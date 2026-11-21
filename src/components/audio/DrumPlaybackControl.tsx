import React, { useState } from 'react';

interface DrumPlaybackControlProps {
  isPlaying: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const DrumPlaybackControl: React.FC<DrumPlaybackControlProps> = ({
  isPlaying,
  onClick,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause' : 'Play'}
      aria-pressed={isPlaying}
      className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 select-none cursor-pointer outline-none group focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95'
      }`}
    >
      {/* Ambient acoustic glow under the drum */}
      <div
        className={`absolute inset-0 rounded-full blur-md transition-opacity duration-300 pointer-events-none ${
          isPlaying
            ? 'bg-violet-600/35 opacity-100 scale-110'
            : isHovered
            ? 'bg-violet-600/20 opacity-80 scale-105'
            : 'bg-transparent opacity-0'
        }`}
      />

      {/* Embedded SVG Drum and Drumsticks */}
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full relative z-10 overflow-visible"
        style={{
          filter: isHovered
            ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.45)) drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
        }}
      >
        <defs>
          {/* Shell Cylindrical Gradient - Deep charcoal lacquer with violet sheen */}
          <linearGradient id="drum-shell-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#12121A" />
            <stop offset="20%" stopColor="#28223C" />
            <stop offset="45%" stopColor="#413563" />
            <stop offset="60%" stopColor="#2D2444" />
            <stop offset="85%" stopColor="#1A1726" />
            <stop offset="100%" stopColor="#0E0D14" />
          </linearGradient>

          {/* Chrome/Silver Rim Gradient */}
          <linearGradient id="drum-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4F4F5" />
            <stop offset="30%" stopColor="#A1A1AA" />
            <stop offset="70%" stopColor="#D4D4D8" />
            <stop offset="100%" stopColor="#52525B" />
          </linearGradient>

          {/* Drumhead Radial Gradient - Parchment white with subtle lavender depth */}
          <radialGradient id="drum-head-grad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#ECEAF4" />
            <stop offset="85%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#948EA5" />
          </radialGradient>

          {/* Drumstick Natural Hickory Wood Gradient */}
          <linearGradient id="stick-wood-left" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="50%" stopColor="#D4A373" />
            <stop offset="100%" stopColor="#8C5A2B" />
          </linearGradient>

          <linearGradient id="stick-wood-right" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="50%" stopColor="#D4A373" />
            <stop offset="100%" stopColor="#8C5A2B" />
          </linearGradient>

          {/* Chrome Lug Bracket Gradient */}
          <linearGradient id="drum-lug-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E4E4E7" />
            <stop offset="50%" stopColor="#FAFAFA" />
            <stop offset="100%" stopColor="#71717A" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes left-stick-stroke {
            0%, 100% {
              transform: rotate(0deg) translate(0px, 0px);
            }
            15% {
              transform: rotate(18deg) translate(2.5px, 4px);
            }
            30% {
              transform: rotate(-3deg) translate(-0.5px, -1px);
            }
            45% {
              transform: rotate(0deg) translate(0px, 0px);
            }
          }

          @keyframes right-stick-stroke {
            0%, 50%, 100% {
              transform: rotate(0deg) translate(0px, 0px);
            }
            65% {
              transform: rotate(-18deg) translate(-2.5px, 4px);
            }
            80% {
              transform: rotate(3deg) translate(0.5px, -1px);
            }
            95% {
              transform: rotate(0deg) translate(0px, 0px);
            }
          }

          @keyframes head-vibration {
            0%, 100% { transform: scale(1); }
            15%, 65% { transform: scale(0.985); }
            25%, 75% { transform: scale(1.01); }
          }

          @keyframes strike-ripple {
            0% { opacity: 0.8; transform: scale(0.6); }
            50% { opacity: 0.3; transform: scale(1.15); }
            100% { opacity: 0; transform: scale(1.4); }
          }

          .drumstick-left-anim {
            transform-origin: 12px 12px;
            animation: left-stick-stroke 0.88s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }

          .drumstick-right-anim {
            transform-origin: 52px 12px;
            animation: right-stick-stroke 0.88s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }

          .drumhead-anim {
            transform-origin: 32px 34px;
            animation: head-vibration 0.88s ease-in-out infinite;
          }

          .drum-ripple-left {
            transform-origin: 27px 33px;
            animation: strike-ripple 0.88s ease-out infinite;
          }

          .drum-ripple-right {
            transform-origin: 37px 33px;
            animation: strike-ripple 0.88s ease-out 0.44s infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .drumstick-left-anim,
            .drumstick-right-anim,
            .drumhead-anim,
            .drum-ripple-left,
            .drum-ripple-right {
              animation: none !important;
            }
          }
        `}</style>

        {/* --- 1. DRUM SHELL (BODY) --- */}
        {/* Cylindrical Shell Wall */}
        <path
          d="M 12 34 A 20 8 0 0 0 52 34 L 52 47 A 20 8 0 0 1 12 47 Z"
          fill="url(#drum-shell-grad)"
        />

        {/* Bottom Rim Hoop */}
        <path
          d="M 12 47 A 20 8 0 0 0 52 47"
          fill="none"
          stroke="url(#drum-rim-grad)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Shell Chrome Tension Lugs (5 lugs across front visible curve) */}
        {[
          { x: 17, topY: 36, botY: 48 },
          { x: 24, topY: 38.5, botY: 50 },
          { x: 32, topY: 39.5, botY: 50.5 },
          { x: 40, topY: 38.5, botY: 50 },
          { x: 47, topY: 36, botY: 48 },
        ].map((lug, i) => (
          <g key={`lug-${i}`}>
            {/* Vertical tension rod */}
            <line
              x1={lug.x}
              y1={lug.topY}
              x2={lug.x}
              y2={lug.botY}
              stroke="#A1A1AA"
              strokeWidth="0.8"
            />
            {/* Center lug casing casting */}
            <rect
              x={lug.x - 1.2}
              y={(lug.topY + lug.botY) / 2 - 2}
              width="2.4"
              height="4"
              rx="0.6"
              fill="url(#drum-lug-grad)"
              stroke="#52525B"
              strokeWidth="0.4"
            />
          </g>
        ))}

        {/* --- 2. DRUMHEAD & COUNTERHOOP (TOP) --- */}
        {/* Top Rim Outer Hoop Casting */}
        <ellipse
          cx="32"
          cy="34"
          rx="20.8"
          ry="8.3"
          fill="none"
          stroke="url(#drum-rim-grad)"
          strokeWidth="2.2"
        />

        {/* Top Rim Specular Light Streak */}
        <path
          d="M 16 32 A 20.8 8.3 0 0 1 48 32"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.9"
          strokeOpacity="0.85"
        />

        {/* Batter Drumhead Surface with reactive flex vibration */}
        <g className={isPlaying ? 'drumhead-anim' : ''}>
          <ellipse
            cx="32"
            cy="34"
            rx="19.2"
            ry="7.4"
            fill="url(#drum-head-grad)"
          />

          {/* Head Overtone Dampening Ring */}
          <ellipse
            cx="32"
            cy="34"
            rx="11.5"
            ry="4.4"
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="0.8"
            strokeOpacity={isPlaying ? 0.6 : 0.35}
            strokeDasharray="2.5 1.5"
          />

          {/* Acoustic strike contact ripples (active during playback) */}
          {isPlaying && (
            <>
              <ellipse
                cx="27"
                cy="33.5"
                rx="4.5"
                ry="1.8"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="0.75"
                className="drum-ripple-left"
              />
              <ellipse
                cx="37"
                cy="33.5"
                rx="4.5"
                ry="1.8"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="0.75"
                className="drum-ripple-right"
              />
            </>
          )}

          {/* Central Play / Pause Status Glyphs on Drumhead */}
          {isPlaying ? (
            /* Pause Indicator: Two clean vertical violet bars */
            <g transform="translate(32, 34)">
              <rect
                x="-3.2"
                y="-3.5"
                width="2.2"
                height="7"
                rx="0.6"
                fill="#7C3AED"
                filter="drop-shadow(0 0 2px rgba(139,92,246,0.6))"
              />
              <rect
                x="1"
                y="-3.5"
                width="2.2"
                height="7"
                rx="0.6"
                fill="#7C3AED"
                filter="drop-shadow(0 0 2px rgba(139,92,246,0.6))"
              />
            </g>
          ) : (
            /* Play Indicator: Crisp violet triangle pointing forward */
            <g transform="translate(32, 34)">
              <polygon
                points="-2.2,-3.8 4.2,0 -2.2,3.8"
                fill="#7C3AED"
                filter="drop-shadow(0 0 2px rgba(139,92,246,0.6))"
              />
            </g>
          )}
        </g>

        {/* --- 3. REALISTIC DRUMSTICKS --- */}
        {/* LEFT DRUMSTICK */}
        <g className={isPlaying ? 'drumstick-left-anim' : ''}>
          {/* Stick Shaft (Tapered Maple Wood) */}
          <path
            d="M 12 12 L 27 31 L 28 30.2 L 13 11.2 Z"
            fill="url(#stick-wood-left)"
            filter="drop-shadow(0 2px 2px rgba(0,0,0,0.5))"
          />
          {/* Stick Teardrop Wooden Tip */}
          <ellipse
            cx="27.8"
            cy="31.8"
            rx="1.9"
            ry="1.3"
            transform="rotate(48 27.8 31.8)"
            fill="#FEF3C7"
            stroke="#B45309"
            strokeWidth="0.4"
          />
          {/* Butt handle highlight */}
          <circle cx="12.5" cy="11.6" r="1.1" fill="#FEF3C7" />
        </g>

        {/* RIGHT DRUMSTICK */}
        <g className={isPlaying ? 'drumstick-right-anim' : ''}>
          {/* Stick Shaft (Tapered Maple Wood) */}
          <path
            d="M 52 12 L 37 31 L 36 30.2 L 51 11.2 Z"
            fill="url(#stick-wood-right)"
            filter="drop-shadow(0 2px 2px rgba(0,0,0,0.5))"
          />
          {/* Stick Teardrop Wooden Tip */}
          <ellipse
            cx="36.2"
            cy="31.8"
            rx="1.9"
            ry="1.3"
            transform="rotate(-48 36.2 31.8)"
            fill="#FEF3C7"
            stroke="#B45309"
            strokeWidth="0.4"
          />
          {/* Butt handle highlight */}
          <circle cx="51.5" cy="11.6" r="1.1" fill="#FEF3C7" />
        </g>
      </svg>
    </button>
  );
};
