import {
  PortableStatus,
  MigrationResult,
  DirectoryPermissionResult,
} from '../types/portable';

const STORAGE_PORTABLE_MODE_KEY = 'harmoniq_portable_mode_active';
const STORAGE_PORTABLE_CUSTOM_PATH_KEY = 'harmoniq_portable_custom_path';

export class PortableService {
  private static instance: PortableService;

  private constructor() {}

  public static getInstance(): PortableService {
    if (!PortableService.instance) {
      PortableService.instance = new PortableService();
    }
    return PortableService.instance;
  }

  /**
   * Retrieves the current portable mode configuration, storage directory, and write permissions.
   */
  public async getPortableStatus(): Promise<PortableStatus> {
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.getPortableStatus) {
      try {
        return await (window as any).harmoniqApi.getPortableStatus();
      } catch (e: any) {
        console.warn('Failed to get portable status from Electron IPC:', e);
      }
    }

    // Web / Test environment fallback
    const isPortable = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_PORTABLE_MODE_KEY) === 'true';
    const customPath = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_PORTABLE_CUSTOM_PATH_KEY)) || '';

    return {
      isPortable,
      dataDirectory: isPortable ? (customPath || './harmoniq-data') : '%APPDATA%\\Harmoniq',
      isWritable: true,
      standardDirectory: '%APPDATA%\\Harmoniq',
      canSwitch: true,
    };
  }

  /**
   * Verifies filesystem write permissions for a target directory.
   * Protects against read-only directories like C:\Program Files without admin rights.
   */
  public async testDirectoryWritable(dirPath: string): Promise<DirectoryPermissionResult> {
    if (!dirPath || !dirPath.trim()) {
      return { writable: false, path: dirPath, error: 'Path cannot be empty' };
    }

    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.testDirectoryWritable) {
      try {
        return await (window as any).harmoniqApi.testDirectoryWritable(dirPath);
      } catch (e: any) {
        return { writable: false, path: dirPath, error: e.message || 'Permission test failed' };
      }
    }

    // Emulated check: reject known protected system directories if simulated
    const lower = dirPath.toLowerCase();
    if (lower.startsWith('c:\\program files') || lower.startsWith('c:\\windows')) {
      return {
        writable: false,
        path: dirPath,
        error: 'Permission denied: Target directory is a protected Windows system path.',
      };
    }

    return { writable: true, path: dirPath };
  }

  /**
   * Toggles portable mode on or off.
   */
  public async setPortableMode(
    enabled: boolean,
    customPath?: string
  ): Promise<{ success: boolean; requiresRestart: boolean; error?: string }> {
    if (enabled && customPath) {
      const perm = await this.testDirectoryWritable(customPath);
      if (!perm.writable) {
        return { success: false, requiresRestart: false, error: perm.error };
      }
    }

    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.setPortableMode) {
      try {
        return await (window as any).harmoniqApi.setPortableMode(enabled, customPath);
      } catch (e: any) {
        return { success: false, requiresRestart: false, error: e.message || 'Failed to update portable mode' };
      }
    }

    // Web / Test fallback
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_PORTABLE_MODE_KEY, String(enabled));
      if (customPath) {
        localStorage.setItem(STORAGE_PORTABLE_CUSTOM_PATH_KEY, customPath);
      } else {
        localStorage.removeItem(STORAGE_PORTABLE_CUSTOM_PATH_KEY);
      }
    }

    return { success: true, requiresRestart: true };
  }

  /**
   * Migrates existing configuration and library state between standard and portable storage.
   */
  public async migrateData(
    direction: 'toPortable' | 'toStandard',
    customPath?: string
  ): Promise<MigrationResult> {
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.migratePortableData) {
      try {
        return await (window as any).harmoniqApi.migratePortableData(direction, customPath);
      } catch (e: any) {
        return {
          success: false,
          filesMigrated: 0,
          sourceDir: direction === 'toPortable' ? '%APPDATA%\\Harmoniq' : (customPath || './harmoniq-data'),
          targetDir: direction === 'toPortable' ? (customPath || './harmoniq-data') : '%APPDATA%\\Harmoniq',
          error: e.message || 'Migration failed',
        };
      }
    }

    // Web / Test fallback: simulates file migration of standard data keys
    return {
      success: true,
      filesMigrated: 18,
      sourceDir: direction === 'toPortable' ? '%APPDATA%\\Harmoniq' : (customPath || './harmoniq-data'),
      targetDir: direction === 'toPortable' ? (customPath || './harmoniq-data') : '%APPDATA%\\Harmoniq',
    };
  }
}

export const portableService = PortableService.getInstance();
