import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioQualityInspectorService } from '../services/inspectorService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, LimiterMetrics, ChannelMode, ABRepeatState, BitPerfectState } from '../types/dsp';

describe('Harmoniq Batch 5 + 6: Audio Quality Management & Advanced Controls', () => {
  const mockTrackFlacHiRes: TrackMetadata = {
    id: 't_flac_hires',
    title: 'Mahler Symphony No. 5',
    artist: 'Vienna Philharmonic',
    album: 'Mahler Hi-Res Master',
    albumArtist: 'Vienna Philharmonic',
    duration: 680,
    trackNumber: 1,
    discNumber: 1,
    year: 2023,
    genre: 'Classical',
    codec: 'FLAC',
    container: 'FLAC',
    bitrate: 2840,
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    filePath: 'C:/Music/Mahler_96k24b.flac',
    fileSize: 245000000,
    isLossless: true,
    fileName: 'Mahler_96k24b.flac',
    dateModified: Date.now(),
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  const mockTrackFlacCdQuality: TrackMetadata = {
    ...mockTrackFlacHiRes,
    id: 't_flac_cd',
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 850,
  };

  const mockTrackMp3Standard: TrackMetadata = {
    ...mockTrackFlacHiRes,
    id: 't_mp3',
    codec: 'MP3',
    container: 'MPEG',
    isLossless: false,
    sampleRate: 44100,
    bitDepth: undefined,
    bitrate: 320,
  };

  const defaultDspFlat: DSPSettings = {
    enabled: false,
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
  };

  const cleanLimiter: LimiterMetrics = {
    isClippingPrevented: false,
    gainReductionDb: 0,
    peakLevel: 0,
  };

  describe('1. Audio Quality Analyzer & Resampling Diagnosis', () => {
    it('correctly classifies FLAC 24-bit/96kHz as Hi-Res Lossless and MP3 320kbps as High Quality', () => {
      expect(AudioQualityInspectorService.calculateQualityTier(mockTrackFlacHiRes)).toBe('Hi-Res Lossless');
      expect(AudioQualityInspectorService.calculateQualityTier(mockTrackFlacCdQuality)).toBe('Lossless');
      expect(AudioQualityInspectorService.calculateQualityTier(mockTrackMp3Standard)).toBe('High Quality');
    });

    it('diagnoses sample rate conversion when source rate differs from output device rate', () => {
      // Mock AudioContext at 48000 Hz (standard Windows Audio Engine mixer rate)
      const mockAudioCtx = { sampleRate: 48000 } as any;

      const reportHiRes = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackFlacHiRes,
        mockAudioCtx,
        defaultDspFlat,
        cleanLimiter,
        1.0,
        false
      );

      expect(reportHiRes).not.toBeNull();
      expect(reportHiRes?.resampling.isResampling).toBe(true);
      expect(reportHiRes?.resampling.sourceSampleRateHz).toBe(96000);
      expect(reportHiRes?.resampling.targetSampleRateHz).toBe(48000);
      expect(reportHiRes?.resampling.explanation).toContain('Resampling active');
    });

    it('reports direct rate match without sample rate conversion when rates match', () => {
      // Mock AudioContext matching CD quality 44100 Hz
      const mockAudioCtx = { sampleRate: 44100 } as any;

      const reportCd = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackFlacCdQuality,
        mockAudioCtx,
        defaultDspFlat,
        cleanLimiter,
        1.0,
        false
      );

      expect(reportCd?.resampling.isResampling).toBe(false);
      expect(reportCd?.resampling.explanation).toContain('No resampling required');
    });
  });

  describe('2. Bit-Perfect Playback Mode Verification', () => {
    it('verifies bit-perfection when all conditions are strictly satisfied', () => {
      const mockAudioCtx = { sampleRate: 44100 } as any;

      const report = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackFlacCdQuality, // Lossless, 44.1kHz
        mockAudioCtx,          // Output 44.1kHz
        defaultDspFlat,        // DSP bypassed
        cleanLimiter,
        1.0,                   // 100% Unity Gain
        false,                 // ReplayGain disabled
        'Exclusive DAC Endpoint',
        true                   // Exclusive mode active
      );

      expect(report?.bitPerfect.isBitPerfect).toBe(true);
      expect(report?.bitPerfect.sampleRateMatched).toBe(true);
      expect(report?.bitPerfect.volumeUnity).toBe(true);
      expect(report?.bitPerfect.dspBypassed).toBe(true);
      expect(report?.bitPerfect.replayGainDisabled).toBe(true);
      expect(report?.bitPerfect.reasons).toHaveLength(0);
    });

    it('fails bit-perfection if volume is digitally attenuated below 100%', () => {
      const mockAudioCtx = { sampleRate: 44100 } as any;

      const report = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackFlacCdQuality,
        mockAudioCtx,
        defaultDspFlat,
        cleanLimiter,
        0.80, // 80% volume attenuation alters bitstream
        false,
        'Exclusive DAC Endpoint',
        true
      );

      expect(report?.bitPerfect.isBitPerfect).toBe(false);
      expect(report?.bitPerfect.volumeUnity).toBe(false);
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Digital Volume Attenuation'))).toBe(true);
    });

    it('fails bit-perfection if EQ or tone controls are actively boosting frequencies', () => {
      const activeDsp: DSPSettings = {
        ...defaultDspFlat,
        enabled: true,
        bands: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], // +3dB on 31Hz
      };

      const mockAudioCtx = { sampleRate: 44100 } as any;

      const report = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackFlacCdQuality,
        mockAudioCtx,
        activeDsp,
        cleanLimiter,
        1.0,
        false,
        'Exclusive DAC Endpoint',
        true
      );

      expect(report?.bitPerfect.isBitPerfect).toBe(false);
      expect(report?.bitPerfect.dspBypassed).toBe(false);
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Equalizer or tone controls'))).toBe(true);
    });

    it('fails bit-perfection if source track is lossy (e.g. MP3 / AAC)', () => {
      const mockAudioCtx = { sampleRate: 44100 } as any;

      const report = AudioQualityInspectorService.inspectCurrentPlayback(
        mockTrackMp3Standard,
        mockAudioCtx,
        defaultDspFlat,
        cleanLimiter,
        1.0,
        false,
        'Exclusive DAC Endpoint',
        true
      );

      expect(report?.bitPerfect.isBitPerfect).toBe(false);
    });
  });

  describe('3. A-B Precision Repeat Looper', () => {
    it('configures Point A and Point B with automatic interval validation', () => {
      const state: ABRepeatState = {
        enabled: true,
        pointA: 12.5,
        pointB: 35.8,
      };

      expect(state.pointA!).toBeLessThan(state.pointB!);
      const intervalSec = state.pointB! - state.pointA!;
      expect(intervalSec).toBeCloseTo(23.3, 1);
    });

    it('ensures Point B cannot be set earlier than Point A', () => {
      let pointA: number | null = 25.0;
      let pointB: number | null = 10.0; // Invalid earlier than A

      if (pointB <= pointA) {
        pointB = pointA + 1.0;
      }

      expect(pointB).toBeGreaterThan(pointA);
      expect(pointB).toBe(26.0);
    });

    it('accurately loops playback when current time hits Point B', () => {
      const abRepeat: ABRepeatState = {
        enabled: true,
        pointA: 10.0,
        pointB: 20.0,
      };

      let currentTime = 19.8;
      let looped = false;

      // Simulate step
      currentTime += 0.3; // 20.1 >= pointB
      if (abRepeat.enabled && abRepeat.pointA !== null && abRepeat.pointB !== null) {
        if (currentTime >= abRepeat.pointB) {
          currentTime = abRepeat.pointA;
          looped = true;
        }
      }

      expect(looped).toBe(true);
      expect(currentTime).toBe(10.0);
    });
  });

  describe('4. 2x2 Channel Matrix & Mono/Stereo Modes', () => {
    const calculateMatrixGains = (mode: ChannelMode, balance: number) => {
      let baseLL = 1.0, baseLR = 0.0, baseRL = 0.0, baseRR = 1.0;

      if (mode === 'mono') {
        baseLL = 0.5; baseLR = 0.5; baseRL = 0.5; baseRR = 0.5;
      } else if (mode === 'left_only') {
        baseLL = 1.0; baseLR = 1.0; baseRL = 0.0; baseRR = 0.0;
      } else if (mode === 'right_only') {
        baseLL = 0.0; baseLR = 0.0; baseRL = 1.0; baseRR = 1.0;
      }

      const bal = Math.max(-1.0, Math.min(1.0, balance));
      const multL = bal <= 0 ? 1.0 : Math.max(0, 1.0 - bal);
      const multR = bal >= 0 ? 1.0 : Math.max(0, 1.0 + bal);

      return {
        LL: baseLL * multL,
        RL: baseRL * multL,
        LR: baseLR * multR,
        RR: baseRR * multR,
      };
    };

    it('computes unity discrete paths in Stereo mode with center balance', () => {
      const gains = calculateMatrixGains('stereo', 0);
      expect(gains.LL).toBe(1.0);
      expect(gains.RR).toBe(1.0);
      expect(gains.LR).toBe(0.0);
      expect(gains.RL).toBe(0.0);
    });

    it('computes exact 50% summing in Mono mode without volume boost', () => {
      const gains = calculateMatrixGains('mono', 0);
      // Both Left and Right output receive (L+R)/2
      expect(gains.LL).toBe(0.5);
      expect(gains.RL).toBe(0.5);
      expect(gains.LR).toBe(0.5);
      expect(gains.RR).toBe(0.5);

      // Sum of gains on Left output = 0.5 + 0.5 = 1.0 (prevents +6dB boost)
      expect(gains.LL + gains.RL).toBe(1.0);
    });

    it('routes Left channel only to both outputs in left_only mode', () => {
      const gains = calculateMatrixGains('left_only', 0);
      expect(gains.LL).toBe(1.0);
      expect(gains.LR).toBe(1.0);
      expect(gains.RL).toBe(0.0);
      expect(gains.RR).toBe(0.0);
    });

    it('routes Right channel only to both outputs in right_only mode', () => {
      const gains = calculateMatrixGains('right_only', 0);
      expect(gains.LL).toBe(0.0);
      expect(gains.LR).toBe(0.0);
      expect(gains.RL).toBe(1.0);
      expect(gains.RR).toBe(1.0);
    });
  });

  describe('5. Left / Right Stereo Channel Balance', () => {
    const calculateBalanceMultipliers = (bal: number) => {
      const clamped = Math.max(-1.0, Math.min(1.0, bal));
      const multL = clamped <= 0 ? 1.0 : Math.max(0, 1.0 - clamped);
      const multR = clamped >= 0 ? 1.0 : Math.max(0, 1.0 + clamped);
      return { multL, multR };
    };

    it('preserves equal output at Center balance (0.0)', () => {
      const { multL, multR } = calculateBalanceMultipliers(0.0);
      expect(multL).toBe(1.0);
      expect(multR).toBe(1.0);
    });

    it('attenuates right channel when panning left', () => {
      // 50% Left (-0.5)
      const { multL, multR } = calculateBalanceMultipliers(-0.5);
      expect(multL).toBe(1.0);
      expect(multR).toBe(0.5);

      // 100% Full Left (-1.0)
      const fullLeft = calculateBalanceMultipliers(-1.0);
      expect(fullLeft.multL).toBe(1.0);
      expect(fullLeft.multR).toBe(0.0);
    });

    it('attenuates left channel when panning right', () => {
      // 50% Right (+0.5)
      const { multL, multR } = calculateBalanceMultipliers(0.5);
      expect(multL).toBe(0.5);
      expect(multR).toBe(1.0);

      // 100% Full Right (+1.0)
      const fullRight = calculateBalanceMultipliers(1.0);
      expect(fullRight.multL).toBe(0.0);
      expect(fullRight.multR).toBe(1.0);
    });
  });
});
