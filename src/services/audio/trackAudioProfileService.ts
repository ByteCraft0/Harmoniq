import { TrackMetadata } from '../../types/audio';
import { TrackAudioProfile } from '../../types/trackAudioProfile';
import { ParametricFilterConfig, DEFAULT_PARAMETRIC_FILTERS } from '../../types/dsp';

const STORAGE_KEY = 'harmoniq_track_audio_profiles_v1';

/**
 * Service managing per-track audio/EQ memory with stable identity resolution.
 * Tracks custom EQ preferences per track and restores them automatically upon track playback.
 */
export class TrackAudioProfileService {
  private profiles: Map<string, TrackAudioProfile> = new Map();
  private isLoaded = false;

  constructor() {
    this.loadProfiles();
  }

  /**
   * Resolve a stable, canonical track identity string using a strict priority hierarchy:
   * 1. Valid ISRC (e.g. "isrc:USUM71703861")
   * 2. Stable local library track ID (e.g. "lib:12345")
   * 3. Normalized metadata string: title + artist + album/version
   * 4. Canonical local file identifier fallback (hashed/sanitized, avoiding full host paths)
   */
  public getTrackIdentity(track: TrackMetadata | null | undefined): string {
    if (!track) return 'track:unknown';

    // 1. Valid ISRC (International Standard Recording Code: 12 alphanumeric characters)
    if (track.isrc && typeof track.isrc === 'string' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(track.isrc.trim())) {
      return `isrc:${track.isrc.trim().toUpperCase()}`;
    }

    // 2. Stable local library or online track ID
    if (track.id && typeof track.id === 'string' && !track.id.startsWith('temp_')) {
      return `id:${track.id.trim()}`;
    }

    // 3. Normalized Title + Artist + Album
    const norm = (str: string | undefined) =>
      (str || '')
        .toLowerCase()
        .replace(/[\s\-_.,/\\()[\]{}'"]/g, '')
        .trim();

    const titleNorm = norm(track.title);
    const artistNorm = norm(track.artist);
    const albumNorm = norm(track.album);

    if (titleNorm && artistNorm) {
      return `meta:${artistNorm}:${titleNorm}${albumNorm ? `:${albumNorm}` : ''}`;
    }

    // 4. Canonical filename / fallback
    if (track.fileName) {
      return `file:${norm(track.fileName)}`;
    }

    return `track:${Date.now()}`;
  }

  private loadProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.profiles.clear();
          parsed.forEach((item: any) => {
            if (item && typeof item.trackIdentity === 'string') {
              this.profiles.set(item.trackIdentity, {
                trackIdentity: item.trackIdentity,
                title: item.title || 'Unknown Title',
                artist: item.artist || 'Unknown Artist',
                album: item.album || undefined,
                isrc: item.isrc || undefined,
                schemaVersion: item.schemaVersion || 1,
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
                updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
                enabled: item.enabled !== false,
                mode: item.mode === 'parametric' ? 'parametric' : 'graphic',
                bands: Array.isArray(item.bands) && item.bands.length === 10
                  ? item.bands.map((b: any) => (typeof b === 'number' && Number.isFinite(b) ? Math.max(-12, Math.min(12, b)) : 0))
                  : undefined,
                parametricFilters: Array.isArray(item.parametricFilters)
                  ? item.parametricFilters.slice(0, 12)
                  : undefined,
                preampOverride: typeof item.preampOverride === 'number' && Number.isFinite(item.preampOverride)
                  ? Math.max(-12, Math.min(12, item.preampOverride))
                  : undefined,
              });
            }
          });
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('Failed to load track audio profiles from localStorage:', e);
      this.profiles.clear();
    }
  }

  private saveProfiles(): void {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.profiles.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (e) {
      console.warn('Failed to save track audio profiles to localStorage:', e);
    }
  }

  public getProfileForTrack(track: TrackMetadata | null | undefined): TrackAudioProfile | null {
    if (!track) return null;
    if (!this.isLoaded) this.loadProfiles();
    const identity = this.getTrackIdentity(track);
    return this.profiles.get(identity) || null;
  }

  public hasTrackProfile(track: TrackMetadata | null | undefined): boolean {
    return this.getProfileForTrack(track) !== null;
  }

  public saveProfileForTrack(
    track: TrackMetadata,
    overrides: {
      mode: 'graphic' | 'parametric';
      bands?: number[];
      parametricFilters?: ParametricFilterConfig[];
      preampOverride?: number;
      enabled?: boolean;
    }
  ): TrackAudioProfile {
    const identity = this.getTrackIdentity(track);
    const existing = this.profiles.get(identity);

    const updated: TrackAudioProfile = {
      trackIdentity: identity,
      title: track.title || 'Unknown Title',
      artist: track.artist || 'Unknown Artist',
      album: track.album,
      isrc: track.isrc,
      schemaVersion: 1,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      enabled: overrides.enabled !== undefined ? overrides.enabled : true,
      mode: overrides.mode,
      bands: overrides.bands ? [...overrides.bands] : existing?.bands,
      parametricFilters: overrides.parametricFilters
        ? overrides.parametricFilters.map((f) => ({ ...f }))
        : existing?.parametricFilters,
      preampOverride: overrides.preampOverride !== undefined ? overrides.preampOverride : existing?.preampOverride,
    };

    this.profiles.set(identity, updated);
    this.saveProfiles();
    return updated;
  }

  public removeProfileForTrack(trackOrIdentity: TrackMetadata | string): boolean {
    const identity = typeof trackOrIdentity === 'string' ? trackOrIdentity : this.getTrackIdentity(trackOrIdentity);
    const deleted = this.profiles.delete(identity);
    if (deleted) {
      this.saveProfiles();
    }
    return deleted;
  }

  public toggleTrackProfile(track: TrackMetadata, enabled: boolean): TrackAudioProfile | null {
    const profile = this.getProfileForTrack(track);
    if (!profile) return null;
    profile.enabled = enabled;
    profile.updatedAt = Date.now();
    this.profiles.set(profile.trackIdentity, profile);
    this.saveProfiles();
    return profile;
  }

  public getAllTrackProfiles(): TrackAudioProfile[] {
    if (!this.isLoaded) this.loadProfiles();
    return Array.from(this.profiles.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public clearAllTrackProfiles(): void {
    this.profiles.clear();
    this.saveProfiles();
  }
}

export const trackAudioProfileService = new TrackAudioProfileService();
