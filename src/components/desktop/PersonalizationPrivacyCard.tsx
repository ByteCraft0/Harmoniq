import React, { useState } from 'react';
import { historyService } from '../../services/historyService';
import { discoveryService } from '../../services/discoveryService';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  History,
  Trash2,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Database,
  Lock,
  HardDrive,
  Info,
} from 'lucide-react';

export const PersonalizationPrivacyCard: React.FC = () => {
  const { showToast } = useToast();
  const [historyEnabled, setHistoryEnabled] = useState(() => historyService.isHistoryEnabled());
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetRecommendations, setConfirmResetRecommendations] = useState(false);

  const handleToggleHistory = () => {
    const next = !historyEnabled;
    historyService.setHistoryEnabled(next);
    setHistoryEnabled(next);
    showToast(
      next
        ? 'Listening history recording enabled'
        : 'Listening history recording paused (no playback logged)',
      'info'
    );
  };

  const handleClearHistory = () => {
    historyService.clearHistory();
    setConfirmClearHistory(false);
    showToast('Listening history successfully cleared', 'info');
  };

  const handleResetRecommendations = () => {
    discoveryService.resetRecommendationProfile();
    setConfirmResetRecommendations(false);
    showToast('Recommendation profile reset to baseline', 'info');
  };

  return (
    <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-6 shadow-card">
      <div className="flex items-center justify-between border-b border-[#272733] pb-3">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span>Listening Intelligence & Privacy Controls</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Control how Harmoniq learns from your playback. All data stays strictly on your PC with zero telemetry.
          </p>
        </div>
      </div>

      {/* 1. History Recording Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-[#09090B] border border-[#272733]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#A78BFA]" />
            <span className="text-xs font-bold text-[#F5F3FF]">Record Listening History</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">
            When enabled, Harmoniq records played tracks, duration, and completion to power stats and discovery.
          </p>
        </div>

        <button
          onClick={handleToggleHistory}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            historyEnabled
              ? 'bg-[#7C3AED]/20 border-[#7C3AED]/50 text-[#A78BFA]'
              : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
          }`}
        >
          {historyEnabled ? (
            <>
              <ToggleRight size={18} className="text-[#A78BFA]" />
              <span>Active</span>
            </>
          ) : (
            <>
              <ToggleLeft size={18} className="text-zinc-500" />
              <span>Disabled</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Clear History & Reset Profile Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clear History */}
        <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#F5F3FF] flex items-center gap-1.5">
              <Trash2 size={14} className="text-rose-400" />
              <span>Clear Playback History</span>
            </span>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Erases your entire listening log and completion counts. Does not affect your audio files or playlists.
            </p>
          </div>

          {confirmClearHistory ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleClearHistory}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmClearHistory(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearHistory(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-400 transition-colors"
            >
              Clear History Log
            </button>
          )}
        </div>

        {/* Reset Recommendation Profile */}
        <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#F5F3FF] flex items-center gap-1.5">
              <RotateCcw size={14} className="text-[#A78BFA]" />
              <span>Reset Recommendations</span>
            </span>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Resets "Made for You" and artist affinity weights back to default without clearing playlists or favorites.
            </p>
          </div>

          {confirmResetRecommendations ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleResetRecommendations}
                className="px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-bold text-white transition-colors"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setConfirmResetRecommendations(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmResetRecommendations(true)}
              className="px-3 py-1.5 rounded-lg bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 border border-[#7C3AED]/30 text-xs font-semibold text-[#A78BFA] transition-colors"
            >
              Reset Discovery Profile
            </button>
          )}
        </div>
      </div>

      {/* 3. Storage Breakdown Transparency */}
      <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <Database size={14} className="text-emerald-400" />
          <span>Local Storage Architecture & Encryption</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono-numbers text-zinc-400">
          <div className="p-2.5 rounded-lg bg-[#14141B] border border-[#272733] space-y-1">
            <div className="font-semibold text-zinc-200">History Log</div>
            <div className="text-[10px] text-zinc-500">harmoniq_listening_history_v2</div>
            <div className="text-[9px] text-emerald-400">Local Disk (Offline)</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#14141B] border border-[#272733] space-y-1">
            <div className="font-semibold text-zinc-200">Unified Favorites</div>
            <div className="text-[10px] text-zinc-500">harmoniq_favorites_v2</div>
            <div className="text-[9px] text-emerald-400">Local Disk (Offline)</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#14141B] border border-[#272733] space-y-1">
            <div className="font-semibold text-zinc-200">Smart Playlists</div>
            <div className="text-[10px] text-zinc-500">harmoniq_smart_playlists_v2</div>
            <div className="text-[9px] text-emerald-400">Local Disk (Offline)</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#14141B] border border-[#272733] space-y-1">
            <div className="font-semibold text-zinc-200">Cloud Telemetry</div>
            <div className="text-[10px] text-zinc-500">Zero Analytics Packets</div>
            <div className="text-[9px] text-emerald-400">Completely Blocked</div>
          </div>
        </div>
      </div>
    </div>
  );
};
