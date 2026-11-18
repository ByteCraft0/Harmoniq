import React from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { audioEngine } from '../../services/audioEngine';
import { ReplayGainMode } from '../../types/audio';
import {
  Settings,
  FolderPlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sliders,
  Volume2,
  Layers,
  Check,
  Shield,
  Activity,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { stats, addMusicFolders, rescanLibrary } = useLibrary();
  const {
    currentTrack,
    replayGainMode,
    setReplayGainMode,
    crossfadeDuration,
    setCrossfadeDuration,
    isCrossfadeEnabled,
    setCrossfadeEnabled,
    preservesPitch,
    togglePreservePitch,
  } = usePlayer();

  const rgInfo = audioEngine.getActiveReplayGainInfo();

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-4xl mx-auto select-none">
      {/* Title */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-[#272733]">
        <div className="p-3 rounded-xl bg-gradient-to-tr from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F5F3FF]">Application Settings</h1>
          <p className="text-xs text-[#A1A1AA]">
            Configure library folders, audio engine behavior, gapless transitions, crossfade, and ReplayGain normalization.
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
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
            <RefreshCw size={13} className={stats.isScanning ? 'animate-spin text-[var(--accent-dynamic)]' : ''} />
            <span>Rescan Library</span>
          </button>
        </div>
      </div>

      {/* Core Playback Enhancements (Batch 1) */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
        <div className="flex items-center justify-between border-b border-[#272733] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--accent-dynamic)]" />
              <span>Core Playback Engine</span>
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Audiophile transitions, dual-deck buffer staging, and perceived loudness normalization.
            </p>
          </div>
          <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
            Dual-Deck WebAudio Engine
          </span>
        </div>

        {/* 1. Gapless Playback */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[var(--accent-dynamic)]" />
              <span className="text-xs font-bold text-[#F5F3FF]">Gapless Playback</span>
            </div>
            <span
              className={`text-[11px] font-mono-numbers px-2 py-0.5 rounded-full font-bold border ${
                !isCrossfadeEnabled
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#181822] border-[#272733] text-[#71717A]'
              }`}
            >
              {!isCrossfadeEnabled ? 'Active (0ms Gap)' : 'Standby (Crossfade Overrides)'}
            </span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Eliminates silence and decoder pauses between consecutive tracks by pre-buffering the upcoming queue item on a dedicated standby deck. Perfect for live concerts, DJ sets, concept albums, and classical suites.
          </p>
        </div>

        {/* 2. Crossfade Between Songs */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-[var(--accent-dynamic)]" />
                <span className="text-xs font-bold text-[#F5F3FF]">Crossfade Between Songs</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Gradually attenuates the outgoing track while fading in the next track using equal-power Web Audio fader ramps.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={isCrossfadeEnabled}
                onChange={(e) => setCrossfadeEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-dynamic)]"></div>
            </label>
          </div>

          {isCrossfadeEnabled && (
            <div className="pt-2 border-t border-[#1B1B24] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A1A1AA]">Crossfade Duration:</span>
                <span className="font-mono-numbers text-[var(--accent-dynamic)] font-bold text-sm">
                  {crossfadeDuration} {crossfadeDuration === 1 ? 'second' : 'seconds'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={crossfadeDuration}
                onChange={(e) => setCrossfadeDuration(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--accent-dynamic)]"
              />
              <div className="flex justify-between text-[10px] font-mono-numbers text-[#71717A]">
                <span>1s (Snappy Blend)</span>
                <span>6s (Recommended)</span>
                <span>12s (Atmospheric Overlay)</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. ReplayGain Normalization */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-[var(--accent-dynamic)]" />
                <span className="text-xs font-bold text-[#F5F3FF]">Volume Normalization (ReplayGain)</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Normalizes loudness across diverse recordings (EBU R128 / 89 dB reference target) through internal gain stages without changing your master volume.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={replayGainMode !== 'off'}
                onChange={(e) => setReplayGainMode(e.target.checked ? 'track' : 'off')}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-dynamic)]"></div>
            </label>
          </div>

          {replayGainMode !== 'off' && (
            <div className="pt-2 border-t border-[#1B1B24] space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#A1A1AA]">Normalization Mode:</span>
                <div className="flex items-center bg-[#14141B] border border-[#272733] rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setReplayGainMode('track')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      replayGainMode === 'track'
                        ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                        : 'text-[#71717A] hover:text-[#F5F3FF]'
                    }`}
                  >
                    Track Gain
                  </button>
                  <button
                    onClick={() => setReplayGainMode('album')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      replayGainMode === 'album'
                        ? 'bg-[var(--accent-dynamic)] text-white font-bold'
                        : 'text-[#71717A] hover:text-[#F5F3FF]'
                    }`}
                  >
                    Album Gain
                  </button>
                </div>
              </div>

              {/* Real-time ReplayGain status on current track */}
              <div className="p-3 rounded-lg bg-[#14141B] border border-[#272733]/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[var(--accent-dynamic)] shrink-0" />
                  <span className="text-[#A1A1AA]">
                    Current Track ({currentTrack ? currentTrack.title : 'None'}):
                  </span>
                  <span className="font-mono-numbers font-bold text-[#F5F3FF]">
                    {currentTrack?.replayGain
                      ? `${rgInfo.gainDb > 0 ? '+' : ''}${rgInfo.gainDb.toFixed(2)} dB (${(rgInfo.linearGain * 100).toFixed(0)}%)`
                      : 'No ReplayGain tags (0.00 dB unity applied)'}
                  </span>
                </div>
                {rgInfo.isClippingPrevented && (
                  <span className="text-[10px] font-mono-numbers text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield size={10} />
                    <span>Peak Clamped (-0.1 dBFS Safe Headroom)</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pitch Preservation */}
        <div className="flex items-center justify-between pt-1">
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
            className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
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
          <span className="text-[#A1A1AA]">Harmoniq Reference Audio v1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span>Dual-Deck Buffer Architecture:</span>
          <span className="text-emerald-400 font-bold">Gapless Preloader & Equal-Power Crossfader</span>
        </div>
        <div className="flex justify-between">
          <span>Normalization Engine:</span>
          <span className="text-[#A1A1AA]">EBU R128 / ReplayGain v2 with Peak Headroom Guard</span>
        </div>
      </div>
    </div>
  );
};
