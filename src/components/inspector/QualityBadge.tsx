import React from 'react';
import { QualityTier } from '../../types/audio';
import { Sparkles, Disc, Radio } from 'lucide-react';

interface QualityBadgeProps {
  tier: QualityTier;
  codec?: string;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  tier,
  codec,
  sampleRate,
  bitDepth,
  bitrate,
  size = 'md',
  onClick,
}) => {
  const getBadgeStyle = () => {
    switch (tier) {
      case 'Hi-Res Lossless':
        return {
          bg: 'bg-purple-950/60 border-[#A78BFA]/60 text-purple-200 shadow-[0_0_10px_rgba(167,139,250,0.15)]',
          dot: 'bg-[#A78BFA] shadow-[0_0_6px_rgba(167,139,250,0.8)]',
          icon: <Sparkles size={10} className="text-[#A78BFA] shrink-0" />,
        };
      case 'Lossless':
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
          dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
          icon: <Disc size={10} className="text-emerald-300 shrink-0" />,
        };
      case 'High Quality':
        return {
          bg: 'bg-sky-950/60 border-sky-500/50 text-sky-200',
          dot: 'bg-sky-400',
          icon: <Radio size={10} className="text-sky-300 shrink-0" />,
        };
      case 'Standard':
      default:
        return {
          bg: 'bg-[#1B1B24] border-[#272733] text-[#A1A1AA]',
          dot: 'bg-[#71717A]',
          icon: null,
        };
    }
  };

  const style = getBadgeStyle();

  const formatQuickSpec = () => {
    if (tier === 'Hi-Res Lossless' || tier === 'Lossless') {
      const rateKhz = sampleRate ? `${(sampleRate / 1000).toFixed(1)}kHz` : '';
      const depth = bitDepth ? `${bitDepth}B` : '';
      return depth && rateKhz ? `${depth}/${rateKhz}` : rateKhz || codec || '';
    }
    return bitrate ? `${bitrate}k` : codec || '';
  };

  const isSmall = size === 'sm';
  const showSpec = !isSmall && Boolean(formatQuickSpec());

  const paddingClass = isSmall
    ? 'px-2 h-[18px] text-[8.5px] tracking-wide gap-1.5'
    : size === 'lg'
    ? 'px-3 h-7 text-xs gap-1.5'
    : 'px-2 h-6 text-[10px] gap-1.5';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`inline-flex items-center justify-center whitespace-nowrap shrink-0 w-fit rounded border font-bold uppercase font-mono-numbers transition-all select-none leading-none ${style.bg} ${paddingClass} ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 hover:border-[#A78BFA]' : ''
      }`}
      title={`Audio Quality: ${tier}${formatQuickSpec() ? ` (${formatQuickSpec()})` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className="whitespace-nowrap shrink-0">{tier}</span>
      {showSpec && (
        <>
          <span className="opacity-30 shrink-0">•</span>
          <span className="opacity-95 whitespace-nowrap shrink-0">{formatQuickSpec()}</span>
        </>
      )}
    </div>
  );
};
