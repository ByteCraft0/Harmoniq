import { historyService } from './historyService';
import { libraryService } from './libraryService';
import { HistoryEntry, ListeningGoal, AudiophileMilestone } from '../types/history';
import { TrackMetadata } from '../types/audio';

export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // Mon, Tue, etc.
  seconds: number;
  minutes: number;
  tracksPlayed: number;
}

export interface WeeklyActivityPoint {
  weekLabel: string;
  seconds: number;
  minutes: number;
  tracksPlayed: number;
}

export interface MonthlyActivityPoint {
  monthLabel: string;
  seconds: number;
  hours: number;
  tracksPlayed: number;
}

export interface TopArtistStat {
  name: string;
  playCount: number;
  listeningSeconds: number;
  artworkUrl?: string;
}

export interface TopAlbumStat {
  title: string;
  artist: string;
  playCount: number;
  listeningSeconds: number;
  artworkUrl?: string;
}

export interface GenreDistribution {
  genre: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ListeningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDay?: string;
}

const GENRE_COLORS = [
  '#A78BFA', // Violet
  '#38BDF8', // Sky
  '#F472B6', // Pink
  '#34D399', // Emerald
  '#FBBF24', // Amber
  '#FB7185', // Rose
  '#818CF8', // Indigo
  '#6EE7B7', // Teal
];

const STORAGE_GOALS_KEY = 'harmoniq_listening_goals_v1';

export class StatsService {
  private weeklyTargetHours = 10;
  private dailyTargetMinutes = 60;

  constructor() {
    this.loadGoalTargets();
  }

  private loadGoalTargets(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_GOALS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.weeklyTargetHours) this.weeklyTargetHours = Number(parsed.weeklyTargetHours);
          if (parsed.dailyTargetMinutes) this.dailyTargetMinutes = Number(parsed.dailyTargetMinutes);
        }
      }
    } catch (e) {
      console.warn('Failed to load goal targets:', e);
    }
  }

  public saveGoalTargets(weeklyHours: number, dailyMinutes: number): void {
    this.weeklyTargetHours = Math.max(1, Math.min(100, Math.round(weeklyHours)));
    this.dailyTargetMinutes = Math.max(5, Math.min(720, Math.round(dailyMinutes)));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_GOALS_KEY,
          JSON.stringify({
            weeklyTargetHours: this.weeklyTargetHours,
            dailyTargetMinutes: this.dailyTargetMinutes,
          })
        );
      }
    } catch (e) {
      console.warn('Failed to save goal targets:', e);
    }
  }

  /**
   * Calculate all-time, monthly, weekly, and daily listening seconds
   */
  public getListeningTotals(): {
    allTimeSeconds: number;
    thisMonthSeconds: number;
    thisWeekSeconds: number;
    todaySeconds: number;
    totalCompletedPlays: number;
  } {
    const history = historyService.getHistory();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - now.getDay() * 86400 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let allTimeSeconds = 0;
    let thisMonthSeconds = 0;
    let thisWeekSeconds = 0;
    let todaySeconds = 0;
    let totalCompletedPlays = 0;

    for (const e of history) {
      const sec = e.playbackDuration || 0;
      allTimeSeconds += sec;
      if (e.playedAt >= monthStart) thisMonthSeconds += sec;
      if (e.playedAt >= weekStart) thisWeekSeconds += sec;
      if (e.playedAt >= todayStart) todaySeconds += sec;
      if (e.completionStatus === 'completed') totalCompletedPlays++;
    }

    return {
      allTimeSeconds,
      thisMonthSeconds,
      thisWeekSeconds,
      todaySeconds,
      totalCompletedPlays,
    };
  }

  /**
   * Harmoniq 2.0 Personalization: Get active listening goals and progress
   */
  public getListeningGoals(): ListeningGoal {
    const totals = this.getListeningTotals();
    const targetWeekSec = this.weeklyTargetHours * 3600;
    const targetDaySec = this.dailyTargetMinutes * 60;

    const weeklyProgressPercent = Math.min(100, Math.round((totals.thisWeekSeconds / targetWeekSec) * 100));
    const dailyProgressPercent = Math.min(100, Math.round((totals.todaySeconds / targetDaySec) * 100));

    return {
      weeklyTargetHours: this.weeklyTargetHours,
      dailyTargetMinutes: this.dailyTargetMinutes,
      weeklyListenedSeconds: totals.thisWeekSeconds,
      todayListenedSeconds: totals.todaySeconds,
      weeklyProgressPercent,
      dailyProgressPercent,
    };
  }

  /**
   * Daily activity for last N days (default 7)
   */
  public getDailyActivity(days = 7): DailyActivityPoint[] {
    const history = historyService.getHistory();
    const result: DailyActivityPoint[] = [];

    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 86400 * 1000;
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });

      let sec = 0;
      let count = 0;

      for (const e of history) {
        if (e.playedAt >= start && e.playedAt < end) {
          sec += e.playbackDuration || 0;
          count++;
        }
      }

      result.push({
        date: dateStr,
        dayLabel,
        seconds: sec,
        minutes: Math.round(sec / 60),
        tracksPlayed: count,
      });
    }

    return result;
  }

  /**
   * Monthly activity for last N months (default 6)
   */
  public getMonthlyActivity(months = 6): MonthlyActivityPoint[] {
    const history = historyService.getHistory();
    const result: MonthlyActivityPoint[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const monthLabel = d.toLocaleDateString([], { month: 'short', year: '2-digit' });

      let sec = 0;
      let count = 0;

      for (const e of history) {
        if (e.playedAt >= start && e.playedAt < end) {
          sec += e.playbackDuration || 0;
          count++;
        }
      }

      result.push({
        monthLabel,
        seconds: sec,
        hours: parseFloat((sec / 3600).toFixed(1)),
        tracksPlayed: count,
      });
    }

    return result;
  }

  /**
   * Calculate consecutive days listening streak
   */
  public calculateStreak(): ListeningStreak {
    const history = historyService.getHistory();
    if (history.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Collect all unique active dates
    const daySet = new Set<string>();
    for (const e of history) {
      const d = new Date(e.playedAt);
      const dayStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      daySet.add(dayStr);
    }

    const sortedDays = Array.from(daySet).sort().reverse();
    if (sortedDays.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const yesterday = new Date(today.getTime() - 86400 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

    let currentStreak = 0;
    let longestStreak = 0;

    // Check if streak is active today or yesterday
    const checkDate = sortedDays[0] === todayStr ? today : sortedDays[0] === yesterdayStr ? yesterday : null;

    if (checkDate) {
      let cursor = new Date(checkDate);
      while (true) {
        const curStr = `${cursor.getFullYear()}-${(cursor.getMonth() + 1).toString().padStart(2, '0')}-${cursor.getDate().toString().padStart(2, '0')}`;
        if (daySet.has(curStr)) {
          currentStreak++;
          cursor = new Date(cursor.getTime() - 86400 * 1000);
        } else {
          break;
        }
      }
    }

    // Longest streak calculation
    let tempStreak = 0;
    const allDaysAsc = Array.from(daySet).sort();
    for (let i = 0; i < allDaysAsc.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(allDaysAsc[i - 1]).getTime();
        const curr = new Date(allDaysAsc[i]).getTime();
        const diffDays = Math.round((curr - prev) / (86400 * 1000));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastActiveDay: sortedDays[0],
    };
  }

  /**
   * Top artists ranked by listening time & plays
   */
  public getTopArtists(limit = 5): TopArtistStat[] {
    const history = historyService.getHistory();
    const artistMap = new Map<string, { seconds: number; plays: number; artwork?: string }>();

    for (const e of history) {
      const name = e.artist || 'Unknown Artist';
      const existing = artistMap.get(name) || { seconds: 0, plays: 0, artwork: e.artworkDataUrl };
      existing.seconds += e.playbackDuration || 0;
      existing.plays += 1;
      if (!existing.artwork && e.artworkDataUrl) existing.artwork = e.artworkDataUrl;
      artistMap.set(name, existing);
    }

    return Array.from(artistMap.entries())
      .map(([name, data]) => ({
        name,
        playCount: data.plays,
        listeningSeconds: data.seconds,
        artworkUrl: data.artwork,
      }))
      .sort((a, b) => b.listeningSeconds - a.listeningSeconds)
      .slice(0, limit);
  }

  /**
   * Top genres distribution
   */
  public getGenreDistribution(): GenreDistribution[] {
    const tracks = libraryService.getAllTracks();
    const history = historyService.getHistory();

    const genreCounts = new Map<string, number>();
    let total = 0;

    // Weight by history plays or library tracks
    if (history.length > 0) {
      for (const e of history) {
        const tr = libraryService.getTrack(e.trackId);
        const g = tr?.genre?.trim() || 'Uncategorized';
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        total++;
      }
    } else {
      for (const t of tracks) {
        const g = t.genre?.trim() || 'Uncategorized';
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        total++;
      }
    }

    if (total === 0) return [];

    return Array.from(genreCounts.entries())
      .map(([genre, count], idx) => ({
        genre,
        count,
        percentage: Math.round((count / total) * 100),
        color: GENRE_COLORS[idx % GENRE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  /**
   * Harmoniq 2.0 Personalization: Dynamic Audiophile Milestones
   */
  public getAudiophileMilestones(): AudiophileMilestone[] {
    const history = historyService.getHistory();
    const totals = this.getListeningTotals();
    const streak = this.calculateStreak();
    const genres = this.getGenreDistribution();

    // Check for Lossless / Hi-Res in history or library
    let hasLossless = false;
    let hasHiRes = false;
    let lateNightCount = 0;

    for (const e of history) {
      const tr = libraryService.getTrack(e.trackId);
      if (tr) {
        if (tr.isLossless || ['FLAC', 'WAV', 'ALAC', 'AIFF'].includes(tr.codec?.toUpperCase() || '')) {
          hasLossless = true;
        }
        if ((tr.sampleRate && tr.sampleRate >= 88200) || (tr.bitDepth && tr.bitDepth >= 24)) {
          hasHiRes = true;
        }
      }
      // Check late night hour (12 AM to 5 AM)
      const hour = new Date(e.playedAt).getHours();
      if (hour >= 0 && hour < 5) {
        lateNightCount++;
      }
    }

    const completedTracks = totals.totalCompletedPlays;
    const marathonHours = totals.allTimeSeconds / 3600;

    const milestones: AudiophileMilestone[] = [
      {
        id: 'first_lossless',
        title: 'Lossless Purity',
        description: 'Play your first bit-perfect lossless track (FLAC, WAV, ALAC, or AIFF)',
        category: 'fidelity',
        icon: 'Sparkles',
        unlocked: hasLossless,
        progress: hasLossless ? 100 : 0,
      },
      {
        id: 'hires_master',
        title: 'Studio Master',
        description: 'Experience studio master quality audio (≥96 kHz or 24-bit depth)',
        category: 'fidelity',
        icon: 'Gauge',
        unlocked: hasHiRes,
        progress: hasHiRes ? 100 : 0,
      },
      {
        id: 'century_club',
        title: 'The Centurion',
        description: 'Complete playback of 100 musical tracks',
        category: 'volume',
        icon: 'Disc',
        unlocked: completedTracks >= 100,
        progress: Math.min(100, Math.round((completedTracks / 100) * 100)),
      },
      {
        id: 'night_owl',
        title: 'Midnight Serenade',
        description: 'Listen to music during the late night hours (12:00 AM – 5:00 AM)',
        category: 'habit',
        icon: 'Moon',
        unlocked: lateNightCount >= 1,
        progress: lateNightCount >= 1 ? 100 : 0,
      },
      {
        id: 'genre_hopper',
        title: 'Genre Cosmopolitan',
        description: 'Explore 5 or more distinct music genres in your library',
        category: 'discovery',
        icon: 'Compass',
        unlocked: genres.length >= 5,
        progress: Math.min(100, Math.round((genres.length / 5) * 100)),
      },
      {
        id: 'streak_dedication',
        title: 'Sonic Momentum',
        description: 'Achieve a 3-day consecutive listening streak',
        category: 'habit',
        icon: 'Flame',
        unlocked: streak.longestStreak >= 3,
        progress: Math.min(100, Math.round((streak.longestStreak / 3) * 100)),
      },
      {
        id: 'marathon_listener',
        title: 'Symphonic Marathon',
        description: 'Log 3 or more total hours of high-fidelity listening',
        category: 'volume',
        icon: 'Clock',
        unlocked: marathonHours >= 3,
        progress: Math.min(100, Math.round((marathonHours / 3) * 100)),
      },
    ];

    return milestones;
  }
}

export const statsService = new StatsService();
