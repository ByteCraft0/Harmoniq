import React, { useState, useMemo } from 'react';
import { statsService } from '../../services/statsService';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import {
  BarChart3,
  Flame,
  Music,
  Users,
  Disc,
  Calendar,
  Sparkles,
  Target,
  Trophy,
  Gauge,
  Moon,
  Compass,
  Clock,
  Edit2,
  Check,
} from 'lucide-react';

export const ListeningStatsDashboard: React.FC = () => {
  const { tracks, albums } = useLibrary();
  const { playTrack } = usePlayer();
  const [chartRange, setChartRange] = useState<'7days' | '30days' | 'monthly'>('7days');
  const [isEditingGoals, setIsEditingGoals] = useState(false);

  // Dynamic goals state
  const [goals, setGoals] = useState(() => statsService.getListeningGoals());
  const [tempWeeklyHours, setTempWeeklyHours] = useState(goals.weeklyTargetHours);
  const [tempDailyMinutes, setTempDailyMinutes] = useState(goals.dailyTargetMinutes);

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
  const milestones = useMemo(() => statsService.getAudiophileMilestones(), [tracks]);

  // Top 10 most played tracks
  const topTracks = useMemo(() => {
    return [...tracks]
      .filter((t) => (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 10);
  }, [tracks]);

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

  const handleSaveGoals = () => {
    statsService.saveGoalTargets(tempWeeklyHours, tempDailyMinutes);
    setGoals(statsService.getListeningGoals());
    setIsEditingGoals(false);
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

  const getMilestoneIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles size={16} />;
      case 'Gauge':
        return <Gauge size={16} />;
      case 'Disc':
        return <Disc size={16} />;
      case 'Moon':
        return <Moon size={16} />;
      case 'Compass':
        return <Compass size={16} />;
      case 'Flame':
        return <Flame size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[var(--ambient-primary)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] shadow-[var(--glow-dynamic)]">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Listening Statistics</h1>
              <p className="text-xs text-[#A1A1AA]">
                Personalized listening analytics, goals, streak momentum, and audiophile milestones
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">
            All-Time Listening
          </span>
          <div className="text-2xl font-black text-[var(--accent-primary)] font-mono-numbers">
            {formatHours(totals.allTimeSeconds)}
          </div>
          <span className="text-[10px] text-[#71717A] font-mono-numbers">
            {totals.totalCompletedPlays} completed plays
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">
            This Month
          </span>
          <div className="text-2xl font-black text-sky-400 font-mono-numbers">
            {formatHours(totals.thisMonthSeconds)}
          </div>
          <span className="text-[10px] text-[#71717A] font-mono-numbers">
            {formatMinutes(totals.thisWeekSeconds)} this week
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">
            Today
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatMinutes(totals.todaySeconds)}
          </div>
          <span className="text-[10px] text-[#71717A]">Active listening session</span>
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

      {/* Harmoniq 2.0 Personalization: Goals & Habit Tracker */}
      <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-[var(--accent-primary)]">
              <Target size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Listening Goals & Progress</h3>
              <p className="text-xs text-[#A1A1AA]">
                Personal audiophile goals for weekly listening and daily focus
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isEditingGoals) handleSaveGoals();
              else setIsEditingGoals(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
          >
            {isEditingGoals ? (
              <>
                <Check size={13} className="text-emerald-400" /> Save Goals
              </>
            ) : (
              <>
                <Edit2 size={13} className="text-[var(--accent-primary)]" /> Customize Goals
              </>
            )}
          </button>
        </div>

        {/* Goals Progress Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weekly Goal */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Calendar size={14} className="text-[var(--accent-primary)]" /> Weekly Listening Goal
              </span>
              <span className="text-xs font-mono-numbers font-bold text-[var(--accent-primary)]">
                {goals.weeklyProgressPercent}%
              </span>
            </div>

            {isEditingGoals ? (
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#A1A1AA]">Target Hours:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tempWeeklyHours}
                  onChange={(e) => setTempWeeklyHours(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-xs text-white font-mono-numbers text-center focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <span className="text-xs text-[#71717A]">hrs/week</span>
              </div>
            ) : (
              <div className="flex items-baseline justify-between text-xs text-[#A1A1AA]">
                <span>
                  Logged <strong className="text-white font-mono-numbers">{formatHours(goals.weeklyListenedSeconds)}</strong>
                </span>
                <span>
                  Target: <strong className="text-white font-mono-numbers">{goals.weeklyTargetHours} hrs</strong>
                </span>
              </div>
            )}

            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent-secondary)] to-[var(--accent-primary)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, goals.weeklyProgressPercent)}%` }}
              />
            </div>
          </div>

          {/* Daily Goal */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-400" /> Daily Focus Goal
              </span>
              <span className="text-xs font-mono-numbers font-bold text-emerald-400">
                {goals.dailyProgressPercent}%
              </span>
            </div>

            {isEditingGoals ? (
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#A1A1AA]">Target Minutes:</label>
                <input
                  type="number"
                  min="10"
                  max="480"
                  step="5"
                  value={tempDailyMinutes}
                  onChange={(e) => setTempDailyMinutes(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-xs text-white font-mono-numbers text-center focus:outline-none focus:border-emerald-400"
                />
                <span className="text-xs text-[#71717A]">mins/day</span>
              </div>
            ) : (
              <div className="flex items-baseline justify-between text-xs text-[#A1A1AA]">
                <span>
                  Logged <strong className="text-white font-mono-numbers">{formatMinutes(goals.todayListenedSeconds)}</strong>
                </span>
                <span>
                  Target: <strong className="text-white font-mono-numbers">{goals.dailyTargetMinutes} mins</strong>
                </span>
              </div>
            )}

            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, goals.dailyProgressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Harmoniq 2.0 Audiophile Milestones Showcase */}
      <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Audiophile Milestones</h3>
              <p className="text-xs text-[#A1A1AA]">
                Earned badges and achievement tracker across fidelity, volume, and habits
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-numbers text-amber-400/90 font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            {milestones.filter((m) => m.unlocked).length} / {milestones.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`p-4 rounded-xl border transition-all relative overflow-hidden group ${
                milestone.unlocked
                  ? 'bg-gradient-to-br from-violet-600/10 via-white/[0.02] to-transparent border-[var(--accent-primary)]/40 shadow-[0_0_15px_rgba(167,139,250,0.1)]'
                  : 'bg-white/[0.01] border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div
                  className={`p-2 rounded-xl border ${
                    milestone.unlocked
                      ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/40 text-[var(--accent-primary)] shadow-sm'
                      : 'bg-white/5 border-white/10 text-[#71717A]'
                  }`}
                >
                  {getMilestoneIcon(milestone.icon)}
                </div>
                <span
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    milestone.unlocked
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold'
                      : 'bg-white/5 border-white/10 text-[#71717A]'
                  }`}
                >
                  {milestone.unlocked ? 'Unlocked' : `${milestone.progress}%`}
                </span>
              </div>

              <h4 className="text-xs font-bold text-white tracking-tight mb-1">
                {milestone.title}
              </h4>
              <p className="text-[11px] text-[#A1A1AA] leading-snug line-clamp-2">
                {milestone.description}
              </p>

              {!milestone.unlocked && (
                <div className="mt-3 w-full h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-zinc-600 rounded-full"
                    style={{ width: `${milestone.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Activity Chart */}
      <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar size={16} className="text-[var(--accent-primary)]" />
              Listening Activity & Duration Trends
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Audio playback duration in {chartRange === 'monthly' ? 'hours' : 'minutes'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setChartRange('7days')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === '7days'
                  ? 'bg-[var(--accent-secondary)] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setChartRange('30days')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === '30days'
                  ? 'bg-[var(--accent-secondary)] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setChartRange('monthly')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === 'monthly'
                  ? 'bg-[var(--accent-secondary)] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
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
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-[10px] text-white font-mono whitespace-nowrap z-10 shadow-lg">
                      {pt.hours} hrs ({pt.tracksPlayed} plays)
                    </div>

                    <div
                      className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-[var(--accent-secondary)] to-[var(--accent-primary)] group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                    />
                    <span className="text-[10px] text-[#71717A] font-mono-numbers mt-2 truncate w-full text-center">
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
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded bg-[#1B1B24] border border-white/10 text-[10px] text-white font-mono whitespace-nowrap z-10 shadow-lg">
                      {pt.minutes} min ({pt.tracksPlayed} plays)
                    </div>

                    <div
                      className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[var(--accent-secondary)] to-[var(--accent-primary)] group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                    />
                    <span className="text-[9px] text-[#71717A] font-mono-numbers mt-2 truncate w-full text-center">
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
            <Users size={16} className="text-[var(--accent-primary)]" />
            <h3 className="text-base font-bold text-white tracking-tight">Top Artists</h3>
          </div>

          <div className="space-y-3">
            {topArtists.length === 0 ? (
              <p className="text-xs text-[#71717A]">No playback recorded yet</p>
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
                      <span className="text-[11px] font-mono-numbers text-[#A1A1AA]">
                        {formatHours(artist.listeningSeconds)} ({artist.playCount} plays)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent-secondary)] to-[var(--accent-primary)] rounded-full"
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
            <Disc size={16} className="text-[var(--accent-primary)]" />
            <h3 className="text-base font-bold text-white tracking-tight">Genre Distribution</h3>
          </div>

          <div className="space-y-3">
            {topGenres.length === 0 ? (
              <p className="text-xs text-[#71717A]">No genres found in library</p>
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
                    <span className="text-[11px] font-mono-numbers text-[#A1A1AA]">
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
          <Music size={16} className="text-[var(--accent-primary)]" />
          <h3 className="text-base font-bold text-white tracking-tight">
            Top 10 Most-Played Tracks
          </h3>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {topTracks.length === 0 ? (
            <p className="text-xs text-[#71717A] py-4">No completed track plays recorded yet</p>
          ) : (
            topTracks.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, topTracks)}
                className="group flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-5 text-right font-mono-numbers text-[#71717A] font-bold">
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    {track.artworkDataUrl ? (
                      <img src={track.artworkDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={14} className="text-[var(--accent-primary)]" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] truncate">
                      {track.artist} • {track.album}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono-numbers text-[#A1A1AA]">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-secondary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
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
