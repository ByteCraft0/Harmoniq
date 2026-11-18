export interface EQBandConfig {
  frequency: number; // Hz
  gain: number; // dB (-12 to +12)
  q?: number;
}

export interface EQPreset {
  id: string;
  name: string;
  isBuiltIn: boolean;
  bands: number[]; // 10 gain values (-12 to +12 dB)
  preamp: number; // dB
  bassBoost?: number; // dB (0 to 12)
  treble?: number; // dB (-6 to 12)
}

export interface DSPSettings {
  enabled: boolean;
  bands: number[]; // Array of 10 band gains in dB
  preamp: number; // in dB (-12 to +12)
  bassBoost: number; // in dB (0 to 12)
  treble: number; // in dB (-6 to 12)
  balance: number; // -1 (full Left) to +1 (full Right), 0 is Center
  monoMix: boolean; // Downmix to mono
  limiterEnabled: boolean; // Anti-clipping brickwall limiter
  activePresetId: string | null;
}

export interface LimiterMetrics {
  isClippingPrevented: boolean;
  gainReductionDb: number; // Amount in dB currently attenuated by limiter
  peakLevel: number; // -1.0 to 1.0 or dBFS
}

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const BUILT_IN_PRESETS: EQPreset[] = [
  {
    id: 'flat',
    name: 'Flat (Reference)',
    isBuiltIn: true,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
  },
  {
    id: 'bass_boost',
    name: 'Bass Boost',
    isBuiltIn: true,
    bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    preamp: -3.0,
    bassBoost: 4,
    treble: 0,
  },
  {
    id: 'rock',
    name: 'Rock',
    isBuiltIn: true,
    bands: [4.5, 3.5, 2.0, 0, -1.0, 1.0, 2.5, 3.5, 4.0, 4.5],
    preamp: -2.0,
    bassBoost: 2,
    treble: 2,
  },
  {
    id: 'pop',
    name: 'Pop',
    isBuiltIn: true,
    bands: [-1.0, 1.0, 3.0, 4.0, 3.5, 1.5, -0.5, 1.0, 2.5, 3.0],
    preamp: -1.5,
    bassBoost: 1,
    treble: 1.5,
  },
  {
    id: 'jazz',
    name: 'Jazz',
    isBuiltIn: true,
    bands: [3.0, 2.0, 1.0, 2.0, -1.5, -1.5, 0, 1.5, 2.5, 3.0],
    preamp: -1.0,
    bassBoost: 1,
    treble: 1,
  },
  {
    id: 'classical',
    name: 'Classical',
    isBuiltIn: true,
    bands: [4.0, 3.0, 2.5, 2.0, -1.0, -1.0, 0, 2.0, 3.0, 3.5],
    preamp: -1.5,
    bassBoost: 0,
    treble: 1,
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    isBuiltIn: true,
    bands: [3.0, 2.0, 1.0, 0.5, 1.5, 2.0, 3.0, 3.5, 2.5, 2.0],
    preamp: -1.0,
    bassBoost: 0,
    treble: 1.5,
  },
  {
    id: 'vocal',
    name: 'Vocal / Dialogue',
    isBuiltIn: true,
    bands: [-2.0, -3.0, -1.0, 2.0, 4.0, 4.5, 3.0, 1.0, -0.5, -2.0],
    preamp: -1.0,
    bassBoost: 0,
    treble: 0,
  },
  {
    id: 'electronic',
    name: 'Electronic / EDM',
    isBuiltIn: true,
    bands: [6.0, 5.0, 3.0, 0, -1.5, 1.0, 2.5, 3.5, 5.0, 5.5],
    preamp: -3.5,
    bassBoost: 5,
    treble: 3,
  },
  {
    id: 'podcast',
    name: 'Podcast & Speech',
    isBuiltIn: true,
    bands: [-4.0, -3.0, 0, 2.5, 4.0, 3.5, 2.0, 0, -2.0, -3.0],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
  },
];
