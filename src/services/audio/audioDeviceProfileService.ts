import { AudioDeviceInfo } from '../../types/devices';
import { DeviceAudioProfile } from '../../types/deviceAudioProfile';

const STORAGE_KEY = 'harmoniq_device_audio_profiles_v1';

export class AudioDeviceProfileService {
  private profiles: Map<string, DeviceAudioProfile> = new Map();
  private isLoaded = false;
  private activeDeviceId = 'default';

  constructor() {
    this.loadProfiles();
  }

  /**
   * Normalizes a device label string for fallback matching across Chromium/Electron sessions
   * where deviceIds may be regenerated.
   */
  public normalizeLabel(label: string | undefined): string {
    return (label || '')
      .toLowerCase()
      .replace(/[\s\-_.,/\\()[\]{}'"]/g, '')
      .trim();
  }

  private loadProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.profiles.clear();
          parsed.forEach((item: any) => {
            if (item && typeof item.deviceId === 'string') {
              this.profiles.set(item.deviceId, {
                deviceId: item.deviceId,
                deviceLabel: item.deviceLabel || 'Audio Output Endpoint',
                normalizedLabel: item.normalizedLabel || this.normalizeLabel(item.deviceLabel),
                groupId: item.groupId,
                preferredVolume: typeof item.preferredVolume === 'number' && Number.isFinite(item.preferredVolume)
                  ? Math.max(0, Math.min(1.0, item.preferredVolume))
                  : 0.85,
                preferredSoundProfileId: typeof item.preferredSoundProfileId === 'string' ? item.preferredSoundProfileId : undefined,
                isDefault: !!item.isDefault,
                lastUsed: typeof item.lastUsed === 'number' ? item.lastUsed : Date.now(),
                schemaVersion: item.schemaVersion || 1,
              });
            }
          });
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('Failed to load device audio profiles from localStorage:', e);
      this.profiles.clear();
    }
  }

  private saveProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.profiles.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (e) {
      console.warn('Failed to save device audio profiles to localStorage:', e);
    }
  }

  /**
   * Resolve an existing profile for a given device by exact deviceId, or by normalized label fallback.
   */
  public getProfileForDevice(device: AudioDeviceInfo | { deviceId: string; label?: string }): DeviceAudioProfile | null {
    if (!this.isLoaded) this.loadProfiles();

    // 1. Exact deviceId match
    if (this.profiles.has(device.deviceId)) {
      return this.profiles.get(device.deviceId)!;
    }

    // 2. Normalized label fallback match across app restarts
    if (device.label) {
      const norm = this.normalizeLabel(device.label);
      for (const p of this.profiles.values()) {
        if (p.normalizedLabel === norm) {
          return p;
        }
      }
    }

    return null;
  }

  /**
   * Get or initialize a device profile with safe defaults.
   */
  public getOrCreateProfile(device: AudioDeviceInfo, currentVolume = 0.85): DeviceAudioProfile {
    const existing = this.getProfileForDevice(device);
    if (existing) {
      existing.deviceId = device.deviceId; // Refresh deviceId if label matched
      existing.deviceLabel = device.label || existing.deviceLabel;
      existing.lastUsed = Date.now();
      this.profiles.set(device.deviceId, existing);
      this.saveProfiles();
      return existing;
    }

    const newProfile: DeviceAudioProfile = {
      deviceId: device.deviceId,
      deviceLabel: device.label || 'Audio Endpoint',
      normalizedLabel: this.normalizeLabel(device.label),
      groupId: device.groupId,
      preferredVolume: Math.max(0, Math.min(1.0, currentVolume)),
      preferredSoundProfileId: undefined,
      isDefault: !!device.isDefault,
      lastUsed: Date.now(),
      schemaVersion: 1,
    };

    this.profiles.set(device.deviceId, newProfile);
    this.saveProfiles();
    return newProfile;
  }

  /**
   * Save or update preferences for an audio output device.
   */
  public saveDevicePreferences(
    deviceId: string,
    updates: {
      preferredVolume?: number;
      preferredSoundProfileId?: string;
      deviceLabel?: string;
    }
  ): DeviceAudioProfile {
    if (!this.isLoaded) this.loadProfiles();

    let profile = this.profiles.get(deviceId);
    if (!profile) {
      profile = {
        deviceId,
        deviceLabel: updates.deviceLabel || 'Audio Endpoint',
        normalizedLabel: this.normalizeLabel(updates.deviceLabel),
        preferredVolume: 0.85,
        isDefault: deviceId === 'default',
        lastUsed: Date.now(),
        schemaVersion: 1,
      };
    }

    if (typeof updates.preferredVolume === 'number' && Number.isFinite(updates.preferredVolume)) {
      profile.preferredVolume = Math.max(0, Math.min(1.0, updates.preferredVolume));
    }
    if (updates.preferredSoundProfileId !== undefined) {
      profile.preferredSoundProfileId = updates.preferredSoundProfileId || undefined;
    }
    if (updates.deviceLabel) {
      profile.deviceLabel = updates.deviceLabel;
      profile.normalizedLabel = this.normalizeLabel(updates.deviceLabel);
    }
    profile.lastUsed = Date.now();

    this.profiles.set(deviceId, profile);
    this.saveProfiles();
    return profile;
  }

  public removeDeviceProfile(deviceId: string): boolean {
    const deleted = this.profiles.delete(deviceId);
    if (deleted) {
      this.saveProfiles();
    }
    return deleted;
  }

  public getAllProfiles(): DeviceAudioProfile[] {
    if (!this.isLoaded) this.loadProfiles();
    return Array.from(this.profiles.values()).sort((a, b) => b.lastUsed - a.lastUsed);
  }

  public setActiveDeviceId(deviceId: string): void {
    this.activeDeviceId = deviceId;
  }

  public getActiveDeviceId(): string {
    return this.activeDeviceId;
  }

  /**
   * Handle device disconnection recovery:
   * Validates if active device still exists in available devices.
   * If missing, returns fallback default device info and remembered volume.
   */
  public handleDisconnection(
    currentDeviceId: string,
    availableDevices: AudioDeviceInfo[]
  ): { fallbackDeviceId: string; restoredVolume: number; reconnectedOriginal: boolean } {
    const exists = availableDevices.some((d) => d.deviceId === currentDeviceId);

    if (exists) {
      const profile = this.getProfileForDevice({ deviceId: currentDeviceId });
      return {
        fallbackDeviceId: currentDeviceId,
        restoredVolume: profile ? profile.preferredVolume : 0.85,
        reconnectedOriginal: true,
      };
    }

    // Fall back to default endpoint
    const defaultDev = availableDevices.find((d) => d.isDefault) || availableDevices[0];
    const fallbackId = defaultDev?.deviceId || 'default';
    const fallbackProfile = this.getProfileForDevice({ deviceId: fallbackId });

    return {
      fallbackDeviceId: fallbackId,
      restoredVolume: fallbackProfile ? fallbackProfile.preferredVolume : 0.85,
      reconnectedOriginal: false,
    };
  }
}

export const audioDeviceProfileService = new AudioDeviceProfileService();
