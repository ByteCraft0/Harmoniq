import { IStorageDriver } from '../IStorageDriver';
import { getGlobalContext } from '../index';

export class ElectronStorageDriver implements IStorageDriver {
  private inMemoryFallback = new Map<string, any>();

  public async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    const ctx = getGlobalContext();

    if (ctx.harmoniqApi?.loadPersistentData) {
      try {
        const val = await ctx.harmoniqApi.loadPersistentData(key);
        if (val !== null && val !== undefined) return val as T;
      } catch (err) {
        console.warn(`[ElectronStorageDriver] loadPersistentData failed for key ${key}:`, err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch (err) {
        console.warn(`[ElectronStorageDriver] localStorage.getItem failed for key ${key}:`, err);
      }
    }

    if (this.inMemoryFallback.has(key)) {
      return this.inMemoryFallback.get(key) as T;
    }

    return defaultValue !== undefined ? defaultValue : null;
  }

  public async set<T>(key: string, value: T): Promise<boolean> {
    const ctx = getGlobalContext();
    let persisted = false;

    if (ctx.harmoniqApi?.savePersistentData) {
      try {
        persisted = await ctx.harmoniqApi.savePersistentData(key, value);
      } catch (err) {
        console.warn(`[ElectronStorageDriver] savePersistentData failed for key ${key}:`, err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        persisted = true;
      } catch (err) {
        console.warn(`[ElectronStorageDriver] localStorage.setItem failed for key ${key}:`, err);
      }
    }

    this.inMemoryFallback.set(key, value);
    return persisted || true;
  }

  public async remove(key: string): Promise<boolean> {
    this.inMemoryFallback.delete(key);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    return true;
  }

  public async clear(): Promise<boolean> {
    this.inMemoryFallback.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}
