import React, { useState, useEffect, useRef, useMemo } from 'react';
import { universalMusicService } from '../../services/universalMusicService';
import {
  UnifiedTrack,
  ProviderId,
  UniversalSearchResponse,
  unifiedTrackToTrackMetadata,
} from '../../types/universalMusic';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { favoritesService } from '../../services/favoritesService';
import { useToast } from '../../context/ToastContext';
import { HarmoniqWaveformLoader } from '../brand/HarmoniqWaveformLoader';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  Search,
  Globe,
  Music,
  Play,
  Pause,
  Plus,
  ListPlus,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Loader2,
  AlertCircle,
  X,
  Clock,
  Sparkles,
  Radio,
  Sliders,
  CheckCircle2,
  Disc,
  Heart,
} from 'lucide-react';

type FilterType = 'all' | 'song' | 'artist' | 'album';
type ProviderFilterType =
  | 'all'
  | 'apple'
  | 'audius'
  | 'archive'
  | 'jamendo'
  | 'spotify'
  | 'youtube'
  | 'local';

const POPULAR_SUGGESTIONS = [
  'Moonlight',
  'Arijit Singh',
  'The Weeknd',
  'Coldplay',
  'Imagine Dragons',
  'Chopin',
];

export const OnlineMusicSearchView: React.FC = () => {
  const { playTrack, currentTrack, isPlaying, togglePlayPause, addToQueue, playNext } = usePlayer();
  const { toggleFavorite } = useLibrary();
  const { showToast } = useToast();
  const [, setFavTick] = useState(0);

  useEffect(() => {
    return favoritesService.subscribe(() => setFavTick((t) => t + 1));
  }, []);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilterType>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<UniversalSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const executeSearch = async (searchTerm: string, activeFilter: FilterType) => {
    const q = searchTerm.trim();
    if (!q) {
      setSearchResponse(null);
      setError(null);
      setIsSearching(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setError(null);

    try {
      const resp = await universalMusicService.searchUniversal(q, {
        filter: activeFilter,
        signal: controller.signal,
        limit: 30,
      });

      if (!controller.signal.aborted) {
        setSearchResponse(resp);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to search universal music catalogs');
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
      setSearchResponse(null);
      setError(null);
      setIsSearching(false);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, filter);
    }, 350);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    if (query.trim()) {
      executeSearch(query, newFilter);
    }
  };

  // Combine online and local results into a unified list
  const allTracks = useMemo<UnifiedTrack[]>(() => {
    if (!searchResponse) return [];
    return [...searchResponse.localResults, ...searchResponse.results];
  }, [searchResponse]);

  // Filter by provider
  const filteredTracks = useMemo<UnifiedTrack[]>(() => {
    if (providerFilter === 'all') return allTracks;
    return allTracks.filter((t) => t.providerId === providerFilter);
  }, [allTracks, providerFilter]);

  // Provider track counts
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allTracks.length,
      apple: 0,
      audius: 0,
      archive: 0,
      jamendo: 0,
      spotify: 0,
      youtube: 0,
      local: 0,
    };
    for (const t of allTracks) {
      if (counts[t.providerId] !== undefined) {
        counts[t.providerId] += 1;
      }
    }
    return counts;
  }, [allTracks]);

  // Provider response health states
  const providerFailures = useMemo(() => {
    if (!searchResponse?.providerResponses) return [];
    const fails: { id: string; name: string; error: string }[] = [];
    for (const [id, resp] of Object.entries(searchResponse.providerResponses)) {
      if (!resp.success && resp.errorMessage) {
        const nameMap: Record<string, string> = {
          apple: 'Apple Music',
          audius: 'Audius',
          archive: 'Internet Archive',
          jamendo: 'Jamendo',
          spotify: 'Spotify',
          youtube: 'YouTube',
          local: 'Local Library',
        };
        fails.push({
          id,
          name: nameMap[id] || id,
          error: resp.errorMessage,
        });
      }
    }
    return fails;
  }, [searchResponse]);

  // Play button handler with on-demand stream resolution
  const handlePlayTrack = async (item: UnifiedTrack) => {
    // If this track is already playing in the audio engine, toggle pause/play
    if (currentTrack?.id === item.id) {
      await togglePlayPause();
      return;
    }

    try {
      setResolvingTrackId(item.id);
      // Resolve fresh on-demand stream URL through main process
      const { track: resolvedTrack } = await universalMusicService.resolveTrackStream(item);
      const metadata = unifiedTrackToTrackMetadata(resolvedTrack);
      await playTrack(metadata);

      if (resolvedTrack.playbackCapability === 'preview_stream') {
        showToast(`Playing 30s preview: "${resolvedTrack.title}"`, 'info');
      } else {
        showToast(`Playing: "${resolvedTrack.title}" (${resolvedTrack.artist})`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || `Unable to stream "${item.title}"`, 'warning');
    } finally {
      setResolvingTrackId(null);
    }
  };

  const handleAddToQueue = (item: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(item);
    addToQueue(metadata);
    showToast(`Added "${item.title}" to queue`, 'info');
  };

  const handlePlayNext = (item: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(item);
    playNext(metadata);
    showToast(`Playing "${item.title}" next`, 'info');
  };

  const handleToggleFavorite = (item: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(item);
    toggleFavorite(metadata);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getProviderBadge = (providerId: ProviderId) => {
    switch (providerId) {
      case 'apple':
        return {
          label: 'Apple Music',
          className: 'bg-violet-950/60 text-violet-300 border-violet-800/40',
        };
      case 'audius':
        return {
          label: 'Audius',
          className: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/40',
        };
      case 'archive':
        return {
          label: 'Internet Archive',
          className: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
        };
      case 'jamendo':
        return {
          label: 'Jamendo',
          className: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
        };
      case 'spotify':
        return {
          label: 'Spotify',
          className: 'bg-[#0f2e1b]/70 text-[#1ed760] border-[#1ed760]/30',
        };
      case 'youtube':
        return {
          label: 'YouTube',
          className: 'bg-[#3b1212]/70 text-[#ff4e4e] border-[#ff4e4e]/30',
        };
      case 'jiosaavn':
        return {
          label: 'JioSaavn',
          className: 'bg-teal-950/60 text-teal-300 border-teal-800/40',
        };
      case 'local':
        return {
          label: 'Local Library',
          className: 'bg-sky-950/60 text-sky-300 border-sky-800/40',
        };
      default:
        return {
          label: providerId,
          className: 'bg-[#1B1B24] text-[#A1A1AA] border-[#272733]',
        };
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600/25 via-indigo-600/20 to-sky-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-950/20">
            <Globe size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-[#F5F3FF] tracking-tight">Universal Music</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-300 border border-violet-500/30">
                Multi-Source Engine
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Explore music across multiple sources, all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input & Category Filters */}
      <div className="space-y-3.5">
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
            placeholder="Search by song title, artist, or album across all sources (e.g. Moonlight, Arijit Singh, The Weeknd)..."
            className="w-full bg-[#14141B] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-2xl pl-12 pr-32 py-4 outline-none transition shadow-sm placeholder:text-[#52525B]"
            autoFocus
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setSearchResponse(null);
                  setError(null);
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                }}
                className="p-1.5 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF] transition"
                title="Clear query"
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
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition shadow-md shadow-violet-950/30 flex items-center gap-1.5"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
            </button>
          </div>
        </div>

        {/* Search Mode Filters */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717A] mr-1 flex items-center gap-1">
              <Sliders size={12} />
              Filter By:
            </span>
            {(['all', 'song', 'artist', 'album'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleFilterChange(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                  filter === mode
                    ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40 shadow-sm'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-[#71717A] flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            Authorized Multi-Provider Direct Streams & Previews
          </span>
        </div>
      </div>

      {/* Provider Health & Quota Notices */}
      {providerFailures.length > 0 && !error && (
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/30 space-y-1.5">
          {providerFailures.map((pf) => (
            <div key={pf.id} className="flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle size={14} className="shrink-0 text-amber-400" />
              <span>
                <strong>{pf.name}:</strong> {pf.error}. Other active catalogs are displayed below.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fatal Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center justify-between gap-3 text-red-300 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => executeSearch(query, filter)}
            className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/50 rounded-lg text-red-200 transition"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Search Content */}
      {isSearching ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <HarmoniqWaveformLoader
            label={`Searching open music catalogs for "${query}"...`}
            size="md"
          />
        </div>
      ) : allTracks.length > 0 ? (
        <div className="space-y-6">
          {/* Provider Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-xs text-[#71717A] mr-1 shrink-0">Source:</span>
            <button
              onClick={() => setProviderFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                providerFilter === 'all'
                  ? 'bg-gradient-to-r from-violet-600/30 to-indigo-600/30 text-violet-200 border border-violet-500/50'
                  : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
              }`}
            >
              All Sources
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#272733] text-[#F5F3FF]">
                {providerCounts.all}
              </span>
            </button>

            {providerCounts.apple > 0 && (
              <button
                onClick={() => setProviderFilter('apple')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'apple'
                    ? 'bg-violet-600/30 text-violet-200 border border-violet-500/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Apple Music
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-violet-950 text-violet-300 border border-violet-800/40">
                  {providerCounts.apple}
                </span>
              </button>
            )}

            {providerCounts.audius > 0 && (
              <button
                onClick={() => setProviderFilter('audius')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'audius'
                    ? 'bg-fuchsia-600/30 text-fuchsia-200 border border-fuchsia-500/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Audius
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800/40">
                  {providerCounts.audius}
                </span>
              </button>
            )}

            {providerCounts.archive > 0 && (
              <button
                onClick={() => setProviderFilter('archive')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'archive'
                    ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Internet Archive
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-800/40">
                  {providerCounts.archive}
                </span>
              </button>
            )}

            {providerCounts.jamendo > 0 && (
              <button
                onClick={() => setProviderFilter('jamendo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'jamendo'
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Jamendo
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  {providerCounts.jamendo}
                </span>
              </button>
            )}

            {providerCounts.spotify > 0 && (
              <button
                onClick={() => setProviderFilter('spotify')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'spotify'
                    ? 'bg-emerald-600/30 text-emerald-200 border border-[#1ed760]/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Spotify
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#0f2e1b] text-[#1ed760] border border-[#1ed760]/30">
                  {providerCounts.spotify}
                </span>
              </button>
            )}

            {providerCounts.youtube > 0 && (
              <button
                onClick={() => setProviderFilter('youtube')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'youtube'
                    ? 'bg-red-600/30 text-red-200 border border-[#ff4e4e]/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                YouTube
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#3b1212] text-[#ff4e4e] border border-[#ff4e4e]/30">
                  {providerCounts.youtube}
                </span>
              </button>
            )}

            {providerCounts.local > 0 && (
              <button
                onClick={() => setProviderFilter('local')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
                  providerFilter === 'local'
                    ? 'bg-sky-600/30 text-sky-200 border border-sky-500/50'
                    : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                }`}
              >
                Local Library
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-300 border border-sky-800/40">
                  {providerCounts.local}
                </span>
              </button>
            )}
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTracks.map((item) => {
              const isCurrentPlaying = currentTrack?.id === item.id && isPlaying;
              const isCurrentPaused = currentTrack?.id === item.id && !isPlaying;
              const isResolving = resolvingTrackId === item.id;
              const badge = getProviderBadge(item.providerId);
              const durFormatted = formatDuration(item.duration);
              const canStreamAudio =
                item.playbackCapability === 'full_stream' ||
                item.playbackCapability === 'preview_stream' ||
                item.playbackCapability === 'local_file';
              const isEmbed = item.playbackCapability === 'authorized_embed';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 bg-[#14141B] border rounded-2xl flex items-center justify-between group transition relative overflow-hidden ${
                    isCurrentPlaying
                      ? 'border-violet-500/60 shadow-lg shadow-violet-950/20 bg-gradient-to-r from-violet-950/20 to-[#14141B]'
                      : 'border-[#272733] hover:border-violet-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-2">
                    {/* Artwork Container */}
                    <div className="w-13 h-13 w-[52px] h-[52px] rounded-xl bg-[#1B1B24] border border-[#272733] flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                      <Music size={20} className="text-[#71717A] absolute" />
                      {item.artworkUrl && (
                        <img
                          src={item.artworkUrl}
                          alt={item.title}
                          className="w-full h-full object-cover relative z-10 transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      {/* Artwork hover action */}
                      {canStreamAudio ? (
                        <button
                          onClick={() => handlePlayTrack(item)}
                          className={`absolute inset-0 z-20 flex items-center justify-center transition bg-black/40 ${
                            isCurrentPlaying || isResolving
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isResolving ? (
                            <Loader2 size={18} className="animate-spin text-white" />
                          ) : isCurrentPlaying ? (
                            <Pause size={18} className="text-white" />
                          ) : (
                            <Play size={18} fill="currentColor" className="text-white ml-0.5" />
                          )}
                        </button>
                      ) : (
                        item.providerWebUrl && (
                          <a
                            href={item.providerWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 z-20 flex items-center justify-center transition bg-black/50 opacity-0 group-hover:opacity-100 text-white"
                            title={`Open on ${badge.label}`}
                          >
                            <ExternalLink size={18} />
                          </a>
                        )
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F5F3FF] truncate group-hover:text-violet-300 transition">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                        {item.artist} {item.album ? `• ${item.album}` : ''}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* Provider badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        {/* Capability label */}
                        {item.playbackCapability === 'full_stream' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/50 text-emerald-300 border border-emerald-800/40">
                            Full Track
                          </span>
                        ) : item.playbackCapability === 'preview_stream' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-950/50 text-violet-300 border border-violet-800/40">
                            30s Preview
                          </span>
                        ) : item.providerId === 'youtube' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-950/50 text-red-300 border border-red-800/40">
                            Official Video
                          </span>
                        ) : item.playbackCapability === 'authorized_embed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-950/50 text-red-300 border border-red-800/40">
                            Authorized Video
                          </span>
                        ) : item.playbackCapability === 'external_link' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#272733] text-[#D4D4D8] border border-[#3F3F46]">
                            Official Link
                          </span>
                        ) : item.playbackCapability === 'metadata_only' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#272733] text-[#A1A1AA] border border-[#3F3F46]">
                            Metadata Only
                          </span>
                        ) : item.playbackCapability === 'local_file' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950/50 text-sky-300 border border-sky-800/40">
                            Local File
                          </span>
                        ) : null}

                        {/* Popularity metric if available */}
                        {typeof item.popularity === 'number' && (
                          <span
                            className="text-[10px] text-amber-300/90 font-mono flex items-center gap-0.5"
                            title={`Popularity score: ${item.popularity}/100`}
                          >
                            ★ {item.popularity}%
                          </span>
                        )}

                        {/* Bitrate / Quality badge if verified */}
                        {item.bitrate && (
                          <span className="text-[10px] text-[#71717A] font-mono">
                            {item.bitrate}k {item.format || 'MP3'}
                          </span>
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

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Favorite Button */}
                    <button
                      onClick={() => handleToggleFavorite(item)}
                      className={`p-2 hover:bg-[#272733] rounded-xl transition ${
                        favoritesService.isFavorite(item.id)
                          ? 'text-rose-500'
                          : 'text-[#71717A] hover:text-[#F5F3FF]'
                      }`}
                      title={
                        favoritesService.isFavorite(item.id)
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                    >
                      <Heart
                        size={15}
                        fill={favoritesService.isFavorite(item.id) ? 'currentColor' : 'none'}
                      />
                    </button>

                    {canStreamAudio ? (
                      <>
                        {/* Add to Queue */}
                        <button
                          onClick={() => handleAddToQueue(item)}
                          className="p-2 hover:bg-[#272733] rounded-xl text-[#71717A] hover:text-[#F5F3FF] transition"
                          title="Add to queue"
                        >
                          <Plus size={15} />
                        </button>

                        {/* Play Next */}
                        <button
                          onClick={() => handlePlayNext(item)}
                          className="p-2 hover:bg-[#272733] rounded-xl text-[#71717A] hover:text-[#F5F3FF] transition"
                          title="Play next"
                        >
                          <ListPlus size={15} />
                        </button>

                        {/* Play Button */}
                        <button
                          onClick={() => handlePlayTrack(item)}
                          disabled={isResolving}
                          className={`p-2.5 rounded-full transition shadow-sm ${
                            isCurrentPlaying
                              ? 'bg-violet-500 text-white shadow-violet-900/40'
                              : isCurrentPaused
                              ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                              : 'bg-[#1B1B24] text-[#A78BFA] hover:bg-[#272733] hover:text-[#F5F3FF]'
                          }`}
                          title={
                            isCurrentPlaying
                              ? 'Pause playback'
                              : isCurrentPaused
                              ? 'Resume playback'
                              : 'Play track'
                          }
                        >
                          {isResolving ? (
                            <Loader2 size={15} className="animate-spin text-[#A78BFA]" />
                          ) : isCurrentPlaying ? (
                            <Pause size={15} />
                          ) : (
                            <Play size={15} fill="currentColor" />
                          )}
                        </button>

                        {/* External Link */}
                        {item.providerWebUrl && (
                          <a
                            href={item.providerWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 hover:bg-[#272733] rounded-xl text-[#71717A] hover:text-[#F5F3FF] transition ml-0.5"
                            title="View on source website"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </>
                    ) : item.providerId === 'youtube' ? (
                      /* Official YouTube Video platform action */
                      <a
                        href={item.providerWebUrl || item.streamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-[#3b1212]/80 hover:bg-[#4a1717] text-[#ff4e4e] border border-[#ff4e4e]/30 rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                        title="Watch video on official YouTube platform"
                      >
                        <ExternalLink size={13} />
                        <span>Watch on YouTube</span>
                      </a>
                    ) : isEmbed ? (
                      /* Authorized Video Platform action */
                      <a
                        href={item.providerWebUrl || item.streamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-[#3b1212]/80 hover:bg-[#4a1717] text-[#ff4e4e] border border-[#ff4e4e]/30 rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                        title="Watch video on official platform"
                      >
                        <ExternalLink size={13} />
                        <span>Watch Video</span>
                      </a>
                    ) : (
                      /* External-link or metadata-only track (e.g. Spotify without preview) */
                      item.providerWebUrl ? (
                        <a
                          href={item.providerWebUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-[#1B1B24] hover:bg-[#272733] text-[#F5F3FF] border border-[#3F3F46] rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                          title={`Open on official ${badge.label} platform`}
                        >
                          <ExternalLink size={13} />
                          <span>Open in {badge.label}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#71717A] italic px-2 py-1">
                          Catalog Only
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : query.trim() ? (
        <div className="py-16">
          <HarmoniqEmptyState
            type="empty_search"
            title="No Music Matches Found"
            description={`No online tracks or local library matches were found for "${query}". Try searching for other song titles, artists, or genres.`}
            action={{
              label: 'Clear Search',
              onClick: () => {
                setQuery('');
                setSearchResponse(null);
                setError(null);
              },
            }}
          />
        </div>
      ) : (
        /* Initial Discovery Hero Screen with Curated Quick Searches */
        <div className="space-y-6 pt-2">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#14141B] via-[#121217] to-[#101014] border border-[#272733] space-y-6 relative overflow-hidden shadow-card">
            <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            <div className="space-y-2 relative z-10">
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-violet-950/60 text-violet-300 border border-violet-800/40 inline-flex items-center gap-1.5">
                <Sparkles size={12} />
                Universal Catalog Discovery
              </span>
              <h2 className="text-xl font-bold text-[#F5F3FF]">
                Instant Access to Millions of Free & Open Audio Tracks
              </h2>
              <p className="text-xs text-[#A1A1AA] max-w-2xl leading-relaxed">
                Harmoniq Universal Music aggregates authorized music from Apple Music previews,
                Audius 320kbps full-track streaming, Jamendo Creative Commons, Spotify commercial
                catalog discovery, YouTube music video discovery, the Internet Archive historical collection,
                and your offline local library.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-violet-400">
                  <Globe size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">Apple Music</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  30s high-definition previews across Bollywood, Hindi, Punjabi & International charts.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-[#1ed760]">
                  <Disc size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">Spotify Catalog</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Official commercial track discovery, rich metadata, popularity scores, and links.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-[#ff4e4e]">
                  <Radio size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">YouTube Platform</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Music video discovery across global and regional channels with authorized links.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-fuchsia-400">
                  <Disc size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">Audius Network</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Full-length 320kbps MP3 audio streams from decentralized creators.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <Radio size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">Internet Archive</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Historical public domain audio, vintage recordings, and live concerts.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1B1B24]/70 border border-[#272733] space-y-1">
                <div className="flex items-center gap-2 text-sky-400">
                  <HardDrive size={16} />
                  <span className="text-xs font-semibold text-[#F5F3FF]">Local Collection</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA]">
                  Instant offline results from your personal library in parallel.
                </p>
              </div>
            </div>

            {/* Quick-Search Prompt Chips */}
            <div className="space-y-2.5 pt-2 relative z-10 border-t border-[#272733]/60">
              <span className="text-xs text-[#71717A] block font-medium">
                Try searching popular songs and artists:
              </span>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => {
                      setQuery(sug);
                      executeSearch(sug, filter);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs bg-[#1B1B24] hover:bg-violet-600/20 text-[#A1A1AA] hover:text-violet-300 border border-[#272733] hover:border-violet-500/40 transition flex items-center gap-1.5"
                  >
                    <Search size={11} className="text-[#71717A]" />
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
