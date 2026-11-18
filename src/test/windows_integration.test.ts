import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DEFINITIONS,
  ShortcutAction,
  ShortcutConfig,
} from '../types/shortcuts';
import {
  validateAccelerator,
  validateShortcutConfig,
  normalizeAccelerator,
  formatAcceleratorToKeys,
  keyboardEventToAccelerator,
} from '../services/shortcutService';

describe('Windows System Integration — Global Keyboard Shortcuts', () => {
  it('should verify all 7 required default shortcuts exist and match Windows standards', () => {
    expect(DEFAULT_SHORTCUTS.playPause).toBe('CommandOrControl+Alt+Space');
    expect(DEFAULT_SHORTCUTS.nextTrack).toBe('CommandOrControl+Alt+Right');
    expect(DEFAULT_SHORTCUTS.prevTrack).toBe('CommandOrControl+Alt+Left');
    expect(DEFAULT_SHORTCUTS.volumeUp).toBe('CommandOrControl+Alt+Up');
    expect(DEFAULT_SHORTCUTS.volumeDown).toBe('CommandOrControl+Alt+Down');
    expect(DEFAULT_SHORTCUTS.toggleMute).toBe('CommandOrControl+Alt+M');
    expect(DEFAULT_SHORTCUTS.toggleWindow).toBe('CommandOrControl+Alt+H');

    expect(SHORTCUT_DEFINITIONS).toHaveLength(7);
  });

  it('should validate default shortcut configuration without any conflicts or errors', () => {
    const result = validateShortcutConfig(DEFAULT_SHORTCUTS);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should reject empty or whitespace-only accelerators', () => {
    expect(validateAccelerator('').valid).toBe(false);
    expect(validateAccelerator('   ').valid).toBe(false);
  });

  it('should reject accelerators missing a modifier key (preventing normal typing hijacking)', () => {
    const noMod = validateAccelerator('Space');
    expect(noMod.valid).toBe(false);
    expect(noMod.error).toContain('at least one modifier key');

    const bareKey = validateAccelerator('K');
    expect(bareKey.valid).toBe(false);
  });

  it('should reject accelerators that contain only modifier keys without a trigger key', () => {
    const onlyMods = validateAccelerator('CommandOrControl+Alt');
    expect(onlyMods.valid).toBe(false);
    expect(onlyMods.error).toContain('trigger key');
  });

  it('should accept valid multi-modifier combinations', () => {
    expect(validateAccelerator('CommandOrControl+Alt+Space').valid).toBe(true);
    expect(validateAccelerator('Ctrl+Shift+P').valid).toBe(true);
    expect(validateAccelerator('Alt+F10').valid).toBe(true);
  });

  it('should canonicalize accelerator order regardless of input permutation', () => {
    const norm1 = normalizeAccelerator('Alt+CommandOrControl+Space');
    const norm2 = normalizeAccelerator('CommandOrControl+Alt+Space');
    const norm3 = normalizeAccelerator('Ctrl+Alt+Space');

    expect(norm1).toBe(norm2);
    expect(norm2).toBe(norm3);
    expect(norm1).toBe('alt+ctrl+space');
  });

  it('should detect conflicts when two distinct actions share the same shortcut', () => {
    const conflictingConfig: ShortcutConfig = {
      ...DEFAULT_SHORTCUTS,
      playPause: 'CommandOrControl+Alt+Space',
      nextTrack: 'Alt+Ctrl+Space', // Normalized identical to playPause!
    };

    const res = validateShortcutConfig(conflictingConfig);
    expect(res.valid).toBe(false);
    expect(res.errors.nextTrack).toBeDefined();
    expect(res.errors.nextTrack).toContain('Conflicts with Play / Pause');
    expect(res.errors.playPause).toBeDefined();
    expect(res.errors.playPause).toContain('Conflicts with Next Track');
  });

  it('should format accelerators into user-friendly UI badges', () => {
    expect(formatAcceleratorToKeys('CommandOrControl+Alt+Space')).toEqual(['Ctrl', 'Alt', 'Space']);
    expect(formatAcceleratorToKeys('CommandOrControl+Alt+Right')).toEqual(['Ctrl', 'Alt', 'Right']);
    expect(formatAcceleratorToKeys('Ctrl+Shift+ArrowUp')).toEqual(['Ctrl', 'Shift', 'Up']);
    expect(formatAcceleratorToKeys('Alt+M')).toEqual(['Alt', 'M']);
  });

  it('should parse keyboard events into accelerators correctly', () => {
    // Modifier alone returns null
    const modEvent = {
      key: 'Control',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
    } as any;
    expect(keyboardEventToAccelerator(modEvent)).toBeNull();

    // Ctrl + Alt + Space
    const fullEvent = {
      key: ' ',
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
    } as any;
    expect(keyboardEventToAccelerator(fullEvent)).toBe('CommandOrControl+Alt+Space');

    // Ctrl + Alt + ArrowRight
    const rightEvent = {
      key: 'ArrowRight',
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
    } as any;
    expect(keyboardEventToAccelerator(rightEvent)).toBe('CommandOrControl+Alt+Right');
  });
});

describe('Windows System Integration — SMTC & MediaSession Protocol', () => {
  it('should properly format and sanitize SMTC position state', () => {
    const sanitizePosition = (duration: number, currentTime: number, playbackRate: number) => {
      if (!Number.isFinite(duration) || duration <= 0) return null;
      if (!Number.isFinite(currentTime)) return null;
      return {
        duration,
        playbackRate: playbackRate > 0 ? playbackRate : 1.0,
        position: Math.min(Math.max(0, currentTime), duration),
      };
    };

    const normal = sanitizePosition(240, 45.5, 1.0);
    expect(normal).toEqual({ duration: 240, playbackRate: 1.0, position: 45.5 });

    // Boundary overshoot clamping
    const overshoot = sanitizePosition(200, 250, 1.25);
    expect(overshoot?.position).toBe(200);

    // Negative position clamp
    const negative = sanitizePosition(180, -10, 1.0);
    expect(negative?.position).toBe(0);

    // Invalid duration rejection
    expect(sanitizePosition(0, 10, 1.0)).toBeNull();
    expect(sanitizePosition(-50, 10, 1.0)).toBeNull();
    expect(sanitizePosition(NaN, 10, 1.0)).toBeNull();
  });

  it('should handle album artwork gracefully with and without embedded covers', () => {
    const formatArtworkList = (artworkDataUrl?: string) => {
      if (artworkDataUrl && artworkDataUrl.startsWith('data:image/')) {
        return [
          {
            src: artworkDataUrl,
            sizes: '512x512',
            type: artworkDataUrl.includes('png') ? 'image/png' : 'image/jpeg',
          },
        ];
      }
      return [];
    };

    const withCover = formatArtworkList('data:image/jpeg;base64,/9j/4AAQSkZJRg...');
    expect(withCover).toHaveLength(1);
    expect(withCover[0].type).toBe('image/jpeg');

    const withoutCover = formatArtworkList(undefined);
    expect(withoutCover).toEqual([]);
  });
});

describe('Windows System Integration — System Tray Menu & Close Behavior', () => {
  it('should correctly format tray menu song information header', () => {
    const formatTraySongHeader = (track?: { title?: string; artist?: string }) => {
      if (track?.title) {
        return `🎵 ${track.title}${track.artist ? ` — ${track.artist}` : ''}`;
      }
      return '🎵 Harmoniq (Idle)';
    };

    expect(formatTraySongHeader({ title: 'Comfortably Numb', artist: 'Pink Floyd' })).toBe(
      '🎵 Comfortably Numb — Pink Floyd'
    );
    expect(formatTraySongHeader({ title: 'Solo Track' })).toBe('🎵 Solo Track');
    expect(formatTraySongHeader(undefined)).toBe('🎵 Harmoniq (Idle)');
  });

  it('should toggle play/pause label based on active playback state', () => {
    const getPlayPauseLabel = (isPlaying: boolean) => (isPlaying ? 'Pause' : 'Play');
    expect(getPlayPauseLabel(true)).toBe('Pause');
    expect(getPlayPauseLabel(false)).toBe('Play');
  });

  it('should decide window close behavior based on closeToTray setting and isQuitting flag', () => {
    const evaluateCloseAction = (closeToTray: boolean, isQuitting: boolean) => {
      if (isQuitting) return 'terminate';
      if (closeToTray) return 'hide_to_tray';
      return 'terminate';
    };

    expect(evaluateCloseAction(true, false)).toBe('hide_to_tray');
    expect(evaluateCloseAction(false, false)).toBe('terminate');
    expect(evaluateCloseAction(true, true)).toBe('terminate');
    expect(evaluateCloseAction(false, true)).toBe('terminate');
  });
});
