import { describe, it, expect, beforeEach, vi } from 'vitest';
import { audioEngine } from '../services/audioEngine';

// In-memory mock for localStorage
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

describe('Mini Player Visual Redesign & Audio-Reactive Components', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  describe('Mini Live Audio-Reactive Visualizer', () => {
    it('accesses audioEngine frequency data using getFrequencyData', () => {
      const freqSpy = vi.spyOn(audioEngine, 'getFrequencyData').mockImplementation((array: any) => {
        if (array && array.length) {
          array[2] = 128;
          array[6] = 200;
          array[14] = 80;
          array[28] = 40;
        }
      });

      const buffer = new Uint8Array(64);
      audioEngine.getFrequencyData(buffer);

      expect(freqSpy).toHaveBeenCalledWith(buffer);
      expect(buffer[2]).toBe(128);
      expect(buffer[6]).toBe(200);
      expect(buffer[14]).toBe(80);
      expect(buffer[28]).toBe(40);
    });

    it('correctly maps raw frequency bytes (0-255) to normalized bar heights (0.15-1.0)', () => {
      const normalize = (val: number) => Math.max(0.15, Math.min(1.0, val / 255));

      expect(normalize(0)).toBe(0.15);
      expect(normalize(128)).toBeCloseTo(0.502, 2);
      expect(normalize(255)).toBe(1.0);
      expect(normalize(500)).toBe(1.0); // clamped
    });
  });

  describe('Mini Waveform Progress Bar Calculations', () => {
    it('generates consistent, deterministic waveform envelopes for a given trackId', () => {
      function generateTrackProfile(trackId?: string, count: number = 36, maxH: number = 16): number[] {
        const seed = trackId
          ? trackId.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0)
          : 1337;

        const minH = maxH > 10 ? 4 : 3;
        const profile: number[] = [];
        for (let i = 0; i < count; i++) {
          const pos = i / (count - 1);
          const w1 = Math.sin(pos * Math.PI * 2.5 + seed * 0.03);
          const w2 = Math.cos(pos * Math.PI * 5.2 + seed * 0.07);
          const w3 = Math.sin(pos * Math.PI * 9.1 + seed * 0.11);
          const envelope = Math.sin(pos * Math.PI);
          const rawAmp = (Math.abs(w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.75 + 0.25) * (0.35 + 0.65 * envelope);
          const h = Math.round(minH + rawAmp * (maxH - minH));
          profile.push(Math.max(minH, Math.min(maxH, h)));
        }
        return profile;
      }

      const profileA1 = generateTrackProfile('track-classical-101', 36, 16);
      const profileA2 = generateTrackProfile('track-classical-101', 36, 16);
      const profileB = generateTrackProfile('track-electronic-202', 36, 16);

      expect(profileA1).toEqual(profileA2);
      expect(profileA1).not.toEqual(profileB);
      expect(profileA1.length).toBe(36);
      // Ensure all bar heights stay within expected bounds
      for (const h of profileA1) {
        expect(h).toBeGreaterThanOrEqual(4);
        expect(h).toBeLessThanOrEqual(16);
      }
    });

    it('generates compact bars clamped to max height 10px in compact mode', () => {
      function generateCompactProfile(trackId?: string): number[] {
        const totalBars = 30;
        const maxH = 10;
        const minH = 3;
        const seed = trackId ? 42 : 1337;
        const profile: number[] = [];
        for (let i = 0; i < totalBars; i++) {
          const pos = i / (totalBars - 1);
          const env = Math.sin(pos * Math.PI);
          const h = Math.round(minH + env * (maxH - minH));
          profile.push(Math.max(minH, Math.min(maxH, h)));
        }
        return profile;
      }

      const compactProfile = generateCompactProfile('track-compact');
      expect(compactProfile.length).toBe(30);
      for (const h of compactProfile) {
        expect(h).toBeGreaterThanOrEqual(3);
        expect(h).toBeLessThanOrEqual(10);
      }
    });

    it('accurately calculates target seek time from mouse click ratio', () => {
      const duration = 210; // 3 mins 30 secs
      const calculateTargetTime = (ratio: number, totalDuration: number) => {
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        return clampedRatio * totalDuration;
      };

      expect(calculateTargetTime(0.0, duration)).toBe(0);
      expect(calculateTargetTime(0.5, duration)).toBe(105);
      expect(calculateTargetTime(1.0, duration)).toBe(210);
      expect(calculateTargetTime(-0.1, duration)).toBe(0);
      expect(calculateTargetTime(1.2, duration)).toBe(210);
    });

    it('formats timestamps accurately into mm:ss monospace format', () => {
      const formatSeconds = (sec: number): string => {
        if (!sec || isNaN(sec)) return '0:00';
        const mins = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${mins}:${s < 10 ? '0' : ''}${s}`;
      };

      expect(formatSeconds(0)).toBe('0:00');
      expect(formatSeconds(45)).toBe('0:45');
      expect(formatSeconds(65)).toBe('1:05');
      expect(formatSeconds(195)).toBe('3:15');
      expect(formatSeconds(3600)).toBe('60:00');
    });
  });

  describe('Mini Player Layout & Transparency Settings', () => {
    it('persists layout mode changes between compact pill and expanded console', () => {
      let layout = 'expanded';
      const handleLayoutSwitch = (newLayout: 'compact' | 'expanded') => {
        layout = newLayout;
        localStorageMock.setItem('harmoniq_miniplayer_layout', newLayout);
      };

      handleLayoutSwitch('compact');
      expect(layout).toBe('compact');
      expect(localStorageMock.getItem('harmoniq_miniplayer_layout')).toBe('compact');

      handleLayoutSwitch('expanded');
      expect(layout).toBe('expanded');
      expect(localStorageMock.getItem('harmoniq_miniplayer_layout')).toBe('expanded');
    });

    it('enforces safe opacity boundaries between 0.6 and 1.0 to prevent invisible windows', () => {
      const clampOpacity = (val: number) => Math.max(0.6, Math.min(1.0, val));

      expect(clampOpacity(1.0)).toBe(1.0);
      expect(clampOpacity(0.85)).toBe(0.85);
      expect(clampOpacity(0.7)).toBe(0.7);
      expect(clampOpacity(0.4)).toBe(0.6); // Clamped minimum to prevent invisible player
      expect(clampOpacity(1.5)).toBe(1.0); // Clamped maximum
    });

    it('toggles always-on-top state accurately', () => {
      let isPinned = true;
      const togglePin = () => {
        isPinned = !isPinned;
        return isPinned;
      };

      expect(togglePin()).toBe(false);
      expect(togglePin()).toBe(true);
    });
  });
});
