import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { TrackMetadata, RepeatMode, ReplayGainMode } from '../types/audio';
import { ABRepeatState, BitPerfectState } from '../types/dsp';
import { AudioDeviceInfo } from '../types/devices';
import { audioEngine, TransitionMode } from '../services/audioEngine';
import { libraryService } from '../services/libraryService';
import { colorExtractionService } from '../services/colorExtractionService';
import { historyService } from '../services/historyService';
import { favoritesService } from '../services/favoritesService';
import { sessionRecoveryService } from '../services/sessionRecoveryService';
import { queueManagerService } from '../services/queueManagerService';
import { universalMusicService } from '../services/universalMusicService';
import { trackMetadataToUnifiedTrack, unifiedTrackToTrackMetadata } from '../types/universalMusic';
import { MusicBookmark } from '../types/bookmark';
import { bookmarkService } from '../services/bookmarkService';
import { ListeningSession, sessionTrackingService } from '../services/sessionTrackingService';
import { RadioStation } from '../types/radio';
import { mobileRadioService } from '../services/mobileRadioService';
import { useToast } from './ToastContext';
import { getPlatformDriver } from '../services/platform';
import { App } from '@capacitor/app';

const PREFS_KEY = 'harmoniq_player_prefs';

function loadPrefs(): Partial<{
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  preservesPitch: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  replayGainMode: ReplayGainMode;
  crossfadeDuration: number;
  transitionMode: TransitionMode;
  isBitPerfect: boolean;
}> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export type SleepTimerMode = 'duration' | 'stopAfterTrack' | 'stopAfterQueue';
export type SleepTimerEndAction = 'pause' | 'closeApp' | 'exitApp';

export interface SleepTimerOptions {
  minutes?: number;
  mode?: SleepTimerMode;
  endAction?: SleepTimerEndAction;
  stopAfterCurrentTrack?: boolean;
  stopAfterQueue?: boolean;
  fadeDurationSeconds?: number;
}

export interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerMode;
  endAction: SleepTimerEndAction;
  totalSeconds: number;
  secondsRemaining: number;
  stopAfterCurrentTrack: boolean;
  stopAfterQueue: boolean;
  isFading: boolean;
  fadeDurationSeconds: number;
}

interface PlayerContextType {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  preservesPitch: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  replayGainMode: ReplayGainMode;
  crossfadeDuration: number;
  isCrossfadeEnabled: boolean;
  queue: TrackMetadata[];
  history: TrackMetadata[];
  sleepTimer: SleepTimerState;

  // Actions
  playTrack: (track: TrackMetadata, newQueue?: TrackMetadata[]) => Promise<void>;
  playRadioStation: (station: RadioStation) => Promise<void>;
  playNow: (track: TrackMetadata) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => void;
  seekTo: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  togglePreservePitch: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  setReplayGainMode: (mode: ReplayGainMode) => void;
  setCrossfadeDuration: (sec: number) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  transitionMode: TransitionMode;
  setTransitionMode: (mode: TransitionMode) => void;
  
  // Queue actions
  addToQueue: (track: TrackMetadata) => void;
  playNext: (track: TrackMetadata) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  replaceQueue: (tracks: TrackMetadata[]) => void;

  // Bookmarks (Phase 5C.2)
  bookmarks: MusicBookmark[];
  addBookmark: (trackId: string, title: string, timestamp: number, note?: string) => MusicBookmark;
  updateBookmark: (id: string, updates: { title?: string; note?: string; timestamp?: number }) => boolean;
  deleteBookmark: (id: string) => boolean;
  getBookmarksForTrack: (trackId: string) => MusicBookmark[];

  // Listening Sessions (Phase 5C.5)
  currentSession: ListeningSession | null;
  sessionHistory: ListeningSession[];
  replaySession: (sessionId: string) => void;
  clearSessionHistory: () => void;
  isSessionTrackingEnabled: boolean;
  setSessionTrackingEnabled: (enabled: boolean) => void;

  // A-B Repeat
  abRepeat: ABRepeatState;
  setABRepeatPointA: (seconds?: number) => void;
  setABRepeatPointB: (seconds?: number) => void;
  toggleABRepeat: (enabled?: boolean) => void;
  clearABRepeat: () => void;
  setABPoints: (a: number | null, b: number | null, enabled?: boolean) => void;

  // Bit-Perfect Playback Mode
  isBitPerfect: boolean;
  bitPerfectStatus: BitPerfectState;
  setBitPerfectMode: (requested: boolean) => void;
  engageBitPerfectMode: () => void;
  disengageBitPerfectMode: () => void;

  // Audio Device Manager
  outputDevices: AudioDeviceInfo[];
  currentDeviceId: string;
  setOutputDevice: (deviceId: string) => Promise<boolean>;
  refreshOutputDevices: () => Promise<void>;

  // Sleep timer & Auto Shutdown
  setSleepTimer: (arg1: number | SleepTimerOptions, stopAfterCurrentTrack?: boolean) => void;
  extendSleepTimer: (additionalMinutes: number) => void;
  cancelSleepTimer: () => void;
  updateCurrentTrackMetadata: (updated: Partial<TrackMetadata>) => void;
}

function getNextTrackInQueue(
  curTrack: TrackMetadata | null,
  curQueue: TrackMetadata[],
  isShuff: boolean,
  repMode: RepeatMode,
  playNextCount: number
): TrackMetadata | null {
  if (curQueue.length === 0) return null;
  if (!curTrack) return curQueue[0];

  const currentIndex = curQueue.findIndex((t) => t.id === curTrack.id);
  if (currentIndex === -1) return curQueue[0];

  if (repMode === 'one') {
    return curTrack;
  }

  if (isShuff && playNextCount <= 0) {
    if (curQueue.length > 1) {
      const nextIdx = (currentIndex + 1) % curQueue.length;
      return curQueue[nextIdx];
    }
    return curQueue[0];
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex < curQueue.length) {
    return curQueue[nextIndex];
  } else if (repMode === 'all') {
    return curQueue[0];
  }
  return null;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [prefs] = useState(loadPrefs);
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(typeof prefs.volume === 'number' ? Math.max(0, Math.min(1, prefs.volume)) : 0.85);
  const [isMuted, setIsMuted] = useState(!!prefs.isMuted);
  const [playbackRate, setPlaybackRateState] = useState(typeof prefs.playbackRate === 'number' ? Math.max(0.5, Math.min(3, prefs.playbackRate)) : 1.0);
  const [preservesPitch, setPreservesPitch] = useState(prefs.preservesPitch !== false);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>(prefs.repeatMode === 'all' || prefs.repeatMode === 'one' ? prefs.repeatMode : 'off');
  const [isShuffle, setIsShuffle] = useState(!!prefs.isShuffle);
  const [replayGainMode, setReplayGainModeState] = useState<ReplayGainMode>(prefs.replayGainMode === 'track' || prefs.replayGainMode === 'album' ? prefs.replayGainMode : 'off');
  const [crossfadeDuration, setCrossfadeState] = useState(typeof prefs.crossfadeDuration === 'number' ? prefs.crossfadeDuration : 0);
  const [savedCrossfadeSec, setSavedCrossfadeSec] = useState(typeof prefs.crossfadeDuration === 'number' && prefs.crossfadeDuration > 0 ? prefs.crossfadeDuration : 4);
  const [transitionMode, setTransitionModeState] = useState<TransitionMode>(
    prefs.transitionMode === 'gapless' || prefs.transitionMode === 'fade_out_fade_in'
      ? prefs.transitionMode
      : 'crossfade'
  );

  // Bookmarks State (Phase 5C.2)
  const [bookmarks, setBookmarks] = useState<MusicBookmark[]>(() => bookmarkService.getAllBookmarks());

  // Session Tracking State (Phase 5C.5)
  const [currentSession, setCurrentSession] = useState<ListeningSession | null>(() => sessionTrackingService.getCurrentSession());
  const [sessionHistory, setSessionHistory] = useState<ListeningSession[]>(() => sessionTrackingService.getSessionHistory());
  const [isSessionTrackingEnabled, setIsSessionTrackingEnabled] = useState<boolean>(() => sessionTrackingService.isTrackingEnabled());

  const [queue, setQueue] = useState<TrackMetadata[]>([]);
  const [history, setHistory] = useState<TrackMetadata[]>([]);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimerState>({
    isActive: false,
    mode: 'duration',
    endAction: 'pause',
    totalSeconds: 0,
    secondsRemaining: 0,
    stopAfterCurrentTrack: false,
    stopAfterQueue: false,
    isFading: false,
    fadeDurationSeconds: 30,
  });

  // A-B Repeat State
  const [abRepeat, setABRepeat] = useState<ABRepeatState>(() => audioEngine.getABRepeat());

  // Bit-Perfect Mode State
  const [isBitPerfect, setIsBitPerfectState] = useState<boolean>(!!prefs.isBitPerfect);
  const [bitPerfectStatus, setBitPerfectStatus] = useState<BitPerfectState>(() => audioEngine.getBitPerfectStatus());

  // Audio Device Manager State
  const [outputDevices, setOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(() => audioEngine.getCurrentSinkId());

  const sleepTimerIntervalRef = useRef<any>(null);
  const sleepTimerFadeIntervalRef = useRef<any>(null);
  const preFadeVolumeRef = useRef<number | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;
  const sleepTimerRef = useRef(sleepTimer);
  sleepTimerRef.current = sleepTimer;
  const lastResumeSaveRef = useRef(0);
  const errorStreakRef = useRef(0);
  const playNextCountRef = useRef(0);
  const onEndedRef = useRef<() => void>(() => {});
  const listeningDurationRef = useRef(0);
  const lastPlaybackTimestampRef = useRef<number | null>(null);
  const activePlayCountedRef = useRef<string | null>(null);

  const commitListeningSession = useCallback(() => {
    const track = currentTrackRef.current;
    const elapsed = listeningDurationRef.current;
    listeningDurationRef.current = 0;
    lastPlaybackTimestampRef.current = null;
    activePlayCountedRef.current = null;
    if (track && elapsed > 0) {
      const { isCompleted } = historyService.recordSession(track, elapsed);
      if (isCompleted) {
        libraryService.recordPlay(track.id);
      }
      sessionTrackingService.onTrackCompletedOrSkipped(
        track,
        elapsed,
        isCompleted ? 'completed' : elapsed < 15 ? 'skipped' : 'partial'
      );
    }
  }, []);

  // Subscriptions for bookmarks and session tracking
  useEffect(() => {
    const unsubBookmarks = bookmarkService.subscribe((list) => {
      setBookmarks(list);
    });
    const unsubSessions = sessionTrackingService.subscribe(() => {
      setCurrentSession(sessionTrackingService.getCurrentSession());
      setSessionHistory(sessionTrackingService.getSessionHistory());
      setIsSessionTrackingEnabled(sessionTrackingService.isTrackingEnabled());
    });
    return () => {
      unsubBookmarks();
      unsubSessions();
    };
  }, []);

  const actionsRef = useRef<{ toggle: () => void; next: () => void; prev: () => void; pause: () => void; seek: (s: number) => void }>({
    toggle: () => {},
    next: () => {},
    prev: () => {},
    pause: () => {},
    seek: () => {},
  });

  // Dynamic Color Extraction for ambient atmosphere and accents
  useEffect(() => {
    if (currentTrack?.artworkDataUrl) {
      colorExtractionService.extractFromArtwork(currentTrack.artworkDataUrl);
    } else {
      colorExtractionService.extractFromArtwork(null);
    }
  }, [currentTrack?.artworkDataUrl, currentTrack?.id]);

  // Synchronize active track favorite state with unified favoritesService
  useEffect(() => {
    return favoritesService.subscribe(() => {
      const cur = currentTrackRef.current;
      if (cur) {
        const isFav = favoritesService.isFavorite(cur);
        if (cur.isFavorite !== isFav) {
          setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isFav } : null));
        }
      }
    });
  }, []);

  // Push persisted preferences into the engine once (engine stores them until the audio graph exists)
  useEffect(() => {
    audioEngine.setVolume(volume);
    audioEngine.setMute(isMuted);
    audioEngine.setPlaybackRate(playbackRate, preservesPitch);
    audioEngine.setReplayGainMode(replayGainMode);
    audioEngine.setCrossfadeDuration(crossfadeDuration);
    audioEngine.setTransitionMode(transitionMode);
    audioEngine.setBitPerfectMode(isBitPerfect);

    // Initial devices enumeration
    audioEngine.getAvailableOutputDevices().then((devs) => {
      setOutputDevices(devs);
      setCurrentDeviceId(audioEngine.getCurrentSinkId());
    });

    const unsubAB = audioEngine.subscribeABRepeat((state) => {
      setABRepeat(state);
    });

    const unsubDev = audioEngine.subscribeDeviceChange((activeId, devs) => {
      setCurrentDeviceId(activeId);
      setOutputDevices(devs);
    });

    return () => {
      unsubAB();
      unsubDev();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update bit-perfect status whenever relevant playback or DSP states change
  useEffect(() => {
    setBitPerfectStatus(audioEngine.getBitPerfectStatus());
  }, [currentTrack, volume, isMuted, isBitPerfect, crossfadeDuration, replayGainMode]);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          volume,
          isMuted,
          playbackRate,
          preservesPitch,
          repeatMode,
          isShuffle,
          replayGainMode,
          crossfadeDuration,
          transitionMode,
          isBitPerfect,
        })
      );
    } catch {
      /* ignore */
    }
  }, [volume, isMuted, playbackRate, preservesPitch, repeatMode, isShuffle, replayGainMode, crossfadeDuration, transitionMode, isBitPerfect]);

  // Harmoniq 2.0: Session Recovery on Launch
  useEffect(() => {
    const saved = sessionRecoveryService.getSavedSession();
    if (saved) {
      if (saved.queueTrackIds && saved.queueTrackIds.length > 0) {
        const loadedTracks = saved.queueTrackIds
          .map((id) => libraryService.getTrack(id))
          .filter((t): t is TrackMetadata => !!t);
        if (loadedTracks.length > 0) {
          setQueue(loadedTracks);
        }
      }
      if (saved.currentTrackId) {
        const tr = libraryService.getTrack(saved.currentTrackId);
        if (tr) {
          setCurrentTrack(tr);
          if (saved.playbackPosition && saved.playbackPosition > 0) {
            setCurrentTime(saved.playbackPosition);
            audioEngine.seek(saved.playbackPosition);
          }
          if (sessionRecoveryService.getSettings().autoResumePlaybackOnLaunch) {
            audioEngine.loadAndPlay(tr, saved.playbackPosition || 0);
            setIsPlaying(true);
          }
        }
      }
      if (saved.repeatMode) {
        setRepeatMode(saved.repeatMode);
      }
      if (typeof saved.isShuffle === 'boolean') {
        setIsShuffle(saved.isShuffle);
      }
    }
  }, []);

  // Harmoniq 2.0: Periodically save session state
  useEffect(() => {
    if (currentTrack || queue.length > 0) {
      sessionRecoveryService.saveSession({
        currentTrackId: currentTrack?.id || null,
        playbackPosition: currentTime,
        queueTrackIds: queue.map((t) => t.id),
        currentQueueIndex: currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0,
        activeQueueId: queueManagerService.getActiveQueue()?.id,
        isShuffle,
        repeatMode,
        volume,
        activeView: 'home',
      });
    }
  }, [currentTrack?.id, queue, currentTime, isShuffle, repeatMode, volume]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      commitListeningSession();
      sessionTrackingService.endCurrentSession();
      if (currentTrackRef.current || queueRef.current.length > 0) {
        sessionRecoveryService.saveSessionImmediate({
          currentTrackId: currentTrackRef.current?.id || null,
          playbackPosition: currentTime,
          queueTrackIds: queueRef.current.map((t) => t.id),
          currentQueueIndex: currentTrackRef.current
            ? queueRef.current.findIndex((t) => t.id === currentTrackRef.current?.id)
            : 0,
          activeQueueId: queueManagerService.getActiveQueue()?.id,
          isShuffle: isShuffleRef.current,
          repeatMode: repeatModeRef.current,
          volume,
          activeView: 'home',
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentTime, volume]);

  // Android Background / Screen-Lock State Restoration & Lifecycle Synchronization
  useEffect(() => {
    const driver = getPlatformDriver();
    if (!driver.isAndroid) return;

    let isSubscribed = true;

    const restoreNativePlaybackState = async () => {
      try {
        const snapshot = await (driver.audio as any).getPlaybackSnapshot?.();
        if (!isSubscribed || !snapshot) return;

        if (snapshot.currentTrack) {
          setCurrentTrack(snapshot.currentTrack);
          currentTrackRef.current = snapshot.currentTrack;
        } else if (snapshot.trackId) {
          const match = (snapshot.queue || queueRef.current).find((t: TrackMetadata) => t.id === snapshot.trackId);
          if (match) {
            setCurrentTrack(match);
            currentTrackRef.current = match;
          }
        }

        if (snapshot.queue && snapshot.queue.length > 0) {
          setQueue(snapshot.queue);
          queueRef.current = snapshot.queue;
        }

        if (typeof snapshot.currentTime === 'number') {
          setCurrentTime(snapshot.currentTime);
        }
        if (typeof snapshot.duration === 'number' && snapshot.duration > 0) {
          setDuration(snapshot.duration);
        }
        if (typeof snapshot.isPlaying === 'boolean') {
          setIsPlaying(snapshot.isPlaying);
        }
        if (typeof snapshot.isShuffle === 'boolean') {
          setIsShuffle(snapshot.isShuffle);
        }
        if (snapshot.repeatMode) {
          setRepeatModeState(snapshot.repeatMode);
        }
        if (driver.audio.getSleepTimerStatus) {
          const sleepStatus = await driver.audio.getSleepTimerStatus();
          if (sleepStatus && sleepStatus.isActive) {
            setSleepTimerState((prev) => ({
              ...prev,
              isActive: true,
              totalSeconds: sleepStatus.totalSeconds,
              secondsRemaining: sleepStatus.secondsRemaining,
            }));
          }
        }
      } catch (err) {
        console.warn('[PlayerContext] Failed to restore native state on foreground transition:', err);
      }
    };

    // 1. Initial snapshot restoration on PlayerContext mount
    restoreNativePlaybackState();

    // 2. Capacitor App lifecycle listener for foreground/resume transitions
    let appStateHandle: any = null;
    try {
      const cap = (window as any).Capacitor;
      const appPlugin = cap?.Plugins?.App || App;
      if (appPlugin?.addListener) {
        appPlugin.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (state?.isActive) {
            restoreNativePlaybackState();
          }
        }).then((handle: any) => {
          appStateHandle = handle;
        }).catch(() => {});
      }
    } catch {}

    // 3. Document visibilitychange & window focus fallback
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        restoreNativePlaybackState();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', restoreNativePlaybackState);
    }

    return () => {
      isSubscribed = false;
      if (appStateHandle?.remove) {
        appStateHandle.remove();
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', restoreNativePlaybackState);
      }
    };
  }, []);

  // Subscribe to audio engine status updates (handlers read through refs, so no stale closures)
  useEffect(() => {
    const driver = getPlatformDriver();
    if (driver.isAndroid) {
      const unsubStatus = driver.audio.onPlaybackStateChange((status) => {
        setCurrentTime(status.currentTime);
        if (status.duration > 0) {
          setDuration(status.duration);
        }
        setIsPlaying(status.isPlaying);

        // Sync active track: prefer status.currentTrack from native snapshot, then lookup in queue
        const nextTrack = status.currentTrack ||
          (status.trackId ? (status.queue || queueRef.current).find((t) => t.id === status.trackId) : null);

        if (nextTrack) {
          if (nextTrack.id !== currentTrackRef.current?.id) {
            commitListeningSession();
            activePlayCountedRef.current = null;
            setCurrentTrack(nextTrack);
            currentTrackRef.current = nextTrack;
            setHistory((prev) => [nextTrack, ...prev.filter((t) => t.id !== nextTrack.id)].slice(0, 50));
            if (status.isPlaying) {
              libraryService.recordPlaybackStart(nextTrack.id);
            }
          } else if (!currentTrackRef.current) {
            // Restore currentTrack if it was null in React state (e.g. after screen unlock/remount)
            setCurrentTrack(nextTrack);
            currentTrackRef.current = nextTrack;
          }
        }

        if (status.queue && status.queue.length > 0 && queueRef.current.length === 0) {
          setQueue(status.queue);
          queueRef.current = status.queue;
        }

        if (typeof status.isShuffle === 'boolean' && status.isShuffle !== isShuffleRef.current) {
          setIsShuffle(status.isShuffle);
        }
        if (status.repeatMode && status.repeatMode !== repeatModeRef.current) {
          setRepeatModeState(status.repeatMode);
        }

        if (status.isPlaying) {
          errorStreakRef.current = 0;
          const now = Date.now();
          if (lastPlaybackTimestampRef.current !== null) {
            const delta = (now - lastPlaybackTimestampRef.current) / 1000;
            if (delta > 0 && delta < 2.0) {
              listeningDurationRef.current += delta;
              sessionTrackingService.onPlaybackProgress(delta);

              // Play count threshold: at least 30s (or 50% for shorter tracks)
              const curTrack = currentTrackRef.current;
              if (curTrack && activePlayCountedRef.current !== curTrack.id) {
                const threshold = curTrack.duration && curTrack.duration > 0
                  ? Math.min(30, curTrack.duration * 0.5)
                  : 30;
                if (listeningDurationRef.current >= threshold) {
                  activePlayCountedRef.current = curTrack.id;
                  libraryService.recordPlay(curTrack.id);
                }
              }
            }
          }
          lastPlaybackTimestampRef.current = now;
        } else {
          lastPlaybackTimestampRef.current = null;
        }
      });

      const unsubEnded = driver.audio.onTrackEnded(() => {
        onEndedRef.current();
      });

      const unsubSleep = driver.audio.onSleepTimerExpired?.(() => {
        setIsPlaying(false);
        cancelSleepTimer();
        showToast('Sleep timer expired. Playback paused.', 'info');
      });

      const unsubError = driver.audio.onError?.((err) => {
        const isRadio = mobileRadioService.isRadioTrack(err.track || currentTrackRef.current);
        if (isRadio) {
          setIsPlaying(false);
          errorStreakRef.current = 0;
          showToast('Internet radio stream unavailable or network disconnected.', 'warning');
          return;
        }
        showToast(`${err.track ? err.track.title + ': ' : ''}${err.message}`, 'warning');
        errorStreakRef.current += 1;
        if (errorStreakRef.current < Math.max(1, Math.min(queueRef.current.length, 3))) {
          setTimeout(() => {
            nextTrack();
          }, 600);
        } else {
          errorStreakRef.current = 0;
        }
      });

      return () => {
        unsubStatus();
        unsubEnded();
        if (unsubSleep) unsubSleep();
        if (unsubError) unsubError();
      };
    }

    const unsubscribe = audioEngine.subscribeStatus((status) => {
      setCurrentTime(status.currentTime);
      if (status.duration > 0) {
        setDuration(status.duration);
      }
      setIsPlaying(status.isPlaying);

      // Track active playback duration without counting paused duration
      if (status.isPlaying) {
        const now = Date.now();
        if (lastPlaybackTimestampRef.current !== null) {
          const delta = (now - lastPlaybackTimestampRef.current) / 1000;
          if (delta > 0 && delta < 2.0) {
            listeningDurationRef.current += delta;
            sessionTrackingService.onPlaybackProgress(delta);
          }
        }
        lastPlaybackTimestampRef.current = now;
      } else {
        lastPlaybackTimestampRef.current = null;
      }

      const track = currentTrackRef.current;
      if (status.isPlaying) errorStreakRef.current = 0;

      // Persist resume position (long recordings / previously resumed tracks), throttled, only for the live track
      if (
        track &&
        status.trackId === track.id &&
        !status.isEnded &&
        status.isPlaying &&
        status.currentTime > 1 &&
        (track.duration > 600 || track.resumePosition !== undefined)
      ) {
        const now = Date.now();
        if (now - lastResumeSaveRef.current > 5000) {
          lastResumeSaveRef.current = now;
          libraryService.saveResumePosition(track.id, status.currentTime);
        }
      }

      if (status.isEnded) {
        if (track) libraryService.saveResumePosition(track.id, 0);
        onEndedRef.current();
      }
    });

    const unsubscribeError = audioEngine.subscribeError((message, track) => {
      const isRadio = mobileRadioService.isRadioTrack(track || currentTrackRef.current);
      if (isRadio) {
        setIsPlaying(false);
        errorStreakRef.current = 0;
        showToast('Internet radio stream unavailable or network disconnected.', 'warning');
        return;
      }
      showToast(`${track ? track.title + ': ' : ''}${message}`, 'warning');
      errorStreakRef.current += 1;
      // Skip to the next track, but never loop forever through a queue of broken files
      if (errorStreakRef.current < Math.max(1, Math.min(queueRef.current.length, 3))) {
        setTimeout(() => {
          nextTrack();
        }, 600);
      } else {
        errorStreakRef.current = 0;
      }
    });

    // Automatic Gapless & Crossfade Deck Transition Subscriber
    const unsubscribeTransition = audioEngine.subscribeTrackTransition((nextTrack, type) => {
      commitListeningSession();
      setCurrentTrack(nextTrack);
      currentTrackRef.current = nextTrack;
      setHistory((prev) => [nextTrack, ...prev.filter((t) => t.id !== nextTrack.id)].slice(0, 50));

      const subsequent = getNextTrackInQueue(
        nextTrack,
        queueRef.current,
        isShuffleRef.current,
        repeatModeRef.current,
        playNextCountRef.current
      );
      audioEngine.prepareNextTrack(subsequent);
    });

    return () => {
      unsubscribe();
      unsubscribeError();
      unsubscribeTransition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload and prepare upcoming track on standby deck whenever queue, track or mode changes
  useEffect(() => {
    if (getPlatformDriver().isAndroid) return;
    if (currentTrack) {
      const next = getNextTrackInQueue(
        currentTrack,
        queue,
        isShuffle,
        repeatMode,
        playNextCountRef.current
      );
      audioEngine.prepareNextTrack(next);
    } else {
      audioEngine.prepareNextTrack(null);
    }
  }, [currentTrack?.id, queue, isShuffle, repeatMode]);

  onEndedRef.current = () => {
    commitListeningSession();
    if (sleepTimerRef.current.stopAfterCurrentTrack) {
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setStopAfterCurrentTrack?.(false).catch(() => {});
      }
      executeSleepEndAction();
      return;
    }

    if (sleepTimerRef.current.stopAfterQueue) {
      const curIndex = queue.findIndex((t) => t.id === currentTrackRef.current?.id);
      const isLastTrack = curIndex === -1 || curIndex >= queue.length - 1;
      if (isLastTrack && repeatModeRef.current !== 'all') {
        executeSleepEndAction();
        return;
      }
    }

    if (repeatModeRef.current === 'one' && currentTrackRef.current) {
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.seekTo(0);
        getPlatformDriver().audio.resume();
      } else {
        audioEngine.seek(0);
        audioEngine.play();
      }
      return;
    }

    nextTrack();
  };

  // Clear sleep timer on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) clearInterval(sleepTimerIntervalRef.current);
    };
  }, []);

  // Load and play track
  const playTrack = async (track: TrackMetadata, newQueue?: TrackMetadata[]) => {
    // Finalize previous track session if switching tracks
    if (currentTrackRef.current && currentTrackRef.current.id !== track.id) {
      commitListeningSession();
    }
    playNextCountRef.current = 0;

    let playableTrack = track;
    // On-demand stream resolution for online tracks (e.g. Audius tokens, Archive file manifests)
    const isOnline = Boolean((track as any).isOnline || (track as any).providerId || /^https?:\/\//i.test(track.filePath));
    const providerId = (track as any).providerId;

    if (isOnline && providerId && providerId !== 'local') {
      try {
        const ut = trackMetadataToUnifiedTrack(track);
        if (!ut.streamUrl || ut.providerId === 'audius' || ut.providerId === 'archive') {
          const res = await universalMusicService.resolveTrackStream(ut);
          playableTrack = unifiedTrackToTrackMetadata(res.track);
        }
      } catch (err: any) {
        console.warn('Online stream resolution fallback:', err);
      }
    }

    if (newQueue) {
      setQueue(newQueue.filter(isPlayableAudioTrack));
    } else {
      setQueue((prev) => {
        if (prev.length === 0) return [playableTrack];
        const exists = prev.some((t) => t.id === playableTrack.id);
        if (!exists) {
          return [playableTrack, ...prev];
        }
        return prev;
      });
    }

    // Check resume position (for audiobooks or saved tracks)
    const startPos = playableTrack.resumePosition && playableTrack.resumePosition > 5 && playableTrack.resumePosition < (playableTrack.duration - 10)
      ? playableTrack.resumePosition
      : 0;

    playableTrack = {
      ...playableTrack,
      isFavorite: favoritesService.isFavorite(playableTrack),
    };

    activePlayCountedRef.current = null;
    libraryService.recordPlaybackStart(playableTrack.id);
    setCurrentTrack(playableTrack);
    if (getPlatformDriver().isAndroid) {
      await getPlatformDriver().audio.play(playableTrack, newQueue || queueRef.current);
    } else {
      await audioEngine.loadAndPlay(playableTrack, startPos);
    }
    sessionTrackingService.onPlaybackStarted(playableTrack);

    // Add to history
    setHistory((prev) => [playableTrack, ...prev.filter((t) => t.id !== playableTrack.id)].slice(0, 50));
  };

  const playRadioStation = async (station: RadioStation) => {
    if (currentTrackRef.current && currentTrackRef.current.id !== `radio_${station.id}`) {
      commitListeningSession();
    }
    playNextCountRef.current = 0;

    const radioTrack = mobileRadioService.stationToTrackMetadata(station);
    mobileRadioService.recordPlay(station);

    activePlayCountedRef.current = null;
    setCurrentTrack(radioTrack);
    currentTrackRef.current = radioTrack;
    setCurrentTime(0);
    setDuration(0);

    const driver = getPlatformDriver();
    if (driver.isAndroid) {
      await driver.audio.play(radioTrack, [radioTrack]);
    } else {
      await audioEngine.loadAndPlay(radioTrack, 0);
    }
  };

  const playNow = async (track: TrackMetadata) => {
    playNextCountRef.current = 0;
    setQueue((prev) => {
      const copy = [...prev];
      const curTrack = currentTrackRef.current;
      const curIndex = curTrack ? copy.findIndex((t) => t.id === curTrack.id) : -1;
      const existingIdx = copy.findIndex((t) => t.id === track.id);
      if (existingIdx !== -1) {
        return copy;
      }
      const insertIndex = curIndex !== -1 ? curIndex + 1 : 0;
      copy.splice(insertIndex, 0, track);
      return copy;
    });
    await playTrack(track);
  };

  const togglePlayPause = async () => {
    if (getPlatformDriver().isAndroid) {
      if (isPlaying) {
        await getPlatformDriver().audio.pause();
      } else {
        if (currentTrack) {
          await getPlatformDriver().audio.resume();
        } else if (queue.length > 0) {
          await playTrack(queue[0]);
        }
      }
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
    } else {
      if (currentTrack) {
        await audioEngine.play();
      } else if (queue.length > 0) {
        await playTrack(queue[0]);
      }
    }
  };

  const pause = () => {
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.pause();
      return;
    }
    audioEngine.pause();
  };

  const seekTo = (seconds: number) => {
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.seekTo(seconds);
      setCurrentTime(seconds);
      return;
    }
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const nextTrack = () => {
    const curQueue = queueRef.current;
    if (curQueue.length === 0) return;

    const curTrack = currentTrackRef.current;
    let nextIndex = 0;

    if (curTrack) {
      const currentIndex = curQueue.findIndex((t) => t.id === curTrack.id);
      if (currentIndex !== -1) {
        if (isShuffleRef.current && playNextCountRef.current <= 0) {
          nextIndex = Math.floor(Math.random() * curQueue.length);
          if (curQueue.length > 1 && nextIndex === currentIndex) {
            nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (curQueue.length - 1))) % curQueue.length;
          }
        } else {
          nextIndex = currentIndex + 1;
          if (playNextCountRef.current > 0) {
            playNextCountRef.current = Math.max(0, playNextCountRef.current - 1);
          }
        }
      }
    }

    if (nextIndex < curQueue.length) {
      playTrack(curQueue[nextIndex]);
    } else if (repeatModeRef.current === 'all' && curQueue.length > 0) {
      playTrack(curQueue[0]);
    } else {
      pause();
    }
  };

  const prevTrack = () => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    const curQueue = queueRef.current;
    if (curQueue.length === 0) return;

    const curTrack = currentTrackRef.current;
    if (curTrack) {
      const currentIndex = curQueue.findIndex((t) => t.id === curTrack.id);
      if (currentIndex > 0) {
        playTrack(curQueue[currentIndex - 1]);
        return;
      }
    }
    seekTo(0);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setVolume(clamped);
    } else {
      audioEngine.setVolume(clamped);
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      if (!getPlatformDriver().isAndroid) {
        audioEngine.setMute(false);
      }
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setMuted(nextMuted);
    } else {
      audioEngine.setMute(nextMuted);
    }
  };

  const setPlaybackRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, rate));
    setPlaybackRateState(clamped);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setPlaybackRate(clamped);
    } else {
      audioEngine.setPlaybackRate(clamped, preservesPitch);
    }
  };

  const togglePreservePitch = () => {
    const next = !preservesPitch;
    setPreservesPitch(next);
    audioEngine.setPlaybackRate(playbackRate, next);
  };

  const setRepeatMode = (mode: RepeatMode) => {
    setRepeatModeState(mode);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setRepeatMode?.(mode).catch(() => {});
    }
  };

  const cycleRepeatMode = () => {
    const nextMode: RepeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    setRepeatModeState(nextMode);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setRepeatMode?.(nextMode).catch(() => {});
    }
  };

  const toggleShuffle = () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setShuffle?.(nextShuffle).catch(() => {});
    }
  };

  const setReplayGainMode = (mode: ReplayGainMode) => {
    setReplayGainModeState(mode);
    audioEngine.setReplayGainMode(mode);
  };

  const setCrossfadeDuration = (sec: number) => {
    const clamped = Math.max(0, Math.min(12, Math.round(sec)));
    setCrossfadeState(clamped);
    if (clamped > 0) {
      setSavedCrossfadeSec(clamped);
    }
    audioEngine.setCrossfadeDuration(clamped);
  };

  const isCrossfadeEnabled = crossfadeDuration > 0;

  const setCrossfadeEnabled = (enabled: boolean) => {
    if (enabled) {
      const dur = savedCrossfadeSec > 0 ? savedCrossfadeSec : 4;
      setCrossfadeDuration(dur);
    } else {
      setCrossfadeDuration(0);
    }
  };

  const setTransitionMode = (mode: TransitionMode) => {
    setTransitionModeState(mode);
    audioEngine.setTransitionMode(mode);
  };

  // Bookmarks Actions (Phase 5C.2)
  const addBookmark = useCallback(
    (trackId: string, title: string, timestamp: number, note?: string) => {
      const b = bookmarkService.addBookmark(trackId, title, timestamp, note);
      showToast(`Bookmark saved at ${bookmarkService.formatTimestamp(timestamp)}`, 'success');
      return b;
    },
    [showToast]
  );

  const updateBookmark = useCallback(
    (id: string, updates: { title?: string; note?: string; timestamp?: number }) => {
      return bookmarkService.updateBookmark(id, updates);
    },
    []
  );

  const deleteBookmark = useCallback(
    (id: string) => {
      const res = bookmarkService.deleteBookmark(id);
      if (res) showToast('Bookmark removed', 'info');
      return res;
    },
    [showToast]
  );

  const getBookmarksForTrack = useCallback((trackId: string) => {
    return bookmarkService.getBookmarksForTrack(trackId);
  }, []);

  // Listening Sessions Actions (Phase 5C.5)
  const replaySession = useCallback(
    (sessionId: string) => {
      const tracks = sessionTrackingService.replaySession(sessionId);
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
        showToast(`Replaying session (${tracks.length} tracks)`, 'info');
      } else {
        showToast('No tracks found to replay for this session', 'warning');
      }
    },
    [showToast]
  );

  const clearSessionHistory = useCallback(() => {
    sessionTrackingService.clearSessionHistory();
    showToast('Session history cleared', 'info');
  }, [showToast]);

  const setSessionTrackingEnabled = useCallback((enabled: boolean) => {
    sessionTrackingService.setTrackingEnabled(enabled);
  }, []);

  // A-B Repeat Actions
  const setABRepeatPointA = (seconds?: number) => {
    audioEngine.setABRepeatPointA(seconds !== undefined ? seconds : currentTime);
  };

  const setABRepeatPointB = (seconds?: number) => {
    audioEngine.setABRepeatPointB(seconds !== undefined ? seconds : currentTime);
  };

  const toggleABRepeat = (enabled?: boolean) => {
    audioEngine.toggleABRepeat(enabled);
  };

  const clearABRepeat = () => {
    audioEngine.clearABRepeat();
  };

  const setABPoints = (a: number | null, b: number | null, enabled = true) => {
    audioEngine.setABPoints(a, b, enabled);
  };

  // Bit-Perfect Mode Actions
  const setBitPerfectMode = (requested: boolean) => {
    setIsBitPerfectState(requested);
    audioEngine.setBitPerfectMode(requested);
    if (requested) {
      setVolume(1.0);
      setCrossfadeDuration(0);
      setReplayGainMode('off');
      showToast('Direct Stream Mode engaged: 100% Unity Gain, DSP bypassed, Crossfade & ReplayGain disabled', 'info');
    }
    setBitPerfectStatus(audioEngine.getBitPerfectStatus());
  };

  const engageBitPerfectMode = () => setBitPerfectMode(true);
  const disengageBitPerfectMode = () => setBitPerfectMode(false);

  // Audio Device Manager Actions
  const refreshOutputDevices = async () => {
    const devs = await audioEngine.getAvailableOutputDevices();
    setOutputDevices(devs);
    setCurrentDeviceId(audioEngine.getCurrentSinkId());
  };

  const setOutputDevice = async (deviceId: string): Promise<boolean> => {
    const success = await audioEngine.setAudioOutputDevice(deviceId);
    if (success) {
      setCurrentDeviceId(deviceId);
      const dev = outputDevices.find((d) => d.deviceId === deviceId);
      showToast(`Audio output: ${dev?.label || 'Selected Device'}`, 'success');
    } else {
      showToast('Could not switch output device', 'warning');
    }
    return success;
  };

  const isPlayableAudioTrack = (t: TrackMetadata): boolean => {
    if (!t) return false;
    const cap = t.playbackCapability;
    return cap !== 'external_link' && cap !== 'metadata_only' && cap !== 'unavailable';
  };

  // Queue actions
  const addToQueue = (track: TrackMetadata) => {
    if (!isPlayableAudioTrack(track)) {
      showToast('External or unavailable items cannot be added to audio playback queue', 'info');
      return;
    }
    setQueue((prev) => {
      const curTrack = currentTrackRef.current;
      const nextQueue = prev.length === 0 && curTrack ? [curTrack, track] : [...prev, track];
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setQueue(nextQueue).catch(() => {});
      }
      return nextQueue;
    });
    showToast(`Added "${track.title}" to queue`, 'info');
  };

  const playNext = (track: TrackMetadata) => {
    if (!isPlayableAudioTrack(track)) {
      showToast('External or unavailable items cannot be added to audio playback queue', 'info');
      return;
    }
    setQueue((prev) => {
      const copy = [...prev];
      const curTrack = currentTrackRef.current;
      let curIndex = curTrack ? copy.findIndex((t) => t.id === curTrack.id) : -1;
      
      if (curIndex === -1 && curTrack) {
        copy.unshift(curTrack);
        curIndex = 0;
      }

      const baseIndex = curIndex !== -1 ? curIndex + 1 : 0;
      const insertIndex = Math.min(copy.length, baseIndex + playNextCountRef.current);
      copy.splice(insertIndex, 0, track);
      playNextCountRef.current += 1;
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setQueue(copy).catch(() => {});
      }
      return copy;
    });
    showToast(`Playing "${track.title}" next`, 'info');
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setQueue(copy).catch(() => {});
      }
      return copy;
    });
    playNextCountRef.current = Math.max(0, playNextCountRef.current - 1);
    showToast('Removed track from queue', 'info');
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      if (fromIndex < 0 || fromIndex >= copy.length) return prev;
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(Math.max(0, Math.min(toIndex, copy.length)), 0, moved);
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setQueue(copy).catch(() => {});
      }
      return copy;
    });
  };

  const clearQueue = () => {
    const nextQueue = currentTrackRef.current ? [currentTrackRef.current] : [];
    setQueue(nextQueue);
    playNextCountRef.current = 0;
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setQueue(nextQueue).catch(() => {});
    }
    showToast('Upcoming queue cleared', 'info');
  };

  const replaceQueue = (tracks: TrackMetadata[]) => {
    const filtered = tracks.filter(isPlayableAudioTrack);
    setQueue(filtered);
    playNextCountRef.current = 0;
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setQueue(filtered).catch(() => {});
    }
  };

  // Extended Sleep Timer & Auto Shutdown Logic
  const executeSleepEndAction = () => {
    const endAction = sleepTimerRef.current.endAction || 'pause';
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.pause().catch(() => {});
    } else {
      audioEngine.pause();
    }
    setIsPlaying(false);
    cancelSleepTimer();

    if (endAction === 'closeApp') {
      if (getPlatformDriver().isAndroid) {
        App.exitApp().catch(() => {});
      } else if (typeof window !== 'undefined' && window.harmoniqApi?.windowClose) {
        window.harmoniqApi.windowClose().catch(() => {});
      }
    } else if (endAction === 'exitApp') {
      if (getPlatformDriver().isAndroid) {
        App.exitApp().catch(() => {});
      } else if (typeof window !== 'undefined' && (window.harmoniqApi as any)?.quitApp) {
        (window.harmoniqApi as any).quitApp().catch(() => {});
      } else if (typeof window !== 'undefined' && window.harmoniqApi?.windowClose) {
        window.harmoniqApi.windowClose().catch(() => {});
      }
    }
  };

  const startVolumeFadeOut = () => {
    if (sleepTimerFadeIntervalRef.current) {
      clearInterval(sleepTimerFadeIntervalRef.current);
    }

    const initialVolume = volume;
    preFadeVolumeRef.current = initialVolume;

    setSleepTimerState((prev) => ({
      ...prev,
      isFading: true,
    }));

    const fadeDurationSecs = sleepTimerRef.current.fadeDurationSeconds || 30;
    const fadeDurationMs = Math.max(1000, fadeDurationSecs * 1000);
    const stepIntervalMs = 300;
    const totalSteps = Math.max(1, Math.round(fadeDurationMs / stepIntervalMs));
    let currentStep = 0;

    sleepTimerFadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const fraction = currentStep / totalSteps;
      const nextVol = Math.max(0, initialVolume * (1 - fraction));
      audioEngine.setVolume(nextVol);

      if (currentStep >= totalSteps) {
        if (sleepTimerFadeIntervalRef.current) {
          clearInterval(sleepTimerFadeIntervalRef.current);
          sleepTimerFadeIntervalRef.current = null;
        }
        // Restore user's base volume
        audioEngine.setVolume(initialVolume);
        setVolumeState(initialVolume);
        preFadeVolumeRef.current = null;
        executeSleepEndAction();
      }
    }, stepIntervalMs);
  };

  const setSleepTimer = (
    arg1: number | SleepTimerOptions,
    stopAfterTrackParam = false
  ) => {
    cancelSleepTimer();

    let mode: SleepTimerMode = 'duration';
    let endAction: SleepTimerEndAction = 'pause';
    let minutes = 0;
    let fadeDurationSeconds = 30;

    if (typeof arg1 === 'number') {
      minutes = arg1;
      if (stopAfterTrackParam) {
        mode = 'stopAfterTrack';
      } else {
        mode = 'duration';
      }
    } else if (typeof arg1 === 'object') {
      mode = arg1.mode || (arg1.stopAfterCurrentTrack ? 'stopAfterTrack' : arg1.stopAfterQueue ? 'stopAfterQueue' : 'duration');
      endAction = arg1.endAction || 'pause';
      minutes = arg1.minutes || 0;
      fadeDurationSeconds = arg1.fadeDurationSeconds !== undefined ? arg1.fadeDurationSeconds : 30;
    }

    if (mode === 'stopAfterTrack') {
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setStopAfterCurrentTrack?.(true).catch(() => {});
      }
      setSleepTimerState({
        isActive: true,
        mode: 'stopAfterTrack',
        endAction,
        totalSeconds: 0,
        secondsRemaining: 0,
        stopAfterCurrentTrack: true,
        stopAfterQueue: false,
        isFading: false,
        fadeDurationSeconds,
      });
      return;
    }

    if (mode === 'stopAfterQueue') {
      if (getPlatformDriver().isAndroid) {
        getPlatformDriver().audio.setStopAfterCurrentTrack?.(false).catch(() => {});
      }
      setSleepTimerState({
        isActive: true,
        mode: 'stopAfterQueue',
        endAction,
        totalSeconds: 0,
        secondsRemaining: 0,
        stopAfterCurrentTrack: false,
        stopAfterQueue: true,
        isFading: false,
        fadeDurationSeconds,
      });
      return;
    }

    const totalSecs = Math.round(minutes * 60);
    let remaining = totalSecs;

    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.setStopAfterCurrentTrack?.(false).catch(() => {});
      if (minutes > 0) {
        getPlatformDriver().audio.startSleepTimer?.(minutes).catch(() => {});
      }
    }

    setSleepTimerState({
      isActive: true,
      mode: 'duration',
      endAction,
      totalSeconds: totalSecs,
      secondsRemaining: totalSecs,
      stopAfterCurrentTrack: false,
      stopAfterQueue: false,
      isFading: false,
      fadeDurationSeconds,
    });

    sleepTimerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (sleepTimerIntervalRef.current) {
          clearInterval(sleepTimerIntervalRef.current);
          sleepTimerIntervalRef.current = null;
        }
        setSleepTimerState((prev) => ({
          ...prev,
          secondsRemaining: 0,
        }));
        if (fadeDurationSeconds > 0) {
          startVolumeFadeOut();
        } else {
          executeSleepEndAction();
        }
      } else {
        setSleepTimerState((prev) => ({
          ...prev,
          secondsRemaining: remaining,
        }));
      }
    }, 1000);
  };

  const extendSleepTimer = (additionalMinutes: number) => {
    if (!sleepTimerRef.current.isActive) {
      setSleepTimer(additionalMinutes);
      return;
    }
    const addSecs = Math.round(additionalMinutes * 60);
    setSleepTimerState((prev) => ({
      ...prev,
      totalSeconds: prev.totalSeconds + addSecs,
      secondsRemaining: prev.secondsRemaining + addSecs,
    }));
  };

  const cancelSleepTimer = () => {
    if (getPlatformDriver().isAndroid) {
      getPlatformDriver().audio.cancelSleepTimer?.().catch(() => {});
      getPlatformDriver().audio.setStopAfterCurrentTrack?.(false).catch(() => {});
    }
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    if (sleepTimerFadeIntervalRef.current) {
      clearInterval(sleepTimerFadeIntervalRef.current);
      sleepTimerFadeIntervalRef.current = null;
    }
    if (preFadeVolumeRef.current !== null) {
      audioEngine.setVolume(preFadeVolumeRef.current);
      setVolumeState(preFadeVolumeRef.current);
      preFadeVolumeRef.current = null;
    }
    setSleepTimerState({
      isActive: false,
      mode: 'duration',
      endAction: 'pause',
      totalSeconds: 0,
      secondsRemaining: 0,
      stopAfterCurrentTrack: false,
      stopAfterQueue: false,
      isFading: false,
      fadeDurationSeconds: 30,
    });
  };

  const updateCurrentTrackMetadata = (updated: Partial<TrackMetadata>) => {
    setCurrentTrack((prev) => {
      if (!prev) return null;
      return { ...prev, ...updated };
    });
  };

  actionsRef.current = { toggle: togglePlayPause, next: nextTrack, prev: prevTrack, pause, seek: seekTo };

  // OS media integration: Media Session (Windows SMTC / media keys) + native taskbar & tray
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (currentTrack) {
      try {
        const artwork: MediaImage[] = [];
        if (currentTrack.artworkDataUrl && currentTrack.artworkDataUrl.startsWith('data:image/')) {
          artwork.push({
            src: currentTrack.artworkDataUrl,
            sizes: '512x512',
            type: currentTrack.artworkDataUrl.includes('png') ? 'image/png' : 'image/jpeg',
          });
        }
        ms.metadata = new MediaMetadata({
          title: currentTrack.title || 'Unknown Title',
          artist: currentTrack.artist || 'Unknown Artist',
          album: currentTrack.album || 'Unknown Album',
          artwork,
        });
      } catch {
        /* fallback if MediaMetadata fails */
      }
    } else {
      try {
        ms.metadata = null;
      } catch {}
    }
    ms.playbackState = currentTrack ? (isPlaying ? 'playing' : 'paused') : 'none';
  }, [currentTrack, isPlaying]);

  // Synchronize Windows SMTC scrubber seekbar
  useEffect(() => {
    if (
      'mediaSession' in navigator &&
      typeof navigator.mediaSession.setPositionState === 'function' &&
      currentTrack &&
      Number.isFinite(duration) &&
      duration > 0 &&
      Number.isFinite(currentTime) &&
      currentTime >= 0
    ) {
      try {
        const safePosition = Math.min(Math.max(0, currentTime), duration);
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: playbackRate > 0 ? playbackRate : 1.0,
          position: safePosition,
        });
      } catch {
        /* ignore invalid timing state */
      }
    }
  }, [currentTime, duration, playbackRate, currentTrack]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        try {
          ms.setActionHandler(action, handler);
        } catch {
          /* action unsupported */
        }
      };
      set('play', () => actionsRef.current.toggle());
      set('pause', () => actionsRef.current.pause());
      set('previoustrack', () => actionsRef.current.prev());
      set('nexttrack', () => actionsRef.current.next());
      set('seekto', (d) => {
        if (typeof d.seekTime === 'number') actionsRef.current.seek(d.seekTime);
      });
    }

    const off = window.harmoniqApi?.onMediaCommand?.((cmd) => {
      if (cmd === 'playpause') actionsRef.current.toggle();
      else if (cmd === 'next') actionsRef.current.next();
      else if (cmd === 'prev') actionsRef.current.prev();
      else if (cmd === 'volumeup') {
        setVolumeState((prev) => {
          const next = Math.min(1, Math.round((prev + 0.05) * 100) / 100);
          audioEngine.setVolume(next);
          return next;
        });
      } else if (cmd === 'volumedown') {
        setVolumeState((prev) => {
          const next = Math.max(0, Math.round((prev - 0.05) * 100) / 100);
          audioEngine.setVolume(next);
          return next;
        });
      } else if (cmd === 'togglemute') {
        toggleMute();
      }
    });
    return () => {
      off?.();
    };
  }, [toggleMute]);

  useEffect(() => {
    getPlatformDriver().audio.updateMetadata(currentTrack, isPlaying).catch(() => {});
  }, [currentTrack, isPlaying]);

  // Windows File Association (double-click in Explorer or CLI argument)
  useEffect(() => {
    const handleOpenFile = async (filePath: string) => {
      if (!filePath) return;
      try {
        const track = await window.harmoniqApi?.parseAudioFile?.(filePath);
        if (track) {
          libraryService.addTracks([track]);
          await playTrack(track);
        }
      } catch (err) {
        console.warn('Failed to open file from external trigger:', err);
      }
    };

    const off = window.harmoniqApi?.onOpenExternalFile?.((filePath) => {
      handleOpenFile(filePath);
    });

    window.harmoniqApi?.getPendingOpenFile?.().then((pending) => {
      if (pending) {
        handleOpenFile(pending);
      }
    }).catch(() => {});

    return () => {
      off?.();
    };
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackRate,
        preservesPitch,
        repeatMode,
        isShuffle,
        replayGainMode,
        crossfadeDuration,
        isCrossfadeEnabled,
        queue,
        history,
        sleepTimer,
        playTrack,
        playRadioStation,
        playNow,
        togglePlayPause,
        pause,
        seekTo,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
        setPlaybackRate,
        togglePreservePitch,
        setRepeatMode,
        cycleRepeatMode,
        toggleShuffle,
        setReplayGainMode,
        setCrossfadeDuration,
        setCrossfadeEnabled,
        transitionMode,
        setTransitionMode,
        addToQueue,
        playNext,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        replaceQueue,
        // Bookmarks (Phase 5C.2)
        bookmarks,
        addBookmark,
        updateBookmark,
        deleteBookmark,
        getBookmarksForTrack,
        // Listening Sessions (Phase 5C.5)
        currentSession,
        sessionHistory,
        replaySession,
        clearSessionHistory,
        isSessionTrackingEnabled,
        setSessionTrackingEnabled,
        // A-B Repeat
        abRepeat,
        setABRepeatPointA,
        setABRepeatPointB,
        toggleABRepeat,
        clearABRepeat,
        setABPoints,
        // Bit-Perfect Mode
        isBitPerfect,
        bitPerfectStatus,
        setBitPerfectMode,
        engageBitPerfectMode,
        disengageBitPerfectMode,
        // Audio Device Manager
        outputDevices,
        currentDeviceId,
        setOutputDevice,
        refreshOutputDevices,
        // Sleep Timer & Auto Shutdown
        setSleepTimer,
        extendSleepTimer,
        cancelSleepTimer,
        updateCurrentTrackMetadata,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
