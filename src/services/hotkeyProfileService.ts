import {
  ShortcutAction,
  ShortcutConfig,
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
} from '../types/shortcuts';
import {
  HotkeyProfile,
  HotkeyConflictResult,
  RESERVED_NAVIGATION_SHORTCUTS,
  BUILTIN_HOTKEY_PROFILES,
  HotkeyScenario,
} from '../types/hotkeyProfile';
import { normalizeAccelerator, validateAccelerator } from './shortcutService';

const STORAGE_PROFILES_KEY = 'harmoniq_hotkey_profiles_v1';
const STORAGE_ACTIVE_PROFILE_KEY = 'harmoniq_active_hotkey_profile_v1';

export class HotkeyProfileService {
  private static instance: HotkeyProfileService;
  private profiles: HotkeyProfile[] = [];
  private activeProfileId: string = 'profile_default_desktop';

  private constructor() {
    this.load();
  }

  public static getInstance(): HotkeyProfileService {
    if (!HotkeyProfileService.instance) {
      HotkeyProfileService.instance = new HotkeyProfileService();
    }
    return HotkeyProfileService.instance;
  }

  private load(): void {
    let loadedProfiles: HotkeyProfile[] = [];
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_PROFILES_KEY);
        if (raw) {
          loadedProfiles = JSON.parse(raw);
        }
      } catch (e) {
        console.warn('Failed to parse hotkey profiles from localStorage', e);
      }
    }

    // Merge builtin profiles with saved profiles
    const profileMap = new Map<string, HotkeyProfile>();
    BUILTIN_HOTKEY_PROFILES.forEach((p) => profileMap.set(p.id, { ...p }));
    loadedProfiles.forEach((p) => profileMap.set(p.id, p));

    this.profiles = Array.from(profileMap.values());

    if (typeof localStorage !== 'undefined') {
      const savedActive = localStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY);
      if (savedActive && this.profiles.some((p) => p.id === savedActive)) {
        this.activeProfileId = savedActive;
      }
    }
  }

  private save(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(this.profiles));
        localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, this.activeProfileId);
      } catch (e) {
        console.warn('Failed to save hotkey profiles to localStorage', e);
      }
    }
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
      (window as any).harmoniqApi
        .savePersistentData(STORAGE_PROFILES_KEY, this.profiles)
        .catch(() => {});
    }
  }

  public getProfiles(): HotkeyProfile[] {
    return [...this.profiles];
  }

  public getActiveProfile(): HotkeyProfile {
    const found = this.profiles.find((p) => p.id === this.activeProfileId);
    return found ? { ...found } : { ...BUILTIN_HOTKEY_PROFILES[0] };
  }

  public async setActiveProfile(id: string): Promise<boolean> {
    const target = this.profiles.find((p) => p.id === id);
    if (!target) return false;

    this.activeProfileId = id;
    this.save();

    // Register active profile shortcuts with Electron if available
    if (typeof window !== 'undefined' && window.harmoniqApi?.updateGlobalShortcuts) {
      try {
        await window.harmoniqApi.updateGlobalShortcuts(target.shortcuts);
      } catch (e) {
        console.warn('Failed to register active hotkey profile with Electron:', e);
      }
    }

    return true;
  }

  public createProfile(name: string, scenario: HotkeyScenario = 'custom', baseShortcuts?: ShortcutConfig): HotkeyProfile {
    const active = this.getActiveProfile();
    const newProfile: HotkeyProfile = {
      id: `profile_custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim() || 'Custom Profile',
      description: `User-defined hotkey configuration (${scenario} scenario)`,
      scenario,
      isBuiltIn: false,
      shortcuts: baseShortcuts ? { ...baseShortcuts } : { ...active.shortcuts },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.push(newProfile);
    this.save();
    return newProfile;
  }

  public updateProfileShortcuts(
    profileId: string,
    action: ShortcutAction,
    keyCombo: string
  ): { success: boolean; error?: string; conflicts?: HotkeyConflictResult } {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return { success: false, error: 'Profile not found' };

    // Validate key combo
    const valResult = validateAccelerator(keyCombo);
    if (!valResult.valid) {
      return { success: false, error: valResult.error };
    }

    // Check for conflicts
    const nextShortcuts = { ...profile.shortcuts, [action]: keyCombo };
    const conflicts = this.detectConflicts(nextShortcuts);

    if (conflicts.hasConflict) {
      return {
        success: false,
        error: conflicts.conflicts[action] || 'Shortcut conflict detected',
        conflicts,
      };
    }

    profile.shortcuts[action] = keyCombo;
    profile.updatedAt = new Date().toISOString();
    this.save();

    if (this.activeProfileId === profileId && typeof window !== 'undefined' && window.harmoniqApi?.updateGlobalShortcuts) {
      window.harmoniqApi.updateGlobalShortcuts(profile.shortcuts).catch(() => {});
    }

    return { success: true };
  }

  public updateProfileMetadata(
    profileId: string,
    name: string,
    description?: string,
    scenario?: HotkeyScenario
  ): boolean {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return false;
    if (profile.isBuiltIn) return false; // builtins cannot be renamed

    profile.name = name.trim() || profile.name;
    if (description !== undefined) profile.description = description;
    if (scenario !== undefined) profile.scenario = scenario;
    profile.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  public restoreDefaultShortcuts(profileId: string): HotkeyProfile | null {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return null;

    const builtinMatch = BUILTIN_HOTKEY_PROFILES.find((p) => p.id === profileId);
    if (builtinMatch) {
      profile.shortcuts = { ...builtinMatch.shortcuts };
    } else {
      profile.shortcuts = { ...DEFAULT_SHORTCUTS };
    }

    profile.updatedAt = new Date().toISOString();
    this.save();

    if (this.activeProfileId === profileId && typeof window !== 'undefined' && window.harmoniqApi?.updateGlobalShortcuts) {
      window.harmoniqApi.updateGlobalShortcuts(profile.shortcuts).catch(() => {});
    }

    return profile;
  }

  public deleteProfile(profileId: string): boolean {
    const index = this.profiles.findIndex((p) => p.id === profileId);
    if (index === -1) return false;
    if (this.profiles[index].isBuiltIn) return false; // cannot delete built-in profiles

    this.profiles.splice(index, 1);
    if (this.activeProfileId === profileId) {
      this.activeProfileId = 'profile_default_desktop';
      this.setActiveProfile(this.activeProfileId);
    } else {
      this.save();
    }
    return true;
  }

  public detectConflicts(shortcuts: Record<string, string>): HotkeyConflictResult {
    const conflicts: Record<string, string> = {};
    const seenNorms = new Map<string, string>();
    let isNavigationConflict = false;

    // Check conflict against reserved Harmoniq navigation shortcuts (Violin Back & Trumpet Forward)
    for (const [action, combo] of Object.entries(shortcuts)) {
      if (!combo) continue;
      const norm = normalizeAccelerator(combo);

      for (const res of RESERVED_NAVIGATION_SHORTCUTS) {
        if (norm === res.key) {
          conflicts[action] = `Conflicts with ${res.label} (${res.key.toUpperCase()})`;
          isNavigationConflict = true;
        }
      }

      if (seenNorms.has(norm)) {
        const priorAction = seenNorms.get(norm)!;
        const priorDef = SHORTCUT_DEFINITIONS.find((d) => d.id === priorAction)?.label || priorAction;
        const currentDef = SHORTCUT_DEFINITIONS.find((d) => d.id === action)?.label || action;

        conflicts[action] = `Conflicts with ${priorDef}`;
        if (!conflicts[priorAction]) {
          conflicts[priorAction] = `Conflicts with ${currentDef}`;
        }
      } else {
        seenNorms.set(norm, action);
      }
    }

    return {
      hasConflict: Object.keys(conflicts).length > 0,
      conflicts,
      isNavigationConflict,
    };
  }

  public exportProfile(profileId: string): string {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    const exportPayload = {
      format: 'harmoniq_hotkey_profile',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        name: profile.name,
        description: profile.description,
        scenario: profile.scenario,
        shortcuts: profile.shortcuts,
      },
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  public importProfile(jsonStr: string): { success: boolean; profile?: HotkeyProfile; error?: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || (parsed.format !== 'harmoniq_hotkey_profile' && !parsed.profile && !parsed.shortcuts)) {
        return { success: false, error: 'Invalid profile format. Expected Harmoniq hotkey profile JSON.' };
      }

      const pData = parsed.profile || parsed;
      const name = (pData.name || 'Imported Profile').trim();
      const scenario = pData.scenario || 'custom';
      const shortcuts = pData.shortcuts;

      if (!shortcuts || typeof shortcuts !== 'object') {
        return { success: false, error: 'Profile does not contain valid shortcut mappings.' };
      }

      const validShortcuts: Partial<ShortcutConfig> = {};
      for (const def of SHORTCUT_DEFINITIONS) {
        const key = shortcuts[def.id] || def.defaultKey;
        const val = validateAccelerator(key);
        if (!val.valid) {
          return { success: false, error: `Invalid keybinding for ${def.label}: ${val.error}` };
        }
        validShortcuts[def.id] = key;
      }

      const conflicts = this.detectConflicts(validShortcuts as Record<string, string>);
      if (conflicts.hasConflict) {
        const firstError = Object.values(conflicts.conflicts)[0];
        return { success: false, error: `Profile contains shortcut conflict: ${firstError}` };
      }

      const created = this.createProfile(name, scenario, validShortcuts as ShortcutConfig);
      return { success: true, profile: created };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to parse JSON file' };
    }
  }
}

export const hotkeyProfileService = HotkeyProfileService.getInstance();
