import React, { useState, useRef, useCallback, useMemo } from 'react';

export interface MiniWaveformProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  trackId?: string;
  compact?: boolean;
  showTimestamps?: boolean;
  className?: string;
}

/**
 * Generates an aesthetic, deterministic waveform envelope based on track identifier.
 */
function generateTrackProfile(trackId?: string, count: number = 36, maxH: number = 16): number[] {
  const seed = trackId
    ? trackId.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0)
    : 1337;

  const minH = maxH > 10 ? 4 : 3;
  const profile: number[] = [];
  for (let i = 0; i < count; i++) {
    const pos = i / (count - 1);
    // Multi-harmonic synthesized acoustic envelope
    const w1 = Math.sin(pos * Math.PI * 2.5 + seed * 0.03);
    const w2 = Math.cos(pos * Math.PI * 5.2 + seed * 0.07);
    const w3 = Math.sin(pos * Math.PI * 9.1 + seed * 0.11);
    // Natural audio dynamic curve tapering at intro/outro
    const envelope = Math.sin(pos * Math.PI);
    const rawAmp = (Math.abs(w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.75 + 0.25) * (0.35 + 0.65 * envelope);

    const h = Math.round(minH + rawAmp * (maxH - minH));
    profile.push(Math.max(minH, Math.min(maxH, h)));
  }
  return profile;
}

function formatSeconds(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
}

export const MiniWaveformProgressBar: React.FC<MiniWaveformProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  trackId,
  compact = false,
  showTimestamps = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalBars = compact ? 30 : 38;
  const maxBarHeight = compact ? 10 : 16;
  const bars = useMemo(() => generateTrackProfile(trackId, totalBars, maxBarHeight), [trackId, totalBars, maxBarHeight]);

  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  const calculateTargetTime = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || duration <= 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const target = calculateTargetTime(e.clientX);
    onSeek(target);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveTarget = calculateTargetTime(moveEvent.clientX);
      onSeek(moveTarget);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio * duration);
  };

  return (
    <div className={`space-y-0.5 select-none ${className}`}>
      {/* Waveform Scrubber Surface */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Playback waveform position"
        aria-valuemin={0}
        aria-valuemax={duration || 100}
        aria-valuenow={currentTime}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setHoverPosition(null);
        }}
        onMouseMove={handleMouseMove}
        className={`relative flex items-center justify-between cursor-pointer px-0.5 group ${
          compact ? 'h-3.5' : 'h-5'
        }`}
      >
        {bars.map((barHeight, idx) => {
          const barRatio = idx / (totalBars - 1);
          const isPlayed = barRatio <= progressRatio;
          const isHoverHighlight =
            hoverPosition !== null && barRatio <= hoverPosition / (duration || 1);

          return (
            <span
              key={idx}
              className={`rounded-full transition-all duration-150 origin-center ${
                isPlayed
                  ? 'bg-gradient-to-t from-[#6D28D9] via-[#8B5CF6] to-[#C4B5FD] shadow-[0_0_6px_rgba(167,139,250,0.5)]'
                  : isHoverHighlight
                  ? 'bg-violet-400/40'
                  : 'bg-white/15 group-hover:bg-white/20'
              }`}
              style={{
                width: compact ? 2 : 2.5,
                height: barHeight,
              }}
            />
          );
        })}

        {/* Hover Tooltip Timestamp */}
        {isHovering && hoverPosition !== null && (
          <div
            className="absolute -top-5 transform -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#130f24] border border-violet-500/40 text-[9px] font-mono text-violet-200 pointer-events-none shadow-md z-30"
            style={{
              left: `${Math.max(10, Math.min(90, (hoverPosition / (duration || 1)) * 100))}%`,
            }}
          >
            {formatSeconds(hoverPosition)}
          </div>
        )}
      </div>

      {/* Timestamp labels below waveform */}
      {showTimestamps && (
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 px-0.5 leading-none">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      )}
    </div>
  );
};
