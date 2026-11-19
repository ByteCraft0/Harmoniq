import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { SongRow, SongTableHeader } from '../layout/SongRow';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { FolderTreeExplorer } from '../library/FolderTreeExplorer';
import { ListeningHistoryView } from '../library/ListeningHistoryView';
import { SmartPlaylistsSection } from '../library/SmartPlaylistsSection';
import { DuplicateDetectorModal } from '../maintenance/DuplicateDetectorModal';
import { MissingArtworkManager } from '../maintenance/MissingArtworkManager';
import { BulkMetadataModal } from '../maintenance/BulkMetadataModal';
import { TrackMetadata } from '../../types/audio';
import { libraryService } from '../../services/libraryService';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  Music,
  Disc,
  Users,
  Folder,
  Play,
  Heart,
  Plus,
  ListPlus,
  FolderOpen,
  ExternalLink,
  History,
  Sliders,
  Clock,
  CheckSquare,
  Square,
  Trash2,
  Filter,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';

export type LibraryTab =
  | 'songs'
  | 'albums'
  | 'artists'
  | 'genres'
  | 'folders'
  | 'recently_added'
  | 'history'
  | 'smart_playlists';

interface LibraryViewProps {
  initialTab?: LibraryTab;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ initialTab = 'songs' }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const {
    activeView,
    setActiveView,
    tracks,
    albums,
    artists,
    genres,
    folderTree,
    searchQuery,
    searchResults,
    toggleFavorite,
    openAlbumDetail,
    openArtistDetail,
    showFileInFolder,
    addMusicFolders,
  } = useLibrary();

  const { playTrack, playNext, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  // Multi-selection state
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [missingArtworkOpen, setMissingArtworkOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // Advanced Filtering & Sorting
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration' | 'bitrate' | 'playCount' | 'dateAdded'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Progressive rendering window for 60 FPS scrolling on large libraries (10k+ tracks)
  const [renderLimit, setRenderLimit] = useState<number>(150);

  // Album Collection Filtering
  const [albumDecade, setAlbumDecade] = useState<string>('all');
  const [albumSortBy, setAlbumSortBy] = useState<'title' | 'artist' | 'year' | 'trackCount'>('title');
  const [albumSortOrder, setAlbumSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (['songs', 'albums', 'artists', 'genres', 'folders', 'history', 'smart_playlists'].includes(activeView)) {
      setActiveTab(activeView as any);
    }
  }, [activeView]);

  const handleTabChange = (tab: LibraryTab) => {
    setActiveTab(tab);
    if (['songs', 'albums', 'artists', 'folders'].includes(tab)) {
      setActiveView(tab as any);
    }
  };

  // Base tracks
  const baseTracks = useMemo(() => {
    return searchQuery.trim() ? searchResults : tracks;
  }, [searchQuery, searchResults, tracks]);

  // Filtered & Sorted tracks
  const processedTracks = useMemo(() => {
    let list = [...baseTracks];

    // Recently added tab forces sort by dateAdded desc
    if (activeTab === 'recently_added') {
      list.sort((a, b) => (b.dateAdded ?? b.dateModified) - (a.dateAdded ?? a.dateModified));
      return list;
    }

    // Format filter
    if (formatFilter !== 'all') {
      if (formatFilter === 'lossless') {
        list = list.filter((t) => t.isLossless);
      } else if (formatFilter === 'hires') {
        list = list.filter((t) => t.sampleRate > 44100 || (t.bitDepth && t.bitDepth > 16));
      } else {
        list = list.filter((t) => (t.codec || '').toLowerCase() === formatFilter.toLowerCase());
      }
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (sortBy) {
        case 'title':
          valA = (a.title || '').toLowerCase();
          valB = (b.title || '').toLowerCase();
          break;
        case 'artist':
          valA = (a.artist || '').toLowerCase();
          valB = (b.artist || '').toLowerCase();
          break;
        case 'album':
          valA = (a.album || '').toLowerCase();
          valB = (b.album || '').toLowerCase();
          break;
        case 'duration':
          valA = a.duration || 0;
          valB = b.duration || 0;
          break;
        case 'bitrate':
          valA = a.bitrate || 0;
          valB = b.bitrate || 0;
          break;
        case 'playCount':
          valA = a.playCount || 0;
          valB = b.playCount || 0;
          break;
        case 'dateAdded':
          valA = a.dateAdded ?? a.dateModified ?? 0;
          valB = b.dateAdded ?? b.dateModified ?? 0;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return list;
  }, [baseTracks, activeTab, formatFilter, sortBy, sortOrder]);

  const filteredAlbums = useMemo(() => {
    let list = [...albums];
    if (albumDecade !== 'all') {
      list = list.filter((a) => {
        if (!a.year) return false;
        const y = a.year;
        if (albumDecade === '2020s') return y >= 2020 && y <= 2029;
        if (albumDecade === '2010s') return y >= 2010 && y <= 2019;
        if (albumDecade === '2000s') return y >= 2000 && y <= 2009;
        if (albumDecade === '1990s') return y >= 1990 && y <= 1999;
        if (albumDecade === '1980s') return y >= 1980 && y <= 1989;
        return false;
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (albumSortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (albumSortBy === 'artist') cmp = a.artist.localeCompare(b.artist);
      else if (albumSortBy === 'year') cmp = (a.year || 0) - (b.year || 0);
      else if (albumSortBy === 'trackCount') cmp = a.tracks.length - b.tracks.length;
      return albumSortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [albums, albumDecade, albumSortBy, albumSortOrder]);

  // Reset progressive render window when query, filter, sort, or tab changes
  useEffect(() => {
    setRenderLimit(150);
  }, [searchQuery, formatFilter, sortBy, sortOrder, activeTab]);

  const visibleTracks = useMemo(() => {
    return processedTracks.slice(0, renderLimit);
  }, [processedTracks, renderLimit]);

  const handlePlay = useCallback(
    (track: TrackMetadata) => {
      playTrack(track, processedTracks);
    },
    [playTrack, processedTracks]
  );

  const handlePlayNext = useCallback(
    (track: TrackMetadata) => {
      playNext(track);
      showToast(`Playing next: "${track.title}"`, 'info');
    },
    [playNext, showToast]
  );

  const handleAddToQueue = useCallback(
    (track: TrackMetadata) => {
      addToQueue(track);
      showToast(`Added to queue: "${track.title}"`, 'success');
    },
    [addToQueue, showToast]
  );

  const handleToggleFavorite = useCallback(
    (trackId: string) => {
      toggleFavorite(trackId);
    },
    [toggleFavorite]
  );

  const handleAddToPlaylist = useCallback((track: TrackMetadata) => {
    setPlaylistModalTracks([track]);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, track: TrackMetadata) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  }, []);

  // Multi-select handlers
  const handleToggleTrackSelect = (id: string) => {
    setSelectedTrackIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const handleSelectAll = () => {
    if (selectedTrackIds.size === processedTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(processedTracks.map((t) => t.id)));
    }
  };

  const handlePlaySelected = () => {
    const selected = processedTracks.filter((t) => selectedTrackIds.has(t.id));
    if (selected.length > 0) {
      playTrack(selected[0], selected);
      showToast(`Playing ${selected.length} selected tracks`, 'success');
    }
  };

  const handleQueueSelected = () => {
    const selected = processedTracks.filter((t) => selectedTrackIds.has(t.id));
    selected.forEach((t) => addToQueue(t));
    showToast(`Added ${selected.length} tracks to queue`, 'success');
  };

  const handlePlaylistSelected = () => {
    const selected = processedTracks.filter((t) => selectedTrackIds.has(t.id));
    if (selected.length > 0) {
      setPlaylistModalTracks(selected);
    }
  };

  const handleConfirmRemoveFromLibrary = () => {
    const ids = Array.from(selectedTrackIds);
    const removed = libraryService.removeTracks(ids);
    setSelectedTrackIds(new Set());
    setShowRemoveConfirmModal(false);
    showToast(`Removed ${removed} tracks from library (Files kept safely on disk)`, 'info');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden px-8 py-6 select-none relative">
      {/* Navigation Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#272733]">
        <div className="flex flex-wrap items-center gap-1 bg-[#14141B] p-1 rounded-xl border border-[#272733]">
          <button
            onClick={() => handleTabChange('songs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'songs'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Music size={13} className={activeTab === 'songs' ? 'text-violet-400' : ''} />
            <span>Songs ({tracks.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('albums')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'albums'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Disc size={13} className={activeTab === 'albums' ? 'text-violet-400' : ''} />
            <span>Albums ({albums.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('artists')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'artists'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Users size={13} className={activeTab === 'artists' ? 'text-violet-400' : ''} />
            <span>Artists ({artists.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('genres')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'genres'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <span>Genres ({genres.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('folders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'folders'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Folder size={13} className={activeTab === 'folders' ? 'text-violet-400' : ''} />
            <span>Folders</span>
          </button>

          <button
            onClick={() => handleTabChange('recently_added')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recently_added'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Clock size={13} className={activeTab === 'recently_added' ? 'text-violet-400' : ''} />
            <span>Recently Added</span>
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <History size={13} className={activeTab === 'history' ? 'text-violet-400' : ''} />
            <span>History</span>
          </button>

          <button
            onClick={() => handleTabChange('smart_playlists')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'smart_playlists'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Sliders size={13} className={activeTab === 'smart_playlists' ? 'text-violet-400' : ''} />
            <span>Smart Playlists</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDuplicateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            title="Scan for duplicate songs"
          >
            <span>Duplicates</span>
          </button>

          <button
            onClick={() => setMissingArtworkOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            title="Scan for missing album artwork"
          >
            <span>Artwork</span>
          </button>

          <button
            onClick={addMusicFolders}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm transition-colors"
          >
            <FolderOpen size={14} />
            <span>Add Folder</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden mt-4 flex flex-col">
        {/* 1. SONGS TABLE WITH FILTERING & MULTI-SELECT */}
        {(activeTab === 'songs' || activeTab === 'recently_added') && (
          <div className="flex-1 flex flex-col overflow-hidden space-y-2">
            {/* Filter & Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors text-[11px]"
                >
                  {selectedTrackIds.size === processedTracks.length && processedTracks.length > 0 ? (
                    <CheckSquare size={13} className="text-violet-400" />
                  ) : (
                    <Square size={13} />
                  )}
                  <span>
                    {selectedTrackIds.size === 0
                      ? 'Select All'
                      : `${selectedTrackIds.size} Selected`}
                  </span>
                </button>

                {/* Format Pills */}
                {activeTab === 'songs' && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-zinc-500 text-[11px] mr-1 flex items-center gap-1">
                      <Filter size={11} /> Format:
                    </span>
                    {['all', 'flac', 'mp3', 'lossless', 'hires'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setFormatFilter(fmt)}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold transition-all ${
                          formatFilter === fmt
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/[0.03] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Selector */}
              {activeTab === 'songs' && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[11px] flex items-center gap-1">
                    <ArrowUpDown size={11} /> Sort by:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2 py-1 rounded-lg bg-[#14141B] border border-white/10 text-[11px] text-zinc-300 focus:outline-none"
                  >
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                    <option value="album">Album</option>
                    <option value="duration">Duration</option>
                    <option value="bitrate">Bitrate</option>
                    <option value="playCount">Play Count</option>
                    <option value="dateAdded">Date Added</option>
                  </select>
                  <button
                    onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="px-2 py-1 rounded-lg bg-[#14141B] border border-white/10 text-[11px] text-zinc-300 hover:text-white transition-colors"
                  >
                    {sortOrder === 'asc' ? 'Asc (A-Z)' : 'Desc (Z-A)'}
                  </button>
                </div>
              )}
            </div>

            {/* Song Table */}
            <div
              className="flex-1 overflow-y-auto custom-scrollbar"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 300) {
                  if (renderLimit < processedTracks.length) {
                    setRenderLimit((prev) => Math.min(processedTracks.length, prev + 150));
                  }
                }
              }}
            >
              {processedTracks.length === 0 ? (
                <HarmoniqEmptyState
                  type="empty_library"
                  title="Your Music Collection Awaits"
                  description="Scan your local audio folders or import high-fidelity tracks to build your Harmoniq record library."
                  action={{
                    label: "Add Music Folder",
                    onClick: addMusicFolders,
                  }}
                />
              ) : (
                <div className="w-full">
                  <SongTableHeader showAlbum={true} />
                  <div className="space-y-0.5">
                    {visibleTracks.map((track, idx) => (
                      <SongRow
                        key={track.id}
                        track={track}
                        index={idx}
                        isCurrent={currentTrack?.id === track.id}
                        isPlaying={currentTrack?.id === track.id && isPlaying}
                        showAlbum={true}
                        isSelected={selectedTrackIds.has(track.id)}
                        onToggleSelect={() => handleToggleTrackSelect(track.id)}
                        onPlay={handlePlay}
                        onPlayNext={handlePlayNext}
                        onAddToQueue={handleAddToQueue}
                        onToggleFavorite={handleToggleFavorite}
                        onAddToPlaylist={handleAddToPlaylist}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </div>
                  {visibleTracks.length < processedTracks.length && (
                    <div className="py-3 text-center text-[11px] text-[#71717A]">
                      Showing {visibleTracks.length} of {processedTracks.length} tracks — scroll down to load more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ALBUMS GRID (RECORD COLLECTION) */}
        {activeTab === 'albums' && (
          <div className="flex-1 flex flex-col overflow-hidden space-y-4">
            {/* Album Collection Filtering Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-[#14141B]/70 p-2.5 rounded-xl border border-[#272733]">
              {/* Decade Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
                {['all', '2020s', '2010s', '2000s', '1990s', '1980s'].map((dec) => (
                  <button
                    key={dec}
                    onClick={() => setAlbumDecade(dec)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono-numbers whitespace-nowrap transition-all ${
                      albumDecade === dec
                        ? 'bg-[var(--accent-dynamic)] border-transparent text-white shadow-sm'
                        : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {dec === 'all' ? `All Decades (${albums.length})` : dec}
                  </button>
                ))}
              </div>

              {/* Sorting & Vinyl Collection Link */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-[#09090B] px-2 py-1 rounded-lg border border-white/10 text-xs">
                  <select
                    value={albumSortBy}
                    onChange={(e) => setAlbumSortBy(e.target.value as any)}
                    className="bg-transparent text-xs text-[#E4E4E7] focus:outline-none font-mono-numbers"
                  >
                    <option value="title">Title (A-Z)</option>
                    <option value="artist">Artist</option>
                    <option value="year">Release Year</option>
                    <option value="trackCount">Track Count</option>
                  </select>
                  <button
                    onClick={() => setAlbumSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="p-0.5 text-[#A1A1AA] hover:text-white font-mono-numbers text-xs"
                    title="Toggle direction"
                  >
                    {albumSortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                <button
                  onClick={() => setActiveView('vinyl_collection')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--accent-dynamic)]/15 border border-[var(--accent-dynamic)] text-[var(--accent-dynamic)] hover:bg-[var(--accent-dynamic)] hover:text-white transition-all text-xs font-semibold shadow-glow-sm"
                  title="Open Virtual Vinyl Record Crate"
                >
                  <Disc size={13} />
                  <span>Vinyl Crate</span>
                </button>
              </div>
            </div>

            {/* Albums Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredAlbums.length === 0 ? (
                <HarmoniqEmptyState
                  type="empty_library"
                  title="No Matching Albums"
                  description="Adjust your search criteria or decade filters to explore your music collection."
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {filteredAlbums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => openAlbumDetail(album)}
                      className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)]/50 card-interactive cursor-pointer flex flex-col space-y-2.5 shadow-card transition-all"
                    >
                      <div className="relative aspect-square w-full rounded-xl bg-[#09090B] overflow-hidden flex items-center justify-center border border-[#272733] shadow-md">
                        {album.artworkDataUrl ? (
                          <img
                            src={album.artworkDataUrl}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Disc size={36} className="text-[#3F3F46]" />
                        )}

                        {/* Cardboard Spine Highlight */}
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-white/25 to-transparent pointer-events-none" />

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
                            }}
                            className="floating-play-btn p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:scale-110 active:scale-90 transition-all"
                            title="Play Album"
                          >
                            <Play size={16} className="ml-0.5 fill-white" />
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[var(--accent-dynamic)] transition-colors">
                          {album.title}
                        </h3>
                        <p className="text-[11px] text-[#A1A1AA] truncate">{album.artist}</p>
                        <p className="text-[10px] text-[#71717A] font-mono-numbers mt-0.5">
                          {album.trackCount} Tracks {album.year ? `• ${album.year}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ARTISTS CIRCLES */}
        {activeTab === 'artists' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 text-center">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => openArtistDetail(artist)}
                  className="group p-4 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] card-interactive cursor-pointer flex flex-col items-center space-y-3 shadow-card"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#1B1B24] to-[#272733] group-hover:from-[#7C3AED]/20 group-hover:to-[#A78BFA]/30 border border-[#272733] group-hover:border-[#A78BFA] flex items-center justify-center text-lg font-black text-[#A78BFA] shadow-md group-hover:scale-105 transition-all duration-300">
                    {artist.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 w-full">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[#A78BFA] transition-colors">
                      {artist.name}
                    </h3>
                    <p className="text-[10px] text-[#71717A] font-mono-numbers mt-0.5">
                      {artist.albumCount} {artist.albumCount === 1 ? 'Album' : 'Albums'} • {artist.trackCount} Tracks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. GENRES */}
        {activeTab === 'genres' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {genres.map((genre) => (
                <div
                  key={genre.name}
                  onClick={() => {
                    if (genre.tracks.length > 0) playTrack(genre.tracks[0], genre.tracks);
                  }}
                  className="p-5 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#A78BFA] transition-all cursor-pointer space-y-2 group shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-[#F5F3FF] group-hover:text-[#A78BFA] transition-colors">
                      {genre.name}
                    </h3>
                    <button className="p-2.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={14} className="ml-0.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#71717A] font-mono-numbers">
                    {genre.trackCount} Tracks
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. FOLDERS - HIERARCHICAL TREE EXPLORER */}
        {activeTab === 'folders' && (
          <div className="flex-1 overflow-hidden">
            <FolderTreeExplorer
              tracks={tracks}
              onSelectTrack={handlePlay}
              selectedTrackIds={selectedTrackIds}
              onToggleTrackSelect={handleToggleTrackSelect}
            />
          </div>
        )}

        {/* 6. LISTENING HISTORY */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-hidden">
            <ListeningHistoryView />
          </div>
        )}

        {/* 7. SMART PLAYLISTS */}
        {activeTab === 'smart_playlists' && (
          <div className="flex-1 overflow-hidden">
            <SmartPlaylistsSection />
          </div>
        )}
      </div>

      {/* Floating Multi-Select Batch Action Bar */}
      {selectedTrackIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#14141E]/95 backdrop-blur-xl border border-violet-500/30 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-white/10 text-xs font-semibold text-white">
            <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white font-mono-numbers text-[11px]">
              {selectedTrackIds.size}
            </span>
            <span>Selected</span>
          </div>

          <button
            onClick={handlePlaySelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm transition-all"
          >
            <Play size={13} fill="currentColor" /> Play
          </button>

          <button
            onClick={handleQueueSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors"
          >
            <ListPlus size={13} /> Add to Queue
          </button>

          <button
            onClick={handlePlaylistSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors"
          >
            <Plus size={13} /> Add to Playlist
          </button>

          <button
            onClick={() => setBulkEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors"
          >
            <span>Bulk Edit</span>
          </button>

          <button
            onClick={() => setShowRemoveConfirmModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-colors border border-rose-500/20"
          >
            <Trash2 size={13} /> Remove from Library
          </button>

          <button
            onClick={() => setSelectedTrackIds(new Set())}
            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Confirmation Modal for Removing from Library vs Disk */}
      {showRemoveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#14141E] border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Remove Tracks from Library</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{selectedTrackIds.size}</strong> track(s) from your Harmoniq library?
            </p>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              ✓ <strong>Safety Guarantee:</strong> Your actual music files and audio data will <strong>NOT</strong> be deleted from your hard drive. They are only removed from Harmoniq's indexed library.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRemoveConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveFromLibrary}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm"
              >
                Remove from Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modals */}
      <DuplicateDetectorModal
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
      />

      <MissingArtworkManager
        isOpen={missingArtworkOpen}
        onClose={() => setMissingArtworkOpen(false)}
      />

      <BulkMetadataModal
        isOpen={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        tracks={processedTracks.filter((t) => selectedTrackIds.has(t.id))}
        onComplete={() => {
          setSelectedTrackIds(new Set());
        }}
      />

      <TrackContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpenAddToPlaylist={(track) => setPlaylistModalTracks([track])}
      />

      <AddToPlaylistModal
        isOpen={!!playlistModalTracks}
        onClose={() => setPlaylistModalTracks(null)}
        tracks={playlistModalTracks || []}
      />
    </div>
  );
};
