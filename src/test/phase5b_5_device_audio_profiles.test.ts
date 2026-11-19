import { describe, it, expect, beforeEach } from 'vitest';
import { audioDeviceProfileService } from '../services/audio/audioDeviceProfileService';
import { soundProfileService } from '../services/audio/soundProfileService';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { AudioDeviceInfo } from '../types/devices';

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

describe('Phase 5B.5: Per-Device Audio Profiles & Volume Memory', () => {
  const headphones: AudioDeviceInfo = {
    deviceId: 'device_sony_wh1000xm4',
    label: 'Headphones (Sony WH-1000XM4 Audio)',
    groupId: 'group_sony',
    isDefault: false,
    sampleRate: 48000,
    channels: 2,
  };

  const speakers: AudioDeviceInfo = {
    deviceId: 'device_realtek_speakers',
    label: 'Speakers (Realtek High Definition Audio)',
    groupId: 'group_realtek',
    isDefault: true,
    sampleRate: 48000,
    channels: 2,
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Device Identification & Normalization', () => {
    it('normalizes labels by stripping punctuation and whitespace', () => {
      const norm1 = audioDeviceProfileService.normalizeLabel('Headphones (Sony WH-1000XM4 Audio)');
      const norm2 = audioDeviceProfileService.normalizeLabel('Headphones - Sony WH 1000XM4 Audio');
      expect(norm1).toBe(norm2);
      expect(norm1).toBe('headphonessonywh1000xm4audio');
    });

    it('matches device profile across sessions using normalized label fallback', () => {
      // Save profile under session 1 deviceId
      audioDeviceProfileService.saveDevicePreferences('ephemeral_id_1', {
        deviceLabel: 'Sony WH-1000XM4',
        preferredVolume: 0.42,
      });

      // Session 2 re-enumerates with a new ephemeral ID but identical label
      const matched = audioDeviceProfileService.getProfileForDevice({
        deviceId: 'ephemeral_id_2',
        label: 'Sony WH-1000XM4',
      });

      expect(matched).not.toBeNull();
      expect(matched?.preferredVolume).toBe(0.42);
    });
  });

  describe('2. Per-Device Volume Memory', () => {
    it('maintains independent preferred volume per device', () => {
      audioDeviceProfileService.saveDevicePreferences(headphones.deviceId, {
        preferredVolume: 0.35,
        deviceLabel: headphones.label,
      });

      audioDeviceProfileService.saveDevicePreferences(speakers.deviceId, {
        preferredVolume: 0.85,
        deviceLabel: speakers.label,
      });

      const hpProfile = audioDeviceProfileService.getProfileForDevice(headphones);
      const spkProfile = audioDeviceProfileService.getProfileForDevice(speakers);

      expect(hpProfile?.preferredVolume).toBe(0.35);
      expect(spkProfile?.preferredVolume).toBe(0.85);
    });

    it('clamps volume preferences strictly between 0.0 and 1.0', () => {
      audioDeviceProfileService.saveDevicePreferences('test_dev', {
        preferredVolume: 1.5, // Out of bounds
      });
      expect(audioDeviceProfileService.getProfileForDevice({ deviceId: 'test_dev' })?.preferredVolume).toBe(1.0);

      audioDeviceProfileService.saveDevicePreferences('test_dev', {
        preferredVolume: -0.2, // Out of bounds
      });
      expect(audioDeviceProfileService.getProfileForDevice({ deviceId: 'test_dev' })?.preferredVolume).toBe(0.0);
    });
  });

  describe('3. Sound Profile Association & Configuration Resolver', () => {
    it('associates preferred sound profile with output device', () => {
      audioDeviceProfileService.saveDevicePreferences(headphones.deviceId, {
        preferredSoundProfileId: 'wide_soundstage',
      });

      const profile = audioDeviceProfileService.getProfileForDevice(headphones);
      expect(profile?.preferredSoundProfileId).toBe('wide_soundstage');

      const associatedSoundProfile = soundProfileService.getProfileById(profile!.preferredSoundProfileId!)!;
      expect(associatedSoundProfile).toBeDefined();

      // Resolve configuration with device profile
      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile: profile,
        globalProfile: associatedSoundProfile,
        currentVolume: 0.5,
      });

      expect(resolved.activeProfileId).toBe('wide_soundstage');
      expect(resolved.settings.stereoWidth).toBe(135);
    });

    it('keeps application volume distinct from DSP preamp in resolved configuration', () => {
      const rockGlobal = soundProfileService.getProfileById('rock')!;
      const deviceProfile = audioDeviceProfileService.saveDevicePreferences(headphones.deviceId, {
        preferredVolume: 0.4,
      });

      const resolved = AudioConfigurationResolver.resolve({
        deviceProfile,
        globalProfile: rockGlobal,
        currentVolume: 0.8,
      });

      // Volume is 0.4 from device preferences
      expect(resolved.effectiveVolume).toBe(0.4);
      // DSP preamp remains untouched at -1.5 dB from Rock profile
      expect(resolved.settings.preamp).toBe(-1.5);
    });
  });

  describe('4. Disconnection Recovery & Fallback', () => {
    it('falls back to default endpoint when active device is disconnected', () => {
      const available = [speakers]; // Headphones disconnected, only speakers present

      const recovery = audioDeviceProfileService.handleDisconnection(headphones.deviceId, available);
      expect(recovery.reconnectedOriginal).toBe(false);
      expect(recovery.fallbackDeviceId).toBe(speakers.deviceId);
    });

    it('restores preferred settings safely when original device is still connected', () => {
      const available = [headphones, speakers];

      const recovery = audioDeviceProfileService.handleDisconnection(headphones.deviceId, available);
      expect(recovery.reconnectedOriginal).toBe(true);
      expect(recovery.fallbackDeviceId).toBe(headphones.deviceId);
    });
  });
});
