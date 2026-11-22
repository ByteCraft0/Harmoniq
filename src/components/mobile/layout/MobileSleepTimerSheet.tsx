import React, { useState } from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { useBackHandler } from '../MobileNavigationContext';
import { Moon, X, Clock, Play, AlertCircle, Plus, Check } from 'lucide-react';

interface MobileSleepTimerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PRESETS = [5, 10, 15, 30, 45, 60];

export const MobileSleepTimerSheet: React.FC<MobileSleepTimerSheetProps> = ({ isOpen, onClose }) => {
  const { sleepTimer, setSleepTimer, cancelSleepTimer, extendSleepTimer } = usePlayer();
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [customError, setCustomError] = useState<string | null>(null);

  // Priority 2: System back button closes active sleep timer sheet
  useBackHandler(
    2,
    () => {
      onClose();
      return true;
    },
    isOpen
  );

  if (!isOpen) return null;

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStartTimer = (minutes: number) => {
    setCustomError(null);
    setSleepTimer(minutes);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customMinutes, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 720) {
      setCustomError('Please enter a duration between 1 and 720 minutes.');
      return;
    }
    setCustomError(null);
    setSleepTimer(parsed);
    setCustomMinutes('');
  };

  const progressPercent =
    sleepTimer.isActive && sleepTimer.totalSeconds > 0
      ? Math.max(0, Math.min(100, (1 - sleepTimer.secondsRemaining / sleepTimer.totalSeconds) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] rounded-t-3xl bg-[#14141b] border-t border-[#272733] flex flex-col text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272733] flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Sleep Timer</h3>
              <p className="text-xs text-zinc-400">
                {sleepTimer.isActive ? 'Active countdown in progress' : 'Auto-pause playback when you sleep'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Close sleep timer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Active Timer Display */}
          {sleepTimer.isActive ? (
            <div className="bg-gradient-to-br from-violet-950/40 via-[#181824] to-[#12121a] border border-violet-800/40 rounded-2xl p-5 text-center space-y-4 shadow-lg shadow-violet-950/30">
              <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-violet-400">Time Remaining</span>
                <div className="text-4xl font-extrabold font-mono tracking-tight text-white mt-1">
                  {formatRemaining(sleepTimer.secondsRemaining)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Quick actions for active timer */}
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={() => extendSleepTimer(5)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-zinc-300 flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-400" />
                  <span>+5 min</span>
                </button>
                <button
                  onClick={() => extendSleepTimer(15)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-zinc-300 flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-400" />
                  <span>+15 min</span>
                </button>
                <button
                  onClick={cancelSleepTimer}
                  className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 text-xs font-semibold active:scale-95 transition-all"
                >
                  Cancel Timer
                </button>
              </div>

              <p className="text-[11px] text-zinc-400">
                Playback will pause automatically even with your screen turned off.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Preset Buttons */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Quick Presets
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {QUICK_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleStartTimer(mins)}
                      className="py-3 px-4 rounded-xl bg-[#1b1b24] border border-[#272733] hover:border-violet-500/50 hover:bg-violet-950/20 text-center text-sm font-semibold text-white active:scale-95 transition-all flex flex-col items-center justify-center space-y-1"
                    >
                      <span className="text-base text-violet-400 font-bold">{mins}</span>
                      <span className="text-[11px] text-zinc-400 font-normal">minutes</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Duration Form */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Custom Duration
                </span>
                <form onSubmit={handleCustomSubmit} className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      placeholder="Minutes (e.g. 25)"
                      value={customMinutes}
                      onChange={(e) => {
                        setCustomMinutes(e.target.value);
                        setCustomError(null);
                      }}
                      className="w-full px-4 py-2.5 bg-[#1b1b24] border border-[#272733] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 font-mono"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-zinc-500 pointer-events-none">
                      min
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm active:scale-95 transition-all shadow-md shadow-violet-900/30 flex items-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>Set</span>
                  </button>
                </form>
                {customError && (
                  <p className="text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{customError}</span>
                  </p>
                )}
              </div>

              {/* Helpful background notice */}
              <div className="p-3.5 rounded-xl bg-[#181822] border border-[#272733] text-zinc-400 text-xs leading-relaxed space-y-1">
                <p className="font-medium text-zinc-300">Native Android Service Support</p>
                <p>
                  The sleep timer runs in HARMONIQ's foreground media service. It remains active when the screen locks or when switching to other apps.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Bottom Close button */}
        <div className="px-5 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm active:scale-[0.98] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
