import { getPlatformDriver } from './platform';

export type MobileThemeMode = 'dark' | 'light' | 'system';
export type MobileAccentColor = 'violet' | 'blue' | 'purple' | 'emerald' | 'amber';
export type MobileListDensity = 'comfortable' | 'compact';

export interface MobileAppearanceSettings {
  themeMode: MobileThemeMode;
  accentColor: MobileAccentColor;
  density: MobileListDensity;
  reduceAnimations: boolean;
}

export const DEFAULT_MOBILE_APPEARANCE: MobileAppearanceSettings = {
  themeMode: 'dark',
  accentColor: 'violet',
  density: 'comfortable',
  reduceAnimations: false,
};

export const STORAGE_MOBILE_APPEARANCE_KEY = 'harmoniq_mobile_appearance_v1';

export const MOBILE_ACCENT_PALETTES: Record<
  MobileAccentColor,
  {
    name: string;
    primary: string;
    secondary: string;
    glow: string;
    chipColor: string;
  }
> = {
  violet: {
    name: 'Harmoniq Violet',
    primary: '#a78bfa',
    secondary: '#7c3aed',
    glow: 'rgba(167, 139, 250, 0.25)',
    chipColor: '#8b5cf6',
  },
  blue: {
    name: 'Sapphire Blue',
    primary: '#60a5fa',
    secondary: '#2563eb',
    glow: 'rgba(96, 165, 250, 0.25)',
    chipColor: '#3b82f6',
  },
  purple: {
    name: 'Neon Purple',
    primary: '#c084fc',
    secondary: '#9333ea',
    glow: 'rgba(192, 132, 252, 0.25)',
    chipColor: '#a855f7',
  },
  emerald: {
    name: 'Emerald Green',
    primary: '#34d399',
    secondary: '#059669',
    glow: 'rgba(52, 211, 153, 0.25)',
    chipColor: '#10b981',
  },
  amber: {
    name: 'Amber Gold',
    primary: '#fbbf24',
    secondary: '#d97706',
    glow: 'rgba(251, 191, 36, 0.25)',
    chipColor: '#f59e0b',
  },
};

export class MobileAppearanceService {
  private settings: MobileAppearanceSettings = { ...DEFAULT_MOBILE_APPEARANCE };
  private listeners: Set<(settings: MobileAppearanceSettings) => void> = new Set();
  private systemMediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.loadSynchronous();
    this.loadAsynchronous();
    this.setupSystemMediaListener();
    this.applyToDOM();
  }

  private loadSynchronous(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_MOBILE_APPEARANCE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.settings = { ...this.settings, ...parsed };
        }
      }
    } catch (e) {
      console.warn('[MobileAppearance] Failed to parse local appearance settings:', e);
    }
  }

  private async loadAsynchronous(): Promise<void> {
    try {
      const driver = getPlatformDriver();
      if (driver?.storage?.get) {
        const nativeStored = await driver.storage.get<MobileAppearanceSettings | string>(
          STORAGE_MOBILE_APPEARANCE_KEY
        );
        if (nativeStored) {
          const parsed =
            typeof nativeStored === 'string' ? JSON.parse(nativeStored) : nativeStored;
          this.settings = { ...this.settings, ...parsed };
          this.applyToDOM();
          this.notify();
        }
      }
    } catch {
      // Driver storage might not be initialized or available in testing
    }
  }

  private save(): void {
    const serialized = JSON.stringify(this.settings);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_MOBILE_APPEARANCE_KEY, serialized);
      }
    } catch (e) {
      console.warn('[MobileAppearance] Failed to save appearance settings to localStorage:', e);
    }

    try {
      const driver = getPlatformDriver();
      if (driver?.storage?.set) {
        driver.storage.set(STORAGE_MOBILE_APPEARANCE_KEY, this.settings).catch(() => {});
      }
    } catch {
      // Ignore background persistence failure
    }

    this.applyToDOM();
    this.notify();
  }

  private setupSystemMediaListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemMediaListener = () => {
        if (this.settings.themeMode === 'system') {
          this.applyToDOM();
          this.notify();
        }
      };
      if (mql.addEventListener) {
        mql.addEventListener('change', this.systemMediaListener);
      } else if ('addListener' in mql) {
        (mql as any).addListener(this.systemMediaListener);
      }
    }
  }

  public getEffectiveTheme(): 'dark' | 'light' {
    if (this.settings.themeMode === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'dark' : 'light';
      }
      return 'dark';
    }
    return this.settings.themeMode;
  }

  public applyToDOM(): void {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;

    const effectiveTheme = this.getEffectiveTheme();
    root.setAttribute('data-mobile-theme-mode', this.settings.themeMode);
    root.setAttribute('data-mobile-theme', effectiveTheme);
    root.setAttribute('data-mobile-accent', this.settings.accentColor);
    root.setAttribute('data-mobile-density', this.settings.density);
    root.setAttribute(
      'data-mobile-reduce-animations',
      this.settings.reduceAnimations ? 'true' : 'false'
    );

    // Apply color palette variables
    const palette = MOBILE_ACCENT_PALETTES[this.settings.accentColor] || MOBILE_ACCENT_PALETTES.violet;
    if (root.style && typeof root.style.setProperty === 'function') {
      root.style.setProperty('--mobile-accent-primary', palette.primary);
      root.style.setProperty('--mobile-accent-secondary', palette.secondary);
      root.style.setProperty('--mobile-accent-glow', palette.glow);
      root.style.setProperty('--accent-primary', palette.primary);
      root.style.setProperty('--accent-secondary', palette.secondary);
      root.style.setProperty('--accent-dynamic', palette.primary);
      root.style.setProperty('--accent-dynamic-secondary', palette.secondary);
      root.style.setProperty('--accent-glow', palette.glow);

      if (effectiveTheme === 'light') {
        root.style.setProperty('--bg-main', '#0f1015');
        root.style.setProperty('--bg-sidebar', '#13141c');
        root.style.setProperty('--bg-card', '#1a1b26');
        root.style.setProperty('--border-subtle', '#2f3144');
      } else {
        root.style.setProperty('--bg-main', '#09090b');
        root.style.setProperty('--bg-sidebar', '#0d0d12');
        root.style.setProperty('--bg-card', '#14141b');
        root.style.setProperty('--border-subtle', '#272733');
      }
    }
  }

  public getSettings(): MobileAppearanceSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<MobileAppearanceSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  public setThemeMode(mode: MobileThemeMode): void {
    this.updateSettings({ themeMode: mode });
  }

  public setAccentColor(accent: MobileAccentColor): void {
    this.updateSettings({ accentColor: accent });
  }

  public setDensity(density: MobileListDensity): void {
    this.updateSettings({ density });
  }

  public setReduceAnimations(reduce: boolean): void {
    this.updateSettings({ reduceAnimations: reduce });
  }

  public subscribe(listener: (settings: MobileAppearanceSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getSettings();
    this.listeners.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.error('[MobileAppearance] Error in listener callback:', err);
      }
    });
  }
}

export const mobileAppearanceService = new MobileAppearanceService();
