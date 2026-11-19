import React, { useState, useEffect } from 'react';
import { playlistFolderService } from '../../services/playlistFolderService';
import { Playlist, PlaylistHistoryEntry, PlaylistHistoryAction } from '../../types/library';
import { useToast } from '../../context/ToastContext';
import {
  History,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  X,
  Clock,
  ArrowUpDown,
  ListMusic,
  CheckCircle2,
} from 'lucide-react';

interface PlaylistHistoryModalProps {
  playlist: Playlist | null;
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const PlaylistHistoryModal: React.FC<PlaylistHistoryModalProps> = ({
  playlist,
  isOpen,
  onClose,
  onRestored,
}) => {
  const { showToast } = useToast();
  const [historyEntries, setHistoryEntries] = useState<PlaylistHistoryEntry[]>([]);

  const refreshHistory = () => {
    if (playlist) {
      setHistoryEntries(playlistFolderService.getHistoryForPlaylist(playlist.id));
    } else {
      setHistoryEntries([]);
    }
  };

  useEffect(() => {
    refreshHistory();
    return playlistFolderService.subscribeHistory(() => {
      refreshHistory();
    });
  }, [playlist?.id]);

  if (!isOpen || !playlist) return null;

  const handleRestore = (entry: PlaylistHistoryEntry) => {
    const success = playlistFolderService.restoreVersion(playlist.id, entry.id);
    if (success) {
      showToast(`Playlist restored to version with ${entry.trackCount} tracks`, 'success');
      onRestored?.();
      onClose();
    } else {
      showToast('Failed to restore playlist version', 'warning');
    }
  };

  const getActionBadge = (action: PlaylistHistoryAction) => {
    switch (action) {
      case 'created':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
            <Sparkles size={10} /> Created
          </span>
        );
      case 'tracks_added':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-600/20 text-sky-400 border border-sky-500/20">
            <Plus size={10} /> Tracks Added
          </span>
        );
      case 'tracks_removed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/20">
            <Trash2 size={10} /> Tracks Removed
          </span>
        );
      case 'tracks_reordered':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-600/20 text-[var(--accent-primary)] border border-violet-500/20">
            <ArrowUpDown size={10} /> Reordered
          </span>
        );
      case 'renamed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/20">
            <Edit2 size={10} /> Renamed / Moved
          </span>
        );
      case 'restored':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-600/20 text-pink-400 border border-pink-500/20">
            <RotateCcw size={10} /> Restored
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#14141B] border border-[#272733] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#272733] flex items-center justify-between bg-[#0D0D12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--ambient-primary)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
              <History size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Playlist Version History</h3>
              <p className="text-[11px] text-[#A1A1AA] truncate max-w-[320px]">
                {playlist.name} • {playlist.trackIds.length} current tracks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#71717A] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          <p className="text-xs text-[#A1A1AA]">
            Harmoniq automatically records snapshots when tracks are added, removed, or reordered. Inspect or restore any previous version at any time.
          </p>

          <div className="space-y-2 pt-2">
            {historyEntries.length === 0 ? (
              <div className="text-center py-10 text-[#71717A] text-xs space-y-2">
                <History size={26} className="mx-auto opacity-30" />
                <p>No historical changes recorded for this playlist yet.</p>
                <p className="text-[10px] text-[#71717A]/60">
                  Modifications (adding or removing tracks) will generate restore points automatically.
                </p>
              </div>
            ) : (
              historyEntries.map((entry, idx) => {
                const isCurrent = idx === 0;
                return (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between gap-3 text-xs group hover:border-[var(--accent-primary)]/30 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(entry.action)}
                        <span className="text-[10px] font-mono-numbers text-[#71717A]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono font-bold text-[var(--accent-primary)] bg-white/5 px-1.5 py-0.5 rounded">
                            Latest Version
                          </span>
                        )}
                      </div>

                      <p className="font-semibold text-white truncate">{entry.description}</p>

                      <div className="flex items-center gap-2 text-[11px] text-[#A1A1AA] font-mono-numbers">
                        <ListMusic size={12} className="text-[#71717A]" />
                        <span>{entry.trackCount} tracks in snapshot</span>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(entry)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[var(--accent-primary)] hover:text-black border border-white/10 text-xs font-semibold text-white transition-all flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm"
                      >
                        <RotateCcw size={12} />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
