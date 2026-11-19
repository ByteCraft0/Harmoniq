import {
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
  ThemePresetId,
  THEME_PALETTES,
} from '../types/appearance';

const STORAGE_KEY = 'harmoniq_appearance_settings_v1';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) {
    return `rgba(167, 139, 250, ${alpha})`;
  }
  const r = clean.length === 3
    ? parseInt(clean[0] + clean[0], 16)
    : parseInt(clean.substring(0, 2), 16);
  const g = clean.length === 3
    ? parseInt(clean[1] + clean[1], 16)
    : parseInt(clean.substring(2, 4), 16);
  const b = clean.length === 3
    ? parseInt(clean[2] + clean[2], 16)
    : parseInt(clean.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

export class AppearanceService {
  private settings: AppearanceSettings = { ...DEFAULT_APPEARANCE_SETTINGS };
  private listeners: Set<(settings: AppearanceSettings) => void> = new Set();

  constructor() {
    this.load();
    this.checkSystemReducedMotion();
    this.applyToDOM();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.settings = { ...this.settings, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load appearance settings:', e);
    }
  }

  private save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('Failed to save appearance settings:', e);
    }
    this.applyToDOM();
    this.notify();
  }

  private checkSystemReducedMotion(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches && !localStorage.getItem(STORAGE_KEY)) {
        this.settings.reducedMotion = true;
      }
      mediaQuery.addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          this.updateSettings({ reducedMotion: e.matches });
        }
      });
    }
  }

  public applyToDOM(): void {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;

    root.setAttribute('data-animations', this.settings.animationsEnabled ? 'enabled' : 'disabled');
    root.setAttribute('data-animation-intensity', this.settings.animationIntensity);
    root.setAttribute('data-reduced-motion', this.settings.reducedMotion ? 'true' : 'false');
    root.setAttribute('data-hover-effects', this.settings.hoverEffects ? 'enabled' : 'disabled');
    root.setAttribute(
      'data-album-animations',
      this.settings.albumArtworkAnimations ? 'enabled' : 'disabled'
    );
    root.setAttribute('data-ambient-lighting', this.settings.ambientLighting ? 'enabled' : 'disabled');
    root.setAttribute('data-theme-preset', this.settings.themePreset);
    root.setAttribute('data-high-contrast', this.settings.highContrastMode ? 'true' : 'false');

    // Resolve active colors
    const isCustom = this.settings.themePreset === 'custom';
    const palette = THEME_PALETTES[this.settings.themePreset] || THEME_PALETTES.obsidian_violet;

    const primary = isCustom
      ? this.settings.customAccentColor || palette.primary
      : palette.primary;
    const secondary = isCustom
      ? this.settings.customSecondaryColor || palette.secondary
      : palette.secondary;
    const surfaceBg = this.settings.highContrastMode ? '#000000' : palette.surfaceBg;

    // Apply Dynamic CSS variables to root if style object is supported
    if (root.style && typeof root.style.setProperty === 'function') {
      root.style.setProperty('--accent-primary', primary);
      root.style.setProperty('--accent-secondary', secondary);
      root.style.setProperty('--accent-dynamic', primary);
      root.style.setProperty('--accent-dynamic-secondary', secondary);
      root.style.setProperty('--accent-glow', hexToRgba(primary, 0.15));
      root.style.setProperty('--ambient-primary', hexToRgba(primary, 0.20));
      root.style.setProperty('--ambient-secondary', hexToRgba(secondary, 0.15));
      root.style.setProperty('--glow-dynamic', `0 0 24px ${hexToRgba(primary, 0.35)}`);

      if (this.settings.highContrastMode) {
        root.style.setProperty('--bg-main', '#000000');
        root.style.setProperty('--bg-sidebar', '#040406');
        root.style.setProperty('--bg-card', '#0a0a0f');
        root.style.setProperty('--border-subtle', '#4b4b5e');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#d4d4d8');
      } else {
        root.style.setProperty('--bg-main', surfaceBg);
        root.style.setProperty('--bg-sidebar', '#0D0D12');
        root.style.setProperty('--bg-card', '#14141B');
        root.style.setProperty('--border-subtle', '#272733');
        root.style.setProperty('--text-primary', '#F5F3FF');
        root.style.setProperty('--text-secondary', '#A1A1AA');
      }
    }
  }

  public getSettings(): AppearanceSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AppearanceSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  public setThemePreset(preset: ThemePresetId): void {
    this.updateSettings({ themePreset: preset });
  }

  public setCustomColors(primary: string, secondary: string): void {
    this.updateSettings({
      themePreset: 'custom',
      customAccentColor: primary,
      customSecondaryColor: secondary,
    });
  }

  public setHighContrast(enabled: boolean): void {
    this.updateSettings({ highContrastMode: enabled });
  }

  public isViewPinned(viewId: string): boolean {
    return (this.settings.sidebarPinnedViews || []).includes(viewId);
  }

  public togglePinView(viewId: string): boolean {
    const current = new Set(this.settings.sidebarPinnedViews || []);
    let isNowPinned = false;
    if (current.has(viewId)) {
      current.delete(viewId);
      isNowPinned = false;
    } else {
      current.add(viewId);
      isNowPinned = true;
    }
    this.updateSettings({ sidebarPinnedViews: Array.from(current) });
    return isNowPinned;
  }

  public subscribe(cb: (settings: AppearanceSettings) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSettings());
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    const s = this.getSettings();
    this.listeners.forEach((cb) => cb(s));
  }
}

export const appearanceService = new AppearanceService();
