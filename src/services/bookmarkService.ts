import { MusicBookmark } from '../types/bookmark';

const STORAGE_KEY = 'harmoniq_music_bookmarks_v1';

export class BookmarkService {
  private bookmarks: Map<string, MusicBookmark> = new Map();
  private listeners: Set<(bookmarks: MusicBookmark[]) => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const b of parsed) {
              if (b && b.id) this.bookmarks.set(b.id, b);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load music bookmarks:', e);
    }
  }

  private save(): void {
    try {
      const list = Array.from(this.bookmarks.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_KEY, list).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist music bookmarks:', e);
    }
    this.notify();
  }

  public getAllBookmarks(): MusicBookmark[] {
    return Array.from(this.bookmarks.values());
  }

  public getBookmark(id: string): MusicBookmark | undefined {
    return this.bookmarks.get(id);
  }

  public getBookmarksForTrack(trackId: string): MusicBookmark[] {
    if (!trackId) return [];
    return Array.from(this.bookmarks.values())
      .filter((b) => b.trackId === trackId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public addBookmark(
    trackId: string,
    title: string,
    timestamp: number,
    note?: string
  ): MusicBookmark {
    const id = `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const bookmark: MusicBookmark = {
      id,
      trackId,
      title: title.trim() || `Bookmark at ${this.formatTimestamp(timestamp)}`,
      note: note?.trim(),
      timestamp: Math.max(0, Math.round(timestamp * 10) / 10),
      dateCreated: Date.now(),
    };

    this.bookmarks.set(id, bookmark);
    this.save();
    return bookmark;
  }

  public updateBookmark(
    id: string,
    updates: { title?: string; note?: string; timestamp?: number }
  ): boolean {
    const b = this.bookmarks.get(id);
    if (!b) return false;

    if (updates.title !== undefined) b.title = updates.title.trim() || b.title;
    if (updates.note !== undefined) b.note = updates.note.trim();
    if (typeof updates.timestamp === 'number') {
      b.timestamp = Math.max(0, Math.round(updates.timestamp * 10) / 10);
    }

    this.save();
    return true;
  }

  public deleteBookmark(id: string): boolean {
    if (!this.bookmarks.has(id)) return false;
    this.bookmarks.delete(id);
    this.save();
    return true;
  }

  public deleteBookmarksForTrack(trackId: string): number {
    let deleted = 0;
    for (const [id, b] of this.bookmarks.entries()) {
      if (b.trackId === trackId) {
        this.bookmarks.delete(id);
        deleted++;
      }
    }
    if (deleted > 0) this.save();
    return deleted;
  }

  public subscribe(cb: (bookmarks: MusicBookmark[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getAllBookmarks());
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    const list = this.getAllBookmarks();
    this.listeners.forEach((cb) => cb(list));
  }

  public formatTimestamp(seconds: number): string {
    const totalSecs = Math.floor(seconds);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

export const bookmarkService = new BookmarkService();
