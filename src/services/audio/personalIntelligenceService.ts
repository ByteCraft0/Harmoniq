import { historyService } from '../historyService';
import { sessionTrackingService } from '../sessionTrackingService';
import { libraryService } from '../libraryService';
import { HistoryEntry } from '../../types/history';

export type IntelligenceTimeRange = '7d' | '30d' | 'all';

export interface TopArtistStat {
  name: string;
  playCount: number;
  durationSeconds: number;
  affinityScore: number;
}

export interface TopAlbumStat {
  title: string;
  artist: string;
  playCount: number;
  durationSeconds: number;
}

export interface GenreStat {
  genre: string;
  playCount: number;
  durationSeconds: number;
  completionRate: number;
  skipRate: number;
}

export interface TimeOfDayDistribution {
  morning: number;   // 06:00 - 11:59
  afternoon: number; // 12:00 - 16:59
  evening: number;   // 17:00 - 21:59
  night: number;     // 22:00 - 05:59
}

export interface PersonalListeningProfile {
  totalListeningSeconds: number;
  totalPlays: number;
  completedPlays: number;
  skippedPlays: number;
  completionRate: number; // 0 - 100%
  skipRate: number;       // 0 - 100%
  topArtists: TopArtistStat[];
  topAlbums: TopAlbumStat[];
  topGenres: GenreStat[];
  timeOfDayDistribution: TimeOfDayDistribution;
  dayOfWeekDistribution: number[]; // Index 0 = Sunday ... 6 = Saturday
  weeklyListeningHours: number;
  preferredListeningWindow: 'Morning' | 'Afternoon' | 'Evening' | 'Late Night';
}

const STORAGE_INTEL_ENABLED_KEY = 'harmoniq_intelligence_enabled';

export class PersonalIntelligenceService {
  private enabled = true;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(STORAGE_INTEL_ENABLED_KEY);
        if (val !== null) {
          this.enabled = val === 'true';
        }
      }
    } catch {
      /* ignore */
    }
  }

  public isIntelligenceEnabled(): boolean {
    return this.enabled;
  }

  public setIntelligenceEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_INTEL_ENABLED_KEY, String(enabled));
      }
    } catch {
      /* ignore */
    }
    this.emit();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  public resetIntelligenceData(): void {
    sessionTrackingService.clearSessionHistory();
    this.emit();
  }

  public clearIntelligenceData(): void {
    this.resetIntelligenceData();
  }

  /**
   * Compute comprehensive listening profile for the specified time range
   */
  public getListeningProfile(timeRange: IntelligenceTimeRange = 'all'): PersonalListeningProfile {
    if (!this.enabled) {
      return this.getEmptyProfile();
    }

    const now = Date.now();
    let cutoff = 0;
    if (timeRange === '7d') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '30d') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    const historyEntries = historyService.getHistory().filter((e) => e.playedAt >= cutoff);

    let totalDurationSeconds = 0;
    let completedPlays = 0;
    let skippedPlays = 0;

    const artistMap = new Map<string, { count: number; duration: number; affinity: number }>();
    const albumMap = new Map<string, { title: string; artist: string; count: number; duration: number }>();
    const genreMap = new Map<string, { count: number; duration: number; completes: number; skips: number }>();

    const timeOfDayCounts: TimeOfDayDistribution = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const entry of historyEntries) {
      const dur = entry.playbackDuration || 0;
      totalDurationSeconds += dur;

      if (entry.completionStatus === 'completed') {
        completedPlays++;
      } else if (entry.completionStatus === 'skipped') {
        skippedPlays++;
      }

      // Time of day & day of week
      const date = new Date(entry.playedAt);
      const hour = date.getHours();
      const day = date.getDay();
      dayOfWeekCounts[day]++;

      if (hour >= 6 && hour < 12) {
        timeOfDayCounts.morning++;
      } else if (hour >= 12 && hour < 17) {
        timeOfDayCounts.afternoon++;
      } else if (hour >= 17 && hour < 22) {
        timeOfDayCounts.evening++;
      } else {
        timeOfDayCounts.night++;
      }

      // Artist aggregation with recency and status weighting
      const artist = (entry.artist || 'Unknown Artist').trim();
      const daysAgo = Math.max(0, (now - entry.playedAt) / (1000 * 60 * 60 * 24));
      const recencyWeight = Math.exp(-daysAgo / 30);
      const statusWeight =
        entry.completionStatus === 'completed' ? 1.0 : entry.completionStatus === 'partial' ? 0.5 : 0.1;
      const affinity = (dur / 60) * statusWeight * recencyWeight;

      const currArt = artistMap.get(artist) || { count: 0, duration: 0, affinity: 0 };
      currArt.count++;
      currArt.duration += dur;
      currArt.affinity += affinity;
      artistMap.set(artist, currArt);

      // Album aggregation
      const album = (entry.album || 'Unknown Album').trim();
      if (album && album !== 'Unknown Album') {
        const albumKey = `${artist}___${album}`;
        const currAlb = albumMap.get(albumKey) || { title: album, artist, count: 0, duration: 0 };
        currAlb.count++;
        currAlb.duration += dur;
        albumMap.set(albumKey, currAlb);
      }

      // Genre aggregation
      const cleanGenre = (entry.genre && entry.genre.trim()) || 'Uncategorized';
      const currGen = genreMap.get(cleanGenre) || { count: 0, duration: 0, completes: 0, skips: 0 };
      currGen.count++;
      currGen.duration += dur;
      if (entry.completionStatus === 'completed') currGen.completes++;
      if (entry.completionStatus === 'skipped') currGen.skips++;
      genreMap.set(cleanGenre, currGen);
    }

    const totalPlays = historyEntries.length;
    const completionRate = totalPlays > 0 ? Math.round((completedPlays / totalPlays) * 100) : 0;
    const skipRate = totalPlays > 0 ? Math.round((skippedPlays / totalPlays) * 100) : 0;

    const topArtists: TopArtistStat[] = Array.from(artistMap.entries())
      .map(([name, data]) => ({
        name,
        playCount: data.count,
        durationSeconds: Math.round(data.duration),
        affinityScore: Math.round(data.affinity * 10) / 10,
      }))
      .sort((a, b) => b.affinityScore - a.affinityScore)
      .slice(0, 10);

    const topAlbums: TopAlbumStat[] = Array.from(albumMap.values())
      .map((data) => ({
        title: data.title,
        artist: data.artist,
        playCount: data.count,
        durationSeconds: Math.round(data.duration),
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
      .slice(0, 8);

    const topGenres: GenreStat[] = Array.from(genreMap.entries())
      .map(([genre, data]) => ({
        genre,
        playCount: data.count,
        durationSeconds: Math.round(data.duration),
        completionRate: data.count > 0 ? Math.round((data.completes / data.count) * 100) : 0,
        skipRate: data.count > 0 ? Math.round((data.skips / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
      .slice(0, 8);

    // Preferred listening window
    let preferredListeningWindow: 'Morning' | 'Afternoon' | 'Evening' | 'Late Night' = 'Evening';
    const maxCount = Math.max(
      timeOfDayCounts.morning,
      timeOfDayCounts.afternoon,
      timeOfDayCounts.evening,
      timeOfDayCounts.night
    );
    if (maxCount === timeOfDayCounts.morning && maxCount > 0) preferredListeningWindow = 'Morning';
    else if (maxCount === timeOfDayCounts.afternoon && maxCount > 0) preferredListeningWindow = 'Afternoon';
    else if (maxCount === timeOfDayCounts.night && maxCount > 0) preferredListeningWindow = 'Late Night';

    const weeklyListeningHours = Math.round((totalDurationSeconds / 3600) * 10) / 10;

    return {
      totalListeningSeconds: Math.round(totalDurationSeconds),
      totalPlays,
      completedPlays,
      skippedPlays,
      completionRate,
      skipRate,
      topArtists,
      topAlbums,
      topGenres,
      timeOfDayDistribution: timeOfDayCounts,
      dayOfWeekDistribution: dayOfWeekCounts,
      weeklyListeningHours,
      preferredListeningWindow,
    };
  }

  private getEmptyProfile(): PersonalListeningProfile {
    return {
      totalListeningSeconds: 0,
      totalPlays: 0,
      completedPlays: 0,
      skippedPlays: 0,
      completionRate: 0,
      skipRate: 0,
      topArtists: [],
      topAlbums: [],
      topGenres: [],
      timeOfDayDistribution: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      dayOfWeekDistribution: [0, 0, 0, 0, 0, 0, 0],
      weeklyListeningHours: 0,
      preferredListeningWindow: 'Evening',
    };
  }
}

export const personalIntelligenceService = new PersonalIntelligenceService();
