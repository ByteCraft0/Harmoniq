import { SoundProfile, SoundProfileHeadroomCalculation } from '../../types/soundProfile';
import { ParametricFilterConfig, DEFAULT_PARAMETRIC_FILTERS } from '../../types/dsp';

const STORAGE_CUSTOM_PROFILES_KEY = 'harmoniq_custom_sound_profiles_v1';

export const BUILT_IN_SOUND_PROFILES: readonly SoundProfile[] = [
  {
    id: 'neutral_reference',
    name: 'Neutral / Reference',
    description: 'Flat studio monitoring reference. Unaltered frequency response preserving original master intent.',
    category: 'reference',
    icon: 'Activity',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    parametricFilters: DEFAULT_PARAMETRIC_FILTERS.map((f, i) => ({ ...f, id: `p_ref_${i}`, gain: 0 })),
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    stereoWidth: 100,
    stereoWidthEnabled: false,
    channelMode: 'stereo',
  },
  {
    id: 'bass_focus',
    name: 'Bass Focus',
    description: 'Rich low-end extension with reinforced sub-bass and mid-bass warmth, balanced with headroom protection.',
    category: 'genre',
    icon: 'Disc',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [4.0, 3.5, 2.5, 1.0, 0, 0, 0, 0.5, 1.0, 1.5],
    parametricFilters: [
      { id: 'p_bf_1', type: 'lowshelf', frequency: 90, gain: 3.5, q: 0.707, enabled: true },
      { id: 'p_bf_2', type: 'peaking', frequency: 180, gain: 1.5, q: 1.2, enabled: true },
      { id: 'p_bf_3', type: 'peaking', frequency: 1000, gain: 0, q: 1.4, enabled: true },
      { id: 'p_bf_4', type: 'peaking', frequency: 4000, gain: 0.5, q: 1.4, enabled: true },
      { id: 'p_bf_5', type: 'highshelf', frequency: 12000, gain: 1.0, q: 0.707, enabled: true },
    ],
    preamp: -2.5,
    bassBoost: 2.5,
    treble: 0,
    stereoWidth: 100,
    stereoWidthEnabled: false,
    channelMode: 'stereo',
  },
  {
    id: 'vocal_clarity',
    name: 'Vocal Clarity',
    description: 'Lifted vocal presence in the 1kHz to 4kHz speech articulation band. Crisp and intelligible.',
    category: 'acoustic',
    icon: 'Mic2',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [-1.5, -1.0, 0, 1.0, 2.5, 3.0, 2.5, 1.5, 0.5, 0],
    parametricFilters: [
      { id: 'p_vc_1', type: 'highpass', frequency: 80, gain: 0, q: 0.707, enabled: true },
      { id: 'p_vc_2', type: 'peaking', frequency: 250, gain: -1.0, q: 1.4, enabled: true },
      { id: 'p_vc_3', type: 'peaking', frequency: 1500, gain: 2.5, q: 1.2, enabled: true },
      { id: 'p_vc_4', type: 'peaking', frequency: 3200, gain: 2.5, q: 1.4, enabled: true },
      { id: 'p_vc_5', type: 'highshelf', frequency: 8000, gain: 1.0, q: 0.707, enabled: true },
    ],
    preamp: -1.0,
    bassBoost: 0,
    treble: 1.5,
    stereoWidth: 100,
    stereoWidthEnabled: false,
    channelMode: 'stereo',
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    description: 'Tailored for wooden stringed instruments and natural reverberation. Sweet acoustic warmth.',
    category: 'acoustic',
    icon: 'Guitar',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [1.5, 2.0, 1.5, 0.5, 0, 1.0, 2.0, 2.5, 2.0, 1.0],
    parametricFilters: [
      { id: 'p_ac_1', type: 'lowshelf', frequency: 100, gain: 1.5, q: 0.707, enabled: true },
      { id: 'p_ac_2', type: 'peaking', frequency: 300, gain: 1.0, q: 1.4, enabled: true },
      { id: 'p_ac_3', type: 'peaking', frequency: 1200, gain: 0.5, q: 1.2, enabled: true },
      { id: 'p_ac_4', type: 'peaking', frequency: 3800, gain: 2.0, q: 1.4, enabled: true },
      { id: 'p_ac_5', type: 'highshelf', frequency: 10000, gain: 1.5, q: 0.707, enabled: true },
    ],
    preamp: -1.0,
    bassBoost: 1.0,
    treble: 1.5,
    stereoWidth: 108,
    stereoWidthEnabled: true,
    channelMode: 'stereo',
  },
  {
    id: 'classical',
    name: 'Classical',
    description: 'Maximum dynamic expression and expansive orchestral hall depth with open, transparent highs.',
    category: 'genre',
    icon: 'Music2',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [1.0, 1.0, 0.5, 0, -0.5, 0, 0.5, 1.5, 2.5, 2.5],
    parametricFilters: [
      { id: 'p_cl_1', type: 'lowshelf', frequency: 70, gain: 1.0, q: 0.707, enabled: true },
      { id: 'p_cl_2', type: 'peaking', frequency: 400, gain: -0.5, q: 1.2, enabled: true },
      { id: 'p_cl_3', type: 'peaking', frequency: 2000, gain: 0.5, q: 1.4, enabled: true },
      { id: 'p_cl_4', type: 'peaking', frequency: 6000, gain: 1.5, q: 1.4, enabled: true },
      { id: 'p_cl_5', type: 'highshelf', frequency: 12000, gain: 2.0, q: 0.707, enabled: true },
    ],
    preamp: 0,
    bassBoost: 0,
    treble: 1.5,
    stereoWidth: 115,
    stereoWidthEnabled: true,
    channelMode: 'stereo',
  },
  {
    id: 'electronic',
    name: 'Electronic',
    description: 'Deep resonant sub-bass combined with razor-sharp percussion transients for EDM and Synthwave.',
    category: 'genre',
    icon: 'Radio',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [4.5, 3.5, 1.5, 0, -1.0, 0, 1.5, 2.5, 3.5, 3.0],
    parametricFilters: [
      { id: 'p_el_1', type: 'peaking', frequency: 55, gain: 4.0, q: 1.2, enabled: true },
      { id: 'p_el_2', type: 'lowshelf', frequency: 120, gain: 2.0, q: 0.707, enabled: true },
      { id: 'p_el_3', type: 'peaking', frequency: 600, gain: -1.0, q: 1.4, enabled: true },
      { id: 'p_el_4', type: 'peaking', frequency: 3000, gain: 1.5, q: 1.4, enabled: true },
      { id: 'p_el_5', type: 'highshelf', frequency: 9000, gain: 3.0, q: 0.707, enabled: true },
    ],
    preamp: -2.5,
    bassBoost: 3.0,
    treble: 2.5,
    stereoWidth: 110,
    stereoWidthEnabled: true,
    channelMode: 'stereo',
  },
  {
    id: 'rock',
    name: 'Rock',
    description: 'Punchy kick drum, driving bass guitar, and focused electric guitar crunch across 1kHz-3kHz.',
    category: 'genre',
    icon: 'Zap',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [3.0, 2.5, 2.0, 0.5, -0.5, 1.0, 2.0, 2.5, 2.0, 1.5],
    parametricFilters: [
      { id: 'p_rk_1', type: 'lowshelf', frequency: 100, gain: 2.5, q: 0.707, enabled: true },
      { id: 'p_rk_2', type: 'peaking', frequency: 250, gain: 1.5, q: 1.4, enabled: true },
      { id: 'p_rk_3', type: 'peaking', frequency: 800, gain: -0.5, q: 1.2, enabled: true },
      { id: 'p_rk_4', type: 'peaking', frequency: 2500, gain: 2.0, q: 1.4, enabled: true },
      { id: 'p_rk_5', type: 'highshelf', frequency: 8000, gain: 1.5, q: 0.707, enabled: true },
    ],
    preamp: -1.5,
    bassBoost: 1.5,
    treble: 1.0,
    stereoWidth: 105,
    stereoWidthEnabled: true,
    channelMode: 'stereo',
  },
  {
    id: 'podcast_speech',
    name: 'Podcast / Speech',
    description: 'Sub-bass rumble elimination, enhanced vocal presence, and reduced listening fatigue for long sessions.',
    category: 'lifestyle',
    icon: 'Headphones',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'parametric',
    bands: [-6.0, -3.0, 0, 1.5, 2.5, 3.0, 2.0, 0.5, -1.0, -2.0],
    parametricFilters: [
      { id: 'p_pod_1', type: 'highpass', frequency: 80, gain: 0, q: 0.707, enabled: true },
      { id: 'p_pod_2', type: 'peaking', frequency: 220, gain: -1.5, q: 1.8, enabled: true },
      { id: 'p_pod_3', type: 'peaking', frequency: 1800, gain: 3.0, q: 1.2, enabled: true },
      { id: 'p_pod_4', type: 'peaking', frequency: 3500, gain: 2.0, q: 1.4, enabled: true },
      { id: 'p_pod_5', type: 'lowpass', frequency: 14000, gain: 0, q: 0.707, enabled: true },
    ],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    stereoWidth: 100,
    stereoWidthEnabled: false,
    channelMode: 'stereo',
  },
  {
    id: 'late_night',
    name: 'Late Night',
    description: 'Controlled low-frequency impact and rolled-off highs for fatigue-free listening at intimate volume.',
    category: 'lifestyle',
    icon: 'Moon',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [-2.0, -1.0, 0, 0.5, 0.5, 0.5, 0, -1.0, -2.5, -4.0],
    parametricFilters: [
      { id: 'p_ln_1', type: 'lowshelf', frequency: 80, gain: -1.5, q: 0.707, enabled: true },
      { id: 'p_ln_2', type: 'peaking', frequency: 400, gain: 0.5, q: 1.2, enabled: true },
      { id: 'p_ln_3', type: 'peaking', frequency: 1500, gain: 0.5, q: 1.4, enabled: true },
      { id: 'p_ln_4', type: 'peaking', frequency: 5000, gain: -1.5, q: 1.4, enabled: true },
      { id: 'p_ln_5', type: 'highshelf', frequency: 9000, gain: -3.0, q: 0.707, enabled: true },
    ],
    preamp: 0,
    bassBoost: 0,
    treble: -2.0,
    stereoWidth: 100,
    stereoWidthEnabled: false,
    channelMode: 'stereo',
  },
  {
    id: 'wide_soundstage',
    name: 'Wide Soundstage',
    description: 'Expansive Mid-Side psychoacoustic spatializer. Widens side ambience while locking center vocals.',
    category: 'lifestyle',
    icon: 'Maximize2',
    isBuiltIn: true,
    schemaVersion: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    mode: 'graphic',
    bands: [0.5, 0.5, 0, 0, 0, 0.5, 1.0, 1.5, 2.0, 2.0],
    parametricFilters: [
      { id: 'p_wss_1', type: 'lowshelf', frequency: 100, gain: 0.5, q: 0.707, enabled: true },
      { id: 'p_wss_2', type: 'peaking', frequency: 800, gain: 0, q: 1.4, enabled: true },
      { id: 'p_wss_3', type: 'peaking', frequency: 2500, gain: 1.0, q: 1.2, enabled: true },
      { id: 'p_wss_4', type: 'peaking', frequency: 6500, gain: 1.5, q: 1.4, enabled: true },
      { id: 'p_wss_5', type: 'highshelf', frequency: 11000, gain: 2.0, q: 0.707, enabled: true },
    ],
    preamp: -1.0,
    bassBoost: 0.5,
    treble: 1.5,
    stereoWidth: 135,
    stereoWidthEnabled: true,
    channelMode: 'stereo',
  },
];

export class SoundProfileService {
  private customProfiles: SoundProfile[] = [];
  private isLoaded = false;

  constructor() {
    this.loadCustomProfiles();
  }

  private loadCustomProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_PROFILES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.customProfiles = parsed
            .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
            .map((p) => ({
              ...p,
              isBuiltIn: false,
              schemaVersion: p.schemaVersion || 1,
              bands: Array.isArray(p.bands) && p.bands.length === 10 ? p.bands : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              parametricFilters: Array.isArray(p.parametricFilters) ? p.parametricFilters : [...DEFAULT_PARAMETRIC_FILTERS],
              preamp: typeof p.preamp === 'number' ? Math.max(-12, Math.min(12, p.preamp)) : 0,
              bassBoost: typeof p.bassBoost === 'number' ? Math.max(0, Math.min(12, p.bassBoost)) : 0,
              treble: typeof p.treble === 'number' ? Math.max(-6, Math.min(12, p.treble)) : 0,
              stereoWidth: typeof p.stereoWidth === 'number' ? Math.max(0, Math.min(150, p.stereoWidth)) : 100,
              stereoWidthEnabled: !!p.stereoWidthEnabled,
              channelMode: ['stereo', 'mono', 'left_only', 'right_only'].includes(p.channelMode) ? p.channelMode : 'stereo',
            }));
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('Failed to load custom sound profiles from localStorage:', e);
      this.customProfiles = [];
    }
  }

  private saveCustomProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_CUSTOM_PROFILES_KEY, JSON.stringify(this.customProfiles));
    } catch (e) {
      console.warn('Failed to save custom sound profiles to localStorage:', e);
    }
  }

  public getAllProfiles(): SoundProfile[] {
    if (!this.isLoaded) this.loadCustomProfiles();
    return [...BUILT_IN_SOUND_PROFILES, ...this.customProfiles];
  }

  public getProfileById(id: string): SoundProfile | undefined {
    return this.getAllProfiles().find((p) => p.id === id);
  }

  public createCustomProfile(
    data: Omit<SoundProfile, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
  ): SoundProfile {
    const id = `profile_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newProfile: SoundProfile = {
      ...data,
      id,
      name: data.name.trim() || 'Untitled Profile',
      category: 'custom',
      isBuiltIn: false,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.customProfiles.push(newProfile);
    this.saveCustomProfiles();
    return newProfile;
  }

  public duplicateProfile(sourceId: string, customName?: string): SoundProfile | null {
    const source = this.getProfileById(sourceId);
    if (!source) return null;

    const name = customName?.trim() || `${source.name} (Copy)`;
    return this.createCustomProfile({
      ...source,
      name,
      description: `Copy of ${source.name}. ${source.description}`,
      bands: [...source.bands],
      parametricFilters: source.parametricFilters.map((f) => ({ ...f })),
    });
  }

  public updateCustomProfile(id: string, updates: Partial<SoundProfile>): SoundProfile | null {
    const idx = this.customProfiles.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const current = this.customProfiles[idx];
    const updated: SoundProfile = {
      ...current,
      ...updates,
      id: current.id, // Cannot change ID
      isBuiltIn: false, // Cannot become built-in
      updatedAt: Date.now(),
    };

    this.customProfiles[idx] = updated;
    this.saveCustomProfiles();
    return updated;
  }

  public deleteCustomProfile(id: string): boolean {
    const initialLen = this.customProfiles.length;
    this.customProfiles = this.customProfiles.filter((p) => p.id !== id);
    if (this.customProfiles.length !== initialLen) {
      this.saveCustomProfiles();
      return true;
    }
    return false;
  }

  /**
   * Evaluates maximum positive gain across graphic and parametric filters and provides
   * recommended headroom compensation to avoid digital clipping before the limiter.
   */
  public calculateHeadroom(profile: SoundProfile): SoundProfileHeadroomCalculation {
    let maxGraphicGain = 0;
    if (Array.isArray(profile.bands)) {
      maxGraphicGain = Math.max(0, ...profile.bands);
    }

    let maxParametricGain = 0;
    if (Array.isArray(profile.parametricFilters)) {
      profile.parametricFilters.forEach((f) => {
        if (f.enabled && (f.type === 'peaking' || f.type === 'lowshelf' || f.type === 'highshelf')) {
          if (f.gain > maxParametricGain) {
            maxParametricGain = f.gain;
          }
        }
      });
    }

    const activeMaxEq = profile.mode === 'parametric' ? maxParametricGain : maxGraphicGain;
    const toneBoost = Math.max(0, profile.bassBoost || 0) * 0.6 + Math.max(0, profile.treble || 0) * 0.4;
    const totalMaxBoost = Math.round((activeMaxEq + toneBoost) * 10) / 10;

    // Headroom rule: If total boost exceeds +2 dB, suggest attenuating preamp by ~75% of the boost
    const suggestedAttenuation = totalMaxBoost > 1.5 ? Math.min(6.0, Math.round(totalMaxBoost * 0.75 * 10) / 10) : 0;
    const effectivePreamp = Math.round((profile.preamp - suggestedAttenuation) * 10) / 10;

    return {
      maxBoostDb: totalMaxBoost,
      suggestedPreampAttenuationDb: suggestedAttenuation,
      effectivePreampDb: effectivePreamp,
      headroomSafe: totalMaxBoost <= 2.0 || profile.preamp <= -suggestedAttenuation,
    };
  }

  /**
   * Compares active DSP settings with the base profile to determine if settings have been modified.
   */
  public isProfileModified(
    profile: SoundProfile,
    currentBands: number[],
    currentParametric: ParametricFilterConfig[],
    currentPreamp: number,
    currentBass: number,
    currentTreble: number,
    currentWidth: number
  ): boolean {
    if (Math.abs(profile.preamp - currentPreamp) > 0.1) return true;
    if (Math.abs((profile.bassBoost || 0) - currentBass) > 0.1) return true;
    if (Math.abs((profile.treble || 0) - currentTreble) > 0.1) return true;
    if (profile.stereoWidthEnabled && Math.abs((profile.stereoWidth || 100) - currentWidth) > 1.0) return true;

    if (profile.mode === 'graphic') {
      if (!Array.isArray(currentBands) || currentBands.length !== profile.bands.length) return true;
      for (let i = 0; i < profile.bands.length; i++) {
        if (Math.abs(profile.bands[i] - (currentBands[i] ?? 0)) > 0.1) return true;
      }
    } else {
      if (!Array.isArray(currentParametric) || currentParametric.length !== profile.parametricFilters.length) return true;
      for (let i = 0; i < profile.parametricFilters.length; i++) {
        const pf = profile.parametricFilters[i];
        const cf = currentParametric[i];
        if (!cf || pf.type !== cf.type || Math.abs(pf.frequency - cf.frequency) > 2 || Math.abs(pf.gain - cf.gain) > 0.1 || Math.abs(pf.q - cf.q) > 0.05 || pf.enabled !== cf.enabled) {
          return true;
        }
      }
    }

    return false;
  }

  public exportProfilesJson(): string {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        profiles: this.customProfiles,
      },
      null,
      2
    );
  }

  public importProfilesJson(jsonStr: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(jsonStr);
      const list = Array.isArray(data) ? data : data?.profiles;
      if (!Array.isArray(list)) {
        return { success: false, count: 0, error: 'JSON does not contain a valid profiles array.' };
      }

      let count = 0;
      for (const item of list) {
        if (item && typeof item.name === 'string') {
          this.createCustomProfile({
            name: String(item.name).slice(0, 50),
            description: typeof item.description === 'string' ? item.description.slice(0, 200) : '',
            category: 'custom',
            icon: typeof item.icon === 'string' ? item.icon : 'Sliders',
            mode: item.mode === 'parametric' ? 'parametric' : 'graphic',
            bands: Array.isArray(item.bands) && item.bands.length === 10
              ? item.bands.map((b: any) => (typeof b === 'number' && Number.isFinite(b) ? Math.max(-12, Math.min(12, b)) : 0))
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            parametricFilters: Array.isArray(item.parametricFilters) && item.parametricFilters.length > 0
              ? item.parametricFilters.slice(0, 12)
              : [...DEFAULT_PARAMETRIC_FILTERS],
            preamp: typeof item.preamp === 'number' ? Math.max(-12, Math.min(12, item.preamp)) : 0,
            bassBoost: typeof item.bassBoost === 'number' ? Math.max(0, Math.min(12, item.bassBoost)) : 0,
            treble: typeof item.treble === 'number' ? Math.max(-6, Math.min(12, item.treble)) : 0,
            stereoWidth: typeof item.stereoWidth === 'number' ? Math.max(0, Math.min(150, item.stereoWidth)) : 100,
            stereoWidthEnabled: !!item.stereoWidthEnabled,
            channelMode: ['stereo', 'mono', 'left_only', 'right_only'].includes(item.channelMode) ? item.channelMode : 'stereo',
          });
          count++;
        }
      }

      return { success: true, count };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Invalid JSON format' };
    }
  }
}

export const soundProfileService = new SoundProfileService();
