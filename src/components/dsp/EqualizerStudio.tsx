import React, { useState } from 'react';
import { useDSP } from '../../context/DSPContext';
import { useToast } from '../../context/ToastContext';
import { EQ_FREQUENCIES } from '../../types/dsp';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import {
  Sliders,
  RotateCcw,
  Power,
  Shield,
  Save,
  Trash2,
  Volume2,
  Plus,
  Sparkles,
  Activity,
  Check,
} from 'lucide-react';

export const EqualizerStudio: React.FC = () => {
  const {
    settings,
    presets,
    limiterMetrics,
    setBandGain,
    setPreamp,
    setBassBoost,
    setTreble,
    setBalance,
    toggleMonoMix,
    toggleDSPEnabled,
    resetToFlat,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
  } = useDSP();

  const { showToast } = useToast();
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      saveCustomPreset(newPresetName.trim());
      showToast(`Custom preset "${newPresetName.trim()}" saved`, 'success');
      setNewPresetName('');
      setShowSaveModal(false);
    }
  };

  // Generate SVG path for the smooth EQ frequency response curve
  const generateCurvePath = () => {
    const width = 640;
    const height = 110;
    const centerY = height / 2;
    const rangeDb = 24; // -12 to +12 dB

    const points = settings.bands.map((gain, i) => {
      const x = (i / (settings.bands.length - 1)) * (width - 60) + 30;
      const y = centerY - (gain / rangeDb) * (height - 30);
      return { x, y };
    });

    if (points.length === 0) return '';

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    return d;
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Studio Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm">
            <Sliders size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#F5F3FF] tracking-tight">Equalizer Studio & DSP</h2>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1B1B24] text-[#A78BFA] border border-[#272733]">
                32-Bit Float
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              10-Band Peaking Biquad Filters • Headroom Preamp • Anti-Clipping Brickwall Limiter
            </p>
          </div>
        </div>

        {/* Master Switches */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetToFlat();
              showToast('Equalizer reset to Flat (0 dB reference)', 'info');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#242432] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
            title="Reset all bands to flat"
          >
            <RotateCcw size={14} />
            <span>Reset to Flat</span>
          </button>

          <button
            onClick={() => {
              toggleDSPEnabled();
              showToast(settings.enabled ? 'DSP Bypassed' : 'DSP Active', 'info');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs border transition-all ${
              settings.enabled
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] border-[#A78BFA] text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#14141B] border-[#272733] text-[#71717A]'
            }`}
          >
            <Power size={14} />
            <span>{settings.enabled ? 'DSP Active' : 'DSP Bypassed'}</span>
          </button>
        </div>
      </div>

      {/* Preset Selector Bar */}
      <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-bold text-[#71717A] font-mono-numbers">
            Acoustic Profiles & Presets
          </span>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold transition-colors"
          >
            <Plus size={14} />
            <span>Save Custom Preset</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="relative group inline-flex items-center">
              <button
                onClick={() => {
                  applyPreset(preset.id);
                  showToast(`Applied preset: ${preset.name}`, 'info');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  settings.activePresetId === preset.id
                    ? 'bg-[#7C3AED]/20 border-[#A78BFA] text-[#A78BFA] shadow-glow-sm'
                    : 'bg-[#1B1B24] hover:bg-[#242432] border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF]'
                }`}
              >
                {preset.name}
              </button>

              {!preset.isBuiltIn && (
                <button
                  onClick={() => {
                    deleteCustomPreset(preset.id);
                    showToast(`Deleted preset ${preset.name}`, 'info');
                  }}
                  title="Delete preset"
                  className="ml-1 p-1 rounded-md hover:bg-red-950/50 text-[#71717A] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Combined Visualizer: FFT Spectrum + EQ Response Curve */}
      <div className="p-5 rounded-2xl bg-[#09090B] border border-[#272733] space-y-2 shadow-card">
        <div className="flex justify-between items-center text-xs text-[#71717A] font-mono-numbers">
          <span>Real-time Response Curve & FFT Spectrum</span>
          <span>+12 dB / -12 dB Range</span>
        </div>

        <div className="w-full h-32 bg-[#14141B] rounded-xl p-3 border border-[#272733] relative overflow-hidden flex items-center justify-center">
          {/* Underlying Live Spectrum Analyzer */}
          <div className="absolute inset-x-4 bottom-2 opacity-35 pointer-events-none">
            <AudioVisualizer height={55} mode="spectrum" />
          </div>

          {/* Reference Center Grid Line */}
          <div className="absolute w-full h-[1px] bg-[#272733] top-1/2 left-0" />

          {/* Smooth Calculated Curve */}
          <svg className="w-full h-full relative z-10" viewBox="0 0 640 110" preserveAspectRatio="none">
            <path
              d={generateCurvePath()}
              fill="none"
              stroke="#A78BFA"
              strokeWidth="2.5"
              className="transition-all duration-100 ease-out"
            />
          </svg>
        </div>
      </div>

      {/* Main 10-Band Graphic EQ Sliders */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#F5F3FF] text-sm">10-Band Graphic Filters (ISO Standard)</h3>
          <span className="text-xs text-[#71717A] font-mono-numbers">Double-click slider to reset band</span>
        </div>

        <div className="grid grid-cols-10 gap-2 sm:gap-3 items-center justify-items-center">
          {EQ_FREQUENCIES.map((freq, idx) => {
            const gain = settings.bands[idx] ?? 0;
            return (
              <div key={freq} className="flex flex-col items-center gap-3 w-full">
                {/* dB Readout */}
                <span
                  className={`text-xs font-mono-numbers font-bold ${
                    gain > 0 ? 'text-[#A78BFA]' : gain < 0 ? 'text-sky-400' : 'text-[#71717A]'
                  }`}
                >
                  {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                </span>

                {/* Slider */}
                <div className="h-44 flex items-center justify-center">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={gain}
                    onChange={(e) => setBandGain(idx, parseFloat(e.target.value))}
                    onDoubleClick={() => setBandGain(idx, 0)}
                    className="eq-slider"
                  />
                </div>

                {/* Frequency Label */}
                <span className="text-xs font-bold text-[#A1A1AA] font-mono-numbers">
                  {formatFreq(freq)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preamp, Tone Controls & Anti-Clipping Limiter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Preamp Gain */}
        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-[#F5F3FF]">Preamp Gain</span>
            <span className="text-xs font-mono-numbers font-bold text-[#A78BFA]">
              {settings.preamp > 0 ? `+${settings.preamp.toFixed(1)}` : settings.preamp.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={settings.preamp}
            onChange={(e) => setPreamp(parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-[11px] text-[#A1A1AA]">
            Pre-attenuation to prevent digital clipping before applying filter boosts.
          </p>
        </div>

        {/* Tone Controls: Bass Boost & Treble */}
        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#F5F3FF]">Bass Boost (100 Hz Shelf)</span>
              <span className="text-xs font-mono-numbers font-bold text-[#A78BFA]">
                +{settings.bassBoost.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={settings.bassBoost}
              onChange={(e) => setBassBoost(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#F5F3FF]">Treble Control (10 kHz Shelf)</span>
              <span className="text-xs font-mono-numbers font-bold text-[#A78BFA]">
                {settings.treble > 0 ? `+${settings.treble.toFixed(1)}` : settings.treble.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="-6"
              max="12"
              step="0.5"
              value={settings.treble}
              onChange={(e) => setTreble(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Stereo Balance & Limiter Monitoring */}
        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#F5F3FF]">Stereo Balance</span>
              <span className="text-xs font-mono-numbers text-[#A1A1AA]">
                {settings.balance < 0
                  ? `L ${Math.abs(Math.round(settings.balance * 100))}%`
                  : settings.balance > 0
                  ? `R ${Math.round(settings.balance * 100)}%`
                  : 'Center'}
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={settings.balance}
              onChange={(e) => setBalance(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="pt-2 border-t border-[#272733] flex items-center justify-between">
            <button
              onClick={toggleMonoMix}
              className={`px-3 py-1.5 rounded-xl text-xs border font-bold transition-colors ${
                settings.monoMix
                  ? 'bg-[#7C3AED]/20 border-[#A78BFA] text-[#A78BFA]'
                  : 'bg-[#1B1B24] border-[#272733] text-[#A1A1AA]'
              }`}
            >
              Mono Downmix
            </button>

            {/* Anti-clipping limiter gain reduction */}
            <div className="flex items-center gap-2">
              <Shield
                size={15}
                className={limiterMetrics.isClippingPrevented ? 'text-amber-400' : 'text-emerald-400'}
              />
              <span className="text-xs font-mono-numbers text-[#A1A1AA]">
                {limiterMetrics.isClippingPrevented
                  ? `Limiter: -${limiterMetrics.gainReductionDb.toFixed(1)} dB`
                  : 'Limiter: Idle (0 dB)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Custom Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <form
            onSubmit={handleSavePreset}
            className="w-full max-w-sm p-6 rounded-2xl bg-[#14141B]/90 backdrop-blur-2xl border border-[#272733] shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-4"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF]">Save Custom EQ Preset</h3>
            <p className="text-xs text-[#A1A1AA]">
              Store current 10-band gains, preamp, and tone settings into a reusable preset.
            </p>
            <input
              type="text"
              autoFocus
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="e.g. My Studio Monitors"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] text-xs text-[#F5F3FF] focus:outline-none focus:border-[#A78BFA]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#242432] text-xs font-medium text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newPresetName.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-xs font-bold text-[#F5F3FF] disabled:opacity-50"
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
