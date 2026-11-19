import { describe, it, expect, beforeEach, vi } from 'vitest';
import { discoveryIntentService } from '../services/discoveryIntentService';
import { musicDiscoveryEngine } from '../services/musicDiscoveryEngine';
import { assistantService } from '../services/assistantService';
import { universalMusicService } from '../services/universalMusicService';
import { UnifiedTrack } from '../types/universalMusic';
import { HarmoniqAssistantContext } from '../types/assistant';

describe('Harmoniq 2.0 - Phase 5A.2: Natural Language Music Discovery & Intelligent Search', () => {
  const mockContext: HarmoniqAssistantContext = {
    playback: {
      isPlaying: true,
      isPaused: false,
      currentTime: 45,
      duration: 354,
    },
    currentTrack: {
      id: 'local_flac_1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      genre: 'Classic Rock',
      year: 1975,
      source: 'local',
      duration: 354,
    },
    audio: {
      codec: 'FLAC',
      sampleRate: 96000,
      bitDepth: 24,
      isLossless: true,
      isBitPerfect: true,
    },
    queue: {
      totalTracks: 5,
      currentIndex: 0,
      nextTrack: {
        title: 'Somebody to Love',
        artist: 'Queen',
      },
    },
    contextTimestamp: Date.now(),
  };

  const mockJamendoTrack: UnifiedTrack = {
    id: 'jamendo:101',
    providerId: 'jamendo',
    providerTrackId: '101',
    title: 'Peaceful Acoustic Morning',
    artist: 'Sunny Valley',
    album: 'Acoustic Serenity',
    duration: 195,
    playbackCapability: 'full_stream',
    streamUrl: 'https://mp3d.jamendo.com/?trackid=101',
    format: 'MP3',
    bitrate: 320,
    isOnline: true,
    genre: 'acoustic',
    releaseYear: 2021,
  };

  const mockApplePreviewTrack: UnifiedTrack = {
    id: 'apple:202',
    providerId: 'apple',
    providerTrackId: '202',
    title: 'Study Lo-Fi Beats',
    artist: 'Chill Coder',
    album: 'Focus Flow Vol. 1',
    duration: 30,
    playbackCapability: 'preview_stream',
    streamUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    format: 'AAC',
    bitrate: 256,
    isOnline: true,
    genre: 'lo-fi',
    releaseYear: 2023,
  };

  const mockSpotifyLinkTrack: UnifiedTrack = {
    id: 'spotify:303',
    providerId: 'spotify',
    providerTrackId: '303',
    title: 'High Energy Rock Anthem',
    artist: 'Electric Pulse',
    album: 'Stadium Vibes',
    duration: 210,
    playbackCapability: 'external_link',
    providerWebUrl: 'https://open.spotify.com/track/303',
    isOnline: true,
    genre: 'rock',
    releaseYear: 2022,
    popularity: 82,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    discoveryIntentService.clearSession();
  });

  describe('Part 1: Natural Language Intent Parsing & Extraction', () => {
    it('detects discovery queries and distinguishes them from general chatter', () => {
      expect(discoveryIntentService.isDiscoveryQuery('Find relaxing instrumental music')).toBe(true);
      expect(discoveryIntentService.isDiscoveryQuery('Play something similar to my current song')).toBe(true);
      expect(discoveryIntentService.isDiscoveryQuery('Find energetic electronic music')).toBe(true);
      expect(discoveryIntentService.isDiscoveryQuery('I want something suitable for studying')).toBe(true);
      expect(discoveryIntentService.isDiscoveryQuery('Discover acoustic songs released after 2020')).toBe(true);

      // Non-discovery queries
      expect(discoveryIntentService.isDiscoveryQuery('What is bit-perfect mode?')).toBe(false);
      expect(discoveryIntentService.isDiscoveryQuery('How do I configure the equalizer?')).toBe(false);
    });

    it('extracts moods, activities, and genres from natural language requests', () => {
      const intent = discoveryIntentService.parseIntent('Find peaceful acoustic songs for studying');
      expect(intent.action).toBe('discover');
      expect(intent.confidence).toBe('high');
      expect(intent.filters.moods).toContain('peaceful');
      expect(intent.filters.activities).toContain('studying');
      expect(intent.filters.genres).toContain('acoustic');
      expect(intent.filters.isAcoustic).toBe(true);
    });

    it('extracts temporal constraints like "after 2020" and decades', () => {
      const intent = discoveryIntentService.parseIntent('Find acoustic rock songs released after 2020');
      expect(intent.filters.yearMin).toBe(2020);
      expect(intent.filters.genres).toContain('acoustic');
      expect(intent.filters.genres).toContain('rock');

      const eightiesIntent = discoveryIntentService.parseIntent('Discover 80s synthpop music');
      expect(eightiesIntent.filters.yearMin).toBe(1980);
      expect(eightiesIntent.filters.yearMax).toBe(1989);
    });

    it('extracts similarity intent referencing current track, artist, and album', () => {
      const trackIntent = discoveryIntentService.parseIntent('Play something similar to my current song');
      expect(trackIntent.action).toBe('discover_similar');
      expect(trackIntent.reference?.type).toBe('current_track');

      const artistIntent = discoveryIntentService.parseIntent('Show me more songs from this artist');
      expect(artistIntent.action).toBe('discover_similar');
      expect(artistIntent.reference?.type).toBe('current_artist');

      const namedIntent = discoveryIntentService.parseIntent('Find songs similar to Bohemian Rhapsody');
      expect(namedIntent.action).toBe('discover_similar');
      expect(namedIntent.reference?.type).toBe('track_title');
      expect(namedIntent.reference?.title?.toLowerCase()).toContain('bohemian rhapsody');
    });

    it('extracts instrumental and vocal preferences accurately', () => {
      const instIntent = discoveryIntentService.parseIntent('Find relaxing instrumental music without singing');
      expect(instIntent.filters.isInstrumental).toBe(true);
      expect(instIntent.filters.vocalPreference).toBe('instrumental');

      const femaleIntent = discoveryIntentService.parseIntent('Find indie pop with female vocals');
      expect(femaleIntent.filters.vocalPreference).toBe('female');
    });

    it('evaluates intent confidence levels properly', () => {
      const highIntent = discoveryIntentService.parseIntent('Find energetic rock songs for workout');
      expect(highIntent.confidence).toBe('high');

      const mediumIntent = discoveryIntentService.parseIntent('Find music');
      expect(mediumIntent.confidence).toBe('medium');

      const lowIntent = discoveryIntentService.parseIntent('ab');
      expect(lowIntent.confidence).toBe('low');
    });
  });

  describe('Part 2: Conversational Refinement & Session Tracking', () => {
    it('maintains active discovery session and refines filters on follow-up requests', () => {
      // First turn
      const initialIntent = discoveryIntentService.parseIntent('Find relaxing music');
      discoveryIntentService.setSession(initialIntent, [mockJamendoTrack]);

      expect(discoveryIntentService.getActiveSession()).toBeDefined();
      expect(discoveryIntentService.getActiveSession()?.filters.moods).toContain('relaxing');

      // Second turn: Refinement "More acoustic"
      const refinedIntent = discoveryIntentService.parseIntent('More acoustic');
      expect(refinedIntent.action).toBe('refine');
      expect(refinedIntent.filters.moods).toContain('relaxing');
      expect(refinedIntent.filters.isAcoustic).toBe(true);

      // Third turn: Refinement "Only instrumental"
      const refinedAgain = discoveryIntentService.parseIntent('Only instrumental');
      expect(refinedAgain.filters.isAcoustic).toBe(true);
      expect(refinedAgain.filters.isInstrumental).toBe(true);
      expect(refinedAgain.filters.moods).toContain('relaxing');
    });

    it('allows clearing the discovery session completely', () => {
      const intent = discoveryIntentService.parseIntent('Find electronic music');
      discoveryIntentService.setSession(intent, [mockJamendoTrack]);
      expect(discoveryIntentService.getActiveSession()).not.toBeNull();

      discoveryIntentService.clearSession();
      expect(discoveryIntentService.getActiveSession()).toBeNull();
      expect(discoveryIntentService.getLastResults().length).toBe(0);
    });
  });

  describe('Part 3: Universal Music Engine Discovery & Capability Classification', () => {
    it('uses Universal Music Engine to discover music and isolates provider errors', async () => {
      // Mock universalMusicService.searchUniversal
      const searchSpy = vi.spyOn(universalMusicService, 'searchUniversal').mockResolvedValue({
        query: 'acoustic studying',
        filter: 'all',
        results: [mockJamendoTrack, mockApplePreviewTrack, mockSpotifyLinkTrack],
        localResults: [],
        providerResponses: {
          jamendo: { providerId: 'jamendo', success: true, tracks: [mockJamendoTrack], durationMs: 40 },
          apple: { providerId: 'apple', success: true, tracks: [mockApplePreviewTrack], durationMs: 50 },
          spotify: { providerId: 'spotify', success: true, tracks: [mockSpotifyLinkTrack], durationMs: 45 },
          audius: { providerId: 'audius', success: false, tracks: [], errorMessage: 'Rate limited', durationMs: 10 },
        },
        totalResults: 3,
        cached: false,
        searchedAt: Date.now(),
      });

      const intent = discoveryIntentService.parseIntent('Find acoustic music for studying');
      const result = await musicDiscoveryEngine.discoverMusic(intent, mockContext);

      expect(searchSpy).toHaveBeenCalled();
      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Found **3 tracks**');
      expect(result.appliedFilters.some(f => f.includes('studying') || f.includes('Acoustic'))).toBe(true);

      // Verify capabilities are strictly preserved
      const jamendoRes = result.tracks.find(t => t.id === 'jamendo:101');
      expect(jamendoRes?.playbackCapability).toBe('full_stream');

      const appleRes = result.tracks.find(t => t.id === 'apple:202');
      expect(appleRes?.playbackCapability).toBe('preview_stream');

      const spotifyRes = result.tracks.find(t => t.id === 'spotify:303');
      expect(spotifyRes?.playbackCapability).toBe('external_link');
    });

    it('performs contextual similarity search using active track metadata', async () => {
      const searchSpy = vi.spyOn(universalMusicService, 'searchUniversal').mockResolvedValue({
        query: 'Queen Classic Rock',
        filter: 'all',
        results: [mockJamendoTrack],
        localResults: [],
        providerResponses: {},
        totalResults: 1,
        cached: false,
        searchedAt: Date.now(),
      });

      const intent = discoveryIntentService.parseIntent('Play something similar to my current song');
      const result = await musicDiscoveryEngine.discoverMusic(intent, mockContext);

      expect(searchSpy).toHaveBeenCalled();
      expect(result.appliedFilters.some(f => f.includes('Bohemian Rhapsody') && f.includes('Queen'))).toBe(true);
    });

    it('handles similarity requests gracefully when no track is active', async () => {
      const intent = discoveryIntentService.parseIntent('Play something similar to my current song');
      const result = await musicDiscoveryEngine.discoverMusic(intent, null);

      expect(result.tracks.length).toBe(0);
      expect(result.summary).toContain('No song is currently playing');
    });

    it('ranks playable full-length streams above external links', async () => {
      vi.spyOn(universalMusicService, 'searchUniversal').mockResolvedValue({
        query: 'rock',
        filter: 'all',
        results: [mockSpotifyLinkTrack, mockJamendoTrack],
        localResults: [],
        providerResponses: {},
        totalResults: 2,
        cached: false,
        searchedAt: Date.now(),
      });

      const intent = discoveryIntentService.parseIntent('Find rock music');
      const result = await musicDiscoveryEngine.discoverMusic(intent);

      // Jamendo is a full_stream, Spotify is external_link -> Jamendo must rank first
      expect(result.tracks[0].id).toBe('jamendo:101');
      expect(result.tracks[0].playbackCapability).toBe('full_stream');
    });
  });

  describe('Part 4: Smart Playback Actions & Natural Language Commands', () => {
    it('detects playback command queries accurately', () => {
      expect(discoveryIntentService.isPlaybackCommand('play the first song')).toBe(true);
      expect(discoveryIntentService.isPlaybackCommand('play track 1')).toBe(true);
      expect(discoveryIntentService.isPlaybackCommand('add the second song to queue')).toBe(true);
      expect(discoveryIntentService.isPlaybackCommand('play next track 3')).toBe(true);
      expect(discoveryIntentService.isPlaybackCommand('queue all these songs')).toBe(true);
      expect(discoveryIntentService.isPlaybackCommand('queue all')).toBe(true);

      expect(discoveryIntentService.isPlaybackCommand('what song is playing')).toBe(false);
    });

    it('executes "play the first song" command on valid playable results', async () => {
      discoveryIntentService.setSession(
        discoveryIntentService.parseIntent('Find acoustic music'),
        [mockJamendoTrack, mockApplePreviewTrack]
      );

      const handlerSpy = vi.fn().mockResolvedValue({ success: true, message: 'Playing track' });
      assistantService.registerPlaybackHandler(handlerSpy);

      const msg = await assistantService.sendMessage('play the first song');

      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'play_index', targetIndex: 0 }),
        mockJamendoTrack,
        expect.any(Array)
      );
      expect(msg.content).toContain('Now playing **"Peaceful Acoustic Morning"**');
    });

    it('rejects playing external links and explains that only official platform access is supported', async () => {
      discoveryIntentService.setSession(
        discoveryIntentService.parseIntent('Find rock hits'),
        [mockSpotifyLinkTrack]
      );

      const handlerSpy = vi.fn();
      assistantService.registerPlaybackHandler(handlerSpy);

      const msg = await assistantService.sendMessage('play the first result');

      // Handler must NOT be called to play an unplayable external link
      expect(handlerSpy).not.toHaveBeenCalled();
      expect(msg.content).toContain('external destination on SPOTIFY');
      expect(msg.content).toContain('cannot be played directly');
    });

    it('executes "queue all" command on playable tracks only', async () => {
      discoveryIntentService.setSession(
        discoveryIntentService.parseIntent('Find songs'),
        [mockJamendoTrack, mockApplePreviewTrack, mockSpotifyLinkTrack]
      );

      const handlerSpy = vi.fn().mockResolvedValue({ success: true, message: 'Queued all' });
      assistantService.registerPlaybackHandler(handlerSpy);

      const msg = await assistantService.sendMessage('queue all these songs');

      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'queue_all' }),
        undefined,
        expect.arrayContaining([mockJamendoTrack, mockApplePreviewTrack])
      );
      // Spotify track is an external link and must be excluded from direct queue
      const callArgs = handlerSpy.mock.calls[0][2];
      expect(callArgs.some((t: UnifiedTrack) => t.id === 'spotify:303')).toBe(false);
      expect(msg.content).toContain('Added **2 tracks** to your playback queue');
    });

    it('handles out-of-bounds result index requests gracefully', async () => {
      discoveryIntentService.setSession(
        discoveryIntentService.parseIntent('Find songs'),
        [mockJamendoTrack]
      );

      const msg = await assistantService.sendMessage('play track 5');
      expect(msg.content).toContain('Result #5 does not exist');
      expect(msg.content).toContain('1 discovery results displayed');
    });
  });

  describe('Part 5: Assistant Integration & Message Results Attachment', () => {
    it('attaches discoveryResults array and discoverySummary to assistant message', async () => {
      vi.spyOn(universalMusicService, 'searchUniversal').mockResolvedValue({
        query: 'studying lo-fi',
        filter: 'all',
        results: [mockJamendoTrack, mockApplePreviewTrack],
        localResults: [],
        providerResponses: {},
        totalResults: 2,
        cached: false,
        searchedAt: Date.now(),
      });

      const msg = await assistantService.sendMessage('Find peaceful instrumental music for studying');

      expect(msg.discoveryResults).toBeDefined();
      expect(msg.discoveryResults?.length).toBe(2);
      expect(msg.discoverySummary).toContain('Found **2 tracks**');
      expect(msg.content).toContain('Music Discovery');
    });
  });
});
