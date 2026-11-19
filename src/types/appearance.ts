export type AnimationIntensity = 'subtle' | 'normal' | 'enhanced';

export type ThemePresetId =
  | 'obsidian_violet'
  | 'emerald_matrix'
  | 'cyberpunk_amber'
  | 'electric_cyan'
  | 'crimson_velvet'
  | 'rose_gold'
  | 'custom';

export interface ThemePaletteDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  surfaceBg: string;
  ambientPrimary: string;
  ambientSecondary: string;
}

export const THEME_PALETTES: Record<ThemePresetId, ThemePaletteDefinition> = {
  obsidian_violet: {
    id: 'obsidian_violet',
    name: 'Obsidian Violet',
    description: 'Signature Harmoniq deep dark violet with lavender luminescence',
    primary: '#A78BFA',
    secondary: '#7C3AED',
    surfaceBg: '#09090B',
    ambientPrimary: 'rgba(167, 139, 250, 0.20)',
    ambientSecondary: 'rgba(124, 58, 237, 0.15)',
  },
  emerald_matrix: {
    id: 'emerald_matrix',
    name: 'Emerald Matrix',
    description: 'Deep forest obsidian with vivid neon emerald accents',
    primary: '#34D399',
    secondary: '#059669',
    surfaceBg: '#06120E',
    ambientPrimary: 'rgba(52, 211, 153, 0.20)',
    ambientSecondary: 'rgba(5, 150, 105, 0.15)',
  },
  cyberpunk_amber: {
    id: 'cyberpunk_amber',
    name: 'Cyberpunk Amber',
    description: 'High-contrast warm golden amber over midnight obsidian',
    primary: '#FBBF24',
    secondary: '#D97706',
    surfaceBg: '#120E06',
    ambientPrimary: 'rgba(251, 191, 36, 0.20)',
    ambientSecondary: 'rgba(217, 119, 6, 0.15)',
  },
  electric_cyan: {
    id: 'electric_cyan',
    name: 'Electric Cyan',
    description: 'Crisp Arctic cyan glow over deep maritime obsidian',
    primary: '#38BDF8',
    secondary: '#0284C7',
    surfaceBg: '#060F17',
    ambientPrimary: 'rgba(56, 189, 248, 0.20)',
    ambientSecondary: 'rgba(2, 132, 199, 0.15)',
  },
  crimson_velvet: {
    id: 'crimson_velvet',
    name: 'Crimson Velvet',
    description: 'Rich ruby and crimson accents over royal obsidian',
    primary: '#F43F5E',
    secondary: '#E11D48',
    surfaceBg: '#14070A',
    ambientPrimary: 'rgba(244, 63, 94, 0.20)',
    ambientSecondary: 'rgba(225, 29, 72, 0.15)',
  },
  rose_gold: {
    id: 'rose_gold',
    name: 'Rose Gold',
    description: 'Soft pink and rose metallic glow with elegant warmth',
    primary: '#FB7185',
    secondary: '#DB2777',
    surfaceBg: '#12070E',
    ambientPrimary: 'rgba(251, 113, 133, 0.20)',
    ambientSecondary: 'rgba(219, 39, 119, 0.15)',
  },
  custom: {
    id: 'custom',
    name: 'Custom Palette',
    description: 'User-configured custom hex accent colors',
    primary: '#A78BFA',
    secondary: '#7C3AED',
    surfaceBg: '#09090B',
    ambientPrimary: 'rgba(167, 139, 250, 0.20)',
    ambientSecondary: 'rgba(124, 58, 237, 0.15)',
  },
};

export interface AppearanceSettings {
  animationsEnabled: boolean;
  animationIntensity: AnimationIntensity;
  reducedMotion: boolean;
  hoverEffects: boolean;
  albumArtworkAnimations: boolean;
  ambientLighting: boolean;
  vinylStyleAnimation: boolean;

  // Harmoniq 2.0 Personalization Engine
  themePreset: ThemePresetId;
  customAccentColor: string;
  customSecondaryColor: string;
  highContrastMode: boolean;
  sidebarPinnedViews: string[];
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  animationsEnabled: true,
  animationIntensity: 'normal',
  reducedMotion: false,
  hoverEffects: true,
  albumArtworkAnimations: true,
  ambientLighting: true,
  vinylStyleAnimation: false,

  // Harmoniq 2.0 Personalization Defaults
  themePreset: 'obsidian_violet',
  customAccentColor: '#A78BFA',
  customSecondaryColor: '#7C3AED',
  highContrastMode: false,
  sidebarPinnedViews: [],
};
