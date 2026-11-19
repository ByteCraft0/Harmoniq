import {
  HistoryEntry,
  HistoryDateFilter,
  HistoryCompletionStatus,
  HistoryQueryOptions,
} from '../types/history';
import { TrackMetadata } from '../types/audio';

const STORAGE_HISTORY_KEY = 'harmoniq_listening_history_v2';
const STORAGE_HISTORY_ENABLED_KEY = 'harmoniq_history_recording_enabled';
const MAX_HISTORY_ENTRIES = 5000;

export class HistoryService {
  private entries: HistoryEntry[] = [];
  private listeners: Set<() => void> = new Set();
  private historyEnabled: boolean = true;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.entries = parsed;
          }
        }
        const enabledSetting = localStorage.getItem(STORAGE_HISTORY_ENABLED_KEY);
        if (enabledSetting !== null) {
          this.historyEnabled = enabledSetting === 'true';
        }
      }
    } catch (e) {
      console.warn('Failed to load listening history:', e);
    }
  }

  public isHistoryEnabled(): boolean {
    return this.historyEnabled;
  }

  public setHistoryEnabled(enabled: boolean): void {
    this.historyEnabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_HISTORY_ENABLED_KEY, String(enabled));
      }
    } catch {
      /* ignore */
    }
    this.emit();
  }

  public save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(this.entries.slice(0, MAX_HISTORY_ENTRIES)));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi
          .savePersistentData(STORAGE_HISTORY_KEY, this.entries.slice(0, 1000))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to save listening history:', e);
    }
    this.emit();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Record a completed or partial play session.
   * Play completion rule:
   * - Completed: listened for >= 30 seconds AND (listened >= 50% of track or >= 120s)
   * - Skipped: listened for < 15 seconds
   * - Partial: listened between 15s and completion threshold
   */
  public recordSession(
    track: TrackMetadata,
    playbackDuration: number
  ): { entry: HistoryEntry; isCompleted: boolean } {
    const duration = track.duration || 0;
    const cleanDuration = Math.max(0, Math.round(playbackDuration));

    const isPreview =
      track.playbackCapability === 'preview_stream' ||
      track.playbackCapability === 'preview_only';

    let status: HistoryCompletionStatus = 'partial';
    let isCompleted = false;

    if (cleanDuration < 15) {
      status = 'skipped';
    } else if (!isPreview && cleanDuration >= 30 && (duration <= 0 || cleanDuration >= duration * 0.5 || cleanDuration >= 120)) {
      status = 'completed';
      isCompleted = true;
    }

    const entry: HistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      artworkDataUrl: track.artworkDataUrl,
      playedAt: Date.now(),
      duration: Math.round(duration),
      playbackDuration: cleanDuration,
      completionStatus: status,
      isOnline: Boolean(track.isOnline),
      providerId: track.providerId || 'local',
      providerTrackId: track.providerTrackId,
      playbackCapability: track.playbackCapability,
      genre: track.genre,
      filePath: track.filePath,
    };

    if (!this.historyEnabled) {
      return { entry, isCompleted };
    }

    // Prepend to history
    this.entries.unshift(entry);
    if (this.entries.length > MAX_HISTORY_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
    }

    this.save();
    return { entry, isCompleted };
  }

  public getHistory(options?: HistoryQueryOptions): HistoryEntry[] {
    let result = [...this.entries];

    // 1. Date filter
    const now = Date.now();
    if (options?.dateFilter && options.dateFilter !== 'all') {
      switch (options.dateFilter) {
        case 'today': {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          result = result.filter((e) => e.playedAt >= d.getTime());
          break;
        }
        case 'yesterday': {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          result = result.filter((e) => e.playedAt >= yesterday.getTime() && e.playedAt < today.getTime());
          break;
        }
        case '7days': {
          const cutoff = now - 7 * 86400 * 1000;
          result = result.filter((e) => e.playedAt >= cutoff);
          break;
        }
        case '30days': {
          const cutoff = now - 30 * 86400 * 1000;
          result = result.filter((e) => e.playedAt >= cutoff);
          break;
        }
      }
    }

    // 2. Status filter
    if (options?.statusFilter && options.statusFilter !== 'all') {
      result = result.filter((e) => e.completionStatus === options.statusFilter);
    }

    // 3. Provider filter
    if (options?.providerId && options.providerId !== 'all') {
      const pid = options.providerId.toLowerCase();
      result = result.filter((e) => {
        const itemPid = (e.providerId || 'local').toLowerCase();
        return itemPid === pid;
      });
    }

    // 4. Artist filter
    if (options?.artist && options.artist !== 'all') {
      const targetArtist = options.artist.toLowerCase().trim();
      result = result.filter((e) => (e.artist || '').toLowerCase().trim() === targetArtist);
    }

    // 5. Search query
    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.artist || '').toLowerCase().includes(q) ||
          (e.album || '').toLowerCase().includes(q)
      );
    }

    // 6. Sorting
    const sortBy = options?.sortBy || 'playedAt';
    const isAsc = options?.sortOrder === 'asc';

    result.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return isAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    if (options?.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  public getUniqueProviders(): string[] {
    const set = new Set<string>();
    for (const e of this.entries) {
      set.add(e.providerId || 'local');
    }
    return Array.from(set);
  }

  public getUniqueArtists(): string[] {
    const set = new Set<string>();
    for (const e of this.entries) {
      if (e.artist && e.artist.trim()) {
        set.add(e.artist.trim());
      }
    }
    return Array.from(set).sort();
  }

  public removeEntry(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public clearHistory(): void {
    this.entries = [];
    this.save();
  }

  public getStatsSummary() {
    const totalListeningSeconds = this.entries.reduce((acc, e) => acc + (e.playbackDuration || 0), 0);
    const completedPlays = this.entries.filter((e) => e.completionStatus === 'completed').length;
    const partialPlays = this.entries.filter((e) => e.completionStatus === 'partial').length;
    const skippedPlays = this.entries.filter((e) => e.completionStatus === 'skipped').length;

    return {
      totalEntries: this.entries.length,
      totalListeningSeconds,
      completedPlays,
      partialPlays,
      skippedPlays,
    };
  }
}

export const historyService = new HistoryService();
