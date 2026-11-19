import { DSPSettings, ParametricFilterConfig } from '../../types/dsp';
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

    // Calculate accurate headroom compensation using exact composite biquad frequency evaluation
    const totalPeakBoost = this.evaluateCompositePeakBoost(
      eqMode,
      bands,
      parametricFilters,
      bassBoost,
      treble
    );
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

  /**
   * Evaluates the combined frequency response of graphic/parametric filters and tone controls
   * across a dense logarithmic grid (40 points from 20 Hz to 20,000 Hz) to find the true composite peak boost in dB.
   */
  public static evaluateCompositePeakBoost(
    eqMode: 'graphic' | 'parametric',
    bands: number[],
    parametricFilters: ParametricFilterConfig[],
    bassBoost: number,
    treble: number
  ): number {
    const fs = 48000;
    const numPoints = 40;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);

    const testFrequencies: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      testFrequencies.push(Math.pow(10, minLog + (i / (numPoints - 1)) * (maxLog - minLog)));
    }

    // Helper to evaluate single biquad filter dB gain at frequency f
    const evalBiquadDb = (type: string, f0: number, gainDb: number, q: number, f: number): number => {
      if (Math.abs(gainDb) < 0.05 && type !== 'lowpass' && type !== 'highpass' && type !== 'notch') return 0;

      const w0 = (2 * Math.PI * f0) / fs;
      const cosw0 = Math.cos(w0);
      const sinw0 = Math.sin(w0);
      const A = Math.pow(10, gainDb / 40);
      const alpha = sinw0 / (2 * Math.max(0.01, q));

      let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

      if (type === 'peaking') {
        b0 = 1 + alpha * A;
        b1 = -2 * cosw0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosw0;
        a2 = 1 - alpha / A;
      } else if (type === 'lowshelf') {
        const sqrtA = Math.sqrt(A);
        b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
        b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha);
        a0 = (A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * cosw0);
        a2 = (A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha;
      } else if (type === 'highshelf') {
        const sqrtA = Math.sqrt(A);
        b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
        b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha);
        a0 = (A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * cosw0);
        a2 = (A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha;
      } else if (type === 'lowpass') {
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else if (type === 'highpass') {
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else if (type === 'notch') {
        b0 = 1;
        b1 = -2 * cosw0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else {
        return 0;
      }

      const w = (2 * Math.PI * f) / fs;
      const cosw = Math.cos(w);
      const sinw = Math.sin(w);
      const cos2w = Math.cos(2 * w);
      const sin2w = Math.sin(2 * w);

      const numReal = b0 + b1 * cosw + b2 * cos2w;
      const numImag = -b1 * sinw - b2 * sin2w;
      const denReal = a0 + a1 * cosw + a2 * cos2w;
      const denImag = -a1 * sinw - a2 * sin2w;

      const numMagSq = numReal * numReal + numImag * numImag;
      const denMagSq = denReal * denReal + denImag * denImag;

      if (denMagSq < 1e-12) return 0;
      const magLinearSq = numMagSq / denMagSq;
      return 10 * Math.log10(Math.max(1e-10, magLinearSq));
    };

    const ISO_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    let maxCombinedBoost = 0;

    for (const f of testFrequencies) {
      let totalDbAtF = 0;

      if (eqMode === 'graphic') {
        for (let i = 0; i < 10; i++) {
          const gain = bands[i] ?? 0;
          if (Math.abs(gain) >= 0.1) {
            totalDbAtF += evalBiquadDb('peaking', ISO_FREQS[i], gain, 1.414, f);
          }
        }
      } else {
        for (const pf of parametricFilters) {
          if (pf.enabled) {
            totalDbAtF += evalBiquadDb(pf.type, pf.frequency, pf.gain, pf.q, f);
          }
        }
      }

      if (bassBoost && bassBoost > 0) {
        totalDbAtF += evalBiquadDb('lowshelf', 100, bassBoost, 0.707, f);
      }
      if (treble && treble !== 0) {
        totalDbAtF += evalBiquadDb('highshelf', 10000, treble, 0.707, f);
      }

      if (totalDbAtF > maxCombinedBoost) {
        maxCombinedBoost = totalDbAtF;
      }
    }

    return Math.max(0, Math.round(maxCombinedBoost * 10) / 10);
  }
}
