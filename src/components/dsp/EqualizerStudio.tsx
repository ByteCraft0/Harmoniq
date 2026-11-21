import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDSP } from '../../context/DSPContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { EQ_FREQUENCIES, ParametricFilterType, ParametricFilterConfig } from '../../types/dsp';
import { audioEngine } from '../../services/audioEngine';
import { soundProfileService } from '../../services/audio/soundProfileService';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { ParametricEQCurve } from './ParametricEQCurve';
import { AutoEqImportModal } from './AutoEqImportModal';
import { VinylAudioDial } from './VinylAudioDial';
import { GraphicEQBand } from './GraphicEQBand';
import { windowLifecycleService } from '../../services/windowLifecycleService';
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
  Download,
  Upload,
  Edit2,
  Settings2,
  SlidersHorizontal,
  X,
  Gauge,
  HelpCircle,
  Headphones,
  Speaker,
  Music2,
  Disc,
  Mic2,
  Guitar,
  Radio,
  Zap,
  Moon,
  Maximize2,
  FileAudio,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Copy,
  Info,
} from 'lucide-react';

type StudioTab = 'equalizer' | 'profiles' | 'track_eq' | 'devices' | 'quality';

export const EqualizerStudio: React.FC = () => {
  const {
    settings,
    presets,
    limiterMetrics,
    setEQMode,
    setBandGain,
    setPreamp,
    setBassBoost,
    setTreble,
    setBalance,
    resetBalance,
    setChannelMode,
    setStereoWidth,
    toggleStereoWidth,
    resetStereoWidth,
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
    // Phase 5B.3 Sound Profiles
    soundProfiles,
    activeSoundProfileId,
    applySoundProfile,
    isProfileModified,
    saveCurrentAsProfile,
    restoreActiveProfile,
    deleteCustomProfile,
    duplicateSoundProfile,
    // Phase 5B.4 Per-Track EQ Memory
    currentTrackProfile,
    saveCurrentForTrack,
    removeTrackProfile,
    toggleTrackProfile,
    allTrackProfiles,
    // Phase 5B.5 Per-Device Profiles
    deviceProfiles,
    saveDevicePreferences,
    // Phase 5B.6 Quality Intelligence
    getQualityReport,
  } = useDSP();

  const {
    currentTrack,
    isPlaying,
    volume,
    replayGainMode,
    outputDevices,
    currentDeviceId,
    setOutputDevice,
    refreshOutputDevices,
  } = usePlayer();

  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<StudioTab>('equalizer');

  // Modal & Edit States
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAutoEqModal, setShowAutoEqModal] = useState(false);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Profile Save Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  // Track search filter for Track EQ Library table
  const [trackSearchQuery, setTrackSearchQuery] = useState('');

  // Graphic EQ Canvas Ref
  const graphicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Living Equalizer sub-band energies state (throttled ~25-30fps, zero-allocation when paused or suspended)
  const [bandEnergies, setBandEnergies] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!isPlaying) {
      setBandEnergies({});
      return;
    }

    let animId: number;
    let lastTime = 0;
    const update = (time: number) => {
      if (time - lastTime >= 35 && !windowLifecycleService.isRenderingSuspended()) {
        lastTime = time;
        const e = audioEngine?.getSubBandEnergies?.() ?? {
          subBass: 0,
          bass: 0,
          lowMid: 0,
          mid: 0,
          upperMid: 0,
          presence: 0,
          brilliance: 0,
        };
        setBandEnergies({
          31: e.subBass,
          62: e.bass,
          125: (e.bass + e.lowMid) / 2,
          250: e.lowMid,
          500: e.mid,
          1000: (e.mid + e.upperMid) / 2,
          2000: e.upperMid,
          4000: e.presence,
          8000: (e.presence + e.brilliance) / 2,
          16000: e.brilliance,
        });
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`;
  };

  const getProfileIcon = (iconName: string) => {
    switch (iconName) {
      case 'Activity':
        return <Activity size={18} />;
      case 'Disc':
        return <Disc size={18} />;
      case 'Mic2':
        return <Mic2 size={18} />;
      case 'Guitar':
        return <Guitar size={18} />;
      case 'Music2':
        return <Music2 size={18} />;
      case 'Radio':
        return <Radio size={18} />;
      case 'Zap':
        return <Zap size={18} />;
      case 'Headphones':
        return <Headphones size={18} />;
      case 'Moon':
        return <Moon size={18} />;
      case 'Maximize2':
        return <Maximize2 size={18} />;
      default:
        return <Sparkles size={18} />;
    }
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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProfileName.trim()) {
      saveCurrentAsProfile(newProfileName.trim(), newProfileDesc.trim());
      showToast(`Sound profile "${newProfileName.trim()}" saved`, 'success');
      setNewProfileName('');
      setNewProfileDesc('');
      setShowProfileModal(false);
    }
  };

  const handleExportPresets = () => {
    try {
      const json = exportPresetsAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `harmoniq_eq_presets_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Custom presets exported to JSON file', 'success');
    } catch {
      showToast('Failed to export presets', 'warning');
    }
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importPresetsFromJson(content);
        if (result.success) {
          showToast(`Successfully imported ${result.count} custom presets`, 'success');
        } else {
          showToast(result.error || 'Failed to import presets', 'warning');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Render 10-Band Graphic EQ Response Curve
  useEffect(() => {
    if (settings.eqMode !== 'graphic') return;
    const canvas = graphicCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, width, height);

    const minFreq = 20;
    const maxFreq = 20000;
    const rangeDb = 24;
    const centerY = height / 2;

    const freqToX = (freq: number) => {
      const minLog = Math.log10(minFreq);
      const maxLog = Math.log10(maxFreq);
      const logVal = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
      return ((logVal - minLog) / (maxLog - minLog)) * (width - 40) + 20;
    };

    const gainToY = (gain: number) => {
      const clamped = Math.max(-14, Math.min(14, gain));
      return centerY - (clamped / rangeDb) * (height - 30);
    };

    // Draw Grid Lines (Muted Charcoal & Violet)
    const gridFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    gridFreqs.forEach((gf) => {
      const gx = freqToX(gf);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();

      ctx.fillStyle = '#52525B';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatFreq(gf), gx, height - 6);
    });

    // Horizontal dB lines
    const dbLines = [12, 6, 0, -6, -12];
    dbLines.forEach((db) => {
      const gy = gainToY(db);
      ctx.strokeStyle = db === 0 ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();

      ctx.fillStyle = db === 0 ? '#A78BFA' : '#52525B';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, 4, gy - 2);
    });

    // Sample 160 points for physical BiquadFilter response curve
    const numSamples = 160;
    const testFreqs = new Float32Array(numSamples);
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);

    for (let i = 0; i < numSamples; i++) {
      const logVal = minLog + (i / (numSamples - 1)) * (maxLog - minLog);
      testFreqs[i] = Math.pow(10, logVal);
    }

    const responseDb = audioEngine.getCombinedFrequencyResponse(testFreqs);

    // Draw Curve with Muted Violet
    ctx.strokeStyle = settings.enabled ? '#A78BFA' : '#52525B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = freqToX(testFreqs[i]);
      const y = gainToY(responseDb[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Subtle gradient fill under curve
    if (settings.enabled) {
      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(167, 139, 250, 0.14)');
      fillGradient.addColorStop(0.6, 'rgba(139, 92, 246, 0.04)');
      fillGradient.addColorStop(1, 'rgba(9, 9, 11, 0)');

      ctx.lineTo(freqToX(testFreqs[numSamples - 1]), height / 2);
      ctx.lineTo(freqToX(testFreqs[0]), height / 2);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }

    // Draw 10-Band Graphic EQ nodes on curve
    EQ_FREQUENCIES.forEach((freq, idx) => {
      const gain = settings.bands[idx] ?? 0;
      const hx = freqToX(freq);
      const hy = gainToY(gain);
      ctx.fillStyle = settings.enabled ? '#A78BFA' : '#52525B';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#09090B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [settings, settings.bands, settings.enabled, settings.eqMode]);

  // Audio Quality Report computation for Quality Tab
  const qualityReport = getQualityReport(currentTrack, volume, replayGainMode !== 'off');

  // Filter track profiles based on search query
  const filteredTrackProfiles = allTrackProfiles.filter(
    (tp) =>
      tp.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
      tp.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
      (tp.album && tp.album.toLowerCase().includes(trackSearchQuery.toLowerCase()))
  );

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden px-6 sm:px-8 py-6 space-y-8 max-w-6xl mx-auto select-none scrollbar-thin bg-[#09090B]">
      {/* Studio Master Header */}
      <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[#111116] border border-[#292936] text-[#A78BFA] shadow-glow-sm">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#F5F3FF] tracking-tight">Equalizer & Audio DSP Studio</h2>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#111116] text-[#A78BFA] border border-[#292936]">
                  32-Bit Float DSP
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Audiophile 10-Band ISO Graphic • Parametric Nodes • Analog Vinyl Spatial Field • Anti-Clipping Limiter
              </p>
            </div>
          </div>

          {/* Master Controls: Reset Flat & DSP Active/Bypass */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetToFlat();
                showToast('Equalizer reset to Flat reference', 'info');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111116] hover:bg-[#1C1C26] border border-[#292936] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
              title="Reset active bands to 0 dB"
            >
              <RotateCcw size={14} />
              <span>Reset Flat</span>
            </button>

            <button
              onClick={() => {
                toggleDSPEnabled();
                showToast(settings.enabled ? 'DSP Bypassed' : 'DSP Active', 'info');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs border transition-all ${
                settings.enabled
                  ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6] text-[#A78BFA] shadow-glow-sm'
                  : 'bg-[#111116] border-[#292936] text-[#71717A]'
              }`}
            >
              <Power size={14} />
              <span>{settings.enabled ? 'DSP: ACTIVE' : 'DSP: BYPASS'}</span>
            </button>
          </div>
        </div>

        {/* Studio 5-Tab Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#292936]/80">
          <button
            onClick={() => setActiveTab('equalizer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'equalizer'
                ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1C1C26]'
            }`}
          >
            <Sliders size={14} className={activeTab === 'equalizer' ? 'text-[#A78BFA]' : ''} />
            <span>Equalizer & Effects</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all relative ${
              activeTab === 'profiles'
                ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1C1C26]'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'profiles' ? 'text-[#A78BFA]' : ''} />
            <span>Sound Profiles</span>
            {isProfileModified && (
              <span className="w-2 h-2 rounded-full bg-[#A78BFA] absolute top-1.5 right-1.5 animate-pulse" title="Profile modified" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('track_eq')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'track_eq'
                ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1C1C26]'
            }`}
          >
            <Music2 size={14} className={activeTab === 'track_eq' ? 'text-[#A78BFA]' : ''} />
            <span>Track EQ Memory</span>
            {currentTrackProfile && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[rgba(139,92,246,0.2)] text-[#A78BFA] border border-[#8B5CF6]/30 font-mono">
                OVERRIDE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'devices'
                ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1C1C26]'
            }`}
          >
            <Speaker size={14} className={activeTab === 'devices' ? 'text-[#A78BFA]' : ''} />
            <span>Audio Devices</span>
          </button>

          <button
            onClick={() => setActiveTab('quality')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'quality'
                ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1C1C26]'
            }`}
          >
            <Activity size={14} className={activeTab === 'quality' ? 'text-[#A78BFA]' : ''} />
            <span>Quality Transparency</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EQUALIZER STUDIO & AUDIO EFFECTS */}
      {/* ========================================================================= */}
      {activeTab === 'equalizer' && (
        <div className="space-y-8 animate-fade-in">
          {/* SECTION 1 — Equalizer Header & Acoustic Presets */}
          <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] space-y-3 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-[#A1A1AA] font-mono-numbers">
                  Acoustic Profiles & Tuned Presets
                </span>
                <p className="text-[11px] text-[#71717A]">
                  Select reference curve or save customized response curves to local disk.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-1.5 text-xs text-[#A78BFA] hover:text-[#F5F3FF] font-semibold transition-colors px-2.5 py-1.5 rounded-xl bg-[#111116] border border-[#292936] hover:border-[#8B5CF6]/50"
                >
                  <Plus size={13} />
                  <span>Save Preset</span>
                </button>

                <button
                  onClick={handleExportPresets}
                  title="Export custom presets as JSON"
                  className="flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors px-2 py-1.5 rounded-xl bg-[#111116] border border-[#292936] hover:bg-[#1C1C26]"
                >
                  <Download size={13} />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Import custom presets from JSON"
                  className="flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors px-2 py-1.5 rounded-xl bg-[#111116] border border-[#292936] hover:bg-[#1C1C26]"
                >
                  <Upload size={13} />
                  <span>Import</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportPresets}
                  className="hidden"
                />
              </div>
            </div>

            {/* Preset Selector Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {presets.map((preset) => {
                const isSoundProfile = ['late_night', 'electronic_punch', 'audiophile_warmth', 'spatial_clarity'].includes(preset.id);
                const isSelected = settings.activePresetId === preset.id;

                return (
                  <div key={preset.id} className="relative group inline-flex items-center">
                    <button
                      onClick={() => {
                        applyPreset(preset.id);
                        showToast(`Applied preset: ${preset.name}`, 'info');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6] text-[#F5F3FF] shadow-glow-sm ring-1 ring-[#8B5CF6]/40'
                          : isSoundProfile
                          ? 'bg-[#111116] hover:bg-[#1C1C26] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF]'
                          : 'bg-[#111116] hover:bg-[#1C1C26] border-[#292936] text-[#71717A] hover:text-[#A1A1AA]'
                      }`}
                    >
                      {isSoundProfile && <Sparkles size={11} className={isSelected ? 'text-[#A78BFA]' : 'text-[#71717A]'} />}
                      <span>{preset.name}</span>
                    </button>

                    {!preset.isBuiltIn && (
                      <div className="flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => {
                            setRenamingPresetId(preset.id);
                            setRenameValue(preset.name);
                          }}
                          title="Rename preset"
                          className="p-1 rounded-md hover:bg-[#252535] text-[#71717A] hover:text-[#F5F3FF]"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={() => {
                            deleteCustomPreset(preset.id);
                            showToast(`Deleted preset ${preset.name}`, 'info');
                          }}
                          title="Delete preset"
                          className="p-1 rounded-md hover:bg-zinc-800 text-[#71717A] hover:text-zinc-300"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2 — Combined Audio Response Curve & Physical Spectrum */}
          <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] space-y-2.5 shadow-card">
            <div className="flex justify-between items-center text-xs text-[#71717A] font-mono-numbers">
              <span className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                <span className="font-semibold">Combined Frequency Response Curve</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#111116] text-[#A78BFA] border border-[#292936]">
                  {settings.eqMode === 'graphic' ? '10-Band Graphic' : 'Parametric Studio'}
                </span>
              </span>

              <div className="flex items-center gap-3">
                {/* EQ Mode Switcher */}
                <div className="flex items-center bg-[#111116] border border-[#292936] rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setEQMode('graphic')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      settings.eqMode === 'graphic'
                        ? 'bg-[rgba(139,92,246,0.18)] border border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                        : 'text-[#71717A] hover:text-[#A1A1AA]'
                    }`}
                  >
                    10-Band Graphic
                  </button>
                  <button
                    onClick={() => setEQMode('parametric')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      settings.eqMode === 'parametric'
                        ? 'bg-[rgba(139,92,246,0.18)] border border-[#8B5CF6]/50 text-[#F5F3FF] shadow-glow-sm'
                        : 'text-[#71717A] hover:text-[#A1A1AA]'
                    }`}
                  >
                    Parametric Nodes
                  </button>
                </div>

                <span className="text-[10px] text-[#71717A] hidden sm:inline">±18 dB Scale</span>
              </div>
            </div>

            {settings.eqMode === 'parametric' ? (
              <ParametricEQCurve
                filters={settings.parametricFilters}
                enabled={settings.enabled}
                auditionFilterId={auditionFilterId}
                onUpdateFilter={updateParametricFilter}
                onSoloFilter={soloFilter}
                onRemoveFilter={removeParametricFilter}
              />
            ) : (
              <div className="w-full h-44 bg-[#111116] rounded-xl border border-[#292936] relative overflow-hidden flex items-center justify-center shadow-inner">
                <div className="absolute inset-x-4 bottom-2 opacity-15 pointer-events-none">
                  <AudioVisualizer height={55} mode="spectrum" />
                </div>
                <canvas ref={graphicCanvasRef} className="w-full h-full block cursor-default" />
              </div>
            )}
          </div>

          {/* SECTION 2 (Cont.) — 10-Band Graphic Equalizer Controls */}
          {settings.eqMode === 'graphic' ? (
            <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] space-y-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#F5F3FF] text-sm tracking-tight">10-Band Graphic Equalizer (ISO Standard)</h3>
                  <p className="text-xs text-[#71717A]">
                    Precision 32-bit floating point Biquad filters with frequency-tuned musical waveform tracks.
                  </p>
                </div>
                <span className="text-xs text-[#71717A] font-mono-numbers hidden sm:inline">
                  Double-click slider or column to reset band
                </span>
              </div>

              {/* 10 Individually Controlled Vertical Frequency Columns */}
              <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 md:gap-3 items-center justify-items-center w-full min-w-0">
                {EQ_FREQUENCIES.map((freq, idx) => (
                  <GraphicEQBand
                    key={freq}
                    index={idx}
                    frequency={freq}
                    gain={settings.bands[idx] ?? 0}
                    onChange={setBandGain}
                    onReset={() => setBandGain(idx, 0)}
                    isPlaying={isPlaying}
                    disabled={!settings.enabled}
                    realEnergy={bandEnergies[freq]}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Parametric EQ Filter Nodes List */
            <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] space-y-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292936] pb-3">
                <div>
                  <h3 className="font-bold text-[#F5F3FF] text-sm">Parametric Filter Nodes</h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Peaking, Shelving, Notch, and Bandpass filters with adjustable Frequency, Q factor, and Gain.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAutoEqModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111116] border border-[#292936] text-xs font-semibold text-[#A78BFA] hover:text-[#F5F3FF] transition-all"
                  >
                    <Headphones size={13} />
                    <span>AutoEQ Import</span>
                  </button>

                  <button
                    type="button"
                    disabled={settings.parametricFilters.length >= 12}
                    onClick={() =>
                      addParametricFilter({
                        type: 'peaking',
                        frequency: 1000,
                        gain: 0,
                        q: 1.41,
                        enabled: true,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(139,92,246,0.18)] border border-[#8B5CF6]/50 text-xs font-bold text-[#F5F3FF] hover:bg-[rgba(139,92,246,0.28)] disabled:opacity-30 transition-all"
                  >
                    <Plus size={13} />
                    <span>Add Filter Node</span>
                  </button>
                </div>
              </div>

              {/* Parametric Filters List */}
              <div className="space-y-3">
                {settings.parametricFilters.map((filter, idx) => (
                  <div
                    key={filter.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-wrap items-center gap-4 ${
                      filter.id === auditionFilterId
                        ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6]'
                        : filter.enabled
                        ? 'bg-[#111116] border-[#292936]'
                        : 'bg-[#0E0E14] border-[#292936]/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#17171F] text-[#A78BFA] text-[10px] font-bold font-mono flex items-center justify-center border border-[#292936]">
                        {idx + 1}
                      </span>
                      <button
                        onClick={() => toggleParametricFilter(filter.id)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                          filter.enabled
                            ? 'bg-[rgba(139,92,246,0.14)] text-[#A78BFA] border-[#8B5CF6]/40'
                            : 'bg-[#17171F] text-[#71717A] border-[#292936]'
                        }`}
                      >
                        {filter.enabled ? 'ON' : 'OFF'}
                      </button>

                      <button
                        onClick={() => soloFilter(filter.id)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-md border transition-all ${
                          auditionFilterId === filter.id
                            ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-glow-sm'
                            : 'bg-[#17171F] text-[#71717A] border-[#292936] hover:text-[#A1A1AA]'
                        }`}
                        title="Solo this filter node"
                      >
                        SOLO
                      </button>

                      <select
                        value={filter.type}
                        onChange={(e) =>
                          updateParametricFilter(filter.id, {
                            type: e.target.value as ParametricFilterType,
                          })
                        }
                        className="bg-[#17171F] border border-[#292936] text-[#F5F3FF] text-xs rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="peaking">Peaking Bell</option>
                        <option value="lowshelf">Low Shelf</option>
                        <option value="highshelf">High Shelf</option>
                        <option value="lowpass">Low Pass</option>
                        <option value="highpass">High Pass</option>
                        <option value="notch">Notch</option>
                        <option value="bandpass">Bandpass</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
                      {/* Frequency */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[#A1A1AA]">
                          <span>Frequency</span>
                          <span className="font-mono-numbers text-[#F5F3FF] font-bold">
                            {filter.frequency} Hz
                          </span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="20000"
                          step="10"
                          value={filter.frequency}
                          onChange={(e) =>
                            updateParametricFilter(filter.id, {
                              frequency: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[#8B5CF6]"
                        />
                      </div>

                      {/* Gain */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[#A1A1AA]">
                          <span>Gain</span>
                          <span
                            className={`font-mono-numbers font-bold ${
                              filter.gain > 0
                                ? 'text-[#A78BFA]'
                                : filter.gain < 0
                                ? 'text-[#8B5CF6]'
                                : 'text-[#71717A]'
                            }`}
                          >
                            {['lowpass', 'highpass', 'notch', 'bandpass'].includes(filter.type)
                              ? 'N/A'
                              : filter.gain > 0
                              ? `+${filter.gain.toFixed(1)} dB`
                              : `${filter.gain.toFixed(1)} dB`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-18"
                          max="18"
                          step="0.5"
                          disabled={['lowpass', 'highpass', 'notch', 'bandpass'].includes(filter.type)}
                          value={filter.gain}
                          onChange={(e) =>
                            updateParametricFilter(filter.id, {
                              gain: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[#8B5CF6] disabled:opacity-30"
                        />
                      </div>

                      {/* Q Factor */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[#A1A1AA]">
                          <span>Q / Bandwidth</span>
                          <span className="font-mono-numbers text-[#F5F3FF] font-bold">
                            {filter.q.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="18.0"
                          step="0.05"
                          value={filter.q}
                          onChange={(e) =>
                            updateParametricFilter(filter.id, {
                              q: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => removeParametricFilter(filter.id)}
                      title="Remove this filter node"
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-[#71717A] hover:text-[#F5F3FF] transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3 — Main Audio Enhancement Controls (Preamp, Bass Warmth, Treble Air) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Preamp Gain */}
            <div className={`p-5 rounded-2xl bg-[#17171F] border transition-all flex flex-col justify-between space-y-3.5 shadow-card select-none ${
              settings.preamp !== 0 ? 'border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.08)]' : 'border-[#292936] hover:border-[#8B5CF6]/40'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                    <Volume2 size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F3FF] text-xs">Preamp Gain</h4>
                    <span className="text-[10px] text-[#71717A]">Input Level Trim</span>
                  </div>
                </div>
                <span className={`font-mono-numbers font-bold text-xs ${settings.preamp !== 0 ? 'text-[#A78BFA]' : 'text-[#71717A]'}`}>
                  {`${settings.preamp > 0 ? `+${settings.preamp.toFixed(1)}` : settings.preamp.toFixed(1)} dB`}
                </span>
              </div>

              {/* Calibrated Studio VU Ladder Meter */}
              <div className="p-2.5 rounded-xl bg-[#111116] border border-[#292936] space-y-1.5">
                <div className="flex justify-between items-center text-[9px] font-mono-numbers text-[#71717A]">
                  <span>-12dB</span>
                  <span className="text-[#A78BFA] font-bold">0dB UNITY</span>
                  <span>+12dB</span>
                </div>
                {/* 13-Segment Calibrated VU Ladder */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))', gap: '3px', height: '14px', alignItems: 'center' }}>
                  {[-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12].map((dbVal) => {
                    const isZero = dbVal === 0;
                    const isActive =
                      settings.preamp === 0
                        ? isZero
                        : settings.preamp > 0
                        ? dbVal >= 0 && dbVal <= settings.preamp
                        : dbVal <= 0 && dbVal >= settings.preamp;
                    return (
                      <div
                        key={dbVal}
                        className={`h-full rounded-xs transition-all duration-150 ${
                          isActive
                            ? isZero
                              ? 'bg-[#C4B5FD] shadow-[0_0_6px_#C4B5FD]'
                              : dbVal > 0
                              ? 'bg-[#A78BFA] shadow-[0_0_4px_#8B5CF6]'
                              : 'bg-[#8B5CF6]'
                            : isZero
                            ? 'bg-[#343443]'
                            : 'bg-[#181821] border border-[#292936]/40'
                        }`}
                        title={`${dbVal > 0 ? '+' : ''}${dbVal} dB`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={settings.preamp}
                  onChange={(e) => setPreamp(parseFloat(e.target.value))}
                  onDoubleClick={() => setPreamp(0)}
                  className="w-full accent-[#8B5CF6] h-1.5 bg-[#111116] rounded-lg cursor-pointer"
                  title="Double-click to reset to 0 dB"
                />
                <div className="flex justify-between text-[10px] text-[#71717A]">
                  <span>Linear headroom offset</span>
                  <button
                    type="button"
                    onClick={() => setPreamp(0)}
                    className="hover:text-[#A78BFA] transition-colors"
                  >
                    Reset 0dB
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Bass Warmth */}
            <div className={`p-5 rounded-2xl bg-[#17171F] border transition-all flex flex-col justify-between space-y-3.5 shadow-card select-none ${
              settings.bassBoost > 0 ? 'border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.08)]' : 'border-[#292936] hover:border-[#8B5CF6]/40'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                    <Disc size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F3FF] text-xs">Bass Warmth</h4>
                    <span className="text-[10px] text-[#71717A]">50 Hz Low Shelf</span>
                  </div>
                </div>
                <span className={`font-mono-numbers font-bold text-xs ${settings.bassBoost > 0 ? 'text-[#A78BFA]' : 'text-[#71717A]'}`}>
                  {`+${settings.bassBoost.toFixed(1)} dB`}
                </span>
              </div>

              {/* Dynamic 50 Hz Low-Shelf Acoustic Resonance Curve */}
              <div className="p-2 rounded-xl bg-[#111116] border border-[#292936] h-14 relative overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 160 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="bassBloomGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={settings.bassBoost > 0 ? '0.35' : '0.05'} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Baseline 0dB reference */}
                  <line x1="0" y1="28" x2="160" y2="28" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" strokeWidth="1" />
                  {/* Dynamic Low-Shelf Curve */}
                  {(() => {
                    const lift = (settings.bassBoost / 12) * 18;
                    const peakY = 28 - lift;
                    const d = `M 0 ${peakY.toFixed(1)} C 40 ${peakY.toFixed(1)}, 65 28, 110 28 L 160 28 L 160 38 L 0 38 Z`;
                    const strokeD = `M 0 ${peakY.toFixed(1)} C 40 ${peakY.toFixed(1)}, 65 28, 110 28 L 160 28`;
                    return (
                      <>
                        <path d={d} fill="url(#bassBloomGrad)" />
                        <path
                          d={strokeD}
                          fill="none"
                          stroke={settings.bassBoost > 0 ? '#A78BFA' : '#52525B'}
                          strokeWidth={settings.bassBoost > 0 ? '2' : '1.5'}
                        />
                        {settings.bassBoost > 0 && (
                          <circle cx="28" cy={peakY} r="3" fill="#C4B5FD" />
                        )}
                      </>
                    );
                  })()}
                </svg>
                <span className="absolute right-2.5 top-1.5 text-[9px] font-mono-numbers text-[#71717A]">
                  50 Hz Shelf
                </span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={settings.bassBoost}
                  onChange={(e) => setBassBoost(parseFloat(e.target.value))}
                  onDoubleClick={() => setBassBoost(0)}
                  className="w-full accent-[#8B5CF6] h-1.5 bg-[#111116] rounded-lg cursor-pointer"
                  title="Double-click to reset to 0 dB"
                />
                <div className="flex justify-between text-[10px] text-[#71717A]">
                  <span>Acoustic sub-bass body</span>
                  <button
                    type="button"
                    onClick={() => setBassBoost(0)}
                    className="hover:text-[#A78BFA] transition-colors"
                  >
                    Reset 0dB
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Treble Air */}
            <div className={`p-5 rounded-2xl bg-[#17171F] border transition-all flex flex-col justify-between space-y-3.5 shadow-card select-none ${
              settings.treble !== 0 ? 'border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.08)]' : 'border-[#292936] hover:border-[#8B5CF6]/40'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                    <Zap size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F3FF] text-xs">Treble Air</h4>
                    <span className="text-[10px] text-[#71717A]">10 kHz High Shelf</span>
                  </div>
                </div>
                <span className={`font-mono-numbers font-bold text-xs ${settings.treble !== 0 ? 'text-[#A78BFA]' : 'text-[#71717A]'}`}>
                  {`${settings.treble > 0 ? `+${settings.treble.toFixed(1)}` : settings.treble.toFixed(1)} dB`}
                </span>
              </div>

              {/* Dynamic 10 kHz High-Shelf Shimmer Dispersion Wave */}
              <div className="p-2 rounded-xl bg-[#111116] border border-[#292936] h-14 relative overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 160 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="trebleShimmerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A78BFA" stopOpacity={settings.treble > 0 ? '0.35' : '0.05'} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Baseline 0dB reference */}
                  <line x1="0" y1="24" x2="160" y2="24" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" strokeWidth="1" />
                  {/* Dynamic High-Shelf Shimmer */}
                  {(() => {
                    const lift = (settings.treble / 12) * 16;
                    const shelfY = 24 - lift;
                    const strokeD = `M 0 24 C 50 24, 75 ${shelfY}, 115 ${shelfY} L 125 ${(shelfY - (settings.treble !== 0 ? 1.5 : 0)).toFixed(1)} L 135 ${(shelfY + (settings.treble !== 0 ? 1.2 : 0)).toFixed(1)} L 145 ${(shelfY - (settings.treble !== 0 ? 1.0 : 0)).toFixed(1)} L 160 ${shelfY.toFixed(1)}`;
                    const fillD = `${strokeD} L 160 38 L 0 38 Z`;
                    return (
                      <>
                        <path d={fillD} fill="url(#trebleShimmerGrad)" />
                        <path
                          d={strokeD}
                          fill="none"
                          stroke={settings.treble !== 0 ? '#C4B5FD' : '#52525B'}
                          strokeWidth={settings.treble !== 0 ? '2' : '1.5'}
                        />
                        {settings.treble !== 0 && (
                          <circle cx="135" cy={shelfY} r="3" fill="#A78BFA" />
                        )}
                      </>
                    );
                  })()}
                </svg>
                <span className="absolute left-2.5 top-1.5 text-[9px] font-mono-numbers text-[#71717A]">
                  10 kHz Shimmer
                </span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min="-6"
                  max="12"
                  step="0.5"
                  value={settings.treble}
                  onChange={(e) => setTreble(parseFloat(e.target.value))}
                  onDoubleClick={() => setTreble(0)}
                  className="w-full accent-[#8B5CF6] h-1.5 bg-[#111116] rounded-lg cursor-pointer"
                  title="Double-click to reset to 0 dB"
                />
                <div className="flex justify-between text-[10px] text-[#71717A]">
                  <span>High-shelf air & presence</span>
                  <button
                    type="button"
                    onClick={() => setTreble(0)}
                    className="hover:text-[#A78BFA] transition-colors"
                  >
                    Reset 0dB
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4 — Advanced DSP Dynamics Processing (Dynamic Peak Limiter) */}
          <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] hover:border-[#8B5CF6]/40 transition-colors space-y-4 shadow-card">
            <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                  <Shield size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-[#F5F3FF] text-xs">Peak Limiter</h4>
                  <span className="text-[10px] text-[#71717A]">Anti-Clipping DSP Protection</span>
                </div>
              </div>
              <button
                onClick={toggleLimiter}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  settings.limiterEnabled
                    ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6]/60 text-[#A78BFA] shadow-glow-sm'
                    : 'bg-[#111116] border-[#292936] text-[#71717A]'
                }`}
              >
                {settings.limiterEnabled ? 'ACTIVE' : 'BYPASS'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Soft-Knee Compression Transfer Function Curve */}
              <div className="p-3.5 rounded-xl bg-[#111116] border border-[#292936] flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[#A1A1AA] font-semibold">Soft-Knee Compression</span>
                  <span className="text-[#71717A] font-mono-numbers">Thresh: -0.5 dBFS</span>
                </div>
                <div className="h-16 w-full flex items-center justify-center relative">
                  <svg viewBox="0 0 160 50" className="w-full h-full" preserveAspectRatio="none">
                    <line x1="10" y1="42" x2="150" y2="42" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <line x1="10" y1="10" x2="10" y2="42" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <line x1="10" y1="42" x2="150" y2="10" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" strokeWidth="1" />
                    {/* Linear transfer into soft knee */}
                    <path
                      d="M 10 42 L 105 18 C 118 14, 130 12, 150 12"
                      fill="none"
                      stroke={settings.limiterEnabled ? '#8B5CF6' : '#52525B'}
                      strokeWidth="2.5"
                    />
                    {/* Knee point marker */}
                    <circle cx="105" cy="18" r="3" fill="#A78BFA" />
                    {/* Gain reduction indicator */}
                    {limiterMetrics.gainReductionDb > 0 && (
                      <circle cx="128" cy="13" r="4" fill="#C4B5FD" />
                    )}
                  </svg>
                </div>
                <div className="flex justify-between text-[9px] text-[#71717A]">
                  <span>Linear 1:1 Headroom</span>
                  <span>Soft Knee</span>
                  <span>Brickwall Ceiling</span>
                </div>
              </div>

              {/* Live Gain Reduction & Headroom Meter */}
              <div className="p-3.5 rounded-xl bg-[#111116] border border-[#292936] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#A1A1AA]">Gain Reduction:</span>
                  <span className={`font-mono-numbers font-bold ${limiterMetrics.gainReductionDb > 0 ? 'text-[#A78BFA]' : 'text-[#F5F3FF]'}`}>
                    {limiterMetrics.gainReductionDb > 0 ? `-${limiterMetrics.gainReductionDb.toFixed(1)} dB` : '0.0 dB'}
                  </span>
                </div>
                <div className="w-full bg-[#17171F] h-2 rounded-full overflow-hidden border border-[#292936]">
                  <div
                    className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#C4B5FD] transition-all duration-75"
                    style={{ width: `${Math.min(100, (limiterMetrics.gainReductionDb / 12) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#71717A]">
                  <span>Status:</span>
                  <span className={limiterMetrics.isClippingPrevented ? 'text-[#A78BFA] font-semibold' : 'text-[#71717A]'}>
                    {limiterMetrics.isClippingPrevented ? 'Protection Active' : 'Headroom Clear'}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#71717A] leading-relaxed pt-1 border-t border-[#292936]/60">
                  Monitors 32-bit floating point peaks and prevents digital overs without audible pumping.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 5 — Stereo & Spatial Audio Console (Vinyl Audio Dial & Channel Routing) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column (7 cols): Realistic Vinyl-Inspired Audio Dial */}
            <div className="lg:col-span-7">
              <VinylAudioDial
                value={settings.stereoWidth ?? 100}
                min={0}
                max={150}
                defaultValue={100}
                step={5}
                unit="%"
                label="Stereo Width"
                sublabel="Spatial Mid-Side Expander"
                enabled={settings.stereoWidthEnabled}
                onToggleEnabled={toggleStereoWidth}
                onChange={setStereoWidth}
                onReset={resetStereoWidth}
                isPlaying={isPlaying}
                size={144}
              />
            </div>

            {/* Right Column (5 cols): Channel Routing & Stereo Balance */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-[#17171F] border border-[#292936] hover:border-[#8B5CF6]/40 transition-colors flex flex-col justify-between space-y-4 shadow-card">
              <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                    <Headphones size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F3FF] text-xs">Channel Routing & Balance</h4>
                    <span className="text-[10px] text-[#71717A]">Acoustic Channel Mapping</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#111116] text-[#A78BFA] border border-[#292936]">
                  {settings.channelMode.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                {/* Channel Mode Buttons */}
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#111116] border border-[#292936]">
                  {(['stereo', 'mono', 'left_only', 'right_only'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setChannelMode(mode)}
                      className={`py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${
                        settings.channelMode === mode
                          ? 'bg-[rgba(139,92,246,0.18)] text-[#F5F3FF] border border-[#8B5CF6]/50 shadow-glow-sm'
                          : 'text-[#71717A] hover:text-[#A1A1AA]'
                      }`}
                    >
                      {mode === 'left_only' ? 'Left' : mode === 'right_only' ? 'Right' : mode}
                    </button>
                  ))}
                </div>

                {/* Panning / Balance Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#A1A1AA]">Stereo Balance</span>
                    <span className="font-mono-numbers text-[#F5F3FF] font-bold text-xs">
                      {settings.balance === 0
                        ? 'Center'
                        : settings.balance < 0
                        ? `L ${(Math.abs(settings.balance) * 100).toFixed(0)}%`
                        : `R ${(settings.balance * 100).toFixed(0)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={settings.balance}
                    onChange={(e) => setBalance(parseFloat(e.target.value))}
                    onDoubleClick={resetBalance}
                    className="w-full accent-[#8B5CF6] h-1.5 bg-[#111116] rounded-lg cursor-pointer"
                    title="Double-click to reset to center"
                  />
                  <div className="flex justify-between text-[9px] text-[#71717A]">
                    <span>Full Left</span>
                    <span>Center</span>
                    <span>Full Right</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-[#71717A] pt-2 border-t border-[#292936]/80">
                <span>Phase-aligned panning</span>
                <button type="button" onClick={resetBalance} className="hover:text-[#A78BFA] transition-colors">
                  Reset Center
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 6 — Acoustic Profiles & Studio Signatures */}
          <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] hover:border-[#8B5CF6]/40 transition-colors flex flex-col justify-between space-y-4 shadow-card">
            <div className="flex items-center justify-between pb-2 border-b border-[#292936]/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#111116] border border-[#292936] text-[#A78BFA]">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="font-bold text-[#F5F3FF] text-xs">Acoustic Profiles</h4>
                  <span className="text-[10px] text-[#71717A]">Quick Studio Signatures</span>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('profiles')}
                className="text-[10px] text-[#A78BFA] hover:text-[#F5F3FF] font-semibold transition-colors flex items-center gap-1"
              >
                <span>View All Profiles</span>
                <span>→</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {[
                { id: 'audiophile_warmth', name: 'Audiophile Warmth', desc: 'Analog Tube Tone' },
                { id: 'late_night', name: 'Late Night', desc: 'Low-Bass Intimate' },
                { id: 'electronic_punch', name: 'Electronic Punch', desc: 'Fast Dynamic Attack' },
                { id: 'spatial_clarity', name: 'Spatial Clarity', desc: 'Acoustic Room Field' },
              ].map((prof) => {
                const isCurrent = activeSoundProfileId === prof.id || settings.activePresetId === prof.id;
                return (
                  <button
                    key={prof.id}
                    onClick={() => {
                      applyPreset(prof.id);
                      showToast(`Applied: ${prof.name}`, 'info');
                    }}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isCurrent
                        ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6] text-[#F5F3FF] shadow-glow-sm'
                        : 'bg-[#111116] border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] hover:border-[#8B5CF6]/30'
                    }`}
                  >
                    <div className="font-bold text-[11px] truncate">{prof.name}</div>
                    <div className="text-[9px] text-[#71717A] truncate">{prof.desc}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] text-[#71717A] pt-2 border-t border-[#292936]/80">
              <span>Unified 10-profile catalog</span>
              <span className="font-mono text-[#A78BFA]">32-Bit Floating DSP</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: UNIFIED SOUND PROFILES (Phase 5B.3) */}
      {/* ========================================================================= */}
      {activeTab === 'profiles' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Bar */}
          <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] flex flex-wrap items-center justify-between gap-4 shadow-card">
            <div>
              <h3 className="font-bold text-[#F5F3FF] text-base">Sound Profiles System</h3>
              <p className="text-xs text-[#A1A1AA]">
                One-click acoustic profiles tailored for reference listening, specific genres, and intimate settings.
              </p>
            </div>
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgba(139,92,246,0.18)] hover:bg-[rgba(139,92,246,0.28)] border border-[#8B5CF6]/50 text-white text-xs font-bold shadow-glow-sm transition-all"
            >
              <Plus size={14} />
              <span>Save Current as Profile</span>
            </button>
          </div>

          {/* Active Profile Modified Banner */}
          {isProfileModified && (
            <div className="p-4 rounded-xl bg-[#17171F] border border-[#8B5CF6]/40 flex flex-wrap items-center justify-between gap-3 text-zinc-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#A78BFA] shrink-0" />
                <span>
                  <strong className="text-[#F5F3FF]">Active Profile Modified:</strong> Current EQ settings have manual adjustments not yet saved to the profile.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={restoreActiveProfile}
                  className="px-3 py-1.5 rounded-lg bg-[#111116] border border-[#292936] text-zinc-300 hover:text-white font-semibold transition-colors"
                >
                  Revert to Profile
                </button>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white font-bold hover:bg-[#7C3AED] transition-colors"
                >
                  Save as Custom Profile
                </button>
              </div>
            </div>
          )}

          {/* Sound Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {soundProfiles.map((p) => {
              const isActive = activeSoundProfileId === p.id;
              const headroom = soundProfileService.calculateHeadroom(p);

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isActive
                      ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6] shadow-glow-sm ring-1 ring-[#8B5CF6]/30'
                      : 'bg-[#17171F] border-[#292936] hover:border-[#8B5CF6]/30'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${
                            isActive
                              ? 'bg-[#111116] text-[#A78BFA] border border-[#8B5CF6]/40'
                              : 'bg-[#111116] text-[#71717A] border border-[#292936]'
                          }`}
                        >
                          {getProfileIcon(p.icon)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isBuiltIn && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-[#111116] text-[#71717A] font-mono border border-[#292936]">
                                Built-In
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-[#71717A] capitalize">{p.category} Profile</span>
                        </div>
                      </div>

                      {/* Headroom Badge */}
                      {headroom.suggestedPreampAttenuationDb > 0 && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.1)] border border-[#8B5CF6]/20 text-[#A78BFA] font-mono"
                          title="Automatic preamp attenuation to prevent clipping"
                        >
                          -{headroom.suggestedPreampAttenuationDb} dB Headroom
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{p.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#292936] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          applySoundProfile(p.id);
                          showToast(`Applied ${p.name} profile`, 'info');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-[#8B5CF6] text-white shadow-glow-sm'
                            : 'bg-[#111116] hover:bg-[#1C1C26] text-zinc-300 hover:text-white border border-[#292936]'
                        }`}
                      >
                        {isActive ? 'Active Profile' : 'Apply Profile'}
                      </button>

                      <button
                        onClick={() => {
                          const dup = duplicateSoundProfile(p.id);
                          if (dup) showToast(`Duplicated to ${dup.name}`, 'success');
                        }}
                        title="Duplicate Profile"
                        className="p-1.5 rounded-lg bg-[#111116] hover:bg-[#1C1C26] text-zinc-400 hover:text-white border border-[#292936] transition-colors"
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    {!p.isBuiltIn && (
                      <button
                        onClick={() => {
                          deleteCustomProfile(p.id);
                          showToast(`Deleted profile ${p.name}`, 'info');
                        }}
                        title="Delete Custom Profile"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PER-TRACK EQ MEMORY (Phase 5B.4) */}
      {/* ========================================================================= */}
      {activeTab === 'track_eq' && (
        <div className="space-y-6 animate-fade-in">
          {/* Current Playing Track Status Card */}
          <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <div>
                <h3 className="font-bold text-[#F5F3FF] text-base">Active Track EQ Memory</h3>
                <p className="text-xs text-[#A1A1AA]">
                  Automatically remembers and restores tailored EQ curves whenever a specific track plays.
                </p>
              </div>

              {currentTrack && (
                <div className="flex items-center gap-2">
                  {currentTrackProfile ? (
                    <>
                      <button
                        onClick={() => toggleTrackProfile(currentTrack, !currentTrackProfile.enabled)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          currentTrackProfile.enabled
                            ? 'bg-[rgba(139,92,246,0.18)] border-[#8B5CF6]/50 text-[#F5F3FF]'
                            : 'bg-[#111116] text-[#71717A] border-[#292936]'
                        }`}
                      >
                        {currentTrackProfile.enabled ? 'Track EQ: Enabled' : 'Track EQ: Bypassed'}
                      </button>
                      <button
                        onClick={() => {
                          removeTrackProfile(currentTrack);
                          showToast('Removed custom EQ for current track', 'info');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#111116] hover:bg-[#1C1C26] border border-[#292936] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs font-semibold transition-all"
                      >
                        Reset to Global EQ
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        saveCurrentForTrack(currentTrack);
                        showToast(`Saved EQ profile for "${currentTrack.title}"`, 'success');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgba(139,92,246,0.18)] hover:bg-[rgba(139,92,246,0.28)] border border-[#8B5CF6]/50 text-[#F5F3FF] text-xs font-bold shadow-glow-sm transition-all"
                    >
                      <Save size={14} />
                      <span>Save Current EQ for This Track</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentTrack ? (
              <div className="p-4 rounded-xl bg-[#111116] border border-[#292936] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#17171F] border border-[#292936] text-[#A78BFA]">
                    <Music2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#F5F3FF]">{currentTrack.title}</h4>
                    <p className="text-xs text-[#71717A]">
                      {currentTrack.artist} • {currentTrack.album || 'Single'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono border ${
                      currentTrackProfile?.enabled
                        ? 'bg-[rgba(139,92,246,0.14)] border-[#8B5CF6]/40 text-[#A78BFA]'
                        : 'bg-[#17171F] border-[#292936] text-[#71717A]'
                    }`}
                  >
                    {currentTrackProfile ? (currentTrackProfile.enabled ? 'Custom Curve Active' : 'Overridden (Bypassed)') : 'Using Global Profile'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#111116] border border-[#292936] text-center text-xs text-[#71717A]">
                No track currently playing. Play a song to configure its dedicated EQ memory.
              </div>
            )}
          </div>

          {/* Library Track EQ Table */}
          <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292936] pb-3">
              <div>
                <h3 className="font-bold text-[#F5F3FF] text-sm">Saved Track EQ Profiles ({allTrackProfiles.length})</h3>
                <p className="text-xs text-[#71717A]">
                  Overview of all customized song curves stored in your local Harmoniq library.
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="Filter track profiles..."
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#111116] border border-[#292936] text-xs text-[#F5F3FF] placeholder-[#71717A] outline-none focus:border-[#8B5CF6]"
                />
              </div>
            </div>

            {filteredTrackProfiles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#292936] text-[#71717A]">
                      <th className="py-2.5 px-3">Track & Artist</th>
                      <th className="py-2.5 px-3">Album</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrackProfiles.map((tp) => (
                      <tr key={tp.trackIdentity} className="border-b border-[#292936]/60 hover:bg-[#111116]/60">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#F5F3FF]">{tp.title}</div>
                          <div className="text-[11px] text-[#71717A]">{tp.artist}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[#A1A1AA]">{tp.album || '—'}</td>
                        <td className="py-2.5 px-3 capitalize text-[#A78BFA] font-mono">{tp.mode}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              tp.enabled ? 'bg-[rgba(139,92,246,0.18)] text-[#A78BFA]' : 'bg-[#111116] text-[#71717A]'
                            }`}
                          >
                            {tp.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              removeTrackProfile(tp.trackIdentity);
                              showToast(`Removed EQ for "${tp.title}"`, 'info');
                            }}
                            className="p-1 rounded-lg hover:bg-zinc-800 text-[#71717A] hover:text-[#F5F3FF] transition-colors"
                            title="Delete Track EQ Profile"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#71717A]">
                {allTrackProfiles.length === 0
                  ? 'No per-track EQ profiles saved yet. Click "Save Current EQ for This Track" while listening.'
                  : 'No saved track profiles match your search filter.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PER-DEVICE AUDIO PROFILES & VOLUME MEMORY (Phase 5B.5) */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-6 animate-fade-in">
          {/* Active Device Card */}
          <div className="p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <div>
                <h3 className="font-bold text-[#F5F3FF] text-base">Active Output Endpoint</h3>
                <p className="text-xs text-[#A1A1AA]">
                  Remembers application volume preferences and default sound profiles per output device.
                </p>
              </div>
              <button
                onClick={() => {
                  refreshOutputDevices();
                  showToast('Scanned audio hardware endpoints', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111116] border border-[#292936] text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors"
              >
                <RefreshCw size={13} />
                <span>Rescan Hardware</span>
              </button>
            </div>

            {/* Architecture Transparency Banner */}
            <div className="p-3.5 rounded-xl bg-[#111116] border border-[#292936] flex items-center gap-3 text-xs text-[#A1A1AA]">
              <Info size={16} className="text-[#A78BFA] shrink-0" />
              <span>
                <strong className="text-[#F5F3FF]">Shared Mode Architecture:</strong> Harmoniq routes audio via the standard Windows Audio Engine in shared mode at the OS format rate. Exclusive hardware control is intentionally omitted to avoid taking monopoly ownership of user audio interfaces.
              </span>
            </div>

            {/* Device Volume Memory & Associated Sound Profile */}
            {(() => {
              const activeDev = outputDevices.find(
                (d) => d.deviceId === currentDeviceId || (d.isDefault && currentDeviceId === 'default')
              );
              const activeProfile = deviceProfiles.find((p) => p.deviceId === activeDev?.deviceId);
              const preferredVol = activeProfile?.preferredVolume ?? volume;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Remembered Volume */}
                  <div className="p-4 rounded-xl bg-[#111116] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                        <Volume2 size={14} className="text-[#A78BFA]" />
                        <span>Remembered Volume</span>
                      </span>
                      <span className="font-mono text-[#F5F3FF] font-bold">
                        {Math.round(preferredVol * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={preferredVol}
                      onChange={(e) => {
                        const newVol = parseFloat(e.target.value);
                        if (activeDev) {
                          saveDevicePreferences(activeDev.deviceId, {
                            preferredVolume: newVol,
                            deviceLabel: activeDev.label,
                          });
                        }
                      }}
                      className="w-full accent-[#8B5CF6]"
                    />
                    <p className="text-[11px] text-[#71717A]">
                      Harmoniq automatically sets application volume to {Math.round(preferredVol * 100)}% when this device connects.
                    </p>
                  </div>

                  {/* Associated Sound Profile */}
                  <div className="p-4 rounded-xl bg-[#111116] border border-[#292936] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[#A78BFA]" />
                        <span>Associated Sound Profile</span>
                      </span>
                    </div>
                    <select
                      value={activeProfile?.preferredSoundProfileId || ''}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        if (activeDev) {
                          saveDevicePreferences(activeDev.deviceId, {
                            preferredSoundProfileId: val,
                            deviceLabel: activeDev.label,
                          });
                          if (val) applySoundProfile(val);
                        }
                      }}
                      className="w-full bg-[#17171F] border border-[#292936] text-[#F5F3FF] text-xs rounded-lg p-2 outline-none"
                    >
                      <option value="">No automatic profile (Use active global profile)</option>
                      {soundProfiles.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({sp.category})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#71717A]">
                      Automatically activates this sound profile whenever this output device is selected.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Connected Endpoints Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outputDevices.map((dev) => {
              const isSelected = currentDeviceId === dev.deviceId || (dev.isDefault && currentDeviceId === 'default');
              const devProfile = deviceProfiles.find((p) => p.deviceId === dev.deviceId);
              const isHeadphone = dev.label.toLowerCase().includes('headphone') || dev.label.toLowerCase().includes('earphone');

              return (
                <div
                  key={dev.deviceId}
                  onClick={() => {
                    setOutputDevice(dev.deviceId);
                    const associated = devProfile?.preferredSoundProfileId;
                    if (associated) applySoundProfile(associated);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start justify-between ${
                    isSelected
                      ? 'bg-[rgba(139,92,246,0.12)] border-[#8B5CF6] shadow-glow-sm ring-1 ring-[#8B5CF6]/30'
                      : 'bg-[#17171F] border-[#292936] hover:border-[#8B5CF6]/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        isSelected
                          ? 'bg-[#111116] text-[#A78BFA] border border-[#8B5CF6]/40'
                          : 'bg-[#111116] text-[#71717A] border border-[#292936]'
                      }`}
                    >
                      {isHeadphone ? <Headphones size={20} /> : <Speaker size={20} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#F5F3FF]">{dev.label}</h4>
                        {dev.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#111116] text-[#71717A] border border-[#292936] font-mono">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#71717A]">
                        {dev.sampleRate ? `${dev.sampleRate / 1000} kHz` : '48 kHz'} • {dev.channels ? `${dev.channels}ch` : 'Stereo'}
                      </p>
                      {devProfile && (
                        <p className="text-[11px] text-[#A78BFA] font-mono">
                          Vol: {Math.round((devProfile.preferredVolume || 0.85) * 100)}%
                          {devProfile.preferredSoundProfileId && ` • Profile: ${devProfile.preferredSoundProfileId}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shrink-0">
                      <Check size={14} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIO QUALITY TRANSPARENCY (Phase 5B.6) */}
      {/* ========================================================================= */}
      {activeTab === 'quality' && (
        <div className="space-y-6 animate-fade-in">
          {qualityReport ? (
            <>
              {/* Bit-Perfect Transparency Status Banner */}
              <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield size={20} className="text-[#A78BFA]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#F5F3FF]">Audio Path & Bit-Perfect Transparency</h3>
                      <p className="text-xs text-[#A1A1AA]">{qualityReport.bitPerfect.explanation}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[rgba(139,92,246,0.18)] text-[#A78BFA] border border-[#8B5CF6]/40">
                    {qualityReport.bitPerfect.status.toUpperCase()}
                  </span>
                </div>

                {/* Transparency Factors Breakdown */}
                <div className="p-3.5 rounded-xl bg-[#111116] border border-[#292936] space-y-1.5 text-xs text-[#A1A1AA]">
                  <span className="text-[11px] font-bold text-[#F5F3FF] uppercase tracking-wider">
                    Audio Pipeline Audit:
                  </span>
                  <ul className="space-y-1 list-disc list-inside text-[#71717A]">
                    {qualityReport.bitPerfect.reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Side-by-Side Diagnostics: Source vs Processing vs Output */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Source Specs */}
                <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#292936] pb-2">
                    <span className="text-xs font-bold text-[#A78BFA] flex items-center gap-1.5">
                      <FileAudio size={15} />
                      <span>Source Audio Stream</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        qualityReport.source.isLossless
                          ? 'bg-[rgba(139,92,246,0.18)] text-[#A78BFA]'
                          : 'bg-[#111116] text-[#71717A]'
                      }`}
                    >
                      {qualityReport.source.qualityTier}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-[#A1A1AA]">
                    <div className="flex justify-between">
                      <span>Codec:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.source.codec.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Container:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.source.container.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sample Rate:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.source.sampleRateHz / 1000} kHz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bit Depth:</span>
                      <span className="text-[#F5F3FF]">
                        {qualityReport.source.bitDepthBits ? `${qualityReport.source.bitDepthBits}-Bit` : 'N/A (Lossy)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nominal Bitrate:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.source.bitrateKbps} kbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lossless:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.source.isLossless ? 'Yes (Lossless)' : 'Lossy'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Processing Specs */}
                <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#292936] pb-2">
                    <span className="text-xs font-bold text-[#A78BFA] flex items-center gap-1.5">
                      <Activity size={15} />
                      <span>DSP Processing Pipeline</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        qualityReport.processing.isDspEnabled
                          ? 'bg-[rgba(139,92,246,0.18)] text-[#A78BFA]'
                          : 'bg-[#111116] text-[#71717A]'
                      }`}
                    >
                      {qualityReport.processing.isDspEnabled ? 'ACTIVE' : 'BYPASS'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-[#A1A1AA]">
                    <div className="flex justify-between">
                      <span>Internal Format:</span>
                      <span className="text-[#F5F3FF]">32-Bit Floating Point</span>
                    </div>
                    <div className="flex justify-between">
                      <span>EQ Mode:</span>
                      <span className="text-[#F5F3FF] capitalize">{settings.eqMode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Preamp:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.processing.preampDb.toFixed(1)} dB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ReplayGain:</span>
                      <span className="text-[#F5F3FF]">
                        {qualityReport.processing.replayGainApplied ? 'Engaged' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limiter Reduction:</span>
                      <span className={qualityReport.processing.limiterActive ? 'text-[#A78BFA]' : 'text-[#F5F3FF]'}>
                        {qualityReport.processing.limiterActive ? 'Clipping Prevented' : '0.0 dB'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#292936] text-[11px] text-[#71717A]">
                      <span className="font-bold text-[#A1A1AA]">Active DSP Stages:</span>
                      <div className="mt-1 space-y-0.5 text-[#71717A]">
                        {qualityReport.processing.activeDspStages.length > 0
                          ? qualityReport.processing.activeDspStages.map((s, idx) => (
                              <div key={idx}>• {s}</div>
                            ))
                          : '• None (Flat reference)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Hardware Output Endpoint */}
                <div className="p-5 rounded-2xl bg-[#17171F] border border-[#292936] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#292936] pb-2">
                    <span className="text-xs font-bold text-[#A78BFA] flex items-center gap-1.5">
                      <Speaker size={15} />
                      <span>Hardware Output</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#111116] text-[#A78BFA] border border-[#292936]">
                      WASAPI SHARED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-[#A1A1AA]">
                    <div className="flex justify-between">
                      <span>Endpoint:</span>
                      <span className="text-[#F5F3FF] truncate max-w-[140px]" title={qualityReport.output.deviceName}>
                        {qualityReport.output.deviceName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Driver Mode:</span>
                      <span className="text-[#F5F3FF]">Shared Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output Rate:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.output.outputSampleRateHz / 1000} kHz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Channels:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.output.outputChannels} Channels</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Buffer Latency:</span>
                      <span className="text-[#F5F3FF]">{qualityReport.output.latencyMs} ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-2xl bg-[#17171F] border border-[#292936] text-center space-y-3 shadow-card">
              <FileAudio size={32} className="mx-auto text-[#71717A]" />
              <h4 className="text-sm font-bold text-[#F5F3FF]">No Audio Stream Active</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Play any track from your library or stream to inspect truthful source metadata, decoded stream parameters, active DSP filtering, and output routing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Save Custom Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePreset}
            className="w-full max-w-md p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-[#F5F3FF] text-base">Save Custom Equalizer Preset</h3>
            <input
              type="text"
              placeholder="e.g., Studio Reference, Late Night Warmth"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#111116] border border-[#292936] text-[#F5F3FF] text-xs outline-none focus:border-[#8B5CF6]"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#111116]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold transition-all shadow-glow-sm"
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Save Custom Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-md p-6 rounded-2xl bg-[#17171F] border border-[#292936] shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-[#F5F3FF] text-base">Save Current EQ as Custom Profile</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#A1A1AA] block mb-1">Profile Name</label>
                <input
                  type="text"
                  placeholder="e.g., Sennheiser HD600 Harmonized"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#111116] border border-[#292936] text-[#F5F3FF] text-xs outline-none focus:border-[#8B5CF6]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[#A1A1AA] block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Describe your acoustic tuning..."
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl bg-[#111116] border border-[#292936] text-[#F5F3FF] text-xs outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#111116]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold transition-all shadow-glow-sm"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AutoEQ Headphone Profile Import Modal */}
      <AutoEqImportModal
        isOpen={showAutoEqModal}
        onClose={() => setShowAutoEqModal(false)}
        onApply={(filters, preamp) => {
          importAutoEqProfile(filters, preamp);
          setShowAutoEqModal(false);
          showToast('Applied AutoEQ headphone calibration curve', 'success');
        }}
      />
    </div>
  );
};
