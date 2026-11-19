import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('Phase 4: Listening Intelligence, Personalization & Smart Discovery', () => {
  const mockTrack1: TrackMetadata = {
    id: 'local_track_1',
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    album: 'Aashiqui 2',
    duration: 262,
    filePath: 'C:/Music/tum_hi_ho.mp3',
    fileName: 'tum_hi_ho.mp3',
    hasArtwork: false,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    fileSize: 10485760,
    isLossless: false,
    dateAdded: Date.now() - 30 * 86400 * 1000,
    dateModified: Date.now() - 30 * 86400 * 1000,
    genre: 'Bollywood',
    playCount: 15,
    lastPlayed: Date.now() - 10000,
    isFavorite: true,
  };

  const mockTrack2: TrackMetadata = {
    id: 'online_track_jamendo_1',
    title: 'Moonlight Sonata',
    artist: 'Ludwig van Beethoven',
    album: 'Classical Masters',
    duration: 310,
    filePath: '',
    fileName: 'moonlight.mp3',
    hasArtwork: false,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 192,
    channels: 2,
    fileSize: 5000000,
    isLossless: false,
    dateAdded: Date.now() - 5 * 86400 * 1000,
    dateModified: Date.now() - 5 * 86400 * 1000,
    genre: 'Classical',
    isOnline: true,
    providerId: 'jamendo',
    providerTrackId: 'jm_12345',
    playbackCapability: 'streamable',
    providerWebUrl: 'https://www.jamendo.com/track/12345',
    playCount: 3,
    lastPlayed: Date.now() - 86400 * 1000,
    isFavorite: false,
  };

  const mockTrack3: TrackMetadata = {
    id: 'online_track_spotify_1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    filePath: '',
    fileName: 'blinding_lights.m4a',
    hasArtwork: false,
    codec: 'AAC',
    container: 'm4a',
    sampleRate: 44100,
    bitrate: 256,
    channels: 2,
    fileSize: 6000000,
    isLossless: false,
    dateAdded: Date.now() - 2 * 86400 * 1000,
    dateModified: Date.now() - 2 * 86400 * 1000,
    genre: 'Synthwave',
    isOnline: true,
    providerId: 'spotify',
    providerTrackId: 'sp_99999',
    playbackCapability: 'preview_only',
    providerWebUrl: 'https://open.spotify.com/track/sp_99999',
    playCount: 0,
    isFavorite: false,
  };

  beforeEach(() => {
    localStorageMock.clear();
    historyService.clearHistory();
    historyService.setHistoryEnabled(true);
    // Reset favorites
    const favs = favoritesService.getFavorites();
    for (const f of favs) {
      favoritesService.removeFavorite(f.id);
    }
  });

  describe('Feature A: Listening History & Play Completion Thresholds', () => {
    it('classifies playback < 15 seconds as skipped', () => {
      const res = historyService.recordSession(mockTrack1, 10);
      expect(res.isCompleted).toBe(false);
      expect(res.entry.completionStatus).toBe('skipped');
      expect(res.entry.playbackDuration).toBe(10);
    });

    it('classifies playback between 15s and 50% threshold as partial', () => {
      // mockTrack1 duration is 262s. 50% is 131s. 25s is between 15s and 131s (and < 120s)
      const res = historyService.recordSession(mockTrack1, 25);
      expect(res.isCompleted).toBe(false);
      expect(res.entry.completionStatus).toBe('partial');
    });

    it('classifies playback >= 30s and >= 50% or >= 120s as completed', () => {
      const res = historyService.recordSession(mockTrack1, 140);
      expect(res.isCompleted).toBe(true);
      expect(res.entry.completionStatus).toBe('completed');
    });

    it('records online provider details in history entry', () => {
      const res = historyService.recordSession(mockTrack2, 45);
      expect(res.entry.isOnline).toBe(true);
      expect(res.entry.providerId).toBe('jamendo');
      expect(res.entry.providerTrackId).toBe('jm_12345');
      expect(res.entry.playbackCapability).toBe('streamable');
      expect(res.entry.genre).toBe('Classical');
    });

    it('filters history by timeline: today, yesterday, and all', () => {
      historyService.recordSession(mockTrack1, 60); // played right now

      const todayHistory = historyService.getHistory({ dateFilter: 'today' });
      expect(todayHistory.length).toBe(1);

      const yesterdayHistory = historyService.getHistory({ dateFilter: 'yesterday' });
      expect(yesterdayHistory.length).toBe(0);

      const allHistory = historyService.getHistory({ dateFilter: 'all' });
      expect(allHistory.length).toBe(1);
    });

    it('filters history by providerId and artist', () => {
      historyService.recordSession(mockTrack1, 60); // Arijit Singh / local
      historyService.recordSession(mockTrack2, 60); // Beethoven / jamendo

      const localOnly = historyService.getHistory({ providerId: 'local' });
      expect(localOnly.length).toBe(1);
      expect(localOnly[0].title).toBe('Tum Hi Ho');

      const jamendoOnly = historyService.getHistory({ providerId: 'jamendo' });
      expect(jamendoOnly.length).toBe(1);
      expect(jamendoOnly[0].title).toBe('Moonlight Sonata');

      const artistOnly = historyService.getHistory({ artist: 'Arijit Singh' });
      expect(artistOnly.length).toBe(1);
      expect(artistOnly[0].artist).toBe('Arijit Singh');
    });

    it('disables history recording when toggled off', () => {
      historyService.setHistoryEnabled(false);
      expect(historyService.isHistoryEnabled()).toBe(false);

      const res = historyService.recordSession(mockTrack1, 60);
      // Entry is evaluated but not stored in history list
      expect(res.entry.title).toBe('Tum Hi Ho');
      expect(historyService.getHistory().length).toBe(0);

      // Re-enable
      historyService.setHistoryEnabled(true);
      historyService.recordSession(mockTrack1, 60);
      expect(historyService.getHistory().length).toBe(1);
    });

    it('clears history completely', () => {
      historyService.recordSession(mockTrack1, 60);
      expect(historyService.getHistory().length).toBe(1);

      historyService.clearHistory();
      expect(historyService.getHistory().length).toBe(0);
    });
  });

  describe('Feature B: Unified Cross-Provider Favorites', () => {
    it('adds and removes local tracks from favorites', () => {
      expect(favoritesService.isFavorite(mockTrack1)).toBe(false);

      const added = favoritesService.toggleFavorite(mockTrack1);
      expect(added).toBe(true);
      expect(favoritesService.isFavorite(mockTrack1)).toBe(true);
      expect(favoritesService.isFavorite(mockTrack1.id)).toBe(true);

      const removed = favoritesService.toggleFavorite(mockTrack1);
      expect(removed).toBe(false);
      expect(favoritesService.isFavorite(mockTrack1)).toBe(false);
    });

    it('supports online tracks in favorites with provider metadata', () => {
      favoritesService.toggleFavorite(mockTrack2);
      expect(favoritesService.isFavorite(mockTrack2)).toBe(true);

      const favs = favoritesService.getFavorites();
      expect(favs.length).toBe(1);
      expect(favs[0].providerId).toBe('jamendo');
      expect(favs[0].isOnline).toBe(true);
    });

    it('deduplicates cross-provider tracks with same title and artist', () => {
      // Add local version of a track
      const localSong: TrackMetadata = {
        ...mockTrack1,
        id: 'local_tum_hi_ho',
        title: 'Tum Hi Ho',
        artist: 'Arijit Singh',
      };
      favoritesService.toggleFavorite(localSong);

      // Same track from an online provider
      const onlineSong: TrackMetadata = {
        ...mockTrack1,
        id: 'online_tum_hi_ho_spotify',
        title: 'Tum Hi Ho',
        artist: 'Arijit Singh',
        isOnline: true,
        providerId: 'spotify',
      };

      // Cross-provider duplicate identity check should report true!
      expect(favoritesService.isFavorite(onlineSong)).toBe(true);
    });

    it('filters favorites by provider, artist, and search query', () => {
      favoritesService.toggleFavorite(mockTrack1); // local / Arijit Singh
      favoritesService.toggleFavorite(mockTrack2); // jamendo / Beethoven

      const jamendoFavs = favoritesService.getFavorites({ provider: 'jamendo' });
      expect(jamendoFavs.length).toBe(1);
      expect(jamendoFavs[0].title).toBe('Moonlight Sonata');

      const artistFavs = favoritesService.getFavorites({ artist: 'Arijit Singh' });
      expect(artistFavs.length).toBe(1);
      expect(artistFavs[0].title).toBe('Tum Hi Ho');

      const queryFavs = favoritesService.getFavorites({ searchQuery: 'sonata' });
      expect(queryFavs.length).toBe(1);
      expect(queryFavs[0].title).toBe('Moonlight Sonata');
    });

    it('sorts favorites by dateAdded, title, and artist', () => {
      favoritesService.toggleFavorite(mockTrack1);
      favoritesService.toggleFavorite(mockTrack2);

      const sortedByTitleAsc = favoritesService.getFavorites({ sortBy: 'title', sortOrder: 'asc' });
      expect(sortedByTitleAsc[0].title).toBe('Moonlight Sonata');
      expect(sortedByTitleAsc[1].title).toBe('Tum Hi Ho');

      const sortedByArtistAsc = favoritesService.getFavorites({ sortBy: 'artist', sortOrder: 'asc' });
      expect(sortedByArtistAsc[0].artist).toBe('Arijit Singh');
      expect(sortedByArtistAsc[1].artist).toBe('Ludwig van Beethoven');
    });
  });

  describe('Feature C: Smart Playlists with 7 Templates & Online Defense', () => {
    it('contains all 7 required Phase 4 smart playlist templates', () => {
      const templateIds = DEFAULT_SMART_PLAYLISTS.map((p) => p.id);
      expect(templateIds).toContain('sp_recently_added');
      expect(templateIds).toContain('sp_most_played');
      expect(templateIds).toContain('sp_recently_played');
      expect(templateIds).toContain('sp_never_played');
      expect(templateIds).toContain('sp_frequently_played');
      expect(templateIds).toContain('sp_forgotten_favorites');
      expect(templateIds).toContain('sp_discovery_mix');
    });

    it('evaluates sp_never_played by filtering for playCount === 0', () => {
      const neverPlayedPlaylist = DEFAULT_SMART_PLAYLISTS.find((p) => p.id === 'sp_never_played')!;
      const tracks = [mockTrack1, mockTrack2, mockTrack3]; // mockTrack3 has playCount = 0

      const results = evaluateSmartPlaylist(neverPlayedPlaylist, tracks);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('online_track_spotify_1');
    });

    it('evaluates sp_forgotten_favorites for favorites not played recently', () => {
      const forgottenFavsPlaylist = DEFAULT_SMART_PLAYLISTS.find((p) => p.id === 'sp_forgotten_favorites')!;
      const oldFavorite: TrackMetadata = {
        ...mockTrack1,
        id: 'old_fav',
        isFavorite: true,
        lastPlayed: Date.now() - 25 * 86400 * 1000, // 25 days ago (> 14 days)
      };
      const recentFavorite: TrackMetadata = {
        ...mockTrack1,
        id: 'recent_fav',
        isFavorite: true,
        lastPlayed: Date.now() - 1000, // 1 second ago
      };

      const results = evaluateSmartPlaylist(forgottenFavsPlaylist, [oldFavorite, recentFavorite]);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('old_fav');
    });

    it('defensively excludes online tracks with unavailable or metadata_only playback capability', () => {
      const recentlyAddedPlaylist = DEFAULT_SMART_PLAYLISTS.find((p) => p.id === 'sp_recently_added')!;
      const validOnline: TrackMetadata = {
        ...mockTrack2,
        id: 'valid_online',
        playbackCapability: 'streamable',
      };
      const invalidOnline: TrackMetadata = {
        ...mockTrack2,
        id: 'invalid_online',
        playbackCapability: 'unavailable',
      };
      const metadataOnlyOnline: TrackMetadata = {
        ...mockTrack2,
        id: 'meta_online',
        playbackCapability: 'metadata_only',
      };

      const results = evaluateSmartPlaylist(recentlyAddedPlaylist, [validOnline, invalidOnline, metadataOnlyOnline]);
      expect(results.some((t) => t.id === 'valid_online')).toBe(true);
      expect(results.some((t) => t.id === 'invalid_online')).toBe(false);
      expect(results.some((t) => t.id === 'meta_online')).toBe(false);
    });
  });

  describe('Feature D: Local Personalized Discovery Engine', () => {
    it('computes explainable recommendations across sections', () => {
      // Simulate listening history
      historyService.recordSession(mockTrack1, 150); // completed
      favoritesService.toggleFavorite(mockTrack1);

      const libraryTracks = [
        mockTrack1,
        {
          ...mockTrack1,
          id: 'arijit_song_2',
          title: 'Channa Mereya',
          artist: 'Arijit Singh',
          playCount: 0,
          lastPlayed: undefined,
        },
        {
          ...mockTrack2,
          id: 'beethoven_5',
          title: 'Symphony No. 5',
          artist: 'Ludwig van Beethoven',
          playCount: 0,
          lastPlayed: undefined,
        },
      ];

      const sections = discoveryService.getPersonalizedSections(libraryTracks);
      expect(sections.hasSufficientData).toBe(true);
      expect(sections.madeForYou.length).toBeGreaterThan(0);
      expect(sections.artistRotation.length).toBeGreaterThan(0);

      // Verify explainable badges
      const topRec = sections.madeForYou[0];
      expect(topRec.reason).toBeDefined();
      expect(typeof topRec.reason).toBe('string');
      expect(topRec.signal).toBeDefined();
    });

    it('refreshes and resets discovery profile', () => {
      expect(() => discoveryService.refreshPersonalizedDiscovery()).not.toThrow();
      expect(() => discoveryService.resetRecommendationProfile()).not.toThrow();
    });
  });

  describe('Feature E: Listening Statistics & Aggregations', () => {
    beforeEach(() => {
      // Seed history
      historyService.recordSession(mockTrack1, 200); // 200s, Bollywood, local
      historyService.recordSession(mockTrack2, 100); // 100s, Classical, jamendo
    });

    it('calculates top tracks with listening durations', () => {
      const topTracks = statsService.getTopTracks(5);
      expect(topTracks.length).toBe(2);
      expect(topTracks[0].title).toBe('Tum Hi Ho');
      expect(topTracks[0].listeningSeconds).toBe(200);
      expect(topTracks[1].title).toBe('Moonlight Sonata');
      expect(topTracks[1].listeningSeconds).toBe(100);
    });

    it('calculates top albums', () => {
      const topAlbums = statsService.getTopAlbums(5);
      expect(topAlbums.length).toBe(2);
      expect(topAlbums[0].title).toBe('Aashiqui 2');
      expect(topAlbums[0].listeningSeconds).toBe(200);
    });

    it('calculates provider distribution with percentages', () => {
      const dist = statsService.getProviderDistribution();
      expect(dist.length).toBe(2);

      const localEntry = dist.find((d) => d.provider.toLowerCase() === 'local');
      const jamendoEntry = dist.find((d) => d.provider.toLowerCase() === 'jamendo');

      expect(localEntry).toBeDefined();
      expect(jamendoEntry).toBeDefined();
      // Total seconds = 300. Local = 200 (67%), Jamendo = 100 (33%)
      expect(localEntry!.seconds).toBe(200);
      expect(localEntry!.percentage).toBe(67);
      expect(jamendoEntry!.seconds).toBe(100);
      expect(jamendoEntry!.percentage).toBe(33);
    });

    it('calculates most active listening day of the week', () => {
      const mostActive = statsService.getMostActiveDay();
      expect(mostActive).not.toBeNull();
      expect(mostActive!.listeningSeconds).toBe(300);
      expect(mostActive!.tracksPlayed).toBe(2);
    });

    it('calculates weekly activity trend points', () => {
      const weekly = statsService.getWeeklyActivity(4);
      expect(weekly.length).toBe(4);
      // The current week should contain the 300 seconds
      const currentWeek = weekly[weekly.length - 1];
      expect(currentWeek.seconds).toBe(300);
      expect(currentWeek.tracksPlayed).toBe(2);
    });
  });
});
