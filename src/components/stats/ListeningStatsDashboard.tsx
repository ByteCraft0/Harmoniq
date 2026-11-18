import React, { useState, useMemo } from 'react';
import { statsService } from '../../services/statsService';
import { historyService } from '../../services/historyService';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import {
  BarChart3,
  Clock,
  Flame,
  Music,
  Users,
  Disc,
  Play,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export const ListeningStatsDashboard: React.FC = () => {
  const { tracks, albums } = useLibrary();
  const { playTrack } = usePlayer();
  const [chartRange, setChartRange] = useState<'7days' | '30days' | 'monthly'>('7days');

  // Aggregated Statistics
  const totals = useMemo(() => statsService.getListeningTotals(), []);
  const streak = useMemo(() => statsService.calculateStreak(), []);
  const dailyPoints = useMemo(
    () => statsService.getDailyActivity(chartRange === '30days' ? 30 : 7),
    [chartRange]
  );
  const monthlyPoints = useMemo(() => statsService.getMonthlyActivity(6), []);
  const topArtists = useMemo(() => statsService.getTopArtists(5), []);
  const topGenres = useMemo(() => statsService.getGenreDistribution(), [tracks]);

  // Top 10 most played tracks
  const topTracks = useMemo(() => {
    return [...tracks]
      .filter((t) => (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 10);
  }, [tracks]);

  // Top 5 albums
  const topAlbums = useMemo(() => {
    return [...albums]
      .map((alb) => {
        const totalPlays = alb.tracks.reduce((s, t) => s + (t.playCount || 0), 0);
        return { album: alb, totalPlays };
      })
      .filter((a) => a.totalPlays > 0)
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, 5);
  }, [albums]);

  const formatHours = (seconds: number) => {
    if (!seconds) return '0 hrs';
    const hrs = (seconds / 3600).toFixed(1);
    return `${hrs} hrs`;
  };

  const formatMinutes = (seconds: number) => {
    if (!seconds) return '0 min';
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  // Find max value for chart scaling
  const maxChartValue = useMemo(() => {
    if (chartRange === 'monthly') {
      const maxH = Math.max(...monthlyPoints.map((p) => p.hours), 1);
      return maxH;
    }
    const maxM = Math.max(...dailyPoints.map((p) => p.minutes), 1);
    return maxM;
  }, [chartRange, dailyPoints, monthlyPoints]);

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Listening Statistics</h1>
              <p className="text-xs text-zinc-400">
                Live metrics, historical trends, listening streaks, and library intelligence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            All-Time Listening
          </span>
          <div className="text-2xl font-black text-violet-300 font-mono-numbers">
            {formatHours(totals.allTimeSeconds)}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono-numbers">
            {totals.totalCompletedPlays} completed plays
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            This Month
          </span>
          <div className="text-2xl font-black text-sky-400 font-mono-numbers">
            {formatHours(totals.thisMonthSeconds)}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono-numbers">
            {formatMinutes(totals.thisWeekSeconds)} this week
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Today
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatMinutes(totals.todaySeconds)}
          </div>
          <span className="text-[10px] text-zinc-500">Active listening session</span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Flame size={13} className="text-amber-400 fill-amber-400" /> Listening Streak
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono-numbers">
            {streak.currentStreak} Day{streak.currentStreak !== 1 ? 's' : ''}
          </div>
          <span className="text-[10px] text-amber-400/70 font-mono-numbers">
            Longest record: {streak.longestStreak} days
          </span>
        </div>
      </div>

      {/* Interactive Activity Chart */}
      <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar size={16} className="text-violet-400" />
              Listening Activity & Duration Trends
            </h3>
            <p className="text-xs text-zinc-400">
              Audio playback duration in {chartRange === 'monthly' ? 'hours' : 'minutes'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setChartRange('7days')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === '7days'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setChartRange('30days')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === '30days'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setChartRange('monthly')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === 'monthly'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              6 Months
            </button>
          </div>
        </div>

        {/* SVG Bar Chart */}
        <div className="h-56 w-full flex items-end gap-2 pt-6 pb-2 border-b border-white/5">
          {chartRange === 'monthly'
            ? monthlyPoints.map((pt, idx) => {
                const heightPercent = maxChartValue > 0 ? (pt.hours / maxChartValue) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-[10px] text-white font-mono whitespace-nowrap z-10 shadow-lg">
                      {pt.hours} hrs ({pt.tracksPlayed} plays)
                    </div>

                    <div
                      className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-violet-700 to-violet-400 group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                    />
                    <span className="text-[10px] text-zinc-500 font-mono-numbers mt-2 truncate w-full text-center">
                      {pt.monthLabel}
                    </span>
                  </div>
                );
              })
            : dailyPoints.map((pt, idx) => {
                const heightPercent = maxChartValue > 0 ? (pt.minutes / maxChartValue) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-[10px] text-white font-mono whitespace-nowrap z-10 shadow-lg">
                      {pt.minutes} min ({pt.tracksPlayed} plays)
                    </div>

                    <div
                      className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-violet-700 to-violet-400 group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                    />
                    <span className="text-[9px] text-zinc-500 font-mono-numbers mt-2 truncate w-full text-center">
                      {pt.dayLabel}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Two Column Layout: Top Artists & Genre Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Artists Horizontal Chart */}
        <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-violet-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Top Artists</h3>
          </div>

          <div className="space-y-3">
            {topArtists.length === 0 ? (
              <p className="text-xs text-zinc-500">No playback recorded yet</p>
            ) : (
              topArtists.map((artist, idx) => {
                const maxSec = topArtists[0].listeningSeconds || 1;
                const widthPct = Math.max(5, (artist.listeningSeconds / maxSec) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white truncate max-w-[200px]">
                        {idx + 1}. {artist.name}
                      </span>
                      <span className="text-[11px] font-mono-numbers text-zinc-400">
                        {formatHours(artist.listeningSeconds)} ({artist.playCount} plays)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Genres Breakdown */}
        <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Disc size={16} className="text-violet-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Genre Distribution</h3>
          </div>

          <div className="space-y-3">
            {topGenres.length === 0 ? (
              <p className="text-xs text-zinc-500">No genres found in library</p>
            ) : (
              topGenres.map((g, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white truncate flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.genre}
                    </span>
                    <span className="text-[11px] font-mono-numbers text-zinc-400">
                      {g.percentage}% ({g.count} tracks)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${g.percentage}%`, backgroundColor: g.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top 10 Most-Played Tracks */}
      <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-violet-400" />
          <h3 className="text-base font-bold text-white tracking-tight">
            Top 10 Most-Played Tracks
          </h3>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {topTracks.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No completed track plays recorded yet</p>
          ) : (
            topTracks.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, topTracks)}
                className="group flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-5 text-right font-mono-numbers text-zinc-500 font-bold">
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    {track.artworkDataUrl ? (
                      <img src={track.artworkDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={14} className="text-violet-400" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {track.artist} • {track.album}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono-numbers text-zinc-400">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600/20 text-violet-300 border border-violet-500/20">
                    {track.playCount} plays
                  </span>
                  <span>
                    {Math.floor(track.duration / 60)}:
                    {Math.floor(track.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
