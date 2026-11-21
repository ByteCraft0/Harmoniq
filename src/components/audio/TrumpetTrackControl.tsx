import React, { useState } from 'react';

interface TrumpetTrackControlProps {
  direction: 'previous' | 'next';
  onClick: () => void;
  disabled?: boolean;
}

export const TrumpetTrackControl: React.FC<TrumpetTrackControlProps> = ({
  direction,
  onClick,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [pulseKey, setPulseKey] = useState<number>(0);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    setPulseKey((prev) => prev + 1);
    onClick();
  };

  const isPrevious = direction === 'previous';
  const label = isPrevious ? 'Previous Track' : 'Next Track';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={label}
      title={label}
      className={`relative w-10 h-8 flex items-center justify-center rounded-xl p-1 transition-all duration-150 select-none cursor-pointer outline-none group focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#09090B] ${
        disabled
          ? 'opacity-35 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95 text-[#A1A1AA] hover:text-[#F5F3FF]'
      }`}
    >
      <svg
        viewBox="0 0 46 28"
        className={`w-full h-full relative z-10 transition-transform duration-200 overflow-visible ${
          isPrevious ? 'scale-x-[-1]' : ''
        }`}
        style={{
          filter: isHovered && !disabled
            ? 'drop-shadow(0 0 5px rgba(167, 139, 250, 0.4)) drop-shadow(0 1px 3px rgba(0,0,0,0.8)) brightness(1.12)'
            : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
        }}
      >
        <defs>
          {/* Dark Brushed Champagne Brass Metallic Gradient with Restrained Violet Reflection */}
          <linearGradient id={`trumpet-brass-${direction}`} x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#C8B8A6" />
            <stop offset="22%" stopColor="#9C8B7A" />
            <stop offset="45%" stopColor="#6E5E4E" />
            <stop offset="68%" stopColor="#7E7088" />
            <stop offset="86%" stopColor="#43372E" />
            <stop offset="100%" stopColor="#1E1917" />
          </linearGradient>

          {/* Trumpet Bell Flare - Muted Antique Gold into Deep Charcoal Shadow */}
          <radialGradient id={`trumpet-bell-${direction}`} cx="72%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#D8C9B6" />
            <stop offset="30%" stopColor="#A89785" />
            <stop offset="60%" stopColor="#6A5B4D" />
            <stop offset="82%" stopColor="#40342C" />
            <stop offset="100%" stopColor="#1C1715" />
          </radialGradient>

          {/* Valve Casing Brushed Nickel / Champagne Silver with Subtle Violet Sheen */}
          <linearGradient id={`trumpet-valve-${direction}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4CCC3" />
            <stop offset="38%" stopColor="#A4988E" />
            <stop offset="72%" stopColor="#82778D" />
            <stop offset="100%" stopColor="#463E38" />
          </linearGradient>

          {/* Inner Bell Deep Resonance - Charcoal-Black with Dark Violet-Charcoal Tone */}
          <radialGradient id={`trumpet-bell-interior-${direction}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0E0D12" />
            <stop offset="65%" stopColor="#17151D" />
            <stop offset="100%" stopColor="#2A2433" />
          </radialGradient>

          {/* Very Restrained Violet Specular Shimmer */}
          <linearGradient id={`trumpet-violet-shimmer-${direction}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(196, 181, 253, 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes mechanical-recoil {
            0% { transform: translateX(0); }
            35% { transform: translateX(-1.2px); }
            100% { transform: translateX(0); }
          }

          @keyframes valve-press {
            0% { transform: translateY(0); }
            40% { transform: translateY(1.2px); }
            100% { transform: translateY(0); }
          }

          @keyframes subtle-acoustic-pulse {
            0% {
              opacity: 0.8;
              transform: translateX(0px) scale(0.88);
            }
            100% {
              opacity: 0;
              transform: translateX(4px) scale(1.28);
            }
          }

          .trumpet-recoil-anim {
            animation: mechanical-recoil 0.22s cubic-bezier(0.2, 0.8, 0.4, 1);
          }

          .trumpet-valve-anim {
            animation: valve-press 0.22s cubic-bezier(0.2, 0.8, 0.4, 1);
          }

          .acoustic-wave-1 {
            transform-origin: 39px 14px;
            animation: subtle-acoustic-pulse 0.32s ease-out forwards;
          }

          .acoustic-wave-2 {
            transform-origin: 41px 14px;
            animation: subtle-acoustic-pulse 0.38s ease-out 0.05s forwards;
          }

          @media (prefers-reduced-motion: reduce) {
            .trumpet-recoil-anim,
            .trumpet-valve-anim,
            .acoustic-wave-1,
            .acoustic-wave-2 {
              animation: none !important;
              display: none;
            }
          }
        `}</style>

        {/* Master Instrument Group with Restrained Mechanical Recoil on Click */}
        <g
          key={pulseKey > 0 ? `trumpet-pulse-${pulseKey}` : 'trumpet-idle'}
          className={pulseKey > 0 ? 'trumpet-recoil-anim' : ''}
        >
          {/* --- 1. MOUTHPIECE & LEADPIPE (Left) --- */}
          {/* Mouthpiece Cup & Rim - Muted Champagne Nickel */}
          <ellipse
            cx="4.5"
            cy="14"
            rx="1"
            ry="2.4"
            fill="#C8C0B7"
            stroke="#4A423B"
            strokeWidth="0.4"
          />
          {/* Mouthpiece Shank */}
          <polygon
            points="4.5,13.2 7.5,13.4 7.5,14.6 4.5,14.8"
            fill="#A49C93"
          />
          {/* Receiver Collar Ring */}
          <rect
            x="7.2"
            y="12.9"
            width="1.3"
            height="2.2"
            rx="0.4"
            fill={`url(#trumpet-valve-${direction})`}
          />

          {/* --- 2. LEADPIPE & TUNING SLIDE --- */}
          {/* Lower Leadpipe Tube */}
          <rect
            x="8.5"
            y="13.2"
            width="10.5"
            height="1.6"
            rx="0.4"
            fill={`url(#trumpet-brass-${direction})`}
          />

          {/* Tuning Slide Return Bow (U-bend on the left) */}
          <path
            d="M 12 13.2 L 10.5 13.2 A 1.8 1.8 0 0 1 10.5 9.6 L 12 9.6"
            fill="none"
            stroke={`url(#trumpet-brass-${direction})`}
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Upper Return Tube running from tuning slide into valve block */}
          <rect
            x="12"
            y="8.8"
            width="7"
            height="1.6"
            rx="0.4"
            fill={`url(#trumpet-brass-${direction})`}
          />

          {/* Tuning Slide Structural Braces */}
          <line x1="13.5" y1="10.4" x2="13.5" y2="13.2" stroke="#483B30" strokeWidth="0.7" />
          <line x1="16.5" y1="10.4" x2="16.5" y2="13.2" stroke="#483B30" strokeWidth="0.7" />

          {/* --- 3. PISTON VALVE CASINGS (3 Vertical Valves) --- */}
          {[
            { x: 19 },
            { x: 22.4, isActiveValve: true },
            { x: 25.8 },
          ].map((valve, i) => (
            <g
              key={`valve-${i}`}
              className={pulseKey > 0 && valve.isActiveValve ? 'trumpet-valve-anim' : ''}
            >
              {/* Vertical Valve Casing */}
              <rect
                x={valve.x}
                y="8"
                width="2.6"
                height="12.5"
                rx="0.5"
                fill={`url(#trumpet-brass-${direction})`}
                stroke="#2B231D"
                strokeWidth="0.3"
              />
              {/* Top Valve Cap Collar */}
              <rect
                x={valve.x - 0.3}
                y="7.2"
                width="3.2"
                height="1"
                rx="0.3"
                fill={`url(#trumpet-valve-${direction})`}
              />
              {/* Piston Stem */}
              <line
                x1={valve.x + 1.3}
                y1="5.6"
                x2={valve.x + 1.3}
                y2="7.2"
                stroke="#B8B0A6"
                strokeWidth="0.8"
              />
              {/* Pearl Finger Button on top - Iridescent with Soft Violet Undertone */}
              <ellipse
                cx={valve.x + 1.3}
                cy="5.2"
                rx="1.3"
                ry="0.7"
                fill="#EDE8F2"
                stroke="#756B80"
                strokeWidth="0.3"
              />
              {/* Bottom Valve Cap */}
              <rect
                x={valve.x - 0.2}
                y="20.5"
                width="3"
                height="1"
                rx="0.3"
                fill={`url(#trumpet-valve-${direction})`}
              />
            </g>
          ))}

          {/* Valve Slide Tubing Loops (1st & 3rd slides) */}
          {/* 1st slide loop below valve 1 */}
          <path
            d="M 19.5 15.5 Q 18.5 18 20.5 18.5 L 21 16"
            fill="none"
            stroke={`url(#trumpet-brass-${direction})`}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          {/* 3rd slide loop below valve 3 */}
          <path
            d="M 26.5 15.5 Q 29 18.5 27 19 L 25.5 16"
            fill="none"
            stroke={`url(#trumpet-brass-${direction})`}
            strokeWidth="1.1"
            strokeLinecap="round"
          />

          {/* --- 4. BELL TUBE & CONICAL BELL FLARE --- */}
          {/* Upper Bell Tube emerging from valve block to the bell throat */}
          <rect
            x="28.4"
            y="8.8"
            width="4.2"
            height="1.6"
            rx="0.3"
            fill={`url(#trumpet-brass-${direction})`}
          />

          {/* Bell Flare - Graceful expansion into horn bell in Dark Brushed Champagne */}
          <path
            d="M 32 9.2 C 34.5 9 36.8 6.2 38.5 5.5 L 38.5 22.5 C 36.8 21.8 34.5 19 32 18.8 Z"
            fill={`url(#trumpet-bell-${direction})`}
            stroke="#382E25"
            strokeWidth="0.3"
          />

          {/* Inner Bell Opening Depth - Charcoal Black Interior */}
          <ellipse
            cx="38.5"
            cy="14"
            rx="1.3"
            ry="8.4"
            fill={`url(#trumpet-bell-interior-${direction})`}
          />

          {/* Bell Outer Rim Wire - Muted Antique Gold */}
          <ellipse
            cx="38.5"
            cy="14"
            rx="1.5"
            ry="8.5"
            fill="none"
            stroke="#D8C8B6"
            strokeWidth="0.8"
          />

          {/* Specular Highlight Streak on upper curvature of the bell */}
          <path
            d="M 29 9 C 33 8.8 36 6.8 38.2 6.2"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="0.7"
            strokeOpacity="0.65"
            strokeLinecap="round"
          />

          {/* Subtle Violet Reflection Sheen along the upper bell curve */}
          <path
            d="M 30.5 9.4 C 33.5 9.2 35.5 7.5 37.5 7"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="0.6"
            strokeOpacity={isHovered ? 0.7 : 0.35}
            strokeLinecap="round"
          />

          {/* --- 5. INTERACTIVE SOUND-WAVE ARCS (On Click Feedback) --- */}
          {pulseKey > 0 && (
            <g key={pulseKey} className="pointer-events-none">
              {/* Near acoustic arc - Soft lavender violet */}
              <path
                d="M 40.5 10 A 5 5 0 0 1 40.5 18"
                fill="none"
                stroke="#C4B5FD"
                strokeWidth="0.85"
                strokeLinecap="round"
                className="acoustic-wave-1"
              />
              {/* Outer acoustic arc - Muted champagne sheen */}
              <path
                d="M 42.5 8 A 7.5 7.5 0 0 1 42.5 20"
                fill="none"
                stroke="#D8CCBC"
                strokeWidth="0.7"
                strokeLinecap="round"
                className="acoustic-wave-2"
              />
            </g>
          )}
        </g>
      </svg>
    </button>
  );
};
