export type AudioCodec =
  | 'FLAC'
  | 'MP3'
  | 'AAC'
  | 'ALAC'
  | 'WAV'
  | 'OGG'
  | 'OPUS'
  | 'AIFF'
  | 'UNKNOWN';

export type QualityTier =
  | 'Standard'
  | 'High Quality'
  | 'Lossless'
  | 'Hi-Res Lossless';

export interface ReplayGainData {
  trackGain?: number; // in dB
  trackPeak?: number; // 0.0 - 1.0+
  albumGain?: number; // in dB
  albumPeak?: number; // 0.0 - 1.0+
}

export interface TrackMetadata {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number; // in bytes
  dateModified: number; // timestamp
  dateAdded?: number; // timestamp when first indexed
  
  // Tag information
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  comment?: string;
  hasArtwork: boolean;
  artworkDataUrl?: string; // base64 or custom protocol URI

  // Technical Audio Stream specifications (extracted from stream header, NOT file extension)
  codec: AudioCodec;
  container: string;
  duration: number; // in seconds
  sampleRate: number; // in Hz (e.g. 44100, 48000, 96000, 192000)
  bitDepth?: number; // in bits (e.g. 16, 24, 32). Optional/undefined for lossy perceptual codecs
  bitrate: number; // in kbps (e.g. 320, 982)
  channels: number; // 1 = Mono, 2 = Stereo, 6 = 5.1
  isLossless: boolean;
  
  // ReplayGain
  replayGain?: ReplayGainData;
  
  // Embedded lyrics
  embeddedLyrics?: string;
  hasSyncedLyrics?: boolean;

  // Library statistics
  playCount: number;
  isFavorite: boolean;
  lastPlayed?: number; // timestamp
  resumePosition?: number; // in seconds, remembered for audiobooks/podcasts
  customPlaybackSpeed?: number; // custom speed remembered for this specific file
}

export type RepeatMode = 'off' | 'all' | 'one';
export type ReplayGainMode = 'off' | 'track' | 'album';

export interface PlaybackState {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number; // in seconds
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  playbackRate: number; // 0.5 to 3.0
  preservesPitch: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  crossfadeDuration: number; // 0 to 10 seconds
  replayGainMode: ReplayGainMode;
}

export interface AudioOutputDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault: boolean;
  sampleRate?: number;
  channels?: number;
  mode: 'shared' | 'exclusive';
  supportedModes: ('shared' | 'exclusive')[];
}
