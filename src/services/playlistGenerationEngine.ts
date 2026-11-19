import {
  GeneratedPlaylistPreview,
  PlaylistComposition,
  PlaylistIntent,
  PlaylistPreferences,
} from '../types/playlistAssistant';
import {
  UnifiedTrack,
  trackMetadataToUnifiedTrack,
  unifiedTrackToTrackMetadata,
} from '../types/universalMusic';
import { HarmoniqAssistantContext } from '../types/assistant';
import { DiscoveryMood } from '../types/discovery';
import { libraryService } from './libraryService';
import { favoritesService } from './favoritesService';
import { musicDiscoveryEngine } from './musicDiscoveryEngine';
import { playlistFolderService } from './playlistFolderService';
import { playlistIntentService } from './playlistIntentService';

export class PlaylistGenerationEngine {
  /**
   * Generates a preview playlist based on the user's conversational intent.
   * Does NOT save to the user's library until explicit confirmation is received.
   */
  public async generatePlaylist(
    intent: PlaylistIntent,
    context?: HarmoniqAssistantContext | null
  ): Promise<GeneratedPlaylistPreview> {
    const targetCount = intent.preferences.targetCount || 15;
    let candidateTracks: UnifiedTrack[] = [];
    let excludedExternalCount = 0;
    let sourceDescription = '';

    // 1. Gather Candidate Tracks based on Source Type
    switch (intent.sourceType) {
      case 'favorites': {
        const favs = favoritesService.getFavorites();
        candidateTracks = favs.map((t) => trackMetadataToUnifiedTrack(t));
        sourceDescription = 'Created from your Favorite Tracks';

        // If favorites have fewer tracks than target, supplement with discovery
        if (candidateTracks.length < targetCount) {
          const sampleArtist = candidateTracks[0]?.artist || 'chill music';
          const supplementResult = await musicDiscoveryEngine.discoverMusic(
            {
              action: 'discover',
              confidence: 'high',
              filters: {
                query: sampleArtist,
                genres: intent.preferences.genres,
              },
              rawQuery: intent.rawQuery,
            },
            context
          );
          for (const st of supplementResult.tracks) {
            if (st.playbackCapability === 'external_link' || st.playbackCapability === 'metadata_only') {
              excludedExternalCount++;
            } else {
              candidateTracks.push(st);
            }
          }
          sourceDescription += ' & Recommended Tracks';
        }
        break;
      }

      case 'current_track': {
        if (context?.currentTrack) {
          const current = context.currentTrack;
          sourceDescription = `Inspired by "${current.title}" by ${current.artist}`;

          // Search local library first
          const localTracks = libraryService.getAllTracks();
          const matchingLocal = localTracks
            .filter(
              (t) =>
                (current.genre && t.genre && t.genre.toLowerCase() === current.genre.toLowerCase()) ||
                (current.artist && t.artist && t.artist.toLowerCase() === current.artist.toLowerCase())
            )
            .map((t) => trackMetadataToUnifiedTrack(t));

          candidateTracks.push(...matchingLocal);

          // Supplement with discovery
          const discoveryResult = await musicDiscoveryEngine.discoverMusic(
            {
              action: 'discover_similar',
              confidence: 'high',
              reference: {
                type: 'current_track',
                title: current.title,
                artist: current.artist,
              },
              filters: {
                genres: intent.preferences.genres,
              },
              rawQuery: intent.rawQuery,
            },
            context
          );

          for (const dt of discoveryResult.tracks) {
            if (dt.playbackCapability === 'external_link' || dt.playbackCapability === 'metadata_only') {
              excludedExternalCount++;
            } else {
              candidateTracks.push(dt);
            }
          }
        } else {
          sourceDescription = 'Generated from Music Discovery';
        }
        break;
      }

      case 'existing_playlist': {
        const allPlaylists = libraryService.getPlaylists();
        const refName = (intent.referencePlaylistName || '').toLowerCase();
        const existingPl = allPlaylists.find(
          (p) => p.name.toLowerCase().includes(refName) || refName.includes(p.name.toLowerCase())
        );

        if (existingPl && existingPl.trackIds.length > 0) {
          sourceDescription = `Similar to playlist "${existingPl.name}"`;
          const allLocal = libraryService.getAllTracks();
          const plTracks = allLocal
            .filter((t) => existingPl.trackIds.includes(t.id))
            .map((t) => trackMetadataToUnifiedTrack(t));
          candidateTracks.push(...plTracks);
        } else {
          sourceDescription = 'Discovery Playlist';
        }

        // Add discovery tracks
        const discoveryResult = await musicDiscoveryEngine.discoverMusic(
          {
            action: 'discover',
            confidence: 'high',
            filters: {
              query: intent.referencePlaylistName || intent.rawQuery,
              genres: intent.preferences.genres,
              moods: this.mapMoods(intent.preferences.moods),
            },
            rawQuery: intent.rawQuery,
          },
          context
        );
        for (const dt of discoveryResult.tracks) {
          if (dt.playbackCapability === 'external_link' || dt.playbackCapability === 'metadata_only') {
            excludedExternalCount++;
          } else {
            candidateTracks.push(dt);
          }
        }
        break;
      }

      case 'local_library': {
        const allLocal = libraryService.getAllTracks();
        candidateTracks = allLocal.map((t) => trackMetadataToUnifiedTrack(t));
        sourceDescription = 'Selected from your Local Audio Library';
        break;
      }

      case 'universal_discovery':
      default: {
        // 1. Check local library for relevant matches
        const allLocal = libraryService.getAllTracks();
        const relevantLocal = this.filterTracksByPreferences(
          allLocal.map((t) => trackMetadataToUnifiedTrack(t)),
          intent.preferences
        );
        candidateTracks.push(...relevantLocal);

        // 2. Query Universal Music via MusicDiscoveryEngine
        const queryTerms: string[] = [];
        if (intent.preferences.activities && intent.preferences.activities.length > 0) {
          queryTerms.push(...intent.preferences.activities);
        }
        if (intent.preferences.moods && intent.preferences.moods.length > 0) {
          queryTerms.push(...intent.preferences.moods);
        }
        if (intent.preferences.genres && intent.preferences.genres.length > 0) {
          queryTerms.push(...intent.preferences.genres);
        }

        const queryStr = queryTerms.length > 0 ? queryTerms.join(' ') : intent.rawQuery;
        const discoveryResult = await musicDiscoveryEngine.discoverMusic(
          {
            action: 'discover',
            confidence: 'high',
            filters: {
              query: queryStr,
              genres: intent.preferences.genres,
              moods: this.mapMoods(intent.preferences.moods),
              isAcoustic: intent.preferences.isAcoustic,
              isInstrumental: intent.preferences.isInstrumental,
            },
            rawQuery: intent.rawQuery,
          },
          context
        );

        for (const dt of discoveryResult.tracks) {
          if (dt.playbackCapability === 'external_link' || dt.playbackCapability === 'metadata_only') {
            excludedExternalCount++;
          } else {
            candidateTracks.push(dt);
          }
        }

        sourceDescription = 'Curated from Universal Music & Local Files';
        break;
      }
    }

    // 2. Filter & Prioritize by Preferences
    let filtered = this.filterTracksByPreferences(candidateTracks, intent.preferences);

    // 3. Deduplicate
    filtered = this.deduplicateTracks(filtered);

    // 4. Limit to Target Count
    const selectedTracks = filtered.slice(0, targetCount);

    // 5. Calculate Composition & Duration
    let localCount = 0;
    let onlineFullCount = 0;
    let previewCount = 0;
    let totalDuration = 0;

    for (const t of selectedTracks) {
      totalDuration += t.duration || 0;
      if (t.playbackCapability === 'local_file' || t.providerId === 'local') {
        localCount++;
      } else if (t.playbackCapability === 'full_stream') {
        onlineFullCount++;
      } else if (t.playbackCapability === 'preview_stream') {
        previewCount++;
      }
    }

    const composition: PlaylistComposition = {
      localCount,
      onlineFullCount,
      previewCount,
      excludedExternalCount,
    };

    // 6. Build Title and Description
    const playlistName = intent.name || this.generatePlaylistName(intent.preferences, intent.sourceType);
    const description = this.generatePlaylistDescription(
      selectedTracks.length,
      intent.preferences,
      composition
    );

    const preview: GeneratedPlaylistPreview = {
      id: `preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: playlistName,
      description,
      tracks: selectedTracks,
      totalDuration,
      composition,
      sourceDescription,
      isSaved: false,
    };

    // Store in intent service active preview
    playlistIntentService.setActivePreview(preview);

    return preview;
  }

  /**
   * Refines or modifies the active preview playlist based on a conversational edit or refinement intent.
   */
  public async refinePlaylist(
    preview: GeneratedPlaylistPreview,
    intent: PlaylistIntent,
    context?: HarmoniqAssistantContext | null
  ): Promise<GeneratedPlaylistPreview> {
    // 1. Direct Edits (Rename, Remove, Add, Replace, Undo)
    if (intent.editOperation) {
      switch (intent.editOperation.type) {
        case 'undo': {
          playlistIntentService.undo();
          const current = playlistIntentService.getActivePreview();
          return current || preview;
        }

        case 'rename': {
          if (intent.editOperation.newName) {
            playlistIntentService.renameActivePreview(intent.editOperation.newName);
          }
          return playlistIntentService.getActivePreview() || preview;
        }

        case 'remove_tracks': {
          if (intent.editOperation.targetIndex !== undefined) {
            const trackToRemove = preview.tracks[intent.editOperation.targetIndex];
            if (trackToRemove) {
              playlistIntentService.removeTrackFromActivePreview(trackToRemove.id);
            }
          }
          return playlistIntentService.getActivePreview() || preview;
        }

        case 'add_tracks': {
          const countToAdd = intent.editOperation.countToAdd || 5;
          const query = intent.preferences.genres?.join(' ') || preview.name;

          const moreResult = await musicDiscoveryEngine.discoverMusic(
            {
              action: 'discover',
              confidence: 'high',
              filters: {
                query,
                genres: intent.preferences.genres,
                isAcoustic: intent.preferences.isAcoustic,
                isInstrumental: intent.preferences.isInstrumental,
              },
              rawQuery: intent.rawQuery,
            },
            context
          );

          const existingIds = new Set(preview.tracks.map((t) => t.id));
          const newToAdd: UnifiedTrack[] = [];

          for (const dt of moreResult.tracks) {
            if (
              !existingIds.has(dt.id) &&
              (dt.playbackCapability === 'full_stream' ||
                dt.playbackCapability === 'preview_stream' ||
                dt.playbackCapability === 'local_file')
            ) {
              newToAdd.push(dt);
              existingIds.add(dt.id);
              if (newToAdd.length >= countToAdd) break;
            }
          }

          const updatedTracks = [...preview.tracks, ...newToAdd];
          playlistIntentService.updatePreviewTracks(updatedTracks);
          return playlistIntentService.getActivePreview() || preview;
        }

        case 'replace_tracks': {
          const countToReplace = intent.editOperation.countToAdd || 5;
          const keptTracks = preview.tracks.slice(0, Math.max(1, preview.tracks.length - countToReplace));

          const query = intent.preferences.moods?.join(' ') || 'calm relaxing acoustic';
          const replaceResult = await musicDiscoveryEngine.discoverMusic(
            {
              action: 'discover',
              confidence: 'high',
              filters: {
                query,
                moods: this.mapMoods(intent.preferences.moods),
                genres: intent.preferences.genres,
                isAcoustic: intent.preferences.isAcoustic,
                isInstrumental: intent.preferences.isInstrumental,
              },
              rawQuery: intent.rawQuery,
            },
            context
          );

          const existingIds = new Set(keptTracks.map((t) => t.id));
          const replacements: UnifiedTrack[] = [];

          for (const dt of replaceResult.tracks) {
            if (
              !existingIds.has(dt.id) &&
              (dt.playbackCapability === 'full_stream' ||
                dt.playbackCapability === 'preview_stream' ||
                dt.playbackCapability === 'local_file')
            ) {
              replacements.push(dt);
              existingIds.add(dt.id);
              if (replacements.length >= countToReplace) break;
            }
          }

          const updatedTracks = [...keptTracks, ...replacements];
          playlistIntentService.updatePreviewTracks(updatedTracks);
          return playlistIntentService.getActivePreview() || preview;
        }
      }
    }

    // 2. Attribute Refinements ("more acoustic", "remove energetic", "instrumental only")
    if (intent.action === 'refine') {
      let filteredTracks = [...preview.tracks];

      if (intent.preferences.isAcoustic) {
        // Prioritize or filter acoustic
        const acoustic = filteredTracks.filter(
          (t) =>
            t.genre?.toLowerCase().includes('acoustic') ||
            t.title.toLowerCase().includes('acoustic') ||
            t.album?.toLowerCase().includes('acoustic')
        );
        if (acoustic.length >= 3) {
          filteredTracks = acoustic;
        } else {
          // Fetch more acoustic tracks
          const acousticResult = await musicDiscoveryEngine.discoverMusic(
            {
              action: 'discover',
              confidence: 'high',
              filters: { query: 'acoustic guitar indie', isAcoustic: true },
              rawQuery: intent.rawQuery,
            },
            context
          );
          const valid = acousticResult.tracks.filter(
            (t) =>
              t.playbackCapability === 'full_stream' ||
              t.playbackCapability === 'preview_stream' ||
              t.playbackCapability === 'local_file'
          );
          filteredTracks = [...acoustic, ...valid].slice(0, preview.tracks.length);
        }
      }

      if (intent.preferences.isInstrumental) {
        filteredTracks = filteredTracks.filter(
          (t) =>
            !t.title.toLowerCase().includes('feat.') &&
            !t.title.toLowerCase().includes('vocal')
        );
      }

      if (intent.preferences.energy === 'low') {
        // Remove high energy / energetic tracks
        filteredTracks = filteredTracks.filter(
          (t) =>
            !t.title.toLowerCase().includes('remix') &&
            !t.genre?.toLowerCase().includes('metal') &&
            !t.genre?.toLowerCase().includes('punk') &&
            !t.genre?.toLowerCase().includes('edm')
        );
      }

      playlistIntentService.updatePreviewTracks(filteredTracks);
      return playlistIntentService.getActivePreview() || preview;
    }

    return preview;
  }

  /**
   * Saves the generated preview to Harmoniq's library.
   * Registers any online tracks with libraryService, creates the playlist, and records folder history.
   */
  public async savePlaylistPreview(
    preview: GeneratedPlaylistPreview
  ): Promise<{
    success: boolean;
    playlistId?: string;
    playlistName: string;
    trackCount: number;
    error?: string;
  }> {
    if (!preview || preview.tracks.length === 0) {
      return {
        success: false,
        playlistName: preview?.name || 'Playlist',
        trackCount: 0,
        error: 'Cannot save an empty playlist preview.',
      };
    }

    try {
      // 1. Ensure online tracks are registered with libraryService
      const trackMetadatas = preview.tracks.map((t) => unifiedTrackToTrackMetadata(t));
      libraryService.addTracks(trackMetadatas);

      // 2. Create the playlist in library
      const created = libraryService.createPlaylist(
        preview.name.trim() || 'Harmoniq Curated Playlist',
        preview.description || preview.sourceDescription
      );

      // 3. Add tracks to the created playlist
      const trackIds = preview.tracks.map((t) => t.id);
      libraryService.addTracksToPlaylist(created.id, trackIds);

      // 4. Record history entry
      playlistFolderService.recordHistory(
        created.id,
        'created',
        `Generated via Conversational Assistant (${trackIds.length} tracks)`,
        trackIds
      );

      // 5. Update preview status
      preview.isSaved = true;
      preview.savedPlaylistId = created.id;

      return {
        success: true,
        playlistId: created.id,
        playlistName: created.name,
        trackCount: trackIds.length,
      };
    } catch (err: any) {
      return {
        success: false,
        playlistName: preview.name,
        trackCount: preview.tracks.length,
        error: err?.message || 'Failed to save playlist to library.',
      };
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  private mapMoods(moods?: string[]): DiscoveryMood[] | undefined {
    if (!moods) return undefined;
    const valid: DiscoveryMood[] = [
      'relaxing',
      'happy',
      'sad',
      'energetic',
      'peaceful',
      'romantic',
      'motivational',
      'melancholic',
      'atmospheric',
      'chill',
    ];
    return moods.filter((m): m is DiscoveryMood => valid.includes(m as DiscoveryMood));
  }

  private filterTracksByPreferences(
    tracks: UnifiedTrack[],
    preferences: PlaylistPreferences
  ): UnifiedTrack[] {
    return tracks.filter((t) => {
      // Exclude external links and catalog metadata
      if (t.playbackCapability === 'external_link' || t.playbackCapability === 'metadata_only') {
        return false;
      }

      // Acoustic filter
      if (preferences.isAcoustic) {
        const text = `${t.title} ${t.genre || ''} ${t.album || ''}`.toLowerCase();
        if (text.includes('acoustic') || text.includes('unplugged')) {
          return true;
        }
      }

      // Instrumental filter
      if (preferences.isInstrumental) {
        const text = `${t.title} ${t.genre || ''}`.toLowerCase();
        if (
          text.includes('instrumental') ||
          text.includes('ambient') ||
          text.includes('lo-fi') ||
          text.includes('soundtrack') ||
          text.includes('score')
        ) {
          return true;
        }
      }

      // Low energy filter
      if (preferences.energy === 'low') {
        const text = `${t.title} ${t.genre || ''}`.toLowerCase();
        if (
          text.includes('workout') ||
          text.includes('club') ||
          text.includes('remix') ||
          text.includes('metal')
        ) {
          return false;
        }
      }

      return true;
    });
  }

  private deduplicateTracks(tracks: UnifiedTrack[]): UnifiedTrack[] {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const result: UnifiedTrack[] = [];

    for (const t of tracks) {
      if (!t.id || seenIds.has(t.id)) continue;

      const normName = `${t.title.trim().toLowerCase()}:::${t.artist.trim().toLowerCase()}`;
      if (seenNames.has(normName)) continue;

      seenIds.add(t.id);
      seenNames.add(normName);
      result.push(t);
    }

    return result;
  }

  private generatePlaylistName(
    prefs: PlaylistPreferences,
    sourceType?: string
  ): string {
    if (prefs.activities && prefs.activities.length > 0) {
      const act = prefs.activities[0];
      return act === 'coding'
        ? 'Late-Night Coding'
        : act === 'studying'
        ? 'Deep Study Session'
        : act === 'road trip'
        ? 'Highway Horizon Road Trip'
        : `${act.charAt(0).toUpperCase() + act.slice(1)} Mix`;
    }

    if (prefs.moods && prefs.moods.length > 0) {
      const m = prefs.moods[0];
      return m === 'relaxing'
        ? 'Evening Relaxation'
        : m === 'chill'
        ? 'Chillout Vibes'
        : m === 'energetic'
        ? 'High Energy Drive'
        : `${m.charAt(0).toUpperCase() + m.slice(1)} Flow`;
    }

    if (prefs.genres && prefs.genres.length > 0) {
      return `${prefs.genres[0].charAt(0).toUpperCase() + prefs.genres[0].slice(1)} Essentials`;
    }

    if (sourceType === 'favorites') {
      return 'Favorites Blend';
    }

    return 'Harmoniq Curated Discovery';
  }

  private generatePlaylistDescription(
    trackCount: number,
    prefs: PlaylistPreferences,
    comp: PlaylistComposition
  ): string {
    const parts: string[] = [`${trackCount} tracks curated for your listening experience.`];

    if (prefs.isAcoustic) parts.push('Acoustic & Unplugged focus.');
    if (prefs.isInstrumental) parts.push('Instrumental selections.');
    if (prefs.energy === 'low') parts.push('Calm and relaxing atmosphere.');

    const compParts: string[] = [];
    if (comp.localCount > 0) compParts.push(`${comp.localCount} local`);
    if (comp.onlineFullCount > 0) compParts.push(`${comp.onlineFullCount} full stream`);
    if (comp.previewCount > 0) compParts.push(`${comp.previewCount} preview (30s)`);

    if (compParts.length > 0) {
      parts.push(`Composition: ${compParts.join(', ')}.`);
    }

    if (comp.excludedExternalCount > 0) {
      parts.push(
        `Note: ${comp.excludedExternalCount} external catalog links (Spotify/YouTube) were excluded from playback.`
      );
    }

    return parts.join(' ');
  }
}

export const playlistGenerationEngine = new PlaylistGenerationEngine();
