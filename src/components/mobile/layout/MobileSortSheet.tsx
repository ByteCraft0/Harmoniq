import React from 'react';
import { useBackHandler } from '../MobileNavigationContext';
import { ArrowDownAZ, Check, Clock, Calendar, Disc, User, X } from 'lucide-react';

export type TrackSortOption =
  | 'title_asc'
  | 'title_desc'
  | 'artist'
  | 'album'
  | 'duration_desc'
  | 'duration_asc'
  | 'date_added';

interface MobileSortSheetProps {
  isOpen: boolean;
  selectedOption: TrackSortOption;
  onSelectOption: (option: TrackSortOption) => void;
  onClose: () => void;
}

export const MobileSortSheet: React.FC<MobileSortSheetProps> = ({
  isOpen,
  selectedOption,
  onSelectOption,
  onClose,
}) => {
  // Priority 2: System back button closes active sort menu
  useBackHandler(
    2,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen) return null;

  const options: { id: TrackSortOption; label: string; icon: React.ReactNode }[] = [
    { id: 'title_asc', label: 'Title (A to Z)', icon: <ArrowDownAZ className="w-4 h-4" /> },
    { id: 'artist', label: 'Artist Name', icon: <User className="w-4 h-4" /> },
    { id: 'album', label: 'Album Title', icon: <Disc className="w-4 h-4" /> },
    { id: 'duration_desc', label: 'Duration (Longest first)', icon: <Clock className="w-4 h-4" /> },
    { id: 'duration_asc', label: 'Duration (Shortest first)', icon: <Clock className="w-4 h-4" /> },
    { id: 'date_added', label: 'Recently Added', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-[#14141b] border-t border-[#272733] p-5 shadow-2xl text-white animate-in slide-in-from-bottom duration-250"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#272733]">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Sort Songs</h3>
            <p className="text-xs text-zinc-400">Choose how library tracks are ordered</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Close sort sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1 py-1">
          {options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectOption(opt.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-violet-600/20 border border-violet-500/40 text-violet-300'
                    : 'bg-[#1b1b24] hover:bg-[#232330] border border-transparent text-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-violet-600 text-white' : 'bg-[#272738] text-zinc-400'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <span className="text-xs font-semibold">{opt.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-violet-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
