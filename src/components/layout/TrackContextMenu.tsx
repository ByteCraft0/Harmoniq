import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { TrackMetadata } from '../../types/audio';
import { MetadataEditorModal } from '../inspector/MetadataEditorModal';
import {
  Play,
  Plus,
  ListPlus,
  FolderPlus,
  Heart,
  FileText,
  ExternalLink,
  Trash2,
  ChevronRight,
  Edit3,
} from 'lucide-react';

export interface ContextMenuState {
  track: TrackMetadata;
  x: number;
  y: number;
  playlistId?: string;
  playlistIndex?: number;
}

interface TrackContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onOpenAddToPlaylist: (track: TrackMetadata) => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  menu,
  onClose,
  onOpenAddToPlaylist,
}) => {
  const { playNow, playNext, addToQueue } = usePlayer();
  const {
    toggleFavorite,
    showFileInFolder,
    removeTrackFromPlaylist,
    setActiveView,
    playlists,
    addTracksToPlaylist,
  } = useLibrary();
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!isEditingTags && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditingTags) {
        onClose();
      }
    };

    if (menu) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu, onClose, isEditingTags]);

  if (!menu) return null;

  const { track, x, y, playlistId, playlistIndex } = menu;
  const customPlaylists = playlists.filter((p) => !p.isSmart);

  if (isEditingTags) {
    return (
      <MetadataEditorModal
        track={track}
        isOpen={isEditingTags}
        onClose={() => {
          setIsEditingTags(false);
          onClose();
        }}
      />
    );
  }

  // Keep menu within viewport bounds
  const menuWidth = 210;
  const menuHeight = playlistId ? 280 : 250;
  const adjustedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const adjustedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));
  const openSubmenuLeft = adjustedX + menuWidth + 190 > window.innerWidth;

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-52 rounded-xl bg-[#14141B] border border-[#272733] shadow-2xl py-1.5 select-none text-xs text-[#A1A1AA] animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Track Title Summary */}
      <div className="px-3 py-1.5 border-b border-[#272733] mb-1">
        <p className="font-bold text-[#F5F3FF] truncate">{track.title}</p>
        <p className="text-[10px] text-[#71717A] truncate">{track.artist}</p>
      </div>

      {/* Play Actions */}
      <button
        onClick={() => {
          playNow(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <Play size={13} className="text-[#A78BFA]" />
        <span>Play Now</span>
      </button>

      <button
        onClick={() => {
          playNext(track);
          showToast(`Playing next: "${track.title}"`, 'info');
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <Plus size={13} className="text-[#A78BFA]" />
        <span>Play Next</span>
      </button>

      <button
        onClick={() => {
          addToQueue(track);
          showToast(`Added to queue: "${track.title}"`, 'success');
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <ListPlus size={13} className="text-[#A78BFA]" />
        <span>Add to Queue</span>
      </button>

      <div className="my-1 border-t border-[#272733]" />

      {/* Playlist Actions with Submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowSubmenu(true)}
        onMouseLeave={() => setShowSubmenu(false)}
      >
        <button
          onClick={() => {
            onOpenAddToPlaylist(track);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <FolderPlus size={13} className="text-[#A78BFA]" />
            <span>Add to Playlist</span>
          </div>
          <ChevronRight size={12} className="text-[#71717A]" />
        </button>

        {showSubmenu && (
          <div
            style={{
              left: openSubmenuLeft ? '-195px' : '100%',
              top: '-4px',
            }}
            className="absolute z-50 w-48 rounded-xl bg-[#14141B] border border-[#272733] shadow-2xl py-1.5 text-xs text-[#A1A1AA] animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto"
          >
            <div className="px-3 py-1 text-[10px] font-bold text-[#71717A] uppercase tracking-wider border-b border-[#272733] mb-1">
              Select Playlist
            </div>
            {customPlaylists.length === 0 ? (
              <div className="px-3 py-2 text-center text-[#71717A] text-[11px]">
                No custom playlists yet
              </div>
            ) : (
              customPlaylists.map((pl) => {
                const isAlreadyIn = pl.trackIds.includes(track.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => {
                      addTracksToPlaylist(pl.id, [track.id]);
                      showToast(`Added "${track.title}" to "${pl.name}"`, 'success');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
                  >
                    <span className="truncate">{pl.name}</span>
                    {isAlreadyIn && (
                      <span className="text-[10px] text-emerald-400 shrink-0 ml-1">Added</span>
                    )}
                  </button>
                );
              })
            )}
            <div className="my-1 border-t border-[#272733]" />
            <button
              onClick={() => {
                onOpenAddToPlaylist(track);
                onClose();
              }}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#1B1B24] text-[#A78BFA] hover:text-[#C4B5FD] transition-colors text-left font-semibold text-[11px]"
            >
              <Plus size={12} />
              <span>Create / Manage...</span>
            </button>
          </div>
        )}
      </div>

      {playlistId !== undefined && playlistIndex !== undefined && (
        <button
          onClick={() => {
            removeTrackFromPlaylist(playlistId, playlistIndex);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-950/40 hover:text-red-400 transition-colors text-left text-red-400/90"
        >
          <Trash2 size={13} />
          <span>Remove from Playlist</span>
        </button>
      )}

      <div className="my-1 border-t border-[#272733]" />

      {/* Extra Actions */}
      <button
        onClick={() => {
          toggleFavorite(track.id);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <Heart
          size={13}
          className={track.isFavorite ? 'fill-red-500 text-red-500' : 'text-[#71717A]'}
        />
        <span>{track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>

      <button
        onClick={() => {
          setActiveView('lyrics');
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <FileText size={13} className="text-[#71717A]" />
        <span>View Synced Lyrics</span>
      </button>

      <button
        onClick={() => {
          setIsEditingTags(true);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <Edit3 size={13} className="text-[#A78BFA]" />
        <span>Edit Metadata</span>
      </button>

      <button
        onClick={() => {
          showFileInFolder(track.filePath);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#1B1B24] hover:text-[#F5F3FF] transition-colors text-left"
      >
        <ExternalLink size={13} className="text-[#71717A]" />
        <span>Reveal in Explorer</span>
      </button>
    </div>
  );
};
