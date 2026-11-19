import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnifiedTrack,
  unifiedTrackToTrackMetadata,
  trackMetadataToUnifiedTrack,
  PlaybackCapability,
} from '../types/universalMusic';
import { universalMusicService } from '../services/universalMusicService';
import { SpotifyProvider } from '../services/providers/spotifyProvider';
import { YouTubeProvider, parseIsoDuration } from '../services/providers/youtubeProvider';
import { ApplePreviewProvider } from '../services/providers/applePreviewProvider';

describe('Harmoniq Universal Music Engine — Phase 3 Commercial Music Discovery & Provider Expansion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    universalMusicService.clearCache();
  });

  // =========================================================================
  // 1. SPOTIFY PROVIDER UNIT TESTS
  // =========================================================================
  describe('Spotify Provider (Client Credentials Flow & Metadata Discovery)', () => {
    it('initializes with default empty credentials or stored values', () => {
      const provider = new SpotifyProvider('test-client-id', 'test-client-secret');
      expect(provider.id).toBe('spotify');
      expect(provider.name).toBe('Spotify');
      expect(provider.getCredentials().clientId).toBe('test-client-id');
      expect(provider.getCredentials().hasSecret).toBe(true);
    });

    it('returns empty result when credentials are not configured', async () => {
      const provider = new SpotifyProvider('', '');
      const resp = await provider.search('Arijit Singh');
      expect(resp.success).toBe(false);
      expect(resp.tracks).toEqual([]);
      expect(resp.errorMessage).toContain('not configured');
    });

    it('requests OAuth token and normalizes track items with popularity and ISRC', async () => {
      const provider = new SpotifyProvider('client-id-xyz', 'client-secret-123');

      // Mock fetch for token request and search request
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'mock-access-token-999',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          });
        }
        if (url.includes('/v1/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              tracks: {
                items: [
                  {
                    id: 'spotify_track_001',
                    name: 'Tum Hi Ho',
                    artists: [{ id: 'art1', name: 'Arijit Singh' }, { id: 'art2', name: 'Mithoon' }],
                    album: {
                      id: 'alb1',
                      name: 'Aashiqui 2',
                      images: [
                        { url: 'https://i.scdn.co/image/large.jpg', width: 640, height: 640 },
                        { url: 'https://i.scdn.co/image/medium.jpg', width: 300, height: 300 },
                      ],
                    },
                    duration_ms: 262000,
                    popularity: 88,
                    external_ids: { isrc: 'INUM71300054' },
                    external_urls: { spotify: 'https://open.spotify.com/track/spotify_track_001' },
                    preview_url: null, // typical modern Spotify API response
                  },
                  {
                    id: 'spotify_track_002',
                    name: 'Channa Mereya',
                    artists: [{ id: 'art1', name: 'Arijit Singh' }],
                    album: {
                      id: 'alb2',
                      name: 'Ae Dil Hai Mushkil',
                      images: [{ url: 'https://i.scdn.co/image/channa.jpg', width: 640, height: 640 }],
                    },
                    duration_ms: 289000,
                    popularity: 82,
                    external_ids: { isrc: 'INUM71600321' },
                    external_urls: { spotify: 'https://open.spotify.com/track/spotify_track_002' },
                    preview_url: 'https://p.scdn.co/mp3-preview/channa123',
                  },
                ],
              },
            }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.stubGlobal('fetch', mockFetch);

      const resp = await provider.search('Arijit Singh');
      expect(resp.success).toBe(true);
      expect(resp.tracks.length).toBe(2);

      const t1 = resp.tracks[0];
      expect(t1.id).toBe('spotify:spotify_track_001');
      expect(t1.providerId).toBe('spotify');
      expect(t1.title).toBe('Tum Hi Ho');
      expect(t1.artist).toBe('Arijit Singh, Mithoon');
      expect(t1.album).toBe('Aashiqui 2');
      expect(t1.duration).toBe(262);
      expect(t1.artworkUrl).toBe('https://i.scdn.co/image/large.jpg');
      expect(t1.popularity).toBe(88);
      expect(t1.isrc).toBe('INUM71300054');
      expect(t1.playbackCapability).toBe('external_link');
      expect(t1.providerWebUrl).toBe('https://open.spotify.com/track/spotify_track_001');

      const t2 = resp.tracks[1];
      expect(t2.id).toBe('spotify:spotify_track_002');
      expect(t2.playbackCapability).toBe('preview_stream');
      expect(t2.streamUrl).toBe('https://p.scdn.co/mp3-preview/channa123');
    });

    it('provides capability audit confirming metadata access and external destination links', () => {
      const provider = new SpotifyProvider('cid', 'csec');
      const audit = provider.getCapabilityAudit();
      expect(audit.providerId).toBe('spotify');
      expect(audit.searchAvailable).toBe(true);
      expect(audit.metadataAvailable).toBe(true);
      expect(audit.requiresAuth).toBe(true);
      expect(audit.officialDestinationUrl).toBe('https://open.spotify.com');
      expect(audit.commercialRestrictions).toContain('Stream ripping, audio extraction');
    });
  });

  // =========================================================================
  // 2. YOUTUBE PROVIDER UNIT TESTS
  // =========================================================================
  describe('YouTube Provider (Data API v3 & Authorized Video Embed/Links)', () => {
    it('correctly parses ISO 8601 durations', () => {
      expect(parseIsoDuration('PT3M45S')).toBe(225);
      expect(parseIsoDuration('PT1H2M10S')).toBe(3730);
      expect(parseIsoDuration('PT45S')).toBe(45);
      expect(parseIsoDuration('PT5M')).toBe(300);
      expect(parseIsoDuration('PT1H')).toBe(3600);
      expect(parseIsoDuration('')).toBe(0);
      expect(parseIsoDuration('invalid')).toBe(0);
    });

    it('returns empty result when API key is not configured', async () => {
      const provider = new YouTubeProvider('');
      const resp = await provider.search('Diljit Dosanjh');
      expect(resp.success).toBe(false);
      expect(resp.tracks).toEqual([]);
      expect(resp.errorMessage).toContain('not configured');
    });

    it('normalizes search results with authorized_embed capability and enforces ToS Section II.10', async () => {
      const provider = new YouTubeProvider('AIzaSyMockKey123');

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/youtube/v3/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: { videoId: 'yt_vid_001' },
                  snippet: {
                    title: 'Diljit Dosanjh - Lover (Official Music Video)',
                    channelTitle: 'Diljit Dosanjh',
                    thumbnails: {
                      high: { url: 'https://i.ytimg.com/vi/yt_vid_001/hqdefault.jpg' },
                    },
                  },
                },
              ],
            }),
          });
        }
        if (url.includes('/youtube/v3/videos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'yt_vid_001',
                  contentDetails: {
                    duration: 'PT3M15S',
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.stubGlobal('fetch', mockFetch);

      const resp = await provider.search('Diljit Dosanjh Lover');
      expect(resp.success).toBe(true);
      expect(resp.tracks.length).toBe(1);

      const track = resp.tracks[0];
      expect(track.id).toBe('youtube:yt_vid_001');
      expect(track.providerId).toBe('youtube');
      expect(track.title).toBe('Diljit Dosanjh - Lover (Official Music Video)');
      expect(track.artist).toBe('Diljit Dosanjh');
      expect(track.duration).toBe(195);
      expect(track.artworkUrl).toBe('https://i.ytimg.com/vi/yt_vid_001/hqdefault.jpg');
      expect(track.playbackCapability).toBe('authorized_embed');
      expect(track.providerWebUrl).toBe('https://www.youtube.com/watch?v=yt_vid_001');
    });

    it('provides capability audit verifying no audio ripping and full ToS compliance', () => {
      const provider = new YouTubeProvider('test-key');
      const audit = provider.getCapabilityAudit();
      expect(audit.providerId).toBe('youtube');
      expect(audit.playbackCapability).toBe('authorized_embed');
      expect(audit.commercialRestrictions).toContain('Section II.10');
      expect(audit.commercialRestrictions).toContain('Audio extraction, stream ripping');
    });
  });

  // =========================================================================
  // 3. CAPABILITY AUDITS (APPLE MUSIC & JIOSAAVN)
  // =========================================================================
  describe('Capability Audits: Apple Music & JioSaavn', () => {
    it('audits Apple Music as unauthenticated 30s previews with zero fees', () => {
      const apple = new ApplePreviewProvider();
      const audit = apple.getCapabilityAudit();
      expect(audit.providerId).toBe('apple');
      expect(audit.searchAvailable).toBe(true);
      expect(audit.metadataAvailable).toBe(true);
      expect(audit.playbackCapability).toBe('preview_stream');
      expect(audit.requiresAuth).toBe(false);
      expect(audit.developerRegistration).toContain('No developer key required');
    });

    it('audits JioSaavn as NOT AVAILABLE due to lack of official public developer API', () => {
      const audits = universalMusicService.getProviderCapabilityAudits();
      const saavnAudit = audits.find((a) => a.providerId === 'jiosaavn');
      expect(saavnAudit).toBeDefined();
      expect(saavnAudit!.playbackCapability).toBe('unavailable');
      expect(saavnAudit!.searchAvailable).toBe(false);
      expect(saavnAudit!.developerRegistration).toContain('NOT AVAILABLE');
      expect(saavnAudit!.commercialRestrictions).toContain('Unofficial scraping strictly prohibited');
    });
  });

  // =========================================================================
  // 4. RANK-BASED DEDUPLICATION WITH EXPANDED CAPABILITIES
  // =========================================================================
  describe('Universal Deduplication & Capability Ranking', () => {
    it('prioritizes full_stream > preview_stream > authorized_embed > external_link', async () => {
      // Simulate multi-provider search with same song across providers
      const duplicateTracks: UnifiedTrack[] = [
        {
          id: 'spotify:xyz',
          providerId: 'spotify',
          providerTrackId: 'xyz',
          title: 'Starboy',
          artist: 'The Weeknd',
          duration: 230,
          playbackCapability: 'external_link',
          isOnline: true,
          popularity: 92,
        },
        {
          id: 'youtube:abc',
          providerId: 'youtube',
          providerTrackId: 'abc',
          title: 'Starboy',
          artist: 'The Weeknd',
          duration: 230,
          playbackCapability: 'authorized_embed',
          isOnline: true,
        },
        {
          id: 'apple:123',
          providerId: 'apple',
          providerTrackId: '123',
          title: 'Starboy',
          artist: 'The Weeknd',
          duration: 230,
          playbackCapability: 'preview_stream',
          streamUrl: 'https://preview.apple.com/starboy.m4a',
          isOnline: true,
        },
        {
          id: 'audius:456',
          providerId: 'audius',
          providerTrackId: '456',
          title: 'Starboy',
          artist: 'The Weeknd',
          duration: 230,
          playbackCapability: 'full_stream',
          streamUrl: 'https://audius.co/stream/starboy.mp3',
          isOnline: true,
        },
      ];

      // Access private deduplicateTracks via any cast or test service wrapper
      const deduplicated = (universalMusicService as any).deduplicateTracks(duplicateTracks);
      expect(deduplicated.length).toBe(1);
      // The track with highest capability (full_stream = 10) must be retained
      expect(deduplicated[0].providerId).toBe('audius');
      expect(deduplicated[0].playbackCapability).toBe('full_stream');
    });

    it('prefers preview_stream over external_link when no full stream is available', () => {
      const duplicateTracks: UnifiedTrack[] = [
        {
          id: 'spotify:xyz',
          providerId: 'spotify',
          providerTrackId: 'xyz',
          title: 'Kesariya',
          artist: 'Arijit Singh',
          duration: 268,
          playbackCapability: 'external_link',
          isOnline: true,
          popularity: 85,
        },
        {
          id: 'apple:789',
          providerId: 'apple',
          providerTrackId: '789',
          title: 'Kesariya',
          artist: 'Arijit Singh',
          duration: 268,
          playbackCapability: 'preview_stream',
          streamUrl: 'https://preview.apple.com/kesariya.m4a',
          isOnline: true,
        },
      ];

      const deduplicated = (universalMusicService as any).deduplicateTracks(duplicateTracks);
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].providerId).toBe('apple');
      expect(deduplicated[0].playbackCapability).toBe('preview_stream');
    });
  });

  // =========================================================================
  // 5. METADATA PERSISTENCE (POPULARITY & ISRC)
  // =========================================================================
  describe('Metadata Type Conversion & Persistence', () => {
    it('preserves popularity and isrc when converting UnifiedTrack to TrackMetadata and back', () => {
      const originalTrack: UnifiedTrack = {
        id: 'spotify:track123',
        providerId: 'spotify',
        providerTrackId: 'track123',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 200,
        artworkUrl: 'https://i.scdn.co/image/blinding.jpg',
        playbackCapability: 'external_link',
        providerWebUrl: 'https://open.spotify.com/track/track123',
        popularity: 96,
        isrc: 'USUM71900764',
        isOnline: true,
      };

      const trackMetadata = unifiedTrackToTrackMetadata(originalTrack);
      expect(trackMetadata.popularity).toBe(96);
      expect(trackMetadata.isrc).toBe('USUM71900764');
      expect(trackMetadata.providerId).toBe('spotify');

      const convertedBack = trackMetadataToUnifiedTrack(trackMetadata);
      expect(convertedBack.popularity).toBe(96);
      expect(convertedBack.isrc).toBe('USUM71900764');
      expect(convertedBack.playbackCapability).toBe('external_link');
    });
  });

  // =========================================================================
  // 6. FAILURE ISOLATION & PROVIDER CREDENTIAL CONFIGURATION
  // =========================================================================
  describe('Failure Isolation & Credential Management', () => {
    it('stores and retrieves Spotify credentials and YouTube API key', () => {
      universalMusicService.setSpotifyCredentials('client-123', 'secret-456');
      expect(universalMusicService.getSpotifyCredentials().clientId).toBe('client-123');
      expect(universalMusicService.getSpotifyCredentials().hasSecret).toBe(true);

      universalMusicService.setYouTubeApiKey('yt-api-key-789');
      expect(universalMusicService.getYouTubeApiKey()).toBe('yt-api-key-789');

      // Clear them
      universalMusicService.setSpotifyCredentials('', '');
      expect(universalMusicService.getSpotifyCredentials().clientId).toBe('');
      expect(universalMusicService.getSpotifyCredentials().hasSecret).toBe(false);

      universalMusicService.setYouTubeApiKey('');
      expect(universalMusicService.getYouTubeApiKey()).toBe('');
    });

    it('isolates failures so unconfigured or failing commercial providers do not break the search', async () => {
      // Ensure Spotify and YouTube have empty keys (unconfigured)
      universalMusicService.setSpotifyCredentials('', '');
      universalMusicService.setYouTubeApiKey('');

      // Mock search on Apple provider
      const appleProvider = universalMusicService.getProvider('apple');
      expect(appleProvider).toBeDefined();

      vi.spyOn(appleProvider!, 'search').mockResolvedValueOnce({
        providerId: 'apple',
        success: true,
        durationMs: 50,
        tracks: [
          {
            id: 'apple:101',
            providerId: 'apple',
            providerTrackId: '101',
            title: 'Moonlight',
            artist: 'Ali Gatie',
            duration: 240,
            playbackCapability: 'preview_stream',
            streamUrl: 'https://preview.apple.com/moonlight.m4a',
            isOnline: true,
          },
        ],
      });

      // Search should succeed with results from Apple while Spotify and YouTube report graceful info
      const result = await universalMusicService.searchUniversal('Moonlight', { limit: 10 });
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(result.providerResponses.apple.success).toBe(true);
      expect(result.providerResponses.spotify.success).toBe(false); // unconfigured reports failure message gracefully
      expect(result.providerResponses.youtube.success).toBe(false); // unconfigured reports failure message gracefully
      expect(result.providerResponses.spotify.errorMessage).toContain('not configured');
      expect(result.providerResponses.youtube.errorMessage).toContain('not configured');
    });
  });
});
