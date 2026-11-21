import React, { useEffect, useState, useRef } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { windowLifecycleService } from '../../services/windowLifecycleService';

export interface MiniLiveVisualizerProps {
  isPlaying: boolean;
  isMuted?: boolean;
  barCount?: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * MiniLiveVisualizer
 * Renders small vertical audio-reactive frequency bars driven by actual FFT data from audioEngine.
 * - When playing: responds in real-time to genuine audio spectrum energy.
 * - When paused: cleanly freezes into static resting bars.
 * - When muted: dims into a distinct muted appearance.
 */
export const MiniLiveVisualizer: React.FC<MiniLiveVisualizerProps> = ({
  isPlaying,
  isMuted = false,
  barCount = 4,
  size = 'md',
  className = '',
}) => {
  const [levels, setLevels] = useState<number[]>(() => new Array(barCount).fill(0.15));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || isMuted || windowLifecycleService.isRenderingSuspended()) {
      // Resting static state
      setLevels(new Array(barCount).fill(0.18));
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!isPlaying || isMuted) return;
    }

    const freqArray = new Uint8Array(64);
    let lastRender = 0;

    const updateFrame = (now: number) => {
      if (windowLifecycleService.isRenderingSuspended()) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        return;
      }

      // Throttle visual level recalculation and React state update to ~30 FPS (~33ms)
      if (now - lastRender >= 33) {
        lastRender = now;
        audioEngine.getFrequencyData(freqArray);

        // Sample logarithmic bins corresponding to Bass, Low-Mid, High-Mid, Treble
        const sampleIndices =
          barCount === 4
            ? [2, 6, 14, 28]
            : barCount === 5
            ? [1, 4, 9, 18, 32]
            : [2, 5, 10, 18, 28, 40];

        const newLevels = sampleIndices.map((idx) => {
          const val = freqArray[idx] || 0;
          // Normalize 0..255 to 0.15..1.0
          return Math.max(0.15, Math.min(1.0, val / 255));
        });

        setLevels(newLevels);
      }

      rafRef.current = requestAnimationFrame(updateFrame);
    };

    const startRaf = () => {
      if (!rafRef.current && isPlaying && !isMuted && !windowLifecycleService.isRenderingSuspended()) {
        rafRef.current = requestAnimationFrame(updateFrame);
      }
    };

    startRaf();

    const unsubLifecycle = windowLifecycleService.subscribeSuspension((suspended) => {
      if (suspended) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        startRaf();
      }
    });

    return () => {
      unsubLifecycle();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, isMuted, barCount]);

  const maxHeight = size === 'sm' ? 12 : 16;
  const barWidth = size === 'sm' ? 2 : 2.5;
  const gap = size === 'sm' ? 1.5 : 2;

  return (
    <div
      className={`flex items-end select-none pointer-events-none ${className}`}
      style={{ height: maxHeight, gap }}
      title={isMuted ? 'Muted' : isPlaying ? 'Real-time Audio Reactive' : 'Paused'}
    >
      {levels.map((lvl, i) => {
        const h = Math.round(maxHeight * lvl);
        return (
          <span
            key={i}
            className={`rounded-full transition-all duration-75 origin-bottom ${
              isMuted
                ? 'bg-zinc-600/40'
                : isPlaying
                ? 'bg-gradient-to-t from-violet-600 via-purple-500 to-violet-300 shadow-[0_0_6px_rgba(167,139,250,0.4)]'
                : 'bg-violet-400/30'
            }`}
            style={{
              width: barWidth,
              height: Math.max(3, h),
            }}
          />
        );
      })}
    </div>
  );
};
