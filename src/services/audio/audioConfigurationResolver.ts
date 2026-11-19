import { DSPSettings, ParametricFilterConfig, DEFAULT_SETTINGS } from '../../types/dsp';
import { SoundProfile } from '../../types/soundProfile';
import { TrackAudioProfile } from '../../types/trackAudioProfile';
import { DeviceAudioProfile } from '../../types/deviceAudioProfile';

export interface ConfigurationResolutionInput {
  deviceProfile?: DeviceAudioProfile | null;
  globalProfile: SoundProfile;
  trackProfile?: TrackAudioProfile | null;
  manualOverrides?: Partial<DSPSettings> | null;
  currentVolume: number;
}

export interface ResolvedAudioConfiguration {
  source: 'global_profile' | 'track_override' | 'manual_adjustment';
  activeProfileId: string;
  activeProfileName: string;
  trackHasOverride: boolean;
  trackIdentity?: string;
  isModified: boolean;
  settings: DSPSettings;
  effectiveVolume: number;
  headroomCompensationDb: number;
}

/**
 * Single deterministic audio configuration resolver implementing the 4-layer hierarchy:
 * Layer 1: Device Configuration (Volume and output default profile)
 * Layer 2: Global Sound Profile (Default tonal and spatial processing)
 * Layer 3: Per-Track EQ Override (Track-specific EQ parameters and preamp)
 * Layer 4: Temporary Manual Adjustments (Unsaved user session overrides)
 */
export class AudioConfigurationResolver {
  public static resolve(input: ConfigurationResolutionInput): ResolvedAudioConfiguration {
    const { deviceProfile, globalProfile, trackProfile, manualOverrides, currentVolume } = input;

    // 1. Layer 1: Device-specific application volume (Volume remains strictly separate from DSP preamp)
    let effectiveVolume = currentVolume;
    if (deviceProfile && typeof deviceProfile.preferredVolume === 'number' && Number.isFinite(deviceProfile.preferredVolume)) {
      effectiveVolume = Math.max(0, Math.min(1.0, deviceProfile.preferredVolume));
    }

    // 2. Layer 2: Global Sound Profile baseline
    let eqMode = globalProfile.mode || 'graphic';
    let bands = [...globalProfile.bands];
    let parametricFilters = globalProfile.parametricFilters.map((f) => ({ ...f }));
    let preamp = globalProfile.preamp;
    let bassBoost = globalProfile.bassBoost || 0;
    let treble = globalProfile.treble || 0;
    let stereoWidth = globalProfile.stereoWidth ?? 100;
    let stereoWidthEnabled = !!globalProfile.stereoWidthEnabled;
    let channelMode = globalProfile.channelMode || 'stereo';
    let enabled = true;

    let source: 'global_profile' | 'track_override' | 'manual_adjustment' = 'global_profile';
    const activeProfileId = globalProfile.id;
    const activeProfileName = globalProfile.name;
    let trackHasOverride = false;
    let trackIdentity: string | undefined;

    // 3. Layer 3: Per-Track EQ Override (overrides only explicitly stored EQ fields; inherits others)
    if (trackProfile && trackProfile.enabled) {
      trackHasOverride = true;
      trackIdentity = trackProfile.trackIdentity;
      source = 'track_override';

      if (trackProfile.mode) {
        eqMode = trackProfile.mode;
      }
      if (Array.isArray(trackProfile.bands) && trackProfile.bands.length === 10) {
        bands = [...trackProfile.bands];
      }
      if (Array.isArray(trackProfile.parametricFilters) && trackProfile.parametricFilters.length > 0) {
        parametricFilters = trackProfile.parametricFilters.map((f) => ({ ...f }));
      }
      if (typeof trackProfile.preampOverride === 'number' && Number.isFinite(trackProfile.preampOverride)) {
        preamp = Math.max(-12, Math.min(12, trackProfile.preampOverride));
      }
    }

    // 4. Layer 4: Temporary Manual Adjustments (Unsaved active session changes)
    let isModified = false;
    if (manualOverrides && Object.keys(manualOverrides).length > 0) {
      source = 'manual_adjustment';
      isModified = true;

      if (manualOverrides.eqMode) eqMode = manualOverrides.eqMode;
      if (Array.isArray(manualOverrides.bands)) bands = [...manualOverrides.bands];
      if (Array.isArray(manualOverrides.parametricFilters)) parametricFilters = manualOverrides.parametricFilters.map((f) => ({ ...f }));
      if (typeof manualOverrides.preamp === 'number') preamp = manualOverrides.preamp;
      if (typeof manualOverrides.bassBoost === 'number') bassBoost = manualOverrides.bassBoost;
      if (typeof manualOverrides.treble === 'number') treble = manualOverrides.treble;
      if (typeof manualOverrides.stereoWidth === 'number') stereoWidth = manualOverrides.stereoWidth;
      if (manualOverrides.stereoWidthEnabled !== undefined) stereoWidthEnabled = manualOverrides.stereoWidthEnabled;
      if (manualOverrides.channelMode) channelMode = manualOverrides.channelMode;
      if (manualOverrides.enabled !== undefined) enabled = manualOverrides.enabled;
    }

    // Calculate headroom compensation for safe signal level before limiter
    let maxPositiveEq = 0;
    if (eqMode === 'graphic') {
      maxPositiveEq = Math.max(0, ...bands);
    } else {
      parametricFilters.forEach((f) => {
        if (f.enabled && f.gain > maxPositiveEq) maxPositiveEq = f.gain;
      });
    }
    const toneBoost = Math.max(0, bassBoost) * 0.5 + Math.max(0, treble) * 0.4;
    const totalPeakBoost = maxPositiveEq + toneBoost;
    const headroomCompensationDb = totalPeakBoost > 2.0 ? Math.min(6.0, Math.round(totalPeakBoost * 0.6 * 10) / 10) : 0;

    const finalSettings: DSPSettings = {
      enabled,
      eqMode,
      bands,
      parametricFilters,
      preamp,
      bassBoost,
      treble,
      balance: manualOverrides?.balance ?? 0,
      monoMix: channelMode === 'mono',
      channelMode,
      limiterEnabled: manualOverrides?.limiterEnabled ?? true,
      activePresetId: activeProfileId,
      stereoWidth,
      stereoWidthEnabled,
    };

    return {
      source,
      activeProfileId,
      activeProfileName,
      trackHasOverride,
      trackIdentity,
      isModified,
      settings: finalSettings,
      effectiveVolume,
      headroomCompensationDb,
    };
  }
}
