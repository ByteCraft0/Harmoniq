import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnifiedTrack,
  unifiedTrackToTrackMetadata,
  trackMetadataToUnifiedTrack,
} from '../types/universalMusic';
import { universalMusicService, UniversalMusicService } from '../services/universalMusicService';
import {
  JamendoProvider,
  AudiusProvider,
  ArchiveProvider,
  ApplePreviewProvider,
  BaseMusicProvider,
} from '../services/providers';
import { buildMediaUrl } from '../services/audioEngine';
import { TrackMetadata } from '../types/audio';

describe('Harmoniq Universal Music Engine — Phase 1 Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    universalMusicService.clearCache();
  });

  // =========================================================================
  // 1. DATA CONTRACTS & MODEL INTEGRITY
  // =========================================================================
  describe('Data Contracts & Track Model Conversion', () => {
    it('creates a valid UnifiedTrack with required provider metadata', () => {
      const track: UnifiedTrack = {
        id: 'jamendo:1001',
        providerId: 'jamendo',
        providerTrackId: '1001',
        title: 'Cinematic Dream',
        artist: 'Aurora Vibes',
        album: 'Cosmic Journeys',
        duration: 215,
        artworkUrl: 'https://usercontent.jamendo.com/covers/1001.jpg',
        genre: 'Ambient',
        releaseYear: 2024,
        playbackCapability: 'full_stream',
        streamUrl: 'https://prod-1.storage.jamendo.com/download/track/1001/mp32/',
        format: 'MP3',
        bitrate: 128,
        license: 'Creative Commons BY-SA 4.0',
        attributionText: 'Aurora Vibes via Jamendo',
        providerWebUrl: 'https://www.jamendo.com/track/1001',
        isOnline: true,
      };

      expect(track.id).toBe('jamendo:1001');
      expect(track.providerId).toBe('jamendo');
      expect(track.playbackCapability).toBe('full_stream');
      expect(track.isOnline).toBe(true);
    });

    it('converts UnifiedTrack to TrackMetadata for audio engine and queue compatibility', () => {
      const onlineTrack: UnifiedTrack = {
        id: 'audius:trk_999',
        providerId: 'audius',
        providerTrackId: 'trk_999',
        title: 'Neon Skyline',
        artist: 'SynthWave Kid',
        album: 'Retrofuturism',
        duration: 180,
        artworkUrl: 'https://audius.co/art/trk_999_480.jpg',
        playbackCapability: 'full_stream',
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/trk_999/stream',
        format: 'MP3',
        bitrate: 320,
        isOnline: true,
      };

      const meta = unifiedTrackToTrackMetadata(onlineTrack);

      expect(meta.id).toBe('audius:trk_999');
      expect(meta.title).toBe('Neon Skyline');
      expect(meta.artist).toBe('SynthWave Kid');
      expect(meta.duration).toBe(180);
      expect(meta.filePath).toBe('https://discoveryprovider.audius.co/v1/tracks/trk_999/stream');
      expect(meta.hasArtwork).toBe(true);
      expect(meta.artworkDataUrl).toBe('https://audius.co/art/trk_999_480.jpg');
      expect(meta.codec).toBe('MP3');
      expect((meta as any).isOnline).toBe(true);
      expect((meta as any).providerId).toBe('audius');
    });

    it('converts local TrackMetadata into UnifiedTrack format', () => {
      const localTrack: TrackMetadata = {
        id: 'local_flac_12',
        filePath: 'C:\\Music\\Jazz\\Take Five.flac',
        fileName: 'Take Five.flac',
        fileSize: 45000000,
        dateModified: Date.now(),
        title: 'Take Five',
        artist: 'Dave Brubeck',
        album: 'Time Out',
        duration: 324,
        hasArtwork: false,
        codec: 'FLAC',
        container: 'FLAC',
        sampleRate: 96000,
        bitrate: 1411,
        channels: 2,
        isLossless: true,
        playCount: 15,
        isFavorite: true,
      };

      const unified = trackMetadataToUnifiedTrack(localTrack);

      expect(unified.id).toBe('local_flac_12');
      expect(unified.providerId).toBe('local');
      expect(unified.playbackCapability).toBe('local_file');
      expect(unified.isOnline).toBe(false);
      expect(unified.streamUrl).toBe('C:\\Music\\Jazz\\Take Five.flac');
      expect(unified.format).toBe('FLAC');
    });
  });

  // =========================================================================
  // 2. PROVIDER REGISTRATION ARCHITECTURE
  // =========================================================================
  describe('Provider Architecture & Registration', () => {
    it('registers initial default providers in the universal service', () => {
      const providers = universalMusicService.getAllProviders();
      const providerIds = providers.map((p) => p.id);

      expect(providerIds).toContain('jamendo');
      expect(providerIds).toContain('audius');
      expect(providerIds).toContain('archive');
      expect(providerIds).toContain('apple');
      expect(providerIds).toContain('local');
    });

    it('allows registering a custom music provider dynamically', () => {
      const service = new UniversalMusicService();

      class CustomProvider extends BaseMusicProvider {
        readonly id = 'jamendo'; // replacement test
        readonly name = 'Custom Jamendo Mock';
        readonly defaultCapability = 'full_stream' as const;

        normalize(raw: any): UnifiedTrack | null {
          return null;
        }

        async search(): Promise<any> {
          return { providerId: 'jamendo', success: true, tracks: [], durationMs: 5 };
        }
      }

      service.registerProvider(new CustomProvider());
      const p = service.getProvider('jamendo');
      expect(p?.name).toBe('Custom Jamendo Mock');
    });

    it('supports enabling and disabling specific providers', () => {
      expect(universalMusicService.isProviderEnabled('audius')).toBe(true);

      universalMusicService.setProviderEnabled('audius', false);
      expect(universalMusicService.isProviderEnabled('audius')).toBe(false);

      universalMusicService.setProviderEnabled('audius', true);
      expect(universalMusicService.isProviderEnabled('audius')).toBe(true);
    });
  });

  // =========================================================================
  // 3. METADATA NORMALIZATION ACROSS HETEROGENEOUS PROVIDERS
  // =========================================================================
  describe('Metadata Normalization', () => {
    it('normalizes Jamendo API response objects accurately', () => {
      const jamendo = new JamendoProvider();
      const raw = {
        id: '54321',
        name: 'Midnight Echoes',
        artist_name: 'Solar Flare',
        album_name: 'Supernova',
        duration: 195,
        image: 'https://jamendo.com/img54321.jpg',
        audio: 'https://jamendo.com/stream54321.mp3',
        releasedate: '2023-05-18',
        license_ccurl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      };

      const norm = jamendo.normalize(raw);
      expect(norm).not.toBeNull();
      expect(norm?.id).toBe('jamendo:54321');
      expect(norm?.title).toBe('Midnight Echoes');
      expect(norm?.artist).toBe('Solar Flare');
      expect(norm?.album).toBe('Supernova');
      expect(norm?.duration).toBe(195);
      expect(norm?.playbackCapability).toBe('full_stream');
      expect(norm?.streamUrl).toBe('https://jamendo.com/stream54321.mp3');
      expect(norm?.bitrate).toBe(128);
    });

    it('normalizes Audius API track response with 320kbps MP3 stream', () => {
      const audius = new AudiusProvider();
      const raw = {
        id: 'aud_777',
        title: 'Cyber Highway',
        duration: 240,
        genre: 'Electronic',
        user: { name: 'Vapor Wave', handle: 'vaporwave' },
        artwork: { '480x480': 'https://audius.co/art/480.jpg' },
        permalink: '/vaporwave/cyber-highway',
      };

      const norm = audius.normalize(raw);
      expect(norm).not.toBeNull();
      expect(norm?.id).toBe('audius:aud_777');
      expect(norm?.artist).toBe('Vapor Wave');
      expect(norm?.playbackCapability).toBe('full_stream');
      expect(norm?.bitrate).toBe(320);
      expect(norm?.streamUrl).toContain('/v1/tracks/aud_777/stream');
      expect(norm?.providerWebUrl).toBe('https://audius.co/vaporwave/cyber-highway');
    });

    it('normalizes Internet Archive audio objects including array creators and titles', () => {
      const archive = new ArchiveProvider();
      const raw = {
        identifier: 'beethoven_sym7_1952',
        title: ['Symphony No. 7 in A Major, Op. 92'],
        creator: ['Arturo Toscanini', 'NBC Symphony Orchestra'],
        year: '1952',
      };

      const norm = archive.normalize(raw);
      expect(norm).not.toBeNull();
      expect(norm?.id).toBe('archive:beethoven_sym7_1952');
      expect(norm?.title).toBe('Symphony No. 7 in A Major, Op. 92');
      expect(norm?.artist).toBe('Arturo Toscanini');
      expect(norm?.releaseYear).toBe(1952);
      expect(norm?.playbackCapability).toBe('full_stream');
      expect(norm?.streamUrl).toBe(
        'https://archive.org/download/beethoven_sym7_1952/beethoven_sym7_1952_vbr.mp3'
      );
    });

    it('normalizes Apple / iTunes results with 30s preview and high-res artwork', () => {
      const apple = new ApplePreviewProvider();
      const raw = {
        trackId: 1440857781,
        trackName: 'Tum Hi Ho',
        artistName: 'Arijit Singh',
        collectionName: 'Aashiqui 2 (Original Motion Picture Soundtrack)',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg',
        trackTimeMillis: 262000,
        previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
        primaryGenreName: 'Bollywood',
        releaseDate: '2013-04-08T07:00:00Z',
      };

      const norm = apple.normalize(raw);
      expect(norm).not.toBeNull();
      expect(norm?.id).toBe('apple:1440857781');
      expect(norm?.title).toBe('Tum Hi Ho');
      expect(norm?.artist).toBe('Arijit Singh');
      expect(norm?.genre).toBe('Bollywood');
      expect(norm?.duration).toBe(262);
      expect(norm?.playbackCapability).toBe('preview_stream');
      expect(norm?.artworkUrl).toContain('600x600bb.jpg');
      expect(norm?.format).toBe('AAC');
    });
  });

  // =========================================================================
  // 4. DUPLICATE DETECTION & PRECEDENCE
  // =========================================================================
  describe('Duplicate Detection & Priority', () => {
    it('deduplicates matching tracks and prioritizes full-length streams over 30s previews', () => {
      const previewTrack: UnifiedTrack = {
        id: 'apple:preview_1',
        providerId: 'apple',
        providerTrackId: 'p1',
        title: 'Canon in D',
        artist: 'Johann Pachelbel',
        duration: 300,
        playbackCapability: 'preview_stream',
        streamUrl: 'https://apple.com/preview.m4a',
        isOnline: true,
      };

      const fullTrack: UnifiedTrack = {
        id: 'archive:full_1',
        providerId: 'archive',
        providerTrackId: 'f1',
        title: 'Canon in D',
        artist: 'Johann Pachelbel',
        duration: 312,
        playbackCapability: 'full_stream',
        streamUrl: 'https://archive.org/canon.mp3',
        isOnline: true,
      };

      const deduplicated = universalMusicService.deduplicateTracks([previewTrack, fullTrack]);

      expect(deduplicated.length).toBe(1);
      // Full stream takes priority over preview
      expect(deduplicated[0].id).toBe('archive:full_1');
      expect(deduplicated[0].playbackCapability).toBe('full_stream');
    });

    it('keeps distinct songs from different artists intact', () => {
      const track1: UnifiedTrack = {
        id: 'apple:1',
        providerId: 'apple',
        providerTrackId: '1',
        title: 'Imagine',
        artist: 'John Lennon',
        duration: 183,
        playbackCapability: 'preview_stream',
        isOnline: true,
      };

      const track2: UnifiedTrack = {
        id: 'jamendo:2',
        providerId: 'jamendo',
        providerTrackId: '2',
        title: 'Imagine',
        artist: 'Carbon Leaf',
        duration: 210,
        playbackCapability: 'full_stream',
        isOnline: true,
      };

      const deduplicated = universalMusicService.deduplicateTracks([track1, track2]);
      expect(deduplicated.length).toBe(2);
    });
  });

  // =========================================================================
  // 5. PROVIDER FAILURE ISOLATION & PARALLEL EXECUTION
  // =========================================================================
  describe('Provider Failure Isolation & Parallel Execution', () => {
    it('returns results from healthy providers even if one provider fails or times out', async () => {
      const service = new UniversalMusicService();
      service.clearProviders();

      const healthyProvider = new ApplePreviewProvider();
      vi.spyOn(healthyProvider, 'search').mockResolvedValue({
        providerId: 'apple',
        success: true,
        tracks: [
          {
            id: 'apple:test1',
            providerId: 'apple',
            providerTrackId: 'test1',
            title: 'Kesariya',
            artist: 'Arijit Singh',
            duration: 268,
            playbackCapability: 'preview_stream',
            isOnline: true,
          },
        ],
        durationMs: 45,
      });

      const failingProvider = new JamendoProvider();
      vi.spyOn(failingProvider, 'search').mockRejectedValue(new Error('Network gateway timeout (504)'));

      service.registerProvider(healthyProvider);
      service.registerProvider(failingProvider);

      const resp = await service.searchUniversal('Kesariya');

      expect(resp.results.length).toBe(1);
      expect(resp.results[0].title).toBe('Kesariya');
      expect(resp.providerResponses['apple'].success).toBe(true);
      expect(resp.providerResponses['jamendo'].success).toBe(false);
      expect(resp.providerResponses['jamendo'].errorMessage).toContain('timeout');
    });
  });

  // =========================================================================
  // 6. CACHING & EXPIRATION
  // =========================================================================
  describe('Caching & Search Expiration', () => {
    it('caches universal search queries and marks subsequent calls as cached', async () => {
      const service = new UniversalMusicService();
      service.clearProviders();

      const mockProvider = new ApplePreviewProvider();
      const searchSpy = vi.spyOn(mockProvider, 'search').mockResolvedValue({
        providerId: 'apple',
        success: true,
        tracks: [
          {
            id: 'apple:c1',
            providerId: 'apple',
            providerTrackId: 'c1',
            title: 'Cache Track',
            artist: 'Cache Artist',
            duration: 200,
            playbackCapability: 'preview_stream',
            isOnline: true,
          },
        ],
        durationMs: 30,
      });

      service.registerProvider(mockProvider);

      const res1 = await service.searchUniversal('CacheQuery');
      expect(res1.cached).toBe(false);
      expect(searchSpy).toHaveBeenCalledTimes(1);

      // Second immediate call must hit cache
      const res2 = await service.searchUniversal('CacheQuery');
      expect(res2.cached).toBe(true);
      expect(searchSpy).toHaveBeenCalledTimes(1); // Provider not called again
    });

    it('clears cache on demand via clearCache()', async () => {
      const service = new UniversalMusicService();
      service.clearProviders();

      const mockProvider = new ApplePreviewProvider();
      const searchSpy = vi.spyOn(mockProvider, 'search').mockResolvedValue({
        providerId: 'apple',
        success: true,
        tracks: [],
        durationMs: 10,
      });

      service.registerProvider(mockProvider);

      await service.searchUniversal('ClearMe');
      expect(searchSpy).toHaveBeenCalledTimes(1);

      service.clearCache();

      await service.searchUniversal('ClearMe');
      expect(searchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // 7. AUDIO ENGINE STREAMING FOUNDATION & URL VALIDATION
  // =========================================================================
  describe('Audio Engine Stream URL Validation', () => {
    it('preserves valid HTTP and HTTPS stream URLs directly without path corruption', () => {
      const httpsUrl = 'https://prod-1.storage.jamendo.com/download/track/123/mp32/';
      const httpUrl = 'http://radio.linn.co.uk:8000/autodj';
      const urlWithParams = 'https://discoveryprovider.audius.co/v1/tracks/456/stream?app_name=Harmoniq';

      expect(buildMediaUrl(httpsUrl)).toBe(httpsUrl);
      expect(buildMediaUrl(httpUrl)).toBe(httpUrl);
      expect(buildMediaUrl(urlWithParams)).toBe(urlWithParams);
    });

    it('continues to route local Windows audio files through harmoniq-media:// protocol', () => {
      const winPath = 'C:\\Music\\FLAC Collection\\Artist\\Song.flac';
      const mediaUrl = buildMediaUrl(winPath);

      expect(mediaUrl.startsWith('harmoniq-media://local/')).toBe(true);
      expect(mediaUrl).toContain('C%3A');
      expect(mediaUrl).toContain('Song.flac');
    });

    it('correctly handles UNC network share paths', () => {
      const uncPath = '\\\\NAS\\Music\\Album\\Track.mp3';
      const mediaUrl = buildMediaUrl(uncPath);

      expect(mediaUrl.startsWith('harmoniq-media://local/UNC/')).toBe(true);
    });

    it('rejects dangerous and unauthorized protocol schemes', () => {
      expect(() => buildMediaUrl('javascript:alert(1)')).toThrow();
      expect(() => buildMediaUrl('file:///etc/passwd')).toThrow();
      expect(() => buildMediaUrl('ftp://insecure.server/audio.wav')).toThrow();
      expect(() => buildMediaUrl('data:text/html;base64,PHNjcmlwdD4=')).toThrow();
    });

    it('handles empty or non-string inputs safely', () => {
      expect(buildMediaUrl('')).toBe('');
      expect(buildMediaUrl(null as any)).toBe('');
      expect(buildMediaUrl(undefined as any)).toBe('');
    });
  });

  // =========================================================================
  // 8. QUEUE & PLAYBACK INTEGRATION COMPATIBILITY
  // =========================================================================
  describe('Queue & Player Integration Compatibility', () => {
    it('allows local and online tracks to coexist in the same queue structure', () => {
      const localTrack: TrackMetadata = {
        id: 'local_1',
        filePath: 'C:\\Music\\rock.mp3',
        fileName: 'rock.mp3',
        fileSize: 5000000,
        dateModified: Date.now(),
        title: 'Local Rock Song',
        artist: 'Garage Band',
        album: 'Demo Album',
        duration: 180,
        hasArtwork: false,
        codec: 'MP3',
        container: 'MP3',
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        isLossless: false,
        playCount: 1,
        isFavorite: false,
      };

      const onlineTrack: UnifiedTrack = {
        id: 'jamendo:987',
        providerId: 'jamendo',
        providerTrackId: '987',
        title: 'Summer Breeze',
        artist: 'Acoustic Sound',
        duration: 210,
        playbackCapability: 'full_stream',
        streamUrl: 'https://jamendo.com/stream.mp3',
        isOnline: true,
      };

      const queue: TrackMetadata[] = [localTrack, unifiedTrackToTrackMetadata(onlineTrack)];

      expect(queue.length).toBe(2);
      expect(queue[0].id).toBe('local_1');
      expect(queue[0].filePath).toBe('C:\\Music\\rock.mp3');

      expect(queue[1].id).toBe('jamendo:987');
      expect(queue[1].filePath).toBe('https://jamendo.com/stream.mp3');
      expect((queue[1] as any).isOnline).toBe(true);

      // Verify buildMediaUrl handles both items in the queue seamlessly
      expect(buildMediaUrl(queue[0].filePath).startsWith('harmoniq-media://local/')).toBe(true);
      expect(buildMediaUrl(queue[1].filePath)).toBe('https://jamendo.com/stream.mp3');
    });
  });
});
