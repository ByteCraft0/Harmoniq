import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface MobileVolumeSliderProps {
  className?: string;
  showPercentage?: boolean;
}

export const MobileVolumeSlider: React.FC<MobileVolumeSliderProps> = ({
  className = '',
  showPercentage = true,
}) => {
  const { volume, isMuted, setVolume, toggleMute } = usePlayer();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);

  // Sync local volume state when external volume changes and not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalVolume(volume);
    }
  }, [volume, isDragging]);

  // Trailing throttle for Capacitor bridge dispatch (40ms interval)
  const lastDispatchTimeRef = useRef<number>(0);
  const trailingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dispatchVolumeThrottled = useCallback(
    (newVol: number, immediate: boolean = false) => {
      const now = performance.now();
      const elapsed = now - lastDispatchTimeRef.current;

      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }

      if (immediate || elapsed >= 40) {
        lastDispatchTimeRef.current = now;
        setVolume(newVol);
      } else {
        // Trailing schedule for remaining ms
        const remaining = 40 - elapsed;
        trailingTimerRef.current = setTimeout(() => {
          lastDispatchTimeRef.current = performance.now();
          setVolume(newVol);
          trailingTimerRef.current = null;
        }, remaining);
      }
    },
    [setVolume]
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
      }
    };
  }, []);

  const calculateVolumeFromClientX = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const offsetX = clientX - rect.left;
    const ratio = offsetX / rect.width;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only main button / touch
    e.stopPropagation();

    const newVol = calculateVolumeFromClientX(e.clientX);
    setLocalVolume(newVol);
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback if setPointerCapture not supported
    }

    dispatchVolumeThrottled(newVol, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();

    const newVol = calculateVolumeFromClientX(e.clientX);
    setLocalVolume(newVol);
    dispatchVolumeThrottled(newVol, false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();

    const newVol = calculateVolumeFromClientX(e.clientX);
    setLocalVolume(newVol);
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture release error
    }

    // Always immediately dispatch the exact final volume on pointer up
    dispatchVolumeThrottled(newVol, true);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const effectiveDisplayVolume = isMuted ? 0 : localVolume;
  const percent = Math.round(effectiveDisplayVolume * 100);

  return (
    <div
      className={`flex items-center space-x-3 select-none touch-none ${className}`}
      role="group"
      aria-label="Volume controls"
    >
      {/* Tap-to-mute button */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute volume' : `Mute volume (current ${percent}%)`}
        title={isMuted ? 'Unmute' : 'Mute'}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-white active:scale-95 transition-all flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
      >
        {isMuted || effectiveDisplayVolume === 0 ? (
          <VolumeX className="w-4 h-4 text-red-400" />
        ) : effectiveDisplayVolume < 0.5 ? (
          <Volume1 className="w-4 h-4 text-zinc-300" />
        ) : (
          <Volume2 className="w-4 h-4 text-zinc-200" />
        )}
      </button>

      {/* Horizontal Volume Track with Drag Area */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Audio Volume"
        className="relative flex-1 py-3 cursor-pointer group"
      >
        {/* Track Background */}
        <div className="w-full h-1.5 rounded-full bg-[#1e1e28] border border-white/5 overflow-hidden">
          {/* Active Fill Bar */}
          <div
            className={`h-full rounded-full transition-all duration-75 ${
              isMuted
                ? 'bg-zinc-600 opacity-30'
                : 'bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.35)]'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Luminous Knob Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-violet-300/80 bg-white shadow-md shadow-violet-900/50 transition-transform pointer-events-none ${
            isDragging ? 'scale-125 ring-2 ring-violet-500/40' : 'group-hover:scale-110'
          } ${isMuted ? 'opacity-40 border-zinc-500 bg-zinc-400' : ''}`}
          style={{ left: `${percent}%` }}
        />
      </div>

      {/* Numerical readout / Muted badge */}
      {showPercentage && (
        <span
          className={`font-mono text-xs w-11 text-right tabular-nums flex-shrink-0 ${
            isMuted ? 'text-red-400 font-medium' : 'text-zinc-400'
          }`}
        >
          {isMuted ? 'Muted' : `${percent}%`}
        </span>
      )}
    </div>
  );
};
