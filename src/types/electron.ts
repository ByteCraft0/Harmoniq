import { TrackMetadata } from './audio';
import { LyricsData } from './lyrics';
import {
  ShortcutAction,
  ShortcutConfig,
  ShortcutStatus,
  ShortcutStateResponse,
} from './shortcuts';

export type { ShortcutAction, ShortcutConfig, ShortcutStatus, ShortcutStateResponse };

export interface WindowsAudioDeviceDiagnostic {
  name: string;
  id: string;
  isDefault: boolean;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  formatDescription: string;
}

export interface TagEditPayload {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  trackTotal?: number;
  artworkBase64?: string;
  artworkMime?: string;
}

export interface WatcherSyncStatus {
  status: 'active' | 'syncing' | 'idle' | 'error';
  folderCount: number;
  lastSync?: number;
  addedOrUpdatedCount?: number;
  removedCount?: number;
  error?: string;
}

export interface HarmoniqApi {
  // Window control
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  quitApp: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  isMiniPlayer: () => Promise<boolean>;
  setMiniPlayer: (enable: boolean) => Promise<boolean>;
  toggleMiniPlayer: () => Promise<boolean>;
  setAlwaysOnTop?: (flag: boolean) => Promise<boolean>;
  isAlwaysOnTop?: () => Promise<boolean>;
  setWindowOpacity?: (opacity: number) => Promise<number>;
  setMiniPlayerLayout?: (layout: 'compact' | 'expanded') => Promise<boolean>;

  // Native File dialogs
  openFolderDialog: () => Promise<string[] | null>;
  openFileDialog: () => Promise<string[] | null>;
  openLrcFileDialog: () => Promise<{ filePath: string; content: string } | null>;
  openArtworkDialog: () => Promise<{ filePath: string; mime: string; dataUrl: string } | null>;
  showItemInFolder: (filePath: string) => Promise<void>;

  // Audio metadata parsing & scanning
  parseAudioFile: (filePath: string) => Promise<TrackMetadata | null>;
  scanFolder: (
    folderPath: string,
    callbackId?: string
  ) => Promise<{ tracks: TrackMetadata[]; totalScanned: number; folderAccessible?: boolean }>;
  readLrcFile: (audioFilePath: string) => Promise<LyricsData | null>;

  // Automatic Folder Watcher
  startFolderWatcher: (folders: string[]) => Promise<boolean>;
  stopFolderWatcher: () => Promise<boolean>;
  getFolderWatcherStatus: () => Promise<{ isActive: boolean; folders: string[] }>;
  
  // Tag editing
  writeAudioTags: (
    filePath: string,
    tags: TagEditPayload
  ) => Promise<{ success: boolean; track: TrackMetadata | null; error?: string } | boolean>;

  // Persistent storage
  loadPersistentData: <T>(key: string) => Promise<T | null>;
  savePersistentData: <T>(key: string, data: T) => Promise<boolean>;

  // Windows Audio & Device diagnostics
  getWindowsAudioDiagnostics: () => Promise<{
    defaultDevice: WindowsAudioDeviceDiagnostic;
    availableDevices: WindowsAudioDeviceDiagnostic[];
    isWasapiExclusiveCapable: boolean;
  }>;

  // Taskbar / Media Transport & Tray
  updateSMTC: (track: { title: string; artist: string; album: string; isPlaying: boolean }) => Promise<boolean>;
  setCloseToTray: (enabled: boolean) => Promise<boolean>;
  getCloseToTray: () => Promise<boolean>;

  // Global Keyboard Shortcuts
  getGlobalShortcuts: () => Promise<ShortcutStateResponse>;
  updateGlobalShortcuts: (shortcuts: ShortcutConfig) => Promise<{
    success: boolean;
    shortcuts: ShortcutConfig;
    status: Record<ShortcutAction, ShortcutStatus>;
    errors?: Partial<Record<ShortcutAction, string>>;
  }>;
  resetGlobalShortcuts: () => Promise<ShortcutStateResponse>;

  // Online Integrations
  fetchPodcastFeed: (feedUrl: string) => Promise<{ xmlText: string; effectiveUrl: string; contentType: string }>;
  resolvePodcastUrl?: (urlOrQuery: string) => Promise<any>;
  searchOnlineMusic: (query: string, filter?: string) => Promise<any[]>;
  universalSearch?: (request: any) => Promise<any>;
  resolveUniversalStream?: (request: {
    providerId: string;
    providerTrackId: string;
    currentStreamUrl?: string;
    jamendoClientId?: string;
  }) => Promise<{
    success: boolean;
    streamUrl?: string;
    capability?: string;
    format?: string;
    bitrate?: number;
    duration?: number;
    durationMs?: number;
    error?: string;
  }>;
  getJamendoConfig?: () => Promise<{ clientId: string }>;
  saveJamendoConfig?: (config: { clientId: string }) => Promise<{ success: boolean; clientId: string }>;
  getProviderConfigs?: () => Promise<{
    jamendoClientId: string;
    spotify: { clientId: string; clientSecret: string };
    youtube: { apiKey: string };
  }>;
  saveProviderConfigs?: (configs: {
    jamendoClientId?: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    youtubeApiKey?: string;
  }) => Promise<{ success: boolean }>;
  verifyRadioStream: (streamUrl: string) => Promise<{
    accessible: boolean;
    directStreamUrl: string;
    contentType?: string;
    error?: string;
  }>;

  // Portable Mode
  getPortableStatus?: () => Promise<any>;
  testDirectoryWritable?: (dirPath: string) => Promise<any>;
  setPortableMode?: (enabled: boolean, customPath?: string) => Promise<any>;
  migratePortableData?: (direction: 'toPortable' | 'toStandard', customPath?: string) => Promise<any>;

  // Harmoniq Assistant (Phase 7)
  getAssistantConfig?: () => Promise<any>;
  saveAssistantConfig?: (config: any) => Promise<boolean>;
  testAssistantConnection?: (config: any) => Promise<{ success: boolean; message: string; model?: string }>;
  sendAssistantChat?: (payload: {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    context?: string;
  }) => Promise<{ content: string; actions?: string[]; error?: string }>;

  // Events
  onMediaCommand?: (callback: (command: 'prev' | 'playpause' | 'next' | 'volumeup' | 'volumedown' | 'togglemute') => void) => () => void;
  onWindowMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
  onMiniPlayerChange?: (callback: (isMini: boolean) => void) => () => void;
  onScanProgress?: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => () => void;
  onWatcherFileAddedOrUpdated?: (callback: (track: TrackMetadata) => void) => () => void;
  onWatcherFileRemoved?: (callback: (filePath: string) => void) => () => void;
  onWatcherSyncStatus?: (callback: (status: WatcherSyncStatus) => void) => () => void;
}

declare global {
  interface Window {
    harmoniqApi?: HarmoniqApi;
  }
}
