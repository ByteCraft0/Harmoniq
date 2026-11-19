import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { historyService } from '../../services/historyService';
import { HistoryEntry, HistoryDateFilter, HistoryCompletionStatus } from '../../types/history';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  History,
  Trash2,
  Play,
  Clock,
  CheckCircle,
  SkipForward,
  Calendar,
  Search,
  Filter,
  ListPlus,
  FolderPlus,
  Globe,
  Radio,
} from 'lucide-react';

export const ListeningHistoryView: React.FC = () => {
  const { playTrack, addToQueue, playNext } = usePlayer();
  const { tracks } = useLibrary();
  const { showToast } = useToast();

  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | HistoryCompletionStatus>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [artistFilter, setArtistFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'playedAt' | 'playbackDuration'>('playedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  // Subscribe to history mutations
  useEffect(() => {
    const refresh = () => {
      setHistoryList(
        historyService.getHistory({
          dateFilter,
          statusFilter,
          providerId: providerFilter === 'all' ? undefined : providerFilter,
          artist: artistFilter === 'all' ? undefined : artistFilter,
          searchQuery,
          sortBy,
          sortOrder,
        })
      );
    };
    refresh();
    const unsub = historyService.subscribe(refresh);
    return unsub;
  }, [dateFilter, statusFilter, providerFilter, artistFilter, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => historyService.getStatsSummary(), [historyList]);
  const uniqueArtists = useMemo(() => historyService.getUniqueArtists(), [historyList]);
  const uniqueProviders = useMemo(() => historyService.getUniqueProviders(), [historyList]);

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
    const yesterday = new Date(now.getTime() - 86400 * 1000);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const entryToTrackMetadata = useCallback(
    (entry: HistoryEntry): TrackMetadata => {
      const local = tracks.find((t) => t.id === entry.trackId);
      if (local) return local;

      return {
        id: entry.trackId,
        filePath: entry.filePath || '',
        fileName: entry.title,
        fileSize: 0,
        dateModified: entry.playedAt,
        title: entry.title,
        artist: entry.artist,
        album: entry.album,
        hasArtwork: Boolean(entry.artworkDataUrl),
        artworkDataUrl: entry.artworkDataUrl,
        codec: 'MP3',
        container: 'mp3',
        duration: entry.duration,
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        isLossless: false,
        playCount: 1,
        isFavorite: false,
        isOnline: entry.isOnline,
        providerId: entry.providerId,
        providerTrackId: entry.providerTrackId,
        playbackCapability: entry.playbackCapability,
        genre: entry.genre,
      };
    },
    [tracks]
  );

  const handlePlay = (entry: HistoryEntry) => {
    const track = entryToTrackMetadata(entry);
    playTrack(track);
    showToast(`Playing "${track.title}"`, 'info');
  };

  const handleAddToQueue = (entry: HistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = entryToTrackMetadata(entry);
    addToQueue(track);
    showToast(`Added "${track.title}" to queue`, 'success');
  };

  const handlePlayNext = (entry: HistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = entryToTrackMetadata(entry);
    playNext(track);
    showToast(`Playing next: "${track.title}"`, 'info');
  };

  const handleAddToPlaylist = (entry: HistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = entryToTrackMetadata(entry);
    setPlaylistModalTracks([track]);
  };

  const handleRemoveEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    historyService.removeEntry(id);
    showToast('Removed from history', 'info');
  };

  const handleClearHistory = () => {
    historyService.clearHistory();
    setShowClearConfirm(false);
    showToast('Listening history cleared', 'info');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090B] text-white overflow-hidden p-6 space-y-5 select-none">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA]">
              <History size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Listening History</h1>
              <p className="text-xs text-zinc-400">
                Verified playback log, duration audit, and completion history across local and online tracks
              </p>
            </div>
          </div>
        </div>

        {/* Clear Button with confirmation */}
        <div>
          {showClearConfirm ? (
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-300 font-medium px-2">
                Clear all listening history? (Audio files will not be touched)
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
        <div className="p-3.5 rounded-xl bg-[#14141B] border border-[#272733]">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Total Listening Time
          </span>
          <div className="text-lg font-bold text-[#A78BFA] font-mono-numbers mt-0.5">
            {formatTime(stats.totalListeningSeconds)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#14141B] border border-[#272733]">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Completed Plays
          </span>
          <div className="text-lg font-bold text-emerald-400 font-mono-numbers mt-0.5">
            {stats.completedPlays}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#14141B] border border-[#272733]">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Partial Listens
          </span>
          <div className="text-lg font-bold text-amber-400 font-mono-numbers mt-0.5">
            {stats.partialPlays}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#14141B] border border-[#272733]">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Skipped (&lt; 15s)
          </span>
          <div className="text-lg font-bold text-zinc-500 font-mono-numbers mt-0.5">
            {stats.skippedPlays}
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#14141B] border border-[#272733]">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-[#272733] w-full sm:w-60">
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Calendar size={13} /> Time:
          </span>
          {(['all', 'today', 'yesterday', '7days', '30days'] as HistoryDateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                dateFilter === f
                  ? 'bg-[#7C3AED] text-white shadow-glow-sm'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all'
                ? 'All Time'
                : f === 'today'
                ? 'Today'
                : f === 'yesterday'
                ? 'Yesterday'
                : f === '7days'
                ? 'Last 7 Days'
                : 'Last 30 Days'}
            </button>
          ))}
        </div>

        {/* Provider Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Globe size={13} /> Source:
          </span>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-[#1B1B24] border border-[#272733] text-xs text-zinc-200 rounded-lg px-2.5 py-1 outline-none cursor-pointer"
          >
            <option value="all">All Providers</option>
            <option value="local">Local Library</option>
            {uniqueProviders
              .filter((p) => p !== 'local')
              .map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
          </select>
        </div>

        {/* Artist Filter */}
        {uniqueArtists.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Filter size={13} /> Artist:
            </span>
            <select
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              className="bg-[#1B1B24] border border-[#272733] text-xs text-zinc-200 rounded-lg px-2.5 py-1 outline-none cursor-pointer max-w-[140px]"
            >
              <option value="all">All Artists</option>
              {uniqueArtists.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* History Entries Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-[#14141B] border border-[#272733] custom-scrollbar">
        {historyList.length === 0 ? (
          <HarmoniqEmptyState
            type="empty_history"
            title="No Listening History"
            description="Your playback history, track completions, and listening sessions will appear here as you enjoy your music."
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#272733] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Track</th>
                <th className="py-3 px-4 hidden sm:table-cell">Album</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Listened</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 hidden md:table-cell">Played At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272733]/50 text-xs">
              {historyList.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => handlePlay(entry)}
                  className="hover:bg-[#1B1B24] transition-colors group cursor-pointer"
                >
                  <td className="py-2.5 px-4 flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-black/40 border border-[#272733] shrink-0">
                      {entry.artworkDataUrl ? (
                        <img
                          src={entry.artworkDataUrl}
                          alt={entry.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#7C3AED]/20 text-[#A78BFA]">
                          <History size={16} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={14} className="text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="truncate min-w-0">
                      <div className="font-medium text-white truncate">{entry.title}</div>
                      <div className="text-[11px] text-zinc-400 truncate">{entry.artist}</div>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-zinc-400 hidden sm:table-cell truncate max-w-[180px]">
                    {entry.album || 'Unknown Album'}
                  </td>

                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-numbers bg-white/[0.04] border border-white/10 text-zinc-300 capitalize">
                      {entry.providerId || 'Local'}
                    </span>
                  </td>

                  <td className="py-2.5 px-4 font-mono-numbers text-zinc-300">
                    <span className="text-[#A78BFA]">{formatTime(entry.playbackDuration)}</span>
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

                  <td className="py-2.5 px-4 text-[11px] text-zinc-400 hidden md:table-cell font-mono-numbers">
                    {formatDate(entry.playedAt)}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleAddToQueue(entry, e)}
                        title="Add to queue"
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <ListPlus size={14} />
                      </button>
                      <button
                        onClick={(e) => handleAddToPlaylist(entry, e)}
                        title="Add to playlist"
                        className="p-1.5 text-zinc-400 hover:text-[#A78BFA] rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <FolderPlus size={14} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveEntry(entry.id, e)}
                        title="Remove from history"
                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {playlistModalTracks && (
        <AddToPlaylistModal
          isOpen={true}
          tracks={playlistModalTracks}
          onClose={() => setPlaylistModalTracks(null)}
        />
      )}
    </div>
  );
};
