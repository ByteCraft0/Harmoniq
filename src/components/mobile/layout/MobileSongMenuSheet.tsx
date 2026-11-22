import React, { useState } from 'react';
import { TrackMetadata } from '../../../types/audio';
import { usePlayer } from '../../../context/PlayerContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useBackHandler } from '../MobileNavigationContext';
import { getArtworkUrl } from '../../../services/platform';
import { MobileAddToPlaylistModal } from '../playlists/MobileAddToPlaylistModal';
import {
  Play,
  ListPlus,
  Radio,
  Heart,
  FolderPlus,
  Trash2,
  X,
  Disc,
} from 'lucide-react';

interface MobileSongMenuSheetProps {
  isOpen: boolean;
  track: TrackMetadata | null;
  onClose: () => void;
  playlistContextId?: string | null;
  onRemoveFromPlaylist?: () => void;
}

export const MobileSongMenuSheet: React.FC<MobileSongMenuSheetProps> = ({
  isOpen,
  track,
  onClose,
  playlistContextId,
  onRemoveFromPlaylist,
}) => {
  const { playTrack, playNext, addToQueue } = usePlayer();
  const { toggleFavorite } = useLibrary();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  // Priority 2: System back button closes active menu sheet
  useBackHandler(
    2,
    () => {
      if (isAddToPlaylistOpen) {
        setIsAddToPlaylistOpen(false);
        return true;
      }
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen || !track) return null;

  const artUrl = getArtworkUrl(track.artworkDataUrl);

  const handlePlayNow = () => {
    playTrack(track);
    onClose();
  };

  const handlePlayNext = () => {
    playNext(track);
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(track);
    onClose();
  };

  const handleToggleFavorite = () => {
    toggleFavorite(track);
    onClose();
  };

  const handleOpenAddToPlaylist = () => {
    setIsAddToPlaylistOpen(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-3xl bg-[#14141b] border-t border-x border-[#272733] p-4 pb-8 shadow-2xl text-white animate-in slide-in-from-bottom duration-250"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Handle */}
          <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />

          {/* Track Summary Header */}
          <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-[#272733]">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-11 h-11 rounded-xl bg-[#1b1b24] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
                {artUrl ? (
                  <img
                    src={artUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Disc className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{track.title}</p>
                <p className="text-xs text-zinc-400 truncate">
                  {track.artist} {track.album ? `• ${track.album}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action List */}
          <div className="space-y-1">
            <button
              onClick={handlePlayNow}
              className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center flex-shrink-0">
                <Play className="w-4 h-4 fill-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Play Now</p>
                <p className="text-[11px] text-zinc-400">Start playing this track immediately</p>
              </div>
            </button>

            <button
              onClick={handlePlayNext}
              className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Play Next</p>
                <p className="text-[11px] text-zinc-400">Insert directly after current song</p>
              </div>
            </button>

            <button
              onClick={handleAddToQueue}
              className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ListPlus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Add to Queue</p>
                <p className="text-[11px] text-zinc-400">Append to playback queue</p>
              </div>
            </button>

            <button
              onClick={handleOpenAddToPlaylist}
              className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-fuchsia-600/20 text-fuchsia-400 flex items-center justify-center flex-shrink-0">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Add to Playlist</p>
                <p className="text-[11px] text-zinc-400">Add to an existing or new custom playlist</p>
              </div>
            </button>

            <button
              onClick={handleToggleFavorite}
              className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <Heart
                  className={`w-4 h-4 ${
                    track.isFavorite ? 'fill-red-500 text-red-500' : 'text-red-400'
                  }`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </p>
                <p className="text-[11px] text-zinc-400">Save to your starred favorites collection</p>
              </div>
            </button>

            {onRemoveFromPlaylist && playlistContextId && (
              <button
                onClick={() => {
                  onRemoveFromPlaylist();
                  onClose();
                }}
                className="w-full flex items-center space-x-3.5 px-3 py-2.5 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-colors text-left text-red-400"
              >
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-400">Remove from this Playlist</p>
                  <p className="text-[11px] text-zinc-500">Audio file will not be deleted</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      <MobileAddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        track={track}
        onClose={() => {
          setIsAddToPlaylistOpen(false);
          onClose();
        }}
      />
    </>
  );
};
