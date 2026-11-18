import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  DSPSettings,
  EQPreset,
  BUILT_IN_PRESETS,
  DEFAULT_PARAMETRIC_FILTERS,
  ParametricFilterConfig,
  LimiterMetrics,
} from '../types/dsp';
import { audioEngine } from '../services/audioEngine';

interface DSPContextType {
  settings: DSPSettings;
  presets: EQPreset[];
  limiterMetrics: LimiterMetrics;

  // Real-time Controls
  setEQMode: (mode: 'graphic' | 'parametric') => void;
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

  // Parametric Filter Controls
  addParametricFilter: (filter?: Partial<ParametricFilterConfig>) => void;
  updateParametricFilter: (id: string, updates: Partial<ParametricFilterConfig>) => void;
  removeParametricFilter: (id: string) => void;
  toggleParametricFilter: (id: string) => void;

  // Custom Preset Management
  saveCustomPreset: (name: string) => void;
  renameCustomPreset: (presetId: string, newName: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  exportPresetsAsJson: () => string;
  importPresetsFromJson: (jsonStr: string) => { success: boolean; count: number; error?: string };
  resetToDefaults: () => void;
}

const DSPContext = createContext<DSPContextType | null>(null);

const STORAGE_CUSTOM_PRESETS_KEY = 'harmoniq_custom_presets_v2';
const STORAGE_DSP_SETTINGS_KEY = 'harmoniq_dsp_settings_v2';

const DEFAULT_SETTINGS: DSPSettings = {
  enabled: true,
  eqMode: 'graphic',
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  parametricFilters: [...DEFAULT_PARAMETRIC_FILTERS],
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

function sanitizeParametricFilter(raw: any, index: number): ParametricFilterConfig {
  const validTypes = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass'];
  const type = validTypes.includes(raw?.type) ? raw.type : 'peaking';
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `p_${Date.now()}_${index}`,
    type,
    frequency: num(raw?.frequency, 20, 20000, 1000),
    gain: num(raw?.gain, -18, 18, 0),
    q: num(raw?.q, 0.1, 18.0, 1.0),
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
  };
}

/** Merge untrusted persisted settings over defaults so stale/corrupt storage can never crash the engine. */
function sanitizeSettings(raw: any): DSPSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') {
    return {
      ...d,
      bands: [...d.bands],
      parametricFilters: [...d.parametricFilters],
    };
  }

  const bands = Array.isArray(raw.bands)
    ? d.bands.map((_, i) => num(raw.bands[i], -12, 12, 0))
    : [...d.bands];

  const parametricFilters = Array.isArray(raw.parametricFilters) && raw.parametricFilters.length > 0
    ? raw.parametricFilters.slice(0, 12).map(sanitizeParametricFilter)
    : [...d.parametricFilters];

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    eqMode: raw.eqMode === 'parametric' ? 'parametric' : 'graphic',
    bands,
    parametricFilters,
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
  const [settings, setSettings] = useState<DSPSettings>(() => ({
    ...DEFAULT_SETTINGS,
    bands: [...DEFAULT_SETTINGS.bands],
    parametricFilters: [...DEFAULT_SETTINGS.parametricFilters],
  }));
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
          const validatedCustom: EQPreset[] = parsed
            .filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string')
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              isBuiltIn: false,
              mode: p.mode === 'parametric' ? 'parametric' : 'graphic',
              bands: Array.isArray(p.bands) ? p.bands.map((b: any) => num(b, -12, 12, 0)) : [...DEFAULT_SETTINGS.bands],
              parametricFilters: Array.isArray(p.parametricFilters)
                ? p.parametricFilters.map(sanitizeParametricFilter)
                : [...DEFAULT_SETTINGS.parametricFilters],
              preamp: num(p.preamp, -12, 12, 0),
              bassBoost: num(p.bassBoost, 0, 12, 0),
              treble: num(p.treble, -6, 12, 0),
            }));

          setPresets([...BUILT_IN_PRESETS, ...validatedCustom]);
        }
      }

      const savedSettings = localStorage.getItem(STORAGE_DSP_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = sanitizeSettings(JSON.parse(savedSettings));
        settingsRef.current = parsedSettings;
        setSettings(parsedSettings);
        audioEngine.applyDSPSettings(parsedSettings);
      } else {
        audioEngine.applyDSPSettings(settingsRef.current);
      }
    } catch (e) {
      console.warn('Failed to load saved DSP configuration:', e);
    }
  }, []);

  // Poll limiter reduction metrics at 15Hz for smooth UI meter
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = audioEngine.getLimiterMetrics();
      setLimiterMetrics((prev) =>
        prev.isClippingPrevented === metrics.isClippingPrevented &&
        Math.abs(prev.gainReductionDb - metrics.gainReductionDb) < 0.2
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

  const patch = (changes: Partial<DSPSettings>) => updateSettings({ ...settingsRef.current, ...changes });

  const setEQMode = (mode: 'graphic' | 'parametric') => {
    patch({ eqMode: mode, activePresetId: null });
  };

  const setBandGain = (bandIndex: number, gainDb: number) => {
    if (bandIndex < 0 || bandIndex >= settingsRef.current.bands.length) return;
    const newBands = [...settingsRef.current.bands];
    newBands[bandIndex] = num(gainDb, -12, 12, 0);
    patch({ bands: newBands, activePresetId: null });
  };

  const setAllBands = (bands: number[]) => {
    patch({
      bands: DEFAULT_SETTINGS.bands.map((_, i) => num(bands[i], -12, 12, 0)),
      activePresetId: null,
    });
  };

  const setPreamp = (gainDb: number) => patch({ preamp: num(gainDb, -12, 12, 0), activePresetId: null });
  const setBassBoost = (gainDb: number) => patch({ bassBoost: num(gainDb, 0, 12, 0), activePresetId: null });
  const setTreble = (gainDb: number) => patch({ treble: num(gainDb, -6, 12, 0), activePresetId: null });
  const setBalance = (balance: number) => patch({ balance: num(balance, -1, 1, 0) });
  const toggleMonoMix = () => patch({ monoMix: !settingsRef.current.monoMix });
  const toggleDSPEnabled = () => patch({ enabled: !settingsRef.current.enabled });
  const toggleLimiter = () => patch({ limiterEnabled: !settingsRef.current.limiterEnabled });

  // Parametric Filter Actions
  const addParametricFilter = (filter?: Partial<ParametricFilterConfig>) => {
    if (settingsRef.current.parametricFilters.length >= 12) return;
    const newFilter: ParametricFilterConfig = {
      id: `p_${Date.now()}`,
      type: filter?.type || 'peaking',
      frequency: num(filter?.frequency, 20, 20000, 1000),
      gain: num(filter?.gain, -18, 18, 0),
      q: num(filter?.q, 0.1, 18.0, 1.414),
      enabled: filter?.enabled !== false,
    };
    patch({
      parametricFilters: [...settingsRef.current.parametricFilters, newFilter],
      activePresetId: null,
    });
  };

  const updateParametricFilter = (id: string, updates: Partial<ParametricFilterConfig>) => {
    const updated = settingsRef.current.parametricFilters.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        type: updates.type || f.type,
        frequency: updates.frequency !== undefined ? num(updates.frequency, 20, 20000, f.frequency) : f.frequency,
        gain: updates.gain !== undefined ? num(updates.gain, -18, 18, f.gain) : f.gain,
        q: updates.q !== undefined ? num(updates.q, 0.1, 18.0, f.q) : f.q,
        enabled: updates.enabled !== undefined ? updates.enabled : f.enabled,
      };
    });
    patch({ parametricFilters: updated, activePresetId: null });
  };

  const removeParametricFilter = (id: string) => {
    const remaining = settingsRef.current.parametricFilters.filter((f) => f.id !== id);
    patch({ parametricFilters: remaining, activePresetId: null });
  };

  const toggleParametricFilter = (id: string) => {
    const updated = settingsRef.current.parametricFilters.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    patch({ parametricFilters: updated, activePresetId: null });
  };

  const resetToFlat = () => {
    if (settingsRef.current.eqMode === 'graphic') {
      applyPreset('flat');
    } else {
      patch({
        parametricFilters: DEFAULT_PARAMETRIC_FILTERS.map((f, i) => ({ ...f, id: `p_reset_${i}`, gain: 0 })),
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        activePresetId: 'flat',
      });
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const targetMode = preset.mode || 'graphic';
    patch({
      eqMode: targetMode,
      bands: Array.isArray(preset.bands) ? [...preset.bands] : [...DEFAULT_SETTINGS.bands],
      parametricFilters: Array.isArray(preset.parametricFilters) && preset.parametricFilters.length > 0
        ? preset.parametricFilters.map(sanitizeParametricFilter)
        : [...DEFAULT_PARAMETRIC_FILTERS],
      preamp: preset.preamp,
      bassBoost: preset.bassBoost || 0,
      treble: preset.treble || 0,
      activePresetId: preset.id,
    });
  };

  const saveCustomPreset = (name: string) => {
    const id = `custom_${Date.now()}`;
    const currentMode = settingsRef.current.eqMode;
    const newPreset: EQPreset = {
      id,
      name: name.trim() || 'Custom Preset',
      isBuiltIn: false,
      mode: currentMode,
      bands: [...settingsRef.current.bands],
      parametricFilters: settingsRef.current.parametricFilters.map((f) => ({ ...f })),
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
    const updatedCustom = customOnly.map((p) => (p.id === presetId ? { ...p, name: newName.trim() || p.name } : p));
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

  const exportPresetsAsJson = (): string => {
    const customOnly = presets.filter((p) => !p.isBuiltIn);
    return JSON.stringify(
      {
        format: 'harmoniq_eq_presets',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        presets: customOnly,
      },
      null,
      2
    );
  };

  const importPresetsFromJson = (jsonStr: string): { success: boolean; count: number; error?: string } => {
    try {
      const parsed = JSON.parse(jsonStr);
      const incomingList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.presets) ? parsed.presets : null;
      if (!incomingList) {
        return { success: false, count: 0, error: 'Invalid preset file format: array of presets expected' };
      }

      const validated: EQPreset[] = [];
      for (const item of incomingList) {
        if (!item || typeof item.name !== 'string') continue;
        const validBands = Array.isArray(item.bands)
          ? item.bands.map((b: any) => num(b, -12, 12, 0))
          : [...DEFAULT_SETTINGS.bands];
        const validParametric = Array.isArray(item.parametricFilters)
          ? item.parametricFilters.map(sanitizeParametricFilter)
          : [...DEFAULT_PARAMETRIC_FILTERS];

        validated.push({
          id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: String(item.name).slice(0, 50),
          isBuiltIn: false,
          mode: item.mode === 'parametric' ? 'parametric' : 'graphic',
          bands: validBands,
          parametricFilters: validParametric,
          preamp: num(item.preamp, -12, 12, 0),
          bassBoost: num(item.bassBoost, 0, 12, 0),
          treble: num(item.treble, -6, 12, 0),
        });
      }

      if (validated.length === 0) {
        return { success: false, count: 0, error: 'No valid presets found in the imported file' };
      }

      const existingCustom = presets.filter((p) => !p.isBuiltIn);
      const combined = [...existingCustom, ...validated];
      setPresets([...BUILT_IN_PRESETS, ...combined]);

      try {
        localStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(combined));
      } catch (e) {}

      return { success: true, count: validated.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Failed to parse JSON' };
    }
  };

  const resetToDefaults = () => {
    try {
      localStorage.removeItem(STORAGE_CUSTOM_PRESETS_KEY);
      localStorage.removeItem(STORAGE_DSP_SETTINGS_KEY);
    } catch (e) {}

    setPresets(BUILT_IN_PRESETS);
    updateSettings({
      ...DEFAULT_SETTINGS,
      bands: [...DEFAULT_SETTINGS.bands],
      parametricFilters: [...DEFAULT_SETTINGS.parametricFilters],
    });
  };

  return (
    <DSPContext.Provider
      value={{
        settings,
        presets,
        limiterMetrics,
        setEQMode,
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
        addParametricFilter,
        updateParametricFilter,
        removeParametricFilter,
        toggleParametricFilter,
        saveCustomPreset,
        renameCustomPreset,
        deleteCustomPreset,
        exportPresetsAsJson,
        importPresetsFromJson,
        resetToDefaults,
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
