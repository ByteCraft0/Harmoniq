import { BaseMusicProvider } from './baseProvider';
import {
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  trackMetadataToUnifiedTrack,
} from '../../types/universalMusic';
import { libraryService } from '../libraryService';
import { TrackMetadata } from '../../types/audio';

export class LocalLibraryProvider extends BaseMusicProvider {
  readonly id: ProviderId = 'local';
  readonly name: string = 'Local Library';
  readonly defaultCapability: PlaybackCapability = 'local_file';

  normalize(raw: any): UnifiedTrack | null {
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    return trackMetadataToUnifiedTrack(raw as TrackMetadata);
  }

  async search(query: string, options?: ProviderSearchOptions): Promise<ProviderSearchResponse> {
    const startTime = Date.now();
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) {
      return {
        providerId: this.id,
        success: true,
        tracks: [],
        durationMs: 0,
      };
    }

    try {
      const allTracks = libraryService.getAllTracks();
      const matched = allTracks.filter((t) => {
        if (options?.filter === 'song') {
          return t.title.toLowerCase().includes(cleanQ);
        }
        if (options?.filter === 'artist') {
          return t.artist.toLowerCase().includes(cleanQ);
        }
        if (options?.filter === 'album') {
          return (t.album && t.album.toLowerCase().includes(cleanQ)) || false;
        }
        return (
          t.title.toLowerCase().includes(cleanQ) ||
          t.artist.toLowerCase().includes(cleanQ) ||
          (t.album && t.album.toLowerCase().includes(cleanQ)) ||
          (t.genre && t.genre.toLowerCase().includes(cleanQ))
        );
      });

      const limit = options?.limit || 50;
      const tracks = matched.slice(0, limit).map((t) => trackMetadataToUnifiedTrack(t));

      return {
        providerId: this.id,
        success: true,
        tracks,
        totalFound: tracks.length,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return this.createErrorResponse(err, Date.now() - startTime);
    }
  }
}
