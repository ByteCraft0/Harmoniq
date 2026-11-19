import {
  ProviderId,
  PlaybackCapability,
  MusicProvider,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  UniversalSearchResponse,
  ProviderCapabilityAudit,
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
  SpotifyProvider,
  YouTubeProvider,
} from './providers';

export class UniversalMusicService {
  private providers: Map<ProviderId, MusicProvider> = new Map();
  private enabledProviders: Set<ProviderId> = new Set([
    'jamendo',
    'audius',
    'archive',
    'apple',
    'local',
    'spotify',
    'youtube',
  ]);
  private searchCache = new Map<string, { timestamp: number; response: UniversalSearchResponse }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private activeAbortController: AbortController | null = null;
  private jamendoClientId: string = '';
  private spotifyClientId: string = '';
  private spotifyClientSecret: string = '';
  private youtubeApiKey: string = '';

  constructor() {
    // Register verified Tier 1 & Tier 2 foundation providers
    const jamendo = new JamendoProvider();
    const spotify = new SpotifyProvider();
    const youtube = new YouTubeProvider();

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedJamendo = window.localStorage.getItem('harmoniq_jamendo_client_id');
        if (savedJamendo && savedJamendo.trim()) {
          this.jamendoClientId = savedJamendo.trim();
          jamendo.setClientId(savedJamendo.trim());
        }

        const savedSpotId = window.localStorage.getItem('harmoniq_spotify_client_id');
        const savedSpotSec = window.localStorage.getItem('harmoniq_spotify_client_secret');
        if (savedSpotId && savedSpotSec) {
          this.spotifyClientId = savedSpotId.trim();
          this.spotifyClientSecret = savedSpotSec.trim();
          spotify.setCredentials(savedSpotId.trim(), savedSpotSec.trim());
        }

        const savedYt = window.localStorage.getItem('harmoniq_youtube_api_key');
        if (savedYt && savedYt.trim()) {
          this.youtubeApiKey = savedYt.trim();
          youtube.setApiKey(savedYt.trim());
        }
      }
    } catch {
      /* ignore */
    }

    this.registerProvider(jamendo);
    this.registerProvider(new AudiusProvider());
    this.registerProvider(new ArchiveProvider());
    this.registerProvider(new ApplePreviewProvider());
    this.registerProvider(new LocalLibraryProvider());
    this.registerProvider(spotify);
    this.registerProvider(youtube);
  }

  /**
   * Get configured Spotify credentials
   */
  public getSpotifyCredentials(): { clientId: string; hasSecret: boolean } {
    const sp = this.providers.get('spotify') as SpotifyProvider | undefined;
    return sp
      ? sp.getCredentials()
      : { clientId: this.spotifyClientId, hasSecret: Boolean(this.spotifyClientSecret) };
  }

  /**
   * Configure custom user Spotify Client ID & Secret
   * Note: Client Secret is securely sent to Electron main process for OS-backed DPAPI encryption
   * and is NEVER persisted in renderer localStorage.
   */
  public setSpotifyCredentials(clientId: string, clientSecret: string): void {
    this.spotifyClientId = (clientId || '').trim();
    this.spotifyClientSecret = (clientSecret || '').trim();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (this.spotifyClientId) {
          window.localStorage.setItem('harmoniq_spotify_client_id', this.spotifyClientId);
        } else {
          window.localStorage.removeItem('harmoniq_spotify_client_id');
        }
        // Strictly purge any legacy plaintext secret from browser storage
        window.localStorage.removeItem('harmoniq_spotify_client_secret');
      }
      const api =
        typeof window !== 'undefined'
          ? (window as any).harmoniqApi
          : (globalThis as any).harmoniqApi;
      if (api?.saveProviderConfigs) {
        api.saveProviderConfigs({
          spotifyClientId: this.spotifyClientId,
          spotifyClientSecret: this.spotifyClientSecret,
        });
      }
    } catch {
      /* ignore */
    }
    const sp = this.providers.get('spotify') as SpotifyProvider | undefined;
    if (sp) {
      sp.setCredentials(this.spotifyClientId, this.spotifyClientSecret);
    }
    this.clearCache();
  }

  /**
   * Get configured YouTube Data API Key
   */
  public getYouTubeApiKey(): string {
    const yt = this.providers.get('youtube') as YouTubeProvider | undefined;
    return yt ? yt.getApiKey() : this.youtubeApiKey;
  }

  /**
   * Configure YouTube Data API Key
   */
  public setYouTubeApiKey(key: string): void {
    this.youtubeApiKey = (key || '').trim();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (this.youtubeApiKey) {
          window.localStorage.setItem('harmoniq_youtube_api_key', this.youtubeApiKey);
        } else {
          window.localStorage.removeItem('harmoniq_youtube_api_key');
        }
      }
      const api =
        typeof window !== 'undefined'
          ? (window as any).harmoniqApi
          : (globalThis as any).harmoniqApi;
      if (api?.saveProviderConfigs) {
        api.saveProviderConfigs({
          youtubeApiKey: this.youtubeApiKey,
        });
      }
    } catch {
      /* ignore */
    }
    const yt = this.providers.get('youtube') as YouTubeProvider | undefined;
    if (yt) {
      yt.setApiKey(this.youtubeApiKey);
    }
    this.clearCache();
  }

  /**
   * Audit all supported and investigated music providers
   */
  public getProviderCapabilityAudits(): ProviderCapabilityAudit[] {
    const audits: ProviderCapabilityAudit[] = [];
    for (const p of this.providers.values()) {
      if (p.getCapabilityAudit) {
        audits.push(p.getCapabilityAudit());
      }
    }
    // Add official audit assessment for JioSaavn
    audits.push({
      providerId: 'jiosaavn',
      name: 'JioSaavn',
      searchAvailable: false,
      metadataAvailable: false,
      playbackCapability: 'unavailable',
      requiresAuth: false,
      developerRegistration:
        'NOT AVAILABLE: JioSaavn does not provide an official public third-party developer API or SDK',
      officialDestinationUrl: 'https://www.jiosaavn.com',
      providerAttribution: 'JioSaavn (No official third-party API)',
      geographicAvailability: 'India & diaspora',
      rateLimits: 'N/A',
      commercialRestrictions:
        'Reverse-engineering internal mobile endpoints violates Terms of Service. Unofficial scraping strictly prohibited.',
      desktopCompatibility:
        'Not available via third-party developer integration. Legitimate Indian catalog is provided via Apple Music, YouTube, and Spotify.',
    });
    return audits;
  }

  /**
   * Get configured Jamendo Client ID (or default open demo key)
   */
  public getJamendoClientId(): string {
    if (this.jamendoClientId) return this.jamendoClientId;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('harmoniq_jamendo_client_id');
        if (stored && stored.trim()) {
          this.jamendoClientId = stored.trim();
          return this.jamendoClientId;
        }
      }
    } catch {
      /* ignore */
    }
    const jamendoProv = this.providers.get('jamendo') as JamendoProvider | undefined;
    return jamendoProv?.getClientId ? jamendoProv.getClientId() : 'b6747d04';
  }

  /**
   * Configure custom user Jamendo Client ID for higher quotas and personalized access
   */
  public setJamendoClientId(key: string): void {
    const cleanKey = key ? key.trim() : '';
    this.jamendoClientId = cleanKey;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (cleanKey) {
          window.localStorage.setItem('harmoniq_jamendo_client_id', cleanKey);
        } else {
          window.localStorage.removeItem('harmoniq_jamendo_client_id');
        }
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.saveJamendoConfig) {
        (window as any).harmoniqApi.saveJamendoConfig({ clientId: cleanKey });
      }
    } catch {
      /* ignore */
    }
    const jamendoProv = this.providers.get('jamendo') as JamendoProvider | undefined;
    if (jamendoProv?.setClientId) {
      jamendoProv.setClientId(cleanKey);
    }
    this.clearCache();
  }

  /**
   * Resolve an on-demand, validated stream URL for a UnifiedTrack.
   * Handles ephemeral signed tokens, dynamic archive audio filename resolution,
   * SSRF and loopback validation, and provider capability validation.
   */
  public async resolveTrackStream(
    track: UnifiedTrack
  ): Promise<{ track: UnifiedTrack; streamUrl: string; capability: PlaybackCapability }> {
    if (!track) {
      throw new Error('Track is required for stream resolution');
    }

    // 1. Electron IPC Fast-Path (with main-process security validation)
    const api = typeof window !== 'undefined' ? (window as any).harmoniqApi : (globalThis as any).harmoniqApi;
    if (api?.resolveUniversalStream) {
      try {
        const res = await api.resolveUniversalStream({
          providerId: track.providerId,
          providerTrackId: track.providerTrackId,
          currentStreamUrl: track.streamUrl,
          jamendoClientId: this.getJamendoClientId(),
        });

        if (res && res.success && res.streamUrl) {
          const updatedTrack: UnifiedTrack = {
            ...track,
            streamUrl: res.streamUrl,
            playbackCapability: (res.capability as PlaybackCapability) || track.playbackCapability,
            format: res.format || track.format,
            bitrate: res.bitrate || track.bitrate,
            duration: res.duration && (!track.duration || track.duration === 0) ? res.duration : track.duration,
          };
          return {
            track: updatedTrack,
            streamUrl: res.streamUrl,
            capability: updatedTrack.playbackCapability,
          };
        } else if (res && !res.success && res.error) {
          throw new Error(res.error);
        }
      } catch (ipcErr: any) {
        if (ipcErr?.message && !ipcErr.message.includes('not available')) {
          console.warn('IPC resolveUniversalStream failed, attempting provider fallback:', ipcErr);
        }
      }
    }

    // 2. Direct fallback resolution
    if (track.providerId === 'archive') {
      const archiveProv = this.providers.get('archive') as ArchiveProvider | undefined;
      if (archiveProv?.resolveAudioFile) {
        try {
          const resolved = await archiveProv.resolveAudioFile(track.providerTrackId);
          if (resolved?.streamUrl) {
            const updated: UnifiedTrack = {
              ...track,
              streamUrl: resolved.streamUrl,
              format: resolved.format || track.format,
              duration: resolved.duration && (!track.duration || track.duration === 0) ? resolved.duration : track.duration,
            };
            return {
              track: updated,
              streamUrl: resolved.streamUrl,
              capability: updated.playbackCapability,
            };
          }
        } catch (archiveErr) {
          console.warn('Direct archive resolve failed:', archiveErr);
        }
      }
    }

    if (track.providerId === 'audius') {
      const audiusUrl =
        track.streamUrl ||
        `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(track.providerTrackId)}/stream?app_name=HarmoniqAudioPlayer`;
      return {
        track: { ...track, streamUrl: audiusUrl },
        streamUrl: audiusUrl,
        capability: 'full_stream',
      };
    }

    if (track.providerId === 'spotify') {
      const capability: PlaybackCapability = track.streamUrl ? 'preview_stream' : 'external_link';
      return {
        track: { ...track, playbackCapability: capability },
        streamUrl: track.streamUrl || '',
        capability,
      };
    }

    if (track.providerId === 'youtube') {
      return {
        track: { ...track, playbackCapability: 'external_link' },
        streamUrl: '',
        capability: 'external_link',
      };
    }

    // Default return current stream URL or fallback
    const finalUrl = track.streamUrl || '';
    if (!finalUrl && track.providerId !== 'local') {
      throw new Error(`Unable to resolve stream for track "${track.title}" from provider ${track.providerId}`);
    }

    return {
      track,
      streamUrl: finalUrl,
      capability: track.playbackCapability,
    };
  }

  /**
   * Numeric ranking for playback capabilities during deduplication.
   * Full tracks rank highest, followed by previews, authorized embeds, and external links.
   */
  private getCapabilityRank(cap: PlaybackCapability): number {
    switch (cap) {
      case 'full_stream':
      case 'local_file':
        return 10;
      case 'preview_stream':
        return 8;
      case 'authorized_embed':
      case 'external_embed':
        return 6;
      case 'external_link':
        return 4;
      case 'metadata_only':
        return 2;
      default:
        return 0;
    }
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
   * Respects full_stream > preview_stream > authorized_embed > external_link hierarchy.
   * Matches by definitive ISRC first, secondary by normalized title+artist.
   * Merges and preserves rich metadata (high-res artwork, album, release year, popularity, isrc) from secondary results.
   */
  public deduplicateTracks(tracks: UnifiedTrack[]): UnifiedTrack[] {
    const isrcMap = new Map<string, UnifiedTrack>();
    const titleArtistMap = new Map<string, UnifiedTrack>();
    const dedupedList: UnifiedTrack[] = [];

    for (const track of tracks) {
      const isrcKey =
        track.isrc && typeof track.isrc === 'string' && track.isrc.trim().length >= 10
          ? track.isrc.trim().toUpperCase()
          : null;
      const cleanTitle = this.cleanToken(track.title);
      const cleanArtist = this.cleanToken(track.artist);
      const titleArtistKey = cleanTitle && cleanArtist ? `${cleanTitle}:::${cleanArtist}` : null;

      let existing: UnifiedTrack | undefined = undefined;

      if (isrcKey && isrcMap.has(isrcKey)) {
        existing = isrcMap.get(isrcKey);
      } else if (titleArtistKey && titleArtistMap.has(titleArtistKey)) {
        existing = titleArtistMap.get(titleArtistKey);
      }

      if (!existing) {
        if (isrcKey) isrcMap.set(isrcKey, track);
        if (titleArtistKey) titleArtistMap.set(titleArtistKey, track);
        dedupedList.push(track);
      } else {
        const existingRank = this.getCapabilityRank(existing.playbackCapability);
        const currentRank = this.getCapabilityRank(track.playbackCapability);

        const winner = currentRank > existingRank ? track : existing;
        const secondary = currentRank > existingRank ? existing : track;

        const merged: UnifiedTrack = {
          ...winner,
          artworkUrl: winner.artworkUrl || secondary.artworkUrl,
          album: winner.album || secondary.album,
          releaseYear: winner.releaseYear || secondary.releaseYear,
          genre: winner.genre || secondary.genre,
          popularity: winner.popularity !== undefined ? winner.popularity : secondary.popularity,
          isrc: winner.isrc || secondary.isrc,
          providerWebUrl: winner.providerWebUrl || secondary.providerWebUrl,
        };

        const index = dedupedList.indexOf(existing);
        if (index !== -1) {
          dedupedList[index] = merged;
        }
        if (isrcKey) isrcMap.set(isrcKey, merged);
        if (existing.isrc && existing.isrc.trim().length >= 10) {
          isrcMap.set(existing.isrc.trim().toUpperCase(), merged);
        }
        if (titleArtistKey) titleArtistMap.set(titleArtistKey, merged);
        const existingTitleArtist = `${this.cleanToken(existing.title)}:::${this.cleanToken(existing.artist)}`;
        if (existingTitleArtist) titleArtistMap.set(existingTitleArtist, merged);
      }
    }

    return dedupedList;
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
          jamendoClientId: this.getJamendoClientId(),
          spotifyClientId: this.spotifyClientId,
          youtubeApiKey: this.youtubeApiKey,
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
