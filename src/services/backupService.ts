import {
  BackupArchive,
  BackupData,
  BackupHistoryEntry,
  BackupValidationResult,
  AutoBackupConfig,
} from '../types/backup';

const STORAGE_BACKUP_HISTORY_KEY = 'harmoniq_backup_history_v1';
const STORAGE_AUTO_BACKUP_CONFIG_KEY = 'harmoniq_auto_backup_config_v1';

/**
 * Calculates a fast, deterministic hex checksum of a string.
 */
export function calculateChecksum(str: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x1b873593;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hash1 = (hash1 ^ code) * 0x01000193;
    hash2 = (hash2 ^ (code << 3)) * 0x01000193;
  }

  const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

export class BackupService {
  private static instance: BackupService;
  private autoConfig: AutoBackupConfig = {
    schedule: 'weekly',
    maxStoredBackups: 10,
  };
  private history: BackupHistoryEntry[] = [];

  private constructor() {
    this.loadHistoryAndConfig();
  }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  private loadHistoryAndConfig(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const rawConfig = localStorage.getItem(STORAGE_AUTO_BACKUP_CONFIG_KEY);
        if (rawConfig) {
          this.autoConfig = { ...this.autoConfig, ...JSON.parse(rawConfig) };
        }
        const rawHistory = localStorage.getItem(STORAGE_BACKUP_HISTORY_KEY);
        if (rawHistory) {
          this.history = JSON.parse(rawHistory);
        }
      } catch (e) {
        console.warn('Failed to load backup config or history:', e);
      }
    }
  }

  private saveHistoryAndConfig(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_AUTO_BACKUP_CONFIG_KEY, JSON.stringify(this.autoConfig));
        localStorage.setItem(STORAGE_BACKUP_HISTORY_KEY, JSON.stringify(this.history));
      } catch (e) {
        console.warn('Failed to save backup config or history:', e);
      }
    }
  }

  private getStorageItem<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  private setStorageItem<T>(key: string, value: T): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn(`Failed to set localStorage key ${key}`, e);
      }
    }
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
      (window as any).harmoniqApi.savePersistentData(key, value).catch(() => {});
    }
  }

  /**
   * Generates a complete versioned snapshot of all Harmoniq data.
   * Guarantees that zero audio files are copied—strictly structured metadata and configs.
   */
  public createBackupArchive(): BackupArchive {
    const data: BackupData = {
      playlists: this.getStorageItem('harmoniq_custom_playlists', []),
      smartPlaylists: this.getStorageItem('harmoniq_smart_playlists', []),
      playlistFolders: this.getStorageItem('harmoniq_playlist_folders_v1', []),
      savedQueues: this.getStorageItem('harmoniq_saved_queues_v1', []),
      listeningHistory: this.getStorageItem('harmoniq_listening_history', []),
      bookmarks: this.getStorageItem('harmoniq_track_bookmarks_v1', []),
      themeSettings: this.getStorageItem('harmoniq_appearance_settings_v1', null),
      listeningRooms: this.getStorageItem('harmoniq_listening_rooms_v1', []),
      audioRoutingProfiles: this.getStorageItem('harmoniq_routing_profiles_v1', []),
      eqPresets: this.getStorageItem('harmoniq_custom_eq_presets_v1', []),
      dspSettings: this.getStorageItem('harmoniq_dsp_settings_v1', null),
      volumeProfiles: this.getStorageItem('harmoniq_volume_profiles_v1', []),
      activeVolumeProfileId: this.getStorageItem('harmoniq_active_volume_profile_v1', 'vol_profile_neutral_studio'),
      hotkeyProfiles: this.getStorageItem('harmoniq_hotkey_profiles_v1', []),
      activeHotkeyProfileId: this.getStorageItem('harmoniq_active_hotkey_profile_v1', 'profile_default_desktop'),
      visualizerSettings: this.getStorageItem('harmoniq_visualizer_settings_v1', null),
      animationSettings: this.getStorageItem('harmoniq_animation_settings_v1', null),
      playerPreferences: this.getStorageItem('harmoniq_player_preferences', null),
      podcastSubscriptions: this.getStorageItem('harmoniq_podcast_feeds_v2', []),
      podcastEpisodeState: this.getStorageItem('harmoniq_podcast_episode_state_v2', {}),
      radioFavorites: this.getStorageItem('harmoniq_radio_favorites_v1', []),
      customRadioStations: this.getStorageItem('harmoniq_custom_radio_stations_v1', []),
      abxSessions: this.getStorageItem('harmoniq_abx_sessions_v1', []),
      listeningGoals: this.getStorageItem('harmoniq_listening_goals_v1', null),
    };

    const itemCounts: Record<string, number> = {
      playlists: (data.playlists?.length || 0) + (data.smartPlaylists?.length || 0),
      playlistFolders: data.playlistFolders?.length || 0,
      savedQueues: data.savedQueues?.length || 0,
      listeningHistory: data.listeningHistory?.length || 0,
      bookmarks: data.bookmarks?.length || 0,
      eqPresets: data.eqPresets?.length || 0,
      listeningRooms: data.listeningRooms?.length || 0,
      audioRoutingProfiles: data.audioRoutingProfiles?.length || 0,
      volumeProfiles: data.volumeProfiles?.length || 0,
      hotkeyProfiles: data.hotkeyProfiles?.length || 0,
      podcastSubscriptions: data.podcastSubscriptions?.length || 0,
      radioFavorites: (data.radioFavorites?.length || 0) + (data.customRadioStations?.length || 0),
      abxSessions: data.abxSessions?.length || 0,
    };

    const dataJson = JSON.stringify(data);
    const checksum = calculateChecksum(dataJson);

    const archive: BackupArchive = {
      format: 'harmoniq_backup',
      version: 2,
      createdAt: new Date().toISOString(),
      appVersion: '2.0.0',
      checksum,
      itemCounts,
      data,
    };

    return archive;
  }

  /**
   * Validates a backup archive structure, format version, and data checksum.
   */
  public validateBackup(archive: any): BackupValidationResult {
    const emptySummary = {
      playlists: 0,
      folders: 0,
      queues: 0,
      history: 0,
      bookmarks: 0,
      eqPresets: 0,
      rooms: 0,
      profiles: 0,
      podcasts: 0,
      radioFavorites: 0,
    };

    if (!archive || typeof archive !== 'object') {
      return {
        valid: false,
        itemCount: 0,
        checksumValid: false,
        error: 'Invalid file format: Not a JSON object',
        summary: emptySummary,
      };
    }

    if (archive.format !== 'harmoniq_backup') {
      return {
        valid: false,
        format: archive.format,
        itemCount: 0,
        checksumValid: false,
        error: `Unsupported format "${archive.format}". Expected "harmoniq_backup".`,
        summary: emptySummary,
      };
    }

    if (archive.version !== 2 && archive.version !== 1) {
      return {
        valid: false,
        format: archive.format,
        version: archive.version,
        itemCount: 0,
        checksumValid: false,
        error: `Unsupported backup version "${archive.version}". Expected version 2.`,
        summary: emptySummary,
      };
    }

    if (!archive.data || typeof archive.data !== 'object') {
      return {
        valid: false,
        format: archive.format,
        version: archive.version,
        itemCount: 0,
        checksumValid: false,
        error: 'Missing data payload in backup archive.',
        summary: emptySummary,
      };
    }

    const dataJson = JSON.stringify(archive.data);
    const calculated = calculateChecksum(dataJson);
    const checksumValid = !archive.checksum || archive.checksum === calculated;

    const data = archive.data as BackupData;
    const summary = {
      playlists: (data.playlists?.length || 0) + (data.smartPlaylists?.length || 0),
      folders: data.playlistFolders?.length || 0,
      queues: data.savedQueues?.length || 0,
      history: data.listeningHistory?.length || 0,
      bookmarks: data.bookmarks?.length || 0,
      eqPresets: data.eqPresets?.length || 0,
      rooms: data.listeningRooms?.length || 0,
      profiles: (data.volumeProfiles?.length || 0) + (data.hotkeyProfiles?.length || 0),
      podcasts: data.podcastSubscriptions?.length || 0,
      radioFavorites: (data.radioFavorites?.length || 0) + (data.customRadioStations?.length || 0),
    };

    const totalItems = Object.values(summary).reduce((a, b) => a + b, 0);

    return {
      valid: checksumValid,
      format: archive.format,
      version: archive.version,
      itemCount: totalItems,
      createdAt: archive.createdAt,
      checksumValid,
      error: !checksumValid ? 'Integrity verification failed: Checksum mismatch.' : undefined,
      summary,
    };
  }

  /**
   * Restores data from a validated backup archive into storage.
   */
  public async restoreBackup(
    archive: BackupArchive,
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<{ success: boolean; error?: string; restoredCount: number }> {
    const val = this.validateBackup(archive);
    if (!val.valid) {
      return { success: false, error: val.error || 'Backup validation failed', restoredCount: 0 };
    }

    const d = archive.data;
    let restoredCount = 0;

    try {
      if (mode === 'replace') {
        if (d.playlists !== undefined) {
          this.setStorageItem('harmoniq_custom_playlists', d.playlists);
          restoredCount += d.playlists.length;
        }
        if (d.smartPlaylists !== undefined) {
          this.setStorageItem('harmoniq_smart_playlists', d.smartPlaylists);
          restoredCount += d.smartPlaylists.length;
        }
        if (d.playlistFolders !== undefined) {
          this.setStorageItem('harmoniq_playlist_folders_v1', d.playlistFolders);
          restoredCount += d.playlistFolders.length;
        }
        if (d.savedQueues !== undefined) {
          this.setStorageItem('harmoniq_saved_queues_v1', d.savedQueues);
          restoredCount += d.savedQueues.length;
        }
        if (d.listeningHistory !== undefined) {
          this.setStorageItem('harmoniq_listening_history', d.listeningHistory);
          restoredCount += d.listeningHistory.length;
        }
        if (d.bookmarks !== undefined) {
          this.setStorageItem('harmoniq_track_bookmarks_v1', d.bookmarks);
          restoredCount += d.bookmarks.length;
        }
        if (d.listeningRooms !== undefined) {
          this.setStorageItem('harmoniq_listening_rooms_v1', d.listeningRooms);
          restoredCount += d.listeningRooms.length;
        }
        if (d.audioRoutingProfiles !== undefined) {
          this.setStorageItem('harmoniq_routing_profiles_v1', d.audioRoutingProfiles);
          restoredCount += d.audioRoutingProfiles.length;
        }
        if (d.eqPresets !== undefined) {
          this.setStorageItem('harmoniq_custom_eq_presets_v1', d.eqPresets);
          restoredCount += d.eqPresets.length;
        }
        if (d.volumeProfiles !== undefined) {
          this.setStorageItem('harmoniq_volume_profiles_v1', d.volumeProfiles);
          restoredCount += d.volumeProfiles.length;
        }
        if (d.hotkeyProfiles !== undefined) {
          this.setStorageItem('harmoniq_hotkey_profiles_v1', d.hotkeyProfiles);
          restoredCount += d.hotkeyProfiles.length;
        }
        if (d.podcastSubscriptions !== undefined) {
          this.setStorageItem('harmoniq_podcast_feeds_v2', d.podcastSubscriptions);
          restoredCount += d.podcastSubscriptions.length;
        }
        if (d.radioFavorites !== undefined) {
          this.setStorageItem('harmoniq_radio_favorites_v1', d.radioFavorites);
          restoredCount += d.radioFavorites.length;
        }
        if (d.customRadioStations !== undefined) {
          this.setStorageItem('harmoniq_custom_radio_stations_v1', d.customRadioStations);
          restoredCount += d.customRadioStations.length;
        }
        if (d.abxSessions !== undefined) {
          this.setStorageItem('harmoniq_abx_sessions_v1', d.abxSessions);
          restoredCount += d.abxSessions.length;
        }
      } else {
        // Merge mode: combine arrays preserving existing IDs
        const mergeArrays = (key: string, incoming: any[] = []) => {
          const current = this.getStorageItem<any[]>(key, []);
          const idMap = new Map();
          current.forEach((item) => idMap.set(item.id || item, item));
          incoming.forEach((item) => idMap.set(item.id || item, item));
          const merged = Array.from(idMap.values());
          this.setStorageItem(key, merged);
          restoredCount += incoming.length;
        };

        if (d.playlists) mergeArrays('harmoniq_custom_playlists', d.playlists);
        if (d.playlistFolders) mergeArrays('harmoniq_playlist_folders_v1', d.playlistFolders);
        if (d.savedQueues) mergeArrays('harmoniq_saved_queues_v1', d.savedQueues);
        if (d.bookmarks) mergeArrays('harmoniq_track_bookmarks_v1', d.bookmarks);
        if (d.listeningRooms) mergeArrays('harmoniq_listening_rooms_v1', d.listeningRooms);
        if (d.audioRoutingProfiles) mergeArrays('harmoniq_routing_profiles_v1', d.audioRoutingProfiles);
        if (d.eqPresets) mergeArrays('harmoniq_custom_eq_presets_v1', d.eqPresets);
        if (d.volumeProfiles) mergeArrays('harmoniq_volume_profiles_v1', d.volumeProfiles);
        if (d.hotkeyProfiles) mergeArrays('harmoniq_hotkey_profiles_v1', d.hotkeyProfiles);
        if (d.podcastSubscriptions) mergeArrays('harmoniq_podcast_feeds_v2', d.podcastSubscriptions);
        if (d.customRadioStations) mergeArrays('harmoniq_custom_radio_stations_v1', d.customRadioStations);
      }

      // Settings objects (Theme, DSP, Goals)
      if (d.themeSettings) this.setStorageItem('harmoniq_appearance_settings_v1', d.themeSettings);
      if (d.dspSettings) this.setStorageItem('harmoniq_dsp_settings_v1', d.dspSettings);
      if (d.visualizerSettings) this.setStorageItem('harmoniq_visualizer_settings_v1', d.visualizerSettings);
      if (d.animationSettings) this.setStorageItem('harmoniq_animation_settings_v1', d.animationSettings);
      if (d.playerPreferences) this.setStorageItem('harmoniq_player_preferences', d.playerPreferences);
      if (d.podcastEpisodeState) this.setStorageItem('harmoniq_podcast_episode_state_v2', d.podcastEpisodeState);
      if (d.activeVolumeProfileId) this.setStorageItem('harmoniq_active_volume_profile_v1', d.activeVolumeProfileId);
      if (d.activeHotkeyProfileId) this.setStorageItem('harmoniq_active_hotkey_profile_v1', d.activeHotkeyProfileId);
      if (d.listeningGoals) this.setStorageItem('harmoniq_listening_goals_v1', d.listeningGoals);

      return { success: true, restoredCount };
    } catch (e: any) {
      return { success: false, error: e.message || 'Restoration failed', restoredCount };
    }
  }

  public exportBackupJson(): string {
    const archive = this.createBackupArchive();
    const jsonStr = JSON.stringify(archive, null, 2);

    // Record in backup history
    const entry: BackupHistoryEntry = {
      id: `backup_${Date.now()}`,
      fileName: `harmoniq_backup_${new Date().toISOString().slice(0, 10)}.json`,
      createdAt: archive.createdAt,
      sizeBytes: new Blob([jsonStr]).size,
      itemCount: Object.values(archive.itemCounts).reduce((a, b) => a + b, 0),
      checksum: archive.checksum,
      isAutomatic: false,
    };

    this.history.unshift(entry);
    if (this.history.length > (this.autoConfig.maxStoredBackups || 10)) {
      this.history = this.history.slice(0, this.autoConfig.maxStoredBackups || 10);
    }
    this.saveHistoryAndConfig();

    return jsonStr;
  }

  public downloadBackupFile(): void {
    const json = this.exportBackupJson();
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmoniq_backup_v2_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public getAutoBackupConfig(): AutoBackupConfig {
    return { ...this.autoConfig };
  }

  public setAutoBackupConfig(config: Partial<AutoBackupConfig>): void {
    this.autoConfig = { ...this.autoConfig, ...config };
    this.saveHistoryAndConfig();
  }

  public getBackupHistory(): BackupHistoryEntry[] {
    return [...this.history];
  }

  public deleteHistoryEntry(id: string): void {
    this.history = this.history.filter((h) => h.id !== id);
    this.saveHistoryAndConfig();
  }

  public checkAndRunScheduledBackup(): boolean {
    if (this.autoConfig.schedule === 'disabled') return false;

    const now = Date.now();
    const last = this.autoConfig.lastBackupTime ? new Date(this.autoConfig.lastBackupTime).getTime() : 0;
    const intervalMap: Record<string, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const interval = intervalMap[this.autoConfig.schedule] || intervalMap.weekly;
    if (now - last >= interval) {
      const archive = this.createBackupArchive();
      const jsonStr = JSON.stringify(archive);
      const entry: BackupHistoryEntry = {
        id: `auto_backup_${now}`,
        fileName: `harmoniq_autobackup_${new Date().toISOString().slice(0, 10)}.json`,
        createdAt: archive.createdAt,
        sizeBytes: new Blob([jsonStr]).size,
        itemCount: Object.values(archive.itemCounts).reduce((a, b) => a + b, 0),
        checksum: archive.checksum,
        isAutomatic: true,
      };

      this.history.unshift(entry);
      if (this.history.length > (this.autoConfig.maxStoredBackups || 10)) {
        this.history = this.history.slice(0, this.autoConfig.maxStoredBackups || 10);
      }
      this.autoConfig.lastBackupTime = new Date().toISOString();
      this.saveHistoryAndConfig();
      return true;
    }

    return false;
  }
}

export const backupService = BackupService.getInstance();
