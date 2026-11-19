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

  /**
   * Resolves the actual audio file name and direct stream URL from the item's metadata files manifest.
   * Avoids fragile {id}_vbr.mp3 assumptions and selects the highest quality audio format.
   */
  async resolveAudioFile(
    identifier: string,
    signal?: AbortSignal
  ): Promise<{ streamUrl: string; format?: string; duration?: number }> {
    const cleanId = identifier.trim();
    if (!cleanId) throw new Error('Invalid Archive identifier');

    try {
      const filesUrl = `https://archive.org/metadata/${encodeURIComponent(cleanId)}/files`;
      const res = await fetch(filesUrl, { signal });
      if (!res.ok) throw new Error(`Archive manifest HTTP ${res.status}`);
      const data = await res.json();
      const files: any[] = Array.isArray(data?.result) ? data.result : [];

      const audioFiles = files.filter((f) => {
        if (!f || !f.name) return false;
        const name = String(f.name).toLowerCase();
        const format = String(f.format || '').toLowerCase();
        if (
          name.endsWith('.xml') ||
          name.endsWith('.txt') ||
          name.endsWith('.png') ||
          name.endsWith('.jpg') ||
          name.endsWith('.afpk') ||
          name.endsWith('.sqlite') ||
          name.endsWith('.torrent') ||
          name.endsWith('.cue')
        ) {
          return false;
        }
        return (
          format.includes('mp3') ||
          format.includes('vbr') ||
          format.includes('ogg') ||
          format.includes('flac') ||
          format.includes('m4a') ||
          name.endsWith('.mp3') ||
          name.endsWith('.ogg') ||
          name.endsWith('.flac') ||
          name.endsWith('.m4a')
        );
      });

      if (audioFiles.length === 0) {
        return {
          streamUrl: `https://archive.org/download/${cleanId}/${cleanId}_vbr.mp3`,
          format: 'MP3',
        };
      }

      audioFiles.sort((a, b) => {
        const aFmt = String(a.format || '').toLowerCase();
        const bFmt = String(b.format || '').toLowerCase();
        const aVbr = aFmt.includes('vbr') ? 3 : aFmt.includes('mp3') ? 2 : 1;
        const bVbr = bFmt.includes('vbr') ? 3 : bFmt.includes('mp3') ? 2 : 1;
        return bVbr - aVbr;
      });

      const chosen = audioFiles[0];
      const dur = chosen.length ? Math.round(parseFloat(chosen.length)) : undefined;
      return {
        streamUrl: `https://archive.org/download/${cleanId}/${encodeURIComponent(chosen.name).replace(/%2F/g, '/')}`,
        format: chosen.format?.includes('MP3') ? 'MP3' : (chosen.format || 'MP3'),
        duration: dur,
      };
    } catch {
      return {
        streamUrl: `https://archive.org/download/${cleanId}/${cleanId}_vbr.mp3`,
        format: 'MP3',
      };
    }
  }

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
