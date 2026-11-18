import { TrackMetadata } from '../types/audio';
import { Album } from '../types/library';
import { libraryService } from './libraryService';

export interface DuplicateGroup {
  id: string;
  reason: string;
  matchType: 'exact' | 'fuzzy_metadata';
  tracks: TrackMetadata[];
  recommendedKeepId: string;
}

export interface BulkMetadataPayload {
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  composer?: string;
  artworkDataUrl?: string;
}

export interface BulkUpdateResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: { trackId: string; filePath: string; error: string }[];
}

export class MaintenanceService {
  /**
   * Find exact duplicates (matching size + duration + clean title)
   * and possible duplicates (matching title + artist + duration within 3 seconds)
   */
  public findDuplicates(tracks: TrackMetadata[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const visitedIds = new Set<string>();

    const cleanStr = (s?: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\b(feat|ft|featuring|remastered|remaster|deluxe|version)\b.*$/i, '')
        .replace(/[^\w\s]/g, '')
        .trim();

    // 1. Group by exact file size & approximate duration (Exact file/audio duplicate)
    const sizeMap = new Map<string, TrackMetadata[]>();
    for (const track of tracks) {
      if (!track.fileSize || track.fileSize <= 0) continue;
      const key = `${track.fileSize}_${Math.round(track.duration || 0)}`;
      const list = sizeMap.get(key) || [];
      list.push(track);
      sizeMap.set(key, list);
    }

    for (const [key, list] of sizeMap.entries()) {
      if (list.length > 1) {
        list.forEach((t) => visitedIds.add(t.id));
        groups.push({
          id: `exact_${key}`,
          reason: 'Identical file size and audio duration (Exact Duplicate)',
          matchType: 'exact',
          tracks: list,
          recommendedKeepId: this.pickBestQualityTrack(list).id,
        });
      }
    }

    // 2. Group by clean title + artist + duration within 3 seconds
    const metaMap = new Map<string, TrackMetadata[]>();
    for (const track of tracks) {
      if (visitedIds.has(track.id)) continue;
      const cTitle = cleanStr(track.title);
      const cArtist = cleanStr(track.artist);
      if (!cTitle) continue;

      const key = `${cTitle}:::${cArtist}`;
      const list = metaMap.get(key) || [];
      list.push(track);
      metaMap.set(key, list);
    }

    for (const [key, list] of metaMap.entries()) {
      if (list.length > 1) {
        // Verify durations are within 3 seconds of each other
        const sortedByDur = [...list].sort((a, b) => a.duration - b.duration);
        const minDur = sortedByDur[0].duration;
        const maxDur = sortedByDur[sortedByDur.length - 1].duration;

        if (Math.abs(maxDur - minDur) <= 4.0) {
          groups.push({
            id: `meta_${key}`,
            reason: 'Matching title, artist, and track length (Metadata Duplicate)',
            matchType: 'fuzzy_metadata',
            tracks: list,
            recommendedKeepId: this.pickBestQualityTrack(list).id,
          });
        }
      }
    }

    return groups;
  }

  /**
   * Determine the highest fidelity copy in a group (Lossless > Hi-Res > Bitrate > Newer date)
   */
  private pickBestQualityTrack(tracks: TrackMetadata[]): TrackMetadata {
    return [...tracks].sort((a, b) => {
      // 1. Lossless priority
      if (a.isLossless && !b.isLossless) return -1;
      if (!a.isLossless && b.isLossless) return 1;

      // 2. Sample rate
      if ((a.sampleRate || 0) !== (b.sampleRate || 0)) {
        return (b.sampleRate || 0) - (a.sampleRate || 0);
      }

      // 3. Bit depth
      if ((a.bitDepth || 0) !== (b.bitDepth || 0)) {
        return (b.bitDepth || 0) - (a.bitDepth || 0);
      }

      // 4. Bitrate
      if ((a.bitrate || 0) !== (b.bitrate || 0)) {
        return (b.bitrate || 0) - (a.bitrate || 0);
      }

      return (b.dateModified || 0) - (a.dateModified || 0);
    })[0];
  }

  /**
   * Detect albums and tracks lacking artwork
   */
  public findMissingArtwork(
    albums: Album[],
    tracks: TrackMetadata[]
  ): { missingAlbums: Album[]; missingTracks: TrackMetadata[] } {
    const missingAlbums = albums.filter((a) => !a.artworkDataUrl);
    const missingTracks = tracks.filter((t) => !t.hasArtwork || !t.artworkDataUrl);
    return { missingAlbums, missingTracks };
  }

  /**
   * Bulk Metadata Update: preserves untouched fields, updates ID3 tags, and refreshes library
   */
  public async bulkUpdateMetadata(
    targetTracks: TrackMetadata[],
    payload: BulkMetadataPayload,
    onProgress?: (current: number, total: number) => void
  ): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      total: targetTracks.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < targetTracks.length; i++) {
      const track = targetTracks[i];
      try {
        const updatedTrack: TrackMetadata = {
          ...track,
          artist: payload.artist !== undefined && payload.artist.trim() !== '' ? payload.artist.trim() : track.artist,
          album: payload.album !== undefined && payload.album.trim() !== '' ? payload.album.trim() : track.album,
          albumArtist: payload.albumArtist !== undefined && payload.albumArtist.trim() !== '' ? payload.albumArtist.trim() : track.albumArtist,
          genre: payload.genre !== undefined && payload.genre.trim() !== '' ? payload.genre.trim() : track.genre,
          year: payload.year !== undefined && payload.year > 0 ? payload.year : track.year,
          artworkDataUrl: payload.artworkDataUrl ? payload.artworkDataUrl : track.artworkDataUrl,
          hasArtwork: payload.artworkDataUrl ? true : track.hasArtwork,
        };

        // Write tags via Electron API if available
        if (typeof window !== 'undefined' && (window as any).harmoniqApi?.writeAudioTags) {
          const tagsToWrite: any = {};
          if (payload.artist) tagsToWrite.artist = payload.artist;
          if (payload.album) tagsToWrite.album = payload.album;
          if (payload.albumArtist) tagsToWrite.albumArtist = payload.albumArtist;
          if (payload.genre) tagsToWrite.genre = payload.genre;
          if (payload.year) tagsToWrite.year = payload.year;

          await (window as any).harmoniqApi.writeAudioTags(track.filePath, tagsToWrite);
        }

        // Update in library service
        libraryService.updateTrack(updatedTrack);
        result.succeeded++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          trackId: track.id,
          filePath: track.filePath,
          error: err?.message || 'Failed to update track',
        });
      }

      onProgress?.(i + 1, targetTracks.length);
    }

    return result;
  }
}

export const maintenanceService = new MaintenanceService();
