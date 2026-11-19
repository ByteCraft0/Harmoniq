import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  HardDrive,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  FolderOpen,
  Info,
  RotateCcw,
} from 'lucide-react';
import { PortableStatus, MigrationResult } from '../../types/portable';
import { portableService } from '../../services/portableService';

export const PortableModeCard: React.FC = () => {
  const [status, setStatus] = useState<PortableStatus | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [permissionCheck, setPermissionCheck] = useState<{ writable: boolean; error?: string } | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const refresh = async () => {
    const s = await portableService.getPortableStatus();
    setStatus(s);
    if (s.isPortable) {
      setCustomPath(s.dataDirectory);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleTestPath = async (path: string) => {
    setCustomPath(path);
    if (!path.trim()) {
      setPermissionCheck(null);
      return;
    }
    const res = await portableService.testDirectoryWritable(path);
    setPermissionCheck(res);
  };

  const handleTogglePortable = async (enable: boolean) => {
    if (enable && customPath) {
      const perm = await portableService.testDirectoryWritable(customPath);
      if (!perm.writable) {
        setStatusMsg({
          type: 'error',
          message: perm.error || 'Cannot activate portable mode in a read-only directory.',
        });
        return;
      }
    }

    const res = await portableService.setPortableMode(enable, customPath || undefined);
    if (res.success) {
      setStatusMsg({
        type: 'success',
        message: enable
          ? 'Portable Mode enabled! Restart Harmoniq to begin using the portable data directory.'
          : 'Standard AppData mode restored! Restart Harmoniq to apply.',
      });
      refresh();
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Failed to update portable configuration.',
      });
    }
  };

  const handleMigrate = async (direction: 'toPortable' | 'toStandard') => {
    setIsMigrating(true);
    try {
      const res = await portableService.migrateData(direction, customPath || undefined);
      setMigrationResult(res);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          message: `Successfully migrated ${res.filesMigrated} configuration files to ${res.targetDir}!`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          message: res.error || 'Data migration failed.',
        });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', message: e.message || 'Migration error' });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272733] pb-4">
        <div>
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <FolderArchive size={18} className="text-[var(--accent-dynamic)]" />
            <span>Portable Mode & Directory Storage</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Store Harmoniq data locally on a USB flash drive or chosen directory instead of Windows %APPDATA%.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status?.isPortable ? (
            <button
              onClick={() => handleTogglePortable(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
            >
              <RotateCcw size={12} />
              <span>Switch to Standard AppData</span>
            </button>
          ) : (
            <button
              onClick={() => handleTogglePortable(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-xs font-semibold text-white transition-all shadow-glow-sm"
            >
              <HardDrive size={13} />
              <span>Enable Portable Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Notifications */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl border text-xs animate-in fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{statusMsg.message}</span>
        </div>
      )}

      {/* Current Mode & Permission Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Storage Path */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-[var(--accent-dynamic)]" />
              <span className="text-xs font-bold text-[#F5F3FF]">Active Storage Directory</span>
            </div>
            <span
              className={`text-[10px] font-mono-numbers px-2 py-0.5 rounded-full font-bold border ${
                status?.isPortable
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {status?.isPortable ? 'Portable Storage' : 'Standard AppData'}
            </span>
          </div>
          <p className="text-[11px] font-mono-numbers text-[#E4E4E7] truncate bg-[#14141B] p-2 rounded-lg border border-[#272733]">
            {status?.dataDirectory || '%APPDATA%\\Harmoniq'}
          </p>
        </div>

        {/* Windows Permissions Safeguard */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status?.isWritable ? (
                <ShieldCheck size={16} className="text-emerald-400" />
              ) : (
                <ShieldAlert size={16} className="text-rose-400" />
              )}
              <span className="text-xs font-bold text-[#F5F3FF]">Filesystem Permissions</span>
            </div>
            <span
              className={`text-[10px] font-mono-numbers px-2 py-0.5 rounded-full font-bold border ${
                status?.isWritable
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
              }`}
            >
              {status?.isWritable ? 'Writable (Full Access)' : 'Write-Protected'}
            </span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Windows system directories like <kbd className="px-1 py-0.5 bg-black/40 rounded text-[10px]">Program Files</kbd> require administrator elevation. Harmoniq tests write permissions before activating portable mode.
          </p>
        </div>
      </div>

      {/* Custom Portable Path Input & Permission Check */}
      <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[#F5F3FF]">Custom Portable Directory (Optional)</span>
            <p className="text-[11px] text-[#A1A1AA]">
              Leave empty to default to <kbd className="px-1 py-0.5 bg-black/40 rounded text-[10px]">./harmoniq-data</kbd> adjacent to the application executable.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={customPath}
            onChange={(e) => handleTestPath(e.target.value)}
            placeholder="e.g. D:\HarmoniqPortable\data or ./harmoniq-data"
            className="flex-1 px-3 py-2 rounded-xl bg-[#14141B] border border-[#272733] text-xs font-mono-numbers text-[#F5F3FF] focus:border-[var(--accent-dynamic)] focus:outline-none"
          />
          <button
            onClick={() => handleTogglePortable(true)}
            className="px-4 py-2 rounded-xl bg-[#1B1B24] hover:bg-[#272736] border border-[#272733] text-xs font-semibold text-[#E4E4E7] hover:text-white transition-all shrink-0"
          >
            Apply Path
          </button>
        </div>

        {permissionCheck && (
          <div
            className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
              permissionCheck.writable
                ? 'bg-emerald-950/20 text-emerald-400'
                : 'bg-rose-950/20 text-rose-400'
            }`}
          >
            {permissionCheck.writable ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>
              {permissionCheck.writable
                ? 'Target directory is valid and writable.'
                : permissionCheck.error || 'Target directory is read-only.'}
            </span>
          </div>
        )}
      </div>

      {/* Migration Assistant */}
      <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-3">
        <div className="flex items-center gap-2">
          <FolderSync size={16} className="text-[var(--accent-dynamic)]" />
          <span className="text-xs font-bold text-[#F5F3FF]">Migration Assistant</span>
        </div>
        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
          Safely copy your playlists, folders, listening history, custom DSP presets, and EQ settings between storage modes so you never lose your configuration.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={() => handleMigrate('toPortable')}
            disabled={isMigrating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#E4E4E7] hover:text-white transition-all disabled:opacity-50"
          >
            <ArrowRightLeft size={13} className="text-[var(--accent-dynamic)]" />
            <span>Copy AppData to Portable</span>
          </button>
          <button
            onClick={() => handleMigrate('toStandard')}
            disabled={isMigrating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#E4E4E7] hover:text-white transition-all disabled:opacity-50"
          >
            <ArrowRightLeft size={13} className="text-purple-400" />
            <span>Copy Portable to AppData</span>
          </button>
        </div>
      </div>
    </div>
  );
};
