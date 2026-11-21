import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  SongTableHeader,
  SongRow,
  SONG_TABLE_GRID_WITH_ALBUM,
  SONG_TABLE_GRID_NO_ALBUM,
} from '../components/layout/SongRow';
import { QualityBadge } from '../components/inspector/QualityBadge';
import { HotkeyProfilesCard } from '../components/desktop/HotkeyProfilesCard';
import { hotkeyProfileService } from '../services/hotkeyProfileService';
import { TrackMetadata } from '../types/audio';

// Mock Track for SongRow testing
const createMockTrack = (overrides?: Partial<TrackMetadata>): TrackMetadata => ({
  id: 'test-track-1',
  title: 'Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio',
  artist: 'Ludwig van Beethoven / Vienna Philharmonic Orchestra',
  album: 'Beethoven: Complete Symphonies Master Edition',
  duration: 432,
  filePath: 'C:/Music/beethoven_sym5.flac',
  fileName: 'beethoven_sym5.flac',
  fileSize: 150000000,
  container: 'FLAC',
  codec: 'FLAC',
  bitrate: 1411,
  sampleRate: 96000,
  bitDepth: 24,
  channels: 2,
  hasArtwork: false,
  playCount: 0,
  dateModified: Date.now(),
  isLossless: true,
  isFavorite: false,
  ...overrides,
});

describe('HARMONIQ 2.0.1 — UI Precision Alignment & Text Overflow Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Song Library — Format Badge Alignment & Column Geometry', () => {
    it('defines 120px for the Format column in both album and no-album grid layouts', () => {
      // Format column (120px) precedes the Actions column (76px)
      expect(SONG_TABLE_GRID_WITH_ALBUM).toContain('120px 76px');
      expect(SONG_TABLE_GRID_NO_ALBUM).toContain('120px 76px');

      // Verify the full grid definitions
      expect(SONG_TABLE_GRID_WITH_ALBUM).toBe(
        '56px minmax(140px, 3fr) minmax(120px, 2fr) minmax(100px, 1.8fr) 36px 52px 120px 76px'
      );
      expect(SONG_TABLE_GRID_NO_ALBUM).toBe(
        '56px minmax(180px, 3.5fr) minmax(140px, 2.5fr) 36px 52px 120px 76px'
      );
    });

    it('centers the Format header in SongTableHeader to match centered badge alignment', () => {
      const html = renderToString(<SongTableHeader showAlbum={true} />);
      expect(html).toContain('Format');
      expect(html).toContain('text-center min-w-0');
      expect(html).not.toContain('text-right pr-2 min-w-0">Format');
    });

    it('centers the QualityBadge within its cell in SongRow with zero overflow clipping', () => {
      const mockTrack = createMockTrack();
      const html = renderToString(
        <SongRow
          track={mockTrack}
          index={0}
          isPlaying={false}
          isCurrent={false}
          onPlay={vi.fn()}
          onToggleFavorite={vi.fn()}
          onPlayNext={vi.fn()}
          onAddToQueue={vi.fn()}
          onAddToPlaylist={vi.fn()}
          onContextMenu={vi.fn()}
        />
      );

      // Verify QualityBadge is rendered
      expect(html).toContain('Hi-Res Lossless');

      // Verify cell container has centering and no clipping
      expect(html).toContain('min-w-0 flex items-center justify-center');
      expect(html).not.toContain('min-w-0 pr-2 flex items-center justify-end overflow-hidden');
    });

    it('renders all four QualityBadge tiers cleanly in small size without layout disruption', () => {
      const tiers = ['Hi-Res Lossless', 'Lossless', 'High Quality', 'Standard'] as const;

      for (const tier of tiers) {
        const html = renderToString(<QualityBadge tier={tier} size="sm" />);
        expect(html).toContain(tier);
        expect(html).toContain('px-2');
        expect(html).toContain('tracking-wide');
        expect(html).toContain('h-[18px]');
      }
    });
  });

  describe('2. Settings — Hotkey Profile Card Text Overflow & Responsive Grid', () => {
    it('renders HotkeyProfilesCard with responsive grid and non-overflowing card buttons', () => {
      const html = renderToString(<HotkeyProfilesCard />);

      // Must use responsive grid with 1 to 5 cols adapting across breakpoints
      expect(html).toContain('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3');

      // Card buttons must contain min-w-0, w-full, min-h-[94px], and overflow-hidden to prevent bleeding
      expect(html).toContain('min-w-0 w-full min-h-[94px]');
      expect(html).toContain('overflow-hidden');
    });

    it('renders long profile names with break-words and line-clamp-2 to prevent horizontal overflow', () => {
      const html = renderToString(<HotkeyProfilesCard />);

      // Check specific long profile names like "Audiophile / Minimalist" and "Gaming / Background Friendly"
      expect(html).toContain('Audiophile / Minimalist');
      expect(html).toContain('Gaming / Background Friendly');
      expect(html).toContain('break-words line-clamp-2');
    });

    it('applies charcoal and violet styling to active profile card with active pill badge', () => {
      const html = renderToString(<HotkeyProfilesCard />);

      // Active pill badge
      expect(html).toContain('Active');
      expect(html).toContain('text-[#A78BFA]');

      // Active card button styling
      expect(html).toContain('border-[#8B5CF6]');
      expect(html).toContain('bg-[#181824]');
    });

    it('allows switching hotkey profiles without crashing or layout disturbance', async () => {
      const initialProfile = hotkeyProfileService.getActiveProfile();
      expect(initialProfile).toBeDefined();

      const success = await hotkeyProfileService.setActiveProfile('profile_gaming');
      expect(success).toBe(true);

      const active = hotkeyProfileService.getActiveProfile();
      expect(active.id).toBe('profile_gaming');
      expect(active.scenario).toBe('gaming');

      // Restore to default
      await hotkeyProfileService.setActiveProfile('profile_desktop_default');
    });
  });
});
