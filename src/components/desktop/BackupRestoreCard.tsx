import React, { useState, useEffect } from 'react';
import {
  Archive,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Trash2,
  ListMusic,
  FolderTree,
  Sliders,
  Radio,
  Podcast,
  RotateCcw,
} from 'lucide-react';
import {
  BackupValidationResult,
  BackupHistoryEntry,
  AutoBackupSchedule,
} from '../../types/backup';
import { backupService } from '../../services/backupService';

export const BackupRestoreCard: React.FC = () => {
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [autoSchedule, setAutoSchedule] = useState<AutoBackupSchedule>('weekly');
  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [validationPreview, setValidationPreview] = useState<{
    result: BackupValidationResult;
    archive: any;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const refresh = () => {
    setHistory(backupService.getBackupHistory());
    const config = backupService.getAutoBackupConfig();
    setAutoSchedule(config.schedule);
    setLastBackup(config.lastBackupTime);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleExportBackup = () => {
    try {
      backupService.downloadBackupFile();
      refresh();
      setStatusMsg({
        type: 'success',
        message: 'Harmoniq v2 backup archive generated and saved.',
      });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', message: e.message || 'Backup creation failed' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const val = backupService.validateBackup(parsed);
        if (!val.valid) {
          setStatusMsg({ type: 'error', message: val.error || 'Invalid backup archive.' });
          setValidationPreview(null);
        } else {
          setValidationPreview({ result: val, archive: parsed });
          setStatusMsg(null);
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', message: `Parse error: ${err.message}` });
        setValidationPreview(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!validationPreview) return;
    setIsRestoring(true);
    try {
      const res = await backupService.restoreBackup(validationPreview.archive, restoreMode);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          message: `Successfully restored ${res.restoredCount} items into library & settings!`,
        });
        setValidationPreview(null);
        refresh();
      } else {
        setStatusMsg({ type: 'error', message: res.error || 'Restore operation failed' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', message: e.message || 'Restore failed' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleScheduleChange = (sched: AutoBackupSchedule) => {
    setAutoSchedule(sched);
    backupService.setAutoBackupConfig({ schedule: sched });
  };

  const handleDeleteHistory = (id: string) => {
    backupService.deleteHistoryEntry(id);
    refresh();
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272733] pb-4">
        <div>
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <Archive size={18} className="text-[var(--accent-dynamic)]" />
            <span>Library Backup & Snapshot Restore</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Archive your complete music library metadata, playlist folders, saved queues, and custom EQ DSP presets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1B24] hover:bg-[#272736] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all cursor-pointer">
            <Upload size={12} />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-xs font-semibold text-white transition-all shadow-glow-sm"
          >
            <Download size={13} />
            <span>Create Backup</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
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

      {/* Validation & Restore Preview Modal / Card */}
      {validationPreview && (
        <div className="p-4 rounded-xl bg-[#0D0D12] border-2 border-[var(--accent-dynamic)] space-y-4 animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#272733] pb-2">
            <div className="flex items-center gap-2">
              <FileCheck size={16} className="text-emerald-400" />
              <span className="text-xs font-bold text-[#F5F3FF]">
                Backup Verified & Ready to Restore
              </span>
            </div>
            <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
              Checksum Match ({validationPreview.result.itemCount} items)
            </span>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
              <span className="text-[#A1A1AA] flex items-center gap-1.5">
                <ListMusic size={13} className="text-[var(--accent-dynamic)]" />
                Playlists
              </span>
              <span className="font-bold text-[#F5F3FF] font-mono-numbers">
                {validationPreview.result.summary.playlists}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
              <span className="text-[#A1A1AA] flex items-center gap-1.5">
                <FolderTree size={13} className="text-amber-400" />
                Folders
              </span>
              <span className="font-bold text-[#F5F3FF] font-mono-numbers">
                {validationPreview.result.summary.folders}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
              <span className="text-[#A1A1AA] flex items-center gap-1.5">
                <Clock size={13} className="text-cyan-400" />
                History & Queues
              </span>
              <span className="font-bold text-[#F5F3FF] font-mono-numbers">
                {validationPreview.result.summary.history + validationPreview.result.summary.queues}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
              <span className="text-[#A1A1AA] flex items-center gap-1.5">
                <Sliders size={13} className="text-violet-400" />
                Audio Presets
              </span>
              <span className="font-bold text-[#F5F3FF] font-mono-numbers">
                {validationPreview.result.summary.eqPresets + validationPreview.result.summary.rooms + validationPreview.result.summary.profiles}
              </span>
            </div>
          </div>

          {/* Restore Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A1A1AA]">Restore Method:</span>
              <label className="flex items-center gap-1.5 text-xs text-[#E4E4E7] cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="replace"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="text-[var(--accent-dynamic)]"
                />
                <span>Clean Replace (Exact State)</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#E4E4E7] cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="merge"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="text-[var(--accent-dynamic)]"
                />
                <span>Safe Merge (Keep Current)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setValidationPreview(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#A1A1AA] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-glow-sm"
              >
                <RotateCcw size={12} />
                <span>{isRestoring ? 'Restoring...' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Backup Scheduling & Zero Binary Constraint Guarantee */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scheduling Config */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[var(--accent-dynamic)]" />
              <span className="text-xs font-bold text-[#F5F3FF]">Automatic Backup Schedule</span>
            </div>
            <select
              value={autoSchedule}
              onChange={(e) => handleScheduleChange(e.target.value as AutoBackupSchedule)}
              className="px-2.5 py-1 rounded-lg bg-[#14141B] border border-[#272733] text-xs text-[#F5F3FF] focus:border-[var(--accent-dynamic)] focus:outline-none font-mono-numbers"
            >
              <option value="disabled">Disabled</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Automatically takes a lightweight snapshot of your playlists and statistics on launch according to your schedule.
          </p>
          <div className="text-[10px] text-[#71717A] font-mono-numbers">
            Last Automatic Backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}
          </div>
        </div>

        {/* Lightweight Architecture Guarantee */}
        <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-[#F5F3FF]">Strict Zero-Binary Guarantee</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Harmoniq backup archives never copy or duplicate gigabytes of raw audio files. Backups strictly contain structured JSON playlists, folders, listening history, and spatial audio calibration values.
          </p>
        </div>
      </div>

      {/* Backup History */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-[#A1A1AA] tracking-wider font-mono-numbers">
          Recent Backup Snapshots ({history.length}):
        </label>

        {history.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#0D0D12] border border-[#272733] text-center text-xs text-[#71717A]">
            No previous backups recorded. Click "Create Backup" to generate your first snapshot.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="p-2.5 rounded-xl bg-[#0D0D12] border border-[#272733] flex items-center justify-between text-xs hover:border-[#38384A] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Archive size={14} className="text-[#A1A1AA]" />
                  <div>
                    <span className="font-semibold text-[#F5F3FF]">{entry.fileName}</span>
                    <div className="flex items-center gap-2 text-[10px] text-[#71717A] font-mono-numbers">
                      <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{formatBytes(entry.sizeBytes)}</span>
                      <span>•</span>
                      <span>{entry.itemCount} items</span>
                      {entry.isAutomatic && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-950/40 text-purple-400 border border-purple-800/30">
                          Auto
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-numbers text-[#52525B]" title="Checksum">
                    #{entry.checksum.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => handleDeleteHistory(entry.id)}
                    title="Remove history entry"
                    className="p-1 rounded text-[#71717A] hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
