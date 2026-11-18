import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { TrackMetadata } from '../../types/audio';
import { ListMusic, Plus, X, Check } from 'lucide-react';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackMetadata[];
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  tracks,
}) => {
  const { playlists, createPlaylist, addTracksToPlaylist } = useLibrary();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen || tracks.length === 0) return null;

  const customPlaylists = playlists.filter((p) => !p.isSmart);

  const handleSelectPlaylist = (playlistId: string) => {
    const trackIds = tracks.map((t) => t.id);
    addTracksToPlaylist(playlistId, trackIds);
    onClose();
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    const pl = createPlaylist(trimmed);
    const trackIds = tracks.map((t) => t.id);
    addTracksToPlaylist(pl.id, trackIds);
    setNewPlaylistName('');
    setIsCreating(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#272733]">
          <div>
            <h3 className="text-sm font-bold text-[#F5F3FF]">Add to Playlist</h3>
            <p className="text-[11px] text-[#A1A1AA] truncate max-w-[240px]">
              {tracks.length === 1
                ? `"${tracks[0].title}"`
                : `${tracks.length} selected tracks`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#71717A] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Existing Custom Playlists List */}
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {customPlaylists.length === 0 ? (
            <div className="text-center py-4 text-xs text-[#71717A]">
              <ListMusic size={28} className="mx-auto mb-1.5 text-[#3F3F46]" />
              <p>No custom playlists created yet.</p>
            </div>
          ) : (
            customPlaylists.map((pl) => {
              const alreadyHasAll = tracks.every((t) => pl.trackIds.includes(t.id));
              return (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs hover:bg-[#1B1B24] border border-transparent hover:border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <ListMusic size={15} className="text-[#A78BFA] shrink-0" />
                    <span className="truncate font-semibold">{pl.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alreadyHasAll && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Check size={11} /> Added
                      </span>
                    )}
                    <span className="text-[10px] font-mono-numbers text-[#71717A]">
                      {pl.trackIds.length} tracks
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Create New Playlist option */}
        <div className="pt-2 border-t border-[#272733]">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#1B1B24] hover:bg-[#242432] text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
            >
              <Plus size={14} />
              <span>Create New Playlist & Add</span>
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewPlaylistName('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#71717A] hover:text-[#F5F3FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-50 text-xs font-bold text-[#F5F3FF]"
                >
                  Create & Add
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
