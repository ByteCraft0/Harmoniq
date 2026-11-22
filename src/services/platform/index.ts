import { IPlatformDriver } from './IPlatformDriver';
import { PlatformType } from './types';
import { ElectronPlatformDriver } from './electron/ElectronPlatformDriver';
import { AndroidPlatformDriver } from './android/AndroidPlatformDriver';
import { WebPlatformDriver } from './web/WebPlatformDriver';

export * from './types';
export * from './IPlatformDriver';
export * from './IAudioDriver';
export * from './ILibraryDriver';
export * from './IStorageDriver';
export * from './artworkHelper';

export function getGlobalContext(): any {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return {};
}

export function detectPlatform(): PlatformType {
  const ctx = getGlobalContext();

  // 1. Electron environment check: window.harmoniqApi exposed via preload script
  if (Boolean(ctx.harmoniqApi)) {
    return 'electron';
  }

  // 2. Capacitor native platform check: running inside Android native shell
  if (Boolean(ctx.Capacitor?.isNativePlatform?.())) {
    return 'android';
  }

  // 3. Fallback browser environment
  return 'web';
}

let activeDriver: IPlatformDriver | null = null;

export function getPlatformDriver(): IPlatformDriver {
  if (activeDriver) return activeDriver;

  const platform = detectPlatform();
  switch (platform) {
    case 'electron':
      activeDriver = new ElectronPlatformDriver();
      break;
    case 'android':
      activeDriver = new AndroidPlatformDriver();
      break;
    case 'web':
    default:
      activeDriver = new WebPlatformDriver();
      break;
  }

  return activeDriver;
}

/**
 * Reset driver instance — primarily for test suites
 */
export function setPlatformDriverForTesting(driver: IPlatformDriver | null): void {
  activeDriver = driver;
}
