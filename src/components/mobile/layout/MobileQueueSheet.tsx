import React from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { useBackHandler } from '../MobileNavigationContext';
import { getArtworkUrl } from '../../../services/platform';
import {
  ListMusic,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Disc,
  Play,
  Volume2,
} from 'lucide-react';

interface MobileQueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileQueueSheet: React.FC<MobileQueueSheetProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    queue,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isPlaying,
  } = usePlayer();

  // Priority 2: System back button closes active queue sheet
  useBackHandler(
    2,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen) return null;

  // Find index of current track in queue
  const currentIndex = currentTrack
    ? queue.findIndex((t) => t.id === currentTrack.id)
    : -1;

  // Split into current track and upcoming tracks
  const upcomingTracks = currentIndex !== -1
    ? queue.slice(currentIndex + 1)
    : queue;

  const formatDuration = (secs?: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMoveUp = (upcomingIndex: number) => {
    if (upcomingIndex <= 0) return;
    const realFrom = currentIndex !== -1 ? currentIndex + 1 + upcomingIndex : upcomingIndex;
    const realTo = realFrom - 1;
    reorderQueue(realFrom, realTo);
  };

  const handleMoveDown = (upcomingIndex: number) => {
    if (upcomingIndex >= upcomingTracks.length - 1) return;
    const realFrom = currentIndex !== -1 ? currentIndex + 1 + upcomingIndex : upcomingIndex;
    const realTo = realFrom + 1;
    reorderQueue(realFrom, realTo);
  };

  const handleRemove = (upcomingIndex: number) => {
    const realIndex = currentIndex !== -1 ? currentIndex + 1 + upcomingIndex : upcomingIndex;
    removeFromQueue(realIndex);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full h-[85vh] max-h-[85vh] rounded-t-3xl bg-[#14141b] border-t border-[#272733] flex flex-col text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272733] flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Playback Queue</h3>
              <p className="text-xs text-zinc-400">
                {upcomingTracks.length} upcoming {upcomingTracks.length === 1 ? 'track' : 'tracks'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {upcomingTracks.length > 0 && (
              <button
                onClick={clearQueue}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 active:scale-95 transition-all flex items-center space-x-1"
                title="Clear upcoming tracks"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Close queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 overscroll-contain">
          {/* Currently Playing Card */}
          {currentTrack && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-2 block px-1">
                Now Playing
              </span>
              <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#1b1b26] to-[#14141b] border border-violet-700/40 flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                  <div className="w-12 h-12 rounded-xl bg-[#222230] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/10 relative">
                    {getArtworkUrl(currentTrack.artworkDataUrl) ? (
                      <img
                        src={getArtworkUrl(currentTrack.artworkDataUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Disc className="w-6 h-6 text-zinc-500" />
                    )}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-violet-950/60 flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-violet-300 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-400 px-2 flex-shrink-0">
                  {formatDuration(currentTrack.duration)}
                </span>
              </div>
            </div>
          )}

          {/* Up Next Section */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Up Next ({upcomingTracks.length})
              </span>
            </div>

            {upcomingTracks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#1b1b24]/50 border border-dashed border-[#272733] text-center space-y-2">
                <ListMusic className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-zinc-300">Queue is empty</p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Add tracks from your music library or playlists using "Play Next" or "Add to Queue".
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingTracks.map((track, idx) => {
                  const artUrl = getArtworkUrl(track.artworkDataUrl);
                  return (
                    <div
                      key={`${track.id}_${idx}`}
                      className="p-2.5 rounded-xl bg-[#1b1b24] border border-[#2b2b3a] hover:border-violet-500/40 flex items-center justify-between transition-all group"
                    >
                      <div
                        onClick={() => playTrack(track, queue)}
                        className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1 cursor-pointer pr-2"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#272738] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
                          {artUrl ? (
                            <img
                              src={artUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Disc className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>

                      {/* Reorder and Remove controls */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <span className="text-[11px] font-mono text-zinc-500 mr-1 hidden sm:inline">
                          {formatDuration(track.duration)}
                        </span>

                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20 active:scale-90 transition-all"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === upcomingTracks.length - 1}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20 active:scale-90 transition-all"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleRemove(idx)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-red-400 active:scale-90 transition-all ml-0.5"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
