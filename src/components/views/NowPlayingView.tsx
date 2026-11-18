import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { LyricsService } from '../../services/lyricsService';
import { LyricsData } from '../../types/lyrics';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
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
  FileAudio,
  FileText,
  FolderPlus,
  Gauge,
  ListMusic,
  Sparkles,
} from 'lucide-react';

export const NowPlayingView: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    togglePlayPause,
    seekTo,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
  } = usePlayer();

  const { setActiveView, toggleFavorite } = useLibrary();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const trackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentTrack) {
      const activeId = currentTrack.id;
      trackIdRef.current = activeId;
      setLyricsData(null); // Immediate reset to prevent previous song lyrics from displaying
      LyricsService.loadLyricsForTrack(currentTrack).then((data) => {
        if (trackIdRef.current === activeId) {
          setLyricsData(data);
        }
      }).catch(() => {
        if (trackIdRef.current === activeId) {
          setLyricsData(null);
        }
      });
    } else {
      trackIdRef.current = null;
      setLyricsData(null);
    }
  }, [currentTrack?.id]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#71717A] select-none">
        <div className="w-20 h-20 rounded-2xl bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46] mb-4 shadow-card">
          <FileAudio size={40} />
        </div>
        <h3 className="text-xl font-bold text-[#F5F3FF] mb-1">No Audio Playing</h3>
        <p className="text-xs text-[#A1A1AA] max-w-sm mb-5">
          Select any track from your library or open a local folder to begin playback.
        </p>
        <button
          onClick={() => setActiveView('songs')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
        >
          Browse Music Library
        </button>
      </div>
    );
  }

  const qualityTier = AudioQualityInspectorService.calculateQualityTier(currentTrack);
  const activeLyricIndex = lyricsData?.synced
    ? LyricsService.findActiveLineIndex(lyricsData.lines, currentTime, lyricsData.offset || 0)
    : -1;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeRemaining = duration > currentTime ? duration - currentTime : 0;

  return (
    <div className="h-full overflow-y-auto px-8 py-8 flex flex-col justify-between max-w-6xl mx-auto relative select-none">
      {/* Subtle Blurred Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7C3AED]/12 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <QualityBadge
            tier={qualityTier}
            codec={currentTrack.codec}
            sampleRate={currentTrack.sampleRate}
            bitDepth={currentTrack.bitDepth}
            bitrate={currentTrack.bitrate}
            size="lg"
            onClick={() => setActiveView('inspector')}
          />
          <button
            onClick={() => setActiveView('inspector')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <Gauge size={14} className="text-[#A78BFA]" />
            <span>Technical Inspector</span>
          </button>
        </div>

        <button
          onClick={() => setActiveView('equalizer')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
        >
          <Sliders size={14} className="text-[#A78BFA]" />
          <span>Equalizer Studio</span>
        </button>
      </div>

      {/* Main Focus: Artwork + Details & Synced Lyrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 my-auto items-center z-10 py-4">
        {/* Left Column: Album Artwork & Spectrum */}
        <div className="md:col-span-5 flex flex-col items-center space-y-5">
          <div className="relative group w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-[#14141B] border border-[#272733] shadow-2xl flex items-center justify-center">
            {currentTrack.artworkDataUrl ? (
              <img
                src={currentTrack.artworkDataUrl}
                alt={currentTrack.album}
                className="w-full h-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#3F3F46]">
                <FileAudio size={80} strokeWidth={1} />
                <span className="text-xs uppercase tracking-wider mt-2 font-mono-numbers text-[#71717A]">
                  {currentTrack.codec} Lossless
                </span>
              </div>
            )}
          </div>

          {/* Integrated Live Spectrum Visualizer */}
          <div className="w-full max-w-xs p-3 rounded-xl bg-[#14141B] border border-[#272733]">
            <AudioVisualizer height={48} mode="spectrum" />
          </div>
        </div>

        {/* Right Column: Track Details & Synchronized Lyrics */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] font-mono-numbers">
                Now Playing
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddToPlaylistOpen(true)}
                  title="Add to Playlist"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                >
                  <FolderPlus size={14} className="text-[#A78BFA]" />
                  <span>Add to Playlist</span>
                </button>
                <button
                  onClick={() => toggleFavorite(currentTrack.id)}
                  title={currentTrack.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                  className="p-1.5 rounded-full hover:bg-[#1B1B24] text-[#71717A] hover:text-red-400 transition-colors"
                >
                  <Heart
                    size={20}
                    className={currentTrack.isFavorite ? 'fill-red-500 text-red-500' : ''}
                  />
                </button>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F5F3FF] tracking-tight truncate">
              {currentTrack.title}
            </h1>
            <p className="text-lg text-[#A1A1AA] font-medium truncate">
              {currentTrack.artist}
            </p>
            <p className="text-xs text-[#71717A] font-mono-numbers">
              {currentTrack.album} {currentTrack.year ? `• ${currentTrack.year}` : ''}
            </p>
          </div>

          {/* Synchronized Lyrics Container (Clickable to open full Lyrics view) */}
          <div
            onClick={() => setActiveView('lyrics')}
            title="Click to view full Synced Lyrics (Key: L)"
            className="h-44 overflow-hidden rounded-2xl bg-[#14141B] hover:bg-[#181822] border border-[#272733] hover:border-[#3B3B4E] p-5 flex flex-col justify-center text-center shadow-card cursor-pointer transition-all relative group"
          >
            <div className="absolute top-2.5 right-3 text-[10px] text-[#71717A] group-hover:text-[#A78BFA] font-semibold flex items-center gap-1 transition-colors">
              <FileText size={12} />
              <span>Full Lyrics</span>
            </div>
            {lyricsData && lyricsData.synced && lyricsData.lines.length > 0 ? (
              <div className="space-y-2">
                {activeLyricIndex >= 0 ? (
                  <>
                    <p className="text-xs text-[#71717A] line-clamp-1 opacity-70">
                      {lyricsData.lines[activeLyricIndex - 1]?.text || ''}
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-[#A78BFA] drop-shadow-[0_0_12px_rgba(167,139,250,0.5)] transition-all">
                      {lyricsData.lines[activeLyricIndex].text}
                    </p>
                    <p className="text-xs text-[#71717A] line-clamp-1 opacity-70">
                      {lyricsData.lines[activeLyricIndex + 1]?.text || ''}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[#A1A1AA]">Waiting for audio timestamp...</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#71717A] space-y-1">
                <p className="font-semibold text-[#A1A1AA]">No Synchronized Lyrics</p>
                <p className="text-[11px]">
                  {lyricsData?.plainText
                    ? lyricsData.plainText.substring(0, 100) + '...'
                    : 'Click to open Synced Lyrics view'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Transport Controls */}
      <div className="space-y-4 pt-4 border-t border-[#272733] z-10">
        {/* Progress Bar & Seek */}
        <div className="space-y-1.5">
          <div className="relative group w-full h-2 rounded-full bg-[#1B1B24] overflow-hidden cursor-pointer">
            <div
              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] rounded-full transition-all duration-100"
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

          <div className="flex justify-between text-xs font-mono-numbers text-[#71717A]">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(timeRemaining)}</span>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left: Shuffle & Repeat */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleShuffle}
              title="Shuffle"
              className={`p-2 rounded-lg transition-colors ${
                isShuffle ? 'text-[#A78BFA] bg-[#1B1B24]' : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
            >
              <Shuffle size={18} />
            </button>
            <button
              onClick={cycleRepeatMode}
              title={`Repeat: ${repeatMode}`}
              className={`p-2 rounded-lg transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[#A78BFA] bg-[#1B1B24]'
                  : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center gap-5">
            <button
              onClick={prevTrack}
              title="Previous Track"
              className="p-2 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipBack size={22} />
            </button>

            <button
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-4 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:shadow-glow-md hover:scale-105 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track"
              className="p-2 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Right: Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1.5 text-[#71717A] hover:text-[#F5F3FF] transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        tracks={currentTrack ? [currentTrack] : []}
      />
    </div>
  );
};
