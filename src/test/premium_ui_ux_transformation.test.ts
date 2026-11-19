import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MusicalNavigation } from '../components/layout/MusicalNavigation';
import { appearanceService } from '../services/appearanceService';
import { DEFAULT_APPEARANCE_SETTINGS } from '../types/appearance';

// In-memory mock for Node test environments
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

if (typeof document === 'undefined') {
  const attrs = new Map<string, string>();
  (global as any).document = {
    documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) || null,
    },
  };
}

describe('Harmoniq: Premium UI/UX Transformation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Part 1: Signature Musical Navigation (Violin & Trumpet)', () => {
    it('renders custom Violin (Back) and Trumpet (Forward) with proper aria-labels and tooltips', () => {
      const html = renderToStaticMarkup(
        React.createElement(MusicalNavigation, {
          canGoBack: true,
          canGoForward: true,
          onGoBack: vi.fn(),
          onGoForward: vi.fn(),
        })
      );

      // Verify aria labels and titles
      expect(html).toContain('aria-label="Go Back"');
      expect(html).toContain('aria-label="Go Forward"');
      expect(html).toContain('title="Go Back (Alt + Left)"');
      expect(html).toContain('title="Go Forward (Alt + Right)"');

      // Verify buttons are not disabled
      expect(html).not.toContain('disabled=""');
    });

    it('disables controls when navigation is unavailable and shows helpful status', () => {
      const html = renderToStaticMarkup(
        React.createElement(MusicalNavigation, {
          canGoBack: false,
          canGoForward: false,
          onGoBack: vi.fn(),
          onGoForward: vi.fn(),
        })
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('title="No previous page"');
      expect(html).toContain('title="No forward page"');
      expect(html).toContain('cursor-not-allowed');
    });

    it('contains custom musical SVG elements rather than generic arrows', () => {
      const html = renderToStaticMarkup(
        React.createElement(MusicalNavigation, {
          canGoBack: true,
          canGoForward: true,
          onGoBack: vi.fn(),
          onGoForward: vi.fn(),
        })
      );

      // Verify Violin bow and body curves
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('M20 5 L4.5 13'); // Left-oriented bow line
      expect(html).toContain('M6 11.5 L3.2 13.5 L5.5 15'); // Left-oriented bow tip
      expect(html).toContain('stroke-width="1.6"');

      // Verify Trumpet piston valves and bell flare
      expect(html).toContain('rx="1"'); // Trumpet valve casing
      expect(html).toContain('ry="4"'); // Trumpet bell rim ellipse
    });
  });

  describe('Part 8: Appearance & Animation Settings Service', () => {
    it('initializes with default appearance settings', () => {
      const settings = appearanceService.getSettings();
      expect(settings.animationsEnabled).toBe(true);
      expect(settings.animationIntensity).toBe('normal');
      expect(settings.reducedMotion).toBe(false);
      expect(settings.hoverEffects).toBe(true);
      expect(settings.albumArtworkAnimations).toBe(true);
      expect(settings.ambientLighting).toBe(true);
    });

    it('updates settings, persists to localStorage, and updates document attributes immediately', () => {
      appearanceService.updateSettings({
        animationsEnabled: false,
        animationIntensity: 'subtle',
        reducedMotion: true,
        hoverEffects: false,
        albumArtworkAnimations: false,
        ambientLighting: false,
      });

      const updated = appearanceService.getSettings();
      expect(updated.animationsEnabled).toBe(false);
      expect(updated.animationIntensity).toBe('subtle');
      expect(updated.reducedMotion).toBe(true);
      expect(updated.hoverEffects).toBe(false);
      expect(updated.albumArtworkAnimations).toBe(false);
      expect(updated.ambientLighting).toBe(false);

      // Verify DOM attributes for styling
      expect(document.documentElement.getAttribute('data-animations')).toBe('disabled');
      expect(document.documentElement.getAttribute('data-animation-intensity')).toBe('subtle');
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
      expect(document.documentElement.getAttribute('data-hover-effects')).toBe('disabled');
      expect(document.documentElement.getAttribute('data-album-animations')).toBe('disabled');
      expect(document.documentElement.getAttribute('data-ambient-lighting')).toBe('disabled');

      // Verify localStorage persistence
      const savedRaw = localStorage.getItem('harmoniq_appearance_settings_v1');
      expect(savedRaw).toBeDefined();
      const saved = JSON.parse(savedRaw!);
      expect(saved.animationsEnabled).toBe(false);
    });

    it('notifies subscribers on setting change', () => {
      const listener = vi.fn();
      const unsub = appearanceService.subscribe(listener);

      appearanceService.updateSettings({ animationIntensity: 'enhanced' });
      expect(listener).toHaveBeenCalled();
      expect(appearanceService.getSettings().animationIntensity).toBe('enhanced');

      unsub();
      // After unsubscribing, call count should not increase further
      const callsBefore = listener.mock.calls.length;
      appearanceService.updateSettings({ animationIntensity: 'subtle' });
      expect(listener.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('Part 1: Navigation History Stack Logic', () => {
    it('manages back/forward history stacks without duplicate entries', () => {
      interface HistoryEntry {
        view: string;
      }
      let history: HistoryEntry[] = [{ view: 'home' }];
      let currentIndex = 0;

      const recordNavigation = (view: string) => {
        if (history[currentIndex]?.view === view) return;
        const truncated = history.slice(0, currentIndex + 1);
        history = [...truncated, { view }];
        currentIndex = history.length - 1;
      };

      const goBack = () => {
        if (currentIndex > 0) currentIndex--;
      };

      const goForward = () => {
        if (currentIndex < history.length - 1) currentIndex++;
      };

      expect(currentIndex).toBe(0);
      expect(history.length).toBe(1);

      // Duplicate click does nothing
      recordNavigation('home');
      expect(history.length).toBe(1);

      // Navigate to discover
      recordNavigation('discover');
      expect(currentIndex).toBe(1);
      expect(history.length).toBe(2);

      // Navigate to library
      recordNavigation('songs');
      expect(currentIndex).toBe(2);
      expect(history.length).toBe(3);

      // Go Back to discover
      goBack();
      expect(currentIndex).toBe(1);
      expect(history[currentIndex].view).toBe('discover');

      // Go Back to home
      goBack();
      expect(currentIndex).toBe(0);
      expect(history[currentIndex].view).toBe('home');

      // Go Forward to discover
      goForward();
      expect(currentIndex).toBe(1);
      expect(history[currentIndex].view).toBe('discover');

      // New navigation from middle drops forward history
      recordNavigation('equalizer');
      expect(currentIndex).toBe(2);
      expect(history.length).toBe(3);
      expect(history[2].view).toBe('equalizer');

      // Forward is no longer available
      const canGoForward = currentIndex < history.length - 1;
      expect(canGoForward).toBe(false);
    });
  });
});
