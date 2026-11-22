package com.bytecraft.harmoniqlite;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Size;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Harmoniq Lite Native Media Scanner & Storage Access Framework Bridge.
 * Features:
 * 1. Android MediaStore scanning (MP3, FLAC, WAV, AAC, OGG, OPUS).
 * 2. Storage Access Framework (SAF) ACTION_OPEN_DOCUMENT_TREE directory picker.
 * 3. Persistable URI permissions across app reboots.
 * 4. Recursive folder scanning with MediaMetadataRetriever.
 * 5. Deduplication across MediaStore and SAF folders.
 * 6. Companion local .lrc lyrics resolution.
 */
@CapacitorPlugin(
    name = "HarmoniqMediaScanner",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_AUDIO },
            alias = "media_audio"
        ),
        @Permission(
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "storage"
        )
    }
)
public class HarmoniqMediaScannerPlugin extends Plugin {
    private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();
    private final Map<Long, String> mAlbumArtCache = new ConcurrentHashMap<>();

    private String getOrExtractAlbumArt(Context context, long albumId) {
        if (albumId <= 0) return null;
        if (mAlbumArtCache.containsKey(albumId)) {
            String cached = mAlbumArtCache.get(albumId);
            return (cached != null && !cached.isEmpty()) ? cached : null;
        }

        try {
            File cacheDir = new File(context.getCacheDir(), "album_art");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File artFile = new File(cacheDir, albumId + ".jpg");
            if (artFile.exists() && artFile.length() > 0) {
                String path = artFile.getAbsolutePath();
                mAlbumArtCache.put(albumId, path);
                return path;
            }

            Bitmap bitmap = null;
            if (Build.VERSION.SDK_INT >= 29) {
                try {
                    Uri albumUri = ContentUris.withAppendedId(
                        MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI,
                        albumId
                    );
                    bitmap = context.getContentResolver().loadThumbnail(albumUri, new Size(300, 300), null);
                } catch (Exception ignored) {}
            }

            if (bitmap == null) {
                try {
                    Uri sArtworkUri = Uri.parse("content://media/external/audio/albumart");
                    Uri albumArtUri = ContentUris.withAppendedId(sArtworkUri, albumId);
                    try (InputStream is = context.getContentResolver().openInputStream(albumArtUri)) {
                        if (is != null) {
                            bitmap = BitmapFactory.decodeStream(is);
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (bitmap != null) {
                try (FileOutputStream fos = new FileOutputStream(artFile)) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, fos);
                    fos.flush();
                    String path = artFile.getAbsolutePath();
                    mAlbumArtCache.put(albumId, path);
                    return path;
                } finally {
                    bitmap.recycle();
                }
            }
        } catch (Exception ignored) {}

        mAlbumArtCache.put(albumId, "");
        return null;
    }

    @PluginMethod
    public void checkAudioPermission(PluginCall call) {
        boolean granted = hasAudioPermission();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        ret.put("permissionRequired", Build.VERSION.SDK_INT >= 33 ? "READ_MEDIA_AUDIO" : "READ_EXTERNAL_STORAGE");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAudioPermission(PluginCall call) {
        if (hasAudioPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAlias("media_audio", call, "audioPermissionCallback");
        } else {
            requestPermissionForAlias("storage", call, "audioPermissionCallback");
        }
    }

    @PermissionCallback
    private void audioPermissionCallback(PluginCall call) {
        boolean granted = hasAudioPermission();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    private boolean hasAudioPermission() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void scanMediaStore(PluginCall call) {
        if (!hasAudioPermission()) {
            JSObject ret = new JSObject();
            ret.put("status", "permission_denied");
            ret.put("tracks", new JSArray());
            ret.put("totalScanned", 0);
            ret.put("message", "Storage audio permission has not been granted.");
            call.resolve(ret);
            return;
        }

        mExecutor.execute(() -> {
            try {
                Context context = getContext();
                ContentResolver resolver = context.getContentResolver();

                String[] projection = {
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.ALBUM_ID,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.DATA,
                    MediaStore.Audio.Media.MIME_TYPE,
                    MediaStore.Audio.Media.SIZE,
                    MediaStore.Audio.Media.YEAR,
                    MediaStore.Audio.Media.TRACK,
                    MediaStore.Audio.Media.DATE_MODIFIED
                };

                String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " >= 1000";
                String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

                List<JSObject> trackList = new ArrayList<>();
                Set<String> seenIds = new HashSet<>();

                try (Cursor cursor = resolver.query(
                    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    null,
                    sortOrder
                )) {
                    if (cursor != null) {
                        int idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                        int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                        int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                        int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                        int albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);
                        int durCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                        int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                        int mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
                        int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                        int yearCol = cursor.getColumnIndex(MediaStore.Audio.Media.YEAR);
                        int trackCol = cursor.getColumnIndex(MediaStore.Audio.Media.TRACK);
                        int modCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED);

                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(idCol);
                            String uniqueId = "android_ms_" + id;
                            if (seenIds.contains(uniqueId)) continue;
                            seenIds.add(uniqueId);

                            String title = cursor.getString(titleCol);
                            String artist = cursor.getString(artistCol);
                            String album = cursor.getString(albumCol);
                            long albumId = cursor.getLong(albumIdCol);
                            long durationMs = cursor.getLong(durCol);
                            String rawPath = cursor.getString(dataCol);
                            String mimeType = cursor.getString(mimeCol);
                            long size = cursor.getLong(sizeCol);
                            int year = cursor.getInt(yearCol);
                            int trackNumber = cursor.getInt(trackCol);
                            long dateModifiedSec = cursor.getLong(modCol);

                            Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                            String finalPath = (rawPath != null && !rawPath.isEmpty()) ? rawPath : contentUri.toString();
                            String fileName = rawPath != null ? new File(rawPath).getName() : (title != null ? title : "Track_" + id);

                            if (title == null || title.trim().isEmpty()) {
                                title = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
                            }
                            if (artist == null || artist.trim().isEmpty() || "<unknown>".equalsIgnoreCase(artist)) {
                                artist = "Unknown Artist";
                            }
                            if (album == null || album.trim().isEmpty() || "<unknown>".equalsIgnoreCase(album)) {
                                album = "Unknown Album";
                            }

                            String codec = determineCodec(mimeType, fileName);
                            boolean isLossless = isLosslessCodec(codec);
                            String artworkPath = getOrExtractAlbumArt(context, albumId);

                            JSObject track = new JSObject();
                            track.put("id", uniqueId);
                            track.put("filePath", contentUri.toString());
                            track.put("fileName", fileName);
                            track.put("fileSize", size);
                            track.put("dateModified", dateModifiedSec > 0 ? dateModifiedSec * 1000L : System.currentTimeMillis());
                            track.put("title", title);
                            track.put("artist", artist);
                            track.put("album", album);
                            track.put("year", year > 0 ? year : null);
                            track.put("trackNumber", trackNumber > 0 ? trackNumber : null);
                            track.put("hasArtwork", artworkPath != null);
                            if (artworkPath != null) {
                                track.put("artworkDataUrl", artworkPath);
                            }
                            track.put("codec", codec);
                            track.put("container", codec.toLowerCase());
                            track.put("duration", durationMs > 0 ? durationMs / 1000.0 : 0.0);
                            track.put("sampleRate", 44100);
                            track.put("bitrate", isLossless ? 920 : 320);
                            track.put("channels", 2);
                            track.put("isLossless", isLossless);
                            track.put("playCount", 0);
                            track.put("isFavorite", false);

                            trackList.add(track);
                        }
                    }
                }

                JSArray tracksArray = new JSArray();
                for (JSObject t : trackList) {
                    tracksArray.put(t);
                }

                JSObject ret = new JSObject();
                ret.put("status", "success");
                ret.put("tracks", tracksArray);
                ret.put("totalScanned", trackList.size());
                call.resolve(ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("status", "error");
                ret.put("message", e.getMessage());
                ret.put("tracks", new JSArray());
                ret.put("totalScanned", 0);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void openFolderPicker(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(call, intent, "folderPickerResult");
        } catch (Exception e) {
            call.reject("Failed to launch Storage Access Framework folder picker: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            Uri treeUri = data.getData();
            if (treeUri == null) {
                call.reject("No directory selected");
                return;
            }

            // Persist read URI permission across restarts
            try {
                getContext().getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (SecurityException ignored) {}

            DocumentFile docTree = DocumentFile.fromTreeUri(getContext(), treeUri);
            String folderName = docTree != null && docTree.getName() != null ? docTree.getName() : treeUri.getLastPathSegment();

            JSObject ret = new JSObject();
            ret.put("uri", treeUri.toString());
            ret.put("name", folderName != null ? folderName : "Music Folder");
            call.resolve(ret);
        } else {
            call.reject("Folder selection cancelled by user");
        }
    }

    @PluginMethod
    public void scanFolder(PluginCall call) {
        String folderUriStr = call.getString("folderUri");
        if (folderUriStr == null || folderUriStr.trim().isEmpty()) {
            call.reject("folderUri is required");
            return;
        }

        mExecutor.execute(() -> {
            try {
                Context context = getContext();
                Uri folderUri = Uri.parse(folderUriStr);
                DocumentFile rootDir = DocumentFile.fromTreeUri(context, folderUri);
                if (rootDir == null || !rootDir.exists() || !rootDir.isDirectory()) {
                    JSObject err = new JSObject();
                    err.put("status", "error");
                    err.put("folderAccessible", false);
                    err.put("tracks", new JSArray());
                    err.put("totalScanned", 0);
                    err.put("message", "Cannot access directory");
                    call.resolve(err);
                    return;
                }

                List<JSObject> tracks = new ArrayList<>();
                Set<String> visited = new HashSet<>();
                scanDocumentFileRecursively(context, rootDir, tracks, visited, 0);

                JSArray tracksArray = new JSArray();
                for (JSObject t : tracks) {
                    tracksArray.put(t);
                }

                JSObject ret = new JSObject();
                ret.put("status", "success");
                ret.put("folderUri", folderUriStr);
                ret.put("folderAccessible", true);
                ret.put("tracks", tracksArray);
                ret.put("totalScanned", tracks.size());
                call.resolve(ret);
            } catch (Exception e) {
                JSObject err = new JSObject();
                err.put("status", "error");
                err.put("folderAccessible", false);
                err.put("tracks", new JSArray());
                err.put("totalScanned", 0);
                err.put("message", e.getMessage());
                call.resolve(err);
            }
        });
    }

    private void scanDocumentFileRecursively(
        Context context,
        DocumentFile dir,
        List<JSObject> tracks,
        Set<String> visited,
        int depth
    ) {
        if (depth > 8) return; // Prevent excessive recursion
        DocumentFile[] files = dir.listFiles();
        if (files == null) return;

        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            for (DocumentFile file : files) {
                if (file.isDirectory()) {
                    scanDocumentFileRecursively(context, file, tracks, visited, depth + 1);
                } else if (file.isFile() && isAudioDocument(file)) {
                    String uriStr = file.getUri().toString();
                    if (visited.contains(uriStr)) continue;
                    visited.add(uriStr);

                    try {
                        mmr.setDataSource(context, file.getUri());

                        String title = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
                        String artist = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
                        String album = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
                        String durStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                        String yearStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR);
                        String trackStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
                        String mimeType = file.getType();

                        String fileName = file.getName() != null ? file.getName() : "AudioFile";
                        if (title == null || title.trim().isEmpty()) {
                            title = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
                        }
                        if (artist == null || artist.trim().isEmpty()) artist = "Unknown Artist";
                        if (album == null || album.trim().isEmpty()) album = "Unknown Album";

                        long durationMs = 0;
                        if (durStr != null) {
                            try { durationMs = Long.parseLong(durStr); } catch (Exception ignored) {}
                        }
                        int year = 0;
                        if (yearStr != null) {
                            try { year = Integer.parseInt(yearStr); } catch (Exception ignored) {}
                        }
                        int trackNumber = 0;
                        if (trackStr != null) {
                            try {
                                if (trackStr.contains("/")) {
                                    trackStr = trackStr.substring(0, trackStr.indexOf('/'));
                                }
                                trackNumber = Integer.parseInt(trackStr.trim());
                            } catch (Exception ignored) {}
                        }

                        String codec = determineCodec(mimeType, fileName);
                        boolean isLossless = isLosslessCodec(codec);
                        String uniqueId = "saf_" + Math.abs(uriStr.hashCode());

                        byte[] embeddedPic = null;
                        try {
                            embeddedPic = mmr.getEmbeddedPicture();
                        } catch (Exception ignored) {}

                        String safArtPath = null;
                        if (embeddedPic != null && embeddedPic.length > 0) {
                            try {
                                File cacheDir = new File(context.getCacheDir(), "album_art");
                                if (!cacheDir.exists()) cacheDir.mkdirs();
                                File artFile = new File(cacheDir, "saf_" + Math.abs(uriStr.hashCode()) + ".jpg");
                                if (!artFile.exists() || artFile.length() == 0) {
                                    try (FileOutputStream fos = new FileOutputStream(artFile)) {
                                        fos.write(embeddedPic);
                                        fos.flush();
                                    }
                                }
                                safArtPath = artFile.getAbsolutePath();
                            } catch (Exception ignored) {}
                        }

                        JSObject track = new JSObject();
                        track.put("id", uniqueId);
                        track.put("filePath", uriStr);
                        track.put("fileName", fileName);
                        track.put("fileSize", file.length());
                        track.put("dateModified", file.lastModified() > 0 ? file.lastModified() : System.currentTimeMillis());
                        track.put("title", title);
                        track.put("artist", artist);
                        track.put("album", album);
                        if (year > 0) track.put("year", year);
                        if (trackNumber > 0) track.put("trackNumber", trackNumber);
                        track.put("hasArtwork", safArtPath != null);
                        if (safArtPath != null) {
                            track.put("artworkDataUrl", safArtPath);
                        }
                        track.put("codec", codec);
                        track.put("container", codec.toLowerCase());
                        track.put("duration", durationMs > 0 ? durationMs / 1000.0 : 0.0);
                        track.put("sampleRate", 44100);
                        track.put("bitrate", isLossless ? 920 : 320);
                        track.put("channels", 2);
                        track.put("isLossless", isLossless);
                        track.put("playCount", 0);
                        track.put("isFavorite", false);

                        tracks.add(track);
                    } catch (Exception ignored) {
                        // Skip unreadable audio file without crashing scan
                    }
                }
            }
        } finally {
            try {
                mmr.release();
            } catch (Exception ignored) {}
        }
    }

    private boolean isAudioDocument(DocumentFile file) {
        String type = file.getType();
        if (type != null && type.startsWith("audio/")) return true;
        String name = file.getName();
        if (name != null) {
            String lower = name.toLowerCase();
            return lower.endsWith(".mp3") || lower.endsWith(".flac") || lower.endsWith(".wav") ||
                   lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".ogg") ||
                   lower.endsWith(".opus");
        }
        return false;
    }

    @PluginMethod
    public void getPersistedFolders(PluginCall call) {
        Context context = getContext();
        List<UriPermission> permissions = context.getContentResolver().getPersistedUriPermissions();
        JSArray arr = new JSArray();

        for (UriPermission perm : permissions) {
            if (perm.isReadPermission()) {
                Uri uri = perm.getUri();
                DocumentFile doc = DocumentFile.fromTreeUri(context, uri);
                JSObject item = new JSObject();
                item.put("uri", uri.toString());
                item.put("name", doc != null && doc.getName() != null ? doc.getName() : uri.getLastPathSegment());
                arr.put(item);
            }
        }

        JSObject ret = new JSObject();
        ret.put("folders", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void removeFolder(PluginCall call) {
        String folderUriStr = call.getString("folderUri");
        if (folderUriStr != null) {
            try {
                Uri uri = Uri.parse(folderUriStr);
                getContext().getContentResolver().releasePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void readCompanionLrc(PluginCall call) {
        String audioFilePath = call.getString("audioFilePath");
        if (audioFilePath == null || audioFilePath.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("content", null);
            call.resolve(ret);
            return;
        }

        mExecutor.execute(() -> {
            try {
                Context context = getContext();
                // Check if file path is direct filesystem path
                if (audioFilePath.startsWith("/") || audioFilePath.startsWith("file://")) {
                    String cleanPath = audioFilePath.startsWith("file://") ? audioFilePath.substring(7) : audioFilePath;
                    File audioFile = new File(cleanPath);
                    if (audioFile.exists()) {
                        String name = audioFile.getName();
                        int dot = name.lastIndexOf('.');
                        String base = dot > 0 ? name.substring(0, dot) : name;
                        File lrcFile = new File(audioFile.getParentFile(), base + ".lrc");
                        if (lrcFile.exists() && lrcFile.canRead()) {
                            StringBuilder sb = new StringBuilder();
                            try (InputStream is = context.getContentResolver().openInputStream(Uri.fromFile(lrcFile));
                                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                                String line;
                                while ((line = reader.readLine()) != null) {
                                    sb.append(line).append("\n");
                                }
                            }
                            JSObject ret = new JSObject();
                            ret.put("content", sb.toString());
                            call.resolve(ret);
                            return;
                        }
                    }
                }

                // If content URI from SAF
                if (audioFilePath.startsWith("content://")) {
                    Uri audioUri = Uri.parse(audioFilePath);
                    DocumentFile audioDoc = DocumentFile.fromSingleUri(context, audioUri);
                    if (audioDoc != null && audioDoc.getParentFile() != null) {
                        DocumentFile parent = audioDoc.getParentFile();
                        String name = audioDoc.getName();
                        if (name != null) {
                            int dot = name.lastIndexOf('.');
                            String base = dot > 0 ? name.substring(0, dot) : name;
                            DocumentFile lrcDoc = parent.findFile(base + ".lrc");
                            if (lrcDoc != null && lrcDoc.exists()) {
                                StringBuilder sb = new StringBuilder();
                                try (InputStream is = context.getContentResolver().openInputStream(lrcDoc.getUri());
                                     BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                                    String line;
                                    while ((line = reader.readLine()) != null) {
                                        sb.append(line).append("\n");
                                    }
                                }
                                JSObject ret = new JSObject();
                                ret.put("content", sb.toString());
                                call.resolve(ret);
                                return;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}

            JSObject ret = new JSObject();
            ret.put("content", null);
            call.resolve(ret);
        });
    }

    private String determineCodec(String mimeType, String name) {
        if (mimeType != null) {
            String lower = mimeType.toLowerCase();
            if (lower.contains("flac")) return "FLAC";
            if (lower.contains("mp3") || lower.contains("mpeg")) return "MP3";
            if (lower.contains("wav") || lower.contains("wave") || lower.contains("x-wav")) return "WAV";
            if (lower.contains("aac") || lower.contains("mp4") || lower.contains("m4a")) return "AAC";
            if (lower.contains("ogg") || lower.contains("vorbis")) return "OGG";
            if (lower.contains("opus")) return "OPUS";
        }
        if (name != null) {
            String lower = name.toLowerCase();
            if (lower.endsWith(".flac")) return "FLAC";
            if (lower.endsWith(".mp3")) return "MP3";
            if (lower.endsWith(".wav")) return "WAV";
            if (lower.endsWith(".m4a") || lower.endsWith(".aac")) return "AAC";
            if (lower.endsWith(".ogg")) return "OGG";
            if (lower.endsWith(".opus")) return "OPUS";
        }
        return "UNKNOWN";
    }

    private boolean isLosslessCodec(String codec) {
        return "FLAC".equalsIgnoreCase(codec) || "WAV".equalsIgnoreCase(codec) ||
               "ALAC".equalsIgnoreCase(codec) || "AIFF".equalsIgnoreCase(codec);
    }

    @Override
    protected void handleOnDestroy() {
        if (mExecutor != null && !mExecutor.isShutdown()) {
            mExecutor.shutdownNow();
        }
        mAlbumArtCache.clear();
        super.handleOnDestroy();
    }
}
