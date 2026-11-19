import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnifiedTrack,
  unifiedTrackToTrackMetadata,
  trackMetadataToUnifiedTrack,
  PlaybackCapability,
} from '../types/universalMusic';
import { universalMusicService, UniversalMusicService } from '../services/universalMusicService';
import { ArchiveProvider } from '../services/providers/archiveProvider';
import { JamendoProvider } from '../services/providers/jamendoProvider';
import { AudiusProvider } from '../services/providers/audiusProvider';
import { ApplePreviewProvider } from '../services/providers/applePreviewProvider';
import { buildMediaUrl } from '../services/audioEngine';

describe('Harmoniq Universal Music Engine — Phase 2 UI Transformation & Real Playback Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    universalMusicService.clearCache();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('harmoniq_jamendo_client_id');
    }
    universalMusicService.setJamendoClientId('');
  });

  // =========================================================================
  // 1. ON-DEMAND STREAM RESOLUTION
  // =========================================================================
  describe('On-Demand Stream Resolution Layer', () => {
    it('resolves Audius tracks to their streaming endpoint', async () => {
      const audiusTrack: UnifiedTrack = {
        id: 'audius:ayb1yz',
        providerId: 'audius',
        providerTrackId: 'ayb1yz',
        title: 'Moonlight Fantasy',
        artist: 'Luna Beats',
        duration: 210,
        playbackCapability: 'full_stream',
        isOnline: true,
      };

      const resolved = await universalMusicService.resolveTrackStream(audiusTrack);
      expect(resolved.streamUrl).toContain('discoveryprovider.audius.co/v1/tracks/ayb1yz/stream');
      expect(resolved.capability).toBe('full_stream');
      expect(resolved.track.streamUrl).toBe(resolved.streamUrl);
    });

    it('resolves Apple Music preview streams with 30s preview capability', async () => {
      const appleTrack: UnifiedTrack = {
        id: 'apple:1440857781',
        providerId: 'apple',
        providerTrackId: '1440857781',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        duration: 200,
        playbackCapability: 'preview_stream',
        streamUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/preview.m4a',
        format: 'AAC',
        bitrate: 256,
        isOnline: true,
      };

      const resolved = await universalMusicService.resolveTrackStream(appleTrack);
      expect(resolved.streamUrl).toBe(appleTrack.streamUrl);
      expect(resolved.capability).toBe('preview_stream');
    });

    it('resolves local files directly without remote network requests', async () => {
      const localTrack: UnifiedTrack = {
        id: 'local_song_42',
        providerId: 'local',
        providerTrackId: 'local_song_42',
        title: 'My Favorite Track',
        artist: 'Home Artist',
        duration: 195,
        playbackCapability: 'local_file',
        streamUrl: 'C:/Music/song.mp3',
        isOnline: false,
      };

      const resolved = await universalMusicService.resolveTrackStream(localTrack);
      expect(resolved.streamUrl).toBe('C:/Music/song.mp3');
      expect(resolved.capability).toBe('local_file');
    });

    it('uses Electron IPC resolver when available in desktop environment', async () => {
      const mockResolveIpc = vi.fn().mockResolvedValue({
        success: true,
        streamUrl: 'https://cdn.archive.org/download/test/resolved_file.mp3',
        capability: 'full_stream',
        format: 'MP3',
        bitrate: 320,
        duration: 240,
      });

      const target = typeof window !== 'undefined' ? window : (globalThis as any);
      target.harmoniqApi = {
        resolveUniversalStream: mockResolveIpc,
      };

      const track: UnifiedTrack = {
        id: 'archive:test_item',
        providerId: 'archive',
        providerTrackId: 'test_item',
        title: 'Classical Piece',
        artist: 'Orchestra',
        duration: 0,
        playbackCapability: 'full_stream',
        isOnline: true,
      };

      const resolved = await universalMusicService.resolveTrackStream(track);
      expect(mockResolveIpc).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'archive',
          providerTrackId: 'test_item',
        })
      );
      expect(resolved.streamUrl).toBe('https://cdn.archive.org/download/test/resolved_file.mp3');
      expect(resolved.track.duration).toBe(240);

      delete target.harmoniqApi;
    });
  });

  // =========================================================================
  // 2. INTERNET ARCHIVE MANIFEST & AUDIO FILE RESOLUTION
  // =========================================================================
  describe('Internet Archive File Manifest Resolution', () => {
    it('identifies and selects the best VBR MP3 audio file from manifest, ignoring non-audio items', async () => {
      const archiveProvider = new ArchiveProvider();

      // Mock manifest with multiple formats and auxiliary files
      const mockManifest = {
        result: [
          { name: 'item_meta.xml', format: 'Metadata' },
          { name: 'item_files.xml', format: 'Metadata' },
          { name: 'cover_thumb.jpg', format: 'JPEG' },
          { name: 'waveform.afpk', format: 'Waveform' },
          { name: 'item_64kbps.mp3', format: '64Kbps MP3', length: '180.5' },
          { name: 'Song_Title_Original.mp3', format: 'VBR MP3', length: '180.5' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      } as Response);

      const resolved = await archiveProvider.resolveAudioFile('test_identifier_123');

      expect(resolved.streamUrl).toBe(
        'https://archive.org/download/test_identifier_123/Song_Title_Original.mp3'
      );
      expect(resolved.format).toBe('MP3');
      expect(resolved.duration).toBe(181);
    });

    it('gracefully handles missing or empty manifests with fallback URL', async () => {
      const archiveProvider = new ArchiveProvider();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const resolved = await archiveProvider.resolveAudioFile('missing_identifier');
      expect(resolved.streamUrl).toBe(
        'https://archive.org/download/missing_identifier/missing_identifier_vbr.mp3'
      );
    });
  });

  // =========================================================================
  // 3. JAMENDO CLIENT ID SETTINGS & CONFIGURATION
  // =========================================================================
  describe('Jamendo Settings & Client ID Configuration', () => {
    it('returns default open demo Client ID initially', () => {
      const clientId = universalMusicService.getJamendoClientId();
      expect(clientId).toBe('b6747d04');
    });

    it('updates, persists, and applies custom Jamendo Client ID', () => {
      const customKey = 'my_developer_jamendo_key_8899';
      universalMusicService.setJamendoClientId(customKey);

      expect(universalMusicService.getJamendoClientId()).toBe(customKey);
      if (typeof window !== 'undefined' && window.localStorage) {
        expect(window.localStorage.getItem('harmoniq_jamendo_client_id')).toBe(customKey);
      }
    });

    it('resets Client ID back to default when empty string or null is provided', () => {
      universalMusicService.setJamendoClientId('temporary_key');
      expect(universalMusicService.getJamendoClientId()).toBe('temporary_key');

      universalMusicService.setJamendoClientId('');
      expect(universalMusicService.getJamendoClientId()).toBe('b6747d04');
    });
  });

  // =========================================================================
  // 4. QUEUE & METADATA PRESERVATION
  // =========================================================================
  describe('Queue Metadata Round-Tripping & Descriptor Preservation', () => {
    it('preserves providerId, providerTrackId, and capability across conversion cycles', () => {
      const originalTrack: UnifiedTrack = {
        id: 'audius:trk_abc_123',
        providerId: 'audius',
        providerTrackId: 'trk_abc_123',
        title: 'Cosmic Journey',
        artist: 'Starlight',
        album: 'Void Exploration',
        duration: 245,
        playbackCapability: 'full_stream',
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/trk_abc_123/stream',
        format: 'MP3',
        bitrate: 320,
        isOnline: true,
        license: 'Free Stream',
      };

      // 1. Convert to Harmoniq's internal TrackMetadata for queue
      const queueMetadata = unifiedTrackToTrackMetadata(originalTrack);
      expect(queueMetadata.id).toBe('audius:trk_abc_123');
      expect((queueMetadata as any).isOnline).toBe(true);
      expect((queueMetadata as any).providerId).toBe('audius');
      expect((queueMetadata as any).providerTrackId).toBe('trk_abc_123');
      expect((queueMetadata as any).playbackCapability).toBe('full_stream');

      // 2. Round-trip back to UnifiedTrack for on-demand resolution
      const roundTripped = trackMetadataToUnifiedTrack(queueMetadata);
      expect(roundTripped.id).toBe(originalTrack.id);
      expect(roundTripped.providerId).toBe('audius');
      expect(roundTripped.providerTrackId).toBe('trk_abc_123');
      expect(roundTripped.playbackCapability).toBe('full_stream');
      expect(roundTripped.isOnline).toBe(true);
    });

    it('differentiates 30s preview capability from full stream in queue metadata', () => {
      const applePreview: UnifiedTrack = {
        id: 'apple:54321',
        providerId: 'apple',
        providerTrackId: '54321',
        title: 'Midnight City',
        artist: 'M83',
        duration: 30,
        playbackCapability: 'preview_stream',
        streamUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
        format: 'AAC',
        bitrate: 256,
        isOnline: true,
      };

      const meta = unifiedTrackToTrackMetadata(applePreview);
      expect((meta as any).playbackCapability).toBe('preview_stream');
      expect(meta.duration).toBe(30);

      const ut = trackMetadataToUnifiedTrack(meta);
      expect(ut.playbackCapability).toBe('preview_stream');
    });
  });

  // =========================================================================
  // 5. SECURITY & AUDIO ENGINE STREAM URL RESTRICTIONS
  // =========================================================================
  describe('Security & Media URL Validation', () => {
    it('accepts valid HTTP and HTTPS remote stream URLs in buildMediaUrl', () => {
      const httpsUrl = 'https://audio-ssl.itunes.apple.com/preview.m4a';
      const httpUrl = 'http://archive.org/download/item/file.mp3';

      expect(buildMediaUrl(httpsUrl)).toBe(httpsUrl);
      expect(buildMediaUrl(httpUrl)).toBe(httpUrl);
    });

    it('rejects forbidden or dangerous URI schemes (javascript, file, blob, data, ftp)', () => {
      expect(() => buildMediaUrl('javascript:alert(1)')).toThrow();
      expect(() => buildMediaUrl('data:text/html;base64,PHNjcmlwdD4=')).toThrow();
      expect(() => buildMediaUrl('file:///etc/passwd')).toThrow();
      expect(() => buildMediaUrl('ftp://example.com/audio.mp3')).toThrow();
    });
  });

  // =========================================================================
  // 6. ERROR ISOLATION & MULTI-PROVIDER AGGREGATION
  // =========================================================================
  describe('Error Isolation & Search Aggregation', () => {
    it('preserves results from healthy providers when another provider fails', async () => {
      const service = new UniversalMusicService();
      service.clearProviders();

      // Working provider
      const workingProvider = new AudiusProvider();
      vi.spyOn(workingProvider, 'search').mockResolvedValueOnce({
        providerId: 'audius',
        success: true,
        tracks: [
          {
            id: 'audius:track_ok',
            providerId: 'audius',
            providerTrackId: 'track_ok',
            title: 'Working Track',
            artist: 'Good Artist',
            duration: 180,
            playbackCapability: 'full_stream',
            isOnline: true,
          },
        ],
        durationMs: 50,
      });

      // Failing provider
      const failingProvider = new JamendoProvider();
      vi.spyOn(failingProvider, 'search').mockRejectedValueOnce(
        new Error('Jamendo quota limit exceeded')
      );

      service.registerProvider(workingProvider);
      service.registerProvider(failingProvider);

      const resp = await service.searchUniversal('test query');

      expect(resp.results.length).toBe(1);
      expect(resp.results[0].title).toBe('Working Track');
      expect(resp.providerResponses['jamendo']?.success).toBe(false);
      expect(resp.providerResponses['jamendo']?.errorMessage).toContain(
        'Jamendo quota limit exceeded'
      );
      expect(resp.providerResponses['audius']?.success).toBe(true);
    });
  });
});
