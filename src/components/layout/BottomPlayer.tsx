import React, { useState, useRef, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { ABRepeatControls } from '../audio/ABRepeatControls';
import {
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Sliders,
  ListMusic,
  FileAudio,
  FileText,
  Speaker,
  Clock,
  Sparkles,
  Minimize2,
  Maximize2,
  X,
  Bookmark,
} from 'lucide-react';

import { DrumPlaybackControl } from '../audio/DrumPlaybackControl';
import { TrumpetTrackControl } from '../audio/TrumpetTrackControl';
import { MusicBookmarksModal } from '../audio/MusicBookmarksModal';
import { WaveformVolumeControl } from '../audio/WaveformVolumeControl';

interface BottomPlayerProps {
  onToggleQueue: () => void;
  isQueueOpen: boolean;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({ onToggleQueue, isQueueOpen }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    playbackRate,
    sleepTimer,
    abRepeat,
    setABRepeatPointA,
    setABRepeatPointB,
    toggleABRepeat,
    clearABRepeat,
    togglePlayPause,
    seekTo,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    setPlaybackRate,
    setSleepTimer,
    extendSleepTimer,
    cancelSleepTimer,
  } = usePlayer();

  const { activeView, setActiveView, toggleFavorite } = useLibrary();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showABMenu, setShowABMenu] = useState(false);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [sleepEndAction, setSleepEndAction] = useState<'pause' | 'closeApp' | 'exitApp'>('pause');
  const [sleepFadeOut, setSleepFadeOut] = useState(true);

  // Scrubber interactive states
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState(0);
  const [isHoveringBar, setIsHoveringBar] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const qualityTier = currentTrack
    ? AudioQualityInspectorService.calculateQualityTier(currentTrack)
    : 'Standard';

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
  const sleepPresets = [5, 10, 15, 30, 45, 60];

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setTooltipPos(e.clientX - rect.left);
    setHoverSeekTime(pos * duration);

    if (isDraggingSeek) {
      seekTo(pos * duration);
    }
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pos * duration);
    setIsDraggingSeek(true);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingSeek(false);
    };
    if (isDraggingSeek) {
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSeek]);

  const handleCustomSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutes, 10);
    if (val && val > 0) {
      setSleepTimer({
        minutes: val,
        mode: 'duration',
        endAction: sleepEndAction,
        fadeDurationSeconds: sleepFadeOut ? 30 : 0,
      });
      setCustomMinutes('');
      setShowSleepMenu(false);
    }
  };

  const handleToggleMini = () => {
    window.harmoniqApi?.setMiniPlayer(true);
  };

  return (
    <footer className="h-[86px] min-h-[86px] shrink-0 glass-panel border-t border-white/10 px-5 flex items-center justify-between select-none relative z-40">
      {/* Subtle dynamic ambient glow behind player */}
      <div className="ambient-mesh-glow opacity-25" />

      {/* Interactive Top-Edge Scrubber */}
      <div
        ref={progressBarRef}
        onMouseEnter={() => setIsHoveringBar(true)}
        onMouseLeave={() => {
          setIsHoveringBar(false);
          setHoverSeekTime(null);
        }}
        onMouseMove={handleProgressBarMouseMove}
        onMouseDown={handleProgressBarMouseDown}
        className="absolute top-0 left-0 right-0 h-[4px] hover:h-[7px] bg-white/10 group cursor-pointer transition-all duration-150 z-30"
      >
        {/* Fill track */}
        <div
          className="h-full bg-gradient-to-r from-[#7C3AED] via-[var(--accent-dynamic)] to-[#C4B5FD] transition-all duration-75 relative rounded-r-full shadow-[0_0_12px_rgba(167,139,250,0.5)]"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Playhead thumb */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(167,139,250,0.9)] opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100" />
        </div>

        {/* Active A-B Loop Region Highlight */}
        {duration > 0 && abRepeat.pointA !== null && abRepeat.pointB !== null && (
          <div
            className={`absolute top-0 bottom-0 pointer-events-none transition-all ${
              abRepeat.enabled
                ? 'bg-amber-400/40 border-l-2 border-r-2 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                : 'bg-white/20 border-l border-r border-white/40'
            }`}
            style={{
              left: `${Math.max(0, Math.min(100, (abRepeat.pointA / duration) * 100))}%`,
              width: `${Math.max(0, Math.min(100, ((abRepeat.pointB - abRepeat.pointA) / duration) * 100))}%`,
            }}
          />
        )}

        {/* Point A Marker Pin */}
        {duration > 0 && abRepeat.pointA !== null && (
          <div
            style={{ left: `${Math.max(0, Math.min(100, (abRepeat.pointA / duration) * 100))}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none z-10"
            title={`Point A: ${formatTime(abRepeat.pointA)}`}
          >
            <div className="absolute -top-3.5 -translate-x-1/2 px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500 text-black">
              A
            </div>
          </div>
        )}

        {/* Point B Marker Pin */}
        {duration > 0 && abRepeat.pointB !== null && (
          <div
            style={{ left: `${Math.max(0, Math.min(100, (abRepeat.pointB / duration) * 100))}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none z-10"
            title={`Point B: ${formatTime(abRepeat.pointB)}`}
          >
            <div className="absolute -top-3.5 -translate-x-1/2 px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500 text-black">
              B
            </div>
          </div>
        )}

        {/* Floating Timestamp Tooltip */}
        {isHoveringBar && hoverSeekTime !== null && (
          <div
            style={{
              left: `${Math.max(
                24,
                Math.min(progressBarRef.current ? progressBarRef.current.clientWidth - 24 : 500, tooltipPos)
              )}px`,
            }}
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#14141B]/95 border border-white/15 backdrop-blur-md text-[10px] font-mono-numbers text-white shadow-xl pointer-events-none z-30"
          >
            {formatTime(hoverSeekTime)}
          </div>
        )}
      </div>

      {/* LEFT: Track Info, Artwork & Quality Badge */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[190px] max-w-[280px] shrink-0 z-10">
        {currentTrack ? (
          <>
            <div
              onClick={() => setActiveView('now_playing')}
              className="relative group w-[52px] h-[52px] rounded-xl bg-[#14141B] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer shadow-md hover:border-[var(--accent-dynamic)] transition-colors"
            >
              {currentTrack.artworkDataUrl ? (
                <img
                  src={currentTrack.artworkDataUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <FileAudio size={24} className="text-[#71717A]" />
              )}
            </div>

            <div className="flex flex-col min-w-0 pr-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  onClick={() => setActiveView('now_playing')}
                  className="text-xs font-bold text-[#F5F3FF] truncate cursor-pointer hover:text-[var(--accent-dynamic)] transition-colors"
                >
                  {currentTrack.title}
                </span>
                <button
                  onClick={() => toggleFavorite(currentTrack.id)}
                  className="text-[#71717A] hover:text-red-400 shrink-0 transition-colors"
                >
                  <Heart
                    size={14}
                    className={currentTrack.isFavorite ? 'fill-red-500 text-red-500' : ''}
                  />
                </button>
              </div>

              <span className="text-[11px] text-[#A1A1AA] truncate">
                {currentTrack.artist}
              </span>

              <div className="pt-0.5">
                <QualityBadge
                  tier={qualityTier}
                  codec={currentTrack.codec}
                  sampleRate={currentTrack.sampleRate}
                  bitDepth={currentTrack.bitDepth}
                  size="sm"
                  onClick={() => setActiveView('inspector')}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xs text-[#71717A]">
            <div className="w-[50px] h-[50px] rounded-xl bg-[#14141B] border border-white/10 flex items-center justify-center text-[#3F3F46]">
              <FileAudio size={22} />
            </div>
            <div>
              <p className="font-semibold text-[#A1A1AA]">No Track Loaded</p>
              <p className="text-[11px]">Select audio to begin playback</p>
            </div>
          </div>
        )}
      </div>

      {/* CENTER: Transport Controls & Seek Timer */}
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 max-w-lg mx-2 z-10">
        <div className="flex items-center gap-4 mb-1">
          <button
            onClick={toggleShuffle}
            title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
            className={`p-1.5 rounded-lg transition-colors relative ${
              isShuffle ? 'text-[var(--accent-dynamic)]' : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            <Shuffle size={16} />
            {isShuffle && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-dynamic)]" />}
          </button>

          <TrumpetTrackControl
            direction="previous"
            onClick={prevTrack}
          />

          <DrumPlaybackControl
            isPlaying={isPlaying}
            onClick={togglePlayPause}
          />

          <TrumpetTrackControl
            direction="next"
            onClick={nextTrack}
          />

          <button
            onClick={cycleRepeatMode}
            title={`Repeat: ${repeatMode}`}
            className={`p-1.5 rounded-lg transition-colors relative ${
              repeatMode !== 'off' ? 'text-[var(--accent-dynamic)]' : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            {repeatMode !== 'off' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-dynamic)]" />}
          </button>

          {/* A-B Repeat Quick Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowABMenu(!showABMenu)}
              title={
                abRepeat.enabled
                  ? 'A-B Loop: Active'
                  : abRepeat.pointA !== null || abRepeat.pointB !== null
                  ? 'A-B Loop: Configured'
                  : 'A-B Repeat Looper'
              }
              className={`px-1.5 py-1 rounded-md text-[11px] font-mono-numbers font-bold transition-all relative ${
                abRepeat.enabled
                  ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : abRepeat.pointA !== null || abRepeat.pointB !== null
                  ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
                  : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
            >
              <span>A-B</span>
              {abRepeat.enabled && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {showABMenu && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 p-3 rounded-2xl glass-panel border border-white/15 shadow-2xl z-50">
                <ABRepeatControls compact={false} />
              </div>
            )}
          </div>
        </div>

        {/* Time display with tabular numbers */}
        <div className="flex items-center gap-2 text-[10px] font-mono-numbers text-[#71717A]">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <span className="opacity-40">/</span>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* RIGHT: Mini-Player Toggle, Output Device, Speed, Sleep, EQ, Queue, Volume */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 z-10">
        {/* Floating Mini-Player Mode Button */}
        <button
          onClick={handleToggleMini}
          title="Compact Mini-Player Mode (Floating Widget)"
          className="p-1.5 rounded-lg text-[#71717A] hover:text-[var(--accent-dynamic)] hover:bg-white/5 transition-colors"
        >
          <Minimize2 size={15} />
        </button>

        {/* Audio Output Device Indicator Pill */}
        <button
          onClick={() => setActiveView('audio_output')}
          title="Audio Output & DAC Settings"
          className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono-numbers text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
        >
          <Speaker size={12} className="text-[var(--accent-dynamic)]" />
          <span className="truncate max-w-[80px]">WASAPI</span>
        </button>

        {/* Playback Speed selector */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            title="Playback Speed"
            className={`px-2 py-1 rounded text-[11px] font-mono-numbers border font-medium transition-colors ${
              playbackRate !== 1.0
                ? 'bg-white/10 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]'
                : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            {playbackRate}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-12 right-0 p-1 rounded-xl glass-panel border border-white/15 shadow-2xl flex flex-col gap-0.5 z-50 min-w-[70px]">
              {speeds.map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    setShowSpeedMenu(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg text-left font-mono-numbers transition-colors ${
                    playbackRate === rate
                      ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                      : 'text-[#A1A1AA] hover:bg-white/10 hover:text-[#F5F3FF]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sleep Timer Popover */}
        <div className="relative">
          <button
            onClick={() => setShowSleepMenu(!showSleepMenu)}
            title={
              sleepTimer.isActive
                ? `Sleep Timer: ${formatTime(sleepTimer.secondsRemaining)} remaining`
                : 'Set Sleep Timer'
            }
            className={`p-1.5 rounded-lg transition-colors relative ${
              sleepTimer.isActive
                ? 'text-[var(--accent-dynamic)] bg-white/10 shadow-sm'
                : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            <Clock size={16} />
            {sleepTimer.isActive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent-dynamic)] animate-pulse" />
            )}
          </button>

          {showSleepMenu && (
            <div className="absolute bottom-12 right-0 p-4 rounded-2xl glass-panel border border-white/15 shadow-2xl flex flex-col gap-2.5 z-50 w-72 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] uppercase font-bold text-[#A1A1AA] tracking-wider font-mono-numbers flex items-center gap-1.5">
                  <Clock size={12} className="text-[var(--accent-dynamic)]" />
                  <span>Extended Auto Shutdown</span>
                </span>
                {sleepTimer.isActive && (
                  <span className="text-[10px] font-mono-numbers font-bold text-[var(--accent-dynamic)]">
                    {sleepTimer.isFading ? 'Fading Out...' : formatTime(sleepTimer.secondsRemaining)}
                  </span>
                )}
              </div>

              {/* Active Timer Status Banner */}
              {sleepTimer.isActive && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-dynamic)] animate-pulse" />
                      <span className="text-[#F5F3FF] font-medium">
                        {sleepTimer.stopAfterCurrentTrack
                          ? 'Stop after track'
                          : sleepTimer.stopAfterQueue
                          ? 'Stop after queue'
                          : sleepTimer.isFading
                          ? 'Fading out'
                          : 'Active countdown'}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                      {sleepTimer.secondsRemaining > 0 ? formatTime(sleepTimer.secondsRemaining) : '--:--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#A1A1AA]">
                    <span>Action:</span>
                    <span className="font-semibold text-[var(--accent-dynamic)] uppercase tracking-wider font-mono-numbers">
                      {sleepTimer.endAction === 'closeApp'
                        ? 'Close Harmoniq'
                        : sleepTimer.endAction === 'exitApp'
                        ? 'Exit App'
                        : 'Pause Audio'}
                    </span>
                  </div>

                  {sleepTimer.totalSeconds > 0 && (
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent-dynamic)] to-purple-400 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (sleepTimer.secondsRemaining / sleepTimer.totalSeconds) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}

                  {/* Extend Controls: +5m, +15m */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      onClick={() => extendSleepTimer(5)}
                      className="flex-1 py-1 text-center text-[10px] font-mono-numbers font-bold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#E4E4E7] hover:text-white transition-colors"
                      title="Add 5 minutes to active countdown"
                    >
                      +5 min
                    </button>
                    <button
                      onClick={() => extendSleepTimer(15)}
                      className="flex-1 py-1 text-center text-[10px] font-mono-numbers font-bold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#E4E4E7] hover:text-white transition-colors"
                      title="Add 15 minutes to active countdown"
                    >
                      +15 min
                    </button>
                    <button
                      onClick={() => {
                        cancelSleepTimer();
                        setShowSleepMenu(false);
                      }}
                      className="px-2.5 py-1 text-center text-[10px] font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-800/40 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action Selection (On Timer End) */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono-numbers font-bold">
                  On Trigger:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'pause', label: 'Pause' },
                      { id: 'closeApp', label: 'Close Win' },
                      { id: 'exitApp', label: 'Exit App' },
                    ] as const
                  ).map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setSleepEndAction(act.id)}
                      className={`py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                        sleepEndAction === act.id
                          ? 'bg-[var(--accent-dynamic)] text-white border-transparent'
                          : 'bg-white/5 text-[#A1A1AA] hover:text-[#F5F3FF] border-white/5 hover:border-white/15'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gradual Volume Fade-Out Option */}
              <label className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/5 cursor-pointer">
                <span className="text-[10px] text-[#A1A1AA]">Gradual 30s volume fade</span>
                <input
                  type="checkbox"
                  checked={sleepFadeOut}
                  onChange={(e) => setSleepFadeOut(e.target.checked)}
                  className="rounded border-white/20 text-[var(--accent-dynamic)] focus:ring-0"
                />
              </label>

              {/* Countdown Presets */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono-numbers font-bold">
                  Countdown Presets:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {sleepPresets.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        setSleepTimer({
                          minutes: mins,
                          mode: 'duration',
                          endAction: sleepEndAction,
                          fadeDurationSeconds: sleepFadeOut ? 30 : 0,
                        });
                        setShowSleepMenu(false);
                      }}
                      className="px-2 py-1.5 rounded-lg text-center bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors font-mono-numbers text-[11px]"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Duration Input */}
              <form onSubmit={handleCustomSleepSubmit} className="flex gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Custom mins..."
                  className="w-full px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] text-[11px] font-mono-numbers text-[#F5F3FF] placeholder-[#71717A] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-white font-bold text-[11px] shrink-0"
                >
                  Set
                </button>
              </form>

              {/* Event-driven Trigger Options */}
              <div className="border-t border-white/10 pt-1.5 space-y-1">
                <button
                  onClick={() => {
                    setSleepTimer({
                      mode: 'stopAfterTrack',
                      endAction: sleepEndAction,
                      fadeDurationSeconds: sleepFadeOut ? 30 : 0,
                    });
                    setShowSleepMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left hover:bg-white/10 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors text-[11px] flex items-center justify-between"
                >
                  <span>End of Current Track</span>
                  <span className="text-[9px] font-mono-numbers text-[#71717A]">Track End</span>
                </button>
                <button
                  onClick={() => {
                    setSleepTimer({
                      mode: 'stopAfterQueue',
                      endAction: sleepEndAction,
                      fadeDurationSeconds: sleepFadeOut ? 30 : 0,
                    });
                    setShowSleepMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left hover:bg-white/10 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors text-[11px] flex items-center justify-between"
                >
                  <span>End of Current Queue</span>
                  <span className="text-[9px] font-mono-numbers text-[#71717A]">Queue End</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Immersive Album Mode Button */}
        <button
          onClick={() => setActiveView(activeView === 'immersive_album' ? 'home' : 'immersive_album')}
          title="Immersive Full-Screen Album Mode"
          className={`p-1.5 rounded-lg transition-colors hidden xl:block ${
            activeView === 'immersive_album'
              ? 'text-[var(--accent-dynamic)] bg-white/10 shadow-glow-sm'
              : 'text-[#71717A] hover:text-[#F5F3FF]'
          }`}
        >
          <Maximize2 size={16} />
        </button>

        {/* Synced Lyrics Quick Toggle */}
        <button
          onClick={() => setActiveView(activeView === 'lyrics' ? 'now_playing' : 'lyrics')}
          title="Synced Lyrics (Key: L)"
          className={`p-1.5 rounded-lg transition-colors hidden lg:block ${
            activeView === 'lyrics'
              ? 'text-[var(--accent-dynamic)] bg-white/10'
              : 'text-[#71717A] hover:text-[#F5F3FF]'
          }`}
        >
          <FileText size={16} />
        </button>

        {/* EQ Studio Quick Toggle */}
        <button
          onClick={() => setActiveView('equalizer')}
          title="Equalizer Studio (Key: E)"
          className="p-1.5 text-[#71717A] hover:text-[#F5F3FF] transition-colors"
        >
          <Sliders size={16} />
        </button>

        {/* Music Bookmarks Quick Trigger */}
        <button
          onClick={() => setShowBookmarksModal(true)}
          title="Music Bookmarks (Timestamp Markers)"
          className="p-1.5 text-[#71717A] hover:text-[var(--accent-dynamic)] hover:bg-white/10 rounded-lg transition-colors hidden md:block"
        >
          <Bookmark size={16} />
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={onToggleQueue}
          title="Play Queue"
          className={`p-1.5 rounded-lg transition-colors ${
            isQueueOpen
              ? 'text-[var(--accent-dynamic)] bg-white/10'
              : 'text-[#71717A] hover:text-[#F5F3FF]'
          }`}
        >
          <ListMusic size={16} />
        </button>

        {/* Subtle Vertical Divider */}
        <div className="h-4 w-[1px] bg-white/10 mx-1.5 hidden sm:block" />

        {/* Signature Waveform Volume Control (Authoritative Control) */}
        <div className="flex items-center shrink-0">
          <WaveformVolumeControl
            volume={volume}
            isMuted={isMuted}
            isPlaying={isPlaying}
            onToggleMute={toggleMute}
            onVolumeChange={setVolume}
            showSlider={true}
            size="md"
            sliderWidth="w-[110px]"
          />
        </div>
      </div>

      <MusicBookmarksModal
        track={currentTrack}
        isOpen={showBookmarksModal}
        onClose={() => setShowBookmarksModal(false)}
      />
    </footer>
  );
};

