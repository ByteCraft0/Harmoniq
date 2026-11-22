package com.bytecraft.harmoniqlite;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Harmoniq Lite Native Android Audio Player Plugin.
 * Powers high-fidelity background audio playback, queue transitions,
 * seeking, and state notifications via AndroidX Media3 ExoPlayer and HarmoniqMediaService.
 */
@CapacitorPlugin(
    name = "HarmoniqAudioPlayer",
    permissions = {
        @Permission(
            strings = { Manifest.permission.POST_NOTIFICATIONS },
            alias = "notifications"
        )
    }
)
public class HarmoniqAudioPlayerPlugin extends Plugin {
    private static HarmoniqAudioPlayerPlugin sInstance = null;

    public static HarmoniqAudioPlayerPlugin getInstance() {
        return sInstance;
    }

    private ExoPlayer mPlayer = null;
    private Handler mHandler = null;
    private Runnable mProgressRunnable = null;
    private String mCurrentTrackId = null;
    private boolean mListenersAttached = false;

    private JSONObject mLocalCurrentTrack = null;
    private List<JSONObject> mLocalQueue = new ArrayList<>();
    private int mLocalQueueIndex = 0;

    private final ServiceConnection mServiceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && service.getPlayer() != null) {
                if (mPlayer != null && mPlayer != service.getPlayer()) {
                    try {
                        mPlayer.stop();
                        mPlayer.release();
                    } catch (Exception ignored) {}
                }
                mPlayer = service.getPlayer();
                mListenersAttached = false;
                attachPlayerListeners();
                notifyState();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
        }
    };

    @Override
    public void load() {
        super.load();
        sInstance = this;
        mHandler = new Handler(Looper.getMainLooper());
        Context context = getContext();
        try {
            Intent intent = new Intent(context, HarmoniqMediaService.class);
            context.startService(intent);
            context.bindService(intent, mServiceConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception ignored) {}
        mHandler.post(this::initPlayer);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (mHandler != null) {
            mHandler.post(() -> {
                initPlayer();
                notifyState();
            });
        }
    }

    private synchronized void initPlayer() {
        HarmoniqMediaService service = HarmoniqMediaService.getInstance();
        if (service != null && service.getPlayer() != null) {
            if (mPlayer != null && mPlayer != service.getPlayer()) {
                try {
                    mPlayer.stop();
                    mPlayer.release();
                } catch (Exception ignored) {}
            }
            mPlayer = service.getPlayer();
            if (!mListenersAttached) {
                attachPlayerListeners();
            }
            return;
        }

        Context context = getContext();
        try {
            Intent intent = new Intent(context, HarmoniqMediaService.class);
            context.startService(intent);
            context.bindService(intent, mServiceConnection, Context.BIND_AUTO_CREATE);
        } catch (Exception ignored) {}

        service = HarmoniqMediaService.getInstance();
        if (service != null && service.getPlayer() != null) {
            if (mPlayer != null && mPlayer != service.getPlayer()) {
                try {
                    mPlayer.stop();
                    mPlayer.release();
                } catch (Exception ignored) {}
            }
            mPlayer = service.getPlayer();
            if (!mListenersAttached) {
                attachPlayerListeners();
            }
            return;
        }

        if (mPlayer != null) return;

        // Fallback temporary player initialization if service startup is delayed
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        mPlayer = new ExoPlayer.Builder(context)
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build();
        attachPlayerListeners();
    }

    private void attachPlayerListeners() {
        if (mPlayer == null || mListenersAttached) return;
        mListenersAttached = true;

        mPlayer.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                notifyState();
                if (isPlaying) {
                    startProgressTracker();
                } else {
                    stopProgressTracker();
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                notifyState();
                if (playbackState == Player.STATE_ENDED) {
                    JSObject ret = new JSObject();
                    ret.put("trackId", mCurrentTrackId);
                    notifyListeners("trackEnded", ret);
                }
            }

            @Override
            public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                if (mediaItem != null) {
                    mCurrentTrackId = mediaItem.mediaId;
                }
                notifyState();
            }

            @Override
            public void onMediaMetadataChanged(MediaMetadata mediaMetadata) {
                JSObject ret = new JSObject();
                if (mediaMetadata.title != null) {
                    ret.put("title", mediaMetadata.title.toString());
                }
                if (mediaMetadata.artist != null) {
                    ret.put("artist", mediaMetadata.artist.toString());
                }
                ret.put("trackId", mCurrentTrackId);
                notifyListeners("metadataChanged", ret);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                JSObject ret = new JSObject();
                ret.put("errorCode", error.errorCode);
                ret.put("errorCodeName", error.getErrorCodeName());
                ret.put("message", error.getMessage() != null ? error.getMessage() : "Playback failed");
                ret.put("trackId", mCurrentTrackId);
                notifyListeners("playbackError", ret);
            }
        });
    }

    private void startProgressTracker() {
        stopProgressTracker();
        mProgressRunnable = new Runnable() {
            @Override
            public void run() {
                if (mPlayer != null && mPlayer.isPlaying()) {
                    notifyState();
                    mHandler.postDelayed(this, 500);
                }
            }
        };
        mHandler.postDelayed(mProgressRunnable, 500);
    }

    private void stopProgressTracker() {
        if (mProgressRunnable != null) {
            mHandler.removeCallbacks(mProgressRunnable);
            mProgressRunnable = null;
        }
    }

    private void notifyState() {
        if (mPlayer == null) return;
        JSObject ret = getCurrentStateObject();
        notifyListeners("playbackStateChange", ret);
    }

    private JSObject getCurrentStateObject() {
        HarmoniqMediaService service = HarmoniqMediaService.getInstance();
        if (service != null && service.getPlayer() != null) {
            return service.getPlaybackSnapshot();
        }

        JSObject ret = new JSObject();
        if (mPlayer != null) {
            ret.put("isPlaying", mPlayer.isPlaying());
            ret.put("currentTime", mPlayer.getCurrentPosition() / 1000.0);
            long dur = mPlayer.getDuration();
            ret.put("duration", dur > 0 ? dur / 1000.0 : 0.0);
            ret.put("trackId", mCurrentTrackId);
            ret.put("volume", (double) mPlayer.getVolume());
            ret.put("currentQueueIndex", mPlayer.getCurrentMediaItemIndex());
            ret.put("isLive", mPlayer.isCurrentMediaItemLive());
            ret.put("isBuffering", mPlayer.getPlaybackState() == Player.STATE_BUFFERING);

            if (mLocalCurrentTrack != null) {
                try {
                    ret.put("track", new JSObject(mLocalCurrentTrack.toString()));
                } catch (Exception ignored) {}
            }
            if (mLocalQueue != null && !mLocalQueue.isEmpty()) {
                JSArray qArray = new JSArray();
                for (JSONObject q : mLocalQueue) {
                    try {
                        qArray.put(new JSObject(q.toString()));
                    } catch (Exception ignored) {}
                }
                ret.put("queue", qArray);
            }
        } else {
            ret.put("isPlaying", false);
            ret.put("currentTime", 0.0);
            ret.put("duration", 0.0);
            ret.put("trackId", null);
            ret.put("volume", 1.0);
        }
        return ret;
    }

    private Uri parseMediaUri(String filePath) {
        if (filePath == null || filePath.trim().isEmpty()) {
            return Uri.EMPTY;
        }
        if (filePath.startsWith("content://") || filePath.startsWith("file://") || filePath.startsWith("http://") || filePath.startsWith("https://")) {
            return Uri.parse(filePath);
        }
        return Uri.fromFile(new File(filePath));
    }

    @PluginMethod
    public void play(PluginCall call) {
        JSObject track = call.getObject("track");
        if (track == null) {
            call.reject("No track provided");
            return;
        }

        mHandler.post(() -> {
            initPlayer();
            if (mPlayer == null) {
                call.reject("Failed to initialize player");
                return;
            }

            String trackId = track.getString("id");
            String filePath = track.getString("filePath");
            String title = track.getString("title", "Unknown Track");
            String artist = track.getString("artist", "Unknown Artist");
            String album = track.getString("album", "Unknown Album");
            String artworkUri = track.getString("artworkDataUrl", null);

            if (filePath == null || filePath.isEmpty()) {
                call.reject("Invalid audio file URI");
                return;
            }

            mCurrentTrackId = trackId;
            JSONObject trackJson = null;
            try {
                trackJson = new JSONObject(track.toString());
            } catch (Exception ignored) {}
            mLocalCurrentTrack = trackJson;
            Uri parsedUri = parseMediaUri(filePath);

            // Prepare MediaItem
            MediaItem.Builder builder = new MediaItem.Builder()
                    .setUri(parsedUri)
                    .setMediaId(trackId != null ? trackId : filePath);

            MediaMetadata.Builder meta = new MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album);

            if (artworkUri != null && !artworkUri.isEmpty()) {
                try {
                    meta.setArtworkUri(parseMediaUri(artworkUri));
                    File artFile = new File(artworkUri);
                    if (artFile.exists() && artFile.length() > 0 && artFile.length() < 1000000) {
                        try (FileInputStream fis = new FileInputStream(artFile)) {
                            byte[] data = new byte[(int) artFile.length()];
                            int read = fis.read(data);
                            if (read > 0) {
                                meta.setArtworkData(data, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
            builder.setMediaMetadata(meta.build());

            JSArray queue = call.getArray("queue");
            List<JSONObject> queueJsonList = new ArrayList<>();
            int startIndex = 0;

            if (queue != null && queue.length() > 0) {
                List<MediaItem> mediaItems = new ArrayList<>();

                for (int i = 0; i < queue.length(); i++) {
                    try {
                        JSONObject qTrack = queue.getJSONObject(i);
                        queueJsonList.add(qTrack);
                        String qId = qTrack.optString("id");
                        String qPath = qTrack.optString("filePath");
                        if (qPath != null && !qPath.isEmpty()) {
                            MediaItem.Builder qb = new MediaItem.Builder()
                                    .setUri(parseMediaUri(qPath))
                                    .setMediaId(qId);
                            MediaMetadata.Builder qMeta = new MediaMetadata.Builder()
                                    .setTitle(qTrack.optString("title", "Track"))
                                    .setArtist(qTrack.optString("artist", ""))
                                    .setAlbumTitle(qTrack.optString("album", ""));
                            String qArt = qTrack.optString("artworkDataUrl");
                            if (qArt != null && !qArt.isEmpty()) {
                                try {
                                    qMeta.setArtworkUri(parseMediaUri(qArt));
                                } catch (Exception ignored) {}
                            }
                            qb.setMediaMetadata(qMeta.build());
                            mediaItems.add(qb.build());

                            if (trackId != null && trackId.equals(qId)) {
                                startIndex = mediaItems.size() - 1;
                            }
                        }
                    } catch (JSONException ignored) {}
                }

                if (!mediaItems.isEmpty()) {
                    mPlayer.setMediaItems(mediaItems, startIndex, 0);
                } else {
                    mPlayer.setMediaItem(builder.build());
                }
            } else {
                mPlayer.setMediaItem(builder.build());
            }

            mLocalQueue = queueJsonList;
            mLocalQueueIndex = startIndex;

            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.setUserExplicitlyPaused(false);
                service.updatePlaybackQueue(trackJson, queueJsonList, startIndex);
            }

            mPlayer.prepare();
            mPlayer.play();

            JSObject ret = new JSObject();
            ret.put("status", "playing");
            ret.put("trackId", trackId);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.setUserExplicitlyPaused(true);
            }
            if (mPlayer != null) {
                mPlayer.pause();
            }
            JSObject ret = new JSObject();
            ret.put("status", "paused");
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.setUserExplicitlyPaused(false);
            }
            if (mPlayer != null) {
                mPlayer.play();
            }
            JSObject ret = new JSObject();
            ret.put("status", "resumed");
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double position = call.getDouble("position", 0.0);
        mHandler.post(() -> {
            if (mPlayer != null && position != null) {
                mPlayer.seekTo((long) (position * 1000));
            }
            JSObject ret = new JSObject();
            ret.put("position", position);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume", 1.0);
        mHandler.post(() -> {
            if (mPlayer != null && volume != null) {
                mPlayer.setVolume(volume.floatValue());
            }
            JSObject ret = new JSObject();
            ret.put("volume", volume);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        JSArray queue = call.getArray("queue");
        mHandler.post(() -> {
            initPlayer();
            if (mPlayer == null || queue == null) {
                JSObject ret = new JSObject();
                ret.put("status", "no_op");
                call.resolve(ret);
                return;
            }

            List<JSONObject> queueJsonList = new ArrayList<>();
            List<MediaItem> mediaItems = new ArrayList<>();
            int currentIndex = -1;

            for (int i = 0; i < queue.length(); i++) {
                try {
                    JSONObject qTrack = queue.getJSONObject(i);
                    queueJsonList.add(qTrack);
                    String qId = qTrack.optString("id");
                    String qPath = qTrack.optString("filePath");
                    if (qPath != null && !qPath.isEmpty()) {
                        MediaItem.Builder qb = new MediaItem.Builder()
                                .setUri(parseMediaUri(qPath))
                                .setMediaId(qId);
                        MediaMetadata.Builder qMeta = new MediaMetadata.Builder()
                                .setTitle(qTrack.optString("title", "Track"))
                                .setArtist(qTrack.optString("artist", ""))
                                .setAlbumTitle(qTrack.optString("album", ""));
                        String qArt = qTrack.optString("artworkDataUrl");
                        if (qArt != null && !qArt.isEmpty()) {
                            try {
                                qMeta.setArtworkUri(parseMediaUri(qArt));
                            } catch (Exception ignored) {}
                        }
                        qb.setMediaMetadata(qMeta.build());
                        mediaItems.add(qb.build());

                        if (mCurrentTrackId != null && mCurrentTrackId.equals(qId) && currentIndex == -1) {
                            currentIndex = mediaItems.size() - 1;
                        }
                    }
                } catch (JSONException ignored) {}
            }

            if (!mediaItems.isEmpty()) {
                long currentPos = mPlayer.getCurrentPosition();
                int targetIndex = currentIndex >= 0 ? currentIndex : Math.min(mPlayer.getCurrentMediaItemIndex(), mediaItems.size() - 1);
                if (targetIndex < 0) targetIndex = 0;

                mPlayer.setMediaItems(mediaItems, targetIndex, currentPos);
                mLocalQueue = queueJsonList;
                mLocalQueueIndex = targetIndex;
            } else {
                mLocalQueue = queueJsonList;
            }

            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.updatePlaybackQueue(mLocalCurrentTrack, queueJsonList, mLocalQueueIndex);
            }

            JSObject ret = new JSObject();
            ret.put("status", "queue_updated");
            ret.put("queueLength", queueJsonList.size());
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void skipToNext(PluginCall call) {
        mHandler.post(() -> {
            if (mPlayer != null && mPlayer.hasNextMediaItem()) {
                mPlayer.seekToNextMediaItem();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void skipToPrevious(PluginCall call) {
        mHandler.post(() -> {
            if (mPlayer != null) {
                if (mPlayer.getCurrentPosition() > 3000 || !mPlayer.hasPreviousMediaItem()) {
                    mPlayer.seekTo(0);
                } else {
                    mPlayer.seekToPreviousMediaItem();
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        mHandler.post(() -> {
            initPlayer();
            call.resolve(getCurrentStateObject());
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        mHandler.post(() -> {
            initPlayer();
            call.resolve(getCurrentStateObject());
        });
    }

    public void notifySleepTimerExpired() {
        mHandler.post(() -> {
            JSObject ret = new JSObject();
            ret.put("status", "expired");
            notifyListeners("sleepTimerExpired", ret);
            notifyState();
        });
    }

    public void notifyNativePlayerError(PlaybackException error) {
        mHandler.post(() -> {
            JSObject ret = new JSObject();
            ret.put("errorCode", error != null ? error.errorCode : -1);
            ret.put("errorCodeName", error != null ? error.getErrorCodeName() : "UNKNOWN");
            ret.put("message", error != null && error.getMessage() != null ? error.getMessage() : "Playback failed");
            ret.put("trackId", mCurrentTrackId);
            notifyListeners("playbackError", ret);
            notifyState();
        });
    }

    @PluginMethod
    public void setStopAfterCurrentTrack(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.setStopAfterCurrentTrack(enabled);
            }
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        Boolean shuffle = call.getBoolean("shuffle", false);
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && shuffle != null) {
                service.setShuffleMode(shuffle);
            } else if (mPlayer != null && shuffle != null) {
                mPlayer.setShuffleModeEnabled(shuffle);
            }
            notifyState();
            JSObject ret = new JSObject();
            ret.put("shuffle", shuffle);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("repeatMode", "off");
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.setRepeatMode(mode);
            } else if (mPlayer != null) {
                int repeat = Player.REPEAT_MODE_OFF;
                if ("all".equalsIgnoreCase(mode)) repeat = Player.REPEAT_MODE_ALL;
                else if ("one".equalsIgnoreCase(mode)) repeat = Player.REPEAT_MODE_ONE;
                mPlayer.setRepeatMode(repeat);
            }
            notifyState();
            JSObject ret = new JSObject();
            ret.put("repeatMode", mode);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getEqualizerParameters(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                call.resolve(service.getEqualizerParameters());
            } else {
                JSObject fallback = new JSObject();
                fallback.put("supported", false);
                fallback.put("enabled", false);
                fallback.put("numBands", 0);
                fallback.put("bands", new JSArray());
                fallback.put("presets", new JSArray());
                fallback.put("currentPreset", "Flat");
                call.resolve(fallback);
            }
        });
    }

    @PluginMethod
    public void setEqualizerEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && enabled != null) {
                service.setEqualizerEnabled(enabled);
            }
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setEqualizerBandGain(PluginCall call) {
        Integer band = call.getInt("band");
        Double gainDb = call.getDouble("gainDb", 0.0);
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && band != null && gainDb != null) {
                service.setEqualizerBandGain(band, gainDb.floatValue());
            }
            JSObject ret = new JSObject();
            ret.put("band", band);
            ret.put("gainDb", gainDb);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setEqualizerPreset(PluginCall call) {
        String preset = call.getString("preset", "Flat");
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && preset != null) {
                service.setEqualizerPreset(preset);
            }
            JSObject ret = new JSObject();
            ret.put("preset", preset);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void resetEqualizer(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.resetEqualizer();
            }
            JSObject ret = new JSObject();
            ret.put("reset", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void startSleepTimer(PluginCall call) {
        Integer minutes = call.getInt("minutes", 15);
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null && minutes != null) {
                service.startSleepTimer(minutes);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("minutes", minutes);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void cancelSleepTimer(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                service.cancelSleepTimer();
            }
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getSleepTimerStatus(PluginCall call) {
        mHandler.post(() -> {
            HarmoniqMediaService service = HarmoniqMediaService.getInstance();
            if (service != null) {
                call.resolve(service.getSleepTimerStatus());
            } else {
                JSObject ret = new JSObject();
                ret.put("isActive", false);
                ret.put("secondsRemaining", 0);
                ret.put("totalSeconds", 0);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void setEqBands(PluginCall call) {
        JSArray bands = call.getArray("bands");
        if (bands != null) {
            mHandler.post(() -> {
                HarmoniqMediaService service = HarmoniqMediaService.getInstance();
                if (service != null) {
                    for (int i = 0; i < bands.length(); i++) {
                        try {
                            double gain = bands.getDouble(i);
                            service.setEqualizerBandGain(i, (float) gain);
                        } catch (Exception ignored) {}
                    }
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void setPreamp(PluginCall call) {
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopProgressTracker();
        try {
            getContext().unbindService(mServiceConnection);
        } catch (Exception ignored) {}
        sInstance = null;
        super.handleOnDestroy();
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= 33) {
            boolean granted = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
            boolean shouldShowRationale = false;
            if (getActivity() != null) {
                shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                    getActivity(),
                    Manifest.permission.POST_NOTIFICATIONS
                );
            }
            ret.put("granted", granted);
            ret.put("shouldShowRationale", shouldShowRationale);
        } else {
            ret.put("granted", true);
            ret.put("shouldShowRationale", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    1002
                );
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Failed to open notification settings: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void getStopOnTaskRemoved(PluginCall call) {
        JSObject ret = new JSObject();
        boolean enabled = true;
        HarmoniqMediaService service = HarmoniqMediaService.getInstance();
        if (service != null) {
            enabled = service.isStopOnTaskRemovedEnabled();
        } else {
            try {
                SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String val = prefs.getString("harmoniq_stop_on_task_removed", null);
                if (val != null) {
                    enabled = Boolean.parseBoolean(val);
                } else {
                    enabled = prefs.getBoolean("harmoniq_stop_on_task_removed", true);
                }
            } catch (Exception ignored) {
                enabled = true;
            }
        }
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setStopOnTaskRemoved(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        HarmoniqMediaService service = HarmoniqMediaService.getInstance();
        if (service != null) {
            service.setStopOnTaskRemoved(enabled);
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            prefs.edit().putString("harmoniq_stop_on_task_removed", String.valueOf(enabled)).apply();
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }
}
