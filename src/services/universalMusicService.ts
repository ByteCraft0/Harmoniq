import {
  ProviderId,
  MusicProvider,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  UniversalSearchResponse,
  unifiedTrackToTrackMetadata,
} from '../types/universalMusic';
import { OnlineSearchResult } from '../types/online';
import { TrackMetadata } from '../types/audio';
import {
  JamendoProvider,
  AudiusProvider,
  ArchiveProvider,
  ApplePreviewProvider,
  LocalLibraryProvider,
} from './providers';

export class UniversalMusicService {
  private providers: Map<ProviderId, MusicProvider> = new Map();
  private enabledProviders: Set<ProviderId> = new Set([
    'jamendo',
    'audius',
    'archive',
    'apple',
    'local',
  ]);
  private searchCache = new Map<string, { timestamp: number; response: UniversalSearchResponse }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private activeAbortController: AbortController | null = null;

  constructor() {
    // Register verified Tier 1 foundation providers
    this.registerProvider(new JamendoProvider());
    this.registerProvider(new AudiusProvider());
    this.registerProvider(new ArchiveProvider());
    this.registerProvider(new ApplePreviewProvider());
    this.registerProvider(new LocalLibraryProvider());
  }

  /**
   * Register a new music provider adapter dynamically
   */
  public registerProvider(provider: MusicProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Clear all registered providers (useful for testing and reconfiguration)
   */
  public clearProviders(): void {
    this.providers.clear();
  }

  /**
   * Retrieve a registered provider by its unique identifier
   */
  public getProvider(id: ProviderId): MusicProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  public getAllProviders(): MusicProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check whether a specific provider is currently enabled
   */
  public isProviderEnabled(id: ProviderId): boolean {
    return this.enabledProviders.has(id);
  }

  /**
   * Enable or disable a provider
   */
  public setProviderEnabled(id: ProviderId, enabled: boolean): void {
    if (enabled) {
      this.enabledProviders.add(id);
    } else {
      this.enabledProviders.delete(id);
    }
  }

  /**
   * Normalize text tokens for clean comparison and duplicate detection
   */
  private cleanToken(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Deduplicate track collection across heterogeneous providers.
   * Prioritizes full-length direct audio streams over 30-second previews.
   */
  public deduplicateTracks(tracks: UnifiedTrack[]): UnifiedTrack[] {
    const seen = new Map<string, UnifiedTrack>();

    for (const track of tracks) {
      const cleanTitle = this.cleanToken(track.title);
      const cleanArtist = this.cleanToken(track.artist);
      const key = `${cleanTitle}:::${cleanArtist}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, track);
      } else {
        // Preference hierarchy: full_stream > preview_stream > external_embed
        const isExistingFull = existing.playbackCapability === 'full_stream';
        const isCurrentFull = track.playbackCapability === 'full_stream';

        if (!isExistingFull && isCurrentFull) {
          seen.set(key, track);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Clear cached search responses
   */
  public clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Cancel any pending in-flight universal search
   */
  public cancelPendingSearch(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Execute an aggregated universal search across all enabled providers.
   * Handles parallel dispatch, timeout bounding, error isolation, and deduplication.
   */
  public async searchUniversal(
    query: string,
    options?: ProviderSearchOptions
  ): Promise<UniversalSearchResponse> {
    const cleanQ = query.trim();
    const filter = options?.filter || 'all';

    if (!cleanQ) {
      return {
        query: '',
        filter,
        results: [],
        localResults: [],
        providerResponses: {},
        totalResults: 0,
        cached: false,
        searchedAt: Date.now(),
      };
    }

    const cacheKey = `${filter}:${cleanQ.toLowerCase()}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return {
        ...cached.response,
        cached: true,
      };
    }

    // 1. Electron Main Process IPC Fast-Path (if running in desktop host)
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.universalSearch) {
      try {
        const ipcResponse = await (window as any).harmoniqApi.universalSearch({
          query: cleanQ,
          filter,
          limit: options?.limit || 25,
        });

        if (ipcResponse && Array.isArray(ipcResponse.results)) {
          this.searchCache.set(cacheKey, {
            timestamp: Date.now(),
            response: ipcResponse,
          });
          return ipcResponse;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        console.warn('IPC universalSearch error, falling back to renderer provider adapters:', err);
      }
    }

    // 2. Direct Parallel Provider Execution (with error isolation)
    const activeProviders = Array.from(this.providers.values()).filter((p) =>
      this.enabledProviders.has(p.id)
    );

    const providerPromises = activeProviders.map(async (provider) => {
      try {
        return await provider.search(cleanQ, options);
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        return {
          providerId: provider.id,
          success: false,
          tracks: [],
          errorMessage: err?.message || 'Provider execution failed',
          durationMs: 0,
        } as ProviderSearchResponse;
      }
    });

    const settledResults = await Promise.allSettled(providerPromises);

    const providerResponses: Record<string, ProviderSearchResponse> = {};
    const rawOnlineTracks: UnifiedTrack[] = [];
    let localTracks: UnifiedTrack[] = [];

    for (let i = 0; i < settledResults.length; i++) {
      const settled = settledResults[i];
      const provider = activeProviders[i];

      if (settled.status === 'fulfilled') {
        const resp = settled.value;
        providerResponses[resp.providerId] = resp;

        if (resp.providerId === 'local') {
          localTracks = resp.tracks;
        } else if (resp.success) {
          rawOnlineTracks.push(...resp.tracks);
        }
      } else {
        providerResponses[provider.id] = {
          providerId: provider.id,
          success: false,
          tracks: [],
          errorMessage: settled.reason?.message || 'Failed to complete query',
          durationMs: 0,
        };
      }
    }

    const deduplicatedOnline = this.deduplicateTracks(rawOnlineTracks);

    const response: UniversalSearchResponse = {
      query: cleanQ,
      filter,
      results: deduplicatedOnline,
      localResults: localTracks,
      providerResponses,
      totalResults: deduplicatedOnline.length + localTracks.length,
      cached: false,
      searchedAt: Date.now(),
    };

    this.searchCache.set(cacheKey, { timestamp: Date.now(), response });
    return response;
  }

  // =========================================================================
  // Backward Compatibility Layer for Legacy OnlineMusicService & Existing Tests
  // =========================================================================

  /**
   * Search local library (retains exact signature of legacy onlineMusicService)
   */
  public searchLocal(query: string): TrackMetadata[] {
    const localProvider = this.providers.get('local');
    if (!localProvider) return [];

    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) return [];

    // Use local provider normalize logic
    const all = (localProvider as LocalLibraryProvider);
    // Directly call local search synchronously for instant response
    const tracks = (all as any).searchSync
      ? (all as any).searchSync(cleanQ)
      : (window as any)._harmoniqLocalTracksCache || [];

    if (tracks.length > 0) return tracks;

    // Fallback directly to libraryService
    try {
      const { libraryService } = require('./libraryService');
      return libraryService.getAllTracks().filter(
        (t: TrackMetadata) =>
          t.title.toLowerCase().includes(cleanQ) ||
          t.artist.toLowerCase().includes(cleanQ) ||
          (t.album && t.album.toLowerCase().includes(cleanQ)) ||
          (t.genre && t.genre.toLowerCase().includes(cleanQ))
      );
    } catch {
      return [];
    }
  }

  /**
   * Search online catalog (retains signature of legacy onlineMusicService for test suites)
   */
  public async searchOnline(
    query: string,
    filter: 'all' | 'song' | 'artist' | 'album' = 'all',
    signal?: AbortSignal
  ): Promise<OnlineSearchResult[]> {
    // 1. Honor legacy IPC mock in tests
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.searchOnlineMusic) {
      try {
        const rawResults = await (window as any).harmoniqApi.searchOnlineMusic(query, filter);
        return (rawResults || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          artist: r.artist,
          album: r.album,
          year: r.year,
          duration: r.duration,
          source: r.source || 'Open Catalog',
          streamUrl: r.streamUrl,
          detailUrl: r.detailUrl,
          artworkUrl: r.artworkUrl,
          license: r.license,
          format: r.format || 'MP3',
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
      }
    }

    // 2. Delegate to Universal Search
    const universal = await this.searchUniversal(query, { filter, signal });
    return universal.results.map((ut) => ({
      id: ut.id,
      title: ut.title,
      artist: ut.artist,
      album: ut.album,
      year: ut.releaseYear,
      duration: ut.duration,
      source: ut.providerId,
      streamUrl: ut.streamUrl,
      detailUrl: ut.providerWebUrl,
      artworkUrl: ut.artworkUrl,
      license: ut.license,
      bitrate: ut.bitrate,
      format: ut.format,
    }));
  }
}

export const universalMusicService = new UniversalMusicService();
