import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { LyricsService } from '../../../services/lyricsService';
import { LyricsData, LyricLine } from '../../../types/lyrics';
import { useBackHandler } from '../MobileNavigationContext';
import { Mic2, X, RefreshCw, Clock, FileText, Sparkles } from 'lucide-react';

interface MobileLyricsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileLyricsSheet: React.FC<MobileLyricsSheetProps> = ({ isOpen, onClose }) => {
  const { currentTrack, currentTime, seekTo } = usePlayer();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState<number>(-1);
  const [userIsScrolling, setUserIsScrolling] = useState(false);

  const linesContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const userScrollTimeoutRef = useRef<any>(null);

  // Priority 2: System back button closes active lyrics sheet
  useBackHandler(
    2,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  // Load lyrics when current track changes or sheet opens
  const fetchLyrics = useCallback(async (forceRefresh = false) => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await LyricsService.loadLyricsForTrack(currentTrack, forceRefresh);
      setLyricsData(data);
    } catch (e) {
      setLyricsData({ synced: false, lines: [], source: 'none', offset: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isOpen) {
      fetchLyrics();
    }
  }, [isOpen, fetchLyrics]);

  // Synchronized lyric highlighting
  useEffect(() => {
    if (!lyricsData || !lyricsData.synced || !lyricsData.lines || lyricsData.lines.length === 0) {
      setActiveLineIdx(-1);
      return;
    }

    const idx = LyricsService.findActiveLineIndex(lyricsData.lines, currentTime, lyricsData.offset || 0);
    setActiveLineIdx(idx);

    // Auto-scroll to active line unless user is manually inspecting lyrics
    if (idx !== -1 && !userIsScrolling && linesContainerRef.current) {
      const activeEl = document.getElementById(`lyric_line_${idx}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, lyricsData, userIsScrolling]);

  // Handle manual user scroll override
  const handleUserScroll = () => {
    setUserIsScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    // Resume auto-scrolling after 4 seconds of idle
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 4000);
  };

  if (!isOpen) return null;

  const lines: LyricLine[] = lyricsData?.lines || [];
  const plainText = lyricsData?.plainText || '';
  const isSynced = !!lyricsData?.synced && lines.length > 0;
  const hasLyrics = isSynced || (plainText.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full h-[85vh] max-h-[85vh] rounded-t-3xl bg-[#14141b] border-t border-[#272733] flex flex-col text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272733] flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
              <Mic2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight truncate">Lyrics</h3>
                {isSynced ? (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-950/60 border border-violet-800/40 text-violet-300 flex items-center space-x-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Synced</span>
                  </span>
                ) : hasLyrics ? (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                    Plain Text
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-zinc-400 truncate">
                {currentTrack?.title} • {currentTrack?.artist}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchLyrics(true)}
              disabled={isLoading}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              title="Refresh Lyrics"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Close lyrics"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Lyrics Container */}
        <div
          ref={linesContainerRef}
          onScroll={handleUserScroll}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4 overscroll-contain text-center select-text"
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 py-16">
              <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm font-medium text-zinc-400">Loading lyrics...</p>
            </div>
          ) : !hasLyrics ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1b1b24] border border-[#272733] flex items-center justify-center text-zinc-600">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white">No Lyrics Available</h4>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Lyrics were not found embedded in this audio file or in companion .lrc files.
              </p>
            </div>
          ) : isSynced ? (
            <div className="space-y-4 py-8">
              {lines.map((line, idx) => {
                const isActive = idx === activeLineIdx;
                return (
                  <div
                    key={idx}
                    id={`lyric_line_${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seekTo(line.time)}
                    className={`p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-950/60 to-fuchsia-950/40 border border-violet-500/40 text-white font-bold text-lg sm:text-xl scale-[1.03] shadow-lg shadow-violet-950/50'
                        : 'text-zinc-500 hover:text-zinc-300 text-sm sm:text-base border border-transparent hover:bg-white/5'
                    }`}
                  >
                    <p className="leading-relaxed">{line.text || '•••'}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 whitespace-pre-line text-sm sm:text-base text-zinc-300 leading-relaxed font-sans max-w-lg mx-auto">
              {plainText}
            </div>
          )}
        </div>

        {/* User scroll notice banner */}
        {userIsScrolling && isSynced && (
          <div className="py-1.5 px-4 bg-violet-950/80 border-t border-violet-700/40 text-center text-[11px] text-violet-300">
            Manual scrolling active • Auto-scroll resumes in a few seconds
          </div>
        )}
      </div>
    </div>
  );
};
