import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { useDSP } from '../../context/DSPContext';
import { audioEngine } from '../../services/audioEngine';
import {
  FileAudio,
  Radio,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  Info,
} from 'lucide-react';

export const AudioQualityAnalyzer: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentTrack, volume, replayGainMode } = usePlayer();
  const { settings, limiterMetrics } = useDSP();

  const activeDeviceLabel = audioEngine.getCurrentSinkId() === 'default'
    ? 'Default Windows Audio Endpoint'
    : audioEngine.getCurrentSinkId() || 'Default Windows Audio Endpoint';

  const audioCtx = (audioEngine as any).audioCtx as AudioContext | null;
  const report = AudioQualityInspectorService.inspectCurrentPlayback(
    currentTrack,
    audioCtx,
    settings,
    limiterMetrics,
    volume,
    replayGainMode !== 'off',
    activeDeviceLabel,
    false
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDuration = (secs?: number) => {
    if (!secs || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack || !report) {
    return (
      <div className="p-6 rounded-2xl bg-[#09090B] border border-[#272733] text-center space-y-3">
        <FileAudio size={28} className="mx-auto text-[#71717A]" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#F5F3FF]">No Audio Stream Loaded</h4>
          <p className="text-xs text-[#71717A] max-w-sm mx-auto">
            Play a track from your library to inspect source file format, codec, sample rate, bit depth, and output pipeline diagnostics.
          </p>
        </div>
      </div>
    );
  }

  const { source, output, resampling } = report;

  return (
    <div className="space-y-4">
      {/* Resampling & Conversion Banner */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
          resampling.isResampling
            ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
            : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {resampling.isResampling ? (
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span className="font-semibold">{resampling.explanation}</span>
        </div>
        <span className="font-mono-numbers text-[11px] px-2 py-0.5 rounded bg-black/40 border border-white/10 shrink-0">
          {(source.sampleRateHz / 1000).toFixed(1)} kHz → {(output.outputSampleRateHz / 1000).toFixed(1)} kHz
        </span>
      </div>

      {/* Side-by-Side Diagnostic Specs: Source File vs. Hardware Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source File Specifications */}
        <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
          <div className="flex items-center justify-between border-b border-[#272733] pb-2">
            <span className="text-xs font-bold text-[#A78BFA] flex items-center gap-1.5">
              <FileAudio size={14} />
              <span>Source File Stream</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                source.isLossless
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {source.isLossless ? 'Lossless Stream' : 'Lossy Stream'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono-numbers">
            <div>
              <span className="text-[#71717A] block text-[10px]">FORMAT / CODEC</span>
              <span className="font-bold text-[#F5F3FF] truncate block" title={source.codecDetail}>
                {source.codec} ({source.container})
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">SAMPLE RATE</span>
              <span className="font-bold text-[#F5F3FF]">
                {source.sampleRateHz.toLocaleString()} Hz ({(source.sampleRateHz / 1000).toFixed(1)} kHz)
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">BIT DEPTH</span>
              <span className="font-bold text-[#F5F3FF]">
                {source.bitDepthBits ? `${source.bitDepthBits}-bit` : '16-bit equivalent'}
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">BITRATE</span>
              <span className="font-bold text-[#F5F3FF]">{source.bitrateKbps} kbps</span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">CHANNELS</span>
              <span className="font-bold text-[#F5F3FF]">{source.channelLayout} ({source.channels}ch)</span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">FILE SIZE / DURATION</span>
              <span className="font-bold text-[#F5F3FF]">
                {formatFileSize(source.fileSizeBytes)} • {formatDuration(source.durationSec)}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Output Engine Pipeline */}
        <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
          <div className="flex items-center justify-between border-b border-[#272733] pb-2">
            <span className="text-xs font-bold text-[var(--accent-dynamic)] flex items-center gap-1.5">
              <Cpu size={14} />
              <span>Output Audio Pipeline</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14141B] text-[#A1A1AA] border border-[#272733]">
              {output.driverMode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono-numbers">
            <div>
              <span className="text-[#71717A] block text-[10px]">ENDPOINT DEVICE</span>
              <span className="font-bold text-[#F5F3FF] truncate block" title={output.deviceName}>
                {output.deviceName}
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">HARDWARE SAMPLE RATE</span>
              <span className="font-bold text-[#F5F3FF]">
                {output.outputSampleRateHz.toLocaleString()} Hz ({(output.outputSampleRateHz / 1000).toFixed(1)} kHz)
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">PROCESSING DEPTH</span>
              <span className="font-bold text-[#F5F3FF]">{output.outputBitDepthBits}-bit float (IEEE 754)</span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">BUFFER & LATENCY</span>
              <span className="font-bold text-[#F5F3FF]">
                {output.bufferSizeSamples} samples (~{output.latencyMs} ms)
              </span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">CHANNEL ROUTING</span>
              <span className="font-bold text-[#F5F3FF] capitalize">{settings.channelMode || 'Stereo'}</span>
            </div>
            <div>
              <span className="text-[#71717A] block text-[10px]">STEREO BALANCE</span>
              <span className="font-bold text-[#F5F3FF]">
                {settings.balance === 0
                  ? 'Center (0.0)'
                  : settings.balance < 0
                  ? `Left ${Math.round(Math.abs(settings.balance) * 100)}%`
                  : `Right ${Math.round(settings.balance * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
