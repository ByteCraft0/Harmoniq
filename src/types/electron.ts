import { TrackMetadata } from './audio';
import { LyricsData } from './lyrics';

export interface WindowsAudioDeviceDiagnostic {
  name: string;
  id: string;
  isDefault: boolean;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  formatDescription: string;
}

export interface HarmoniqApi {
  // Window control
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;

  // Native File dialogs
  openFolderDialog: () => Promise<string[] | null>;
  openFileDialog: () => Promise<string[] | null>;
  showItemInFolder: (filePath: string) => Promise<void>;

  // Audio metadata parsing & scanning
  parseAudioFile: (filePath: string) => Promise<TrackMetadata | null>;
  scanFolder: (
    folderPath: string,
    callbackId?: string
  ) => Promise<{ tracks: TrackMetadata[]; totalScanned: number; folderAccessible?: boolean }>;
  readLrcFile: (audioFilePath: string) => Promise<LyricsData | null>;
  
  // Tag editing
  writeAudioTags: (
    filePath: string,
    tags: { title?: string; artist?: string; album?: string; year?: number; genre?: string; trackNumber?: number }
  ) => Promise<boolean>;

  // Persistent storage
  loadPersistentData: <T>(key: string) => Promise<T | null>;
  savePersistentData: <T>(key: string, data: T) => Promise<boolean>;

  // Windows Audio & Device diagnostics
  getWindowsAudioDiagnostics: () => Promise<{
    defaultDevice: WindowsAudioDeviceDiagnostic;
    availableDevices: WindowsAudioDeviceDiagnostic[];
    isWasapiExclusiveCapable: boolean;
  }>;

  // Taskbar / Media Transport
  updateSMTC: (track: { title: string; artist: string; album: string; isPlaying: boolean }) => Promise<boolean>;

  // Events
  onMediaCommand?: (callback: (command: 'prev' | 'playpause' | 'next') => void) => () => void;
  onWindowMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
  onScanProgress?: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => () => void;
}

declare global {
  interface Window {
    harmoniqApi?: HarmoniqApi;
  }
}
