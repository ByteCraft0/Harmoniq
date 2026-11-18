import React from 'react';
import { TrackMetadata } from '../../types/audio';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import {
  Play,
  Heart,
  Plus,
  FolderPlus,
  MoreVertical,
  Trash2,
} from 'lucide-react';

export const SONG_TABLE_GRID_WITH_ALBUM =
  '48px minmax(130px, 3fr) minmax(110px, 2fr) minmax(100px, 1.8fr) 52px 105px 76px';

export const SONG_TABLE_GRID_NO_ALBUM =
  '48px minmax(160px, 3.5fr) minmax(130px, 2.5fr) 52px 105px 76px';

interface SongTableHeaderProps {
  showAlbum?: boolean;
}

export const SongTableHeader: React.FC<SongTableHeaderProps> = ({ showAlbum = true }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showAlbum ? SONG_TABLE_GRID_WITH_ALBUM : SONG_TABLE_GRID_NO_ALBUM,
        alignItems: 'center',
      }}
      className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers border-b border-[#272733] mb-1 select-none"
    >
      <span className="text-center font-mono-numbers">#</span>
      <span className="truncate pr-4 min-w-0">Title</span>
      <span className="truncate pr-4 min-w-0">Artist</span>
      {showAlbum && <span className="truncate pr-4 min-w-0">Album</span>}
      <span className="text-right pr-3 min-w-0">Time</span>
      <span className="text-right pr-2 min-w-0">Format</span>
      <span className="min-w-0" />
    </div>
  );
};

interface SongRowProps {
  track: TrackMetadata;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  showAlbum?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onPlay: (track: TrackMetadata) => void;
  onPlayNext: (track: TrackMetadata) => void;
  onAddToQueue: (track: TrackMetadata) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (track: TrackMetadata) => void;
  onContextMenu: (e: React.MouseEvent, track: TrackMetadata, index: number) => void;
  onRemoveFromPlaylist?: (index: number) => void;
}

const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const SongRowComponent: React.FC<SongRowProps> = ({
  track,
  index,
  isCurrent,
  isPlaying,
  showAlbum = true,
  isSelected = false,
  onToggleSelect,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onToggleFavorite,
  onAddToPlaylist,
  onContextMenu,
  onRemoveFromPlaylist,
}) => {
  const tier = AudioQualityInspectorService.calculateQualityTier(track);

  return (
    <div
      onClick={() => onPlay(track)}
      onDoubleClick={() => onPlay(track)}
      onContextMenu={(e) => onContextMenu(e, track, index)}
      style={{
        display: 'grid',
        gridTemplateColumns: showAlbum ? SONG_TABLE_GRID_WITH_ALBUM : SONG_TABLE_GRID_NO_ALBUM,
        alignItems: 'center',
      }}
      className={`group px-3 h-10 min-h-[40px] max-h-[40px] rounded-xl text-xs select-none cursor-pointer transition-colors duration-150 box-border ${
        isSelected
          ? 'bg-violet-900/30 border border-violet-500/40 text-violet-200'
          : isCurrent
          ? 'bg-[#1B1B24] border border-[#272733] text-[#A78BFA] font-bold shadow-sm'
          : 'border border-transparent hover:bg-[#14141B] text-[#A1A1AA]'
      }`}
    >
      {/* 1. # & Favorite (48px) */}
      <div className="flex items-center gap-1 min-w-0">
        {onToggleSelect ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="w-4 h-4 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
          </div>
        ) : null}
        <div className="w-6 h-6 relative flex items-center justify-center shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(track);
            }}
            title="Play"
            className="absolute inset-0 m-auto w-6 h-6 rounded-full flex items-center justify-center text-[#A78BFA] hover:text-[#F5F3FF] hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <Play size={12} className="ml-0.5 fill-current" />
          </button>
          <div className="transition-opacity duration-150 group-hover:opacity-0 flex items-center justify-center">
            {isCurrent && isPlaying ? (
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-[#A78BFA] rounded-full animate-audio-bar-1" />
                <span className="w-0.5 bg-[#A78BFA] rounded-full animate-audio-bar-2" />
                <span className="w-0.5 bg-[#A78BFA] rounded-full animate-audio-bar-3" />
              </div>
            ) : (
              <span className="font-mono-numbers text-[11px] text-[#71717A]">
                {index + 1}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(track.id);
          }}
          title={track.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
          className="p-0.5 text-[#71717A] hover:text-red-400 transition-colors shrink-0"
        >
          <Heart
            size={12}
            className={track.isFavorite ? 'fill-red-500 text-red-500' : ''}
          />
        </button>
      </div>

      {/* 2. Title */}
      <div className="min-w-0 pr-4 truncate" title={track.title}>
        <span
          className={`truncate block ${
            isCurrent ? 'text-[#A78BFA] font-bold' : 'text-[#F5F3FF] font-medium'
          }`}
        >
          {track.title}
        </span>
      </div>

      {/* 3. Artist */}
      <div className="min-w-0 pr-4 truncate text-[#A1A1AA] font-normal" title={track.artist}>
        <span className="truncate block">{track.artist}</span>
      </div>

      {/* 4. Album (Optional) */}
      {showAlbum && (
        <div className="min-w-0 pr-4 truncate text-[#71717A] font-normal" title={track.album || undefined}>
          <span className="truncate block">{track.album || '—'}</span>
        </div>
      )}

      {/* 5. Duration */}
      <div className="min-w-0 pr-3 text-right font-mono-numbers text-[11px] text-[#71717A] truncate">
        {formatDuration(track.duration)}
      </div>

      {/* 6. Format Quality Badge */}
      <div className="min-w-0 pr-2 flex items-center justify-end overflow-hidden">
        <QualityBadge tier={tier} size="sm" />
      </div>

      {/* 7. Action Buttons (smooth opacity fade, invariant dimensions) */}
      <div className="min-w-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayNext(track);
          }}
          title="Play Next"
          className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
        >
          <Plus size={13} />
        </button>

        {onRemoveFromPlaylist ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromPlaylist(index);
            }}
            title="Remove from playlist"
            className="p-1 rounded-md text-[#A1A1AA] hover:text-red-400 hover:bg-[#1B1B24] transition-colors"
          >
            <Trash2 size={13} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlaylist(track);
            }}
            title="Add to Playlist"
            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
          >
            <FolderPlus size={13} />
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, track, index);
          }}
          title="More Options"
          className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
        >
          <MoreVertical size={13} />
        </button>
      </div>
    </div>
  );
};

export const SongRow = React.memo(SongRowComponent, (prev, next) => {
  return (
    prev.track.id === next.track.id &&
    prev.track.title === next.track.title &&
    prev.track.artist === next.track.artist &&
    prev.track.album === next.track.album &&
    prev.track.duration === next.track.duration &&
    prev.track.isFavorite === next.track.isFavorite &&
    prev.isCurrent === next.isCurrent &&
    prev.isPlaying === next.isPlaying &&
    prev.index === next.index &&
    prev.showAlbum === next.showAlbum
  );
});
