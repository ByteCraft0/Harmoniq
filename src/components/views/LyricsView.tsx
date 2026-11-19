import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { LyricsService } from '../../services/lyricsService';
import { LyricsData } from '../../types/lyrics';
import {
  FileText,
  Plus,
  Minus,
  RotateCcw,
  RotateCw,
  Disc,
  Play,
  CheckCircle2,
  Upload,
  Search,
} from 'lucide-react';
import { SearchOnlineLyricsModal } from './SearchOnlineLyricsModal';
import { HarmoniqWaveformLoader } from '../brand/HarmoniqWaveformLoader';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';

const formatLineTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const LyricsView: React.FC = () => {
  const { currentTrack, currentTime, seekTo } = usePlayer();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showOnlineSearchModal, setShowOnlineSearchModal] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLyrics = useCallback((forceRefresh = false) => {
    if (!currentTrack) return;
    const activeId = currentTrack.id;
    trackIdRef.current = activeId;
    if (forceRefresh) {
      LyricsService.clearCacheForTrack(currentTrack);
    }
    setLyricsData(null);
    setIsLoading(true);
    setOffsetMs(0);
    setIsUserScrolling(false);

    LyricsService.loadLyricsForTrack(currentTrack, forceRefresh)
      .then((data) => {
        if (trackIdRef.current === activeId) {
          setLyricsData(data);
          setOffsetMs((data.offset || 0) * 1000);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (trackIdRef.current === activeId) {
          setLyricsData({ synced: false, lines: [], source: 'none', offset: 0 });
          setIsLoading(false);
        }
      });
  }, [currentTrack]);

  useEffect(() => {
    if (currentTrack) {
      fetchLyrics(false);
    } else {
      trackIdRef.current = null;
      setLyricsData(null);
      setIsLoading(false);
    }
  }, [currentTrack?.id, fetchLyrics]);

  const activeIndex = lyricsData?.synced
    ? LyricsService.findActiveLineIndex(lyricsData.lines, currentTime, offsetMs / 1000)
    : -1;

  const scrollToActive = useCallback((smooth = true) => {
    if (containerRef.current && activeLineRef.current) {
      const container = containerRef.current;
      const el = activeLineRef.current;
      const targetScroll = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    if (!isUserScrolling && activeIndex >= 0) {
      scrollToActive(true);
    }
  }, [activeIndex, isUserScrolling, scrollToActive]);

  const handleContainerWheel = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollToActive(true);
    }, 4500);
  };

  const handleResumeSync = () => {
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    setIsUserScrolling(false);
    scrollToActive(true);
  };

  const adjustOffset = (deltaMs: number) => {
    setOffsetMs((prev) => prev + deltaMs);
  };

  const resetOffset = () => {
    setOffsetMs(0);
  };

  const handlePickLrc = async () => {
    if (!currentTrack) return;
    const loaded = await LyricsService.pickAndLoadLrcFile(currentTrack);
    if (loaded) {
      setLyricsData(loaded);
      setOffsetMs((loaded.offset || 0) * 1000);
      setIsUserScrolling(false);
    }
  };

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-[#71717A] select-none">
        <div className="w-16 h-16 rounded-2xl bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46] mb-3">
          <FileText size={32} />
        </div>
        <h3 className="font-bold text-base text-[#F5F3FF]">No Audio Playing</h3>
        <p className="text-xs text-[#A1A1AA] mt-1">Select a song to display synchronized lyrics.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-4xl mx-auto select-none relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#272733]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#14141B] overflow-hidden shrink-0 border border-[#272733] shadow-md">
            {currentTrack.artworkDataUrl ? (
              <img src={currentTrack.artworkDataUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Disc size={22} className="m-auto text-[#3F3F46]" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#F5F3FF] truncate">{currentTrack.title}</h2>
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA] truncate">
              <span className="truncate">{currentTrack.artist}</span>
              {lyricsData?.source && lyricsData.source !== 'none' && (
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                  <CheckCircle2 size={11} />
                  {lyricsData.source === 'lrc_file' ? '.LRC' : lyricsData.source === 'embedded' ? 'Embedded' : 'LRCLIB'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls: Offset and Refresh */}
        <div className="flex items-center gap-2">
          {lyricsData?.synced && (
            <div className="flex items-center gap-2 bg-[#14141B] px-3.5 py-1.5 rounded-xl border border-[#272733] text-xs">
              <span className="text-[#71717A] font-mono-numbers">Offset:</span>
              <span
                className={`font-mono-numbers font-bold ${
                  offsetMs !== 0 ? 'text-[#A78BFA]' : 'text-[#71717A]'
                }`}
              >
                {offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms
              </span>
              <div className="flex items-center gap-1 ml-1.5">
                <button
                  onClick={() => adjustOffset(-200)}
                  title="Delay Lyrics (-200ms)"
                  className="p-1 hover:bg-[#1B1B24] rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                >
                  <Minus size={13} />
                </button>
                <button
                  onClick={() => adjustOffset(200)}
                  title="Advance Lyrics (+200ms)"
                  className="p-1 hover:bg-[#1B1B24] rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                >
                  <Plus size={13} />
                </button>
                {offsetMs !== 0 && (
                  <button
                    onClick={resetOffset}
                    title="Reset Offset"
                    className="p-1 hover:bg-[#1B1B24] rounded-lg text-[#A1A1AA] hover:text-[#A78BFA] transition-colors"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowOnlineSearchModal(true)}
            title="Search lyrics online"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <Search size={13} className="text-[#A78BFA]" />
            <span>Search Online</span>
          </button>

          <button
            onClick={handlePickLrc}
            title="Load local .lrc file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <Upload size={13} className="text-[var(--accent-dynamic)]" />
            <span>Load .LRC</span>
          </button>

          <button
            onClick={() => fetchLyrics(true)}
            title="Refresh / Re-fetch Lyrics"
            className="p-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#71717A] hover:text-[#A78BFA] transition-colors"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Lyrics Content Container */}
      <div
        ref={containerRef}
        onWheel={handleContainerWheel}
        className="flex-1 overflow-y-auto py-16 px-4 space-y-7 text-center relative scroll-smooth"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <HarmoniqWaveformLoader
              label={`Synchronizing lyrics for "${currentTrack.title}"...`}
              size="lg"
            />
          </div>
        ) : lyricsData?.synced && lyricsData.lines.length > 0 ? (
          lyricsData.lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seekTo(line.time)}
                className={`group relative flex items-center justify-center gap-3 cursor-pointer py-1.5 px-4 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'scale-105 origin-center'
                    : 'hover:bg-[#14141B]/40'
                }`}
              >
                {/* Time Indicator on Hover */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono-numbers text-[#71717A] flex items-center gap-1 shrink-0">
                  <Play size={10} className="text-[#A78BFA]" />
                  {formatLineTime(line.time)}
                </span>

                {/* Lyric Text */}
                <p
                  className={`transition-all duration-300 ${
                    isActive
                      ? 'text-2xl sm:text-3xl font-black text-[#A78BFA] drop-shadow-[0_0_16px_rgba(167,139,250,0.5)]'
                      : 'text-sm sm:text-base font-semibold text-[#52525B] group-hover:text-[#A1A1AA]'
                  }`}
                >
                  {line.text}
                </p>
              </div>
            );
          })
        ) : lyricsData?.plainText ? (
          <div className="max-w-lg mx-auto whitespace-pre-wrap text-sm text-[#A1A1AA] leading-relaxed py-6">
            {lyricsData.plainText}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-[#71717A] text-xs">
            <FileText size={40} className="mb-2.5 text-[#3F3F46]" />
            <p className="font-bold text-[#F5F3FF] text-sm">No Lyrics Available</p>
            <p className="max-w-sm mt-1 text-[#A1A1AA]">
              No lyrics found for <span className="text-[#F5F3FF] font-semibold">{currentTrack.title}</span> by <span className="text-[#F5F3FF] font-semibold">{currentTrack.artist}</span>.
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <button
                onClick={() => fetchLyrics(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] font-bold text-xs shadow-glow-sm hover:shadow-glow-md transition-all"
              >
                Retry Search
              </button>
              <button
                onClick={handlePickLrc}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#252532] text-[#F5F3FF] font-bold text-xs border border-[#2D2D3B] transition-all"
              >
                <Upload size={13} />
                <span>Load .LRC File</span>
              </button>
            </div>
            <p className="text-[11px] text-[#71717A] mt-3">
              Searches companion <span className="font-mono-numbers text-[#A78BFA]">.lrc</span> files, embedded tags, and LRCLIB online.
            </p>
          </div>
        )}
      </div>

      {/* Floating Resume Auto-Scroll Button */}
      {isUserScrolling && lyricsData?.synced && (
        <button
          onClick={handleResumeSync}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-xs font-bold shadow-lg shadow-[#7C3AED]/40 transition-all hover:scale-105 active:scale-95 z-20"
        >
          <RotateCcw size={12} />
          <span>Resume Auto-Scroll</span>
        </button>
      )}

      {showOnlineSearchModal && currentTrack && (
        <SearchOnlineLyricsModal
          currentTrack={currentTrack}
          onApplyLyrics={(data) => {
            setLyricsData(data);
            setOffsetMs((data.offset || 0) * 1000);
          }}
          onClose={() => setShowOnlineSearchModal(false)}
        />
      )}
    </div>
  );
};
