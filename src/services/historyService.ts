import { HistoryEntry, HistoryDateFilter, HistoryCompletionStatus } from '../types/history';
import { TrackMetadata } from '../types/audio';

const STORAGE_HISTORY_KEY = 'harmoniq_listening_history_v2';
const MAX_HISTORY_ENTRIES = 5000;

export class HistoryService {
  private entries: HistoryEntry[] = [];
  private listeners: Set<() => void> = new Set();

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
      }
    } catch (e) {
      console.warn('Failed to load listening history:', e);
    }
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

    let status: HistoryCompletionStatus = 'partial';
    let isCompleted = false;

    if (cleanDuration < 15) {
      status = 'skipped';
    } else if (cleanDuration >= 30 && (duration <= 0 || cleanDuration >= duration * 0.5 || cleanDuration >= 120)) {
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
    };

    // Prepend to history
    this.entries.unshift(entry);
    if (this.entries.length > MAX_HISTORY_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
    }

    this.save();
    return { entry, isCompleted };
  }

  public getHistory(options?: {
    dateFilter?: HistoryDateFilter;
    searchQuery?: string;
    sortBy?: 'playedAt' | 'playbackDuration';
    sortOrder?: 'asc' | 'desc';
    statusFilter?: 'all' | HistoryCompletionStatus;
  }): HistoryEntry[] {
    let result = [...this.entries];

    // 1. Date filter
    const now = Date.now();
    if (options?.dateFilter && options.dateFilter !== 'all') {
      let cutoff = 0;
      switch (options.dateFilter) {
        case 'today': {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          cutoff = d.getTime();
          break;
        }
        case '7days':
          cutoff = now - 7 * 86400 * 1000;
          break;
        case '30days':
          cutoff = now - 30 * 86400 * 1000;
          break;
      }
      result = result.filter((e) => e.playedAt >= cutoff);
    }

    // 2. Status filter
    if (options?.statusFilter && options.statusFilter !== 'all') {
      result = result.filter((e) => e.completionStatus === options.statusFilter);
    }

    // 3. Search query
    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.artist.toLowerCase().includes(q) ||
          e.album.toLowerCase().includes(q)
      );
    }

    // 4. Sorting
    const sortBy = options?.sortBy || 'playedAt';
    const isAsc = options?.sortOrder === 'asc';

    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return isAsc ? valA - valB : valB - valA;
    });

    return result;
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
