import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
} from '../../types/universalMusic';

export class AudiusProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'audius';
  readonly name: string = 'Audius';
  readonly defaultCapability: PlaybackCapability = 'full_stream';

  private appName = 'HarmoniqAudioPlayer';
  private discoveryHost = 'https://discoveryprovider.audius.co';

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.id;
    if (!rawId) return null;

    const title = String(raw.title || 'Untitled Track').trim();
    const artist = String(raw.user?.name || raw.user?.handle || 'Unknown Artist').trim();
    const duration = this.parseDuration(raw.duration);

    const artworkUrl =
      raw.artwork?.['480x480'] ||
      raw.artwork?.['150x150'] ||
      raw.artwork?.['1000x1000'] ||
      undefined;

    const streamUrl = `${this.discoveryHost}/v1/tracks/${rawId}/stream?app_name=${this.appName}`;
    const webUrl = raw.permalink ? `https://audius.co${raw.permalink}` : `https://audius.co/tracks/${rawId}`;

    return {
      id: `audius:${rawId}`,
      providerId: 'audius',
      providerTrackId: String(rawId),
      title,
      artist,
      album: undefined,
      duration,
      artworkUrl,
      genre: raw.genre || undefined,
      releaseYear: raw.release_date ? parseInt(raw.release_date.slice(0, 4), 10) : undefined,
      playbackCapability: 'full_stream',
      streamUrl,
      format: 'MP3',
      bitrate: 320,
      license: 'Free Creator Streaming via Audius',
      attributionText: `${artist} on Audius`,
      providerWebUrl: webUrl,
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
      const limit = Math.min(50, Math.max(1, options?.limit || 20));
      const url = `${this.discoveryHost}/v1/tracks/search?query=${encodeURIComponent(
        cleanQ
      )}&app_name=${this.appName}&limit=${limit}`;

      const res = await fetch(url, { signal: options?.signal });
      if (!res.ok) {
        throw new Error(`Audius API HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawTracks = data?.data || [];

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
