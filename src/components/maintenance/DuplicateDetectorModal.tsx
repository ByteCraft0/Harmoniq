import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { maintenanceService, DuplicateGroup } from '../../services/maintenanceService';
import { libraryService } from '../../services/libraryService';
import { TrackMetadata } from '../../types/audio';
import {
  Copy,
  X,
  Play,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  HardDrive,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface DuplicateDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicateDetectorModal: React.FC<DuplicateDetectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tracks, showFileInFolder } = useLibrary();
  const { playTrack } = usePlayer();
  const { showToast } = useToast();

  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'fuzzy_metadata'>('all');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Scan duplicates
  const duplicateGroups = useMemo(() => {
    return maintenanceService.findDuplicates(tracks);
  }, [tracks, isOpen]);

  const filteredGroups = useMemo(() => {
    if (filterType === 'all') return duplicateGroups;
    return duplicateGroups.filter((g) => g.matchType === filterType);
  }, [duplicateGroups, filterType]);

  if (!isOpen) return null;

  const toggleSelectToRemove = (id: string) => {
    setSelectedToRemove((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const selectAllLowerQuality = () => {
    const toRemove = new Set<string>();
    for (const group of duplicateGroups) {
      for (const t of group.tracks) {
        if (t.id !== group.recommendedKeepId) {
          toRemove.add(t.id);
        }
      }
    }
    setSelectedToRemove(toRemove);
    showToast(`Selected ${toRemove.size} duplicate copies for removal`, 'info');
  };

  const handleConfirmRemove = () => {
    const ids = Array.from(selectedToRemove);
    const count = libraryService.removeTracks(ids);
    setSelectedToRemove(new Set());
    setShowConfirmModal(false);
    showToast(`Removed ${count} duplicate tracks from library (Files kept safely on disk)`, 'success');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101018] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Copy size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Duplicate Track Detector</h2>
              <p className="text-xs text-zinc-400">
                Identify duplicate audio files by hash, file size, or metadata matching
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Filter:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              All ({duplicateGroups.length})
            </button>
            <button
              onClick={() => setFilterType('exact')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterType === 'exact'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              Exact Matches ({duplicateGroups.filter((g) => g.matchType === 'exact').length})
            </button>
            <button
              onClick={() => setFilterType('fuzzy_metadata')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterType === 'fuzzy_metadata'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              Metadata Matches ({duplicateGroups.filter((g) => g.matchType === 'fuzzy_metadata').length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAllLowerQuality}
              disabled={duplicateGroups.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <Sparkles size={13} className="text-violet-400" />
              Auto-Select Lower Quality Copies
            </button>
            {selectedToRemove.size > 0 && (
              <button
                onClick={() => setSelectedToRemove(new Set())}
                className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Duplicate Groups List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-2">
              <CheckCircle size={36} className="text-emerald-500" />
              <p className="text-sm font-semibold text-white">No duplicate tracks found</p>
              <p className="text-xs text-zinc-400">
                Your music library is clean and free of redundant audio files
              </p>
            </div>
          ) : (
            filteredGroups.map((group, gIdx) => (
              <div
                key={group.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Group #{gIdx + 1}:</span>
                    <span className="text-zinc-400">{group.reason}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/5 text-zinc-400">
                    {group.matchType}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.tracks.map((track) => {
                    const isRecommended = track.id === group.recommendedKeepId;
                    const isSelected = selectedToRemove.has(track.id);

                    return (
                      <div
                        key={track.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
                            : isRecommended
                            ? 'bg-emerald-500/5 border border-emerald-500/20 text-white'
                            : 'bg-white/[0.02] border border-white/5 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectToRemove(track.id)}
                            className="rounded border-zinc-700 bg-zinc-900 text-rose-600 focus:ring-0 cursor-pointer"
                          />
                          <button
                            onClick={() => playTrack(track)}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Preview Track"
                          >
                            <Play size={13} fill="currentColor" />
                          </button>
                          <div className="truncate min-w-0">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-white truncate">{track.title}</span>
                              <span className="text-zinc-400 truncate">— {track.artist}</span>
                              {isRecommended && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 shrink-0">
                                  <ShieldCheck size={11} /> Keep (Best Quality)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono truncate">
                              {track.filePath}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 font-mono-numbers text-[11px] shrink-0 ml-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              track.isLossless
                                ? 'bg-violet-500/20 text-violet-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {track.codec} {track.bitrate}k
                          </span>
                          <span className="text-zinc-400">{formatFileSize(track.fileSize)}</span>
                          <button
                            onClick={() => showFileInFolder(track.filePath)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
                            title="Show in Windows Explorer"
                          >
                            <FolderOpen size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>
              Selected for removal:{' '}
              <strong className="text-white">{selectedToRemove.size}</strong> track(s)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={selectedToRemove.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white shadow-sm transition-all"
            >
              <Trash2 size={14} /> Remove Selected ({selectedToRemove.size})
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#14141E] border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Confirm Duplicate Removal</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You are about to remove <strong className="text-white">{selectedToRemove.size}</strong> duplicate track(s) from your Harmoniq library.
            </p>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              ✓ <strong>Safe Operation:</strong> The files on your hard drive are preserved intact. Only the duplicate entries in Harmoniq are cleared.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
