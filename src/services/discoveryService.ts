import { TrackMetadata } from '../types/audio';
import { Artist, Album } from '../types/library';
import { historyService } from './historyService';
import { libraryService } from './libraryService';
import { favoritesService } from './favoritesService';

export interface RecommendationItem {
  track: TrackMetadata;
  reason: string;
  signal: 'frequent_artist' | 'favorite_artist' | 'rediscover' | 'genre_affinity' | 'fresh_discovery';
  isPlayable: boolean;
}

export interface PersonalizedDiscoverySections {
  madeForYou: RecommendationItem[];
  rediscover: RecommendationItem[];
  moreLikeThis: RecommendationItem[];
  artistRotation: {
    artistName: string;
    tracks: RecommendationItem[];
    listenCount: number;
  }[];
  freshDiscoveries: RecommendationItem[];
  hasSufficientData: boolean;
  totalSignalsCount: number;
}

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

  private refreshSeed = 0;

  public refreshPersonalizedDiscovery(): void {
    this.refreshSeed += 1;
  }

  public resetRecommendationProfile(): void {
    this.refreshSeed = 0;
  }

  /**
   * Local-First Personalized Discovery Engine (Phase 4)
   * Learns from listening history, favorites, skips, and play counts without any external AI API.
   */
  public getPersonalizedDiscovery(candidateTracks?: TrackMetadata[]): PersonalizedDiscoverySections {
    const history = historyService.getHistory();
    const favorites = favoritesService.getFavorites();
    const allTracks = candidateTracks || libraryService.getAllTracks();

    // Combine local library tracks and favorites (which may include online favorites)
    const trackMap = new Map<string, TrackMetadata>();
    for (const t of allTracks) {
      if (t && t.id) trackMap.set(t.id, t);
    }
    for (const f of favorites) {
      if (f && f.id && !trackMap.has(f.id)) trackMap.set(f.id, f);
    }
    const combinedTracks = Array.from(trackMap.values());

    const totalSignalsCount = history.length + favorites.length + combinedTracks.filter((t) => (t.playCount || 0) > 0).length;
    const hasSufficientData = totalSignalsCount >= 1 && combinedTracks.length > 0;

    if (!hasSufficientData) {
      return {
        madeForYou: [],
        rediscover: [],
        moreLikeThis: [],
        artistRotation: [],
        freshDiscoveries: [],
        hasSufficientData: false,
        totalSignalsCount,
      };
    }

    // 1. Calculate Artist & Genre Weights
    const artistScores = new Map<string, number>();
    const genreScores = new Map<string, number>();
    const skippedTracks = new Map<string, number>();
    const recentlyPlayedIds = new Set<string>();

    const twoDaysAgo = Date.now() - 2 * 86400 * 1000;
    const oneWeekAgo = Date.now() - 7 * 86400 * 1000;
    const twoWeeksAgo = Date.now() - 14 * 86400 * 1000;

    for (const e of history) {
      if (e.playedAt >= twoDaysAgo) {
        recentlyPlayedIds.add(e.trackId);
      }
      const artist = (e.artist || '').toLowerCase().trim();
      const genre = (e.genre || '').toLowerCase().trim();

      if (e.completionStatus === 'completed') {
        if (artist) artistScores.set(artist, (artistScores.get(artist) || 0) + 3);
        if (genre) genreScores.set(genre, (genreScores.get(genre) || 0) + 2);
      } else if (e.completionStatus === 'skipped') {
        skippedTracks.set(e.trackId, (skippedTracks.get(e.trackId) || 0) + 1);
        if (artist) artistScores.set(artist, (artistScores.get(artist) || 0) - 1);
      }
    }

    // Favorites give strong positive affinity
    for (const fav of favorites) {
      const artist = (fav.artist || '').toLowerCase().trim();
      const genre = (fav.genre || '').toLowerCase().trim();
      if (artist) artistScores.set(artist, (artistScores.get(artist) || 0) + 5);
      if (genre) genreScores.set(genre, (genreScores.get(genre) || 0) + 3);
    }

    // Track play counts give baseline affinity
    for (const t of combinedTracks) {
      if ((t.playCount || 0) > 0) {
        const artist = (t.artist || '').toLowerCase().trim();
        const genre = (t.genre || '').toLowerCase().trim();
        const add = Math.min(10, t.playCount);
        if (artist) artistScores.set(artist, (artistScores.get(artist) || 0) + add);
        if (genre) genreScores.set(genre, (genreScores.get(genre) || 0) + Math.ceil(add / 2));
      }
    }

    const checkPlayable = (t: TrackMetadata): boolean => {
      if (!t.isOnline) return true;
      return t.playbackCapability !== 'external_link' &&
        t.playbackCapability !== 'unavailable' &&
        t.playbackCapability !== 'metadata_only';
    };

    // Filter candidate tracks (excluding heavily skipped tracks)
    const validCandidates = combinedTracks.filter((t) => (skippedTracks.get(t.id) || 0) < 3);

    // Section 1: Made for You (Tracks from high affinity artists/genres, not played in last 48h)
    const madeForYou: RecommendationItem[] = validCandidates
      .filter((t) => !recentlyPlayedIds.has(t.id))
      .map((t) => {
        const aScore = artistScores.get((t.artist || '').toLowerCase().trim()) || 0;
        const gScore = genreScores.get((t.genre || '').toLowerCase().trim()) || 0;
        const score = aScore * 2 + gScore;
        let reason = 'Recommended based on your library style';
        if (aScore >= 5) {
          reason = `Because you listen to ${t.artist} frequently`;
        } else if (gScore >= 3 && t.genre) {
          reason = `Matches your preference for ${t.genre} music`;
        }
        return {
          track: t,
          reason,
          signal: (aScore >= 5 ? 'frequent_artist' : 'genre_affinity') as any,
          isPlayable: checkPlayable(t),
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ track, reason, signal, isPlayable }) => ({ track, reason, signal, isPlayable }));

    // Section 2: Rediscover (Played multiple times or completed, but not played in last 7-14 days)
    const rediscover: RecommendationItem[] = validCandidates
      .filter((t) => {
        const playedCount = t.playCount || 0;
        const lastP = t.lastPlayed || 0;
        return (playedCount >= 1 || history.some((h) => h.trackId === t.id && h.completionStatus === 'completed')) &&
          (!lastP || lastP < oneWeekAgo);
      })
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 8)
      .map((t) => ({
        track: t,
        reason: t.lastPlayed
          ? 'You enjoyed this track earlier. Pick it back up.'
          : 'A favorite from your collection waiting to be rediscovered.',
        signal: 'rediscover',
        isPlayable: checkPlayable(t),
      }));

    // Section 3: More Like This (Similar to user's favorite tracks)
    const topGenres = Array.from(genreScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);

    const moreLikeThis: RecommendationItem[] = validCandidates
      .filter((t) => {
        const g = (t.genre || '').toLowerCase().trim();
        return topGenres.includes(g) && !recentlyPlayedIds.has(t.id);
      })
      .slice(0, 8)
      .map((t) => ({
        track: t,
        reason: t.genre
          ? `Similar sound and energy in ${t.genre}`
          : 'Curated based on your listening style',
        signal: 'genre_affinity',
        isPlayable: checkPlayable(t),
      }));

    // Section 4: Your Artist Rotation (Top 3-4 artists by score with their tracks)
    const sortedArtists = Array.from(artistScores.entries())
      .filter(([name, score]) => name && score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const artistRotation = sortedArtists.map(([artistNorm, score]) => {
      const artistTracks = validCandidates
        .filter((t) => (t.artist || '').toLowerCase().trim() === artistNorm)
        .slice(0, 4)
        .map((t) => ({
          track: t,
          reason: `In your active artist rotation (${t.artist})`,
          signal: 'frequent_artist' as const,
          isPlayable: checkPlayable(t),
        }));

      const origTrack = validCandidates.find((t) => (t.artist || '').toLowerCase().trim() === artistNorm);
      const artistName = origTrack ? origTrack.artist : artistNorm;

      return {
        artistName,
        tracks: artistTracks,
        listenCount: score,
      };
    }).filter((r) => r.tracks.length > 0);

    // Section 5: Fresh Discoveries (Tracks from familiar artists or genres that have 0 plays)
    const freshDiscoveries: RecommendationItem[] = validCandidates
      .filter((t) => (!t.playCount || t.playCount === 0) && !t.lastPlayed)
      .filter((t) => {
        const aScore = artistScores.get((t.artist || '').toLowerCase().trim()) || 0;
        const gScore = genreScores.get((t.genre || '').toLowerCase().trim()) || 0;
        return aScore > 0 || gScore > 0;
      })
      .slice(0, 8)
      .map((t) => ({
        track: t,
        reason: `Unplayed track from an artist in your circle: ${t.artist}`,
        signal: 'fresh_discovery',
        isPlayable: checkPlayable(t),
      }));

    return {
      madeForYou,
      rediscover,
      moreLikeThis,
      artistRotation,
      freshDiscoveries,
      hasSufficientData: true,
      totalSignalsCount,
    };
  }

  public getPersonalizedSections(candidateTracks?: TrackMetadata[]): PersonalizedDiscoverySections {
    return this.getPersonalizedDiscovery(candidateTracks);
  }
}

export const discoveryService = new DiscoveryService();
