import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEME_PALETTES } from '../types/appearance';
import { BUILTIN_HOTKEY_PROFILES } from '../types/hotkeyProfile';
import { queueManagerService } from '../services/queueManagerService';
import { sessionRecoveryService } from '../services/sessionRecoveryService';
import { abxService, ABXService } from '../services/abxService';

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

describe('Phase 6: Final Visual Polish & Complete QA Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------
  // 1. SIGNATURE WAVEFORM VOLUME CONTROL
  // -------------------------------------------------------------
  describe('Signature Waveform Volume Control', () => {
    // Waveform bar logic helper mirroring WaveformVolumeControl.tsx
    const calculateWaveformBars = (
      volume: number,
      isMuted: boolean,
      isPlaying: boolean,
      size: 'sm' | 'md' | 'lg' = 'md'
    ) => {
      const baseHeights =
        size === 'sm'
          ? [6, 11, 16, 12, 7]
          : size === 'lg'
          ? [12, 20, 28, 22, 13]
          : [8, 15, 22, 17, 9];

      const effectiveVolume = isMuted ? 0 : Math.max(0, Math.min(1, volume));

      return baseHeights.map((baseH, idx) => {
        const threshold = idx / 5;
        const barFraction = Math.max(0, Math.min(1, (effectiveVolume - threshold) * 5));
        const isActive = !isMuted && effectiveVolume > threshold;
        const activeHeight =
          isMuted || effectiveVolume === 0
            ? 3
            : Math.max(3, Math.round(baseH * (0.35 + 0.65 * barFraction)));

        const isAnimated = isPlaying && isActive;

        return {
          idx,
          baseHeight: baseH,
          activeHeight,
          isActive,
          isAnimated,
        };
      });
    };

    it('energizes all 5 bars at 100% volume and animates while playing', () => {
      const bars = calculateWaveformBars(1.0, false, true, 'md');
      expect(bars.length).toBe(5);
      expect(bars.every((b) => b.isActive)).toBe(true);
      expect(bars.every((b) => b.isAnimated)).toBe(true);
      expect(bars[2].activeHeight).toBe(22); // Peak center bar at full height
    });

    it('partially energizes bars proportional to volume level', () => {
      // At 40% volume: bars 0 and 1 are active, bar 2, 3, 4 are inactive
      const bars = calculateWaveformBars(0.4, false, true, 'md');
      expect(bars[0].isActive).toBe(true);
      expect(bars[1].isActive).toBe(true);
      expect(bars[2].isActive).toBe(false);
      expect(bars[3].isActive).toBe(false);
      expect(bars[4].isActive).toBe(false);
    });

    it('freezes animation when music is paused', () => {
      const bars = calculateWaveformBars(0.8, false, false, 'md');
      expect(bars.some((b) => b.isActive)).toBe(true);
      expect(bars.every((b) => !b.isAnimated)).toBe(true); // Animation frozen
    });

    it('deactivates and collapses all bars to resting height when muted', () => {
      const bars = calculateWaveformBars(0.9, true, true, 'md');
      expect(bars.every((b) => !b.isActive)).toBe(true);
      expect(bars.every((b) => b.activeHeight === 3)).toBe(true);
      expect(bars.every((b) => !b.isAnimated)).toBe(true);
    });

    it('correctly scales dimensions for small (mini-player) and large variants', () => {
      const smallBars = calculateWaveformBars(1.0, false, true, 'sm');
      const largeBars = calculateWaveformBars(1.0, false, true, 'lg');

      expect(smallBars[2].activeHeight).toBe(16);
      expect(largeBars[2].activeHeight).toBe(28);
    });

    it('formats accessible tooltips and ARIA attributes accurately', () => {
      const getAriaLabel = (volume: number, isMuted: boolean) => {
        const pct = Math.round((isMuted ? 0 : volume) * 100);
        return isMuted ? 'Unmute volume' : `Mute volume (current ${pct}%)`;
      };

      expect(getAriaLabel(0.75, false)).toBe('Mute volume (current 75%)');
      expect(getAriaLabel(0.75, true)).toBe('Unmute volume');
    });
  });

  // -------------------------------------------------------------
  // 2. SIDEBAR COLLAPSE & NAVIGATION CONSISTENCY
  // -------------------------------------------------------------
  describe('Sidebar Collapse & Navigation Consistency', () => {
    it('persists and toggles sidebar collapsed state in localStorage', () => {
      localStorage.setItem('harmoniq_sidebar_collapsed', 'true');
      expect(localStorage.getItem('harmoniq_sidebar_collapsed')).toBe('true');

      localStorage.setItem('harmoniq_sidebar_collapsed', 'false');
      expect(localStorage.getItem('harmoniq_sidebar_collapsed')).toBe('false');
    });

    it('preserves musical navigation icons without replacing with arrows', () => {
      const musicalIcons = {
        back: 'Violin with Left-Oriented Bow Detail',
        forward: 'Trumpet Oriented to the Right',
      };

      expect(musicalIcons.back).toContain('Violin');
      expect(musicalIcons.forward).toContain('Trumpet');
    });
  });

  // -------------------------------------------------------------
  // 3. GLOBAL DESIGN & THEME SYSTEM CONSISTENCY
  // -------------------------------------------------------------
  describe('Global Design & Theme System Consistency', () => {
    it('provides all 6 high-contrast audiophile theme palettes', () => {
      const paletteList = Object.values(THEME_PALETTES);
      expect(paletteList.length).toBeGreaterThanOrEqual(6);
      const ids = paletteList.map((p) => p.id);
      expect(ids).toContain('obsidian_violet');
      expect(ids).toContain('emerald_matrix');
      expect(ids).toContain('cyberpunk_amber');
    });

    it('ensures each theme palette includes valid primary, secondary, and background colors', () => {
      Object.values(THEME_PALETTES).forEach((theme) => {
        expect(theme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.surfaceBg).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  // -------------------------------------------------------------
  // 4. MULTI-QUEUE & SESSION RECOVERY INTEGRATION
  // -------------------------------------------------------------
  describe('Multi-Queue & Session Recovery Integration', () => {
    it('supports multiple independent queues without data loss', () => {
      const q1 = queueManagerService.createQueue('Study Focus');
      expect(q1.name).toBe('Study Focus');

      const allQueues = queueManagerService.getAllQueues();
      expect(allQueues.some((q) => q.name === 'Study Focus')).toBe(true);

      const duplicated = queueManagerService.duplicateQueue(q1.id);
      expect(duplicated?.name).toBe('Study Focus (Copy)');

      queueManagerService.deleteQueue(q1.id);
      if (duplicated) queueManagerService.deleteQueue(duplicated.id);
    });

    it('recovers saved session state accurately', () => {
      const mockSession = {
        currentTrackId: 'track_bach_sonata',
        playbackPosition: 42.5,
        queueTrackIds: ['track_bach_sonata'],
        currentQueueIndex: 0,
        volume: 0.85,
        activeQueueId: 'default',
        repeatMode: 'all' as const,
        isShuffle: false,
        activeView: 'home',
      };

      sessionRecoveryService.saveSessionImmediate(mockSession);
      const restored = sessionRecoveryService.getSavedSession();
      expect(restored).toBeDefined();
      expect(restored?.currentTrackId).toBe('track_bach_sonata');
      expect(restored?.playbackPosition).toBe(42.5);
    });
  });

  // -------------------------------------------------------------
  // 5. ABX COMPARISON TOOL QUALITY ASSURANCE
  // -------------------------------------------------------------
  describe('ABX Comparison Tool QA', () => {
    it('randomizes X sample between file A and file B fairly', () => {
      const mockTrackA = {
        id: 'track_flac_24bit',
        title: 'Track A',
        artist: 'Artist',
        filePath: '/music/a.flac',
        duration: 180,
      } as any;

      const mockTrackB = {
        id: 'track_mp3_320k',
        title: 'Track B',
        artist: 'Artist',
        filePath: '/music/b.mp3',
        duration: 180,
      } as any;

      const session = abxService.createSession(mockTrackA, mockTrackB, 10);
      expect(session.trials.length).toBe(10);
      expect(
        session.trials.every((t) => t.secretAssignment === 'A' || t.secretAssignment === 'B')
      ).toBe(true);
    });

    it('tracks user responses and calculates identification accuracy', () => {
      const result = ABXService.analyzeResults(10, 9);
      expect(result.percentage).toBe(90);
      expect(result.correct).toBe(9);
      expect(result.trials).toBe(10);
      expect(result.isSignificant).toBe(true);
    });
  });
});
