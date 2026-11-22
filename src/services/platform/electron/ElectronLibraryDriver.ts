import { ILibraryDriver, ScanOptions, ScanResult } from '../ILibraryDriver';
import { TrackMetadata } from '../../../types/audio';

export class ElectronLibraryDriver implements ILibraryDriver {
  public async scanLibrary(options?: ScanOptions): Promise<ScanResult> {
    const folders = options?.folderPaths || [];
    if (folders.length === 0) {
      return { tracks: [], totalScanned: 0, folderAccessible: false };
    }

    if (typeof window === 'undefined' || !window.harmoniqApi?.scanFolder) {
      return { tracks: [], totalScanned: 0, folderAccessible: false };
    }

    let progressUnsub: (() => void) | null = null;
    if (options?.onProgress && window.harmoniqApi?.onScanProgress) {
      progressUnsub = window.harmoniqApi.onScanProgress(options.onProgress);
    }

    try {
      const allTracks: TrackMetadata[] = [];
      let total = 0;
      let accessible = true;

      for (const folder of folders) {
        const res = await window.harmoniqApi.scanFolder(folder);
        if (res && res.tracks) {
          allTracks.push(...res.tracks);
          total += res.totalScanned || res.tracks.length;
          if (res.folderAccessible === false) {
            accessible = false;
          }
        }
      }

      return {
        tracks: allTracks,
        totalScanned: total,
        folderAccessible: accessible,
      };
    } finally {
      if (progressUnsub) {
        progressUnsub();
      }
    }
  }

  public async readCompanionLrc(audioFilePath: string): Promise<string | null> {
    if (typeof window === 'undefined' || !window.harmoniqApi?.readLrcFile) {
      return null;
    }
    try {
      const res: any = await window.harmoniqApi.readLrcFile(audioFilePath);
      if (typeof res === 'string') return res;
      if (res && typeof res.content === 'string') return res.content;
      if (res && typeof res.plainText === 'string') return res.plainText;
      return null;
    } catch {
      return null;
    }
  }

  public async pickFolder(): Promise<string[] | null> {
    if (typeof window === 'undefined' || !window.harmoniqApi?.openFolderDialog) {
      return null;
    }
    return await window.harmoniqApi.openFolderDialog();
  }

  public async pickFiles(): Promise<string[] | null> {
    if (typeof window === 'undefined' || !window.harmoniqApi?.openFileDialog) {
      return null;
    }
    return await window.harmoniqApi.openFileDialog();
  }

  public async showItemInFolder(filePath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.harmoniqApi?.showItemInFolder) {
      await window.harmoniqApi.showItemInFolder(filePath);
    }
  }

  public async startWatcher(folders: string[]): Promise<boolean> {
    if (typeof window !== 'undefined' && window.harmoniqApi?.startFolderWatcher) {
      return await window.harmoniqApi.startFolderWatcher(folders);
    }
    return false;
  }

  public async stopWatcher(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.harmoniqApi?.stopFolderWatcher) {
      return await window.harmoniqApi.stopFolderWatcher();
    }
    return false;
  }

  public onWatcherFileAddedOrUpdated(callback: (track: TrackMetadata) => void): () => void {
    if (typeof window !== 'undefined' && window.harmoniqApi?.onWatcherFileAddedOrUpdated) {
      return window.harmoniqApi.onWatcherFileAddedOrUpdated(callback);
    }
    return () => {};
  }

  public onWatcherFileRemoved(callback: (filePath: string) => void): () => void {
    if (typeof window !== 'undefined' && window.harmoniqApi?.onWatcherFileRemoved) {
      return window.harmoniqApi.onWatcherFileRemoved(callback);
    }
    return () => {};
  }
}
