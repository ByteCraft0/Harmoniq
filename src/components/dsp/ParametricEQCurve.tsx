import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ParametricFilterConfig } from '../../types/dsp';
import { audioEngine } from '../../services/audioEngine';
import { Headphones, Volume2, RotateCcw } from 'lucide-react';

interface ParametricEQCurveProps {
  filters: ParametricFilterConfig[];
  enabled: boolean;
  auditionFilterId: string | null;
  onUpdateFilter: (id: string, updates: Partial<ParametricFilterConfig>) => void;
  onSoloFilter: (id: string | null) => void;
  onRemoveFilter?: (id: string) => void;
  className?: string;
}

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const DB_RANGE = 18; // -18 dB to +18 dB

export const ParametricEQCurve: React.FC<ParametricEQCurveProps> = ({
  filters,
  enabled,
  auditionFilterId,
  onUpdateFilter,
  onSoloFilter,
  onRemoveFilter,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredFilterId, setHoveredFilterId] = useState<string | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [draggingFilterId, setDraggingFilterId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  // Coordinate conversion helpers
  const freqToX = useCallback((freq: number, width: number) => {
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    const logVal = Math.log10(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)));
    const padding = 28;
    return padding + ((logVal - minLog) / (maxLog - minLog)) * (width - padding * 2);
  }, []);

  const xToFreq = useCallback((x: number, width: number) => {
    const padding = 28;
    const clampedX = Math.max(padding, Math.min(width - padding, x));
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    const fraction = (clampedX - padding) / (width - padding * 2);
    const logVal = minLog + fraction * (maxLog - minLog);
    return Math.round(Math.pow(10, logVal));
  }, []);

  const gainToY = useCallback((gain: number, height: number) => {
    const paddingY = 24;
    const centerY = height / 2;
    const usableHeight = height - paddingY * 2;
    const clamped = Math.max(-DB_RANGE, Math.min(DB_RANGE, gain));
    return centerY - (clamped / DB_RANGE) * (usableHeight / 2);
  }, []);

  const yToGain = useCallback((y: number, height: number) => {
    const paddingY = 24;
    const centerY = height / 2;
    const usableHeight = height - paddingY * 2;
    const deltaY = centerY - y;
    const rawGain = (deltaY / (usableHeight / 2)) * DB_RANGE;
    return Math.round(Math.max(-DB_RANGE, Math.min(DB_RANGE, rawGain)) * 10) / 10;
  }, []);

  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`;
  };

  const calculateBandwidth = (q: number) => {
    if (q <= 0) return 0;
    // Standard formula: BW = (2 / ln(2)) * asinh(1 / (2Q))
    const bw = (2 / Math.LN2) * Math.asinh(1 / (2 * q));
    return Math.round(bw * 100) / 100;
  };

  // Render canvas curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Grid lines and Frequency labels
    const gridFreqs = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    gridFreqs.forEach((gf) => {
      const gx = freqToX(gf, width);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height - 18);
      ctx.stroke();

      ctx.fillStyle = '#71717A';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatFreq(gf), gx, height - 6);
    });

    // Horizontal dB lines (-18, -12, -6, 0, +6, +12, +18)
    const dbLines = [18, 12, 6, 0, -6, -12, -18];
    dbLines.forEach((db) => {
      const gy = gainToY(db, height);
      ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)';
      ctx.setLineDash(db === 0 ? [] : [3, 4]);
      ctx.beginPath();
      ctx.moveTo(24, gy);
      ctx.lineTo(width - 24, gy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = db === 0 ? '#E4E4E7' : '#71717A';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 4, gy + 3);
    });

    // 2. Sample 180 points for physical biquad response curve
    const numSamples = 180;
    const testFreqs = new Float32Array(numSamples);
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);

    for (let i = 0; i < numSamples; i++) {
      const logVal = minLog + (i / (numSamples - 1)) * (maxLog - minLog);
      testFreqs[i] = Math.pow(10, logVal);
    }

    const responseDb = audioEngine.getCombinedFrequencyResponse(testFreqs);

    // Draw Smooth Frequency Response Line
    ctx.strokeStyle = enabled ? (auditionFilterId ? '#F59E0B' : '#A78BFA') : '#52525B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = freqToX(testFreqs[i], width);
      const y = gainToY(responseDb[i], height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    if (enabled) {
      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      if (auditionFilterId) {
        fillGradient.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
        fillGradient.addColorStop(0.5, 'rgba(217, 119, 6, 0.06)');
        fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        fillGradient.addColorStop(0, 'rgba(167, 139, 250, 0.18)');
        fillGradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.06)');
        fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.lineTo(freqToX(testFreqs[numSamples - 1], width), gainToY(0, height));
      ctx.lineTo(freqToX(testFreqs[0], width), gainToY(0, height));
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }

    // 3. Draw Filter Handles
    filters.forEach((filter, idx) => {
      const isSoloed = auditionFilterId === filter.id;
      const isDimmed = auditionFilterId !== null && !isSoloed;
      const isHovered = hoveredFilterId === filter.id;
      const isDragged = draggingFilterId === filter.id;
      const isSelected = selectedFilterId === filter.id;

      const hx = freqToX(filter.frequency, width);
      const hy = gainToY(filter.gain, height);

      // Handle outer halo for active / hovered / soloed
      if (isSoloed) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.beginPath();
        ctx.arc(hx, hy, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (isDragged || isHovered || isSelected) {
        ctx.fillStyle = 'rgba(192, 132, 252, 0.25)';
        ctx.beginPath();
        ctx.arc(hx, hy, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Handle Core
      ctx.fillStyle = isDimmed
        ? 'rgba(113, 113, 122, 0.6)'
        : !filter.enabled
        ? '#52525B'
        : isSoloed
        ? '#F59E0B'
        : isDragged || isHovered || isSelected
        ? '#C084FC'
        : '#8B5CF6';

      ctx.beginPath();
      ctx.arc(hx, hy, isDragged || isHovered ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isSoloed ? '#FEF3C7' : '#FFFFFF';
      ctx.lineWidth = isDragged || isHovered || isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Band Label
      ctx.fillStyle = isDimmed ? '#71717A' : '#F4F4F5';
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      const labelY = hy > height - 32 ? hy - 12 : hy - 10;
      ctx.fillText(`${idx + 1}`, hx, labelY);

      if (isSoloed) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('SOLO', hx, hy + 16);
      }
    });
  }, [
    filters,
    enabled,
    auditionFilterId,
    hoveredFilterId,
    selectedFilterId,
    draggingFilterId,
    freqToX,
    gainToY,
  ]);

  // Pointer Down: Pointer Capture for smooth dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestId: string | null = null;
    let minDist = 20;

    filters.forEach((filter) => {
      const hx = freqToX(filter.frequency, rect.width);
      const hy = gainToY(filter.gain, rect.height);
      const dist = Math.hypot(mouseX - hx, mouseY - hy);
      if (dist < minDist) {
        minDist = dist;
        closestId = filter.id;
      }
    });

    if (closestId) {
      canvas.setPointerCapture(e.pointerId);
      setDraggingFilterId(closestId);
      setSelectedFilterId(closestId);
      setPointerPos({ x: e.clientX, y: e.clientY });
    } else {
      setSelectedFilterId(null);
    }
  };

  // Pointer Move: Update frequency & gain
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingFilterId) {
      const newFreq = xToFreq(mouseX, rect.width);
      const newGain = yToGain(mouseY, rect.height);
      onUpdateFilter(draggingFilterId, { frequency: newFreq, gain: newGain });
      setPointerPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check hover
    let hoveredId: string | null = null;
    let minDist = 18;
    filters.forEach((filter) => {
      const hx = freqToX(filter.frequency, rect.width);
      const hy = gainToY(filter.gain, rect.height);
      const dist = Math.hypot(mouseX - hx, mouseY - hy);
      if (dist < minDist) {
        minDist = dist;
        hoveredId = filter.id;
      }
    });

    setHoveredFilterId(hoveredId);
    if (hoveredId) {
      setPointerPos({ x: e.clientX, y: e.clientY });
    } else if (!draggingFilterId) {
      setPointerPos(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setDraggingFilterId(null);
  };

  // Double Click: Reset gain to 0 dB
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    filters.forEach((filter) => {
      const hx = freqToX(filter.frequency, rect.width);
      const hy = gainToY(filter.gain, rect.height);
      const dist = Math.hypot(mouseX - hx, mouseY - hy);
      if (dist < 18) {
        onUpdateFilter(filter.id, { gain: 0 });
      }
    });
  };

  // Wheel Event: Multiplicative Q-Factor Adjustment without page scroll
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const targetFilterId = draggingFilterId || hoveredFilterId || selectedFilterId;
    if (!targetFilterId) return;

    // Prevent document scrolling while hovering over active filter point
    e.preventDefault();
    e.stopPropagation();

    const targetFilter = filters.find((f) => f.id === targetFilterId);
    if (!targetFilter) return;

    // Multiplicative Q scaling: wheel up increases Q (narrower), wheel down decreases Q (wider)
    const factor = e.deltaY < 0 ? 1.10 : 1 / 1.10;
    const newQ = Math.round(Math.max(0.1, Math.min(18.0, targetFilter.q * factor)) * 100) / 100;

    onUpdateFilter(targetFilterId, { q: newQ });
  };

  // Keyboard navigation for selected filter point
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedFilterId) return;
    const current = filters.find((f) => f.id === selectedFilterId);
    if (!current) return;

    const freqMultiplier = e.shiftKey ? 1.2 : 1.03;
    const gainStep = e.shiftKey ? 2.0 : 0.5;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          frequency: Math.max(MIN_FREQ, Math.round(current.frequency / freqMultiplier)),
        });
        break;
      case 'ArrowRight':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          frequency: Math.min(MAX_FREQ, Math.round(current.frequency * freqMultiplier)),
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          gain: Math.min(DB_RANGE, Math.round((current.gain + gainStep) * 10) / 10),
        });
        break;
      case 'ArrowDown':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          gain: Math.max(-DB_RANGE, Math.round((current.gain - gainStep) * 10) / 10),
        });
        break;
      case '[':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          q: Math.max(0.1, Math.round((current.q / 1.1) * 100) / 100),
        });
        break;
      case ']':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, {
          q: Math.min(18.0, Math.round(current.q * 1.1 * 100) / 100),
        });
        break;
      case 's':
      case 'S':
        e.preventDefault();
        onSoloFilter(selectedFilterId);
        break;
      case ' ':
        e.preventDefault();
        onUpdateFilter(selectedFilterId, { enabled: !current.enabled });
        break;
      case 'Delete':
      case 'Backspace':
        if (onRemoveFilter && filters.length > 1) {
          e.preventDefault();
          onRemoveFilter(selectedFilterId);
          setSelectedFilterId(null);
        }
        break;
    }
  };

  const activeHoverOrDrag = filters.find(
    (f) => f.id === (draggingFilterId || hoveredFilterId || selectedFilterId)
  );
  const activeIndex = activeHoverOrDrag
    ? filters.findIndex((f) => f.id === activeHoverOrDrag.id) + 1
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-64 bg-zinc-950/80 rounded-xl border border-zinc-800/80 overflow-hidden select-none focus:outline-none focus:ring-1 focus:ring-violet-500/40 ${className}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Interactive Parametric Equalizer Curve"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />

      {/* Solo Audition Mode Alert Banner */}
      {auditionFilterId && (
        <div className="absolute top-2 right-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
          <Headphones className="w-3.5 h-3.5 text-amber-400" />
          <span>Audition Mode Active</span>
          <button
            onClick={() => onSoloFilter(null)}
            className="ml-1 text-[10px] underline hover:text-amber-100 focus:outline-none"
            title="Restore all filters"
          >
            Exit Solo
          </button>
        </div>
      )}

      {/* Floating Precision Tooltip */}
      {activeHoverOrDrag && pointerPos && containerRef.current && (
        <div
          className="pointer-events-none absolute z-20 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700 shadow-xl backdrop-blur-md text-xs transition-opacity duration-150"
          style={{
            left: Math.max(
              10,
              Math.min(
                containerRef.current.clientWidth - 160,
                pointerPos.x - containerRef.current.getBoundingClientRect().left - 70
              )
            ),
            top: Math.max(
              8,
              pointerPos.y - containerRef.current.getBoundingClientRect().top - 70
            ),
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
            <span className="w-4 h-4 rounded-full bg-violet-600/80 text-[10px] flex items-center justify-center text-white">
              {activeIndex}
            </span>
            <span className="capitalize text-violet-300">{activeHoverOrDrag.type}</span>
            {auditionFilterId === activeHoverOrDrag.id && (
              <span className="text-[10px] px-1 bg-amber-500/30 text-amber-300 rounded font-bold">
                SOLO
              </span>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono text-zinc-400">
            <span>Freq:</span>
            <span className="text-zinc-100 text-right">
              {activeHoverOrDrag.frequency >= 1000
                ? `${(activeHoverOrDrag.frequency / 1000).toFixed(2)} kHz`
                : `${activeHoverOrDrag.frequency} Hz`}
            </span>
            <span>Gain:</span>
            <span
              className={`text-right font-medium ${
                activeHoverOrDrag.gain > 0
                  ? 'text-emerald-400'
                  : activeHoverOrDrag.gain < 0
                  ? 'text-rose-400'
                  : 'text-zinc-200'
              }`}
            >
              {activeHoverOrDrag.gain > 0 ? '+' : ''}
              {activeHoverOrDrag.gain.toFixed(1)} dB
            </span>
            <span>Q / BW:</span>
            <span className="text-zinc-100 text-right">
              {activeHoverOrDrag.q.toFixed(2)} ({calculateBandwidth(activeHoverOrDrag.q)} oct)
            </span>
          </div>
        </div>
      )}

      {/* Interactive Controls Overlay Hint */}
      <div className="absolute bottom-2 left-8 pointer-events-none text-[10px] text-zinc-500 flex items-center gap-3">
        <span>Drag: Freq & Gain</span>
        <span>•</span>
        <span>Mousewheel: Q-Factor</span>
        <span>•</span>
        <span>Double-click: Reset 0 dB</span>
        <span>•</span>
        <span>[S]: Solo</span>
      </div>
    </div>
  );
};
