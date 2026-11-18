import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { BarChart3, Activity } from 'lucide-react';

interface AudioVisualizerProps {
  height?: number;
  mode?: 'spectrum' | 'waveform';
  compact?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  height = 80,
  mode: initialMode = 'spectrum',
  compact = false,
}) => {
  const [mode, setMode] = useState<'spectrum' | 'waveform'>(initialMode);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Peak hold array for spectrum mode
  const peaksRef = useRef<number[]>([]);
  const peakDecayRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = 128; // bars / peak slots
    const binCount = audioEngine.getFrequencyBinCount();
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(audioEngine.getFftSize());

    if (peaksRef.current.length !== bufferLength) {
      peaksRef.current = new Array(bufferLength).fill(0);
      peakDecayRef.current = new Array(bufferLength).fill(0);
    }

    const render = () => {
      animationFrameId.current = requestAnimationFrame(render);

      const width = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, width, h);

      if (mode === 'spectrum') {
        audioEngine.getFrequencyData(freqData);

        // Draw frequency bars
        const barCount = compact ? 32 : 64;
        const barWidth = width / barCount - 1.5;

        for (let i = 0; i < barCount; i++) {
          // Log-spaced bins so the bars span the whole audible range, not just the lowest bins
          const lo = Math.floor(Math.pow(binCount, i / barCount));
          const hi = Math.max(lo + 1, Math.floor(Math.pow(binCount, (i + 1) / barCount)));
          let val = 0;
          for (let b = lo; b < hi && b < binCount; b++) val = Math.max(val, freqData[b]);
          const percent = val / 255;
          const barHeight = Math.max(2, percent * h * 0.95);

          // Peak holding
          if (barHeight > peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
            peakDecayRef.current[i] = 0;
          } else {
            peakDecayRef.current[i] += 0.4;
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecayRef.current[i]);
          }

          const x = i * (barWidth + 1.5);
          const y = h - barHeight;

          // Gradient: Electric violet to subtle blue
          const gradient = ctx.createLinearGradient(0, y, 0, h);
          gradient.addColorStop(0, '#a78bfa');
          gradient.addColorStop(0.6, '#8b5cf6');
          gradient.addColorStop(1, '#4c1d95');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, Math.max(1, barWidth), barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Peak cap
          if (peaksRef.current[i] > 2 && !compact) {
            ctx.fillStyle = '#c4b5fd';
            ctx.fillRect(x, h - peaksRef.current[i], Math.max(1, barWidth), 1.5);
          }
        }
      } else {
        // Waveform Oscilloscope Mode
        audioEngine.getTimeDomainData(timeData);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#8b5cf6';
        ctx.beginPath();

        const points = 512;
        const step = Math.floor(timeData.length / points) || 1;
        const sliceWidth = width / points;
        let x = 0;

        for (let i = 0; i < points; i++) {
          const v = timeData[i * step] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, h / 2);
        ctx.stroke();
      }
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [mode, compact]);

  return (
    <div className="relative group w-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={compact ? 200 : 480}
        height={height}
        className="w-full rounded"
        style={{ height: `${height}px` }}
      />
      {!compact && (
        <button
          onClick={() => setMode(mode === 'spectrum' ? 'waveform' : 'spectrum')}
          title={`Switch to ${mode === 'spectrum' ? 'Waveform' : 'Spectrum'}`}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-[#181920]/80 text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#22232e] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {mode === 'spectrum' ? <Activity size={14} /> : <BarChart3 size={14} />}
        </button>
      )}
    </div>
  );
};
