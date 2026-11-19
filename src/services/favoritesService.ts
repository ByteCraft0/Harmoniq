import { TrackMetadata } from '../types/audio';
import { libraryService } from './libraryService';

const STORAGE_FAVORITES_KEY = 'harmoniq_favorites_v2';
const MAX_FAVORITES = 5000;

export interface FavoritesFilterOptions {
  provider?: string;
  artist?: string;
  album?: string;
  searchQuery?: string;
  sortBy?: 'dateAdded' | 'title' | 'artist' | 'lastPlayed';
  sortOrder?: 'asc' | 'desc';
}

const normalizeStr = (s?: string): string =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');

const recordingKey = (t: Partial<TrackMetadata>): string => {
  const isrc = (t as any).isrc;
  if (isrc && typeof isrc === 'string' && isrc.trim()) {
    return `isrc:${isrc.trim().toUpperCase()}`;
  }
  const cleanTitle = normalizeStr(t.title);
  const cleanArtist = normalizeStr(t.artist);
  return `${cleanTitle}:::${cleanArtist}`;
};

export class FavoritesService {
  private favorites: Map<string, TrackMetadata> = new Map();
  private recordingIndex: Map<string, string> = new Map(); // recordingKey -> trackId
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_FAVORITES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id) {
                const track: TrackMetadata = {
                  ...item,
                  isFavorite: true,
                };
                this.favorites.set(track.id, track);
                const rKey = recordingKey(track);
                if (rKey !== ':::') {
                  this.recordingIndex.set(rKey, track.id);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e);
    }
  }

  public save(): void {
    try {
      const list = Array.from(this.favorites.values()).slice(0, MAX_FAVORITES);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(list));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi
          .savePersistentData(STORAGE_FAVORITES_KEY, list.slice(0, 1000))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to save favorites:', e);
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
   * Sync favorites with local tracks so local isFavorite flags stay synchronized
   */
  public syncWithLocalLibrary(localTracks: TrackMetadata[]): void {
    let changed = false;
    for (const t of localTracks) {
      if (!t || !t.id) continue;
      if (t.isFavorite && !this.favorites.has(t.id)) {
        this.favorites.set(t.id, { ...t, isFavorite: true });
        const rKey = recordingKey(t);
        if (rKey !== ':::') this.recordingIndex.set(rKey, t.id);
        changed = true;
      } else if (!t.isFavorite && this.favorites.has(t.id) && (!t.providerId || t.providerId === 'local')) {
        this.favorites.delete(t.id);
        const rKey = recordingKey(t);
        this.recordingIndex.delete(rKey);
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }

  /**
   * Check if a track is favorited by ID, ISRC, or title:::artist
   */
  public isFavorite(trackOrId: TrackMetadata | string): boolean {
    if (!trackOrId) return false;
    if (typeof trackOrId === 'string') {
      return this.favorites.has(trackOrId);
    }
    if (this.favorites.has(trackOrId.id)) {
      return true;
    }
    // Cross-provider duplicate identity check
    const rKey = recordingKey(trackOrId);
    if (rKey !== ':::' && this.recordingIndex.has(rKey)) {
      return true;
    }
    return false;
  }

  /**
   * Find existing favorite ID matching track (by ID or cross-provider recording match)
   */
  public findFavoriteId(track: TrackMetadata): string | null {
    if (this.favorites.has(track.id)) return track.id;
    const rKey = recordingKey(track);
    if (rKey !== ':::') {
      return this.recordingIndex.get(rKey) || null;
    }
    return null;
  }

  /**
   * Toggle favorite status for a track (local or online)
   */
  public toggleFavorite(track: TrackMetadata): boolean {
    if (!track || !track.id) return false;

    const existingId = this.findFavoriteId(track);
    if (existingId) {
      // Remove favorite
      const existing = this.favorites.get(existingId);
      this.favorites.delete(existingId);
      if (existing) {
        const rKey = recordingKey(existing);
        this.recordingIndex.delete(rKey);
      }
      // If local track, sync libraryService
      if (!track.providerId || track.providerId === 'local') {
        const localTrack = libraryService.getTrack(track.id);
        if (localTrack) {
          localTrack.isFavorite = false;
        }
      }
      track.isFavorite = false;
      this.save();
      return false;
    } else {
      // Add favorite
      const favTrack: TrackMetadata = {
        ...track,
        isFavorite: true,
        dateAdded: track.dateAdded || Date.now(),
        providerId: track.providerId || (track.isOnline ? 'online' : 'local'),
      };
      this.favorites.set(track.id, favTrack);
      const rKey = recordingKey(favTrack);
      if (rKey !== ':::') {
        this.recordingIndex.set(rKey, track.id);
      }
      // If local track, sync libraryService
      if (!track.providerId || track.providerId === 'local') {
        const localTrack = libraryService.getTrack(track.id);
        if (localTrack) {
          localTrack.isFavorite = true;
        }
      }
      track.isFavorite = true;
      this.save();
      return true;
    }
  }

  public removeFavorite(trackId: string): void {
    const existing = this.favorites.get(trackId);
    if (existing) {
      this.favorites.delete(trackId);
      const rKey = recordingKey(existing);
      this.recordingIndex.delete(rKey);
      if (!existing.providerId || existing.providerId === 'local') {
        const localTrack = libraryService.getTrack(trackId);
        if (localTrack) {
          localTrack.isFavorite = false;
        }
      }
      this.save();
    }
  }

  public getFavorites(options?: FavoritesFilterOptions): TrackMetadata[] {
    let result = Array.from(this.favorites.values());

    // 1. Provider filter
    if (options?.provider && options.provider !== 'all') {
      const pid = options.provider.toLowerCase();
      result = result.filter((t) => {
        const trackPid = (t.providerId || 'local').toLowerCase();
        return trackPid === pid;
      });
    }

    // 2. Artist filter
    if (options?.artist && options.artist !== 'all') {
      const targetArtist = options.artist.toLowerCase().trim();
      result = result.filter((t) => (t.artist || '').toLowerCase().trim() === targetArtist);
    }

    // 3. Album filter
    if (options?.album && options.album !== 'all') {
      const targetAlbum = options.album.toLowerCase().trim();
      result = result.filter((t) => (t.album || '').toLowerCase().trim() === targetAlbum);
    }

    // 4. Search query
    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.album || '').toLowerCase().includes(q)
      );
    }

    // 5. Sorting
    const sortBy = options?.sortBy || 'dateAdded';
    const isAsc = options?.sortOrder === 'asc';

    result.sort((a, b) => {
      if (sortBy === 'title') {
        const comp = (a.title || '').localeCompare(b.title || '');
        return isAsc ? comp : -comp;
      }
      if (sortBy === 'artist') {
        const comp = (a.artist || '').localeCompare(b.artist || '');
        return isAsc ? comp : -comp;
      }
      if (sortBy === 'lastPlayed') {
        const valA = a.lastPlayed || 0;
        const valB = b.lastPlayed || 0;
        return isAsc ? valA - valB : valB - valA;
      }
      // default: dateAdded
      const valA = a.dateAdded || 0;
      const valB = b.dateAdded || 0;
      return isAsc ? valA - valB : valB - valA;
    });

    return result;
  }

  public getFavoriteCount(): number {
    return this.favorites.size;
  }

  public getUniqueArtists(): string[] {
    const set = new Set<string>();
    for (const t of this.favorites.values()) {
      if (t.artist && t.artist.trim()) {
        set.add(t.artist.trim());
      }
    }
    return Array.from(set).sort();
  }

  public getUniqueAlbums(): string[] {
    const set = new Set<string>();
    for (const t of this.favorites.values()) {
      if (t.album && t.album.trim()) {
        set.add(t.album.trim());
      }
    }
    return Array.from(set).sort();
  }

  public getUniqueProviders(): string[] {
    const set = new Set<string>();
    for (const t of this.favorites.values()) {
      set.add(t.providerId || 'local');
    }
    return Array.from(set);
  }

  public clearFavorites(): void {
    // Clear local track flags too
    for (const fav of this.favorites.values()) {
      if (!fav.providerId || fav.providerId === 'local') {
        const localTrack = libraryService.getTrack(fav.id);
        if (localTrack) localTrack.isFavorite = false;
      }
    }
    this.favorites.clear();
    this.recordingIndex.clear();
    this.save();
  }
}

export const favoritesService = new FavoritesService();
