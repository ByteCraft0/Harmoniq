import { TrackMetadata, RepeatMode } from '../../types/audio';
import {
  PlaybackState,
  PlaybackStateListener,
  TrackEndedListener,
  MediaCommandListener,
  PlaybackErrorListener,
  EqualizerParameters,
  NativeSleepTimerStatus,
  SleepTimerExpiredListener,
} from './types';

export interface IAudioDriver {
  // Playback Control
  play(track: TrackMetadata, queue?: TrackMetadata[]): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;

  // Playback Modes & Navigation
  setShuffle?(enabled: boolean): Promise<void>;
  setRepeatMode?(mode: RepeatMode): Promise<void>;
  skipToNext?(): Promise<void>;
  skipToPrevious?(): Promise<void>;

  // Queue Control
  setQueue(queue: TrackMetadata[]): Promise<void>;
  addToQueue(track: TrackMetadata): Promise<void>;
  playNext(track: TrackMetadata): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  clearQueue(): Promise<void>;

  // DSP & Equalizer
  setEqBands?(bands: number[]): Promise<void>;
  setPreamp?(gainDb: number): Promise<void>;
  setDspEnabled?(enabled: boolean): Promise<void>;
  setBassBoost?(gainDb: number): Promise<void>;
  setTreble?(gainDb: number): Promise<void>;
  getEqualizerParameters?(): Promise<EqualizerParameters>;
  setEqualizerEnabled?(enabled: boolean): Promise<void>;
  setEqualizerBandGain?(band: number, gainDb: number): Promise<void>;
  setEqualizerPreset?(presetName: string): Promise<void>;
  resetEqualizer?(): Promise<void>;

  // Sleep Timer
  startSleepTimer?(minutes: number): Promise<void>;
  cancelSleepTimer?(): Promise<void>;
  getSleepTimerStatus?(): Promise<NativeSleepTimerStatus>;

  // Device Routing
  setOutputDevice?(deviceId: string): Promise<boolean>;

  // System Media Transport (SMTC on Windows / MediaSession on Android)
  updateMetadata(track: TrackMetadata | null, isPlaying: boolean): Promise<void>;

  // State Inspection
  getState(): PlaybackState;
  getPlaybackSnapshot?(): Promise<PlaybackState>;

  // Notification Permission & App Removal Lifecycle
  checkNotificationPermission?(): Promise<{ granted: boolean; shouldShowRationale?: boolean }>;
  requestNotificationPermission?(): Promise<{ requested: boolean; granted?: boolean }>;
  openNotificationSettings?(): Promise<boolean>;
  getStopOnTaskRemoved?(): Promise<boolean>;
  setStopOnTaskRemoved?(enabled: boolean): Promise<void>;

  // Subscriptions
  onPlaybackStateChange(listener: PlaybackStateListener): () => void;
  onTrackEnded(listener: TrackEndedListener): () => void;
  onMediaCommand?(listener: MediaCommandListener): () => void;
  onError(listener: PlaybackErrorListener): () => void;
  onSleepTimerExpired?(listener: SleepTimerExpiredListener): () => void;
}
