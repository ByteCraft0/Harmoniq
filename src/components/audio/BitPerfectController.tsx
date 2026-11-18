import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useDSP } from '../../context/DSPContext';
import { ShieldCheck, ShieldAlert, Sparkles, Check, X, AlertCircle, Info, Lock } from 'lucide-react';

export const BitPerfectController: React.FC = () => {
  const {
    isBitPerfect,
    bitPerfectStatus,
    setBitPerfectMode,
    engageBitPerfectMode,
    disengageBitPerfectMode,
    currentTrack,
  } = usePlayer();

  const { settings, toggleDSPEnabled } = useDSP();

  const handleToggle = () => {
    if (isBitPerfect) {
      disengageBitPerfectMode();
    } else {
      engageBitPerfectMode();
      // Ensure DSP is bypassed when engaging Bit-Perfect
      if (settings.enabled) {
        toggleDSPEnabled();
      }
    }
  };

  const getStatusBadge = () => {
    switch (bitPerfectStatus.status) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-glow-sm">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>BIT-PERFECT ACTIVE</span>
          </div>
        );
      case 'resampled':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
            <ShieldAlert size={14} className="text-amber-400" />
            <span>RESAMPLED BY HARDWARE</span>
          </div>
        );
      case 'impaired':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
            <AlertCircle size={14} className="text-rose-400" />
            <span>PROCESSING ACTIVE</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1C24] text-[#A1A1AA] border border-[#272733] text-xs font-bold">
            <span>DISABLED</span>
          </div>
        );
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-[#09090B] border border-[#272733] space-y-4 shadow-card">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent-dynamic)]/10 text-[var(--accent-dynamic)]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#F5F3FF]">Bit-Perfect Direct Audio Mode</h4>
              <p className="text-xs text-[#A1A1AA]">
                Preserves source bitstream integrity by delivering unmodified audio samples directly to your output endpoint.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isBitPerfect ? 'bg-[var(--accent-dynamic)]' : 'bg-[#272733]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isBitPerfect ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Bit-Perfect Explanation & Feature Disclosures */}
      <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] text-xs space-y-3">
        <div className="flex items-center gap-2 text-[#A78BFA] font-bold">
          <Info size={14} />
          <span>Bit-Perfect Operation Policy</span>
        </div>
        <p className="text-[#A1A1AA] leading-relaxed">
          True bit-perfect audio requires zero digital tampering. When Bit-Perfect mode is active, the following processing features are locked to ensure 100% bit-transparent transmission:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1 font-mono-numbers">
          <div className="flex items-center gap-1.5 text-[#F5F3FF]">
            <Lock size={12} className="text-[var(--accent-dynamic)]" />
            <span>Volume: 100% (Unity Gain)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#F5F3FF]">
            <Lock size={12} className="text-[var(--accent-dynamic)]" />
            <span>DSP & EQ: Bypassed</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#F5F3FF]">
            <Lock size={12} className="text-[var(--accent-dynamic)]" />
            <span>ReplayGain: Off</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#F5F3FF]">
            <Lock size={12} className="text-[var(--accent-dynamic)]" />
            <span>Crossfade: Disabled (Gapless)</span>
          </div>
        </div>
      </div>

      {/* Live Diagnostic Telemetry */}
      {isBitPerfect && (
        <div className="p-3.5 rounded-xl bg-[#111116] border border-[#272733] text-xs space-y-2">
          <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">
            BIT-PERFECT TELEMETRY & DIAGNOSIS
          </span>
          <p className="text-[#D4D4D8] font-medium">{bitPerfectStatus.reason}</p>

          {bitPerfectStatus.disabledFeatures.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] text-rose-400 block mb-1">Active features modifying bitstream:</span>
              <div className="flex flex-wrap gap-1.5">
                {bitPerfectStatus.disabledFeatures.map((feat) => (
                  <span
                    key={feat}
                    className="px-2 py-0.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[10px]"
                  >
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
