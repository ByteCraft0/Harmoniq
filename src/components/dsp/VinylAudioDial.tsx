import React, { useState, useRef } from 'react';
import { Disc, Maximize2, RotateCcw } from 'lucide-react';

export interface VinylAudioDialProps {
  value: number; // e.g. 100 (% stereo width)
  min?: number;
  max?: number;
  defaultValue?: number;
  step?: number;
  unit?: string;
  label?: string;
  sublabel?: string;
  enabled?: boolean;
  onToggleEnabled?: () => void;
  onChange: (val: number) => void;
  onReset?: () => void;
  isPlaying?: boolean;
  size?: number;
}

export const VinylAudioDial: React.FC<VinylAudioDialProps> = ({
  value,
  min = 0,
  max = 150,
  defaultValue = 100,
  step = 5,
  unit = '%',
  label = 'Stereo Width',
  sublabel = 'Spatial Mid-Side Expander',
  enabled = true,
  onToggleEnabled,
  onChange,
  onReset,
  isPlaying = false,
  size = 156,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const dialRef = useRef<HTMLDivElement | null>(null);

  // Normalize value within bounds
  const clampedValue = Math.min(max, Math.max(min, value));
  const t = max === min ? 0 : (clampedValue - min) / (max - min);

  // Gauge angle: -135deg (min: 0% mono) to +135deg (max: 150% expanded spatial)
  const startAngle = -135;
  const endAngle = 135;
  const currentAngle = startAngle + t * (endAngle - startAngle);

  // Geometry calculations
  const cx = size / 2;
  const cy = size / 2;
  const trackRadius = cx - 8;
  const discRadius = cx - 18; // Vinyl outer diameter
  const labelRadius = discRadius * 0.44; // Authentic center paper label radius

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (centerX: number, centerY: number, radius: number, startAng: number, endAng: number) => {
    const start = polarToCartesian(centerX, centerY, radius, endAng);
    const end = polarToCartesian(centerX, centerY, radius, startAng);
    const largeArcFlag = endAng - startAng <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  // Outer calibrated soundstage arc
  const bgArc = describeArc(cx, cy, trackRadius, startAngle, endAngle);
  const activeArc = t > 0.005 ? describeArc(cx, cy, trackRadius, startAngle, currentAngle) : '';

  // Needle indicator position on the disc perimeter
  const needlePos = polarToCartesian(cx, cy, trackRadius, currentAngle);
  const needleTip = polarToCartesian(cx, cy, discRadius + 1, currentAngle);

  // Drag interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = clampedValue;
    dialRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startYRef.current - e.clientY;
    const range = max - min;
    const valDelta = (deltaY / 160) * range;
    const rawVal = startValRef.current + valDelta;
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.min(max, Math.max(min, stepped));
    onChange(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        dialRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const delta = dir * step;
    const next = Math.min(max, Math.max(min, Math.round((clampedValue + delta) / step) * step));
    onChange(next);
  };

  const handleDoubleClick = () => {
    if (onReset) {
      onReset();
    } else {
      onChange(defaultValue);
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-between p-5 rounded-2xl bg-[#181821] border transition-all duration-200 shadow-card relative group select-none ${
        enabled && clampedValue !== defaultValue
          ? 'border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.12)]'
          : 'border-[#343443] hover:border-[#8B5CF6]/40'
      }`}
    >
      {/* Card Header: Title, Icon, Bypass Switch */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#343443]/80 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#111116] border border-[#343443] text-[#A78BFA] shadow-inner">
            <Disc
              size={15}
              className={isPlaying && enabled ? 'animate-vinyl-spin' : ''}
              style={{ animationDuration: '3s' }}
            />
          </div>
          <div>
            <h4 className="font-bold text-[#F5F3FF] tracking-tight text-xs flex items-center gap-1.5">
              <span>{label}</span>
            </h4>
            <span className="text-[10px] text-[#A1A1AA]">{sublabel}</span>
          </div>
        </div>

        {onToggleEnabled && (
          <button
            type="button"
            onClick={onToggleEnabled}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              enabled
                ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6]/60 text-[#A78BFA] shadow-glow-sm'
                : 'bg-[#111116] border-[#343443] text-[#71717A]'
            }`}
            title={enabled ? 'Bypass processing' : 'Enable processing'}
          >
            {enabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        )}
      </div>

      {/* Realistic Miniature Vinyl Record Rotary Centerpiece */}
      <div
        ref={dialRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={`relative my-2 cursor-ns-resize flex items-center justify-center touch-none ${
          isDragging ? 'scale-105' : 'hover:scale-[1.02]'
        } transition-transform duration-150`}
        style={{ width: size, height: size }}
        title="Drag up/down or rotate mouse wheel to adjust • Double-click to reset"
      >
        <svg width={size} height={size} className="overflow-visible block">
          <defs>
            {/* Vinyl Body Deep Radial Sheen */}
            <radialGradient id="vinyl-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#222230" />
              <stop offset="30%" stopColor="#121218" />
              <stop offset="65%" stopColor="#0B0B0F" />
              <stop offset="92%" stopColor="#161620" />
              <stop offset="100%" stopColor="#0E0E14" />
            </radialGradient>

            {/* Specular Light Sheen Wedge 1 (Anisotropic Reflection) */}
            <linearGradient id="vinyl-sheen-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
              <stop offset="60%" stopColor="rgba(167, 139, 250, 0.05)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>

            {/* Specular Light Sheen Wedge 2 (Opposing Anisotropic Reflection) */}
            <linearGradient id="vinyl-sheen-2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.07)" />
              <stop offset="60%" stopColor="rgba(167, 139, 250, 0.04)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>

            {/* Center Paper Label Gradient */}
            <radialGradient id="vinyl-label-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2E1F4A" />
              <stop offset="75%" stopColor="#221738" />
              <stop offset="100%" stopColor="#181126" />
            </radialGradient>
          </defs>

          {/* Outer Recessed Turntable Well Rim */}
          <circle
            cx={cx}
            cy={cy}
            r={trackRadius + 4}
            fill="#111116"
            stroke="#20202C"
            strokeWidth="2"
          />

          {/* Background Inactive Arc Track */}
          <path
            d={bgArc}
            fill="none"
            stroke="#343443"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Active Violet Progress Arc */}
          {enabled && activeArc && (
            <path
              d={activeArc}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="4"
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.55))',
              }}
            />
          )}

          {/* Realistic Vinyl Disc Body (Spins at 33⅓ RPM when playing) */}
          <g className={isPlaying && enabled ? 'animate-vinyl-spin origin-center' : 'origin-center'}>
            {/* Outer Vinyl Bead & Disc Surface */}
            <circle
              cx={cx}
              cy={cy}
              r={discRadius}
              fill="url(#vinyl-gradient)"
              stroke="#20202C"
              strokeWidth="1.5"
            />

            {/* Realistic Concentric Record Grooves: Run-in, Track Separation & Recorded Grooves */}
            <circle cx={cx} cy={cy} r={discRadius * 0.94} fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.90} fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.86} fill="none" stroke="rgba(139, 92, 246, 0.05)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.82} fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.78} fill="none" stroke="rgba(139, 92, 246, 0.05)" strokeWidth="0.8" />

            {/* Track Separation Gap (Quiet LP Band) */}
            <circle cx={cx} cy={cy} r={discRadius * 0.74} fill="none" stroke="rgba(0, 0, 0, 0.65)" strokeWidth="1.8" />

            {/* Inner Music Grooves */}
            <circle cx={cx} cy={cy} r={discRadius * 0.70} fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.66} fill="none" stroke="rgba(139, 92, 246, 0.05)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.62} fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={discRadius * 0.58} fill="none" stroke="rgba(139, 92, 246, 0.05)" strokeWidth="0.8" />

            {/* Dead Wax / Run-out Zone */}
            <circle cx={cx} cy={cy} r={discRadius * 0.51} fill="none" stroke="#0B0B0F" strokeWidth="5" />

            {/* Spiral Run-out Lead Groove */}
            <path
              d={`M ${cx + discRadius * 0.54} ${cy} A ${discRadius * 0.50} ${discRadius * 0.50} 0 0 1 ${cx} ${cy + discRadius * 0.47} A ${discRadius * 0.44} ${discRadius * 0.44} 0 0 1 ${cx - discRadius * 0.42} ${cy}`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="0.75"
            />

            {/* Anisotropic Specular Light Reflections (Rotating Sheen) */}
            <path
              d={`M ${cx} ${cy} L ${cx + discRadius * 0.94 * 0.76} ${cy - discRadius * 0.94 * 0.65} A ${discRadius * 0.94} ${discRadius * 0.94} 0 0 1 ${cx + discRadius * 0.94 * 0.94} ${cy - discRadius * 0.94 * 0.34} Z`}
              fill="url(#vinyl-sheen-1)"
            />
            <path
              d={`M ${cx} ${cy} L ${cx - discRadius * 0.94 * 0.76} ${cy + discRadius * 0.94 * 0.65} A ${discRadius * 0.94} ${discRadius * 0.94} 0 0 1 ${cx - discRadius * 0.94 * 0.94} ${cy + discRadius * 0.94 * 0.34} Z`}
              fill="url(#vinyl-sheen-2)"
            />

            {/* Authentic Circular Center Record Label (Paper Label) */}
            <circle
              cx={cx}
              cy={cy}
              r={labelRadius}
              fill="url(#vinyl-label-grad)"
              stroke="#62518A"
              strokeWidth="1.2"
            />
            <circle
              cx={cx}
              cy={cy}
              r={labelRadius - 3}
              fill="none"
              stroke="#343443"
              strokeWidth="0.75"
            />

            {/* Label Typography: Brand Header */}
            <text
              x={cx}
              y={cy - 13}
              textAnchor="middle"
              fill="#A78BFA"
              fontSize="4.8"
              fontWeight="bold"
              letterSpacing="0.08em"
            >
              HARMONIQ
            </text>

            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fill="#62518A"
              fontSize="3.6"
              fontWeight="600"
            >
              33⅓ RPM • SIDE A
            </text>

            {/* Digital Value Readout directly on the Record Label */}
            <text
              x={cx}
              y={cy + 7}
              textAnchor="middle"
              fill={enabled ? '#F5F3FF' : '#71717A'}
              fontSize="11"
              fontWeight="900"
              fontFamily="monospace"
            >
              {clampedValue}
              <tspan fill="#A78BFA" fontSize="8" dx="1">
                {unit}
              </tspan>
            </text>

            {/* Label Subtitle Footer */}
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fill="#C4B5FD"
              fontSize="4.2"
              fontWeight="bold"
              letterSpacing="0.04em"
            >
              STEREO
            </text>

            {/* Center Spindle Grommet & Hole */}
            <circle cx={cx} cy={cy} r={6.5} fill="#20202C" stroke="#52525B" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={3} fill="#09090B" />
          </g>

          {/* Tone-Arm Needle / Cueing Indicator on Outer Perimeter */}
          <g>
            {/* Tone-Arm Cue Line */}
            <line
              x1={needlePos.x}
              y1={needlePos.y}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke={enabled ? '#A78BFA' : '#71717A'}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Indicator Dot */}
            <circle
              cx={needlePos.x}
              cy={needlePos.y}
              r={4}
              fill={enabled ? '#8B5CF6' : '#62518A'}
              stroke="#F5F3FF"
              strokeWidth="1.5"
              style={{
                filter: enabled ? 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.75))' : 'none',
              }}
            />
          </g>
        </svg>
      </div>

      {/* Footer Controls & Reset */}
      <div className="w-full flex items-center justify-between pt-2 border-t border-[#343443]/80 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#A1A1AA]">
          <Maximize2 size={12} className="text-[#8B5CF6]" />
          <span className="font-semibold">
            {clampedValue === 0
              ? 'Mono Downmix'
              : clampedValue < 100
              ? 'Narrow Field'
              : clampedValue === 100
              ? 'Standard Stereo'
              : 'Expanded Spatial'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDoubleClick}
          className="flex items-center gap-1 text-[10px] text-[#71717A] hover:text-[#A78BFA] transition-colors py-0.5 px-2 rounded hover:bg-[#20202C] border border-transparent hover:border-[#343443]"
          title="Reset to default 100%"
        >
          <RotateCcw size={10} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
