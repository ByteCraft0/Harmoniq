import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildAssistantContext,
  formatContextForPrompt,
  detectContextIntent,
  formatDurationSeconds,
} from '../services/assistantContextService';
import {
  generateLocalAnswer,
  getSuggestedQuestions,
} from '../services/assistantKnowledge';
import { assistantService } from '../services/assistantService';
import { TrackMetadata } from '../types/audio';
import { BitPerfectState, DSPSettings } from '../types/dsp';
import { HarmoniqAssistantContext } from '../types/assistant';

describe('Harmoniq 2.0 - Phase 5A.1: Context-Aware Music Assistant Engine', () => {
  const mockLocalFlacTrack: TrackMetadata = {
    id: 'local_flac_1',
    filePath: 'C:\\Users\\Audiophile\\Music\\HighRes\\Queen\\Bohemian_Rhapsody.flac',
    fileName: 'Bohemian_Rhapsody.flac',
    fileSize: 45000000,
    dateModified: 1700000000000,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    genre: 'Classic Rock',
    year: 1975,
    hasArtwork: true,
    codec: 'FLAC',
    container: 'flac',
    duration: 354,
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 2420,
    channels: 2,
    isLossless: true,
    playCount: 15,
    isFavorite: true,
  };

  const mockOnlineMp3Track: TrackMetadata = {
    id: 'online_jamendo_2',
    filePath: '',
    fileName: 'jamendo_track_5678.mp3',
    fileSize: 5200000,
    dateModified: 1700000000000,
    title: 'Starlight Dream',
    artist: 'Aurora Indie',
    album: 'Cosmic Journey',
    genre: 'Electronic',
    year: 2023,
    hasArtwork: true,
    codec: 'MP3',
    container: 'mp3',
    duration: 180,
    sampleRate: 44100,
    bitDepth: undefined, // Lossy MP3 has no verified bit depth
    bitrate: 320,
    channels: 2,
    isLossless: false,
    playCount: 2,
    isFavorite: false,
    isOnline: true,
    providerId: 'jamendo',
    playbackCapability: 'stream',
  };

  const mockActiveDsp: DSPSettings = {
    enabled: true,
    eqMode: 'graphic',
    bands: [3, 2, 1, 0, 0, 0, 1, 2, 3, 4],
    parametricFilters: [],
    preamp: -1.5,
    bassBoost: 3.0,
    treble: 1.5,
    channelMode: 'stereo',
    balance: 0,
    monoMix: false,
    limiterEnabled: true,
    activePresetId: 'rock_preset_1',
  };

  const mockBitPerfectActive: BitPerfectState = {
    enabled: true,
    active: true,
    status: 'active',
    sourceSampleRate: 96000,
    outputSampleRate: 96000,
    isLossless: true,
    disabledFeatures: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part 1: Context Collection, Normalization & Sanitization', () => {
    it('builds accurate context for local lossless tracks without leaking filesystem paths', () => {
      const queue = [mockLocalFlacTrack, mockOnlineMp3Track];
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 75.4,
        duration: 354,
        repeatMode: 'all',
        isShuffle: false,
        queue,
        bitPerfectStatus: mockBitPerfectActive,
        dspSettings: mockActiveDsp,
        activePresetName: 'Rock Legend',
      });

      // Playback
      expect(ctx.playback.isPlaying).toBe(true);
      expect(ctx.playback.isPaused).toBe(false);
      expect(ctx.playback.currentTime).toBe(75);
      expect(ctx.playback.duration).toBe(354);
      expect(ctx.playback.repeatMode).toBe('all');
      expect(ctx.playback.shuffleEnabled).toBe(false);

      // Track Metadata (CRITICAL: ZERO file path leakage)
      expect(ctx.currentTrack).toBeDefined();
      expect(ctx.currentTrack?.title).toBe('Bohemian Rhapsody');
      expect(ctx.currentTrack?.artist).toBe('Queen');
      expect(ctx.currentTrack?.album).toBe('A Night at the Opera');
      expect(ctx.currentTrack?.genre).toBe('Classic Rock');
      expect(ctx.currentTrack?.year).toBe(1975);
      expect(ctx.currentTrack?.source).toBe('local');

      // Verify no path fields exist in currentTrack
      const serialized = JSON.stringify(ctx);
      expect(serialized).not.toContain('C:\\');
      expect(serialized).not.toContain('Audiophile');
      expect(serialized).not.toContain('Music\\HighRes');

      // Audio telemetry
      expect(ctx.audio.codec).toBe('FLAC');
      expect(ctx.audio.sampleRate).toBe(96000);
      expect(ctx.audio.bitDepth).toBe(24);
      expect(ctx.audio.bitrate).toBe(2420);
      expect(ctx.audio.isLossless).toBe(true);
      expect(ctx.audio.isBitPerfect).toBe(true);

      // DSP telemetry
      expect(ctx.audio.activeDSP).toBeDefined();
      expect(ctx.audio.activeDSP?.some((d) => d.includes('Rock Legend'))).toBe(true);
      expect(ctx.audio.activeDSP?.some((d) => d.includes('Preamp'))).toBe(true);
      expect(ctx.audio.activeDSP?.some((d) => d.includes('Bass Boost'))).toBe(true);

      // Queue telemetry
      expect(ctx.queue.totalTracks).toBe(2);
      expect(ctx.queue.currentIndex).toBe(0);
      expect(ctx.queue.nextTrack?.title).toBe('Starlight Dream');
      expect(ctx.queue.nextTrack?.artist).toBe('Aurora Indie');
    });

    it('builds accurate online track context and preserves provider metadata', () => {
      const previewTrack: TrackMetadata = {
        ...mockOnlineMp3Track,
        playbackCapability: 'preview',
      };

      const ctx = buildAssistantContext({
        track: previewTrack,
        isPlaying: false,
        currentTime: 12,
        duration: 30,
        repeatMode: 'off',
        queue: [previewTrack],
      });

      expect(ctx.playback.isPlaying).toBe(false);
      expect(ctx.playback.isPaused).toBe(true);
      expect(ctx.currentTrack?.source).toBe('online');
      expect(ctx.currentTrack?.provider).toBe('jamendo');
      expect(ctx.currentTrack?.isPreview).toBe(true);
      expect(ctx.audio.codec).toBe('MP3');
      expect(ctx.audio.isLossless).toBe(false);
      // Bit depth is strictly undefined for lossy MP3
      expect(ctx.audio.bitDepth).toBeUndefined();
    });

    it('handles missing metadata, unknown codecs, and idle playback gracefully', () => {
      // Idle state
      const idleCtx = buildAssistantContext({
        track: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        queue: [],
      });

      expect(idleCtx.playback.isPlaying).toBe(false);
      expect(idleCtx.playback.isPaused).toBe(false);
      expect(idleCtx.currentTrack).toBeUndefined();
      expect(idleCtx.audio.codec).toBeUndefined();
      expect(idleCtx.queue.totalTracks).toBe(0);
      expect(idleCtx.queue.nextTrack).toBeUndefined();

      // Incomplete metadata track
      const incompleteTrack: TrackMetadata = {
        id: 'incomplete_1',
        filePath: 'C:\\fake\\track.xyz',
        fileName: 'track.xyz',
        fileSize: 1000,
        dateModified: 0,
        title: '',
        artist: '',
        album: '',
        hasArtwork: false,
        codec: 'UNKNOWN',
        container: '',
        duration: 0,
        sampleRate: 0,
        bitrate: 0,
        channels: 0,
        isLossless: false,
        playCount: 0,
        isFavorite: false,
      };

      const partialCtx = buildAssistantContext({
        track: incompleteTrack,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        queue: [incompleteTrack],
      });

      expect(partialCtx.currentTrack?.title).toBe('Untitled Track');
      expect(partialCtx.currentTrack?.artist).toBe('Unknown Artist');
      expect(partialCtx.audio.codec).toBeUndefined();
      expect(partialCtx.audio.bitDepth).toBeUndefined();
    });

    it('formats context string correctly for prompt injection', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 90,
        duration: 354,
        repeatMode: 'off',
        queue: [mockLocalFlacTrack, mockOnlineMp3Track],
        dspSettings: mockActiveDsp,
        bitPerfectStatus: mockBitPerfectActive,
        activePresetName: 'Rock Legend',
      });

      const formatted = formatContextForPrompt(ctx);

      expect(formatted).toContain('--- CURRENT HARMONIQ PLAYBACK CONTEXT ---');
      expect(formatted).toContain('Now Playing: "Bohemian Rhapsody" by Queen');
      expect(formatted).toContain('Album: "A Night at the Opera"');
      expect(formatted).toContain('FLAC / 24-bit / 96,000 Hz / 2420 kbps');
      expect(formatted).toContain('Lossless: Yes');
      expect(formatted).toContain('Bit-Perfect: Active');
      expect(formatted).toContain('Equalizer (Rock Legend)');
      expect(formatted).toContain('Next Up: "Starlight Dream" by Aurora Indie');
      expect(formatted).toContain('--- END PLAYBACK CONTEXT ---');
      expect(formatted).not.toContain('C:\\');
    });

    it('formats duration seconds cleanly into MM:SS and HH:MM:SS', () => {
      expect(formatDurationSeconds(0)).toBe('0:00');
      expect(formatDurationSeconds(45)).toBe('0:45');
      expect(formatDurationSeconds(125)).toBe('2:05');
      expect(formatDurationSeconds(3665)).toBe('1:01:05');
      expect(formatDurationSeconds(undefined)).toBe('0:00');
    });
  });

  describe('Part 2: Intent Classification & Context-Aware Responses', () => {
    it('classifies contextual questions into verified intents', () => {
      expect(detectContextIntent('what song am I listening to')).toBe('current_track');
      expect(detectContextIntent("what's playing right now")).toBe('current_track');
      expect(detectContextIntent('who is the artist')).toBe('artist_info');
      expect(detectContextIntent('tell me about this album')).toBe('album_info');
      expect(detectContextIntent('is this lossless')).toBe('lossless_check');
      expect(detectContextIntent('am I listening to lossless')).toBe('lossless_check');
      expect(detectContextIntent('what is the audio quality of this track')).toBe('audio_quality');
      expect(detectContextIntent('what is the bitrate and sample rate')).toBe('audio_quality');
      expect(detectContextIntent('which song is playing next')).toBe('next_track');
      expect(detectContextIntent('is my equalizer affecting this track')).toBe('dsp_status');
      expect(detectContextIntent('is bit-perfect active')).toBe('bitperfect_status');
      expect(detectContextIntent('how do I create a playlist')).toBeNull(); // Non-context general question
    });

    it('answers "What song am I listening to?" using verified current track telemetry', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 60,
        duration: 354,
        queue: [mockLocalFlacTrack],
      });

      const response = generateLocalAnswer('What song am I listening to?', undefined, ctx);

      expect(response.content).toContain('Bohemian Rhapsody');
      expect(response.content).toContain('Queen');
      expect(response.content).toContain('A Night at the Opera');
      expect(response.content).toContain('Playing 🎵');
      expect(response.actions.some((a) => a.target === 'now_playing')).toBe(true);
      expect(response.actions.some((a) => a.target === 'inspector')).toBe(true);
    });

    it('answers "Is this lossless?" accurately for FLAC vs MP3', () => {
      // Test 1: FLAC
      const flacCtx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 20,
        duration: 354,
        queue: [mockLocalFlacTrack],
      });

      const flacRes = generateLocalAnswer('Is this lossless?', undefined, flacCtx);
      expect(flacRes.content).toContain('Lossless Quality Verified');
      expect(flacRes.content).toContain('FLAC');
      expect(flacRes.content).toContain('24-bit');
      expect(flacRes.actions.some((a) => a.target === 'inspector')).toBe(true);

      // Test 2: MP3
      const mp3Ctx = buildAssistantContext({
        track: mockOnlineMp3Track,
        isPlaying: true,
        currentTime: 10,
        duration: 180,
        queue: [mockOnlineMp3Track],
      });

      const mp3Res = generateLocalAnswer('Is this lossless?', undefined, mp3Ctx);
      expect(mp3Res.content).toContain('Lossy Audio Stream');
      expect(mp3Res.content).toContain('MP3');
      expect(mp3Res.content).toContain('not lossless');
    });

    it('answers "Which song is playing next?" using real queue state', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 20,
        duration: 354,
        queue: [mockLocalFlacTrack, mockOnlineMp3Track],
      });

      const res = generateLocalAnswer('What song is next?', undefined, ctx);
      expect(res.content).toContain('Starlight Dream');
      expect(res.content).toContain('Aurora Indie');
      expect(res.content).toContain('2');
      expect(res.actions.some((a) => a.target === 'now_playing')).toBe(true);
    });

    it('answers "Is my equalizer affecting this track?" using verified active DSP settings', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 30,
        duration: 354,
        queue: [mockLocalFlacTrack],
        dspSettings: mockActiveDsp,
        activePresetName: 'Rock Legend',
      });

      const res = generateLocalAnswer('Is my equalizer affecting this track?', undefined, ctx);
      expect(res.content).toContain('Active DSP Processing');
      expect(res.content).toContain('Rock Legend');
      expect(res.content).toContain('Preamp');
      expect(res.actions.some((a) => a.target === 'equalizer')).toBe(true);
    });

    it('handles context queries when playback is idle without crashing or fabricating', () => {
      const idleCtx = buildAssistantContext({
        track: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        queue: [],
      });

      const trackRes = generateLocalAnswer('What song am I listening to?', undefined, idleCtx);
      expect(trackRes.content).toContain('No song is currently playing');
      expect(trackRes.actions.some((a) => a.target === 'songs')).toBe(true);

      const queueRes = generateLocalAnswer("What's next in the queue?", undefined, idleCtx);
      expect(queueRes.content).toContain('playback queue is currently empty');

      const qualityRes = generateLocalAnswer('What is the audio quality?', undefined, idleCtx);
      expect(qualityRes.content).toContain('No track is currently playing');
    });

    it('provides context-aware suggested questions when music is active', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 40,
        duration: 354,
        queue: [mockLocalFlacTrack],
      });

      const questions = getSuggestedQuestions('now_playing', ctx);
      expect(questions).toContain('What song am I listening to?');
      expect(questions).toContain('What is the audio quality of this track?');
      expect(questions).toContain('Is this track lossless?');
      expect(questions).toContain('Which song is playing next?');
    });
  });

  describe('Part 3: Assistant Service Integration & State Persistence', () => {
    it('sets and updates assistant context on assistantService', () => {
      const ctx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 50,
        duration: 354,
        queue: [mockLocalFlacTrack],
      });

      assistantService.setAssistantContext(ctx);
      const retrieved = assistantService.getAssistantContext();

      expect(retrieved).toBeDefined();
      expect(retrieved?.currentTrack?.title).toBe('Bohemian Rhapsody');
      expect(retrieved?.audio.codec).toBe('FLAC');
    });

    it('preserves message history across context updates and does not wipe chat', () => {
      assistantService.clearHistory();
      const initialCount = assistantService.getMessages().length;

      // Update context multiple times (simulating song changes)
      assistantService.setAssistantContext(
        buildAssistantContext({
          track: mockLocalFlacTrack,
          isPlaying: true,
          currentTime: 10,
          duration: 354,
          queue: [mockLocalFlacTrack],
        })
      );

      assistantService.setAssistantContext(
        buildAssistantContext({
          track: mockOnlineMp3Track,
          isPlaying: true,
          currentTime: 20,
          duration: 180,
          queue: [mockOnlineMp3Track],
        })
      );

      expect(assistantService.getMessages().length).toBe(initialCount);
    });

    it('sanitizes untrusted track metadata and strips prompt injection characters', () => {
      const maliciousTrack: TrackMetadata = {
        ...mockLocalFlacTrack,
        title: 'Song Title `rm -rf /` <script>alert(1)</script> ${process.env}',
        artist: 'Artist with control chars \u0000\u001F and `injection`',
      };

      const ctx = buildAssistantContext({
        track: maliciousTrack,
        isPlaying: true,
        currentTime: 0,
        duration: 200,
        queue: [maliciousTrack],
      });

      expect(ctx.currentTrack?.title).not.toContain('`');
      expect(ctx.currentTrack?.title).not.toContain('<script>');
      expect(ctx.currentTrack?.title).not.toContain('${');
      expect(ctx.currentTrack?.artist).not.toContain('\u0000');
    });

    it('answers Bit-Perfect WASAPI queries accurately based on live status', () => {
      // Bit-perfect active
      const activeCtx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: true,
        currentTime: 30,
        duration: 354,
        queue: [mockLocalFlacTrack],
        bitPerfectStatus: mockBitPerfectActive,
      });

      const activeRes = generateLocalAnswer('is bit-perfect active?', undefined, activeCtx);
      expect(activeRes.content).toContain('Bit-Perfect Mode: Active');
      expect(activeRes.content).toContain('native source sample rate');

      // Bit-perfect inactive
      const inactiveCtx = buildAssistantContext({
        track: mockOnlineMp3Track,
        isPlaying: true,
        currentTime: 10,
        duration: 180,
        queue: [mockOnlineMp3Track],
        bitPerfectStatus: {
          enabled: false,
          active: false,
          status: 'disabled',
          sourceSampleRate: 44100,
          outputSampleRate: 48000,
          isLossless: false,
          disabledFeatures: ['resampled'],
        },
      });

      const inactiveRes = generateLocalAnswer('is bit-perfect active?', undefined, inactiveCtx);
      expect(inactiveRes.content).toContain('Bit-Perfect Mode: Inactive');
    });

    it('identifies 30-second online preview tracks and informs the user', () => {
      const previewTrack: TrackMetadata = {
        ...mockOnlineMp3Track,
        playbackCapability: 'preview',
      };

      const ctx = buildAssistantContext({
        track: previewTrack,
        isPlaying: true,
        currentTime: 15,
        duration: 30,
        queue: [previewTrack],
      });

      const res = generateLocalAnswer('what song am I listening to?', undefined, ctx);
      expect(res.content).toContain('30s Preview');
      expect(res.content).toContain('Online (jamendo)');
    });

    it('answers playback state questions (playing vs paused)', () => {
      // Paused state
      const pausedCtx = buildAssistantContext({
        track: mockLocalFlacTrack,
        isPlaying: false,
        currentTime: 120,
        duration: 354,
        queue: [mockLocalFlacTrack],
      });

      const res = generateLocalAnswer('playback state', undefined, pausedCtx);
      expect(res.content).toContain('Paused ⏸️');
      expect(res.content).toContain('2:00 / 5:54');
    });
  });
});

describe('Harmoniq 2.0 - Phase 5A.4: Pulse Orb Interaction & Persistent Container', () => {
  it('manages pulse orb states cleanly (idle, hover, listening, processing, responding, error)', () => {
    assistantService.setOrbState('idle');
    expect(assistantService.getOrbState()).toBe('idle');

    assistantService.setOrbState('processing');
    expect(assistantService.getOrbState()).toBe('processing');

    assistantService.setOrbState('responding');
    expect(assistantService.getOrbState()).toBe('responding');

    assistantService.setOrbState('error');
    expect(assistantService.getOrbState()).toBe('error');

    assistantService.setOrbState('idle');
    expect(assistantService.getOrbState()).toBe('idle');
  });

  it('toggles assistant open and closed without unmounting service state', () => {
    assistantService.close();
    expect(assistantService.getIsOpen()).toBe(false);

    assistantService.open();
    expect(assistantService.getIsOpen()).toBe(true);

    assistantService.toggle();
    expect(assistantService.getIsOpen()).toBe(false);
  });

  it('preserves conversation history across repeated open and close toggles', () => {
    assistantService.clearHistory();
    const initialMsgCount = assistantService.getMessages().length;

    // Simulate opening and closing panel 5 times
    for (let i = 0; i < 5; i++) {
      assistantService.open();
      expect(assistantService.getIsOpen()).toBe(true);
      assistantService.close();
      expect(assistantService.getIsOpen()).toBe(false);
    }

    // Message history must survive intact
    expect(assistantService.getMessages().length).toBe(initialMsgCount);
  });
});
