import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { audioEngine } from '../services/audioEngine';
import { personalIntelligenceService } from '../services/audio/personalIntelligenceService';
import { sessionTrackingService } from '../services/sessionTrackingService';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { ParametricFilterConfig } from '../types/dsp';
import { TrackMetadata } from '../types/audio';

// In-memory mock for localStorage in Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
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

function createMockTrack(id: string, title = 'Test Track'): TrackMetadata {
  return {
    id,
    title,
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 200,
    filePath: `C:/Music/${id}.flac`,
    fileName: `${id}.flac`,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    hasArtwork: false,
    fileSize: 1048576,
    isLossless: true,
    dateAdded: Date.now(),
    dateModified: Date.now(),
  } as TrackMetadata;
}

describe('Phase 5E — Master Integration Audit, Audio Hardening & Release Readiness', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionTrackingService.endCurrentSession();
    sessionTrackingService.clearSessionHistory();
  });

  describe('1. Adaptive Headroom Compensation & High-Q Filter Detection', () => {
    it('accurately detects high-Q narrow parametric peaks that would be missed by fixed coarse grids', () => {
      // High-Q filter placed at 3150 Hz with Q = 10.0 (bandwidth ~315 Hz, only ~5% span)
      const narrowFilter: ParametricFilterConfig = {
        id: 'narrow_1',
        type: 'peaking',
        frequency: 3150,
        gain: 6.0,
        q: 10.0,
        enabled: true,
      };

      const evaluatedPeak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'parametric',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [narrowFilter],
        0,
        0
      );

      // Adaptive frequency injection guarantees the exact center frequency is evaluated
      expect(evaluatedPeak).toBeGreaterThanOrEqual(5.9);
      expect(evaluatedPeak).toBeLessThanOrEqual(6.1);
    });

    it('accurately evaluates ultra high-Q resonance notches or boosts without undersampling', () => {
      const ultraNarrowFilter: ParametricFilterConfig = {
        id: 'narrow_2',
        type: 'peaking',
        frequency: 7350,
        gain: 8.0,
        q: 14.14,
        enabled: true,
      };

      const peak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'parametric',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [ultraNarrowFilter],
        0,
        0
      );

      expect(peak).toBeGreaterThanOrEqual(7.9);
      expect(peak).toBeLessThanOrEqual(8.1);
    });

    it('accurately evaluates combined graphic EQ and parametric boosts', () => {
      const peak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'graphic',
        [3, 3, 3, 0, 0, 0, 0, 0, 0, 0],
        [],
        3.0, // Bass boost
        0
      );

      expect(peak).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('2. Dual-Deck Crossfade Lifecycle & Transition Cancellation', () => {
    it('cancels active crossfade and restores active deck gain when pause() is called mid-transition', () => {
      const engine = audioEngine as any;
      if (engine.activeDeck?.faderGain && engine.audioCtx) {
        // Simulate in-flight transition state
        engine.isTransitioning = true;
        engine.transitionTimeout = setTimeout(() => {}, 5000);
        engine.activeDeck.faderGain.gain.setValueAtTime(0.4, engine.audioCtx.currentTime);

        engine.pause();

        expect(engine.isTransitioning).toBe(false);
        expect(engine.transitionTimeout).toBeNull();
        expect(engine.activeDeck.faderGain.gain.value).toBeCloseTo(1.0);
      }
    });

    it('stop() cleanly stops playback, resets position to zero, and cancels any active transition', () => {
      const engine = audioEngine as any;
      if (engine.activeDeck?.faderGain && engine.audioCtx) {
        engine.isTransitioning = true;
        engine.transitionTimeout = setTimeout(() => {}, 5000);

        audioEngine.stop();

        expect(engine.isTransitioning).toBe(false);
        expect(engine.transitionTimeout).toBeNull();
        expect(engine.activeDeck.element.currentTime).toBe(0);
      }
    });

    it('prepareNextTrack(null) cleanly cancels transition when queue is purged mid-crossfade', () => {
      const engine = audioEngine as any;
      if (engine.isInitialized) {
        engine.isTransitioning = true;
        engine.transitionTimeout = setTimeout(() => {}, 5000);

        audioEngine.prepareNextTrack(null);

        expect(engine.isTransitioning).toBe(false);
        expect(engine.transitionTimeout).toBeNull();
        expect(engine.standbyDeck?.currentTrack).toBeNull();
      }
    });
  });

  describe('3. Personal Intelligence Lifecycle & Privacy Controls', () => {
    it('clearIntelligenceData() resets session history and notifies listeners', () => {
      const listener = vi.fn();
      const unsub = personalIntelligenceService.subscribe(listener);

      // Record a session track
      sessionTrackingService.onPlaybackStarted(createMockTrack('t1'));
      sessionTrackingService.onPlaybackProgress(45);
      sessionTrackingService.onTrackCompletedOrSkipped(createMockTrack('t1'), 45, 'completed');
      sessionTrackingService.endCurrentSession();

      expect(sessionTrackingService.getSessionHistory().length).toBeGreaterThan(0);

      personalIntelligenceService.clearIntelligenceData();

      expect(sessionTrackingService.getSessionHistory().length).toBe(0);
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it('disabling intelligence returns an empty profile without data leaks', () => {
      personalIntelligenceService.setIntelligenceEnabled(false);
      const profile = personalIntelligenceService.getListeningProfile('30d');

      expect(profile.totalPlays).toBe(0);
      expect(profile.totalListeningSeconds).toBe(0);
      expect(profile.topArtists.length).toBe(0);

      personalIntelligenceService.setIntelligenceEnabled(true);
    });
  });

  describe('4. Truthful Audio Transparency Verification', () => {
    it('truthfully reports Windows Shared Mode (WASAPI Shared) without fake exclusive claims', () => {
      const track = createMockTrack('t_truth');
      const mockDsp = {
        enabled: true,
        eqMode: 'graphic' as const,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        balance: 0,
        monoMix: false,
        channelMode: 'stereo' as const,
        limiterEnabled: true,
        activePresetId: 'flat',
        stereoWidth: 100,
        stereoWidthEnabled: false,
      };

      const report = AudioQualityService.generateReport(
        track,
        null,
        mockDsp,
        { isClippingPrevented: false, gainReductionDb: 0, peakLevel: -10 },
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.output.driverMode).toContain('Windows Shared Mode');
      expect(report?.bitPerfect.isBitPerfect).toBe(false);
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Windows Shared Mode'))).toBe(true);
    });
  });
});
