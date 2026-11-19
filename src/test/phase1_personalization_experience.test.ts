import { describe, it, expect, beforeEach } from 'vitest';
import { appearanceService } from '../services/appearanceService';
import { THEME_PALETTES, ThemePresetId } from '../types/appearance';
import { statsService } from '../services/statsService';
import { BUILT_IN_PRESETS } from '../types/dsp';

// In-memory mock for localStorage and DOM in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (globalThis as any).localStorage = localStorageMock;
}

if (typeof document === 'undefined') {
  const attributes: Record<string, string> = {};
  const styleProps: Record<string, string> = {};
  (globalThis as any).document = {
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attributes[k] = v;
      },
      getAttribute: (k: string) => attributes[k] || null,
      style: {
        setProperty: (k: string, v: string) => {
          styleProps[k] = v;
        },
        getPropertyValue: (k: string) => styleProps[k] || '',
      },
    },
  };
}

describe('Harmoniq 2.0 – Phase 1: Personalization & Listening Experience', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Theme Palette Engine & Appearance', () => {
    it('provides all 6 curated theme palettes plus custom', () => {
      const paletteIds = Object.keys(THEME_PALETTES) as ThemePresetId[];
      expect(paletteIds).toContain('obsidian_violet');
      expect(paletteIds).toContain('emerald_matrix');
      expect(paletteIds).toContain('cyberpunk_amber');
      expect(paletteIds).toContain('electric_cyan');
      expect(paletteIds).toContain('crimson_velvet');
      expect(paletteIds).toContain('rose_gold');
      expect(paletteIds).toContain('custom');

      for (const id of paletteIds) {
        const pal = THEME_PALETTES[id];
        expect(pal.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(pal.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(pal.name).toBeTruthy();
        expect(pal.description).toBeTruthy();
      }
    });

    it('updates active theme preset, attributes, and styles', () => {
      appearanceService.setThemePreset('emerald_matrix');
      const settings = appearanceService.getSettings();
      expect(settings.themePreset).toBe('emerald_matrix');

      const attr = document.documentElement.getAttribute('data-theme-preset');
      expect(attr).toBe('emerald_matrix');

      const primary = document.documentElement.style.getPropertyValue('--accent-primary');
      expect(primary).toBe(THEME_PALETTES.emerald_matrix.primary);
    });

    it('supports custom hex accent colors', () => {
      appearanceService.setCustomColors('#FF0077', '#990055');
      const settings = appearanceService.getSettings();
      expect(settings.themePreset).toBe('custom');
      expect(settings.customAccentColor).toBe('#FF0077');
      expect(settings.customSecondaryColor).toBe('#990055');

      const primary = document.documentElement.style.getPropertyValue('--accent-primary');
      expect(primary).toBe('#FF0077');
      const secondary = document.documentElement.style.getPropertyValue('--accent-secondary');
      expect(secondary).toBe('#990055');
    });

    it('enables and disables high contrast accessibility mode', () => {
      appearanceService.setHighContrast(true);
      expect(appearanceService.getSettings().highContrastMode).toBe(true);
      expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
      expect(document.documentElement.style.getPropertyValue('--bg-main')).toBe('#000000');

      appearanceService.setHighContrast(false);
      expect(appearanceService.getSettings().highContrastMode).toBe(false);
      expect(document.documentElement.getAttribute('data-high-contrast')).toBe('false');
    });

    it('manages pinned sidebar navigation views', () => {
      expect(appearanceService.isViewPinned('radio')).toBe(false);

      const isPinned = appearanceService.togglePinView('radio');
      expect(isPinned).toBe(true);
      expect(appearanceService.isViewPinned('radio')).toBe(true);
      expect(appearanceService.getSettings().sidebarPinnedViews).toContain('radio');

      const isUnpinned = appearanceService.togglePinView('radio');
      expect(isUnpinned).toBe(false);
      expect(appearanceService.isViewPinned('radio')).toBe(false);
    });
  });

  describe('2. Listening Goals & Streak Tracking', () => {
    it('retrieves default listening goals with progress calculation', () => {
      const goals = statsService.getListeningGoals();
      expect(goals.weeklyTargetHours).toBeGreaterThan(0);
      expect(goals.dailyTargetMinutes).toBeGreaterThan(0);
      expect(goals.weeklyProgressPercent).toBeGreaterThanOrEqual(0);
      expect(goals.weeklyProgressPercent).toBeLessThanOrEqual(100);
      expect(goals.dailyProgressPercent).toBeGreaterThanOrEqual(0);
      expect(goals.dailyProgressPercent).toBeLessThanOrEqual(100);
    });

    it('persists and updates custom goal targets', () => {
      statsService.saveGoalTargets(15, 90);
      const updated = statsService.getListeningGoals();
      expect(updated.weeklyTargetHours).toBe(15);
      expect(updated.dailyTargetMinutes).toBe(90);
    });

    it('evaluates dynamic audiophile milestones', () => {
      const milestones = statsService.getAudiophileMilestones();
      expect(milestones.length).toBe(7);

      const ids = milestones.map((m) => m.id);
      expect(ids).toContain('first_lossless');
      expect(ids).toContain('hires_master');
      expect(ids).toContain('century_club');
      expect(ids).toContain('night_owl');
      expect(ids).toContain('genre_hopper');
      expect(ids).toContain('streak_dedication');
      expect(ids).toContain('marathon_listener');

      for (const m of milestones) {
        expect(m.title).toBeTruthy();
        expect(m.description).toBeTruthy();
        expect(typeof m.unlocked).toBe('boolean');
        expect(m.progress).toBeGreaterThanOrEqual(0);
        expect(m.progress).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('3. DSP Sound Profiles (Harmoniq 2.0 Signatures)', () => {
    it('includes all 4 new signature sound profiles in BUILT_IN_PRESETS', () => {
      const presetIds = BUILT_IN_PRESETS.map((p) => p.id);
      expect(presetIds).toContain('late_night');
      expect(presetIds).toContain('electronic_punch');
      expect(presetIds).toContain('audiophile_warmth');
      expect(presetIds).toContain('spatial_clarity');
    });

    it('has valid gain parameters for each signature profile', () => {
      const profiles = BUILT_IN_PRESETS.filter((p) =>
        ['late_night', 'electronic_punch', 'audiophile_warmth', 'spatial_clarity'].includes(p.id)
      );

      expect(profiles.length).toBe(4);
      for (const profile of profiles) {
        expect(profile.bands.length).toBe(10);
        for (const bandGain of profile.bands) {
          expect(bandGain).toBeGreaterThanOrEqual(-12);
          expect(bandGain).toBeLessThanOrEqual(12);
        }
        expect(profile.preamp).toBeGreaterThanOrEqual(-12);
        expect(profile.preamp).toBeLessThanOrEqual(0);
      }
    });
  });
});
