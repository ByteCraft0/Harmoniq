import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { Speaker, Headphones, Check, RefreshCw, AlertCircle } from 'lucide-react';

export const AudioDeviceManager: React.FC = () => {
  const { outputDevices, currentDeviceId, setOutputDevice, refreshOutputDevices } = usePlayer();

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('headphone') || l.includes('headset') || l.includes('earphone')) {
      return <Headphones size={18} className="text-[#A78BFA]" />;
    }
    return <Speaker size={18} className="text-[var(--accent-dynamic)]" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#F5F3FF]">Audio Output Devices</h4>
          <p className="text-xs text-[#A1A1AA]">
            Select your preferred DAC, headphones, or soundcard endpoint. Supports live switching during playback.
          </p>
        </div>
        <button
          onClick={() => refreshOutputDevices()}
          title="Rescan audio output devices"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
        >
          <RefreshCw size={13} />
          <span>Rescan Devices</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {outputDevices.map((device) => {
          const isSelected = currentDeviceId === device.deviceId || (device.isDefault && (currentDeviceId === 'default' || !currentDeviceId));

          return (
            <div
              key={device.deviceId}
              onClick={() => setOutputDevice(device.deviceId)}
              className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-[var(--accent-dynamic)]/10 border-[var(--accent-dynamic)]/60 shadow-glow-sm'
                  : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 pr-2">
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent-dynamic)]/20 text-[#F5F3FF]'
                      : 'bg-[#14141B] text-[#71717A]'
                  }`}
                >
                  {getDeviceIcon(device.label)}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#F5F3FF] truncate">
                      {device.label || 'Standard Audio Endpoint'}
                    </span>
                    {device.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#272733] text-[#A1A1AA]">
                        System Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#71717A] font-mono-numbers">
                    {device.channels || 2} Channels • {((device.sampleRate || 48000) / 1000).toFixed(1)} kHz • {device.bitDepth || 24}-bit
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                {isSelected ? (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--accent-dynamic)]">
                    <Check size={14} className="stroke-[3]" />
                    <span>Active</span>
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-[#3E3E4E] hover:border-[#71717A]" />
                )}
              </div>
            </div>
          );
        })}

        {outputDevices.length === 0 && (
          <div className="col-span-2 p-6 rounded-xl bg-[#09090B] border border-[#272733] text-center space-y-2">
            <AlertCircle size={24} className="mx-auto text-[#71717A]" />
            <p className="text-xs text-[#A1A1AA]">No audio output devices detected by browser sandbox.</p>
          </div>
        )}
      </div>
    </div>
  );
};
