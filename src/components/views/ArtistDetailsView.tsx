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
  Disc,
  FolderPlus,
} from 'lucide-react';

export const ArtistDetailsView: React.FC = () => {
  const { selectedArtist, setActiveView, openAlbumDetail, toggleFavorite } = useLibrary();
  const { playTrack, playNext, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  const allTracks = selectedArtist ? selectedArtist.albums.flatMap((a) => a.tracks) : [];

  const handlePlayAll = () => {
    if (allTracks.length > 0) {
      playTrack(allTracks[0], allTracks);
    }
  };

  const handlePlay = useCallback(
    (track: TrackMetadata) => {
      playTrack(track, allTracks);
    },
    [playTrack, allTracks]
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

  if (!selectedArtist) {
    return (
      <div className="p-8 text-center text-[#71717A] select-none">
        <p>No artist selected.</p>
        <button
          onClick={() => setActiveView('artists')}
          className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold"
        >
          Return to Artists
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-6xl mx-auto select-none">
      {/* Back Button */}
      <button
        onClick={() => setActiveView('artists')}
        className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to Artists</span>
      </button>

      {/* Artist Banner */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-[#272733]">
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#7C3AED]/30 to-[#A78BFA]/30 border-2 border-[#A78BFA] flex items-center justify-center text-[#F5F3FF] font-black text-3xl shadow-glow-sm shrink-0">
          {selectedArtist.name.substring(0, 2).toUpperCase()}
        </div>

        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <span className="text-xs uppercase font-mono-numbers font-bold tracking-wider text-[#A78BFA]">
            Artist
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#F5F3FF] tracking-tight truncate">
            {selectedArtist.name}
          </h1>
          <p className="text-xs text-[#71717A] font-mono-numbers">
            {selectedArtist.albumCount} {selectedArtist.albumCount === 1 ? 'Album' : 'Albums'} • {selectedArtist.trackCount} Tracks
          </p>
        </div>

        {allTracks.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
            >
              <Play size={16} className="ml-0.5" />
              <span>Play Discography</span>
            </button>
            <button
              onClick={() => setPlaylistModalTracks(allTracks)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-colors"
            >
              <FolderPlus size={15} className="text-[#A78BFA]" />
              <span>Add to Playlist</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Tracks Section */}
      {allTracks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#F5F3FF]">Top Songs</h2>
          {/* Table Header matching SongRow CSS Grid */}
          <SongTableHeader showAlbum={true} />
          <div className="space-y-0.5">
            {allTracks.slice(0, 10).map((track, idx) => (
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

      {/* Discography Albums */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-[#F5F3FF]">Discography</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {selectedArtist.albums.map((album) => (
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
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[#A78BFA] transition-colors">
                  {album.title}
                </h3>
                <p className="text-[10px] text-[#71717A] font-mono-numbers">
                  {album.trackCount} Tracks {album.year ? `• ${album.year}` : ''}
                </p>
              </div>
            </div>
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
