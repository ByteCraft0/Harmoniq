import { ShortcutAction } from './shortcuts';

export type HotkeyScenario = 'desktop' | 'audiophile' | 'mediakey' | 'gaming' | 'laptop' | 'custom';

export interface HotkeyProfile {
  id: string;
  name: string;
  description: string;
  scenario: HotkeyScenario;
  isBuiltIn: boolean;
  shortcuts: Record<ShortcutAction, string>;
  createdAt: string;
  updatedAt: string;
}

export interface HotkeyConflictResult {
  hasConflict: boolean;
  conflicts: Record<string, string>;
  isNavigationConflict?: boolean;
}

export const RESERVED_NAVIGATION_SHORTCUTS: { key: string; label: string }[] = [
  { key: 'alt+left', label: 'Violin Back Navigation' },
  { key: 'alt+right', label: 'Trumpet Forward Navigation' },
  { key: 'browserback', label: 'Browser Back' },
  { key: 'browserforward', label: 'Browser Forward' },
];

export const BUILTIN_HOTKEY_PROFILES: HotkeyProfile[] = [
  {
    id: 'profile_default_desktop',
    name: 'Default Desktop',
    description: 'Full global system control with balanced multi-modifier combinations.',
    scenario: 'desktop',
    isBuiltIn: true,
    shortcuts: {
      playPause: 'CommandOrControl+Alt+Space',
      nextTrack: 'CommandOrControl+Alt+Right',
      prevTrack: 'CommandOrControl+Alt+Left',
      volumeUp: 'CommandOrControl+Alt+Up',
      volumeDown: 'CommandOrControl+Alt+Down',
      toggleMute: 'CommandOrControl+Alt+M',
      toggleWindow: 'CommandOrControl+Alt+H',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_audiophile',
    name: 'Audiophile / Minimalist',
    description: 'Pure focused listening with streamlined modifiers, no accidental window toggles.',
    scenario: 'audiophile',
    isBuiltIn: true,
    shortcuts: {
      playPause: 'CommandOrControl+Space',
      nextTrack: 'CommandOrControl+Right',
      prevTrack: 'CommandOrControl+Left',
      volumeUp: 'CommandOrControl+Up',
      volumeDown: 'CommandOrControl+Down',
      toggleMute: 'CommandOrControl+M',
      toggleWindow: 'CommandOrControl+Shift+H',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_mediakey',
    name: 'Media Key Only',
    description: 'Uses dedicated hardware multimedia keyboard keys directly.',
    scenario: 'mediakey',
    isBuiltIn: true,
    shortcuts: {
      playPause: 'MediaPlayPause',
      nextTrack: 'MediaNextTrack',
      prevTrack: 'MediaPreviousTrack',
      volumeUp: 'VolumeUp',
      volumeDown: 'VolumeDown',
      toggleMute: 'VolumeMute',
      toggleWindow: 'CommandOrControl+Alt+H',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_gaming',
    name: 'Gaming / Background Friendly',
    description: 'NumPad-based combinations that never interfere with WASD, Shift, or FPS keys.',
    scenario: 'gaming',
    isBuiltIn: true,
    shortcuts: {
      playPause: 'CommandOrControl+Num5',
      nextTrack: 'CommandOrControl+Num6',
      prevTrack: 'CommandOrControl+Num4',
      volumeUp: 'CommandOrControl+Num8',
      volumeDown: 'CommandOrControl+Num2',
      toggleMute: 'CommandOrControl+Num0',
      toggleWindow: 'CommandOrControl+NumDec',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_laptop',
    name: 'Laptop / Compact',
    description: 'Ergonomic letter keys with Ctrl+Alt, ideal for compact keyboards without arrows.',
    scenario: 'laptop',
    isBuiltIn: true,
    shortcuts: {
      playPause: 'CommandOrControl+Alt+P',
      nextTrack: 'CommandOrControl+Alt+N',
      prevTrack: 'CommandOrControl+Alt+B',
      volumeUp: 'CommandOrControl+Alt+U',
      volumeDown: 'CommandOrControl+Alt+D',
      toggleMute: 'CommandOrControl+Alt+M',
      toggleWindow: 'CommandOrControl+Alt+W',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
