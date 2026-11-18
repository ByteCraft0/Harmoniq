import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { TrackMetadata, RepeatMode, ReplayGainMode } from '../types/audio';
import { audioEngine } from '../services/audioEngine';
import { libraryService } from '../services/libraryService';
import { colorExtractionService } from '../services/colorExtractionService';
import { useToast } from './ToastContext';

const PREFS_KEY = 'harmoniq_player_prefs';

function loadPrefs(): Partial<{ volume: number; isMuted: boolean; playbackRate: number; preservesPitch: boolean; repeatMode: RepeatMode; isShuffle: boolean; replayGainMode: ReplayGainMode; crossfadeDuration: number }> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface SleepTimerState {
  isActive: boolean;
  totalSeconds: number;
  secondsRemaining: number;
  stopAfterCurrentTrack: boolean;
  isFading: boolean;
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
  
  // Queue actions
  addToQueue: (track: TrackMetadata) => void;
  playNext: (track: TrackMetadata) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;

  // Sleep timer
  setSleepTimer: (minutes: number, stopAfterCurrentTrack?: boolean) => void;
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
  const [queue, setQueue] = useState<TrackMetadata[]>([]);
  const [history, setHistory] = useState<TrackMetadata[]>([]);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimerState>({
    isActive: false,
    totalSeconds: 0,
    secondsRemaining: 0,
    stopAfterCurrentTrack: false,
    isFading: false,
  });

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

  // Push persisted preferences into the engine once (engine stores them until the audio graph exists)
  useEffect(() => {
    audioEngine.setVolume(volume);
    audioEngine.setMute(isMuted);
    audioEngine.setPlaybackRate(playbackRate, preservesPitch);
    audioEngine.setReplayGainMode(replayGainMode);
    audioEngine.setCrossfadeDuration(crossfadeDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ volume, isMuted, playbackRate, preservesPitch, repeatMode, isShuffle, replayGainMode, crossfadeDuration })
      );
    } catch {
      /* ignore */
    }
  }, [volume, isMuted, playbackRate, preservesPitch, repeatMode, isShuffle, replayGainMode, crossfadeDuration]);

  // Subscribe to audio engine status updates (handlers read through refs, so no stale closures)
  useEffect(() => {
    const unsubscribe = audioEngine.subscribeStatus((status) => {
      setCurrentTime(status.currentTime);
      if (status.duration > 0) {
        setDuration(status.duration);
      }
      setIsPlaying(status.isPlaying);

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
      showToast(`${track ? track.title + ': ' : ''}${message}`, 'warning');
      errorStreakRef.current += 1;
      // Skip to the next track, but never loop forever through a queue of broken files
      if (errorStreakRef.current < Math.max(1, Math.min(queueRef.current.length, 10))) {
        nextTrack();
      } else {
        errorStreakRef.current = 0;
      }
    });

    // Automatic Gapless & Crossfade Deck Transition Subscriber
    const unsubscribeTransition = audioEngine.subscribeTrackTransition((nextTrack, type) => {
      setCurrentTrack(nextTrack);
      currentTrackRef.current = nextTrack;
      libraryService.recordPlay(nextTrack.id);
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
    if (sleepTimerRef.current.stopAfterCurrentTrack) {
      audioEngine.pause();
      cancelSleepTimer();
      return;
    }

    if (repeatModeRef.current === 'one' && currentTrackRef.current) {
      audioEngine.seek(0);
      audioEngine.play();
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
    playNextCountRef.current = 0;
    if (newQueue) {
      setQueue(newQueue);
    } else {
      setQueue((prev) => {
        if (prev.length === 0) return [track];
        const exists = prev.some((t) => t.id === track.id);
        if (!exists) {
          return [track, ...prev];
        }
        return prev;
      });
    }

    // Check resume position (for audiobooks or saved tracks)
    const startPos = track.resumePosition && track.resumePosition > 5 && track.resumePosition < (track.duration - 10)
      ? track.resumePosition
      : 0;

    setCurrentTrack(track);
    await audioEngine.loadAndPlay(track, startPos);
    libraryService.recordPlay(track.id);

    // Add to history
    setHistory((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 50));
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
    audioEngine.pause();
  };

  const seekTo = (seconds: number) => {
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
      audioEngine.pause();
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
    audioEngine.setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      audioEngine.setMute(false);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMute(nextMuted);
  };

  const setPlaybackRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, rate));
    setPlaybackRateState(clamped);
    audioEngine.setPlaybackRate(clamped, preservesPitch);
  };

  const togglePreservePitch = () => {
    const next = !preservesPitch;
    setPreservesPitch(next);
    audioEngine.setPlaybackRate(playbackRate, next);
  };

  const setRepeatMode = (mode: RepeatMode) => {
    setRepeatModeState(mode);
  };

  const cycleRepeatMode = () => {
    if (repeatMode === 'off') setRepeatModeState('all');
    else if (repeatMode === 'all') setRepeatModeState('one');
    else setRepeatModeState('off');
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
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

  // Queue actions
  const addToQueue = (track: TrackMetadata) => {
    setQueue((prev) => {
      const curTrack = currentTrackRef.current;
      if (prev.length === 0 && curTrack) {
        return [curTrack, track];
      }
      return [...prev, track];
    });
  };

  const playNext = (track: TrackMetadata) => {
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
      return copy;
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    playNextCountRef.current = Math.max(0, playNextCountRef.current - 1);
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      if (fromIndex < 0 || fromIndex >= copy.length) return prev;
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(Math.max(0, Math.min(toIndex, copy.length)), 0, moved);
      return copy;
    });
  };

  const clearQueue = () => {
    setQueue(currentTrackRef.current ? [currentTrackRef.current] : []);
    playNextCountRef.current = 0;
  };

  // Sleep Timer with Gradual Volume Fade-Out (18-20s fade before pause)
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

    const fadeDurationMs = 18000; // 18 seconds
    const stepIntervalMs = 300;
    const totalSteps = Math.round(fadeDurationMs / stepIntervalMs);
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
        audioEngine.pause();
        // Restore user's base volume
        audioEngine.setVolume(initialVolume);
        setVolumeState(initialVolume);
        preFadeVolumeRef.current = null;
        cancelSleepTimer();
      }
    }, stepIntervalMs);
  };

  const setSleepTimer = (minutes: number, stopAfterCurrentTrack = false) => {
    cancelSleepTimer();

    if (stopAfterCurrentTrack) {
      setSleepTimerState({
        isActive: true,
        totalSeconds: 0,
        secondsRemaining: 0,
        stopAfterCurrentTrack: true,
        isFading: false,
      });
      return;
    }

    const totalSecs = Math.round(minutes * 60);
    let remaining = totalSecs;

    setSleepTimerState({
      isActive: true,
      totalSeconds: totalSecs,
      secondsRemaining: totalSecs,
      stopAfterCurrentTrack: false,
      isFading: false,
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
        startVolumeFadeOut();
      } else {
        setSleepTimerState((prev) => ({
          ...prev,
          secondsRemaining: remaining,
        }));
      }
    }, 1000);
  };

  const cancelSleepTimer = () => {
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
      totalSeconds: 0,
      secondsRemaining: 0,
      stopAfterCurrentTrack: false,
      isFading: false,
    });
  };

  const updateCurrentTrackMetadata = (updated: Partial<TrackMetadata>) => {
    setCurrentTrack((prev) => {
      if (!prev) return null;
      return { ...prev, ...updated };
    });
  };

  actionsRef.current = { toggle: togglePlayPause, next: nextTrack, prev: prevTrack, pause, seek: seekTo };

  // OS media integration: Media Session (Windows SMTC / media keys) + native taskbar buttons
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (currentTrack) {
      try {
        ms.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: currentTrack.artworkDataUrl ? [{ src: currentTrack.artworkDataUrl }] : [],
        });
      } catch {
        /* unsupported artwork */
      }
    }
    ms.playbackState = currentTrack ? (isPlaying ? 'playing' : 'paused') : 'none';
  }, [currentTrack, isPlaying]);

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
    });
    return () => {
      off?.();
    };
  }, []);

  useEffect(() => {
    if (currentTrack) {
      window.harmoniqApi
        ?.updateSMTC?.({ title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album, isPlaying })
        ?.catch?.(() => {});
    }
  }, [currentTrack, isPlaying]);

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
        addToQueue,
        playNext,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setSleepTimer,
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
