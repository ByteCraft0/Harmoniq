import { TrackMetadata } from '../../types/audio';
import { DSPSettings } from '../../types/dsp';

export interface TrackOptimizationReport {
  trackId: string;
  estimatedPeakDbfs: number;
  estimatedRmsDbfs: number;
  dynamicRangeDb: number;
  clippingRisk: boolean;
  excessGainDb: number;
  recommendedPreampDb: number;
  reasoning: string;
}

export class TrackAudioIntelligenceService {
  /**
   * Analyze track audio characteristics and calculate clipping risk under current DSP settings
   */
  public analyzeTrack(
    track: TrackMetadata,
    dspSettings?: DSPSettings,
    replayGainDb = 0
  ): TrackOptimizationReport {
    // 1. Dynamic range and peak estimation from format & tags
    let estimatedPeakDbfs = -0.5; // Default digital ceiling
    let estimatedRmsDbfs = -14.0; // Standard modern master target

    if (track.replayGain?.trackPeak !== undefined && track.replayGain.trackPeak > 0) {
      estimatedPeakDbfs = 20 * Math.log10(track.replayGain.trackPeak);
    } else if (track.bitDepth && track.bitDepth >= 24) {
      estimatedPeakDbfs = -0.8;
      estimatedRmsDbfs = -18.0; // Hi-Res masters typically have more dynamic range
    } else if (track.codec === 'MP3' || track.codec === 'AAC') {
      estimatedPeakDbfs = -0.2; // Lossy codecs often inter-sample clip
      estimatedRmsDbfs = -12.0;
    }

    const dynamicRangeDb = Math.max(4, Math.round((estimatedPeakDbfs - estimatedRmsDbfs) * 10) / 10);

    // 2. Evaluate active DSP gain contributions
    let maxDspBoost = 0;
    let totalPreamp = 0;

    if (dspSettings && dspSettings.enabled) {
      totalPreamp = dspSettings.preamp || 0;

      // Graphic EQ bands
      if (dspSettings.eqMode === 'graphic' && dspSettings.bands) {
        for (const b of dspSettings.bands) {
          if (b > maxDspBoost) maxDspBoost = b;
        }
      }

      // Parametric EQ filters
      if (dspSettings.parametricFilters) {
        for (const f of dspSettings.parametricFilters) {
          if (f.enabled && f.gain > maxDspBoost) {
            maxDspBoost = f.gain;
          }
        }
      }

      // Bass boost / Treble
      if (dspSettings.bassBoost && dspSettings.bassBoost > 0) {
        maxDspBoost = Math.max(maxDspBoost, dspSettings.bassBoost);
      }
      if (dspSettings.treble && dspSettings.treble > 0) {
        maxDspBoost = Math.max(maxDspBoost, dspSettings.treble);
      }
    }

    // Include ReplayGain if boosting
    const rgBoost = Math.max(0, replayGainDb);

    // Sum peak potential
    const totalPeakPotential = estimatedPeakDbfs + totalPreamp + maxDspBoost + rgBoost;
    const clippingRisk = totalPeakPotential > 0;
    const excessGainDb = clippingRisk ? Math.round(totalPeakPotential * 10) / 10 : 0;

    // Smart headroom recommendation: ensure total peak doesn't exceed -0.5 dBFS
    let recommendedPreampDb = totalPreamp;
    let reasoning = 'Optimal headroom: no clipping detected under current audio configuration.';

    if (clippingRisk) {
      const requiredAtten = Math.ceil((totalPeakPotential + 0.5) * 10) / 10;
      recommendedPreampDb = Math.round((totalPreamp - requiredAtten) * 10) / 10;
      reasoning = `Clipping risk detected (+${excessGainDb} dBFS headroom deficit). Applying ${recommendedPreampDb} dB preamp headroom prevents digital inter-sample distortion.`;
    }

    return {
      trackId: track.id,
      estimatedPeakDbfs: Math.round(estimatedPeakDbfs * 10) / 10,
      estimatedRmsDbfs: Math.round(estimatedRmsDbfs * 10) / 10,
      dynamicRangeDb,
      clippingRisk,
      excessGainDb,
      recommendedPreampDb,
      reasoning,
    };
  }
}

export const trackAudioIntelligenceService = new TrackAudioIntelligenceService();
