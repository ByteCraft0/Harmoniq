import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DSPSettings, EQPreset, BUILT_IN_PRESETS, LimiterMetrics } from '../types/dsp';
import { audioEngine } from '../services/audioEngine';

interface DSPContextType {
  settings: DSPSettings;
  presets: EQPreset[];
  limiterMetrics: LimiterMetrics;
  
  // Real-time Controls
  setBandGain: (bandIndex: number, gainDb: number) => void;
  setAllBands: (bands: number[]) => void;
  setPreamp: (gainDb: number) => void;
  setBassBoost: (gainDb: number) => void;
  setTreble: (gainDb: number) => void;
  setBalance: (balance: number) => void;
  toggleMonoMix: () => void;
  toggleDSPEnabled: () => void;
  toggleLimiter: () => void;
  resetToFlat: () => void;
  applyPreset: (presetId: string) => void;

  // Custom Preset Management
  saveCustomPreset: (name: string) => void;
  renameCustomPreset: (presetId: string, newName: string) => void;
  deleteCustomPreset: (presetId: string) => void;
}

const DSPContext = createContext<DSPContextType | null>(null);

const STORAGE_CUSTOM_PRESETS_KEY = 'custom_presets';
const STORAGE_DSP_SETTINGS_KEY = 'dsp_settings';

const DEFAULT_SETTINGS: DSPSettings = {
  enabled: true,
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bassBoost: 0,
  treble: 0,
  balance: 0,
  monoMix: false,
  limiterEnabled: true,
  activePresetId: 'flat',
};

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

/** Merge untrusted persisted settings over defaults so stale/corrupt storage can never crash the engine. */
function sanitizeSettings(raw: any): DSPSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...d, bands: [...d.bands] };
  const bands = Array.isArray(raw.bands) ? d.bands.map((_, i) => num(raw.bands[i], -12, 12, 0)) : [...d.bands];
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    bands,
    preamp: num(raw.preamp, -12, 12, 0),
    bassBoost: num(raw.bassBoost, 0, 12, 0),
    treble: num(raw.treble, -6, 12, 0),
    balance: num(raw.balance, -1, 1, 0),
    monoMix: !!raw.monoMix,
    limiterEnabled: typeof raw.limiterEnabled === 'boolean' ? raw.limiterEnabled : d.limiterEnabled,
    activePresetId: typeof raw.activePresetId === 'string' ? raw.activePresetId : null,
  };
}

export const DSPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<DSPSettings>(() => ({ ...DEFAULT_SETTINGS, bands: [...DEFAULT_SETTINGS.bands] }));
  const settingsRef = useRef<DSPSettings>(settings);

  const [presets, setPresets] = useState<EQPreset[]>(BUILT_IN_PRESETS);
  const [limiterMetrics, setLimiterMetrics] = useState<LimiterMetrics>({
    isClippingPrevented: false,
    gainReductionDb: 0,
    peakLevel: 0,
  });

  // Load custom presets and settings on mount
  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem(STORAGE_CUSTOM_PRESETS_KEY);
      if (savedPresets) {
        const parsed = JSON.parse(savedPresets);
        if (Array.isArray(parsed)) {
          setPresets([
            ...BUILT_IN_PRESETS,
            ...parsed.filter((p: any) => p && typeof p.id === 'string' && Array.isArray(p.bands) && p.bands.length === 10),
          ]);
        }
      }

      const savedSettings = localStorage.getItem(STORAGE_DSP_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = sanitizeSettings(JSON.parse(savedSettings));
        settingsRef.current = parsedSettings;
        setSettings(parsedSettings);
        audioEngine.applyDSPSettings(parsedSettings);
      }
    } catch (e) {
      console.warn('Failed to load saved DSP configuration:', e);
    }
  }, []);

  // Poll limiter reduction metrics at 15Hz for smooth UI meter
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = audioEngine.getLimiterMetrics();
      // Only publish meaningful changes; this context feeds the whole UI
      setLimiterMetrics((prev) =>
        prev.isClippingPrevented === metrics.isClippingPrevented && Math.abs(prev.gainReductionDb - metrics.gainReductionDb) < 0.2
          ? prev
          : metrics
      );
    }, 66);

    return () => clearInterval(interval);
  }, []);

  // Sync settings with audio engine and localStorage
  const updateSettings = useCallback((newSettings: DSPSettings) => {
    settingsRef.current = newSettings;
    setSettings(newSettings);
    audioEngine.applyDSPSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_DSP_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  // All setters read the latest settings through the ref, so rapid slider events never overwrite each other
  const patch = (changes: Partial<DSPSettings>) => updateSettings({ ...settingsRef.current, ...changes });

  const setBandGain = (bandIndex: number, gainDb: number) => {
    if (bandIndex < 0 || bandIndex >= settingsRef.current.bands.length) return;
    const newBands = [...settingsRef.current.bands];
    newBands[bandIndex] = num(gainDb, -12, 12, 0);
    patch({ bands: newBands, activePresetId: null });
  };

  const setAllBands = (bands: number[]) => {
    patch({ bands: DEFAULT_SETTINGS.bands.map((_, i) => num(bands[i], -12, 12, 0)), activePresetId: null });
  };

  const setPreamp = (gainDb: number) => patch({ preamp: num(gainDb, -12, 12, 0), activePresetId: null });
  const setBassBoost = (gainDb: number) => patch({ bassBoost: num(gainDb, 0, 12, 0), activePresetId: null });
  const setTreble = (gainDb: number) => patch({ treble: num(gainDb, -6, 12, 0), activePresetId: null });
  const setBalance = (balance: number) => patch({ balance: num(balance, -1, 1, 0) });
  const toggleMonoMix = () => patch({ monoMix: !settingsRef.current.monoMix });
  const toggleDSPEnabled = () => patch({ enabled: !settingsRef.current.enabled });
  const toggleLimiter = () => patch({ limiterEnabled: !settingsRef.current.limiterEnabled });

  const resetToFlat = () => {
    applyPreset('flat');
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    patch({
      bands: [...preset.bands],
      preamp: preset.preamp,
      bassBoost: preset.bassBoost || 0,
      treble: preset.treble || 0,
      activePresetId: preset.id,
    });
  };

  const saveCustomPreset = (name: string) => {
    const id = `custom_${Date.now()}`;
    const newPreset: EQPreset = {
      id,
      name: name.trim() || 'Custom Preset',
      isBuiltIn: false,
      bands: [...settingsRef.current.bands],
      preamp: settingsRef.current.preamp,
      bassBoost: settingsRef.current.bassBoost,
      treble: settingsRef.current.treble,
    };

    const customOnly = presets.filter((p) => !p.isBuiltIn);
    const updatedCustom = [...customOnly, newPreset];
    setPresets([...BUILT_IN_PRESETS, ...updatedCustom]);

    try {
      localStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updatedCustom));
    } catch (e) {
      console.warn('Failed to save preset to storage:', e);
    }

    patch({ activePresetId: id });
  };

  const renameCustomPreset = (presetId: string, newName: string) => {
    const customOnly = presets.filter((p) => !p.isBuiltIn);
    const updatedCustom = customOnly.map((p) => (p.id === presetId ? { ...p, name: newName } : p));
    setPresets([...BUILT_IN_PRESETS, ...updatedCustom]);

    try {
      localStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updatedCustom));
    } catch (e) {}
  };

  const deleteCustomPreset = (presetId: string) => {
    const customOnly = presets.filter((p) => !p.isBuiltIn && p.id !== presetId);
    setPresets([...BUILT_IN_PRESETS, ...customOnly]);

    try {
      localStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(customOnly));
    } catch (e) {}

    if (settingsRef.current.activePresetId === presetId) {
      patch({ activePresetId: null });
    }
  };

  return (
    <DSPContext.Provider
      value={{
        settings,
        presets,
        limiterMetrics,
        setBandGain,
        setAllBands,
        setPreamp,
        setBassBoost,
        setTreble,
        setBalance,
        toggleMonoMix,
        toggleDSPEnabled,
        toggleLimiter,
        resetToFlat,
        applyPreset,
        saveCustomPreset,
        renameCustomPreset,
        deleteCustomPreset,
      }}
    >
      {children}
    </DSPContext.Provider>
  );
};

export const useDSP = (): DSPContextType => {
  const context = useContext(DSPContext);
  if (!context) {
    throw new Error('useDSP must be used within a DSPProvider');
  }
  return context;
};
