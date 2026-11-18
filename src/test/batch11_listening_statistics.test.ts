import { describe, it, expect, vi, afterEach } from 'vitest';
import { statsService } from '../services/statsService';
import { historyService } from '../services/historyService';
import { HistoryEntry } from '../types/history';

describe('Batch 11: Listening Statistics & Dashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates listening totals correctly from history entries', () => {
    const now = Date.now();
    const mockEntries: HistoryEntry[] = [
      {
        id: 'h1',
        trackId: 't1',
        title: 'Song 1',
        artist: 'Artist A',
        album: 'Album 1',
        playbackDuration: 180,
        duration: 200,
        completionStatus: 'completed',
        playedAt: now, // Today
      },
      {
        id: 'h2',
        trackId: 't2',
        title: 'Song 2',
        artist: 'Artist B',
        album: 'Album 2',
        playbackDuration: 60,
        duration: 200,
        completionStatus: 'partial',
        playedAt: now - 60 * 1000, // Today
      },
      {
        id: 'h3',
        trackId: 't3',
        title: 'Song 3',
        artist: 'Artist A',
        album: 'Album 1',
        playbackDuration: 240,
        duration: 240,
        completionStatus: 'completed',
        playedAt: now - 86400 * 1000 * 40, // 40 days ago
      },
    ];

    vi.spyOn(historyService, 'getHistory').mockReturnValue(mockEntries);

    const totals = statsService.getListeningTotals();
    expect(totals.allTimeSeconds).toBe(180 + 60 + 240);
    expect(totals.todaySeconds).toBe(180 + 60);
    expect(totals.totalCompletedPlays).toBe(2);
  });

  it('aggregates daily activity into accurate bins', () => {
    const now = Date.now();
    const mockEntries: HistoryEntry[] = [
      {
        id: 'h1',
        trackId: 't1',
        title: 'Song 1',
        artist: 'Artist A',
        album: 'Album 1',
        playbackDuration: 300,
        duration: 300,
        completionStatus: 'completed',
        playedAt: now,
      },
    ];

    vi.spyOn(historyService, 'getHistory').mockReturnValue(mockEntries);

    const dailyPoints = statsService.getDailyActivity(7);
    expect(dailyPoints.length).toBe(7);
    const todayPoint = dailyPoints[dailyPoints.length - 1];
    expect(todayPoint.seconds).toBe(300);
    expect(todayPoint.minutes).toBe(5);
    expect(todayPoint.tracksPlayed).toBe(1);
  });

  it('calculates current and longest streaks based on active days', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 86400 * 1000 * 2);

    const mockEntries: HistoryEntry[] = [
      {
        id: 'h1',
        trackId: 't1',
        title: 'Song 1',
        artist: 'Artist A',
        album: 'Album A',
        playbackDuration: 120,
        duration: 180,
        completionStatus: 'completed',
        playedAt: today.getTime(),
      },
      {
        id: 'h2',
        trackId: 't2',
        title: 'Song 2',
        artist: 'Artist B',
        album: 'Album B',
        playbackDuration: 120,
        duration: 180,
        completionStatus: 'completed',
        playedAt: yesterday.getTime(),
      },
      {
        id: 'h3',
        trackId: 't3',
        title: 'Song 3',
        artist: 'Artist C',
        album: 'Album C',
        playbackDuration: 120,
        duration: 180,
        completionStatus: 'completed',
        playedAt: twoDaysAgo.getTime(),
      },
    ];

    vi.spyOn(historyService, 'getHistory').mockReturnValue(mockEntries);

    const streak = statsService.calculateStreak();
    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
  });

  it('ranks top artists accurately by listening duration', () => {
    const mockEntries: HistoryEntry[] = [
      {
        id: 'h1',
        trackId: 't1',
        title: 'Song 1',
        artist: 'Radiohead',
        album: 'OK Computer',
        playbackDuration: 500,
        duration: 500,
        completionStatus: 'completed',
        playedAt: Date.now(),
      },
      {
        id: 'h2',
        trackId: 't2',
        title: 'Song 2',
        artist: 'Pink Floyd',
        album: 'The Dark Side of the Moon',
        playbackDuration: 800,
        duration: 800,
        completionStatus: 'completed',
        playedAt: Date.now(),
      },
      {
        id: 'h3',
        trackId: 't3',
        title: 'Song 3',
        artist: 'Radiohead',
        album: 'Kid A',
        playbackDuration: 200,
        duration: 200,
        completionStatus: 'completed',
        playedAt: Date.now(),
      },
    ];

    vi.spyOn(historyService, 'getHistory').mockReturnValue(mockEntries);

    const topArtists = statsService.getTopArtists(2);
    expect(topArtists.length).toBe(2);
    expect(topArtists[0].name).toBe('Pink Floyd');
    expect(topArtists[0].listeningSeconds).toBe(800);
    expect(topArtists[1].name).toBe('Radiohead');
    expect(topArtists[1].listeningSeconds).toBe(700);
    expect(topArtists[1].playCount).toBe(2);
  });
});
