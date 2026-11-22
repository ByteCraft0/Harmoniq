import { TrackMetadata } from '../../types/audio';
import { ScanProgress, ScanProgressListener } from './types';

export interface ScanOptions {
  folderPaths?: string[];
  onProgress?: ScanProgressListener;
}

export interface ScanResult {
  tracks: TrackMetadata[];
  totalScanned: number;
  folderAccessible?: boolean;
}

export interface FolderInfo {
  uri: string;
  name: string;
}

export interface ILibraryDriver {
  // Scanning
  scanLibrary(options?: ScanOptions): Promise<ScanResult>;
  scanFolder?(folderPathOrUri: string): Promise<ScanResult>;

  // Companion LRC File
  readCompanionLrc(audioFilePath: string): Promise<string | null>;

  // Native Dialogs
  pickFolder?(): Promise<string[] | null>;
  pickFiles?(): Promise<string[] | null>;

  // Folder management
  removeFolder?(folderPathOrUri: string): Promise<boolean>;
  getPersistedFolders?(): Promise<FolderInfo[]>;

  // Permissions (Android)
  checkPermissions?(): Promise<{ granted: boolean; permissionRequired?: string }>;
  requestPermissions?(): Promise<{ granted: boolean }>;

  // Open file in OS explorer / intent
  showItemInFolder?(filePath: string): Promise<void>;

  // Library watching / change observer
  startWatcher?(folders: string[]): Promise<boolean>;
  stopWatcher?(): Promise<boolean>;
  onWatcherFileAddedOrUpdated?(callback: (track: TrackMetadata) => void): () => void;
  onWatcherFileRemoved?(callback: (filePath: string) => void): () => void;
}
