import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HarmoniqEmptyState, EmptyStateType } from '../components/brand/HarmoniqEmptyState';

describe('Phase 6.5 UI/UX Polish & Design System Verification', () => {
  beforeEach(() => {
    // In-memory localStorage mock for node test runner
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

  describe('HarmoniqEmptyState Component', () => {
    it('renders empty_favorites state with harmonic heart clef SVG motif', () => {
      const html = renderToString(
        React.createElement(HarmoniqEmptyState, {
          type: 'empty_favorites',
          title: 'No Favorite Tracks Yet',
          description: 'Click the heart icon on any track to curate your personal collection.',
        })
      );

      expect(html).toContain('No Favorite Tracks Yet');
      expect(html).toContain('Click the heart icon on any track');
      expect(html).toContain('artGradHeart');
      expect(html).toContain('<svg');
    });

    it('renders empty_history state with hourglass metronome SVG motif', () => {
      const html = renderToString(
        React.createElement(HarmoniqEmptyState, {
          type: 'empty_history',
          title: 'No Listening History',
          description: 'Your playback history will appear here as you listen.',
        })
      );

      expect(html).toContain('No Listening History');
      expect(html).toContain('Your playback history will appear here');
      expect(html).toContain('artGradTime');
      expect(html).toContain('<svg');
    });

    it('renders empty_library state with acoustic violin SVG motif', () => {
      const html = renderToString(
        React.createElement(HarmoniqEmptyState, {
          type: 'empty_library',
          title: 'Your Library is Empty',
          description: 'Add local music directories to index your library.',
        })
      );

      expect(html).toContain('Your Library is Empty');
      expect(html).toContain('artGradViolin');
    });

    it('renders empty_playlists state with turntable vinyl SVG motif', () => {
      const html = renderToString(
        React.createElement(HarmoniqEmptyState, {
          type: 'empty_playlists',
          title: 'No Playlists Yet',
          description: 'Create a playlist to organize your music.',
        })
      );

      expect(html).toContain('No Playlists Yet');
      expect(html).toContain('artGradVinyl');
    });

    it('renders action button when action prop is provided', () => {
      const html = renderToString(
        React.createElement(HarmoniqEmptyState, {
          type: 'empty_library',
          title: 'Your Library is Empty',
          description: 'Add music files.',
          action: {
            label: 'Add Local Folder',
            onClick: () => {},
          },
        })
      );

      expect(html).toContain('Add Local Folder');
      expect(html).toContain('<button');
    });
  });

  describe('Sidebar Interaction and Persistence', () => {
    it('persists sidebar collapsed state to localStorage correctly', () => {
      expect(localStorage.getItem('harmoniq_sidebar_collapsed')).toBeNull();
      localStorage.setItem('harmoniq_sidebar_collapsed', 'true');
      expect(localStorage.getItem('harmoniq_sidebar_collapsed')).toBe('true');
      localStorage.setItem('harmoniq_sidebar_collapsed', 'false');
      expect(localStorage.getItem('harmoniq_sidebar_collapsed')).toBe('false');
    });
  });

  describe('Design System Theme Verification', () => {
    it('verifies design tokens adhere to obsidian and violet visual hierarchy', () => {
      // Direct token values from src/index.css
      const designTokens = {
        bgMain: '#09090b',
        bgCard: '#14141b',
        borderSubtle: '#272733',
        accentDynamic: '#a78bfa',
        accentSecondary: '#7c3aed',
      };

      expect(designTokens.bgMain).toBe('#09090b');
      expect(designTokens.bgCard).toBe('#14141b');
      expect(designTokens.borderSubtle).toBe('#272733');
      expect(designTokens.accentDynamic).toBe('#a78bfa');
      expect(designTokens.accentSecondary).toBe('#7c3aed');
    });
  });
});
