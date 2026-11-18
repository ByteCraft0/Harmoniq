import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
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
} from 'lucide-react';

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
    cancelSleepTimer,
  } = usePlayer();

  const { activeView, setActiveView, toggleFavorite } = useLibrary();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

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
  const sleepDurations = [5, 15, 30, 45, 60];

  return (
    <footer className="h-[84px] min-h-[84px] bg-[#0D0D12] border-t border-[#272733] px-5 flex items-center justify-between select-none relative z-40">
      {/* Top Edge Progress Seek Bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] hover:h-[5px] bg-[#1B1B24] group cursor-pointer transition-all duration-150">
        <div
          className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all duration-75 relative rounded-r-full"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(167,139,250,0.8)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        />
      </div>

      {/* LEFT: Track Info, Artwork & Quality Badge */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[220px]">
        {currentTrack ? (
          <>
            <div
              onClick={() => setActiveView('now_playing')}
              className="relative group w-13 h-13 w-[52px] h-[52px] rounded-lg bg-[#14141B] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer shadow-md hover:border-[#A78BFA] transition-colors"
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
                  className="text-xs font-bold text-[#F5F3FF] truncate cursor-pointer hover:text-[#A78BFA] transition-colors"
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
            <div className="w-[50px] h-[50px] rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46]">
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
      <div className="flex flex-col items-center justify-center w-2/4 max-w-lg">
        <div className="flex items-center gap-4 mb-1">
          <button
            onClick={toggleShuffle}
            title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
            className={`p-1.5 rounded-lg transition-colors relative ${
              isShuffle ? 'text-[#A78BFA]' : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            <Shuffle size={16} />
            {isShuffle && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#A78BFA]" />}
          </button>

          <button
            onClick={prevTrack}
            title="Previous Track"
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <SkipBack size={19} />
          </button>

          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:shadow-glow-md hover:scale-105 transition-transform active:scale-95"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          <button
            onClick={nextTrack}
            title="Next Track"
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <SkipForward size={19} />
          </button>

          <button
            onClick={cycleRepeatMode}
            title={`Repeat: ${repeatMode}`}
            className={`p-1.5 rounded-lg transition-colors relative ${
              repeatMode !== 'off' ? 'text-[#A78BFA]' : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            {repeatMode !== 'off' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#A78BFA]" />}
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-2 text-[10px] font-mono-numbers text-[#71717A]">
          <span>{formatTime(currentTime)}</span>
          <span className="opacity-40">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* RIGHT: Output Device Pill, Speed, Sleep, EQ, Queue, Volume */}
      <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[240px]">
        {/* Audio Output Device Indicator Pill */}
        <button
          onClick={() => setActiveView('audio_output')}
          title="Audio Output & DAC Settings"
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[10px] font-mono-numbers text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
        >
          <Speaker size={12} className="text-[#A78BFA]" />
          <span className="truncate max-w-[90px]">WASAPI Output</span>
        </button>

        {/* Playback Speed selector */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            title="Playback Speed"
            className={`px-2 py-1 rounded text-[11px] font-mono-numbers border font-medium transition-colors ${
              playbackRate !== 1.0
                ? 'bg-[#1B1B24] border-[#A78BFA] text-[#A78BFA]'
                : 'bg-[#14141B] border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            {playbackRate}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-12 right-0 p-1 rounded-xl bg-[#14141B] border border-[#272733] shadow-2xl flex flex-col gap-0.5 z-50 min-w-[70px]">
              {speeds.map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    setShowSpeedMenu(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg text-left font-mono-numbers transition-colors ${
                    playbackRate === rate
                      ? 'bg-[#7C3AED] text-[#F5F3FF] font-bold'
                      : 'text-[#A1A1AA] hover:bg-[#1B1B24] hover:text-[#F5F3FF]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sleep Timer */}
        <div className="relative">
          <button
            onClick={() => setShowSleepMenu(!showSleepMenu)}
            title="Sleep Timer"
            className={`p-1.5 rounded-lg transition-colors ${
              sleepTimer.isActive
                ? 'text-[#A78BFA] bg-[#1B1B24]'
                : 'text-[#71717A] hover:text-[#F5F3FF]'
            }`}
          >
            <Clock size={16} />
          </button>
          {showSleepMenu && (
            <div className="absolute bottom-12 right-0 p-2.5 rounded-xl bg-[#14141B] border border-[#272733] shadow-2xl flex flex-col gap-1 z-50 w-40 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#71717A] px-2 py-0.5 font-mono-numbers">
                Sleep Timer
              </span>
              {sleepDurations.map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setSleepTimer(mins);
                    setShowSleepMenu(false);
                  }}
                  className="px-2 py-1.5 rounded-lg text-left hover:bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                >
                  {mins} Minutes
                </button>
              ))}
              <button
                onClick={() => {
                  setSleepTimer(0, true);
                  setShowSleepMenu(false);
                }}
                className="px-2 py-1.5 rounded-lg text-left hover:bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] border-t border-[#272733] mt-1 pt-1.5 transition-colors"
              >
                End of Current Track
              </button>
              {sleepTimer.isActive && (
                <button
                  onClick={() => {
                    cancelSleepTimer();
                    setShowSleepMenu(false);
                  }}
                  className="px-2 py-1.5 rounded-lg text-left text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  Cancel Timer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Synced Lyrics Quick Toggle */}
        <button
          onClick={() => setActiveView(activeView === 'lyrics' ? 'now_playing' : 'lyrics')}
          title="Synced Lyrics (Key: L)"
          className={`p-1.5 rounded-lg transition-colors ${
            activeView === 'lyrics'
              ? 'text-[#A78BFA] bg-[#1B1B24]'
              : 'text-[#71717A] hover:text-[#F5F3FF]'
          }`}
        >
          <FileText size={16} />
        </button>

        {/* EQ Studio Quick Toggle */}
        <button
          onClick={() => setActiveView('equalizer')}
          title="Equalizer Studio"
          className="p-1.5 text-[#71717A] hover:text-[#F5F3FF] transition-colors"
        >
          <Sliders size={16} />
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={onToggleQueue}
          title="Play Queue"
          className={`p-1.5 rounded-lg transition-colors ${
            isQueueOpen
              ? 'text-[#A78BFA] bg-[#1B1B24]'
              : 'text-[#71717A] hover:text-[#F5F3FF]'
          }`}
        >
          <ListMusic size={16} />
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={toggleMute}
            className="text-[#71717A] hover:text-[#F5F3FF] transition-colors p-1"
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-18 w-[72px]"
          />
        </div>
      </div>
    </footer>
  );
};
