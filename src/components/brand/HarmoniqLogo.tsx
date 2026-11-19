import React from 'react';

interface HarmoniqLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  animated?: boolean;
  className?: string;
}

export const HarmoniqLogo: React.FC<HarmoniqLogoProps> = ({
  size = 'md',
  showText = false,
  animated = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const dim = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Signature SVG Mark */}
      <div className={`relative ${animated ? 'animate-pulse' : ''}`} style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_2px_12px_rgba(124,58,237,0.45)]"
        >
          <defs>
            <linearGradient id="harmoniqGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C4B5FD" />
              <stop offset="40%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            <linearGradient id="harmoniqGradAccent" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
            <filter id="harmoniqGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Rounded Shield */}
          <rect
            x="4"
            y="4"
            width="56"
            height="56"
            rx="16"
            fill="#100E17"
            stroke="url(#harmoniqGradPrimary)"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Left Vertical Harmonic Pillar */}
          <rect x="16" y="16" width="6" height="32" rx="3" fill="url(#harmoniqGradPrimary)" />

          {/* Right Vertical Harmonic Pillar */}
          <rect x="42" y="16" width="6" height="32" rx="3" fill="url(#harmoniqGradPrimary)" />

          {/* Center Musical Waveform Crossbar (Sinusoidal Harmonic Bridge) */}
          <path
            d="M 19 32 Q 25 24, 32 32 T 45 32"
            fill="none"
            stroke="url(#harmoniqGradAccent)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Central Harmonic Resonance Node */}
          <circle cx="32" cy="32" r="3.5" fill="#FFFFFF" filter="url(#harmoniqGlow)" />

          {/* Acoustic Wave Resonance Echoes (Violin bridge / soundwave crests) */}
          <circle cx="32" cy="22" r="1.5" fill="#C4B5FD" opacity="0.8" />
          <circle cx="32" cy="42" r="1.5" fill="#C4B5FD" opacity="0.8" />
        </svg>
      </div>

      {/* Optional Refined Brand Typography */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold tracking-widest text-[#F5F3FF] text-sm uppercase">
            Harmoniq
          </span>
          <span className="text-[9px] font-mono-numbers text-[var(--accent-dynamic)] tracking-[0.22em] font-semibold uppercase mt-0.5 opacity-90">
            Reference Audio
          </span>
        </div>
      )}
    </div>
  );
};
