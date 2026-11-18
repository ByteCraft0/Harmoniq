import {
  ShortcutAction,
  ShortcutConfig,
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
} from '../types/shortcuts';

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
    if (lower === 'commandorcontrol' || lower === 'cmdorctrl' || lower === 'control') {
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
 * Validates an accelerator string.
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
 * Validates full shortcut configuration for duplicate assignments or invalid keys.
 */
export function validateShortcutConfig(
  config: Partial<ShortcutConfig>
): { valid: boolean; errors: Partial<Record<ShortcutAction, string>> } {
  const errors: Partial<Record<ShortcutAction, string>> = {};
  const seenNorms = new Map<string, ShortcutAction>();

  const defsMap = new Map(SHORTCUT_DEFINITIONS.map((d) => [d.id, d.label]));

  for (const def of SHORTCUT_DEFINITIONS) {
    const action = def.id;
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
      errors[action] = `Conflicts with ${defsMap.get(priorAction) || priorAction}`;
      if (!errors[priorAction]) {
        errors[priorAction] = `Conflicts with ${defsMap.get(action) || action}`;
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
 * Splits an accelerator string into display badges (e.g. ["Ctrl", "Alt", "Space"]).
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

/**
 * Converts a KeyboardEvent from the UI into an Electron Accelerator string.
 */
export function keyboardEventToAccelerator(e: React.KeyboardEvent | KeyboardEvent): string | null {
  // If the user only pressed a modifier key by itself, don't finalize yet
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
}
