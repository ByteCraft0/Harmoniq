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
import { AudioDeviceManager } from '../audio/AudioDeviceManager';
import { AudioRoutingProfilesCard } from '../audio/AudioRoutingProfilesCard';
import { VolumeProfilesCard } from '../audio/VolumeProfilesCard';
import { AudioQualityAnalyzer } from '../audio/AudioQualityAnalyzer';
import { BitPerfectController } from '../audio/BitPerfectController';
import { ChannelConfigurationCard } from '../audio/ChannelConfigurationCard';
import { ABRepeatControls } from '../audio/ABRepeatControls';
import { HotkeyProfilesCard } from '../desktop/HotkeyProfilesCard';
import { BackupRestoreCard } from '../desktop/BackupRestoreCard';
import { PortableModeCard } from '../desktop/PortableModeCard';
import { PersonalizationPrivacyCard } from '../desktop/PersonalizationPrivacyCard';
import { AssistantSettingsCard } from '../assistant/AssistantSettingsCard';
import { visualizerSettingsService } from '../../services/visualizerSettingsService';
import { appearanceService } from '../../services/appearanceService';
import {
  AppearanceSettings,
  AnimationIntensity,
  THEME_PALETTES,
  ThemePresetId,
} from '../../types/appearance';
import { sessionRecoveryService } from '../../services/sessionRecoveryService';
import { SessionSettings } from '../../types/session';
import { useToast } from '../../context/ToastContext';
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
  Speaker,
  FileAudio,
  Repeat1,
  Wand2,
  Palette,
  Zap,
  Globe,
} from 'lucide-react';
import { universalMusicService } from '../../services/universalMusicService';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
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
  const [animSettings, setAnimSettings] = useState(visualizerSettingsService.getAnimationSettings());
  const [appearance, setAppearance] = useState(appearanceService.getSettings());
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>(() =>
    sessionRecoveryService.getSettings()
  );

  const handleToggleRestoreSession = (checked: boolean) => {
    sessionRecoveryService.updateSettings({ restoreSessionOnLaunch: checked });
    setSessionSettings(sessionRecoveryService.getSettings());
    showToast(
      checked ? 'Session recovery on launch enabled' : 'Session recovery disabled',
      'info'
    );
  };

  const handleToggleAutoResume = (checked: boolean) => {
    sessionRecoveryService.updateSettings({ autoResumePlaybackOnLaunch: checked });
    setSessionSettings(sessionRecoveryService.getSettings());
    showToast(
      checked ? 'Auto-resume playback on launch enabled' : 'Auto-resume disabled',
      'info'
    );
  };

  const handleClearSession = () => {
    sessionRecoveryService.clearSession();
    showToast('Saved playback session cleared', 'info');
  };

  const [jamendoKey, setJamendoKey] = useState<string>(() => {
    const k = universalMusicService.getJamendoClientId();
    return k === 'b6747d04' ? '' : k;
  });

  const [spotifyClientId, setSpotifyClientId] = useState<string>(() => {
    return universalMusicService.getSpotifyCredentials().clientId || '';
  });
  const [spotifyClientSecret, setSpotifyClientSecret] = useState<string>('');
  const [hasSpotifySecret, setHasSpotifySecret] = useState<boolean>(() => {
    return universalMusicService.getSpotifyCredentials().hasSecret;
  });

  const [youtubeApiKey, setYoutubeApiKey] = useState<string>(() => {
    return universalMusicService.getYouTubeApiKey() || '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.harmoniqApi?.getProviderConfigs) {
      window.harmoniqApi
        .getProviderConfigs()
        .then((cfg) => {
          if (cfg) {
            if (cfg.spotify) {
              if (cfg.spotify.clientId) setSpotifyClientId(cfg.spotify.clientId);
              setHasSpotifySecret(Boolean(cfg.spotify.hasSecret));
            }
            if (cfg.youtube?.apiKey) {
              setYoutubeApiKey(cfg.youtube.apiKey);
            }
            if (cfg.jamendoClientId) {
              setJamendoKey(cfg.jamendoClientId === 'b6747d04' ? '' : cfg.jamendoClientId);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSaveJamendoKey = () => {
    universalMusicService.setJamendoClientId(jamendoKey.trim());
    showToast(
      jamendoKey.trim()
        ? 'Jamendo Client ID saved. High-volume searches enabled.'
        : 'Jamendo Client ID reset to default open catalog mode.',
      'success'
    );
  };

  const handleSaveSpotifyCredentials = () => {
    universalMusicService.setSpotifyCredentials(spotifyClientId.trim(), spotifyClientSecret.trim());
    setHasSpotifySecret(Boolean(spotifyClientSecret.trim() || (spotifyClientId.trim() && hasSpotifySecret)));
    setSpotifyClientSecret('');
    showToast(
      spotifyClientId.trim()
        ? 'Spotify API credentials saved. Commercial catalog discovery active.'
        : 'Spotify credentials reset/cleared.',
      'success'
    );
  };

  const handleSaveYouTubeKey = () => {
    universalMusicService.setYouTubeApiKey(youtubeApiKey.trim());
    showToast(
      youtubeApiKey.trim()
        ? 'YouTube Data API key saved. Video music discovery active.'
        : 'YouTube Data API key cleared.',
      'success'
    );
  };

  useEffect(() => {
    return visualizerSettingsService.subscribe(() => {
      setAnimSettings(visualizerSettingsService.getAnimationSettings());
    });
  }, []);

  useEffect(() => {
    return appearanceService.subscribe(setAppearance);
  }, []);

  type SettingsTab =
    | 'all'
    | 'assistant'
    | 'appearance'
    | 'devices'
    | 'quality'
    | 'bitperfect'
    | 'playback'
    | 'channel'
    | 'system'
    | 'library';
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Settings', icon: <Sparkles size={13} /> },
    { id: 'assistant', label: 'Harmoniq Assistant', icon: <Sparkles size={13} /> },
    { id: 'appearance', label: 'Appearance & Animations', icon: <Wand2 size={13} /> },
    { id: 'devices', label: 'Output Devices', icon: <Speaker size={13} /> },
    { id: 'quality', label: 'Audio Quality', icon: <FileAudio size={13} /> },
    { id: 'bitperfect', label: 'Bit-Perfect', icon: <ShieldCheck size={13} /> },
    { id: 'playback', label: 'Playback & Looper', icon: <Sliders size={13} /> },
    { id: 'channel', label: 'Channel & Balance', icon: <Radio size={13} /> },
    { id: 'system', label: 'Windows Integration', icon: <AppWindow size={13} /> },
    { id: 'library', label: 'Music Folders', icon: <FolderPlus size={13} /> },
  ];

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

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm'
                : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Harmoniq Assistant Configuration (Phase 7) */}
      {(activeTab === 'all' || activeTab === 'assistant') && (
        <AssistantSettingsCard />
      )}

      {/* Appearance & Animations Section (Part 8) */}
      {(activeTab === 'all' || activeTab === 'appearance') && (
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card card-interactive">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                <Wand2 size={16} className="text-[#A78BFA]" />
                <span>Appearance & Interactive Animations</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Customize visual fluidity, interactive card transitions, ambient lighting, and accessibility motion settings.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[#A78BFA] border border-[#272733]">
              GPU Accelerated
            </span>
          </div>

          {/* Harmoniq 2.0 Personalization: Theme & Accent Palettes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] font-mono-numbers flex items-center gap-2">
                <Palette size={14} className="text-[var(--accent-primary)]" />
                Color Theme & Luminescence Palettes
              </span>
              <button
                type="button"
                onClick={() => {
                  appearanceService.setThemePreset('obsidian_violet');
                  showToast('Theme reset to signature Obsidian Violet', 'info');
                }}
                className="text-xs text-[var(--accent-primary)] hover:underline font-medium"
              >
                Reset Default Theme
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(Object.keys(THEME_PALETTES) as ThemePresetId[]).map((paletteId) => {
                const pal = THEME_PALETTES[paletteId];
                const isSelected = appearance.themePreset === paletteId;
                return (
                  <button
                    key={paletteId}
                    type="button"
                    onClick={() => {
                      appearanceService.setThemePreset(paletteId);
                      showToast(`Applied ${pal.name} theme`, 'success');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      isSelected
                        ? 'bg-[var(--ambient-primary)] border-[var(--accent-primary)] shadow-[var(--glow-dynamic)]'
                        : 'bg-[#0D0D12] hover:bg-[#181822] border-[#272733] hover:border-[#3b3b4e]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full shadow-sm border border-white/20"
                          style={{ backgroundColor: pal.primary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow-sm border border-white/10"
                          style={{ backgroundColor: pal.secondary }}
                        />
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-mono font-bold text-[var(--accent-primary)] px-1.5 py-0.5 rounded-md bg-white/10">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white truncate">{pal.name}</div>
                    <div className="text-[10px] text-[#71717A] truncate mt-0.5">{pal.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Pickers if Custom Preset Selected */}
            {appearance.themePreset === 'custom' && (
              <div className="p-4 rounded-xl bg-[#0D0D12] border border-[var(--accent-primary)]/40 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-[#A1A1AA] font-medium">Primary Accent:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={appearance.customAccentColor || '#A78BFA'}
                      onChange={(e) => appearanceService.setCustomColors(e.target.value, appearance.customSecondaryColor || '#7C3AED')}
                      className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={appearance.customAccentColor || '#A78BFA'}
                      onChange={(e) => appearanceService.setCustomColors(e.target.value, appearance.customSecondaryColor || '#7C3AED')}
                      className="w-24 px-2 py-1 rounded bg-[#1B1B24] border border-[#272733] text-xs font-mono text-white focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-[#A1A1AA] font-medium">Secondary Accent:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={appearance.customSecondaryColor || '#7C3AED'}
                      onChange={(e) => appearanceService.setCustomColors(appearance.customAccentColor || '#A78BFA', e.target.value)}
                      className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={appearance.customSecondaryColor || '#7C3AED'}
                      onChange={(e) => appearanceService.setCustomColors(appearance.customAccentColor || '#A78BFA', e.target.value)}
                      className="w-24 px-2 py-1 rounded bg-[#1B1B24] border border-[#272733] text-xs font-mono text-white focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* High Contrast Mode Switch */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-white" />
                  <span className="text-xs font-bold text-[#F5F3FF]">High Contrast Accessibility Mode</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Maximizes text legibility, applies deep black backgrounds, and sharpens visual boundaries for enhanced accessibility.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.highContrastMode}
                  onChange={(e) => {
                    appearanceService.setHighContrast(e.target.checked);
                    showToast(e.target.checked ? 'High contrast mode enabled' : 'High contrast mode disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Master Animations Toggle */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#A78BFA]" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Enable UI Animations</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Fluid page transitions, smooth modal drawers, and responsive micro-interactions.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.animationsEnabled}
                  onChange={(e) => {
                    appearanceService.updateSettings({ animationsEnabled: e.target.checked });
                    showToast(e.target.checked ? 'Animations enabled' : 'Animations disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>

            {/* 2. Reduced Motion (Accessibility) */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-sky-400" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Reduced Motion</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Disables rapid zooms and translates, preserving accessibility for vestibular sensitivities.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.reducedMotion}
                  onChange={(e) => {
                    appearanceService.updateSettings({ reducedMotion: e.target.checked });
                    showToast(e.target.checked ? 'Reduced motion enabled' : 'Reduced motion disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>

            {/* 3. Interactive Hover Effects */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Interactive Card Hover Effects</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Subtle card elevation, artwork zoom, and floating quick-play button on hover.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.hoverEffects}
                  onChange={(e) => {
                    appearanceService.updateSettings({ hoverEffects: e.target.checked });
                    showToast(e.target.checked ? 'Hover effects enabled' : 'Hover effects disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>

            {/* 4. Ambient Artwork Lighting */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-pink-400" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Dynamic Ambient Lighting</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Generates smooth color-derived backdrop glows and radial lighting based on the active album artwork.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.ambientLighting}
                  onChange={(e) => {
                    appearanceService.updateSettings({ ambientLighting: e.target.checked });
                    showToast(e.target.checked ? 'Ambient lighting enabled' : 'Ambient lighting disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>

            {/* 5. Album Artwork Animations (Breathing & Vinyl) */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-amber-400" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Album Artwork Animations</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Enables gentle artwork breathing float and 33⅓ RPM rotating vinyl disk animations in Now Playing.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={appearance.albumArtworkAnimations}
                  onChange={(e) => {
                    appearanceService.updateSettings({ albumArtworkAnimations: e.target.checked });
                    showToast(e.target.checked ? 'Artwork animations enabled' : 'Artwork animations disabled', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7C3AED]" />
              </label>
            </div>

            {/* 6. Animation Intensity Selector (Subtle / Normal / Enhanced) */}
            <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-violet-400" />
                  <span className="text-xs font-bold text-[#F5F3FF]">Animation Intensity</span>
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Adjust the speed, springiness, and scale of transitions and micro-interactions.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['subtle', 'normal', 'enhanced'] as AnimationIntensity[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      appearanceService.updateSettings({ animationIntensity: level });
                      showToast(`Animation intensity set to ${level}`, 'info');
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                      appearance.animationIntensity === level
                        ? 'bg-violet-600 text-white shadow-sm border border-violet-400/40'
                        : 'bg-[#181822] text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#20202E] border border-[#272733]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Audio Output Routing Profiles & Devices */}
      {(activeTab === 'all' || activeTab === 'devices') && (
        <div className="space-y-6">
          <AudioRoutingProfilesCard />
          <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-[#272733] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                  <Speaker size={16} className="text-[var(--accent-dynamic)]" />
                  <span>Audio Device Manager</span>
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Switch active sound endpoints, headphones, and external USB/WASAPI DACs with live fallback.
                </p>
              </div>
              <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
                Hardware Routing
              </span>
            </div>
            <AudioDeviceManager />
          </div>
        </div>
      )}

      {/* 2. Audio Quality Analyzer */}
      {(activeTab === 'all' || activeTab === 'quality') && (
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                <FileAudio size={16} className="text-[var(--accent-dynamic)]" />
                <span>Audio Quality Analyzer</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Real-time technical metrics, format verification, and sample rate conversion diagnosis.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[#A78BFA] border border-[#272733]">
              Stream Telemetry
            </span>
          </div>
          <AudioQualityAnalyzer />
        </div>
      )}

      {/* 3. Bit-Perfect Playback */}
      {(activeTab === 'all' || activeTab === 'bitperfect') && (
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--accent-dynamic)]" />
                <span>Bit-Perfect Direct Playback</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Direct hardware pass-through bypassing DSP, volume attenuation, and digital sound processing.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-emerald-400 border border-[#272733]">
              Bit-Transparent
            </span>
          </div>
          <BitPerfectController />
        </div>
      )}

      {/* 4. Channel Configuration */}
      {(activeTab === 'all' || activeTab === 'channel') && (
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                <Radio size={16} className="text-[var(--accent-dynamic)]" />
                <span>Channel Routing & Stereo Balance</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Configure stereo downmixing, isolated channel listening, and left/right balance.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono-numbers px-2.5 py-0.5 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
              Matrix Processing
            </span>
          </div>
          <ChannelConfigurationCard />
        </div>
      )}

      {/* 5. Music Folders Section */}
      {(activeTab === 'all' || activeTab === 'library') && (
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
      )}

      {/* 6. Core Playback Enhancements & A-B Looper */}
      {(activeTab === 'all' || activeTab === 'playback') && (
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

        {/* 4. A-B Precision Repeat Looper */}
        <div className="pt-2 border-t border-[#1B1B24]">
          <ABRepeatControls compact={false} />
        </div>

        {/* 5. Customizable Playback Animations & Reduced Motion */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#F5F3FF]">Reactive Playback Animations</span>
              <p className="text-[11px] text-[#A1A1AA]">
                Smooth ambient glow, track change transitions, and reactive UI effects.
              </p>
            </div>
            <input
              type="checkbox"
              checked={animSettings.animationsEnabled}
              onChange={(e) =>
                visualizerSettingsService.updateAnimationSettings({ animationsEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1B1B24]">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#F5F3FF]">Reduced Motion Mode</span>
              <p className="text-[11px] text-[#A1A1AA]">
                Limits rapid motion, disables flashing, and simplifies transforms for accessibility.
              </p>
            </div>
            <input
              type="checkbox"
              checked={animSettings.reducedMotion}
              onChange={(e) =>
                visualizerSettingsService.updateAnimationSettings({ reducedMotion: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1B1B24]">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#F5F3FF]">Subtle Album Art Crossfade</span>
              <p className="text-[11px] text-[#A1A1AA]">
                Smoothly blends between album artwork when switching songs.
              </p>
            </div>
            <input
              type="checkbox"
              checked={animSettings.albumArtTransitions}
              onChange={(e) =>
                visualizerSettingsService.updateAnimationSettings({ albumArtTransitions: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent-dynamic)] rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#A1A1AA]">Animation Intensity</span>
              <span className="font-mono text-[#A78BFA]">{animSettings.animationIntensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={animSettings.animationIntensity}
              onChange={(e) =>
                visualizerSettingsService.updateAnimationSettings({ animationIntensity: parseFloat(e.target.value) })
              }
              className="w-full accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 6. Playback Session & Queue Recovery */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-[var(--accent-dynamic)]" />
                <span className="text-xs font-bold text-[#F5F3FF]">Restore Playback Session on Launch</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">
                Automatically restores your current queue, last playing track, position, and repeat/shuffle modes upon reopening Harmoniq.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={sessionSettings.restoreSessionOnLaunch}
                onChange={(e) => handleToggleRestoreSession(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-dynamic)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1B1B24]">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#F5F3FF]">Auto-Resume Playback on Launch</span>
              <p className="text-[11px] text-[#A1A1AA]">
                Immediately starts audio playback upon application startup (requires Restore Session to be enabled).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                disabled={!sessionSettings.restoreSessionOnLaunch}
                checked={sessionSettings.autoResumePlaybackOnLaunch}
                onChange={(e) => handleToggleAutoResume(e.target.checked)}
                className="sr-only peer disabled:opacity-40"
              />
              <div className="w-10 h-5 bg-[#272733] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-dynamic)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1B1B24]">
            <span className="text-[11px] text-[#71717A]">
              Active Session Cache: {sessionRecoveryService.getSavedSession() ? 'Saved & Ready' : 'Empty'}
            </span>
            <button
              onClick={handleClearSession}
              className="px-3 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg border border-red-500/20 transition-colors"
            >
              Clear Saved Session
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Advanced Volume Profiles & Loudness Normalization */}
      {(activeTab === 'all' || activeTab === 'playback') && (
        <VolumeProfilesCard />
      )}

      {/* Universal Music Multi-Provider Configuration Hub */}
      {(activeTab === 'all' || activeTab === 'playback') && (
        <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
          <div className="flex items-center justify-between border-b border-[#272733] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                <Globe size={16} className="text-violet-400" />
                <span>Universal Music Engine — Multi-Provider Hub</span>
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Configure official developer API keys, audit provider capabilities, and expand commercial catalog discovery.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/40">
              Phase 3 Expanded
            </span>
          </div>

          {/* Provider Capability & Compliance Status Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#F5F3FF]">Provider Capability & Compliance Matrix</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#272733] text-[#71717A] text-[11px]">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Catalog / Coverage</th>
                    <th className="pb-2 font-medium">Playback Mode</th>
                    <th className="pb-2 font-medium">Authentication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272733]/50 text-[#A1A1AA]">
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">Apple Music</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">Active</span>
                    </td>
                    <td className="py-2.5">Bollywood, Hindi, Punjabi & Global</td>
                    <td className="py-2.5 font-mono text-violet-300">30s Previews</td>
                    <td className="py-2.5 text-[#71717A]">Unauthenticated Open API</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">Audius Network</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">Active</span>
                    </td>
                    <td className="py-2.5">Independent & Decentralized Creators</td>
                    <td className="py-2.5 font-mono text-emerald-300">Full 320k Stream</td>
                    <td className="py-2.5 text-[#71717A]">Unauthenticated Open API</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">Internet Archive</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">Active</span>
                    </td>
                    <td className="py-2.5">Historical, Vintage & Live Concerts</td>
                    <td className="py-2.5 font-mono text-emerald-300">Full Audio Stream</td>
                    <td className="py-2.5 text-[#71717A]">Unauthenticated Open API</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">Jamendo Music</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">Active</span>
                    </td>
                    <td className="py-2.5">Creative Commons Independent Tracks</td>
                    <td className="py-2.5 font-mono text-emerald-300">Full Audio Stream</td>
                    <td className="py-2.5 text-[#71717A]">Client ID (Optional Key)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">Spotify</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${
                        spotifyClientId ? 'bg-[#0f2e1b] text-[#1ed760] border-[#1ed760]/30' : 'bg-[#272733] text-[#71717A] border-[#3F3F46]'
                      }`}>
                        {spotifyClientId ? 'Connected' : 'Optional'}
                      </span>
                    </td>
                    <td className="py-2.5">Mainstream Commercial Catalog</td>
                    <td className="py-2.5 font-mono text-sky-300">Metadata + Links</td>
                    <td className="py-2.5 text-[#71717A]">Client Credentials Flow</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#F5F3FF]">YouTube Platform</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${
                        youtubeApiKey ? 'bg-[#3b1212] text-[#ff4e4e] border-[#ff4e4e]/30' : 'bg-[#272733] text-[#71717A] border-[#3F3F46]'
                      }`}>
                        {youtubeApiKey ? 'Connected' : 'Optional'}
                      </span>
                    </td>
                    <td className="py-2.5">Official Music Videos & Labels</td>
                    <td className="py-2.5 font-mono text-amber-300">Authorized Video Link</td>
                    <td className="py-2.5 text-[#71717A]">YouTube Data API v3 Key</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-[#71717A]">JioSaavn / Gaana / Wynk</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-500 border border-zinc-800">
                        Not Available
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-500">Regional Indian Music Platforms</td>
                    <td className="py-2.5 font-mono text-zinc-500">N/A</td>
                    <td className="py-2.5 text-zinc-500">No official public API. Scraping prohibited.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Spotify Web API Configuration */}
          <div className="p-4 rounded-xl bg-[#1B1B24]/80 border border-[#272733] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1ed760]" />
                <h4 className="text-xs font-semibold text-[#F5F3FF]">Spotify Web API Integration</h4>
              </div>
              <span className="text-[10px] text-[#A1A1AA]">
                Client Credentials Flow (developer.spotify.com)
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Provides commercial track discovery, high-resolution artwork, popularity scores, and official track links. Does not require user passwords and strictly adheres to Spotify Developer Policy.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#A1A1AA] block mb-1">
                  Spotify Client ID
                </label>
                <input
                  type="text"
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                  placeholder="Paste Spotify Client ID..."
                  className="w-full bg-[#101014] border border-[#272733] focus:border-[#1ed760] text-xs text-[#F5F3FF] rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#A1A1AA] block mb-1">
                  Spotify Client Secret {hasSpotifySecret && <span className="text-[#1ed760] font-normal">(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={spotifyClientSecret}
                  onChange={(e) => setSpotifyClientSecret(e.target.value)}
                  placeholder={hasSpotifySecret ? "•••••••••••••••• (Leave blank to keep)" : "Paste Spotify Client Secret..."}
                  className="w-full bg-[#101014] border border-[#272733] focus:border-[#1ed760] text-xs text-[#F5F3FF] rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSaveSpotifyCredentials}
                className="px-4 py-1.5 bg-[#1ed760] hover:bg-[#1db954] text-black font-semibold text-xs rounded-xl transition"
              >
                Save Spotify Credentials
              </button>
              {(spotifyClientId || hasSpotifySecret) && (
                <button
                  onClick={() => {
                    setSpotifyClientId('');
                    setSpotifyClientSecret('');
                    setHasSpotifySecret(false);
                    universalMusicService.setSpotifyCredentials('', '');
                    showToast('Spotify credentials cleared', 'info');
                  }}
                  className="px-3 py-1.5 bg-[#14141B] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs rounded-xl transition border border-[#272733]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* YouTube Data API v3 Configuration */}
          <div className="p-4 rounded-xl bg-[#1B1B24]/80 border border-[#272733] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff4e4e]" />
                <h4 className="text-xs font-semibold text-[#F5F3FF]">YouTube Data API v3 Integration</h4>
              </div>
              <span className="text-[10px] text-[#A1A1AA]">
                Google Cloud Console API Key
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Provides music video discovery across global labels and Indian music channels (T-Series, Zee Music, etc.) with authorized destination links. Per YouTube Terms of Service Section II.10, audio stream extraction is strictly prohibited.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#A1A1AA] block mb-1">
                YouTube Data API v3 Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={youtubeApiKey}
                  onChange={(e) => setYoutubeApiKey(e.target.value)}
                  placeholder="Paste YouTube Data API key (e.g. AIzaSy...)..."
                  className="flex-1 bg-[#101014] border border-[#272733] focus:border-[#ff4e4e] text-xs text-[#F5F3FF] rounded-xl px-3.5 py-2 outline-none transition font-mono"
                />
                <button
                  onClick={handleSaveYouTubeKey}
                  className="px-4 py-1.5 bg-[#ff4e4e] hover:bg-[#e03a3a] text-white font-semibold text-xs rounded-xl transition shrink-0"
                >
                  Save API Key
                </button>
                {youtubeApiKey && (
                  <button
                    onClick={() => {
                      setYoutubeApiKey('');
                      universalMusicService.setYouTubeApiKey('');
                      showToast('YouTube API key cleared', 'info');
                    }}
                    className="px-3 py-1.5 bg-[#14141B] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs rounded-xl transition shrink-0 border border-[#272733]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Jamendo Creative Commons API Configuration */}
          <div className="p-4 rounded-xl bg-[#1B1B24]/80 border border-[#272733] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h4 className="text-xs font-semibold text-[#F5F3FF]">Jamendo Developer Client ID (Optional)</h4>
              </div>
              <span className="text-[10px] text-[#A1A1AA]">
                developer.jamendo.com
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Jamendo&apos;s public demo credentials enforce strict rate-limits. Providing your own free developer Client ID ensures uninterrupted full-track streaming across independent artists.
            </p>
            <div className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={jamendoKey}
                  onChange={(e) => setJamendoKey(e.target.value)}
                  placeholder="Paste Jamendo developer Client ID (e.g. 5a89b...)..."
                  className="flex-1 bg-[#101014] border border-[#272733] focus:border-emerald-400 text-xs text-[#F5F3FF] rounded-xl px-3.5 py-2 outline-none transition font-mono"
                />
                <button
                  onClick={handleSaveJamendoKey}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition shrink-0"
                >
                  Save Client ID
                </button>
                {jamendoKey && (
                  <button
                    onClick={() => {
                      setJamendoKey('');
                      universalMusicService.setJamendoClientId('');
                      showToast('Jamendo Client ID cleared', 'info');
                    }}
                    className="px-3 py-1.5 bg-[#14141B] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs rounded-xl transition shrink-0 border border-[#272733]"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotkey Profiles & Shortcuts (Phase 4) */}
      {(activeTab === 'all' || activeTab === 'system') && (
        <HotkeyProfilesCard />
      )}

      {/* Windows System Integration (Batch 2) */}
      {(activeTab === 'all' || activeTab === 'system') && (
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
      )}

      {/* Library Backup & Restore (Phase 4) */}
      {(activeTab === 'all' || activeTab === 'system') && (
        <BackupRestoreCard />
      )}

      {/* Portable Mode (Phase 4) */}
      {(activeTab === 'all' || activeTab === 'system') && (
        <PortableModeCard />
      )}

      {/* Listening Intelligence & Privacy Controls (Phase 4) */}
      {(activeTab === 'all' || activeTab === 'system' || activeTab === 'library') && (
        <PersonalizationPrivacyCard />
      )}

      {/* Privacy Guarantee */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3 shadow-card">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-emerald-400" />
          <h3 className="font-bold text-sm text-[#F5F3FF]">Local-First & Privacy Guarantee</h3>
        </div>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Harmoniq is local-first. Your personal audio files, listening history, custom DSP profiles, and playlists are stored exclusively on your local machine with zero tracking or telemetry. When you explicitly use online features (such as Jamendo music, Internet Radio, podcast feeds, or optional AI companion), Harmoniq connects directly to those providers without transmitting your private listening data.
        </p>
      </div>

      {/* Welcome Walkthrough & Onboarding (Phase 6.3) */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#F5F3FF] flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--accent-dynamic)]" />
              Harmoniq Welcome Walkthrough
            </h3>
            <p className="text-xs text-[#71717A]">
              Revisit the first-run orientation tour to review library indexing, DSP capabilities, and AI discovery tools.
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('harmoniq:openOnboarding'))}
            className="px-4 py-2 rounded-xl bg-[var(--accent-dynamic)] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Sparkles size={14} />
            <span>Launch Tour</span>
          </button>
        </div>
      </div>

      {/* Version & Technical Architecture Specs */}
      <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] text-[11px] font-mono-numbers text-[#71717A] space-y-1">
        <div className="flex justify-between">
          <span>Application:</span>
          <span className="text-[#A1A1AA]">Harmoniq Reference Audio v2.0.0</span>
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
