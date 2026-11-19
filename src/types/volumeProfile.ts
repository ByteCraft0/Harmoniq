import { ReplayGainMode } from './audio';

export type LoudnessNormalizationStandard =
  | 'off'
  | 'ebu_r128_broadcast' // -23 LUFS (Broadcasting standard)
  | 'streaming_standard' // -14 LUFS (Spotify / YouTube standard)
  | 'high_dynamic_range' // -18 LUFS (Audiophile / Podcast target)
  | 'custom';

export interface VolumeProfile {
  id: string;
  name: string;
  description: string;
  targetVolume: number; // 0.0 to 1.0 (e.g. 0.45 for Late Night, 0.85 for Standard, 1.0 for Audiophile)
  preampGainDb: number; // -12.0 to +12.0 dB
  replayGainMode: ReplayGainMode; // 'off' | 'track' | 'album'
  normalizationStandard: LoudnessNormalizationStandard;
  targetLufs: number; // e.g. -23, -14, -18
  limiterMarginDb: number; // Peak limiter headroom: -0.1 dBFS, -0.5 dBFS, -1.0 dBFS
  smoothTransitionMs: number; // Equal-power volume fader ramp duration (default: 80ms)
  listeningRoomId?: string | null;
  isBuiltIn?: boolean;
}

export const DEFAULT_VOLUME_PROFILES: VolumeProfile[] = [
  {
    id: 'vol_daytime',
    name: 'Daytime / Standard',
    description: 'Balanced volume with Track ReplayGain normalization and peak protection',
    targetVolume: 0.8,
    preampGainDb: 0,
    replayGainMode: 'track',
    normalizationStandard: 'streaming_standard',
    targetLufs: -14,
    limiterMarginDb: -0.5,
    smoothTransitionMs: 80,
    isBuiltIn: true,
  },
  {
    id: 'vol_late_night',
    name: 'Late Night / Quiet',
    description: 'Reduced volume ceiling, dynamic compression and -1.0 dBFS headroom',
    targetVolume: 0.38,
    preampGainDb: -3.0,
    replayGainMode: 'track',
    normalizationStandard: 'ebu_r128_broadcast',
    targetLufs: -23,
    limiterMarginDb: -1.0,
    smoothTransitionMs: 120,
    isBuiltIn: true,
  },
  {
    id: 'vol_audiophile',
    name: 'Audiophile Critical Listening',
    description: 'Bit-accurate unity gain (100% volume, 0 dB preamp), Album ReplayGain mode',
    targetVolume: 1.0,
    preampGainDb: 0.0,
    replayGainMode: 'album',
    normalizationStandard: 'high_dynamic_range',
    targetLufs: -18,
    limiterMarginDb: -0.1,
    smoothTransitionMs: 50,
    isBuiltIn: true,
  },
  {
    id: 'vol_party',
    name: 'Party / High Output',
    description: 'Elevated gain with fast peak limiter protection against clipping',
    targetVolume: 0.95,
    preampGainDb: +2.0,
    replayGainMode: 'track',
    normalizationStandard: 'streaming_standard',
    targetLufs: -14,
    limiterMarginDb: -0.2,
    smoothTransitionMs: 100,
    isBuiltIn: true,
  },
];
