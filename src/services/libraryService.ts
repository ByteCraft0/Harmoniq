import { TrackMetadata } from '../types/audio';
import { Album, Artist, Playlist, FolderNode, LibraryStats } from '../types/library';

const normPath = (p: string): string => p.replace(/\\/g, '/').toLowerCase();
const albumKeyOf = (t: TrackMetadata): string => `${(t.album || '').toLowerCase()}:::${(t.albumArtist || t.artist || '').toLowerCase()}`;

export type LibraryChangeKind = 'data' | 'persist';

export class LibraryService {
  private listeners: Set<(kind: LibraryChangeKind) => void> = new Set();
  private albumsCache: Album[] | null = null;
  private artistsCache: Artist[] | null = null;
  private artworkByAlbum: Map<string, string> = new Map();

  private tracks: Map<string, TrackMetadata> = new Map();
  private folders: Set<string> = new Set();
  private playlists: Map<string, Playlist> = new Map();
  private isScanning = false;
  private scanProgress = { current: 0, total: 0, currentFile: '' };
  private static readonly STORAGE_PLAYLISTS_KEY = 'harmoniq_custom_playlists_v1';

  constructor() {
    this.initializeDefaultSmartPlaylists();
    this.loadSavedPlaylists();
  }

  private loadSavedPlaylists(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LibraryService.STORAGE_PLAYLISTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const pl of parsed) {
              if (pl && pl.id && !pl.isSmart) {
                this.playlists.set(pl.id, pl);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved custom playlists:', e);
    }
  }

  public savePlaylists(): void {
    try {
      const custom = Array.from(this.playlists.values()).filter((p) => !p.isSmart);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LibraryService.STORAGE_PLAYLISTS_KEY, JSON.stringify(custom));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(LibraryService.STORAGE_PLAYLISTS_KEY, custom).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist custom playlists:', e);
    }
  }

  /** Subscribe to mutations: 'data' = views should refresh, 'persist' = only needs saving. */
  public subscribe(cb: (kind: LibraryChangeKind) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(kind: LibraryChangeKind): void {
    this.listeners.forEach((cb) => cb(kind));
  }

  private invalidate(): void {
    this.albumsCache = null;
    this.artistsCache = null;
  }

  private initializeDefaultSmartPlaylists(): void {
    const defaultSmart: Playlist[] = [
      {
        id: 'smart_favorites',
        name: 'Favorite Tracks',
        description: 'All your starred favorite tracks',
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
        isSmart: true,
        smartCriteria: 'favorites',
      },
      {
        id: 'smart_recently_played',
        name: 'Recently Played',
        description: 'Recently listened tracks',
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
        isSmart: true,
        smartCriteria: 'recently_played',
      },
      {
        id: 'smart_recently_added',
        name: 'Recently Added',
        description: 'Newest tracks added to library',
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
        isSmart: true,
        smartCriteria: 'recently_added',
      },
      {
        id: 'smart_most_played',
        name: 'Most Played',
        description: 'Your top played audio tracks',
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
        isSmart: true,
        smartCriteria: 'most_played',
      },
    ];

    defaultSmart.forEach((pl) => {
      this.playlists.set(pl.id, pl);
    });
  }

  // Add tracks in batch (efficient for 10,000+ tracks)
  public addTracks(newTracks: TrackMetadata[]): void {
    const now = Date.now();
    for (const track of newTracks) {
      if (!track || !track.id) continue;
      const existing = this.tracks.get(track.id);
      if (existing) {
        // Preserve user data across rescans
        track.playCount = existing.playCount;
        track.isFavorite = existing.isFavorite;
        track.lastPlayed = existing.lastPlayed;
        track.resumePosition = existing.resumePosition;
        track.customPlaybackSpeed = existing.customPlaybackSpeed;
        track.dateAdded = existing.dateAdded ?? now;
      } else {
        track.dateAdded = track.dateAdded ?? now;
      }

      // Share identical artwork strings between tracks of one album (big memory/disk saving)
      if (track.artworkDataUrl) {
        const key = albumKeyOf(track);
        const known = this.artworkByAlbum.get(key);
        if (known === track.artworkDataUrl) track.artworkDataUrl = known;
        else if (!known) this.artworkByAlbum.set(key, track.artworkDataUrl);
      }
      this.tracks.set(track.id, track);
    }
    this.invalidate();
  }

  /** Remove indexed tracks under a folder that were not found by the latest scan. Returns removed count. */
  public pruneFolder(folderPath: string, keepIds: Set<string>): number {
    const prefix = normPath(folderPath).replace(/\/+$/, '') + '/';
    let removed = 0;
    for (const [id, t] of this.tracks) {
      if (!keepIds.has(id) && normPath(t.filePath).startsWith(prefix)) {
        this.tracks.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.invalidate();
    return removed;
  }

  public getAllTracks(): TrackMetadata[] {
    return Array.from(this.tracks.values());
  }

  public getTrack(id: string): TrackMetadata | undefined {
    return this.tracks.get(id);
  }

  public updateTrack(track: TrackMetadata): void {
    if (!track || !track.id) return;
    const existing = this.tracks.get(track.id);
    if (existing) {
      track.playCount = existing.playCount;
      track.isFavorite = existing.isFavorite;
      track.lastPlayed = existing.lastPlayed;
      track.resumePosition = existing.resumePosition;
      track.customPlaybackSpeed = existing.customPlaybackSpeed;
      track.dateAdded = existing.dateAdded;
    }
    if (track.artworkDataUrl) {
      const key = albumKeyOf(track);
      this.artworkByAlbum.set(key, track.artworkDataUrl);
    }
    this.tracks.set(track.id, track);
    this.invalidate();
    this.emit('data');
  }

  public removeTrackByPath(filePath: string): boolean {
    const norm = normPath(filePath);
    for (const [id, t] of this.tracks) {
      if (normPath(t.filePath) === norm) {
        this.tracks.delete(id);
        this.invalidate();
        this.emit('data');
        return true;
      }
    }
    return false;
  }

  public removeTracks(trackIds: string[]): number {
    let count = 0;
    for (const id of trackIds) {
      if (this.tracks.delete(id)) {
        count++;
      }
    }
    if (count > 0) {
      this.invalidate();
      this.emit('data');
      this.emit('persist');
    }
    return count;
  }

  public toggleFavorite(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    track.isFavorite = !track.isFavorite;
    this.emit('data');
    return track.isFavorite;
  }

  public syncFavorites(trackId: string, isFav: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.isFavorite = isFav;
      this.emit('data');
    }
  }

  public recordPlay(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    track.playCount = (track.playCount || 0) + 1;
    track.lastPlayed = Date.now();
    this.emit('data');
  }

  public saveResumePosition(trackId: string, positionSec: number): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    if (track.resumePosition !== undefined && Math.abs(track.resumePosition - positionSec) < 1) return;
    track.resumePosition = positionSec;
    this.emit('persist');
  }

  // Fast grouped aggregation for Albums
  public getAlbums(): Album[] {
    if (this.albumsCache) return this.albumsCache;
    const albumMap = new Map<string, { albumName: string; artist: string; year?: number; genre?: string; artwork?: string; tracks: TrackMetadata[] }>();

    for (const track of this.tracks.values()) {
      const key = albumKeyOf(track);
      let entry = albumMap.get(key);
      if (!entry) {
        entry = {
          albumName: track.album,
          artist: track.albumArtist || track.artist,
          year: track.year,
          genre: track.genre,
          artwork: track.artworkDataUrl,
          tracks: [],
        };
        albumMap.set(key, entry);
      }
      if (!entry.artwork && track.artworkDataUrl) {
        entry.artwork = track.artworkDataUrl;
      }
      if (!entry.year && track.year) {
        entry.year = track.year;
      }
      if (!entry.genre && track.genre) {
        entry.genre = track.genre;
      }
      entry.tracks.push(track);
    }

    this.albumsCache = Array.from(albumMap.entries()).map(([key, data]) => {
      // Sort tracks by discNumber then trackNumber
      data.tracks.sort((a, b) => {
        const discA = a.discNumber || 1;
        const discB = b.discNumber || 1;
        if (discA !== discB) return discA - discB;
        return (a.trackNumber || 0) - (b.trackNumber || 0);
      });

      const totalDuration = data.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

      return {
        id: key,
        title: data.albumName,
        artist: data.artist,
        year: data.year,
        genre: data.genre || data.tracks.find((t) => t.genre)?.genre,
        artworkDataUrl: data.artwork,
        trackCount: data.tracks.length,
        totalDuration,
        tracks: data.tracks,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
    return this.albumsCache;
  }

  // Fast grouped aggregation for Artists
  public getArtists(): Artist[] {
    if (this.artistsCache) return this.artistsCache;
    const artistMap = new Map<string, { name: string; trackCount: number; albums: Set<Album> }>();
    const entryFor = (name: string) => {
      const key = name.toLowerCase();
      let entry = artistMap.get(key);
      if (!entry) {
        entry = { name, trackCount: 0, albums: new Set() };
        artistMap.set(key, entry);
      }
      return { key, entry };
    };

    for (const track of this.tracks.values()) {
      entryFor(track.artist || 'Unknown Artist').entry.trackCount++;
    }

    // One pass over albums: an album belongs to its album artist and to every artist with a track on it
    for (const album of this.getAlbums()) {
      entryFor(album.artist || 'Unknown Artist').entry.albums.add(album);
      for (const t of album.tracks) {
        entryFor(t.artist || 'Unknown Artist').entry.albums.add(album);
      }
    }

    this.artistsCache = Array.from(artistMap.entries())
      .map(([key, data]) => ({
        id: key,
        name: data.name,
        albumCount: data.albums.size,
        trackCount: data.trackCount,
        albums: Array.from(data.albums),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.artistsCache;
  }

  // Group by Genre
  public getGenres(): { name: string; trackCount: number; tracks: TrackMetadata[] }[] {
    const genreMap = new Map<string, TrackMetadata[]>();

    for (const track of this.tracks.values()) {
      const genre = track.genre?.trim() || 'Uncategorized';
      let list = genreMap.get(genre);
      if (!list) {
        list = [];
        genreMap.set(genre, list);
      }
      list.push(track);
    }

    return Array.from(genreMap.entries())
      .map(([name, tracks]) => ({ name, trackCount: tracks.length, tracks }))
      .sort((a, b) => b.trackCount - a.trackCount);
  }

  // Build Folder Navigation Hierarchy
  public getFolderTree(): FolderNode[] {
    const rootNodes: Map<string, FolderNode> = new Map();

    for (const track of this.tracks.values()) {
      // Split path
      const parts = track.filePath.split(/[/\\]/);
      if (parts.length < 2) continue;
      const folderName = parts[parts.length - 2];
      const folderPath = parts.slice(0, parts.length - 1).join('/');

      let node = rootNodes.get(folderPath);
      if (!node) {
        node = {
          path: folderPath,
          name: folderName,
          trackCount: 0,
          subFolders: [],
          trackIds: [],
        };
        rootNodes.set(folderPath, node);
      }
      node.trackCount++;
      node.trackIds.push(track.id);
    }

    return Array.from(rootNodes.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fast Full-Text & Field Search (Search 10k tracks in < 15ms)
  public searchTracks(query: string): TrackMetadata[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAllTracks();

    const results: TrackMetadata[] = [];
    for (const track of this.tracks.values()) {
      if (
        (track.title || '').toLowerCase().includes(q) ||
        (track.artist || '').toLowerCase().includes(q) ||
        (track.album || '').toLowerCase().includes(q) ||
        (track.genre && track.genre.toLowerCase().includes(q)) ||
        (track.codec || '').toLowerCase().includes(q)
      ) {
        results.push(track);
      }
    }
    return results;
  }

  // Playlists
  public getPlaylists(): Playlist[] {
    // Refresh smart playlist track IDs dynamically
    const all = this.getAllTracks();
    const favSmart = this.playlists.get('smart_favorites');
    if (favSmart) {
      favSmart.trackIds = all.filter((t) => t.isFavorite).map((t) => t.id);
    }

    const recPlayedSmart = this.playlists.get('smart_recently_played');
    if (recPlayedSmart) {
      recPlayedSmart.trackIds = all
        .filter((t) => !!t.lastPlayed)
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        .slice(0, 50)
        .map((t) => t.id);
    }

    const recAddedSmart = this.playlists.get('smart_recently_added');
    if (recAddedSmart) {
      recAddedSmart.trackIds = all
        .slice()
        .sort((a, b) => (b.dateAdded ?? b.dateModified) - (a.dateAdded ?? a.dateModified))
        .slice(0, 50)
        .map((t) => t.id);
    }

    const mostPlayedSmart = this.playlists.get('smart_most_played');
    if (mostPlayedSmart) {
      mostPlayedSmart.trackIds = all
        .filter((t) => (t.playCount || 0) > 0)
        .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
        .slice(0, 50)
        .map((t) => t.id);
    }

    return Array.from(this.playlists.values());
  }

  public createPlaylist(name: string, description?: string): Playlist {
    const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const playlist: Playlist = {
      id,
      name: name.trim(),
      description: description?.trim(),
      trackIds: [],
      folderId: null,
      dateCreated: Date.now(),
      dateModified: Date.now(),
    };
    this.playlists.set(id, playlist);
    this.savePlaylists();
    this.emit('data');
    return playlist;
  }

  public renamePlaylist(id: string, newName: string, description?: string): boolean {
    const pl = this.playlists.get(id);
    if (!pl || pl.isSmart) return false;
    const trimmed = newName.trim();
    if (!trimmed) return false;
    pl.name = trimmed;
    if (description !== undefined) {
      pl.description = description.trim();
    }
    pl.dateModified = Date.now();
    this.savePlaylists();
    this.emit('data');
    return true;
  }

  public deletePlaylist(id: string): boolean {
    const pl = this.playlists.get(id);
    if (!pl || pl.isSmart) return false;
    const deleted = this.playlists.delete(id);
    if (deleted) {
      this.savePlaylists();
      this.emit('data');
    }
    return deleted;
  }

  public addTracksToPlaylist(playlistId: string, trackIds: string[]): boolean {
    const pl = this.playlists.get(playlistId);
    if (!pl || pl.isSmart) return false;
    const existing = new Set(pl.trackIds);
    const unique = trackIds.filter((id) => !existing.has(id));
    if (unique.length === 0) return false;
    pl.trackIds.push(...unique);
    pl.dateModified = Date.now();
    this.savePlaylists();
    this.emit('data');
    return true;
  }

  public removeTrackFromPlaylist(playlistId: string, trackIndex: number): boolean {
    const pl = this.playlists.get(playlistId);
    if (!pl || pl.isSmart) return false;
    if (trackIndex >= 0 && trackIndex < pl.trackIds.length) {
      pl.trackIds.splice(trackIndex, 1);
      pl.dateModified = Date.now();
      this.savePlaylists();
      this.emit('data');
      return true;
    }
    return false;
  }

  public reorderPlaylist(playlistId: string, fromIndex: number, toIndex: number): boolean {
    const pl = this.playlists.get(playlistId);
    if (!pl || pl.isSmart) return false;
    if (fromIndex < 0 || fromIndex >= pl.trackIds.length) return false;
    const [moved] = pl.trackIds.splice(fromIndex, 1);
    pl.trackIds.splice(Math.max(0, Math.min(toIndex, pl.trackIds.length)), 0, moved);
    pl.dateModified = Date.now();
    this.savePlaylists();
    this.emit('data');
    return true;
  }

  // Export M3U8 Playlist
  public exportPlaylistM3u8(playlistId: string): string {
    const pl = this.playlists.get(playlistId);
    if (!pl) return '';

    let content = '#EXTM3U\n';
    for (const trackId of pl.trackIds) {
      const track = this.tracks.get(trackId);
      if (track) {
        content += `#EXTINF:${Math.round(track.duration)},${track.artist} - ${track.title}\n`;
        content += `${track.filePath}\n`;
      }
    }
    return content;
  }

  // Import M3U/M3U8 string
  public importPlaylistM3u(name: string, content: string): Playlist {
    const pl = this.createPlaylist(name, 'Imported from M3U playlist file');
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    const addedTrackIds: string[] = [];

    const byPath = new Map<string, string>();
    const byName = new Map<string, TrackMetadata[]>();
    for (const t of this.tracks.values()) {
      byPath.set(normPath(t.filePath), t.id);
      const key = (t.fileName || '').toLowerCase();
      const list = byName.get(key);
      if (list) list.push(t);
      else byName.set(key, [t]);
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      let n = normPath(trimmed.replace(/^file:\/{2,3}/i, ''));
      let id = byPath.get(n);
      if (!id) {
        // Relative or foreign-root path: match by file name, then verify the path tail
        n = n.replace(/^(\.{1,2}\/)+/, '');
        const base = n.split('/').pop() || '';
        const candidates = byName.get(base) || [];
        const hit = candidates.find((t) => normPath(t.filePath).endsWith('/' + n)) || (candidates.length === 1 ? candidates[0] : undefined);
        id = hit?.id;
      }
      if (id) addedTrackIds.push(id);
    }

    pl.trackIds = addedTrackIds;
    return pl;
  }

  // Library statistics
  public getStats(): LibraryStats {
    const tracks = this.getAllTracks();
    const totalDuration = tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const totalSize = tracks.reduce((s, t) => s + (t.fileSize || 0), 0);

    return {
      totalTracks: tracks.length,
      totalAlbums: this.getAlbums().length,
      totalArtists: this.getArtists().length,
      totalDuration,
      totalSize,
      isScanning: this.isScanning,
      scannedFilesCount: this.scanProgress.current,
      totalFilesCount: this.scanProgress.total,
    };
  }

  public setFolders(folderPaths: string[]): void {
    this.folders = new Set(folderPaths);
  }

  public getFolders(): string[] {
    return Array.from(this.folders);
  }

  public setScanning(isScanning: boolean, progress = { current: 0, total: 0, currentFile: '' }): void {
    this.isScanning = isScanning;
    this.scanProgress = progress;
  }

  // Serialization for persistence (artwork stored once per album instead of once per track)
  public serialize(): any {
    const artworks: Record<string, string> = {};
    const tracks: any[] = [];
    for (const t of this.tracks.values()) {
      if (t.artworkDataUrl) {
        const key = albumKeyOf(t);
        if (!artworks[key]) artworks[key] = t.artworkDataUrl;
        const { artworkDataUrl, ...rest } = t;
        tracks.push(rest);
      } else {
        tracks.push(t);
      }
    }
    return {
      version: 2,
      tracks,
      artworks,
      folders: Array.from(this.folders),
      playlists: Array.from(this.playlists.values()).filter((p) => !p.isSmart),
    };
  }

  public deserialize(data: any): void {
    if (!data) return;
    const artworks: Record<string, string> = data.artworks && typeof data.artworks === 'object' ? data.artworks : {};
    if (Array.isArray(data.tracks)) {
      this.tracks.clear();
      this.artworkByAlbum.clear();
      for (const t of data.tracks) {
        if (!t || !t.id) continue;
        if (!t.artworkDataUrl && t.hasArtwork) {
          const art = artworks[albumKeyOf(t)];
          if (art) t.artworkDataUrl = art;
        }
        if (t.artworkDataUrl && !this.artworkByAlbum.has(albumKeyOf(t))) {
          this.artworkByAlbum.set(albumKeyOf(t), t.artworkDataUrl);
        }
        this.tracks.set(t.id, t);
      }
      this.invalidate();
    }
    if (Array.isArray(data.folders)) {
      this.folders = new Set(data.folders);
    }
    if (Array.isArray(data.playlists)) {
      for (const p of data.playlists) {
        if (p && p.id && !p.isSmart) this.playlists.set(p.id, p);
      }
      this.savePlaylists();
    }
  }
}

export const libraryService = new LibraryService();
