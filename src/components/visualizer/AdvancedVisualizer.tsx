import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { usePlayer } from '../../context/PlayerContext';
import { CircularAudioVisualizer } from './CircularAudioVisualizer';
import {
  BarChart3,
  Activity,
  Sparkles,
  Disc3,
  Waves,
  Maximize2,
  Minimize2,
  Power,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';

export type VisualizerStyle = 'bars' | 'waveform' | 'particles' | 'circular' | 'wave-rings';

interface AdvancedVisualizerProps {
  height?: number;
  initialStyle?: VisualizerStyle;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  showControlsBar?: boolean;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  alpha: number;
}

interface RippleRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export const AdvancedVisualizer: React.FC<AdvancedVisualizerProps> = ({
  height = 220,
  initialStyle = 'bars',
  fullscreen = false,
  onToggleFullscreen,
  showControlsBar = true,
}) => {
  const { isPlaying, currentTrack } = usePlayer();
  const [style, setStyle] = useState<VisualizerStyle>(initialStyle);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Peak hold references for 'bars'
  const peaksRef = useRef<number[]>([]);
  const peakDecayRef = useRef<number[]>([]);

  // Particle & ripple references
  const particlesRef = useRef<Particle3D[]>([]);
  const ripplesRef = useRef<RippleRing[]>([]);
  const lastBassKickTime = useRef<number>(0);

  useEffect(() => {
    if (!isEnabled || style === 'circular') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const binCount = audioEngine.getFrequencyBinCount();
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(audioEngine.getFftSize());

    const barCount = 64;
    if (peaksRef.current.length !== barCount) {
      peaksRef.current = new Array(barCount).fill(0);
      peakDecayRef.current = new Array(barCount).fill(0);
    }

    // Initialize 3D particles pool
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 90; i++) {
        particlesRef.current.push({
          x: (Math.random() - 0.5) * 600,
          y: (Math.random() - 0.5) * 400,
          z: Math.random() * 800 + 100,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          vz: -2 - Math.random() * 3,
          radius: 1.5 + Math.random() * 2.5,
          color: i % 2 === 0 ? '#A78BFA' : '#C084FC',
          alpha: 0.7,
        });
      }
    }

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      animationFrameId.current = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== h * dpr) {
        canvas.width = width * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, h);

      if (isPlaying) {
        audioEngine.getFrequencyData(freqData);
        audioEngine.getTimeDomainData(timeData);
      } else {
        freqData.fill(0);
        timeData.fill(128);
      }

      // 1. Style: BARS (Frequency Spectrum with Gradient & Peak Hold)
      if (style === 'bars') {
        const gap = 3;
        const totalGap = (barCount - 1) * gap;
        const barWidth = Math.max(2, (width - totalGap) / barCount);

        for (let i = 0; i < barCount; i++) {
          const lo = Math.floor(Math.pow(binCount, i / barCount));
          const hi = Math.max(lo + 1, Math.floor(Math.pow(binCount, (i + 1) / barCount)));
          let val = 0;
          for (let b = lo; b < hi && b < binCount; b++) val = Math.max(val, freqData[b]);

          const percent = (val / 255) * sensitivity;
          const barHeight = Math.max(3, percent * h * 0.92);

          // Peak holding
          if (barHeight >= peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
            peakDecayRef.current[i] = 0;
          } else {
            peakDecayRef.current[i] += 0.35;
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecayRef.current[i]);
          }

          const x = i * (barWidth + gap);
          const y = h - barHeight;

          // Gradient: Album dynamic purple/violet to neon lavender
          const gradient = ctx.createLinearGradient(0, y, 0, h);
          gradient.addColorStop(0, '#C4B5FD');
          gradient.addColorStop(0.3, '#A78BFA');
          gradient.addColorStop(0.7, '#7C3AED');
          gradient.addColorStop(1, '#4C1D95');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Peak Cap
          if (peaksRef.current[i] > 3) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, h - peaksRef.current[i], barWidth, 1.5);
          }
        }
      }

      // 2. Style: WAVEFORM (Oscilloscope Ribbon with Dynamic Glow)
      else if (style === 'waveform') {
        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(167, 139, 250, 0.6)';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        const points = 256;
        const step = Math.floor(timeData.length / points) || 1;
        const sliceWidth = width / (points - 1);

        for (let i = 0; i < points; i++) {
          const v = ((timeData[i * step] - 128) / 128.0) * sensitivity;
          const y = h / 2 + v * (h * 0.42);
          const x = i * sliceWidth;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Secondary harmonic ribbon
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }

      // 3. Style: PARTICLES (Kinetic 3D Starfield exploding with audio transients)
      else if (style === 'particles') {
        const cx = width / 2;
        const cy = h / 2;

        let bassSum = 0;
        for (let b = 0; b < 16; b++) bassSum += freqData[b];
        const bassLevel = (bassSum / 16 / 255) * sensitivity;

        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          p.z += p.vz * (1 + bassLevel * 2.5);

          if (p.z <= 10) {
            p.z = 800;
            p.x = (Math.random() - 0.5) * width * 1.5;
            p.y = (Math.random() - 0.5) * h * 1.5;
          }

          const k = 250 / p.z;
          const px = p.x * k + cx;
          const py = p.y * k + cy;

          if (px >= 0 && px <= width && py >= 0 && py <= h) {
            const size = Math.max(1, p.radius * k * (1 + bassLevel * 0.8));
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.min(1, (1 - p.z / 800) * (0.4 + bassLevel * 0.6));
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // 4. Style: WAVE RINGS (Liquid Ripple Shockwaves)
      else if (style === 'wave-rings') {
        const cx = width / 2;
        const cy = h / 2;

        let bassSum = 0;
        for (let b = 0; b < 10; b++) bassSum += freqData[b];
        const bassLevel = (bassSum / 10 / 255) * sensitivity;

        const now = performance.now();
        if (bassLevel > 0.45 && now - lastBassKickTime.current > 200) {
          lastBassKickTime.current = now;
          ripplesRef.current.push({
            x: cx,
            y: cy,
            radius: 10,
            maxRadius: Math.max(width, h) * 0.65,
            alpha: 1.0,
            color: '#A78BFA',
          });
        }

        // Draw and update ripple rings
        for (let rIdx = ripplesRef.current.length - 1; rIdx >= 0; rIdx--) {
          const rip = ripplesRef.current[rIdx];
          rip.radius += 4 + bassLevel * 4;
          rip.alpha = Math.max(0, 1 - rip.radius / rip.maxRadius);

          ctx.strokeStyle = `rgba(167, 139, 250, ${rip.alpha * 0.8})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
          ctx.stroke();

          if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
            ripplesRef.current.splice(rIdx, 1);
          }
        }

        // Central breathing bass core
        const coreRadius = 24 * (1 + bassLevel * 0.5);
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2);
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.4, '#A78BFA');
        coreGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    render();

    return () => {
      isRunning = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isEnabled, style, isPlaying, sensitivity]);

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-2xl bg-[#0D0D12] border border-[#272733] text-[#71717A] space-y-3 p-6 select-none">
        <Power size={28} className="text-[#3F3F46]" />
        <span className="text-xs font-semibold">Visualizer Disabled</span>
        <button
          onClick={() => setIsEnabled(true)}
          className="px-4 py-1.5 rounded-xl bg-[var(--accent-dynamic)] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
        >
          Enable Visualizer
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl overflow-hidden select-none ${
        fullscreen
          ? 'fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-2xl p-8'
          : 'w-full bg-[#0D0D12] border border-[#272733] shadow-card p-4'
      }`}
      style={{ height: fullscreen ? '100vh' : `${height}px` }}
    >
      {/* Top Header / Mode Switcher Bar */}
      {showControlsBar && (
        <div className="flex items-center justify-between z-20 shrink-0 pb-2 mb-2 border-b border-[#1B1B24]/80 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[var(--accent-dynamic)]" />
            <span className="font-bold text-[#F5F3FF]">Advanced Audio Visualizer</span>

            {/* Visualizer Style Switcher */}
            <div className="flex items-center bg-[#14141B] border border-[#272733] rounded-xl p-0.5 ml-2">
              <button
                onClick={() => setStyle('bars')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  style === 'bars'
                    ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
                title="Spectrum Bars"
              >
                <BarChart3 size={12} />
                <span>Bars</span>
              </button>
              <button
                onClick={() => setStyle('waveform')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  style === 'waveform'
                    ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
                title="Oscilloscope Waveform"
              >
                <Activity size={12} />
                <span>Waveform</span>
              </button>
              <button
                onClick={() => setStyle('particles')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  style === 'particles'
                    ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
                title="Kinetic Audio Particles"
              >
                <Sparkles size={12} />
                <span>Particles</span>
              </button>
              <button
                onClick={() => setStyle('circular')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  style === 'circular'
                    ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
                title="Circular Audio Visualizer"
              >
                <Disc3 size={12} />
                <span>Circular</span>
              </button>
              <button
                onClick={() => setStyle('wave-rings')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  style === 'wave-rings'
                    ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
                title="Liquid Ripple Rings"
              >
                <Waves size={12} />
                <span>Wave Rings</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              title="Sensitivity Settings"
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                showSettingsDrawer
                  ? 'bg-[var(--accent-dynamic)]/20 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]'
                  : 'bg-[#14141B] border-[#272733] text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <SlidersHorizontal size={13} />
            </button>

            <button
              onClick={() => setIsEnabled(false)}
              title="Disable Visualizer to reduce GPU usage"
              className="p-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#71717A] hover:text-rose-400 transition-colors"
            >
              <Power size={13} />
            </button>

            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className="p-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
              >
                {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Settings Drawer */}
      {showSettingsDrawer && (
        <div className="absolute top-12 right-4 z-30 p-3.5 rounded-xl bg-[#14141B]/95 border border-[#272733] backdrop-blur-md shadow-xl w-56 text-xs space-y-2">
          <div className="flex justify-between items-center text-[#A1A1AA]">
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
      )}

      {/* Main Canvas Body or Circular Visualizer */}
      <div className="relative flex-1 w-full h-full min-h-0 flex items-center justify-center">
        {style === 'circular' ? (
          <CircularAudioVisualizer
            size={Math.min(height, 360)}
            fullscreen={fullscreen}
            onToggleFullscreen={onToggleFullscreen}
          />
        ) : (
          <canvas ref={canvasRef} className="w-full h-full block" />
        )}
      </div>
    </div>
  );
};
