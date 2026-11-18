import {
  VisualizerThemeId,
  VisualizerSettings,
  PlaybackAnimationSettings,
  VISUALIZER_THEMES,
} from '../types/visualizer';

const STORAGE_VISUALIZER_SETTINGS = 'harmoniq_visualizer_settings_v3';
const STORAGE_ANIMATION_SETTINGS = 'harmoniq_playback_animations_v2';

export class VisualizerSettingsService {
  private visualizerSettings: VisualizerSettings = {
    theme: 'neon-spectrum',
    sensitivity: 1.2,
    intensity: 1.0,
    showTrackInfo: true,
    useAccentColor: true,
  };

  private animationSettings: PlaybackAnimationSettings = {
    animationsEnabled: true,
    reducedMotion: false,
    animationIntensity: 1.0,
    albumArtTransitions: true,
  };

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawViz = localStorage.getItem(STORAGE_VISUALIZER_SETTINGS);
        if (rawViz) {
          const parsed = JSON.parse(rawViz);
          this.visualizerSettings = { ...this.visualizerSettings, ...parsed };
        }

        const rawAnim = localStorage.getItem(STORAGE_ANIMATION_SETTINGS);
        if (rawAnim) {
          const parsed = JSON.parse(rawAnim);
          this.animationSettings = { ...this.animationSettings, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load visualizer settings:', e);
    }
  }

  private save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_VISUALIZER_SETTINGS, JSON.stringify(this.visualizerSettings));
        localStorage.setItem(STORAGE_ANIMATION_SETTINGS, JSON.stringify(this.animationSettings));
      }
    } catch (e) {
      console.warn('Failed to save visualizer settings:', e);
    }
    this.listeners.forEach((cb) => cb());
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getVisualizerSettings(): VisualizerSettings {
    return { ...this.visualizerSettings };
  }

  public updateVisualizerSettings(partial: Partial<VisualizerSettings>): void {
    this.visualizerSettings = { ...this.visualizerSettings, ...partial };
    this.save();
  }

  public getAnimationSettings(): PlaybackAnimationSettings {
    return { ...this.animationSettings };
  }

  public updateAnimationSettings(partial: Partial<PlaybackAnimationSettings>): void {
    this.animationSettings = { ...this.animationSettings, ...partial };
    this.save();
  }

  public getThemeList() {
    return VISUALIZER_THEMES;
  }
}

export const visualizerSettingsService = new VisualizerSettingsService();
