import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  DSPSettings,
  EQPreset,
  BUILT_IN_PRESETS,
  DEFAULT_PARAMETRIC_FILTERS,
  ParametricFilterConfig,
  LimiterMetrics,
  ChannelMode,
} from '../types/dsp';
import { SoundProfile } from '../types/soundProfile';
import { TrackAudioProfile } from '../types/trackAudioProfile';
import { DeviceAudioProfile } from '../types/deviceAudioProfile';
import { TruthfulAudioQualityReport } from '../types/audioQuality';
import { TrackMetadata } from '../types/audio';
import { audioEngine } from '../services/audioEngine';
import { soundProfileService } from '../services/audio/soundProfileService';
import { trackAudioProfileService } from '../services/audio/trackAudioProfileService';
import { audioDeviceProfileService } from '../services/audio/audioDeviceProfileService';
import { AudioConfigurationResolver } from '../services/audio/audioConfigurationResolver';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { windowLifecycleService } from '../services/windowLifecycleService';

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
  resetBalance: () => void;
  setStereoWidth: (widthPercent: number) => void;
  toggleStereoWidth: () => void;
  resetStereoWidth: () => void;
  setChannelMode: (mode: ChannelMode) => void;
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
  auditionFilterId: string | null;
  soloFilter: (id: string | null) => void;
  importAutoEqProfile: (filters: ParametricFilterConfig[], preamp?: number) => void;

  // Custom Preset Management
  saveCustomPreset: (name: string) => void;
  renameCustomPreset: (presetId: string, newName: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  exportPresetsAsJson: () => string;
  importPresetsFromJson: (jsonStr: string) => { success: boolean; count: number; error?: string };
  resetToDefaults: () => void;

  // Sound Profiles System (Phase 5B.3)
  soundProfiles: SoundProfile[];
  activeSoundProfileId: string;
  applySoundProfile: (profileId: string) => void;
  isProfileModified: boolean;
  saveCurrentAsProfile: (name: string, description?: string) => SoundProfile;
  restoreActiveProfile: () => void;
  deleteCustomProfile: (profileId: string) => boolean;
  duplicateSoundProfile: (profileId: string, customName?: string) => SoundProfile | null;

  // Per-Track EQ Memory (Phase 5B.4)
  currentTrackProfile: TrackAudioProfile | null;
  saveCurrentForTrack: (track: TrackMetadata) => TrackAudioProfile;
  removeTrackProfile: (track: TrackMetadata | string) => boolean;
  toggleTrackProfile: (track: TrackMetadata, enabled: boolean) => void;
  allTrackProfiles: TrackAudioProfile[];

  // Per-Device Audio Profiles (Phase 5B.5)
  deviceProfiles: DeviceAudioProfile[];
  saveDevicePreferences: (
    deviceId: string,
    updates: { preferredVolume?: number; preferredSoundProfileId?: string; deviceLabel?: string }
  ) => DeviceAudioProfile;

  // Audio Quality Intelligence (Phase 5B.6)
  getQualityReport: (track: TrackMetadata | null, volume: number, replayGainActive: boolean) => TruthfulAudioQualityReport | null;
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
  channelMode: 'stereo',
  limiterEnabled: true,
  activePresetId: 'flat',
  stereoWidth: 100,
  stereoWidthEnabled: false,
};

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

function sanitizeParametricFilter(raw: any, index: number): ParametricFilterConfig {
  const validTypes = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];
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
    channelMode: ['stereo', 'mono', 'left_only', 'right_only'].includes(raw.channelMode)
      ? raw.channelMode
      : raw.monoMix
      ? 'mono'
      : 'stereo',
    limiterEnabled: typeof raw.limiterEnabled === 'boolean' ? raw.limiterEnabled : d.limiterEnabled,
    activePresetId: typeof raw.activePresetId === 'string' ? raw.activePresetId : null,
    stereoWidth: num(raw.stereoWidth, 0, 150, 100),
    stereoWidthEnabled: typeof raw.stereoWidthEnabled === 'boolean' ? raw.stereoWidthEnabled : false,
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
  const [auditionFilterId, setAuditionFilterId] = useState<string | null>(null);
  const auditionFilterIdRef = useRef<string | null>(null);
  auditionFilterIdRef.current = auditionFilterId;

  // Sound Profiles & Device Profiles State
  const [soundProfiles, setSoundProfiles] = useState<SoundProfile[]>(() => soundProfileService.getAllProfiles());
  const [activeSoundProfileId, setActiveSoundProfileId] = useState<string>(() => {
    try {
      return localStorage.getItem('harmoniq_active_sound_profile_id') || 'neutral_reference';
    } catch {
      return 'neutral_reference';
    }
  });
  const [deviceProfiles, setDeviceProfiles] = useState<DeviceAudioProfile[]>(() => audioDeviceProfileService.getAllProfiles());
  const [allTrackProfiles, setAllTrackProfiles] = useState<TrackAudioProfile[]>(() => trackAudioProfileService.getAllTrackProfiles());
  const [currentTrackProfile, setCurrentTrackProfile] = useState<TrackAudioProfile | null>(null);

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

  // Event-driven limiter metrics polling: only polls during active playback when window is visible
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      setLimiterMetrics((prev) =>
        prev.isClippingPrevented === false && prev.gainReductionDb === 0
          ? prev
          : { isClippingPrevented: false, gainReductionDb: 0, peakLevel: 0 }
      );
    };

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (windowLifecycleService.isRenderingSuspended() || !audioEngine.isPlaying()) {
          stopPolling();
          return;
        }

        const metrics = audioEngine.getLimiterMetrics();
        setLimiterMetrics((prev) =>
          prev.isClippingPrevented === metrics.isClippingPrevented &&
          Math.abs(prev.gainReductionDb - metrics.gainReductionDb) < 0.2
            ? prev
            : metrics
        );
      }, 66);
    };

    // Listen to playback status changes
    const unsubStatus = audioEngine.subscribeStatus((status) => {
      if (status.isPlaying && !windowLifecycleService.isRenderingSuspended()) {
        startPolling();
      } else {
        stopPolling();
      }
    });

    // Listen to window lifecycle changes (minimize/restore, hide/show)
    const unsubLifecycle = windowLifecycleService.subscribeSuspension((suspended) => {
      if (!suspended && audioEngine.isPlaying()) {
        startPolling();
      } else {
        stopPolling();
      }
    });

    // Initial check
    if (audioEngine.isPlaying() && !windowLifecycleService.isRenderingSuspended()) {
      startPolling();
    }

    return () => {
      if (interval) clearInterval(interval);
      unsubStatus();
      unsubLifecycle();
    };
  }, []);

  const getEffectiveSettingsForEngine = useCallback(
    (baseSettings: DSPSettings, soloId: string | null): DSPSettings => {
      if (!soloId || baseSettings.eqMode !== 'parametric') {
        return baseSettings;
      }
      return {
        ...baseSettings,
        parametricFilters: baseSettings.parametricFilters.map((f) => {
          if (f.id === soloId) return f;
          return {
            ...f,
            gain: 0,
          };
        }),
      };
    },
    []
  );

  // Sync settings with audio engine and localStorage
  const updateSettings = useCallback(
    (newSettings: DSPSettings, overrideSoloId?: string | null) => {
      settingsRef.current = newSettings;
      setSettings(newSettings);
      const currentSolo = overrideSoloId !== undefined ? overrideSoloId : auditionFilterIdRef.current;
      const effective = getEffectiveSettingsForEngine(newSettings, currentSolo);
      audioEngine.applyDSPSettings(effective);
      try {
        localStorage.setItem(STORAGE_DSP_SETTINGS_KEY, JSON.stringify(newSettings));
      } catch (e) {
        // Ignore storage errors
      }
    },
    [getEffectiveSettingsForEngine]
  );

  const patch = (changes: Partial<DSPSettings>) => updateSettings({ ...settingsRef.current, ...changes });

  const setEQMode = (mode: 'graphic' | 'parametric') => {
    setAuditionFilterId(null);
    auditionFilterIdRef.current = null;
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
  const resetBalance = () => patch({ balance: 0 });
  const setStereoWidth = (widthPercent: number) => patch({ stereoWidth: num(widthPercent, 0, 150, 100) });
  const toggleStereoWidth = () => patch({ stereoWidthEnabled: !settingsRef.current.stereoWidthEnabled });
  const resetStereoWidth = () => patch({ stereoWidth: 100 });
  const setChannelMode = (mode: ChannelMode) => {
    patch({
      channelMode: mode,
      monoMix: mode === 'mono',
    });
  };
  const toggleMonoMix = () => {
    const nextMode = settingsRef.current.channelMode === 'mono' ? 'stereo' : 'mono';
    patch({
      channelMode: nextMode,
      monoMix: nextMode === 'mono',
    });
  };
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
    if (auditionFilterIdRef.current === id) {
      setAuditionFilterId(null);
      auditionFilterIdRef.current = null;
    }
    const remaining = settingsRef.current.parametricFilters.filter((f) => f.id !== id);
    patch({ parametricFilters: remaining, activePresetId: null });
  };

  const toggleParametricFilter = (id: string) => {
    if (auditionFilterIdRef.current === id) {
      setAuditionFilterId(null);
      auditionFilterIdRef.current = null;
    }
    const updated = settingsRef.current.parametricFilters.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    patch({ parametricFilters: updated, activePresetId: null });
  };

  const soloFilter = useCallback(
    (id: string | null) => {
      const nextSolo = auditionFilterIdRef.current === id ? null : id;
      setAuditionFilterId(nextSolo);
      auditionFilterIdRef.current = nextSolo;
      const effective = getEffectiveSettingsForEngine(settingsRef.current, nextSolo);
      audioEngine.applyDSPSettings(effective);
    },
    [getEffectiveSettingsForEngine]
  );

  const importAutoEqProfile = useCallback(
    (filters: ParametricFilterConfig[], newPreamp?: number) => {
      setAuditionFilterId(null);
      auditionFilterIdRef.current = null;
      const sanitized = filters.slice(0, 12).map(sanitizeParametricFilter);
      patch({
        eqMode: 'parametric',
        parametricFilters: sanitized,
        preamp:
          newPreamp !== undefined
            ? num(newPreamp, -12, 12, settingsRef.current.preamp)
            : settingsRef.current.preamp,
        activePresetId: null,
      });
    },
    []
  );

  const resetToFlat = () => {
    setAuditionFilterId(null);
    auditionFilterIdRef.current = null;
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

    setAuditionFilterId(null);
    auditionFilterIdRef.current = null;

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
      stereoWidth: preset.stereoWidth !== undefined ? num(preset.stereoWidth, 0, 150, 100) : settingsRef.current.stereoWidth ?? 100,
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

  // Sound Profile Methods
  const applySoundProfile = useCallback(
    (profileId: string) => {
      const profile = soundProfileService.getProfileById(profileId);
      if (!profile) return;

      setAuditionFilterId(null);
      auditionFilterIdRef.current = null;
      setActiveSoundProfileId(profileId);
      try {
        localStorage.setItem('harmoniq_active_sound_profile_id', profileId);
      } catch {}

      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: profile,
        currentVolume: 1.0,
      });

      updateSettings(resolved.settings);
    },
    [updateSettings]
  );

  const saveCurrentAsProfile = useCallback(
    (name: string, description?: string) => {
      const s = settingsRef.current;
      const created = soundProfileService.createCustomProfile({
        name,
        description: description || 'Custom user sound profile',
        category: 'custom',
        icon: 'Sliders',
        mode: s.eqMode,
        bands: [...s.bands],
        parametricFilters: s.parametricFilters.map((f) => ({ ...f })),
        preamp: s.preamp,
        bassBoost: s.bassBoost,
        treble: s.treble,
        stereoWidth: s.stereoWidth ?? 100,
        stereoWidthEnabled: !!s.stereoWidthEnabled,
        channelMode: s.channelMode,
      });

      setSoundProfiles(soundProfileService.getAllProfiles());
      setActiveSoundProfileId(created.id);
      try {
        localStorage.setItem('harmoniq_active_sound_profile_id', created.id);
      } catch {}
      return created;
    },
    []
  );

  const restoreActiveProfile = useCallback(() => {
    applySoundProfile(activeSoundProfileId);
  }, [activeSoundProfileId, applySoundProfile]);

  const duplicateSoundProfile = useCallback((profileId: string, customName?: string) => {
    const dup = soundProfileService.duplicateProfile(profileId, customName);
    if (dup) {
      setSoundProfiles(soundProfileService.getAllProfiles());
      setActiveSoundProfileId(dup.id);
      try {
        localStorage.setItem('harmoniq_active_sound_profile_id', dup.id);
      } catch {}
    }
    return dup;
  }, []);

  const deleteCustomProfile = useCallback(
    (profileId: string) => {
      const deleted = soundProfileService.deleteCustomProfile(profileId);
      if (deleted) {
        setSoundProfiles(soundProfileService.getAllProfiles());
        if (activeSoundProfileId === profileId) {
          applySoundProfile('neutral_reference');
        }
      }
      return deleted;
    },
    [activeSoundProfileId, applySoundProfile]
  );

  const activeSoundProfile =
    soundProfileService.getProfileById(activeSoundProfileId) ||
    soundProfileService.getProfileById('neutral_reference')!;

  const isProfileModified = soundProfileService.isProfileModified(
    activeSoundProfile,
    settings.bands,
    settings.parametricFilters,
    settings.preamp,
    settings.bassBoost,
    settings.treble,
    settings.stereoWidth ?? 100
  );

  // Per-Track EQ Methods
  const saveCurrentForTrack = useCallback((track: TrackMetadata) => {
    const s = settingsRef.current;
    const saved = trackAudioProfileService.saveProfileForTrack(track, {
      mode: s.eqMode,
      bands: [...s.bands],
      parametricFilters: s.parametricFilters.map((f) => ({ ...f })),
      preampOverride: s.preamp,
      enabled: true,
    });
    setCurrentTrackProfile(saved);
    setAllTrackProfiles(trackAudioProfileService.getAllTrackProfiles());
    return saved;
  }, []);

  const removeTrackProfile = useCallback(
    (track: TrackMetadata | string) => {
      const ok = trackAudioProfileService.removeProfileForTrack(track);
      if (ok) {
        setCurrentTrackProfile(null);
        setAllTrackProfiles(trackAudioProfileService.getAllTrackProfiles());
        restoreActiveProfile();
      }
      return ok;
    },
    [restoreActiveProfile]
  );

  const toggleTrackProfile = useCallback(
    (track: TrackMetadata, enabled: boolean) => {
      const updated = trackAudioProfileService.toggleTrackProfile(track, enabled);
      setCurrentTrackProfile(updated);
      setAllTrackProfiles(trackAudioProfileService.getAllTrackProfiles());
      if (!enabled) {
        restoreActiveProfile();
      } else if (updated) {
        const global =
          soundProfileService.getProfileById(activeSoundProfileId) ||
          soundProfileService.getProfileById('neutral_reference')!;
        const resolved = AudioConfigurationResolver.resolve({
          globalProfile: global,
          trackProfile: updated,
          currentVolume: 1.0,
        });
        updateSettings(resolved.settings);
      }
    },
    [activeSoundProfileId, restoreActiveProfile, updateSettings]
  );

  // Per-Device Preferences Methods
  const saveDevicePreferences = useCallback(
    (
      deviceId: string,
      updates: { preferredVolume?: number; preferredSoundProfileId?: string; deviceLabel?: string }
    ) => {
      const saved = audioDeviceProfileService.saveDevicePreferences(deviceId, updates);
      setDeviceProfiles(audioDeviceProfileService.getAllProfiles());
      return saved;
    },
    []
  );

  // Truthful Audio Quality Report
  const getQualityReport = useCallback(
    (track: TrackMetadata | null, volume: number, replayGainActive: boolean) => {
      const audioCtx = (audioEngine as any).audioCtx as AudioContext | null;
      const activeSink = audioEngine.getCurrentSinkId();
      const devProfile = audioDeviceProfileService.getProfileForDevice({ deviceId: activeSink });
      const deviceLabel =
        devProfile?.deviceLabel || (activeSink === 'default' ? 'Default Windows Audio Endpoint' : activeSink);
      return AudioQualityService.generateReport(
        track,
        audioCtx,
        settingsRef.current,
        limiterMetrics,
        volume,
        replayGainActive,
        deviceLabel
      );
    },
    [limiterMetrics]
  );

  // Register track EQ resolver with audioEngine so dual-deck playback and preloading always have access to resolved settings
  useEffect(() => {
    audioEngine.registerTrackEQResolver((track) => {
      const profile = trackAudioProfileService.getProfileForTrack(track);
      const global =
        soundProfileService.getProfileById(activeSoundProfileId) ||
        soundProfileService.getProfileById('neutral_reference')!;
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: global,
        trackProfile: profile,
        currentVolume: 1.0,
      });
      return resolved.settings;
    });

    return () => {
      audioEngine.registerTrackEQResolver(null);
    };
  }, [activeSoundProfileId]);

  // Listen to track transitions for per-track EQ memory restoration
  useEffect(() => {
    const unsub = audioEngine.subscribeTrackTransition((nextTrack, type) => {
      const profile = trackAudioProfileService.getProfileForTrack(nextTrack);
      setCurrentTrackProfile(profile);

      const global =
        soundProfileService.getProfileById(activeSoundProfileId) ||
        soundProfileService.getProfileById('neutral_reference')!;
      const resolved = AudioConfigurationResolver.resolve({
        globalProfile: global,
        trackProfile: profile,
        currentVolume: 1.0,
      });

      if (type === 'crossfade' || type === 'fade_out_fade_in') {
        // Dual-deck independence: Apply incoming track settings to the standby deck (the incoming deck)!
        // Outgoing active deck retains its existing track EQ throughout the transition!
        audioEngine.setStandbyDeckDSPSettings(resolved.settings);
      } else {
        updateSettings(resolved.settings);
      }
    });

    return () => unsub();
  }, [activeSoundProfileId, updateSettings]);

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
        resetBalance,
        setStereoWidth,
        toggleStereoWidth,
        resetStereoWidth,
        setChannelMode,
        toggleMonoMix,
        toggleDSPEnabled,
        toggleLimiter,
        resetToFlat,
        applyPreset,
        addParametricFilter,
        updateParametricFilter,
        removeParametricFilter,
        toggleParametricFilter,
        auditionFilterId,
        soloFilter,
        importAutoEqProfile,
        saveCustomPreset,
        renameCustomPreset,
        deleteCustomPreset,
        exportPresetsAsJson,
        importPresetsFromJson,
        resetToDefaults,
        // Sound Profiles System (Phase 5B.3)
        soundProfiles,
        activeSoundProfileId,
        applySoundProfile,
        isProfileModified,
        saveCurrentAsProfile,
        restoreActiveProfile,
        deleteCustomProfile,
        duplicateSoundProfile,
        // Per-Track EQ Memory (Phase 5B.4)
        currentTrackProfile,
        saveCurrentForTrack,
        removeTrackProfile,
        toggleTrackProfile,
        allTrackProfiles,
        // Per-Device Audio Profiles (Phase 5B.5)
        deviceProfiles,
        saveDevicePreferences,
        // Audio Quality Intelligence (Phase 5B.6)
        getQualityReport,
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
