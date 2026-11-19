import { describe, it, expect, beforeEach } from 'vitest';
import { soundProfileService, BUILT_IN_SOUND_PROFILES } from '../services/audio/soundProfileService';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { SoundProfile } from '../types/soundProfile';

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

describe('Phase 5B.3: Unified Sound Profiles System', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Built-in Sound Profiles', () => {
    it('provides exactly 10 carefully balanced built-in sound profiles', () => {
      expect(BUILT_IN_SOUND_PROFILES).toHaveLength(10);
      const expectedIds = [
        'neutral_reference',
        'bass_focus',
        'vocal_clarity',
        'acoustic',
        'classical',
        'electronic',
        'rock',
        'podcast_speech',
        'late_night',
        'wide_soundstage',
      ];

      expectedIds.forEach((id) => {
        const found = BUILT_IN_SOUND_PROFILES.find((p) => p.id === id);
        expect(found).toBeDefined();
        expect(found?.isBuiltIn).toBe(true);
      });
    });

    it('validates each built-in profile has 10 graphic bands and valid parametric filters', () => {
      BUILT_IN_SOUND_PROFILES.forEach((profile) => {
        expect(profile.bands).toHaveLength(10);
        expect(profile.preamp).toBeGreaterThanOrEqual(-12);
        expect(profile.preamp).toBeLessThanOrEqual(12);
        expect(profile.stereoWidth).toBeGreaterThanOrEqual(0);
        expect(profile.stereoWidth).toBeLessThanOrEqual(150);
        expect(profile.parametricFilters.length).toBeGreaterThanOrEqual(1);

        profile.bands.forEach((b) => {
          expect(b).toBeGreaterThanOrEqual(-12);
          expect(b).toBeLessThanOrEqual(12);
        });
      });
    });

    it('ensures Neutral / Reference profile has flat unity gain and 0dB preamp', () => {
      const neutral = soundProfileService.getProfileById('neutral_reference');
      expect(neutral).toBeDefined();
      expect(neutral?.bands.every((b) => b === 0)).toBe(true);
      expect(neutral?.preamp).toBe(0);
      expect(neutral?.stereoWidth).toBe(100);
      expect(neutral?.stereoWidthEnabled).toBe(false);
    });
  });

  describe('2. Custom Profile Management (CRUD)', () => {
    it('creates a custom sound profile with unique ID and timestamps', () => {
      const custom = soundProfileService.createCustomProfile({
        name: 'Warm Tube Amp',
        description: 'Smooth harmonic warmth',
        category: 'custom',
        icon: 'Flame',
        mode: 'graphic',
        bands: [2, 1.5, 1, 0, 0, 0, 0, -0.5, -1, -1.5],
        parametricFilters: [],
        preamp: -1.0,
        bassBoost: 1.5,
        treble: 0,
        stereoWidth: 105,
        stereoWidthEnabled: true,
        channelMode: 'stereo',
      });

      expect(custom.id).toContain('profile_custom_');
      expect(custom.isBuiltIn).toBe(false);
      expect(custom.name).toBe('Warm Tube Amp');

      const retrieved = soundProfileService.getProfileById(custom.id);
      expect(retrieved).toEqual(custom);
    });

    it('duplicates an existing profile with a copy name and independent ID', () => {
      const duplicated = soundProfileService.duplicateProfile('bass_focus', 'My Custom Bass');
      expect(duplicated).not.toBeNull();
      expect(duplicated?.name).toBe('My Custom Bass');
      expect(duplicated?.id).not.toBe('bass_focus');
      expect(duplicated?.isBuiltIn).toBe(false);
      expect(duplicated?.bands).toEqual(soundProfileService.getProfileById('bass_focus')?.bands);
    });

    it('updates a custom profile and preserves immutability of ID and built-in status', () => {
      const created = soundProfileService.createCustomProfile({
        name: 'Initial Name',
        description: 'Initial',
        category: 'custom',
        icon: 'Sliders',
        mode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        channelMode: 'stereo',
      });

      const updated = soundProfileService.updateCustomProfile(created.id, {
        name: 'Updated Name',
        preamp: -2.0,
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.preamp).toBe(-2.0);
      expect(updated?.id).toBe(created.id);
      expect(updated?.isBuiltIn).toBe(false);
    });

    it('deletes custom profile while refusing to delete built-in profiles', () => {
      const created = soundProfileService.createCustomProfile({
        name: 'To Delete',
        description: '',
        category: 'custom',
        icon: 'Trash',
        mode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        channelMode: 'stereo',
      });

      const deleted = soundProfileService.deleteCustomProfile(created.id);
      expect(deleted).toBe(true);
      expect(soundProfileService.getProfileById(created.id)).toBeUndefined();

      // Attempt to delete built-in profile
      const deletedBuiltIn = soundProfileService.deleteCustomProfile('bass_focus');
      expect(deletedBuiltIn).toBe(false);
      expect(soundProfileService.getProfileById('bass_focus')).toBeDefined();
    });
  });

  describe('3. Headroom Calculation & Compensation', () => {
    it('calculates headroom compensation for profiles with positive EQ boosts', () => {
      const bassFocus = soundProfileService.getProfileById('bass_focus')!;
      const headroom = soundProfileService.calculateHeadroom(bassFocus);

      expect(headroom.maxBoostDb).toBeGreaterThan(3.0);
      expect(headroom.suggestedPreampAttenuationDb).toBeGreaterThan(1.0);
      expect(headroom.effectivePreampDb).toBeLessThan(0);
    });

    it('reports headroom safe for neutral reference profile without attenuation', () => {
      const neutral = soundProfileService.getProfileById('neutral_reference')!;
      const headroom = soundProfileService.calculateHeadroom(neutral);

      expect(headroom.maxBoostDb).toBe(0);
      expect(headroom.suggestedPreampAttenuationDb).toBe(0);
      expect(headroom.headroomSafe).toBe(true);
    });
  });

  describe('4. Profile Modification Detection', () => {
    it('detects when active settings deviate from base profile', () => {
      const neutral = soundProfileService.getProfileById('neutral_reference')!;
      const isClean = soundProfileService.isProfileModified(
        neutral,
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        neutral.parametricFilters,
        0,
        0,
        0,
        100
      );
      expect(isClean).toBe(false);

      const isModified = soundProfileService.isProfileModified(
        neutral,
        [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Modified band 0
        neutral.parametricFilters,
        0,
        0,
        0,
        100
      );
      expect(isModified).toBe(true);
    });
  });

  describe('5. Import & Export', () => {
    it('exports and imports custom profiles via JSON with validation', () => {
      soundProfileService.createCustomProfile({
        name: 'Exportable Sound',
        description: 'Testing export',
        category: 'custom',
        icon: 'Download',
        mode: 'graphic',
        bands: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: -1.5,
        bassBoost: 2,
        treble: 1,
        stereoWidth: 120,
        stereoWidthEnabled: true,
        channelMode: 'stereo',
      });

      const jsonStr = soundProfileService.exportProfilesJson();
      expect(jsonStr).toContain('Exportable Sound');

      const importResult = soundProfileService.importProfilesJson(jsonStr);
      expect(importResult.success).toBe(true);
      expect(importResult.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Audio Configuration Resolver Integration', () => {
    it('resolves global sound profile into effective DSP settings', () => {
      const rockProfile = soundProfileService.getProfileById('rock')!;
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: rockProfile,
        currentVolume: 0.85,
      });

      expect(resolved.source).toBe('global_profile');
      expect(resolved.activeProfileId).toBe('rock');
      expect(resolved.effectiveVolume).toBe(0.85);
      expect(resolved.settings.bands).toEqual(rockProfile.bands);
      expect(resolved.settings.stereoWidth).toBe(105);
      expect(resolved.settings.stereoWidthEnabled).toBe(true);
    });
  });
});
