import React, { useEffect, useRef, useState } from 'react';
import { PulseOrbState } from '../../types/assistant';
import { orbAudioReactiveService } from '../../services/assistant/orbAudioReactiveService';
import { colorExtractionService, ExtractedColors } from '../../services/colorExtractionService';

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
  docked = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [accentColors, setAccentColors] = useState<ExtractedColors | null>(null);

  // Direct element references for 60fps zero-rerender rendering loop
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coreCircleRef = useRef<SVGCircleElement>(null);
  const ring1Ref = useRef<SVGCircleElement>(null);
  const ring2Ref = useRef<SVGCircleElement>(null);
  const ring3Ref = useRef<SVGCircleElement>(null);
  const nodesGroupRef = useRef<SVGGElement>(null);
  const nodeTopRef = useRef<SVGCircleElement>(null);
  const nodeRightRef = useRef<SVGCircleElement>(null);
  const nodeBottomRef = useRef<SVGCircleElement>(null);
  const nodeLeftRef = useRef<SVGCircleElement>(null);
  const waveLinesRef = useRef<SVGGElement>(null);

  // References for animation loop state
  const rafIdRef = useRef<number>(0);
  const angleRef = useRef<number>(0);
  const dashOffsetRef = useRef<number>(0);
  const stateRef = useRef<PulseOrbState>(state);
  const isHoveredRef = useRef<boolean>(isHovered);
  const reducedMotionRef = useRef<boolean>(reducedMotion);

  // Sync state refs to avoid restarting the animation loop
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  // Subscribe to album artwork colors for secondary ambient accent blending
  useEffect(() => {
    const unsub = colorExtractionService.subscribe((colors) => {
      setAccentColors(colors);
    });
    return unsub;
  }, []);

  // Single Animation Frame Loop for Audio Reactivity & Ambient Motion
  useEffect(() => {
    let isMounted = true;
    let lastTime = performance.now();

    const renderLoop = (currentTime: number) => {
      if (!isMounted) return;

      const delta = Math.min(50, currentTime - lastTime); // clamp delta to prevent jumps
      lastTime = currentTime;

      const curState = stateRef.current;
      const hovered = isHoveredRef.current;
      const lowMotion =
        reducedMotionRef.current ||
        (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

      // Sample current audio metrics from orbAudioReactiveService
      const metrics = orbAudioReactiveService.processFrame();

      // State Precedence: Interaction states take visual priority over music reactivity
      const isError = curState === 'error';
      const isListening = curState === 'listening';
      const isProcessing = curState === 'processing';
      const isResponding = curState === 'responding';
      const isInteraction = isError || isListening || isProcessing || isResponding;

      // Music reactive is active when in idle/hover and music is actually playing
      const isMusicActive = !isInteraction && metrics.isPlaying && metrics.intensity > 0.01;

      // 1. Volumetric Backdrop Glow Modulation
      if (glowRef.current) {
        if (lowMotion) {
          // Low motion: subtle opacity only, no scaling
          glowRef.current.style.transform = 'scale(1)';
          glowRef.current.style.opacity = isMusicActive
            ? `${0.35 + metrics.intensity * 0.25}`
            : '0.35';
        } else if (isMusicActive) {
          // Bass expands glow subtly (1.0 to 1.18); intensity modulates opacity (0.35 to 0.75)
          const glowScale = 1.0 + metrics.bass * 0.18 + (hovered ? 0.08 : 0);
          const glowOpacity = 0.35 + metrics.intensity * 0.40;
          glowRef.current.style.transform = `scale(${glowScale.toFixed(3)})`;
          glowRef.current.style.opacity = glowOpacity.toFixed(3);
        } else if (!isInteraction) {
          // Calm ambient breathing: 0.2 Hz slow sine wave
          const breathe = Math.sin(currentTime * 0.0018);
          const glowScale = 1.0 + breathe * 0.04 + (hovered ? 0.10 : 0);
          const glowOpacity = 0.28 + breathe * 0.08;
          glowRef.current.style.transform = `scale(${glowScale.toFixed(3)})`;
          glowRef.current.style.opacity = glowOpacity.toFixed(3);
        } else {
          // Reset inline styles for CSS-managed interaction states (listening, processing, error)
          glowRef.current.style.transform = '';
          glowRef.current.style.opacity = '';
        }
      }

      // 2. SVG Multi-Layer Audio-Reactive Elements
      if (!isInteraction && svgRef.current) {
        // A. Core Energy Sphere: Bass expands core (radius 15 to 18.5)
        if (coreCircleRef.current) {
          if (lowMotion) {
            coreCircleRef.current.setAttribute('r', '15');
          } else if (isMusicActive) {
            const coreR = 15 + metrics.bass * 3.5 + (hovered ? 1.5 : 0);
            coreCircleRef.current.setAttribute('r', coreR.toFixed(2));
          } else {
            const breatheR = 15 + Math.sin(currentTime * 0.0018) * 0.6 + (hovered ? 2 : 0);
            coreCircleRef.current.setAttribute('r', breatheR.toFixed(2));
          }
        }

        // B. Outer Resonance Ring 1: Bass expands radius (45 to 47.5); Midrange shifts dash offset
        if (ring1Ref.current) {
          if (!lowMotion) {
            const ring1R = 45 + (isMusicActive ? metrics.bass * 2.5 : 0);
            ring1Ref.current.setAttribute('r', ring1R.toFixed(2));

            // Advance dash offset smoothly
            dashOffsetRef.current += isMusicActive
              ? (0.8 + metrics.mid * 2.5) * (delta / 16.6)
              : 0.3 * (delta / 16.6);
            ring1Ref.current.style.strokeDashoffset = `${dashOffsetRef.current.toFixed(1)}`;
            ring1Ref.current.style.strokeOpacity = isMusicActive
              ? `${0.45 + metrics.intensity * 0.45}`
              : hovered
              ? '0.85'
              : '0.45';
          }
        }

        // C. Middle Frequency Ring 2: Rotates gently based on midrange energy
        if (ring2Ref.current && !lowMotion) {
          const rotSpeed = isMusicActive ? 0.4 + metrics.mid * 1.8 : 0.15;
          angleRef.current = (angleRef.current + rotSpeed * (delta / 16.6)) % 360;
          ring2Ref.current.style.transform = `rotate(${angleRef.current.toFixed(1)}deg)`;
          ring2Ref.current.style.transformOrigin = '50px 50px';
          ring2Ref.current.style.strokeOpacity = isMusicActive
            ? `${0.5 + metrics.mid * 0.4}`
            : hovered
            ? '0.8'
            : '0.5';
        }

        // D. Inner Resonant Soundwave Ring 3: Vibrates with intensity
        if (ring3Ref.current) {
          const ring3Opacity = isMusicActive
            ? 0.4 + metrics.intensity * 0.45
            : hovered
            ? '0.7'
            : '0.4';
          ring3Ref.current.style.strokeOpacity = `${ring3Opacity}`;
        }

        // E. Treble Shimmer & Orbit Particle Nodes: Shimmer and expand with treble
        if (!lowMotion) {
          const nodeRadius = isMusicActive ? 1.8 + metrics.treble * 1.4 : 1.8;
          const nodeOpacity = isMusicActive
            ? 0.5 + metrics.treble * 0.5
            : hovered
            ? 1.0
            : 0.6;

          const rStr = nodeRadius.toFixed(2);
          const opStr = nodeOpacity.toFixed(2);

          if (nodeTopRef.current) {
            nodeTopRef.current.setAttribute('r', rStr);
            nodeTopRef.current.style.opacity = opStr;
          }
          if (nodeRightRef.current) {
            nodeRightRef.current.setAttribute('r', rStr);
            nodeRightRef.current.style.opacity = opStr;
          }
          if (nodeBottomRef.current) {
            nodeBottomRef.current.setAttribute('r', rStr);
            nodeBottomRef.current.style.opacity = opStr;
          }
          if (nodeLeftRef.current) {
            nodeLeftRef.current.setAttribute('r', rStr);
            nodeLeftRef.current.style.opacity = opStr;
          }
        }

        // F. Central Waveform Indicator: Subtle dynamic wave height
        if (waveLinesRef.current && !lowMotion) {
          const waveScaleY = isMusicActive ? 1.0 + metrics.intensity * 0.35 : 1.0;
          waveLinesRef.current.style.transform = `scaleY(${waveScaleY.toFixed(2)})`;
          waveLinesRef.current.style.transformOrigin = '50px 50px';
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    // Start single animation loop
    rafIdRef.current = requestAnimationFrame(renderLoop);

    // Window visibility listener: Pause animation frame loop when tab or window is hidden to save battery/CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
      } else {
        if (!rafIdRef.current && isMounted) {
          lastTime = performance.now();
          rafIdRef.current = requestAnimationFrame(renderLoop);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, []);

  const activeState: PulseOrbState = isHovered && state === 'idle' ? 'hover' : state;
  const isListening = activeState === 'listening';
  const isProcessing = activeState === 'processing';
  const isResponding = activeState === 'responding';
  const isError = activeState === 'error';

  const defaultDimension = docked ? 'w-8 h-8' : 'w-14 h-14';
  const label = docked ? 'Minimize Harmoniq Assistant' : 'Ask Harmoniq (AI Assistant)';

  // Secondary accent color extracted from album artwork (fallback to lavender)
  const secondaryAccent = accentColors?.secondary || '#8b5cf6';
  const primaryAccent = accentColors?.primary || '#c084fc';

  return (
    <div
      ref={containerRef}
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
      {/* Ambient Volumetric Backdrop Glow (Smoothly driven by Bass & Overall Intensity) */}
      <div
        ref={glowRef}
        className={`absolute inset-0 rounded-full blur-xl transition-colors duration-500 pointer-events-none will-change-transform ${
          isError
            ? 'bg-rose-500/40'
            : isListening
            ? 'bg-cyan-400/50'
            : isProcessing
            ? 'bg-violet-500/60'
            : isResponding
            ? 'bg-fuchsia-400/50'
            : isHovered
            ? 'bg-violet-500/50'
            : 'bg-violet-600/35'
        }`}
      />

      {/* SVG Multi-Layer Audio-Reactive Orb */}
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={`w-full h-full relative z-10 filter drop-shadow-[0_0_12px_rgba(139,92,246,0.6)] ${
          !reducedMotion && isProcessing ? 'animate-spin' : ''
        }`}
        style={{
          animationDuration: isProcessing ? '4s' : '0s',
        }}
      >
        <defs>
          {/* Radial Gradient for Inner Luminous Core (blends album art secondary accent) */}
          <radialGradient id="pulseCoreGrad" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#d8b4fe" stopOpacity="0.9" />
            <stop offset="70%" stopColor={secondaryAccent} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.95" />
          </radialGradient>

          {/* Holographic Ring Gradient */}
          <linearGradient id="pulseRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryAccent} />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Listening Cyan Wave Gradient */}
          <linearGradient id="pulseListenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Outer Audio Resonance Ring 1 (Dashed, modulates radius with bass) */}
        <circle
          ref={ring1Ref}
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={isListening ? 'url(#pulseListenGrad)' : 'url(#pulseRingGrad)'}
          strokeWidth="1.5"
          strokeDasharray={isListening ? '4 2' : '6 4 2 4'}
          strokeOpacity={isHovered || isListening || isProcessing ? 0.9 : 0.45}
          className={!reducedMotion ? (isListening ? 'animate-ping' : '') : ''}
          style={{ transformOrigin: '50px 50px' }}
        />

        {/* Middle Frequency Orbit Ring 2 (Rotates with midrange energy) */}
        <circle
          ref={ring2Ref}
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={isError ? '#f43f5e' : '#a78bfa'}
          strokeWidth="1.2"
          strokeDasharray="8 6"
          strokeOpacity={isHovered ? 0.8 : 0.5}
        />

        {/* Inner Resonant Soundwave Ring 3 */}
        <circle
          ref={ring3Ref}
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke="#e9d5ff"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity={isListening || isResponding ? 0.85 : 0.4}
        />

        {/* Outer Orbit Particle Nodes (Treble Shimmer) */}
        <g ref={nodesGroupRef}>
          <circle ref={nodeTopRef} cx="50" cy="5" r="2" fill={primaryAccent} opacity={isHovered ? 1 : 0.6} />
          <circle ref={nodeRightRef} cx="95" cy="50" r="1.8" fill="#38bdf8" opacity={isHovered ? 1 : 0.6} />
          <circle ref={nodeBottomRef} cx="50" cy="95" r="2" fill={primaryAccent} opacity={isHovered ? 1 : 0.6} />
          <circle ref={nodeLeftRef} cx="5" cy="50" r="1.8" fill="#818cf8" opacity={isHovered ? 1 : 0.6} />
        </g>

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

        {/* Core Luminous Energy Sphere (Modulates radius with Bass) */}
        <circle
          ref={coreCircleRef}
          cx="50"
          cy="50"
          r={isListening ? 19 : isResponding ? 18 : isHovered ? 17 : 15}
          fill="url(#pulseCoreGrad)"
          className={`transition-all duration-300 ${
            !reducedMotion && (isListening || isResponding) ? 'animate-pulse' : ''
          }`}
        />

        {/* Miniature Audio Waveform Core Icon (Modulated by Intensity) */}
        <g ref={waveLinesRef} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.95">
          <line x1="42" y1="46" x2="42" y2="54" />
          <line x1="46" y1="42" x2="46" y2="58" />
          <line x1="50" y1="39" x2="50" y2="61" />
          <line x1="54" y1="43" x2="54" y2="57" />
          <line x1="58" y1="47" x2="58" y2="53" />
        </g>
      </svg>

      {/* Floating State Badge Pills */}
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
