import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrackMetadata } from '../../types/audio';
import { WaveformData } from '../../types/waveform';
import { waveformService } from '../../services/waveformService';

interface WaveformSeekbarProps {
  track: TrackMetadata | null;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  height?: number;
  compact?: boolean;
  className?: string;
}

export const WaveformSeekbar: React.FC<WaveformSeekbarProps> = ({
  track,
  currentTime,
  duration,
  onSeek,
  height = 54,
  compact = false,
  className = '',
}) => {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load waveform asynchronously without blocking audio or UI
  useEffect(() => {
    let isCancelled = false;
    if (track) {
      waveformService.getWaveform(track).then((data) => {
        if (!isCancelled) setWaveformData(data);
      });
    } else {
      setWaveformData(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [track?.id]);

  const effectiveDuration = duration > 0 ? duration : track?.duration || 180;
  const progressRatio = effectiveDuration > 0 ? Math.max(0, Math.min(1, currentTime / effectiveDuration)) : 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || effectiveDuration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * effectiveDuration);
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || effectiveDuration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio);
    setHoverTime(ratio * effectiveDuration);

    if (isDragging) {
      onSeek(ratio * effectiveDuration);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverPosition(null);
      setHoverTime(null);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Generate fallback bars if waveform data is loading
  const peaks = waveformData?.peaks || Array.from({ length: 120 }, (_, i) => Math.sin(i / 10) * 0.4 + 0.5);
  const barCount = peaks.length;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full cursor-pointer select-none group flex items-center ${className}`}
      style={{ height }}
      title="Click or drag to seek with precision"
    >
      {/* Waveform Bars Container */}
      <div className="w-full h-full flex items-center justify-between gap-[1.5px] px-1">
        {peaks.map((peak, index) => {
          const barRatio = index / barCount;
          const isPlayed = barRatio <= progressRatio;
          const isHovered = hoverPosition !== null && barRatio <= hoverPosition;

          // Bar height calculation (min 4px, max 100%)
          const barHeightPercent = Math.max(8, Math.min(100, Math.round(peak * 100)));

          return (
            <div
              key={index}
              className="flex-1 rounded-full transition-all duration-75"
              style={{
                height: `${barHeightPercent}%`,
                backgroundColor: isPlayed
                  ? 'var(--accent-dynamic, #A78BFA)'
                  : isHovered
                  ? 'rgba(167, 139, 250, 0.45)'
                  : 'rgba(63, 63, 70, 0.5)',
                opacity: isPlayed ? 1 : isHovered ? 0.8 : 0.4,
                boxShadow: isPlayed && !compact ? '0 0 6px var(--accent-dynamic, rgba(167, 139, 250, 0.3))' : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Progress Playhead Scrubber Pin */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none shadow-md transition-all duration-75"
        style={{
          left: `${progressRatio * 100}%`,
          boxShadow: '0 0 8px #FFF, 0 0 14px var(--accent-dynamic)',
        }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md border border-[var(--accent-dynamic)]" />
      </div>

      {/* Hover Timestamp Indicator & Cursor Pin */}
      {hoverPosition !== null && hoverTime !== null && (
        <>
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-white/40 pointer-events-none"
            style={{ left: `${hoverPosition * 100}%` }}
          />
          <div
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#181822] border border-[#272733] text-[10px] font-mono-numbers font-bold text-[#F5F3FF] shadow-xl pointer-events-none z-30"
            style={{ left: `${hoverPosition * 100}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        </>
      )}

      {/* Acoustic profile badge if estimated */}
      {waveformData?.isEstimated && !compact && (
        <span className="absolute bottom-1 right-2 text-[9px] font-mono text-[#71717A] bg-[#09090B]/80 px-1.5 py-0.2 rounded border border-[#272733]/60 pointer-events-none">
          Estimated Contour
        </span>
      )}
    </div>
  );
};
