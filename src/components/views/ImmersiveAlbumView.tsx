import React, { useState, useEffect, useRef } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { Album } from '../../types/library';
import { TrackMetadata } from '../../types/audio';
import { colorExtractionService, ExtractedColors } from '../../services/colorExtractionService';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  X,
  FileText,
  Sparkles,
  ListPlus,
  Disc,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  User,
  Music,
} from 'lucide-react';
import { LyricsView } from './LyricsView';
import { VisualizerView } from './VisualizerView';

interface ImmersiveAlbumViewProps {
  onExit?: () => void;
  albumOverride?: Album | null;
}

export const ImmersiveAlbumView: React.FC<ImmersiveAlbumViewProps> = ({
  onExit,
  albumOverride,
}) => {
  const {
    albums,
    artists,
    selectedAlbum,
    setActiveView,
    openArtistDetail,
  } = useLibrary();

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    playTrack,
    togglePlayPause,
    seekTo,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    addToQueue,
  } = usePlayer();

  // Active Album determination
  const activeAlbum: Album | null =
    albumOverride ||
    selectedAlbum ||
    (currentTrack
      ? albums.find((a) => a.title.toLowerCase() === (currentTrack.album || '').toLowerCase()) || null
      : null) ||
    albums[0] ||
    null;

  const [colors, setColors] = useState<ExtractedColors>({
    primary: '#A78BFA',
    secondary: '#7C3AED',
    muted: '#1F1A3A',
    primaryRgb: [167, 139, 250],
    secondaryRgb: [124, 58, 237],
    mutedRgb: [31, 26, 58],
  });

  const [showLyrics, setShowLyrics] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Extract ambient colors from album artwork
  useEffect(() => {
    const artworkUrl = activeAlbum?.artworkDataUrl || currentTrack?.artworkDataUrl;
    if (artworkUrl) {
      colorExtractionService.extractColors(artworkUrl).then((c) => {
        if (c) setColors(c);
      });
    }
  }, [activeAlbum?.artworkDataUrl, currentTrack?.artworkDataUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      } else if (e.code === 'Space') {
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
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        setShowVisualizer((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, togglePlayPause, prevTrack, nextTrack, seekTo]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      setActiveView('home');
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayAlbum = () => {
    if (!activeAlbum || activeAlbum.tracks.length === 0) return;
    playTrack(activeAlbum.tracks[0], activeAlbum.tracks);
  };

  const handleQueueAlbum = () => {
    if (!activeAlbum) return;
    activeAlbum.tracks.forEach((t) => addToQueue(t));
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(frac * duration);
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeekTime(frac * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const albumTracks = activeAlbum?.tracks || [];

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B] text-[#F5F3FF] select-none flex flex-col justify-between overflow-hidden animate-in fade-in duration-300 font-sans">
      {/* Animated Multi-Layer Dynamic Ambient Lighting */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000 opacity-30"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${colors.primary} 0%, transparent 65%), radial-gradient(circle at 80% 80%, ${colors.secondary} 0%, transparent 60%)`,
          filter: 'blur(90px)',
        }}
      />
      <div className="analog-noise-overlay" />

      {/* Top Bar: Brand Crest, Album Breadcrumb, and Obvious Exit Button */}
      <header className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-black text-xs shadow-glow-sm">
            H
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold tracking-widest text-[#A1A1AA] uppercase">IMMERSIVE ALBUM EXPERIENCE</span>
            <ChevronRight size={13} className="text-[#52525B]" />
            <span className="font-semibold text-white truncate max-w-xs">{activeAlbum?.title || 'Unknown Album'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Optional Lyrics Toggle Button */}
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showLyrics
                ? 'bg-[var(--accent-dynamic)] text-white border-transparent shadow-glow-sm'
                : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Synced Lyrics (Key: L)"
          >
            <FileText size={13} />
            <span>Lyrics</span>
          </button>

          {/* Optional Visualizer Toggle Button */}
          <button
            onClick={() => setShowVisualizer(!showVisualizer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showVisualizer
                ? 'bg-[var(--accent-dynamic)] text-white border-transparent shadow-glow-sm'
                : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Visualizer (Key: V)"
          >
            <Sparkles size={13} />
            <span>Visualizer</span>
          </button>

          {/* Obvious Exit Button */}
          <button
            onClick={handleExit}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-md"
            title="Exit Immersive Mode (Esc)"
          >
            <span>Exit</span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/50 border border-white/20 text-[10px] font-mono-numbers">
              Esc
            </kbd>
            <X size={14} className="text-white/80" />
          </button>
        </div>
      </header>

      {/* Main Showcase Stage */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 px-8 lg:px-16 py-6 overflow-hidden">
        {/* Left: Large Artwork & Visual Stage */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="relative group">
            {/* Soft Vinyl Groove Shadow under Sleeve */}
            <div
              className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl transition-all duration-700 pointer-events-none"
              style={{ backgroundColor: colors.primary }}
            />

            {/* Tactile High-Resolution Album Sleeve */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl overflow-hidden bg-[#14141B] border border-white/15 shadow-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02]">
              {activeAlbum?.artworkDataUrl ? (
                <img
                  src={activeAlbum.artworkDataUrl}
                  alt={activeAlbum.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc size={96} className="text-[#3F3F46]" />
              )}
              {isPlaying && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none transition-all duration-500"
                  style={{ boxShadow: `inset 0 0 0 2px ${colors.primary}` }}
                />
              )}
            </div>
          </div>

          {/* Quick Album Transport Buttons */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handlePlayAlbum}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-dynamic)] hover:opacity-90 text-white font-bold text-xs shadow-glow transition-all hover:scale-105 active:scale-95"
            >
              <Play size={14} className="fill-white" />
              <span>Play Album</span>
            </button>
            <button
              onClick={handleQueueAlbum}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#E4E4E7] hover:text-white transition-all"
            >
              <ListPlus size={14} />
              <span>Queue Album</span>
            </button>
          </div>
        </div>

        {/* Right: Album Info & Tracklist OR Overlaid Lyrics / Visualizer */}
        <div className="flex-1 w-full max-w-xl h-full flex flex-col justify-between py-2 overflow-hidden">
          {showLyrics ? (
            /* Overlaid Synced Lyrics Pane */
            <div className="h-full flex flex-col bg-[#100E17]/80 rounded-2xl border border-white/10 p-4 backdrop-blur-xl animate-in zoom-in-95 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-xs font-bold text-[#F5F3FF] flex items-center gap-1.5">
                  <FileText size={14} className="text-[var(--accent-dynamic)]" />
                  Synced Lyrics
                </span>
                <button
                  onClick={() => setShowLyrics(false)}
                  className="text-xs text-[#A1A1AA] hover:text-white"
                >
                  Close Lyrics
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LyricsView />
              </div>
            </div>
          ) : showVisualizer ? (
            /* Overlaid Visualizer Pane */
            <div className="h-full flex flex-col bg-[#100E17]/80 rounded-2xl border border-white/10 p-4 backdrop-blur-xl animate-in zoom-in-95 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-xs font-bold text-[#F5F3FF] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[var(--accent-dynamic)]" />
                  Acoustic Visualizer
                </span>
                <button
                  onClick={() => setShowVisualizer(false)}
                  className="text-xs text-[#A1A1AA] hover:text-white"
                >
                  Close Visualizer
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <VisualizerView />
              </div>
            </div>
          ) : (
            /* Standard Album Details & Tracklist Showcase */
            <div className="flex flex-col h-full justify-between space-y-4">
              {/* Header Info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--accent-dynamic)] font-mono-numbers">
                    STUDIO ALBUM
                  </span>
                  {activeAlbum?.year && (
                    <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#A1A1AA]">
                      {activeAlbum.year}
                    </span>
                  )}
                  {activeAlbum?.genre && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#A1A1AA]">
                      {activeAlbum.genre}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F3FF] tracking-tight truncate">
                  {activeAlbum?.title || 'Unknown Album'}
                </h1>

                <div className="flex items-center gap-3 text-xs text-[#A1A1AA]">
                  <button
                    onClick={() => {
                      if (activeAlbum?.artist) {
                        const found = artists.find(
                          (a) => a.name.toLowerCase() === activeAlbum.artist.toLowerCase()
                        );
                        if (found) {
                          openArtistDetail(found);
                        } else {
                          openArtistDetail({
                            id: activeAlbum.artist,
                            name: activeAlbum.artist,
                            albumCount: 1,
                            trackCount: albumTracks.length,
                            albums: activeAlbum ? [activeAlbum] : [],
                          });
                        }
                      }
                    }}
                    className="flex items-center gap-1 text-[#E4E4E7] hover:text-[var(--accent-dynamic)] transition-colors font-semibold"
                  >
                    <User size={13} />
                    <span>{activeAlbum?.artist || 'Unknown Artist'}</span>
                  </button>
                  <span>•</span>
                  <span>{albumTracks.length} tracks</span>
                  <span>•</span>
                  <span>
                    {formatTime(albumTracks.reduce((acc, t) => acc + (t.duration || 0), 0))} total
                  </span>
                </div>
              </div>

              {/* Scrollable Tracklist */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar max-h-72 lg:max-h-80">
                {albumTracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, albumTracks)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--accent-dynamic)]/15 border-[var(--accent-dynamic)] text-white shadow-glow-sm'
                          : 'bg-[#100E17]/60 hover:bg-[#181622] border-white/5 text-[#A1A1AA] hover:text-[#F5F3FF]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center font-mono-numbers text-xs text-[#71717A] group-hover:text-white">
                          {isCurrent && isPlaying ? (
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-dynamic)] inline-block animate-pulse" />
                          ) : (
                            track.trackNumber || idx + 1
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-[#F5F3FF]">{track.title}</p>
                          <p className="text-[10px] text-[#71717A] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-xs font-mono-numbers text-[#71717A]">
                        <span>{formatTime(track.duration || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Timeline & Controls Bar */}
      <footer className="relative z-20 px-8 py-4 border-t border-white/10 backdrop-blur-xl bg-[#09090B]/90 space-y-2">
        {/* Scrubber Seekbar */}
        <div
          ref={progressBarRef}
          onClick={handleSeekClick}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={() => setHoverSeekTime(null)}
          className="relative group w-full h-2 rounded-full bg-white/10 cursor-pointer overflow-hidden transition-all hover:h-2.5"
        >
          <div
            className="h-full bg-gradient-to-r from-[#7C3AED] to-[var(--accent-dynamic)] rounded-full transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
          {hoverSeekTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/70"
              style={{ left: `${(hoverSeekTime / (duration || 1)) * 100}%` }}
            />
          )}
        </div>

        {/* Transport & Volume Bar */}
        <div className="flex items-center justify-between">
          {/* Currently Playing Track Label */}
          <div className="flex items-center gap-3 min-w-0 w-1/4">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-[#F5F3FF] truncate">{currentTrack?.title || 'Idle'}</h4>
              <p className="text-[10px] text-[#A1A1AA] truncate">{currentTrack?.artist || 'Select track to play'}</p>
            </div>
          </div>

          {/* Center Transport Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-lg transition-colors ${
                isShuffle ? 'text-[var(--accent-dynamic)]' : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
              title="Shuffle"
            >
              <Shuffle size={15} />
            </button>

            <button
              onClick={prevTrack}
              className="p-2 text-[#A1A1AA] hover:text-white transition-colors"
              title="Previous (Ctrl+Left)"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[var(--accent-dynamic)] text-white shadow-glow hover:scale-105 active:scale-95 transition-all"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-[#A1A1AA] hover:text-white transition-colors"
              title="Next (Ctrl+Right)"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={cycleRepeatMode}
              className={`p-1.5 rounded-lg transition-colors ${
                repeatMode !== 'off' ? 'text-[var(--accent-dynamic)]' : 'text-[#71717A] hover:text-[#F5F3FF]'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          {/* Right: Timestamps & Volume */}
          <div className="flex items-center justify-end gap-3 w-1/4">
            <span className="text-xs font-mono-numbers text-[#A1A1AA]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div
              className="flex items-center gap-1.5 relative"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              {showVolumeSlider && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-[var(--accent-dynamic)] transition-all"
                />
              )}
              <button
                onClick={toggleMute}
                className="p-1.5 text-[#A1A1AA] hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
