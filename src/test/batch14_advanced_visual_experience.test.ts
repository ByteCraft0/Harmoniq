import { describe, it, expect, beforeEach } from 'vitest';
import { visualizerSettingsService } from '../services/visualizerSettingsService';
import { VISUALIZER_THEMES, VisualizerThemeId } from '../types/visualizer';

describe('Batch 14: Advanced Visual Experience', () => {
  it('defines all 8 specified visualizer themes', () => {
    const requiredThemes: VisualizerThemeId[] = [
      'minimal-bars',
      'neon-spectrum',
      'circular-spectrum',
      'waveform',
      'particle-field',
      'retro-equalizer',
      'ambient-waves',
      'frequency-rings',
    ];

    const definedIds = VISUALIZER_THEMES.map((t) => t.id);
    for (const req of requiredThemes) {
      expect(definedIds).toContain(req);
    }
    expect(VISUALIZER_THEMES.length).toBe(8);
  });

  it('updates and persists visualizer settings', () => {
    visualizerSettingsService.updateVisualizerSettings({
      theme: 'retro-equalizer',
      sensitivity: 1.8,
      intensity: 1.4,
    });

    const current = visualizerSettingsService.getVisualizerSettings();
    expect(current.theme).toBe('retro-equalizer');
    expect(current.sensitivity).toBe(1.8);
    expect(current.intensity).toBe(1.4);
  });

  it('updates and persists playback animation and reduced motion preferences', () => {
    visualizerSettingsService.updateAnimationSettings({
      animationsEnabled: true,
      reducedMotion: true,
      animationIntensity: 0.8,
      albumArtTransitions: false,
    });

    const anim = visualizerSettingsService.getAnimationSettings();
    expect(anim.animationsEnabled).toBe(true);
    expect(anim.reducedMotion).toBe(true);
    expect(anim.animationIntensity).toBe(0.8);
    expect(anim.albumArtTransitions).toBe(false);
  });

  it('allows switching between all 8 themes instantly', () => {
    for (const theme of VISUALIZER_THEMES) {
      visualizerSettingsService.updateVisualizerSettings({ theme: theme.id });
      const current = visualizerSettingsService.getVisualizerSettings();
      expect(current.theme).toBe(theme.id);
    }
  });
});
