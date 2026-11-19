import { describe, it, expect, beforeEach } from 'vitest';
import { historyService } from '../services/historyService';
import { favoritesService } from '../services/favoritesService';
import { smartPlaylistService, evaluateSmartPlaylist, DEFAULT_SMART_PLAYLISTS } from '../services/smartPlaylistService';
import { discoveryService } from '../services/discoveryService';
import { statsService } from '../services/statsService';
import { libraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Phase 4.5: Personalization QA, Integration Testing & UX Polish', () => {
  const localTrack: TrackMetadata = {
    id: 'local_track_101',
    title: 'Kal Ho Naa Ho',
    artist: 'Sonu Nigam',
    album: 'Kal Ho Naa Ho',
    duration: 320,
    filePath: 'C:/Music/kal_ho_naa_ho.mp3',
    fileName: 'kal_ho_naa_ho.mp3',
    hasArtwork: false,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    fileSize: 12000000,
    isLossless: false,
    dateAdded: Date.now() - 40 * 86400 * 1000,
    dateModified: Date.now() - 40 * 86400 * 1000,
    genre: 'Bollywood',
    playCount: 10,
    lastPlayed: Date.now() - 50000,
    isFavorite: false,
    isrc: 'INUM70300123',
  };

  const onlineFullTrack: TrackMetadata = {
    id: 'online_jamendo_202',
    title: 'Electric Dreams',
    artist: 'Synthwave Collective',
    album: 'Neon City',
    duration: 210,
    filePath: '',
    fileName: 'electric_dreams.mp3',
    hasArtwork: false,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 192,
    channels: 2,
    fileSize: 5000000,
    isLossless: false,
    dateAdded: Date.now() - 10 * 86400 * 1000,
    dateModified: Date.now() - 10 * 86400 * 1000,
    genre: 'Electronic',
    isOnline: true,
    providerId: 'jamendo',
    providerTrackId: 'jm_9876',
    playbackCapability: 'full_stream',
    playCount: 4,
    lastPlayed: Date.now() - 86400 * 1000,
    isFavorite: false,
  };

  const onlinePreviewTrack: TrackMetadata = {
    id: 'online_apple_303',
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    duration: 30, // Preview length
    filePath: '',
    fileName: 'starboy_preview.m4a',
    hasArtwork: false,
    codec: 'AAC',
    container: 'm4a',
    sampleRate: 44100,
    bitrate: 256,
    channels: 2,
    fileSize: 1000000,
    isLossless: false,
    dateAdded: Date.now() - 3 * 86400 * 1000,
    dateModified: Date.now() - 3 * 86400 * 1000,
    genre: 'Pop',
    isOnline: true,
    providerId: 'apple',
    providerTrackId: 'ap_4444',
    playbackCapability: 'preview_stream',
    playCount: 1,
    isFavorite: false,
  };

  beforeEach(() => {
    localStorageMock.clear();
    historyService.clearHistory();
    historyService.setHistoryEnabled(true);
    discoveryService.resetRecommendationProfile();
    const favs = favoritesService.getFavorites();
    for (const f of favs) {
      favoritesService.removeFavorite(f.id);
    }
  });

  describe('Area A: Listening History & Preview Safety', () => {
    it('does not confuse online preview completion with a full-track completed listen', () => {
      // 30s preview played to the end (30s)
      const res = historyService.recordSession(onlinePreviewTrack, 30);
      expect(res.isCompleted).toBe(false);
      expect(res.entry.completionStatus).toBe('partial');
    });

    it('classifies full track completed plays correctly', () => {
      // Full track played for 180s on 210s track
      const res = historyService.recordSession(onlineFullTrack, 180);
      expect(res.isCompleted).toBe(true);
      expect(res.entry.completionStatus).toBe('completed');
    });

    it('limits history query efficiently when limit option is passed', () => {
      for (let i = 0; i < 20; i++) {
        historyService.recordSession(
          { ...localTrack, id: `track_${i}`, title: `Song ${i}` },
          35
        );
      }

      const all = historyService.getHistory();
      expect(all.length).toBe(20);

      const limited = historyService.getHistory({ limit: 5 });
      expect(limited.length).toBe(5);
      expect(limited[0].title).toBe('Song 19'); // Most recent first
    });
  });

  describe('Area B: Favorites & Cross-Provider Identity', () => {
    it('matches same ISRC across providers', () => {
      favoritesService.toggleFavorite(localTrack); // has isrc: INUM70300123

      const onlineVersionWithSameISRC: TrackMetadata = {
        ...onlineFullTrack,
        id: 'online_spotify_same_isrc',
        title: 'Kal Ho Naa Ho (Remastered)',
        artist: 'Sonu Nigam',
        isrc: 'INUM70300123',
      };

      expect(favoritesService.isFavorite(onlineVersionWithSameISRC)).toBe(true);
    });

    it('preserves distinct recordings when ISRCs differ even if title and artist match', () => {
      favoritesService.toggleFavorite(localTrack); // isrc: INUM70300123

      const liveRecordingDifferentISRC: TrackMetadata = {
        ...localTrack,
        id: 'local_live_version',
        title: 'Kal Ho Naa Ho',
        artist: 'Sonu Nigam',
        isrc: 'INUM70999999', // Different ISRC!
      };

      // Distinct recording must NOT be falsely identified as the favorite
      expect(favoritesService.isFavorite(liveRecordingDifferentISRC)).toBe(false);
    });

    it('preserves distinct recordings for remixes, acoustic versions, and live versions', () => {
      favoritesService.toggleFavorite(localTrack); // "Kal Ho Naa Ho"

      const remixTrack: TrackMetadata = {
        ...localTrack,
        id: 'remix_1',
        title: 'Kal Ho Naa Ho (Club Remix)',
        isrc: undefined,
      };

      const acousticTrack: TrackMetadata = {
        ...localTrack,
        id: 'acoustic_1',
        title: 'Kal Ho Naa Ho (Acoustic)',
        isrc: undefined,
      };

      expect(favoritesService.isFavorite(remixTrack)).toBe(false);
      expect(favoritesService.isFavorite(acousticTrack)).toBe(false);
    });

    it('synchronizes libraryService when removing favorite from cross-provider match', () => {
      // Register track in libraryService
      libraryService.addTracks([localTrack]);
      favoritesService.toggleFavorite(localTrack);
      expect(favoritesService.isFavorite(localTrack)).toBe(true);

      // Now user views same song online and toggles off favorite
      const onlineMatch: TrackMetadata = {
        ...localTrack,
        id: 'online_match_1',
        providerId: 'spotify',
        isOnline: true,
      };

      const toggledOff = favoritesService.toggleFavorite(onlineMatch);
      expect(toggledOff).toBe(false);
      expect(favoritesService.isFavorite(localTrack.id)).toBe(false);

      // Verify local track in libraryService was updated
      const inLib = libraryService.getTrack(localTrack.id);
      expect(inLib?.isFavorite).toBe(false);
    });
  });

  describe('Area C: Smart Playlists & Queue Capability Defense', () => {
    it('defensively excludes external_link, metadata_only, and unavailable tracks', () => {
      const externalLinkTrack: TrackMetadata = {
        ...onlineFullTrack,
        id: 'ext_track',
        playbackCapability: 'external_link',
      };
      const unavailableTrack: TrackMetadata = {
        ...onlineFullTrack,
        id: 'unavail_track',
        playbackCapability: 'unavailable',
      };
      const metadataOnlyTrack: TrackMetadata = {
        ...onlineFullTrack,
        id: 'meta_track',
        playbackCapability: 'metadata_only',
      };
      const validTrack: TrackMetadata = {
        ...onlineFullTrack,
        id: 'valid_stream_track',
        playbackCapability: 'full_stream',
      };

      const smartPlaylist = DEFAULT_SMART_PLAYLISTS.find((p) => p.id === 'sp_recently_added')!;
      const evaluated = evaluateSmartPlaylist(smartPlaylist, [
        externalLinkTrack,
        unavailableTrack,
        metadataOnlyTrack,
        validTrack,
      ]);

      expect(evaluated.length).toBe(1);
      expect(evaluated[0].id).toBe('valid_stream_track');
    });
  });

  describe('Area D: Recommendation Engine & Deterministic Refresh', () => {
    it('rotates recommendations deterministically when refreshPersonalizedDiscovery is called', () => {
      const candidates: TrackMetadata[] = [
        { ...localTrack, id: 'c1', title: 'Song 1', playCount: 20 },
        { ...localTrack, id: 'c2', title: 'Song 2', playCount: 18 },
        { ...localTrack, id: 'c3', title: 'Song 3', playCount: 16 },
        { ...localTrack, id: 'c4', title: 'Song 4', playCount: 14 },
        { ...localTrack, id: 'c5', title: 'Song 5', playCount: 12 },
        { ...localTrack, id: 'c6', title: 'Song 6', playCount: 10 },
      ];

      favoritesService.toggleFavorite(candidates[0]);

      const initial = discoveryService.getPersonalizedDiscovery(candidates);
      const firstTitle = initial.madeForYou[0]?.track.title;

      // Trigger refresh
      discoveryService.refreshPersonalizedDiscovery();
      const refreshed = discoveryService.getPersonalizedDiscovery(candidates);
      const secondTitle = refreshed.madeForYou[0]?.track.title;

      // Candidates rotated
      expect(firstTitle).toBeDefined();
      expect(secondTitle).toBeDefined();
      expect(firstTitle).not.toBe(secondTitle);
    });

    it('resets recommendation profile cleanly and ignores past history signals', () => {
      // Seed history for Sonu Nigam
      historyService.recordSession(localTrack, 200);

      const beforeReset = discoveryService.getPersonalizedDiscovery([localTrack]);
      expect(beforeReset.hasSufficientData).toBe(true);

      // Reset profile
      discoveryService.resetRecommendationProfile();

      // Now history prior to reset is ignored
      const afterReset = discoveryService.getPersonalizedDiscovery([
        { ...localTrack, playCount: 0, isFavorite: false },
      ]);
      expect(afterReset.hasSufficientData).toBe(false);
    });
  });

  describe('Area E: Statistics Accuracy & Timezone Consistency', () => {
    it('excludes online previews from completed plays total', () => {
      historyService.recordSession(onlinePreviewTrack, 30); // 30s preview
      historyService.recordSession(onlineFullTrack, 150); // full track completed

      const totals = statsService.getListeningTotals();
      // Only the full track is completed!
      expect(totals.totalCompletedPlays).toBe(1);
      // But active duration includes both (30 + 150 = 180s)
      expect(totals.allTimeSeconds).toBe(180);
    });

    it('aggregates top tracks by song identity across providers', () => {
      // Play local version for 100s
      historyService.recordSession(localTrack, 100);
      // Play online version of same song for 120s
      const onlineVersion: TrackMetadata = {
        ...localTrack,
        id: 'online_same_song',
        isOnline: true,
        providerId: 'spotify',
      };
      historyService.recordSession(onlineVersion, 120);

      const topTracks = statsService.getTopTracks(5);
      expect(topTracks.length).toBe(1);
      expect(topTracks[0].title).toBe('Kal Ho Naa Ho');
      expect(topTracks[0].listeningSeconds).toBe(220); // 100 + 120 aggregated!
      expect(topTracks[0].playCount).toBe(2);
    });

    it('handles provider distribution when listening seconds are 0', () => {
      // Two immediate skips on different providers
      historyService.recordSession(localTrack, 0); // local
      historyService.recordSession(onlineFullTrack, 0); // jamendo

      const dist = statsService.getProviderDistribution();
      expect(dist.length).toBe(2);
      expect(dist[0].percentage).toBe(50);
      expect(dist[1].percentage).toBe(50);
    });

    it('formats daily activity dates consistently with local calendar date', () => {
      historyService.recordSession(localTrack, 60);

      const daily = statsService.getDailyActivity(7);
      expect(daily.length).toBe(7);

      const today = new Date();
      const expectedDateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      const todayPoint = daily[daily.length - 1];
      expect(todayPoint.date).toBe(expectedDateStr);
      expect(todayPoint.seconds).toBe(60);
    });
  });

  describe('Area G: Privacy & Data Separation', () => {
    it('clearing history does not delete favorites or playlists', () => {
      favoritesService.toggleFavorite(localTrack);
      historyService.recordSession(localTrack, 120);

      expect(historyService.getHistory().length).toBe(1);
      expect(favoritesService.getFavorites().length).toBe(1);

      // Clear history
      historyService.clearHistory();

      expect(historyService.getHistory().length).toBe(0);
      // Favorites must remain 100% intact!
      expect(favoritesService.getFavorites().length).toBe(1);
      expect(favoritesService.isFavorite(localTrack)).toBe(true);
    });
  });
});
