import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { Playlist } from '../../types/library';
import {
  Search,
  X,
  Check,
  ListMusic,
  Plus,
  CheckSquare,
  Square,
} from 'lucide-react';

interface AddSongsToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
}

const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const AddSongsToPlaylistModal: React.FC<AddSongsToPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
}) => {
  const { tracks, addTracksToPlaylist } = useLibrary();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const existingTrackIds = useMemo(() => {
    return new Set(playlist?.trackIds || []);
  }, [playlist?.trackIds]);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, search]);

  if (!isOpen || !playlist) return null;

  const toggleSelect = (id: string) => {
    if (existingTrackIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const available = filteredTracks.filter((t) => !existingTrackIds.has(t.id));
    if (selectedIds.size >= available.length && available.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map((t) => t.id)));
    }
  };

  const handleAddSelected = () => {
    if (selectedIds.size === 0) return;
    const idsToAdd = Array.from(selectedIds);
    addTracksToPlaylist(playlist.id, idsToAdd);
    showToast(`Added ${idsToAdd.length} track${idsToAdd.length > 1 ? 's' : ''} to "${playlist.name}"`, 'success');
    setSelectedIds(new Set());
    setSearch('');
    onClose();
  };

  const availableCount = filteredTracks.filter((t) => !existingTrackIds.has(t.id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#272733] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1B1B24] border border-[#272733] flex items-center justify-center text-[#A78BFA]">
                <ListMusic size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F5F3FF]">
                  Add Songs to <span className="text-[#A78BFA]">"{playlist.name}"</span>
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Select songs from your library to add to this playlist
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
            >
              <X size={17} />
            </button>
          </div>

          {/* Search bar and Select All */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs by title, artist, or album..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
              />
            </div>

            {availableCount > 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#22222E] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors shrink-0"
              >
                {selectedIds.size >= availableCount ? (
                  <>
                    <CheckSquare size={13} className="text-[#A78BFA]" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={13} />
                    <span>Select All</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-[#272733]/40">
          {filteredTracks.length === 0 ? (
            <div className="py-12 text-center text-[#71717A] text-xs">
              <p className="font-semibold text-[#F5F3FF]">No matching songs found</p>
              <p className="mt-1">Try another search keyword.</p>
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isAlreadyIn = existingTrackIds.has(track.id);
              const isSelected = selectedIds.has(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => toggleSelect(track.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isAlreadyIn
                      ? 'opacity-60 cursor-default bg-[#09090B]/30'
                      : isSelected
                      ? 'bg-[#1B1B24] border border-[#7C3AED]/40'
                      : 'hover:bg-[#1B1B24]/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox indicator */}
                    <div className="shrink-0">
                      {isAlreadyIn ? (
                        <span className="w-4 h-4 rounded flex items-center justify-center bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                          <Check size={11} />
                        </span>
                      ) : isSelected ? (
                        <span className="w-4 h-4 rounded flex items-center justify-center bg-[#7C3AED] text-white">
                          <Check size={11} />
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded border border-[#3F3F46] block" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-semibold ${isSelected ? 'text-[#A78BFA]' : 'text-[#F5F3FF]'}`}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Status & Duration */}
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {isAlreadyIn && (
                      <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                        In Playlist
                      </span>
                    )}
                    <span className="text-[11px] font-mono-numbers text-[#71717A]">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#272733] bg-[#0D0D12] flex items-center justify-between">
          <span className="text-xs text-[#A1A1AA]">
            <span className="font-bold text-[#F5F3FF] font-mono-numbers">{selectedIds.size}</span> tracks selected
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleAddSelected}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-40 text-xs font-bold text-[#F5F3FF] shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Add to Playlist ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
