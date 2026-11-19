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

    // Draw Grid Lines
    const gridFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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
      ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();

      ctx.fillStyle = db === 0 ? '#A1A1AA' : '#52525B';
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

    // Draw Curve
    ctx.strokeStyle = settings.enabled ? '#A78BFA' : '#71717A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = freqToX(testFreqs[i]);
      const y = gainToY(responseDb[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    if (settings.enabled) {
      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(167, 139, 250, 0.15)');
      fillGradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.05)');
      fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.lineTo(freqToX(testFreqs[numSamples - 1]), height / 2);
      ctx.lineTo(freqToX(testFreqs[0]), height / 2);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }

    // Draw 10-Band Graphic EQ nodes
    EQ_FREQUENCIES.forEach((freq, idx) => {
      const gain = settings.bands[idx] ?? 0;
      const hx = freqToX(freq);
      const hy = gainToY(gain);
      ctx.fillStyle = '#A78BFA';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
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
    <div className="h-full overflow-y-auto px-8 py-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Studio Master Header */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#F5F3FF] tracking-tight">Audio Experience Studio</h2>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1B1B24] text-[#A78BFA] border border-[#272733]">
                  32-Bit Float DSP
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Interactive Equalizers • Unified Sound Profiles • Per-Track Memory • Device Preferences • Quality Transparency
              </p>
            </div>
          </div>

          {/* Master Bypass Switch */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetToFlat();
                showToast('Equalizer reset to Flat reference', 'info');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#242432] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
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
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] border-[#A78BFA] text-[#F5F3FF] shadow-glow-sm'
                  : 'bg-[#14141B] border-[#272733] text-[#71717A]'
              }`}
            >
              <Power size={14} />
              <span>{settings.enabled ? 'DSP: ACTIVE' : 'DSP: BYPASS'}</span>
            </button>
          </div>
        </div>

        {/* Studio 5-Tab Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#272733]">
          <button
            onClick={() => setActiveTab('equalizer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'equalizer'
                ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#242432]'
            }`}
          >
            <Sliders size={14} />
            <span>Equalizer</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'profiles'
                ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#242432]'
            }`}
          >
            <Sparkles size={14} />
            <span>Sound Profiles</span>
            {isProfileModified && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1.5 right-1.5 animate-pulse" title="Profile modified" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('track_eq')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'track_eq'
                ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#242432]'
            }`}
          >
            <Music2 size={14} />
            <span>Track EQ Memory</span>
            {currentTrackProfile && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 font-mono">
                OVERRIDE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#242432]'
            }`}
          >
            <Speaker size={14} />
            <span>Audio Devices</span>
          </button>

          <button
            onClick={() => setActiveTab('quality')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'quality'
                ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#242432]'
            }`}
          >
            <Activity size={14} />
            <span>Quality Transparency</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EQUALIZER STUDIO (Phase 5B.2 Enhanced) */}
      {/* ========================================================================= */}
      {activeTab === 'equalizer' && (
        <div className="space-y-6 animate-fade-in">
          {/* Preset Selector Bar */}
          <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-[#71717A] font-mono-numbers">
                Acoustic Profiles & Presets
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-1.5 text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-[#1B1B24]"
                >
                  <Plus size={14} />
                  <span>Save Preset</span>
                </button>

                <button
                  onClick={handleExportPresets}
                  title="Export custom presets as JSON"
                  className="flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-[#1B1B24]"
                >
                  <Download size={13} />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Import custom presets from JSON"
                  className="flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F5F3FF] font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-[#1B1B24]"
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

            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const isSoundProfile = ['late_night', 'electronic_punch', 'audiophile_warmth', 'spatial_clarity'].includes(preset.id);
                return (
                  <div key={preset.id} className="relative group inline-flex items-center">
                    <button
                      onClick={() => {
                        applyPreset(preset.id);
                        showToast(`Applied preset: ${preset.name}`, 'info');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        settings.activePresetId === preset.id
                          ? 'bg-[var(--ambient-primary)] border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-glow-sm'
                          : isSoundProfile
                          ? 'bg-[#181824] hover:bg-[#222232] border-[var(--accent-primary)]/20 text-[#E2E8F0] hover:text-[#FFFFFF]'
                          : 'bg-[#1B1B24] hover:bg-[#242432] border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF]'
                      }`}
                    >
                      {isSoundProfile && <Sparkles size={11} className="text-[var(--accent-primary)]" />}
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
                          className="p-1 rounded-md hover:bg-red-950/50 text-[#71717A] hover:text-red-400"
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

          {/* Interactive Frequency Response Curve */}
          <div className="p-5 rounded-2xl bg-[#09090B] border border-[#272733] space-y-2 shadow-card">
            <div className="flex justify-between items-center text-xs text-[#71717A] font-mono-numbers">
              <span className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                <span>Combined Audio Response Curve ({settings.eqMode === 'graphic' ? '10-Band Graphic' : 'Parametric Studio'})</span>
                {settings.eqMode === 'parametric' && (
                  <span className="text-[10px] text-[var(--accent-dynamic)] bg-[#1B1B24] px-2 py-0.5 rounded-full border border-[#272733]">
                    Drag nodes • Wheel Q • Double-click 0dB • [S] Solo
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {/* EQ Mode Switcher */}
                <div className="flex items-center bg-[#1B1B24] border border-[#272733] rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setEQMode('graphic')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      settings.eqMode === 'graphic'
                        ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                        : 'text-[#71717A] hover:text-[#A1A1AA]'
                    }`}
                  >
                    10-Band
                  </button>
                  <button
                    onClick={() => setEQMode('parametric')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      settings.eqMode === 'parametric'
                        ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                        : 'text-[#71717A] hover:text-[#A1A1AA]'
                    }`}
                  >
                    Parametric
                  </button>
                </div>
                <span>±18 dB Scale</span>
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
              <div className="w-full h-44 bg-[#14141B] rounded-xl border border-[#272733] relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-x-4 bottom-2 opacity-20 pointer-events-none">
                  <AudioVisualizer height={55} mode="spectrum" />
                </div>
                <canvas ref={graphicCanvasRef} className="w-full h-full block cursor-default" />
              </div>
            )}
          </div>

          {/* Equalizer Controls: Graphic Sliders OR Parametric Nodes */}
          {settings.eqMode === 'graphic' ? (
            <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#F5F3FF] text-sm">10-Band Graphic Equalizer (ISO Standard)</h3>
                <span className="text-xs text-[#71717A] font-mono-numbers">Double-click slider to reset band</span>
              </div>

              <div className="grid grid-cols-10 gap-2 sm:gap-3 items-center justify-items-center">
                {EQ_FREQUENCIES.map((freq, idx) => {
                  const gain = settings.bands[idx] ?? 0;
                  return (
                    <div key={freq} className="flex flex-col items-center gap-3 w-full">
                      <span
                        className={`text-xs font-mono-numbers font-bold ${
                          gain > 0 ? 'text-[#A78BFA]' : gain < 0 ? 'text-sky-400' : 'text-[#71717A]'
                        }`}
                      >
                        {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                      </span>

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

                      <span className="text-xs font-bold text-[#A1A1AA] font-mono-numbers">
                        {formatFreq(freq)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#272733] pb-3">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B24] hover:bg-[#242432] border border-[#272733] text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] transition-all"
                    title="Import AutoEQ or Equalizer APO profile"
                  >
                    <Sparkles size={14} />
                    <span>AutoEQ Import</span>
                  </button>
                  <button
                    onClick={() => addParametricFilter()}
                    disabled={settings.parametricFilters.length >= 12}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Add Filter Node</span>
                  </button>
                </div>
              </div>

              {auditionFilterId && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-pulse">
                  <div className="flex items-center gap-2">
                    <Headphones size={15} className="text-amber-400" />
                    <span>
                      <strong>Audition Mode Active:</strong> Isolating individual filter. All other parametric bands are temporarily bypassed.
                    </span>
                  </div>
                  <button
                    onClick={() => soloFilter(null)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition-colors"
                  >
                    Exit Solo
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {settings.parametricFilters.map((filter, idx) => (
                  <div
                    key={filter.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      auditionFilterId === filter.id
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-glow-sm'
                        : filter.enabled
                        ? 'bg-[#0D0D12] border-[#272733]'
                        : 'bg-[#09090B]/60 border-[#1B1B24] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={() => toggleParametricFilter(filter.id)}
                        className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
                      />
                      <span
                        className={`w-5 h-5 rounded-full border text-xs font-mono-numbers font-bold flex items-center justify-center ${
                          auditionFilterId === filter.id
                            ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                            : 'bg-[var(--accent-dynamic)]/20 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]'
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {/* Solo / Audition Toggle Button */}
                      <button
                        type="button"
                        onClick={() => soloFilter(filter.id)}
                        title={auditionFilterId === filter.id ? 'Exit Solo' : 'Solo / Audition this filter'}
                        className={`p-1.5 rounded-lg border transition-all ${
                          auditionFilterId === filter.id
                            ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-glow-sm'
                            : 'bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] border-[#272733]'
                        }`}
                      >
                        <Headphones size={13} />
                      </button>

                      {/* Filter Type Selector */}
                      <select
                        value={filter.type}
                        onChange={(e) =>
                          updateParametricFilter(filter.id, {
                            type: e.target.value as ParametricFilterType,
                          })
                        }
                        className="bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] rounded-lg px-2.5 py-1 text-xs font-semibold outline-none"
                      >
                        <option value="peaking">Peaking / Bell</option>
                        <option value="lowshelf">Low Shelf</option>
                        <option value="highshelf">High Shelf</option>
                        <option value="lowpass">Low Pass</option>
                        <option value="highpass">High Pass</option>
                        <option value="notch">Notch</option>
                        <option value="bandpass">Bandpass</option>
                      </select>
                    </div>

                    {/* Filter Parameters: Freq, Gain, Q */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
                      {/* Frequency Slider */}
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
                          className="w-full accent-[var(--accent-dynamic)]"
                        />
                      </div>

                      {/* Gain Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[#A1A1AA]">
                          <span>Gain</span>
                          <span
                            className={`font-mono-numbers font-bold ${
                              filter.gain > 0
                                ? 'text-[var(--accent-dynamic)]'
                                : filter.gain < 0
                                ? 'text-sky-400'
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
                          className="w-full accent-[var(--accent-dynamic)] disabled:opacity-30"
                        />
                      </div>

                      {/* Q Factor Slider */}
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
                          className="w-full accent-[var(--accent-dynamic)]"
                        />
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeParametricFilter(filter.id)}
                      title="Remove this filter node"
                      className="p-1.5 rounded-lg hover:bg-rose-950/40 text-[#71717A] hover:text-rose-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Master Preamp, Tone Controls, Stereo Width & Limiter */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Preamp */}
            <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] font-semibold">Preamp Gain</span>
                <span className="font-mono text-[#F5F3FF] font-bold">
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
                onDoubleClick={() => setPreamp(0)}
                className="w-full accent-[var(--accent-dynamic)]"
              />
            </div>

            {/* Bass Boost */}
            <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] font-semibold">Bass Warmth</span>
                <span className="font-mono text-[#F5F3FF] font-bold">
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
                onDoubleClick={() => setBassBoost(0)}
                className="w-full accent-[var(--accent-dynamic)]"
              />
            </div>

            {/* Treble */}
            <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] font-semibold">Treble Air</span>
                <span className="font-mono text-[#F5F3FF] font-bold">
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
                onDoubleClick={() => setTreble(0)}
                className="w-full accent-[var(--accent-dynamic)]"
              />
            </div>

            {/* Mid-Side Stereo Width */}
            <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                  <Maximize2 size={13} className="text-[#A78BFA]" />
                  <span>Stereo Width</span>
                </span>
                <span className="font-mono text-[#F5F3FF] font-bold">
                  {settings.stereoWidthEnabled ? `${settings.stereoWidth ?? 100}%` : 'Bypassed'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={settings.stereoWidth ?? 100}
                disabled={!settings.stereoWidthEnabled}
                onChange={(e) => setStereoWidth(parseFloat(e.target.value))}
                onDoubleClick={resetStereoWidth}
                className="w-full accent-[var(--accent-dynamic)] disabled:opacity-40"
              />
              <div className="flex items-center justify-between text-[10px] text-[#71717A]">
                <button
                  type="button"
                  onClick={toggleStereoWidth}
                  className="hover:text-violet-400 font-semibold underline"
                >
                  {settings.stereoWidthEnabled ? 'Disable Widener' : 'Enable Widener'}
                </button>
                <span>Double-click 100%</span>
              </div>
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
          <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] flex flex-wrap items-center justify-between gap-4 shadow-card">
            <div>
              <h3 className="font-bold text-[#F5F3FF] text-base">Sound Profiles System</h3>
              <p className="text-xs text-[#A1A1AA]">
                One-click acoustic profiles tailored for reference listening, specific genres, and intimate settings.
              </p>
            </div>
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-dynamic)] hover:bg-violet-500 text-white text-xs font-bold shadow-glow-sm transition-all"
            >
              <Plus size={14} />
              <span>Save Current as Profile</span>
            </button>
          </div>

          {/* Active Profile Modified Banner */}
          {isProfileModified && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>
                  <strong>Active Profile Modified:</strong> Current EQ settings have manual adjustments not yet saved to the profile.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={restoreActiveProfile}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white font-semibold transition-colors"
                >
                  Revert to Profile
                </button>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors"
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
                      ? 'bg-gradient-to-b from-violet-950/30 to-[#14141B] border-violet-500/60 shadow-glow-sm ring-1 ring-violet-500/30'
                      : 'bg-[#14141B] border-[#272733] hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${
                            isActive
                              ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                              : 'bg-[#1B1B24] text-zinc-400 border border-[#272733]'
                          }`}
                        >
                          {getProfileIcon(p.icon)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isBuiltIn && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                                Built-In
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-zinc-400 capitalize">{p.category} Profile</span>
                        </div>
                      </div>

                      {/* Headroom Badge */}
                      {headroom.suggestedPreampAttenuationDb > 0 && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono"
                          title="Automatic preamp attenuation to prevent clipping"
                        >
                          -{headroom.suggestedPreampAttenuationDb} dB Headroom
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">{p.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#272733] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          applySoundProfile(p.id);
                          showToast(`Applied ${p.name} profile`, 'info');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-violet-600 text-white shadow-glow-sm'
                            : 'bg-[#1B1B24] hover:bg-[#252535] text-zinc-300 hover:text-white border border-[#272733]'
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
                        className="p-1.5 rounded-lg bg-[#1B1B24] hover:bg-[#252535] text-zinc-400 hover:text-white border border-[#272733] transition-colors"
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
                        className="p-1.5 rounded-lg hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition-colors"
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
          <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#272733] pb-3">
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
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {currentTrackProfile.enabled ? 'Track EQ: Enabled' : 'Track EQ: Bypassed'}
                      </button>
                      <button
                        onClick={() => {
                          removeTrackProfile(currentTrack);
                          showToast('Removed custom EQ for current track', 'info');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all"
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
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
                    >
                      <Save size={14} />
                      <span>Save Current EQ for This Track</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentTrack ? (
              <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold">
                    <Music2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">{currentTrack.title}</h4>
                    <p className="text-xs text-zinc-400">
                      {currentTrack.artist} • {currentTrack.album || 'Single'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {currentTrackProfile ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>Custom Track EQ Active</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium">
                      Using Global Sound Profile
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#09090B] border border-[#272733] text-center text-xs text-zinc-500">
                No track currently playing. Play a track to view or assign custom EQ memory.
              </div>
            )}
          </div>

          {/* Saved Track Profiles Library Table */}
          <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[#F5F3FF] text-sm">Saved Track EQ Library</h3>
                <p className="text-xs text-[#A1A1AA]">
                  {allTrackProfiles.length} track{allTrackProfiles.length === 1 ? '' : 's'} with personalized acoustic profiles
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter saved tracks..."
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {filteredTrackProfiles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#272733] text-zinc-400">
                      <th className="py-2.5 px-3">Track & Artist</th>
                      <th className="py-2.5 px-3">Album</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrackProfiles.map((tp) => (
                      <tr key={tp.trackIdentity} className="border-b border-[#272733]/60 hover:bg-zinc-900/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-zinc-200">{tp.title}</div>
                          <div className="text-[11px] text-zinc-400">{tp.artist}</div>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400">{tp.album || '—'}</td>
                        <td className="py-2.5 px-3 capitalize text-violet-300 font-mono">{tp.mode}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              tp.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
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
                            className="p-1 rounded-lg hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition-colors"
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
              <div className="py-8 text-center text-xs text-zinc-500">
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
          <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-[#272733] pb-3">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                <RefreshCw size={13} />
                <span>Rescan Hardware</span>
              </button>
            </div>

            {/* Architecture Transparency Banner */}
            <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 flex items-center gap-3 text-xs text-violet-200">
              <Info size={16} className="text-violet-400 shrink-0" />
              <span>
                <strong>Shared Mode Architecture:</strong> Harmoniq routes audio through Windows Shared Mode (WASAPI Shared) via Chromium Engine. Sample rates are automatically matched to prevent audible conversion artifacts.
              </span>
            </div>

            {/* Active Device Preference Adjustments */}
            {(() => {
              const activeDev = outputDevices.find((d) => d.deviceId === currentDeviceId) || outputDevices[0];
              const activeProfile = activeDev ? deviceProfiles.find((p) => p.deviceId === activeDev.deviceId) : null;
              const preferredVol = activeProfile?.preferredVolume ?? volume;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Preferred Volume Memory */}
                  <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <Volume2 size={14} className="text-violet-400" />
                        <span>Remembered Volume</span>
                      </span>
                      <span className="font-mono text-zinc-100 font-bold">
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
                      className="w-full accent-[var(--accent-dynamic)]"
                    />
                    <p className="text-[11px] text-zinc-500">
                      Harmoniq automatically sets application volume to {Math.round(preferredVol * 100)}% when this device connects.
                    </p>
                  </div>

                  {/* Associated Sound Profile */}
                  <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                        <Sparkles size={14} className="text-violet-400" />
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
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg p-2 outline-none"
                    >
                      <option value="">No automatic profile (Use active global profile)</option>
                      {soundProfiles.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({sp.category})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500">
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
                      ? 'bg-violet-950/20 border-violet-500/60 shadow-glow-sm ring-1 ring-violet-500/30'
                      : 'bg-[#14141B] border-[#272733] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        isSelected
                          ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                          : 'bg-[#1B1B24] text-zinc-400 border border-[#272733]'
                      }`}
                    >
                      {isHeadphone ? <Headphones size={20} /> : <Speaker size={20} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-100">{dev.label}</h4>
                        {dev.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {dev.sampleRate ? `${dev.sampleRate / 1000} kHz` : '48 kHz'} • {dev.channels ? `${dev.channels}ch` : 'Stereo'}
                      </p>
                      {devProfile && (
                        <p className="text-[11px] text-violet-300 font-mono">
                          Vol: {Math.round((devProfile.preferredVolume || 0.85) * 100)}%
                          {devProfile.preferredSoundProfileId && ` • Profile: ${devProfile.preferredSoundProfileId}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
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
              <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield size={20} className="text-violet-400" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">Audio Path & Bit-Perfect Transparency</h3>
                      <p className="text-xs text-zinc-400">{qualityReport.bitPerfect.explanation}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-600/20 text-violet-300 border border-violet-500/30">
                    {qualityReport.bitPerfect.status.toUpperCase()}
                  </span>
                </div>

                {/* Transparency Factors Breakdown */}
                <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#272733] space-y-1.5 text-xs text-zinc-400">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                    Audio Pipeline Audit:
                  </span>
                  <ul className="space-y-1 list-disc list-inside">
                    {qualityReport.bitPerfect.reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Side-by-Side Diagnostics: Source vs Processing vs Output */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Source Specs */}
                <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#272733] pb-2">
                    <span className="text-xs font-bold text-violet-400 flex items-center gap-1.5">
                      <FileAudio size={15} />
                      <span>Source Audio Stream</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        qualityReport.source.isLossless
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {qualityReport.source.qualityTier}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-zinc-400">
                    <div className="flex justify-between">
                      <span>Codec:</span>
                      <span className="text-zinc-100 font-bold">{qualityReport.source.codec}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Container:</span>
                      <span className="text-zinc-100 uppercase">{qualityReport.source.container}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sample Rate:</span>
                      <span className="text-zinc-100">{(qualityReport.source.sampleRateHz / 1000).toFixed(1)} kHz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bit Depth:</span>
                      <span className="text-zinc-100">
                        {qualityReport.source.bitDepthBits ? `${qualityReport.source.bitDepthBits}-Bit` : 'N/A (Lossy)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bitrate:</span>
                      <span className="text-zinc-100">{qualityReport.source.bitrateKbps} kbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Channels:</span>
                      <span className="text-zinc-100">{qualityReport.source.channelLayout}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Source Type:</span>
                      <span className="text-zinc-100 capitalize">{qualityReport.source.sourceType}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Processing Pipeline */}
                <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#272733] pb-2">
                    <span className="text-xs font-bold text-violet-400 flex items-center gap-1.5">
                      <Sliders size={15} />
                      <span>DSP Processing</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        qualityReport.processing.isDspEnabled
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {qualityReport.processing.isDspEnabled ? 'Active' : 'Bypassed'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-zinc-400">
                    <div className="flex justify-between">
                      <span>Resampling:</span>
                      <span
                        className={
                          qualityReport.processing.isResampling ? 'text-amber-400' : 'text-emerald-400'
                        }
                      >
                        {qualityReport.processing.isResampling ? 'Active' : 'Bit-Matched'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Preamp:</span>
                      <span className="text-zinc-100">{qualityReport.processing.preampDb.toFixed(1)} dB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ReplayGain:</span>
                      <span className="text-zinc-100">
                        {qualityReport.processing.replayGainApplied ? 'Engaged' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limiter Reduction:</span>
                      <span
                        className={
                          qualityReport.processing.limiterActive ? 'text-rose-400' : 'text-zinc-100'
                        }
                      >
                        {qualityReport.processing.limiterActive ? 'Clipping Prevented' : '0.0 dB'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#272733] text-[11px] text-zinc-400">
                      <span className="font-bold text-zinc-300">Active DSP Stages:</span>
                      <div className="mt-1 space-y-0.5 text-zinc-400">
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
                <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-[#272733] pb-2">
                    <span className="text-xs font-bold text-violet-400 flex items-center gap-1.5">
                      <Speaker size={15} />
                      <span>Hardware Output</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      WASAPI SHARED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-zinc-400">
                    <div className="flex justify-between">
                      <span>Endpoint:</span>
                      <span className="text-zinc-100 truncate max-w-[140px]" title={qualityReport.output.deviceName}>
                        {qualityReport.output.deviceName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Driver Mode:</span>
                      <span className="text-zinc-100">Shared Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output Rate:</span>
                      <span className="text-zinc-100">{qualityReport.output.outputSampleRateHz / 1000} kHz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Channels:</span>
                      <span className="text-zinc-100">{qualityReport.output.outputChannels} Channels</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Buffer Latency:</span>
                      <span className="text-zinc-100">{qualityReport.output.latencyMs} ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-2xl bg-[#14141B] border border-[#272733] text-center space-y-3 shadow-card">
              <FileAudio size={32} className="mx-auto text-zinc-500" />
              <h4 className="text-sm font-bold text-zinc-200">No Audio Stream Active</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Play any track from your library or stream to inspect truthful source metadata, decoded stream parameters, active DSP filtering, and output routing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Save Custom Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePreset}
            className="w-full max-w-md p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-[#F5F3FF] text-base">Save Custom Equalizer Preset</h3>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Sennheiser HD650 Target"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-sm text-[#F5F3FF] focus:outline-none focus:border-[var(--accent-dynamic)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-[#1B1B24] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-white text-xs font-bold shadow-glow-sm"
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Save Custom Sound Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-md p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-[#F5F3FF] text-base">Save as Custom Sound Profile</h3>
            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Profile Name (e.g. Audiophile Warmth)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-sm text-[#F5F3FF] focus:outline-none focus:border-[var(--accent-dynamic)]"
              />
              <textarea
                placeholder="Description of acoustic tuning intent..."
                value={newProfileDesc}
                onChange={(e) => setNewProfileDesc(e.target.value)}
                className="w-full h-20 px-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-xs text-[#F5F3FF] focus:outline-none focus:border-[var(--accent-dynamic)] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 rounded-xl bg-[#1B1B24] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-glow-sm"
              >
                Save Sound Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AutoEQ Profile Import Modal */}
      <AutoEqImportModal
        isOpen={showAutoEqModal}
        onClose={() => setShowAutoEqModal(false)}
        onApply={(filters, preamp) => {
          importAutoEqProfile(filters, preamp);
          showToast(`Imported ${filters.length} AutoEQ parametric bands`, 'success');
        }}
      />
    </div>
  );
};
