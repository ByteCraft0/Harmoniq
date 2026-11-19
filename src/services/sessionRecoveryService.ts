import { SessionState, SessionSettings, DEFAULT_SESSION_SETTINGS } from '../types/session';

const STORAGE_STATE_KEY = 'harmoniq_session_state_v1';
const STORAGE_SETTINGS_KEY = 'harmoniq_session_settings_v1';

export class SessionRecoveryService {
  private settings: SessionSettings = { ...DEFAULT_SESSION_SETTINGS };
  private lastSavedState: SessionState | null = null;
  private saveDebounceTimer: any = null;

  constructor() {
    this.loadSettings();
    this.loadLastState();
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.settings = { ...this.settings, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load session settings:', e);
    }
  }

  private loadLastState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_STATE_KEY);
        if (raw) {
          this.lastSavedState = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn('Failed to load session state:', e);
    }
  }

  public getSettings(): SessionSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<SessionSettings>): void {
    this.settings = { ...this.settings, ...partial };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_SETTINGS_KEY, this.settings).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to save session settings:', e);
    }
  }

  public getSavedSession(): SessionState | null {
    if (!this.settings.restoreSessionOnLaunch) return null;
    return this.lastSavedState;
  }

  public saveSession(state: Omit<SessionState, 'lastSaved'>): void {
    if (!this.settings.restoreSessionOnLaunch) return;

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.saveSessionImmediate(state);
    }, 1500);
  }

  public saveSessionImmediate(state: Omit<SessionState, 'lastSaved'>): void {
    const fullState: SessionState = {
      ...state,
      lastSaved: Date.now(),
    };
    this.lastSavedState = fullState;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(fullState));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_STATE_KEY, fullState).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to save session state:', e);
    }
  }

  public clearSession(): void {
    this.lastSavedState = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_STATE_KEY);
      }
    } catch {}
  }
}

export const sessionRecoveryService = new SessionRecoveryService();
