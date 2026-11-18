export type VisualizerThemeId =
  | 'minimal-bars'
  | 'neon-spectrum'
  | 'circular-spectrum'
  | 'waveform'
  | 'particle-field'
  | 'retro-equalizer'
  | 'ambient-waves'
  | 'frequency-rings';

export interface VisualizerThemeInfo {
  id: VisualizerThemeId;
  name: string;
  description: string;
}

export const VISUALIZER_THEMES: VisualizerThemeInfo[] = [
  {
    id: 'minimal-bars',
    name: 'Minimal Bars',
    description: 'Clean logarithmic spectrum bars with peak-hold indicators.',
  },
  {
    id: 'neon-spectrum',
    name: 'Neon Spectrum',
    description: 'Vibrant neon gradient with bottom audio bloom and reflections.',
  },
  {
    id: 'circular-spectrum',
    name: 'Circular Spectrum',
    description: '360° radial frequency burst surrounding album artwork.',
  },
  {
    id: 'waveform',
    name: 'Waveform',
    description: 'Silky smooth continuous time-domain oscilloscope wave.',
  },
  {
    id: 'particle-field',
    name: 'Particle Field',
    description: '3D starfield particles accelerating and pulsing with bass transients.',
  },
  {
    id: 'retro-equalizer',
    name: 'Retro Equalizer',
    description: 'Vintage segmented LED audio level bars (Green/Amber/Red).',
  },
  {
    id: 'ambient-waves',
    name: 'Ambient Waves',
    description: 'Multi-layered translucent aurora ribbons undulating with audio dynamics.',
  },
  {
    id: 'frequency-rings',
    name: 'Frequency Rings',
    description: 'Concentric resonant ripple rings radiating outward on audio beats.',
  },
];

export interface VisualizerSettings {
  theme: VisualizerThemeId;
  sensitivity: number; // 0.5 to 2.5
  intensity: number; // 0.5 to 2.0
  showTrackInfo: boolean;
  useAccentColor: boolean;
}

export interface PlaybackAnimationSettings {
  animationsEnabled: boolean;
  reducedMotion: boolean;
  animationIntensity: number; // 0.5 to 1.5
  albumArtTransitions: boolean;
}
