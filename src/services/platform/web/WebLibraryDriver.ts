import { ILibraryDriver, ScanOptions, ScanResult } from '../ILibraryDriver';

export class WebLibraryDriver implements ILibraryDriver {
  public async scanLibrary(_options?: ScanOptions): Promise<ScanResult> {
    // In standalone browser environment without native bridge, file scanning is unavailable
    return { tracks: [], totalScanned: 0, folderAccessible: false };
  }

  public async readCompanionLrc(_audioFilePath: string): Promise<string | null> {
    return null;
  }
}
