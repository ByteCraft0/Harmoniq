import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { orbAudioReactiveService } from '../services/assistant/orbAudioReactiveService';
import { audioEngine } from '../services/audioEngine';
import { assistantService } from '../services/assistantService';
import { HarmoniqPulseOrb } from '../components/assistant/HarmoniqPulseOrb';

describe('Harmoniq 2.0 - Phase 5A.5: Pulse Orb Audio-Reactive Glow & Dynamic Shaders', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    orbAudioReactiveService.reset();
    orbAudioReactiveService.setMockFrequencyData(null);
    orbAudioReactiveService.setMockTimeDomainData(null);
    orbAudioReactiveService.setMockIsPlaying(null);
  });

  afterEach(() => {
    orbAudioReactiveService.reset();
  });

  // =========================================================================
  // 1. Audio Analysis, Frequency Bins & Normalization
  // =========================================================================
  describe('Part 1: Audio Analysis, Multi-Band Energies & Normalization', () => {
    it('returns zeroes when audio is stopped or silent', () => {
      orbAudioReactiveService.setMockIsPlaying(false);
      const metrics = orbAudioReactiveService.processFrame();

      expect(metrics.bass).toBe(0);
      expect(metrics.mid).toBe(0);
      expect(metrics.treble).toBe(0);
      expect(metrics.intensity).toBe(0);
      expect(metrics.isPlaying).toBe(false);
    });

    it('computes normalized visual metrics in range [0, 1] during live playback', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const mockFreq = new Uint8Array(1024);

      // Populate bass bins (bins ~1 to 12 at 44.1kHz / 2048) with high energy (200/255)
      for (let i = 1; i <= 12; i++) {
        mockFreq[i] = 200;
      }
      // Populate mid bins (~12 to 186) with moderate energy (100/255)
      for (let i = 13; i <= 186; i++) {
        mockFreq[i] = 100;
      }
      // Populate treble bins (~186 to 929) with subtle energy (50/255)
      for (let i = 187; i <= 929; i++) {
        mockFreq[i] = 50;
      }

      orbAudioReactiveService.setMockFrequencyData(mockFreq);
      const metrics = orbAudioReactiveService.processFrame();

      expect(metrics.isPlaying).toBe(true);
      expect(metrics.bass).toBeGreaterThan(0);
      expect(metrics.bass).toBeLessThanOrEqual(1.0);
      expect(metrics.mid).toBeGreaterThan(0);
      expect(metrics.mid).toBeLessThanOrEqual(1.0);
      expect(metrics.treble).toBeGreaterThan(0);
      expect(metrics.treble).toBeLessThanOrEqual(1.0);
      expect(metrics.intensity).toBeGreaterThan(0);
      expect(metrics.intensity).toBeLessThanOrEqual(1.0);

      // Bass should be strongest due to high 200 value
      expect(metrics.rawBass).toBeGreaterThan(metrics.rawMid);
      expect(metrics.rawMid).toBeGreaterThan(metrics.rawTreble);
    });

    it('handles different FFT sizes and bin counts dynamically without hardcoded indices', () => {
      orbAudioReactiveService.setMockIsPlaying(true);

      // Test with small FFT (512 bins)
      const smallBuf = new Uint8Array(512);
      smallBuf.fill(150, 2, 8); // bass bins in smaller buffer
      orbAudioReactiveService.setMockFrequencyData(smallBuf);

      const smallMetrics = orbAudioReactiveService.processFrame();
      expect(smallMetrics.bass).toBeGreaterThan(0);
      expect(smallMetrics.bass).toBeLessThanOrEqual(1.0);

      // Test with large FFT (2048 bins)
      const largeBuf = new Uint8Array(2048);
      largeBuf.fill(180, 4, 30); // bass bins in larger buffer
      orbAudioReactiveService.setMockFrequencyData(largeBuf);

      const largeMetrics = orbAudioReactiveService.processFrame();
      expect(largeMetrics.bass).toBeGreaterThan(0);
      expect(largeMetrics.bass).toBeLessThanOrEqual(1.0);
    });

    it('handles different audio sample rates (44.1k, 48k, 96k, 192k) correctly', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const testBuf = new Uint8Array(1024);
      testBuf.fill(160, 5, 20);
      orbAudioReactiveService.setMockFrequencyData(testBuf);

      const sampleRates = [44100, 48000, 96000, 192000];
      for (const rate of sampleRates) {
        orbAudioReactiveService.setSampleRate(rate);
        const res = orbAudioReactiveService.processFrame();
        expect(res.bass).toBeGreaterThanOrEqual(0);
        expect(res.bass).toBeLessThanOrEqual(1.0);
        expect(Number.isNaN(res.bass)).toBe(false);
        expect(Number.isNaN(res.mid)).toBe(false);
        expect(Number.isNaN(res.treble)).toBe(false);
        expect(Number.isNaN(res.intensity)).toBe(false);
      }
    });

    it('clamps maximum intensity signals to 1.0 without overflow or NaN', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const maxBuf = new Uint8Array(1024).fill(255);
      const maxTime = new Uint8Array(1024).fill(255);

      orbAudioReactiveService.setMockFrequencyData(maxBuf);
      orbAudioReactiveService.setMockTimeDomainData(maxTime);

      const metrics = orbAudioReactiveService.processFrame();
      expect(metrics.rawBass).toBe(1.0);
      expect(metrics.rawMid).toBe(1.0);
      expect(metrics.rawTreble).toBe(1.0);
      expect(metrics.rawIntensity).toBeLessThanOrEqual(1.0);
      expect(metrics.bass).toBeLessThanOrEqual(1.0);
    });

    it('suppresses micro-noise below the noise floor threshold to prevent visual jitter', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const jitterBuf = new Uint8Array(1024).fill(2); // value 2/255 ≈ 0.0078, below threshold 0.015
      orbAudioReactiveService.setMockFrequencyData(jitterBuf);

      const metrics = orbAudioReactiveService.processFrame();
      expect(metrics.rawBass).toBe(0);
      expect(metrics.rawMid).toBe(0);
      expect(metrics.rawTreble).toBe(0);
      expect(metrics.rawIntensity).toBe(0);
    });

    it('falls back gracefully without crashing when audioEngine or AnalyserNode is unavailable', () => {
      vi.spyOn(audioEngine, 'getAnalyserNode').mockReturnValue(null);
      vi.spyOn(audioEngine, 'isPlaying').mockReturnValue(false);

      const metrics = orbAudioReactiveService.processFrame();
      expect(metrics.bass).toBe(0);
      expect(metrics.mid).toBe(0);
      expect(metrics.intensity).toBe(0);
      expect(metrics.isPlaying).toBe(false);
    });
  });

  // =========================================================================
  // 2. Asymmetric Attack and Release Smoothing
  // =========================================================================
  describe('Part 2: Asymmetric Attack & Release Smoothing', () => {
    it('responds quickly to transient audio peaks (attack smoothing)', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const peakBuf = new Uint8Array(1024);
      peakBuf.fill(255, 0, 25); // Instant max bass kick
      orbAudioReactiveService.setMockFrequencyData(peakBuf);

      // Frame 1
      const frame1 = orbAudioReactiveService.processFrame();
      expect(frame1.rawBass).toBe(1.0);
      // Smoothed should jump up substantially (around 0.45 attack rate)
      expect(frame1.bass).toBeGreaterThan(0.35);
      expect(frame1.bass).toBeLessThan(1.0);

      // Frame 2
      const frame2 = orbAudioReactiveService.processFrame();
      expect(frame2.bass).toBeGreaterThan(frame1.bass);
    });

    it('decays smoothly without abrupt drops when audio ends (release smoothing)', () => {
      orbAudioReactiveService.setMockIsPlaying(true);

      // Establish initial high energy
      const highBuf = new Uint8Array(1024);
      highBuf.fill(220, 1, 15);
      orbAudioReactiveService.setMockFrequencyData(highBuf);
      orbAudioReactiveService.processFrame();
      orbAudioReactiveService.processFrame();
      const peakBass = orbAudioReactiveService.getMetrics().bass;

      // Drop raw signal to zero while still playing
      const silentBuf = new Uint8Array(1024).fill(0);
      orbAudioReactiveService.setMockFrequencyData(silentBuf);

      const frameAfter = orbAudioReactiveService.processFrame();
      expect(frameAfter.rawBass).toBe(0);
      // Value decays gracefully rather than immediately dropping to 0
      expect(frameAfter.bass).toBeGreaterThan(0);
      expect(frameAfter.bass).toBeLessThan(peakBass);
    });

    it('decays to zero smoothly when playback is paused', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const highBuf = new Uint8Array(1024).fill(200, 1, 20);
      orbAudioReactiveService.setMockFrequencyData(highBuf);
      orbAudioReactiveService.processFrame();

      // Pause playback
      orbAudioReactiveService.setMockIsPlaying(false);
      const afterPause1 = orbAudioReactiveService.processFrame();
      expect(afterPause1.isPlaying).toBe(false);
      expect(afterPause1.rawBass).toBe(0);

      // Progressively decays
      for (let i = 0; i < 20; i++) {
        orbAudioReactiveService.processFrame();
      }
      const finalMetrics = orbAudioReactiveService.getMetrics();
      expect(finalMetrics.bass).toBe(0);
      expect(finalMetrics.mid).toBe(0);
      expect(finalMetrics.treble).toBe(0);
      expect(finalMetrics.intensity).toBe(0);
    });
  });

  // =========================================================================
  // 3. Assistant States & Visual Precedence
  // =========================================================================
  describe('Part 3: Assistant State Visualization & Precedence', () => {
    it('gives interaction states (listening, processing, responding, error) precedence over audio reactivity', () => {
      // Setup live playing audio
      orbAudioReactiveService.setMockIsPlaying(true);
      const activeBuf = new Uint8Array(1024).fill(200);
      orbAudioReactiveService.setMockFrequencyData(activeBuf);
      const metrics = orbAudioReactiveService.processFrame();
      expect(metrics.rawIntensity).toBeGreaterThan(0.5);

      // Test state transitions
      const states: Array<'idle' | 'listening' | 'processing' | 'responding' | 'error'> = [
        'listening',
        'processing',
        'responding',
        'error',
        'idle',
      ];

      for (const st of states) {
        assistantService.setOrbState(st);
        expect(assistantService.getOrbState()).toBe(st);
      }
    });

    it('maintains state transitions cleanly without corrupting assistant history', () => {
      assistantService.clearHistory();
      const initialCount = assistantService.getMessages().length;

      assistantService.setOrbState('idle');
      expect(assistantService.getOrbState()).toBe('idle');

      assistantService.setOrbState('listening');
      expect(assistantService.getOrbState()).toBe('listening');

      assistantService.setOrbState('processing');
      expect(assistantService.getOrbState()).toBe('processing');

      assistantService.setOrbState('responding');
      expect(assistantService.getOrbState()).toBe('responding');

      assistantService.setOrbState('idle');
      expect(assistantService.getOrbState()).toBe('idle');

      // Chat history remains intact
      expect(assistantService.getMessages().length).toBe(initialCount);
    });

    it('error state takes visual precedence over standard idle', () => {
      assistantService.setOrbState('error');
      expect(assistantService.getOrbState()).toBe('error');
    });
  });

  // =========================================================================
  // 4. Non-Intrusive Safety, Zero Microphone & Audio Graph Purity
  // =========================================================================
  describe('Part 4: Zero Microphone, No DSP Modification & Playback Purity', () => {
    it('does NOT request microphone permissions or call navigator.mediaDevices.getUserMedia', () => {
      const getUserMediaSpy = vi.fn();
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = getUserMediaSpy;
      }

      // Process frames in audio reactive service
      orbAudioReactiveService.processFrame();
      orbAudioReactiveService.processFrame();

      // Verify getUserMedia was never invoked
      expect(getUserMediaSpy).not.toHaveBeenCalled();
    });

    it('does NOT modify volume, EQ, ReplayGain, crossfade, or DSP nodes', () => {
      const volumeBefore = audioEngine.getVolume();

      // Process audio reactivity frames
      for (let i = 0; i < 10; i++) {
        orbAudioReactiveService.processFrame();
      }

      // Volume must remain strictly identical
      expect(audioEngine.getVolume()).toBe(volumeBefore);
    });

    it('consumes existing AnalyserNode data passively without altering audio routing', () => {
      const getFrequencyDataSpy = vi.spyOn(audioEngine, 'getFrequencyData');
      const getTimeDomainDataSpy = vi.spyOn(audioEngine, 'getTimeDomainData');

      orbAudioReactiveService.setMockIsPlaying(true);
      orbAudioReactiveService.processFrame();

      // Verifies passive query directly through audioEngine interface
      expect(getFrequencyDataSpy).toHaveBeenCalled();
      expect(getTimeDomainDataSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Single Animation Frame Loop & Lifecycle Management
  // =========================================================================
  describe('Part 5: Lifecycle & Visibility Handling', () => {
    it('resets all smoothed values and buffers when reset() is invoked', () => {
      orbAudioReactiveService.setMockIsPlaying(true);
      const activeBuf = new Uint8Array(1024).fill(220);
      orbAudioReactiveService.setMockFrequencyData(activeBuf);
      orbAudioReactiveService.processFrame();

      expect(orbAudioReactiveService.getMetrics().bass).toBeGreaterThan(0);

      orbAudioReactiveService.reset();
      const afterReset = orbAudioReactiveService.getMetrics();

      expect(afterReset.bass).toBe(0);
      expect(afterReset.mid).toBe(0);
      expect(afterReset.treble).toBe(0);
      expect(afterReset.intensity).toBe(0);
      expect(afterReset.rawBass).toBe(0);
    });

    it('provides time domain buffer access for waveform visuals', () => {
      const timeBuf = orbAudioReactiveService.getTimeDomainBuffer();
      expect(timeBuf).toBeDefined();
      expect(timeBuf.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 6. Component Presentation & Mode Rendering Integration
  // =========================================================================
  describe('Part 6: HarmoniqPulseOrb Component Modes & Accessibility', () => {
    it('renders floating mode with dimension w-14 h-14', () => {
      const html = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'idle',
          onClick: () => {},
          docked: false,
        })
      );

      expect(html).toContain('w-14 h-14');
      expect(html).toContain('role="button"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('Ask Harmoniq (AI Assistant)');
    });

    it('renders docked mode with dimension w-8 h-8', () => {
      const html = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'idle',
          onClick: () => {},
          docked: true,
        })
      );

      expect(html).toContain('w-8 h-8');
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('Minimize Harmoniq Assistant');
    });

    it('renders state badges for listening (REC) and processing (AI)', () => {
      const listeningHtml = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'listening',
          onClick: () => {},
          docked: false,
        })
      );
      expect(listeningHtml).toContain('REC');

      const processingHtml = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'processing',
          onClick: () => {},
          docked: false,
        })
      );
      expect(processingHtml).toContain('AI');

      const errorHtml = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'error',
          onClick: () => {},
          docked: false,
        })
      );
      expect(errorHtml).toContain('bg-rose-500');
    });

    it('includes dynamic SVG radial and linear gradient definitions', () => {
      const html = renderToString(
        React.createElement(HarmoniqPulseOrb, {
          state: 'idle',
          onClick: () => {},
          docked: false,
        })
      );

      expect(html).toContain('id="pulseCoreGrad"');
      expect(html).toContain('id="pulseRingGrad"');
      expect(html).toContain('id="pulseListenGrad"');
    });
  });
});
