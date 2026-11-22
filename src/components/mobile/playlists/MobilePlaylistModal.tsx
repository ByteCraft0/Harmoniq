import React, { useState, useEffect, useRef } from 'react';
import { useBackHandler } from '../MobileNavigationContext';
import { ListMusic, X } from 'lucide-react';

interface MobilePlaylistModalProps {
  isOpen: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string;
  confirmLabel?: string;
  onConfirm: (name: string, description?: string) => void;
  onClose: () => void;
}

export const MobilePlaylistModal: React.FC<MobilePlaylistModalProps> = ({
  isOpen,
  title,
  initialName = '',
  initialDescription = '',
  confirmLabel = 'Create',
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const inputRef = useRef<HTMLInputElement>(null);

  // Priority 1: System back button closes active modal dialog
  useBackHandler(
    1,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, description.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-2xl bg-[#14141b] border border-[#272733] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-zinc-400">Harmoniq Lite Playlist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Playlist Name <span className="text-violet-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chill Beats, Favorites, Running"
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b1b24] border border-[#2b2b3a] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Description <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b1b24] border border-[#2b2b3a] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#1f1f2c] border border-[#2b2b3a] text-zinc-300 hover:text-white text-xs font-semibold active:scale-98 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold active:scale-98 transition-all shadow-lg shadow-violet-900/30"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
