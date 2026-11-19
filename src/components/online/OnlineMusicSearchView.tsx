import React, { useState, useEffect, useRef } from 'react';
import { onlineMusicService } from '../../services/onlineMusicService';
import { OnlineSearchResult } from '../../types/online';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
import { HarmoniqWaveformLoader } from '../brand/HarmoniqWaveformLoader';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  Search,
  Globe,
  Music,
  Disc,
  User,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Loader2,
  AlertCircle,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';

export const OnlineMusicSearchView: React.FC = () => {
  const { playTrack } = usePlayer();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'song' | 'artist' | 'album'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [localResults, setLocalResults] = useState<TrackMetadata[]>([]);
  const [onlineResults, setOnlineResults] = useState<OnlineSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Online preview audio element
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    previewAudioRef.current = new Audio();
    const a = previewAudioRef.current;
    a.onended = () => setPreviewTrackId(null);
    a.onerror = () => setPreviewTrackId(null);
    return () => {
      a.pause();
      a.src = '';
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const executeSearch = async (searchTerm: string, activeFilter: 'all' | 'song' | 'artist' | 'album') => {
    const q = searchTerm.trim();
    if (!q) {
      setLocalResults([]);
      setOnlineResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setError(null);

    // 1. Instant local search
    const local = onlineMusicService.searchLocal(q);
    setLocalResults(local);

    // 2. Online search via IPC / API
    try {
      const results = await onlineMusicService.searchOnline(q, activeFilter, controller.signal);
      if (!controller.signal.aborted) {
        setOnlineResults(results);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to search online catalog');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!val.trim()) {
      setLocalResults([]);
      setOnlineResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, filter);
    }, 350);
  };

  const handleFilterChange = (newFilter: 'all' | 'song' | 'artist' | 'album') => {
    setFilter(newFilter);
    if (query.trim()) {
      executeSearch(query, newFilter);
    }
  };

  const handleTogglePreview = (item: OnlineSearchResult) => {
    if (!item.streamUrl || !previewAudioRef.current) return;
    const a = previewAudioRef.current;

    if (previewTrackId === item.id) {
      a.pause();
      setPreviewTrackId(null);
    } else {
      a.pause();
      a.src = item.streamUrl;
      a.play().catch(console.warn);
      setPreviewTrackId(item.id);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-sky-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Globe size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F5F3FF]">Online Music Search</h1>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Search open music catalogs, public domain archives, and your local library with real audio previews
            </p>
          </div>
        </div>
      </div>

      {/* Search Input & Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#71717A]" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                executeSearch(query, filter);
              }
            }}
            placeholder="Search by track title, artist name (e.g. Moonlight, Imagine, Coldplay)..."
            className="w-full bg-[#14141B] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-xl pl-12 pr-28 py-3.5 outline-none transition shadow-sm"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setLocalResults([]);
                  setOnlineResults([]);
                  setError(null);
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                }}
                className="p-1 hover:bg-[#272733] rounded-md text-[#71717A] hover:text-[#F5F3FF]"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                executeSearch(query, filter);
              }}
              disabled={isSearching || !query.trim()}
              className="px-4 py-1.5 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-50 text-[#09090B] font-semibold text-xs rounded-lg transition"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-[#71717A] mr-2">Filter By:</span>
          {(['all', 'song', 'artist', 'album'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleFilterChange(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                filter === mode
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                  : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center gap-3 text-red-300 text-xs">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Local Library Matches */}
      {localResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-[#38BDF8]" />
            <h2 className="text-sm font-semibold text-[#F5F3FF]">
              Local Library Results ({localResults.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {localResults.map((tr) => (
              <div
                key={tr.id}
                className="p-3 bg-[#14141B] border border-[#272733] hover:border-[#38BDF8]/40 rounded-xl flex items-center justify-between group transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-[#1B1B24] flex items-center justify-center shrink-0 overflow-hidden relative">
                    <Music size={18} className="text-[#71717A] absolute" />
                    {tr.artworkDataUrl && (
                      <img
                        src={tr.artworkDataUrl}
                        alt={tr.title}
                        className="w-full h-full object-cover relative z-10"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F5F3FF] truncate">{tr.title}</p>
                    <p className="text-[11px] text-[#A1A1AA] truncate">
                      {tr.artist} {tr.album ? `• ${tr.album}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950/50 text-sky-300 border border-sky-800/40">
                    LOCAL
                  </span>
                  <button
                    onClick={() => playTrack(tr)}
                    className="p-2 bg-[#A78BFA] text-[#09090B] hover:bg-[#8B5CF6] rounded-full transition shadow-sm"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Online Open Catalogs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-[#A78BFA]" />
            <h2 className="text-sm font-semibold text-[#F5F3FF]">
              Open Catalogs & Audio Previews {onlineResults.length > 0 && `(${onlineResults.length})`}
            </h2>
          </div>
          <span className="text-[11px] text-[#71717A] flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            Legitimate Catalog & Public Domain Previews
          </span>
        </div>

        {isSearching ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <HarmoniqWaveformLoader
              label={`Searching open catalogs for "${query}"...`}
              size="md"
            />
          </div>
        ) : onlineResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {onlineResults.map((item) => {
              const isPlayingThis = previewTrackId === item.id;
              const durFormatted = formatDuration(item.duration);
              return (
                <div
                  key={item.id}
                  className={`p-3 bg-[#14141B] border rounded-xl flex items-center justify-between group transition ${
                    isPlayingThis ? 'border-violet-500/60 shadow-lg shadow-violet-950/20' : 'border-[#272733] hover:border-violet-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#1B1B24] border border-[#272733] flex items-center justify-center shrink-0 overflow-hidden relative">
                      <Music size={18} className="text-[#71717A] absolute" />
                      {item.artworkUrl && (
                        <img
                          src={item.artworkUrl}
                          alt={item.title}
                          className="w-full h-full object-cover relative z-10"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F5F3FF] truncate">{item.title}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">
                        {item.artist} {item.album ? `• ${item.album}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-emerald-400 font-mono">{item.source}</span>
                        {item.year && (
                          <span className="text-[10px] text-[#71717A] font-mono">({item.year})</span>
                        )}
                        {durFormatted && (
                          <span className="text-[10px] text-[#71717A] font-mono flex items-center gap-0.5">
                            <Clock size={10} />
                            {durFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.streamUrl && (
                      <button
                        onClick={() => handleTogglePreview(item)}
                        className={`p-2.5 rounded-full transition shadow-sm ${
                          isPlayingThis
                            ? 'bg-emerald-500 text-[#09090B]'
                            : 'bg-[#1B1B24] text-[#A78BFA] hover:bg-[#272733]'
                        }`}
                        title={isPlayingThis ? 'Pause preview' : 'Stream preview'}
                      >
                        {isPlayingThis ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                      </button>
                    )}
                    {item.detailUrl && (
                      <a
                        href={item.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF] transition"
                        title="View details"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : query.trim() ? (
          <div className="py-12">
            <HarmoniqEmptyState
              type="empty_search"
              title="No Online Matches Found"
              description={`No matching online tracks found for "${query}". Try searching for other artists, songs, or genres.`}
              action={{
                label: 'Clear Search',
                onClick: () => setQuery(''),
              }}
            />
          </div>
        ) : (
          <div className="py-12">
            <HarmoniqEmptyState
              type="empty_search"
              title="Search Music Catalogs"
              description="Type a song title, artist, or genre to explore open online music archives alongside your local library."
            />
          </div>
        )}
      </div>
    </div>
  );
};
