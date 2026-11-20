import { describe, it, expect, beforeEach, vi } from 'vitest';
import { audioEngine } from '../services/audioEngine';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { audioDeviceProfileService } from '../services/audio/audioDeviceProfileService';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { soundProfileService } from '../services/audio/soundProfileService';
import { trackAudioProfileService } from '../services/audio/trackAudioProfileService';
import { TrackMetadata } from '../types/audio';
import { DSPSettings, ParametricFilterConfig } from '../types/dsp';
import { DeviceAudioProfile } from '../types/deviceAudioProfile';

// In-memory mock for localStorage in Node test environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, val: string) => store.set(key, val),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = globalThis;

function createMockAudioParam(initialValue = 1.0) {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    setTargetAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    linearRampToValueAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    exponentialRampToValueAtTime: vi.fn(function (this: any, val: number) {
      this.value = val;
    }),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  };
}

function createMockAudioContext() {
  return {
    state: 'running',
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
    close: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
  } as any;
}

(globalThis as any).AudioContext = vi.fn(function() {
  return createMockAudioContext();
});
(globalThis as any).Audio = vi.fn().mockImplementation(function() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    src: '',
    currentTime: 0,
    duration: 200,
    volume: 1,
    muted: false,
    playbackRate: 1,
  };
});

describe('Phase 5B.7: Final Audio Architecture Audit & Validation', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    await audioEngine.initialize();
  });

  const sampleTrackA: TrackMetadata = {
    id: 'track_alpha',
    filePath: 'C:/Music/test_alpha.flac',
    fileName: 'test_alpha.flac',
    fileSize: 30000000,
    dateModified: Date.now(),
    title: 'Alpha Song (Acoustic)',
    artist: 'Artist Alpha',
    album: 'Album Alpha',
    codec: 'FLAC',
    container: 'flac',
    duration: 240,
    sampleRate: 44100,
    bitDepth: 24,
    bitrate: 1411,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    playCount: 10,
    isFavorite: false,
  };

  const sampleTrackB: TrackMetadata = {
    id: 'track_beta',
    filePath: 'C:/Music/test_beta.mp3',
    fileName: 'test_beta.mp3',
    fileSize: 8000000,
    dateModified: Date.now(),
    title: 'Beta Banger (EDM)',
    artist: 'Artist Beta',
    album: 'Album Beta',
    codec: 'MP3',
    container: 'mp3',
    duration: 210,
    sampleRate: 48000,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: false,
    playCount: 5,
    isFavorite: true,
  };

  const trackAEQSettings: DSPSettings = {
    enabled: true,
    eqMode: 'graphic',
    bands: [-8, -6, -4, 0, 0, 0, 2, 4, 6, 8], // Bass cut, treble boost
    parametricFilters: [],
    preamp: -2.0,
    bassBoost: 0,
    treble: 3.0,
    balance: 0,
    monoMix: false,
    channelMode: 'stereo',
    limiterEnabled: true,
    activePresetId: 'custom_alpha',
  };

  const trackBEQSettings: DSPSettings = {
    enabled: true,
    eqMode: 'graphic',
    bands: [8, 6, 4, 2, 0, -2, -4, -4, -6, -8], // Heavy bass boost, treble cut
    parametricFilters: [],
    preamp: -4.0,
    bassBoost: 6.0,
    treble: -3.0,
    balance: 0,
    monoMix: false,
    channelMode: 'stereo',
    limiterEnabled: true,
    activePresetId: 'custom_beta',
  };

  describe('1. Dual-Deck Independent EQ and Crossfade Behavior', () => {
    it('verifies that Deck A and Deck B have genuinely independent EQ stages', () => {
      const deckA = audioEngine.getDeck('A');
      const deckB = audioEngine.getDeck('B');

      expect(deckA).not.toBeNull();
      expect(deckB).not.toBeNull();
      expect(deckA?.eqFilters).toHaveLength(10);
      expect(deckB?.eqFilters).toHaveLength(10);

      // Verify that the filter instances on Deck A and Deck B are completely distinct Web Audio nodes
      expect(deckA?.eqFilters[0]).not.toBe(deckB?.eqFilters[0]);
      expect(deckA?.preampGain).not.toBe(deckB?.preampGain);
      expect(deckA?.bassBoostFilter).not.toBe(deckB?.bassBoostFilter);
      expect(deckA?.trebleFilter).not.toBe(deckB?.trebleFilter);
    });

    it('incoming track EQ applied to standby deck does NOT modify outgoing track EQ during crossfade', () => {
      // 1. Configure Deck A (Active) with Track A EQ
      audioEngine.setDeckDSPSettings('A', trackAEQSettings);
      const deckASettingsBefore = audioEngine.getDeckDSPSettings('A');
      expect(deckASettingsBefore?.bands[0]).toBe(-8);
      expect(deckASettingsBefore?.preamp).toBe(-2.0);

      // 2. Prepare next track on Deck B (Standby) with Track B EQ
      audioEngine.prepareNextTrack(sampleTrackB, trackBEQSettings);
      const deckBSettings = audioEngine.getDeckDSPSettings('B');
      expect(deckBSettings?.bands[0]).toBe(8);
      expect(deckBSettings?.preamp).toBe(-4.0);

      // 3. Verify Deck A's EQ remains 100% UNMODIFIED after Deck B is configured
      const deckASettingsAfter = audioEngine.getDeckDSPSettings('A');
      expect(deckASettingsAfter?.bands[0]).toBe(-8);
      expect(deckASettingsAfter?.preamp).toBe(-2.0);
      expect(deckASettingsAfter?.treble).toBe(3.0);
    });

    it('simulates crossfade: outgoing deck retains its own EQ while incoming deck fades in with its own EQ', () => {
      const deckA = audioEngine.getDeck('A')!;
      const deckB = audioEngine.getDeck('B')!;

      // Setup initial state: Deck A active with Track A EQ, Deck B standby with Track B EQ
      audioEngine.setDeckDSPSettings('A', trackAEQSettings);
      audioEngine.setDeckDSPSettings('B', trackBEQSettings);

      // Check physical filter gains on both decks
      expect(deckA.eqFilters[0].gain.value).toBe(-8);
      expect(deckB.eqFilters[0].gain.value).toBe(8);

      // Trigger crossfade transition to standby deck
      audioEngine.setStandbyDeckDSPSettings(trackBEQSettings);

      // Deck A physical filter gains must still reflect Track A's -8 dB
      expect(deckA.eqFilters[0].gain.value).toBe(-8);
      // Deck B physical filter gains must reflect Track B's +8 dB
      expect(deckB.eqFilters[0].gain.value).toBe(8);
    });

    it('deck reuse resets and configures the incoming deck cleanly on rapid track switching', () => {
      // Configure Deck A
      audioEngine.setDeckDSPSettings('A', trackAEQSettings);
      // Quickly load another track on Deck A
      audioEngine.setDeckDSPSettings('A', trackBEQSettings);

      const updated = audioEngine.getDeckDSPSettings('A');
      expect(updated?.bands[0]).toBe(8);
      expect(updated?.bassBoost).toBe(6.0);
    });
  });

  describe('2. Accurate Headroom Compensation Evaluation', () => {
    it('accurately evaluates peak boost for flat EQ (0 dB boost)', () => {
      const flatPeak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'graphic',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [],
        0,
        0
      );
      expect(flatPeak).toBe(0);
    });

    it('accurately evaluates multiple overlapping parametric boosts (e.g. +6 dB + +6 dB at 1kHz = 12 dB)', () => {
      const overlappingFilters: ParametricFilterConfig[] = [
        { id: 'f1', type: 'peaking', frequency: 1000, gain: 6.0, q: 1.414, enabled: true },
        { id: 'f2', type: 'peaking', frequency: 1000, gain: 6.0, q: 1.414, enabled: true },
      ];

      const evaluatedPeak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'parametric',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        overlappingFilters,
        0,
        0
      );

      // Physical peak of two stacked +6dB peaking filters at same frequency is exactly 12 dB
      expect(evaluatedPeak).toBeGreaterThanOrEqual(11.8);
      expect(evaluatedPeak).toBeLessThanOrEqual(12.2);

      // Resolver calculates headroom compensation from accurate peak
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: {
          ...soundProfileService.getProfileById('neutral_reference')!,
          mode: 'parametric',
          parametricFilters: overlappingFilters,
        },
        currentVolume: 1.0,
      });

      // Total peak > 2.0 dB -> Headroom compensation is applied up to max 6.0 dB
      expect(resolved.headroomCompensationDb).toBe(6.0);
    });

    it('accurately evaluates overlapping graphic EQ band and bass boost shelf', () => {
      // 125Hz graphic band +6dB, Bass boost +6dB (lowshelf @ 100Hz)
      const evaluatedPeak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'graphic',
        [0, 0, 6.0, 0, 0, 0, 0, 0, 0, 0],
        [],
        6.0,
        0
      );

      // Overlapping 100Hz shelf and 125Hz peak exceed either individual 6dB boost
      expect(evaluatedPeak).toBeGreaterThan(6.0);
      expect(evaluatedPeak).toBeLessThanOrEqual(9.0);
    });

    it('excludes disabled parametric filters from headroom calculation', () => {
      const filters: ParametricFilterConfig[] = [
        { id: 'f1', type: 'peaking', frequency: 1000, gain: 12.0, q: 1.0, enabled: false }, // Disabled
      ];

      const evaluatedPeak = AudioConfigurationResolver.evaluateCompositePeakBoost(
        'parametric',
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        filters,
        0,
        0
      );

      expect(evaluatedPeak).toBe(0);
    });
  });

  describe('3. Device Identity, Restoration & Persistence', () => {
    it('does NOT conflate two devices with identical generic labels but different verified groupIds', () => {
      // Device 1: USB Audio Device (Headset)
      const headsetProfile = audioDeviceProfileService.saveDevicePreferences('usb_headset_sink', {
        deviceLabel: 'USB Audio Device',
        groupId: 'hardware_group_headset_xyz',
        preferredVolume: 0.40,
        preferredSoundProfileId: 'vocal_clarity',
      });

      // Device 2: USB Audio Device (Desktop Speakers)
      const speakerProfile = audioDeviceProfileService.saveDevicePreferences('usb_speaker_sink', {
        deviceLabel: 'USB Audio Device',
        groupId: 'hardware_group_speakers_abc',
        preferredVolume: 0.90,
        preferredSoundProfileId: 'bass_focus',
      });

      // Query Device 1 with new sink ID across restarts, but matching groupId
      const retrievedHeadset = audioDeviceProfileService.getProfileForDevice({
        deviceId: 'new_session_headset_sink',
        label: 'USB Audio Device',
        groupId: 'hardware_group_headset_xyz',
      });

      expect(retrievedHeadset).not.toBeNull();
      expect(retrievedHeadset?.preferredVolume).toBe(0.40);
      expect(retrievedHeadset?.preferredSoundProfileId).toBe('vocal_clarity');

      // Query Device 2 with new sink ID and its own groupId
      const retrievedSpeakers = audioDeviceProfileService.getProfileForDevice({
        deviceId: 'new_session_speaker_sink',
        label: 'USB Audio Device',
        groupId: 'hardware_group_speakers_abc',
      });

      expect(retrievedSpeakers).not.toBeNull();
      expect(retrievedSpeakers?.preferredVolume).toBe(0.90);
      expect(retrievedSpeakers?.preferredSoundProfileId).toBe('bass_focus');
    });

    it('prunes stale old deviceId keys when a device reconnects with a regenerated sink ID', () => {
      audioDeviceProfileService.saveDevicePreferences('initial_dac_id', {
        deviceLabel: 'AudioQuest Dragonfly Red',
        preferredVolume: 0.70,
      });

      // App restarts, Chromium assigns 'new_dac_id'
      const updated = audioDeviceProfileService.getOrCreateProfile({
        deviceId: 'new_dac_id',
        label: 'AudioQuest Dragonfly Red',
        groupId: 'group_dragonfly',
        isDefault: false,
      });

      expect(updated.deviceId).toBe('new_dac_id');
      expect(updated.preferredVolume).toBe(0.70);

      // Verify that the old 'initial_dac_id' was pruned from profiles
      const oldLookup = audioDeviceProfileService.getProfileForDevice({ deviceId: 'initial_dac_id' });
      expect(oldLookup).toBeNull();
    });

    it('handles device disconnection by falling back to system default endpoint and volume', () => {
      const availableDevices = [
        { deviceId: 'default', label: 'Default System Output', isDefault: true, groupId: 'grp_default' },
        { deviceId: 'speakers_1', label: 'Realtek Audio', isDefault: false, groupId: 'grp_realtek' },
      ];

      // Disconnect 'external_dac_disconnected'
      const recovery = audioDeviceProfileService.handleDisconnection(
        'external_dac_disconnected',
        availableDevices
      );

      expect(recovery.reconnectedOriginal).toBe(false);
      expect(recovery.fallbackDeviceId).toBe('default');
      expect(recovery.restoredVolume).toBeGreaterThan(0);
    });
  });

  describe('4. Audio Quality Transparency & Dynamic Hardware Latency', () => {
    it('computes accurate hardware buffer latency when AudioContext.baseLatency is available', () => {
      const mockContextWithLatency = {
        sampleRate: 48000,
        baseLatency: 0.00533, // ~5.33ms (256 samples @ 48kHz)
        outputLatency: 0.004, // ~4ms driver buffering
      } as unknown as AudioContext;

      const report = AudioQualityService.generateReport(
        sampleTrackA,
        mockContextWithLatency,
        trackAEQSettings,
        { gainReductionDb: 0, peakLevel: 0, isClippingPrevented: false },
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.output.latencyMs).toBe(9.3); // (0.00533 + 0.004) * 1000 = 9.33ms -> 9.3ms
      expect(report?.decoded.bufferSizeSamples).toBe(256); // 0.00533 * 48000 = 256 samples
    });

    it('truthfully reports Windows Shared Mode driver without claiming nonexistent WASAPI exclusive', () => {
      const report = AudioQualityService.generateReport(
        sampleTrackB,
        null,
        trackBEQSettings,
        { gainReductionDb: 0, peakLevel: 0, isClippingPrevented: false },
        1.0,
        false
      );

      expect(report?.output.driverMode).toContain('Windows Shared Mode (WASAPI Shared)');
      expect(report?.bitPerfect.isBitPerfect).toBe(false);
      expect(report?.bitPerfect.reasons.some((r) => r.includes('Windows Shared Mode'))).toBe(true);
    });

    it('omits discrete PCM bit depth for lossy codecs to preserve audiological integrity', () => {
      const report = AudioQualityService.generateReport(
        sampleTrackB, // MP3 track
        null,
        trackBEQSettings,
        { gainReductionDb: 0, peakLevel: 0, isClippingPrevented: false },
        1.0,
        false
      );

      expect(report?.source.isLossless).toBe(false);
      expect(report?.source.bitDepthBits).toBeUndefined();
      expect(report?.bitPerfect.status).toBe('lossy_source');
    });
  });
});
