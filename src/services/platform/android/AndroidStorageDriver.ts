import { IStorageDriver } from '../IStorageDriver';

export class AndroidStorageDriver implements IStorageDriver {
  public async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Preferences) {
      try {
        const { value } = await cap.Plugins.Preferences.get({ key });
        if (value !== null && value !== undefined) {
          return JSON.parse(value) as T;
        }
      } catch {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch {}
    }

    return defaultValue ?? null;
  }

  public async set<T>(key: string, value: T): Promise<boolean> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Preferences) {
      try {
        await cap.Plugins.Preferences.set({ key, value: serialized });
      } catch {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, serialized);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  public async remove(key: string): Promise<boolean> {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Preferences) {
      try {
        await cap.Plugins.Preferences.remove({ key });
      } catch {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    return true;
  }

  public async clear(): Promise<boolean> {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Preferences) {
      try {
        await cap.Plugins.Preferences.clear();
      } catch {}
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {}
    }

    return true;
  }
}
