import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { ListMusic, Trash2, X, Music, ArrowUp, ArrowDown } from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const { queue, currentTrack, playTrack, removeFromQueue, reorderQueue, clearQueue } = usePlayer();

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = queue.reduce((sum, t) => sum + (t.duration || 0), 0);

  return (
    <aside className="w-80 h-full bg-[#0D0D12]/85 backdrop-blur-2xl border-l border-[#272733]/80 flex flex-col z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#272733]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ListMusic size={18} className="text-[var(--accent-dynamic)]" />
          <h3 className="font-bold text-sm text-[#F5F3FF]">Play Queue</h3>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
            {queue.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              title="Clear queue"
              className="p-1.5 rounded-lg text-[#71717A] hover:text-red-400 hover:bg-[#1B1B24] transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F3FF] hover:bg-[#1B1B24] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[#71717A] text-xs p-4">
            <Music size={32} className="mb-2 text-[#3F3F46]" />
            <p className="font-bold text-[#F5F3FF]">Queue is empty</p>
            <p className="mt-1">Add tracks from your music library.</p>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}_${idx}`}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                  isCurrent
                    ? 'bg-[#1B1B24] border border-[#272733] text-[#A78BFA] font-bold'
                    : 'hover:bg-[#14141B] text-[#A1A1AA]'
                }`}
              >
                <div
                  onClick={() => playTrack(track)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <span className="w-5 text-center font-mono-numbers text-[10px] text-[#71717A]">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-semibold truncate ${
                        isCurrent ? 'text-[#A78BFA]' : 'text-[#F5F3FF]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-[10px] text-[#71717A] truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-mono-numbers text-[10px] text-[#71717A] group-hover:hidden">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Reordering and remove buttons visible on hover */}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    {idx > 0 && (
                      <button
                        onClick={() => reorderQueue(idx, idx - 1)}
                        title="Move Up"
                        className="p-1 hover:text-[#F5F3FF]"
                      >
                        <ArrowUp size={12} />
                      </button>
                    )}
                    {idx < queue.length - 1 && (
                      <button
                        onClick={() => reorderQueue(idx, idx + 1)}
                        title="Move Down"
                        className="p-1 hover:text-[#F5F3FF]"
                      >
                        <ArrowDown size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => removeFromQueue(idx)}
                      title="Remove"
                      className="p-1 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Queue Total Duration Footer */}
      {queue.length > 0 && (
        <div className="p-3.5 border-t border-[#272733] bg-[#09090B] flex justify-between text-xs text-[#71717A] font-mono-numbers">
          <span>{queue.length} Tracks</span>
          <span>{Math.round(totalDuration / 60)} min remaining</span>
        </div>
      )}
    </aside>
  );
};
