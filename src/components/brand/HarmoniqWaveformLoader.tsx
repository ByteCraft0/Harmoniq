import React from 'react';

interface HarmoniqWaveformLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const HarmoniqWaveformLoader: React.FC<HarmoniqWaveformLoaderProps> = ({
  label = 'Tuning Acoustic Buffers...',
  size = 'md',
  className = '',
}) => {
  const barHeights = [16, 28, 42, 60, 48, 32, 54, 68, 45, 30, 20];

  const heightMultiplier = size === 'sm' ? 0.5 : size === 'lg' ? 1.4 : 1.0;
  const barWidth = size === 'sm' ? 2.5 : size === 'lg' ? 5 : 3.5;
  const gap = size === 'sm' ? 2 : size === 'lg' ? 4 : 3;

  return (
    <div className={`flex flex-col items-center justify-center gap-3.5 select-none ${className}`}>
      {/* Waveform Equalizer Harmonic Dance */}
      <div className="flex items-center" style={{ gap }}>
        {barHeights.map((baseH, idx) => {
          const delay = (idx * 0.1).toFixed(2);
          const duration = (0.9 + (idx % 3) * 0.2).toFixed(2);
          return (
            <div
              key={idx}
              className="rounded-full bg-gradient-to-t from-[#6D28D9] via-[#8B5CF6] to-[#C4B5FD] shadow-glow-sm"
              style={{
                width: barWidth,
                height: baseH * heightMultiplier,
                animation: `harmoniqWavePulse ${duration}s ease-in-out ${delay}s infinite alternate`,
              }}
            />
          );
        })}
      </div>

      {/* Musical Loading Label */}
      {label && (
        <span className="text-[11px] font-mono-numbers tracking-widest text-[#A1A1AA] uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-dynamic)] animate-ping" />
          <span>{label}</span>
        </span>
      )}

      {/* Scoped CSS animation definition */}
      <style>{`
        @keyframes harmoniqWavePulse {
          0% {
            transform: scaleY(0.25);
            opacity: 0.45;
          }
          50% {
            transform: scaleY(1.0);
            opacity: 1;
          }
          100% {
            transform: scaleY(0.35);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
};
