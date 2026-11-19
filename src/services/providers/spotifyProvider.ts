import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  ProviderCapabilityAudit,
} from '../../types/universalMusic';

export class SpotifyProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'spotify';
  readonly name: string = 'Spotify';
  readonly defaultCapability: PlaybackCapability = 'external_link';

  private clientId: string = '';
  private clientSecret: string = '';
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private tokenPromise: Promise<string> | null = null;

  constructor(clientId = '', clientSecret = '') {
    super();
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
  }

  public setCredentials(clientId: string, clientSecret: string): void {
    this.clientId = (clientId || '').trim();
    this.clientSecret = (clientSecret || '').trim();
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenPromise = null;
  }

  public getCredentials(): { clientId: string; hasSecret: boolean } {
    return {
      clientId: this.clientId,
      hasSecret: Boolean(this.clientSecret),
    };
  }

  public getCapabilityAudit(): ProviderCapabilityAudit {
    return {
      providerId: this.id,
      name: this.name,
      searchAvailable: true,
      metadataAvailable: true,
      playbackCapability: this.defaultCapability,
      requiresAuth: true,
      developerRegistration: 'Spotify Developer Dashboard (developer.spotify.com)',
      officialDestinationUrl: 'https://open.spotify.com',
      providerAttribution: 'Spotify Web API',
      geographicAvailability: 'Global (180+ markets including India, US, UK, EU)',
      rateLimits: 'Rolling application rate limits per Developer Dashboard tier',
      commercialRestrictions:
        'Personal and non-commercial exploration. Stream ripping, audio extraction, or bypassing Spotify Premium is strictly prohibited.',
      desktopCompatibility:
        'Metadata, popularity rankings, and direct Spotify destination links. Web Playback SDK requires Widevine CDM and user OAuth Premium authentication.',
    };
  }

  public async getAccessToken(signal?: AbortSignal): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Spotify Client ID and Client Secret not configured. Add your developer credentials in Settings to search Spotify.'
      );
    }

    this.tokenPromise = (async () => {
      try {
        const basicAuth =
          typeof btoa !== 'undefined'
            ? btoa(`${this.clientId}:${this.clientSecret}`)
            : Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const res = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
          signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            `Spotify Authentication failed (HTTP ${res.status}): ${
              errBody.error_description || errBody.error || 'Invalid credentials'
            }`
          );
        }

        const data = await res.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        return this.accessToken!;
      } finally {
        this.tokenPromise = null;
      }
    })();

    return this.tokenPromise;
  }

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.id;
    if (!rawId) return null;

    const title = String(raw.name || 'Untitled Track').trim();
    const artist = Array.isArray(raw.artists)
      ? raw.artists.map((a: any) => a.name).filter(Boolean).join(', ')
      : 'Unknown Artist';
    const album = raw.album?.name || undefined;
    const duration = raw.duration_ms ? Math.round(raw.duration_ms / 1000) : 0;
    const artworkUrl = raw.album?.images?.[0]?.url || raw.album?.images?.[1]?.url || undefined;
    const releaseYear = raw.album?.release_date
      ? parseInt(raw.album.release_date.slice(0, 4), 10)
      : undefined;

    const previewUrl = raw.preview_url || undefined;
    const capability: PlaybackCapability = previewUrl ? 'preview_stream' : 'external_link';
    const webUrl = raw.external_urls?.spotify || `https://open.spotify.com/track/${rawId}`;

    return {
      id: `spotify:${rawId}`,
      providerId: 'spotify',
      providerTrackId: String(rawId),
      title,
      artist,
      album,
      duration,
      artworkUrl,
      releaseYear: isNaN(releaseYear!) ? undefined : releaseYear,
      playbackCapability: capability,
      streamUrl: previewUrl,
      format: previewUrl ? 'MP3' : undefined,
      bitrate: previewUrl ? 160 : undefined,
      popularity: typeof raw.popularity === 'number' ? raw.popularity : undefined,
      isrc: raw.external_ids?.isrc || undefined,
      license: 'Official Spotify Catalog',
      attributionText: `${artist} on Spotify`,
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

    if (!this.clientId || !this.clientSecret) {
      return {
        providerId: this.id,
        success: false,
        tracks: [],
        errorMessage:
          'Spotify Client ID and Secret not configured. Add credentials in Settings to search Spotify.',
        durationMs: 0,
      };
    }

    try {
      const token = await this.getAccessToken(options?.signal);
      const limit = Math.min(50, Math.max(1, options?.limit || 20));

      let typeParam = 'track';
      if (options?.filter === 'album') typeParam = 'album';
      else if (options?.filter === 'artist') typeParam = 'artist';

      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        cleanQ
      )}&type=${typeParam}&limit=${limit}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: options?.signal,
      });

      if (!res.ok) {
        throw new Error(`Spotify Search API HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawTracks = data?.tracks?.items || [];

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
