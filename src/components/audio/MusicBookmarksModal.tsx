import React, { useState, useEffect, useMemo } from 'react';
import { bookmarkService } from '../../services/bookmarkService';
import { MusicBookmark } from '../../types/bookmark';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import {
  Bookmark,
  Plus,
  Play,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';

interface MusicBookmarksModalProps {
  track: TrackMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MusicBookmarksModal: React.FC<MusicBookmarksModalProps> = ({
  track,
  isOpen,
  onClose,
}) => {
  const { currentTime, seekTo } = usePlayer();
  const { showToast } = useToast();

  const [bookmarks, setBookmarks] = useState<MusicBookmark[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');

  const refreshBookmarks = () => {
    if (track) {
      setBookmarks(bookmarkService.getBookmarksForTrack(track.id));
    } else {
      setBookmarks([]);
    }
  };

  useEffect(() => {
    refreshBookmarks();
    return bookmarkService.subscribe(() => {
      refreshBookmarks();
    });
  }, [track?.id]);

  if (!isOpen || !track) return null;

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;
    const bm = bookmarkService.addBookmark(track.id, newTitle, currentTime, newNote);
    showToast(`Bookmarked at ${bookmarkService.formatTimestamp(bm.timestamp)}`, 'success');
    setNewTitle('');
    setNewNote('');
    setIsAdding(false);
    refreshBookmarks();
  };

  const handleSeekToBookmark = (bm: MusicBookmark) => {
    seekTo(bm.timestamp);
    showToast(`Jumped to ${bm.title} (${bookmarkService.formatTimestamp(bm.timestamp)})`, 'info');
    onClose();
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkService.deleteBookmark(id);
    showToast('Bookmark deleted', 'info');
    refreshBookmarks();
  };

  const handleStartEdit = (bm: MusicBookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(bm.id);
    setEditTitle(bm.title);
    setEditNote(bm.note || '');
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkService.updateBookmark(id, { title: editTitle, note: editNote });
    setEditingId(null);
    showToast('Bookmark updated', 'success');
    refreshBookmarks();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#14141B] border border-[#272733] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#272733] flex items-center justify-between bg-[#0D0D12]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--ambient-primary)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
              <Bookmark size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Audio Bookmarks</h3>
              <p className="text-[11px] text-[#A1A1AA] truncate max-w-[320px]">
                {track.title} • {track.artist}
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Quick Add Bar */}
          {!isAdding ? (
            <button
              onClick={() => {
                setNewTitle(`Mark at ${bookmarkService.formatTimestamp(currentTime)}`);
                setIsAdding(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)] bg-[var(--ambient-primary)]/20 hover:bg-[var(--ambient-primary)]/40 text-xs font-semibold text-[var(--accent-primary)] flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Plus size={14} />
              <span>Bookmark Current Position ({bookmarkService.formatTimestamp(currentTime)})</span>
            </button>
          ) : (
            <form onSubmit={handleAddBookmark} className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock size={12} className="text-[var(--accent-primary)]" />
                  New Bookmark at {bookmarkService.formatTimestamp(currentTime)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-[#71717A] hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#71717A] block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Guitar Solo, Drop, Chorus 2"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#1B1B24] border border-[#272733] text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#71717A] block mb-1">Optional Notes</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Notes, cues, or tempo changes"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#1B1B24] border border-[#272733] text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-black text-xs font-bold hover:brightness-110 transition-all shadow-sm"
                >
                  Save Bookmark
                </button>
              </div>
            </form>
          )}

          {/* Bookmarks List */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#71717A] font-mono-numbers block">
              Saved Track Timestamps ({bookmarks.length})
            </span>

            {bookmarks.length === 0 ? (
              <div className="text-center py-8 text-[#71717A] text-xs space-y-1">
                <Bookmark size={24} className="mx-auto opacity-30" />
                <p>No bookmarks saved for this track yet.</p>
                <p className="text-[10px] text-[#71717A]/60">
                  Bookmark solos, key changes, or moments to instantly jump to them.
                </p>
              </div>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleSeekToBookmark(bm)}
                  className="group flex items-center justify-between p-3 rounded-xl bg-[#0D0D12] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-primary)]/40 transition-all cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Timestamp pill */}
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--ambient-primary)] text-[var(--accent-primary)] font-mono-numbers font-bold text-xs shrink-0 flex items-center gap-1 group-hover:bg-[var(--accent-primary)] group-hover:text-black transition-colors">
                      <Play size={10} className="fill-current" />
                      <span>{bookmarkService.formatTimestamp(bm.timestamp)}</span>
                    </div>

                    {editingId === bm.id ? (
                      <div className="flex-1 space-y-1.5 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#14141B] border border-[#272733] text-xs text-white"
                        />
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Optional note"
                          className="w-full px-2 py-1 rounded bg-[#14141B] border border-[#272733] text-[11px] text-[#A1A1AA]"
                        />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                          {bm.title}
                        </p>
                        {bm.note && (
                          <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{bm.note}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {editingId === bm.id ? (
                      <button
                        onClick={(e) => handleSaveEdit(bm.id, e)}
                        className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleStartEdit(bm, e)}
                        title="Edit Bookmark"
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-white hover:bg-white/5 transition-all"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteBookmark(bm.id, e)}
                      title="Delete Bookmark"
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
