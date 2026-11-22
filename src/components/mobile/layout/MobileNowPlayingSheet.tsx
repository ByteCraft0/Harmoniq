import React, { useState } from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { useLibrary } from '../../../context/LibraryContext';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Disc,
  Heart,
  Info,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  SlidersHorizontal,
  Moon,
  Radio,
} from 'lucide-react';
import { getArtworkUrl } from '../../../services/platform';
import { mobileRadioService } from '../../../services/mobileRadioService';
import { useBackHandler } from '../MobileNavigationContext';
import { MobileQueueSheet } from './MobileQueueSheet';
import { MobileLyricsSheet } from '../lyrics/MobileLyricsSheet';
import { MobileEqualizerSheet } from '../dsp/MobileEqualizerSheet';
import { MobileSleepTimerSheet } from './MobileSleepTimerSheet';
import { MobileVolumeSlider } from './MobileVolumeSlider';

interface MobileNowPlayingSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNowPlayingSheet: React.FC<MobileNowPlayingSheetProps> = ({ isOpen, onClose }) => {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    seekTo,
    nextTrack,
    prevTrack,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    sleepTimer,
  } = usePlayer();

  const { toggleFavorite } = useLibrary();
  const isRadio = mobileRadioService.isRadioTrack(currentTrack);
  const stationId = currentTrack?.id?.startsWith('radio_') ? currentTrack.id.replace('radio_', '') : null;
  const isRadioFav = stationId ? mobileRadioService.isFavorite(stationId) : false;

  const handleToggleFav = () => {
    if (!currentTrack) return;
    if (isRadio && stationId) {
      mobileRadioService.toggleFavorite({
        id: stationId,
        name: currentTrack.title,
        streamUrl: currentTrack.filePath,
        favicon: currentTrack.artworkDataUrl,
        tags: currentTrack.genre ? [currentTrack.genre] : [],
      });
    } else {
      toggleFavorite(currentTrack);
    }
  };

  // Priority 3: System back button closes expanded Now Playing sheet
  useBackHandler(
    3,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#09090b] flex flex-col justify-between overflow-y-auto animate-in slide-in-from-bottom duration-300"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}
    >
      {/* Header with dismiss button */}
      <div className="flex items-center justify-between px-6 py-2">
        <button
          onClick={onClose}
          aria-label="Collapse player"
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-all"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center">
          <span className="text-[11px] uppercase tracking-wider text-violet-400 font-medium">
            {isRadio ? 'Live Internet Radio' : 'Now Playing'}
          </span>
          <p className="text-xs text-zinc-400 truncate max-w-[200px]">
            {currentTrack?.album || (isRadio ? 'Global Radio Broadcast' : 'Harmoniq Lite Audio')}
          </p>
        </div>
        <button
          onClick={() => setIsQueueOpen(true)}
          aria-label="View Queue"
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-all"
          title="View Queue"
        >
          <ListMusic className="w-5 h-5 text-violet-400" />
        </button>
      </div>

      {/* Main Artwork */}
      <div className="flex-1 flex items-center justify-center px-8 py-3">
        <div className="w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden bg-[#14141b] border border-white/10 shadow-2xl shadow-violet-900/20 relative group">
          {getArtworkUrl(currentTrack?.artworkDataUrl) ? (
            <img
              src={getArtworkUrl(currentTrack?.artworkDataUrl)}
              alt="Artwork"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
              {isRadio ? (
                <Radio className="w-24 h-24 mb-3 text-violet-500/30" />
              ) : (
                <Disc className="w-24 h-24 mb-3 text-violet-500/30" />
              )}
              <span className="text-xs text-zinc-500 font-medium">
                {isRadio ? 'Harmoniq Live Stream' : 'Harmoniq High-Fidelity'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Track Info & Metadata */}
      <div className="px-8 mb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-xl font-bold text-white truncate tracking-tight">
              {currentTrack?.title || 'No Track Loaded'}
            </h2>
            <p className="text-sm text-zinc-400 truncate mt-0.5">
              {currentTrack?.artist || 'Select an audio track from your library'}
            </p>
          </div>
          {currentTrack && (
            <button
              onClick={handleToggleFav}
              aria-label="Toggle favorite"
              className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors"
            >
              <Heart
                className={`w-6 h-6 ${
                  (isRadio ? isRadioFav : currentTrack.isFavorite)
                    ? 'fill-red-500 text-red-500'
                    : 'text-zinc-400'
                }`}
              />
            </button>
          )}
        </div>

        {/* Audio Engine Notice */}
        <div
          className={`mt-2.5 py-1.5 px-3 rounded-lg flex items-center space-x-2 text-[11px] ${
            isRadio
              ? 'bg-red-950/30 border border-red-800/30 text-red-300'
              : 'bg-violet-950/30 border border-violet-800/30 text-violet-300/80'
          }`}
        >
          {isRadio ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold uppercase tracking-wider text-red-400">LIVE BROADCAST</span>
              <span>• {currentTrack?.codec || 'MP3'} Stream • Media3 ExoPlayer</span>
            </>
          ) : (
            <>
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
              <span>
                {currentTrack
                  ? `${currentTrack.codec || 'Audio'} • ${currentTrack.sampleRate ? currentTrack.sampleRate + ' Hz' : 'Stereo'} • Media3 Engine`
                  : 'Media3 ExoPlayer High-Fidelity Engine ready'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Scrubber or Live Stream Banner */}
      {isRadio ? (
        <div className="px-8 mb-3">
          <div className="py-2.5 px-3.5 rounded-xl bg-[#14141b] border border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-white font-semibold tracking-wide">LIVE AUDIO TRANSMISSION</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">Continuous Stream</span>
          </div>
        </div>
      ) : (
        <div className="px-8 mb-3">
          <div
            className="h-2 bg-zinc-800 rounded-full relative overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (!duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              seekTo(clickPos * duration);
            }}
          >
            <div
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-zinc-500 mt-1.5 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Playback Controls (Shuffle, Prev, Play/Pause, Next, Repeat) */}
      <div className="flex items-center justify-between px-8 mb-4">
        {/* Shuffle Button */}
        <button
          onClick={toggleShuffle}
          disabled={isRadio}
          aria-label="Toggle shuffle"
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isRadio
              ? 'opacity-25 pointer-events-none text-zinc-600'
              : isShuffle
              ? 'text-violet-400 bg-violet-600/15'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
        >
          <Shuffle className="w-5 h-5" />
          {isShuffle && !isRadio && (
            <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-violet-400 shadow-sm shadow-violet-400" />
          )}
        </button>

        {/* Previous Track */}
        <button
          onClick={prevTrack}
          disabled={isRadio || !currentTrack}
          aria-label="Previous track"
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isRadio
              ? 'opacity-25 pointer-events-none text-zinc-600'
              : 'text-zinc-300 hover:text-white disabled:text-zinc-700 active:scale-95'
          }`}
        >
          <SkipBack className="w-6 h-6" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={() => {
            if (currentTrack) togglePlayPause().catch(() => {});
          }}
          disabled={!currentTrack}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-violet-600/30 transition-all ${
            currentTrack
              ? 'bg-violet-600 text-white hover:bg-violet-500 active:scale-90'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>

        {/* Next Track */}
        <button
          onClick={nextTrack}
          disabled={isRadio || !currentTrack}
          aria-label="Next track"
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isRadio
              ? 'opacity-25 pointer-events-none text-zinc-600'
              : 'text-zinc-300 hover:text-white disabled:text-zinc-700 active:scale-95'
          }`}
        >
          <SkipForward className="w-6 h-6" />
        </button>

        {/* Repeat Mode */}
        <button
          onClick={cycleRepeatMode}
          disabled={isRadio}
          aria-label={`Repeat mode: ${repeatMode}`}
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isRadio
              ? 'opacity-25 pointer-events-none text-zinc-600'
              : repeatMode !== 'off'
              ? 'text-violet-400 bg-violet-600/15'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title={`Repeat: ${repeatMode}`}
        >
          {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          {repeatMode !== 'off' && !isRadio && (
            <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-violet-400 shadow-sm shadow-violet-400" />
          )}
        </button>
      </div>

      {/* Action Bar (Lyrics, Equalizer, Sleep Timer, Queue) */}
      <div className="grid grid-cols-4 gap-2 px-6 py-2.5 mb-3 bg-[#13131c] border border-white/5 rounded-2xl mx-6">
        {/* Lyrics Action */}
        <button
          onClick={() => setIsLyricsOpen(true)}
          disabled={isRadio}
          aria-label="Open Lyrics"
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            isRadio
              ? 'opacity-25 pointer-events-none text-zinc-600'
              : 'text-zinc-400 hover:text-violet-400 active:scale-95'
          }`}
        >
          <Mic2 className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Lyrics</span>
        </button>

        {/* Equalizer Action */}
        <button
          onClick={() => setIsEqualizerOpen(true)}
          aria-label="Open Equalizer"
          className="flex flex-col items-center justify-center space-y-1 text-zinc-400 hover:text-violet-400 active:scale-95 transition-all"
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Equalizer</span>
        </button>

        {/* Sleep Timer Action */}
        <button
          onClick={() => setIsSleepTimerOpen(true)}
          aria-label="Open Sleep Timer"
          className={`relative flex flex-col items-center justify-center space-y-1 active:scale-95 transition-all ${
            sleepTimer.isActive ? 'text-violet-400 font-semibold' : 'text-zinc-400 hover:text-violet-400'
          }`}
        >
          <Moon className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">
            {sleepTimer.isActive ? 'Timer On' : 'Sleep'}
          </span>
          {sleepTimer.isActive && (
            <span className="absolute top-0 right-3 w-2 h-2 rounded-full bg-violet-400 ring-2 ring-[#13131c]" />
          )}
        </button>

        {/* Queue Action */}
        <button
          onClick={() => setIsQueueOpen(true)}
          aria-label="Open Queue"
          className="flex flex-col items-center justify-center space-y-1 text-zinc-400 hover:text-violet-400 active:scale-95 transition-all"
        >
          <ListMusic className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Queue</span>
        </button>
      </div>

      {/* Volume slider */}
      <div className="px-8 mb-2">
        <MobileVolumeSlider />
      </div>

      {/* Secondary Bottom Sheets */}
      <MobileQueueSheet
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />

      <MobileLyricsSheet
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
      />

      <MobileEqualizerSheet
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
      />

      <MobileSleepTimerSheet
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
      />
    </div>
  );
};
