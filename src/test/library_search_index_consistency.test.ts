import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';

describe('LibraryService — Search Index Consistency & Lifecycle Suite', () => {
  let lib: LibraryService;

  const mockTrack1: TrackMetadata = {
    id: 'track_1',
    filePath: 'C:/Music/Rock/Pink Floyd/Comfortably Numb.flac',
    fileName: '06 - Comfortably Numb.flac',
    fileSize: 45000000,
    dateModified: 1700000000,
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    genre: 'Progressive Rock',
    codec: 'FLAC',
    container: 'flac',
    duration: 382,
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 2800,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 42,
    isFavorite: true,
  };

  const mockTrack2: TrackMetadata = {
    id: 'track_2',
    filePath: 'C:/Music/Jazz/John Coltrane/Giant Steps.m4a',
    fileName: 'coltrane_giant_steps_1960.m4a',
    fileSize: 25000000,
    dateModified: 1700001000,
    title: 'Giant Steps',
    artist: 'John Coltrane',
    album: 'Giant Steps',
    albumArtist: 'John Coltrane',
    genre: 'Hard Bop',
    codec: 'ALAC',
    container: 'm4a',
    duration: 283,
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 850,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    playCount: 15,
    isFavorite: false,
  };

  const mockTrack3: TrackMetadata = {
    id: 'track_3',
    filePath: 'C:/Music/Soundtracks/Dune/Gom Jabbar.wav',
    fileName: 'dune_ost_gom_jabbar.wav',
    fileSize: 60000000,
    dateModified: 1700002000,
    title: 'Gom Jabbar',
    artist: 'Hans Zimmer',
    album: 'Dune Original Motion Picture Soundtrack',
    albumArtist: 'Various Composers',
    genre: 'Cinematic Ambient',
    codec: 'WAV',
    container: 'wav',
    duration: 295,
    sampleRate: 48000,
    bitDepth: 24,
    bitrate: 2304,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 8,
    isFavorite: false,
  };

  // Track specifically for cross-field false-positive testing
  const mockTrackCrossField: TrackMetadata = {
    id: 'track_cross',
    filePath: 'C:/Music/OST/Dark.flac',
    fileName: 'audio_track.flac',
    fileSize: 20000000,
    dateModified: 1700003000,
    title: 'Dark',
    artist: 'Knight',
    album: 'Gotham Session',
    albumArtist: 'Gotham Symphony',
    genre: 'Soundtrack',
    codec: 'FLAC',
    container: 'flac',
    duration: 180,
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 900,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  beforeEach(() => {
    lib = new LibraryService();
    lib.addTracks([mockTrack1, mockTrack2, mockTrack3, mockTrackCrossField]);
  });

  describe('1. Search Across All Canonical & Supported Metadata Fields', () => {
    it('searches title accurately (case-insensitive substring)', () => {
      const results = lib.searchTracks('comfortably numb');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('track_1');

      const partial = lib.searchTracks('numb');
      expect(partial).toHaveLength(1);
      expect(partial[0].title).toBe('Comfortably Numb');
    });

    it('searches artist accurately', () => {
      const results = lib.searchTracks('coltrane');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('track_2');
    });

    it('searches album accurately', () => {
      const results = lib.searchTracks('the wall');
      expect(results).toHaveLength(1);
      expect(results[0].album).toBe('The Wall');
    });

    it('searches albumArtist accurately', () => {
      const results = lib.searchTracks('various composers');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('track_3');
    });

    it('searches genre accurately', () => {
      const resultsProg = lib.searchTracks('progressive rock');
      expect(resultsProg).toHaveLength(1);
      expect(resultsProg[0].id).toBe('track_1');

      const resultsAmbient = lib.searchTracks('cinematic ambient');
      expect(resultsAmbient).toHaveLength(1);
      expect(resultsAmbient[0].id).toBe('track_3');
    });

    it('searches audio codec accurately', () => {
      const resultsFlac = lib.searchTracks('flac');
      expect(resultsFlac.some((t) => t.id === 'track_1')).toBe(true);

      const resultsAlac = lib.searchTracks('alac');
      expect(resultsAlac).toHaveLength(1);
      expect(resultsAlac[0].codec).toBe('ALAC');

      const resultsWav = lib.searchTracks('wav');
      expect(resultsWav).toHaveLength(1);
      expect(resultsWav[0].codec).toBe('WAV');
    });

    it('searches container and fileName if intentionally supported', () => {
      // Container search
      const resultsM4a = lib.searchTracks('m4a');
      expect(resultsM4a).toHaveLength(1);
      expect(resultsM4a[0].id).toBe('track_2');

      // FileName search (e.g. searching when metadata tags are incomplete)
      const resultsByFilename = lib.searchTracks('dune_ost_gom_jabbar');
      expect(resultsByFilename).toHaveLength(1);
      expect(resultsByFilename[0].fileName).toBe('dune_ost_gom_jabbar.wav');
    });

    it('performs strict case-insensitive search across mixed-case queries', () => {
      expect(lib.searchTracks('PiNk fLoYd')).toHaveLength(1);
      expect(lib.searchTracks('COMFORTABLY')).toHaveLength(1);
      expect(lib.searchTracks('gIaNt StEpS')).toHaveLength(1);
      expect(lib.searchTracks('hAnS zImMeR')).toHaveLength(1);
    });

    it('returns all tracks when query is empty or whitespace only', () => {
      expect(lib.searchTracks('')).toHaveLength(4);
      expect(lib.searchTracks('   ')).toHaveLength(4);
    });
  });

  describe('2. Elimination of Cross-Field False Positives', () => {
    it('prevents cross-field false positives when query spans across title and artist', () => {
      // track_cross has title: "Dark", artist: "Knight"
      // Individual searches must match
      expect(lib.searchTracks('Dark')).toHaveLength(1);
      expect(lib.searchTracks('Dark')[0].id).toBe('track_cross');

      expect(lib.searchTracks('Knight')).toHaveLength(1);
      expect(lib.searchTracks('Knight')[0].id).toBe('track_cross');

      // Joined query "Dark Knight" must NOT match because "Dark" and "Knight" are in distinct fields
      const crossResults = lib.searchTracks('Dark Knight');
      expect(crossResults).toHaveLength(0);
    });

    it('prevents cross-field false positives when query spans across artist and album', () => {
      // mockTrack1 has artist: "Pink Floyd", album: "The Wall"
      // "Floyd The Wall" spans artist and album -> must NOT match
      expect(lib.searchTracks('Floyd The Wall')).toHaveLength(0);
    });

    it('prevents cross-field false positives across codec and filename', () => {
      // mockTrack3 has codec: "WAV", fileName: "dune_ost_gom_jabbar.wav"
      // Query "WAV dune_ost" must NOT match
      expect(lib.searchTracks('WAV dune_ost')).toHaveLength(0);
    });
  });

  describe('3. Metadata Updates & Stale Entry Elimination', () => {
    it('updates searchable metadata and finds the track with the new value', () => {
      const updatedTrack: TrackMetadata = {
        ...mockTrack1,
        title: 'Echoes (Live at Pompeii)',
        album: 'Meddle Remastered',
        genre: 'Psychedelic Rock',
      };

      lib.updateTrack(updatedTrack);

      const newTitleResults = lib.searchTracks('Echoes');
      expect(newTitleResults).toHaveLength(1);
      expect(newTitleResults[0].id).toBe('track_1');
      expect(newTitleResults[0].title).toBe('Echoes (Live at Pompeii)');

      const newAlbumResults = lib.searchTracks('Meddle Remastered');
      expect(newAlbumResults).toHaveLength(1);
      expect(newAlbumResults[0].id).toBe('track_1');

      const newGenreResults = lib.searchTracks('Psychedelic Rock');
      expect(newGenreResults).toHaveLength(1);
      expect(newGenreResults[0].id).toBe('track_1');
    });

    it('confirms the old value no longer matches after an update', () => {
      // Initially matches 'Comfortably Numb' and 'The Wall'
      expect(lib.searchTracks('Comfortably Numb')).toHaveLength(1);
      expect(lib.searchTracks('The Wall')).toHaveLength(1);

      const updatedTrack: TrackMetadata = {
        ...mockTrack1,
        title: 'Hey You',
        album: 'The Wall Immersion Edition',
        fileName: '01 - Hey You.flac',
      };

      lib.updateTrack(updatedTrack);

      // Old title must no longer match
      const oldTitleResults = lib.searchTracks('Comfortably Numb');
      expect(oldTitleResults).toHaveLength(0);

      // Old filename must no longer match
      const oldFileResults = lib.searchTracks('06 - Comfortably Numb');
      expect(oldFileResults).toHaveLength(0);

      // New values must match
      expect(lib.searchTracks('Hey You')).toHaveLength(1);
      expect(lib.searchTracks('Immersion Edition')).toHaveLength(1);
    });

    it('refreshes index in batch updates (updateTracks) and preserves user fields without mutating caller objects', () => {
      const callerTrack1: TrackMetadata = {
        ...mockTrack1,
        title: 'Shine On You Crazy Diamond',
        album: 'Wish You Were Here',
        fileName: 'shine_on.flac',
        playCount: 0, // Caller object has 0, but existing library track has 42
      };

      const callerTrack2: TrackMetadata = {
        ...mockTrack2,
        title: 'Naima',
        album: 'Giant Steps Outtakes',
        fileName: 'naima.m4a',
        isFavorite: true, // Caller object has true, but existing library track has false
      };

      lib.updateTracks([callerTrack1, callerTrack2]);

      // Old values no longer match
      expect(lib.searchTracks('Comfortably Numb')).toHaveLength(0);
      expect(lib.searchTracks('The Wall')).toHaveLength(0);

      // New values match
      expect(lib.searchTracks('Shine On')).toHaveLength(1);
      expect(lib.searchTracks('Wish You Were Here')).toHaveLength(1);
      expect(lib.searchTracks('Naima')).toHaveLength(1);

      // User-managed fields preserved from existing library state
      const storedTrack1 = lib.getTrack('track_1');
      expect(storedTrack1?.playCount).toBe(42); // Preserved existing playCount
      expect(storedTrack1?.isFavorite).toBe(true);

      const storedTrack2 = lib.getTrack('track_2');
      expect(storedTrack2?.isFavorite).toBe(false); // Preserved existing isFavorite: false

      // Caller-owned objects were NOT mutated
      expect(callerTrack1.playCount).toBe(0);
      expect(callerTrack2.isFavorite).toBe(true);
      expect(storedTrack1).not.toBe(callerTrack1);
    });
  });

  describe('4. Track Removal, Index Cleanup & Library Clear', () => {
    it('removes search index entry when removing track by ID', () => {
      expect(lib.hasSearchIndexEntry('track_1')).toBe(true);
      expect(lib.getSearchIndexSize()).toBe(4);

      const removed = lib.removeTracks(['track_1']);
      expect(removed).toBe(1);

      expect(lib.hasSearchIndexEntry('track_1')).toBe(false);
      expect(lib.getSearchIndexSize()).toBe(3);
      expect(lib.searchTracks('Comfortably Numb')).toHaveLength(0);
      expect(lib.getTrack('track_1')).toBeUndefined();
    });

    it('removes search index entry when removing track by path', () => {
      expect(lib.hasSearchIndexEntry('track_2')).toBe(true);

      const success = lib.removeTrackByPath('C:/Music/Jazz/John Coltrane/Giant Steps.m4a');
      expect(success).toBe(true);

      expect(lib.hasSearchIndexEntry('track_2')).toBe(false);
      expect(lib.searchTracks('Giant Steps')).toHaveLength(0);
    });

    it('removes search index entries when pruning missing tracks in a folder', () => {
      const prunedCount = lib.pruneFolder('C:/Music/Rock/Pink Floyd', new Set(['unrelated_id']));
      expect(prunedCount).toBe(1);

      expect(lib.hasSearchIndexEntry('track_1')).toBe(false);
      expect(lib.searchTracks('Pink Floyd')).toHaveLength(0);
    });

    it('clears all tracks and index entries while intentionally retaining user folders and playlists', () => {
      // Set a test folder and custom playlist
      lib.setFolders(['D:/Music/HiRes', 'E:/Audio']);
      const customPl = lib.createPlaylist('Late Night Jazz', 'Relaxing collection');

      expect(lib.getSearchIndexSize()).toBe(4);
      expect(lib.getAllTracks()).toHaveLength(4);
      expect(lib.getFolders()).toHaveLength(2);

      // Perform clear
      lib.clear();

      // Tracks and search index are emptied
      expect(lib.getSearchIndexSize()).toBe(0);
      expect(lib.getAllTracks()).toHaveLength(0);
      expect(lib.searchTracks('Coltrane')).toHaveLength(0);

      // User folders and custom playlists are intentionally retained
      expect(lib.getFolders()).toEqual(['D:/Music/HiRes', 'E:/Audio']);
      expect(lib.getPlaylists().some((p) => p.id === customPl.id)).toBe(true);
    });
  });

  describe('5. Serialization and Deserialization Lifecycle', () => {
    it('round-trips through serialization and fully restores search capability', () => {
      const serialized = lib.serialize();
      const freshLib = new LibraryService();

      freshLib.deserialize(serialized);

      expect(freshLib.getAllTracks()).toHaveLength(4);
      expect(freshLib.getSearchIndexSize()).toBe(4);

      expect(freshLib.searchTracks('Pink Floyd')).toHaveLength(1);
      expect(freshLib.searchTracks('Giant Steps')).toHaveLength(1);
      expect(freshLib.searchTracks('Hans Zimmer')).toHaveLength(1);
      expect(freshLib.searchTracks('m4a')).toHaveLength(1);
      expect(freshLib.searchTracks('flac')).toHaveLength(2); // track_1 and track_cross
    });
  });

  describe('6. Resilience: Missing, Corrupted, or Inconsistent Index Recovery', () => {
    it('handles missing index entry safely by computing on-the-fly and self-healing', () => {
      // Manually simulate a missing index entry
      (lib as any).searchFields.delete('track_1');
      expect(lib.hasSearchIndexEntry('track_1')).toBe(false);
      expect(lib.getSearchIndexSize()).toBe(3);

      // Search query should still find track_1 via on-the-fly computation
      const results = lib.searchTracks('Comfortably Numb');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('track_1');

      // Index must be self-healed and backfilled
      expect(lib.hasSearchIndexEntry('track_1')).toBe(true);
      expect(lib.getSearchIndexSize()).toBe(4);
      expect(lib.getSearchIndexEntry('track_1')).toContain('comfortably numb');
    });

    it('rebuilds entire search index on command without data loss', () => {
      (lib as any).searchFields.clear();
      expect(lib.getSearchIndexSize()).toBe(0);
      expect(lib.getAllTracks()).toHaveLength(4);

      lib.rebuildSearchIndex();

      expect(lib.getSearchIndexSize()).toBe(4);
      expect(lib.searchTracks('Coltrane')).toHaveLength(1);
      expect(lib.searchTracks('Zimmer')).toHaveLength(1);
      expect(lib.searchTracks('The Wall')).toHaveLength(1);
    });

    it('handles duplicate track IDs safely by overwriting with newest metadata without mutating input', () => {
      const inputDuplicate: TrackMetadata = {
        ...mockTrack1,
        title: 'Mother',
        fileName: '02 - Mother.flac',
      };

      lib.addTracks([inputDuplicate]);

      expect(lib.getAllTracks()).toHaveLength(4);
      expect(lib.getSearchIndexSize()).toBe(4);

      // Old title should not match
      expect(lib.searchTracks('Comfortably Numb')).toHaveLength(0);

      // New title must match
      expect(lib.searchTracks('Mother')).toHaveLength(1);
    });
  });
});
