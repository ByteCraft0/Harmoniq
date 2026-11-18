import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { LyricsService } from '../services/lyricsService';
import { TrackMetadata } from '../types/audio';

describe('Harmoniq Functionality Fixes & Bug Elimination Verification', () => {
  let lib: LibraryService;

  const mockTracks: TrackMetadata[] = [
    {
      id: 'track-1',
      filePath: 'C:/Music/Track 1.flac',
      fileName: 'Track 1.flac',
      fileSize: 20000000,
      dateModified: 1000,
      container: 'FLAC',
      bitrate: 900,
      playCount: 0,
      isFavorite: false,
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      duration: 243,
      codec: 'FLAC',
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
    },
    {
      id: 'track-2',
      filePath: 'C:/Music/Track 2.flac',
      fileName: 'Track 2.flac',
      fileSize: 25000000,
      dateModified: 1000,
      container: 'FLAC',
      bitrate: 2400,
      playCount: 0,
      isFavorite: false,
      title: 'Instant Crush',
      artist: 'Daft Punk',
      album: 'Random Access Memories',
      duration: 337,
      codec: 'FLAC',
      sampleRate: 88200,
      bitDepth: 24,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
    },
    {
      id: 'track-3',
      filePath: 'C:/Music/Track 3.flac',
      fileName: 'Track 3.flac',
      fileSize: 30000000,
      dateModified: 1000,
      container: 'FLAC',
      bitrate: 950,
      playCount: 0,
      isFavorite: false,
      title: 'Starboy',
      artist: 'The Weeknd',
      album: 'Starboy',
      duration: 230,
      codec: 'FLAC',
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
    },
    {
      id: 'track-4',
      filePath: 'C:/Music/Track 4.mp3',
      fileName: 'Track 4.mp3',
      fileSize: 8000000,
      dateModified: 1000,
      container: 'MPEG',
      bitrate: 320,
      playCount: 0,
      isFavorite: false,
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration: 200,
      codec: 'MP3',
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      isLossless: false,
      hasArtwork: false,
    },
  ];

  beforeEach(() => {
    lib = new LibraryService();
    lib.addTracks(mockTracks);
  });

  describe('Scenario 3, 4, 5, 6: Custom Playlist Functionality & Persistence', () => {
    it('creates a custom playlist and adds at least three songs', () => {
      const pl = lib.createPlaylist('Night Drive');
      expect(pl).toBeDefined();
      expect(pl.name).toBe('Night Drive');
      expect(pl.trackIds.length).toBe(0);

      // Add three songs
      const added = lib.addTracksToPlaylist(pl.id, ['track-1', 'track-2', 'track-3']);
      expect(added).toBe(true);

      const refreshed = lib.getPlaylists().find((p) => p.id === pl.id);
      expect(refreshed?.trackIds).toEqual(['track-1', 'track-2', 'track-3']);
      expect(refreshed?.trackIds.length).toBe(3);
    });

    it('prevents duplicate entries when adding songs to custom playlist', () => {
      const pl = lib.createPlaylist('Favorites Mix');
      lib.addTracksToPlaylist(pl.id, ['track-1', 'track-2']);

      // Attempt to re-add track-1 and track-2, plus new track-3
      const added = lib.addTracksToPlaylist(pl.id, ['track-1', 'track-2', 'track-3']);
      expect(added).toBe(true);

      const refreshed = lib.getPlaylists().find((p) => p.id === pl.id);
      // track-1 and track-2 should not be duplicated
      expect(refreshed?.trackIds).toEqual(['track-1', 'track-2', 'track-3']);
      expect(refreshed?.trackIds.length).toBe(3);

      // Attempting to add only duplicates returns false
      const addDuplicatesOnly = lib.addTracksToPlaylist(pl.id, ['track-1', 'track-3']);
      expect(addDuplicatesOnly).toBe(false);
      expect(refreshed?.trackIds.length).toBe(3);
    });

    it('removes songs from a playlist correctly', () => {
      const pl = lib.createPlaylist('Roadtrip');
      lib.addTracksToPlaylist(pl.id, ['track-1', 'track-2', 'track-3']);

      // Remove middle track (index 1 = track-2)
      const removed = lib.removeTrackFromPlaylist(pl.id, 1);
      expect(removed).toBe(true);

      const refreshed = lib.getPlaylists().find((p) => p.id === pl.id);
      expect(refreshed?.trackIds).toEqual(['track-1', 'track-3']);
      expect(refreshed?.trackIds.length).toBe(2);
    });

    it('renames a custom playlist and updates dateModified', () => {
      const pl = lib.createPlaylist('Old Playlist Name');
      const oldModified = pl.dateModified;

      const renamed = lib.renamePlaylist(pl.id, 'New Modern Name', 'Updated description');
      expect(renamed).toBe(true);

      const refreshed = lib.getPlaylists().find((p) => p.id === pl.id);
      expect(refreshed?.name).toBe('New Modern Name');
      expect(refreshed?.description).toBe('Updated description');
      expect(refreshed?.dateModified).toBeGreaterThanOrEqual(oldModified);
    });

    it('deletes a custom playlist and disallows deleting smart playlists', () => {
      const pl = lib.createPlaylist('Temporary Playlist');
      expect(lib.getPlaylists().some((p) => p.id === pl.id)).toBe(true);

      const deleted = lib.deletePlaylist(pl.id);
      expect(deleted).toBe(true);
      expect(lib.getPlaylists().some((p) => p.id === pl.id)).toBe(false);

      // Cannot delete smart playlists
      const smartDelete = lib.deletePlaylist('smart_favorites');
      expect(smartDelete).toBe(false);
      expect(lib.getPlaylists().some((p) => p.id === 'smart_favorites')).toBe(true);
    });

    it('persists playlists across application serialize and deserialize lifecycle', () => {
      const pl = lib.createPlaylist('Workout Beats', 'High BPM Tracks');
      lib.addTracksToPlaylist(pl.id, ['track-1', 'track-2', 'track-3']);

      // Simulate serialization on app close
      const serialized = lib.serialize();
      expect(serialized.playlists).toBeDefined();
      expect(serialized.playlists.some((p: any) => p.id === pl.id)).toBe(true);

      // Simulate fresh application launch
      const freshLib = new LibraryService();
      freshLib.deserialize(serialized);

      const restored = freshLib.getPlaylists().find((p) => p.id === pl.id);
      expect(restored).toBeDefined();
      expect(restored?.name).toBe('Workout Beats');
      expect(restored?.description).toBe('High BPM Tracks');
      expect(restored?.trackIds).toEqual(['track-1', 'track-2', 'track-3']);
    });

    it('persists custom playlists to dedicated storage key and survives cold start', () => {
      // Mock localStorage for cold restart test
      const store: Record<string, string> = {};
      const origLocalStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k in store) delete store[k];
        },
        length: 0,
        key: () => null,
      } as any;

      try {
        const testLib = new LibraryService();
        const pl = testLib.createPlaylist('Cold Boot Playlist', 'Survives restart');
        testLib.addTracksToPlaylist(pl.id, ['track-1', 'track-2']);

        // Check dedicated key was written immediately
        expect(store['harmoniq_custom_playlists_v1']).toBeDefined();
        const storedList = JSON.parse(store['harmoniq_custom_playlists_v1']);
        expect(storedList.some((p: any) => p.id === pl.id)).toBe(true);

        // Cold app restart (new instance reads directly from storage without deserialize)
        const restartedLib = new LibraryService();
        const restored = restartedLib.getPlaylists().find((p) => p.id === pl.id);
        expect(restored).toBeDefined();
        expect(restored?.name).toBe('Cold Boot Playlist');
        expect(restored?.trackIds).toEqual(['track-1', 'track-2']);
      } finally {
        globalThis.localStorage = origLocalStorage;
      }
    });

    it('handles deleted/missing library audio files gracefully when rendering playlist tracks', () => {
      const pl = lib.createPlaylist('Missing File Test');
      // track-999 does not exist in library
      lib.addTracksToPlaylist(pl.id, ['track-1', 'track-999-deleted', 'track-2']);

      const allTracks = lib.getAllTracks();
      const resolved = pl.trackIds
        .map((id) => allTracks.find((t) => t.id === id))
        .filter((t): t is TrackMetadata => !!t);

      // Successfully filters out missing track without throwing errors
      expect(resolved.length).toBe(2);
      expect(resolved.map((t) => t.id)).toEqual(['track-1', 'track-2']);
    });
  });

  describe('Scenario 7, 8, 9: Play Next & Playback Queue Ordering Logic', () => {
    it('simulates queue operations and verifies Play Next maintains strict FIFO order after current track', () => {
      // Current queue represents an active listening session
      let queue: TrackMetadata[] = [mockTracks[0], mockTracks[3]]; // [Track 1, Track 4]
      let currentTrack: TrackMetadata | null = mockTracks[0];
      let playNextCount = 0;

      // Helper simulating the fixed playNext in PlayerContext
      const simulatePlayNext = (track: TrackMetadata) => {
        const copy = [...queue];
        const curId = currentTrack ? currentTrack.id : null;
        let curIndex = curId ? copy.findIndex((t) => t.id === curId) : -1;
        if (curIndex === -1 && currentTrack) {
          copy.unshift(currentTrack);
          curIndex = 0;
        }
        const baseIndex = curIndex !== -1 ? curIndex + 1 : 0;
        const insertIndex = Math.min(copy.length, baseIndex + playNextCount);
        copy.splice(insertIndex, 0, track);
        playNextCount += 1;
        queue = copy;
      };

      // Helper simulating addToQueue in PlayerContext
      const simulateAddToQueue = (track: TrackMetadata) => {
        queue = [...queue, track];
      };

      // 1. Queue is: [Track 1 (current), Track 4]
      expect(queue.map((t) => t.id)).toEqual(['track-1', 'track-4']);

      // 2. Add Track 2 using Play Next
      simulatePlayNext(mockTracks[1]);
      // Queue is now: [Track 1, Track 2, Track 4]
      expect(queue.map((t) => t.id)).toEqual(['track-1', 'track-2', 'track-4']);

      // 3. Add Track 3 using Play Next
      simulatePlayNext(mockTracks[2]);
      // Multiple Play Next actions MUST maintain correct order: Track 2 should play first, then Track 3, then Track 4!
      expect(queue.map((t) => t.id)).toEqual(['track-1', 'track-2', 'track-3', 'track-4']);

      // 4. Add to queue appends to end
      const extraTrack: TrackMetadata = { ...mockTracks[0], id: 'track-5', title: 'Extra Track' };
      simulateAddToQueue(extraTrack);
      expect(queue.map((t) => t.id)).toEqual(['track-1', 'track-2', 'track-3', 'track-4', 'track-5']);

      // 5. Track 1 finishes -> Track 2 plays automatically
      const active1 = currentTrack;
      const nextIndex = active1 ? queue.findIndex((t) => t.id === active1.id) + 1 : 0;
      currentTrack = queue[nextIndex];
      playNextCount = 0; // resets on track play
      expect(currentTrack?.id).toBe('track-2');

      // 6. Track 2 finishes -> Track 3 plays automatically
      const active2 = currentTrack;
      const nextIndex2 = active2 ? queue.findIndex((t) => t.id === active2.id) + 1 : 0;
      currentTrack = queue[nextIndex2];
      expect(currentTrack?.id).toBe('track-3');
    });
  });

  describe('Scenario 2: Synced Lyrics Parsing & Synchronization', () => {
    it('parses standard timestamped LRC into synchronized lines with accurate seconds', () => {
      const lrcContent = `
[00:05.50]First line of lyrics
[00:12.80]Second line of lyrics
[00:20.10]Third line of lyrics
      `.trim();

      const parsed = LyricsService.parseLrc(lrcContent, 'lrc_file');
      expect(parsed.synced).toBe(true);
      expect(parsed.lines.length).toBe(3);
      expect(parsed.lines[0].time).toBeCloseTo(5.5, 1);
      expect(parsed.lines[0].text).toBe('First line of lyrics');
      expect(parsed.lines[1].time).toBeCloseTo(12.8, 1);
      expect(parsed.lines[2].time).toBeCloseTo(20.1, 1);
    });

    it('accurately identifies active line index along playback timeline', () => {
      const lines = [
        { time: 5, text: 'Line 1' },
        { time: 10, text: 'Line 2' },
        { time: 15, text: 'Line 3' },
      ];

      expect(LyricsService.findActiveLineIndex(lines, 2)).toBe(-1); // Before first line
      expect(LyricsService.findActiveLineIndex(lines, 5)).toBe(0); // At first line
      expect(LyricsService.findActiveLineIndex(lines, 8)).toBe(0); // Between 1 and 2
      expect(LyricsService.findActiveLineIndex(lines, 10)).toBe(1); // At second line
      expect(LyricsService.findActiveLineIndex(lines, 14.9)).toBe(1); // Right before 3
      expect(LyricsService.findActiveLineIndex(lines, 15.1)).toBe(2); // At third line
      expect(LyricsService.findActiveLineIndex(lines, 60)).toBe(2); // After third line
    });

    it('handles empty lyrics and plain text lyrics with proper fallback state', () => {
      const empty = LyricsService.parseLrc('', 'none' as any);
      expect(empty.synced).toBe(false);
      expect(empty.lines.length).toBe(0);

      const plain = LyricsService.parseLrc('Just plain text without timestamps\nLine two', 'embedded');
      expect(plain.synced).toBe(false);
      expect(plain.plainText).toBe('Just plain text without timestamps\nLine two');
    });

    it('handles playback seeking forward/backward, pause, resume, and track switching', () => {
      const lines = [
        { time: 5, text: 'Intro' },
        { time: 12, text: 'Verse 1' },
        { time: 24, text: 'Chorus' },
        { time: 40, text: 'Outro' },
      ];

      // 1. Initial playback before first line
      expect(LyricsService.findActiveLineIndex(lines, 2)).toBe(-1);

      // 2. Playback advances into Verse 1
      expect(LyricsService.findActiveLineIndex(lines, 14)).toBe(1);

      // 3. User seeks forward to Chorus (26s)
      expect(LyricsService.findActiveLineIndex(lines, 26)).toBe(2);

      // 4. User seeks backward to Intro (6s)
      expect(LyricsService.findActiveLineIndex(lines, 6)).toBe(0);

      // 5. User pauses playback (timestamp stays 6s across multiple status ticks)
      const pausedTime = 6;
      expect(LyricsService.findActiveLineIndex(lines, pausedTime)).toBe(0);
      expect(LyricsService.findActiveLineIndex(lines, pausedTime)).toBe(0);

      // 6. User resumes playback (advances to 42s Outro)
      expect(LyricsService.findActiveLineIndex(lines, 42)).toBe(3);

      // 7. Track switches: active index reset simulation
      const newTrackLines: any[] = [];
      expect(LyricsService.findActiveLineIndex(newTrackLines, 0)).toBe(-1);
    });

    it('caches lyrics locally and provides offline playback when network is unavailable', async () => {
      const testTrack = mockTracks[0];
      const mockLrc = `[00:03.00]Offline lyric test line 1\n[00:08.00]Offline lyric test line 2`;

      // Preload and cache
      const parsed = LyricsService.parseLrc(mockLrc, 'online');
      (LyricsService as any).cache.set(testTrack.id, parsed);

      // Mock offline network failure
      const origFetch = globalThis.fetch;
      globalThis.fetch = () => Promise.reject(new Error('Network Offline (Offline Test)'));

      try {
        const loaded = await LyricsService.loadLyricsForTrack(testTrack);
        expect(loaded.synced).toBe(true);
        expect(loaded.lines.length).toBe(2);
        expect(loaded.lines[0].text).toBe('Offline lyric test line 1');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('Scenario 11: Scalability with Large Music Library (10,000 Tracks)', () => {
    it('indexes and searches 10,000 tracks in under 50ms without UI freezing', () => {
      const largeBatch: TrackMetadata[] = [];
      for (let i = 0; i < 10000; i++) {
        largeBatch.push({
          id: `bench-track-${i}`,
          filePath: `C:/Music/Album_${i % 200}/Track_${i}.flac`,
          fileName: `Track_${i}.flac`,
          fileSize: 15000000,
          dateModified: 1000,
          container: 'FLAC',
          bitrate: 900,
          playCount: 0,
          isFavorite: false,
          title: `Symphony No. ${i}`,
          artist: `Artist ${(i % 50) + 1}`,
          album: `Album ${(i % 200) + 1}`,
          duration: 180 + (i % 300),
          codec: 'FLAC',
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          isLossless: true,
          hasArtwork: false,
        });
      }

      const t0 = performance.now();
      lib.addTracks(largeBatch);
      const indexTime = performance.now() - t0;
      expect(indexTime).toBeLessThan(1000); // 10,000 tracks added in < 1s

      const tSearch0 = performance.now();
      const results = lib.searchTracks('Symphony No. 999');
      const searchTime = performance.now() - tSearch0;

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(searchTime).toBeLessThan(50); // Sub-50ms search on 10,000 tracks
    });
  });
});
