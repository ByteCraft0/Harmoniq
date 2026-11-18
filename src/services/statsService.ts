import { historyService } from './historyService';
import { libraryService } from './libraryService';
import { HistoryEntry } from '../types/history';
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

export class StatsService {
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
    let checkDate = sortedDays[0] === todayStr ? today : sortedDays[0] === yesterdayStr ? yesterday : null;

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
}

export const statsService = new StatsService();
