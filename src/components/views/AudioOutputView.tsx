import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useDSP } from '../../context/DSPContext';
import { audioEngine } from '../../services/audioEngine';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import {
  Speaker,
  Cpu,
  ShieldCheck,
  Info,
  CheckCircle2,
  HardDrive,
  Sliders,
  Check,
} from 'lucide-react';

export const AudioOutputView: React.FC = () => {
  const { currentTrack, volume, replayGainMode } = usePlayer();
  const { settings: dspSettings, limiterMetrics } = useDSP();

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [outputMode, setOutputMode] = useState<'shared' | 'exclusive'>('shared');
  const [bufferSize, setBufferSize] = useState<number>(512);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = allDevices.filter((d) => d.kind === 'audiooutput');
          setDevices(audioOutputs);
          if (audioOutputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(audioOutputs[0].deviceId);
          }
        }
      } catch (e) {
        console.warn('Could not enumerate audio output devices:', e);
      }
    };

    loadDevices();
  }, [selectedDeviceId]);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    await audioEngine.setAudioOutputDevice(deviceId);
  };

  const audioCtx = audioEngine.getAudioContext();
  const report = AudioQualityInspectorService.inspectCurrentPlayback(
    currentTrack,
    audioCtx,
    dspSettings,
    limiterMetrics,
    volume,
    replayGainMode !== 'off',
    devices.find((d) => d.deviceId === selectedDeviceId)?.label || 'Windows Default Audio Endpoint',
    outputMode === 'exclusive'
  );

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-5xl mx-auto select-none">
      {/* Title */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-[#272733]">
        <div className="p-3 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm">
          <Speaker size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F5F3FF]">Audio Output & DAC Engine</h1>
          <p className="text-xs text-[#A1A1AA]">
            Configure Windows WASAPI shared/exclusive endpoints, hardware buffer sizes, and bit-perfect playback integrity.
          </p>
        </div>
      </div>

      {/* Bit-Perfect Master Status Banner */}
      <div
        className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card ${
          report?.bitPerfect.isBitPerfect
            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
            : 'bg-[#14141B] border-[#272733] text-[#F5F3FF]'
        }`}
      >
        <div className="flex items-center gap-3.5">
          {report?.bitPerfect.isBitPerfect ? (
            <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
          ) : (
            <Info size={28} className="text-[#A78BFA] shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-sm">
              {report?.bitPerfect.isBitPerfect
                ? 'Bit-Perfect Path Active'
                : 'Processed Audio Stream (Windows Audio Engine Shared Path)'}
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              {report?.bitPerfect.isBitPerfect
                ? 'Audio bits travel directly to DAC without Windows sample rate conversion, volume attenuation, or EQ alteration.'
                : 'Audio is routed through Windows Audio Engine (WASAPI Shared) or modified by active DSP filters.'}
            </p>
          </div>
        </div>
      </div>

      {/* Device Selection & Driver Mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Output Device */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <span className="font-bold text-sm text-[#F5F3FF]">Active Output Device</span>
            <span className="text-[10px] font-mono-numbers text-[#71717A]">Hardware Sink</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[#A1A1AA]">Select Audio Endpoint / DAC:</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] text-xs text-[#F5F3FF] focus:outline-none focus:border-[#A78BFA]"
            >
              <option value="">Default Windows Audio Endpoint</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Audio Output Device (${d.deviceId.substring(0, 8)})`}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 text-xs text-[#71717A] space-y-1.5 font-mono-numbers">
            <div className="flex justify-between">
              <span>Hardware Driver:</span>
              <span className="text-[#A1A1AA]">Windows CoreAudio / WASAPI</span>
            </div>
            <div className="flex justify-between">
              <span>Endpoint Sample Rate:</span>
              <span className="text-[#A1A1AA]">
                {audioCtx ? `${(audioCtx.sampleRate / 1000).toFixed(1)} kHz` : '48.0 kHz'}
              </span>
            </div>
          </div>
        </div>

        {/* Windows Audio Driver Mode */}
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <span className="font-bold text-sm text-[#F5F3FF]">WASAPI Operating Mode</span>
            <span className="text-[10px] font-mono-numbers text-[#71717A]">Driver Pipeline</span>
          </div>

          <div className="space-y-3">
            <div
              onClick={() => setOutputMode('shared')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                outputMode === 'shared'
                  ? 'bg-[#1B1B24] border-[#A78BFA] text-[#F5F3FF]'
                  : 'bg-[#09090B] border-[#272733] text-[#A1A1AA] hover:border-[#3B3B4E]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>WASAPI Shared Mode (Standard)</span>
                {outputMode === 'shared' && <CheckCircle2 size={15} className="text-[#A78BFA]" />}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Shares audio hardware with system notifications and apps. Resamples to Windows default format.
              </p>
            </div>

            <div
              onClick={() => setOutputMode('exclusive')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                outputMode === 'exclusive'
                  ? 'bg-[#1B1B24] border-[#A78BFA] text-[#F5F3FF]'
                  : 'bg-[#09090B] border-[#272733] text-[#A1A1AA] hover:border-[#3B3B4E]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>WASAPI Exclusive Mode (Bit-Perfect)</span>
                {outputMode === 'exclusive' && <CheckCircle2 size={15} className="text-[#A78BFA]" />}
              </div>
              <p className="text-[11px] text-[#71717A]">
                Grants exclusive direct hardware control to Harmoniq. Bypasses the Windows system audio mixer.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Buffer Size & Latency Configuration */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
        <div className="flex items-center justify-between border-b border-[#272733] pb-3">
          <span className="font-bold text-sm text-[#F5F3FF]">Hardware Buffer Size</span>
          <span className="text-[10px] font-mono-numbers text-[#71717A]">Latency Tuning</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[256, 512, 1024].map((size) => (
            <button
              key={size}
              onClick={() => setBufferSize(size)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                bufferSize === size
                  ? 'bg-[#1B1B24] border-[#A78BFA] text-[#F5F3FF]'
                  : 'bg-[#09090B] border-[#272733] text-[#A1A1AA] hover:border-[#3B3B4E]'
              }`}
            >
              <div className="font-mono-numbers font-bold text-xs mb-1">{size} Samples</div>
              <div className="text-[11px] text-[#71717A]">
                ~{((size / (audioCtx?.sampleRate || 48000)) * 1000).toFixed(1)} ms latency
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
