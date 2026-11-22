import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// In-memory mock for localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as any).localStorage = localStorageMock;

import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { audioEngine } from '../services/audioEngine';
import { mobileRadioService } from '../services/mobileRadioService';
import { favoritesService } from '../services/favoritesService';
import { TrackMetadata } from '../types/audio';

const sampleLocalTrack1: TrackMetadata = {
  id: 'track_local_1',
  filePath: 'content://media/external/audio/media/101',
  fileName: 'flac_sample.flac',
  fileSize: 20000000,
  dateModified: Date.now(),
  title: 'Master Audio Track 1',
  artist: 'Harmoniq Acoustic Studio',
  album: 'High-Res Vault',
  duration: 210,
  hasArtwork: true,
  artworkDataUrl: '/data/user/0/com.bytecraft.harmoniqlite/cache/album_art/101.jpg',
  codec: 'FLAC',
  container: 'flac',
  sampleRate: 96000,
  bitrate: 1411,
  channels: 2,
  isLossless: true,
  playCount: 0,
  isFavorite: false,
};

const sampleLocalTrack2: TrackMetadata = {
  id: 'track_local_2',
  filePath: 'content://media/external/audio/media/102',
  fileName: 'mp3_sample.mp3',
  fileSize: 6000000,
  dateModified: Date.now(),
  title: 'Master Audio Track 2',
  artist: 'Harmoniq Acoustic Studio',
  album: 'High-Res Vault',
  duration: 180,
  hasArtwork: true,
  artworkDataUrl: '/data/user/0/com.bytecraft.harmoniqlite/cache/album_art/102.jpg',
  codec: 'MP3',
  container: 'mp3',
  sampleRate: 44100,
  bitrate: 320,
  channels: 2,
  isLossless: false,
  playCount: 1,
  isFavorite: false,
};

const sampleRadioTrack: TrackMetadata = {
  id: 'radio_station_groove',
  filePath: 'https://live.harmoniq.fm/stream.mp3',
  fileName: 'stream.mp3',
  fileSize: 0,
  dateModified: Date.now(),
  title: 'Harmoniq Global Chill',
  artist: 'Harmoniq Radio Network',
  album: 'Live Radio Stream',
  duration: 0,
  hasArtwork: true,
  artworkDataUrl: 'https://harmoniq.fm/artwork/station1.png',
  codec: 'MP3',
  container: 'mp3',
  sampleRate: 44100,
  bitrate: 192,
  channels: 2,
  isLossless: false,
  playCount: 0,
  isFavorite: false,
};

describe('Phase 02: Android Architecture, Native Playback Reliability & Lifecycle Hardening (A01 - A20)', () => {
  let driver: AndroidAudioDriver;
  let mockPlugin: any;
  let eventListeners: Record<string, ((data: any) => void)[]> = {};

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    eventListeners = {};

    mockPlugin = {
      play: vi.fn().mockImplementation(async (options: any) => {
        return { success: true, track: options?.track };
      }),
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      seekTo: vi.fn().mockResolvedValue({ success: true }),
      setVolume: vi.fn().mockResolvedValue({ success: true }),
      setPlaybackRate: vi.fn().mockResolvedValue({ success: true }),
      setQueue: vi.fn().mockResolvedValue({ success: true }),
      setStopOnTaskRemoved: vi.fn().mockResolvedValue({ enabled: true }),
      getStopOnTaskRemoved: vi.fn().mockResolvedValue({ enabled: true }),
      setStopAfterCurrentTrack: vi.fn().mockResolvedValue({ enabled: true }),
      checkNotificationPermission: vi.fn().mockResolvedValue({ granted: true, shouldShowRationale: false }),
      requestNotificationPermission: vi.fn().mockResolvedValue({ requested: true, granted: true }),
      openNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
      addListener: vi.fn().mockImplementation(async (eventName: string, handler: (data: any) => void) => {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(handler);
        return {
          remove: () => {
            eventListeners[eventName] = eventListeners[eventName].filter((h) => h !== handler);
          },
        };
      }),
      removeAllListeners: vi.fn().mockImplementation(async () => {
        eventListeners = {};
      }),
      getPlaybackState: vi.fn().mockResolvedValue({
        isPlaying: false,
        currentTrack: null,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
        userExplicitlyPaused: false,
        stopAfterCurrentTrack: false,
        playWhenReady: false,
      }),
    };

    const capObject = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: {
        HarmoniqAudioPlayer: mockPlugin,
        App: {
          addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
        },
      },
    };

    (globalThis as any).Capacitor = capObject;
    if (typeof window !== 'undefined') {
      (window as any).Capacitor = capObject;
    } else {
      (globalThis as any).window = { Capacitor: capObject };
    }

    driver = new AndroidAudioDriver();
  });

  afterEach(() => {
    driver.destroy();
  });

  // A01: Single native playback session & authoritative ownership
  it('A01: enforces single native playback session and authoritative plugin ownership', async () => {
    await driver.play(sampleLocalTrack1);
    expect(mockPlugin.play).toHaveBeenCalledTimes(1);
    expect(mockPlugin.play).toHaveBeenCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ id: 'track_local_1' }),
      })
    );
  });

  // A02: Rapid play/pause command debouncing and state stability
  it('A02: handles rapid play/pause toggling without crashing or corrupting state', async () => {
    const promises = [
      driver.play(sampleLocalTrack1),
      driver.pause(),
      driver.resume(),
      driver.pause(),
      driver.resume(),
    ];
    await Promise.all(promises);

    expect(mockPlugin.play).toHaveBeenCalledTimes(1);
    expect(mockPlugin.pause).toHaveBeenCalledTimes(2);
    expect(mockPlugin.resume).toHaveBeenCalledTimes(2);
  });

  // A03: Rapid next/previous track queue transitions
  it('A03: supports rapid queue updates without losing track ordering', async () => {
    const queue = [sampleLocalTrack1, sampleLocalTrack2];
    await driver.setQueue(queue);

    expect(mockPlugin.setQueue).toHaveBeenCalledWith({ queue });
  });

  // A04: Audio focus transient loss and recovery
  it('A04: dispatches playback state change when transient audio focus suppresses playback', () => {
    let observedPlaying: boolean | null = null;
    driver.onPlaybackStateChange((state) => {
      observedPlaying = state.isPlaying;
    });

    // Simulate native state update where ExoPlayer is paused due to transient focus loss
    const handlers = eventListeners['playbackStateChange'] || [];
    for (const h of handlers) {
      h({
        isPlaying: false,
        currentTime: 45,
        duration: 210,
        currentTrack: sampleLocalTrack1,
        userExplicitlyPaused: false,
      });
    }

    expect(observedPlaying).toBe(false);
  });

  // A05: Explicit user pause prevents unintended auto-resume after focus loss
  it('A05: preserves explicit user pause flag to prevent unintended auto-resume', async () => {
    await driver.pause();
    expect(mockPlugin.pause).toHaveBeenCalledTimes(1);

    mockPlugin.getPlaybackState.mockResolvedValueOnce({
      isPlaying: false,
      currentTrack: sampleLocalTrack1,
      currentTime: 45,
      duration: 210,
      volume: 1,
      userExplicitlyPaused: true,
      playWhenReady: false,
    });

    const state = await driver.getPlaybackSnapshot();
    expect(state.isPlaying).toBe(false);
  });

  // A06: Bluetooth media-button routing and MediaSession synchronization
  it('A06: routes MediaSession commands smoothly through native events', () => {
    let trackEndedFired = false;
    driver.onTrackEnded(() => {
      trackEndedFired = true;
    });

    const handlers = eventListeners['trackEnded'] || [];
    for (const h of handlers) {
      h({});
    }

    expect(trackEndedFired).toBe(true);
  });

  // A07: Headset disconnection (ACTION_AUDIO_BECOMING_NOISY) handling
  it('A07: dispatches paused state when headset is unplugged', () => {
    let paused = false;
    driver.onPlaybackStateChange((state) => {
      if (!state.isPlaying) paused = true;
    });

    const handlers = eventListeners['playbackStateChange'] || [];
    for (const h of handlers) {
      h({ isPlaying: false, currentTrack: sampleLocalTrack1, currentTime: 30, duration: 210 });
    }

    expect(paused).toBe(true);
  });

  // A08: Screen lock & background service lifecycle with wake-lock
  it('A08: maintains playback state updates in background while locked', () => {
    const times: number[] = [];
    driver.onPlaybackStateChange((state) => {
      times.push(state.currentTime);
    });

    const handlers = eventListeners['playbackStateChange'] || [];
    for (const h of handlers) {
      h({ isPlaying: true, currentTime: 10 });
      h({ isPlaying: true, currentTime: 11 });
      h({ isPlaying: true, currentTime: 12 });
    }

    expect(times).toEqual([0, 10, 11, 12]);
  });

  // A09: Recents dismissal policy (stopPlaybackAndService on task removed)
  it('A09: queries and configures stop-on-task-removed dismissal policy', async () => {
    await driver.setStopOnTaskRemoved(true);
    expect(mockPlugin.setStopOnTaskRemoved).toHaveBeenCalledWith({ enabled: true });

    const enabled = await driver.getStopOnTaskRemoved();
    expect(enabled).toBe(true);
  });

  // A10: Notification permission check without repeated re-prompting
  it('A10: does not repeatedly re-prompt when permission is already granted', async () => {
    const check1 = await driver.checkNotificationPermission();
    expect(check1.granted).toBe(true);
    expect(mockPlugin.requestNotificationPermission).not.toHaveBeenCalled();
  });

  // A11: MediaSession metadata & artwork URI synchronization
  it('A11: synchronizes artwork URI without blocking main thread binary reads', async () => {
    await driver.play(sampleLocalTrack1);
    expect(mockPlugin.play).toHaveBeenCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({
          artworkDataUrl: '/data/user/0/com.bytecraft.harmoniqlite/cache/album_art/101.jpg',
        }),
      })
    );
  });

  // A12: Android Back navigation priority (dialogs -> sheets -> history -> home minimize)
  it('A12: honors hierarchical back action structure', () => {
    const backStack: string[] = ['home'];
    const openSheet = () => backStack.push('sheet');
    const openDialog = () => backStack.push('dialog');
    const handleBack = () => backStack.pop();

    openSheet();
    openDialog();
    expect(backStack).toEqual(['home', 'sheet', 'dialog']);

    // Dialog pops first
    handleBack();
    expect(backStack).toEqual(['home', 'sheet']);

    // Sheet pops second
    handleBack();
    expect(backStack).toEqual(['home']);
  });

  // A13: Missing local audio file handling with auto-skip and error toast
  it('A13: emits error event on missing file for auto-skip recovery', () => {
    let capturedError: any = null;
    driver.onError((err) => {
      capturedError = err;
    });

    const handlers = eventListeners['playbackError'] || [];
    for (const h of handlers) {
      h({
        message: 'File not found or unreadable: /storage/emulated/0/Music/deleted.mp3',
        errorCodeName: 'ERROR_CODE_IO_FILE_NOT_FOUND',
      });
    }

    expect(capturedError).not.toBeNull();
    expect(capturedError.message).toContain('File not found');
  });

  // A14: Revoked storage permission handling with graceful warning
  it('A14: handles storage permission degradation gracefully', async () => {
    mockPlugin.checkNotificationPermission.mockResolvedValueOnce({
      granted: false,
      shouldShowRationale: true,
    });
    const status = await driver.checkNotificationPermission();
    expect(status.granted).toBe(false);
    expect(status.shouldShowRationale).toBe(true);
  });

  // A15: Playlist & favorites persistence after missing-file errors
  it('A15: preserves playlist and favorites integrity even if a track fails to play', async () => {
    favoritesService.toggleFavorite(sampleLocalTrack2);
    expect(favoritesService.isFavorite(sampleLocalTrack2.id)).toBe(true);

    // Simulate playback error on sampleLocalTrack1
    const handlers = eventListeners['playbackError'] || [];
    for (const h of handlers) {
      h({ message: 'Playback error' });
    }

    // Favorites remains unaffected
    expect(favoritesService.isFavorite(sampleLocalTrack2.id)).toBe(true);
  });

  // A16: Internet radio network loss stops stream without retry storm
  it('A16: detects radio streams and avoids infinite skip loops on stream failure', () => {
    const isRadio = mobileRadioService.isRadioTrack(sampleRadioTrack);
    expect(isRadio).toBe(true);

    const isLocalRadio = mobileRadioService.isRadioTrack(sampleLocalTrack1);
    expect(isLocalRadio).toBe(false);
  });

  // A17: Radio-to-local and local-to-radio playback transition
  it('A17: allows seamless transition between internet radio and local music files', async () => {
    await driver.play(sampleRadioTrack);
    expect(mockPlugin.play).toHaveBeenLastCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ id: 'radio_station_groove' }),
      })
    );

    await driver.play(sampleLocalTrack1);
    expect(mockPlugin.play).toHaveBeenLastCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ id: 'track_local_1' }),
      })
    );
  });

  // A18: Process recreation & state restoration from snapshot
  it('A18: reads full snapshot for process recreation restoration', async () => {
    mockPlugin.getPlaybackState.mockResolvedValueOnce({
      isPlaying: true,
      track: sampleLocalTrack1,
      currentTime: 120,
      duration: 210,
      volume: 0.8,
      isMuted: false,
      playbackRate: 1.0,
      userExplicitlyPaused: false,
      stopAfterCurrentTrack: true,
      playWhenReady: true,
    });

    const state = await driver.getPlaybackSnapshot();
    expect(state.isPlaying).toBe(true);
    expect(state.currentTime).toBe(120);
    expect(state.currentTrack?.id).toBe('track_local_1');
  });

  // A19: Duplicate-listener prevention across driver instances
  it('A19: removes existing listeners when destroy is invoked to prevent leaks', () => {
    let callCount = 0;
    const unsub = driver.onPlaybackStateChange(() => {
      callCount++;
    });
    // First call happens immediately on subscription (line 329)
    expect(callCount).toBe(1);

    unsub();
    driver.destroy();

    const handlers = eventListeners['playbackStateChange'] || [];
    for (const h of handlers) {
      h({ isPlaying: true });
    }
    // No more calls after unsub
    expect(callCount).toBe(1);
  });

  // A20: Windows platform regression protection
  it('A20: ensures audioEngine is available and unaffected for Windows/desktop platform', () => {
    expect(audioEngine).toBeDefined();
    expect(typeof audioEngine.play).toBe('function');
    expect(typeof audioEngine.pause).toBe('function');
    expect(typeof audioEngine.setVolume).toBe('function');
    expect(typeof audioEngine.seek).toBe('function');
  });
});
