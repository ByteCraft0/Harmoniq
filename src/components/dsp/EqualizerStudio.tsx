import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDSP } from '../../context/DSPContext';
import { useToast } from '../../context/ToastContext';
import { EQ_FREQUENCIES, ParametricFilterType, ParametricFilterConfig } from '../../types/dsp';
import { audioEngine } from '../../services/audioEngine';
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
  Download,
  Upload,
  Edit2,
  Settings2,
  SlidersHorizontal,
  X,
  Gauge,
  HelpCircle,
} from 'lucide-react';

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
  } = useDSP();

  const { showToast } = useToast();
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Interactive frequency curve canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  const formatFreq = (freq: number) => {
    return freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`;
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

  // Logarithmic frequency calculation (20 Hz - 20,000 Hz)
  const minFreq = 20;
  const maxFreq = 20000;
  const rangeDb = 24; // -12 to +12 dB scale

  const freqToX = useCallback((freq: number, width: number) => {
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const logVal = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
    return ((logVal - minLog) / (maxLog - minLog)) * (width - 40) + 20;
  }, []);

  const xToFreq = useCallback((x: number, width: number) => {
    const clampedX = Math.max(20, Math.min(width - 20, x));
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const fraction = (clampedX - 20) / (width - 40);
    const logVal = minLog + fraction * (maxLog - minLog);
    return Math.round(Math.pow(10, logVal));
  }, []);

  const gainToY = useCallback((gain: number, height: number) => {
    const centerY = height / 2;
    const clamped = Math.max(-14, Math.min(14, gain));
    return centerY - (clamped / rangeDb) * (height - 30);
  }, []);

  const yToGain = useCallback((y: number, height: number) => {
    const centerY = height / 2;
    const deltaY = centerY - y;
    const gain = (deltaY / (height - 30)) * rangeDb;
    return Math.round(Math.max(-12, Math.min(12, gain)) * 10) / 10;
  }, []);

  // Draw response curve and draggable handles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
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

    // 1. Grid lines and Frequency labels
    const gridFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    gridFreqs.forEach((gf) => {
      const gx = freqToX(gf, width);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();

      ctx.fillStyle = '#52525B';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatFreq(gf), gx, height - 6);
    });

    // Horizontal dB lines (-12, -6, 0, +6, +12)
    const dbLines = [12, 6, 0, -6, -12];
    dbLines.forEach((db) => {
      const gy = gainToY(db, height);
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

    // 2. Sample 160 points for physical BiquadFilter response curve
    const numSamples = 160;
    const testFreqs = new Float32Array(numSamples);
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);

    for (let i = 0; i < numSamples; i++) {
      const logVal = minLog + (i / (numSamples - 1)) * (maxLog - minLog);
      testFreqs[i] = Math.pow(10, logVal);
    }

    const responseDb = audioEngine.getCombinedFrequencyResponse(testFreqs);

    // Draw Smooth Frequency Response Line
    ctx.strokeStyle = settings.enabled ? '#A78BFA' : '#71717A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i < numSamples; i++) {
      const x = freqToX(testFreqs[i], width);
      const y = gainToY(responseDb[i], height);
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

      ctx.lineTo(freqToX(testFreqs[numSamples - 1], width), height / 2);
      ctx.lineTo(freqToX(testFreqs[0], width), height / 2);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }

    // 3. Draw Interactive Handles
    if (settings.eqMode === 'parametric') {
      // Draw Parametric Filter handles
      settings.parametricFilters.forEach((filter, idx) => {
        if (!filter.enabled) return;
        const hx = freqToX(filter.frequency, width);
        const hy = gainToY(filter.gain, height);
        const isHovered = hoveredPointId === filter.id;
        const isDragged = draggingPointId === filter.id;

        // Node Glow Ring
        ctx.fillStyle = isDragged || isHovered ? '#C084FC' : '#8B5CF6';
        ctx.beginPath();
        ctx.arc(hx, hy, isDragged || isHovered ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node Label
        ctx.fillStyle = '#F5F3FF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${idx + 1}`, hx, hy - 10);
      });
    } else {
      // Draw 10-Band Graphic EQ nodes
      EQ_FREQUENCIES.forEach((freq, idx) => {
        const gain = settings.bands[idx] ?? 0;
        const hx = freqToX(freq, width);
        const hy = gainToY(gain, height);
        const isHovered = hoveredPointId === `band_${idx}`;

        ctx.fillStyle = isHovered ? '#C084FC' : '#A78BFA';
        ctx.beginPath();
        ctx.arc(hx, hy, isHovered ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [
    settings,
    hoveredPointId,
    draggingPointId,
    freqToX,
    gainToY,
    settings.bands,
    settings.parametricFilters,
  ]);

  // Handle Canvas Mouse Dragging for Parametric Filter Points
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (settings.eqMode !== 'parametric') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find closest filter handle within 15px radius
    let closestId: string | null = null;
    let minDist = 18;

    settings.parametricFilters.forEach((filter) => {
      if (!filter.enabled) return;
      const hx = freqToX(filter.frequency, rect.width);
      const hy = gainToY(filter.gain, rect.height);
      const dist = Math.hypot(mouseX - hx, mouseY - hy);
      if (dist < minDist) {
        minDist = dist;
        closestId = filter.id;
      }
    });

    if (closestId) {
      setDraggingPointId(closestId);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingPointId) {
      const newFreq = xToFreq(mouseX, rect.width);
      const newGain = yToGain(mouseY, rect.height);
      updateParametricFilter(draggingPointId, { frequency: newFreq, gain: newGain });
      return;
    }

    // Update hovered node
    let foundHover: string | null = null;
    if (settings.eqMode === 'parametric') {
      settings.parametricFilters.forEach((filter) => {
        if (!filter.enabled) return;
        const hx = freqToX(filter.frequency, rect.width);
        const hy = gainToY(filter.gain, rect.height);
        if (Math.hypot(mouseX - hx, mouseY - hy) < 12) foundHover = filter.id;
      });
    }
    setHoveredPointId(foundHover);
  };

  const handleCanvasMouseUp = () => {
    setDraggingPointId(null);
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
                32-Bit Floating Point DSP
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              10-Band Graphic EQ • Advanced Parametric Filters • Cascaded Biquad Engine
            </p>
          </div>
        </div>

        {/* Master Switches & Mode Selector */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1B1B24] border border-[#272733] rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setEQMode('graphic')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                settings.eqMode === 'graphic'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              10-Band Graphic
            </button>
            <button
              onClick={() => setEQMode('parametric')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                settings.eqMode === 'parametric'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Parametric EQ
            </button>
          </div>

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
            <span>{settings.enabled ? 'Bypass: OFF' : 'Bypass: ON'}</span>
          </button>
        </div>
      </div>

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
          ))}
        </div>
      </div>

      {/* Interactive Physical Biquad Response Curve Canvas */}
      <div className="p-5 rounded-2xl bg-[#09090B] border border-[#272733] space-y-2 shadow-card">
        <div className="flex justify-between items-center text-xs text-[#71717A] font-mono-numbers">
          <span className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
            <span>Combined Audio Response Curve ({settings.eqMode === 'graphic' ? '10-Band Graphic' : 'Parametric'})</span>
            {settings.eqMode === 'parametric' && (
              <span className="text-[10px] text-[var(--accent-dynamic)] bg-[#1B1B24] px-2 py-0.5 rounded-full border border-[#272733]">
                Drag nodes to adjust Hz & dB
              </span>
            )}
          </span>
          <span>±12 dB Reference Scale</span>
        </div>

        <div className="w-full h-44 bg-[#14141B] rounded-xl border border-[#272733] relative overflow-hidden flex items-center justify-center">
          {/* Subtle live visualizer background under curve */}
          <div className="absolute inset-x-4 bottom-2 opacity-20 pointer-events-none">
            <AudioVisualizer height={55} mode="spectrum" />
          </div>

          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className={`w-full h-full block ${settings.eqMode === 'parametric' ? 'cursor-crosshair' : 'cursor-default'}`}
          />
        </div>
      </div>

      {/* Main Mode View: 10-Band Graphic Sliders OR Parametric Filter Table */}
      {settings.eqMode === 'graphic' ? (
        /* 10-Band Graphic Sliders */
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
        /* Parametric Equalizer Filter Editor */
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-[#F5F3FF] text-sm">Parametric Filter Nodes</h3>
              <p className="text-xs text-[#A1A1AA]">
                Configurable Peaking, Shelving, and Cut filters with adjustable Frequency, Q factor, and Gain.
              </p>
            </div>
            <button
              onClick={() => addParametricFilter()}
              disabled={settings.parametricFilters.length >= 12}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <Plus size={14} />
              <span>Add Filter Node</span>
            </button>
          </div>

          <div className="space-y-3">
            {settings.parametricFilters.map((filter, idx) => (
              <div
                key={filter.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  filter.enabled
                    ? 'bg-[#0D0D12] border-[#272733]'
                    : 'bg-[#09090B]/60 border-[#1B1B24] opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="checkbox"
                    checked={filter.enabled}
                    onChange={() => toggleParametricFilter(filter.id)}
                    className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
                  />
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-dynamic)]/20 border border-[var(--accent-dynamic)] text-[var(--accent-dynamic)] font-mono-numbers text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>

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

                  {/* Gain Slider (for peaking & shelves) */}
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
                        {filter.gain > 0 ? `+${filter.gain.toFixed(1)}` : filter.gain.toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-18"
                      max="18"
                      step="0.5"
                      disabled={filter.type === 'lowpass' || filter.type === 'highpass'}
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
                      max="10.0"
                      step="0.1"
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
            className="w-full accent-[var(--accent-dynamic)]"
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
              className="w-full accent-[var(--accent-dynamic)]"
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
              className="w-full accent-[var(--accent-dynamic)]"
            />
          </div>
        </div>

        {/* Anti-Clipping Brickwall Limiter */}
        <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield size={16} className={settings.limiterEnabled ? 'text-emerald-400' : 'text-[#71717A]'} />
              <span className="text-sm font-bold text-[#F5F3FF]">Anti-Clipping Limiter</span>
            </div>
            <button
              onClick={toggleLimiter}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                settings.limiterEnabled
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#181822] border-[#272733] text-[#71717A]'
              }`}
            >
              {settings.limiterEnabled ? 'Active' : 'Disabled'}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono-numbers">
              <span className="text-[#A1A1AA]">Gain Reduction:</span>
              <span className="text-amber-400 font-bold">
                -{limiterMetrics.gainReductionDb.toFixed(1)} dB
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#09090B] overflow-hidden border border-[#272733]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
                style={{ width: `${Math.min(100, (limiterMetrics.gainReductionDb / 12) * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-[#A1A1AA]">
            3ms ultra-fast lookahead compressor prevents inter-sample clipping on hot masters.
          </p>
        </div>
      </div>

      {/* Save Custom Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePreset}
            className="w-full max-w-md p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#F5F3FF] text-base">Save Custom Preset</h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-[#71717A] hover:text-[#F5F3FF]"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Saves the current {settings.eqMode === 'graphic' ? '10-band' : 'parametric'} configuration, preamp, and tone settings to your local library.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Sennheiser HD650 Warm, Car Audio Punch..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-sm text-[#F5F3FF] placeholder-[#52525B] focus:outline-none focus:border-[var(--accent-dynamic)]"
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

      {/* Rename Custom Preset Modal */}
      {renamingPresetId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl space-y-4">
            <h3 className="font-bold text-[#F5F3FF] text-base">Rename Custom Preset</h3>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-sm text-[#F5F3FF] focus:outline-none focus:border-[var(--accent-dynamic)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingPresetId(null)}
                className="px-4 py-2 rounded-xl bg-[#1B1B24] text-xs font-semibold text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  renameCustomPreset(renamingPresetId, renameValue);
                  setRenamingPresetId(null);
                  showToast('Preset renamed', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent-dynamic)] text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
