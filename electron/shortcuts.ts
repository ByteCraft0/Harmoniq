export type ShortcutAction =
  | 'playPause'
  | 'nextTrack'
  | 'prevTrack'
  | 'volumeUp'
  | 'volumeDown'
  | 'toggleMute'
  | 'toggleWindow';

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'playPause',
  'nextTrack',
  'prevTrack',
  'volumeUp',
  'volumeDown',
  'toggleMute',
  'toggleWindow',
];

export const SHORTCUT_LABELS: Record<ShortcutAction, { label: string; description: string }> = {
  playPause: {
    label: 'Play / Pause',
    description: 'Toggle playback of the current track',
  },
  nextTrack: {
    label: 'Next Track',
    description: 'Skip to the next song in the active queue',
  },
  prevTrack: {
    label: 'Previous Track',
    description: 'Return to previous song or track beginning',
  },
  volumeUp: {
    label: 'Volume Up',
    description: 'Increase master audio output volume by 5%',
  },
  volumeDown: {
    label: 'Volume Down',
    description: 'Decrease master audio output volume by 5%',
  },
  toggleMute: {
    label: 'Mute / Unmute',
    description: 'Toggle audio output mute state',
  },
  toggleWindow: {
    label: 'Show / Hide Harmoniq',
    description: 'Toggle Harmoniq between minimized/tray and active view',
  },
};

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  playPause: 'CommandOrControl+Alt+Space',
  nextTrack: 'CommandOrControl+Alt+Right',
  prevTrack: 'CommandOrControl+Alt+Left',
  volumeUp: 'CommandOrControl+Alt+Up',
  volumeDown: 'CommandOrControl+Alt+Down',
  toggleMute: 'CommandOrControl+Alt+M',
  toggleWindow: 'CommandOrControl+Alt+H',
};

const MODIFIERS_SET = new Set([
  'commandorcontrol',
  'cmdorctrl',
  'command',
  'cmd',
  'control',
  'ctrl',
  'alt',
  'shift',
  'super',
  'meta',
]);

/**
 * Normalizes an accelerator string into a canonical representation for reliable conflict checking.
 * e.g. "Alt+Ctrl+Space" and "Ctrl+Alt+Space" both normalize to "alt+ctrl+space".
 */
export function normalizeAccelerator(acc: string): string {
  if (!acc || typeof acc !== 'string') return '';
  const parts = acc
    .trim()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);

  const modifiers: string[] = [];
  const keys: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'commandorcontrol' || lower === 'cmdorctrl') {
      modifiers.push('ctrl');
    } else if (lower === 'control') {
      modifiers.push('ctrl');
    } else if (MODIFIERS_SET.has(lower)) {
      modifiers.push(lower);
    } else {
      keys.push(lower);
    }
  }

  modifiers.sort();
  keys.sort();

  return [...modifiers, ...keys].join('+');
}

/**
 * Validates a single accelerator string.
 */
export function validateAccelerator(acc: string): { valid: boolean; error?: string } {
  if (!acc || typeof acc !== 'string' || !acc.trim()) {
    return { valid: false, error: 'Shortcut cannot be empty' };
  }

  const parts = acc
    .trim()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { valid: false, error: 'Shortcut cannot be empty' };
  }

  let hasModifier = false;
  let hasKey = false;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MODIFIERS_SET.has(lower)) {
      hasModifier = true;
    } else {
      hasKey = true;
    }
  }

  if (!hasModifier) {
    return {
      valid: false,
      error: 'Shortcut must contain at least one modifier key (Ctrl, Alt, or Shift)',
    };
  }

  if (!hasKey) {
    return {
      valid: false,
      error: 'Shortcut must include a trigger key (e.g., Space, Right, M) in addition to modifiers',
    };
  }

  return { valid: true };
}

/**
 * Validates an entire shortcut configuration for conflicts and invalid accelerators.
 */
export function validateShortcutConfig(
  config: Partial<Record<ShortcutAction, string>>
): { valid: boolean; errors: Partial<Record<ShortcutAction, string>> } {
  const errors: Partial<Record<ShortcutAction, string>> = {};
  const seenNorms = new Map<string, ShortcutAction>();

  for (const action of SHORTCUT_ACTIONS) {
    const acc = config[action];
    if (!acc) {
      errors[action] = 'Shortcut cannot be empty';
      continue;
    }

    const valResult = validateAccelerator(acc);
    if (!valResult.valid) {
      errors[action] = valResult.error;
      continue;
    }

    const norm = normalizeAccelerator(acc);
    if (seenNorms.has(norm)) {
      const priorAction = seenNorms.get(norm)!;
      errors[action] = `Conflicts with ${SHORTCUT_LABELS[priorAction]?.label || priorAction}`;
      if (!errors[priorAction]) {
        errors[priorAction] = `Conflicts with ${SHORTCUT_LABELS[action]?.label || action}`;
      }
    } else {
      seenNorms.set(norm, action);
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Converts an Electron accelerator string into a human-readable badge representation.
 * e.g. "CommandOrControl+Alt+Space" -> ["Ctrl", "Alt", "Space"]
 */
export function formatAcceleratorToKeys(acc: string): string[] {
  if (!acc) return [];
  return acc
    .trim()
    .split('+')
    .map((p) => {
      const clean = p.trim();
      const lower = clean.toLowerCase();
      if (lower === 'commandorcontrol' || lower === 'cmdorctrl' || lower === 'control' || lower === 'ctrl') return 'Ctrl';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      if (lower === 'meta' || lower === 'super') return 'Win';
      if (lower === 'space') return 'Space';
      if (lower === 'arrowright' || lower === 'right') return 'Right';
      if (lower === 'arrowleft' || lower === 'left') return 'Left';
      if (lower === 'arrowup' || lower === 'up') return 'Up';
      if (lower === 'arrowdown' || lower === 'down') return 'Down';
      return clean.length === 1 ? clean.toUpperCase() : clean;
    });
}
