import React, { useState, useCallback } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { SongRow, SongTableHeader } from '../layout/SongRow';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
import {
  ArrowLeft,
  Play,
  Shuffle,
  Disc,
  FolderPlus,
} from 'lucide-react';

export const AlbumDetailsView: React.FC = () => {
  const { selectedAlbum, setActiveView, toggleFavorite } = useLibrary();
  const { playTrack, playNext, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  const handlePlayAll = () => {
    if (selectedAlbum && selectedAlbum.tracks.length > 0) {
      playTrack(selectedAlbum.tracks[0], selectedAlbum.tracks);
    }
  };

  const handleShuffleAll = () => {
    if (selectedAlbum && selectedAlbum.tracks.length > 0) {
      const shuffled = [...selectedAlbum.tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const handlePlay = useCallback(
    (track: TrackMetadata) => {
      if (selectedAlbum) playTrack(track, selectedAlbum.tracks);
    },
    [playTrack, selectedAlbum]
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

  if (!selectedAlbum) {
    return (
      <div className="p-8 text-center text-[#71717A] select-none">
        <p>No album selected.</p>
        <button
          onClick={() => setActiveView('albums')}
          className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold"
        >
          Return to Albums
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-6xl mx-auto select-none">
      {/* Back Button */}
      <button
        onClick={() => setActiveView('albums')}
        className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to Albums</span>
      </button>

      {/* Album Header Banner */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-7 pb-6 border-b border-[#272733]">
        <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-2xl bg-[#14141B] border border-[#272733] overflow-hidden shadow-2xl flex items-center justify-center shrink-0">
          {selectedAlbum.artworkDataUrl ? (
            <img
              src={selectedAlbum.artworkDataUrl}
              alt={selectedAlbum.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Disc size={72} className="text-[#3F3F46]" />
          )}
        </div>

        <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
          <span className="text-xs uppercase font-mono-numbers font-bold tracking-wider text-[#A78BFA]">
            Album
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#F5F3FF] tracking-tight truncate">
            {selectedAlbum.title}
          </h1>
          <p className="text-base font-semibold text-[#A1A1AA] truncate">
            {selectedAlbum.artist}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-[#71717A] font-mono-numbers">
            {selectedAlbum.year && <span>{selectedAlbum.year}</span>}
            <span>•</span>
            <span>{selectedAlbum.trackCount} Tracks</span>
            <span>•</span>
            <span>{Math.round(selectedAlbum.totalDuration / 60)} min total</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
            >
              <Play size={16} className="ml-0.5" />
              <span>Play Album</span>
            </button>

            <button
              onClick={handleShuffleAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-colors"
            >
              <Shuffle size={15} />
              <span>Shuffle</span>
            </button>

            <button
              onClick={() => setPlaylistModalTracks(selectedAlbum.tracks)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-colors"
            >
              <FolderPlus size={15} className="text-[#A78BFA]" />
              <span>Add to Playlist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="space-y-1">
        {/* Table Header matching SongRow CSS Grid */}
        <SongTableHeader showAlbum={false} />

        {/* Stable, Memoized Song Rows */}
        <div className="space-y-0.5">
          {selectedAlbum.tracks.map((track, idx) => (
            <SongRow
              key={track.id}
              track={track}
              index={idx}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              showAlbum={false}
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
