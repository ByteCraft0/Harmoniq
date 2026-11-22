import { ILibraryDriver, ScanOptions, ScanResult, FolderInfo } from '../ILibraryDriver';
import { TrackMetadata } from '../../../types/audio';
import { getGlobalContext } from '../index';

export class AndroidLibraryDriver implements ILibraryDriver {
  private getCapacitor(): any {
    return getGlobalContext().Capacitor;
  }

  public async checkPermissions(): Promise<{ granted: boolean; permissionRequired?: string }> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.checkAudioPermission) {
      try {
        const res = await cap.Plugins.HarmoniqMediaScanner.checkAudioPermission();
        return {
          granted: !!res?.granted,
          permissionRequired: res?.permissionRequired || 'READ_MEDIA_AUDIO',
        };
      } catch (err) {
        console.warn('[AndroidLibraryDriver] checkPermissions error:', err);
      }
    }
    return { granted: false };
  }

  public async requestPermissions(): Promise<{ granted: boolean }> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.requestAudioPermission) {
      try {
        const res = await cap.Plugins.HarmoniqMediaScanner.requestAudioPermission();
        return { granted: !!res?.granted };
      } catch (err) {
        console.warn('[AndroidLibraryDriver] requestPermissions error:', err);
      }
    }
    return { granted: false };
  }

  public async scanLibrary(options?: ScanOptions): Promise<ScanResult> {
    const cap = this.getCapacitor();
    const tracks: TrackMetadata[] = [];
    let totalScanned = 0;

    if (cap?.Plugins?.HarmoniqMediaScanner?.scanMediaStore) {
      try {
        const result = await cap.Plugins.HarmoniqMediaScanner.scanMediaStore();
        if (result && Array.isArray(result.tracks)) {
          tracks.push(...result.tracks);
          totalScanned += result.tracks.length;
        }
      } catch (err) {
        console.warn('[AndroidLibraryDriver] Native MediaStore scan failed:', err);
      }
    }

    // Also scan custom SAF folders if provided in options
    if (options?.folderPaths && options.folderPaths.length > 0) {
      for (const folderUri of options.folderPaths) {
        if (folderUri.startsWith('content://')) {
          const folderRes = await this.scanFolder(folderUri);
          if (folderRes && folderRes.tracks) {
            tracks.push(...folderRes.tracks);
            totalScanned += folderRes.tracks.length;
          }
        }
      }
    }

    return {
      tracks,
      totalScanned,
      folderAccessible: true,
    };
  }

  public async scanFolder(folderUri: string): Promise<ScanResult> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.scanFolder) {
      try {
        const result = await cap.Plugins.HarmoniqMediaScanner.scanFolder({ folderUri });
        if (result && Array.isArray(result.tracks)) {
          return {
            tracks: result.tracks,
            totalScanned: result.tracks.length,
            folderAccessible: result.folderAccessible !== false,
          };
        }
      } catch (err) {
        console.warn('[AndroidLibraryDriver] scanFolder failed:', err);
      }
    }
    return { tracks: [], totalScanned: 0, folderAccessible: false };
  }

  public async pickFolder(): Promise<string[] | null> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.openFolderPicker) {
      try {
        const res = await cap.Plugins.HarmoniqMediaScanner.openFolderPicker();
        if (res?.uri) {
          return [res.uri];
        }
      } catch (err) {
        console.warn('[AndroidLibraryDriver] openFolderPicker cancelled or failed:', err);
      }
    }
    return null;
  }

  public async removeFolder(folderUri: string): Promise<boolean> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.removeFolder) {
      try {
        await cap.Plugins.HarmoniqMediaScanner.removeFolder({ folderUri });
        return true;
      } catch (err) {
        console.warn('[AndroidLibraryDriver] removeFolder error:', err);
      }
    }
    return false;
  }

  public async getPersistedFolders(): Promise<FolderInfo[]> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.getPersistedFolders) {
      try {
        const res = await cap.Plugins.HarmoniqMediaScanner.getPersistedFolders();
        if (res && Array.isArray(res.folders)) {
          return res.folders;
        }
      } catch (err) {
        console.warn('[AndroidLibraryDriver] getPersistedFolders error:', err);
      }
    }
    return [];
  }

  public async readCompanionLrc(audioFilePath: string): Promise<string | null> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqMediaScanner?.readCompanionLrc) {
      try {
        const result = await cap.Plugins.HarmoniqMediaScanner.readCompanionLrc({ audioFilePath });
        return result?.content || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
