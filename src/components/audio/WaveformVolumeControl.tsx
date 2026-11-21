import React from 'react';
import { AnimatedVolumeWave } from './AnimatedVolumeWave';

export interface WaveformVolumeControlProps {
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isPlaying?: boolean;
  onToggleMute: () => void;
  onVolumeChange?: (vol: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showSlider?: boolean;
  sliderWidth?: string;
  className?: string;
}

/**
 * Signature Waveform Volume Control for Harmoniq 2.0.1
 * Audiophile-Grade Volume Experience:
 * - When `showSlider` is active, seamlessly renders the continuous flowing SVG waveform volume control
 *   with integrated speaker icon and mute/unmute toggle.
 * - When compact (`showSlider: false`), renders the sculpted 5-bar audiophile waveform button.
 * - Synchronized with audioEngine, windowLifecycleService, and keyboard navigation.
 */
export const WaveformVolumeControl: React.FC<WaveformVolumeControlProps> = ({
  volume,
  isMuted,
  isPlaying = false,
  onToggleMute,
  onVolumeChange,
  size = 'md',
  showSlider = false,
  sliderWidth = 'w-[100px]',
  className = '',
}) => {
  // If slider mode is requested and onVolumeChange is provided, delegate directly to the signature AnimatedVolumeWave
  if (showSlider && onVolumeChange) {
    const waveWidth = sliderWidth.includes('w-[')
      ? parseInt(sliderWidth.replace('w-[', '').replace('px]', ''), 10) || 120
      : sliderWidth === 'w-16'
      ? 80
      : sliderWidth === 'w-24'
      ? 96
      : 120;

    return (
      <AnimatedVolumeWave
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
        width={waveWidth}
        height={size === 'sm' ? 24 : size === 'lg' ? 30 : 28}
        showMuteButton={true}
        className={className}
      />
    );
  }

  // 5 sculpted audio curve heights for the compact button (used when showSlider is false)
  const baseHeights = size === 'sm' ? [6, 11, 16, 12, 7] : size === 'lg' ? [12, 20, 28, 22, 13] : [8, 15, 22, 17, 9];
  const barWidth = size === 'sm' ? 2.5 : size === 'lg' ? 4 : 3;
  const gap = size === 'sm' ? 2 : size === 'lg' ? 3.5 : 2.5;
  const containerHeight = size === 'sm' ? 18 : size === 'lg' ? 30 : 24;

  const effectiveVolume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
  const volumePercent = Math.round(effectiveVolume * 100);

  return (
    <button
      type="button"
      onClick={onToggleMute}
      aria-label={isMuted ? 'Unmute volume' : `Mute volume (current ${volumePercent}%)`}
      title={
        isMuted
          ? 'Unmute (M)'
          : `Volume: ${volumePercent}% • Click to Mute (M)`
      }
      className={`group relative p-1.5 rounded-lg hover:bg-white/[0.06] active:scale-95 transition-all duration-150 flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/40 shrink-0 select-none ${className}`}
    >
      {/* Subtle Ambient Hover Glow */}
      <div className="absolute inset-0 rounded-lg bg-[var(--accent-primary)]/0 group-hover:bg-[var(--accent-primary)]/10 blur-sm transition-all duration-200 pointer-events-none" />

      {/* 5-Bar Audiophile Waveform Visual Element */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: containerHeight, gap }}
      >
        {baseHeights.map((baseH, idx) => {
          const threshold = idx / 5;
          const barFraction = Math.max(0, Math.min(1, (effectiveVolume - threshold) * 5));
          const isActive = !isMuted && effectiveVolume > threshold;

          const activeHeight = isMuted || effectiveVolume === 0 ? 3 : Math.max(3, Math.round(baseH * (0.35 + 0.65 * barFraction)));
          const animDuration = (0.75 + (idx % 3) * 0.25).toFixed(2);
          const animDelay = (idx * 0.12).toFixed(2);

          return (
            <span
              key={idx}
              className={`rounded-full transition-all duration-200 origin-bottom ${
                isActive
                  ? 'bg-gradient-to-t from-[#6D28D9] via-[#8B5CF6] to-[#C4B5FD] shadow-[0_0_8px_rgba(167,139,250,0.5)]'
                  : 'bg-[#3F3F4E]/40'
              }`}
              style={{
                width: barWidth,
                height: activeHeight,
                animation:
                  isPlaying && isActive
                    ? `waveform-bar-pulse ${animDuration}s ease-in-out ${animDelay}s infinite alternate`
                    : 'none',
              }}
            />
          );
        })}

        {/* Mute Diagonal Slash Indicator when muted */}
        {(isMuted || volume === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[120%] h-[1.5px] bg-[#EF4444]/90 rounded-full rotate-[-35deg] shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
          </div>
        )}
      </div>
    </button>
  );
};
