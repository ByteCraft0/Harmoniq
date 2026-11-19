import React, { useState, useMemo } from 'react';
import { calendarService, CalendarDayStat, DayTrackEvent, CalendarMonthSummary } from '../../services/calendarService';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Music,
  Play,
  Flame,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart2,
} from 'lucide-react';

export const ListeningCalendarView: React.FC = () => {
  const { playTrack } = usePlayer();
  const { tracks: allTracks } = useLibrary();

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'yearly'>('calendar');

  // Month data
  const monthData: CalendarMonthSummary = useMemo(() => {
    return calendarService.getMonthData(currentYear, currentMonth);
  }, [currentYear, currentMonth, allTracks]);

  // Selected day tracks
  const dayTracks: DayTrackEvent[] = useMemo(() => {
    return calendarService.getDayTracks(currentYear, currentMonth, selectedDay);
  }, [currentYear, currentMonth, selectedDay, allTracks]);

  // Year overview
  const yearOverview = useMemo(() => {
    return calendarService.getYearOverview(currentYear);
  }, [currentYear, allTracks]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(1);
  };

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  const formatHours = (seconds: number) => {
    if (!seconds) return '0 hrs';
    const hrs = (seconds / 3600).toFixed(1);
    return `${hrs} hrs`;
  };

  const formatMinutes = (seconds: number) => {
    if (!seconds) return '0m';
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
  };

  // Day cell padding for start of month
  const emptyDaysPrefix = Array.from({ length: monthData.firstDayOfWeek }, (_, i) => i);

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[var(--ambient-primary)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] shadow-[var(--glow-dynamic)]">
            <CalendarIcon size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Listening Calendar</h1>
            <p className="text-xs text-[#A1A1AA]">
              Explore genuine listening history, playback sessions, timelines, and activity heatmaps
            </p>
          </div>
        </div>

        {/* Navigation & View Switcher */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#14141B] border border-[#272733] rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-[var(--accent-primary)] text-black font-bold shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'yearly'
                  ? 'bg-[var(--accent-primary)] text-black font-bold shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Yearly Overview
            </button>
          </div>

          {/* Month Steppers */}
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-1 bg-[#14141B] border border-[#272733] rounded-xl p-1 text-xs">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1.5 rounded-lg hover:bg-white/5 text-[#A1A1AA] hover:text-white transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-white px-2 font-mono-numbers">
                {monthData.monthName} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1.5 rounded-lg hover:bg-white/5 text-[#A1A1AA] hover:text-white transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <button
            onClick={handleJumpToToday}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
          >
            Today
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Monthly Summary Metric Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-[var(--accent-primary)]" /> Total Month Duration
              </span>
              <div className="text-2xl font-black text-[var(--accent-primary)] font-mono-numbers">
                {formatHours(monthData.totalSeconds)}
              </div>
              <span className="text-[10px] text-[#71717A] font-mono-numbers">
                In {monthData.monthName} {currentYear}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider flex items-center gap-1.5">
                <Music size={13} className="text-sky-400" /> Tracks Played
              </span>
              <div className="text-2xl font-black text-sky-400 font-mono-numbers">
                {monthData.totalTracksPlayed}
              </div>
              <span className="text-[10px] text-[#71717A]">Listened across the month</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider flex items-center gap-1.5">
                <Users size={13} className="text-emerald-400" /> Unique Artists
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono-numbers">
                {monthData.uniqueArtistsCount}
              </div>
              <span className="text-[10px] text-[#71717A]">Distinct musical voices</span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/20 space-y-1">
              <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={13} className="text-amber-400 fill-amber-400" /> Peak Listening Day
              </span>
              <div className="text-2xl font-black text-amber-400 font-mono-numbers">
                {monthData.topDay ? `${monthData.monthName.slice(0, 3)} ${monthData.topDay.dayNumber}` : '—'}
              </div>
              <span className="text-[10px] text-amber-400/70 font-mono-numbers">
                {monthData.topDay ? formatHours(monthData.topDay.seconds) : 'No listening recorded'}
              </span>
            </div>
          </div>

          {/* Calendar Grid & Selected Day Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: 7-Day Monthly Heatmap Grid */}
            <div className="lg:col-span-7 xl:col-span-8 p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="font-bold text-base text-white">
                  {monthData.monthName} {currentYear}
                </h3>
                {/* Heatmap Legend */}
                <div className="flex items-center gap-1.5 text-[10px] text-[#71717A]">
                  <span>Less</span>
                  <span className="w-2.5 h-2.5 rounded bg-white/[0.04]" />
                  <span className="w-2.5 h-2.5 rounded bg-[var(--accent-secondary)]/20" />
                  <span className="w-2.5 h-2.5 rounded bg-[var(--accent-secondary)]/45" />
                  <span className="w-2.5 h-2.5 rounded bg-[var(--accent-primary)]/70" />
                  <span className="w-2.5 h-2.5 rounded bg-[var(--accent-primary)]" />
                  <span>More</span>
                </div>
              </div>

              {/* Day-of-Week Labels */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#71717A] py-1">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {emptyDaysPrefix.map((_, i) => (
                  <div key={`empty_${i}`} className="h-20 sm:h-24 rounded-xl bg-transparent opacity-20" />
                ))}

                {monthData.days.map((day) => {
                  const isSelected = day.dayNumber === selectedDay;
                  const isToday =
                    today.getFullYear() === currentYear &&
                    today.getMonth() === currentMonth &&
                    today.getDate() === day.dayNumber;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDay(day.dayNumber)}
                      className={`h-20 sm:h-24 p-2 rounded-xl text-left flex flex-col justify-between transition-all relative overflow-hidden group border ${
                        isSelected
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 shadow-lg'
                          : 'border-white/5 hover:border-white/20'
                      } ${
                        day.heatmapLevel === 4
                          ? 'bg-[var(--accent-primary)] text-black'
                          : day.heatmapLevel === 3
                          ? 'bg-[var(--accent-secondary)]/45 text-white'
                          : day.heatmapLevel === 2
                          ? 'bg-[var(--accent-secondary)]/25 text-white'
                          : day.heatmapLevel === 1
                          ? 'bg-[var(--accent-secondary)]/10 text-white'
                          : 'bg-white/[0.02] text-[#A1A1AA]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono-numbers font-bold ${
                            day.heatmapLevel === 4
                              ? 'text-black'
                              : isToday
                              ? 'text-[var(--accent-primary)] underline decoration-2'
                              : 'text-white'
                          }`}
                        >
                          {day.dayNumber}
                        </span>
                        {day.tracksPlayed > 0 && (
                          <span
                            className={`text-[9px] font-mono-numbers px-1 rounded ${
                              day.heatmapLevel === 4
                                ? 'bg-black/20 text-black font-bold'
                                : 'bg-white/10 text-[#A1A1AA]'
                            }`}
                          >
                            {day.tracksPlayed}
                          </span>
                        )}
                      </div>

                      {day.totalSeconds > 0 ? (
                        <div className="space-y-0.5">
                          <div
                            className={`text-[10px] font-mono-numbers font-bold truncate ${
                              day.heatmapLevel === 4 ? 'text-black' : 'text-[var(--accent-primary)]'
                            }`}
                          >
                            {day.totalSeconds >= 3600
                              ? formatHours(day.totalSeconds)
                              : formatMinutes(day.totalSeconds)}
                          </div>
                          {day.mostPlayedTrack && (
                            <div
                              className={`text-[9px] truncate ${
                                day.heatmapLevel === 4 ? 'text-black/80' : 'text-[#71717A]'
                              }`}
                            >
                              {day.mostPlayedTrack.title}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-[#71717A]/50 font-mono-numbers">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 4-5 Cols: Selected Date Breakdown Timeline */}
            <div className="lg:col-span-5 xl:col-span-4 p-6 rounded-2xl bg-[#101018] border border-white/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="border-b border-white/5 pb-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)] font-bold uppercase tracking-wider font-mono-numbers">
                    <CalendarIcon size={14} />
                    <span>
                      {monthData.monthName} {selectedDay}, {currentYear}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-1">Playback Timeline</h3>
                  <p className="text-xs text-[#71717A]">
                    {dayTracks.length > 0
                      ? `${dayTracks.length} tracks played on this day`
                      : 'No recorded listening sessions on this date'}
                  </p>
                </div>

                {/* Chronological List of Tracks */}
                <div className="space-y-2 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
                  {dayTracks.length === 0 ? (
                    <div className="text-center py-12 text-[#71717A] text-xs space-y-2">
                      <Music size={28} className="mx-auto opacity-30" />
                      <p>No listening activity logged for this day.</p>
                      <p className="text-[11px] text-[#71717A]/60">Select an active day on the heatmap to view tracks.</p>
                    </div>
                  ) : (
                    dayTracks.map((item, idx) => (
                      <div
                        key={item.historyId}
                        onClick={() => {
                          if (item.track) playTrack(item.track);
                        }}
                        className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-[10px] font-mono-numbers text-[#71717A] w-10 shrink-0">
                            {item.timeString}
                          </span>

                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                            {item.artworkDataUrl ? (
                              <img src={item.artworkDataUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music size={13} className="text-[var(--accent-primary)]" />
                            )}
                          </div>

                          <div className="truncate">
                            <p className="font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-[#71717A] truncate">{item.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono-numbers text-[#A1A1AA]">
                            {formatMinutes(item.playbackDuration)}
                          </span>
                          {item.completionStatus === 'completed' ? (
                            <CheckCircle2 size={12} className="text-emerald-400" />
                          ) : item.completionStatus === 'skipped' ? (
                            <XCircle size={12} className="text-rose-400" />
                          ) : (
                            <HelpCircle size={12} className="text-amber-400" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {dayTracks.length > 0 && (
                <div className="pt-3 border-t border-white/5 text-[11px] font-mono-numbers text-[#71717A] flex items-center justify-between">
                  <span>Day Total:</span>
                  <span className="text-white font-bold">
                    {formatHours(dayTracks.reduce((s, t) => s + t.playbackDuration, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Yearly Overview Mode: 12 Month Grid */
        <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BarChart2 size={16} className="text-[var(--accent-primary)]" />
                <span>{currentYear} Annual Listening Architecture</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Year-at-a-glance listening breakdown across all 12 calendar months
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {yearOverview.map((m) => (
              <div
                key={m.monthIndex}
                onClick={() => {
                  setCurrentMonth(m.monthIndex);
                  setViewMode('calendar');
                }}
                className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-[var(--accent-primary)]/40 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors">
                    {m.monthLabel}
                  </span>
                  <span className="text-[10px] font-mono-numbers text-[#71717A]">
                    {m.tracksPlayed} tracks
                  </span>
                </div>
                <div className="text-xl font-black text-white font-mono-numbers">
                  {m.hours} hrs
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--accent-secondary)] to-[var(--accent-primary)] rounded-full"
                    style={{ width: `${Math.min(100, (m.hours / 30) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
