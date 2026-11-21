import React, { useMemo } from 'react';

export interface GraphicEQBandProps {
  index: number;
  frequency: number;
  gain: number; // -12 to +12 dB
  onChange: (index: number, gain: number) => void;
  onReset: (index: number) => void;
  isPlaying?: boolean;
  disabled?: boolean;
  realEnergy?: number; // 0 to 1 audio energy from audioEngine
}

const BAND_METADATA: { [freq: number]: { cycles: number; amp: number; tag: string; desc: string } } = {
  31: { cycles: 2, amp: 8.0, tag: 'Sub', desc: 'Sub-bass fundamental' },
  62: { cycles: 3, amp: 7.5, tag: 'Bass', desc: 'Deep bass harmonics' },
  125: { cycles: 4, amp: 7.0, tag: 'Warmth', desc: 'Warm resonance' },
  250: { cycles: 6, amp: 6.5, tag: 'Body', desc: 'Acoustic body' },
  500: { cycles: 8, amp: 6.0, tag: 'Mid', desc: 'Midrange contour' },
  1000: { cycles: 12, amp: 5.5, tag: 'Vocal', desc: 'Vocal fundamental' },
  2000: { cycles: 16, amp: 5.0, tag: 'Attack', desc: 'Transient attack' },
  4000: { cycles: 20, amp: 4.5, tag: 'Presence', desc: 'Presence harmonics' },
  8000: { cycles: 26, amp: 4.0, tag: 'Brilliance', desc: 'Brilliance shimmer' },
  16000: { cycles: 34, amp: 3.5, tag: 'Air', desc: 'Ultra-high air' },
};

export const GraphicEQBand: React.FC<GraphicEQBandProps> = ({
  index,
  frequency,
  gain,
  onChange,
  onReset,
  isPlaying = false,
  disabled = false,
  realEnergy,
}) => {
  const meta = BAND_METADATA[frequency] || { cycles: 8, amp: 5.0, tag: 'EQ', desc: 'Equalizer' };

  // Calculate dynamic waveform amplitude based on actual audio data when playing
  const energyMod = isPlaying && !disabled && realEnergy !== undefined ? 0.85 + 0.45 * Math.min(1, Math.max(0, realEnergy)) : 1.0;
  const currentAmp = meta.amp * energyMod;

  // Generate smooth, continuous sinusoidal wave path across the 180px column
  const wavePath = useMemo(() => {
    const height = 180;
    const width = 32;
    const cx = width / 2;
    const points = 72; // High resolution for silky smooth curves
    const parts: string[] = [];
    for (let i = 0; i <= points; i++) {
      const y = (i / points) * height;
      const x = cx + currentAmp * Math.sin((2 * Math.PI * meta.cycles * y) / height);
      parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return parts.join(' ');
  }, [meta.cycles, currentAmp]);

  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`;
  };

  // Calculate normalized coordinate from bottom (-12dB = 0%, 0dB = 50%, +12dB = 100%)
  const clampedGain = Math.max(-12, Math.min(12, gain));
  const normalizedFromBottom = (clampedGain - -12) / 24;
  const thumbPercentFromBottom = normalizedFromBottom * 100;

  // Active bar styling: illuminated vertical fill from center (50%) to thumb
  const activeBarStyle = useMemo(() => {
    if (clampedGain > 0) {
      return {
        bottom: '50%',
        height: `${thumbPercentFromBottom - 50}%`,
        background: 'linear-gradient(to top, rgba(139, 92, 246, 0.15), rgba(167, 139, 250, 0.45))',
      };
    } else if (clampedGain < 0) {
      return {
        top: '50%',
        height: `${50 - thumbPercentFromBottom}%`,
        background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.15), rgba(98, 81, 138, 0.4))',
      };
    }
    return { height: '0%' };
  }, [clampedGain, thumbPercentFromBottom]);

  return (
    <div
      className={`flex flex-col items-center gap-2.5 w-full select-none ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {/* Decibel Readout Above Band */}
      <div
        className={`px-1.5 py-0.5 rounded-md bg-[#181821] border transition-all ${
          gain !== 0
            ? 'border-[#8B5CF6]/50 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
            : 'border-[#343443]'
        }`}
      >
        <span
          className={`text-[11px] font-mono-numbers font-bold tracking-tight transition-colors ${
            gain > 0
              ? 'text-[#A78BFA] drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]'
              : gain < 0
              ? 'text-[#8B5CF6]'
              : 'text-[#71717A]'
          }`}
        >
          {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
        </span>
      </div>

      {/* Vertical Slider Column with Distinct Musical Waveform Track */}
      <div
        className={`relative w-8 h-[180px] rounded-xl bg-[#111116] border transition-all duration-150 flex items-center justify-center overflow-hidden group shadow-inner ${
          gain !== 0
            ? 'border-[#8B5CF6]/60 shadow-[0_0_12px_rgba(139,92,246,0.18)]'
            : 'border-[#343443] hover:border-[#8B5CF6]/40'
        }`}
        onDoubleClick={() => onReset(index)}
        title={`Frequency: ${frequency} Hz (${meta.tag} — ${meta.desc}) • Gain: ${gain > 0 ? '+' : ''}${gain.toFixed(1)} dB\nDouble-click to reset to 0 dB`}
      >
        {/* Subtle SVG Gradients & Continuous Musical Waves */}
        <svg
          width="32"
          height="180"
          className={`absolute inset-0 pointer-events-none ${
            isPlaying && !disabled ? 'animate-eq-wave' : ''
          }`}
        >
          <defs>
            <linearGradient id={`eq-wave-grad-${frequency}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#62518A" stopOpacity={gain !== 0 ? 0.8 : 0.45} />
              <stop offset="50%" stopColor={gain !== 0 ? '#C4B5FD' : '#A78BFA'} stopOpacity={gain !== 0 ? 1 : 0.85} />
              <stop offset="100%" stopColor="#62518A" stopOpacity={gain !== 0 ? 0.8 : 0.45} />
            </linearGradient>
          </defs>

          {/* Soft Ambient Wave Glow */}
          <path
            d={wavePath}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={gain !== 0 ? '3.5' : '2.0'}
            strokeLinecap="round"
            strokeDasharray="none"
            style={{
              opacity: gain !== 0 ? 0.4 : 0.18,
            }}
          />

          {/* Smooth Continuous Foreground Waveform */}
          <path
            d={wavePath}
            fill="none"
            stroke={gain !== 0 ? '#8B5CF6' : `url(#eq-wave-grad-${frequency})`}
            strokeWidth={gain !== 0 ? '2.0' : '1.5'}
            strokeLinecap="round"
            strokeDasharray="none"
            style={{
              opacity: gain !== 0 ? 0.95 : 0.75,
            }}
          />
        </svg>

        {/* Center 0 dB Reference Marker Notch */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-between px-1 pointer-events-none z-10">
          <div className="w-1.5 h-[1.5px] bg-[#62518A] rounded-full" />
          <div className="w-1.5 h-[1.5px] bg-[#62518A] rounded-full" />
        </div>

        {/* Active Boost / Cut Illuminated Bar */}
        <div
          className="absolute left-1 right-1 rounded-sm pointer-events-none transition-all duration-75"
          style={activeBarStyle}
        />

        {/* Fader Thumb Line Indicator */}
        <div
          className="absolute left-1 right-1 h-[2px] bg-[#A78BFA] shadow-[0_0_6px_#8B5CF6] pointer-events-none z-15 transition-all duration-75"
          style={{
            bottom: `${thumbPercentFromBottom}%`,
            opacity: gain !== 0 ? 0.85 : 0.4,
          }}
        />

        {/* Interactive Native Range Slider Overlay */}
        <input
          type="range"
          min="-12"
          max="12"
          step="0.5"
          value={gain}
          onChange={(e) => onChange(index, parseFloat(e.target.value))}
          onDoubleClick={() => onReset(index)}
          className="eq-slider z-20"
          aria-label={`${frequency} Hertz band gain`}
        />
      </div>

      {/* Frequency & Range Label Below */}
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-bold text-[#F5F3FF] font-mono-numbers tracking-tight">
          {formatFreq(frequency)}
        </span>
        <span className="text-[9px] text-[#A78BFA] tracking-wider uppercase font-semibold">
          {meta.tag}
        </span>
      </div>
    </div>
  );
};
