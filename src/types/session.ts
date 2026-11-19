export interface SessionState {
  currentTrackId: string | null;
  playbackPosition: number; // in seconds
  queueTrackIds: string[];
  currentQueueIndex: number;
  activeQueueId?: string;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  activeView: string;
  lastSaved: number;
}

export interface SessionSettings {
  restoreSessionOnLaunch: boolean;
  autoResumePlaybackOnLaunch: boolean;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  restoreSessionOnLaunch: true,
  autoResumePlaybackOnLaunch: false, // Strict safety: do not start playback unexpectedly
};
