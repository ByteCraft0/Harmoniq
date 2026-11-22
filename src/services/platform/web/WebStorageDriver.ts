import { IStorageDriver } from '../IStorageDriver';

export class WebStorageDriver implements IStorageDriver {
  public async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    if (typeof localStorage === 'undefined') return defaultValue ?? null;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // JSON parse error
    }
    return defaultValue ?? null;
  }

  public async set<T>(key: string, value: T): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, payload);
      return true;
    } catch {
      return false;
    }
  }

  public async remove(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  public async clear(): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
}
