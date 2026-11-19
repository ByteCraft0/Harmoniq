import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnifiedTrack,
  unifiedTrackToTrackMetadata,
  trackMetadataToUnifiedTrack,
} from '../types/universalMusic';
import { universalMusicService } from '../services/universalMusicService';
import { SpotifyProvider } from '../services/providers/spotifyProvider';
import { YouTubeProvider } from '../services/providers/youtubeProvider';
import { ApplePreviewProvider } from '../services/providers/applePreviewProvider';
import { AudiusProvider } from '../services/providers/audiusProvider';
import { ArchiveProvider } from '../services/providers/archiveProvider';
import { JamendoProvider } from '../services/providers/jamendoProvider';
import { LocalLibraryProvider } from '../services/providers/localProvider';

describe('Harmoniq Universal Music Engine — Phase 3.5 QA, Security & Reliability Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    universalMusicService.clearCache();
  });

  // =========================================================================
  // AREA A: SPOTIFY AUTHENTICATION & CREDENTIAL SECURITY
  // =========================================================================
  describe('Area A: Spotify Authentication & Credential Security', () => {
    it('A1: deduplicates concurrent token refresh requests so only a single token request is made', async () => {
      const provider = new SpotifyProvider('test-client-id', 'test-client-secret');

      let tokenFetchCount = 0;
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/token')) {
          tokenFetchCount += 1;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  access_token: 'mock-token-shared-123',
                  token_type: 'Bearer',
                  expires_in: 3600,
                }),
              });
            }, 10);
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ tracks: { items: [] } }),
        });
      });

      vi.stubGlobal('fetch', mockFetch);

      // Launch 3 simultaneous access token requests concurrently
      const [t1, t2, t3] = await Promise.all([
        provider.getAccessToken(),
        provider.getAccessToken(),
        provider.getAccessToken(),
      ]);

      expect(t1).toBe('mock-token-shared-123');
      expect(t2).toBe('mock-token-shared-123');
      expect(t3).toBe('mock-token-shared-123');
      expect(tokenFetchCount).toBe(1); // Exactly 1 fetch issued, 0 redundant storms
    });

    it('A2: does not store Spotify clientSecret in browser localStorage', () => {
      universalMusicService.setSpotifyCredentials('test-client-id', 'super-secret-password-xyz');

      if (typeof window !== 'undefined' && window.localStorage) {
        expect(window.localStorage.getItem('harmoniq_spotify_client_secret')).toBeNull();
        expect(window.localStorage.getItem('harmoniq_spotify_client_id')).toBe('test-client-id');
      }

      const creds = universalMusicService.getSpotifyCredentials();
      expect(creds.clientId).toBe('test-client-id');
      expect(creds.hasSecret).toBe(true);
    });

    it('A3: handles invalid Spotify credentials gracefully without throwing unhandled exceptions', async () => {
      const provider = new SpotifyProvider('bad-client-id', 'bad-secret');

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
          }),
        })
      );

      const resp = await provider.search('Arijit Singh');
      expect(resp.success).toBe(false);
      expect(resp.tracks).toEqual([]);
      expect(resp.errorMessage).toContain('Invalid client credentials');
      // Ensure the error message does not leak the secret
      expect(resp.errorMessage).not.toContain('bad-secret');
    });
  });

  // =========================================================================
  // AREA B: YOUTUBE PLAYBACK CLASSIFICATION
  // =========================================================================
  describe('Area B: YouTube Playback Classification', () => {
    it('B1: classifies ordinary YouTube watch results as external_link instead of authorized_embed', async () => {
      const provider = new YouTubeProvider('test-yt-key');

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/youtube/v3/search')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                items: [
                  {
                    id: { videoId: 'yt_video_99' },
                    snippet: {
                      title: 'Lover - Diljit Dosanjh',
                      channelTitle: 'Diljit Dosanjh',
                      thumbnails: { high: { url: 'https://i.ytimg.com/vi/yt_video_99/hqdefault.jpg' } },
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
                items: [{ id: 'yt_video_99', contentDetails: { duration: 'PT3M15S' } }],
              }),
            });
          }
          return Promise.reject(new Error('Unknown'));
        })
      );

      const resp = await provider.search('Diljit Dosanjh');
      expect(resp.success).toBe(true);
      expect(resp.tracks.length).toBe(1);

      const ytTrack = resp.tracks[0];
      // Critical check: Must be external_link because Harmoniq does not embed an iframe player in Phase 3
      expect(ytTrack.playbackCapability).toBe('external_link');
      expect(ytTrack.providerWebUrl).toBe('https://www.youtube.com/watch?v=yt_video_99');
    });

    it('B2: YouTube capability audit confirms no audio stream ripping in compliance with ToS Section II.10', () => {
      const provider = new YouTubeProvider('test-key');
      const audit = provider.getCapabilityAudit();
      expect(audit.playbackCapability).toBe('external_link');
      expect(audit.commercialRestrictions).toContain('Section II.10');
      expect(audit.commercialRestrictions).toContain('Audio extraction, stream ripping');
    });
  });

  // =========================================================================
  // AREA C: CROSS-PROVIDER DEDUPLICATION & METADATA ENRICHMENT
  // =========================================================================
  describe('Area C: Cross-Provider Deduplication & Metadata Preservation', () => {
    it('C1: deduplicates matching tracks across providers by ISRC code as primary definitive identifier', () => {
      const tracks: UnifiedTrack[] = [
        {
          id: 'spotify:track_spot_1',
          providerId: 'spotify',
          providerTrackId: 'spot_1',
          title: 'Blinding Lights (Album Version)',
          artist: 'The Weeknd',
          duration: 200,
          playbackCapability: 'external_link',
          isOnline: true,
          popularity: 95,
          isrc: 'USUM71900764',
          artworkUrl: 'https://i.scdn.co/image/640.jpg',
        },
        {
          id: 'apple:track_apple_1',
          providerId: 'apple',
          providerTrackId: 'apple_1',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          duration: 200,
          playbackCapability: 'preview_stream',
          streamUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
          isOnline: true,
          isrc: 'USUM71900764', // Matching ISRC code
        },
      ];

      const deduped = universalMusicService.deduplicateTracks(tracks);
      expect(deduped.length).toBe(1);

      const merged = deduped[0];
      // Winner is Apple (preview_stream rank 8 > external_link rank 4)
      expect(merged.providerId).toBe('apple');
      expect(merged.playbackCapability).toBe('preview_stream');
      expect(merged.streamUrl).toBe('https://audio-ssl.itunes.apple.com/preview.m4a');
      // Preserved rich Spotify metadata
      expect(merged.popularity).toBe(95);
      expect(merged.artworkUrl).toBe('https://i.scdn.co/image/640.jpg');
      expect(merged.isrc).toBe('USUM71900764');
    });

    it('C2: separates Live and Studio versions into distinct tracks', () => {
      const tracks: UnifiedTrack[] = [
        {
          id: 'spotify:studio',
          providerId: 'spotify',
          providerTrackId: 'studio',
          title: 'Hotel California',
          artist: 'Eagles',
          duration: 390,
          playbackCapability: 'external_link',
          isOnline: true,
        },
        {
          id: 'apple:live',
          providerId: 'apple',
          providerTrackId: 'live',
          title: 'Hotel California (Live at The Forum)',
          artist: 'Eagles',
          duration: 420,
          playbackCapability: 'preview_stream',
          streamUrl: 'https://preview.apple.com/live.m4a',
          isOnline: true,
        },
      ];

      const deduped = universalMusicService.deduplicateTracks(tracks);
      expect(deduped.length).toBe(2);
    });

    it('C3: separates Remix versions from Original tracks', () => {
      const tracks: UnifiedTrack[] = [
        {
          id: 'spotify:orig',
          providerId: 'spotify',
          providerTrackId: 'orig',
          title: 'Starboy',
          artist: 'The Weeknd',
          duration: 230,
          playbackCapability: 'external_link',
          isOnline: true,
        },
        {
          id: 'audius:remix',
          providerId: 'audius',
          providerTrackId: 'remix',
          title: 'Starboy (Kygo Remix)',
          artist: 'The Weeknd',
          duration: 245,
          playbackCapability: 'full_stream',
          streamUrl: 'https://audius.co/stream/remix.mp3',
          isOnline: true,
        },
      ];

      const deduped = universalMusicService.deduplicateTracks(tracks);
      expect(deduped.length).toBe(2);
    });

    it('C4: separates Cover recordings with different artists sharing the same title', () => {
      const tracks: UnifiedTrack[] = [
        {
          id: 'spotify:nin',
          providerId: 'spotify',
          providerTrackId: 'nin',
          title: 'Hurt',
          artist: 'Nine Inch Nails',
          duration: 373,
          playbackCapability: 'external_link',
          isOnline: true,
        },
        {
          id: 'apple:cash',
          providerId: 'apple',
          providerTrackId: 'cash',
          title: 'Hurt',
          artist: 'Johnny Cash',
          duration: 218,
          playbackCapability: 'preview_stream',
          streamUrl: 'https://preview.apple.com/cash.m4a',
          isOnline: true,
        },
      ];

      const deduped = universalMusicService.deduplicateTracks(tracks);
      expect(deduped.length).toBe(2);
    });
  });

  // =========================================================================
  // AREA D: CAPABILITY ACCURACY AUDIT
  // =========================================================================
  describe('Area D: Capability Accuracy Across All Providers', () => {
    it('D1: audits all 7 supported and investigated providers with verified accuracy', () => {
      const audits = universalMusicService.getProviderCapabilityAudits();
      expect(audits.length).toBeGreaterThanOrEqual(6);

      const apple = audits.find((a) => a.providerId === 'apple');
      expect(apple?.playbackCapability).toBe('preview_stream');

      const audius = audits.find((a) => a.providerId === 'audius');
      expect(audius?.playbackCapability).toBe('full_stream');

      const archive = audits.find((a) => a.providerId === 'archive');
      expect(archive?.playbackCapability).toBe('full_stream');

      const jamendo = audits.find((a) => a.providerId === 'jamendo');
      expect(jamendo?.playbackCapability).toBe('full_stream');

      const spotify = audits.find((a) => a.providerId === 'spotify');
      expect(spotify?.playbackCapability).toBe('external_link');

      const youtube = audits.find((a) => a.providerId === 'youtube');
      expect(youtube?.playbackCapability).toBe('external_link');

      const saavn = audits.find((a) => a.providerId === 'jiosaavn');
      expect(saavn?.playbackCapability).toBe('unavailable');
    });
  });

  // =========================================================================
  // AREA E: QUEUE DEFENSE & METADATA PRESERVATION
  // =========================================================================
  describe('Area E: Queue Defense & Metadata Types', () => {
    it('E1: converts UnifiedTrack to TrackMetadata with online capability descriptors', () => {
      const ut: UnifiedTrack = {
        id: 'spotify:track1',
        providerId: 'spotify',
        providerTrackId: 'track1',
        title: 'Channa Mereya',
        artist: 'Arijit Singh',
        duration: 289,
        playbackCapability: 'external_link',
        popularity: 88,
        isrc: 'INUM71600321',
        isOnline: true,
      };

      const meta = unifiedTrackToTrackMetadata(ut);
      expect(meta.id).toBe('spotify:track1');
      expect(meta.playbackCapability).toBe('external_link');
      expect(meta.popularity).toBe(88);
      expect(meta.isrc).toBe('INUM71600321');
      expect(meta.isOnline).toBe(true);

      const back = trackMetadataToUnifiedTrack(meta);
      expect(back.playbackCapability).toBe('external_link');
      expect(back.popularity).toBe(88);
      expect(back.isrc).toBe('INUM71600321');
    });
  });

  // =========================================================================
  // AREA F: API FAILURE ISOLATION
  // =========================================================================
  describe('Area F: API Failure Isolation', () => {
    it('F1: ensures total failure of Spotify & YouTube does not impede Apple Music discovery', async () => {
      universalMusicService.setSpotifyCredentials('', '');
      universalMusicService.setYouTubeApiKey('');

      const appleProvider = universalMusicService.getProvider('apple');
      vi.spyOn(appleProvider!, 'search').mockResolvedValueOnce({
        providerId: 'apple',
        success: true,
        durationMs: 40,
        tracks: [
          {
            id: 'apple:arijit_1',
            providerId: 'apple',
            providerTrackId: 'arijit_1',
            title: 'Tum Hi Ho',
            artist: 'Arijit Singh',
            duration: 262,
            playbackCapability: 'preview_stream',
            streamUrl: 'https://preview.apple.com/tumhiho.m4a',
            isOnline: true,
          },
        ],
      });

      const response = await universalMusicService.searchUniversal('Arijit Singh');
      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(response.results[0].title).toBe('Tum Hi Ho');
      expect(response.providerResponses.apple.success).toBe(true);
      expect(response.providerResponses.spotify.success).toBe(false);
      expect(response.providerResponses.youtube.success).toBe(false);
    });
  });
});
