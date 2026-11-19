import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { colorExtractionService, ExtractedColors } from '../../services/colorExtractionService';
import { WaveformVolumeControl } from '../audio/WaveformVolumeControl';
import { MiniLiveVisualizer } from '../audio/MiniLiveVisualizer';
import { MiniWaveformProgressBar } from '../audio/MiniWaveformProgressBar';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  X,
  Disc,
  Pin,
  PinOff,
  SlidersHorizontal,
  LayoutGrid,
  Minimize2,
  Sparkles,
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
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [ambientColors, setAmbientColors] = useState<ExtractedColors | null>(null);

  // Synchronize Always-on-Top state with Electron backend
  useEffect(() => {
    if (window.harmoniqApi?.isAlwaysOnTop) {
      window.harmoniqApi.isAlwaysOnTop().then((val) => setIsPinned(val)).catch(() => {});
    }
  }, []);

  // Extract ambient lighting colors dynamically from current track album artwork
  useEffect(() => {
    if (currentTrack?.artworkDataUrl) {
      colorExtractionService.extractColors(currentTrack.artworkDataUrl).then((c) => {
        if (c) setAmbientColors(c);
      });
    } else {
      setAmbientColors(null);
    }
  }, [currentTrack?.artworkDataUrl]);

  // Mini-player keyboard shortcuts
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

  const handleClose = () => {
    window.harmoniqApi?.windowClose();
  };

  return (
    <div
      style={{ opacity }}
      className="relative w-full h-full bg-[#0B0813]/95 backdrop-blur-2xl border border-violet-500/20 rounded-2xl overflow-hidden select-none flex flex-col justify-between p-2.5 window-drag-region shadow-[0_12px_36px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition-all duration-300"
    >
      {/* Dynamic Ambient Artwork Lighting Mesh */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-30"
        style={{
          background: ambientColors
            ? `radial-gradient(circle at 20% 30%, ${ambientColors.primary} 0%, transparent 65%), radial-gradient(circle at 85% 75%, ${ambientColors.secondary || ambientColors.primary} 0%, transparent 60%)`
            : 'radial-gradient(circle at 25% 35%, rgba(124, 58, 237, 0.4) 0%, transparent 65%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.25) 0%, transparent 60%)',
          filter: 'blur(32px)',
        }}
      />
      {/* Subtle obsidian glass vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-[#0B0813]/60 pointer-events-none" />

      {/* Top Header: Brand, Audio-Reactive Visualizer, Pin, Layout & Window Controls */}
      <div className="flex items-center justify-between z-10 shrink-0 mb-1">
        <div className="flex items-center gap-2">
          {/* Logo Monogram */}
          <div className="w-4 h-4 rounded bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#C4B5FD] flex items-center justify-center text-white font-black text-[9px] shadow-[0_0_8px_rgba(139,92,246,0.5)] ring-1 ring-white/20">
            H
          </div>
          {/* Brand & Mode Label */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black tracking-widest text-zinc-200 uppercase font-sans">
              HARMONIQ
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
              {layout === 'compact' ? 'Pill' : 'Console'}
            </span>
          </div>

          {/* Real-time Audio-Reactive Frequency Bars */}
          <MiniLiveVisualizer
            isPlaying={isPlaying}
            isMuted={isMuted}
            barCount={4}
            size="sm"
            className="ml-1"
          />
        </div>

        {/* Window & Settings Actions */}
        <div className="flex items-center gap-1 window-no-drag">
          {/* Always on top Pin Toggle */}
          <button
            onClick={handleTogglePin}
            title={isPinned ? 'Always on Top (Active)' : 'Always on Top (Disabled)'}
            className={`p-1 rounded-md transition-all duration-200 ${
              isPinned
                ? 'text-violet-300 bg-violet-600/25 border border-violet-500/40 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
            }`}
          >
            {isPinned ? <Pin size={11} className="fill-violet-400" /> : <PinOff size={11} />}
          </button>

          {/* Layout switcher: Compact vs Expanded */}
          <button
            onClick={() => handleLayoutSwitch(layout === 'compact' ? 'expanded' : 'compact')}
            title={layout === 'compact' ? 'Switch to Expanded Console' : 'Switch to Compact Pill'}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
          >
            {layout === 'compact' ? <LayoutGrid size={11} /> : <Minimize2 size={11} />}
          </button>

          {/* Opacity / Transparency Popover */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              title="Widget Transparency & Visual Settings"
              className={`p-1 rounded-md transition-colors ${
                showSettingsPopover
                  ? 'text-violet-300 bg-violet-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal size={11} />
            </button>

            {showSettingsPopover && (
              <div className="absolute top-7 right-0 p-3 rounded-xl bg-[#130F23]/95 border border-violet-500/30 shadow-2xl z-50 w-48 text-xs flex flex-col gap-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                  <span>Transparency</span>
                  <span className="text-violet-400 font-semibold">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-500 h-1 cursor-pointer bg-white/10 rounded-lg"
                />
                <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                  <button onClick={() => handleOpacityChange(0.7)} className="hover:text-violet-300 transition-colors">70%</button>
                  <button onClick={() => handleOpacityChange(0.85)} className="hover:text-violet-300 transition-colors">85%</button>
                  <button onClick={() => handleOpacityChange(1.0)} className="hover:text-violet-300 transition-colors">100%</button>
                </div>
              </div>
            )}
          </div>

          {/* Full Player Expansion */}
          <button
            onClick={onExpand}
            title="Expand to Full Harmoniq Player"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
          >
            <Maximize2 size={11} />
          </button>

          {/* Close Harmoniq */}
          <button
            onClick={handleClose}
            title="Close Harmoniq"
            className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Compact vs Expanded */}
      {layout === 'compact' ? (
        /* COMPACT PILL LAYOUT (Height: ~100px) */
        <div className="flex items-center gap-2.5 my-auto z-10 w-full transition-all duration-300">
          {/* Mini Album Artwork with subtle glow */}
          <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-[#161224] border border-white/10 shrink-0 shadow flex items-center justify-center group">
            {currentTrack?.artworkDataUrl ? (
              <img
                src={currentTrack.artworkDataUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : 'scale-100'}`}
              />
            ) : (
              <Disc size={18} className="text-zinc-500" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 ring-1 ring-inset ring-violet-500/50 rounded-lg pointer-events-none" />
            )}
          </div>

          {/* Song Info */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-[11px] font-bold text-zinc-100 truncate leading-tight" title={currentTrack?.title || 'No Audio Playing'}>
              {currentTrack?.title || 'No Audio Playing'}
            </h4>
            <p className="text-[9px] text-zinc-400 truncate mt-0.5" title={currentTrack?.artist || 'Harmoniq Audio'}>
              {currentTrack?.artist || 'Harmoniq Audio'}
            </p>
          </div>

          {/* Compact Transport Controls */}
          <div className="flex items-center gap-1 shrink-0 window-no-drag">
            <button
              onClick={prevTrack}
              title="Previous Track (Ctrl + Left)"
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <SkipBack size={13} />
            </button>

            {/* Signature Mini Centerpiece Play/Pause */}
            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#6366F1] text-white flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)] hover:shadow-[0_0_14px_rgba(139,92,246,0.7)] hover:scale-105 active:scale-95 transition-all ring-1 ring-white/20"
            >
              {isPlaying ? <Pause size={11} className="fill-white" /> : <Play size={11} className="ml-0.5 fill-white" />}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track (Ctrl + Right)"
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
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
        /* EXPANDED CARD LAYOUT (Height: ~180px) */
        <div className="flex items-center gap-3 my-auto z-10 w-full transition-all duration-300">
          {/* Enhanced Album Artwork */}
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#161224] border border-white/10 shrink-0 shadow-lg flex items-center justify-center group">
            {currentTrack?.artworkDataUrl ? (
              <img
                src={currentTrack.artworkDataUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-950/40 via-[#161224] to-[#0B0813]">
                <Disc size={26} className="text-violet-400/60 animate-pulse" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 ring-1 ring-inset ring-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.3)] rounded-xl pointer-events-none" />
            )}
          </div>

          {/* Track Details */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <h4
                className="text-[13px] font-bold text-white truncate leading-tight tracking-tight"
                title={currentTrack?.title || 'No Audio Playing'}
              >
                {currentTrack?.title || 'No Audio Playing'}
              </h4>
            </div>
            <p
              className="text-[11px] font-medium text-zinc-400 truncate mt-0.5"
              title={currentTrack?.artist || 'Select track in library'}
            >
              {currentTrack?.artist || 'Harmoniq Music'}
            </p>
          </div>

          {/* Centerpiece Transport Controls */}
          <div className="flex items-center gap-1.5 shrink-0 window-no-drag">
            <button
              onClick={prevTrack}
              title="Previous Track (Ctrl + Left)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-full transition-colors"
            >
              <SkipBack size={15} />
            </button>

            {/* Signature Centerpiece Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#6366F1] text-white flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)] hover:shadow-[0_0_22px_rgba(139,92,246,0.7)] hover:scale-105 active:scale-95 transition-all duration-200 ring-1 ring-white/30"
            >
              {isPlaying ? <Pause size={15} className="fill-white" /> : <Play size={15} className="ml-0.5 fill-white" />}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track (Ctrl + Right)"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-full transition-colors"
            >
              <SkipForward size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Progress Console: Waveform Scrubber & Volume Slider */}
      <div className="space-y-1 z-10 window-no-drag shrink-0 pt-0.5">
        {layout === 'compact' ? (
          /* Compact waveform scrubber */
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MiniWaveformProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={seekTo}
                trackId={currentTrack?.id}
                compact={true}
                showTimestamps={false}
              />
            </div>
            <span className="text-[8px] font-mono text-zinc-400 shrink-0">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
            </span>
          </div>
        ) : (
          /* Expanded full waveform console */
          <div className="space-y-1">
            <MiniWaveformProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
              trackId={currentTrack?.id}
              compact={false}
              showTimestamps={true}
            />

            {/* Volume Quick Adjust Row */}
            <div className="flex items-center justify-end">
              <div
                className="flex items-center gap-1.5"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <WaveformVolumeControl
                  volume={volume}
                  isMuted={isMuted}
                  isPlaying={isPlaying}
                  onToggleMute={toggleMute}
                  onVolumeChange={setVolume}
                  showSlider={showVolumeSlider}
                  size="sm"
                  sliderWidth="w-16"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
