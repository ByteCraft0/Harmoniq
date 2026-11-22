import React, { useState } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { useBackHandler } from '../MobileNavigationContext';
import { TrackMetadata } from '../../../types/audio';
import { MobilePlaylistModal } from './MobilePlaylistModal';
import { ListMusic, Plus, Check, X, Sparkles } from 'lucide-react';

interface MobileAddToPlaylistModalProps {
  isOpen: boolean;
  track: TrackMetadata | null;
  onClose: () => void;
}

export const MobileAddToPlaylistModal: React.FC<MobileAddToPlaylistModalProps> = ({
  isOpen,
  track,
  onClose,
}) => {
  const { playlists, addTracksToPlaylist, createPlaylist } = useLibrary();
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Priority 1: System back button closes active modal dialog
  useBackHandler(
    1,
    () => {
      if (isCreatingNew) {
        setIsCreatingNew(false);
        return true;
      }
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen || !track) return null;

  // Filter out smart playlists (custom playlists only)
  const customPlaylists = playlists.filter((p) => !p.isSmart);

  const handleSelectPlaylist = (playlistId: string) => {
    addTracksToPlaylist(playlistId, [track.id]);
    onClose();
  };

  const handleCreateAndAdd = (name: string, description?: string) => {
    const pl = createPlaylist(name, description);
    addTracksToPlaylist(pl.id, [track.id]);
    setIsCreatingNew(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#14141b] border border-[#272733] p-5 shadow-2xl max-h-[80vh] flex flex-col text-white animate-in slide-in-from-bottom duration-250"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#272733]">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-bold text-white tracking-tight">Add to Playlist</h3>
              <p className="text-xs text-zinc-400 truncate">
                "{track.title}" • {track.artist}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Playlist Action */}
          <div className="py-3">
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 text-violet-300 active:scale-98 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-900/40">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Create New Playlist</p>
                <p className="text-[11px] text-violet-300/80">And add this song</p>
              </div>
            </button>
          </div>

          {/* Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-1 max-h-60 overscroll-contain">
            {customPlaylists.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ListMusic className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No custom playlists yet</p>
                <p className="text-[11px] text-zinc-500">Tap "Create New Playlist" above to start</p>
              </div>
            ) : (
              customPlaylists.map((pl) => {
                const alreadyContains = pl.trackIds.includes(track.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleSelectPlaylist(pl.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1b1b24] hover:bg-[#232330] border border-[#2b2b3a] active:scale-98 transition-all text-left"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="w-9 h-9 rounded-lg bg-[#272738] flex items-center justify-center text-zinc-400 flex-shrink-0">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                        <p className="text-xs text-zinc-400">
                          {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                    </div>
                    {alreadyContains ? (
                      <span className="flex items-center space-x-1 text-[11px] text-violet-400 font-medium px-2 py-1 rounded bg-violet-950/40 border border-violet-800/40 flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <MobilePlaylistModal
        isOpen={isCreatingNew}
        title="New Playlist"
        confirmLabel="Create & Add"
        onConfirm={handleCreateAndAdd}
        onClose={() => setIsCreatingNew(false)}
      />
    </>
  );
};
