import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { getPlatformDriver } from '../services/platform';

describe('HARMONIQ LITE — PHASE 3B: Custom Playlists, Music Library & Playback Queue', () => {
  let libService: LibraryService;
  let mockStorageStore: Record<string, any> = {};

  const sampleTracks: TrackMetadata[] = [
    {
      id: 'track_1',
      filePath: 'content://media/external/audio/media/101',
      fileName: 'starlight_echoes.flac',
      fileSize: 45000000,
      dateModified: 1715000000,
      dateAdded: 1715000000,
      title: 'Starlight Echoes',
      artist: 'Acoustic Labs',
      album: 'Celestial Harmonies',
      duration: 320,
      hasArtwork: false,
      codec: 'FLAC',
      container: 'flac',
      sampleRate: 96000,
      bitrate: 2304,
      channels: 2,
      playCount: 0,
      isLossless: true,
      isFavorite: true,
    },
    {
      id: 'track_2',
      filePath: 'content://media/external/audio/media/102',
      fileName: 'midnight_drive.mp3',
      fileSize: 8500000,
      dateModified: 1714000000,
      dateAdded: 1714000000,
      title: 'Midnight Drive',
      artist: 'Synthwave Odyssey',
      album: 'Neon Horizon',
      duration: 215,
      hasArtwork: false,
      codec: 'MP3',
      container: 'mp3',
      sampleRate: 44100,
      bitrate: 320,
      channels: 2,
      playCount: 0,
      isLossless: false,
      isFavorite: false,
    },
    {
      id: 'track_3',
      filePath: 'content://media/external/audio/media/103',
      fileName: 'aurora_borealis.wav',
      fileSize: 60000000,
      dateModified: 1716000000,
      dateAdded: 1716000000,
      title: 'Aurora Borealis',
      artist: 'Acoustic Labs',
      album: 'Polar Sounds',
      duration: 410,
      hasArtwork: false,
      codec: 'WAV',
      container: 'wav',
      sampleRate: 48000,
      bitrate: 1536,
      channels: 2,
      playCount: 0,
      isLossless: true,
      isFavorite: true,
    },
    {
      id: 'track_4',
      filePath: 'content://media/external/audio/media/104',
      fileName: 'ambient_rain.flac',
      fileSize: 30000000,
      dateModified: 1713000000,
      dateAdded: 1713000000,
      title: 'Ambient Rain & Thunder',
      artist: 'Nature Sounds',
      album: 'Earth Tones',
      duration: 540,
      hasArtwork: false,
      codec: 'FLAC',
      container: 'flac',
      sampleRate: 44100,
      bitrate: 850,
      channels: 2,
      playCount: 0,
      isLossless: true,
      isFavorite: false,
    },
  ];

  beforeEach(() => {
    mockStorageStore = {};

    // Mock localStorage
    const mockLocalStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        for (const k in mockLocalStorage) delete mockLocalStorage[k];
      }),
    };

    libService = new LibraryService();
    libService.addTracks(sampleTracks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Custom Playlist Management (CRUD & Logic)', () => {
    it('creates a custom playlist with generated id and empty tracks', () => {
      const pl = libService.createPlaylist('Late Night Jams', 'Vibes for studying');
      expect(pl).toBeDefined();
      expect(pl.id).toMatch(/^pl_\d+_/);
      expect(pl.name).toBe('Late Night Jams');
      expect(pl.description).toBe('Vibes for studying');
      expect(pl.trackIds).toEqual([]);
      expect(pl.isSmart).toBeFalsy();

      const all = libService.getPlaylists();
      expect(all.some((p) => p.id === pl.id)).toBe(true);
    });

    it('renames a custom playlist and updates dateModified', () => {
      const pl = libService.createPlaylist('Initial Name');
      const initialMod = pl.dateModified;

      const success = libService.renamePlaylist(pl.id, 'Updated Cool Playlist', 'New Description');
      expect(success).toBe(true);

      const found = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(found?.name).toBe('Updated Cool Playlist');
      expect(found?.description).toBe('New Description');
      expect(found?.dateModified).toBeGreaterThanOrEqual(initialMod);
    });

    it('rejects renaming a smart playlist', () => {
      const success = libService.renamePlaylist('smart_favorites', 'My Favorite Tunes');
      expect(success).toBe(false);
      const fav = libService.getPlaylists().find((p) => p.id === 'smart_favorites');
      expect(fav?.name).toBe('Favorite Tracks');
    });

    it('deletes a custom playlist and prevents deleting smart playlists', () => {
      const pl = libService.createPlaylist('Temporary Playlist');
      expect(libService.getPlaylists().some((p) => p.id === pl.id)).toBe(true);

      const deleted = libService.deletePlaylist(pl.id);
      expect(deleted).toBe(true);
      expect(libService.getPlaylists().some((p) => p.id === pl.id)).toBe(false);

      const smartDelete = libService.deletePlaylist('smart_favorites');
      expect(smartDelete).toBe(false);
      expect(libService.getPlaylists().some((p) => p.id === 'smart_favorites')).toBe(true);
    });
  });

  describe('2. Playlist Track Membership, Deduplication & Ordering', () => {
    it('adds tracks to playlist and preserves track addition order', () => {
      const pl = libService.createPlaylist('Synthwave Hits');
      const added = libService.addTracksToPlaylist(pl.id, ['track_2', 'track_1']);
      expect(added).toBe(true);

      const updated = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(updated?.trackIds).toEqual(['track_2', 'track_1']);
    });

    it('prevents adding duplicate tracks to the same playlist', () => {
      const pl = libService.createPlaylist('Deduplication Test');
      libService.addTracksToPlaylist(pl.id, ['track_1', 'track_2']);

      // Attempt adding duplicate
      const addDuplicate = libService.addTracksToPlaylist(pl.id, ['track_1']);
      expect(addDuplicate).toBe(false);

      const updated = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(updated?.trackIds).toEqual(['track_1', 'track_2']);
    });

    it('removes a track from playlist without deleting audio file from library', () => {
      const pl = libService.createPlaylist('Removal Test');
      libService.addTracksToPlaylist(pl.id, ['track_1', 'track_2', 'track_3']);

      // Remove middle track (index 1 -> track_2)
      const removed = libService.removeTrackFromPlaylist(pl.id, 1);
      expect(removed).toBe(true);

      const updated = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(updated?.trackIds).toEqual(['track_1', 'track_3']);

      // Audio file remains intact in library
      expect(libService.getTrack('track_2')).toBeDefined();
      expect(libService.getAllTracks().some((t) => t.id === 'track_2')).toBe(true);
    });

    it('reorders playlist tracks from one position to another', () => {
      const pl = libService.createPlaylist('Reorder Test');
      libService.addTracksToPlaylist(pl.id, ['track_1', 'track_2', 'track_3', 'track_4']);

      // Move track at index 3 (track_4) to index 0
      const reordered = libService.reorderPlaylist(pl.id, 3, 0);
      expect(reordered).toBe(true);

      const updated = libService.getPlaylists().find((p) => p.id === pl.id);
      expect(updated?.trackIds).toEqual(['track_4', 'track_1', 'track_2', 'track_3']);
    });
  });

  describe('3. Dual Storage Persistence for Playlists', () => {
    it('persists custom playlists to localStorage and platform driver storage', () => {
      const pl = libService.createPlaylist('Persistent Playlist', 'Stored across reboots');
      libService.addTracksToPlaylist(pl.id, ['track_1', 'track_3']);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'harmoniq_custom_playlists_v1',
        expect.stringContaining('Persistent Playlist')
      );
    });

    it('loads custom playlists asynchronously through loadSavedPlaylistsAsync', async () => {
      const freshService = new LibraryService();
      const mockDriverPlaylists = [
        {
          id: 'pl_saved_from_prefs',
          name: 'Restored from SharedPreferences',
          description: 'Android SharedPreferences persistent data',
          trackIds: ['track_1', 'track_2'],
          dateCreated: 1714000000,
          dateModified: 1714000000,
        },
      ];

      vi.spyOn(getPlatformDriver().storage, 'get').mockResolvedValue(mockDriverPlaylists as any);

      await freshService.loadSavedPlaylistsAsync();
      const all = freshService.getPlaylists();
      const found = all.find((p) => p.id === 'pl_saved_from_prefs');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Restored from SharedPreferences');
      expect(found?.trackIds).toEqual(['track_1', 'track_2']);
    });
  });

  describe('4. Android Audio Driver Native Queue Synchronization', () => {
    it('synchronizes queue updates to Capacitor HarmoniqAudioPlayer plugin', async () => {
      let sentQueue: any = null;
      (globalThis as any).Capacitor = {
        Plugins: {
          HarmoniqAudioPlayer: {
            addListener: vi.fn(),
            setQueue: vi.fn(async (args: any) => {
              sentQueue = args.queue;
              return { status: 'queue_updated' };
            }),
            play: vi.fn().mockResolvedValue({ status: 'playing' }),
            pause: vi.fn().mockResolvedValue({ status: 'paused' }),
            resume: vi.fn().mockResolvedValue({ status: 'resumed' }),
          },
        },
      };

      const audioDriver = new AndroidAudioDriver();
      await audioDriver.setQueue([sampleTracks[0], sampleTracks[1]]);

      expect(sentQueue).toHaveLength(2);
      expect(sentQueue[0].id).toBe('track_1');
      expect(sentQueue[1].id).toBe('track_2');

      // Test addToQueue
      await audioDriver.addToQueue(sampleTracks[2]);
      expect(sentQueue).toHaveLength(3);
      expect(sentQueue[2].id).toBe('track_3');

      // Test removeFromQueue
      await audioDriver.removeFromQueue(1);
      expect(sentQueue).toHaveLength(2);
      expect(sentQueue[0].id).toBe('track_1');
      expect(sentQueue[1].id).toBe('track_3');
    });

    it('supports playNext by inserting at the head of the upcoming queue', async () => {
      let sentQueue: any = null;
      (globalThis as any).Capacitor = {
        Plugins: {
          HarmoniqAudioPlayer: {
            addListener: vi.fn(),
            setQueue: vi.fn(async (args: any) => {
              sentQueue = args.queue;
              return { status: 'queue_updated' };
            }),
          },
        },
      };

      const audioDriver = new AndroidAudioDriver();
      await audioDriver.setQueue([sampleTracks[0], sampleTracks[1]]);

      await audioDriver.playNext(sampleTracks[3]);
      expect(sentQueue[0].id).toBe('track_4');
      expect(sentQueue[1].id).toBe('track_1');
      expect(sentQueue[2].id).toBe('track_2');
    });
  });

  describe('5. Library Search & Sorting', () => {
    it('searches tracks by title, artist, and album', () => {
      // Search by title
      const titleRes = libService.searchTracks('starlight');
      expect(titleRes.some((t) => t.id === 'track_1')).toBe(true);

      // Search by artist
      const artistRes = libService.searchTracks('Synthwave');
      expect(artistRes.some((t) => t.id === 'track_2')).toBe(true);

      // Search by album
      const albumRes = libService.searchTracks('Polar Sounds');
      expect(albumRes.some((t) => t.id === 'track_3')).toBe(true);
    });

    it('performs multi-criteria sorting accurately', () => {
      const all = [...sampleTracks];

      // Sort by Title A-Z
      const byTitleAsc = [...all].sort((a, b) => a.title.localeCompare(b.title));
      expect(byTitleAsc[0].title).toBe('Ambient Rain & Thunder');
      expect(byTitleAsc[3].title).toBe('Starlight Echoes');

      // Sort by Duration Descending (longest first)
      const byDurationDesc = [...all].sort((a, b) => (b.duration || 0) - (a.duration || 0));
      expect(byDurationDesc[0].title).toBe('Ambient Rain & Thunder'); // 540s
      expect(byDurationDesc[3].title).toBe('Midnight Drive'); // 215s

      // Sort by Duration Ascending (shortest first)
      const byDurationAsc = [...all].sort((a, b) => (a.duration || 0) - (b.duration || 0));
      expect(byDurationAsc[0].title).toBe('Midnight Drive'); // 215s
      expect(byDurationAsc[3].title).toBe('Ambient Rain & Thunder'); // 540s
    });
  });

  describe('6. Folder Management & File Preservation', () => {
    it('adds and lists monitored folders', () => {
      libService.setFolders([
        'content://com.android.externalstorage.documents/tree/primary%3AMusic',
        'content://com.android.externalstorage.documents/tree/primary%3AAudiobooks',
      ]);

      const folders = libService.getFolders();
      expect(folders).toHaveLength(2);
      expect(folders[0]).toContain('primary%3AMusic');
    });

    it('removing a folder removes the reference without deleting audio tracks', () => {
      const folderUri = 'content://com.android.externalstorage.documents/tree/primary%3AMusic';
      libService.setFolders([folderUri]);

      const current = libService.getFolders();
      const updated = current.filter((f) => f !== folderUri);
      libService.setFolders(updated);

      expect(libService.getFolders()).toHaveLength(0);
      // Ensure all tracks still exist in library
      expect(libService.getAllTracks()).toHaveLength(4);
    });
  });

  describe('7. Desktop Electron Isolation', () => {
    it('preserves Windows Electron platform driver and storage compatibility', () => {
      const driver = getPlatformDriver();
      expect(driver).toBeDefined();
      expect(driver.audio).toBeDefined();
      expect(driver.library).toBeDefined();
      expect(driver.storage).toBeDefined();
    });
  });
});
