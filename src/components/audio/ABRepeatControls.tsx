import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { Repeat1, RotateCcw, Play, Pause, Scissors, Sparkles, Check, Clock } from 'lucide-react';

export const ABRepeatControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    abRepeat,
    setABRepeatPointA,
    setABRepeatPointB,
    toggleABRepeat,
    clearABRepeat,
    currentTime,
    duration,
    seekTo,
  } = usePlayer();

  const formatSec = (s: number | null) => {
    if (s === null || isNaN(s)) return '--:--.-';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec < 10 ? '0' : ''}${sec}.${ms}`;
  };

  const getLoopDuration = () => {
    if (abRepeat.pointA !== null && abRepeat.pointB !== null) {
      const diff = Math.max(0, abRepeat.pointB - abRepeat.pointA);
      return `${diff.toFixed(1)}s`;
    }
    return null;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#09090B] border border-[#272733] text-xs">
        <button
          onClick={() => setABRepeatPointA()}
          title="Set Point A to current position"
          className={`px-2 py-1 rounded-lg font-bold text-[11px] font-mono-numbers transition-all ${
            abRepeat.pointA !== null
              ? 'bg-[var(--accent-dynamic)] text-[#F5F3FF]'
              : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF]'
          }`}
        >
          A: {abRepeat.pointA !== null ? formatSec(abRepeat.pointA) : 'Set'}
        </button>

        <button
          onClick={() => setABRepeatPointB()}
          title="Set Point B to current position"
          className={`px-2 py-1 rounded-lg font-bold text-[11px] font-mono-numbers transition-all ${
            abRepeat.pointB !== null
              ? 'bg-[var(--accent-dynamic)] text-[#F5F3FF]'
              : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF]'
          }`}
        >
          B: {abRepeat.pointB !== null ? formatSec(abRepeat.pointB) : 'Set'}
        </button>

        {abRepeat.pointA !== null && abRepeat.pointB !== null && (
          <>
            <button
              onClick={() => toggleABRepeat()}
              title={abRepeat.enabled ? 'Pause A-B Loop' : 'Enable A-B Loop'}
              className={`p-1.5 rounded-lg transition-all ${
                abRepeat.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#14141B] text-[#71717A]'
              }`}
            >
              <Repeat1 size={13} />
            </button>

            <button
              onClick={() => clearABRepeat()}
              title="Reset A-B points"
              className="p-1.5 rounded-lg bg-[#14141B] hover:bg-[#1F1F2A] text-[#71717A] hover:text-rose-400 transition-all"
            >
              <RotateCcw size={13} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-4">
      <div className="flex items-center justify-between border-b border-[#272733] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--accent-dynamic)]/10 text-[var(--accent-dynamic)]">
            <Repeat1 size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F3FF]">A-B Precision Repeat Looper</h4>
            <p className="text-[11px] text-[#71717A]">
              Set exact start (A) and end (B) points to seamlessly loop musical phrases, solos, or passages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {abRepeat.enabled && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LOOPING ({getLoopDuration()})</span>
            </span>
          )}
          <button
            onClick={() => toggleABRepeat()}
            disabled={abRepeat.pointA === null || abRepeat.pointB === null}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              abRepeat.enabled
                ? 'bg-emerald-500 text-black shadow-glow-sm hover:bg-emerald-400'
                : abRepeat.pointA !== null && abRepeat.pointB !== null
                ? 'bg-[#1C1C24] text-[#F5F3FF] hover:bg-[#272733]'
                : 'bg-[#14141B] text-[#52525B] cursor-not-allowed'
            }`}
          >
            {abRepeat.enabled ? 'Disable Loop' : 'Enable Loop'}
          </button>
        </div>
      </div>

      {/* Interval display & Setters */}
      <div className="grid grid-cols-2 gap-3 font-mono-numbers">
        <div className="p-3 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#71717A] block">POINT A (START)</span>
            <span className="text-sm font-bold text-[#F5F3FF]">{formatSec(abRepeat.pointA)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {abRepeat.pointA !== null && (
              <button
                onClick={() => seekTo(abRepeat.pointA!)}
                title="Jump to Point A"
                className="px-2 py-1 rounded bg-[#272733] hover:bg-[#3E3E4E] text-[#D4D4D8] text-[11px] font-semibold"
              >
                Jump
              </button>
            )}
            <button
              onClick={() => setABRepeatPointA()}
              className="px-2.5 py-1 rounded bg-[var(--accent-dynamic)] text-[#F5F3FF] text-[11px] font-bold hover:brightness-110 shadow-glow-sm"
            >
              Set at Current
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#14141B] border border-[#272733] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#71717A] block">POINT B (END)</span>
            <span className="text-sm font-bold text-[#F5F3FF]">{formatSec(abRepeat.pointB)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {abRepeat.pointB !== null && (
              <button
                onClick={() => seekTo(abRepeat.pointB!)}
                title="Jump to Point B"
                className="px-2 py-1 rounded bg-[#272733] hover:bg-[#3E3E4E] text-[#D4D4D8] text-[11px] font-semibold"
              >
                Jump
              </button>
            )}
            <button
              onClick={() => setABRepeatPointB()}
              className="px-2.5 py-1 rounded bg-[var(--accent-dynamic)] text-[#F5F3FF] text-[11px] font-bold hover:brightness-110 shadow-glow-sm"
            >
              Set at Current
            </button>
          </div>
        </div>
      </div>

      {/* Reset & Visual Timeline bar */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-[#71717A] text-[11px]">
          Current Position: <span className="font-bold text-[#F5F3FF] font-mono-numbers">{formatSec(currentTime)}</span>
        </span>
        <button
          onClick={() => clearABRepeat()}
          disabled={abRepeat.pointA === null && abRepeat.pointB === null}
          className="flex items-center gap-1 text-[11px] text-[#71717A] hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          <span>Clear A-B Points</span>
        </button>
      </div>
    </div>
  );
};
