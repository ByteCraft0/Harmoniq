import { TrackMetadata } from '../types/audio';
import { Artist, Album } from '../types/library';

export type MoodCategory = 'Relax' | 'Energetic' | 'Focus' | 'Chill' | 'Party' | 'Acoustic';

export interface MoodDefinition {
  id: MoodCategory;
  name: string;
  description: string;
  color: string;
  gradient: string;
  genres: string[];
}

export const MOOD_DEFINITIONS: MoodDefinition[] = [
  {
    id: 'Chill',
    name: 'Chill & Ambient',
    description: 'Laid-back vibes, downtempo grooves, and soothing lo-fi textures',
    color: '#38BDF8',
    gradient: 'from-sky-500/20 via-sky-900/10 to-transparent',
    genres: ['chillout', 'lo-fi', 'downtempo', 'ambient', 'trip hop', 'dream pop', 'smooth jazz', 'reggae'],
  },
  {
    id: 'Focus',
    name: 'Deep Focus & Study',
    description: 'Instrumental clarity, neo-classical harmony, and atmospheric soundscapes',
    color: '#818CF8',
    gradient: 'from-indigo-500/20 via-indigo-900/10 to-transparent',
    genres: ['classical', 'instrumental', 'piano', 'post-rock', 'soundtrack', 'minimal', 'ambient'],
  },
  {
    id: 'Energetic',
    name: 'High Energy & Drive',
    description: 'Driving rhythms, punchy rock anthems, and fast-paced electronic beats',
    color: '#F43F5E',
    gradient: 'from-rose-500/20 via-rose-900/10 to-transparent',
    genres: ['rock', 'metal', 'hard rock', 'punk', 'electronic', 'drum and bass', 'techno', 'edm'],
  },
  {
    id: 'Party',
    name: 'Party & Celebration',
    description: 'Upbeat pop, dance hits, funk grooves, and dancefloor bangers',
    color: '#EC4899',
    gradient: 'from-pink-500/20 via-pink-900/10 to-transparent',
    genres: ['pop', 'dance', 'house', 'hip-hop', 'funk', 'disco', 'r&b', 'club'],
  },
  {
    id: 'Acoustic',
    name: 'Raw Acoustic & Folk',
    description: 'Organic guitars, unplugged songwriting, and heartfelt vocals',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 via-amber-900/10 to-transparent',
    genres: ['acoustic', 'folk', 'singer-songwriter', 'bluegrass', 'unplugged', 'indie folk', 'country'],
  },
  {
    id: 'Relax',
    name: 'Evening Relaxation',
    description: 'Gentle melodies, mellow jazz standards, and peaceful acoustic serenity',
    color: '#A78BFA',
    gradient: 'from-purple-500/20 via-purple-900/10 to-transparent',
    genres: ['jazz', 'soul', 'easy listening', 'new age', 'bossa nova', 'blues'],
  },
];

export interface SimilarArtistMatch {
  artist: Artist;
  score: number;
  reasons: string[];
}

export interface ArtistBioInfo {
  name: string;
  biography: string;
  country?: string;
  activeYears?: string;
  genres: string[];
  website?: string;
  source: string;
  imageUrl?: string;
}

export interface OnlineMetadataResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  trackCount?: number;
  country?: string;
  label?: string;
  artworkUrl?: string;
}

const STORAGE_MOOD_TAGS_KEY = 'harmoniq_track_mood_tags_v1';
const STORAGE_ARTIST_BIO_KEY = 'harmoniq_artist_bio_cache_v1';

export class DiscoveryService {
  private userMoodTags: Map<string, Set<MoodCategory>> = new Map();
  private bioCache: Map<string, ArtistBioInfo> = new Map();

  constructor() {
    this.loadUserMoods();
    this.loadBioCache();
  }

  private loadUserMoods(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_MOOD_TAGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [id, moods] of Object.entries(parsed)) {
            if (Array.isArray(moods)) {
              this.userMoodTags.set(id, new Set(moods as MoodCategory[]));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load user mood tags:', e);
    }
  }

  private saveUserMoods(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, MoodCategory[]> = {};
        for (const [id, moods] of this.userMoodTags.entries()) {
          obj[id] = Array.from(moods);
        }
        localStorage.setItem(STORAGE_MOOD_TAGS_KEY, JSON.stringify(obj));
      }
    } catch (e) {
      console.warn('Failed to persist user mood tags:', e);
    }
  }

  private loadBioCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_ARTIST_BIO_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [k, v] of Object.entries(parsed)) {
            this.bioCache.set(k.toLowerCase(), v as ArtistBioInfo);
          }
        }
      }
    } catch {}
  }

  private saveBioCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const obj: Record<string, ArtistBioInfo> = {};
        for (const [k, v] of this.bioCache.entries()) {
          obj[k] = v;
        }
        localStorage.setItem(STORAGE_ARTIST_BIO_KEY, JSON.stringify(obj));
      }
    } catch {}
  }

  /**
   * Assign or toggle a mood category for a track
   */
  public toggleTrackMood(trackId: string, mood: MoodCategory): boolean {
    let set = this.userMoodTags.get(trackId);
    if (!set) {
      set = new Set();
      this.userMoodTags.set(trackId, set);
    }
    let has = false;
    if (set.has(mood)) {
      set.delete(mood);
      has = false;
    } else {
      set.add(mood);
      has = true;
    }
    this.saveUserMoods();
    return has;
  }

  public getTrackMoods(trackId: string): MoodCategory[] {
    const set = this.userMoodTags.get(trackId);
    return set ? Array.from(set) : [];
  }

  /**
   * Deterministically categorize tracks by mood without AI
   */
  public getTracksForMood(mood: MoodCategory, tracks: TrackMetadata[]): TrackMetadata[] {
    const def = MOOD_DEFINITIONS.find((m) => m.id === mood);
    if (!def) return [];

    return tracks.filter((t) => {
      // 1. Explicit user tag match
      const userMoods = this.userMoodTags.get(t.id);
      if (userMoods && userMoods.has(mood)) return true;

      // 2. Genre and comment rule matching
      const genre = (t.genre || '').toLowerCase();
      const comment = (t.comment || '').toLowerCase();

      return def.genres.some((keyword) => genre.includes(keyword) || comment.includes(keyword));
    });
  }

  /**
   * Compute deterministic similarity between artists based on:
   * - Shared genres
   * - Shared musical eras / decades
   * - Shared compilation/soundtrack appearances
   */
  public findSimilarArtists(targetArtist: Artist, allArtists: Artist[]): SimilarArtistMatch[] {
    const targetName = targetArtist.name.toLowerCase();
    const results: SimilarArtistMatch[] = [];

    // Extract genres and active decades for target artist
    const targetGenres = new Set<string>();
    const targetDecades = new Set<number>();

    for (const alb of targetArtist.albums) {
      for (const t of alb.tracks) {
        if (t.genre) targetGenres.add(t.genre.toLowerCase());
        if (t.year && t.year > 1900) {
          targetDecades.add(Math.floor(t.year / 10) * 10);
        }
      }
    }

    for (const other of allArtists) {
      if (other.name.toLowerCase() === targetName) continue;

      let score = 0;
      const reasons: string[] = [];

      // 1. Compare genres
      const otherGenres = new Set<string>();
      const otherDecades = new Set<number>();
      for (const alb of other.albums) {
        for (const t of alb.tracks) {
          if (t.genre) otherGenres.add(t.genre.toLowerCase());
          if (t.year && t.year > 1900) {
            otherDecades.add(Math.floor(t.year / 10) * 10);
          }
        }
      }

      const sharedGenres: string[] = [];
      for (const g of targetGenres) {
        if (otherGenres.has(g)) {
          sharedGenres.push(g);
          score += 3;
        }
      }

      if (sharedGenres.length > 0) {
        const formatted = sharedGenres
          .slice(0, 2)
          .map((s) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
          .join(', ');
        reasons.push(`Shared genre: ${formatted}`);
      }

      // 2. Compare decades
      for (const dec of targetDecades) {
        if (otherDecades.has(dec)) {
          score += 2;
          reasons.push(`Active in the ${dec}s era`);
          break;
        }
      }

      if (score > 0) {
        results.push({
          artist: other,
          score,
          reasons,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  /**
   * Fetch legitimate artist biography from Wikipedia open summary or MusicBrainz
   */
  public async getArtistBio(artistName: string): Promise<ArtistBioInfo> {
    const key = artistName.trim().toLowerCase();
    if (this.bioCache.has(key)) {
      return this.bioCache.get(key)!;
    }

    try {
      // 1. Open Wikipedia REST API (free, open public encyclopedic knowledge)
      const encoded = encodeURIComponent(artistName.trim());
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
        headers: {
          'User-Agent': 'HarmoniqDesktopMusicPlayer/1.0 (contact@harmoniq.audio)',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.extract) {
          const info: ArtistBioInfo = {
            name: artistName,
            biography: data.extract,
            source: 'Wikipedia & Wikimedia Open Knowledge',
            imageUrl: data.thumbnail?.source,
            website: data.content_urls?.desktop?.page,
            genres: [],
          };
          this.bioCache.set(key, info);
          this.saveBioCache();
          return info;
        }
      }
    } catch (e) {
      console.warn(`Online bio lookup failed for ${artistName}:`, e);
    }

    // Fallback: Local synthesized info
    const fallback: ArtistBioInfo = {
      name: artistName,
      biography: `${artistName} is part of your local music library. Connect to the internet for detailed biography and discography information.`,
      source: 'Local Library Metadata',
      genres: [],
    };
    return fallback;
  }

  /**
   * Query MusicBrainz open database for online metadata & cover art
   */
  public async searchOnlineMetadata(query: {
    title?: string;
    artist?: string;
    album?: string;
  }): Promise<OnlineMetadataResult[]> {
    const results: OnlineMetadataResult[] = [];
    try {
      const parts: string[] = [];
      if (query.artist) parts.push(`artist:"${query.artist}"`);
      if (query.album) parts.push(`release:"${query.album}"`);
      if (query.title) parts.push(`recording:"${query.title}"`);

      if (parts.length === 0) return [];

      const qStr = encodeURIComponent(parts.join(' AND '));
      const res = await fetch(
        `https://musicbrainz.org/ws/2/release/?query=${qStr}&limit=5&fmt=json`,
        {
          headers: {
            'User-Agent': 'HarmoniqAudioPlayer/1.0.0 (https://harmoniq.audio)',
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.releases)) {
          for (const rel of data.releases) {
            const yearStr = rel.date ? parseInt(rel.date.substring(0, 4), 10) : undefined;
            const artistCredit = Array.isArray(rel['artist-credit'])
              ? rel['artist-credit'].map((a: any) => a.name).join(', ')
              : 'Unknown Artist';

            results.push({
              id: rel.id,
              title: query.title || rel.title,
              album: rel.title,
              artist: artistCredit,
              year: yearStr,
              country: rel.country,
              label: rel['label-info-list']?.[0]?.label?.name,
              trackCount: rel['track-count'],
              artworkUrl: `https://coverartarchive.org/release/${rel.id}/front-250`,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Online metadata search error:', e);
    }
    return results;
  }
}

export const discoveryService = new DiscoveryService();
