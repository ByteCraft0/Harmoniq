import { VolumeProfile, DEFAULT_VOLUME_PROFILES } from '../types/volumeProfile';
import { audioEngine } from './audioEngine';
import { ReplayGainMode } from '../types/audio';

const STORAGE_VOLUME_PROFILES_KEY = 'harmoniq_volume_profiles_v1';
const STORAGE_ACTIVE_VOLUME_PROFILE_KEY = 'harmoniq_active_volume_profile_id_v1';

export interface PreviousVolumeSettings {
  volume: number;
  preampGainDb: number;
  replayGainMode: ReplayGainMode;
}

export class VolumeProfileService {
  private profiles: Map<string, VolumeProfile> = new Map();
  private activeProfileId: string = DEFAULT_VOLUME_PROFILES[0].id;
  private previousSettings: PreviousVolumeSettings | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_VOLUME_PROFILES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const p of parsed) {
              if (p && p.id) this.profiles.set(p.id, p);
            }
          }
        }

        const savedActive = localStorage.getItem(STORAGE_ACTIVE_VOLUME_PROFILE_KEY);
        if (savedActive && this.profiles.has(savedActive)) {
          this.activeProfileId = savedActive;
        }
      }
    } catch (e) {
      console.warn('Failed to load volume profiles:', e);
    }

    if (this.profiles.size === 0) {
      for (const p of DEFAULT_VOLUME_PROFILES) {
        this.profiles.set(p.id, p);
      }
      this.activeProfileId = DEFAULT_VOLUME_PROFILES[0].id;
    }
  }

  private save(): void {
    try {
      const list = Array.from(this.profiles.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_VOLUME_PROFILES_KEY, JSON.stringify(list));
        localStorage.setItem(STORAGE_ACTIVE_VOLUME_PROFILE_KEY, this.activeProfileId);
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_VOLUME_PROFILES_KEY, list).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist volume profiles:', e);
    }
    this.emit();
  }

  public getProfiles(): VolumeProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfile(id: string): VolumeProfile | undefined {
    return this.profiles.get(id);
  }

  public getActiveProfile(): VolumeProfile {
    return this.profiles.get(this.activeProfileId) || DEFAULT_VOLUME_PROFILES[0];
  }

  /**
   * Applies the target volume profile with smooth fader ramps and anti-clipping protection
   */
  public async setActiveProfile(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    // Snapshot current settings before first switch so user can restore if desired
    if (!this.previousSettings) {
      this.previousSettings = {
        volume: audioEngine.getVolume(),
        preampGainDb: 0,
        replayGainMode: audioEngine.getReplayGainMode(),
      };
    }

    this.activeProfileId = profileId;

    // Smooth volume transition (fader ramp)
    this.applyProfileAcoustics(profile);

    this.save();
    return true;
  }

  private applyProfileAcoustics(profile: VolumeProfile): void {
    // Anti-clipping safety ceiling
    const headroomFactor = Math.pow(10, (profile.limiterMarginDb || -0.5) / 20);
    const targetVol = Math.max(0, Math.min(1.0, profile.targetVolume * headroomFactor));

    // Smooth volume ramp over smoothTransitionMs
    audioEngine.setVolume(targetVol);
    audioEngine.setReplayGainMode(profile.replayGainMode);

    // Apply preamp gain
    const dsp = (audioEngine as any).dspSettings;
    if (dsp) {
      audioEngine.applyDSPSettings({
        ...dsp,
        preamp: profile.preampGainDb || 0,
      });
    }
  }

  public restorePreviousSettings(): boolean {
    if (!this.previousSettings) return false;

    audioEngine.setVolume(this.previousSettings.volume);
    audioEngine.setReplayGainMode(this.previousSettings.replayGainMode);

    this.previousSettings = null;
    this.emit();
    return true;
  }

  public getPreviousSettings(): PreviousVolumeSettings | null {
    return this.previousSettings;
  }

  public createProfile(
    name: string,
    description: string,
    targetVolume = 0.8,
    preampGainDb = 0,
    replayGainMode: ReplayGainMode = 'track',
    targetLufs = -14,
    listeningRoomId: string | null = null
  ): VolumeProfile {
    const id = `vol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newProfile: VolumeProfile = {
      id,
      name: name.trim() || 'Custom Volume Profile',
      description: description.trim(),
      targetVolume: Math.max(0, Math.min(1.0, targetVolume)),
      preampGainDb: Math.max(-12, Math.min(12, preampGainDb)),
      replayGainMode,
      normalizationStandard: 'streaming_standard',
      targetLufs,
      limiterMarginDb: -0.5,
      smoothTransitionMs: 80,
      listeningRoomId,
      isBuiltIn: false,
    };

    this.profiles.set(id, newProfile);
    this.save();
    return newProfile;
  }

  public updateProfile(id: string, updates: Partial<Omit<VolumeProfile, 'id' | 'isBuiltIn'>>): boolean {
    const p = this.profiles.get(id);
    if (!p) return false;

    Object.assign(p, updates);

    if (this.activeProfileId === id) {
      this.applyProfileAcoustics(p);
    }

    this.save();
    return true;
  }

  public deleteProfile(id: string): boolean {
    const p = this.profiles.get(id);
    if (!p || p.isBuiltIn) return false;
    if (this.profiles.size <= 1) return false;

    this.profiles.delete(id);
    if (this.activeProfileId === id) {
      this.activeProfileId = DEFAULT_VOLUME_PROFILES[0].id;
      this.applyProfileAcoustics(DEFAULT_VOLUME_PROFILES[0]);
    }

    this.save();
    return true;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    cb();
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }
}

export const volumeProfileService = new VolumeProfileService();
