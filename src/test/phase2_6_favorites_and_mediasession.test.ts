import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoritesService } from '../services/favoritesService';
import { TrackMetadata } from '../types/audio';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (globalThis as any).localStorage = localStorageMock;
}

describe('Phase 2.6: Favorites Management & Android MediaSession Regression Suite', () => {
  let mockStorage: Map<string, any>;

  const sampleTrackA: TrackMetadata = {
    id: 'track_1',
    filePath: 'content://media/external/audio/media/1001',
    fileName: 'song_a.flac',
    fileSize: 25000000,
    dateModified: 1700000000,
    title: 'High-Res FLAC Master',
    artist: 'Harmoniq Audio Lab',
    album: 'Audiophile Sessions',
    duration: 240,
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

  const sampleTrackB: TrackMetadata = {
    id: 'track_2',
    filePath: 'content://media/external/audio/media/1002',
    fileName: 'song_b.mp3',
    fileSize: 8000000,
    dateModified: 1700000500,
    title: 'Standard MP3 Release',
    artist: 'Harmoniq Audio Lab',
    album: 'Audiophile Sessions',
    duration: 180,
    hasArtwork: false,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    playCount: 0,
    isFavorite: false,
  };

  beforeEach(() => {
    mockStorage = new Map();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Favorites Lifecycle & Multi-Tier Persistence', () => {
    it('marks a track as favorite and updates index', () => {
      const favService = new FavoritesService();
      expect(favService.isFavorite(sampleTrackA)).toBe(false);

      const toggled = favService.toggleFavorite({ ...sampleTrackA });
      expect(toggled).toBe(true);
      expect(favService.isFavorite(sampleTrackA.id)).toBe(true);
      expect(favService.isFavorite(sampleTrackA)).toBe(true);
    });

    it('removes a track from favorites and updates state immediately', () => {
      const favService = new FavoritesService();
      favService.toggleFavorite({ ...sampleTrackA });
      expect(favService.isFavorite(sampleTrackA.id)).toBe(true);

      const untoggled = favService.toggleFavorite({ ...sampleTrackA, isFavorite: true });
      expect(untoggled).toBe(false);
      expect(favService.isFavorite(sampleTrackA.id)).toBe(false);
    });

    it('persists favorites to localStorage and emits change events', () => {
      const favService = new FavoritesService();
      let emitCount = 0;
      favService.subscribe(() => {
        emitCount++;
      });

      favService.toggleFavorite({ ...sampleTrackA });
      expect(emitCount).toBeGreaterThanOrEqual(1);

      const raw = localStorage.getItem('harmoniq_favorites_v2');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe(sampleTrackA.id);
    });

    it('restores favorites on service initialization across restarts', () => {
      const savedList = [{ ...sampleTrackA, isFavorite: true }];
      localStorage.setItem('harmoniq_favorites_v2', JSON.stringify(savedList));

      const freshFavService = new FavoritesService();
      expect(freshFavService.isFavorite(sampleTrackA.id)).toBe(true);
      const allFavs = freshFavService.getFavorites();
      expect(allFavs.length).toBe(1);
      expect(allFavs[0].title).toBe(sampleTrackA.title);
    });

    it('synchronizes favorites with local library scan results', () => {
      const favService = new FavoritesService();
      favService.toggleFavorite({ ...sampleTrackA });

      const localLibrary = [
        { ...sampleTrackA, isFavorite: true },
        { ...sampleTrackB, isFavorite: false },
      ];

      // syncWithLocalLibrary should preserve existing favorites
      favService.syncWithLocalLibrary(localLibrary);
      expect(favService.isFavorite(sampleTrackA.id)).toBe(true);
      expect(favService.isFavorite(sampleTrackB.id)).toBe(false);
    });
  });

  describe('2. Smart Favorites Playlist Generation', () => {
    it('filters tracks accurately for smart_favorites criteria', () => {
      const tracks = [
        { ...sampleTrackA, isFavorite: true },
        { ...sampleTrackB, isFavorite: false },
      ];

      const favoritesList = tracks.filter((t) => t.isFavorite);
      expect(favoritesList.length).toBe(1);
      expect(favoritesList[0].id).toBe(sampleTrackA.id);
    });

    it('handles empty favorites collection with clean zero count', () => {
      const tracks = [
        { ...sampleTrackA, isFavorite: false },
        { ...sampleTrackB, isFavorite: false },
      ];

      const favoritesList = tracks.filter((t) => t.isFavorite);
      expect(favoritesList.length).toBe(0);
    });
  });

  describe('3. Android Audio Driver Native MediaSession Synchronization', () => {
    it('initializes in stopped state with default playback values', () => {
      const driver = new AndroidAudioDriver();
      const state = driver.getState();

      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.volume).toBe(1.0);
      expect(state.isMuted).toBe(false);
    });

    it('notifies playback state change listeners when state updates', () => {
      const driver = new AndroidAudioDriver();
      const states: boolean[] = [];

      driver.onPlaybackStateChange((s) => {
        states.push(s.isPlaying);
      });

      // Initial subscription notification
      expect(states.length).toBe(1);
      expect(states[0]).toBe(false);
    });

    it('supports queue manipulation without errors', async () => {
      const driver = new AndroidAudioDriver();
      await driver.setQueue([sampleTrackA, sampleTrackB]);
      await driver.addToQueue({ ...sampleTrackA, id: 'track_3' });
      await driver.playNext({ ...sampleTrackB, id: 'track_0' });
      await driver.clearQueue();

      expect(driver.getState().isPlaying).toBe(false);
    });
  });

  describe('4. Android Lifecycle & Now Playing State Restoration Across Lock/Unlock', () => {
    let mockNativeSnapshot: any = null;
    let mockListeners: Record<string, ((data: any) => void)[]> = {};

    beforeEach(() => {
      mockListeners = {};
      mockNativeSnapshot = {
        isPlaying: true,
        currentTime: 75.4,
        duration: 240.0,
        trackId: sampleTrackA.id,
        track: sampleTrackA,
        queue: [sampleTrackA, sampleTrackB],
        currentQueueIndex: 0,
        volume: 0.9,
      };

      (globalThis as any).Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          HarmoniqAudioPlayer: {
            getPlaybackState: vi.fn(async () => mockNativeSnapshot),
            getState: vi.fn(async () => mockNativeSnapshot),
            play: vi.fn(async () => {}),
            pause: vi.fn(async () => {}),
            resume: vi.fn(async () => {}),
            seekTo: vi.fn(async () => {}),
            setVolume: vi.fn(async () => {}),
            addListener: vi.fn((event: string, cb: (data: any) => void) => {
              if (!mockListeners[event]) mockListeners[event] = [];
              mockListeners[event].push(cb);
              return { remove: () => {} };
            }),
          },
          App: {
            addListener: vi.fn(async (event: string, cb: any) => {
              if (!mockListeners[event]) mockListeners[event] = [];
              mockListeners[event].push(cb);
              return { remove: () => {} };
            }),
          },
        },
      };
    });

    it('Scenario 1: Screen off -> screen on restores active track and position', async () => {
      const driver = new AndroidAudioDriver();
      const snapshot = await driver.getPlaybackSnapshot();

      expect(snapshot.isPlaying).toBe(true);
      expect(snapshot.currentTime).toBe(75.4);
      expect(snapshot.duration).toBe(240.0);
      expect(snapshot.currentTrack?.id).toBe(sampleTrackA.id);
      expect(snapshot.currentTrack?.title).toBe('High-Res FLAC Master');
    });

    it('Scenario 2: App background -> foreground restores queue and metadata', async () => {
      const driver = new AndroidAudioDriver();
      await driver.getPlaybackSnapshot();

      const state = driver.getState();
      expect(state.currentTrack?.title).toBe('High-Res FLAC Master');
      expect(state.queue?.length).toBe(2);
      expect(state.queue?.[1].title).toBe('Standard MP3 Release');
    });

    it('Scenario 3: Playing -> background -> resume preserves continuous playing state without restart', async () => {
      const driver = new AndroidAudioDriver();
      mockNativeSnapshot.isPlaying = true;
      mockNativeSnapshot.currentTime = 112.0;

      await driver.getPlaybackSnapshot();
      expect(driver.getState().isPlaying).toBe(true);
      expect(driver.getState().currentTime).toBe(112.0);
      // Playback was not restarted, play method was never called
      expect((globalThis as any).Capacitor.Plugins.HarmoniqAudioPlayer.play).not.toHaveBeenCalled();
    });

    it('Scenario 4: Paused -> background -> resume preserves paused state and exact timestamp', async () => {
      const driver = new AndroidAudioDriver();
      mockNativeSnapshot.isPlaying = false;
      mockNativeSnapshot.currentTime = 45.0;

      await driver.getPlaybackSnapshot();
      expect(driver.getState().isPlaying).toBe(false);
      expect(driver.getState().currentTime).toBe(45.0);
      expect(driver.getState().currentTrack?.id).toBe(sampleTrackA.id);
    });

    it('Scenario 5: Track changes while app is backgrounded updates to the new track', async () => {
      const driver = new AndroidAudioDriver();
      // Track transitioned while locked/backgrounded
      mockNativeSnapshot.currentQueueIndex = 1;
      mockNativeSnapshot.trackId = sampleTrackB.id;
      mockNativeSnapshot.track = sampleTrackB;
      mockNativeSnapshot.currentTime = 12.3;

      await driver.getPlaybackSnapshot();
      expect(driver.getState().trackId).toBe(sampleTrackB.id);
      expect(driver.getState().currentTrack?.title).toBe('Standard MP3 Release');
      expect(driver.getState().currentTime).toBe(12.3);
    });

    it('Scenario 6: React state restoration from native playback state', async () => {
      const driver = new AndroidAudioDriver();
      let reactCurrentTrack: TrackMetadata | null = null;
      let reactIsPlaying = false;
      let reactCurrentTime = 0;

      driver.onPlaybackStateChange((status) => {
        if (status.currentTrack) {
          reactCurrentTrack = status.currentTrack;
        }
        reactIsPlaying = status.isPlaying;
        reactCurrentTime = status.currentTime;
      });

      await driver.getPlaybackSnapshot();

      expect(reactCurrentTrack).not.toBeNull();
      expect((reactCurrentTrack as any).title).toBe('High-Res FLAC Master');
      expect(reactIsPlaying).toBe(true);
      expect(reactCurrentTime).toBe(75.4);
    });

    it('Scenario 7: Missing or stale track metadata falls back safely to queue match', async () => {
      const driver = new AndroidAudioDriver();
      // Snapshot only has trackId, missing track object
      mockNativeSnapshot.track = null;
      mockNativeSnapshot.trackId = sampleTrackB.id;
      mockNativeSnapshot.queue = [sampleTrackA, sampleTrackB];

      await driver.getPlaybackSnapshot();

      const state = driver.getState();
      expect(state.trackId).toBe(sampleTrackB.id);
      const queueMatch = state.queue?.find((t) => t.id === state.trackId);
      expect(queueMatch?.title).toBe('Standard MP3 Release');
    });

    it('Scenario 8: Repeated foreground/background transitions remain consistent without leaks', async () => {
      const driver = new AndroidAudioDriver();

      for (let i = 1; i <= 5; i++) {
        mockNativeSnapshot.currentTime = i * 20;
        await driver.getPlaybackSnapshot();
        expect(driver.getState().currentTime).toBe(i * 20);
        expect(driver.getState().currentTrack?.id).toBe(sampleTrackA.id);
      }
    });
  });
});
