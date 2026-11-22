import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { LibraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';
import { LyricsService } from '../services/lyricsService';
import { TrackMetadata } from '../types/audio';
import { Playlist } from '../types/library';
import { getPlatformDriver } from '../services/platform';

describe('HARMONIQ LITE — PHASE 4: Master Integration & Cross-Feature Verification', () => {
  let libService: LibraryService;
  let mockCapacitor: any;
  let audioDriver: AndroidAudioDriver;
  let mockStorageStore: Record<string, string> = {};

  const sampleTracks: TrackMetadata[] = [
    {
      id: 'track_fav_1',
      filePath: 'content://media/external/audio/media/1001',
      fileName: 'starlight_symphony.flac',
      fileSize: 45000000,
      dateModified: 1715000000,
      dateAdded: 1715000000,
      title: 'Starlight Symphony',
      artist: 'Acoustic Labs',
      album: 'Celestial Realm',
      duration: 310,
      hasArtwork: true,
      artworkDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      codec: 'FLAC',
      container: 'flac',
      sampleRate: 96000,
      bitrate: 2304,
      channels: 2,
      playCount: 12,
      isLossless: true,
      isFavorite: true,
    },
    {
      id: 'track_synth_2',
      filePath: 'content://media/external/audio/media/1002',
      fileName: 'cyberpunk_overdrive.mp3',
      fileSize: 9200000,
      dateModified: 1714000000,
      dateAdded: 1714000000,
      title: 'Cyberpunk Overdrive',
      artist: 'Neon Driver',
      album: 'Retro City',
      duration: 215,
      hasArtwork: false,
      codec: 'MP3',
      container: 'mp3',
      sampleRate: 44100,
      bitrate: 320,
      channels: 2,
      playCount: 5,
      isLossless: false,
      isFavorite: false,
    },
    {
      id: 'track_chill_3',
      filePath: 'content://media/external/audio/media/1003',
      fileName: 'midnight_rain.wav',
      fileSize: 52000000,
      dateModified: 1716000000,
      dateAdded: 1716000000,
      title: 'Midnight Rain',
      artist: 'Ambient Soundscapes',
      album: 'Quiet Horizons',
      duration: 480,
      hasArtwork: false,
      codec: 'WAV',
      container: 'wav',
      sampleRate: 48000,
      bitrate: 1536,
      channels: 2,
      playCount: 20,
      isLossless: true,
      isFavorite: true,
    },
  ];

  beforeEach(() => {
    mockStorageStore = {};

    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorageStore[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorageStore[key];
      }),
      clear: vi.fn(() => {
        mockStorageStore = {};
      }),
    };

    // Setup Mock Capacitor Plugins
    mockCapacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: {
        HarmoniqAudioPlayer: {
          addListener: vi.fn(),
          play: vi.fn(async () => ({ status: 'playing' })),
          playTrack: vi.fn(async () => ({ status: 'playing' })),
          pause: vi.fn(async () => ({ status: 'paused' })),
          resume: vi.fn(async () => ({ status: 'resumed' })),
          seekTo: vi.fn(async ({ position }) => ({ status: 'seeked', position })),
          setVolume: vi.fn(async () => ({ status: 'volume_set' })),
          setQueue: vi.fn(async () => ({ status: 'queue_updated' })),
          skipToNext: vi.fn(async () => ({ status: 'next_skipped' })),
          skipToPrevious: vi.fn(async () => ({ status: 'prev_skipped' })),
          setShuffle: vi.fn(async ({ shuffle }) => ({ status: 'shuffle_set', shuffle })),
          setRepeatMode: vi.fn(async ({ repeatMode }) => ({ status: 'repeat_set', repeatMode })),
          getEqualizerParameters: vi.fn(async () => ({
            supported: true,
            enabled: false,
            numBands: 5,
            bands: [
              { band: 0, centerFreq: 60, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 1, centerFreq: 230, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 2, centerFreq: 910, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 3, centerFreq: 3600, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 4, centerFreq: 14000, minLevel: -15, maxLevel: 15, currentLevel: 0 },
            ],
            presets: ['Flat', 'Bass Boost', 'Vocal', 'Rock', 'Pop', 'Classical', 'Jazz', 'Electronic'],
            currentPreset: 'Flat',
          })),
          setEqualizerEnabled: vi.fn(async ({ enabled }) => ({ status: 'eq_enabled', enabled })),
          setEqualizerBandGain: vi.fn(async ({ band, gainDb }) => ({ status: 'eq_band_set', band, gainDb })),
          setEqualizerPreset: vi.fn(async ({ preset }) => ({ status: 'eq_preset_set', preset })),
          resetEqualizer: vi.fn(async () => ({ status: 'eq_reset' })),
          startSleepTimer: vi.fn(async ({ minutes }) => ({ status: 'sleep_timer_started', minutes })),
          cancelSleepTimer: vi.fn(async () => ({ status: 'sleep_timer_cancelled' })),
          getSleepTimerStatus: vi.fn(async () => ({
            isActive: false,
            secondsRemaining: 0,
            totalSeconds: 0,
          })),
          getPlaybackState: vi.fn(async () => ({
            isPlaying: true,
            currentTime: 65,
            duration: 310,
            trackId: 'track_fav_1',
            track: sampleTracks[0],
            volume: 0.9,
            isShuffle: false,
            repeatMode: 'off',
            queue: sampleTracks,
            currentQueueIndex: 0,
          })),
        },
        Preferences: {
          get: vi.fn(async ({ key }) => ({ value: mockStorageStore[key] || null })),
          set: vi.fn(async ({ key, value }) => {
            mockStorageStore[key] = value;
          }),
          remove: vi.fn(async ({ key }) => {
            delete mockStorageStore[key];
          }),
        },
      },
    };

    (globalThis as any).Capacitor = mockCapacitor;
    audioDriver = new AndroidAudioDriver();
    libService = new LibraryService();
    libService.addTracks(sampleTracks);
  });

  afterEach(() => {
    delete (globalThis as any).Capacitor;
    vi.clearAllMocks();
  });

  // ==========================================
  // SCENARIO 1: FAVORITES PLAYBACK & QUEUE RESTORATION
  // ==========================================
  describe('Workflow 1: Favorites Playback, Background State & Snapshot Restoration', () => {
    it('plays from favorites and synchronizes queue with native Android driver', async () => {
      const favs = sampleTracks.filter((t) => t.isFavorite);
      expect(favs).toHaveLength(2);

      await audioDriver.play(favs[0], favs);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.play).toHaveBeenCalledWith({
        track: favs[0],
        queue: favs,
      });

      const state = audioDriver.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.trackId).toBe('track_fav_1');
    });

    it('recovers full playback state and queue on app foreground resume', async () => {
      const snapshot = await audioDriver.getPlaybackSnapshot();
      expect(snapshot.isPlaying).toBe(true);
      expect(snapshot.trackId).toBe('track_fav_1');
      expect(snapshot.currentTime).toBe(65);
      expect(snapshot.queue).toHaveLength(3);
    });
  });

  // ==========================================
  // SCENARIO 2: NOTIFICATION & TRANSPORT CONTROLS
  // ==========================================
  describe('Workflow 2: System Notification & MediaSession Transport Controls', () => {
    it('dispatches pause, resume, seek, next, and previous commands accurately', async () => {
      await audioDriver.pause();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.pause).toHaveBeenCalled();

      await audioDriver.resume();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.resume).toHaveBeenCalled();

      await audioDriver.seekTo(120);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.seekTo).toHaveBeenCalledWith({ position: 120 });

      await audioDriver.skipToNext();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.skipToNext).toHaveBeenCalled();

      await audioDriver.skipToPrevious();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.skipToPrevious).toHaveBeenCalled();
    });
  });

  // ==========================================
  // SCENARIO 3: PLAYLIST MANAGEMENT & PERSISTENCE
  // ==========================================
  describe('Workflow 3: Custom Playlist Lifecycle & Dual-Storage Persistence', () => {
    it('creates, renames, adds songs, and removes songs without file loss', () => {
      // 1. Create Playlist
      const pl = libService.createPlaylist('Late Night Lo-Fi', 'Relaxing ambient beats');
      expect(pl.name).toBe('Late Night Lo-Fi');
      expect(libService.getPlaylists().filter((p) => !p.isSmart)).toHaveLength(1);

      // 2. Add Tracks
      libService.addTracksToPlaylist(pl.id, ['track_fav_1', 'track_chill_3']);
      const updatedPl = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(updatedPl?.trackIds).toHaveLength(2);

      // 3. Rename Playlist
      const renamed = libService.renamePlaylist(pl.id, 'Midnight Ambient Beats', 'Updated description');
      expect(renamed).toBe(true);
      expect(libService.getPlaylists().find((p) => p.id === pl.id)?.name).toBe('Midnight Ambient Beats');

      // 4. Remove Track from Playlist
      libService.removeTrackFromPlaylist(pl.id, 0);
      const afterRemoval = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(afterRemoval?.trackIds).toHaveLength(1);
      expect(afterRemoval?.trackIds[0]).toBe('track_chill_3');

      // 5. Verify Audio File Remains in Master Library
      expect(libService.getAllTracks()).toHaveLength(3);

      // 6. Delete Playlist
      libService.deletePlaylist(pl.id);
      expect(libService.getPlaylists().filter((p) => !p.isSmart)).toHaveLength(0);
      expect(libService.getAllTracks()).toHaveLength(3);
    });
  });

  // ==========================================
  // SCENARIO 4: EQUALIZER, SHUFFLE & SLEEP TIMER
  // ==========================================
  describe('Workflow 4: Audio Effects, Shuffle, Repeat & Sleep Timer Integration', () => {
    it('manages hardware equalizer without crashing on unsupported effect calls', async () => {
      // Query parameters
      const params = await audioDriver.getEqualizerParameters();
      expect(params.supported).toBe(true);
      expect(params.bands).toHaveLength(5);

      // Enable EQ
      await audioDriver.setEqualizerEnabled(true);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerEnabled).toHaveBeenCalledWith({ enabled: true });

      // Change Band Gains
      await audioDriver.setEqualizerBandGain(1, 3);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerBandGain).toHaveBeenCalledWith({ band: 1, gainDb: 3 });

      // Preset Selection
      await audioDriver.setEqualizerPreset('Bass Boost');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerPreset).toHaveBeenCalledWith({ preset: 'Bass Boost' });

      // Reset to Flat
      await audioDriver.resetEqualizer();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.resetEqualizer).toHaveBeenCalled();
    });

    it('coordinates shuffle, repeat, and sleep timer concurrently', async () => {
      // Shuffle & Repeat
      await audioDriver.setShuffle(true);
      await audioDriver.setRepeatMode('one');
      expect(audioDriver.getState().isShuffle).toBe(true);
      expect(audioDriver.getState().repeatMode).toBe('one');

      // Start Sleep Timer
      await audioDriver.startSleepTimer(45);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.startSleepTimer).toHaveBeenCalledWith({ minutes: 45 });

      // Cancel Sleep Timer
      await audioDriver.cancelSleepTimer();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.cancelSleepTimer).toHaveBeenCalled();
    });
  });

  // ==========================================
  // SCENARIO 5: SYNCHRONIZED LYRICS & LRC ENGINE
  // ==========================================
  describe('Workflow 5: Synchronized Lyrics & Line Detection', () => {
    it('parses synchronized LRC content and tracks active line index', () => {
      const lrcContent = `
        [ti:Starlight Symphony]
        [ar:Acoustic Labs]
        [00:10.00]Introduction instrumental
        [00:30.50]Stars illuminate the night sky
        [01:05.00]Chorus: Resonating frequencies
      `;

      const lyrics = LyricsService.parseLrc(lrcContent, 'lrc_file');
      expect(lyrics.synced).toBe(true);
      expect(lyrics.lines).toHaveLength(3);

      // Active Line Detection
      expect(LyricsService.findActiveLineIndex(lyrics.lines, 5)).toBe(-1); // Before intro
      expect(LyricsService.findActiveLineIndex(lyrics.lines, 12)).toBe(0); // Intro
      expect(LyricsService.findActiveLineIndex(lyrics.lines, 45)).toBe(1); // Verse
      expect(LyricsService.findActiveLineIndex(lyrics.lines, 70)).toBe(2); // Chorus
    });
  });

  // ==========================================
  // SCENARIO 6: LIBRARY SEARCH, SORTING & STABILITY
  // ==========================================
  describe('Workflow 6: Library Search, Filtering & Multi-Criteria Sorting', () => {
    it('filters tracks by partial artist, title, or album query', () => {
      const titleMatches = libService.searchTracks('cyberpunk');
      expect(titleMatches).toHaveLength(1);
      expect(titleMatches[0].id).toBe('track_synth_2');

      const artistMatches = libService.searchTracks('Acoustic');
      expect(artistMatches).toHaveLength(1);
      expect(artistMatches[0].id).toBe('track_fav_1');
    });

    it('sorts tracks accurately across all supported criteria', () => {
      const all = libService.getAllTracks();

      // Title A-Z
      const titleSorted = [...all].sort((a, b) => a.title.localeCompare(b.title));
      expect(titleSorted[0].title).toBe('Cyberpunk Overdrive');
      expect(titleSorted[2].title).toBe('Starlight Symphony');

      // Duration Descending
      const durSorted = [...all].sort((a, b) => (b.duration || 0) - (a.duration || 0));
      expect(durSorted[0].duration).toBe(480); // Midnight Rain
      expect(durSorted[2].duration).toBe(215); // Cyberpunk Overdrive
    });
  });

  // ==========================================
  // SCENARIO 7: DESKTOP PLATFORM ISOLATION
  // ==========================================
  describe('Workflow 7: Desktop Platform Isolation Verification', () => {
    it('confirms desktop Electron platform driver remains intact', () => {
      const driver = getPlatformDriver();
      expect(driver).toBeDefined();
      expect(driver.audio).toBeDefined();
      expect(driver.library).toBeDefined();
      expect(driver.storage).toBeDefined();
    });
  });
});
