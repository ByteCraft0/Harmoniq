import { TrackMetadata, RepeatMode } from '../../types/audio';

export type PlatformType = 'electron' | 'android' | 'web';

export interface PlatformCapabilities {
  hasLocalFileSystem: boolean;
  hasFolderPicker: boolean;
  hasFilePicker: boolean;
  hasMediaStore: boolean;
  hasNativeAudioService: boolean;
  hasHardwareEqualizer: boolean;
  hasSoftwareDsp: boolean;
  hasSystemMediaTransport: boolean; // Windows SMTC or Android MediaStyle Notification
  hasGlobalShortcuts: boolean;
  hasTrayIntegration: boolean;
  hasWindowManagement: boolean; // minimize, maximize, close, miniplayer window
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  trackId: string | null;
  currentTrack: TrackMetadata | null;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  queue?: TrackMetadata[];
  currentQueueIndex?: number;
  isShuffle?: boolean;
  repeatMode?: RepeatMode;
  isLive?: boolean;
  isBuffering?: boolean;
}

export interface EqualizerBand {
  band: number;
  centerFreq: number; // Hz
  minLevel: number; // dB
  maxLevel: number; // dB
  currentLevel: number; // dB
}

export interface EqualizerParameters {
  supported: boolean;
  enabled: boolean;
  numBands: number;
  bands: EqualizerBand[];
  presets: string[];
  currentPreset?: string;
}

export interface NativeSleepTimerStatus {
  isActive: boolean;
  secondsRemaining: number;
  totalSeconds: number;
}

export type PlaybackStateListener = (state: PlaybackState) => void;
export type TrackEndedListener = () => void;
export type MediaCommand = 'play' | 'pause' | 'playpause' | 'next' | 'prev' | 'stop';
export type MediaCommandListener = (command: MediaCommand) => void;
export type PlaybackErrorListener = (error: { message: string; track?: TrackMetadata | null; code?: string }) => void;
export type SleepTimerExpiredListener = () => void;

export interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
}

export type ScanProgressListener = (progress: ScanProgress) => void;
