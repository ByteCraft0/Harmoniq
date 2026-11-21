import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NowPlayingView } from '../components/views/NowPlayingView';
import { VisualizerView } from '../components/views/VisualizerView';
import { SongRow, SongTableHeader, SONG_TABLE_GRID_WITH_ALBUM, SONG_TABLE_GRID_NO_ALBUM } from '../components/layout/SongRow';
import { HarmoniqAssistantPanel } from '../components/assistant/HarmoniqAssistantPanel';
import { assistantService } from '../services/assistantService';
import { TrackMetadata } from '../types/audio';
import { AssistantMessage } from '../types/assistant';

// Mock PlayerContext
const mockPlayerState = {
  currentTrack: {
    id: 'track-42',
    title: 'Echoes in the Starlight — Audiophile Master Edition with an Extremely Long Title That Needs Graceful Truncation',
    artist: 'Celestial Soundscapes',
    album: 'Cosmic Horizons (2026 Remastered)',
    year: 2026,
    duration: 312,
    codec: 'FLAC',
    sampleRate: 192000,
    bitDepth: 24,
    bitrate: 4608,
    isFavorite: false,
  } as TrackMetadata,
  isPlaying: true,
  currentTime: 120,
  duration: 312,
  volume: 0.85,
  isMuted: false,
  repeatMode: 'off' as const,
  isShuffle: false,
  queue: [],
  abRepeat: {
    pointA: null,
    pointB: null,
    enabled: false,
  },
  setABRepeatPointA: vi.fn(),
  setABRepeatPointB: vi.fn(),
  toggleABRepeat: vi.fn(),
  clearABRepeat: vi.fn(),
  togglePlayPause: vi.fn(),
  seekTo: vi.fn(),
  nextTrack: vi.fn(),
  prevTrack: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
  cycleRepeatMode: vi.fn(),
  toggleShuffle: vi.fn(),
  playTrack: vi.fn(),
  addToQueue: vi.fn(),
  playNext: vi.fn(),
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => mockPlayerState,
}));

vi.mock('../context/LibraryContext', () => ({
  useLibrary: () => ({
    activeView: 'songs',
    setActiveView: vi.fn(),
    toggleFavorite: vi.fn(),
  }),
}));

describe('HARMONIQ 2.0.1 — UI Scroll, AI Orb History & Song Library Alignment Repair', () => {
  beforeEach(() => {
    // In-memory mock localStorage
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };
  });

  // =========================================================================
  // 1. MAIN UI VERTICAL SCROLL REPAIR
  // =========================================================================
  describe('Phase 1: Main UI Vertical Scroll Repair', () => {
    it('establishes NowPlayingView root with bounded h-full and overflow-y-auto', () => {
      const html = renderToString(React.createElement(NowPlayingView));

      // Must have h-full w-full overflow-y-auto to establish a single bounded scroll container
      expect(html).toContain('h-full w-full overflow-y-auto overflow-x-hidden');
      // Must not use min-h-full which previously allowed height to grow to auto and prevent scrolling
      expect(html).not.toContain('min-h-full w-full');
      // Must include bottom padding clearance for BottomPlayer separation
      expect(html).toContain('pb-10');
      // Must maintain clean scrollbar styling
      expect(html).toContain('scrollbar-thin');
    });

    it('establishes VisualizerView root with bounded h-full, gap spacing, and overflow-y-auto', () => {
      const html = renderToString(React.createElement(VisualizerView));

      expect(html).toContain('h-full w-full overflow-y-auto overflow-x-hidden');
      expect(html).toContain('flex flex-col gap-5');
      expect(html).toContain('pb-10');
      // Does not use justify-between which previously clipped scrolling content
      expect(html).not.toContain('justify-between select-none relative p-6 sm:p-8');
    });

    it('ensures all NowPlaying sub-panels (Spectrum, Lyrics, Waveform) render without layout collisions', () => {
      const html = renderToString(React.createElement(NowPlayingView));

      // Live Audio Spectrum panel
      expect(html).toContain('Live Audio Spectrum');
      // Karaoke Lyrics container
      expect(html).toContain('Synchronized Karaoke Lyrics');
      // Timeline Waveform seekbar
      expect(html).toContain('Waveform Mode');
    });
  });

  // =========================================================================
  // 2. AI ORB CONVERSATION HISTORY SCROLL STABILITY
  // =========================================================================
  describe('Phase 2: AI Orb Conversation History Scroll Stability', () => {
    it('renders assistant panel with dedicated scroll container and overscroll containment', () => {
      const html = renderToString(
        React.createElement(HarmoniqAssistantPanel, {
          isOpen: true,
          onClose: vi.fn(),
          hideHeaderOrb: true,
        })
      );

      // Dedicated messages container
      expect(html).toContain('flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scrollbar-thin');
      // Overscroll containment prevents scroll events from leaking to main document
      expect(html).toContain('overscroll-behavior:contain');
    });

    it('preserves existing conversation history across open and close lifecycle', async () => {
      assistantService.clearHistory();

      // Send message to populate history
      await assistantService.sendMessage('How do I enable 10-band DSP Equalizer?', 'equalizer');

      const messages = assistantService.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.some((m) => m.role === 'user')).toBe(true);
      expect(messages.some((m) => m.role === 'assistant')).toBe(true);

      const countBefore = messages.length;

      // Closing and reopening assistant maintains message history
      assistantService.close();
      expect(assistantService.getIsOpen()).toBe(false);
      expect(assistantService.getMessages().length).toBe(countBefore);

      assistantService.open();
      expect(assistantService.getIsOpen()).toBe(true);
      expect(assistantService.getMessages().length).toBe(countBefore);
    });

    it('renders historical messages and action buttons in assistant panel without resetting', () => {
      const html = renderToString(
        React.createElement(HarmoniqAssistantPanel, {
          isOpen: true,
          onClose: vi.fn(),
          hideHeaderOrb: true,
        })
      );

      expect(html).toContain('Harmoniq Assistant');
      expect(html).toContain('How do I enable 10-band DSP Equalizer?');
      expect(html).toContain('Equalizer Studio');
    });

    it('provides copy and speech actions for assistant messages', () => {
      const html = renderToString(
        React.createElement(HarmoniqAssistantPanel, {
          isOpen: true,
          onClose: vi.fn(),
          hideHeaderOrb: true,
        })
      );

      expect(html).toContain('Copy');
      expect(html).toContain('Listen');
    });
  });

  // =========================================================================
  // 3. SONGS LIBRARY FAVORITE HEART ALIGNMENT
  // =========================================================================
  describe('Phase 3: Songs Library Favorite Heart Alignment', () => {
    const testTrack: TrackMetadata = {
      id: 'track-test-favorite',
      title: 'Midnight Horizon (Special Ultra Extended Audiophile Master Mix)',
      artist: 'Acoustic Reverie',
      album: 'Resonance Album',
      duration: 275,
      codec: 'FLAC',
      sampleRate: 96000,
      bitDepth: 24,
      bitrate: 2800,
      isFavorite: true,
    } as TrackMetadata;

    it('defines 8-column grid with dedicated 36px Favorite column and 56px index column (with album)', () => {
      expect(SONG_TABLE_GRID_WITH_ALBUM).toBe(
        '56px minmax(140px, 3fr) minmax(120px, 2fr) minmax(100px, 1.8fr) 36px 52px 120px 76px'
      );
    });

    it('defines 7-column grid with dedicated 36px Favorite column and 56px index column (no album)', () => {
      expect(SONG_TABLE_GRID_NO_ALBUM).toBe(
        '56px minmax(180px, 3.5fr) minmax(140px, 2.5fr) 36px 52px 120px 76px'
      );
    });

    it('renders SongTableHeader with matching CSS grid and dedicated Favorite header icon', () => {
      const htmlWithAlbum = renderToString(
        React.createElement(SongTableHeader, { showAlbum: true })
      );

      expect(htmlWithAlbum).toContain(SONG_TABLE_GRID_WITH_ALBUM);
      expect(htmlWithAlbum).toContain('Title');
      expect(htmlWithAlbum).toContain('Artist');
      expect(htmlWithAlbum).toContain('Album');
      expect(htmlWithAlbum).toContain('Time');
      expect(htmlWithAlbum).toContain('Format');

      const htmlNoAlbum = renderToString(
        React.createElement(SongTableHeader, { showAlbum: false })
      );
      expect(htmlNoAlbum).toContain(SONG_TABLE_GRID_NO_ALBUM);
      expect(htmlNoAlbum).not.toContain('>Album<');
    });

    it('renders SongRow with dedicated Favorite column separated from track title', () => {
      const onToggleFavorite = vi.fn();
      const onToggleSelect = vi.fn();

      const html = renderToString(
        React.createElement(SongRow, {
          track: testTrack,
          index: 0,
          isCurrent: false,
          isPlaying: false,
          showAlbum: true,
          isSelected: false,
          onToggleSelect,
          onPlay: vi.fn(),
          onPlayNext: vi.fn(),
          onAddToQueue: vi.fn(),
          onToggleFavorite,
          onAddToPlaylist: vi.fn(),
          onContextMenu: vi.fn(),
        })
      );

      // Column 1: Checkbox & Track Index
      expect(html).toContain('checkbox');
      expect(html).toContain('1');

      // Column 2: Title with truncate pr-4 min-w-0 without any heart inside
      expect(html).toContain('title="Midnight Horizon (Special Ultra Extended Audiophile Master Mix)"');
      expect(html).toContain('truncate block text-[#F5F3FF] font-medium');

      // Column 5: Dedicated unobstructed Favorite Heart column
      expect(html).toContain('title="Remove Favorite"');
      expect(html).toContain('aria-label="Remove from Favorites"');
      // Red fill for favorite track
      expect(html).toContain('fill-red-500 text-red-500');
      // Clickable area button styling
      expect(html).toContain('w-7 h-7 flex items-center justify-center rounded-lg');
    });

    it('renders non-favorite song row with hover outline heart and Add to Favorites title', () => {
      const nonFavTrack: TrackMetadata = {
        ...testTrack,
        id: 'track-non-fav',
        isFavorite: false,
      };

      const html = renderToString(
        React.createElement(SongRow, {
          track: nonFavTrack,
          index: 4,
          isCurrent: true,
          isPlaying: true,
          showAlbum: true,
          isSelected: true,
          onToggleSelect: vi.fn(),
          onPlay: vi.fn(),
          onPlayNext: vi.fn(),
          onAddToQueue: vi.fn(),
          onToggleFavorite: vi.fn(),
          onAddToPlaylist: vi.fn(),
          onContextMenu: vi.fn(),
        })
      );

      expect(html).toContain('title="Add to Favorites"');
      expect(html).toContain('aria-label="Add to Favorites"');
      expect(html).toContain('text-[#52525B] hover:text-red-400 opacity-0 group-hover:opacity-100');

      // When selected and current, styling is distinguishable
      expect(html).toContain('bg-violet-900/30 border border-violet-500/40 text-violet-200');
      // Animated audio bars for active playing track
      expect(html).toContain('animate-audio-bar-1');
      expect(html).toContain('animate-audio-bar-2');
      expect(html).toContain('animate-audio-bar-3');
    });

    it('renders SongRow without selection checkbox when onToggleSelect is omitted', () => {
      const html = renderToString(
        React.createElement(SongRow, {
          track: testTrack,
          index: 2,
          isCurrent: false,
          isPlaying: false,
          showAlbum: false,
          onPlay: vi.fn(),
          onPlayNext: vi.fn(),
          onAddToQueue: vi.fn(),
          onToggleFavorite: vi.fn(),
          onAddToPlaylist: vi.fn(),
          onContextMenu: vi.fn(),
        })
      );

      // No checkbox rendered
      expect(html).not.toContain('type="checkbox"');
      // Uses 7-column grid
      expect(html).toContain(SONG_TABLE_GRID_NO_ALBUM);
      // Index 3 rendered
      expect(html).toContain('3');
      // Dedicated Favorite Heart rendered
      expect(html).toContain('title="Remove Favorite"');
    });
  });
});
