import { describe, it, expect } from 'vitest';
import { audioEngine } from '../services/audioEngine';
import { TrackMetadata, RepeatMode } from '../types/audio';

describe('Harmoniq – Batch 1: Core Playback Enhancements', () => {
  const track1: TrackMetadata = {
    id: 'track-1',
    filePath: 'C:/Music/Track 1.flac',
    fileName: 'Track 1.flac',
    fileSize: 20000000,
    dateModified: 1000,
    container: 'FLAC',
    bitrate: 900,
    playCount: 0,
    isFavorite: false,
    title: 'The Dark Side of the Moon - Speak to Me',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    duration: 68,
    codec: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    replayGain: {
      trackGain: -4.5,
      trackPeak: 0.95,
      albumGain: -6.0,
      albumPeak: 0.98,
    },
  };

  const track2: TrackMetadata = {
    id: 'track-2',
    filePath: 'C:/Music/Track 2.flac',
    fileName: 'Track 2.flac',
    fileSize: 25000000,
    dateModified: 1000,
    container: 'FLAC',
    bitrate: 1000,
    playCount: 0,
    isFavorite: false,
    title: 'The Dark Side of the Moon - Breathe',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    duration: 169,
    codec: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    replayGain: {
      trackGain: -5.2,
      trackPeak: 0.92,
      albumGain: -6.0,
      albumPeak: 0.98,
    },
  };

  const trackNoRg: TrackMetadata = {
    id: 'track-3',
    filePath: 'C:/Music/Track 3.mp3',
    fileName: 'Track 3.mp3',
    fileSize: 5000000,
    dateModified: 1000,
    container: 'MP3',
    bitrate: 320,
    playCount: 0,
    isFavorite: false,
    title: 'Live Acoustic Jam',
    artist: 'Indie Artist',
    album: 'Unmastered Demos',
    duration: 210,
    codec: 'MP3',
    sampleRate: 44100,
    channels: 2,
    isLossless: false,
    hasArtwork: false,
  };

  const trackHighGainPeak: TrackMetadata = {
    id: 'track-4',
    filePath: 'C:/Music/Track 4.wav',
    fileName: 'Track 4.wav',
    fileSize: 40000000,
    dateModified: 1000,
    container: 'WAV',
    bitrate: 1411,
    playCount: 0,
    isFavorite: false,
    title: 'Quiet Classical Movement',
    artist: 'Symphony Orchestra',
    album: 'Dynamic Recordings',
    duration: 300,
    codec: 'WAV',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    replayGain: {
      trackGain: +9.5, // High boost requested
      trackPeak: 0.85,  // At +9.5 dB, 0.85 * 2.98x = 2.53 -> CLIPPING without protection!
      albumGain: +7.0,
      albumPeak: 0.90,
    },
  };

  // ==========================================
  // 1. GAPLESS PLAYBACK TESTS
  // ==========================================
  describe('1. Gapless Playback Engine', () => {
    it('initializes crossfade duration at 0 by default (Gapless active)', () => {
      audioEngine.setCrossfadeDuration(0);
      expect(audioEngine.getCrossfadeDuration()).toBe(0);
    });

    it('preloads the next track on standby deck without interrupting active playback', () => {
      expect(() => {
        audioEngine.prepareNextTrack(track2);
      }).not.toThrow();
    });

    it('handles queue clearing and empty next tracks gracefully', () => {
      expect(() => {
        audioEngine.prepareNextTrack(null);
      }).not.toThrow();
    });
  });

  // ==========================================
  // 2. CROSSFADE TESTS
  // ==========================================
  describe('2. Crossfade Between Songs', () => {
    it('sets and clamps crossfade duration within the range 1 to 12 seconds', () => {
      // Test valid duration
      audioEngine.setCrossfadeDuration(6);
      expect(audioEngine.getCrossfadeDuration()).toBe(6);

      // Test lower boundary clamp (values < 0 clamp to 0)
      audioEngine.setCrossfadeDuration(-2);
      expect(audioEngine.getCrossfadeDuration()).toBe(0);

      // Test upper boundary clamp (values > 12 clamp to 12)
      audioEngine.setCrossfadeDuration(20);
      expect(audioEngine.getCrossfadeDuration()).toBe(12);

      // Set to 4 seconds for standard test
      audioEngine.setCrossfadeDuration(4);
      expect(audioEngine.getCrossfadeDuration()).toBe(4);
    });

    it('disabling crossfade (0 seconds) restores gapless mode without interference', () => {
      audioEngine.setCrossfadeDuration(0);
      expect(audioEngine.getCrossfadeDuration()).toBe(0);
    });
  });

  // ==========================================
  // 3. VOLUME NORMALIZATION (REPLAYGAIN) TESTS
  // ==========================================
  describe('3. Volume Normalization (ReplayGain)', () => {
    it('applies Track Gain correctly when in track mode', () => {
      audioEngine.setReplayGainMode('track');
      const calc = audioEngine.calculateReplayGain(track1);

      expect(calc.gainDb).toBe(-4.5);
      // Linear gain for -4.5 dB: 10^(-4.5/20) ~= 0.59566
      expect(calc.linearGain).toBeCloseTo(0.596, 2);
      expect(calc.isClippingPrevented).toBe(false);
    });

    it('applies Album Gain correctly when in album mode', () => {
      audioEngine.setReplayGainMode('album');
      const calc = audioEngine.calculateReplayGain(track1);

      expect(calc.gainDb).toBe(-6.0);
      // Linear gain for -6.0 dB: 10^(-6.0/20) ~= 0.50118
      expect(calc.linearGain).toBeCloseTo(0.501, 2);
    });

    it('falls back to Track Gain in album mode if album gain is absent', () => {
      audioEngine.setReplayGainMode('album');
      const trackWithoutAlbumGain: TrackMetadata = {
        ...track1,
        replayGain: {
          trackGain: -3.2,
          trackPeak: 0.90,
        },
      };

      const calc = audioEngine.calculateReplayGain(trackWithoutAlbumGain);
      expect(calc.gainDb).toBe(-3.2);
      expect(calc.linearGain).toBeCloseTo(0.692, 2);
    });

    it('applies neutral unity gain (0 dB, 1.0x) when ReplayGain mode is off', () => {
      audioEngine.setReplayGainMode('off');
      const calc = audioEngine.calculateReplayGain(track1);

      expect(calc.gainDb).toBe(0);
      expect(calc.linearGain).toBe(1.0);
      expect(calc.isClippingPrevented).toBe(false);
    });

    it('applies neutral unity gain (0 dB, 1.0x) when track lacks ReplayGain metadata', () => {
      audioEngine.setReplayGainMode('track');
      const calc = audioEngine.calculateReplayGain(trackNoRg);

      expect(calc.gainDb).toBe(0);
      expect(calc.linearGain).toBe(1.0);
      expect(calc.isClippingPrevented).toBe(false);
    });

    it('prevents digital clipping and inter-sample distortion when boost exceeds peak headroom', () => {
      audioEngine.setReplayGainMode('track');
      // trackHighGainPeak requests +9.5 dB boost (2.98x) with peak of 0.85
      // 2.98 * 0.85 = 2.53, which would heavily clip!
      const calc = audioEngine.calculateReplayGain(trackHighGainPeak);

      expect(calc.isClippingPrevented).toBe(true);
      // Safe headroom ceiling clamps linear gain so linear * peak <= 0.988 (-0.1 dBFS)
      expect(calc.linearGain * 0.85).toBeLessThanOrEqual(0.989);
      expect(calc.linearGain).toBeCloseTo(0.988 / 0.85, 2);
    });

    it('preserves user master volume independently of ReplayGain', () => {
      const userMasterVolume = 0.75;
      audioEngine.setVolume(userMasterVolume);

      audioEngine.setReplayGainMode('track');
      audioEngine.calculateReplayGain(track1);

      // Verify master volume remains untouched
      expect(audioEngine.getVolume()).toBe(0.75);
    });
  });
});
