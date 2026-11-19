import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playlistIntentService } from '../services/playlistIntentService';
import { playlistGenerationEngine } from '../services/playlistGenerationEngine';
import { assistantService } from '../services/assistantService';
import { libraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';
import { musicDiscoveryEngine } from '../services/musicDiscoveryEngine';
import { playlistFolderService } from '../services/playlistFolderService';
import { UnifiedTrack } from '../types/universalMusic';
import { TrackMetadata } from '../types/audio';
import { GeneratedPlaylistPreview } from '../types/playlistAssistant';
import { HarmoniqAssistantContext } from '../types/assistant';

describe('Harmoniq 2.0 - Phase 5A.3: Conversational Playlist Assistant & Intelligent Generation', () => {
  const mockContext: HarmoniqAssistantContext = {
    playback: {
      isPlaying: true,
      isPaused: false,
      currentTime: 60,
      duration: 240,
    },
    currentTrack: {
      id: 'local_track_1',
      title: 'Midnight Coding Flow',
      artist: 'Synthwave Pilot',
      album: 'Neon Grid',
      genre: 'electronic',
      year: 2023,
      source: 'local',
      duration: 240,
    },
    audio: {
      codec: 'FLAC',
      sampleRate: 48000,
      bitDepth: 24,
      isLossless: true,
      isBitPerfect: true,
    },
    queue: {
      totalTracks: 3,
      currentIndex: 0,
    },
    contextTimestamp: Date.now(),
  };

  const sampleLocalTrack: TrackMetadata = {
    id: 'local_fav_1',
    filePath: 'C:/Music/Acoustic_Sun.mp3',
    fileName: 'Acoustic Sun.mp3',
    fileSize: 5000000,
    duration: 180,
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    title: 'Acoustic Sun',
    artist: 'Sunny Folk',
    album: 'Sunlight Acoustic',
    year: 2022,
    genre: 'acoustic',
    codec: 'MP3',
    container: 'MP3',
    isLossless: false,
    playCount: 5,
    hasArtwork: false,
    dateModified: Date.now(),
    dateAdded: Date.now(),
    isFavorite: true,
  };

  const sampleJamendoTrack: UnifiedTrack = {
    id: 'jamendo:501',
    providerId: 'jamendo',
    providerTrackId: '501',
    title: 'Deep Focus Ambient',
    artist: 'Ambient Soundscapes',
    album: 'Flow State',
    duration: 220,
    playbackCapability: 'full_stream',
    streamUrl: 'https://mp3d.jamendo.com/?trackid=501',
    format: 'MP3',
    bitrate: 320,
    isOnline: true,
    genre: 'ambient',
  };

  const sampleApplePreviewTrack: UnifiedTrack = {
    id: 'apple:602',
    providerId: 'apple',
    providerTrackId: '602',
    title: 'Late Night Chill Lo-Fi',
    artist: 'Study Master',
    album: 'Lo-Fi Chill Sessions',
    duration: 30,
    playbackCapability: 'preview_stream',
    streamUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    format: 'AAC',
    bitrate: 256,
    isOnline: true,
    genre: 'lo-fi',
  };

  const sampleSpotifyExcludedTrack: UnifiedTrack = {
    id: 'spotify:703',
    providerId: 'spotify',
    providerTrackId: '703',
    title: 'Popular Chart Banger',
    artist: 'Pop Star',
    album: 'Radio Hits 2024',
    duration: 195,
    playbackCapability: 'external_link',
    providerWebUrl: 'https://open.spotify.com/track/703',
    isOnline: true,
    genre: 'pop',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    playlistIntentService.clearSession();
  });

  // =========================================================================
  // 1. Intent Detection & Natural Language Parsing
  // =========================================================================
  describe('Part 1: Playlist Intent Classification & Parsing', () => {
    it('detects playlist generation requests from natural conversational text', () => {
      expect(playlistIntentService.isPlaylistIntent('Create a playlist for late-night coding')).toBe(true);
      expect(playlistIntentService.isPlaylistIntent('Make me a playlist with 30 relaxing songs')).toBe(true);
      expect(playlistIntentService.isPlaylistIntent('Create a playlist similar to my current playlist')).toBe(true);
      expect(playlistIntentService.isPlaylistIntent('Build a playlist using my favorite tracks')).toBe(true);
      expect(playlistIntentService.isPlaylistIntent('Create a playlist with acoustic and indie music')).toBe(true);
      expect(playlistIntentService.isPlaylistIntent('Make a playlist for a long road trip')).toBe(true);

      // Non-playlist queries
      expect(playlistIntentService.isPlaylistIntent('How do I enable bit-perfect mode?')).toBe(false);
      expect(playlistIntentService.isPlaylistIntent('What audio device am I using?')).toBe(false);
    });

    it('extracts target count, activity, and suggests an appropriate title', () => {
      const intent = playlistIntentService.parseIntent('Create a playlist for late-night coding');
      expect(intent.action).toBe('create');
      expect(intent.preferences.activities).toContain('coding');
      expect(intent.name).toBe('Late-Night Coding');
      expect(intent.preferences.targetCount).toBe(15);
    });

    it('extracts custom target track counts and moods', () => {
      const intent = playlistIntentService.parseIntent('Make me a playlist with 30 relaxing songs');
      expect(intent.action).toBe('create');
      expect(intent.preferences.targetCount).toBe(30);
      expect(intent.preferences.moods).toContain('relaxing');
      expect(intent.preferences.energy).toBe('low');
    });

    it('detects favorites as the source when requested by user', () => {
      const intent = playlistIntentService.parseIntent('Build a playlist using my favorite tracks');
      expect(intent.action).toBe('create');
      expect(intent.sourceType).toBe('favorites');
      expect(intent.name).toBe('Personal Favorites Blend');
    });

    it('detects acoustic and instrumental preferences', () => {
      const intent = playlistIntentService.parseIntent('Create a playlist with acoustic and indie music');
      expect(intent.action).toBe('create');
      expect(intent.preferences.isAcoustic).toBe(true);
      expect(intent.preferences.genres).toContain('acoustic');
      expect(intent.preferences.genres).toContain('indie');
    });

    it('identifies save confirmation intents with optional custom names', () => {
      const save1 = playlistIntentService.parseIntent('save');
      expect(save1.action).toBe('save');

      const save2 = playlistIntentService.parseIntent('save this as Deep Focus');
      expect(save2.action).toBe('save');
      expect(save2.name).toBe('Deep Focus');

      const save3 = playlistIntentService.parseIntent('save playlist as "Morning Energy"');
      expect(save3.action).toBe('save');
      expect(save3.name).toBe('Morning Energy');
    });

    it('identifies discard, cancellation, and undo requests', () => {
      const cancel1 = playlistIntentService.parseIntent('cancel');
      expect(cancel1.action).toBe('cancel');

      const cancel2 = playlistIntentService.parseIntent('discard playlist');
      expect(cancel2.action).toBe('cancel');

      const undo = playlistIntentService.parseIntent('undo');
      expect(undo.action).toBe('edit');
      expect(undo.editOperation?.type).toBe('undo');
    });
  });

  // =========================================================================
  // 2. Preview Generation, Multi-Source Assembly & Capability Filtering
  // =========================================================================
  describe('Part 2: Intelligent Playlist Generation & Capability Filtering', () => {
    it('generates a preview without saving to the library', async () => {
      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [sampleJamendoTrack, sampleApplePreviewTrack],
        totalFound: 2,
        providersQueried: ['jamendo', 'apple'],
        summary: 'Found 2 tracks',
        appliedFilters: [],
      });

      const intent = playlistIntentService.parseIntent('Create a playlist for late-night coding');
      const preview = await playlistGenerationEngine.generatePlaylist(intent, mockContext);

      expect(preview).toBeDefined();
      expect(preview.isSaved).toBe(false);
      expect(preview.savedPlaylistId).toBeUndefined();
      expect(preview.name).toBe('Late-Night Coding');
      expect(preview.tracks.length).toBeGreaterThan(0);
      expect(playlistIntentService.getActivePreview()).toEqual(preview);
    });

    it('excludes external links (Spotify/YouTube) from playable tracks and records excluded count', async () => {
      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [sampleJamendoTrack, sampleSpotifyExcludedTrack, sampleApplePreviewTrack],
        totalFound: 3,
        providersQueried: ['jamendo', 'spotify', 'apple'],
        summary: 'Found 3 tracks',
        appliedFilters: [],
      });

      const intent = playlistIntentService.parseIntent('Create a playlist for studying');
      const preview = await playlistGenerationEngine.generatePlaylist(intent, mockContext);

      // Spotify external link must NOT be in preview.tracks
      const hasSpotify = preview.tracks.some((t) => t.id === sampleSpotifyExcludedTrack.id);
      expect(hasSpotify).toBe(false);

      // Excluded count must reflect the omitted external item
      expect(preview.composition.excludedExternalCount).toBeGreaterThanOrEqual(1);

      // Composition must correctly categorize full stream and preview tracks
      expect(preview.composition.onlineFullCount).toBeGreaterThanOrEqual(1);
      expect(preview.composition.previewCount).toBeGreaterThanOrEqual(1);
    });

    it('sources tracks from favorites when requested', async () => {
      vi.spyOn(favoritesService, 'getFavorites').mockReturnValue([sampleLocalTrack]);
      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [sampleJamendoTrack],
        totalFound: 1,
        providersQueried: ['jamendo'],
        summary: '',
        appliedFilters: [],
      });

      const intent = playlistIntentService.parseIntent('Build a playlist using my favorite tracks');
      const preview = await playlistGenerationEngine.generatePlaylist(intent, mockContext);

      expect(preview.sourceDescription).toContain('Favorite Tracks');
      expect(preview.composition.localCount).toBeGreaterThanOrEqual(1);
      expect(preview.tracks.some((t) => t.id === sampleLocalTrack.id)).toBe(true);
    });

    it('generates playlist inspired by currently playing track context', async () => {
      vi.spyOn(libraryService, 'getAllTracks').mockReturnValue([sampleLocalTrack]);
      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover_similar', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [sampleJamendoTrack],
        totalFound: 1,
        providersQueried: ['jamendo'],
        summary: '',
        appliedFilters: [],
      });

      const intent = playlistIntentService.parseIntent('Create a playlist similar to my current track');
      const preview = await playlistGenerationEngine.generatePlaylist(intent, mockContext);

      expect(preview.sourceDescription).toContain(mockContext.currentTrack!.title);
      expect(preview.tracks.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. Conversational Refinement & Stack Management (Undo)
  // =========================================================================
  describe('Part 3: Conversational Refinements & Stack', () => {
    beforeEach(() => {
      // Set active preview with 2 tracks
      playlistIntentService.setActivePreview({
        id: 'prev_1',
        name: 'Coding Flow',
        description: 'Focus music',
        tracks: [sampleJamendoTrack, sampleApplePreviewTrack],
        totalDuration: 250,
        composition: { localCount: 0, onlineFullCount: 1, previewCount: 1, excludedExternalCount: 0 },
        sourceDescription: 'Discovery',
        isSaved: false,
      });
    });

    it('renames active preview via natural language command', async () => {
      const intent = playlistIntentService.parseIntent('rename this to Deep Focus');
      expect(intent.action).toBe('edit');
      expect(intent.editOperation?.type).toBe('rename');
      expect(intent.editOperation?.newName).toBe('Deep Focus');

      const active = playlistIntentService.getActivePreview()!;
      const updated = await playlistGenerationEngine.refinePlaylist(active, intent);

      expect(updated.name).toBe('Deep Focus');
      expect(playlistIntentService.getActivePreview()?.name).toBe('Deep Focus');
    });

    it('removes track by index and recalculates duration and composition', async () => {
      const intent = playlistIntentService.parseIntent('remove song 1');
      expect(intent.action).toBe('edit');
      expect(intent.editOperation?.type).toBe('remove_tracks');
      expect(intent.editOperation?.targetIndex).toBe(0);

      const active = playlistIntentService.getActivePreview()!;
      const updated = await playlistGenerationEngine.refinePlaylist(active, intent);

      expect(updated.tracks.length).toBe(1);
      expect(updated.tracks[0].id).toBe(sampleApplePreviewTrack.id);
      expect(updated.composition.onlineFullCount).toBe(0);
      expect(updated.composition.previewCount).toBe(1);
    });

    it('adds more tracks when requested', async () => {
      const newTrack: UnifiedTrack = {
        id: 'jamendo:999',
        providerId: 'jamendo',
        providerTrackId: '999',
        title: 'New Flow Beats',
        artist: 'Flow Master',
        duration: 200,
        playbackCapability: 'full_stream',
        streamUrl: 'https://stream.jamendo.com/999',
        isOnline: true,
      };

      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [newTrack],
        totalFound: 1,
        providersQueried: ['jamendo'],
        summary: '',
        appliedFilters: [],
      });

      const intent = playlistIntentService.parseIntent('add 5 more songs');
      expect(intent.action).toBe('edit');
      expect(intent.editOperation?.type).toBe('add_tracks');
      expect(intent.editOperation?.countToAdd).toBe(5);

      const active = playlistIntentService.getActivePreview()!;
      const updated = await playlistGenerationEngine.refinePlaylist(active, intent);

      expect(updated.tracks.length).toBe(3);
      expect(updated.tracks.some((t) => t.id === 'jamendo:999')).toBe(true);
    });

    it('supports undo operation to restore prior state', async () => {
      const active = playlistIntentService.getActivePreview()!;
      const originalTrackCount = active.tracks.length;

      // Remove a track
      const removeIntent = playlistIntentService.parseIntent('remove song 1');
      const afterRemove = await playlistGenerationEngine.refinePlaylist(active, removeIntent);
      expect(afterRemove.tracks.length).toBe(originalTrackCount - 1);

      // Undo
      const undoIntent = playlistIntentService.parseIntent('undo');
      expect(undoIntent.action).toBe('edit');
      expect(undoIntent.editOperation?.type).toBe('undo');

      const afterUndo = await playlistGenerationEngine.refinePlaylist(afterRemove, undoIntent);
      expect(afterUndo.tracks.length).toBe(originalTrackCount);
    });
  });

  // =========================================================================
  // 4. Persistence & Explicit Confirmation Saving
  // =========================================================================
  describe('Part 4: Persistence & Explicit Library Confirmation', () => {
    it('persists playlist to library only upon explicit save confirmation', async () => {
      const activePreview: GeneratedPlaylistPreview = {
        id: 'preview_123',
        name: 'Late-Night Coding',
        description: 'Focus mix',
        tracks: [sampleJamendoTrack, sampleApplePreviewTrack],
        totalDuration: 250,
        composition: { localCount: 0, onlineFullCount: 1, previewCount: 1, excludedExternalCount: 0 },
        sourceDescription: 'Curated',
        isSaved: false,
      };
      playlistIntentService.setActivePreview(activePreview);

      const addTracksSpy = vi.spyOn(libraryService, 'addTracks').mockImplementation(() => {});
      const createPlaylistSpy = vi.spyOn(libraryService, 'createPlaylist').mockReturnValue({
        id: 'pl_real_123',
        name: 'Late-Night Coding',
        description: 'Focus mix',
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
      });
      const addTracksToPlaylistSpy = vi.spyOn(libraryService, 'addTracksToPlaylist').mockReturnValue(true);
      const recordHistorySpy = vi.spyOn(playlistFolderService, 'recordHistory').mockReturnValue({} as any);

      const res = await playlistGenerationEngine.savePlaylistPreview(activePreview);

      expect(res.success).toBe(true);
      expect(res.playlistId).toBe('pl_real_123');
      expect(addTracksSpy).toHaveBeenCalled();
      expect(createPlaylistSpy).toHaveBeenCalledWith('Late-Night Coding', 'Focus mix');
      expect(addTracksToPlaylistSpy).toHaveBeenCalledWith('pl_real_123', [
        sampleJamendoTrack.id,
        sampleApplePreviewTrack.id,
      ]);
      expect(recordHistorySpy).toHaveBeenCalledWith(
        'pl_real_123',
        'created',
        expect.stringContaining('2 tracks'),
        expect.any(Array)
      );

      expect(activePreview.isSaved).toBe(true);
      expect(activePreview.savedPlaylistId).toBe('pl_real_123');
    });

    it('rejects saving an empty playlist preview', async () => {
      const emptyPreview = {
        id: 'preview_empty',
        name: 'Empty Playlist',
        description: 'No tracks',
        tracks: [],
        totalDuration: 0,
        composition: { localCount: 0, onlineFullCount: 0, previewCount: 0, excludedExternalCount: 0 },
        sourceDescription: '',
        isSaved: false,
      };

      const res = await playlistGenerationEngine.savePlaylistPreview(emptyPreview);
      expect(res.success).toBe(false);
      expect(res.error).toContain('empty');
    });
  });

  // =========================================================================
  // 5. AssistantService End-to-End Conversational Workflow
  // =========================================================================
  describe('Part 5: AssistantService Chat Interception & Workflow', () => {
    it('creates preview on playlist prompt, returns preview card metadata, and allows subsequent save', async () => {
      vi.spyOn(musicDiscoveryEngine, 'discoverMusic').mockResolvedValue({
        intent: { action: 'discover', confidence: 'high', filters: {}, rawQuery: '' },
        tracks: [sampleJamendoTrack, sampleApplePreviewTrack],
        totalFound: 2,
        providersQueried: ['jamendo', 'apple'],
        summary: 'Curated 2 tracks',
        appliedFilters: [],
      });

      vi.spyOn(libraryService, 'createPlaylist').mockImplementation((name: string, description?: string) => ({
        id: 'pl_chat_1',
        name,
        description,
        trackIds: [],
        dateCreated: Date.now(),
        dateModified: Date.now(),
      }));
      vi.spyOn(libraryService, 'addTracksToPlaylist').mockReturnValue(true);

      // 1. User asks to create a playlist
      const msg1 = await assistantService.sendMessage('Create a playlist for late-night coding');

      expect(msg1.playlistPreview).toBeDefined();
      expect(msg1.playlistPreview?.name).toBe('Late-Night Coding');
      expect(msg1.playlistPreview?.isSaved).toBe(false);
      expect(msg1.content).toContain('Playlist Preview: "Late-Night Coding"');

      // 2. User confirms save with a custom title
      const msg2 = await assistantService.sendMessage('save this as Deep Focus');

      expect(msg2.content).toContain('Playlist Saved!');
      expect(msg2.content).toContain('Deep Focus');
      expect(msg2.playlistPreview?.isSaved).toBe(true);
      expect(msg2.actions?.some((a) => a.target === 'playlists')).toBe(true);
    });

    it('handles cancellation of an active preview via chat prompt', async () => {
      playlistIntentService.setActivePreview({
        id: 'prev_test',
        name: 'Test',
        description: '',
        tracks: [sampleJamendoTrack],
        totalDuration: 200,
        composition: { localCount: 0, onlineFullCount: 1, previewCount: 0, excludedExternalCount: 0 },
        sourceDescription: '',
        isSaved: false,
      });

      const msg = await assistantService.sendMessage('cancel preview');
      expect(msg.content).toContain('discarded');
      expect(playlistIntentService.getActivePreview()).toBeNull();
    });
  });
});
