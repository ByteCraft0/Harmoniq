package com.bytecraft.harmoniqlite;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.audiofx.Equalizer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Harmoniq Lite Background Media Playback Service.
 * Implements AndroidX MediaSessionService with foreground playback capabilities,
 * lockscreen and notification transport controls, audio focus handling,
 * wake lock for screen-off playback, and audio becoming noisy auto-pause.
 */
public class HarmoniqMediaService extends MediaSessionService {
    public static final String CHANNEL_ID = "harmoniq_playback_channel";
    public static final String PREFS_NAME = "CapacitorStorage";
    public static final String PREF_KEY_STOP_ON_TASK_REMOVED = "harmoniq_stop_on_task_removed";

    private static HarmoniqMediaService sInstance = null;
    private MediaSession mMediaSession = null;
    private ExoPlayer mPlayer = null;
    private Boolean mStopOnTaskRemovedOverride = null;

    private JSONObject mCurrentTrack = null;
    private List<JSONObject> mCurrentQueue = new ArrayList<>();
    private int mCurrentQueueIndex = 0;

    private Equalizer mEqualizer = null;
    private boolean mEqualizerEnabled = false;
    private String mCurrentPreset = "Flat";
    private final Map<Integer, Float> mBandGains = new HashMap<>();

    private final Handler mSleepTimerHandler = new Handler(Looper.getMainLooper());
    private Runnable mSleepTimerRunnable = null;
    private long mSleepTimerEndTimeMs = 0;
    private long mSleepTimerTotalDurationMs = 0;
    private boolean mSleepTimerActive = false;

    public static HarmoniqMediaService getInstance() {
        return sInstance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;

        // 1. Create playback notification channel on Android 8+ (API 26+)
        createNotificationChannel();

        // 2. Configure audio attributes for music playback with automatic audio focus
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        // 3. Build ExoPlayer with WakeLock (keeps CPU alive while screen is locked)
        mPlayer = new ExoPlayer.Builder(this)
                .setAudioAttributes(audioAttributes, /* handleAudioFocus = */ true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build();

        attachEqualizer();

        // 4. Track transitions so native MediaSession and React UI stay synchronized
        mPlayer.addListener(new Player.Listener() {
            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                if (mPlayer != null) {
                    int index = mPlayer.getCurrentMediaItemIndex();
                    mCurrentQueueIndex = index;
                    if (mCurrentQueue != null && index >= 0 && index < mCurrentQueue.size()) {
                        mCurrentTrack = mCurrentQueue.get(index);
                    }
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) {
                    if (mEqualizer == null) {
                        attachEqualizer();
                    }
                }
            }
        });

        // 4. Create Session Activity PendingIntent to reopen app from notification
        Intent sessionIntent = new Intent(this, MainActivity.class);
        sessionIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent sessionActivity = PendingIntent.getActivity(
                this,
                0,
                sessionIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // 5. Build MediaSession
        mMediaSession = new MediaSession.Builder(this, mPlayer)
                .setSessionActivity(sessionActivity)
                .setId("HarmoniqMediaSession")
                .build();

        // 6. Register session with MediaSessionService & MediaNotificationManager
        addSession(mMediaSession);

        // 7. Configure DefaultMediaNotificationProvider with channel & small icon
        try {
            DefaultMediaNotificationProvider notificationProvider =
                    new DefaultMediaNotificationProvider.Builder(this)
                            .setChannelId(CHANNEL_ID)
                            .setNotificationId(1001)
                            .build();
            notificationProvider.setSmallIcon(R.mipmap.ic_launcher);
            setMediaNotificationProvider(notificationProvider);
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        // START_NOT_STICKY guarantees that if Harmoniq Lite is intentionally dismissed,
        // Android will not automatically revive an empty background service.
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);

        // When the user deliberately swipes Harmoniq Lite away from Android Recent Apps,
        // respect user's explicit intention to terminate playback and release resources.
        if (isStopOnTaskRemovedEnabled()) {
            stopPlaybackAndService();
        }
    }

    public synchronized void setStopOnTaskRemoved(boolean enabled) {
        mStopOnTaskRemovedOverride = enabled;
    }

    public synchronized boolean isStopOnTaskRemovedEnabled() {
        if (mStopOnTaskRemovedOverride != null) {
            return mStopOnTaskRemovedOverride;
        }
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String val = prefs.getString(PREF_KEY_STOP_ON_TASK_REMOVED, null);
            if (val != null) {
                return Boolean.parseBoolean(val);
            }
            return prefs.getBoolean(PREF_KEY_STOP_ON_TASK_REMOVED, true);
        } catch (Exception e) {
            return true; // Default: Enabled
        }
    }

    /**
     * Gracefully stops active audio playback, releases MediaSession and ExoPlayer,
     * strips the foreground media notification, and terminates the background service.
     */
    public synchronized void stopPlaybackAndService() {
        cancelSleepTimer();

        if (mEqualizer != null) {
            try {
                mEqualizer.release();
            } catch (Exception ignored) {}
            mEqualizer = null;
        }

        if (mPlayer != null) {
            try {
                mPlayer.stop();
                mPlayer.clearMediaItems();
            } catch (Exception ignored) {}
        }

        if (mMediaSession != null) {
            try {
                removeSession(mMediaSession);
                mMediaSession.release();
                mMediaSession = null;
            } catch (Exception ignored) {}
        }

        if (mPlayer != null) {
            try {
                mPlayer.release();
                mPlayer = null;
            } catch (Exception ignored) {}
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}

        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(1001);
            }
        } catch (Exception ignored) {}

        sInstance = null;
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Harmoniq Lite Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Harmoniq Lite background music playback controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mMediaSession;
    }

    public ExoPlayer getPlayer() {
        return mPlayer;
    }

    public synchronized void updatePlaybackQueue(JSONObject currentTrack, List<JSONObject> queue, int startIndex) {
        this.mCurrentTrack = currentTrack;
        this.mCurrentQueue = queue != null ? new ArrayList<>(queue) : new ArrayList<>();
        this.mCurrentQueueIndex = startIndex;
    }

    public synchronized JSONObject getCurrentTrack() {
        return mCurrentTrack;
    }

    public synchronized List<JSONObject> getCurrentQueue() {
        return mCurrentQueue;
    }

    public synchronized int getCurrentQueueIndex() {
        if (mPlayer != null) {
            return mPlayer.getCurrentMediaItemIndex();
        }
        return mCurrentQueueIndex;
    }

    public synchronized JSObject getPlaybackSnapshot() {
        JSObject ret = new JSObject();
        if (mPlayer != null) {
            ret.put("isPlaying", mPlayer.isPlaying());
            ret.put("currentTime", mPlayer.getCurrentPosition() / 1000.0);
            long dur = mPlayer.getDuration();
            ret.put("duration", dur > 0 ? dur / 1000.0 : 0.0);
            ret.put("volume", (double) mPlayer.getVolume());
            ret.put("isLive", mPlayer.isCurrentMediaItemLive());
            ret.put("isBuffering", mPlayer.getPlaybackState() == Player.STATE_BUFFERING);

            MediaItem currentItem = mPlayer.getCurrentMediaItem();
            String trackId = null;
            if (currentItem != null && currentItem.mediaId != null) {
                trackId = currentItem.mediaId;
            } else if (mCurrentTrack != null) {
                trackId = mCurrentTrack.optString("id", null);
            }
            ret.put("trackId", trackId);

            int queueIndex = mPlayer.getCurrentMediaItemIndex();
            ret.put("currentQueueIndex", queueIndex);

            if (mCurrentTrack != null) {
                try {
                    ret.put("track", new JSObject(mCurrentTrack.toString()));
                } catch (Exception ignored) {}
            } else if (currentItem != null && currentItem.mediaMetadata != null) {
                JSObject synth = new JSObject();
                synth.put("id", currentItem.mediaId != null ? currentItem.mediaId : "");
                synth.put("title", currentItem.mediaMetadata.title != null ? currentItem.mediaMetadata.title.toString() : "Unknown Track");
                synth.put("artist", currentItem.mediaMetadata.artist != null ? currentItem.mediaMetadata.artist.toString() : "Unknown Artist");
                synth.put("album", currentItem.mediaMetadata.albumTitle != null ? currentItem.mediaMetadata.albumTitle.toString() : "");
                if (currentItem.mediaMetadata.artworkUri != null) {
                    synth.put("artworkDataUrl", currentItem.mediaMetadata.artworkUri.toString());
                }
                ret.put("track", synth);
            }

            if (mCurrentQueue != null && !mCurrentQueue.isEmpty()) {
                JSArray qArray = new JSArray();
                for (JSONObject qItem : mCurrentQueue) {
                    try {
                        qArray.put(new JSObject(qItem.toString()));
                    } catch (Exception ignored) {}
                }
                ret.put("queue", qArray);
            }
            ret.put("isShuffle", getShuffleMode());
            ret.put("repeatMode", getRepeatModeString());
        } else {
            ret.put("isPlaying", false);
            ret.put("currentTime", 0.0);
            ret.put("duration", 0.0);
            ret.put("trackId", null);
            ret.put("volume", 1.0);
            ret.put("isShuffle", false);
            ret.put("repeatMode", "off");
        }
        return ret;
    }

    public synchronized void attachEqualizer() {
        if (mPlayer == null) return;
        int sessionId = mPlayer.getAudioSessionId();
        if (sessionId == C.AUDIO_SESSION_ID_UNSET || sessionId == 0) return;

        if (mEqualizer != null) {
            try {
                mEqualizer.release();
            } catch (Exception ignored) {}
            mEqualizer = null;
        }

        try {
            mEqualizer = new Equalizer(0, sessionId);
            mEqualizer.setEnabled(mEqualizerEnabled);

            short numBands = mEqualizer.getNumberOfBands();
            short[] range = mEqualizer.getBandLevelRange();
            for (short b = 0; b < numBands; b++) {
                Float gain = mBandGains.get((int) b);
                if (gain != null) {
                    int mb = Math.round(gain * 100.0f);
                    if (mb < range[0]) mb = range[0];
                    if (mb > range[1]) mb = range[1];
                    mEqualizer.setBandLevel(b, (short) mb);
                }
            }
        } catch (Exception e) {
            mEqualizer = null;
        }
    }

    public synchronized JSObject getEqualizerParameters() {
        JSObject ret = new JSObject();
        if (mEqualizer == null) {
            attachEqualizer();
        }

        if (mEqualizer == null) {
            ret.put("supported", false);
            ret.put("enabled", false);
            ret.put("numBands", 0);
            ret.put("bands", new JSArray());
            ret.put("presets", new JSArray());
            ret.put("currentPreset", "Flat");
            return ret;
        }

        try {
            ret.put("supported", true);
            ret.put("enabled", mEqualizer.getEnabled());
            short numBands = mEqualizer.getNumberOfBands();
            ret.put("numBands", (int) numBands);
            short[] range = mEqualizer.getBandLevelRange();
            int minDb = Math.round(range[0] / 100.0f);
            int maxDb = Math.round(range[1] / 100.0f);

            JSArray bandsArray = new JSArray();
            for (short i = 0; i < numBands; i++) {
                JSObject bandObj = new JSObject();
                bandObj.put("band", (int) i);
                bandObj.put("centerFreq", mEqualizer.getCenterFreq(i) / 1000); // in Hz
                bandObj.put("minLevel", minDb);
                bandObj.put("maxLevel", maxDb);
                short level = mEqualizer.getBandLevel(i);
                bandObj.put("currentLevel", Math.round(level / 100.0f));
                bandsArray.put(bandObj);
            }
            ret.put("bands", bandsArray);

            JSArray presetsArray = new JSArray();
            String[] builtIns = new String[]{"Flat", "Bass Boost", "Vocal", "Rock", "Pop", "Classical", "Jazz", "Electronic"};
            for (String p : builtIns) {
                presetsArray.put(p);
            }
            ret.put("presets", presetsArray);
            ret.put("currentPreset", mCurrentPreset);
        } catch (Exception e) {
            ret.put("supported", false);
            ret.put("enabled", false);
            ret.put("numBands", 0);
            ret.put("bands", new JSArray());
            ret.put("presets", new JSArray());
            ret.put("currentPreset", "Flat");
        }

        return ret;
    }

    public synchronized void setEqualizerEnabled(boolean enabled) {
        mEqualizerEnabled = enabled;
        if (mEqualizer == null) {
            attachEqualizer();
        }
        if (mEqualizer != null) {
            try {
                mEqualizer.setEnabled(enabled);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void setEqualizerBandGain(int band, float gainDb) {
        if (mEqualizer == null) {
            attachEqualizer();
        }
        mBandGains.put(band, gainDb);
        mCurrentPreset = "Custom";
        if (mEqualizer != null) {
            try {
                short[] range = mEqualizer.getBandLevelRange();
                int mb = Math.round(gainDb * 100.0f);
                if (mb < range[0]) mb = range[0];
                if (mb > range[1]) mb = range[1];
                mEqualizer.setBandLevel((short) band, (short) mb);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void setEqualizerPreset(String presetName) {
        if (mEqualizer == null) {
            attachEqualizer();
        }
        mCurrentPreset = presetName;
        if (mEqualizer == null) return;

        try {
            short numBands = mEqualizer.getNumberOfBands();
            short[] range = mEqualizer.getBandLevelRange();

            float[] gains = new float[numBands];
            if ("Flat".equalsIgnoreCase(presetName)) {
                // all 0
            } else if ("Bass Boost".equalsIgnoreCase(presetName)) {
                if (numBands > 0) gains[0] = 6.0f;
                if (numBands > 1) gains[1] = 4.5f;
                if (numBands > 2) gains[2] = 2.0f;
            } else if ("Vocal".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = -2.0f;
                    gains[1] = -1.0f;
                    gains[2] = 3.5f;
                    gains[3] = 4.0f;
                    gains[4] = 1.0f;
                } else if (numBands > 0) {
                    int mid = numBands / 2;
                    gains[mid] = 4.0f;
                }
            } else if ("Rock".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = 4.0f;
                    gains[1] = 2.0f;
                    gains[2] = -1.0f;
                    gains[3] = 2.0f;
                    gains[4] = 4.0f;
                }
            } else if ("Pop".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = 2.0f;
                    gains[1] = 3.0f;
                    gains[2] = 3.5f;
                    gains[3] = 2.0f;
                    gains[4] = 1.5f;
                }
            } else if ("Classical".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = 3.0f;
                    gains[1] = 2.0f;
                    gains[2] = -1.0f;
                    gains[3] = 2.0f;
                    gains[4] = 3.0f;
                }
            } else if ("Jazz".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = 3.0f;
                    gains[1] = 1.5f;
                    gains[2] = -1.0f;
                    gains[3] = 1.5f;
                    gains[4] = 2.5f;
                }
            } else if ("Electronic".equalsIgnoreCase(presetName)) {
                if (numBands >= 5) {
                    gains[0] = 6.0f;
                    gains[1] = 4.5f;
                    gains[2] = 0.0f;
                    gains[3] = 3.0f;
                    gains[4] = 5.0f;
                }
            }

            for (short i = 0; i < numBands; i++) {
                float g = gains[i];
                mBandGains.put((int) i, g);
                int mb = Math.round(g * 100.0f);
                if (mb < range[0]) mb = range[0];
                if (mb > range[1]) mb = range[1];
                mEqualizer.setBandLevel(i, (short) mb);
            }
        } catch (Exception ignored) {}
    }

    public synchronized void resetEqualizer() {
        setEqualizerPreset("Flat");
    }

    public synchronized void startSleepTimer(int minutes) {
        cancelSleepTimer();
        if (minutes <= 0) return;
        mSleepTimerTotalDurationMs = (long) minutes * 60 * 1000;
        mSleepTimerEndTimeMs = SystemClock.elapsedRealtime() + mSleepTimerTotalDurationMs;
        mSleepTimerActive = true;

        mSleepTimerRunnable = new Runnable() {
            @Override
            public void run() {
                if (!mSleepTimerActive) return;
                long remaining = mSleepTimerEndTimeMs - SystemClock.elapsedRealtime();
                if (remaining <= 0) {
                    triggerSleepTimerExpiration();
                } else {
                    mSleepTimerHandler.postDelayed(this, 1000);
                }
            }
        };
        mSleepTimerHandler.postDelayed(mSleepTimerRunnable, 1000);
    }

    public synchronized void cancelSleepTimer() {
        mSleepTimerActive = false;
        if (mSleepTimerRunnable != null) {
            mSleepTimerHandler.removeCallbacks(mSleepTimerRunnable);
            mSleepTimerRunnable = null;
        }
        mSleepTimerEndTimeMs = 0;
        mSleepTimerTotalDurationMs = 0;
    }

    public synchronized JSObject getSleepTimerStatus() {
        JSObject ret = new JSObject();
        ret.put("isActive", mSleepTimerActive);
        if (mSleepTimerActive) {
            long remaining = Math.max(0, mSleepTimerEndTimeMs - SystemClock.elapsedRealtime());
            ret.put("secondsRemaining", (int) (remaining / 1000));
            ret.put("totalSeconds", (int) (mSleepTimerTotalDurationMs / 1000));
        } else {
            ret.put("secondsRemaining", 0);
            ret.put("totalSeconds", 0);
        }
        return ret;
    }

    private synchronized void triggerSleepTimerExpiration() {
        mSleepTimerActive = false;
        mSleepTimerRunnable = null;
        if (mPlayer != null) {
            mPlayer.pause();
        }
        HarmoniqAudioPlayerPlugin plugin = HarmoniqAudioPlayerPlugin.getInstance();
        if (plugin != null) {
            plugin.notifySleepTimerExpired();
        }
    }

    public synchronized void setShuffleMode(boolean enabled) {
        if (mPlayer != null) {
            mPlayer.setShuffleModeEnabled(enabled);
        }
    }

    public synchronized boolean getShuffleMode() {
        return mPlayer != null && mPlayer.getShuffleModeEnabled();
    }

    public synchronized void setRepeatMode(String mode) {
        if (mPlayer != null) {
            int repeatMode = Player.REPEAT_MODE_OFF;
            if ("all".equalsIgnoreCase(mode)) {
                repeatMode = Player.REPEAT_MODE_ALL;
            } else if ("one".equalsIgnoreCase(mode)) {
                repeatMode = Player.REPEAT_MODE_ONE;
            }
            mPlayer.setRepeatMode(repeatMode);
        }
    }

    public synchronized String getRepeatModeString() {
        if (mPlayer != null) {
            int mode = mPlayer.getRepeatMode();
            if (mode == Player.REPEAT_MODE_ALL) return "all";
            if (mode == Player.REPEAT_MODE_ONE) return "one";
        }
        return "off";
    }

    @Override
    public void onDestroy() {
        if (mEqualizer != null) {
            try {
                mEqualizer.release();
            } catch (Exception ignored) {}
            mEqualizer = null;
        }
        cancelSleepTimer();

        if (mMediaSession != null) {
            removeSession(mMediaSession);
            if (mPlayer != null) {
                mPlayer.release();
                mPlayer = null;
            }
            mMediaSession.release();
            mMediaSession = null;
        }
        sInstance = null;
        super.onDestroy();
    }
}
