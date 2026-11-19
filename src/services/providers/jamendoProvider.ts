import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
} from '../../types/universalMusic';

export class JamendoProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'jamendo';
  readonly name: string = 'Jamendo Music';
  readonly defaultCapability: PlaybackCapability = 'full_stream';

  private clientId = 'b6747d04'; // Official public API client ID for open exploration

  public setClientId(key: string): void {
    if (key && key.trim()) {
      this.clientId = key.trim();
    }
  }

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.id || raw.track_id;
    if (!rawId) return null;

    const title = String(raw.name || raw.title || 'Untitled Track').trim();
    const artist = String(raw.artist_name || raw.artist || 'Unknown Artist').trim();

    const streamUrl = raw.audio || raw.audiodl || undefined;
    const artworkUrl = raw.image || raw.album_image || undefined;
    const duration = this.parseDuration(raw.duration);

    return {
      id: `jamendo:${rawId}`,
      providerId: 'jamendo',
      providerTrackId: String(rawId),
      title,
      artist,
      album: raw.album_name || undefined,
      duration,
      artworkUrl,
      genre: raw.musicinfo?.tags?.genres?.[0] || undefined,
      releaseYear: raw.releasedate ? parseInt(raw.releasedate.slice(0, 4), 10) : undefined,
      playbackCapability: 'full_stream',
      streamUrl,
      format: 'MP3',
      bitrate: 128,
      license: raw.license_ccurl || 'Creative Commons',
      attributionText: `${artist} via Jamendo (Creative Commons)`,
      providerWebUrl: raw.shareurl || `https://www.jamendo.com/track/${rawId}`,
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
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${this.clientId}&format=jsonpretty&limit=${limit}&namesearch=${encodeURIComponent(
        cleanQ
      )}&include=musicinfo`;

      const res = await fetch(url, { signal: options?.signal });
      if (!res.ok) {
        throw new Error(`Jamendo API HTTP ${res.status}`);
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
