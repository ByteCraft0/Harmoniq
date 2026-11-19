import { PlaylistFolder, PlaylistHistoryEntry, PlaylistHistoryAction } from '../types/library';
import { libraryService } from './libraryService';

const STORAGE_FOLDERS_KEY = 'harmoniq_playlist_folders_v1';
const STORAGE_HISTORY_KEY = 'harmoniq_playlist_history_v1';

export class PlaylistFolderService {
  private folders: Map<string, PlaylistFolder> = new Map();
  private historyByPlaylist: Map<string, PlaylistHistoryEntry[]> = new Map();
  private folderListeners: Set<(folders: PlaylistFolder[]) => void> = new Set();
  private historyListeners: Set<(history: Map<string, PlaylistHistoryEntry[]>) => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawFolders = localStorage.getItem(STORAGE_FOLDERS_KEY);
        if (rawFolders) {
          const parsed = JSON.parse(rawFolders);
          if (Array.isArray(parsed)) {
            for (const f of parsed) {
              if (f && f.id) this.folders.set(f.id, f);
            }
          }
        }

        const rawHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (parsed && typeof parsed === 'object') {
            for (const [plId, entries] of Object.entries(parsed)) {
              if (Array.isArray(entries)) {
                this.historyByPlaylist.set(plId, entries as PlaylistHistoryEntry[]);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load playlist folders & history:', e);
    }
  }

  private saveFolders(): void {
    try {
      const list = Array.from(this.folders.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_FOLDERS_KEY, JSON.stringify(list));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_FOLDERS_KEY, list).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist playlist folders:', e);
    }
    this.notifyFolders();
  }

  private saveHistory(): void {
    try {
      const obj: Record<string, PlaylistHistoryEntry[]> = {};
      for (const [k, v] of this.historyByPlaylist.entries()) {
        obj[k] = v;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(obj));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_HISTORY_KEY, obj).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist playlist history:', e);
    }
    this.notifyHistory();
  }

  // --- Folder Operations ---

  public getFolders(): PlaylistFolder[] {
    return Array.from(this.folders.values());
  }

  public getFolder(id: string): PlaylistFolder | undefined {
    return this.folders.get(id);
  }

  public createFolder(name: string, parentId: string | null = null): PlaylistFolder {
    const id = `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const newFolder: PlaylistFolder = {
      id,
      name: name.trim() || 'New Folder',
      parentId: parentId && this.folders.has(parentId) ? parentId : null,
      dateCreated: now,
      dateModified: now,
      isExpanded: true,
    };
    this.folders.set(id, newFolder);
    this.saveFolders();
    return newFolder;
  }

  public renameFolder(id: string, newName: string): boolean {
    const f = this.folders.get(id);
    if (!f) return false;
    f.name = newName.trim() || f.name;
    f.dateModified = Date.now();
    this.saveFolders();
    return true;
  }

  /**
   * Safe Folder Deletion: Deletes folder without deleting any playlists.
   * Playlists assigned to this folder have their folderId reset to null.
   * Child folders have their parentId reset to null.
   */
  public deleteFolder(id: string): boolean {
    if (!this.folders.has(id)) return false;

    // Reset child folders
    for (const folder of this.folders.values()) {
      if (folder.parentId === id) {
        folder.parentId = null;
      }
    }

    // Reset playlists inside this folder to root
    const allPlaylists = libraryService.getPlaylists();
    for (const pl of allPlaylists) {
      if (pl.folderId === id) {
        pl.folderId = null;
      }
    }
    libraryService.savePlaylists();

    this.folders.delete(id);
    this.saveFolders();
    return true;
  }

  public moveFolder(id: string, newParentId: string | null): boolean {
    const f = this.folders.get(id);
    if (!f) return false;
    // Prevent cycle
    if (newParentId === id) return false;
    if (newParentId && this.isDescendant(newParentId, id)) return false;

    f.parentId = newParentId && this.folders.has(newParentId) ? newParentId : null;
    f.dateModified = Date.now();
    this.saveFolders();
    return true;
  }

  private isDescendant(targetId: string, potentialAncestorId: string): boolean {
    let curr = this.folders.get(targetId);
    while (curr && curr.parentId) {
      if (curr.parentId === potentialAncestorId) return true;
      curr = this.folders.get(curr.parentId);
    }
    return false;
  }

  public movePlaylistToFolder(playlistId: string, folderId: string | null): boolean {
    const allPlaylists = libraryService.getPlaylists();
    const pl = allPlaylists.find((p) => p.id === playlistId);
    if (!pl) return false;

    pl.folderId = folderId && this.folders.has(folderId) ? folderId : null;
    pl.dateModified = Date.now();
    libraryService.savePlaylists();

    // Record in history
    const folderName = folderId ? this.folders.get(folderId)?.name || 'folder' : 'Root';
    this.recordHistory(
      playlistId,
      'renamed',
      `Moved to ${folderName}`,
      pl.trackIds
    );

    return true;
  }

  // --- Playlist History & Versioning ---

  public recordHistory(
    playlistId: string,
    action: PlaylistHistoryAction,
    description: string,
    snapshotTrackIds: string[]
  ): PlaylistHistoryEntry {
    const entries = this.historyByPlaylist.get(playlistId) || [];
    const entry: PlaylistHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playlistId,
      timestamp: Date.now(),
      action,
      description,
      trackCount: snapshotTrackIds.length,
      snapshotTrackIds: [...snapshotTrackIds],
    };

    // Keep up to 30 snapshots per playlist to save storage
    entries.unshift(entry);
    if (entries.length > 30) {
      entries.splice(30);
    }

    this.historyByPlaylist.set(playlistId, entries);
    this.saveHistory();
    return entry;
  }

  public getHistoryForPlaylist(playlistId: string): PlaylistHistoryEntry[] {
    return this.historyByPlaylist.get(playlistId) || [];
  }

  public restoreVersion(playlistId: string, historyEntryId: string): boolean {
    const entries = this.historyByPlaylist.get(playlistId);
    if (!entries) return false;
    const targetVersion = entries.find((e) => e.id === historyEntryId);
    if (!targetVersion) return false;

    const allPlaylists = libraryService.getPlaylists();
    const pl = allPlaylists.find((p) => p.id === playlistId);
    if (!pl) return false;

    // Restore track list
    pl.trackIds = [...targetVersion.snapshotTrackIds];
    pl.dateModified = Date.now();
    libraryService.savePlaylists();

    // Record the restore event
    this.recordHistory(
      playlistId,
      'restored',
      `Restored version from ${new Date(targetVersion.timestamp).toLocaleString()} (${targetVersion.snapshotTrackIds.length} tracks)`,
      pl.trackIds
    );

    return true;
  }

  // --- Subscriptions ---

  public subscribeFolders(cb: (folders: PlaylistFolder[]) => void): () => void {
    this.folderListeners.add(cb);
    cb(this.getFolders());
    return () => this.folderListeners.delete(cb);
  }

  public subscribeHistory(cb: (history: Map<string, PlaylistHistoryEntry[]>) => void): () => void {
    this.historyListeners.add(cb);
    cb(this.historyByPlaylist);
    return () => this.historyListeners.delete(cb);
  }

  private notifyFolders(): void {
    const list = this.getFolders();
    this.folderListeners.forEach((cb) => cb(list));
  }

  private notifyHistory(): void {
    this.historyListeners.forEach((cb) => cb(this.historyByPlaylist));
  }
}

export const playlistFolderService = new PlaylistFolderService();
