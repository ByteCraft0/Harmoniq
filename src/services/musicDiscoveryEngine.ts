import {
  DiscoveryFilters,
  DiscoveryIntent,
  DiscoveryResult,
} from '../types/discovery';
import { UnifiedTrack, ProviderId } from '../types/universalMusic';
import { universalMusicService } from './universalMusicService';
import { HarmoniqAssistantContext } from '../types/assistant';

export class MusicDiscoveryEngine {
  /**
   * Translates a structured DiscoveryIntent into a provider-aware Universal Music query,
   * executes searches across all available providers, deduplicates, and ranks results.
   */
  public async discoverMusic(
    intent: DiscoveryIntent,
    context?: HarmoniqAssistantContext | null
  ): Promise<DiscoveryResult> {
    const appliedFilters: string[] = [];
    const providersQueried: ProviderId[] = [
      'local',
      'jamendo',
      'audius',
      'archive',
      'apple',
      'spotify',
      'youtube',
    ];

    // 1. Build Optimized Query String
    let searchQuery = '';

    if (intent.action === 'discover_similar' && intent.reference) {
      if (intent.reference.type === 'current_track') {
        if (context?.currentTrack) {
          const artist = context.currentTrack.artist || '';
          const genre = context.currentTrack.genre || '';
          appliedFilters.push(`Similar to "${context.currentTrack.title}" by ${artist}`);

          // Search primarily by artist and genre
          if (intent.filters.genres && intent.filters.genres.length > 0) {
            searchQuery = `${artist} ${intent.filters.genres.join(' ')}`;
          } else if (genre) {
            searchQuery = `${artist} ${genre}`;
          } else {
            searchQuery = artist || context.currentTrack.title;
          }
        } else {
          return {
            intent,
            tracks: [],
            totalFound: 0,
            providersQueried,
            summary: 'No song is currently playing to discover similar music. Start playing a track or specify an artist name.',
            appliedFilters: ['Similarity: Current Track (None Active)'],
          };
        }
      } else if (intent.reference.type === 'current_artist') {
        if (context?.currentTrack?.artist) {
          searchQuery = context.currentTrack.artist;
          appliedFilters.push(`Artist: ${context.currentTrack.artist}`);
        } else {
          searchQuery = intent.filters.query || 'music';
        }
      } else if (intent.reference.type === 'current_album') {
        if (context?.currentTrack?.album) {
          searchQuery = `${context.currentTrack.artist || ''} ${context.currentTrack.album}`.trim();
          appliedFilters.push(`Album: ${context.currentTrack.album}`);
        } else {
          searchQuery = intent.filters.query || 'music';
        }
      } else if (intent.reference.type === 'track_title' && intent.reference.title) {
        searchQuery = intent.reference.title;
        appliedFilters.push(`Similar to "${intent.reference.title}"`);
      } else if (intent.reference.type === 'playlist') {
        if (context?.queue && context.queue.nextTrack) {
          searchQuery = context.queue.nextTrack.artist || context.queue.nextTrack.title;
          appliedFilters.push('Playlist Context');
        } else {
          searchQuery = intent.filters.query || 'study playlist';
        }
      }
    } else {
      // General Discovery: Build from moods, activities, genres, and query
      const queryParts: string[] = [];

      if (intent.filters.genres && intent.filters.genres.length > 0) {
        queryParts.push(intent.filters.genres.join(' '));
        appliedFilters.push(`Genres: ${intent.filters.genres.join(', ')}`);
      }

      if (intent.filters.moods && intent.filters.moods.length > 0) {
        appliedFilters.push(`Mood: ${intent.filters.moods.join(', ')}`);
        // Map moods to search-friendly terms
        for (const mood of intent.filters.moods) {
          if (mood === 'relaxing' || mood === 'peaceful') queryParts.push('relaxing ambient');
          else if (mood === 'chill') queryParts.push('chillout lo-fi');
          else if (mood === 'energetic') queryParts.push('energetic upbeat');
          else if (mood === 'happy') queryParts.push('happy uplifting');
          else if (mood === 'sad' || mood === 'melancholic') queryParts.push('melancholic acoustic');
          else if (mood === 'romantic') queryParts.push('romantic acoustic');
          else if (mood === 'atmospheric') queryParts.push('atmospheric cinematic');
          else if (mood === 'motivational') queryParts.push('motivational');
        }
      }

      if (intent.filters.activities && intent.filters.activities.length > 0) {
        appliedFilters.push(`Activity: ${intent.filters.activities.join(', ')}`);
        for (const act of intent.filters.activities) {
          if (act === 'studying' || act === 'coding' || act === 'working') queryParts.push('study instrumental focus');
          else if (act === 'exercising') queryParts.push('workout electronic');
          else if (act === 'sleeping') queryParts.push('sleep ambient peaceful');
          else if (act === 'travelling') queryParts.push('road trip chill');
        }
      }

      if (intent.filters.isAcoustic) {
        queryParts.push('acoustic');
        appliedFilters.push('Acoustic');
      }

      if (intent.filters.isInstrumental) {
        queryParts.push('instrumental');
        appliedFilters.push('Instrumental Only');
      }

      if (intent.filters.vocalPreference === 'female') {
        queryParts.push('female');
        appliedFilters.push('Female Vocals');
      } else if (intent.filters.vocalPreference === 'male') {
        queryParts.push('male');
        appliedFilters.push('Male Vocals');
      }

      if (intent.filters.yearMin && intent.filters.yearMax) {
        appliedFilters.push(`Years: ${intent.filters.yearMin}-${intent.filters.yearMax}`);
      } else if (intent.filters.yearMin) {
        appliedFilters.push(`Released after ${intent.filters.yearMin}`);
      }

      if (intent.filters.query && !queryParts.some(p => p.toLowerCase().includes(intent.filters.query!.toLowerCase()))) {
        queryParts.unshift(intent.filters.query);
      }

      searchQuery = queryParts.join(' ').trim() || 'featured';
    }

    // 2. Execute Search via Existing Universal Music Engine
    const searchResponse = await universalMusicService.searchUniversal(searchQuery, {
      limit: 25,
      genre: intent.filters.genres?.[0],
    });

    // 3. Combine and Post-Filter Results
    let allTracks = [...(searchResponse.localResults || []), ...(searchResponse.results || [])];

    if (intent.filters.localOnly) {
      allTracks = allTracks.filter(t => t.providerId === 'local' || !t.isOnline);
      appliedFilters.push('Local Library Only');
    }

    // Year constraints
    if (intent.filters.yearMin) {
      allTracks = allTracks.filter(t => !t.releaseYear || t.releaseYear >= intent.filters.yearMin!);
    }
    if (intent.filters.yearMax) {
      allTracks = allTracks.filter(t => !t.releaseYear || t.releaseYear <= intent.filters.yearMax!);
    }

    // Instrumental constraints
    if (intent.filters.isInstrumental) {
      allTracks = allTracks.filter(t => {
        const text = `${t.title} ${t.album || ''} ${t.genre || ''}`.toLowerCase();
        return (
          text.includes('instrumental') ||
          text.includes('piano') ||
          text.includes('ambient') ||
          text.includes('soundtrack') ||
          text.includes('lo-fi') ||
          text.includes('acoustic')
        );
      });
    }

    // 4. Deterministic Scoring & Ranking
    const scoredTracks = allTracks.map(track => {
      let score = 0;

      // Playback capability priority
      if (track.playbackCapability === 'full_stream' || track.playbackCapability === 'local_file') {
        score += 50; // Highest priority: directly playable full tracks
      } else if (track.playbackCapability === 'preview_stream') {
        score += 35; // Second priority: playable 30s preview
      } else if (track.playbackCapability === 'authorized_embed' || track.playbackCapability === 'external_embed') {
        score += 20;
      } else if (track.playbackCapability === 'external_link') {
        score += 10;
      } else {
        score += 5;
      }

      // Keyword & genre affinity bonus
      const combinedMeta = `${track.title} ${track.artist} ${track.album || ''} ${track.genre || ''}`.toLowerCase();
      if (intent.filters.genres) {
        for (const g of intent.filters.genres) {
          if (combinedMeta.includes(g.toLowerCase())) score += 20;
        }
      }

      if (intent.filters.isAcoustic && combinedMeta.includes('acoustic')) {
        score += 15;
      }

      // Popularity filter
      if (intent.filters.popularityFilter === 'underrated') {
        // Boost independent & creative commons providers
        if (['jamendo', 'audius', 'archive'].includes(track.providerId)) {
          score += 25;
        }
      } else if (intent.filters.popularityFilter === 'popular') {
        if (track.popularity && track.popularity > 50) {
          score += 20;
        }
      }

      return { track, score };
    });

    scoredTracks.sort((a, b) => b.score - a.score);

    // Deduplicate top tracks
    const finalTracks = universalMusicService.deduplicateTracks(scoredTracks.map(s => s.track)).slice(0, 8);

    // 5. Generate Natural Language Discovery Summary
    let summary = '';
    const activeProviderNames = Array.from(new Set(finalTracks.map(t => t.providerId.toUpperCase())));

    if (finalTracks.length > 0) {
      const playableCount = finalTracks.filter(t => t.playbackCapability === 'full_stream' || t.playbackCapability === 'local_file').length;
      const previewCount = finalTracks.filter(t => t.playbackCapability === 'preview_stream').length;
      const externalCount = finalTracks.filter(t => t.playbackCapability === 'external_link' || t.playbackCapability === 'metadata_only').length;

      summary = `Found **${finalTracks.length} tracks** for your request across ${activeProviderNames.join(', ')}.`;
      if (playableCount > 0 && previewCount > 0) {
        summary += ` (${playableCount} full stream${playableCount === 1 ? '' : 's'}, ${previewCount} preview${previewCount === 1 ? '' : 's'})`;
      } else if (playableCount > 0) {
        summary += ` (All full playable streams)`;
      } else if (previewCount > 0 && externalCount > 0) {
        summary += ` (${previewCount} preview${previewCount === 1 ? '' : 's'}, ${externalCount} official platform link${externalCount === 1 ? '' : 's'})`;
      }
    } else {
      summary = `I couldn't find tracks matching your specific criteria across your enabled providers. Try broadening your mood, genre, or release year filters.`;
    }

    return {
      intent,
      tracks: finalTracks,
      totalFound: finalTracks.length,
      providersQueried,
      summary,
      appliedFilters,
    };
  }
}

export const musicDiscoveryEngine = new MusicDiscoveryEngine();
