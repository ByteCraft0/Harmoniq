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
  Globe,
  Radio,
  Layers,
} from 'lucide-react';

export const ListeningStatsDashboard: React.FC = () => {
  const { tracks, albums } = useLibrary();
  const { playTrack } = usePlayer();
  const [chartRange, setChartRange] = useState<'7days' | 'weekly' | '30days' | 'monthly'>('7days');
  const [isEditingGoals, setIsEditingGoals] = useState(false);

  // Dynamic goals state
  const [goals, setGoals] = useState(() => statsService.getListeningGoals());
  const [tempWeeklyHours, setTempWeeklyHours] = useState(goals.weeklyTargetHours);
  const [tempDailyMinutes, setTempDailyMinutes] = useState(goals.dailyTargetMinutes);

  // Aggregated Statistics
  const totals = useMemo(() => statsService.getListeningTotals(), []);
  const streak = useMemo(() => statsService.calculateStreak(), []);
  const mostActiveDay = useMemo(() => statsService.getMostActiveDay(), []);
  const dailyPoints = useMemo(
    () => statsService.getDailyActivity(chartRange === '30days' ? 30 : 7),
    [chartRange]
  );
  const weeklyPoints = useMemo(() => statsService.getWeeklyActivity(8), []);
  const monthlyPoints = useMemo(() => statsService.getMonthlyActivity(6), []);
  const topArtists = useMemo(() => statsService.getTopArtists(5), []);
  const topAlbums = useMemo(() => statsService.getTopAlbums(5), []);
  const topGenres = useMemo(() => statsService.getGenreDistribution(), [tracks]);
  const providerDist = useMemo(() => statsService.getProviderDistribution(), []);
  const favoriteArtists = useMemo(() => statsService.getFavoriteArtists(5), []);
  const recentlyDiscovered = useMemo(() => statsService.getRecentlyDiscoveredArtists(5), []);
  const milestones = useMemo(() => statsService.getAudiophileMilestones(), [tracks]);

  // Top 10 most played tracks
  const topTracks = useMemo(() => statsService.getTopTracks(10), []);

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
    if (chartRange === 'weekly') {
      const maxM = Math.max(...weeklyPoints.map((p) => p.minutes), 1);
      return maxM;
    }
    const maxM = Math.max(...dailyPoints.map((p) => p.minutes), 1);
    return maxM;
  }, [chartRange, dailyPoints, weeklyPoints, monthlyPoints]);

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
                Personalized listening analytics, goals, streak momentum, and provider distribution
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-1">
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

        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-1">
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

        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">
            Today
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatMinutes(totals.todaySeconds)}
          </div>
          <span className="text-[10px] text-[#71717A]">Active listening session</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-1">
          <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">
            Peak Listening Day
          </span>
          <div className="text-2xl font-black text-violet-400 font-mono-numbers truncate">
            {mostActiveDay ? mostActiveDay.dayOfWeek : 'N/A'}
          </div>
          <span className="text-[10px] text-[#71717A] font-mono-numbers">
            {mostActiveDay ? `${formatHours(mostActiveDay.listeningSeconds)} logged` : 'No history yet'}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Flame size={13} className="text-amber-400 fill-amber-400" /> Streak
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono-numbers">
            {streak.currentStreak} Day{streak.currentStreak !== 1 ? 's' : ''}
          </div>
          <span className="text-[10px] text-amber-400/70 font-mono-numbers">
            Record: {streak.longestStreak} days
          </span>
        </div>
      </div>

      {/* Goals & Habit Tracker */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-5">
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

      {/* Interactive Activity Chart */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-5">
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
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setChartRange('weekly')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === 'weekly'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              8 Weeks
            </button>
            <button
              onClick={() => setChartRange('30days')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === '30days'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setChartRange('monthly')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                chartRange === 'monthly'
                  ? 'bg-[#7C3AED] text-white shadow-sm'
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
                      className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-[#7C3AED] to-[#A78BFA] group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                    />
                    <span className="text-[10px] text-[#71717A] font-mono-numbers mt-2 truncate w-full text-center">
                      {pt.monthLabel}
                    </span>
                  </div>
                );
              })
            : chartRange === 'weekly'
            ? weeklyPoints.map((pt, idx) => {
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
                      className="w-full max-w-[36px] rounded-t-md bg-gradient-to-t from-sky-600 to-sky-400 group-hover:brightness-125 transition-all"
                      style={{ height: `${Math.max(5, heightPercent)}%` }}
                    />
                    <span className="text-[9px] text-[#71717A] font-mono-numbers mt-2 truncate w-full text-center">
                      {pt.weekLabel}
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
                      className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[#7C3AED] to-[#A78BFA] group-hover:brightness-125 transition-all"
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

      {/* Two Column Layout: Top Artists & Top Albums */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Artists Horizontal Chart */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#A78BFA]" />
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
                        className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Albums Horizontal Chart */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
          <div className="flex items-center gap-2">
            <Disc size={16} className="text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Top Albums</h3>
          </div>

          <div className="space-y-3">
            {topAlbums.length === 0 ? (
              <p className="text-xs text-[#71717A]">No album playback recorded yet</p>
            ) : (
              topAlbums.map((album, idx) => {
                const maxSec = topAlbums[0].listeningSeconds || 1;
                const widthPct = Math.max(5, (album.listeningSeconds / maxSec) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white truncate max-w-[220px]">
                        {idx + 1}. {album.title}
                        <span className="text-zinc-500 font-normal ml-1">by {album.artist}</span>
                      </span>
                      <span className="text-[11px] font-mono-numbers text-[#A1A1AA]">
                        {formatHours(album.listeningSeconds)} ({album.playCount} plays)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Provider Distribution & Top Genres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Distribution */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Provider-Wise Listening Share
            </h3>
          </div>

          <div className="space-y-3">
            {providerDist.length === 0 ? (
              <p className="text-xs text-[#71717A]">No provider activity recorded yet</p>
            ) : (
              providerDist.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.provider}
                    </span>
                    <span className="text-[11px] font-mono-numbers text-[#A1A1AA]">
                      {p.percentage}% ({p.count} tracks • {formatHours(p.seconds)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(4, p.percentage)}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Genres Breakdown */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
          <div className="flex items-center gap-2">
            <Disc size={16} className="text-[#A78BFA]" />
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
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-[#A78BFA]" />
          <h3 className="text-base font-bold text-white tracking-tight">
            Top 10 Most-Played Tracks
          </h3>
        </div>

        <div className="divide-y divide-[#272733]/50">
          {topTracks.length === 0 ? (
            <p className="text-xs text-[#71717A] py-4">No completed track plays recorded yet</p>
          ) : (
            topTracks.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => {
                  const match = tracks.find((t) => t.id === track.id);
                  if (match) playTrack(match);
                }}
                className="group flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-5 text-right font-mono-numbers text-[#71717A] font-bold">
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-[#272733] shrink-0 flex items-center justify-center">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={14} className="text-[#A78BFA]" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-white truncate group-hover:text-[#A78BFA] transition-colors">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] truncate">
                      {track.artist} • {track.album}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono-numbers text-[#A1A1AA]">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/20 text-[#A78BFA] border border-[#7C3AED]/30">
                    {track.playCount} plays
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {formatHours(track.listeningSeconds)}
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
