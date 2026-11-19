import React, { useState, useEffect, useRef } from 'react';
import { AutoEqImportService, AutoEqParseResult } from '../../services/audio/autoEqImportService';
import { ParametricFilterConfig } from '../../types/dsp';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Sparkles, Sliders } from 'lucide-react';

interface AutoEqImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: ParametricFilterConfig[], preamp?: number) => void;
}

const EXAMPLE_PROFILE = `Preamp: -6.2 dB
Filter 1: ON PK Fc 32 Hz Gain 3.5 dB Q 1.41
Filter 2: ON PK Fc 64 Hz Gain -2.0 dB Q 2.0
Filter 3: ON LSC Fc 105 Hz Gain 2.5 dB Q 0.71
Filter 4: ON PK Fc 250 Hz Gain -1.2 dB Q 1.2
Filter 5: ON PK Fc 1000 Hz Gain 1.8 dB Q 1.5
Filter 6: ON PK Fc 3000 Hz Gain -3.0 dB Q 2.5
Filter 7: ON HSC Fc 8000 Hz Gain 2.0 dB Q 0.71
Filter 8: ON HP Fc 20 Hz Gain 0.0 dB Q 0.71`;

export const AutoEqImportModal: React.FC<AutoEqImportModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [inputText, setInputText] = useState('');
  const [parseResult, setParseResult] = useState<AutoEqParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse text whenever input changes
  useEffect(() => {
    if (!inputText.trim()) {
      setParseResult(null);
      return;
    }
    const result = AutoEqImportService.parseAutoEqText(inputText);
    setParseResult(result);
  }, [inputText]);

  // Draw preview frequency response curve
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !parseResult || !parseResult.success || parseResult.filters.length === 0) {
      return;
    }
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

    // Grid lines
    const minFreq = 20;
    const maxFreq = 20000;
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    const rangeDb = 24; // -12 to +12 dB
    const centerY = height / 2;

    const freqToX = (f: number) => {
      const logVal = Math.log10(Math.max(minFreq, Math.min(maxFreq, f)));
      return 20 + ((logVal - minLog) / (maxLog - minLog)) * (width - 40);
    };

    const gainToY = (g: number) => {
      const clamped = Math.max(-12, Math.min(12, g));
      return centerY - (clamped / rangeDb) * (height - 20);
    };

    // Draw horizontal 0dB line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Sample 120 points for response curve
    const numSamples = 120;
    const testFreqs = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const logVal = minLog + (i / (numSamples - 1)) * (maxLog - minLog);
      testFreqs[i] = Math.pow(10, logVal);
    }

    const responseDb = AutoEqImportService.evaluateParametricResponse(
      parseResult.filters,
      parseResult.preamp,
      testFreqs
    );

    // Draw curve
    ctx.strokeStyle = '#A78BFA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = freqToX(testFreqs[i]);
      const y = gainToY(responseDb[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(167, 139, 250, 0.25)');
    grad.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
    ctx.lineTo(freqToX(testFreqs[numSamples - 1]), centerY);
    ctx.lineTo(freqToX(testFreqs[0]), centerY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, [parseResult]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (typeof content === 'string') {
        setInputText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApply = () => {
    if (!parseResult || !parseResult.success || parseResult.filters.length === 0) return;
    onApply(parseResult.filters, parseResult.preamp);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Import AutoEQ / Equalizer APO Profile</h2>
              <p className="text-xs text-zinc-400">
                Paste parametric EQ filters or load an exported headphone/speaker correction text file.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Quick Action Toolbar */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">Profile Text / Instructions</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputText(EXAMPLE_PROFILE)}
                className="px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
              >
                Load Example Profile
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 font-medium transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .txt File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Paste Equalizer APO or AutoEQ text here...\nExample:\nPreamp: -6.0 dB\nFilter 1: ON PK Fc 32 Hz Gain 3.0 dB Q 1.41\nFilter 2: ON LSC Fc 105 Hz Gain -2.0 dB Q 0.71`}
            className="w-full h-36 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
            spellCheck={false}
          />

          {/* Real-Time Parse Feedback */}
          {parseResult && (
            <div className="space-y-3">
              {parseResult.success ? (
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        Valid profile: {parseResult.filters.length} parametric band
                        {parseResult.filters.length > 1 ? 's' : ''} detected
                      </span>
                    </div>
                    {parseResult.preamp !== 0 && (
                      <span className="font-mono text-zinc-300 font-medium">
                        Preamp:{' '}
                        <strong className="text-violet-300">
                          {parseResult.preamp > 0 ? `+${parseResult.preamp}` : parseResult.preamp} dB
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Warnings if any */}
                  {parseResult.warnings.map((warn, wIdx) => (
                    <div
                      key={wIdx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{warn}</span>
                    </div>
                  ))}

                  {/* Frequency Response Preview Curve */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Offline Response Preview</span>
                      <span>20 Hz – 20 kHz (±12 dB)</span>
                    </div>
                    <div className="w-full h-24 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative">
                      <canvas ref={previewCanvasRef} className="w-full h-full block" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseResult.error || 'Could not parse valid filters from text.'}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setInputText('')}
            disabled={!inputText}
            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
          >
            Clear Text
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!parseResult || !parseResult.success || parseResult.filters.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white shadow-lg shadow-violet-600/25 transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Apply to Equalizer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
