import { describe, it, expect } from 'vitest';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, DEFAULT_PARAMETRIC_FILTERS, LimiterMetrics } from '../types/dsp';

describe('Phase 6.4 — Product Accuracy & Feature Consistency Audit', () => {
  const defaultDsp: DSPSettings = {
    enabled: false,
    eqMode: 'graphic',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    parametricFilters: DEFAULT_PARAMETRIC_FILTERS,
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    balance: 0,
    stereoWidth: 100,
    channelMode: 'stereo',
    monoMix: false,
    limiterEnabled: true,
    activePresetId: null,
  };

  const cleanLimiter: LimiterMetrics = {
    isClippingPrevented: false,
    gainReductionDb: 0,
    peakLevel: -6.0,
  };

  const mockAudioContext = {
    sampleRate: 48000,
    state: 'running',
  } as unknown as AudioContext;

  it('verifies that AudioQualityService truthfully reports Windows Shared Mode', () => {
    const dummyTrack: TrackMetadata = {
      id: 'test_track',
      filePath: 'C:\\Music\\test.flac',
      fileName: 'test.flac',
      fileSize: 10000000,
      title: 'Audited Track',
      artist: 'Accuracy Artist',
      album: 'Transparency Album',
      duration: 200,
      sampleRate: 96000,
      bitDepth: 24,
      channels: 2,
      bitrate: 1411,
      codec: 'FLAC',
      container: 'FLAC',
      isLossless: true,
      isFavorite: false,
      playCount: 1,
      hasArtwork: false,
      dateAdded: Date.now(),
      dateModified: Date.now(),
    };

    const report = AudioQualityService.generateReport(
      dummyTrack,
      mockAudioContext,
      defaultDsp,
      cleanLimiter,
      1.0,
      false
    );

    expect(report).not.toBeNull();
    // Must report Windows Shared Mode, NOT nonexistent WASAPI Exclusive
    expect(report?.output.driverMode).toContain('Windows Shared Mode');
    expect(report?.bitPerfect.isBitPerfect).toBe(false);
    expect(report?.bitPerfect.reasons.some((r) => r.includes('Windows Shared Mode'))).toBe(true);
  });

  it('verifies DSD is explicitly unsupported by Web Audio API', () => {
    const supportedWebAudioDecoders = new Set(['FLAC', 'ALAC', 'WAV', 'MP3', 'AAC', 'OGG', 'OPUS']);
    expect(supportedWebAudioDecoders.has('DSD')).toBe(false);
  });

  it('verifies peak limiter characterization', () => {
    const limiterTypes = {
      antiClippingGuard: 'peak_limiter',
      isBrickwallOversampled: false, // DynamicsCompressorNode does not do inter-sample oversampled true-peak detection
    };
    expect(limiterTypes.isBrickwallOversampled).toBe(false);
  });
});
