import React, { useState, useEffect } from 'react';
import { audioRoutingService } from '../../services/audioRoutingService';
import { volumeProfileService } from '../../services/volumeProfileService';
import { audioEngine } from '../../services/audioEngine';
import { AudioRoutingProfile, ListeningRoom } from '../../types/audioRouting';
import { AudioDeviceInfo } from '../../types/devices';
import { useToast } from '../../context/ToastContext';
import {
  Speaker,
  Headphones,
  Radio,
  Sliders,
  Check,
  RefreshCw,
  AlertCircle,
  Home,
  CheckCircle2,
  Volume2,
  Sparkles,
} from 'lucide-react';

export const AudioRoutingProfilesCard: React.FC = () => {
  const { showToast } = useToast();

  const [profiles, setProfiles] = useState<AudioRoutingProfile[]>(() => audioRoutingService.getProfiles());
  const [rooms, setRooms] = useState<ListeningRoom[]>(() => audioRoutingService.getRooms());
  const [activeProfile, setActiveProfile] = useState<AudioRoutingProfile>(() => audioRoutingService.getActiveProfile());
  const [activeRoom, setActiveRoom] = useState<ListeningRoom>(() => audioRoutingService.getActiveRoom());
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);

  const refreshState = () => {
    setProfiles(audioRoutingService.getProfiles());
    setRooms(audioRoutingService.getRooms());
    setActiveProfile(audioRoutingService.getActiveProfile());
    setActiveRoom(audioRoutingService.getActiveRoom());
  };

  useEffect(() => {
    const unsub = audioRoutingService.subscribe(() => {
      refreshState();
    });

    audioEngine.getAvailableOutputDevices().then(setDevices);

    const unsubDevice = audioEngine.subscribeDeviceChange((_, devs) => {
      setDevices(devs);
      refreshState();
    });

    return () => {
      unsub();
      unsubDevice();
    };
  }, []);

  const handleSelectProfile = async (profileId: string) => {
    const success = await audioRoutingService.setActiveProfile(profileId);
    if (success) {
      const p = audioRoutingService.getProfile(profileId);
      showToast(`Activated Output Profile: "${p?.name}"`, 'success');
    }
  };

  const handleSelectRoom = async (roomId: string) => {
    const success = await audioRoutingService.setActiveRoom(roomId);
    if (success) {
      const r = audioRoutingService.getRooms().find((rm) => rm.id === roomId);
      if (r?.volumeProfileId) {
        await volumeProfileService.setActiveProfile(r.volumeProfileId);
      }
      showToast(`Switched to Listening Room: "${r?.name}"`, 'success');
    }
  };

  const handleUpdatePreferredDevice = (profileId: string, deviceId: string) => {
    const dev = devices.find((d) => d.deviceId === deviceId);
    audioRoutingService.updateProfile(profileId, {
      preferredDeviceId: deviceId,
      preferredDeviceLabel: dev?.label || 'Audio Device',
    });
    showToast('Saved preferred device for profile', 'info');
  };

  const getProfileIcon = (category: AudioRoutingProfile['category']) => {
    switch (category) {
      case 'headphones':
        return <Headphones size={18} className="text-[#A78BFA]" />;
      case 'dac':
        return <Sliders size={18} className="text-emerald-400" />;
      case 'bluetooth':
        return <Radio size={18} className="text-sky-400" />;
      default:
        return <Speaker size={18} className="text-[var(--accent-dynamic)]" />;
    }
  };

  const getStatusBadge = (profile: AudioRoutingProfile) => {
    const state = audioRoutingService.getProfileConnectionState(profile);
    switch (state) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
            <CheckCircle2 size={11} /> Active
          </span>
        );
      case 'connected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950/40 text-sky-400 border border-sky-500/30 font-mono">
            Connected
          </span>
        );
      case 'disconnected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-mono">
            <AlertCircle size={11} /> Disconnected (Auto-Fallback)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B1B24] text-[#71717A] font-mono">
            Standby
          </span>
        );
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      <div className="flex items-center justify-between border-b border-[#272733] pb-3">
        <div>
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <Speaker size={16} className="text-[var(--accent-dynamic)]" />
            <span>Audio Routing Profiles & Listening Rooms</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Dedicated hardware endpoints, automatic disconnect recovery, and unified acoustic room environments.
          </p>
        </div>
        <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
          Dynamic Sink Routing
        </span>
      </div>

      {/* Section 1: Listening Rooms Quick Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F5F3FF] flex items-center gap-1.5">
            <Home size={14} className="text-[#A78BFA]" />
            <span>Listening Rooms</span>
          </span>
          <span className="text-[11px] text-[#71717A]">
            Current Room: <strong className="text-[var(--accent-dynamic)]">{activeRoom.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rooms.map((room) => {
            const isSelected = activeRoom.id === room.id;
            return (
              <div
                key={room.id}
                onClick={() => handleSelectRoom(room.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--accent-dynamic)]/15 border-[var(--accent-dynamic)] shadow-glow-sm'
                    : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-[#F5F3FF] truncate">{room.name}</span>
                  {isSelected && <Check size={14} className="text-[var(--accent-dynamic)]" />}
                </div>
                <p className="text-[10px] text-[#71717A] leading-tight line-clamp-2">
                  {room.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Audio Output Routing Profiles */}
      <div className="space-y-3 pt-2 border-t border-[#1B1B24]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#F5F3FF]">Output Routing Profiles</span>
          <button
            onClick={async () => {
              const devs = await audioEngine.getAvailableOutputDevices();
              setDevices(devs);
              showToast(`Refreshed ${devs.length} audio endpoints`, 'info');
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#09090B] hover:bg-[#1B1B24] border border-[#272733] text-[11px] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <RefreshCw size={11} />
            <span>Rescan Hardware</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {profiles.map((profile) => {
            const isCurrentActive = activeProfile.id === profile.id;
            return (
              <div
                key={profile.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrentActive
                    ? 'bg-[#181822] border-[var(--accent-dynamic)]/50'
                    : 'bg-[#09090B] border-[#272733]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[#14141B] border border-[#272733] shrink-0">
                      {getProfileIcon(profile.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F5F3FF]">{profile.name}</span>
                        {getStatusBadge(profile)}
                      </div>
                      <p className="text-[11px] text-[#71717A] font-mono-numbers mt-0.5">
                        Target Endpoint: {profile.preferredDeviceLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Device selector */}
                    <select
                      value={profile.preferredDeviceId}
                      onChange={(e) => handleUpdatePreferredDevice(profile.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#14141B] border border-[#272733] text-xs text-[#F5F3FF] outline-none cursor-pointer max-w-[200px] truncate"
                    >
                      <option value="default">Default Windows Endpoint</option>
                      {devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleSelectProfile(profile.id)}
                      disabled={isCurrentActive}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isCurrentActive
                          ? 'bg-[var(--accent-dynamic)] text-black'
                          : 'bg-[#14141B] hover:bg-[#1B1B24] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
                      }`}
                    >
                      {isCurrentActive ? 'Active' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
