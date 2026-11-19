import React, { useState } from 'react';
import { PulseOrbState } from '../../types/assistant';

interface HarmoniqPulseOrbProps {
  state: PulseOrbState;
  onClick: () => void;
  reducedMotion?: boolean;
  className?: string;
  docked?: boolean;
}

export const HarmoniqPulseOrb: React.FC<HarmoniqPulseOrbProps> = ({
  state,
  onClick,
  reducedMotion = false,
  className = '',
  docked = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const activeState: PulseOrbState = isHovered && state === 'idle' ? 'hover' : state;

  // Determine glow, animation and ring classes based on state
  const isListening = activeState === 'listening';
  const isProcessing = activeState === 'processing';
  const isResponding = activeState === 'responding';
  const isError = activeState === 'error';

  const defaultDimension = docked ? 'w-8 h-8' : 'w-14 h-14';
  const label = docked ? 'Minimize Harmoniq Assistant' : 'Ask Harmoniq (AI Assistant)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={label}
      aria-label={label}
      aria-expanded={docked}
      className={`group relative flex items-center justify-center ${defaultDimension} cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0813] transition-all duration-300 ${
        isHovered ? (docked ? 'scale-105' : 'scale-110') : 'scale-100'
      } ${className}`}
    >
      {/* Ambient Volumetric Backdrop Glow */}
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 pointer-events-none ${
          isError
            ? 'bg-rose-500/40'
            : isListening
            ? 'bg-cyan-400/50 scale-125 animate-pulse'
            : isProcessing
            ? 'bg-violet-500/60 scale-115'
            : isResponding
            ? 'bg-fuchsia-400/50 scale-120 animate-pulse'
            : isHovered
            ? 'bg-violet-500/50 scale-125'
            : 'bg-violet-600/30'
        }`}
      />

      {/* SVG Multi-Layer Frequency Rings & Holographic Orb */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full relative z-10 filter drop-shadow-[0_0_12px_rgba(139,92,246,0.6)] ${
          !reducedMotion && isProcessing ? 'animate-spin' : ''
        }`}
        style={{
          animationDuration: isProcessing ? '4s' : '0s'
        }}
      >
        <defs>
          {/* Radial Gradient for Inner Luminous Core */}
          <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#d8b4fe" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.95" />
          </radialGradient>

          {/* Holographic Ring Gradient */}
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Listening Cyan Wave Gradient */}
          <linearGradient id="listenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Outer Audio Frequency Ring 1 (Dashed) */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={isListening ? 'url(#listenGrad)' : 'url(#ringGrad)'}
          strokeWidth="1.5"
          strokeDasharray={isListening ? '4 2' : '6 4 2 4'}
          strokeOpacity={isHovered || isListening || isProcessing ? 0.9 : 0.45}
          className={!reducedMotion ? (isListening ? 'animate-ping' : '') : ''}
          style={{ transformOrigin: 'center' }}
        />

        {/* Middle Frequency Orbit Ring 2 */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={isError ? '#f43f5e' : '#a78bfa'}
          strokeWidth="1.2"
          strokeDasharray="8 6"
          strokeOpacity={isHovered ? 0.8 : 0.5}
          className={
            !reducedMotion && !isProcessing
              ? 'transition-transform duration-700 ease-out'
              : ''
          }
        />

        {/* Inner Resonant Soundwave Ring */}
        <circle
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke="#e9d5ff"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity={isListening || isResponding ? 0.85 : 0.4}
        />

        {/* Outer Orbit Particle Nodes */}
        <circle cx="50" cy="5" r="2" fill="#c084fc" opacity={isHovered ? 1 : 0.6} />
        <circle cx="95" cy="50" r="1.8" fill="#38bdf8" opacity={isHovered ? 1 : 0.6} />
        <circle cx="50" cy="95" r="2" fill="#c084fc" opacity={isHovered ? 1 : 0.6} />
        <circle cx="5" cy="50" r="1.8" fill="#818cf8" opacity={isHovered ? 1 : 0.6} />

        {/* Spherical Glass Shell */}
        <circle
          cx="50"
          cy="50"
          r="24"
          fill="#0f0c1b"
          fillOpacity="0.85"
          stroke="#c084fc"
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />

        {/* Core Luminous Energy Sphere */}
        <circle
          cx="50"
          cy="50"
          r={isListening ? 19 : isResponding ? 18 : isHovered ? 17 : 15}
          fill="url(#coreGradient)"
          className={`transition-all duration-300 ${
            !reducedMotion && (isListening || isResponding)
              ? 'animate-pulse'
              : ''
          }`}
        />

        {/* Miniature Audio Waveform Core Icon */}
        <g stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.95">
          <line x1="42" y1="46" x2="42" y2="54" />
          <line x1="46" y1="42" x2="46" y2="58" />
          <line x1="50" y1="39" x2="50" y2="61" />
          <line x1="54" y1="43" x2="54" y2="57" />
          <line x1="58" y1="47" x2="58" y2="53" />
        </g>
      </svg>

      {/* Floating State Badge Pill for Speech / Processing */}
      {isListening && (
        <span className="absolute -top-2 -right-1 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 bg-cyan-950/90 border border-cyan-400/40 rounded-full shadow-lg animate-pulse z-20">
          REC
        </span>
      )}
      {isProcessing && (
        <span className="absolute -top-2 -right-1 px-1.5 py-0.5 text-[9px] font-bold text-violet-200 bg-violet-950/90 border border-violet-400/40 rounded-full shadow-lg z-20">
          AI
        </span>
      )}
      {isError && (
        <span className="absolute -top-2 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white z-20 shadow-lg" />
      )}
    </div>
  );
};
