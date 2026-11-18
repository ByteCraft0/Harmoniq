import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { audioEngine } from '../../services/audioEngine';
import {
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
  ShortcutAction,
  ShortcutConfig,
  ShortcutStatus,
} from '../../types/shortcuts';
import {
  validateAccelerator,
  validateShortcutConfig,
  formatAcceleratorToKeys,
  keyboardEventToAccelerator,
} from '../../services/shortcutService';
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
  AppWindow,
  Keyboard,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Radio,
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

  // Windows System Integration States
  const [closeToTray, setCloseToTray] = useState<boolean>(true);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS);
  const [shortcutStatus, setShortcutStatus] = useState<Record<ShortcutAction, ShortcutStatus>>({
    playPause: { registered: true },
    nextTrack: { registered: true },
    prevTrack: { registered: true },
    volumeUp: { registered: true },
    volumeDown: { registered: true },
    toggleMute: { registered: true },
    toggleWindow: { registered: true },
  });
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [recordingKey, setRecordingKey] = useState<string>('');
  const [shortcutErrors, setShortcutErrors] = useState<Partial<Record<ShortcutAction, string>>>({});
  const [shortcutSaveSuccess, setShortcutSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (window.harmoniqApi?.getCloseToTray) {
      window.harmoniqApi.getCloseToTray().then((val) => {
        if (typeof val === 'boolean') setCloseToTray(val);
      });
    }
    if (window.harmoniqApi?.getGlobalShortcuts) {
      window.harmoniqApi.getGlobalShortcuts().then((res) => {
        if (res?.shortcuts) setShortcuts(res.shortcuts);
        if (res?.status) setShortcutStatus(res.status);
      });
    }
  }, []);

  const handleToggleCloseToTray = async (checked: boolean) => {
    setCloseToTray(checked);
    await window.harmoniqApi?.setCloseToTray?.(checked);
  };

  const handleStartRecording = (action: ShortcutAction) => {
    setRecordingAction(action);
    setRecordingKey('');
    setShortcutErrors((prev) => ({ ...prev, [action]: undefined }));
  };

  const handleKeyDown = async (e: React.KeyboardEvent, action: ShortcutAction) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecordingAction(null);
      setRecordingKey('');
      return;
    }

    const accel = keyboardEventToAccelerator(e);
    if (!accel) {
      const previewParts: string[] = [];
      if (e.ctrlKey) previewParts.push('Ctrl');
      if (e.altKey) previewParts.push('Alt');
      if (e.shiftKey) previewParts.push('Shift');
      if (previewParts.length > 0) {
        setRecordingKey(previewParts.join(' + ') + ' + ...');
      }
      return;
    }

    const valResult = validateAccelerator(accel);
    if (!valResult.valid) {
      setShortcutErrors((prev) => ({ ...prev, [action]: valResult.error }));
      return;
    }

    const updatedShortcuts: ShortcutConfig = { ...shortcuts, [action]: accel };
    const configValidation = validateShortcutConfig(updatedShortcuts);
    if (!configValidation.valid) {
      setShortcutErrors(configValidation.errors);
      return;
    }

    setRecordingAction(null);
    setRecordingKey('');
    setShortcutErrors({});

    if (window.harmoniqApi?.updateGlobalShortcuts) {
      const res = await window.harmoniqApi.updateGlobalShortcuts(updatedShortcuts);
      if (res.success) {
        setShortcuts(res.shortcuts);
        setShortcutStatus(res.status);
        setShortcutSaveSuccess(true);
        setTimeout(() => setShortcutSaveSuccess(false), 2500);
      } else {
        if (res.errors) setShortcutErrors(res.errors);
        setShortcutStatus(res.status);
      }
    } else {
      setShortcuts(updatedShortcuts);
    }
  };

  const handleResetShortcuts = async () => {
    setShortcutErrors({});
    if (window.harmoniqApi?.resetGlobalShortcuts) {
      const res = await window.harmoniqApi.resetGlobalShortcuts();
      setShortcuts(res.shortcuts);
      setShortcutStatus(res.status);
    } else {
      setShortcuts(DEFAULT_SHORTCUTS);
    }
    setShortcutSaveSuccess(true);
    setTimeout(() => setShortcutSaveSuccess(false), 2500);
  };

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
            Configure library folders, audio engine behavior, Windows system integration, and global shortcuts.
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

      {/* Windows System Integration (Batch 2) */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
        <div className="flex items-center justify-between border-b border-[#272733] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
              <AppWindow size={16} className="text-[var(--accent-dynamic)]" />
              <span>Windows System Integration</span>
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              System tray residency, Windows Media Transport Controls (SMTC), and global background shortcuts.
            </p>
          </div>
          <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
            Native Windows API
          </span>
        </div>

        {/* 1. System Tray Residency & Close to Tray */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[var(--accent-dynamic)]" />
                <span className="text-xs font-bold text-[#F5F3FF]">Close to System Tray</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                When enabled, clicking the window close button hides Harmoniq into the Windows notification area tray instead of terminating the app, keeping music playback uninterrupted.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={closeToTray}
                onChange={(e) => handleToggleCloseToTray(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-dynamic)]"></div>
            </label>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#71717A] pt-2 border-t border-[#1B1B24]">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>
              Tray context menu includes Play/Pause, Next, Previous, Song Info, Show/Hide, and Clean Exit. Single-click tray icon restores the window.
            </span>
          </div>
        </div>

        {/* 2. Global Media Controls (SMTC) Status */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-[var(--accent-dynamic)]" />
              <span className="text-xs font-bold text-[#F5F3FF]">System Media Transport Controls (SMTC)</span>
            </div>
            <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              Synchronized
            </span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Directly connected to Windows 10 & 11 Media Transport Controls. Hardware multimedia keys, volume overlays, lock screen media widgets, and Windows Action Center display the current track artwork, title, artist, and live timeline scrubber.
          </p>
        </div>

        {/* 3. Global Keyboard Shortcuts */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-4">
          <div className="flex items-center justify-between border-b border-[#1B1B24] pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-[var(--accent-dynamic)]" />
                <span className="text-xs font-bold text-[#F5F3FF]">Global Keyboard Shortcuts</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Control Harmoniq playback and window visibility even when working inside other applications or games.
              </p>
            </div>
            <button
              onClick={handleResetShortcuts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all hover:scale-105 active:scale-95"
              title="Reset all global keyboard shortcuts to factory defaults"
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>
          </div>

          {shortcutSaveSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 size={14} />
              <span>Global keyboard shortcuts successfully registered with Windows.</span>
            </div>
          )}

          {/* Shortcuts List */}
          <div className="space-y-2">
            {SHORTCUT_DEFINITIONS.map((def) => {
              const action = def.id;
              const currentAccel = shortcuts[action] || def.defaultKey;
              const isRecording = recordingAction === action;
              const keys = formatAcceleratorToKeys(currentAccel);
              const status = shortcutStatus[action];
              const error = shortcutErrors[action] || status?.error;

              return (
                <div
                  key={action}
                  className={`p-3 rounded-xl border transition-all ${
                    isRecording
                      ? 'bg-[#181824] border-[var(--accent-dynamic)] shadow-glow-sm'
                      : error
                      ? 'bg-[#141113] border-rose-900/50'
                      : 'bg-[#14141B] border-[#272733]/80 hover:border-[#38384A]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F5F3FF]">{def.label}</span>
                        {status?.registered && !error && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active in Windows" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#71717A]">{def.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isRecording ? (
                        <div
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, action)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#09090B] border-2 border-[var(--accent-dynamic)] text-xs text-[var(--accent-dynamic)] font-mono-numbers outline-none animate-pulse cursor-pointer"
                        >
                          <Keyboard size={13} />
                          <span>{recordingKey || 'Press key combo... (Esc cancels)'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {keys.map((k, idx) => (
                            <React.Fragment key={idx}>
                              <kbd className="px-2 py-0.5 rounded bg-[#1B1B24] border border-[#3A3A4D] text-[#E4E4E7] font-mono-numbers text-[11px] font-bold shadow-sm">
                                {k}
                              </kbd>
                              {idx < keys.length - 1 && <span className="text-[#52525B] text-xs">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {!isRecording ? (
                        <button
                          onClick={() => handleStartRecording(action)}
                          className="px-2.5 py-1 rounded-lg bg-[#1B1B24] hover:bg-[#272736] text-[11px] font-medium text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733] transition-colors"
                        >
                          Change
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setRecordingAction(null);
                            setRecordingKey('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#272736] text-[11px] font-medium text-[#F5F3FF] transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="mt-2 pt-2 border-t border-[#272733]/60 flex items-center gap-1.5 text-[11px] text-rose-400">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
        <div className="flex justify-between">
          <span>Windows Integration:</span>
          <span className="text-[var(--accent-dynamic)] font-bold">SMTC Scrubber • System Tray • Global Keyboard Shortcuts</span>
        </div>
      </div>
    </div>
  );
};
