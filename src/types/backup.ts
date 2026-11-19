export interface BackupData {
  playlists?: any[];
  smartPlaylists?: any[];
  playlistFolders?: any[];
  savedQueues?: any[];
  listeningHistory?: any[];
  bookmarks?: any[];
  themeSettings?: any;
  listeningRooms?: any[];
  audioRoutingProfiles?: any[];
  eqPresets?: any[];
  dspSettings?: any;
  volumeProfiles?: any[];
  activeVolumeProfileId?: string;
  hotkeyProfiles?: any[];
  activeHotkeyProfileId?: string;
  visualizerSettings?: any;
  animationSettings?: any;
  playerPreferences?: any;
  podcastSubscriptions?: any[];
  podcastEpisodeState?: any;
  radioFavorites?: string[];
  customRadioStations?: any[];
  abxSessions?: any[];
  listeningGoals?: any;
}

export interface BackupArchive {
  format: 'harmoniq_backup';
  version: 2;
  createdAt: string;
  appVersion: string;
  checksum: string;
  itemCounts: Record<string, number>;
  data: BackupData;
}

export interface BackupValidationResult {
  valid: boolean;
  format?: string;
  version?: number;
  itemCount: number;
  createdAt?: string;
  checksumValid: boolean;
  error?: string;
  summary: {
    playlists: number;
    folders: number;
    queues: number;
    history: number;
    bookmarks: number;
    eqPresets: number;
    rooms: number;
    profiles: number;
    podcasts: number;
    radioFavorites: number;
  };
}

export interface BackupHistoryEntry {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  itemCount: number;
  checksum: string;
  isAutomatic: boolean;
}

export type AutoBackupSchedule = 'disabled' | 'daily' | 'weekly' | 'monthly';

export interface AutoBackupConfig {
  schedule: AutoBackupSchedule;
  lastBackupTime?: string;
  maxStoredBackups: number;
}
