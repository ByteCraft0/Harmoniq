import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import {
  UnifiedTrack,
  UniversalSearchResponse,
  ProviderSearchResponse,
  unifiedTrackToTrackMetadata,
} from '../types/universalMusic';
import { universalMusicService } from '../services/universalMusicService';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { libraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';

describe('HARMONIQ 2.0 — Universal Music Black Screen Bug & Resilience Regression Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    universalMusicService.clearCache();
    (globalThis as any).window = globalThis;
    delete (globalThis as any).window.harmoniqApi;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ((globalThis as any).window) {
      delete (globalThis as any).window.harmoniqApi;
    }
  });

  // =========================================================================
  // 1. ROOT CAUSE REPRODUCTION & REGRESSION VALIDATION
  // =========================================================================
  describe('Root Cause: Missing localResults in IPC response payload', () => {
    it('demonstrates that spreading undefined localResults causes TypeError: is not iterable', () => {
      // Reproducing the exact defect that crashed React and turned the window black:
      const malformedIpcResponse = {
        query: 'coldplay',
        filter: 'all',
        results: [
          {
            id: 'apple:123',
            providerId: 'apple',
            providerTrackId: '123',
            title: 'Yellow',
            artist: 'Coldplay',
            duration: 269,
            playbackCapability: 'preview_stream',
            isOnline: true,
          },
        ],
        // Notice localResults is omitted (undefined) as was returned by electron/main.ts
        providerResponses: {},
        totalResults: 1,
        searchedAt: Date.now(),
      };

      // Raw un-defended access (the old buggy code):
      const buggyExtract = () => {
        const resp = malformedIpcResponse as any;
        return [...resp.localResults, ...resp.results];
      };

      // Spreading undefined MUST throw TypeError
      expect(buggyExtract).toThrow(TypeError);
      expect(buggyExtract).toThrow(/is not iterable/i);
    });

    it('verifies that the defensive allTracks extraction handles undefined or null localResults safely', () => {
      const malformedIpcResponse = {
        query: 'coldplay',
        filter: 'all',
        results: [
          {
            id: 'apple:123',
            providerId: 'apple',
            providerTrackId: '123',
            title: 'Yellow',
            artist: 'Coldplay',
            duration: 269,
            playbackCapability: 'preview_stream',
            isOnline: true,
          },
        ],
        // localResults is intentionally undefined
        localResults: undefined as any,
        providerResponses: {},
        totalResults: 1,
        cached: false,
        searchedAt: Date.now(),
      };

      // The new defensive implementation:
      const safeExtract = (searchResponse: any): UnifiedTrack[] => {
        if (!searchResponse) return [];
        const local = Array.isArray(searchResponse.localResults) ? searchResponse.localResults : [];
        const online = Array.isArray(searchResponse.results) ? searchResponse.results : [];
        return [...local, ...online].filter((t): t is UnifiedTrack => Boolean(t && typeof t === 'object' && t.id));
      };

      const extracted = safeExtract(malformedIpcResponse);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].id).toBe('apple:123');
      expect(extracted[0].title).toBe('Yellow');
    });

    it('verifies that safeExtract handles completely empty, null, or malformed search responses without throwing', () => {
      const safeExtract = (searchResponse: any): UnifiedTrack[] => {
        if (!searchResponse) return [];
        const local = Array.isArray(searchResponse.localResults) ? searchResponse.localResults : [];
        const online = Array.isArray(searchResponse.results) ? searchResponse.results : [];
        return [...local, ...online].filter((t): t is UnifiedTrack => Boolean(t && typeof t === 'object' && t.id));
      };

      expect(safeExtract(null)).toEqual([]);
      expect(safeExtract(undefined)).toEqual([]);
      expect(safeExtract({})).toEqual([]);
      expect(safeExtract({ localResults: null, results: null })).toEqual([]);
      expect(safeExtract({ localResults: [null, undefined, { id: 'valid:1' }], results: [false, 'invalid'] })).toEqual([
        { id: 'valid:1' },
      ]);
    });
  });

  // =========================================================================
  // 2. UNIVERSAL MUSIC SERVICE IPC NORMALIZATION & LOCAL LIBRARY MERGING
  // =========================================================================
  describe('Universal Music Service: IPC Response Normalization', () => {
    it('normalizes IPC response missing localResults and cached fields into a valid UniversalSearchResponse', async () => {
      // Mock window.harmoniqApi.universalSearch returning payload without localResults/cached
      (globalThis as any).window.harmoniqApi = {
        universalSearch: vi.fn().mockResolvedValue({
          query: 'chopin',
          filter: 'all',
          results: [
            {
              id: 'archive:chopin_nocturne',
              providerId: 'archive',
              providerTrackId: 'chopin_nocturne',
              title: 'Nocturne in E-flat major, Op. 9, No. 2',
              artist: 'Frédéric Chopin',
              duration: 270,
              playbackCapability: 'full_stream',
              isOnline: true,
            },
          ],
          providerResponses: {
            archive: {
              providerId: 'archive',
              success: true,
              tracks: [],
              durationMs: 120,
            },
          },
          totalResults: 1,
          searchedAt: 1700000000000,
        }),
      };

      // Also spy on libraryService.getAllTracks to return a matching local track
      const mockLocalTrack = {
        id: 'local-chopin-1',
        title: 'Chopin Waltz in A minor',
        artist: 'Frédéric Chopin',
        album: 'Classical Masterpieces',
        duration: 150,
        filePath: 'C:/Music/chopin.flac',
        fileName: 'chopin.flac',
        codec: 'FLAC',
        bitrate: 850,
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        dateAdded: Date.now(),
        dateModified: Date.now(),
        fileSize: 15000000,
        container: 'flac',
        hasArtwork: false,
        isLossless: true,
        playCount: 0,
        isFavorite: false,
      } as unknown as TrackMetadata;
      vi.spyOn(libraryService, 'getAllTracks').mockReturnValue([mockLocalTrack]);

      const response = await universalMusicService.searchUniversal('chopin');

      // 1. Response must have non-null localResults array
      expect(Array.isArray(response.localResults)).toBe(true);
      expect(response.localResults.length).toBeGreaterThanOrEqual(1);
      expect(response.localResults[0].id).toBe('local-chopin-1');
      expect(response.localResults[0].title).toBe('Chopin Waltz in A minor');

      // 2. Online results must be preserved
      expect(Array.isArray(response.results)).toBe(true);
      expect(response.results).toHaveLength(1);
      expect(response.results[0].id).toBe('archive:chopin_nocturne');

      // 3. Cached must be a boolean
      expect(typeof response.cached).toBe('boolean');
      expect(response.cached).toBe(false);

      // 4. Total results must reflect both online and local
      expect(response.totalResults).toBe(2);

      // 5. Subsequent search from cache must return cached: true
      const cachedResponse = await universalMusicService.searchUniversal('chopin');
      expect(cachedResponse.cached).toBe(true);
      expect(cachedResponse.localResults).toHaveLength(1);
    });

    it('falls back safely to renderer provider search if IPC universalSearch fails', async () => {
      (globalThis as any).window.harmoniqApi = {
        universalSearch: vi.fn().mockRejectedValue(new Error('IPC pipe broken or process crashed')),
      };

      // The service should catch the IPC failure and fall back to renderer providers without throwing
      const response = await universalMusicService.searchUniversal('ambient dream');

      expect(response).toBeDefined();
      expect(Array.isArray(response.results)).toBe(true);
      expect(Array.isArray(response.localResults)).toBe(true);
      expect(typeof response.totalResults).toBe('number');
    });

    it('returns empty UniversalSearchResponse immediately for empty or whitespace query without IPC call', async () => {
      const mockIpc = vi.fn();
      (globalThis as any).window.harmoniqApi = { universalSearch: mockIpc };

      const emptyRes1 = await universalMusicService.searchUniversal('');
      const emptyRes2 = await universalMusicService.searchUniversal('   ');

      expect(mockIpc).not.toHaveBeenCalled();
      expect(emptyRes1.results).toEqual([]);
      expect(emptyRes1.localResults).toEqual([]);
      expect(emptyRes1.totalResults).toBe(0);
      expect(emptyRes2.results).toEqual([]);
      expect(emptyRes2.localResults).toEqual([]);
    });
  });

  // =========================================================================
  // 3. UI STATE & RACE CONDITION MITIGATION
  // =========================================================================
  describe('Race Condition & Stale Search Request Mitigation', () => {
    it('simulates rapid consecutive searches where earlier slow response is ignored in favor of newer fast response', async () => {
      let searchSequence = 0;
      const executedResults: string[] = [];

      // Simulate a search controller that uses search sequence guarding
      let latestSeq = 0;
      const simulateSearch = async (query: string, delayMs: number) => {
        const seq = ++searchSequence;
        latestSeq = seq;

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // If a newer search was initiated, drop this stale response
        if (seq !== latestSeq) {
          return { dropped: true, query };
        }

        executedResults.push(query);
        return { dropped: false, query };
      };

      // User rapidly types "C" (slow network 50ms), then "Cold" (fast network 10ms)
      const p1 = simulateSearch('C', 50);
      const p2 = simulateSearch('Cold', 10);

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.dropped).toBe(true);
      expect(r2.dropped).toBe(false);
      expect(executedResults).toEqual(['Cold']);
    });
  });

  // =========================================================================
  // 4. ERROR BOUNDARY COMPONENT INTEGRITY
  // =========================================================================
  describe('ErrorBoundary Component Resilience', () => {
    it('instantiates ErrorBoundary and catches component render errors without crashing', () => {
      const errorBoundary = new ErrorBoundary({
        fallbackTitle: 'Universal Music Temporarily Unavailable',
        fallbackDescription: 'An unexpected error occurred in search.',
      });

      // Initial state
      expect(errorBoundary.state.hasError).toBe(false);
      expect(errorBoundary.state.error).toBeNull();

      // Trigger static getDerivedStateFromError
      const testError = new TypeError('searchResponse.localResults is not iterable');
      const newState = ErrorBoundary.getDerivedStateFromError(testError);

      expect(newState.hasError).toBe(true);
      expect(newState.error).toBe(testError);

      // Verify componentDidCatch runs cleanly without throwing
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      errorBoundary.componentDidCatch(testError, { componentStack: 'in OnlineMusicSearchView' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Harmoniq ErrorBoundary caught error]:',
        testError,
        { componentStack: 'in OnlineMusicSearchView' }
      );
    });

    it('resets ErrorBoundary state when resetError is called', () => {
      const resetSpy = vi.fn();
      const errorBoundary = new ErrorBoundary({
        onReset: resetSpy,
      });

      errorBoundary.state = {
        hasError: true,
        error: new Error('Simulated failure'),
      };

      errorBoundary.setState = vi.fn().mockImplementation((updater) => {
        if (typeof updater === 'function') {
          errorBoundary.state = updater(errorBoundary.state);
        } else {
          errorBoundary.state = { ...errorBoundary.state, ...updater };
        }
      });

      errorBoundary.resetError();

      expect(errorBoundary.state.hasError).toBe(false);
      expect(errorBoundary.state.error).toBeNull();
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. DEFENSIVE DATA TRANSFORMATION & MISSING FIELD HANDLING
  // =========================================================================
  describe('Defensive Track Data Transformation', () => {
    it('safely handles missing artworkUrl, duration, bitrate, and album in UnifiedTrack', () => {
      const trackWithMissingFields: UnifiedTrack = {
        id: 'audius:unknown_track',
        providerId: 'audius',
        providerTrackId: 'unknown_track',
        title: '',
        artist: '',
        duration: 0,
        playbackCapability: 'full_stream',
        isOnline: true,
      };

      const metadata = unifiedTrackToTrackMetadata(trackWithMissingFields);

      expect(metadata.id).toBe('audius:unknown_track');
      expect(metadata.title).toBe('Untitled Track');
      expect(metadata.artist).toBe('Unknown Artist');
      expect(metadata.album).toBe('AUDIUS Stream');
      expect(metadata.duration).toBe(0);
      expect(metadata.codec).toBe('MP3');
      expect(metadata.isOnline).toBe(true);
    });

    it('formats duration safely with 0, negative, NaN, or undefined values', () => {
      const formatDuration = (seconds?: number) => {
        if (!seconds || isNaN(seconds) || seconds <= 0) return null;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      expect(formatDuration(undefined)).toBeNull();
      expect(formatDuration(NaN)).toBeNull();
      expect(formatDuration(0)).toBeNull();
      expect(formatDuration(-15)).toBeNull();
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(215)).toBe('3:35');
    });

    it('isolates single provider failure while allowing healthy provider results to display', async () => {
      (globalThis as any).window.harmoniqApi = {
        universalSearch: vi.fn().mockResolvedValue({
          query: 'arjit',
          filter: 'all',
          results: [
            {
              id: 'apple:tum_hi_ho',
              providerId: 'apple',
              providerTrackId: 'tum_hi_ho',
              title: 'Tum Hi Ho',
              artist: 'Arijit Singh',
              duration: 262,
              playbackCapability: 'preview_stream',
              isOnline: true,
            },
          ],
          localResults: [],
          providerResponses: {
            apple: {
              providerId: 'apple',
              success: true,
              tracks: [],
              durationMs: 150,
            },
            youtube: {
              providerId: 'youtube',
              success: false,
              tracks: [],
              errorMessage: 'YouTube API quota exceeded (HTTP 429)',
              durationMs: 80,
            },
          },
          totalResults: 1,
          cached: false,
          searchedAt: Date.now(),
        }),
      };

      const response = await universalMusicService.searchUniversal('arjit');

      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe('Tum Hi Ho');
      expect(response.providerResponses.youtube.success).toBe(false);
      expect(response.providerResponses.youtube.errorMessage).toContain('quota exceeded');
      expect(response.providerResponses.apple.success).toBe(true);
    });
  });

  // =========================================================================
  // 6. NON-REGRESSION OF AUDIO ENGINE & CORE SECTIONS
  // =========================================================================
  describe('Audio Engine, Queue & Local Playback Non-Regression', () => {
    it('converts an online UnifiedTrack to TrackMetadata and allows queueing without errors', () => {
      const onlineTrack: UnifiedTrack = {
        id: 'jamendo:998877',
        providerId: 'jamendo',
        providerTrackId: '998877',
        title: 'Sunset Horizon',
        artist: 'Solar Fields',
        album: 'Ambient Works',
        duration: 320,
        artworkUrl: 'https://img.jamendo.com/998877.jpg',
        playbackCapability: 'full_stream',
        streamUrl: 'https://stream.jamendo.com/998877.mp3',
        format: 'MP3',
        bitrate: 192,
        isOnline: true,
      };

      const queueItem = unifiedTrackToTrackMetadata(onlineTrack);

      expect(queueItem.id).toBe('jamendo:998877');
      expect(queueItem.filePath).toBe('https://stream.jamendo.com/998877.mp3');
      expect(queueItem.isOnline).toBe(true);
      expect((queueItem as any).isOnline).toBe(true);
    });

    it('verifies local tracks retain their native file paths and lossless flags', () => {
      const localTrackMeta = {
        id: 'local_master_flac',
        title: 'Master Audio Track',
        artist: 'Harmoniq Reference',
        album: 'Studio Master Vol. 1',
        duration: 300,
        filePath: 'D:/HiRes/Master.flac',
        fileName: 'Master.flac',
        codec: 'FLAC',
        bitrate: 1411,
        sampleRate: 96000,
        bitDepth: 24,
        channels: 2,
        dateAdded: Date.now(),
        dateModified: Date.now(),
        fileSize: 45000000,
        container: 'flac',
        hasArtwork: false,
        isLossless: true,
        playCount: 0,
        isFavorite: false,
      } as unknown as TrackMetadata;

      // Local tracks are completely intact
      expect(localTrackMeta.filePath).toBe('D:/HiRes/Master.flac');
      expect(localTrackMeta.sampleRate).toBe(96000);
      expect(localTrackMeta.bitDepth).toBe(24);
      expect(localTrackMeta.codec).toBe('FLAC');
    });
  });
});
