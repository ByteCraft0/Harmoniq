import React from 'react';
import { ListPlus, Sparkles } from 'lucide-react';
import { UnifiedTrack } from '../../types/universalMusic';
import { DiscoveryResultCard } from './DiscoveryResultCard';

interface DiscoveryResultsListProps {
  tracks: UnifiedTrack[];
  onPlayTrack: (track: UnifiedTrack) => void;
  onAddToQueue: (track: UnifiedTrack) => void;
  onPlayNext: (track: UnifiedTrack) => void;
  onQueueAll?: (tracks: UnifiedTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export const DiscoveryResultsList: React.FC<DiscoveryResultsListProps> = ({
  tracks,
  onPlayTrack,
  onAddToQueue,
  onPlayNext,
  onQueueAll,
  currentTrackId,
  isPlaying,
}) => {
  if (!tracks || tracks.length === 0) return null;

  const playableTracks = tracks.filter(
    (t) =>
      t.playbackCapability === 'full_stream' ||
      t.playbackCapability === 'preview_stream' ||
      t.playbackCapability === 'local_file'
  );

  return (
    <div className="mt-2.5 pt-2 border-t border-violet-500/20 space-y-1.5 select-none">
      {/* Header with Quick Action */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5 pb-1">
        <div className="flex items-center gap-1 font-medium text-violet-300">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span>Discovered Songs ({tracks.length})</span>
        </div>
        {playableTracks.length > 1 && onQueueAll && (
          <button
            onClick={() => onQueueAll(playableTracks)}
            className="flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-100 bg-violet-950/40 hover:bg-violet-900/60 border border-violet-500/30 px-2 py-0.5 rounded-md transition-colors"
          >
            <ListPlus className="w-3 h-3" />
            <span>Queue All ({playableTracks.length})</span>
          </button>
        )}
      </div>

      {/* Cards List */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-violet-800/40">
        {tracks.map((track, idx) => (
          <DiscoveryResultCard
            key={track.id || `${track.providerId}_${idx}`}
            track={track}
            index={idx}
            onPlay={onPlayTrack}
            onAddToQueue={onAddToQueue}
            onPlayNext={onPlayNext}
            isPlaying={isPlaying && currentTrackId === track.id}
          />
        ))}
      </div>
    </div>
  );
};
