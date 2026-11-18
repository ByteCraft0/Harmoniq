import React from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { ReplayGainMode } from '../../types/audio';
import {
  Settings,
  Folder,
  FolderPlus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { stats, addMusicFolders, rescanLibrary } = useLibrary();
  const {
    replayGainMode,
    setReplayGainMode,
    crossfadeDuration,
    setCrossfadeDuration,
    preservesPitch,
    togglePreservePitch,
  } = usePlayer();

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-4xl mx-auto select-none">
      {/* Title */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-[#272733]">
        <div className="p-3 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F5F3FF]">Application Settings</h1>
          <p className="text-xs text-[#A1A1AA]">
            Configure library folders, audio engine behavior, replay gain, and privacy policies.
          </p>
        </div>
      </div>

      {/* Music Folders Section */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
        <div className="flex items-center justify-between border-b border-[#272733] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#F5F3FF]">Local Music Folders</h3>
            <p className="text-xs text-[#A1A1AA]">
              Harmoniq recursively indexes audio files (.flac, .mp3, .wav, .m4a, .alac, .ogg, .opus) from these directories.
            </p>
          </div>
          <button
            onClick={addMusicFolders}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm"
          >
            <FolderPlus size={14} />
            <span>Add Folder</span>
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#272733] text-xs">
          <div className="space-y-0.5 font-mono-numbers">
            <span className="text-[#F5F3FF] font-bold">{stats.totalTracks.toLocaleString()} Tracks Scanned</span>
            <p className="text-[#71717A]">
              {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB • {Math.round(stats.totalDuration / 3600)} Hours total
            </p>
          </div>
          <button
            onClick={rescanLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <RefreshCw size={13} className={stats.isScanning ? 'animate-spin text-[#A78BFA]' : ''} />
            <span>Rescan Library</span>
          </button>
        </div>
      </div>

      {/* Audio Playback Engine Options */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-5 shadow-card">
        <h3 className="font-bold text-sm text-[#F5F3FF] border-b border-[#272733] pb-3">
          Playback Engine & Acoustics
        </h3>

        {/* ReplayGain */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-[#F5F3FF]">ReplayGain Normalization</span>
            <p className="text-[11px] text-[#A1A1AA]">
              Standardizes loudness across disparate tracks using embedded ReplayGain tags (EBU R128 / 89dB).
            </p>
          </div>
          <select
            value={replayGainMode}
            onChange={(e) => setReplayGainMode(e.target.value as ReplayGainMode)}
            className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-xs text-[#F5F3FF] focus:outline-none focus:border-[#A78BFA] font-mono-numbers"
          >
            <option value="off">Disabled</option>
            <option value="track">Track Mode</option>
            <option value="album">Album Mode</option>
          </select>
        </div>

        {/* Crossfade */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-[#F5F3FF]">Crossfade Duration</span>
            <span className="font-mono-numbers text-[#A78BFA] font-bold">
              {crossfadeDuration === 0 ? 'Disabled (Gapless Playback)' : `${crossfadeDuration} seconds`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={crossfadeDuration}
            onChange={(e) => setCrossfadeDuration(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>

        {/* Pitch Preservation */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-xs font-bold text-[#F5F3FF]">Pitch Preservation on Variable Speed</span>
            <p className="text-[11px] text-[#A1A1AA]">
              Preserves musical pitch when listening to podcasts or audiobooks at 0.5x to 3.0x speed.
            </p>
          </div>
          <input
            type="checkbox"
            checked={preservesPitch}
            onChange={togglePreservePitch}
            className="w-4 h-4 accent-[#7C3AED] rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-emerald-400" />
          <h3 className="font-bold text-sm text-[#F5F3FF]">Local-First & Privacy Guarantee</h3>
        </div>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          HARMONIQ operates completely offline. No tracking, no advertisements, no forced accounts, and no background telemetry. Your audio metadata, listening history, custom DSP profiles, and playlists are stored exclusively on your local machine.
        </p>
      </div>

      {/* Version & Technical Architecture Specs */}
      <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] text-[11px] font-mono-numbers text-[#71717A] space-y-1">
        <div className="flex justify-between">
          <span>Application:</span>
          <span className="text-[#A1A1AA]">Harmoniq Pro v1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span>Architecture:</span>
          <span className="text-[#A1A1AA]">Electron 34 + React 19 + TypeScript + Native Web Audio DSP</span>
        </div>
        <div className="flex justify-between">
          <span>Platform:</span>
          <span className="text-[#A1A1AA]">Windows 64-bit (x64)</span>
        </div>
      </div>
    </div>
  );
};
