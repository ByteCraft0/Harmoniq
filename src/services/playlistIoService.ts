import { TrackMetadata } from '../types/audio';
import { libraryService } from './libraryService';

export interface ParsedM3uResult {
  playlistName?: string;
  matchedTracks: TrackMetadata[];
  missingEntries: {
    rawPath: string;
    title?: string;
    artist?: string;
    duration?: number;
  }[];
  duplicateCount: number;
}

export class PlaylistIoService {
  /**
   * Parse M3U / M3U8 string content and resolve against library tracks
   */
  public parseM3u(
    content: string,
    options?: {
      libraryTracks?: TrackMetadata[];
      allowDuplicates?: boolean;
    }
  ): ParsedM3uResult {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    const library = options?.libraryTracks || libraryService.getAllTracks();
    const allowDuplicates = options?.allowDuplicates ?? false;

    // Fast lookup indices
    const byPath = new Map<string, TrackMetadata>();
    const byFileName = new Map<string, TrackMetadata[]>();
    const byTitleArtist = new Map<string, TrackMetadata>();

    for (const t of library) {
      const p = this.normalizePath(t.filePath);
      byPath.set(p, t);

      const fName = (t.fileName || p.split('/').pop() || '').toLowerCase();
      const list = byFileName.get(fName) || [];
      list.push(t);
      byFileName.set(fName, list);

      const taKey = `${(t.title || '').trim().toLowerCase()}:::${(t.artist || '').trim().toLowerCase()}`;
      byTitleArtist.set(taKey, t);
    }

    const matchedTracks: TrackMetadata[] = [];
    const missingEntries: ParsedM3uResult['missingEntries'] = [];
    const seenTrackIds = new Set<string>();
    let duplicateCount = 0;
    let playlistName: string | undefined;

    let pendingInf: { duration?: number; title?: string; artist?: string } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for playlist name header #PLAYLIST: Name
      if (trimmed.startsWith('#PLAYLIST:')) {
        playlistName = trimmed.replace('#PLAYLIST:', '').trim();
        continue;
      }

      // Check for #EXTINF:duration,Artist - Title
      if (trimmed.startsWith('#EXTINF:')) {
        const infContent = trimmed.replace('#EXTINF:', '').trim();
        const commaIdx = infContent.indexOf(',');
        let dur = 0;
        let titleArtist = infContent;

        if (commaIdx !== -1) {
          dur = parseInt(infContent.substring(0, commaIdx), 10) || 0;
          titleArtist = infContent.substring(commaIdx + 1).trim();
        }

        const dashIdx = titleArtist.indexOf(' - ');
        let artist = '';
        let title = titleArtist;
        if (dashIdx !== -1) {
          artist = titleArtist.substring(0, dashIdx).trim();
          title = titleArtist.substring(dashIdx + 3).trim();
        }

        pendingInf = { duration: dur > 0 ? dur : undefined, artist, title };
        continue;
      }

      if (trimmed.startsWith('#')) {
        // Other directive, skip
        continue;
      }

      // It's a file path
      const rawPath = trimmed.replace(/^file:\/{2,3}/i, '');
      const norm = this.normalizePath(rawPath);

      // 1. Check exact path
      let hit = byPath.get(norm);

      // 2. Check path ending or relative path
      if (!hit) {
        const cleanTail = norm.replace(/^(\.{1,2}\/)+/, '');
        const fName = (cleanTail.split('/').pop() || '').toLowerCase();
        const candidates = byFileName.get(fName) || [];
        hit =
          candidates.find((c) => this.normalizePath(c.filePath).endsWith('/' + cleanTail)) ||
          (candidates.length === 1 ? candidates[0] : undefined);
      }

      // 3. Fallback to Artist - Title match from pending #EXTINF
      if (!hit && pendingInf?.title && pendingInf.artist) {
        const taKey = `${pendingInf.title.toLowerCase()}:::${pendingInf.artist.toLowerCase()}`;
        hit = byTitleArtist.get(taKey);
      }

      if (hit) {
        if (seenTrackIds.has(hit.id)) {
          duplicateCount++;
          if (allowDuplicates) {
            matchedTracks.push(hit);
          }
        } else {
          seenTrackIds.add(hit.id);
          matchedTracks.push(hit);
        }
      } else {
        missingEntries.push({
          rawPath,
          title: pendingInf?.title,
          artist: pendingInf?.artist,
          duration: pendingInf?.duration,
        });
      }

      pendingInf = null;
    }

    return {
      playlistName,
      matchedTracks,
      missingEntries,
      duplicateCount,
    };
  }

  /**
   * Generate standard M3U / M3U8 string with EXTINF tags
   */
  public generateM3u(
    tracks: TrackMetadata[],
    options?: {
      playlistName?: string;
      useRelativePaths?: boolean;
      baseDirectory?: string;
    }
  ): string {
    const lines: string[] = ['#EXTM3U'];

    if (options?.playlistName) {
      lines.push(`#PLAYLIST:${options.playlistName}`);
    }

    for (const t of tracks) {
      const dur = Math.round(t.duration || 0);
      const artist = t.artist || 'Unknown Artist';
      const title = t.title || t.fileName || 'Untitled';
      lines.push(`#EXTINF:${dur},${artist} - ${title}`);

      let pathStr = t.filePath;
      if (options?.useRelativePaths && options.baseDirectory) {
        pathStr = this.makeRelativePath(t.filePath, options.baseDirectory);
      }
      lines.push(pathStr);
    }

    return lines.join('\n');
  }

  /**
   * Helper to normalize file paths
   */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
  }

  private makeRelativePath(targetPath: string, basePath: string): string {
    const normTarget = targetPath.replace(/\\/g, '/');
    const normBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '') + '/';

    if (normTarget.toLowerCase().startsWith(normBase.toLowerCase())) {
      return normTarget.substring(normBase.length);
    }
    return targetPath;
  }
}

export const playlistIoService = new PlaylistIoService();
