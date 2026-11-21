import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { windowLifecycleService } from '../../services/windowLifecycleService';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

export interface AnimatedVolumeWaveProps {
  volume: number; // 0.0 to 1.0
  isMuted?: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute?: () => void;
  width?: number | string;
  height?: number;
  className?: string;
  showMuteButton?: boolean;
  showPercentage?: boolean;
  disabled?: boolean;
}

/**
 * AnimatedVolumeWave
 * Signature Harmoniq 2.0.1 continuously animated SVG waveform volume control.
 *
 * Audiophile-Grade Visual Refinements:
 * - Visually continuous flowing sine waveform ($L = 60px$, gentle organic amplitude).
 * - Restrained, elegant neon purple-to-lavender gradient with soft glow.
 * - Perfectly seamless infinite CSS translation (-60px loop, 0% JS overhead).
 * - Refined circular white volume knob with lavender rim and luminous halo.
 * - Active wave terminates seamlessly directly into the circular handle.
 * - Subtle, low-opacity continuing wave track for the unselected headroom.
 * - Full pointer capture for smooth real-time dragging beyond component bounds.
 * - Keyboard accessibility (Arrows, PageUp/Down, Home/End, Mute toggle).
 * - Continuous playback-independent motion that suspends when window is minimized.
 * - Respects prefers-reduced-motion media query.
 */
export const AnimatedVolumeWave: React.FC<AnimatedVolumeWaveProps> = ({
  volume,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  width = 130,
  height = 28,
  className = '',
  showMuteButton = true,
  showPercentage = false,
  disabled = false,
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isSuspended, setIsSuspended] = useState(() => windowLifecycleService.isRenderingSuspended());
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Clamped effective volume
  const effectiveVolume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
  const volumePercent = Math.round(effectiveVolume * 100);

  // Subscribe to window lifecycle minimization/suspension
  useEffect(() => {
    setIsSuspended(windowLifecycleService.isRenderingSuspended());
    const unsub = windowLifecycleService.subscribeSuspension((suspended) => {
      setIsSuspended(suspended);
    });
    return unsub;
  }, []);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq) {
      setIsReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mq.addEventListener?.('change', handler);
      return () => mq.removeEventListener?.('change', handler);
    }
  }, []);

  // Convert clientX to normalized volume [0, 1]
  const calculateVolumeFromPointer = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return effectiveVolume;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const relativeX = clientX - rect.left;
      return Math.max(0, Math.min(1, relativeX / rect.width));
    },
    [effectiveVolume]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.button !== 0) return; // Only primary mouse button

    const newVol = calculateVolumeFromPointer(e.clientX);
    onVolumeChange(newVol);
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    const newVol = calculateVolumeFromPointer(e.clientX);
    onVolumeChange(newVol);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let handled = true;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        onVolumeChange(Math.min(1, effectiveVolume + 0.05));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        onVolumeChange(Math.max(0, effectiveVolume - 0.05));
        break;
      case 'PageUp':
        onVolumeChange(Math.min(1, effectiveVolume + 0.1));
        break;
      case 'PageDown':
        onVolumeChange(Math.max(0, effectiveVolume - 0.1));
        break;
      case 'Home':
        onVolumeChange(0);
        break;
      case 'End':
        onVolumeChange(1);
        break;
      case 'm':
      case 'M':
        onToggleMute?.();
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // SVG coordinate space
  const svgWidth = 160;
  const svgHeight = 28;
  const centerY = svgHeight / 2; // 14px

  // Knob dimensions: radius 5px (diameter 10px). Clamped between 6px and 154px.
  // Formula maps [0, 1] linearly to [6, svgWidth - 6] so the knob reaches the exact visual boundaries.
  const handleX = 6 + effectiveVolume * (svgWidth - 12);
  const activeClipWidth = isMuted || effectiveVolume === 0 ? 0 : handleX;

  // Seamless continuous sine wave path (wavelength = 60px, amplitude = 3.2px, centerY = 14px)
  // Repeating 6 cycles across 360px. When translated by -60px, loop is 100% seamless.
  const wavePathD = `M 0 14 C 8.3 10.8, 21.7 10.8, 30.0 14 C 38.3 17.2, 51.7 17.2, 60.0 14 C 68.3 10.8, 81.7 10.8, 90.0 14 C 98.3 17.2, 111.7 17.2, 120.0 14 C 128.3 10.8, 141.7 10.8, 150.0 14 C 158.3 17.2, 171.7 17.2, 180.0 14 C 188.3 10.8, 201.7 10.8, 210.0 14 C 218.3 17.2, 231.7 17.2, 240.0 14 C 248.3 10.8, 261.7 10.8, 270.0 14 C 278.3 17.2, 291.7 17.2, 300.0 14 C 308.3 10.8, 321.7 10.8, 330.0 14 C 338.3 17.2, 351.7 17.2, 360.0 14`;

  const shouldAnimate = !isSuspended && !isReducedMotion;

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {/* Speaker Icon with Mute Toggle */}
      {showMuteButton && (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute volume' : `Mute volume (${volumePercent}%)`}
          title={isMuted ? 'Unmute (M)' : `Volume: ${volumePercent}% • Click to mute (M)`}
          disabled={disabled}
          className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/[0.08] active:scale-95 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-dynamic)] shrink-0"
        >
          {isMuted || effectiveVolume === 0 ? (
            <VolumeX size={16} className="text-rose-400" />
          ) : effectiveVolume < 0.5 ? (
            <Volume1 size={16} className="text-[var(--accent-dynamic)]" />
          ) : (
            <Volume2 size={16} className="text-[var(--accent-dynamic)]" />
          )}
        </button>
      )}

      {/* Interactive Flowing Waveform Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Volume slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volumePercent}
        aria-valuetext={`${volumePercent}% volume${isMuted ? ' (muted)' : ''}`}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="relative cursor-pointer rounded-xl touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]/80 focus-visible:ring-offset-1 focus-visible:ring-offset-[#09090B] group flex items-center"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: `${height}px`,
        }}
        title={`Volume: ${volumePercent}% (Drag or click to adjust)`}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          <defs>
            {/* Gradient: Deep Purple to Vibrant Neon Lavender */}
            <linearGradient id={`neon-purple-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="40%" stopColor="#8B5CF6" />
              <stop offset="75%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>

            {/* Core Brilliance Highlight (Lavender-White Core) */}
            <linearGradient id={`neon-core-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>

            {/* Soft, Restrained Neon Glow Filter */}
            <filter id={`neon-glow-${uniqueId}`} x="-20%" y="-100%" width="140%" height="300%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.0" floodColor="#8B5CF6" floodOpacity="0.7" />
              <feDropShadow dx="0" dy="0" stdDeviation="4.0" floodColor="#7C3AED" floodOpacity="0.4" />
            </filter>

            {/* Circular Handle Glow Filter */}
            <filter id={`knob-glow-${uniqueId}`} x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="#FFFFFF" floodOpacity="0.85" />
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#A78BFA" floodOpacity="0.65" />
            </filter>

            {/* Active Region ClipPath (terminates cleanly right inside the handle) */}
            <clipPath id={`active-clip-${uniqueId}`}>
              <rect x="0" y="0" width={activeClipWidth} height={svgHeight} />
            </clipPath>
          </defs>

          {/* Inline CSS Animation Rules for Continuous Wave Motion */}
          <style>
            {`
              @keyframes volume-wave-flow-${uniqueId} {
                0% { transform: translateX(0); }
                100% { transform: translateX(-60px); }
              }
              .anim-wave-primary-${uniqueId} {
                animation: volume-wave-flow-${uniqueId} 4.0s linear infinite;
                animation-play-state: ${shouldAnimate ? 'running' : 'paused'};
              }
            `}
          </style>

          {/* 1. Subtle Baseline Track (Full Width) */}
          <line
            x1="0"
            y1={centerY}
            x2={svgWidth}
            y2={centerY}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* 2. Inactive Background Wave (Dimmed Full Track Wave) */}
          <g>
            <path
              d={wavePathD}
              fill="none"
              stroke="rgba(167, 139, 250, 0.18)"
              strokeWidth="1.6"
              strokeLinecap="round"
              className={`anim-wave-primary-${uniqueId}`}
            />
          </g>

          {/* 3. Active Energized Region (Clipped from 0 to volume handle) */}
          <g clipPath={`url(#active-clip-${uniqueId})`}>
            {/* Primary Neon Purple Glow Beam */}
            <path
              d={wavePathD}
              fill="none"
              stroke={isMuted ? '#EF4444' : `url(#neon-purple-${uniqueId})`}
              strokeWidth={isHovering || isDragging ? '3.0' : '2.6'}
              strokeLinecap="round"
              filter={isMuted ? 'none' : `url(#neon-glow-${uniqueId})`}
              className={`anim-wave-primary-${uniqueId}`}
            />
            {/* Core Brilliance Highlight (Lavender-White core) */}
            {!isMuted && (
              <path
                d={wavePathD}
                fill="none"
                stroke={`url(#neon-core-${uniqueId})`}
                strokeWidth="1.1"
                strokeLinecap="round"
                className={`anim-wave-primary-${uniqueId}`}
              />
            )}
          </g>

          {/* 4. Refined Circular White Volume Handle */}
          <g className="transition-transform duration-75">
            {/* Outer Ambient Glow Halo */}
            <circle
              cx={handleX}
              cy={centerY}
              r={isDragging ? 8.5 : isHovering ? 7.5 : 6.5}
              fill={isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(167, 139, 250, 0.30)'}
              className="transition-all duration-150"
            />
            {/* Solid White Knob with Lavender Rim */}
            <circle
              cx={handleX}
              cy={centerY}
              r={isDragging ? 5.5 : 5.0}
              fill={isMuted ? '#FCA5A5' : '#FFFFFF'}
              stroke={isMuted ? '#EF4444' : '#8B5CF6'}
              strokeWidth="1.5"
              filter={isMuted ? 'none' : `url(#knob-glow-${uniqueId})`}
              className="transition-all duration-100"
            />
            {/* Inner micro-pip for audiophile precision aesthetic */}
            <circle
              cx={handleX}
              cy={centerY}
              r={1.5}
              fill={isMuted ? '#DC2626' : '#7C3AED'}
            />
          </g>
        </svg>

        {/* Floating Percentage Tooltip on Drag or Hover */}
        {(isDragging || isHovering) && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[#14141B]/95 border border-white/15 text-[9px] font-mono-numbers font-bold text-[#F5F3FF] shadow-xl pointer-events-none z-30 transition-opacity"
            style={{
              left: `${Math.max(14, Math.min(trackRef.current ? trackRef.current.clientWidth - 14 : 126, effectiveVolume * (trackRef.current?.clientWidth || 140)))}px`,
            }}
          >
            {isMuted ? 'Muted' : `${volumePercent}%`}
          </div>
        )}
      </div>

      {/* Optional In-line Percentage Label */}
      {showPercentage && (
        <span className="text-[10px] font-mono-numbers text-[#A1A1AA] w-7 text-right shrink-0">
          {isMuted ? '0%' : `${volumePercent}%`}
        </span>
      )}
    </div>
  );
};
