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
  // Provider and online metadata
  isOnline?: boolean;
  providerId?: string;
  providerTrackId?: string;
  playbackCapability?: string;
  genre?: string;
  filePath?: string;
}

export type HistoryDateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'all';

export interface HistoryQueryOptions {
  dateFilter?: HistoryDateFilter;
  searchQuery?: string;
  sortBy?: 'playedAt' | 'playbackDuration';
  sortOrder?: 'asc' | 'desc';
  statusFilter?: 'all' | HistoryCompletionStatus;
  providerId?: string;
  artist?: string;
  limit?: number;
}

// Harmoniq 2.0 Personalization: Goals & Milestones
export interface ListeningGoal {
  weeklyTargetHours: number; // e.g. 10 hours
  dailyTargetMinutes: number; // e.g. 60 minutes
  weeklyListenedSeconds: number;
  todayListenedSeconds: number;
  weeklyProgressPercent: number;
  dailyProgressPercent: number;
}

export interface AudiophileMilestone {
  id: string;
  title: string;
  description: string;
  category: 'fidelity' | 'volume' | 'habit' | 'discovery';
  icon: string;
  unlocked: boolean;
  progress: number; // 0 to 100 percent
  unlockedAt?: number;
}
