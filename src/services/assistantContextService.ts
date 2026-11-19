import { TrackMetadata } from '../types/audio';
import { BitPerfectState, DSPSettings } from '../types/dsp';
import {
  HarmoniqAssistantContext,
  HarmoniqAudioContext,
  HarmoniqPlaybackContext,
  HarmoniqQueueContext,
  HarmoniqTrackContext,
} from '../types/assistant';

/**
 * Format duration or time offset in seconds to MM:SS or HH:MM:SS
 */
export function formatDurationSeconds(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Sanitize untrusted metadata strings to prevent prompt injection or formatting breaking.
 */
function sanitizeText(value?: string, maxLength: number = 100): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  // Strip control characters, backticks, and common prompt injection wrappers
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[`${}<>]/g, '')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? `${cleaned.substring(0, maxLength)}...` : cleaned;
}

export interface BuildContextParams {
  track: TrackMetadata | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  repeatMode?: string;
  isShuffle?: boolean;
  queue: TrackMetadata[];
  bitPerfectStatus?: BitPerfectState;
  dspSettings?: DSPSettings;
  activePresetName?: string;
}

/**
 * Builds a strongly typed, verified, and sanitized HarmoniqAssistantContext object.
 * Guarantee: Zero private file paths or sensitive system data are ever included.
 */
export function buildAssistantContext(params: BuildContextParams): HarmoniqAssistantContext {
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    repeatMode = 'off',
    isShuffle = false,
    queue = [],
    bitPerfectStatus,
    dspSettings,
    activePresetName,
  } = params;

  // 1. Playback Context
  const playback: HarmoniqPlaybackContext = {
    isPlaying: !!isPlaying,
    isPaused: !isPlaying && (currentTime > 0 || track !== null),
    currentTime: Math.max(0, Math.round(currentTime)),
    duration: duration > 0 ? Math.round(duration) : (track?.duration ? Math.round(track.duration) : undefined),
    repeatMode,
    shuffleEnabled: !!isShuffle,
  };

  // 2. Track Context (Sanitized - STRICTLY NO FILE PATHS)
  let currentTrack: HarmoniqTrackContext | undefined = undefined;
  if (track) {
    const isOnline = !!track.isOnline || !!track.providerId;
    currentTrack = {
      id: track.id,
      title: sanitizeText(track.title, 120) || 'Untitled Track',
      artist: sanitizeText(track.artist, 100) || 'Unknown Artist',
      album: sanitizeText(track.album, 100) || undefined,
      genre: sanitizeText(track.genre, 50) || undefined,
      year: track.year && track.year > 1000 && track.year < 3000 ? track.year : undefined,
      duration: track.duration > 0 ? Math.round(track.duration) : undefined,
      source: isOnline ? 'online' : 'local',
      provider: isOnline ? (track.providerId || 'online') : 'local',
      isPreview: track.playbackCapability === 'preview' || !!track.isOnline && !track.filePath,
      playbackCapability: track.playbackCapability,
    };
  }

  // 3. Audio Context
  const activeDSPList: string[] = [];
  if (dspSettings?.enabled) {
    const hasActiveBands = dspSettings.bands && dspSettings.bands.some(g => Math.abs(g) > 0.1);
    if (hasActiveBands || activePresetName) {
      activeDSPList.push(`Equalizer (${activePresetName || (dspSettings.eqMode === 'parametric' ? 'Parametric' : '10-Band Graphic')})`);
    }
    if (dspSettings.preamp && Math.abs(dspSettings.preamp) > 0.1) {
      activeDSPList.push(`Preamp (${dspSettings.preamp > 0 ? '+' : ''}${dspSettings.preamp.toFixed(1)} dB)`);
    }
    if (dspSettings.bassBoost && dspSettings.bassBoost > 0.1) {
      activeDSPList.push(`Bass Boost (+${dspSettings.bassBoost.toFixed(1)} dB)`);
    }
    if (dspSettings.treble && Math.abs(dspSettings.treble) > 0.1) {
      activeDSPList.push(`Treble (${dspSettings.treble > 0 ? '+' : ''}${dspSettings.treble.toFixed(1)} dB)`);
    }
    if (dspSettings.channelMode === 'mono') {
      activeDSPList.push('Mono Downmix');
    }
  }

  const audio: HarmoniqAudioContext = {
    codec: track?.codec && track.codec !== 'UNKNOWN' ? track.codec : undefined,
    format: track?.container || track?.codec || undefined,
    sampleRate: track?.sampleRate && track.sampleRate > 0 ? track.sampleRate : undefined,
    // Bit depth is strictly undefined for lossy formats unless verified
    bitDepth: track?.isLossless && track.bitDepth && track.bitDepth > 0 ? track.bitDepth : undefined,
    bitrate: track?.bitrate && track.bitrate > 0 ? track.bitrate : undefined,
    channels: track?.channels && track.channels > 0 ? track.channels : undefined,
    isLossless: track ? !!track.isLossless : undefined,
    isBitPerfect: bitPerfectStatus?.status === 'active',
    activeDSP: activeDSPList.length > 0 ? activeDSPList : undefined,
  };

  // 4. Queue Context
  const totalTracks = queue.length;
  let currentIndex: number | undefined = undefined;
  let nextTrack: { title: string; artist?: string } | undefined = undefined;

  if (track && totalTracks > 0) {
    const idx = queue.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      currentIndex = idx;
      if (idx + 1 < totalTracks) {
        const next = queue[idx + 1];
        nextTrack = {
          title: sanitizeText(next.title, 80) || 'Untitled',
          artist: sanitizeText(next.artist, 60),
        };
      } else if (repeatMode === 'all' && totalTracks > 1) {
        const first = queue[0];
        nextTrack = {
          title: sanitizeText(first.title, 80) || 'Untitled',
          artist: sanitizeText(first.artist, 60),
        };
      }
    }
  } else if (!track && totalTracks > 0) {
    nextTrack = {
      title: sanitizeText(queue[0].title, 80) || 'Untitled',
      artist: sanitizeText(queue[0].artist, 60),
    };
  }

  const queueContext: HarmoniqQueueContext = {
    totalTracks,
    currentIndex,
    nextTrack,
  };

  return {
    playback,
    currentTrack,
    audio,
    queue: queueContext,
    contextTimestamp: Date.now(),
  };
}

/**
 * Formats structured context into a clean, concise, delimited text block for prompt injection.
 */
export function formatContextForPrompt(ctx: HarmoniqAssistantContext): string {
  const lines: string[] = ['--- CURRENT HARMONIQ PLAYBACK CONTEXT ---'];

  // Playback state
  if (ctx.currentTrack) {
    const status = ctx.playback.isPlaying ? 'Playing' : ctx.playback.isPaused ? 'Paused' : 'Stopped';
    const curTime = formatDurationSeconds(ctx.playback.currentTime);
    const totalTime = formatDurationSeconds(ctx.playback.duration);
    lines.push(`Status: ${status} (${curTime} / ${totalTime}) | Repeat: ${ctx.playback.repeatMode || 'off'} | Shuffle: ${ctx.playback.shuffleEnabled ? 'On' : 'Off'}`);

    // Track metadata
    const artistStr = ctx.currentTrack.artist ? ` by ${ctx.currentTrack.artist}` : '';
    const albumStr = ctx.currentTrack.album ? ` | Album: "${ctx.currentTrack.album}"` : '';
    const genreStr = ctx.currentTrack.genre ? ` | Genre: ${ctx.currentTrack.genre}` : '';
    const yearStr = ctx.currentTrack.year ? ` (${ctx.currentTrack.year})` : '';
    const sourceStr = ctx.currentTrack.source === 'online' ? ` [Online - ${ctx.currentTrack.provider || 'Web'}]` : ' [Local File]';
    const previewStr = ctx.currentTrack.isPreview ? ' (30s Preview Stream)' : '';
    lines.push(`Now Playing: "${ctx.currentTrack.title}"${artistStr}${yearStr}${albumStr}${genreStr}${sourceStr}${previewStr}`);

    // Audio Telemetry
    const audioParts: string[] = [];
    if (ctx.audio.codec) audioParts.push(ctx.audio.codec);
    if (ctx.audio.bitDepth) audioParts.push(`${ctx.audio.bitDepth}-bit`);
    if (ctx.audio.sampleRate) audioParts.push(`${ctx.audio.sampleRate.toLocaleString()} Hz`);
    if (ctx.audio.bitrate) audioParts.push(`${ctx.audio.bitrate} kbps`);
    if (ctx.audio.channels) audioParts.push(ctx.audio.channels === 1 ? 'Mono' : ctx.audio.channels === 2 ? 'Stereo' : `${ctx.audio.channels} ch`);

    const losslessStr = ctx.audio.isLossless ? 'Lossless: Yes' : 'Lossless: No (Lossy)';
    const bitPerfectStr = ctx.audio.isBitPerfect ? 'Bit-Perfect: Active (WASAPI Exclusive bypass)' : 'Bit-Perfect: Inactive';
    const audioSummary = audioParts.length > 0 ? audioParts.join(' / ') : 'Stream audio';
    lines.push(`Audio Quality: ${audioSummary} | ${losslessStr} | ${bitPerfectStr}`);

    // Active DSP
    if (ctx.audio.activeDSP && ctx.audio.activeDSP.length > 0) {
      lines.push(`Active DSP Processing: ${ctx.audio.activeDSP.join(', ')}`);
    } else {
      lines.push('Active DSP Processing: None (Flat uncolored output)');
    }
  } else {
    lines.push('Status: Idle (No track currently playing)');
    lines.push('Audio Quality: Idle');
    lines.push('Active DSP: None');
  }

  // Queue
  if (ctx.queue.totalTracks > 0) {
    const nextStr = ctx.queue.nextTrack
      ? ` | Next Up: "${ctx.queue.nextTrack.title}"${ctx.queue.nextTrack.artist ? ` by ${ctx.queue.nextTrack.artist}` : ''}`
      : ' | End of queue reached';
    lines.push(`Queue: ${ctx.queue.totalTracks} track${ctx.queue.totalTracks === 1 ? '' : 's'} queued${nextStr}`);
  } else {
    lines.push('Queue: Empty (0 tracks)');
  }

  lines.push('--- END PLAYBACK CONTEXT ---');
  return lines.join('\n');
}

/**
 * Query intent classifier for music context queries.
 */
export type ContextQueryIntent =
  | 'current_track'
  | 'artist_info'
  | 'album_info'
  | 'audio_quality'
  | 'lossless_check'
  | 'next_track'
  | 'queue_status'
  | 'dsp_status'
  | 'bitperfect_status'
  | 'playback_state';

export function detectContextIntent(query: string): ContextQueryIntent | null {
  const q = query.toLowerCase().trim();

  // Lossless check
  if (
    q.includes('is this lossless') ||
    q.includes('am i listening to lossless') ||
    q.includes('is this file lossless') ||
    q.includes('is it lossless') ||
    q.includes('flac or mp3') ||
    q.includes('lossless or lossy')
  ) {
    return 'lossless_check';
  }

  // Audio quality / technical specs
  if (
    q.includes('audio quality') ||
    q.includes('what quality') ||
    q.includes('bitrate') ||
    q.includes('sample rate') ||
    q.includes('bit depth') ||
    q.includes('what codec') ||
    q.includes('sound quality of this track') ||
    q.includes('is this hi-res') ||
    q.includes('hi-res')
  ) {
    return 'audio_quality';
  }

  // Bit-perfect
  if (
    q.includes('bit-perfect') ||
    q.includes('bit perfect') ||
    q.includes('wasapi exclusive') ||
    q.includes('is bit-perfect active')
  ) {
    return 'bitperfect_status';
  }

  // Next track / queue
  if (
    q.includes('what song is next') ||
    q.includes("what's next") ||
    q.includes('what is next') ||
    q.includes('which song is playing next') ||
    q.includes('next track') ||
    q.includes('next song')
  ) {
    return 'next_track';
  }

  if (
    q.includes('in the queue') ||
    q.includes('queue status') ||
    q.includes('how many songs in queue') ||
    q.includes('show queue')
  ) {
    return 'queue_status';
  }

  // DSP / Equalizer
  if (
    q.includes('is my equalizer affecting') ||
    q.includes('is eq affecting') ||
    q.includes('is the equalizer on') ||
    q.includes('is eq on') ||
    q.includes('eq active') ||
    q.includes('dsp active') ||
    q.includes('what preset is active') ||
    q.includes('sound different from the previous')
  ) {
    return 'dsp_status';
  }

  // Current track / What am I listening to
  if (
    q.includes('listening to') ||
    q.includes('what song is playing') ||
    q.includes('what track is playing') ||
    q.includes('what is playing') ||
    q.includes("what's playing") ||
    q.includes('what is this song') ||
    q.includes("what's this song") ||
    q.includes('what song is this') ||
    q.includes('what track is this') ||
    q.includes('current song') ||
    q.includes('current track') ||
    q.includes('now playing')
  ) {
    return 'current_track';
  }

  // Artist info
  if (
    q.includes('who is the artist') ||
    q.includes("who's the artist") ||
    q.includes('who is singing') ||
    q.includes('who made this song') ||
    q.includes('tell me about this artist')
  ) {
    return 'artist_info';
  }

  // Album info
  if (
    q.includes('tell me about this album') ||
    q.includes('what album is this') ||
    q.includes('which album')
  ) {
    return 'album_info';
  }

  // Playback state
  if (
    q.includes('is music playing') ||
    q.includes('playback state') ||
    q.includes('am i paused')
  ) {
    return 'playback_state';
  }

  return null;
}
