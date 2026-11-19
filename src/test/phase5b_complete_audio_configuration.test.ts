import { describe, it, expect, beforeEach } from 'vitest';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { soundProfileService, BUILT_IN_SOUND_PROFILES } from '../services/audio/soundProfileService';
import { trackAudioProfileService } from '../services/audio/trackAudioProfileService';
import { audioDeviceProfileService } from '../services/audio/audioDeviceProfileService';
import { SoundProfile } from '../types/soundProfile';
import { TrackAudioProfile } from '../types/trackAudioProfile';
import { DeviceAudioProfile } from '../types/deviceAudioProfile';
import { TrackMetadata } from '../types/audio';

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

describe('Phase 5B Complete: End-to-End Audio Configuration System', () => {
  beforeEach(() => {
    localStorageMock.clear();
    trackAudioProfileService.clearAllTrackProfiles();
  });

  const sampleTrackA: TrackMetadata = {
    id: 'track_a',
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    duration: 382,
    bitrate: 1411,
    sampleRate: 44100,
    channels: 2,
    codec: 'FLAC',
    container: 'flac',
    isLossless: true,
    isrc: 'GB-AYE-79-00123',
    filePath: 'C:\\Music\\The Wall\\06. Comfortably Numb.flac',
    fileName: '06. Comfortably Numb.flac',
    fileSize: 45000000,
    dateModified: Date.now(),
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  const sampleTrackB: TrackMetadata = {
    id: 'track_b',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    duration: 294,
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    codec: 'MP3',
    container: 'mp3',
    isLossless: false,
    filePath: 'C:\\Music\\Thriller\\02. Billie Jean.mp3',
    fileName: '02. Billie Jean.mp3',
    fileSize: 11000000,
    dateModified: Date.now(),
    hasArtwork: false,
    playCount: 0,
    isFavorite: false,
  };

  describe('1. 4-Layer Hierarchy Resolution', () => {
    it('resolves Layer 1 & 2: Device volume + Global sound profile', () => {
      const globalProfile = soundProfileService.getProfileById('vocal_clarity')!;
      const deviceProfile: DeviceAudioProfile = {
        deviceId: 'device_headphones_1',
        deviceLabel: 'Sony WH-1000XM5 (Bluetooth)',
        normalizedLabel: 'sony wh 1000xm5',
        preferredVolume: 0.65,
        preferredSoundProfileId: 'vocal_clarity',
        isDefault: false,
        lastUsed: Date.now(),
        schemaVersion: 1,
      };

      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile,
        globalProfile,
        trackProfile: null,
        manualOverrides: null,
        currentVolume: 1.0,
      });

      expect(resolved.source).toBe('global_profile');
      expect(resolved.activeProfileId).toBe('vocal_clarity');
      expect(resolved.effectiveVolume).toBe(0.65);
      expect(resolved.settings.bands).toEqual(globalProfile.bands);
      expect(resolved.trackHasOverride).toBe(false);
      expect(resolved.isModified).toBe(false);
    });

    it('resolves Layer 3: Per-Track EQ override supersedes global profile for specified EQ fields', () => {
      const globalProfile = soundProfileService.getProfileById('neutral_reference')!;
      const customTrackBands = [4, 3, 2, 0, 0, 0, 0, 1, 2, 3];

      const trackProfile: TrackAudioProfile = {
        trackIdentity: trackAudioProfileService.getTrackIdentity(sampleTrackA),
        title: sampleTrackA.title,
        artist: sampleTrackA.artist,
        mode: 'graphic',
        bands: customTrackBands,
        preampOverride: -2.0,
        enabled: true,
        schemaVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile,
        trackProfile,
        manualOverrides: null,
        currentVolume: 0.8,
      });

      expect(resolved.source).toBe('track_override');
      expect(resolved.trackHasOverride).toBe(true);
      expect(resolved.trackIdentity).toBe(trackProfile.trackIdentity);
      expect(resolved.settings.bands).toEqual(customTrackBands);
      expect(resolved.settings.preamp).toBe(-2.0);
      // Inherited fields from globalProfile
      expect(resolved.settings.stereoWidth).toBe(globalProfile.stereoWidth);
      expect(resolved.settings.channelMode).toBe(globalProfile.channelMode);
    });

    it('resolves Layer 4: Session manual adjustments take highest precedence without altering saved profiles', () => {
      const globalProfile = soundProfileService.getProfileById('neutral_reference')!;
      const trackProfile: TrackAudioProfile = {
        trackIdentity: trackAudioProfileService.getTrackIdentity(sampleTrackA),
        title: sampleTrackA.title,
        artist: sampleTrackA.artist,
        mode: 'graphic',
        bands: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        preampOverride: 0,
        enabled: true,
        schemaVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile,
        trackProfile,
        manualOverrides: {
          bassBoost: 6.0,
          stereoWidth: 140,
        },
        currentVolume: 0.8,
      });

      expect(resolved.source).toBe('manual_adjustment');
      expect(resolved.isModified).toBe(true);
      expect(resolved.settings.bassBoost).toBe(6.0);
      expect(resolved.settings.stereoWidth).toBe(140);
      expect(resolved.settings.bands).toEqual(trackProfile.bands); // Still uses track EQ bands
      expect(globalProfile.bassBoost).toBe(0); // Underlying profile is NOT mutated
    });
  });

  describe('2. Headroom Compensation Calculation', () => {
    it('calculates safe headroom compensation when EQ or bass boost is applied', () => {
      const globalProfile = soundProfileService.getProfileById('bass_focus')!;
      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile,
        trackProfile: null,
        manualOverrides: null,
        currentVolume: 1.0,
      });

      // Bass focus has positive bass boost and low-end gains
      expect(resolved.headroomCompensationDb).toBeGreaterThan(0);
      expect(resolved.headroomCompensationDb).toBeLessThanOrEqual(6.0);
    });

    it('applies 0 headroom compensation for flat/neutral profile without boost', () => {
      const flatProfile: SoundProfile = {
        id: 'custom_flat',
        name: 'Custom Flat',
        description: 'Flat custom profile',
        category: 'custom',
        icon: 'sliders',
        isBuiltIn: false,
        schemaVersion: 1,
        mode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        channelMode: 'stereo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile: flatProfile,
        trackProfile: null,
        manualOverrides: null,
        currentVolume: 1.0,
      });

      expect(resolved.headroomCompensationDb).toBe(0);
    });
  });

  describe('3. Dynamic Track Transitions & Identity Matching', () => {
    it('seamlessly transitions from track with custom EQ to standard track', () => {
      // 1. Save EQ for Track A
      trackAudioProfileService.saveProfileForTrack(
        sampleTrackA,
        {
          mode: 'graphic',
          bands: [5, 4, 3, 2, 1, 0, 0, 0, 0, 0],
          preampOverride: -3.0,
        }
      );

      const globalProfile = soundProfileService.getProfileById('rock')!;

      // 2. Play Track A -> Track EQ applied
      const profileA = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      expect(profileA).not.toBeNull();

      const resolvedTrackA = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile,
        trackProfile: profileA,
        manualOverrides: null,
        currentVolume: 0.9,
      });
      expect(resolvedTrackA.source).toBe('track_override');
      expect(resolvedTrackA.trackHasOverride).toBe(true);
      expect(resolvedTrackA.settings.preamp).toBe(-3.0);

      // 3. Play Track B (no custom EQ) -> Automatically reverts to global profile
      const profileB = trackAudioProfileService.getProfileForTrack(sampleTrackB);
      expect(profileB).toBeNull();

      const resolvedTrackB = AudioConfigurationResolver.resolve({
        deviceProfile: null,
        globalProfile,
        trackProfile: profileB,
        manualOverrides: null,
        currentVolume: 0.9,
      });
      expect(resolvedTrackB.source).toBe('global_profile');
      expect(resolvedTrackB.trackHasOverride).toBe(false);
      expect(resolvedTrackB.settings.bands).toEqual(globalProfile.bands);
      expect(resolvedTrackB.settings.preamp).toBe(globalProfile.preamp);
    });

    it('matches track identity by ISRC when available, otherwise falling back to ID or normalized metadata', () => {
      const identityWithIsrc = trackAudioProfileService.getTrackIdentity(sampleTrackA);
      expect(identityWithIsrc).toBe('isrc:GBAYE7900123');

      // Without ISRC but with ID
      const identityWithId = trackAudioProfileService.getTrackIdentity(sampleTrackB);
      expect(identityWithId).toBe('id:track_b');

      // Without ISRC and without ID
      const trackNoId: TrackMetadata = {
        ...sampleTrackB,
        id: '',
      };
      const identityWithMeta = trackAudioProfileService.getTrackIdentity(trackNoId);
      expect(identityWithMeta).toContain('meta:');
      expect(identityWithMeta).toContain('michaeljackson');
      expect(identityWithMeta).toContain('billiejean');
    });
  });

  describe('4. Device Preference Persistence & Cross-Session Restoration', () => {
    it('restores device volume memory across sessions and updates cleanly', () => {
      const savedDevice = audioDeviceProfileService.saveDevicePreferences('device_dac_1', {
        deviceLabel: 'FiiO K5 Pro DAC',
        preferredVolume: 0.45,
        preferredSoundProfileId: 'neutral_reference',
      });

      expect(savedDevice.preferredVolume).toBe(0.45);
      expect(savedDevice.preferredSoundProfileId).toBe('neutral_reference');

      const retrieved = audioDeviceProfileService.getProfileForDevice({ deviceId: 'device_dac_1', label: 'FiiO K5 Pro DAC' });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.preferredVolume).toBe(0.45);

      // Fallback matching by label when deviceId changes (e.g. USB port change)
      const fallbackRetrieved = audioDeviceProfileService.getProfileForDevice({ deviceId: 'device_dac_new_uuid', label: 'FiiO K5 Pro DAC' });
      expect(fallbackRetrieved).not.toBeNull();
      expect(fallbackRetrieved?.preferredVolume).toBe(0.45);
    });
  });
});
