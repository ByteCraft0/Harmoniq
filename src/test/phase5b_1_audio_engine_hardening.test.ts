import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioParameterAutomation, AUTOMATION_TIME_CONSTANTS } from '../services/audio/audioParameterAutomation';
import { StereoWidthProcessor } from '../services/audio/stereoWidthProcessor';
import { audioEngine } from '../services/audioEngine';
import { DSPSettings, DEFAULT_PARAMETRIC_FILTERS } from '../types/dsp';

// Helper to create a fully tracked mock AudioParam
function createMockAudioParam(initialValue = 1.0) {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(function (this: any, val: number, _time: number) {
      this.value = val;
    }),
    setTargetAtTime: vi.fn(function (this: any, val: number, _time: number, _tc: number) {
      this.value = val;
    }),
    linearRampToValueAtTime: vi.fn(function (this: any, val: number, _time: number) {
      this.value = val;
    }),
    exponentialRampToValueAtTime: vi.fn(function (this: any, val: number, _time: number) {
      this.value = val;
    }),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  };
}

// Helper to create a mock AudioContext
function createMockAudioContext(state: AudioContextState = 'running') {
  return {
    state,
    currentTime: 10.5,
    sampleRate: 48000,
    createGain: vi.fn(() => ({
      gain: createMockAudioParam(1.0),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createChannelSplitter: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createChannelMerger: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'peaking',
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1.414),
      gain: createMockAudioParam(0),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFrequencyResponse: vi.fn(),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: createMockAudioParam(-0.5),
      knee: createMockAudioParam(3.0),
      ratio: createMockAudioParam(20.0),
      attack: createMockAudioParam(0.003),
      release: createMockAudioParam(0.1),
      reduction: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createMediaElementSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {},
    close: vi.fn(async function (this: any) {
      this.state = 'closed';
    }),
    resume: vi.fn(async function (this: any) {
      this.state = 'running';
    }),
    suspend: vi.fn(async function (this: any) {
      this.state = 'suspended';
    }),
  } as any;
}

describe('Harmoniq 2.0 - Phase 5B.1: Core Audio Engine Hardening & Smooth Parameter Transitions', () => {
  // =========================================================================
  // Part 1: Centralized Audio Parameter Automation
  // =========================================================================
  describe('Part 1: Centralized Audio Parameter Automation (audioParameterAutomation.ts)', () => {
    it('validates and clamps values correctly against NaN, ±Infinity, and bounds', () => {
      // Normal numbers within bounds
      expect(AudioParameterAutomation.validateValue(0.5, 0, 0, 1)).toBe(0.5);

      // Clamp upper bound
      expect(AudioParameterAutomation.validateValue(15, 0, -12, 12)).toBe(12);

      // Clamp lower bound
      expect(AudioParameterAutomation.validateValue(-25, 0, -12, 12)).toBe(-12);

      // Fallback on NaN
      expect(AudioParameterAutomation.validateValue(NaN, 5.0)).toBe(5.0);

      // Fallback on +Infinity / -Infinity
      expect(AudioParameterAutomation.validateValue(Infinity, 1.0)).toBe(1.0);
      expect(AudioParameterAutomation.validateValue(-Infinity, 1.0)).toBe(1.0);

      // Fallback on non-numbers
      expect(AudioParameterAutomation.validateValue('invalid' as any, 2.5)).toBe(2.5);
      expect(AudioParameterAutomation.validateValue(null as any, 3.0)).toBe(3.0);
      expect(AudioParameterAutomation.validateValue(undefined as any, 4.0)).toBe(4.0);
    });

    it('safely cancels automation using cancelAndHoldAtTime when supported', () => {
      const mockParam = createMockAudioParam(0.75);
      const mockCtx = createMockAudioContext();

      AudioParameterAutomation.cancelAutomation(mockParam as any, mockCtx, true);

      expect(mockParam.cancelAndHoldAtTime).toHaveBeenCalledWith(10.5);
      expect(mockParam.cancelScheduledValues).not.toHaveBeenCalled();
    });

    it('falls back to cancelScheduledValues + setValueAtTime when cancelAndHoldAtTime is absent', () => {
      const mockParam = createMockAudioParam(0.6);
      delete (mockParam as any).cancelAndHoldAtTime;
      const mockCtx = createMockAudioContext();

      AudioParameterAutomation.cancelAutomation(mockParam as any, mockCtx, true);

      expect(mockParam.cancelScheduledValues).toHaveBeenCalledWith(10.5);
      expect(mockParam.setValueAtTime).toHaveBeenCalledWith(0.6, 10.5);
    });

    it('handles smooth transitions with validated time constants and clamped boundaries', () => {
      const mockParam = createMockAudioParam(0.0);
      const mockCtx = createMockAudioContext();

      AudioParameterAutomation.smoothTransition(mockParam as any, 6.0, mockCtx, {
        timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND,
        min: -12,
        max: 12,
      });

      expect(mockParam.setTargetAtTime).toHaveBeenCalledWith(6.0, 10.5, AUTOMATION_TIME_CONSTANTS.EQ_BAND);
      expect(mockParam.value).toBe(6.0);
    });

    it('handles rapid successive updates without throwing or accumulating stale scheduled calls', () => {
      const mockParam = createMockAudioParam(0.0);
      const mockCtx = createMockAudioContext();

      // Simulate rapid user slider dragging (60 updates in a burst)
      for (let i = 0; i <= 60; i++) {
        const target = (i / 60) * 12; // 0 dB to 12 dB
        expect(() => {
          AudioParameterAutomation.smoothTransition(mockParam as any, target, mockCtx, {
            timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND,
          });
        }).not.toThrow();
      }

      expect(mockParam.cancelAndHoldAtTime).toHaveBeenCalledTimes(61);
      expect(mockParam.setTargetAtTime).toHaveBeenCalledTimes(61);
      expect(mockParam.value).toBe(12);
    });

    it('handles closed AudioContext gracefully by assigning param.value directly', () => {
      const mockParam = createMockAudioParam(1.0);
      const mockClosedCtx = createMockAudioContext('closed');

      AudioParameterAutomation.smoothTransition(mockParam as any, 0.5, mockClosedCtx);

      expect(mockParam.value).toBe(0.5);
      expect(mockParam.setTargetAtTime).not.toHaveBeenCalled();
    });

    it('does not throw when param or audioCtx is null or undefined', () => {
      expect(() => {
        AudioParameterAutomation.smoothTransition(null, 1.0, null);
        AudioParameterAutomation.linearRamp(null, 1.0, 1.0, null);
        AudioParameterAutomation.cancelAutomation(null, null);
        AudioParameterAutomation.safeSetValue(null, 1.0, null);
      }).not.toThrow();
    });

    it('linearly ramps values over specified duration', () => {
      const mockParam = createMockAudioParam(0.0);
      const mockCtx = createMockAudioContext();

      AudioParameterAutomation.linearRamp(mockParam as any, 1.0, 4.0, mockCtx, { min: 0, max: 1 });

      expect(mockParam.cancelAndHoldAtTime).toHaveBeenCalledWith(10.5);
      expect(mockParam.linearRampToValueAtTime).toHaveBeenCalledWith(1.0, 14.5);
    });
  });

  // =========================================================================
  // Part 2: Mid-Side Stereo Width Processing
  // =========================================================================
  describe('Part 2: Mid-Side Stereo Width Processing (stereoWidthProcessor.ts)', () => {
    it('initializes in neutral state: 100% width, bypassed by default', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      expect(processor.getWidth()).toBe(100);
      expect(processor.getEnabled()).toBe(false);

      const coeffs = processor.getMatrixCoefficients();
      // At w = 1.0 (100%): G_LL=1, G_RL=0, G_LR=0, G_RR=1 (Exact identity!)
      expect(coeffs.gLL).toBe(1.0);
      expect(coeffs.gRL).toBe(0.0);
      expect(coeffs.gLR).toBe(0.0);
      expect(coeffs.gRR).toBe(1.0);
    });

    it('computes exact 0% mono downmix matrix coefficients', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      processor.setWidth(0, false);
      expect(processor.getWidth()).toBe(0);

      const coeffs = processor.getMatrixCoefficients();
      // At w = 0.0 (0%): G_LL=0.5, G_RL=0.5, G_LR=0.5, G_RR=0.5
      expect(coeffs.gLL).toBe(0.5);
      expect(coeffs.gRL).toBe(0.5);
      expect(coeffs.gLR).toBe(0.5);
      expect(coeffs.gRR).toBe(0.5);
    });

    it('computes exact moderate widening (125%) and maximum widening (150%) coefficients', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      // Moderate widening (125%): w = 1.25 -> (1 + 1.25)/2 = 1.125, (1 - 1.25)/2 = -0.125
      processor.setWidth(125, false);
      const coeffs125 = processor.getMatrixCoefficients();
      expect(coeffs125.gLL).toBe(1.125);
      expect(coeffs125.gRL).toBe(-0.125);
      expect(coeffs125.gLR).toBe(-0.125);
      expect(coeffs125.gRR).toBe(1.125);

      // Maximum widening (150%): w = 1.50 -> (1 + 1.5)/2 = 1.25, (1 - 1.5)/2 = -0.25
      processor.setWidth(150, false);
      const coeffs150 = processor.getMatrixCoefficients();
      expect(coeffs150.gLL).toBe(1.25);
      expect(coeffs150.gRL).toBe(-0.25);
      expect(coeffs125.gLR).toBe(-0.125);
      expect(coeffs150.gRR).toBe(1.25);
    });

    it('mathematically preserves center-channel signals (L = R) across ALL width settings', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      // Test test widths from 0% to 150%
      const testWidths = [0, 25, 50, 75, 100, 125, 150];
      const testSignals = [0.1, 0.45, 0.707, 1.0];

      for (const wPercent of testWidths) {
        processor.setWidth(wPercent, false);
        const { gLL, gRL, gLR, gRR } = processor.getMatrixCoefficients();

        for (const centerSignal of testSignals) {
          const L = centerSignal;
          const R = centerSignal;

          // Compute L' and R'
          const LPrime = gLL * L + gRL * R;
          const RPrime = gLR * L + gRR * R;

          // For center audio, L' and R' MUST strictly equal centerSignal!
          expect(Math.abs(LPrime - centerSignal)).toBeLessThan(1e-10);
          expect(Math.abs(RPrime - centerSignal)).toBeLessThan(1e-10);
        }
      }
    });

    it('correctly routes left-only and right-only signals', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      // Left-only signal: L = 1.0, R = 0.0
      // At 100% width: L' = 1.0, R' = 0.0
      processor.setWidth(100, false);
      let coeffs = processor.getMatrixCoefficients();
      expect(coeffs.gLL * 1.0 + coeffs.gRL * 0.0).toBe(1.0);
      expect(coeffs.gLR * 1.0 + coeffs.gRR * 0.0).toBe(0.0);

      // At 0% width (mono): L' = 0.5, R' = 0.5
      processor.setWidth(0, false);
      coeffs = processor.getMatrixCoefficients();
      expect(coeffs.gLL * 1.0 + coeffs.gRL * 0.0).toBe(0.5);
      expect(coeffs.gLR * 1.0 + coeffs.gRR * 0.0).toBe(0.5);

      // At 150% width: L' = 1.25, R' = -0.25
      processor.setWidth(150, false);
      coeffs = processor.getMatrixCoefficients();
      expect(coeffs.gLL * 1.0 + coeffs.gRL * 0.0).toBe(1.25);
      expect(coeffs.gLR * 1.0 + coeffs.gRR * 0.0).toBe(-0.25);
    });

    it('clamps width values strictly between 0% and 150%', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      processor.setWidth(-50, false);
      expect(processor.getWidth()).toBe(0);

      processor.setWidth(300, false);
      expect(processor.getWidth()).toBe(150);

      processor.setWidth(NaN, false);
      expect(processor.getWidth()).toBe(100);
    });

    it('smoothly crossfades between active and bypass paths when toggling enabled state', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      processor.setEnabled(true, false);
      expect(processor.getEnabled()).toBe(true);

      processor.setEnabled(false, false);
      expect(processor.getEnabled()).toBe(false);
    });

    it('cleanly disconnects internal nodes on dispose', () => {
      const mockCtx = createMockAudioContext();
      const processor = new StereoWidthProcessor(mockCtx);

      expect(() => processor.dispose()).not.toThrow();
    });
  });

  // =========================================================================
  // Part 3: DSP Integration & Dual-Deck Hardening
  // =========================================================================
  describe('Part 3: DSP Pipeline Integration & Dual-Deck Transitions', () => {
    it('integrates stereo width settings into audioEngine.getDSPSettings() and applyDSPSettings()', () => {
      audioEngine.setStereoWidth(120);
      audioEngine.setStereoWidthEnabled(true);

      const dsp = audioEngine.getDSPSettings();
      expect(dsp.stereoWidth).toBe(120);
      expect(dsp.stereoWidthEnabled).toBe(true);

      // Apply settings directly
      audioEngine.applyDSPSettings({
        ...dsp,
        stereoWidth: 80,
        stereoWidthEnabled: false,
      });

      const updatedDsp = audioEngine.getDSPSettings();
      expect(updatedDsp.stereoWidth).toBe(80);
      expect(updatedDsp.stereoWidthEnabled).toBe(false);
    });

    it('flags bit-perfect status as impaired/disabled when stereo widening is actively engaged', () => {
      audioEngine.setBitPerfectMode(true);
      audioEngine.setStereoWidth(130);
      audioEngine.setStereoWidthEnabled(true);

      const status = audioEngine.getBitPerfectStatus();
      expect(status.disabledFeatures).toContain('Equalizer / Tone Controls');

      // Reset to neutral and disable
      audioEngine.setStereoWidth(100);
      audioEngine.setStereoWidthEnabled(false);
    });

    it('calculates ReplayGain with peak protection ceiling at 0.988 (-0.1 dBFS)', () => {
      const hotTrack = {
        id: 'hot_master',
        title: 'Loud Master',
        artist: 'Loud Artist',
        album: 'Hot',
        duration: 180,
        codec: 'FLAC',
        sampleRate: 44100,
        bitrate: 1000,
        channels: 2,
        filePath: 'hot.flac',
        fileSize: 10000000,
        isLossless: true,
        replayGain: {
          trackGain: 8.0, // +8 dB requested
          trackPeak: 0.99, // Near 1.0 peak
        },
      } as any;

      audioEngine.setReplayGainMode('track');
      const calc = audioEngine.calculateReplayGain(hotTrack);

      expect(calc.isClippingPrevented).toBe(true);
      // Scaled down so linear * peak <= 0.988
      expect(calc.linearGain * 0.99).toBeLessThanOrEqual(0.989);
    });

    it('sets and clamps crossfade duration within supported 0 to 12 seconds range', () => {
      audioEngine.setCrossfadeDuration(5);
      expect(audioEngine.getCrossfadeDuration()).toBe(5);

      audioEngine.setCrossfadeDuration(-10);
      expect(audioEngine.getCrossfadeDuration()).toBe(0);

      audioEngine.setCrossfadeDuration(20);
      expect(audioEngine.getCrossfadeDuration()).toBe(12);

      // Reset to 0 (gapless default)
      audioEngine.setCrossfadeDuration(0);
    });
  });

  // =========================================================================
  // Part 4: AudioEngine Lifecycle Hardening
  // =========================================================================
  describe('Part 4: AudioEngine Lifecycle Hardening (shutdown & disposal)', () => {
    let originalAudioContext: any;
    let originalAudio: any;

    beforeEach(() => {
      originalAudioContext = (globalThis as any).AudioContext;
      originalAudio = (globalThis as any).Audio;

      (globalThis as any).AudioContext = class {
        constructor() {
          return createMockAudioContext();
        }
      };

      (globalThis as any).Audio = class {
        crossOrigin = '';
        preload = '';
        src = '';
        currentTime = 0;
        volume = 1;
        muted = false;
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
      };
    });

    afterEach(async () => {
      await audioEngine.shutdown();
      (globalThis as any).AudioContext = originalAudioContext;
      (globalThis as any).Audio = originalAudio;
    });

    it('is idempotent on repeated initialize() calls without node duplication', async () => {
      await audioEngine.initialize();
      const firstCtx = audioEngine.getAudioContext();

      // Second initialization should return immediately with same context
      await audioEngine.initialize();
      const secondCtx = audioEngine.getAudioContext();

      expect(firstCtx).toBe(secondCtx);
    });

    it('shuts down cleanly and allows re-initialization', async () => {
      await audioEngine.initialize();
      expect(audioEngine.getAudioContext()).not.toBeNull();

      await audioEngine.shutdown();
      expect(audioEngine.getAudioContext()).toBeNull();

      // Can be safely re-initialized after shutdown
      await audioEngine.initialize();
      expect(audioEngine.getAudioContext()).not.toBeNull();
    });
  });
});
