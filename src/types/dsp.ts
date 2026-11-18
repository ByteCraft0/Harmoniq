export interface EQBandConfig {
  frequency: number; // Hz
  gain: number; // dB (-12 to +12)
  q?: number;
}

export type ParametricFilterType =
  | 'peaking'
  | 'lowshelf'
  | 'highshelf'
  | 'lowpass'
  | 'highpass';

export interface ParametricFilterConfig {
  id: string;
  type: ParametricFilterType;
  frequency: number; // 20 Hz to 20,000 Hz
  gain: number; // -18 dB to +18 dB (for peaking & shelf)
  q: number; // 0.1 to 18.0
  enabled: boolean;
}

export interface EQPreset {
  id: string;
  name: string;
  isBuiltIn: boolean;
  mode?: 'graphic' | 'parametric';
  bands: number[]; // 10 gain values (-12 to +12 dB)
  parametricFilters?: ParametricFilterConfig[];
  preamp: number; // dB (-12 to +12)
  bassBoost?: number; // dB (0 to 12)
  treble?: number; // dB (-6 to 12)
}

export interface DSPSettings {
  enabled: boolean;
  eqMode: 'graphic' | 'parametric';
  bands: number[]; // Array of 10 band gains in dB (-12 to +12)
  parametricFilters: ParametricFilterConfig[];
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

// 10-Band ISO Standard Equalizer Frequencies matching Harmoniq specifications
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Default 5-point Parametric EQ Filters
export const DEFAULT_PARAMETRIC_FILTERS: ParametricFilterConfig[] = [
  { id: 'p1', type: 'lowshelf', frequency: 80, gain: 0, q: 0.707, enabled: true },
  { id: 'p2', type: 'peaking', frequency: 250, gain: 0, q: 1.414, enabled: true },
  { id: 'p3', type: 'peaking', frequency: 1000, gain: 0, q: 1.414, enabled: true },
  { id: 'p4', type: 'peaking', frequency: 4000, gain: 0, q: 1.414, enabled: true },
  { id: 'p5', type: 'highshelf', frequency: 12000, gain: 0, q: 0.707, enabled: true },
];

export const BUILT_IN_PRESETS: EQPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
  },
  {
    id: 'bass_boost',
    name: 'Bass Boost',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    preamp: -3.0,
    bassBoost: 4,
    treble: 0,
  },
  {
    id: 'treble_boost',
    name: 'Treble Boost',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [0, 0, 0, 0, 0, 1.0, 2.5, 4.0, 5.5, 6.0],
    preamp: -2.5,
    bassBoost: 0,
    treble: 4,
  },
  {
    id: 'rock',
    name: 'Rock',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [4.5, 3.5, 2.0, 0, -1.0, 1.0, 2.5, 3.5, 4.0, 4.5],
    preamp: -2.0,
    bassBoost: 2,
    treble: 2,
  },
  {
    id: 'pop',
    name: 'Pop',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [-1.0, 1.0, 3.0, 4.0, 3.5, 1.5, -0.5, 1.0, 2.5, 3.0],
    preamp: -1.5,
    bassBoost: 1,
    treble: 1.5,
  },
  {
    id: 'classical',
    name: 'Classical',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [4.0, 3.0, 2.5, 2.0, -1.0, -1.0, 0, 2.0, 3.0, 3.5],
    preamp: -1.5,
    bassBoost: 0,
    treble: 1,
  },
  {
    id: 'jazz',
    name: 'Jazz',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [3.0, 2.0, 1.0, 2.0, -1.5, -1.5, 0, 1.5, 2.5, 3.0],
    preamp: -1.0,
    bassBoost: 1,
    treble: 1,
  },
  {
    id: 'electronic',
    name: 'Electronic',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [6.0, 5.0, 3.0, 0, -1.5, 1.0, 2.5, 3.5, 5.0, 5.5],
    preamp: -3.5,
    bassBoost: 5,
    treble: 3,
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [3.0, 2.0, 1.0, 0.5, 1.5, 2.0, 3.0, 3.5, 2.5, 2.0],
    preamp: -1.0,
    bassBoost: 0,
    treble: 1.5,
  },
  {
    id: 'vocal',
    name: 'Vocal',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [-2.0, -3.0, -1.0, 2.0, 4.0, 4.5, 3.0, 1.0, -0.5, -2.0],
    preamp: -1.0,
    bassBoost: 0,
    treble: 0,
  },
  {
    id: 'headphones',
    name: 'Headphones',
    isBuiltIn: true,
    mode: 'graphic',
    bands: [3.5, 2.5, 0, -1.5, -1.0, 1.5, 3.0, 4.0, 4.5, 3.0],
    preamp: -2.0,
    bassBoost: 2,
    treble: 2.5,
  },
];
