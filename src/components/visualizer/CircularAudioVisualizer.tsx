import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { windowLifecycleService } from '../../services/windowLifecycleService';
import { usePlayer } from '../../context/PlayerContext';
import {
  Disc,
  Disc3,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Sparkles,
  Waves,
  CircleDot,
  Radio,
} from 'lucide-react';

export type CircularStyle = 'radial-bars' | 'radial-wave' | 'orbit-rings';

interface CircularAudioVisualizerProps {
  size?: number; // base dimension in px
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
}

export const CircularAudioVisualizer: React.FC<CircularAudioVisualizerProps> = ({
  size = 380,
  fullscreen = false,
  onToggleFullscreen,
}) => {
  const { currentTrack, isPlaying } = usePlayer();
  const [style, setStyle] = useState<CircularStyle>('radial-bars');
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [intensity, setIntensity] = useState<number>(1.0);
  const [scale, setScale] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Peak hold array for circular bars
  const radialPeaksRef = useRef<number[]>(new Array(72).fill(0));
  const radialDecayRef = useRef<number[]>(new Array(72).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const binCount = audioEngine.getFrequencyBinCount();
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(audioEngine.getFftSize());

    const barCount = 72; // Circular bars around perimeter
    if (radialPeaksRef.current.length !== barCount) {
      radialPeaksRef.current = new Array(barCount).fill(0);
      radialDecayRef.current = new Array(barCount).fill(0);
    }

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      if (windowLifecycleService.isRenderingSuspended()) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = (Math.min(width, height) / 2) * 0.42 * scale;

      if (isPlaying) {
        audioEngine.getFrequencyData(freqData);
        audioEngine.getTimeDomainData(timeData);
        rotationAngleRef.current += 0.005; // Slow ambient rotation
      } else {
        freqData.fill(0);
        timeData.fill(128);
      }

      // Calculate bass power for central breathing pulse
      let bassEnergy = 0;
      for (let b = 0; b < 12; b++) bassEnergy += freqData[b];
      bassEnergy = (bassEnergy / 12 / 255) * sensitivity;

      const dynamicRadius = baseRadius * (1 + bassEnergy * 0.12 * intensity);

      // 1. Ambient Background Halo & Glow
      const glowGradient = ctx.createRadialGradient(
        cx,
        cy,
        dynamicRadius * 0.7,
        cx,
        cy,
        dynamicRadius * 1.8
      );
      glowGradient.addColorStop(0, `rgba(167, 139, 250, ${0.15 * intensity * (bassEnergy + 0.2)})`);
      glowGradient.addColorStop(0.6, `rgba(139, 92, 246, ${0.08 * intensity * (bassEnergy + 0.1)})`);
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 2. Spawn and update audio-reactive ambient particles
      if (isPlaying && bassEnergy > 0.15 && particlesRef.current.length < 50 * intensity) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1 + Math.random() * 3) * sensitivity;
        particlesRef.current.push({
          x: cx + Math.cos(angle) * dynamicRadius,
          y: cy + Math.sin(angle) * dynamicRadius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1 + Math.random() * 2.5 * intensity,
          alpha: 0.8,
          maxLife: 40 + Math.random() * 30,
          life: 0,
          color: Math.random() > 0.5 ? '#A78BFA' : '#C084FC',
        });
      }

      // Render Particles
      for (let pIdx = particlesRef.current.length - 1; pIdx >= 0; pIdx--) {
        const p = particlesRef.current[pIdx];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const lifeFrac = p.life / p.maxLife;
        p.alpha = Math.max(0, 0.8 * (1 - lifeFrac));

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(pIdx, 1);
        }
      }

      // 3. Render Circular Styles
      if (style === 'radial-bars') {
        const step = (Math.PI * 2) / barCount;
        const maxBarLength = (Math.min(width, height) / 2 - dynamicRadius) * 0.85;

        for (let i = 0; i < barCount; i++) {
          const angle = i * step + rotationAngleRef.current;
          // Log-spaced bin selection
          const lo = Math.floor(Math.pow(binCount, i / barCount));
          const hi = Math.max(lo + 1, Math.floor(Math.pow(binCount, (i + 1) / barCount)));
          let maxVal = 0;
          for (let b = lo; b < hi && b < binCount; b++) maxVal = Math.max(maxVal, freqData[b]);

          const rawNorm = (maxVal / 255) * sensitivity;
          const barLen = Math.max(3, rawNorm * maxBarLength * intensity);

          // Peak holding physics
          if (barLen >= radialPeaksRef.current[i]) {
            radialPeaksRef.current[i] = barLen;
            radialDecayRef.current[i] = 0;
          } else {
            radialDecayRef.current[i] += 0.35;
            radialPeaksRef.current[i] = Math.max(0, radialPeaksRef.current[i] - radialDecayRef.current[i]);
          }

          const startX = cx + Math.cos(angle) * dynamicRadius;
          const startY = cy + Math.sin(angle) * dynamicRadius;
          const endX = cx + Math.cos(angle) * (dynamicRadius + barLen);
          const endY = cy + Math.sin(angle) * (dynamicRadius + barLen);

          // Radial Bar
          ctx.strokeStyle = `hsl(${260 + (i / barCount) * 60}, 85%, ${65 + rawNorm * 25}%)`;
          ctx.lineWidth = Math.max(2, (2 * Math.PI * dynamicRadius) / barCount - 2);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Peak Marker Dot
          const peakLen = radialPeaksRef.current[i];
          if (peakLen > 4) {
            const peakX = cx + Math.cos(angle) * (dynamicRadius + peakLen + 2);
            const peakY = cy + Math.sin(angle) * (dynamicRadius + peakLen + 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(peakX, peakY, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (style === 'radial-wave') {
        // Continuous circular wave ribbon
        const points = 180;
        const step = (Math.PI * 2) / points;
        const maxDisplacement = 45 * sensitivity * intensity;

        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        for (let i = 0; i <= points; i++) {
          const idx = i % points;
          const angle = idx * step + rotationAngleRef.current;
          const dataIdx = Math.floor((idx / points) * timeData.length);
          const v = (timeData[dataIdx] - 128) / 128.0;
          const r = dynamicRadius + v * maxDisplacement;

          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Inner harmonic wave
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const idx = i % points;
          const angle = idx * step - rotationAngleRef.current * 1.5;
          const dataIdx = Math.floor((idx / points) * freqData.length * 0.5);
          const v = (freqData[dataIdx] / 255.0) * sensitivity;
          const r = dynamicRadius + v * (maxDisplacement * 0.6);

          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (style === 'orbit-rings') {
        // Concentric Pulsing Orbit Rings
        const ringCount = 5;
        for (let r = 1; r <= ringCount; r++) {
          const ringRadius = dynamicRadius + (r * 22 * scale * (1 + bassEnergy * 0.2));
          const ringFrac = (r / ringCount);
          ctx.strokeStyle = `rgba(167, 139, 250, ${Math.max(0.1, (1 - ringFrac) * 0.8 * intensity)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Orbiting satellite dots on each ring
          const orbitAngle = rotationAngleRef.current * (r % 2 === 0 ? 1 : -1) * (1.2 / r);
          const satX = cx + Math.cos(orbitAngle) * ringRadius;
          const satY = cy + Math.sin(orbitAngle) * ringRadius;

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(satX, satY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Central Hub Border Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (isPlaying && !windowLifecycleService.isRenderingSuspended()) {
        animationFrameId.current = requestAnimationFrame(render);
      }
    };

    const startRender = () => {
      if (!isRunning) return;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      render();
    };

    startRender();

    const unsubLifecycle = windowLifecycleService.subscribeSuspension((suspended) => {
      if (!suspended && isPlaying) {
        startRender();
      } else if (suspended && animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    });

    return () => {
      isRunning = false;
      unsubLifecycle();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, style, sensitivity, intensity, scale]);

  return (
    <div
      className={`relative flex items-center justify-center select-none overflow-hidden ${
        fullscreen
          ? 'fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-xl p-8 flex flex-col justify-between'
          : 'w-full h-full min-h-[340px] rounded-2xl bg-[#0D0D12] border border-[#272733] shadow-card p-4'
      }`}
    >
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* Style Switcher Pills */}
          <div className="flex items-center bg-[#14141B]/90 border border-[#272733] rounded-xl p-0.5 text-xs backdrop-blur-md shadow-md">
            <button
              onClick={() => setStyle('radial-bars')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                style === 'radial-bars'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <Radio size={13} />
              <span>Radial Bars</span>
            </button>
            <button
              onClick={() => setStyle('radial-wave')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                style === 'radial-wave'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <Waves size={13} />
              <span>Waveform</span>
            </button>
            <button
              onClick={() => setStyle('orbit-rings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                style === 'orbit-rings'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <CircleDot size={13} />
              <span>Orbit Rings</span>
            </button>
          </div>

          <button
            onClick={() => setShowControls(!showControls)}
            title="Adjust Sensitivity, Scale & Intensity"
            className={`p-2 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all ${
              showControls
                ? 'bg-[var(--accent-dynamic)]/20 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]'
                : 'bg-[#14141B]/80 border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF]'
            }`}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Visualizer'}
            className="p-2 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-all backdrop-blur-md"
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>

      {/* Floating Fine-Tuning Drawer */}
      {showControls && (
        <div className="absolute top-16 left-4 z-30 p-4 rounded-xl bg-[#14141B]/95 border border-[#272733] backdrop-blur-lg shadow-xl space-y-3 w-64 text-xs">
          <div>
            <div className="flex justify-between text-[#A1A1AA] mb-1">
              <span>Sensitivity</span>
              <span className="font-mono-numbers text-[var(--accent-dynamic)]">{sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent-dynamic)]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#A1A1AA] mb-1">
              <span>Visual Intensity</span>
              <span className="font-mono-numbers text-[var(--accent-dynamic)]">{intensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent-dynamic)]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#A1A1AA] mb-1">
              <span>Size Scale</span>
              <span className="font-mono-numbers text-[var(--accent-dynamic)]">{scale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.4"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent-dynamic)]"
            />
          </div>
        </div>
      )}

      {/* Center Artwork Hub (Anchored in the middle of the canvas) */}
      <div className="relative flex items-center justify-center w-full h-full">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {/* Center Vinyl Artwork Element */}
        <div
          className={`relative rounded-full overflow-hidden shadow-2xl z-20 border-2 border-white/20 flex items-center justify-center transition-all duration-300 ${
            isPlaying ? 'animate-vinyl' : ''
          }`}
          style={{
            width: `${Math.round(size * 0.42 * scale)}px`,
            height: `${Math.round(size * 0.42 * scale)}px`,
            animationPlayState: isPlaying ? 'running' : 'paused',
          }}
        >
          {currentTrack?.artworkDataUrl ? (
            <img
              src={currentTrack.artworkDataUrl}
              alt={currentTrack.album || 'Album Art'}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-[#121218] flex flex-col items-center justify-center text-[#A78BFA]">
              <Disc3 size={Math.round(size * 0.18 * scale)} strokeWidth={1.5} />
            </div>
          )}

          {/* Center Spindle Hole */}
          <div className="absolute w-5 h-5 rounded-full bg-[#09090B] border-2 border-white/30 shadow-md" />
        </div>
      </div>
    </div>
  );
};
