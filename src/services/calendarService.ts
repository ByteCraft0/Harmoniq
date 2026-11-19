import { historyService } from './historyService';
import { libraryService } from './libraryService';
import { HistoryEntry } from '../types/history';
import { TrackMetadata } from '../types/audio';

export interface CalendarDayStat {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1-31
  dayOfWeek: number; // 0-6 (Sun-Sat)
  totalSeconds: number;
  tracksPlayed: number;
  completedPlays: number;
  mostPlayedTrack: {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    playCount: number;
    artworkDataUrl?: string;
  } | null;
  heatmapLevel: 0 | 1 | 2 | 3 | 4; // 0=none, 1=1-15m, 2=15-45m, 3=45-90m, 4=>90m
}

export interface CalendarMonthSummary {
  year: number;
  month: number; // 0-11
  monthName: string;
  totalSeconds: number;
  totalTracksPlayed: number;
  uniqueArtistsCount: number;
  topDay: { dayNumber: number; date: string; seconds: number } | null;
  days: CalendarDayStat[];
  firstDayOfWeek: number; // 0-6
  daysInMonth: number;
}

export interface DayTrackEvent {
  historyId: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artworkDataUrl?: string;
  playedAt: number;
  timeString: string; // e.g. "14:23"
  playbackDuration: number;
  duration: number;
  completionStatus: 'completed' | 'partial' | 'skipped';
  track?: TrackMetadata;
}

export interface YearMonthStat {
  monthIndex: number;
  monthLabel: string;
  totalSeconds: number;
  tracksPlayed: number;
  hours: number;
}

export class CalendarService {
  private static readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Get calendar data for a given month and year
   */
  public getMonthData(year: number, month: number): CalendarMonthSummary {
    const history = historyService.getHistory();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const monthName = CalendarService.MONTH_NAMES[month];

    // Group history entries by day
    const entriesByDay = new Map<number, HistoryEntry[]>();
    const monthArtists = new Set<string>();

    for (const entry of history) {
      const d = new Date(entry.playedAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const list = entriesByDay.get(day) || [];
        list.push(entry);
        entriesByDay.set(day, list);
        if (entry.artist) monthArtists.add(entry.artist.toLowerCase());
      }
    }

    let monthTotalSeconds = 0;
    let monthTotalTracks = 0;
    let topDay: { dayNumber: number; date: string; seconds: number } | null = null;
    let maxDaySeconds = 0;

    const days: CalendarDayStat[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const dayOfWeek = dayDate.getDay();
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      const entries = entriesByDay.get(day) || [];
      let daySeconds = 0;
      let completedCount = 0;
      const trackPlayCounts = new Map<string, { entry: HistoryEntry; count: number }>();

      for (const e of entries) {
        daySeconds += e.playbackDuration || 0;
        if (e.completionStatus === 'completed') completedCount++;
        const curr = trackPlayCounts.get(e.trackId) || { entry: e, count: 0 };
        curr.count++;
        trackPlayCounts.set(e.trackId, curr);
      }

      monthTotalSeconds += daySeconds;
      monthTotalTracks += entries.length;

      if (daySeconds > maxDaySeconds) {
        maxDaySeconds = daySeconds;
        topDay = { dayNumber: day, date: dateStr, seconds: daySeconds };
      }

      // Determine most played track for the day
      let mostPlayedTrack: CalendarDayStat['mostPlayedTrack'] = null;
      let topCount = 0;
      for (const { entry, count } of trackPlayCounts.values()) {
        if (count > topCount) {
          topCount = count;
          mostPlayedTrack = {
            trackId: entry.trackId,
            title: entry.title,
            artist: entry.artist,
            album: entry.album,
            playCount: count,
            artworkDataUrl: entry.artworkDataUrl,
          };
        }
      }

      // Heatmap level calculation
      const heatmapLevel = this.calculateHeatmapLevel(daySeconds);

      days.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        totalSeconds: daySeconds,
        tracksPlayed: entries.length,
        completedPlays: completedCount,
        mostPlayedTrack,
        heatmapLevel,
      });
    }

    return {
      year,
      month,
      monthName,
      totalSeconds: monthTotalSeconds,
      totalTracksPlayed: monthTotalTracks,
      uniqueArtistsCount: monthArtists.size,
      topDay,
      days,
      firstDayOfWeek,
      daysInMonth,
    };
  }

  /**
   * Get all tracks played on a specific date (ordered chronologically)
   */
  public getDayTracks(year: number, month: number, day: number): DayTrackEvent[] {
    const history = historyService.getHistory();
    const results: DayTrackEvent[] = [];

    for (const e of history) {
      const d = new Date(e.playedAt);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tr = libraryService.getTrack(e.trackId);
        results.push({
          historyId: e.id,
          trackId: e.trackId,
          title: e.title,
          artist: e.artist,
          album: e.album,
          artworkDataUrl: e.artworkDataUrl || tr?.artworkDataUrl,
          playedAt: e.playedAt,
          timeString,
          playbackDuration: e.playbackDuration || 0,
          duration: e.duration || tr?.duration || 0,
          completionStatus: e.completionStatus,
          track: tr,
        });
      }
    }

    // Sort chronologically (oldest to newest)
    return results.sort((a, b) => a.playedAt - b.playedAt);
  }

  /**
   * Yearly overview for a given year (12-month summary)
   */
  public getYearOverview(year: number): YearMonthStat[] {
    const history = historyService.getHistory();
    const monthTotals = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      monthLabel: CalendarService.MONTH_NAMES[i].slice(0, 3),
      totalSeconds: 0,
      tracksPlayed: 0,
      hours: 0,
    }));

    for (const e of history) {
      const d = new Date(e.playedAt);
      if (d.getFullYear() === year) {
        const m = d.getMonth();
        monthTotals[m].totalSeconds += e.playbackDuration || 0;
        monthTotals[m].tracksPlayed += 1;
      }
    }

    for (const mt of monthTotals) {
      mt.hours = parseFloat((mt.totalSeconds / 3600).toFixed(1));
    }

    return monthTotals;
  }

  public calculateHeatmapLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
    const minutes = seconds / 60;
    if (minutes >= 90) return 4;
    if (minutes >= 45) return 3;
    if (minutes >= 15) return 2;
    if (minutes > 0) return 1;
    return 0;
  }

  public formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public getCalendarDaysForMonth(year: number, month: number): CalendarDayStat[] {
    return this.getMonthData(year, month).days;
  }

  public getMonthlySummary(year: number, month: number) {
    const data = this.getMonthData(year, month);
    const daysActive = data.days.filter((d) => d.totalSeconds > 0).length;
    return {
      totalSeconds: data.totalSeconds,
      totalTracks: data.totalTracksPlayed,
      uniqueArtists: data.uniqueArtistsCount,
      daysActive,
      topDay: data.topDay,
    };
  }

  public getDailyTimeline(dateKey: string) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const events = this.getDayTracks(y, m - 1, d);
    let totalDurationSeconds = 0;
    const trackCounts = new Map<string, { track: any; count: number }>();
    for (const ev of events) {
      totalDurationSeconds += ev.playbackDuration || 0;
      const curr = trackCounts.get(ev.trackId) || { track: ev, count: 0 };
      curr.count++;
      trackCounts.set(ev.trackId, curr);
    }
    let mostPlayedTrack: any = null;
    let maxCount = 0;
    for (const item of trackCounts.values()) {
      if (item.count > maxCount) {
        maxCount = item.count;
        mostPlayedTrack = item.track;
      }
    }
    return {
      date: dateKey,
      totalTracksPlayed: events.length,
      totalDurationSeconds,
      mostPlayedTrack,
      events,
    };
  }
}

export const calendarService = new CalendarService();
