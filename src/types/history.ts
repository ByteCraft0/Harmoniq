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
