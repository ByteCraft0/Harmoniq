import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parseFile } from 'music-metadata';
import { audioEngine } from '../services/audioEngine';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, DEFAULT_PARAMETRIC_FILTERS, LimiterMetrics } from '../types/dsp';

describe('Harmoniq 2.0 Stage 2: Audio Engine & Playback Validation', () => {
  const testMusicDir = 'C:\\Users\\a2301\\Music\\test_music\\Playlists\\Favorite Songs';

  describe('1. Real Audio File Metadata & Decoding Pipeline', () => {
    it('accurately parses 44.1kHz 320kbps MP3 audio file', async () => {
      const mp3Path = path.join(testMusicDir, 'Justin Bieber - Baby ft. Ludacris - (320 Kbps).mp3');
      if (!fs.existsSync(mp3Path)) {
        console.warn('MP3 test file not found, skipping');
        return;
      }
      const metadata = await parseFile(mp3Path);
      expect(metadata.format.container).toBe('MPEG');
      expect(metadata.format.sampleRate).toBe(44100);
      expect(metadata.format.numberOfChannels).toBe(2);
      expect(metadata.format.duration).toBeGreaterThan(200);
    });

    it('accurately parses 48kHz 24-bit Lossless FLAC file', async () => {
      const flacPath = path.join(testMusicDir, '02 - Just A Word.flac');
      if (!fs.existsSync(flacPath)) {
        console.warn('FLAC 48k test file not found, skipping');
        return;
      }
      const metadata = await parseFile(flacPath);
      expect(metadata.format.container).toBe('FLAC');
      expect(metadata.format.sampleRate).toBe(48000);
      expect(metadata.format.bitsPerSample).toBe(24);
      expect(metadata.format.numberOfChannels).toBe(2);
    });

    it('accurately parses 96kHz 24-bit Hi-Res Lossless FLAC file', async () => {
      const flacHiResPath = path.join(testMusicDir, '04 - Aankhein.flac');
      if (!fs.existsSync(flacHiResPath)) {
        console.warn('Hi-Res FLAC test file not found, skipping');
        return;
      }
      const metadata = await parseFile(flacHiResPath);
      expect(metadata.format.container).toBe('FLAC');
      expect(metadata.format.sampleRate).toBe(96000);
      expect(metadata.format.bitsPerSample).toBe(24);
      expect(metadata.format.numberOfChannels).toBe(2);
    });
  });

  describe('2. Dual-Deck Transition Modes & Timer Lifecycle', () => {
    it('switches transition modes between crossfade, gapless, and fade_out_fade_in', () => {
      audioEngine.setTransitionMode('crossfade');
      expect(audioEngine.getTransitionMode()).toBe('crossfade');

      audioEngine.setTransitionMode('gapless');
      expect(audioEngine.getTransitionMode()).toBe('gapless');

      audioEngine.setTransitionMode('fade_out_fade_in');
      expect(audioEngine.getTransitionMode()).toBe('fade_out_fade_in');
    });

    it('adjusts crossfade duration within calibrated bounds', () => {
      audioEngine.setCrossfadeDuration(6);
      expect(audioEngine.getCrossfadeDuration()).toBe(6);

      audioEngine.setCrossfadeDuration(0);
      expect(audioEngine.getCrossfadeDuration()).toBe(0);

      // Revert to standard 3s
      audioEngine.setCrossfadeDuration(3);
      expect(audioEngine.getCrossfadeDuration()).toBe(3);
    });
  });

  describe('3. Audio Quality Diagnostics & Output Driver Transparency', () => {
    it('generates truthful diagnostics for 96kHz Hi-Res FLAC on Windows Shared Mode', () => {
      const hiResTrack: TrackMetadata = {
        id: 'flac_96k',
        title: 'Aankhein',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 315,
        bitrate: 2800,
        sampleRate: 96000,
        bitDepth: 24,
        channels: 2,
        codec: 'FLAC',
        container: 'flac',
        isLossless: true,
        filePath: 'C:\\Music\\test.flac',
        fileName: 'test.flac',
        fileSize: 88470495,
        dateModified: Date.now(),
        hasArtwork: false,
        playCount: 0,
        isFavorite: false,
      };

      const mockCtx = { sampleRate: 48000 } as unknown as AudioContext;
      const dsp: DSPSettings = {
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
        activePresetId: null,
      };
      const limiter: LimiterMetrics = { gainReductionDb: 0, peakLevel: -12, isClippingPrevented: false };

      const report = AudioQualityService.generateReport(
        hiResTrack,
        mockCtx,
        dsp,
        limiter,
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.source.qualityTier).toBe('Hi-Res Lossless');
      expect(report?.source.sampleRateHz).toBe(96000);
      expect(report?.source.bitDepthBits).toBe(24);
      expect(report?.output.driverMode).toContain('Windows Shared Mode');
      expect(report?.processing.isResampling).toBe(true);
      expect(report?.processing.resamplingExplanation).toContain('converted to 48 kHz');
    });

    it('generates truthful diagnostics for lossy MP3 indicating perceptual compression', () => {
      const mp3Track: TrackMetadata = {
        id: 'mp3_44k',
        title: 'Baby',
        artist: 'Justin Bieber',
        album: 'My World 2.0',
        duration: 219,
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        codec: 'MP3',
        container: 'mp3',
        isLossless: false,
        filePath: 'C:\\Music\\test.mp3',
        fileName: 'test.mp3',
        fileSize: 9444646,
        dateModified: Date.now(),
        hasArtwork: false,
        playCount: 0,
        isFavorite: false,
      };

      const mockCtx = { sampleRate: 48000 } as unknown as AudioContext;
      const dsp: DSPSettings = {
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
        activePresetId: null,
      };
      const limiter: LimiterMetrics = { gainReductionDb: 0, peakLevel: -6, isClippingPrevented: false };

      const report = AudioQualityService.generateReport(
        mp3Track,
        mockCtx,
        dsp,
        limiter,
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.source.qualityTier).toBe('High Quality');
      expect(report?.source.bitDepthBits).toBeUndefined(); // Lossy codecs do not have discrete PCM bit depth
      expect(report?.bitPerfect.status).toBe('lossy_source');
      expect(report?.bitPerfect.explanation).toContain('Bit-perfect transmission is not applicable');
    });
  });

  describe('4. Playback Speed & Pitch Preservation Bounds', () => {
    it('sets playback speed and preserves pitch within standard boundaries', () => {
      audioEngine.setPlaybackRate(1.5);
      expect(audioEngine.getPlaybackRate()).toBe(1.5);

      audioEngine.setPlaybackRate(0.5);
      expect(audioEngine.getPlaybackRate()).toBe(0.5);

      audioEngine.setPlaybackRate(2.0);
      expect(audioEngine.getPlaybackRate()).toBe(2.0);

      // Revert to 1.0x
      audioEngine.setPlaybackRate(1.0);
      expect(audioEngine.getPlaybackRate()).toBe(1.0);
    });
  });
});
