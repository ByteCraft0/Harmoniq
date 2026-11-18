import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  X,
  Volume2,
  VolumeX,
  Disc,
} from 'lucide-react';

interface MiniPlayerProps {
  onExpand: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpand }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
  } = usePlayer();

  const [showVolume, setShowVolume] = useState(false);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClose = () => {
    window.harmoniqApi?.windowClose();
  };

  return (
    <div className="relative w-full h-full bg-[#09090B]/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden select-none flex flex-col justify-between p-3.5 window-drag-region shadow-2xl">
      {/* Dynamic Ambient Glow Mesh */}
      <div className="ambient-mesh-glow opacity-30" />

      {/* Top Header: Brand, Drag Handle & Window Controls */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-black text-[9px]">
            H
          </div>
          <span className="text-[10px] font-bold tracking-widest text-[#F5F3FF]/80 uppercase">
            Harmoniq Mini
          </span>
        </div>

        <div className="flex items-center gap-1 window-no-drag">
          <button
            onClick={onExpand}
            title="Expand to Full Player"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/10 transition-colors"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={handleClose}
            title="Close Harmoniq"
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Center Body: Artwork, Title, Artist & Transport Controls */}
      <div className="flex items-center gap-3.5 my-auto z-10">
        {/* Album Artwork */}
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#14141B] border border-white/10 shrink-0 shadow-md flex items-center justify-center">
          {currentTrack?.artworkDataUrl ? (
            <img
              src={currentTrack.artworkDataUrl}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
          ) : (
            <Disc size={26} className="text-[#3F3F46]" />
          )}
          {isPlaying && (
            <div className="absolute inset-0 ring-1 ring-inset ring-[var(--accent-dynamic)]/30 rounded-xl" />
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs font-bold text-[#F5F3FF] truncate leading-tight">
            {currentTrack?.title || 'No Audio Playing'}
          </h4>
          <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
            {currentTrack?.artist || 'Open library to select track'}
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0 window-no-drag">
          <button
            onClick={prevTrack}
            title="Previous Track"
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-2.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[var(--accent-dynamic)] text-[#F5F3FF] shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>

          <button
            onClick={nextTrack}
            title="Next Track"
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      {/* Bottom Progress Scrubber & Hover Volume */}
      <div className="space-y-1.5 z-10 window-no-drag">
        {/* Seekbar */}
        <div className="relative group w-full h-1.5 rounded-full bg-white/10 overflow-hidden cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-[#7C3AED] to-[var(--accent-dynamic)] rounded-full transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>

        {/* Timestamps & Quick Volume */}
        <div className="flex items-center justify-between text-[10px] font-mono-numbers text-[#71717A]">
          <span>{formatTime(currentTime)}</span>

          <div
            className="flex items-center gap-1.5 relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            {showVolume && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-14 h-1 mr-1 transition-all"
              />
            )}
            <button
              onClick={toggleMute}
              className="text-[#71717A] hover:text-[#F5F3FF] transition-colors p-0.5"
            >
              {isMuted || volume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
