import React, { useState, useEffect, useRef } from 'react';
import { onlineMusicService } from '../../services/onlineMusicService';
import { OnlineSearchResult } from '../../types/online';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
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
} from 'lucide-react';

export const OnlineMusicSearchView: React.FC = () => {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'song' | 'artist' | 'album'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [localResults, setLocalResults] = useState<TrackMetadata[]>([]);
  const [onlineResults, setOnlineResults] = useState<OnlineSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Online preview audio element
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    previewAudioRef.current = new Audio();
    const a = previewAudioRef.current;
    a.onended = () => setPreviewTrackId(null);
    a.onerror = () => setPreviewTrackId(null);
    return () => {
      a.pause();
      a.src = '';
    };
  }, []);

  const handleSearch = async (searchTerm: string) => {
    const q = searchTerm.trim();
    if (!q) {
      setLocalResults([]);
      setOnlineResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    // 1. Search local library instantly
    const local = onlineMusicService.searchLocal(q);
    setLocalResults(local);

    // 2. Search online authorized open catalogs
    try {
      const online = await onlineMusicService.searchOnline(q, filter);
      setOnlineResults(online);
    } catch (err: any) {
      setError(err.message || 'Failed to search online catalog');
    } finally {
      setIsSearching(false);
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
              Search authorized open music catalogs, public domain archives, and your local library
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search by track title, artist name, or album..."
            className="w-full bg-[#14141B] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-xl pl-12 pr-28 py-3.5 outline-none transition shadow-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setLocalResults([]);
                  setOnlineResults([]);
                }}
                className="p-1 hover:bg-[#272733] rounded-md text-[#71717A] hover:text-[#F5F3FF]"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => handleSearch(query)}
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
              onClick={() => {
                setFilter(mode);
                if (query.trim()) handleSearch(query);
              }}
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
                  <div className="w-10 h-10 rounded-lg bg-[#1B1B24] flex items-center justify-center shrink-0 overflow-hidden">
                    {tr.artworkDataUrl ? (
                      <img src={tr.artworkDataUrl} alt={tr.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music size={18} className="text-[#71717A]" />
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

      {/* Section 2: Online Public Catalogs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-[#A78BFA]" />
            <h2 className="text-sm font-semibold text-[#F5F3FF]">
              Open Catalogs & Public Archives {onlineResults.length > 0 && `(${onlineResults.length})`}
            </h2>
          </div>
          <span className="text-[11px] text-[#71717A] flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            Legitimate CC / Public Domain Sources
          </span>
        </div>

        {isSearching ? (
          <div className="py-16 text-center text-[#71717A] space-y-2">
            <Loader2 size={24} className="animate-spin mx-auto text-[#A78BFA]" />
            <p className="text-xs">Searching open online audio catalogs...</p>
          </div>
        ) : onlineResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {onlineResults.map((item) => {
              const isPlayingThis = previewTrackId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-3 bg-[#14141B] border border-[#272733] hover:border-violet-500/40 rounded-xl flex items-center justify-between group transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#1B1B24] flex items-center justify-center shrink-0 overflow-hidden">
                      {item.artworkUrl ? (
                        <img src={item.artworkUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <Music size={18} className="text-[#71717A]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F5F3FF] truncate">{item.title}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">
                        {item.artist} {item.year ? `(${item.year})` : ''}
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono">{item.license}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.streamUrl && (
                      <button
                        onClick={() => handleTogglePreview(item)}
                        className={`p-2 rounded-full transition shadow-sm ${
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
                        title="View source on Internet Archive"
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
          <div className="py-16 text-center text-[#71717A] text-xs">
            No matching online tracks found for "{query}". Try a different keyword.
          </div>
        ) : (
          <div className="py-16 text-center text-[#71717A] text-xs space-y-1">
            <Globe size={32} className="mx-auto text-[#272733] mb-2" />
            <p>Type a title, artist, or genre above to search open online catalogs and your local library.</p>
          </div>
        )}
      </div>
    </div>
  );
};
