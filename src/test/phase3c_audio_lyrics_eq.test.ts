import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { LyricsService } from '../services/lyricsService';
import { TrackMetadata, RepeatMode } from '../types/audio';
import { getPlatformDriver } from '../services/platform';
import { EqualizerParameters, NativeSleepTimerStatus } from '../services/platform/types';

describe('HARMONIQ LITE — PHASE 3C: Android Audio Features, Equalizer, Sleep Timer & Lyrics', () => {
  let mockCapacitor: any;
  let audioDriver: AndroidAudioDriver;

  const sampleTrack: TrackMetadata = {
    id: 'track_test_1',
    filePath: 'content://media/external/audio/media/501',
    fileName: 'high_fidelity_acoustics.flac',
    fileSize: 48000000,
    dateModified: 1715000000,
    dateAdded: 1715000000,
    title: 'High Fidelity Acoustics',
    artist: 'Harmoniq Ensemble',
    album: 'Pure Audio Vol. 1',
    duration: 240,
    hasArtwork: false,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 96000,
    bitrate: 2304,
    channels: 2,
    playCount: 0,
    isLossless: true,
    isFavorite: false,
  };

  beforeEach(() => {
    // Setup Mock Capacitor Plugins
    mockCapacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: {
        HarmoniqAudioPlayer: {
          addListener: vi.fn(),
          playTrack: vi.fn(async () => ({ status: 'playing' })),
          pause: vi.fn(async () => ({ status: 'paused' })),
          resume: vi.fn(async () => ({ status: 'resumed' })),
          seekTo: vi.fn(async () => ({ status: 'seeked' })),
          setVolume: vi.fn(async () => ({ status: 'volume_set' })),
          setQueue: vi.fn(async () => ({ status: 'queue_updated' })),
          skipToNext: vi.fn(async () => ({ status: 'next_skipped' })),
          skipToPrevious: vi.fn(async () => ({ status: 'prev_skipped' })),
          setShuffle: vi.fn(async ({ shuffle }) => ({ status: 'shuffle_set', shuffle })),
          setRepeatMode: vi.fn(async ({ repeatMode }) => ({ status: 'repeat_set', repeatMode })),
          getEqualizerParameters: vi.fn(async () => ({
            supported: true,
            enabled: false,
            numBands: 5,
            bands: [
              { band: 0, centerFreq: 60, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 1, centerFreq: 230, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 2, centerFreq: 910, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 3, centerFreq: 3600, minLevel: -15, maxLevel: 15, currentLevel: 0 },
              { band: 4, centerFreq: 14000, minLevel: -15, maxLevel: 15, currentLevel: 0 },
            ],
            presets: ['Flat', 'Bass Boost', 'Vocal', 'Rock', 'Pop', 'Classical', 'Jazz', 'Electronic'],
            currentPreset: 'Flat',
          })),
          setEqualizerEnabled: vi.fn(async ({ enabled }) => ({ status: 'eq_enabled', enabled })),
          setEqualizerBandGain: vi.fn(async ({ band, gainDb }) => ({ status: 'eq_band_set', band, gainDb })),
          setEqualizerPreset: vi.fn(async ({ preset }) => ({ status: 'eq_preset_set', preset })),
          resetEqualizer: vi.fn(async () => ({ status: 'eq_reset' })),
          startSleepTimer: vi.fn(async ({ minutes }) => ({ status: 'sleep_timer_started', minutes })),
          cancelSleepTimer: vi.fn(async () => ({ status: 'sleep_timer_cancelled' })),
          getSleepTimerStatus: vi.fn(async () => ({
            isActive: false,
            secondsRemaining: 0,
            totalSeconds: 0,
          })),
          getPlaybackState: vi.fn(async () => ({
            isPlaying: true,
            currentTime: 42,
            duration: 240,
            trackId: 'track_test_1',
            track: sampleTrack,
            volume: 0.85,
            isShuffle: true,
            repeatMode: 'all',
          })),
        },
      },
    };

    (globalThis as any).Capacitor = mockCapacitor;
    audioDriver = new AndroidAudioDriver();
  });

  afterEach(() => {
    delete (globalThis as any).Capacitor;
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. ANDROID HARDWARE EQUALIZER TESTS
  // ==========================================
  describe('1. Android Hardware Equalizer (AudioFX)', () => {
    it('queries hardware equalizer parameters with real bands and frequencies', async () => {
      const params = await audioDriver.getEqualizerParameters();
      expect(params.supported).toBe(true);
      expect(params.numBands).toBe(5);
      expect(params.bands).toHaveLength(5);
      expect(params.bands[0].centerFreq).toBe(60);
      expect(params.bands[4].centerFreq).toBe(14000);
      expect(params.presets).toContain('Bass Boost');
      expect(params.presets).toContain('Vocal');
    });

    it('enables and disables hardware equalizer effect', async () => {
      await audioDriver.setEqualizerEnabled(true);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerEnabled).toHaveBeenCalledWith({ enabled: true });

      await audioDriver.setEqualizerEnabled(false);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerEnabled).toHaveBeenCalledWith({ enabled: false });
    });

    it('sets band gain for individual frequency bands', async () => {
      await audioDriver.setEqualizerBandGain(0, 4); // +4 dB on 60Hz
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerBandGain).toHaveBeenCalledWith({
        band: 0,
        gainDb: 4,
      });

      await audioDriver.setEqualizerBandGain(4, -3); // -3 dB on 14kHz
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerBandGain).toHaveBeenCalledWith({
        band: 4,
        gainDb: -3,
      });
    });

    it('applies equalizer presets cleanly', async () => {
      await audioDriver.setEqualizerPreset('Bass Boost');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerPreset).toHaveBeenCalledWith({
        preset: 'Bass Boost',
      });

      await audioDriver.setEqualizerPreset('Vocal');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setEqualizerPreset).toHaveBeenCalledWith({
        preset: 'Vocal',
      });
    });

    it('resets equalizer to flat response', async () => {
      await audioDriver.resetEqualizer();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.resetEqualizer).toHaveBeenCalled();
    });

    it('returns graceful fallback when AudioFX is unsupported on the device', async () => {
      mockCapacitor.Plugins.HarmoniqAudioPlayer.getEqualizerParameters = vi.fn(async () => {
        throw new Error('AudioFX not supported');
      });

      const params = await audioDriver.getEqualizerParameters();
      expect(params.supported).toBe(false);
      expect(params.enabled).toBe(false);
      expect(params.bands).toHaveLength(0);
    });
  });

  // ==========================================
  // 2. PLAYBACK MODES (SHUFFLE & REPEAT)
  // ==========================================
  describe('2. Playback Modes (Shuffle & Repeat)', () => {
    it('sets shuffle mode and notifies state listeners', async () => {
      let latestState: any = null;
      audioDriver.onPlaybackStateChange((s) => {
        latestState = s;
      });

      await audioDriver.setShuffle(true);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setShuffle).toHaveBeenCalledWith({ shuffle: true });
      expect(latestState?.isShuffle).toBe(true);

      await audioDriver.setShuffle(false);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setShuffle).toHaveBeenCalledWith({ shuffle: false });
      expect(latestState?.isShuffle).toBe(false);
    });

    it('cycles repeat modes: off -> all -> one', async () => {
      let latestState: any = null;
      audioDriver.onPlaybackStateChange((s) => {
        latestState = s;
      });

      await audioDriver.setRepeatMode('all');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setRepeatMode).toHaveBeenCalledWith({ repeatMode: 'all' });
      expect(latestState?.repeatMode).toBe('all');

      await audioDriver.setRepeatMode('one');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setRepeatMode).toHaveBeenCalledWith({ repeatMode: 'one' });
      expect(latestState?.repeatMode).toBe('one');

      await audioDriver.setRepeatMode('off');
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.setRepeatMode).toHaveBeenCalledWith({ repeatMode: 'off' });
      expect(latestState?.repeatMode).toBe('off');
    });

    it('delegates skipToNext and skipToPrevious to native player', async () => {
      await audioDriver.skipToNext();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.skipToNext).toHaveBeenCalled();

      await audioDriver.skipToPrevious();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.skipToPrevious).toHaveBeenCalled();
    });

    it('restores shuffle and repeat mode from native snapshot', async () => {
      const snap = await audioDriver.getPlaybackSnapshot();
      expect(snap.isShuffle).toBe(true);
      expect(snap.repeatMode).toBe('all');
      expect(snap.currentTime).toBe(42);
    });
  });

  // ==========================================
  // 3. ANDROID NATIVE SLEEP TIMER
  // ==========================================
  describe('3. Android Native Sleep Timer', () => {
    it('starts native sleep timer with given minutes', async () => {
      await audioDriver.startSleepTimer(30);
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.startSleepTimer).toHaveBeenCalledWith({ minutes: 30 });
    });

    it('cancels active native sleep timer', async () => {
      await audioDriver.cancelSleepTimer();
      expect(mockCapacitor.Plugins.HarmoniqAudioPlayer.cancelSleepTimer).toHaveBeenCalled();
    });

    it('queries active sleep timer status', async () => {
      mockCapacitor.Plugins.HarmoniqAudioPlayer.getSleepTimerStatus = vi.fn(async () => ({
        isActive: true,
        secondsRemaining: 840,
        totalSeconds: 900,
      }));

      const status = await audioDriver.getSleepTimerStatus();
      expect(status.isActive).toBe(true);
      expect(status.secondsRemaining).toBe(840);
      expect(status.totalSeconds).toBe(900);
    });

    it('notifies listeners when sleep timer expires', () => {
      let expiredCalled = false;
      const unsub = audioDriver.onSleepTimerExpired(() => {
        expiredCalled = true;
      });

      // Emulate plugin sleepTimerExpired event
      (audioDriver as any).sleepTimerExpiredListeners.forEach((l: any) => l());
      expect(expiredCalled).toBe(true);

      unsub();
      expiredCalled = false;
      (audioDriver as any).sleepTimerExpiredListeners.forEach((l: any) => l());
      expect(expiredCalled).toBe(false);
    });
  });

  // ==========================================
  // 4. LYRICS PARSING & SYNCHRONIZATION
  // ==========================================
  describe('4. Synchronized Lyrics & LRC Engine', () => {
    it('parses standard LRC format with millisecond timestamps', () => {
      const lrc = `
        [ti:Test Track]
        [ar:Test Artist]
        [00:05.50]Opening intro melody
        [00:15.20]First verse begins
        [00:30.00]Chorus arrives
      `;

      const result = LyricsService.parseLrc(lrc, 'lrc_file');
      expect(result.synced).toBe(true);
      expect(result.lines).toHaveLength(3);
      expect(result.lines[0].time).toBeCloseTo(5.5, 2);
      expect(result.lines[0].text).toBe('Opening intro melody');
      expect(result.lines[1].time).toBeCloseTo(15.2, 2);
      expect(result.lines[1].text).toBe('First verse begins');
      expect(result.lines[2].time).toBe(30);
      expect(result.lines[2].text).toBe('Chorus arrives');
    });

    it('parses multi-timestamp lyric lines correctly', () => {
      const lrc = `
        [00:10.00][00:40.00]Repeated chorus hook
        [00:25.00]Solo guitar break
      `;

      const result = LyricsService.parseLrc(lrc, 'embedded');
      expect(result.synced).toBe(true);
      expect(result.lines).toHaveLength(3);
      // Chronologically sorted: 10.00, 25.00, 40.00
      expect(result.lines[0].time).toBe(10);
      expect(result.lines[0].text).toBe('Repeated chorus hook');
      expect(result.lines[1].time).toBe(25);
      expect(result.lines[1].text).toBe('Solo guitar break');
      expect(result.lines[2].time).toBe(40);
      expect(result.lines[2].text).toBe('Repeated chorus hook');
    });

    it('applies [offset:+/-ms] tag to timestamps', () => {
      const lrc = `
        [offset:+500]
        [00:10.00]Shifted lyric line
      `;

      const result = LyricsService.parseLrc(lrc, 'lrc_file');
      expect(result.synced).toBe(true);
      expect(result.lines[0].time).toBeCloseTo(10.5, 2);
    });

    it('finds active line index accurately for playback position', () => {
      const lines = [
        { time: 5, text: 'Line 1' },
        { time: 15, text: 'Line 2' },
        { time: 30, text: 'Line 3' },
      ];

      // Before first line
      expect(LyricsService.findActiveLineIndex(lines, 2)).toBe(-1);

      // Exactly at first line
      expect(LyricsService.findActiveLineIndex(lines, 5)).toBe(0);

      // Between line 1 and 2
      expect(LyricsService.findActiveLineIndex(lines, 12)).toBe(0);

      // At line 2
      expect(LyricsService.findActiveLineIndex(lines, 15)).toBe(1);

      // Well after line 3
      expect(LyricsService.findActiveLineIndex(lines, 60)).toBe(2);
    });

    it('falls back to plain text when no timestamp tags are present', () => {
      const plain = `This is a poem\nWithout any time tags\nJust pure lyrics.`;
      const result = LyricsService.parseLrc(plain, 'embedded');
      expect(result.synced).toBe(false);
      expect(result.lines).toHaveLength(0);
      expect(result.plainText).toBe(plain.trim());
    });

    it('gracefully handles empty or null lyrics strings', () => {
      const emptyResult = LyricsService.parseLrc('', 'embedded');
      expect(emptyResult.synced).toBe(false);
      expect(emptyResult.lines).toHaveLength(0);

      const whitespaceResult = LyricsService.parseLrc('   \n  \t ', 'embedded');
      expect(whitespaceResult.synced).toBe(false);
      expect(whitespaceResult.lines).toHaveLength(0);
    });

    it('cleans track titles for lyric metadata matching', () => {
      expect(LyricsService.cleanTrackTitle('Starlight (feat. John Doe)')).toBe('Starlight');
      expect(LyricsService.cleanTrackTitle('Bohemian Rhapsody - Remastered 2011')).toBe('Bohemian Rhapsody');
      expect(LyricsService.cleanTrackTitle('Midnight City [Official Video]')).toBe('Midnight City');
    });
  });

  // ==========================================
  // 5. DESKTOP PLATFORM ISOLATION
  // ==========================================
  describe('5. Desktop Platform Isolation', () => {
    it('verifies that desktop platform driver is intact and isolated', () => {
      const driver = getPlatformDriver();
      expect(driver).toBeDefined();
      expect(driver.audio).toBeDefined();
      expect(driver.library).toBeDefined();
      expect(driver.storage).toBeDefined();
    });
  });
});
