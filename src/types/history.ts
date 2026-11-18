export type HistoryCompletionStatus = 'completed' | 'partial' | 'skipped';

export interface HistoryEntry {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artworkDataUrl?: string;
  playedAt: number; // Timestamp in ms
  duration: number; // Track length in seconds
  playbackDuration: number; // Seconds actually listened
  completionStatus: HistoryCompletionStatus;
}

export type HistoryDateFilter = 'today' | '7days' | '30days' | 'all';
