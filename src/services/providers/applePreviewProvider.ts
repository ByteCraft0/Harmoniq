import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  ProviderCapabilityAudit,
} from '../../types/universalMusic';

export class ApplePreviewProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'apple';
  readonly name: string = 'Apple Music Catalog';
  readonly defaultCapability: PlaybackCapability = 'preview_stream';

  getCapabilityAudit(): ProviderCapabilityAudit {
    return {
      providerId: this.id,
      name: this.name,
      searchAvailable: true,
      metadataAvailable: true,
      playbackCapability: this.defaultCapability,
      requiresAuth: false,
      developerRegistration:
        'Unauthenticated open iTunes Catalog API (No developer key required for search & 30s previews)',
      officialDestinationUrl: 'https://music.apple.com',
      providerAttribution: 'Apple Music / iTunes Search API',
      geographicAvailability:
        'Global (Comprehensive Bollywood, Punjabi, Regional Indian & International catalogs)',
      rateLimits: 'Approximately 20 requests per minute per IP',
      commercialRestrictions:
        '30-second promotional audio previews for discovery. Full track playback requires MusicKit with user Apple Music subscription.',
      desktopCompatibility:
        'Direct HTML5 Audio & Web Audio DSP streaming (CORS: * enabled, HTTP 206 supported)',
    };
  }

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.trackId || raw.collectionId;
    if (!rawId) return null;

    const title = String(raw.trackName || raw.collectionName || 'Untitled Track').trim();
    const artist = String(raw.artistName || 'Unknown Artist').trim();
    const album = raw.collectionName || undefined;

    const artworkUrl = raw.artworkUrl100
      ? raw.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
      : undefined;

    const duration = raw.trackTimeMillis
      ? Math.round(raw.trackTimeMillis / 1000)
      : this.parseDuration(raw.duration);

    const yr = raw.releaseDate ? parseInt(raw.releaseDate.substring(0, 4), 10) : undefined;

    return {
      id: `apple:${rawId}`,
      providerId: 'apple',
      providerTrackId: String(rawId),
      title,
      artist,
      album,
      duration,
      artworkUrl,
      genre: raw.primaryGenreName || undefined,
      releaseYear: isNaN(yr!) ? undefined : yr,
      playbackCapability: 'preview_stream',
      streamUrl: raw.previewUrl || undefined,
      format: 'AAC',
      bitrate: 256,
      license: 'Official 30-Second Audio Preview',
      attributionText: `${artist} (Official 30s Preview via Apple Music)`,
      providerWebUrl: raw.trackViewUrl || raw.collectionViewUrl,
      isOnline: true,
    };
  }

  async search(query: string, options?: ProviderSearchOptions): Promise<ProviderSearchResponse> {
    const startTime = Date.now();
    const cleanQ = query.trim();
    if (!cleanQ) {
      return {
        providerId: this.id,
        success: true,
        tracks: [],
        durationMs: 0,
      };
    }

    try {
      const limit = Math.min(50, Math.max(1, options?.limit || 25));
      const entity = options?.filter === 'album' ? 'album' : 'song';
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanQ
      )}&entity=${entity}&limit=${limit}`;

      const res = await fetch(url, { signal: options?.signal });
      if (!res.ok) {
        throw new Error(`iTunes Search API HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawTracks = data?.results || [];

      const tracks: UnifiedTrack[] = [];
      for (const item of rawTracks) {
        const normalized = this.normalize(item);
        if (normalized) {
          tracks.push(normalized);
        }
      }

      return {
        providerId: this.id,
        success: true,
        tracks,
        totalFound: tracks.length,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return this.createErrorResponse(err, Date.now() - startTime);
    }
  }
}
