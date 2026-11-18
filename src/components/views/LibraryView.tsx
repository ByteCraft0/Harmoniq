import React, { useState, useEffect, useCallback } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { useToast } from '../../context/ToastContext';
import { SongRow, SongTableHeader } from '../layout/SongRow';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
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
} from 'lucide-react';

interface LibraryViewProps {
  initialTab?: 'songs' | 'albums' | 'artists' | 'genres' | 'folders';
}

export const LibraryView: React.FC<LibraryViewProps> = ({ initialTab = 'songs' }) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'albums' | 'artists' | 'genres' | 'folders'>(initialTab);
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

  useEffect(() => {
    if (['songs', 'albums', 'artists', 'genres', 'folders'].includes(activeView)) {
      setActiveTab(activeView as any);
    }
  }, [activeView]);

  const handleTabChange = (tab: 'songs' | 'albums' | 'artists' | 'genres' | 'folders') => {
    setActiveTab(tab);
    if (['songs', 'albums', 'artists', 'folders'].includes(tab)) {
      setActiveView(tab as any);
    }
  };

  const displayTracks = searchQuery.trim() ? searchResults : tracks;

  const handlePlay = useCallback((track: TrackMetadata) => {
    playTrack(track, displayTracks);
  }, [playTrack, displayTracks]);

  const handlePlayNext = useCallback((track: TrackMetadata) => {
    playNext(track);
    showToast(`Playing next: "${track.title}"`, 'info');
  }, [playNext, showToast]);

  const handleAddToQueue = useCallback((track: TrackMetadata) => {
    addToQueue(track);
    showToast(`Added to queue: "${track.title}"`, 'success');
  }, [addToQueue, showToast]);

  const handleToggleFavorite = useCallback((trackId: string) => {
    toggleFavorite(trackId);
  }, [toggleFavorite]);

  const handleAddToPlaylist = useCallback((track: TrackMetadata) => {
    setPlaylistModalTracks([track]);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, track: TrackMetadata) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden px-8 py-6 select-none">
      {/* Header Tabs & Add Folder Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#272733]">
        <div className="flex items-center gap-1 bg-[#14141B] p-1 rounded-xl border border-[#272733]">
          <button
            onClick={() => handleTabChange('songs')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'songs'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Music size={14} className={activeTab === 'songs' ? 'text-[#A78BFA]' : ''} />
            <span>Songs ({displayTracks.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('albums')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'albums'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Disc size={14} className={activeTab === 'albums' ? 'text-[#A78BFA]' : ''} />
            <span>Albums ({albums.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('artists')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'artists'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Users size={14} className={activeTab === 'artists' ? 'text-[#A78BFA]' : ''} />
            <span>Artists ({artists.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('genres')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'genres'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <span>Genres ({genres.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('folders')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'folders'
                ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] shadow-sm'
                : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <Folder size={14} className={activeTab === 'folders' ? 'text-[#A78BFA]' : ''} />
            <span>Folders ({folderTree.length})</span>
          </button>
        </div>

        <button
          onClick={addMusicFolders}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#F5F3FF] transition-colors"
        >
          <FolderOpen size={14} className="text-[#A78BFA]" />
          <span>Add Music Folder</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto mt-4">
        {/* 1. SONGS TABLE */}
        {activeTab === 'songs' && (
          <div className="space-y-1">
            {displayTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-[#71717A]">
                <div className="w-16 h-16 rounded-2xl bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46] mb-3">
                  <Music size={32} />
                </div>
                <p className="text-sm font-bold text-[#F5F3FF]">No Tracks In Library</p>
                <p className="text-xs text-[#A1A1AA] max-w-sm mt-1">
                  Add local folders containing FLAC, WAV, ALAC, or MP3 files to begin.
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
                {/* Table Header matching SongRow CSS Grid */}
                <SongTableHeader showAlbum={true} />

                {/* Stable, Memoized Song Rows */}
                <div className="space-y-0.5">
                  {displayTracks.map((track, idx) => (
                    <SongRow
                      key={track.id}
                      track={track}
                      index={idx}
                      isCurrent={currentTrack?.id === track.id}
                      isPlaying={currentTrack?.id === track.id && isPlaying}
                      showAlbum={true}
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
        )}

        {/* 2. ALBUMS GRID */}
        {activeTab === 'albums' && (
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
        )}

        {/* 3. ARTISTS CIRCLES */}
        {activeTab === 'artists' && (
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
        )}

        {/* 4. GENRES */}
        {activeTab === 'genres' && (
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
        )}

        {/* 5. FOLDERS */}
        {activeTab === 'folders' && (
          <div className="space-y-3">
            {folderTree.map((node) => (
              <div
                key={node.path}
                className="p-4 rounded-xl bg-[#14141B] border border-[#272733] flex items-center justify-between shadow-card hover:bg-[#1B1B24] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <Folder size={20} className="text-[#A78BFA] shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate">{node.name}</h3>
                    <p className="text-[11px] text-[#71717A] truncate font-mono-numbers">{node.path}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-mono-numbers text-[#71717A]">
                    {node.trackCount} Tracks
                  </span>
                  <button
                    onClick={() => showFileInFolder(node.path)}
                    className="p-1.5 rounded-lg hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                    title="Open in Windows Explorer"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
