export interface WaveformData {
  trackId: string;
  duration: number; // in seconds
  peaks: number[]; // normalized 0.0 to 1.0 peak heights per bucket (e.g., 250 bars)
  rms?: number[]; // normalized 0.0 to 1.0 RMS values per bucket
  sampleRate: number;
  channels: number;
  generatedAt: number;
  isEstimated?: boolean; // true if estimated from acoustic profile without full decode
}

export interface WaveformRenderOptions {
  height?: number;
  barWidth?: number;
  barGap?: number;
  playedColor?: string;
  unplayedColor?: string;
  glowEffect?: boolean;
}
