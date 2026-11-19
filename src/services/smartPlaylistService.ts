import { TrackMetadata } from '../types/audio';
import {
  SmartPlaylistDefinition,
  SmartPlaylistRule,
  SmartPlaylistField,
} from '../types/smartPlaylist';

const STORAGE_SMART_PLAYLISTS_KEY = 'harmoniq_smart_playlists_v2';

export const DEFAULT_SMART_PLAYLISTS: SmartPlaylistDefinition[] = [
  {
    id: 'sp_favorites',
    name: 'Starred Favorites',
    description: 'All your starred favorite tracks',
    matchMode: 'all',
    rules: [
      {
        id: 'r_fav',
        field: 'isFavorite',
        operator: 'equals',
        value: 'true',
      },
    ],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 0,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_recently_added',
    name: 'Recently Added',
    description: 'Tracks added to the library recently',
    matchMode: 'all',
    rules: [
      {
        id: 'r_ra',
        field: 'dateAdded',
        operator: 'greaterThan',
        value: 0,
      },
    ],
    sortBy: 'dateAdded',
    sortOrder: 'desc',
    limit: 50,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_most_played',
    name: 'Most Played',
    description: 'Tracks with the highest successful play counts',
    matchMode: 'all',
    rules: [
      {
        id: 'r_mp',
        field: 'playCount',
        operator: 'greaterThan',
        value: 0,
      },
    ],
    sortBy: 'playCount',
    sortOrder: 'desc',
    limit: 50,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_recently_played',
    name: 'Recently Played',
    description: 'Tracks played most recently in your listening history',
    matchMode: 'all',
    rules: [
      {
        id: 'r_rp',
        field: 'lastPlayed',
        operator: 'greaterThan',
        value: 0,
      },
    ],
    sortBy: 'lastPlayed',
    sortOrder: 'desc',
    limit: 50,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_never_played',
    name: 'Never Played',
    description: 'Tracks in the local library that have never been played',
    matchMode: 'all',
    rules: [
      {
        id: 'r_np',
        field: 'playCount',
        operator: 'equals',
        value: 0,
      },
    ],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 0,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_frequently_played',
    name: 'Frequently Played',
    description: 'Tracks played repeatedly over your listening history',
    matchMode: 'all',
    rules: [
      {
        id: 'r_fp',
        field: 'playCount',
        operator: 'greaterThan',
        value: 2,
      },
    ],
    sortBy: 'playCount',
    sortOrder: 'desc',
    limit: 50,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_forgotten_favorites',
    name: 'Forgotten Favorites',
    description: 'Favorite tracks that have not been played recently',
    matchMode: 'all',
    rules: [
      {
        id: 'r_ff_fav',
        field: 'isFavorite',
        operator: 'equals',
        value: 'true',
      },
    ],
    sortBy: 'lastPlayed',
    sortOrder: 'asc',
    limit: 50,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_discovery_mix',
    name: 'Discovery Mix',
    description: 'Tracks from artists and genres you enjoy, prioritizing unplayed or older tracks',
    matchMode: 'all',
    rules: [],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 30,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_lossless_hires',
    name: 'Audiophile Lossless & Hi-Res',
    description: 'FLAC, WAV, ALAC and Hi-Res studio master files',
    matchMode: 'any',
    rules: [
      {
        id: 'r_flac',
        field: 'codec',
        operator: 'equals',
        value: 'FLAC',
      },
      {
        id: 'r_wav',
        field: 'codec',
        operator: 'equals',
        value: 'WAV',
      },
      {
        id: 'r_alac',
        field: 'codec',
        operator: 'equals',
        value: 'ALAC',
      },
      {
        id: 'r_bitrate',
        field: 'bitrate',
        operator: 'greaterThan',
        value: 500,
      },
    ],
    sortBy: 'bitrate',
    sortOrder: 'desc',
    limit: 100,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
  {
    id: 'sp_epic_tracks',
    name: 'Epic Long Tracks (> 7 min)',
    description: 'Extended tracks and progressive masterpieces over 7 minutes',
    matchMode: 'all',
    rules: [
      {
        id: 'r_duration',
        field: 'duration',
        operator: 'greaterThan',
        value: 420,
      },
    ],
    sortBy: 'duration',
    sortOrder: 'desc',
    limit: 0,
    dateCreated: 1700000000000,
    dateModified: 1700000000000,
    isBuiltIn: true,
  },
];

export function evaluateRule(rule: SmartPlaylistRule, track: TrackMetadata): boolean {
  let trackVal: any = undefined;
  switch (rule.field) {
    case 'title':
      trackVal = track.title || '';
      break;
    case 'artist':
      trackVal = track.artist || '';
      break;
    case 'album':
      trackVal = track.album || '';
      break;
    case 'genre':
      trackVal = track.genre || '';
      break;
    case 'year':
      trackVal = track.year ?? 0;
      break;
    case 'duration':
      trackVal = track.duration || 0;
      break;
    case 'bitrate':
      trackVal = track.bitrate || 0;
      break;
    case 'codec':
      trackVal = track.codec || '';
      break;
    case 'dateAdded':
      trackVal = track.dateAdded ?? track.dateModified ?? 0;
      break;
    case 'lastPlayed':
      trackVal = track.lastPlayed ?? 0;
      break;
    case 'playCount':
      trackVal = track.playCount || 0;
      break;
    case 'isFavorite':
      trackVal = track.isFavorite ? 'true' : 'false';
      break;
  }

  const op = rule.operator;
  const target = rule.value;

  if (typeof trackVal === 'string') {
    const sTrack = trackVal.toLowerCase();
    const sTarget = String(target).toLowerCase();
    switch (op) {
      case 'equals':
        return sTrack === sTarget;
      case 'notEquals':
        return sTrack !== sTarget;
      case 'contains':
        return sTrack.includes(sTarget);
      case 'notContains':
        return !sTrack.includes(sTarget);
      default:
        return false;
    }
  }

  if (typeof trackVal === 'number') {
    const nTarget = Number(target) || 0;
    switch (op) {
      case 'equals':
        return trackVal === nTarget;
      case 'notEquals':
        return trackVal !== nTarget;
      case 'greaterThan':
        return trackVal > nTarget;
      case 'lessThan':
        return trackVal < nTarget;
      case 'between': {
        const extra = Number(rule.valueExtra) || 0;
        const min = Math.min(nTarget, extra);
        const max = Math.max(nTarget, extra);
        return trackVal >= min && trackVal <= max;
      }
      default:
        return false;
    }
  }

  return false;
}

export function evaluateSmartPlaylist(
  playlist: SmartPlaylistDefinition,
  allTracks: TrackMetadata[]
): TrackMetadata[] {
  // Defensive filter: for online tracks, include only tracks with stable identities and valid playback capabilities
  const validTracks = allTracks.filter((track) => {
    if (!track || !track.id) return false;
    if (track.isOnline) {
      if (
        track.playbackCapability === 'unavailable' ||
        track.playbackCapability === 'metadata_only' ||
        track.playbackCapability === 'external_link'
      ) {
        return false;
      }
    }
    return true;
  });

  let matches: TrackMetadata[] = [];

  // Special template logic
  if (playlist.id === 'sp_forgotten_favorites') {
    const twoWeeksAgo = Date.now() - 14 * 86400 * 1000;
    matches = validTracks.filter(
      (t) => t.isFavorite && (!t.lastPlayed || t.lastPlayed < twoWeeksAgo)
    );
  } else if (playlist.id === 'sp_never_played') {
    matches = validTracks.filter((t) => (!t.playCount || t.playCount === 0) && !t.lastPlayed);
  } else if (playlist.id === 'sp_discovery_mix') {
    // Collect top artists and genres from played tracks
    const played = validTracks.filter((t) => (t.playCount || 0) > 0);
    const topArtists = new Set<string>();
    const topGenres = new Set<string>();
    for (const t of played) {
      if (t.artist) topArtists.add(t.artist.toLowerCase().trim());
      if (t.genre) topGenres.add(t.genre.toLowerCase().trim());
    }

    const oneWeekAgo = Date.now() - 7 * 86400 * 1000;
    matches = validTracks.filter((t) => {
      const matchArtist = t.artist && topArtists.has(t.artist.toLowerCase().trim());
      const matchGenre = t.genre && topGenres.has(t.genre.toLowerCase().trim());
      const notRecentlyPlayed = !t.lastPlayed || t.lastPlayed < oneWeekAgo;
      return (matchArtist || matchGenre) && notRecentlyPlayed;
    });

    if (matches.length === 0) {
      // Fallback: unplayed tracks
      matches = validTracks.filter((t) => !t.lastPlayed || t.lastPlayed < oneWeekAgo);
    }
  } else {
    // Standard rule evaluation
    matches = validTracks.filter((track) => {
      if (!playlist.rules || playlist.rules.length === 0) return true;
      if (playlist.matchMode === 'any') {
        return playlist.rules.some((rule) => evaluateRule(rule, track));
      }
      return playlist.rules.every((rule) => evaluateRule(rule, track));
    });
  }

  // Sorting
  const sortBy = playlist.sortBy || 'title';
  const isAsc = playlist.sortOrder !== 'desc';

  matches.sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;
    switch (sortBy) {
      case 'title':
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
        break;
      case 'artist':
        valA = (a.artist || '').toLowerCase();
        valB = (b.artist || '').toLowerCase();
        break;
      case 'album':
        valA = (a.album || '').toLowerCase();
        valB = (b.album || '').toLowerCase();
        break;
      case 'year':
        valA = a.year || 0;
        valB = b.year || 0;
        break;
      case 'duration':
        valA = a.duration || 0;
        valB = b.duration || 0;
        break;
      case 'bitrate':
        valA = a.bitrate || 0;
        valB = b.bitrate || 0;
        break;
      case 'dateAdded':
        valA = a.dateAdded ?? a.dateModified ?? 0;
        valB = b.dateAdded ?? b.dateModified ?? 0;
        break;
      case 'lastPlayed':
        valA = a.lastPlayed ?? 0;
        valB = b.lastPlayed ?? 0;
        break;
      case 'playCount':
        valA = a.playCount ?? 0;
        valB = b.playCount ?? 0;
        break;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return isAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });

  if (playlist.limit && playlist.limit > 0) {
    matches = matches.slice(0, playlist.limit);
  }

  return matches;
}

export class SmartPlaylistService {
  private playlists: Map<string, SmartPlaylistDefinition> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    // 1. Seed defaults
    for (const def of DEFAULT_SMART_PLAYLISTS) {
      this.playlists.set(def.id, def);
    }

    // 2. Load custom playlists from storage
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_SMART_PLAYLISTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const sp of parsed) {
              if (sp && sp.id) {
                this.playlists.set(sp.id, sp);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load custom smart playlists:', e);
    }
  }

  public save(): void {
    try {
      const custom = Array.from(this.playlists.values()).filter((p) => !p.isBuiltIn);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_SMART_PLAYLISTS_KEY, JSON.stringify(custom));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_SMART_PLAYLISTS_KEY, custom).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist smart playlists:', e);
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

  public getAll(): SmartPlaylistDefinition[] {
    return Array.from(this.playlists.values());
  }

  public get(id: string): SmartPlaylistDefinition | undefined {
    return this.playlists.get(id);
  }

  public create(
    name: string,
    rules: SmartPlaylistRule[],
    options?: Partial<SmartPlaylistDefinition>
  ): SmartPlaylistDefinition {
    const id = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pl: SmartPlaylistDefinition = {
      id,
      name: name.trim(),
      description: options?.description?.trim(),
      matchMode: options?.matchMode || 'all',
      rules,
      sortBy: options?.sortBy || 'title',
      sortOrder: options?.sortOrder || 'asc',
      limit: options?.limit ?? 0,
      dateCreated: Date.now(),
      dateModified: Date.now(),
      isBuiltIn: false,
    };
    this.playlists.set(id, pl);
    this.save();
    return pl;
  }

  public update(id: string, updates: Partial<SmartPlaylistDefinition>): boolean {
    const existing = this.playlists.get(id);
    if (!existing) return false;
    const updated: SmartPlaylistDefinition = {
      ...existing,
      ...updates,
      dateModified: Date.now(),
    };
    this.playlists.set(id, updated);
    this.save();
    return true;
  }

  public delete(id: string): boolean {
    const existing = this.playlists.get(id);
    if (!existing || existing.isBuiltIn) return false;
    const deleted = this.playlists.delete(id);
    if (deleted) {
      this.save();
    }
    return deleted;
  }
}

export const smartPlaylistService = new SmartPlaylistService();
