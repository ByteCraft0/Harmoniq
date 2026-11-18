import { describe, it, expect } from 'vitest';
import { AudioQualityInspectorService } from '../services/inspectorService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, LimiterMetrics } from '../types/dsp';

describe('AudioQualityInspectorService', () => {
  const mockTrackFlacHiRes: TrackMetadata = {
    id: 'track1',
    filePath: 'C:/Music/TestHiRes.flac',
    fileName: 'TestHiRes.flac',
    fileSize: 45000000,
    dateModified: Date.now(),
    title: 'Symphony in D',
    artist: 'Harmoniq Orchestra',
    album: 'Audiophile Sessions',
    codec: 'FLAC',
    container: 'FLAC',
    duration: 320,
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 2800,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  const mockTrackFlacCdQuality: TrackMetadata = {
    ...mockTrackFlacHiRes,
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 850,
  };

  const mockTrackMp3High: TrackMetadata = {
    ...mockTrackFlacHiRes,
    codec: 'MP3',
    container: 'MPEG',
    isLossless: false,
    sampleRate: 44100,
    bitDepth: undefined,
    bitrate: 320,
  };

  const mockTrackMp3Standard: TrackMetadata = {
    ...mockTrackMp3High,
    bitrate: 192,
  };

  const defaultDspFlat: DSPSettings = {
    enabled: false, // bypassed
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    balance: 0,
    monoMix: false,
    limiterEnabled: true,
    activePresetId: 'flat',
    eqMode: 'graphic',
    parametricFilters: [],
    channelMode: 'stereo',
  };

  const cleanLimiter: LimiterMetrics = {
    isClippingPrevented: false,
    gainReductionDb: 0,
    peakLevel: 0,
  };

  it('truthfully assigns Hi-Res Lossless tier for 24-bit / 96kHz audio', () => {
    const tier = AudioQualityInspectorService.calculateQualityTier(mockTrackFlacHiRes);
    expect(tier).toBe('Hi-Res Lossless');
  });

  it('truthfully assigns Lossless tier for 16-bit / 44.1kHz audio', () => {
    const tier = AudioQualityInspectorService.calculateQualityTier(mockTrackFlacCdQuality);
    expect(tier).toBe('Lossless');
  });

  it('assigns High Quality tier for lossy audio >= 256 kbps', () => {
    const tier = AudioQualityInspectorService.calculateQualityTier(mockTrackMp3High);
    expect(tier).toBe('High Quality');
  });

  it('assigns Standard tier for lossy audio < 256 kbps', () => {
    const tier = AudioQualityInspectorService.calculateQualityTier(mockTrackMp3Standard);
    expect(tier).toBe('Standard');
  });

  it('detects sample rate conversion (resampling) when source rate != output rate', () => {
    const mockAudioCtx = { sampleRate: 48000 } as AudioContext;
    const report = AudioQualityInspectorService.inspectCurrentPlayback(
      mockTrackFlacHiRes, // 96000 Hz
      mockAudioCtx, // 48000 Hz
      defaultDspFlat,
      cleanLimiter,
      1.0,
      false
    );

    expect(report).not.toBeNull();
    expect(report?.resampling.isResampling).toBe(true);
    expect(report?.resampling.sourceSampleRateHz).toBe(96000);
    expect(report?.resampling.targetSampleRateHz).toBe(48000);
  });

  it('verifies bit-perfect playback when all 5 criteria are fulfilled', () => {
    const mockAudioCtx = { sampleRate: 96000 } as AudioContext;
    const report = AudioQualityInspectorService.inspectCurrentPlayback(
      mockTrackFlacHiRes, // 96000 Hz
      mockAudioCtx, // 96000 Hz
      defaultDspFlat, // DSP Bypassed
      cleanLimiter,
      1.0, // 100% Unity Volume
      false, // ReplayGain off
      'DAC Exclusive Endpoint',
      true // Exclusive mode active
    );

    expect(report?.bitPerfect.isBitPerfect).toBe(true);
    expect(report?.bitPerfect.reasons.length).toBe(0);
  });

  it('diagnoses non-bit-perfect playback if volume is attenuated (< 100%)', () => {
    const mockAudioCtx = { sampleRate: 96000 } as AudioContext;
    const report = AudioQualityInspectorService.inspectCurrentPlayback(
      mockTrackFlacHiRes,
      mockAudioCtx,
      defaultDspFlat,
      cleanLimiter,
      0.8, // 80% volume
      false,
      'DAC Exclusive Endpoint',
      true
    );

    expect(report?.bitPerfect.isBitPerfect).toBe(false);
    expect(report?.bitPerfect.volumeUnity).toBe(false);
    expect(report?.bitPerfect.reasons.some((r) => r.includes('Volume'))).toBe(true);
  });
});
