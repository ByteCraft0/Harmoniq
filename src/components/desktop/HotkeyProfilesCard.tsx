import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Shield,
  Layers,
  Gamepad2,
  Headphones,
  Laptop,
} from 'lucide-react';
import {
  SHORTCUT_DEFINITIONS,
  ShortcutAction,
  ShortcutConfig,
} from '../../types/shortcuts';
import {
  HotkeyProfile,
  HotkeyScenario,
} from '../../types/hotkeyProfile';
import { hotkeyProfileService } from '../../services/hotkeyProfileService';
import {
  formatAcceleratorToKeys,
  keyboardEventToAccelerator,
} from '../../services/shortcutService';

export const HotkeyProfilesCard: React.FC = () => {
  const [profiles, setProfiles] = useState<HotkeyProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<HotkeyProfile | null>(null);
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [recordingKey, setRecordingKey] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<HotkeyScenario>('desktop');

  const refresh = () => {
    const list = hotkeyProfileService.getProfiles();
    setProfiles(list);
    setActiveProfile(hotkeyProfileService.getActiveProfile());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSelectProfile = async (id: string) => {
    await hotkeyProfileService.setActiveProfile(id);
    refresh();
    setSuccessMsg(`Switched to "${hotkeyProfileService.getActiveProfile().name}" profile.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const created = hotkeyProfileService.createProfile(newProfileName.trim(), selectedScenario);
    hotkeyProfileService.setActiveProfile(created.id);
    setNewProfileName('');
    setShowNewModal(false);
    refresh();
    setSuccessMsg(`Created new profile "${created.name}".`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDeleteProfile = (id: string) => {
    hotkeyProfileService.deleteProfile(id);
    refresh();
  };

  const handleRestoreDefaults = () => {
    if (!activeProfile) return;
    hotkeyProfileService.restoreDefaultShortcuts(activeProfile.id);
    refresh();
    setSuccessMsg(`Restored default shortcuts for "${activeProfile.name}".`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleExportProfile = () => {
    if (!activeProfile) return;
    try {
      const json = hotkeyProfileService.exportProfile(activeProfile.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `harmoniq_hotkey_${activeProfile.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMsg(e.message || 'Export failed');
    }
  };

  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const res = hotkeyProfileService.importProfile(text);
      if (res.success && res.profile) {
        await hotkeyProfileService.setActiveProfile(res.profile.id);
        refresh();
        setSuccessMsg(`Imported and activated profile "${res.profile.name}".`);
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setErrorMsg(res.error || 'Failed to import profile.');
        setTimeout(() => setErrorMsg(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartRecording = (action: ShortcutAction) => {
    setRecordingAction(action);
    setRecordingKey('');
    setErrorMsg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: ShortcutAction) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecordingAction(null);
      setRecordingKey('');
      return;
    }

    const accel = keyboardEventToAccelerator(e);
    if (!accel) {
      setRecordingKey('Press trigger key...');
      return;
    }

    setRecordingKey(accel);
    if (!activeProfile) return;

    const result = hotkeyProfileService.updateProfileShortcuts(activeProfile.id, action, accel);
    if (!result.success) {
      setErrorMsg(result.error || 'Conflict detected');
    } else {
      setRecordingAction(null);
      setRecordingKey('');
      setErrorMsg(null);
      refresh();
    }
  };

  const getScenarioIcon = (scenario: HotkeyScenario) => {
    switch (scenario) {
      case 'audiophile':
        return <Headphones size={13} className="text-violet-400" />;
      case 'gaming':
        return <Gamepad2 size={13} className="text-emerald-400" />;
      case 'laptop':
        return <Laptop size={13} className="text-amber-400" />;
      case 'mediakey':
        return <Shield size={13} className="text-cyan-400" />;
      default:
        return <Layers size={13} className="text-[var(--accent-dynamic)]" />;
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272733] pb-4">
        <div>
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--accent-dynamic)]" />
            <span>Hotkey Profiles & Desktop Shortcuts</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Customize global system hotkeys, avoid navigation key clashes, and switch between tailored workflow profiles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1B24] hover:bg-[#272736] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all cursor-pointer">
            <Upload size={12} />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportProfile} className="hidden" />
          </label>
          <button
            onClick={handleExportProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1B24] hover:bg-[#272736] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all"
            title="Export active profile to JSON"
          >
            <Download size={12} />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-xs font-semibold text-white transition-all shadow-glow-sm"
          >
            <Plus size={13} />
            <span>New Profile</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs animate-in fade-in">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profile Selector Tabs */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-[#A1A1AA] tracking-wider font-mono-numbers">
          Active Profile:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {profiles.map((p) => {
            const isSelected = activeProfile?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectProfile(p.id)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-[#181824] border-[var(--accent-dynamic)] shadow-glow-sm'
                    : 'bg-[#0D0D12] border-[#272733] hover:border-[#38384A]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5">
                    {getScenarioIcon(p.scenario)}
                    <span className="text-xs font-bold text-[#F5F3FF] truncate">{p.name}</span>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-dynamic)] shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between w-full text-[9px] text-[#71717A] font-mono-numbers">
                  <span className="capitalize">{p.scenario}</span>
                  {!p.isBuiltIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(p.id);
                      }}
                      title="Delete profile"
                      className="hover:text-rose-400 p-0.5"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Profile Info Banner & Reset */}
      {activeProfile && (
        <div className="p-3.5 rounded-xl bg-[#0D0D12] border border-[#272733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#F5F3FF]">{activeProfile.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#A1A1AA] uppercase font-mono-numbers">
                {activeProfile.isBuiltIn ? 'Built-in Preset' : 'Custom'}
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA]">{activeProfile.description}</p>
          </div>

          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all shrink-0"
          >
            <RotateCcw size={12} />
            <span>Reset Profile Defaults</span>
          </button>
        </div>
      )}

      {/* Shortcuts Mapping Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#A1A1AA] tracking-wider font-mono-numbers border-b border-[#272733] pb-1.5">
          <span>Action</span>
          <span>Assigned Key Combo</span>
        </div>

        {activeProfile &&
          SHORTCUT_DEFINITIONS.map((def) => {
            const action = def.id;
            const currentAccel = activeProfile.shortcuts[action] || def.defaultKey;
            const isRecording = recordingAction === action;
            const keys = formatAcceleratorToKeys(currentAccel);

            return (
              <div
                key={action}
                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isRecording
                    ? 'bg-[#181824] border-[var(--accent-dynamic)] shadow-glow-sm'
                    : 'bg-[#0D0D12] border-[#272733]/80 hover:border-[#38384A]'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#F5F3FF]">{def.label}</span>
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
                      <span>{recordingKey || 'Press new combo... (Esc cancels)'}</span>
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
            );
          })}
      </div>

      {/* Navigation Protection Guarantee */}
      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-[11px] text-purple-300 flex items-center gap-2">
        <Shield size={15} className="shrink-0 text-[var(--accent-dynamic)]" />
        <span>
          <strong>Harmoniq Musical Navigation Protected:</strong> <kbd className="px-1 py-0.5 bg-black/40 rounded border border-purple-500/30 text-[10px]">Alt+Left</kbd> (Violin Back) and <kbd className="px-1 py-0.5 bg-black/40 rounded border border-purple-500/30 text-[10px]">Alt+Right</kbd> (Trumpet Forward) are reserved to guarantee fluid navigation without shortcut hijacking.
        </span>
      </div>

      {/* Create Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-2xl w-full max-w-md space-y-4 animate-in zoom-in-95">
            <h4 className="font-bold text-sm text-[#F5F3FF]">Create Custom Hotkey Profile</h4>
            <div className="space-y-1">
              <label className="text-xs text-[#A1A1AA]">Profile Name</label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g. Mechanical 60% Layout"
                className="w-full px-3 py-2 rounded-xl bg-[#0D0D12] border border-[#272733] text-xs text-[#F5F3FF] focus:border-[var(--accent-dynamic)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A1A1AA]">Usage Scenario</label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value as HotkeyScenario)}
                className="w-full px-3 py-2 rounded-xl bg-[#0D0D12] border border-[#272733] text-xs text-[#F5F3FF] focus:border-[var(--accent-dynamic)] focus:outline-none"
              >
                <option value="desktop">Desktop / General</option>
                <option value="audiophile">Audiophile / Minimalist</option>
                <option value="gaming">Gaming / Background Friendly</option>
                <option value="laptop">Laptop / Compact</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#A1A1AA] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim()}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-glow-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
