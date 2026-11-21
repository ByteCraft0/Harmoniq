import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { CircularAudioVisualizer } from '../visualizer/CircularAudioVisualizer';
import { AdvancedVisualizer } from '../visualizer/AdvancedVisualizer';
import { RealTimeFrequencySpectrum } from '../visualizer/RealTimeFrequencySpectrum';
import { FullScreenVisualizer } from '../visualizer/FullScreenVisualizer';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { LyricsService } from '../../services/lyricsService';
import { LyricsData } from '../../types/lyrics';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { AudioQualityAnalyzer } from '../audio/AudioQualityAnalyzer';
import { ABRepeatControls } from '../audio/ABRepeatControls';
import { appearanceService } from '../../services/appearanceService';
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
  Disc3,
  Layers,
  Upload,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  BarChart3,
  Activity,
  Radio,
  Bookmark,
  Maximize2,
} from 'lucide-react';
import { MusicBookmarksModal } from '../audio/MusicBookmarksModal';
import { WaveformSeekbar } from '../audio/WaveformSeekbar';


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
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [timelineMode, setTimelineMode] = useState<'waveform' | 'classic'>('waveform');
  const [artworkMode, setArtworkMode] = useState<'ambient' | 'vinyl' | 'circular' | 'visualizer'>('ambient');
  const [bottomVisualizerMode, setBottomVisualizerMode] = useState<'mini-spectrum' | 'spectrum-7band' | 'stream-specs'>('mini-spectrum');
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [appearance, setAppearance] = useState(appearanceService.getSettings());

  useEffect(() => {
    return appearanceService.subscribe((s) => {
      setAppearance(s);
      if (s.vinylStyleAnimation && artworkMode === 'ambient') {
        setArtworkMode('vinyl');
      }
    });
  }, [artworkMode]);

  const [showFullScreenVisualizer, setShowFullScreenVisualizer] = useState(false);
  const trackIdRef = useRef<string | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load lyrics on track change
  useEffect(() => {
    if (currentTrack) {
      const activeId = currentTrack.id;
      trackIdRef.current = activeId;
      setLyricsData(null);
      setIsUserScrolling(false);

      LyricsService.loadLyricsForTrack(currentTrack)
        .then((data) => {
          if (trackIdRef.current === activeId) {
            setLyricsData(data);
          }
        })
        .catch(() => {
          if (trackIdRef.current === activeId) {
            setLyricsData(null);
          }
        });
    } else {
      trackIdRef.current = null;
      setLyricsData(null);
    }
  }, [currentTrack?.id]);

  const activeLyricIndex = lyricsData?.synced
    ? LyricsService.findActiveLineIndex(lyricsData.lines, currentTime, lyricsData.offset || 0)
    : -1;

  // Auto-scroll to active lyric line (centered)
  const scrollToActive = useCallback((smooth = true) => {
    if (lyricsContainerRef.current && activeLyricRef.current) {
      const container = lyricsContainerRef.current;
      const el = activeLyricRef.current;
      const targetScroll = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    if (!isUserScrolling && activeLyricIndex >= 0) {
      scrollToActive(true);
    }
  }, [activeLyricIndex, isUserScrolling, scrollToActive]);

  const handleContainerWheel = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollToActive(true);
    }, 4000);
  };

  const handleResumeSync = () => {
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    setIsUserScrolling(false);
    scrollToActive(true);
  };

  const handlePickLrc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    const loaded = await LyricsService.pickAndLoadLrcFile(currentTrack);
    if (loaded) {
      setLyricsData(loaded);
      setIsUserScrolling(false);
    }
  };

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
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
        >
          Browse Music Library
        </button>
      </div>
    );
  }

  const qualityTier = AudioQualityInspectorService.calculateQualityTier(currentTrack);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeRemaining = duration > currentTime ? duration - currentTime : 0;

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden px-6 sm:px-8 pt-5 pb-10 flex flex-col gap-6 max-w-6xl mx-auto relative select-none scrollbar-thin">
      {/* Ambient Mesh Glow Layers (Dynamic Colors) */}
      <div
        className="ambient-mesh-glow -top-24 -left-24 w-[500px] h-[500px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--ambient-primary) 0%, transparent 70%)',
        }}
      />
      <div
        className="ambient-mesh-glow -bottom-24 -right-24 w-[450px] h-[450px] opacity-15 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--ambient-secondary) 0%, transparent 70%)',
        }}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10 shrink-0">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors backdrop-blur-md"
          >
            <Gauge size={14} className="text-[var(--accent-dynamic)]" />
            <span>Technical Inspector</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Presentation Style Selector (Ambient, Vinyl, Circular, Multi-Style Visualizer) */}
          <div className="flex items-center bg-[#14141B]/80 border border-[#272733] rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setArtworkMode('ambient')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                artworkMode === 'ambient'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
              title="Ambient Floating Artwork mode"
            >
              <Layers size={13} />
              <span>Ambient</span>
            </button>
            <button
              onClick={() => setArtworkMode('vinyl')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                artworkMode === 'vinyl'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
              title="Vinyl 33⅓ RPM Record mode"
            >
              <Disc3 size={13} />
              <span>Vinyl LP</span>
            </button>
            <button
              onClick={() => setArtworkMode('circular')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                artworkMode === 'circular'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
              title="Circular Radial Visualizer Hub"
            >
              <Radio size={13} />
              <span>Circular</span>
            </button>
            <button
              onClick={() => setArtworkMode('visualizer')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                artworkMode === 'visualizer'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
              title="Multi-Style Advanced Visualizer"
            >
              <Sparkles size={13} />
              <span>Visualizer</span>
            </button>
          </div>

          <button
            onClick={() => setShowFullScreenVisualizer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors backdrop-blur-md"
            title="Launch Immersive Fullscreen Listening Experience"
          >
            <Maximize2 size={14} className="text-[#A78BFA]" />
            <span>Fullscreen</span>
          </button>

          <button
            onClick={() => setActiveView('visualizer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors backdrop-blur-md"
            title="Open dedicated Full-Screen Visualizer Studio"
          >
            <Sparkles size={14} className="text-[var(--accent-dynamic)]" />
            <span>Visualizer Studio</span>
          </button>

          <button
            onClick={() => setActiveView('equalizer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors backdrop-blur-md"
          >
            <Sliders size={14} className="text-[var(--accent-dynamic)]" />
            <span>Equalizer Studio</span>
          </button>
        </div>
      </div>

      {/* Main Focus: Artwork / Visualizer (Left) + Interactive Karaoke Lyrics (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start relative z-10 w-full">
        {/* Left Column: Artwork Presentation & Live Spectrum */}
        <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4 relative">
          {appearance.ambientLighting && (
            <div
              className="absolute -inset-4 rounded-3xl opacity-45 blur-3xl pointer-events-none transition-all duration-1000 -z-10"
              style={{
                background:
                  'radial-gradient(circle, var(--ambient-primary) 10%, var(--ambient-secondary) 50%, transparent 75%)',
              }}
            />
          )}
          {artworkMode === 'ambient' ? (
            /* Style A: Ambient Floating Artwork with Breathing Animation */
            <div
              className={`relative group w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-[#14141B] border border-[#272733] shadow-2xl flex items-center justify-center transition-all duration-700 ${
                isPlaying && appearance.albumArtworkAnimations && appearance.animationsEnabled
                  ? 'animate-artwork-breathing shadow-[0_12px_40px_var(--glow-dynamic)]'
                  : ''
              }`}
            >
              {currentTrack.artworkDataUrl ? (
                <img
                  src={currentTrack.artworkDataUrl}
                  alt={currentTrack.album}
                  className="w-full h-full object-cover select-none transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#3F3F46]">
                  <FileAudio size={76} strokeWidth={1} />
                  <span className="text-xs uppercase tracking-wider mt-2 font-mono-numbers text-[#71717A]">
                    {currentTrack.codec} Lossless
                  </span>
                </div>
              )}
            </div>
          ) : artworkMode === 'vinyl' ? (
            /* Style B: Vinyl Record 33⅓ RPM Mode */
            <div className="relative w-80 h-72 flex items-center justify-center">
              {/* Vinyl Sleeve / Jacket */}
              <div className="relative w-64 h-64 rounded-xl overflow-hidden bg-[#14141B] border border-[#272733] shadow-2xl z-20 shrink-0">
                {currentTrack.artworkDataUrl ? (
                  <img
                    src={currentTrack.artworkDataUrl}
                    alt={currentTrack.album}
                    className="w-full h-full object-cover select-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#3F3F46]">
                    <FileAudio size={60} strokeWidth={1} />
                    <span className="text-[10px] uppercase tracking-wider mt-1 text-[#71717A]">
                      {currentTrack.codec}
                    </span>
                  </div>
                )}
                {/* Vinyl Sleeve Spine Shadow */}
                <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />
              </div>

              {/* Vinyl Disc (slides out and rotates when playing) */}
              <div
                className={`absolute w-60 h-60 rounded-full border border-black/40 shadow-2xl z-10 transition-transform duration-700 ease-out flex items-center justify-center ${
                  isPlaying ? 'translate-x-14' : 'translate-x-4'
                }`}
                style={{
                  background:
                    'radial-gradient(circle, #1a1a24 0%, #0d0d12 40%, #15151e 55%, #08080c 70%, #171720 85%, #050508 100%)',
                }}
              >
                {/* Concentric Vinyl Grooves */}
                <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute inset-12 rounded-full border border-white/5 pointer-events-none" />

                {/* Rotating Vinyl Body & Center Label */}
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center ${
                    isPlaying ? 'animate-vinyl' : ''
                  }`}
                  style={{
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                >
                  {/* Center Label (Mini Artwork) */}
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 shadow-inner relative flex items-center justify-center bg-[#111]">
                    {currentTrack.artworkDataUrl ? (
                      <img
                        src={currentTrack.artworkDataUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc3 size={32} className="text-[#A78BFA]" />
                    )}
                    {/* Center Spindle Hole */}
                    <div className="absolute w-4 h-4 rounded-full bg-[#0a0a0f] border border-white/20 shadow-md" />
                  </div>
                </div>
              </div>
            </div>
          ) : artworkMode === 'circular' ? (
            /* Style C: Circular Audio Visualizer Hub */
            <div className="w-80 h-80 flex items-center justify-center">
              <CircularAudioVisualizer size={320} />
            </div>
          ) : (
            /* Style D: Multi-Style Advanced Audio Visualizer */
            <div className="w-80 h-72 flex items-center justify-center">
              <AdvancedVisualizer height={260} showControlsBar={true} />
            </div>
          )}

          {/* Integrated Spectrum Analyzer / 7-Band Log Spectrum Bar */}
          <div className="w-full max-w-sm rounded-xl bg-[#14141B]/80 border border-[#272733] backdrop-blur-md shadow-card p-2 space-y-1">
            <div className="flex items-center justify-between px-1 text-[10px] text-[#71717A] font-mono-numbers">
              <span className="flex items-center gap-1 text-[var(--accent-dynamic)] font-bold">
                <Activity size={11} />
                <span>Live Audio Spectrum</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBottomVisualizerMode('mini-spectrum')}
                  className={`px-1.5 py-0.5 rounded ${
                    bottomVisualizerMode === 'mini-spectrum'
                      ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  Bars
                </button>
                <button
                  onClick={() => setBottomVisualizerMode('spectrum-7band')}
                  className={`px-1.5 py-0.5 rounded ${
                    bottomVisualizerMode === 'spectrum-7band'
                      ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  7-Band
                </button>
                <button
                  onClick={() => setBottomVisualizerMode('stream-specs')}
                  className={`px-1.5 py-0.5 rounded ${
                    bottomVisualizerMode === 'stream-specs'
                      ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  Specs
                </button>
              </div>
            </div>

            {bottomVisualizerMode === 'mini-spectrum' ? (
              <AudioVisualizer height={40} mode="spectrum" />
            ) : bottomVisualizerMode === 'spectrum-7band' ? (
              <RealTimeFrequencySpectrum height={70} compact={true} />
            ) : (
              <div className="pt-1">
                <AudioQualityAnalyzer compact={true} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Track Details & Interactive Karaoke Lyrics Container */}
        <div className="md:col-span-7 flex flex-col justify-between h-full max-h-[460px] space-y-4">
          {/* Track Meta Header */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-dynamic)] font-mono-numbers">
                Now Playing
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBookmarksOpen(true)}
                  title="Track Bookmarks & Timestamp Notes"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[var(--accent-dynamic)] transition-colors"
                >
                  <Bookmark size={14} className="text-[var(--accent-dynamic)]" />
                  <span>Bookmarks</span>
                </button>
                <button
                  onClick={() => setIsAddToPlaylistOpen(true)}
                  title="Add to Playlist"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                >
                  <FolderPlus size={14} className="text-[var(--accent-dynamic)]" />
                  <span>Add to Playlist</span>
                </button>
                <button
                  onClick={() => toggleFavorite(currentTrack.id)}
                  title={currentTrack.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                  className="p-1.5 rounded-full hover:bg-[#1B1B24] text-[#71717A] hover:text-red-400 transition-colors"
                >
                  <Heart
                    size={19}
                    className={currentTrack.isFavorite ? 'fill-red-500 text-red-500' : ''}
                  />
                </button>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F3FF] tracking-tight truncate">
              {currentTrack.title}
            </h1>
            <p className="text-base text-[#A1A1AA] font-medium truncate">
              {currentTrack.artist}
            </p>
            <p className="text-xs text-[#71717A] font-mono-numbers">
              {currentTrack.album} {currentTrack.year ? `• ${currentTrack.year}` : ''}
            </p>
          </div>

          {/* Interactive Karaoke Synchronized Lyrics Section */}
          <div className="flex-1 min-h-[260px] rounded-2xl bg-[#14141B]/60 border border-[#272733] relative flex flex-col overflow-hidden backdrop-blur-md shadow-card">
            {/* Lyrics Header bar with source indicator & Manual LRC loader */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#272733]/60 bg-[#121218]/50 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-[var(--accent-dynamic)]" />
                <span className="font-semibold text-[#F5F3FF] text-xs">Synchronized Karaoke Lyrics</span>
                {lyricsData?.source && lyricsData.source !== 'none' && (
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5 ml-1">
                    <CheckCircle2 size={11} />
                    {lyricsData.source === 'lrc_file' ? '.LRC' : lyricsData.source === 'embedded' ? 'Embedded' : 'LRCLIB'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePickLrc}
                  title="Choose local .lrc file for this track"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B1B24] hover:bg-[#252532] text-[#A1A1AA] hover:text-[#F5F3FF] text-[11px] font-medium transition-colors border border-[#2D2D3B]"
                >
                  <Upload size={11} />
                  <span>Load .LRC</span>
                </button>
                <button
                  onClick={() => setActiveView('lyrics')}
                  title="Open full dedicated Lyrics View (Hotkey: L)"
                  className="text-[11px] text-[#71717A] hover:text-[var(--accent-dynamic)] transition-colors px-1 font-medium"
                >
                  Full View
                </button>
              </div>
            </div>

            {/* Synchronized Lyrics Interactive Scroll Area */}
            <div
              ref={lyricsContainerRef}
              onWheel={handleContainerWheel}
              className="flex-1 overflow-y-auto px-6 py-12 space-y-6 text-center relative scroll-smooth select-none"
            >
              {lyricsData && lyricsData.synced && lyricsData.lines.length > 0 ? (
                lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => seekTo(line.time)}
                      title={`Seek to ${formatTime(line.time)}`}
                      className={`group cursor-pointer py-1.5 px-3 rounded-xl transition-all duration-300 ${
                        isActive
                          ? 'scale-105 origin-center'
                          : 'opacity-40 hover:opacity-80 hover:bg-[#1B1B24]/40'
                      }`}
                    >
                      <p
                        className={`transition-all duration-300 ${
                          isActive
                            ? 'text-xl sm:text-2xl font-black text-[var(--accent-dynamic)] drop-shadow-[0_0_16px_var(--glow-dynamic)]'
                            : 'text-sm sm:text-base font-semibold text-[#8E8EA0] group-hover:text-[#F5F3FF]'
                        }`}
                      >
                        {line.text}
                      </p>
                    </div>
                  );
                })
              ) : lyricsData?.plainText ? (
                <div className="max-w-md mx-auto whitespace-pre-wrap text-sm text-[#A1A1AA] leading-relaxed py-4">
                  {lyricsData.plainText}
                </div>
              ) : (
                /* Clean Empty State with Action */
                <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center text-[#71717A] py-6">
                  <FileText size={32} className="text-[#3F3F46] mb-2" />
                  <p className="text-xs font-semibold text-[#A1A1AA]">No Synchronized Lyrics Loaded</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5 max-w-xs">
                    Place a matching <span className="text-[var(--accent-dynamic)] font-mono-numbers">.lrc</span> file in the same folder or load one manually.
                  </p>
                  <button
                    onClick={handlePickLrc}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
                  >
                    <Upload size={12} />
                    <span>Choose .LRC File</span>
                  </button>
                </div>
              )}
            </div>

            {/* Resume Auto-Scroll Pill if User Manually Scrolled */}
            {isUserScrolling && lyricsData?.synced && (
              <button
                onClick={handleResumeSync}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-dynamic)] hover:bg-[#8B5CF6] text-white text-[11px] font-bold shadow-lg shadow-[var(--glow-dynamic)] transition-all hover:scale-105 active:scale-95 z-20"
              >
                <RotateCcw size={11} />
                <span>Resume Auto-Scroll</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Playback Timeline & Transport Controls Row (Normal Flow, No Overlap) */}
      <div className="w-full space-y-3 pt-4 border-t border-[#272733]/80 relative">
        {/* Progress Bar & Seek / Real Waveform Navigation */}
        <div className="space-y-1.5">
          {timelineMode === 'waveform' ? (
            <div className="p-2.5 rounded-xl bg-[#14141B] border border-[#272733] shadow-card">
              <WaveformSeekbar
                track={currentTrack}
                currentTime={currentTime}
                duration={duration}
                onSeek={seekTo}
                height={42}
              />
            </div>
          ) : (
            <div className="relative group w-full h-2.5 rounded-full bg-[#1B1B24] overflow-hidden cursor-pointer my-2">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] rounded-full transition-all duration-100"
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
          )}

          <div className="flex justify-between items-center text-xs font-mono-numbers text-[#71717A] px-1">
            <span>{formatTime(currentTime)}</span>
            <button
              onClick={() => setTimelineMode((m) => (m === 'waveform' ? 'classic' : 'waveform'))}
              title="Toggle Waveform vs Classic Seekbar"
              className="text-[10px] text-[#A1A1AA] hover:text-[var(--accent-dynamic)] transition-colors font-mono uppercase tracking-wider"
            >
              {timelineMode === 'waveform' ? 'Waveform Mode' : 'Classic Bar'}
            </button>
            <span>-{formatTime(timeRemaining)}</span>
          </div>
        </div>

        {/* Buttons Row (Symmetrical Layout, Volume Exclusively in BottomPlayer) */}
        <div className="flex items-center justify-between">
          {/* Left: Shuffle & Repeat */}
          <div className="flex items-center gap-3 flex-1 justify-start">
            <button
              onClick={toggleShuffle}
              title="Shuffle"
              className={`p-2 rounded-lg transition-colors ${
                isShuffle ? 'text-[var(--accent-dynamic)] bg-[#1B1B24]' : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
            >
              <Shuffle size={18} />
            </button>
            <button
              onClick={cycleRepeatMode}
              title={`Repeat: ${repeatMode}`}
              className={`p-2 rounded-lg transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[var(--accent-dynamic)] bg-[#1B1B24]'
                  : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>

            {/* A-B Precision Repeat Looper */}
            <ABRepeatControls compact={true} />
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center gap-5 shrink-0">
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
              className="p-3.5 rounded-full bg-gradient-to-tr from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:shadow-glow-md hover:scale-105 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track"
              className="p-2 text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Right: Symmetrical Spacer to preserve centered playback controls */}
          <div className="flex-1" />
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        tracks={currentTrack ? [currentTrack] : []}
      />

      <MusicBookmarksModal
        track={currentTrack}
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
      />

      {showFullScreenVisualizer && (
        <FullScreenVisualizer onClose={() => setShowFullScreenVisualizer(false)} />
      )}
    </div>
  );
};
