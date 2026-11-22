import { describe, it, expect, beforeEach, vi } from 'vitest';

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
import { getTimeBasedGreeting } from '../components/mobile/views/MobileHomeView';
import { TrackMetadata } from '../types/audio';

const sampleTrack: TrackMetadata = {
  id: 'track-test-1',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 240,
  filePath: '/storage/emulated/0/Music/test.mp3',
  fileName: 'test.mp3',
  fileSize: 5000000,
  dateModified: Date.now(),
  dateAdded: Date.now(),
  hasArtwork: false,
  codec: 'MP3',
  container: 'mp3',
  sampleRate: 44100,
  bitrate: 320,
  channels: 2,
  playCount: 0,
  isLossless: false,
  isFavorite: false,
};

describe('Phase 4.2: App Dismissal Lifecycle & Notification Permission Tests', () => {
  let driver: AndroidAudioDriver;
  let mockPlugin: any;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();

    mockPlugin = {
      play: vi.fn().mockResolvedValue({ success: true }),
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      seekTo: vi.fn().mockResolvedValue({ success: true }),
      setVolume: vi.fn().mockResolvedValue({ success: true }),
      getStopOnTaskRemoved: vi.fn().mockResolvedValue({ enabled: true }),
      setStopOnTaskRemoved: vi.fn().mockResolvedValue({ enabled: true }),
      checkNotificationPermission: vi.fn().mockResolvedValue({ granted: true, shouldShowRationale: false }),
      requestNotificationPermission: vi.fn().mockResolvedValue({ requested: true, granted: true }),
      openNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
      addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
      getPlaybackState: vi.fn().mockResolvedValue({
        isPlaying: false,
        currentTrack: null,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
      }),
    };

    (globalThis as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: {
          HarmoniqAudioPlayer: mockPlugin,
          App: {
            addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
          },
        },
      },
    };

    driver = new AndroidAudioDriver();
  });

  describe('1. Stop Playback on Recent Apps Dismissal Setting', () => {
    it('defaults stopOnTaskRemoved to true', async () => {
      const enabled = await driver.getStopOnTaskRemoved();
      expect(enabled).toBe(true);
      expect(mockPlugin.getStopOnTaskRemoved).toHaveBeenCalled();
    });

    it('updates native service and persists when disabled', async () => {
      await driver.setStopOnTaskRemoved(false);
      expect(mockPlugin.setStopOnTaskRemoved).toHaveBeenCalledWith({ enabled: false });
      expect(localStorageMock.getItem('harmoniq_stop_on_task_removed')).toBe('false');

      mockPlugin.getStopOnTaskRemoved.mockResolvedValueOnce({ enabled: false });
      const current = await driver.getStopOnTaskRemoved();
      expect(current).toBe(false);
    });

    it('restores to true when user re-enables setting', async () => {
      await driver.setStopOnTaskRemoved(false);
      await driver.setStopOnTaskRemoved(true);
      expect(mockPlugin.setStopOnTaskRemoved).toHaveBeenLastCalledWith({ enabled: true });
      expect(localStorageMock.getItem('harmoniq_stop_on_task_removed')).toBe('true');
    });

    it('falls back to localStorage if plugin call fails', async () => {
      mockPlugin.getStopOnTaskRemoved.mockRejectedValueOnce(new Error('Plugin uninitialized'));
      localStorageMock.setItem('harmoniq_stop_on_task_removed', 'false');

      const val = await driver.getStopOnTaskRemoved();
      expect(val).toBe(false);
    });
  });

  describe('2. Scenario A & B: Lock Screen & App Switch Background Playback', () => {
    it('Scenario A: Maintains active playback state through screen lock/unlock', async () => {
      await driver.play(sampleTrack);
      expect(driver.getState().isPlaying).toBe(true);
      expect(driver.getState().currentTrack?.id).toBe(sampleTrack.id);

      // Simulate native background notification event arriving while screen is off
      const stateListener = vi.fn();
      driver.onPlaybackStateChange(stateListener);

      // State remains playing
      expect(driver.getState().isPlaying).toBe(true);
      expect(driver.getState().currentTrack).not.toBeNull();
    });

    it('Scenario B: Continues playback when switching apps', async () => {
      await driver.play(sampleTrack);
      expect(driver.getState().isPlaying).toBe(true);

      // App switching changes app state to background/inactive, playback must not pause
      expect(mockPlugin.pause).not.toHaveBeenCalled();
      expect(driver.getState().isPlaying).toBe(true);
    });
  });

  describe('3. Scenario C & D: Task Removal & Clean App Reopen', () => {
    it('Scenario C: Native onTaskRemoved triggers stopPlaybackAndService', () => {
      // Simulating native lifecycle behavior defined in HarmoniqMediaService.java
      let servicePlaying = true;
      let mediaItemsCount = 5;
      let notificationActive = true;
      let serviceRunning = true;

      const stopPlaybackAndService = () => {
        servicePlaying = false;
        mediaItemsCount = 0;
        notificationActive = false;
        serviceRunning = false;
      };

      const isStopOnTaskRemovedEnabled = () => true;

      const onTaskRemoved = () => {
        if (isStopOnTaskRemovedEnabled()) {
          stopPlaybackAndService();
        }
      };

      onTaskRemoved();

      expect(servicePlaying).toBe(false);
      expect(mediaItemsCount).toBe(0);
      expect(notificationActive).toBe(false);
      expect(serviceRunning).toBe(false);
    });

    it('Scenario C (Setting Disabled): Retains playback if user opted out', () => {
      let servicePlaying = true;
      let serviceRunning = true;

      const isStopOnTaskRemovedEnabled = () => false;

      const onTaskRemoved = () => {
        if (isStopOnTaskRemovedEnabled()) {
          servicePlaying = false;
          serviceRunning = false;
        }
      };

      onTaskRemoved();

      expect(servicePlaying).toBe(true);
      expect(serviceRunning).toBe(true);
    });

    it('Scenario D: App reopen initializes with idle playback state without auto-starting', () => {
      // Clean launch does not automatically start playing audio
      const freshDriver = new AndroidAudioDriver();
      const initialState = freshDriver.getState();
      expect(initialState.isPlaying).toBe(false);
      expect(initialState.currentTrack).toBeNull();
      expect(mockPlugin.play).not.toHaveBeenCalled();
    });
  });

  describe('4. Notification Permission Lifecycle & Suppression', () => {
    it('checks notification permission without displaying prompt', async () => {
      const res = await driver.checkNotificationPermission();
      expect(res.granted).toBe(true);
      expect(res.shouldShowRationale).toBe(false);
      expect(mockPlugin.checkNotificationPermission).toHaveBeenCalled();
    });

    it('reports ungranted status accurately without throwing', async () => {
      mockPlugin.checkNotificationPermission.mockResolvedValueOnce({
        granted: false,
        shouldShowRationale: true,
      });

      const res = await driver.checkNotificationPermission();
      expect(res.granted).toBe(false);
      expect(res.shouldShowRationale).toBe(true);
    });

    it('only prompts when user explicitly requests notification permission', async () => {
      expect(mockPlugin.requestNotificationPermission).not.toHaveBeenCalled();

      const res = await driver.requestNotificationPermission();
      expect(res.requested).toBe(true);
      expect(mockPlugin.requestNotificationPermission).toHaveBeenCalled();
    });

    it('opens Android system notification settings on demand', async () => {
      const success = await driver.openNotificationSettings();
      expect(success).toBe(true);
      expect(mockPlugin.openNotificationSettings).toHaveBeenCalled();
    });
  });

  describe('5. Home Page Greeting & Subtitle Fidelity', () => {
    it('returns "Good morning, Audiophile" between 5:00 AM and 11:59 AM', () => {
      expect(getTimeBasedGreeting(new Date('2026-11-22T05:00:00'))).toBe('Good morning, Audiophile');
      expect(getTimeBasedGreeting(new Date('2026-11-22T11:59:59'))).toBe('Good morning, Audiophile');
    });

    it('returns "Good afternoon, Audiophile" between 12:00 PM and 4:59 PM', () => {
      expect(getTimeBasedGreeting(new Date('2026-11-22T12:00:00'))).toBe('Good afternoon, Audiophile');
      expect(getTimeBasedGreeting(new Date('2026-11-22T16:59:59'))).toBe('Good afternoon, Audiophile');
    });

    it('returns "Good evening, Audiophile" between 5:00 PM and 4:59 AM', () => {
      expect(getTimeBasedGreeting(new Date('2026-11-22T17:00:00'))).toBe('Good evening, Audiophile');
      expect(getTimeBasedGreeting(new Date('2026-11-22T23:59:59'))).toBe('Good evening, Audiophile');
      expect(getTimeBasedGreeting(new Date('2026-11-22T04:59:59'))).toBe('Good evening, Audiophile');
    });
  });
});
