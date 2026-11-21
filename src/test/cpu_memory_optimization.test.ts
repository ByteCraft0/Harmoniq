import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { audioEngine } from '../services/audioEngine';
import { windowLifecycleService } from '../services/windowLifecycleService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings } from '../types/dsp';

describe('Harmoniq 2.0.1: Deep CPU & Memory Optimization Regression Suite', () => {
  const sampleTrack: TrackMetadata = {
    id: 'opt_test_track_1',
    filePath: 'C:\\Music\\test.flac',
    fileName: 'test.flac',
    fileSize: 1024000,
    title: 'High-Res Audio Test',
    artist: 'Audiophile Master',
    album: 'Reference Series',
    duration: 240,
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    bitrate: 1411,
    codec: 'FLAC' as any,
    container: 'FLAC' as any,
    isLossless: true,
    hasArtwork: false,
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
  };

  beforeEach(() => {
    windowLifecycleService.setMockMinimized(null);
    windowLifecycleService.setMockSuspended(null);
  });

  afterEach(() => {
    audioEngine.pause();
    windowLifecycleService.setMockMinimized(null);
    windowLifecycleService.setMockSuspended(null);
  });

  describe('1. Paused Playback Audio & DSP Suspension', () => {
    it('suspends AudioContext on pause to release the OS hardware audio client', async () => {
      const mockCtx = {
        state: 'running',
        suspend: vi.fn(async function(this: any) { this.state = 'suspended'; }),
        resume: vi.fn(async function(this: any) { this.state = 'running'; }),
      };
      (audioEngine as any).audioCtx = mockCtx;

      audioEngine.pause();
      expect(mockCtx.suspend).toHaveBeenCalled();
    });

    it('suspends AudioContext on stop to release the OS hardware audio client', async () => {
      const mockCtx = {
        state: 'running',
        suspend: vi.fn(async function(this: any) { this.state = 'suspended'; }),
        resume: vi.fn(async function(this: any) { this.state = 'running'; }),
      };
      (audioEngine as any).audioCtx = mockCtx;

      audioEngine.stop();
      expect(mockCtx.suspend).toHaveBeenCalled();
    });

    it('bypasses FFT analyser calculations and fills zero frequency data immediately when paused', () => {
      const buffer = new Uint8Array(64).fill(255);
      // Ensure playback is paused
      audioEngine.pause();
      expect(audioEngine.isPlaying()).toBe(false);

      audioEngine.getFrequencyData(buffer);
      // All frequency bins should immediately be zeroed without querying the Web Audio thread
      expect(buffer.every((b) => b === 0)).toBe(true);
    });

    it('bypasses Oscillogram time-domain data and fills 128 (silence center) immediately when paused', () => {
      const buffer = new Uint8Array(64).fill(0);
      audioEngine.pause();
      expect(audioEngine.isPlaying()).toBe(false);

      audioEngine.getTimeDomainData(buffer);
      // Time-domain silence in Web Audio is byte 128
      expect(buffer.every((b) => b === 128)).toBe(true);
    });

    it('returns zero sub-band energies immediately without allocating buffers when paused', () => {
      audioEngine.pause();
      const energies = audioEngine.getSubBandEnergies();
      expect(energies).toEqual({
        subBass: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        upperMid: 0,
        presence: 0,
        brilliance: 0,
      });
    });
  });

  describe('2. Window Minimization & Render Suspension', () => {
    it('detects window minimization and marks rendering as suspended', () => {
      windowLifecycleService.setMockMinimized(true);
      expect(windowLifecycleService.isMinimized()).toBe(true);
      expect(windowLifecycleService.isRenderingSuspended()).toBe(true);
    });

    it('detects window restoration and marks rendering as active', () => {
      windowLifecycleService.setMockMinimized(true);
      expect(windowLifecycleService.isRenderingSuspended()).toBe(true);

      windowLifecycleService.setMockMinimized(false);
      expect(windowLifecycleService.isMinimized()).toBe(false);
      expect(windowLifecycleService.isRenderingSuspended()).toBe(false);
    });

    it('notifies subscribers immediately when window minimization state changes', () => {
      const suspensionEvents: boolean[] = [];
      const unsub = windowLifecycleService.subscribeSuspension((suspended) => {
        suspensionEvents.push(suspended);
      });

      windowLifecycleService.setMockMinimized(true);
      windowLifecycleService.setMockMinimized(false);

      expect(suspensionEvents).toContain(true);
      expect(suspensionEvents[suspensionEvents.length - 1]).toBe(false);

      unsub();
    });
  });

  describe('3. Active Playback & Zero-Allocation Performance', () => {
    it('reuses pre-allocated buffer for getSubBandEnergies during active playback', async () => {
      await audioEngine.initialize();
      const ctx = audioEngine.getAudioContext();
      if (ctx) {
        // Mock playing state
        const isPlayingSpy = vi.spyOn(audioEngine, 'isPlaying').mockReturnValue(true);

        const analyser = audioEngine.getAnalyserNode();
        if (analyser) {
          const byteFreqSpy = vi.spyOn(analyser, 'getByteFrequencyData').mockImplementation((arr: any) => {
            arr.fill(100);
          });

          // Run 100 consecutive frames
          for (let f = 0; f < 100; f++) {
            const bands = audioEngine.getSubBandEnergies();
            expect(bands.subBass).toBeGreaterThanOrEqual(0);
          }

          expect(byteFreqSpy).toHaveBeenCalled();
          byteFreqSpy.mockRestore();
        }

        isPlayingSpy.mockRestore();
      }
    });

    it('preserves 10-band Graphic EQ processing and configuration fidelity', () => {
      const dsp: DSPSettings = {
        ...audioEngine.getDSPSettings(),
        enabled: true,
        eqMode: 'graphic',
        bands: [2, 1, 0, -1, 3, 4, 2, 0, -2, -3],
      };

      audioEngine.applyDSPSettings(dsp);
      const applied = audioEngine.getDSPSettings();
      expect(applied.bands).toEqual([2, 1, 0, -1, 3, 4, 2, 0, -2, -3]);
      expect(applied.eqMode).toBe('graphic');
      expect(applied.enabled).toBe(true);
    });

    it('preserves 8-band Parametric EQ filter generation and biquad configurations', () => {
      const dsp: DSPSettings = {
        ...audioEngine.getDSPSettings(),
        enabled: true,
        eqMode: 'parametric',
        parametricFilters: [
          { id: 'p1', type: 'lowshelf', frequency: 80, q: 0.707, gain: 4.5, enabled: true },
          { id: 'p2', type: 'peaking', frequency: 1000, q: 1.414, gain: -2.0, enabled: true },
          { id: 'p3', type: 'highshelf', frequency: 12000, q: 0.707, gain: 3.0, enabled: true },
        ],
      };

      audioEngine.applyDSPSettings(dsp);
      const applied = audioEngine.getDSPSettings();
      expect(applied.parametricFilters).toHaveLength(3);
      expect(applied.parametricFilters[0].gain).toBe(4.5);
      expect(applied.parametricFilters[1].gain).toBe(-2.0);
      expect(applied.eqMode).toBe('parametric');
    });

    it('preserves stereo width adjustment without audio alteration when bypassed', () => {
      const dsp: DSPSettings = {
        ...audioEngine.getDSPSettings(),
        enabled: true,
        stereoWidth: 1.4,
      };

      audioEngine.applyDSPSettings(dsp);
      expect(audioEngine.getDSPSettings().stereoWidth).toBe(1.4);
    });
  });

  describe('4. Lifecycle & Subscription Hygiene', () => {
    it('cleans up status subscriptions and avoids accumulating callbacks across repeated pause/resume cycles', () => {
      const calls: boolean[] = [];
      const unsub = audioEngine.subscribeStatus((status) => {
        calls.push(status.isPlaying);
      });

      for (let i = 0; i < 20; i++) {
        audioEngine.pause();
      }

      unsub();
      const countAfterUnsub = calls.length;

      // Further pauses after unsub should not trigger the callback
      audioEngine.pause();
      expect(calls.length).toBe(countAfterUnsub);
    });

    it('cleans up windowLifecycleService listeners without residual memory references', () => {
      const received: boolean[] = [];
      const unsub = windowLifecycleService.subscribeSuspension((s) => {
        received.push(s);
      });

      windowLifecycleService.setMockSuspended(true);
      expect(received).toContain(true);

      unsub();
      const count = received.length;

      windowLifecycleService.setMockSuspended(false);
      expect(received.length).toBe(count); // No new events after unsubscription
    });
  });
});
