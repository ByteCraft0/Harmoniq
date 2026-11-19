import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
} from '../../types/universalMusic';

export class ArchiveProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'archive';
  readonly name: string = 'Internet Archive';
  readonly defaultCapability: PlaybackCapability = 'full_stream';

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object') return null;
    const rawId = raw.identifier || raw.id;
    if (!rawId) return null;

    const title = Array.isArray(raw.title)
      ? raw.title[0]
      : (raw.title || 'Untitled Archive Audio').trim();
    const artist = Array.isArray(raw.creator)
      ? raw.creator[0]
      : (raw.creator || raw.artist || 'Unknown Creator').trim();
    const album = Array.isArray(raw.album) ? raw.album[0] : raw.album;
    const yr = raw.year ? parseInt(raw.year, 10) : undefined;

    return {
      id: `archive:${rawId}`,
      providerId: 'archive',
      providerTrackId: String(rawId),
      title,
      artist,
      album: album || undefined,
      duration: this.parseDuration(raw.duration),
      artworkUrl: `https://archive.org/services/img/${rawId}`,
      releaseYear: isNaN(yr!) ? undefined : yr,
      playbackCapability: 'full_stream',
      streamUrl: `https://archive.org/download/${rawId}/${rawId}_vbr.mp3`,
      format: 'MP3',
      license: 'Public Domain / Creative Commons',
      attributionText: `${artist} via Internet Archive`,
      providerWebUrl: `https://archive.org/details/${rawId}`,
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
      let fieldQuery = `(title:("${cleanQ}") OR creator:("${cleanQ}") OR description:("${cleanQ}"))`;
      if (options?.filter === 'song') fieldQuery = `title:("${cleanQ}")`;
      else if (options?.filter === 'artist') fieldQuery = `creator:("${cleanQ}")`;
      else if (options?.filter === 'album') fieldQuery = `(album:("${cleanQ}") OR title:("${cleanQ}"))`;

      const url = `https://archive.org/advancedsearch.php?q=mediatype:audio%20AND%20${encodeURIComponent(
        fieldQuery
      )}&fl[]=identifier,title,creator,album,year,description,downloads&sort[]=downloads%20desc&rows=${limit}&output=json`;

      const res = await fetch(url, { signal: options?.signal });
      if (!res.ok) {
        throw new Error(`Internet Archive API HTTP ${res.status}`);
      }

      const data = await res.json();
      const docs = data?.response?.docs || [];

      const tracks: UnifiedTrack[] = [];
      for (const item of docs) {
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
