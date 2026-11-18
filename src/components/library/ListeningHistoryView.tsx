import React, { useState, useEffect, useMemo } from 'react';
import { historyService } from '../../services/historyService';
import { HistoryEntry, HistoryDateFilter, HistoryCompletionStatus } from '../../types/history';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import {
  History,
  Trash2,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  SkipForward,
  Calendar,
  Search,
  Filter,
  Check,
} from 'lucide-react';

export const ListeningHistoryView: React.FC = () => {
  const { playTrack, addToQueue, playNext } = usePlayer();
  const { tracks } = useLibrary();
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | HistoryCompletionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'playedAt' | 'playbackDuration'>('playedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Subscribe to history mutations
  useEffect(() => {
    const refresh = () => {
      setHistoryList(
        historyService.getHistory({
          dateFilter,
          statusFilter,
          searchQuery,
          sortBy,
          sortOrder,
        })
      );
    };
    refresh();
    const unsub = historyService.subscribe(refresh);
    return unsub;
  }, [dateFilter, statusFilter, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => historyService.getStatsSummary(), [historyList]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePlay = (entry: HistoryEntry) => {
    const track = tracks.find((t) => t.id === entry.trackId);
    if (track) {
      playTrack(track);
    }
  };

  const handleRemoveEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    historyService.removeEntry(id);
  };

  const handleClearHistory = () => {
    historyService.clearHistory();
    setShowClearConfirm(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090B] text-white overflow-hidden p-6 space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <History size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Listening History</h1>
              <p className="text-xs text-zinc-400">
                Detailed playback log, duration verification, and play completion status
              </p>
            </div>
          </div>
        </div>

        {/* Clear Button with confirmation */}
        <div>
          {showClearConfirm ? (
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-300 font-medium px-2">
                Clear all history log? (Music files will NOT be touched)
              </span>
              <button
                onClick={handleClearHistory}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                Yes, Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={historyList.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-xs font-medium text-zinc-400 hover:text-rose-400 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <Trash2 size={14} /> Clear History
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Total Listening Time
          </span>
          <div className="text-lg font-bold text-violet-300 font-mono-numbers mt-0.5">
            {formatTime(stats.totalListeningSeconds)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Completed Plays
          </span>
          <div className="text-lg font-bold text-emerald-400 font-mono-numbers mt-0.5">
            {stats.completedPlays}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Partial Listens
          </span>
          <div className="text-lg font-bold text-amber-400 font-mono-numbers mt-0.5">
            {stats.partialPlays}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Skipped (&lt; 15s)
          </span>
          <div className="text-lg font-bold text-zinc-500 font-mono-numbers mt-0.5">
            {stats.skippedPlays}
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 w-full sm:w-64">
          <Search size={14} className="text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Calendar size={13} /> Time:
          </span>
          {(['all', 'today', '7days', '30days'] as HistoryDateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                dateFilter === f
                  ? 'bg-violet-600 text-white shadow-glow-sm'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all'
                ? 'All Time'
                : f === 'today'
                ? 'Today'
                : f === '7days'
                ? 'Last 7 Days'
                : 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Filter size={13} /> Status:
          </span>
          {(['all', 'completed', 'partial', 'skipped'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-white/20 text-white font-semibold'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* History Entries Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white/[0.01] border border-white/5 custom-scrollbar">
        {historyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-2">
            <History size={36} className="text-zinc-600" />
            <p className="text-sm font-medium">No listening history matches the current filter</p>
            <p className="text-xs text-zinc-600">Start playing music to build your history log</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Track</th>
                <th className="py-3 px-4 hidden sm:table-cell">Album</th>
                <th className="py-3 px-4">Listened</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 hidden md:table-cell">Played At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {historyList.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => handlePlay(entry)}
                  className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                >
                  <td className="py-2.5 px-4 flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      {entry.artworkDataUrl ? (
                        <img
                          src={entry.artworkDataUrl}
                          alt={entry.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-violet-950/40 text-violet-400">
                          <History size={16} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={14} className="text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-white truncate">{entry.title}</div>
                      <div className="text-[11px] text-zinc-400 truncate">{entry.artist}</div>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-zinc-400 hidden sm:table-cell truncate max-w-[180px]">
                    {entry.album || 'Unknown Album'}
                  </td>

                  <td className="py-2.5 px-4 font-mono-numbers text-zinc-300">
                    <span className="text-violet-300">{formatTime(entry.playbackDuration)}</span>
                    <span className="text-zinc-600 text-[11px] ml-1">/ {formatTime(entry.duration)}</span>
                  </td>

                  <td className="py-2.5 px-4">
                    {entry.completionStatus === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle size={10} /> Completed
                      </span>
                    )}
                    {entry.completionStatus === 'partial' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <Clock size={10} /> Partial
                      </span>
                    )}
                    {entry.completionStatus === 'skipped' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 border border-zinc-500/20 text-zinc-500">
                        <SkipForward size={10} /> Skipped
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 text-[11px] text-zinc-400 hidden md:table-cell">
                    {formatDate(entry.playedAt)}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={(e) => handleRemoveEntry(entry.id, e)}
                      title="Remove from history"
                      className="p-1.5 text-zinc-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
