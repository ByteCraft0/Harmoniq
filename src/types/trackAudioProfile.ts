import { ParametricFilterConfig } from './dsp';

export interface TrackAudioProfile {
  trackIdentity: string; // Stable canonical key: ISRC, library ID, or normalized metadata hash
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
  mode: 'graphic' | 'parametric';
  bands?: number[]; // Partial override of 10-band graphic EQ
  parametricFilters?: ParametricFilterConfig[]; // Partial override of parametric filters
  preampOverride?: number; // Optional track-specific preamp override in dB
}
