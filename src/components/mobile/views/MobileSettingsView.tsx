import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { getPlatformDriver } from '../../../services/platform';
import {
  Settings,
  ShieldCheck,
  Database,
  RefreshCw,
  FolderPlus,
  Folder,
  Trash2,
  Smartphone,
  Info,
  Radio,
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  Sliders,
  Sparkles,
  ZapOff,
  LayoutList,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { MobileConfirmDialog } from '../common/MobileConfirmDialog';
import {
  mobileAppearanceService,
  MobileAppearanceSettings,
  MOBILE_ACCENT_PALETTES,
  MobileAccentColor,
  MobileThemeMode,
  MobileListDensity,
} from '../../../services/mobileAppearanceService';

export const MobileSettingsView: React.FC = () => {
  const { stats, folders, rescanLibrary, addMusicFolders, removeMusicFolder } = useLibrary();
  const platform = getPlatformDriver();
  const audio = platform.audio;
  const [folderToRemove, setFolderToRemove] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<MobileAppearanceSettings>(() =>
    mobileAppearanceService.getSettings()
  );
  const [stopOnTaskRemoved, setStopOnTaskRemovedState] = useState<boolean>(true);
  const [notificationStatus, setNotificationStatus] = useState<{ granted: boolean; shouldShowRationale?: boolean }>({
    granted: true,
  });

  useEffect(() => {
    return mobileAppearanceService.subscribe((next) => {
      setAppearance(next);
    });
  }, []);

  useEffect(() => {
    if (audio.getStopOnTaskRemoved) {
      audio.getStopOnTaskRemoved().then(setStopOnTaskRemovedState);
    }
    if (audio.checkNotificationPermission) {
      audio.checkNotificationPermission().then(setNotificationStatus);
    }
  }, [audio]);

  const handleToggleStopOnTaskRemoved = async () => {
    const next = !stopOnTaskRemoved;
    setStopOnTaskRemovedState(next);
    if (audio.setStopOnTaskRemoved) {
      await audio.setStopOnTaskRemoved(next);
    }
  };

  const handleRequestNotification = async () => {
    if (audio.requestNotificationPermission) {
      await audio.requestNotificationPermission();
      setTimeout(async () => {
        if (audio.checkNotificationPermission) {
          const res = await audio.checkNotificationPermission();
          setNotificationStatus(res);
        }
      }, 600);
    }
  };

  const handleOpenNotificationSettings = async () => {
    if (audio.openNotificationSettings) {
      await audio.openNotificationSettings();
    }
  };

  const getFolderName = (pathOrUri: string) => {
    try {
      const decoded = decodeURIComponent(pathOrUri);
      if (decoded.includes('/')) {
        const segments = decoded.split('/').filter(Boolean);
        return segments[segments.length - 1] || 'Music Folder';
      }
      if (decoded.includes('\\')) {
        const segments = decoded.split('\\').filter(Boolean);
        return segments[segments.length - 1] || 'Music Folder';
      }
      return decoded;
    } catch {
      return 'Music Folder';
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-zinc-500">Harmoniq Lite system configuration</p>
      </div>

      {/* Appearance & Themes Card */}
      <div className="rounded-xl bg-[#14141b] border border-[#272733] p-4 space-y-4">
        <div className="flex items-center space-x-2.5 text-violet-400">
          <Palette className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Appearance & Theme</h3>
        </div>

        {/* Theme Mode: Dark, Light, System */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">Theme Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'system', label: 'System', icon: Laptop },
            ].map(({ id, label, icon: Icon }) => {
              const active = appearance.themeMode === id;
              return (
                <button
                  key={id}
                  onClick={() => mobileAppearanceService.setThemeMode(id as MobileThemeMode)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
                    active
                      ? 'bg-violet-600/25 border-violet-500 text-white shadow-sm shadow-violet-900/30'
                      : 'bg-[#1b1b24] border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color: 5 colors */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">Accent Color</label>
            <span className="text-[11px] text-zinc-400 font-medium">
              {MOBILE_ACCENT_PALETTES[appearance.accentColor]?.name || 'Violet'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {(
              [
                { id: 'violet', label: 'Violet', color: '#8b5cf6' },
                { id: 'blue', label: 'Blue', color: '#3b82f6' },
                { id: 'purple', label: 'Purple', color: '#a855f7' },
                { id: 'emerald', label: 'Emerald', color: '#10b981' },
                { id: 'amber', label: 'Amber', color: '#f59e0b' },
              ] as const
            ).map(({ id, label, color }) => {
              const active = appearance.accentColor === id;
              return (
                <button
                  key={id}
                  onClick={() => mobileAppearanceService.setAccentColor(id)}
                  aria-label={`${label} accent`}
                  className={`relative flex-1 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    active
                      ? 'bg-white/10 border-white/40 shadow-md'
                      : 'bg-[#1b1b24] border-white/5 hover:border-white/20'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {active && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List Density: Comfortable vs Compact */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-medium text-zinc-300">List Density</label>
              <p className="text-[11px] text-zinc-500">Track row spacing in library and playlists</p>
            </div>
            <div className="flex items-center bg-[#1b1b24] rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => mobileAppearanceService.setDensity('comfortable')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  appearance.density === 'comfortable'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Comfortable
              </button>
              <button
                onClick={() => mobileAppearanceService.setDensity('compact')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  appearance.density === 'compact'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Compact
              </button>
            </div>
          </div>
        </div>

        {/* Reduce Animations Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="pr-4">
            <label className="text-xs font-medium text-zinc-300">Reduce Animations</label>
            <p className="text-[11px] text-zinc-500">
              Minimizes transitions for maximum responsiveness and battery conservation
            </p>
          </div>
          <button
            role="switch"
            aria-checked={appearance.reduceAnimations}
            onClick={() =>
              mobileAppearanceService.setReduceAnimations(!appearance.reduceAnimations)
            }
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
              appearance.reduceAnimations ? 'bg-violet-600' : 'bg-[#272733]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                appearance.reduceAnimations ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Playback & Background Service Card */}
      <div className="rounded-xl bg-[#14141b] border border-[#272733] p-4 space-y-4">
        <div className="flex items-center space-x-2.5 text-violet-400">
          <Radio className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Playback & Background Service</h3>
        </div>

        {/* Stop on Recents Dismissal */}
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <label className="text-xs font-medium text-zinc-300">
              Stop playback when app is removed from Recents
            </label>
            <p className="text-[11px] text-zinc-500">
              {stopOnTaskRemoved
                ? 'Swiping app away terminates playback service and frees audio resources (recommended).'
                : 'Playback continues in background even after closing the app from Recent Apps.'}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={stopOnTaskRemoved}
            onClick={handleToggleStopOnTaskRemoved}
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
              stopOnTaskRemoved ? 'bg-violet-600' : 'bg-[#272733]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                stopOnTaskRemoved ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Media Notification Permission */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-medium text-zinc-300">Media Notification Controls</label>
              <p className="text-[11px] text-zinc-500">
                Lock-screen and notification shade playback controls
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                notificationStatus.granted
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/40'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-700/40'
              }`}
            >
              {notificationStatus.granted ? 'Active' : 'Permission Required'}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {!notificationStatus.granted && (
              <button
                onClick={handleRequestNotification}
                className="flex-1 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm shadow-violet-900/30"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Enable Notification Controls</span>
              </button>
            )}
            <button
              onClick={handleOpenNotificationSettings}
              className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
                notificationStatus.granted
                  ? 'w-full bg-[#1b1b24] border-white/10 text-zinc-300 hover:text-white hover:border-white/20'
                  : 'bg-[#1b1b24] border-white/10 text-zinc-300 hover:text-white'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Android Notification Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Platform & Runtime Card */}
      <div className="rounded-xl bg-[#14141b] border border-[#272733] p-4 space-y-3">
        <div className="flex items-center space-x-2.5 text-violet-400">
          <Smartphone className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Platform Runtime</h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">Active Platform</span>
            <span className="font-mono text-white capitalize">{platform.platform}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">Native Audio Service</span>
            <span className={`font-mono ${platform.capabilities.hasNativeAudioService ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {platform.capabilities.hasNativeAudioService ? 'Media3 ExoPlayer Ready' : 'Web Audio'}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">Media Notification Controls</span>
            <span className={`font-mono ${platform.capabilities.hasSystemMediaTransport ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {platform.capabilities.hasSystemMediaTransport ? 'Active (Lockscreen & Shade)' : 'Desktop SMTC'}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">MediaStore Provider</span>
            <span className={`font-mono ${platform.capabilities.hasMediaStore ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {platform.capabilities.hasMediaStore ? 'MediaStore + SAF Active' : 'Disabled (Desktop/Web)'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Application Version</span>
            <span className="font-mono text-violet-300">Harmoniq Lite 1.0.0 (Phase 4.2)</span>
          </div>
        </div>
      </div>

      {/* Configured Music Folders (Task 2) */}
      <div className="rounded-xl bg-[#14141b] border border-[#272733] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-violet-400">
            <Folder className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Music Folders</h3>
          </div>
          <button
            onClick={() => addMusicFolders()}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add Folder</span>
          </button>
        </div>

        <p className="text-[11px] text-zinc-400">
          Directories configured for music indexing. Removing a folder detaches it from the library without altering device files.
        </p>

        <div className="space-y-2 pt-1">
          {folders.length === 0 ? (
            <div className="p-3 rounded-lg bg-[#1b1b24]/40 border border-white/5 text-center text-xs text-zinc-500">
              No custom storage folders added. (Device MediaStore is active)
            </div>
          ) : (
            folders.map((folderPath) => (
              <div
                key={folderPath}
                className="p-2.5 rounded-lg bg-[#1b1b24] border border-white/5 flex items-center justify-between space-x-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{getFolderName(folderPath)}</p>
                  <p className="text-[10px] font-mono text-zinc-500 truncate">{folderPath}</p>
                </div>
                <button
                  onClick={() => setFolderToRemove(folderPath)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove folder"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <MobileConfirmDialog
        isOpen={Boolean(folderToRemove)}
        title="Remove Folder"
        message={`Remove "${getFolderName(folderToRemove || '')}" from your Harmoniq Lite library? Audio files on device will not be deleted.`}
        confirmLabel="Remove"
        isDestructive
        onConfirm={() => {
          if (folderToRemove) removeMusicFolder(folderToRemove);
          setFolderToRemove(null);
        }}
        onCancel={() => setFolderToRemove(null)}
      />

      {/* Local Storage & Cache Card */}
      <div className="rounded-xl bg-[#14141b] border border-[#272733] p-4 space-y-3">
        <div className="flex items-center space-x-2.5 text-violet-400">
          <Database className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Local Storage & Cache</h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">Indexed Audio Tracks</span>
            <span className="font-mono text-white">{stats.totalTracks}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-zinc-400">Indexed Albums</span>
            <span className="font-mono text-white">{stats.totalAlbums}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Total Duration</span>
            <span className="font-mono text-white">
              {Math.round((stats.totalDuration || 0) / 3600)} hrs
            </span>
          </div>
        </div>

        <button
          onClick={() => rescanLibrary()}
          className="w-full mt-2 py-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium flex items-center justify-center space-x-2 active:scale-98 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rescan MediaStore & Folders</span>
        </button>
      </div>

      {/* Phase 2 Architecture Notice */}
      <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-800/30 text-xs text-violet-300/80 space-y-1">
        <div className="flex items-center space-x-2 text-violet-400 font-medium">
          <Info className="w-4 h-4" />
          <span>Harmoniq Lite Phase 2 Engine</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Native Android MediaStore and Storage Access Framework (SAF) folder picker are fully integrated. Playback is driven by AndroidX Media3 ExoPlayer and HarmoniqMediaService with background audio focus and lockscreen transport controls.
        </p>
      </div>
    </div>
  );
};
