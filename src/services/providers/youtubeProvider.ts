import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  ProviderCapabilityAudit,
} from '../../types/universalMusic';

/**
 * Parse ISO-8601 duration format (e.g. PT4M13S -> 253, PT1H2M30S -> 3750)
 */
export function parseIsoDuration(isoDuration?: string): number {
  if (!isoDuration || typeof isoDuration !== 'string') return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export class YouTubeProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'youtube';
  readonly name: string = 'YouTube';
  readonly defaultCapability: PlaybackCapability = 'external_link';

  private apiKey: string = '';

  constructor(apiKey = '') {
    super();
    this.apiKey = apiKey.trim();
  }

  public setApiKey(key: string): void {
    this.apiKey = (key || '').trim();
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public getCapabilityAudit(): ProviderCapabilityAudit {
    return {
      providerId: this.id,
      name: this.name,
      searchAvailable: true,
      metadataAvailable: true,
      playbackCapability: this.defaultCapability,
      requiresAuth: true,
      developerRegistration: 'Google Cloud Console (console.cloud.google.com)',
      officialDestinationUrl: 'https://www.youtube.com',
      providerAttribution: 'YouTube Data API v3',
      geographicAvailability: 'Global',
      rateLimits: '10,000 units/day default project quota (100 units per search query)',
      commercialRestrictions:
        'Audio extraction, stream ripping, or playing audio without video is strictly prohibited by YouTube Terms of Service Section II.10. Playback is available via official YouTube destination watch links.',
      desktopCompatibility:
        'Official YouTube destination watch link. Audio stream extraction is strictly prohibited and not supported.',
    };
  }

  /**
   * Parse ISO-8601 duration format (e.g. PT4M13S -> 253, PT1H2M30S -> 3750)
   */
  public parseIsoDuration(isoDuration?: string): number {
    return parseIsoDuration(isoDuration);
  }

  /**
   * Decode common HTML entities from YouTube titles
   */
  private cleanHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.id?.videoId || raw.id;
    if (!rawId || typeof rawId !== 'string') return null;

    const snippet = raw.snippet || {};
    const title = this.cleanHtmlEntities(String(snippet.title || 'Untitled Video')).trim();
    const artist = this.cleanHtmlEntities(String(snippet.channelTitle || 'Unknown Channel')).trim();

    const thumbnails = snippet.thumbnails || {};
    const artworkUrl =
      thumbnails.maxres?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url;

    const duration = raw.contentDetails?.duration
      ? parseIsoDuration(raw.contentDetails.duration)
      : this.parseDuration(raw.duration);

    const year = snippet.publishedAt ? parseInt(snippet.publishedAt.slice(0, 4), 10) : undefined;

    return {
      id: `youtube:${rawId}`,
      providerId: 'youtube',
      providerTrackId: String(rawId),
      title,
      artist,
      duration,
      artworkUrl,
      releaseYear: isNaN(year!) ? undefined : year,
      playbackCapability: 'external_link',
      providerWebUrl: `https://www.youtube.com/watch?v=${rawId}`,
      license: 'Official YouTube Video',
      attributionText: `${artist} on YouTube`,
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

    if (!this.apiKey) {
      return {
        providerId: this.id,
        success: false,
        tracks: [],
        errorMessage:
          'YouTube Data API key not configured. Add an API key in Settings to search YouTube Music and videos.',
        durationMs: 0,
      };
    }

    try {
      const limit = Math.min(25, Math.max(1, options?.limit || 15));
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        cleanQ
      )}&type=video&videoCategoryId=10&maxResults=${limit}&key=${this.apiKey}`;

      const res = await fetch(searchUrl, { signal: options?.signal });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          `YouTube API HTTP ${res.status}: ${errJson.error?.message || 'Search failed'}`
        );
      }

      const data = await res.json();
      const items = data?.items || [];
      const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean);

      // Fetch video duration details
      const durationMap: Record<string, string> = {};
      if (videoIds.length > 0) {
        try {
          const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(
            ','
          )}&key=${this.apiKey}`;
          const detailRes = await fetch(detailUrl, { signal: options?.signal });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            for (const item of detailData?.items || []) {
              if (item.id && item.contentDetails?.duration) {
                durationMap[item.id] = item.contentDetails.duration;
              }
            }
          }
        } catch {
          // Duration enrichment failure should not block search results
        }
      }

      const tracks: UnifiedTrack[] = [];
      for (const item of items) {
        const vid = item.id?.videoId;
        if (vid && durationMap[vid]) {
          item.contentDetails = { duration: durationMap[vid] };
        }
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
