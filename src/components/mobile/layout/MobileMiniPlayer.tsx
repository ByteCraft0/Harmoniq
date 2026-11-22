import React from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { Play, Pause, Disc, Radio } from 'lucide-react';
import { getArtworkUrl } from '../../../services/platform';
import { mobileRadioService } from '../../../services/mobileRadioService';

interface MobileMiniPlayerProps {
  onExpand: () => void;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({ onExpand }) => {
  const { currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const artUrl = getArtworkUrl(currentTrack?.artworkDataUrl);
  const isRadio = mobileRadioService.isRadioTrack(currentTrack);

  return (
    <div
      onClick={onExpand}
      className="fixed bottom-16 left-2 right-2 h-14 bg-[#14141b]/95 backdrop-blur-md border border-[#272733] rounded-xl flex items-center justify-between px-3 z-40 shadow-lg shadow-black/50 active:scale-[0.99] transition-all cursor-pointer"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 pr-2">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1b1b24] flex items-center justify-center flex-shrink-0 border border-white/5 relative">
          {artUrl ? (
            <img
              src={artUrl}
              alt="Art"
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : isRadio ? (
            <Radio className="w-5 h-5 text-violet-400" />
          ) : (
            <Disc className="w-5 h-5 text-violet-400/70" />
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 min-w-0">
            {isRadio && (
              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-600/30 text-red-400 border border-red-500/30 flex-shrink-0 animate-pulse">
                LIVE
              </span>
            )}
            <span className="text-sm font-medium text-white truncate">
              {currentTrack?.title || 'HARMONIQ'}
            </span>
          </div>
          <span className="text-xs text-zinc-400 truncate">
            {currentTrack?.artist || 'Ready for music'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (currentTrack) {
              togglePlayPause().catch(() => {});
            }
          }}
          disabled={!currentTrack}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            currentTrack
              ? 'bg-violet-600 text-white hover:bg-violet-500 active:scale-95'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      </div>
    </div>
  );
};
