import { LyricLine, LyricsData } from '../types/lyrics';
import { TrackMetadata } from '../types/audio';

export class LyricsService {
  private static cache: Map<string, LyricsData> = new Map();
  private static readonly STORAGE_CACHE_KEY = 'harmoniq_lyrics_cache_v1';
  private static isCacheHydrated = false;

  private static getCompositeKey(track: TrackMetadata): string {
    const artist = (track.artist || '').trim().toLowerCase();
    const title = (track.title || '').trim().toLowerCase();
    return `${artist}:::${title}`;
  }

  public static cleanTrackTitle(title: string): string {
    return title
      .replace(/\s*\([^)]*(?:feat|ft\.|remaster|version|edition|live|explicit|deluxe|radio edit)[^)]*\)/gi, '')
      .replace(/\s*\[[^\]]*(?:feat|ft\.|remaster|version|edition|live|explicit|deluxe|official)[^\]]*\]/gi, '')
      .replace(/\s*-\s*(?:remastered|live|deluxe edition|single version|radio edit).*/gi, '')
      .trim();
  }

  private static hydrateCache(): void {
    if (this.isCacheHydrated) return;
    this.isCacheHydrated = true;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.STORAGE_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [key, data] of Object.entries(parsed)) {
              if (data && typeof data === 'object') {
                this.cache.set(key, data as LyricsData);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate lyrics cache:', e);
    }
  }

  private static persistCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, LyricsData> = {};
        let count = 0;
        for (const [key, data] of this.cache.entries()) {
          if (data && (data.synced || data.plainText)) {
            obj[key] = data;
            count++;
            if (count >= 300) break;
          }
        }
        localStorage.setItem(this.STORAGE_CACHE_KEY, JSON.stringify(obj));
      }
    } catch (e) {
      console.warn('Failed to persist lyrics cache:', e);
    }
  }

  public static clearCacheForTrack(track: TrackMetadata): void {
    if (!track) return;
    this.cache.delete(track.id);
    this.cache.delete(this.getCompositeKey(track));
    this.persistCache();
  }

  public static clearAllCache(): void {
    this.cache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.STORAGE_CACHE_KEY);
      }
    } catch (e) {}
  }

  /**
   * Parse LRC text content into millisecond-accurate synchronized LyricLine objects
   */
  public static parseLrc(content: string, source: 'embedded' | 'lrc_file' | 'online'): LyricsData {
    if (!content || !content.trim()) {
      return { synced: false, lines: [], source: 'none', offset: 0 };
    }

    const rawLines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    const lines: LyricLine[] = [];
    let fileOffsetSec = 0;

    // Standard LRC tag regex: [mm:ss.xx] or [mm:ss.xxx]
    const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;

    for (const rawLine of rawLines) {
      // Check for global offset tag: [offset:+500] in ms
      const offsetMatch = offsetRegex.exec(rawLine);
      if (offsetMatch) {
        fileOffsetSec = parseInt(offsetMatch[1], 10) / 1000;
        continue;
      }

      // Check if line has timestamp tags
      timestampRegex.lastIndex = 0;
      const matches = [...rawLine.matchAll(timestampRegex)];

      if (matches.length > 0) {
        // Strip timestamps to get clean lyric text
        const text = rawLine.replace(timestampRegex, '').trim();

        // One line may have multiple timestamps (e.g. [00:12.00][00:24.00] Chorus line)
        for (const match of matches) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const fraction = match[3]
            ? parseInt(match[3], 10) / Math.pow(10, match[3].length)
            : 0;
          const time = minutes * 60 + seconds + fraction + fileOffsetSec;

          lines.push({ time: Math.max(0, time), text });
        }
      }
    }

    // Sort chronologically
    lines.sort((a, b) => a.time - b.time);

    // If no timestamp tags were found, treat as plain text lyrics
    if (lines.length === 0) {
      return {
        synced: false,
        lines: [],
        plainText: content.trim(),
        source,
        offset: 0,
      };
    }

    return {
      synced: true,
      lines,
      plainText: content,
      source,
      offset: 0,
    };
  }

  /**
   * Find the active lyric line index for current playback time (seconds)
   */
  public static findActiveLineIndex(lines: LyricLine[], currentTime: number, offset = 0): number {
    if (!lines || lines.length === 0) return -1;
    const effectiveTime = currentTime + offset;

    // Binary search or linear scan for current line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (effectiveTime >= lines[i].time) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Load lyrics for track:
   * 1. Checks companion .lrc file via native IPC
   * 2. Checks embedded metadata tags
   * 3. Falls back to online provider (LRCLIB) if network is available
   */
  public static async loadLyricsForTrack(track: TrackMetadata, forceRefresh = false): Promise<LyricsData> {
    if (!track || !track.id) {
      return { synced: false, lines: [], source: 'none', offset: 0 };
    }

    this.hydrateCache();
    const compositeKey = this.getCompositeKey(track);

    if (!forceRefresh) {
      const cached = this.cache.get(track.id) || this.cache.get(compositeKey);
      if (cached && (cached.synced || cached.plainText)) {
        return cached;
      }
    }

    // 1. Try companion .lrc file in folder
    if (window.harmoniqApi?.readLrcFile && track.filePath) {
      try {
        const lrcResult: any = await window.harmoniqApi.readLrcFile(track.filePath);
        const content = typeof lrcResult === 'string' ? lrcResult : (lrcResult?.content || lrcResult?.plainText || '');
        if (content && content.trim()) {
          const parsed = this.parseLrc(content, 'lrc_file');
          this.cache.set(track.id, parsed);
          this.cache.set(compositeKey, parsed);
          this.persistCache();
          return parsed;
        }
      } catch (err) {
        console.warn('Error reading companion LRC file:', err);
      }
    }

    // 2. Try embedded lyrics in track metadata
    if (track.embeddedLyrics && track.embeddedLyrics.trim()) {
      const parsed = this.parseLrc(track.embeddedLyrics, 'embedded');
      this.cache.set(track.id, parsed);
      this.cache.set(compositeKey, parsed);
      this.persistCache();
      return parsed;
    }

    // 3. Online fallback (LRCLIB open API)
    if (track.title && track.artist) {
      const cleanedTitle = this.cleanTrackTitle(track.title);

      const queryLrclib = async (url: string): Promise<any | null> => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Harmoniq-Audio-Player/1.0.0' },
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          // Timeout or offline
        }
        return null;
      };

      // Stage A: Exact /api/get with track_name, artist_name, album_name, duration
      const paramsA = new URLSearchParams({
        track_name: track.title,
        artist_name: track.artist,
      });
      if (track.album) paramsA.append('album_name', track.album);
      if (track.duration) paramsA.append('duration', Math.round(track.duration).toString());

      let data = await queryLrclib(`https://lrclib.net/api/get?${paramsA.toString()}`);

      // Stage B: If not found, try cleaned title
      if (!data && cleanedTitle && cleanedTitle !== track.title) {
        const paramsB = new URLSearchParams({
          track_name: cleanedTitle,
          artist_name: track.artist,
        });
        if (track.duration) paramsB.append('duration', Math.round(track.duration).toString());
        data = await queryLrclib(`https://lrclib.net/api/get?${paramsB.toString()}`);
      }

      // Stage C: If still not found, try /api/search
      if (!data) {
        const searchQ = `${cleanedTitle || track.title} ${track.artist}`.trim();
        const searchRes = await queryLrclib(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQ)}`);
        if (Array.isArray(searchRes) && searchRes.length > 0) {
          data = searchRes.find((item: any) => item.syncedLyrics && item.syncedLyrics.trim()) || searchRes[0];
        }
      }

      if (data) {
        if (data.syncedLyrics && data.syncedLyrics.trim()) {
          const parsed = this.parseLrc(data.syncedLyrics, 'online');
          this.cache.set(track.id, parsed);
          this.cache.set(compositeKey, parsed);
          this.persistCache();
          return parsed;
        } else if (data.plainLyrics && data.plainLyrics.trim()) {
          const parsed = this.parseLrc(data.plainLyrics, 'online');
          this.cache.set(track.id, parsed);
          this.cache.set(compositeKey, parsed);
          this.persistCache();
          return parsed;
        }
      }
    }

    const emptyResult: LyricsData = {
      synced: false,
      lines: [],
      source: 'none',
      offset: 0,
    };
    this.cache.set(track.id, emptyResult);
    return emptyResult;
  }
}
