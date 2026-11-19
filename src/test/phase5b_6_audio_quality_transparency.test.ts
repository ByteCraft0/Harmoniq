import { describe, it, expect } from 'vitest';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, LimiterMetrics } from '../types/dsp';

describe('Phase 5B.6: Audio Quality Transparency & Truthful Reporting', () => {
  const baseTrack: TrackMetadata = {
    id: 'track_1',
    title: 'Test Symphony',
    artist: 'Test Orchestra',
    album: 'Audiophile Sessions',
    duration: 320,
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    codec: 'FLAC',
    container: 'flac',
    isLossless: true,
    filePath: 'C:\\Music\\test.flac',
    fileName: 'test.flac',
    fileSize: 35000000,
    dateModified: Date.now(),
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  const defaultDsp: DSPSettings = {
    enabled: true,
    eqMode: 'graphic',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    parametricFilters: [],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    balance: 0,
    monoMix: false,
    channelMode: 'stereo',
    limiterEnabled: true,
    activePresetId: 'flat',
    stereoWidth: 100,
    stereoWidthEnabled: false,
  };

  const cleanLimiter: LimiterMetrics = {
    gainReductionDb: 0,
    peakLevel: -6,
    isClippingPrevented: false,
  };

  const mockAudioContext = {
    sampleRate: 48000,
  } as unknown as AudioContext;

  describe('1. Truthful Quality Tier Classification', () => {
    it('classifies 16-bit 44.1kHz lossless audio as Lossless (CD Quality)', () => {
      const tier = AudioQualityService.calculateQualityTier(baseTrack);
      expect(tier).toBe('Lossless');
    });

    it('classifies 24-bit 96kHz lossless audio as Hi-Res Lossless', () => {
      const hiResTrack: TrackMetadata = {
        ...baseTrack,
        bitrate: 4608,
        sampleRate: 96000,
        bitDepth: 24,
      };
      const tier = AudioQualityService.calculateQualityTier(hiResTrack);
      expect(tier).toBe('Hi-Res Lossless');
    });

    it('classifies 24-bit 44.1kHz lossless audio as Hi-Res Lossless based on bit depth', () => {
      const track: TrackMetadata = {
        ...baseTrack,
        bitDepth: 24,
        sampleRate: 44100,
      };
      expect(AudioQualityService.calculateQualityTier(track)).toBe('Hi-Res Lossless');
    });

    it('classifies 16-bit 96kHz lossless audio as Hi-Res Lossless based on high sample rate', () => {
      const track: TrackMetadata = {
        ...baseTrack,
        bitDepth: 16,
        sampleRate: 96000,
      };
      expect(AudioQualityService.calculateQualityTier(track)).toBe('Hi-Res Lossless');
    });

    it('classifies lossy audio >= 256kbps as High Quality', () => {
      const mp3Track: TrackMetadata = {
        ...baseTrack,
        codec: 'MP3',
        isLossless: false,
        bitrate: 320,
        bitDepth: undefined,
      };
      expect(AudioQualityService.calculateQualityTier(mp3Track)).toBe('High Quality');
    });

    it('classifies lossy audio < 256kbps as Standard', () => {
      const mp3Track: TrackMetadata = {
        ...baseTrack,
        codec: 'MP3',
        isLossless: false,
        bitrate: 192,
        bitDepth: undefined,
      };
      expect(AudioQualityService.calculateQualityTier(mp3Track)).toBe('Standard');
    });
  });

  describe('2. Perceptual Lossy vs Lossless Codec Transparency', () => {
    it('omits discrete PCM bit depth for perceptual lossy formats to avoid deceptive reporting', () => {
      const lossyTrack: TrackMetadata = {
        ...baseTrack,
        codec: 'MP3',
        isLossless: false,
        bitDepth: 16, // Corrupted / inaccurate tag on lossy file
      };

      const report = AudioQualityService.generateReport(
        lossyTrack,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.source.isLossless).toBe(false);
      expect(report?.source.bitDepthBits).toBeUndefined(); // Lossy codecs do not have discrete PCM bit depth
    });

    it('faithfully preserves bit depth for true PCM / lossless formats', () => {
      const flac24: TrackMetadata = {
        ...baseTrack,
        codec: 'FLAC',
        isLossless: true,
        bitDepth: 24,
        sampleRate: 96000,
      };

      const report = AudioQualityService.generateReport(
        flac24,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );

      expect(report?.source.bitDepthBits).toBe(24);
      expect(report?.source.sampleRateHz).toBe(96000);
      expect(report?.source.isLossless).toBe(true);
    });

    it('provides descriptive names for all standard codecs', () => {
      expect(AudioQualityService.getCodecDetail('FLAC')).toContain('Free Lossless');
      expect(AudioQualityService.getCodecDetail('ALAC')).toContain('Apple Lossless');
      expect(AudioQualityService.getCodecDetail('WAV')).toContain('Linear PCM');
      expect(AudioQualityService.getCodecDetail('AIFF')).toContain('Audio Interchange');
      expect(AudioQualityService.getCodecDetail('MP3')).toContain('MPEG-1');
      expect(AudioQualityService.getCodecDetail('AAC')).toContain('Advanced Audio Coding');
      expect(AudioQualityService.getCodecDetail('OPUS')).toContain('Opus');
      expect(AudioQualityService.getCodecDetail('OGG')).toContain('Ogg Vorbis');
    });

    it('identifies channel layouts accurately', () => {
      expect(AudioQualityService.getChannelLayout(1)).toBe('Mono');
      expect(AudioQualityService.getChannelLayout(2)).toBe('Stereo');
      expect(AudioQualityService.getChannelLayout(6)).toBe('5.1 Surround');
      expect(AudioQualityService.getChannelLayout(8)).toBe('7.1 Surround');
    });
  });

  describe('3. Active DSP Stages & Resampling Diagnosis', () => {
    it('detects when resampling occurs between source file and hardware output endpoint', () => {
      const source44k: TrackMetadata = {
        ...baseTrack,
        sampleRate: 44100,
      };

      const report = AudioQualityService.generateReport(
        source44k,
        mockAudioContext, // 48000 Hz
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );

      expect(report?.processing.isResampling).toBe(true);
      expect(report?.processing.sourceSampleRateHz).toBe(44100);
      expect(report?.processing.outputSampleRateHz).toBe(48000);
      expect(report?.processing.resamplingExplanation).toContain('44.1 kHz');
      expect(report?.processing.resamplingExplanation).toContain('48 kHz');
    });

    it('detects when source sample rate natively matches output hardware rate', () => {
      const source48k: TrackMetadata = {
        ...baseTrack,
        sampleRate: 48000,
      };

      const report = AudioQualityService.generateReport(
        source48k,
        mockAudioContext, // 48000 Hz
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );

      expect(report?.processing.isResampling).toBe(false);
      expect(report?.processing.resamplingExplanation).toContain('No resampling needed');
    });

    it('correctly audits and enumerates all active DSP processing stages', () => {
      const activeDsp: DSPSettings = {
        ...defaultDsp,
        enabled: true,
        eqMode: 'graphic',
        bands: [3, 0, -2, 0, 0, 0, 1.5, 0, 0, -3], // 4 active bands
        preamp: -1.5,
        bassBoost: 4,
        treble: 2,
        stereoWidth: 125,
        stereoWidthEnabled: true,
        channelMode: 'mono',
      };

      const clippingLimiter: LimiterMetrics = {
        ...cleanLimiter,
        isClippingPrevented: true,
        gainReductionDb: 1.8,
      };

      const report = AudioQualityService.generateReport(
        baseTrack,
        mockAudioContext,
        activeDsp,
        clippingLimiter,
        0.85,
        true
      );

      expect(report?.processing.isDspEnabled).toBe(true);
      const stages = report?.processing.activeDspStages || [];
      expect(stages.some((s) => s.includes('10-Band Graphic EQ (4 active bands)'))).toBe(true);
      expect(stages.some((s) => s.includes('Preamp (-1.5 dB)'))).toBe(true);
      expect(stages.some((s) => s.includes('Bass Boost (+4.0 dB)'))).toBe(true);
      expect(stages.some((s) => s.includes('Treble (+2.0 dB)'))).toBe(true);
      expect(stages.some((s) => s.includes('Mid-Side Stereo Width (125%)'))).toBe(true);
      expect(stages.some((s) => s.includes('Channel Matrix (mono)'))).toBe(true);
      expect(stages.some((s) => s.includes('Anti-Clipping Limiter (-1.8 dB reduction)'))).toBe(true);
    });
  });

  describe('4. Windows Shared Mode & Bit-Perfect Transparency', () => {
    it('truthfully reports Windows Shared Mode driver without claiming nonexistent WASAPI Exclusive', () => {
      const report = AudioQualityService.generateReport(
        baseTrack,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        false,
        'Realtek High Definition Audio'
      );

      expect(report?.output.deviceName).toBe('Realtek High Definition Audio');
      expect(report?.output.driverMode).toContain('Windows Shared Mode (WASAPI Shared)');
      expect(report?.bitPerfect.isBitPerfect).toBe(false);
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Windows Shared Mode'))).toBe(true);
    });

    it('reports lossy source status when playing MP3/AAC audio', () => {
      const mp3Track: TrackMetadata = {
        ...baseTrack,
        codec: 'MP3',
        isLossless: false,
      };

      const report = AudioQualityService.generateReport(
        mp3Track,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );

      expect(report?.bitPerfect.status).toBe('lossy_source');
      expect(report?.bitPerfect.explanation).toContain('lossy perceptual audio');
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Lossy Source'))).toBe(true);
    });

    it('reports volume attenuation when player volume is less than 1.0', () => {
      const report = AudioQualityService.generateReport(
        baseTrack,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        0.75, // 75% volume
        false
      );

      expect(report?.bitPerfect.reasons.some((r) => r.includes('Digital Volume Attenuation: Current volume at 75%'))).toBe(true);
    });

    it('reports ReplayGain scaling when normalization is active', () => {
      const report = AudioQualityService.generateReport(
        baseTrack,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        true // ReplayGain active
      );

      expect(report?.bitPerfect.reasons.some((r) => r.includes('ReplayGain volume normalization'))).toBe(true);
    });

    it('returns null gracefully when no track is provided', () => {
      const report = AudioQualityService.generateReport(
        null,
        mockAudioContext,
        defaultDsp,
        cleanLimiter,
        1.0,
        false
      );
      expect(report).toBeNull();
    });
  });
});
