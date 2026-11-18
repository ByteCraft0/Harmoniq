import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useDSP } from '../../context/DSPContext';
import { audioEngine } from '../../services/audioEngine';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { InspectionReport } from '../../types/inspector';
import { QualityBadge } from './QualityBadge';
import { MetadataEditorModal } from './MetadataEditorModal';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Cpu,
  Speaker,
  FileAudio,
  Sliders,
  Check,
  Edit3,
} from 'lucide-react';

export const AudioQualityInspector: React.FC = () => {
  const { currentTrack, volume, replayGainMode } = usePlayer();
  const { settings: dspSettings, limiterMetrics } = useDSP();
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [activeDeviceLabel, setActiveDeviceLabel] = useState('Windows Default Output Endpoint');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const updateReport = () => {
      const audioCtx = audioEngine.getAudioContext();
      const newReport = AudioQualityInspectorService.inspectCurrentPlayback(
        currentTrack,
        audioCtx,
        dspSettings,
        limiterMetrics,
        volume,
        replayGainMode !== 'off',
        activeDeviceLabel,
        false
      );
      setReport(newReport);
    };

    updateReport();
    const interval = setInterval(updateReport, 200);

    return () => clearInterval(interval);
  }, [currentTrack, dspSettings, limiterMetrics, volume, replayGainMode, activeDeviceLabel]);

  useEffect(() => {
    if (window.harmoniqApi?.getWindowsAudioDiagnostics) {
      window.harmoniqApi.getWindowsAudioDiagnostics().then((diag) => {
        if (diag && diag.defaultDevice && diag.defaultDevice.name) {
          setActiveDeviceLabel(diag.defaultDevice.name);
        }
      });
    }
  }, []);

  if (!currentTrack || !report) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#71717A] select-none">
        <div className="w-20 h-20 rounded-2xl bg-[#14141B] border border-[#272733] flex items-center justify-center text-[#3F3F46] mb-4 shadow-card">
          <FileAudio size={40} />
        </div>
        <h3 className="text-xl font-bold text-[#F5F3FF] mb-1">No Active Audio Stream</h3>
        <p className="text-xs text-[#A1A1AA] max-w-md">
          Start playback to inspect real stream metadata, sample rate conversion, and bit-perfect DAC delivery.
        </p>
      </div>
    );
  }

  const { source, output, resampling, bitPerfect, dspStatus } = report;

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-7 max-w-6xl mx-auto select-none">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase font-mono-numbers font-bold tracking-wider text-[#71717A]">
              Technical Stream Diagnostics
            </span>
            <QualityBadge
              tier={source.qualityTier}
              sampleRate={source.sampleRateHz}
              bitDepth={source.bitDepthBits}
              bitrate={source.bitrateKbps}
              size="md"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-[#F5F3FF] tracking-tight">
            {source.codecDetail}
          </h2>
          <p className="text-xs text-[#71717A] truncate max-w-2xl font-mono-numbers">
            {source.filePath}
          </p>
        </div>

        {/* Actions & Bit-Perfect Master Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--accent-dynamic)] text-xs font-semibold text-[#F5F3FF] transition-all active:scale-95 shadow-sm"
          >
            <Edit3 size={14} className="text-[var(--accent-dynamic)]" />
            <span>Edit Metadata</span>
          </button>

          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider font-mono-numbers ${
              bitPerfect.isBitPerfect
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'bg-[#1B1B24] border-[#272733] text-[#A1A1AA]'
            }`}
          >
            {bitPerfect.isBitPerfect ? (
              <ShieldCheck size={18} className="text-emerald-400" />
            ) : (
              <Info size={18} className="text-[#A78BFA]" />
            )}
            <span>{bitPerfect.isBitPerfect ? 'Bit-Perfect Path Active' : 'Processed Audio Pipeline'}</span>
          </div>
        </div>
      </div>

      {/* Signal Flow Diagram */}
      <div className="p-5 rounded-2xl bg-[#09090B] border border-[#272733] shadow-card">
        <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold block mb-3 font-mono-numbers">
          Real-time Signal Flow Architecture
        </span>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Node 1: Source */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="font-bold text-[11px]">1. Audio Source</span>
              <FileAudio size={14} className="text-[#A78BFA]" />
            </div>
            <div className="font-mono-numbers font-bold text-[#F5F3FF]">
              {source.codec} • {source.channels === 1 ? 'Mono' : 'Stereo'}
            </div>
            <div className="font-mono-numbers text-[11px] text-[#A1A1AA]">
              {source.bitDepthBits ? `${source.bitDepthBits}-bit / ` : ''}
              {(source.sampleRateHz / 1000).toFixed(1)} kHz
            </div>
          </div>

          {/* Node 2: DSP */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="font-bold text-[11px]">2. DSP Engine</span>
              <Sliders size={14} className="text-[#A78BFA]" />
            </div>
            <div className="font-mono-numbers font-bold text-[#F5F3FF]">
              {dspStatus.isBypassed ? 'Bypassed (0 dB)' : `${dspStatus.activeFiltersCount} Filters Active`}
            </div>
            <div className="font-mono-numbers text-[11px] text-[#A1A1AA]">
              Limiter: {dspStatus.limiterActive ? 'Attenuating' : 'Clean Headroom'}
            </div>
          </div>

          {/* Node 3: Windows Mixer / Resampler */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="font-bold text-[11px]">3. Windows Mixer</span>
              <Cpu size={14} className="text-[#A78BFA]" />
            </div>
            <div
              className={`font-mono-numbers font-bold ${
                resampling.isResampling ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {resampling.isResampling ? 'Resampling Active' : 'Native 1:1 Rate'}
            </div>
            <div className="font-mono-numbers text-[11px] text-[#A1A1AA]">
              {output.driverMode}
            </div>
          </div>

          {/* Node 4: Hardware DAC */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="font-bold text-[11px]">4. Audio Output</span>
              <Speaker size={14} className="text-[#A78BFA]" />
            </div>
            <div className="font-mono-numbers font-bold text-[#F5F3FF] truncate" title={output.deviceName}>
              {output.deviceName}
            </div>
            <div className="font-mono-numbers text-[11px] text-[#A1A1AA]">
              {(output.outputSampleRateHz / 1000).toFixed(1)} kHz • {output.outputBitDepthBits}-bit
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Source vs Output Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Technical Specifications */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div className="flex items-center gap-2">
              <FileAudio size={18} className="text-[#A78BFA]" />
              <h3 className="font-bold text-[#F5F3FF]">Source Stream Integrity</h3>
            </div>
            <span className="text-xs text-[#71717A] font-mono-numbers">Header Metadata</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Audio Format / Codec</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">{source.codec}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Container Format</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">{source.container}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Native Sample Rate</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {source.sampleRateHz.toLocaleString()} Hz ({(source.sampleRateHz / 1000).toFixed(1)} kHz)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Native Bit Depth</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {source.bitDepthBits ? `${source.bitDepthBits}-bit Linear PCM` : 'Lossy Perceptual Coding'}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Channels & Layout</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {source.channels} Channels ({source.channelLayout})
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Bitrate</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {source.bitrateKbps.toLocaleString()} kbps
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Lossless Classification</span>
              <span
                className={`font-mono-numbers font-bold ${
                  source.isLossless ? 'text-emerald-400' : 'text-sky-400'
                }`}
              >
                {source.isLossless ? 'Lossless Audio Stream' : 'Lossy Compressed Stream'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-[#A1A1AA]">File Size</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {(source.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          </div>
        </div>

        {/* Output Hardware & Driver Diagnostics */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div className="flex items-center gap-2">
              <Speaker size={18} className="text-[#A78BFA]" />
              <h3 className="font-bold text-[#F5F3FF]">Hardware Endpoint & Driver</h3>
            </div>
            <span className="text-xs text-[#71717A] font-mono-numbers">Endpoint State</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Active Audio Endpoint</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF] truncate max-w-[200px]" title={output.deviceName}>
                {output.deviceName}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Windows Driver Mode</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">{output.driverMode}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Endpoint Sample Rate</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {output.outputSampleRateHz.toLocaleString()} Hz ({(output.outputSampleRateHz / 1000).toFixed(1)} kHz)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Processing Bit Depth</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {output.outputBitDepthBits}-bit IEEE 754 Floating Point
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Buffer Size & Latency</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {output.bufferSizeSamples} samples (~{output.latencyMs} ms)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#1C1C24]">
              <span className="text-[#A1A1AA]">Anti-Clipping Limiter</span>
              <span
                className={`font-mono-numbers font-bold ${
                  limiterMetrics.isClippingPrevented ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {limiterMetrics.isClippingPrevented
                  ? `Active (-${limiterMetrics.gainReductionDb.toFixed(1)} dB reduction)`
                  : 'Idle (0.0 dB / Clean Headroom)'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-[#A1A1AA]">Digital Volume Attenuation</span>
              <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                {Math.round(volume * 100)}% {volume === 1 ? '(0 dB Unity)' : `(${((1 - volume) * -20).toFixed(1)} dB)`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resampling & Deterministic Bit-Perfect Diagnosis */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
        <div className="flex items-center justify-between border-b border-[#272733] pb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[#A78BFA]" />
            <h3 className="font-bold text-[#F5F3FF]">Resampling & Bit-Perfect Matrix</h3>
          </div>
          <span className="text-xs text-[#71717A] font-mono-numbers">Deterministic Verification</span>
        </div>

        <div className="space-y-4">
          {/* Resampling Diagnosis Banner */}
          <div
            className={`p-4 rounded-xl border text-sm ${
              resampling.isResampling
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {resampling.isResampling ? (
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold mb-1">
                  {resampling.isResampling
                    ? 'Sample Rate Conversion (Resampling) Active'
                    : '1:1 Bit-Matched Sample Rate'}
                </div>
                <p className="text-xs opacity-90">{resampling.explanation}</p>
              </div>
            </div>
          </div>

          {/* 5-Factor Verification Matrix */}
          <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
              Bit-Perfect Conditions Matrix
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                {bitPerfect.sampleRateMatched ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                )}
                <span className={bitPerfect.sampleRateMatched ? 'text-[#F5F3FF]' : 'text-[#A1A1AA]'}>
                  Sample Rate Matched ({source.sampleRateHz} Hz == {output.outputSampleRateHz} Hz)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {bitPerfect.volumeUnity ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                )}
                <span className={bitPerfect.volumeUnity ? 'text-[#F5F3FF]' : 'text-[#A1A1AA]'}>
                  100% Unity Volume (No digital attenuation)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {bitPerfect.dspBypassed ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                )}
                <span className={bitPerfect.dspBypassed ? 'text-[#F5F3FF]' : 'text-[#A1A1AA]'}>
                  DSP & Equalizer Bypassed / Flat
                </span>
              </div>

              <div className="flex items-center gap-2">
                {bitPerfect.replayGainDisabled ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                )}
                <span className={bitPerfect.replayGainDisabled ? 'text-[#F5F3FF]' : 'text-[#A1A1AA]'}>
                  ReplayGain Normalization Disabled
                </span>
              </div>
            </div>

            {bitPerfect.reasons.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#272733] text-[11px] text-[#A1A1AA] space-y-1">
                <span className="font-semibold text-zinc-300">Why audio is processed instead of bit-perfect:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[#71717A]">
                  {bitPerfect.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <MetadataEditorModal
        track={currentTrack}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
};
