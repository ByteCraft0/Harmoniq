import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { colorExtractionService, ExtractedColors } from '../../services/colorExtractionService';
import { WaveformVolumeControl } from '../audio/WaveformVolumeControl';
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
  Pin,
  PinOff,
  SlidersHorizontal,
  LayoutGrid,
  Minimize2,
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

  const [layout, setLayout] = useState<'compact' | 'expanded'>(() => {
    return (localStorage.getItem('harmoniq_miniplayer_layout') as 'compact' | 'expanded') || 'expanded';
  });

  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('harmoniq_miniplayer_opacity');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [isPinned, setIsPinned] = useState<boolean>(true);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [ambientColors, setAmbientColors] = useState<ExtractedColors | null>(null);

  useEffect(() => {
    if (window.harmoniqApi?.isAlwaysOnTop) {
      window.harmoniqApi.isAlwaysOnTop().then((val) => setIsPinned(val)).catch(() => {});
    }
  }, []);

  // Extract ambient lighting from album artwork
  useEffect(() => {
    if (currentTrack?.artworkDataUrl) {
      colorExtractionService.extractColors(currentTrack.artworkDataUrl).then((c) => {
        if (c) setAmbientColors(c);
      });
    } else {
      setAmbientColors(null);
    }
  }, [currentTrack?.artworkDataUrl]);

  // Miniplayer keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey) prevTrack();
        else seekTo(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey) nextTrack();
        else seekTo(Math.min(duration, currentTime + 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, volume, togglePlayPause, prevTrack, nextTrack, seekTo, setVolume, toggleMute]);

  const handleTogglePin = async () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    if (window.harmoniqApi?.setAlwaysOnTop) {
      await window.harmoniqApi.setAlwaysOnTop(nextPin).catch(() => {});
    }
  };

  const handleLayoutSwitch = (newLayout: 'compact' | 'expanded') => {
    setLayout(newLayout);
    localStorage.setItem('harmoniq_miniplayer_layout', newLayout);
    if (window.harmoniqApi?.setMiniPlayerLayout) {
      window.harmoniqApi.setMiniPlayerLayout(newLayout).catch(() => {});
    }
  };

  const handleOpacityChange = (val: number) => {
    const clamped = Math.max(0.6, Math.min(1.0, val));
    setOpacity(clamped);
    localStorage.setItem('harmoniq_miniplayer_opacity', String(clamped));
    if (window.harmoniqApi?.setWindowOpacity) {
      window.harmoniqApi.setWindowOpacity(clamped).catch(() => {});
    }
  };

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
    <div
      style={{ opacity }}
      className="relative w-full h-full bg-[#09090B]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden select-none flex flex-col justify-between p-3 window-drag-region shadow-2xl transition-all duration-300"
    >
      {/* Dynamic Ambient Artwork Lighting Mesh */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-700 opacity-35"
        style={{
          background: ambientColors
            ? `radial-gradient(circle at 50% 50%, ${ambientColors.primary} 0%, transparent 70%)`
            : undefined,
          filter: 'blur(35px)',
        }}
      />
      <div className="ambient-mesh-glow opacity-25" />

      {/* Top Header: Brand, Drag Handle, Pin, Settings & Window Controls */}
      <div className="flex items-center justify-between z-10 shrink-0 mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-black text-[8px] shadow-sm">
            H
          </div>
          <span className="text-[9px] font-bold tracking-widest text-[#F5F3FF]/80 uppercase">
            {layout === 'compact' ? 'Harmoniq Pill' : 'Harmoniq Widget'}
          </span>
        </div>

        <div className="flex items-center gap-1 window-no-drag">
          {/* Always on top Pin Toggle */}
          <button
            onClick={handleTogglePin}
            title={isPinned ? 'Always on Top (Active)' : 'Always on Top (Disabled)'}
            className={`p-1 rounded-md transition-colors ${
              isPinned
                ? 'text-[var(--accent-dynamic)] bg-[var(--accent-dynamic)]/15'
                : 'text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/10'
            }`}
          >
            {isPinned ? <Pin size={11} className="fill-[var(--accent-dynamic)]" /> : <PinOff size={11} />}
          </button>

          {/* Layout switcher */}
          <button
            onClick={() => handleLayoutSwitch(layout === 'compact' ? 'expanded' : 'compact')}
            title={layout === 'compact' ? 'Switch to Expanded Card' : 'Switch to Compact Pill'}
            className="p-1 rounded-md text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/10 transition-colors"
          >
            {layout === 'compact' ? <LayoutGrid size={11} /> : <Minimize2 size={11} />}
          </button>

          {/* Opacity / Widget Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              title="Widget Transparency & Options"
              className={`p-1 rounded-md transition-colors ${
                showSettingsPopover
                  ? 'text-[var(--accent-dynamic)] bg-white/10'
                  : 'text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal size={11} />
            </button>

            {showSettingsPopover && (
              <div className="absolute top-7 right-0 p-3 rounded-xl bg-[#14141B] border border-white/15 shadow-2xl z-50 w-48 text-xs flex flex-col gap-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider font-mono-numbers">
                  <span>Widget Opacity</span>
                  <span className="text-[var(--accent-dynamic)]">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent-dynamic)] h-1"
                />
                <div className="flex justify-between text-[9px] text-[#71717A] font-mono-numbers">
                  <button onClick={() => handleOpacityChange(0.7)} className="hover:text-white">70%</button>
                  <button onClick={() => handleOpacityChange(0.85)} className="hover:text-white">85%</button>
                  <button onClick={() => handleOpacityChange(1.0)} className="hover:text-white">100%</button>
                </div>
              </div>
            )}
          </div>

          {/* Full Player Expansion */}
          <button
            onClick={onExpand}
            title="Expand to Full Player"
            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/10 transition-colors"
          >
            <Maximize2 size={11} />
          </button>

          {/* Close Harmoniq */}
          <button
            onClick={handleClose}
            title="Close Harmoniq"
            className="p-1 rounded-md text-[#A1A1AA] hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Main Content: Compact vs Expanded */}
      {layout === 'compact' ? (
        /* COMPACT PILL LAYOUT */
        <div className="flex items-center gap-2.5 my-auto z-10 w-full transition-all duration-300">
          {/* Mini Album Artwork */}
          <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-[#14141B] border border-white/10 shrink-0 shadow flex items-center justify-center">
            {currentTrack?.artworkDataUrl ? (
              <img
                src={currentTrack.artworkDataUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : 'scale-100'}`}
              />
            ) : (
              <Disc size={18} className="text-[#3F3F46]" />
            )}
          </div>

          {/* Song Info */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-[11px] font-bold text-[#F5F3FF] truncate leading-tight">
              {currentTrack?.title || 'No Audio Playing'}
            </h4>
            <p className="text-[9px] text-[#A1A1AA] truncate">
              {currentTrack?.artist || 'Idle'}
            </p>
          </div>

          {/* Compact Transport Controls */}
          <div className="flex items-center gap-1 shrink-0 window-no-drag">
            <button
              onClick={prevTrack}
              title="Previous"
              className="p-1 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipBack size={13} />
            </button>
            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-1.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[var(--accent-dynamic)] text-white shadow hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
            </button>
            <button
              onClick={nextTrack}
              title="Next"
              className="p-1 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipForward size={13} />
            </button>
            <WaveformVolumeControl
              volume={volume}
              isMuted={isMuted}
              isPlaying={isPlaying}
              onToggleMute={toggleMute}
              size="sm"
            />
          </div>
        </div>
      ) : (
        /* EXPANDED CARD LAYOUT */
        <div className="flex items-center gap-3 my-auto z-10 w-full transition-all duration-300">
          {/* Album Artwork */}
          <div className="relative w-13 h-13 rounded-xl overflow-hidden bg-[#14141B] border border-white/10 shrink-0 shadow-md flex items-center justify-center">
            {currentTrack?.artworkDataUrl ? (
              <img
                src={currentTrack.artworkDataUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-500 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
            ) : (
              <Disc size={24} className="text-[#3F3F46]" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 ring-1 ring-inset ring-[var(--accent-dynamic)]/40 rounded-xl" />
            )}
          </div>

          {/* Track Title & Artist */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-bold text-[#F5F3FF] truncate leading-tight">
              {currentTrack?.title || 'No Audio Playing'}
            </h4>
            <p className="text-[10px] text-[#A1A1AA] truncate mt-0.5">
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
              <SkipBack size={15} />
            </button>

            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-2 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[var(--accent-dynamic)] text-[#F5F3FF] shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track"
              className="p-1.5 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipForward size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Progress Scrubber & Volume Slider */}
      <div className="space-y-1 z-10 window-no-drag shrink-0">
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
        <div className="flex items-center justify-between text-[9px] font-mono-numbers text-[#71717A]">
          <span>{formatTime(currentTime)}</span>

          <div
            className="flex items-center gap-1 relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <WaveformVolumeControl
              volume={volume}
              isMuted={isMuted}
              isPlaying={isPlaying}
              onToggleMute={toggleMute}
              onVolumeChange={setVolume}
              showSlider={showVolume}
              size="sm"
              sliderWidth="w-14"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
