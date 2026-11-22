import React, { useState, useEffect, useCallback } from 'react';
import { getPlatformDriver } from '../../../services/platform';
import { EqualizerBand, EqualizerParameters } from '../../../services/platform/types';
import { useBackHandler } from '../MobileNavigationContext';
import { SlidersHorizontal, X, RotateCcw, Volume2, Sparkles, AlertCircle } from 'lucide-react';

interface MobileEqualizerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileEqualizerSheet: React.FC<MobileEqualizerSheetProps> = ({ isOpen, onClose }) => {
  const [params, setParams] = useState<EqualizerParameters>({
    supported: true,
    enabled: false,
    numBands: 5,
    bands: [
      { band: 0, centerFreq: 60, minLevel: -15, maxLevel: 15, currentLevel: 0 },
      { band: 1, centerFreq: 230, minLevel: -15, maxLevel: 15, currentLevel: 0 },
      { band: 2, centerFreq: 910, minLevel: -15, maxLevel: 15, currentLevel: 0 },
      { band: 3, centerFreq: 3600, minLevel: -15, maxLevel: 15, currentLevel: 0 },
      { band: 4, centerFreq: 14000, minLevel: -15, maxLevel: 15, currentLevel: 0 },
    ],
    presets: ['Flat', 'Bass Boost', 'Vocal', 'Rock', 'Pop', 'Classical', 'Jazz', 'Electronic'],
    currentPreset: 'Flat',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Priority 2: System back button closes active equalizer sheet
  useBackHandler(
    2,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  const loadParameters = useCallback(async () => {
    setIsLoading(true);
    try {
      const audioDriver = getPlatformDriver().audio;
      if (audioDriver.getEqualizerParameters) {
        const loaded = await audioDriver.getEqualizerParameters();
        if (loaded && Array.isArray(loaded.bands)) {
          setParams(loaded);
        }
      }
    } catch (e) {
      console.warn('[MobileEqualizerSheet] Failed to load equalizer parameters:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadParameters();
    }
  }, [isOpen, loadParameters]);

  if (!isOpen) return null;

  const handleToggle = async () => {
    const nextState = !params.enabled;
    setParams((prev) => ({ ...prev, enabled: nextState }));
    try {
      await getPlatformDriver().audio.setEqualizerEnabled?.(nextState);
    } catch (e) {
      console.warn('[MobileEqualizerSheet] Failed to toggle equalizer:', e);
    }
  };

  const handlePresetSelect = async (preset: string) => {
    setParams((prev) => ({ ...prev, currentPreset: preset }));
    try {
      await getPlatformDriver().audio.setEqualizerPreset?.(preset);
      // Reload actual band parameters applied
      await loadParameters();
    } catch (e) {
      console.warn('[MobileEqualizerSheet] Failed to apply preset:', e);
    }
  };

  const handleBandGainChange = async (bandIdx: number, newGainDb: number) => {
    setParams((prev) => {
      const nextBands = prev.bands.map((b) =>
        b.band === bandIdx ? { ...b, currentLevel: newGainDb } : b
      );
      return {
        ...prev,
        bands: nextBands,
        currentPreset: 'Custom',
      };
    });

    try {
      await getPlatformDriver().audio.setEqualizerBandGain?.(bandIdx, newGainDb);
    } catch (e) {
      console.warn('[MobileEqualizerSheet] Failed to set band gain:', e);
    }
  };

  const handleReset = async () => {
    setParams((prev) => ({
      ...prev,
      currentPreset: 'Flat',
      bands: prev.bands.map((b) => ({ ...b, currentLevel: 0 })),
    }));
    try {
      await getPlatformDriver().audio.resetEqualizer?.();
      await loadParameters();
    } catch (e) {
      console.warn('[MobileEqualizerSheet] Failed to reset equalizer:', e);
    }
  };

  const formatFreq = (hz: number) => {
    if (hz >= 1000) {
      const khz = hz / 1000;
      return `${khz % 1 === 0 ? khz : khz.toFixed(1)}k`;
    }
    return `${hz}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] rounded-t-3xl bg-[#14141b] border-t border-[#272733] flex flex-col text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272733] flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Equalizer</h3>
              <p className="text-xs text-zinc-400">
                {params.supported
                  ? `Hardware AudioFX • ${params.numBands || params.bands.length} Bands`
                  : 'Hardware Effects Unavailable'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Master Toggle */}
            <button
              onClick={handleToggle}
              disabled={!params.supported}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                params.enabled
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-700/40 active:bg-violet-500'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {params.enabled ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Close equalizer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Unsupported notice */}
          {!params.supported && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-start space-x-2.5 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>
                Native hardware equalizer effect is not supported by this Android device or output route. Audio playback continues in direct mode.
              </span>
            </div>
          )}

          {/* Direct Stream / Bit-Perfect notice when active */}
          {params.enabled && params.supported && (
            <div className="py-2 px-3.5 rounded-xl bg-violet-950/30 border border-violet-800/30 flex items-center space-x-2 text-violet-300 text-xs">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
              <span>
                Audio effects active: Direct Stream / Bit-Perfect output is bypassed.
              </span>
            </div>
          )}

          {/* Presets chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Presets</span>
              <button
                onClick={handleReset}
                disabled={!params.enabled}
                className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-violet-400 disabled:opacity-40 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Flat</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {(params.presets || []).map((preset) => {
                const isSelected = params.currentPreset === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => handlePresetSelect(preset)}
                    disabled={!params.enabled}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                        : 'bg-[#1b1b24] border border-[#272733] text-zinc-400 hover:text-white disabled:opacity-40'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency Sliders */}
          <div
            className={`space-y-4 transition-opacity ${
              params.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <div className="bg-[#181822] border border-[#272733] rounded-2xl p-4 space-y-4">
              {params.bands.map((band) => {
                const gain = band.currentLevel;
                const min = band.minLevel ?? -15;
                const max = band.maxLevel ?? 15;
                const sign = gain > 0 ? '+' : '';

                return (
                  <div key={band.band} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-300 font-semibold">
                        {formatFreq(band.centerFreq)}
                      </span>
                      <span className="font-mono text-violet-400 font-bold">
                        {sign}{gain} dB
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-zinc-500 font-mono w-6 text-right">
                        {min}
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
                        value={gain}
                        onChange={(e) => handleBandGainChange(band.band, parseInt(e.target.value, 10))}
                        className="flex-1 accent-violet-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono w-6">
                        +{max}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Done button */}
        <div className="px-5 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm shadow-lg shadow-violet-900/30 active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
