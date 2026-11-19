import React, { useState, useEffect } from 'react';
import { volumeProfileService, PreviousVolumeSettings } from '../../services/volumeProfileService';
import { VolumeProfile } from '../../types/volumeProfile';
import { useToast } from '../../context/ToastContext';
import {
  Volume2,
  Sliders,
  Shield,
  RotateCcw,
  Check,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

export const VolumeProfilesCard: React.FC = () => {
  const { showToast } = useToast();

  const [profiles, setProfiles] = useState<VolumeProfile[]>(() => volumeProfileService.getProfiles());
  const [activeProfile, setActiveProfile] = useState<VolumeProfile>(() => volumeProfileService.getActiveProfile());
  const [previousSettings, setPreviousSettings] = useState<PreviousVolumeSettings | null>(() => volumeProfileService.getPreviousSettings());

  const refreshState = () => {
    setProfiles(volumeProfileService.getProfiles());
    setActiveProfile(volumeProfileService.getActiveProfile());
    setPreviousSettings(volumeProfileService.getPreviousSettings());
  };

  useEffect(() => {
    return volumeProfileService.subscribe(() => {
      refreshState();
    });
  }, []);

  const handleSelectProfile = async (profileId: string) => {
    const success = await volumeProfileService.setActiveProfile(profileId);
    if (success) {
      const p = volumeProfileService.getProfile(profileId);
      showToast(`Activated Volume Profile: "${p?.name}"`, 'success');
    }
  };

  const handleRestorePrevious = () => {
    const success = volumeProfileService.restorePreviousSettings();
    if (success) {
      showToast('Restored previous volume and ReplayGain settings', 'info');
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      <div className="flex items-center justify-between border-b border-[#272733] pb-3">
        <div>
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <Volume2 size={16} className="text-[var(--accent-dynamic)]" />
            <span>Advanced Volume Profiles & Loudness Normalization</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Separate target volume, pre-amp gain, EBU R128 normalization, and smooth equal-power fader ramps.
          </p>
        </div>
        <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
          Anti-Clipping DSP Protection
        </span>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => {
          const isSelected = activeProfile.id === profile.id;

          return (
            <div
              key={profile.id}
              onClick={() => handleSelectProfile(profile.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-[var(--accent-dynamic)]/10 border-[var(--accent-dynamic)]/60 shadow-glow-sm'
                  : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#F5F3FF]">{profile.name}</span>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-dynamic)]/20 text-[var(--accent-dynamic)] border border-[var(--accent-dynamic)]/30 font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-[var(--accent-dynamic)]" />}
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  {profile.description}
                </p>
              </div>

              {/* Technical Specifications Matrix */}
              <div className="pt-2 border-t border-[#1B1B24] grid grid-cols-3 gap-2 text-center font-mono-numbers text-[10px]">
                <div className="p-1.5 rounded-lg bg-[#14141B]">
                  <span className="text-[#71717A] block">Target Vol</span>
                  <span className="font-bold text-[#F5F3FF]">{Math.round(profile.targetVolume * 100)}%</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#14141B]">
                  <span className="text-[#71717A] block">Pre-amp</span>
                  <span className="font-bold text-[var(--accent-dynamic)]">
                    {profile.preampGainDb > 0 ? `+${profile.preampGainDb}` : profile.preampGainDb} dB
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#14141B]">
                  <span className="text-[#71717A] block">Target LUFS</span>
                  <span className="font-bold text-sky-400">{profile.targetLufs} LUFS</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Ceiling & Restore Previous Settings */}
      <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" />
            <span className="font-bold text-[#F5F3FF]">Anti-Clipping Safety Headroom</span>
          </div>
          <p className="text-[11px] text-[#71717A]">
            Current profile clamps inter-sample output to safe ceiling of {activeProfile.limiterMarginDb} dBFS, preventing DAC overs.
          </p>
        </div>

        {previousSettings && (
          <button
            onClick={handleRestorePrevious}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors shrink-0"
          >
            <RotateCcw size={13} />
            <span>Restore Previous Volume</span>
          </button>
        )}
      </div>
    </div>
  );
};
