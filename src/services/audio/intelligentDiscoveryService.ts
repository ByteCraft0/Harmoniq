import { TrackMetadata } from '../../types/audio';
import { libraryService } from '../libraryService';
import { historyService } from '../historyService';
import { favoritesService } from '../favoritesService';
import { personalIntelligenceService } from './personalIntelligenceService';

export interface DiscoveryTrackRecommendation {
  track: TrackMetadata;
  category: 'similar_to_favorites' | 'recently_discovered' | 'forgotten_favorites' | 'fresh_artists';
  categoryLabel: string;
  rationale: string;
}

export interface PersonalizedDiscoveryBundle {
  similarToFavorites: DiscoveryTrackRecommendation[];
  recentlyDiscovered: DiscoveryTrackRecommendation[];
  forgottenFavorites: DiscoveryTrackRecommendation[];
  freshArtists: DiscoveryTrackRecommendation[];
  generatedAt: number;
}

export class IntelligentDiscoveryService {
  /**
   * Generate intelligent, categorized music recommendations from library and listening habits
   */
  public generatePersonalizedDiscovery(): PersonalizedDiscoveryBundle {
    const allTracks = libraryService.getAllTracks();
    const history = historyService.getHistory();
    const profile = personalIntelligenceService.getListeningProfile('30d');
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    // Build lookup sets
    const playedRecentlyTrackIds = new Set<string>();
    const playedArtistNames = new Set<string>();

    for (const entry of history) {
      if (entry.playedAt >= thirtyDaysAgo) {
        playedRecentlyTrackIds.add(entry.trackId);
      }
      if (entry.artist) {
        playedArtistNames.add(entry.artist.toLowerCase().trim());
      }
    }

    const topArtistNames = new Set(profile.topArtists.slice(0, 5).map((a) => a.name.toLowerCase().trim()));
    const topGenreNames = new Set(profile.topGenres.slice(0, 4).map((g) => g.genre.toLowerCase().trim()));

    const similarToFavorites: DiscoveryTrackRecommendation[] = [];
    const recentlyDiscovered: DiscoveryTrackRecommendation[] = [];
    const forgottenFavorites: DiscoveryTrackRecommendation[] = [];
    const freshArtists: DiscoveryTrackRecommendation[] = [];

    for (const track of allTracks) {
      const trackArtistLower = (track.artist || '').toLowerCase().trim();
      const trackGenreLower = (track.genre || '').toLowerCase().trim();
      const isFav = favoritesService.isFavorite(track);
      const playCount = track.playCount || 0;

      // 1. Forgotten Favorites: Liked or played >= 3 times, but NOT played recently in last 30 days
      if ((isFav || playCount >= 3) && !playedRecentlyTrackIds.has(track.id)) {
        forgottenFavorites.push({
          track,
          category: 'forgotten_favorites',
          categoryLabel: 'Forgotten Favorites',
          rationale: `You previously enjoyed "${track.title}" by ${track.artist}, but haven't listened in over 30 days.`,
        });
        continue;
      }

      // 2. Recently Discovered: Added within 14 days
      const dateAdded = (track as any).dateAdded || (track as any).dateAddedToLibrary || 0;
      if (dateAdded >= fourteenDaysAgo) {
        recentlyDiscovered.push({
          track,
          category: 'recently_discovered',
          categoryLabel: 'Recently Discovered',
          rationale: `Recently added to your library in ${track.genre || 'Lossless'} audio.`,
        });
        continue;
      }

      // 3. Fresh Artists: Artist not in top played, but track is in top user genre
      if (trackGenreLower && topGenreNames.has(trackGenreLower) && !topArtistNames.has(trackArtistLower)) {
        freshArtists.push({
          track,
          category: 'fresh_artists',
          categoryLabel: 'Fresh Artists in Your Genres',
          rationale: `Expand your music horizons with ${track.artist} in your favorite genre (${track.genre}).`,
        });
        continue;
      }

      // 4. Similar to Favorites: Shares genre or artist with top played artists
      if (topArtistNames.has(trackArtistLower) || topGenreNames.has(trackGenreLower)) {
        similarToFavorites.push({
          track,
          category: 'similar_to_favorites',
          categoryLabel: 'Similar to Your Favorites',
          rationale: `Acoustically aligned with your most played artists and genres.`,
        });
      }
    }

    return {
      similarToFavorites: similarToFavorites.slice(0, 10),
      recentlyDiscovered: recentlyDiscovered.slice(0, 10),
      forgottenFavorites: forgottenFavorites.slice(0, 10),
      freshArtists: freshArtists.slice(0, 10),
      generatedAt: now,
    };
  }
}

export const intelligentDiscoveryService = new IntelligentDiscoveryService();
