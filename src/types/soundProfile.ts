import { ParametricFilterConfig, ChannelMode } from './dsp';

export type SoundProfileCategory =
  | 'reference'
  | 'genre'
  | 'acoustic'
  | 'lifestyle'
  | 'custom';

export interface SoundProfile {
  id: string;
  name: string;
  description: string;
  category: SoundProfileCategory;
  icon: string; // Lucide icon identifier
  isBuiltIn: boolean;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  mode: 'graphic' | 'parametric';
  bands: number[]; // 10 ISO standard band gains in dB (-12 to +12)
  parametricFilters: ParametricFilterConfig[]; // Up to 12 biquad parametric filters
  preamp: number; // dB (-12 to +12)
  bassBoost: number; // dB (0 to 12)
  treble: number; // dB (-6 to 12)
  stereoWidth: number; // 0 to 150 (% width)
  stereoWidthEnabled: boolean;
  channelMode: ChannelMode; // 'stereo' | 'mono' | 'left_only' | 'right_only'
}

export interface SoundProfileHeadroomCalculation {
  maxBoostDb: number;
  suggestedPreampAttenuationDb: number;
  effectivePreampDb: number;
  headroomSafe: boolean;
}
