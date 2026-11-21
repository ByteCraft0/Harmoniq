import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { windowLifecycleService } from '../../services/windowLifecycleService';
import { usePlayer } from '../../context/PlayerContext';
import { Activity, Tag, Sparkles } from 'lucide-react';

interface FrequencyBand {
  id: string;
  name: string;
  range: string;
  lowHz: number;
  highHz: number;
  color: string;
}

const BANDS: FrequencyBand[] = [
  { id: 'subBass', name: 'Sub-Bass', range: '20 - 60 Hz', lowHz: 20, highHz: 60, color: '#818CF8' },
  { id: 'bass', name: 'Bass', range: '60 - 250 Hz', lowHz: 60, highHz: 250, color: '#A78BFA' },
  { id: 'lowMid', name: 'Low-Mid', range: '250 - 500 Hz', lowHz: 250, highHz: 500, color: '#C084FC' },
  { id: 'mid', name: 'Mid', range: '500 - 2k Hz', lowHz: 500, highHz: 2000, color: '#E879F9' },
  { id: 'upperMid', name: 'Upper-Mid', range: '2k - 4k Hz', lowHz: 2000, highHz: 4000, color: '#F472B6' },
  { id: 'presence', name: 'Presence', range: '4k - 6k Hz', lowHz: 4000, highHz: 6000, color: '#FB7185' },
  { id: 'brilliance', name: 'Brilliance', range: '6k - 20k Hz', lowHz: 6000, highHz: 20000, color: '#38BDF8' },
];

interface RealTimeFrequencySpectrumProps {
  height?: number;
  compact?: boolean;
}

export const RealTimeFrequencySpectrum: React.FC<RealTimeFrequencySpectrumProps> = ({
  height = 140,
  compact = false,
}) => {
  const { isPlaying } = usePlayer();
  const [showLabels, setShowLabels] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Peak hold & velocity arrays for physics-based gradual decay
  const peaksRef = useRef<number[]>(new Array(BANDS.length).fill(0));
  const peakDecayVelocity = useRef<number[]>(new Array(BANDS.length).fill(0));
  const smoothEnergiesRef = useRef<number[]>(new Array(BANDS.length).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      if (windowLifecycleService.isRenderingSuspended()) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== h * dpr) {
        canvas.width = width * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, h);

      const energiesObj = audioEngine.getSubBandEnergies();
      const currentEnergies: number[] = isPlaying
        ? [
            energiesObj.subBass,
            energiesObj.bass,
            energiesObj.lowMid,
            energiesObj.mid,
            energiesObj.upperMid,
            energiesObj.presence,
            energiesObj.brilliance,
          ]
        : [0, 0, 0, 0, 0, 0, 0];

      const bandCount = BANDS.length;
      const gap = compact ? 4 : 8;
      const totalGaps = (bandCount - 1) * gap;
      const barWidth = Math.max(12, (width - totalGaps) / bandCount);

      // Render 7 Bands with smooth logarithmic response and peak holding
      for (let i = 0; i < bandCount; i++) {
        const raw = currentEnergies[i];

        // Smooth energy with attack/release filter
        const currentSmooth = smoothEnergiesRef.current[i];
        const attack = 0.45;
        const release = 0.15;
        const targetVal = raw > currentSmooth
          ? currentSmooth + (raw - currentSmooth) * attack
          : currentSmooth + (raw - currentSmooth) * release;
        smoothEnergiesRef.current[i] = targetVal;

        // Peak hold physics: gravity decay
        if (targetVal >= peaksRef.current[i]) {
          peaksRef.current[i] = targetVal;
          peakDecayVelocity.current[i] = 0;
        } else {
          peakDecayVelocity.current[i] += 0.0015; // Gravity acceleration
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecayVelocity.current[i]);
        }

        const barX = i * (barWidth + gap);
        const maxHeight = showLabels ? h - 34 : h - 6;
        const barHeight = Math.max(3, targetVal * maxHeight);
        const barY = maxHeight - barHeight;

        // Track Background Slot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.roundRect(barX, 0, barWidth, maxHeight, 4);
        ctx.fill();

        // Active Segment Bar with Gradient
        const bandColor = BANDS[i].color;
        const gradient = ctx.createLinearGradient(0, barY, 0, maxHeight);
        gradient.addColorStop(0, bandColor);
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.2)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, [4, 4, 1, 1]);
        ctx.fill();

        // Glow line at top of energy bar
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(barX + 2, barY, barWidth - 4, 1.5);

        // Peak Hold Indicator
        const peakHeight = Math.max(0, peaksRef.current[i] * maxHeight);
        const peakY = Math.max(0, maxHeight - peakHeight);
        ctx.fillStyle = '#F5F3FF';
        ctx.fillRect(barX, peakY, barWidth, 2);

        // Optional Frequency Labels & Band Names
        if (showLabels && !compact) {
          ctx.fillStyle = '#A1A1AA';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(BANDS[i].name, barX + barWidth / 2, h - 18);

          ctx.fillStyle = '#71717A';
          ctx.font = '8px monospace';
          ctx.fillText(BANDS[i].range, barX + barWidth / 2, h - 6);
        }
      }

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
  }, [isPlaying, showLabels, compact]);

  return (
    <div className="flex flex-col w-full h-full p-3 rounded-2xl bg-[#0D0D12] border border-[#272733] select-none relative group shadow-card">
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#1B1B24] text-xs">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--accent-dynamic)]" />
          <span className="font-bold text-[#F5F3FF] tracking-wide text-xs">Real-Time Frequency Spectrum</span>
          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
            7-Band Log FFT
          </span>
        </div>

        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
            showLabels
              ? 'bg-[var(--accent-dynamic)]/20 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]'
              : 'bg-[#14141B] border-[#272733] text-[#71717A] hover:text-[#A1A1AA]'
          }`}
          title="Toggle frequency labels and range values"
        >
          <Tag size={11} />
          <span>Labels</span>
        </button>
      </div>

      <div className="relative flex-1 w-full min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ minHeight: `${height}px` }}
        />
      </div>
    </div>
  );
};
