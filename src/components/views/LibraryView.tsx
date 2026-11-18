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
import { TrackMetadata } from '../../types/audio';
import { libraryService } from '../../services/libraryService';
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

  // Advanced Filtering & Sorting
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration' | 'bitrate' | 'playCount' | 'dateAdded'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

        <button
          onClick={addMusicFolders}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#F5F3FF] transition-colors"
        >
          <FolderOpen size={14} className="text-violet-400" />
          <span>Add Music Folder</span>
        </button>
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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {processedTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-[#71717A]">
                  <div className="w-16 h-16 rounded-2xl bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46] mb-3">
                    <Music size={32} />
                  </div>
                  <p className="text-sm font-bold text-[#F5F3FF]">No Tracks Found</p>
                  <p className="text-xs text-[#A1A1AA] max-w-sm mt-1">
                    Add local music folders or adjust your active search and format filters.
                  </p>
                  <button
                    onClick={addMusicFolders}
                    className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-xs font-bold text-[#F5F3FF] shadow-glow-sm"
                  >
                    Add Music Folder
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  <SongTableHeader showAlbum={true} />
                  <div className="space-y-0.5">
                    {processedTracks.map((track, idx) => (
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ALBUMS GRID */}
        {activeTab === 'albums' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {albums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => openAlbumDetail(album)}
                  className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#3B3B4E] transition-all cursor-pointer flex flex-col space-y-2.5 shadow-card"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-[#09090B] overflow-hidden flex items-center justify-center border border-[#272733]">
                    {album.artworkDataUrl ? (
                      <img
                        src={album.artworkDataUrl}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Disc size={36} className="text-[#3F3F46]" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
                        }}
                        className="p-3.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:scale-110 transition-transform"
                      >
                        <Play size={18} className="ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[#A78BFA] transition-colors">
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
                  className="group p-4 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#A78BFA] transition-all cursor-pointer flex flex-col items-center space-y-3 shadow-card"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#1B1B24] to-[#272733] group-hover:from-[#7C3AED]/20 group-hover:to-[#A78BFA]/30 border border-[#272733] group-hover:border-[#A78BFA] flex items-center justify-center text-lg font-black text-[#A78BFA] shadow-md transition-all">
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
