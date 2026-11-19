import { OnlineSearchResult } from '../types/online';
import { libraryService } from './libraryService';
import { TrackMetadata } from '../types/audio';

const SEARCH_CACHE = new Map<string, { timestamp: number; results: OnlineSearchResult[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class OnlineMusicService {
  private activeAbortController: AbortController | null = null;

  /**
   * Search open legitimate catalogs (Electron main-process IPC with iTunes & Archive.org)
   */
  public async searchOnline(
    query: string,
    filter: 'all' | 'song' | 'artist' | 'album' = 'all',
    signal?: AbortSignal
  ): Promise<OnlineSearchResult[]> {
    const cleanQ = query.trim();
    if (!cleanQ) return [];

    const cacheKey = `${filter}:${cleanQ.toLowerCase()}`;
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    // 1. Prefer Electron main-process IPC (full SSRF protection, CORS bypass, parallel providers)
    if (typeof window !== 'undefined' && window.harmoniqApi?.searchOnlineMusic) {
      try {
        const rawResults = await window.harmoniqApi.searchOnlineMusic(cleanQ, filter);
        const results: OnlineSearchResult[] = (rawResults || []).map((r: any) => ({
          id: r.id || `res_${Math.random().toString(36).substring(2)}`,
          title: r.title || 'Untitled Track',
          artist: r.artist || 'Unknown Artist',
          album: r.album || undefined,
          year: r.year,
          duration: r.duration,
          source: r.source || 'Open Catalog',
          streamUrl: r.streamUrl,
          detailUrl: r.detailUrl,
          artworkUrl: r.artworkUrl,
          license: r.license || 'Public Catalog',
          format: r.format || 'MP3',
        }));

        SEARCH_CACHE.set(cacheKey, { timestamp: Date.now(), results });
        return results;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.warn('IPC searchOnlineMusic error, falling back to direct fetch:', err);
      }
    }

    // 2. Direct fetch fallback for non-Electron / browser / test environments
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanQ
      )}&entity=${filter === 'album' ? 'album' : 'song'}&limit=25`;

      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Catalog search returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const results: OnlineSearchResult[] = (data.results || []).map((item: any) => ({
        id: `it_${item.trackId || item.collectionId}`,
        title: item.trackName || item.collectionName || 'Untitled Track',
        artist: item.artistName || 'Unknown Artist',
        album: item.collectionName || undefined,
        year: item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : undefined,
        duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : undefined,
        source: 'Open Music Catalog',
        streamUrl: item.previewUrl,
        detailUrl: item.trackViewUrl || item.collectionViewUrl,
        artworkUrl: item.artworkUrl100
          ? item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
          : undefined,
        license: 'Official 30s Audio Preview',
        format: 'AAC',
      }));

      SEARCH_CACHE.set(cacheKey, { timestamp: Date.now(), results });
      return results;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      console.warn('Direct catalog search error:', e);
      return [];
    }
  }

  /**
   * Search local library tracks matching the query
   */
  public searchLocal(query: string): TrackMetadata[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return libraryService.getAllTracks().filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );
  }
}

export const onlineMusicService = new OnlineMusicService();
