import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { queueManagerService } from '../../services/queueManagerService';
import { SavedQueue } from '../../types/queue';
import { useToast } from '../../context/ToastContext';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  ListMusic,
  Trash2,
  X,
  Music,
  ArrowUp,
  ArrowDown,
  Layers,
  Plus,
  Copy,
  Edit2,
  Save,
  Check,
  Heart,
} from 'lucide-react';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const {
    queue,
    currentTrack,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    replaceQueue,
    isShuffle,
    repeatMode,
    toggleShuffle,
    setRepeatMode,
  } = usePlayer();
  const { tracks: allTracks, toggleFavorite } = useLibrary();
  const { showToast } = useToast();

  const [savedQueues, setSavedQueues] = useState<SavedQueue[]>([]);
  const [activeQueue, setActiveQueue] = useState<SavedQueue | null>(null);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    return queueManagerService.subscribe((queues) => {
      setSavedQueues(queues);
      setActiveQueue(queueManagerService.getActiveQueue());
    });
  }, []);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = queue.reduce((sum, t) => sum + (t.duration || 0), 0);

  const handleSwitchQueue = (targetQueue: SavedQueue) => {
    if (activeQueue) {
      // Save current in-memory queue to old active queue first
      queueManagerService.updateQueueTracks(
        activeQueue.id,
        queue.map((t) => t.id),
        currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0
      );
    }

    queueManagerService.setActiveQueueId(targetQueue.id);
    setActiveQueue(targetQueue);

    // Load target queue tracks from library
    const loadedTracks = targetQueue.trackIds
      .map((id) => allTracks.find((t) => t.id === id))
      .filter((t): t is typeof allTracks[0] => !!t);

    replaceQueue(loadedTracks);

    // Apply queue's saved shuffle/repeat
    if (targetQueue.repeatMode) {
      setRepeatMode(targetQueue.repeatMode);
    }

    showToast(`Switched to "${targetQueue.name}" (${loadedTracks.length} tracks)`, 'info');
    setShowManageMenu(false);
  };

  const handleSaveActiveQueue = () => {
    if (activeQueue) {
      queueManagerService.updateQueueTracks(
        activeQueue.id,
        queue.map((t) => t.id),
        currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0
      );
      queueManagerService.updateQueueSettings(activeQueue.id, { isShuffle, repeatMode });
      showToast(`Saved "${activeQueue.name}" (${queue.length} tracks)`, 'success');
    }
  };

  const handleCreateNewQueue = () => {
    const name = prompt('Enter name for new queue:');
    if (name && name.trim()) {
      const newQ = queueManagerService.createQueue(
        name.trim(),
        'Custom saved playback queue',
        queue.map((t) => t.id)
      );
      setActiveQueue(newQ);
      showToast(`Created queue "${newQ.name}"`, 'success');
      setShowManageMenu(false);
    }
  };

  const handleDuplicateQueue = () => {
    if (!activeQueue) return;
    const dup = queueManagerService.duplicateQueue(activeQueue.id);
    if (dup) {
      showToast(`Duplicated to "${dup.name}"`, 'success');
      setShowManageMenu(false);
    }
  };

  const handleRenameQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQueue && renameValue.trim()) {
      queueManagerService.renameQueue(activeQueue.id, renameValue.trim());
      showToast(`Renamed queue to "${renameValue.trim()}"`, 'success');
      setIsRenaming(false);
      setRenameValue('');
    }
  };

  const handleDeleteQueue = () => {
    if (!activeQueue) return;
    if (savedQueues.length <= 1) {
      showToast('Cannot delete the only remaining queue', 'warning');
      return;
    }
    const name = activeQueue.name;
    queueManagerService.deleteQueue(activeQueue.id);
    showToast(`Deleted queue "${name}"`, 'info');
    setShowManageMenu(false);
  };

  return (
    <aside className="w-84 min-w-[340px] max-w-[340px] h-full bg-[#0D0D12]/90 backdrop-blur-2xl border-l border-[#272733]/80 flex flex-col z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#272733]/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic size={18} className="text-[var(--accent-primary)]" />
          <h3 className="font-bold text-sm text-[#F5F3FF]">Play Queue</h3>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-primary)] border border-[#272733]">
            {queue.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSaveActiveQueue}
            title="Save queue changes"
            className="p-1.5 rounded-lg text-[#71717A] hover:text-[var(--accent-primary)] hover:bg-[#1B1B24] transition-colors"
          >
            <Save size={15} />
          </button>
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

      {/* Multiple Saved Queues Switcher Bar */}
      <div className="px-3.5 py-2.5 bg-[#09090B]/60 border-b border-[#1C1C24] relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={13} className="text-[var(--accent-primary)] shrink-0" />
            {isRenaming ? (
              <form onSubmit={handleRenameQueue} className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="px-2 py-0.5 rounded bg-[#1B1B24] border border-[#272733] text-xs text-white"
                />
                <button type="submit" className="text-emerald-400 hover:text-emerald-300">
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => setIsRenaming(false)} className="text-[#71717A] hover:text-white">
                  <X size={13} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowManageMenu(!showManageMenu)}
                className="text-xs font-bold text-white hover:text-[var(--accent-primary)] truncate flex items-center gap-1 transition-colors"
              >
                <span>{activeQueue?.name || 'Active Queue'}</span>
                <span className="text-[10px] text-[#71717A]">▾</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (activeQueue) {
                  setRenameValue(activeQueue.name);
                  setIsRenaming(true);
                }
              }}
              title="Rename active queue"
              className="p-1 rounded text-[#71717A] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={handleCreateNewQueue}
              title="Create new queue"
              className="p-1 rounded text-[#71717A] hover:text-[var(--accent-primary)] hover:bg-white/5 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Dropdown Queues Menu */}
        {showManageMenu && (
          <div className="absolute top-full left-3.5 right-3.5 mt-1.5 bg-[#14141B] border border-[#272733] rounded-xl shadow-2xl p-2 z-40 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] px-2 py-1 font-mono-numbers">
              Saved Queues
            </div>

            <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
              {savedQueues.map((q) => {
                const isSelected = activeQueue?.id === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => handleSwitchQueue(q)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs truncate transition-all ${
                      isSelected
                        ? 'bg-[var(--ambient-primary)] text-[var(--accent-primary)] font-bold'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{q.name}</span>
                    <span className="text-[10px] font-mono-numbers text-[#71717A] ml-2 shrink-0">
                      {q.trackIds.length} tracks
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 border-t border-[#272733] flex items-center justify-between px-1 text-[11px]">
              <button
                onClick={handleDuplicateQueue}
                className="flex items-center gap-1 text-[#A1A1AA] hover:text-white py-1"
              >
                <Copy size={11} /> Duplicate
              </button>
              <button
                onClick={handleDeleteQueue}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 py-1"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="py-12">
            <HarmoniqEmptyState
              type="empty_queue"
              title="Queue is Empty"
              description="Play a song or add tracks from your library to start your listening session."
            />
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={`${track.id}_${idx}`}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                  isCurrent
                    ? 'bg-[#1B1B24] border border-[#272733] text-[var(--accent-primary)] font-bold shadow-sm'
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
                        isCurrent ? 'text-[var(--accent-primary)]' : 'text-[#F5F3FF]'
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(track);
                      }}
                      title={track.isFavorite ? 'Remove favorite' : 'Add favorite'}
                      className={`p-1 transition-colors ${
                        track.isFavorite ? 'text-rose-500' : 'text-[#71717A] hover:text-white'
                      }`}
                    >
                      <Heart size={12} fill={track.isFavorite ? 'currentColor' : 'none'} />
                    </button>
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
          <span>{Math.round(totalDuration / 60)} min total</span>
        </div>
      )}
    </aside>
  );
};
