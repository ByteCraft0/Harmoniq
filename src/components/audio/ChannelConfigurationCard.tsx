import React from 'react';
import { useDSP } from '../../context/DSPContext';
import { ChannelMode } from '../../types/dsp';
import { Sliders, RotateCcw, Volume2, Radio } from 'lucide-react';

export const ChannelConfigurationCard: React.FC = () => {
  const { settings, setChannelMode, setBalance, resetBalance } = useDSP();

  const channelModes: { id: ChannelMode; label: string; desc: string }[] = [
    { id: 'stereo', label: 'Stereo', desc: 'Standard dual-channel stereo pass-through' },
    { id: 'mono', label: 'Mono Downmix', desc: 'Summed (L+R)/2 on both channels to prevent clipping' },
    { id: 'left_only', label: 'Left Channel Only', desc: 'Route left audio stream to both speakers' },
    { id: 'right_only', label: 'Right Channel Only', desc: 'Route right audio stream to both speakers' },
  ];

  const currentMode = settings.channelMode || (settings.monoMix ? 'mono' : 'stereo');
  const balance = settings.balance || 0;

  const getBalanceDisplay = (val: number) => {
    if (Math.abs(val) < 0.01) return 'Center (0%)';
    if (val < 0) return `Left ${Math.round(Math.abs(val) * 100)}%`;
    return `Right ${Math.round(val * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Channel Routing Mode Selector */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-[#F5F3FF]">Channel Routing Mode</h4>
          <p className="text-xs text-[#A1A1AA]">
            Select how left and right audio channels are routed to your stereo speaker setup.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {channelModes.map((m) => {
            const isSelected = currentMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setChannelMode(m.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--accent-dynamic)]/10 border-[var(--accent-dynamic)] shadow-glow-sm'
                    : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#F5F3FF]' : 'text-[#D4D4D8]'}`}>
                    {m.label}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-[var(--accent-dynamic)] bg-[var(--accent-dynamic)]'
                        : 'border-[#3E3E4E]'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Left / Right Stereo Channel Balance */}
      <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#F5F3FF]">Stereo Channel Balance</h4>
            <p className="text-[11px] text-[#71717A]">
              Adjust horizontal stereo image balance between left and right channels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--accent-dynamic)] font-mono-numbers px-2.5 py-0.5 rounded bg-[var(--accent-dynamic)]/10 border border-[var(--accent-dynamic)]/20">
              {getBalanceDisplay(balance)}
            </span>
            <button
              onClick={resetBalance}
              title="Reset balance to Center (0)"
              className="p-1.5 rounded-lg bg-[#14141B] hover:bg-[#1C1C24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Balance Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-[#71717A] font-mono-numbers">
            <span>L (Left 100%)</span>
            <span>CENTER</span>
            <span>R (Right 100%)</span>
          </div>

          <div className="relative flex items-center">
            {/* Center tick indicator */}
            <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#3E3E4E] pointer-events-none" />

            <input
              type="range"
              min="-1"
              max="1"
              step="0.02"
              value={balance}
              onChange={(e) => setBalance(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent-dynamic)] cursor-pointer h-2 bg-[#1C1C24] rounded-lg appearance-none"
            />
          </div>

          {/* Visual Channel Meters */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#71717A] font-mono-numbers">
                <span>Left Channel Output</span>
                <span>{Math.round((balance <= 0 ? 1 : Math.max(0, 1 - balance)) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1C24] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-dynamic)] rounded-full transition-all duration-75"
                  style={{ width: `${(balance <= 0 ? 1 : Math.max(0, 1 - balance)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#71717A] font-mono-numbers">
                <span>Right Channel Output</span>
                <span>{Math.round((balance >= 0 ? 1 : Math.max(0, 1 + balance)) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1C24] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-dynamic)] rounded-full transition-all duration-75"
                  style={{ width: `${(balance >= 0 ? 1 : Math.max(0, 1 + balance)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
