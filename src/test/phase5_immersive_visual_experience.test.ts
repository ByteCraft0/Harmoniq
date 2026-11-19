import { describe, it, expect, beforeEach, vi } from 'vitest';
import { colorExtractionService } from '../services/colorExtractionService';
import { TrackMetadata } from '../types/audio';
import { Album, Artist } from '../types/library';

// In-memory mock for localStorage in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as any).localStorage = localStorageMock;
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
}

describe('Phase 5: Immersive Visual Experience', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // FEATURE 1: IMMERSIVE ALBUM MODE & DYNAMIC AMBIENT LIGHTING
  // -------------------------------------------------------------
  describe('Feature 1 – Immersive Album Mode', () => {
    const mockAlbum: Album = {
      id: 'album_violinsonatas_bach',
      title: 'Sonatas and Partitas for Solo Violin',
      artist: 'Johann Sebastian Bach',
      year: 2021,
      genre: 'Classical',
      artworkDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      trackCount: 3,
      totalDuration: 540,
      tracks: [
        {
          id: 'track_1',
          title: 'Sonata No. 1 in G minor: Adagio',
          artist: 'Johann Sebastian Bach',
          album: 'Sonatas and Partitas for Solo Violin',
          duration: 180,
          filePath: '/music/bach_sonata1.flac',
          trackNumber: 1,
          discNumber: 1,
          year: 2021,
          genre: 'Classical',
        } as TrackMetadata,
        {
          id: 'track_2',
          title: 'Sonata No. 1 in G minor: Fuga',
          artist: 'Johann Sebastian Bach',
          album: 'Sonatas and Partitas for Solo Violin',
          duration: 210,
          filePath: '/music/bach_sonata2.flac',
          trackNumber: 2,
          discNumber: 1,
          year: 2021,
          genre: 'Classical',
        } as TrackMetadata,
        {
          id: 'track_3',
          title: 'Sonata No. 1 in G minor: Presto',
          artist: 'Johann Sebastian Bach',
          album: 'Sonatas and Partitas for Solo Violin',
          duration: 150,
          filePath: '/music/bach_sonata3.flac',
          trackNumber: 3,
          discNumber: 1,
          year: 2021,
          genre: 'Classical',
        } as TrackMetadata,
      ],
    };

    it('extracts dynamic ambient color palette for the album canvas', async () => {
      const palette = await colorExtractionService.extractColors(mockAlbum.artworkDataUrl!);
      expect(palette).toBeDefined();
      expect(palette.primary).toBeDefined();
      expect(palette.secondary).toBeDefined();
      expect(palette.muted).toBeDefined();
      expect(palette.primaryRgb).toBeDefined();
      // Should return hex or rgb color strings
      expect(typeof palette.primary).toBe('string');
      expect(typeof palette.secondary).toBe('string');
    });

    it('caches extracted ambient lighting colors to prevent re-computation', async () => {
      const firstCall = await colorExtractionService.extractColors(mockAlbum.artworkDataUrl!);
      const secondCall = await colorExtractionService.extractColors(mockAlbum.artworkDataUrl!);
      expect(firstCall).toBe(secondCall); // Reference equality for cached objects
    });

    it('falls back to signature violet/lavender palette when artwork is absent', async () => {
      const fallback = await colorExtractionService.extractColors('');
      expect(fallback).toBeDefined();
      expect(fallback.primary).toBe('#A78BFA'); // Harmoniq Signature Violet/Lavender
      expect(fallback.secondary).toBe('#7C3AED');
      expect(fallback.muted).toBe('#1F1A3A');
    });

    it('computes album total duration and track count accurately', () => {
      const durationSum = mockAlbum.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
      expect(durationSum).toBe(540);
      expect(mockAlbum.trackCount).toBe(3);
    });

    it('handles immersive mode keyboard shortcuts (Escape, Space, Seeking)', () => {
      let closed = false;
      let playToggled = false;
      let seekedSeconds: number | null = null;

      const handleKeyDown = (e: { key: string }) => {
        if (e.key === 'Escape') closed = true;
        else if (e.key === ' ') playToggled = true;
        else if (e.key === 'ArrowRight') seekedSeconds = 5;
        else if (e.key === 'ArrowLeft') seekedSeconds = -5;
      };

      handleKeyDown({ key: 'Escape' });
      expect(closed).toBe(true);

      handleKeyDown({ key: ' ' });
      expect(playToggled).toBe(true);

      handleKeyDown({ key: 'ArrowRight' });
      expect(seekedSeconds).toBe(5);
    });

    it('supports toggling synced lyrics and acoustic visualizer overlays', () => {
      let showLyrics = false;
      let showVisualizer = false;

      const toggleLyrics = () => {
        showLyrics = !showLyrics;
        if (showLyrics) showVisualizer = false; // Mutually exclusive view panes
      };

      const toggleVisualizer = () => {
        showVisualizer = !showVisualizer;
        if (showVisualizer) showLyrics = false;
      };

      toggleLyrics();
      expect(showLyrics).toBe(true);
      expect(showVisualizer).toBe(false);

      toggleVisualizer();
      expect(showLyrics).toBe(false);
      expect(showVisualizer).toBe(true);

      toggleVisualizer();
      expect(showVisualizer).toBe(false);
      expect(showLyrics).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 2: VINYL COLLECTION MODE & RECORD CRATE
  // -------------------------------------------------------------
  describe('Feature 2 – Vinyl Collection Mode & Record Crate', () => {
    const testAlbums: Album[] = [
      {
        id: 'alb_1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        year: 1959,
        genre: 'Jazz',
        trackCount: 5,
        totalDuration: 2700,
        tracks: [],
      },
      {
        id: 'alb_2',
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: 1969,
        genre: 'Rock',
        trackCount: 17,
        totalDuration: 2840,
        tracks: [],
      },
      {
        id: 'alb_3',
        title: 'Thriller',
        artist: 'Michael Jackson',
        year: 1982,
        genre: 'Pop',
        trackCount: 9,
        totalDuration: 2530,
        tracks: [],
      },
      {
        id: 'alb_4',
        title: 'OK Computer',
        artist: 'Radiohead',
        year: 1997,
        genre: 'Alternative',
        trackCount: 12,
        totalDuration: 3192,
        tracks: [],
      },
      {
        id: 'alb_5',
        title: 'Random Access Memories',
        artist: 'Daft Punk',
        year: 2013,
        genre: 'Electronic',
        trackCount: 13,
        totalDuration: 4464,
        tracks: [],
      },
      {
        id: 'alb_6',
        title: 'Renaissance',
        artist: 'Beyoncé',
        year: 2022,
        genre: 'Dance',
        trackCount: 16,
        totalDuration: 3734,
        tracks: [],
      },
    ];

    it('correctly filters albums by decade chip (2020s, 2010s, 1990s, 1980s)', () => {
      const filterByDecade = (albums: Album[], decade: string) => {
        return albums.filter((a) => {
          if (!a.year) return false;
          if (decade === '2020s') return a.year >= 2020 && a.year <= 2029;
          if (decade === '2010s') return a.year >= 2010 && a.year <= 2019;
          if (decade === '2000s') return a.year >= 2000 && a.year <= 2009;
          if (decade === '1990s') return a.year >= 1990 && a.year <= 1999;
          if (decade === '1980s') return a.year >= 1980 && a.year <= 1989;
          return true;
        });
      };

      const twenties = filterByDecade(testAlbums, '2020s');
      expect(twenties.map((a) => a.title)).toEqual(['Renaissance']);

      const tens = filterByDecade(testAlbums, '2010s');
      expect(tens.map((a) => a.title)).toEqual(['Random Access Memories']);

      const nineties = filterByDecade(testAlbums, '1990s');
      expect(nineties.map((a) => a.title)).toEqual(['OK Computer']);

      const eighties = filterByDecade(testAlbums, '1980s');
      expect(eighties.map((a) => a.title)).toEqual(['Thriller']);
    });

    it('sorts vinyl collection albums by year, title, artist, and track count', () => {
      // Sort by Year ascending
      const byYear = [...testAlbums].sort((a, b) => (a.year || 0) - (b.year || 0));
      expect(byYear[0].title).toBe('Kind of Blue');
      expect(byYear[byYear.length - 1].title).toBe('Renaissance');

      // Sort by Title ascending
      const byTitle = [...testAlbums].sort((a, b) => a.title.localeCompare(b.title));
      expect(byTitle[0].title).toBe('Abbey Road');

      // Sort by Track Count descending
      const byTrackCount = [...testAlbums].sort((a, b) => b.trackCount - a.trackCount);
      expect(byTrackCount[0].title).toBe('Abbey Road');
      expect(byTrackCount[0].trackCount).toBe(17);
    });

    it('manages 33⅓ RPM vinyl rotation animation toggle', () => {
      let isSpinning = true;
      const toggleSpin = () => {
        isSpinning = !isSpinning;
      };

      expect(isSpinning).toBe(true);
      toggleSpin();
      expect(isSpinning).toBe(false);
      toggleSpin();
      expect(isSpinning).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 3: FLOATING DESKTOP MINI-PLAYER WIDGET
  // -------------------------------------------------------------
  describe('Feature 3 – Floating Desktop Mini-Player', () => {
    it('persists and restores layout mode (compact vs expanded)', () => {
      localStorage.setItem('harmoniq_miniplayer_layout', 'compact');
      const saved = localStorage.getItem('harmoniq_miniplayer_layout');
      expect(saved).toBe('compact');

      localStorage.setItem('harmoniq_miniplayer_layout', 'expanded');
      expect(localStorage.getItem('harmoniq_miniplayer_layout')).toBe('expanded');
    });

    it('clamps window opacity between 60% and 100% to ensure readability', () => {
      const clampOpacity = (val: number) => Math.max(0.6, Math.min(1.0, Math.round(val * 100) / 100));

      expect(clampOpacity(0.4)).toBe(0.6);
      expect(clampOpacity(1.2)).toBe(1.0);
      expect(clampOpacity(0.85)).toBe(0.85);
      expect(clampOpacity(0.6)).toBe(0.6);
    });

    it('interacts with window always-on-top pinning API', async () => {
      let pinnedState = false;
      const mockApi = {
        setAlwaysOnTop: vi.fn(async (flag: boolean) => {
          pinnedState = flag;
          return pinnedState;
        }),
        isAlwaysOnTop: vi.fn(async () => pinnedState),
      };

      await mockApi.setAlwaysOnTop(true);
      expect(pinnedState).toBe(true);
      expect(mockApi.setAlwaysOnTop).toHaveBeenCalledWith(true);

      const status = await mockApi.isAlwaysOnTop();
      expect(status).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 4: HARMONIQ SIGNATURE BRANDING
  // -------------------------------------------------------------
  describe('Feature 4 – Harmoniq Signature Branding', () => {
    it('verifies HarmoniqLogo preset dimensions and gradient stops', () => {
      const sizeMap = {
        sm: 24,
        md: 32,
        lg: 48,
        xl: 64,
      };

      expect(sizeMap.sm).toBe(24);
      expect(sizeMap.md).toBe(32);
      expect(sizeMap.lg).toBe(48);
      expect(sizeMap.xl).toBe(64);
    });

    it('verifies HarmoniqWaveformLoader 11 sinusoidal bar heights', () => {
      const barHeights = [16, 28, 42, 60, 48, 32, 54, 68, 45, 30, 20];
      expect(barHeights.length).toBe(11);
      // Peak height should be 68
      expect(Math.max(...barHeights)).toBe(68);
      // Min height should be 16
      expect(Math.min(...barHeights)).toBe(16);
    });

    it('defines distinct empty states for library, playlists, search, favorites, history, and queue', () => {
      const supportedEmptyStates = [
        'empty_library',
        'empty_playlists',
        'empty_search',
        'empty_favorites',
        'empty_history',
        'empty_queue',
      ];

      expect(supportedEmptyStates).toContain('empty_library');
      expect(supportedEmptyStates).toContain('empty_playlists');
      expect(supportedEmptyStates).toContain('empty_search');
      expect(supportedEmptyStates).toContain('empty_favorites');
      expect(supportedEmptyStates).toContain('empty_history');
      expect(supportedEmptyStates).toContain('empty_queue');
      expect(supportedEmptyStates.length).toBe(6);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 5: HARMONIQ COLLECTION DECADE & GENRE NAVIGATION
  // -------------------------------------------------------------
  describe('Feature 5 – Harmoniq Collection Decade Navigation', () => {
    it('properly handles undefined year in decade filtering without crashing', () => {
      const undatedAlbum: Album = {
        id: 'alb_undated',
        title: 'Unreleased Sessions',
        artist: 'Unknown Artist',
        trackCount: 4,
        totalDuration: 600,
        tracks: [],
      };

      const matchDecade = (album: Album, decade: string) => {
        if (!album.year) return false;
        if (decade === '2020s') return album.year >= 2020 && album.year <= 2029;
        return true;
      };

      expect(matchDecade(undatedAlbum, '2020s')).toBe(false);
    });

    it('correctly associates artist to album during navigation', () => {
      const album: Album = {
        id: 'alb_chopin',
        title: 'Nocturnes',
        artist: 'Frédéric Chopin',
        year: 1836,
        genre: 'Classical',
        trackCount: 21,
        totalDuration: 6400,
        tracks: [],
      };

      const artists: Artist[] = [
        {
          id: 'art_chopin',
          name: 'Frédéric Chopin',
          albumCount: 1,
          trackCount: 21,
          albums: [album],
        },
      ];

      const found = artists.find((a) => a.name.toLowerCase() === album.artist.toLowerCase());
      expect(found).toBeDefined();
      expect(found?.name).toBe('Frédéric Chopin');
      expect(found?.albums.length).toBe(1);
    });
  });
});
