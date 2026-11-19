import { describe, it, expect, beforeEach } from 'vitest';
import { trackAudioProfileService } from '../services/audio/trackAudioProfileService';
import { soundProfileService } from '../services/audio/soundProfileService';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
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

describe('Phase 5B.4: Per-Track EQ Memory & Automatic Restoration', () => {
  const sampleTrackA: TrackMetadata = {
    id: 'track_101',
    filePath: 'C:/Music/Daft Punk - Random Access Memories/08 Get Lucky.flac',
    fileName: '08 Get Lucky.flac',
    fileSize: 45000000,
    dateModified: 1700000000,
    title: 'Get Lucky',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    isrc: 'USQX91300108',
    codec: 'FLAC',
    container: 'flac',
    duration: 369,
    sampleRate: 88200,
    bitDepth: 24,
    bitrate: 1650,
    channels: 2,
    isLossless: true,
    playCount: 15,
    isFavorite: true,
    hasArtwork: false,
  };

  const sampleTrackB: TrackMetadata = {
    id: 'track_102',
    filePath: 'C:/Music/Miles Davis - Kind of Blue/01 So What.flac',
    fileName: '01 So What.flac',
    fileSize: 55000000,
    dateModified: 1700000000,
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    codec: 'FLAC',
    container: 'flac',
    duration: 562,
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 1720,
    channels: 2,
    isLossless: true,
    playCount: 42,
    isFavorite: false,
    hasArtwork: false,
  };

  beforeEach(() => {
    localStorageMock.clear();
    trackAudioProfileService.clearAllTrackProfiles();
  });

  describe('1. Stable Track Identity Resolution', () => {
    it('uses valid ISRC when available as highest priority identity', () => {
      const identity = trackAudioProfileService.getTrackIdentity(sampleTrackA);
      expect(identity).toBe('isrc:USQX91300108');
    });

    it('falls back to stable track ID when ISRC is missing', () => {
      const identity = trackAudioProfileService.getTrackIdentity(sampleTrackB);
      expect(identity).toBe('id:track_102');
    });

    it('falls back to normalized metadata when both ISRC and ID are missing/transient', () => {
      const transientTrack: TrackMetadata = {
        ...sampleTrackB,
        id: 'temp_stream_123',
        isrc: undefined,
      };
      const identity = trackAudioProfileService.getTrackIdentity(transientTrack);
      expect(identity).toBe('meta:milesdavis:sowhat:kindofblue');
    });

    it('distinguishes different album versions of the same track', () => {
      const studioTrack: TrackMetadata = {
        ...sampleTrackB,
        id: 'temp_1',
        isrc: undefined,
        title: 'Comfortably Numb',
        artist: 'Pink Floyd',
        album: 'The Wall',
      };
      const liveTrack: TrackMetadata = {
        ...sampleTrackB,
        id: 'temp_2',
        isrc: undefined,
        title: 'Comfortably Numb',
        artist: 'Pink Floyd',
        album: 'Pulse (Live)',
      };

      const id1 = trackAudioProfileService.getTrackIdentity(studioTrack);
      const id2 = trackAudioProfileService.getTrackIdentity(liveTrack);
      expect(id1).not.toBe(id2);
      expect(id1).toContain('thewall');
      expect(id2).toContain('pulselive');
    });
  });

  describe('2. Per-Track EQ Override CRUD', () => {
    it('saves custom EQ settings for a specific track', () => {
      const customBands = [3, 2.5, 1, 0, -1, 0, 1, 2, 2.5, 3];
      const saved = trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: customBands,
        preampOverride: -2.0,
      });

      expect(saved.trackIdentity).toBe('isrc:USQX91300108');
      expect(saved.bands).toEqual(customBands);
      expect(saved.preampOverride).toBe(-2.0);
      expect(trackAudioProfileService.hasTrackProfile(sampleTrackA)).toBe(true);
      expect(trackAudioProfileService.hasTrackProfile(sampleTrackB)).toBe(false);
    });

    it('retrieves saved track profile upon track lookup', () => {
      trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      });

      const profile = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      expect(profile).not.toBeNull();
      expect(profile?.title).toBe('Get Lucky');
      expect(profile?.artist).toBe('Daft Punk');
      expect(profile?.bands).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('deletes track profile and restores unconfigured status', () => {
      trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      });
      expect(trackAudioProfileService.hasTrackProfile(sampleTrackA)).toBe(true);

      const deleted = trackAudioProfileService.removeProfileForTrack(sampleTrackA);
      expect(deleted).toBe(true);
      expect(trackAudioProfileService.hasTrackProfile(sampleTrackA)).toBe(false);
    });

    it('toggles track profile enabled state without deleting configuration', () => {
      trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      });

      trackAudioProfileService.toggleTrackProfile(sampleTrackA, false);
      const disabledProfile = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      expect(disabledProfile?.enabled).toBe(false);

      // Re-enable
      trackAudioProfileService.toggleTrackProfile(sampleTrackA, true);
      const enabledProfile = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      expect(enabledProfile?.enabled).toBe(true);
    });
  });

  describe('3. Configuration Resolver & Inheritance Hierarchy', () => {
    it('overrides global profile EQ when track has an active custom profile', () => {
      const neutralGlobal = soundProfileService.getProfileById('neutral_reference')!;
      const customBands = [4, 3, 2, 1, 0, 0, 1, 2, 3, 4];

      trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: customBands,
        preampOverride: -1.5,
      });

      const trackProfile = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: neutralGlobal,
        trackProfile,
        currentVolume: 0.9,
      });

      expect(resolved.source).toBe('track_override');
      expect(resolved.trackHasOverride).toBe(true);
      expect(resolved.settings.bands).toEqual(customBands);
      expect(resolved.settings.preamp).toBe(-1.5);
      // Inherits global profile stereo width and channel mode
      expect(resolved.settings.stereoWidth).toBe(100);
      expect(resolved.settings.channelMode).toBe('stereo');
    });

    it('inherits global profile completely when track has no custom profile', () => {
      const rockGlobal = soundProfileService.getProfileById('rock')!;
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: rockGlobal,
        trackProfile: null, // No track override
        currentVolume: 0.8,
      });

      expect(resolved.source).toBe('global_profile');
      expect(resolved.trackHasOverride).toBe(false);
      expect(resolved.settings.bands).toEqual(rockGlobal.bands);
      expect(resolved.settings.stereoWidth).toBe(105);
    });

    it('ignores disabled track override and falls back to global profile', () => {
      const neutralGlobal = soundProfileService.getProfileById('neutral_reference')!;
      trackAudioProfileService.saveProfileForTrack(sampleTrackA, {
        mode: 'graphic',
        bands: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        enabled: false, // Disabled
      });

      const trackProfile = trackAudioProfileService.getProfileForTrack(sampleTrackA);
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: neutralGlobal,
        trackProfile,
        currentVolume: 0.8,
      });

      expect(resolved.source).toBe('global_profile');
      expect(resolved.trackHasOverride).toBe(false);
      expect(resolved.settings.bands).toEqual(neutralGlobal.bands);
    });
  });
});
