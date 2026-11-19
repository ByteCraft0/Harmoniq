import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { abxService } from '../../services/abxService';
import { ABXSession, ABXStreamChoice } from '../../types/abx';
import { TrackMetadata } from '../../types/audio';
import {
  GitCompare,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Volume2,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Headphones,
} from 'lucide-react';

export const ABXComparisonView: React.FC = () => {
  const { tracks } = useLibrary();
  const { showToast } = useToast();

  const [session, setSession] = useState<ABXSession | null>(() => abxService.getCurrentSession());
  const [sessionsList, setSessionsList] = useState<ABXSession[]>(() => abxService.getSessions());
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    activeStream: 'A' as ABXStreamChoice,
  });

  // Track selection state
  const [selectedTrackAId, setSelectedTrackAId] = useState<string>('');
  const [selectedTrackBId, setSelectedTrackBId] = useState<string>('');
  const [totalTrialsInput, setTotalTrialsInput] = useState<number>(10);
  const [gearNotesInput, setGearNotesInput] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tester' | 'history'>('tester');

  useEffect(() => {
    const unsubSession = abxService.subscribe((s) => {
      setSession(s);
      setSessionsList(abxService.getSessions());
    });
    const unsubPlayback = abxService.subscribePlayback((ps) => {
      setPlaybackState(ps);
    });

    return () => {
      unsubSession();
      unsubPlayback();
    };
  }, []);

  const handleStartNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    const trackA = tracks.find((t) => t.id === selectedTrackAId) || null;
    const trackB = tracks.find((t) => t.id === selectedTrackBId) || null;

    if (!trackA || !trackB) {
      showToast('Please select both Audio File A and Audio File B', 'warning');
      return;
    }

    if (trackA.id === trackB.id) {
      showToast('Track A and Track B must be different audio files', 'warning');
      return;
    }

    const newSession = abxService.createSession(trackA, trackB, totalTrialsInput, {
      audioGearNotes: gearNotesInput.trim(),
    });

    setShowNewModal(false);
    setActiveTab('tester');
    showToast(`Started ABX Blind Test (${newSession.totalTrials} Trials)`, 'success');
  };

  const handleAudition = (stream: ABXStreamChoice) => {
    abxService.audition(stream);
  };

  const handleTogglePlay = () => {
    if (playbackState.isPlaying) {
      abxService.pause();
    } else {
      abxService.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    abxService.seek(parseFloat(e.target.value));
  };

  const handleVote = (choice: 'A' | 'B') => {
    if (!session || session.isComplete) return;
    const currentTrialNum = session.currentTrialIndex + 1;
    abxService.submitChoice(choice);
    showToast(`Submitted vote for Trial #${currentTrialNum}`, 'info');
  };

  const handleResetSession = () => {
    abxService.resetCurrentSession();
    showToast('ABX test session reset', 'info');
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    abxService.deleteSession(id);
    showToast('ABX test session deleted', 'info');
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentTrial = session?.trials[session.currentTrialIndex];

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#272733] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-[var(--accent-dynamic)]/20 to-[#A78BFA]/20 border border-[var(--accent-dynamic)]/30 text-[var(--accent-dynamic)] shadow-glow-sm">
            <GitCompare size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F5F3FF] tracking-tight">
              ABX Audio Comparison
            </h1>
            <p className="text-xs text-[#A1A1AA]">
              Double-blind scientific auditioning tool with level matching, synchronized lockstep switching, and binomial statistical analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#14141B] border border-[#272733] rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveTab('tester')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'tester'
                  ? 'bg-[var(--accent-dynamic)] text-black font-bold shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
              }`}
            >
              Active Test
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-[var(--accent-dynamic)] text-black font-bold shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
              }`}
            >
              Past Tests ({sessionsList.length})
            </button>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>New Test</span>
          </button>
        </div>
      </div>

      {activeTab === 'tester' ? (
        session ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Main Auditioning Deck */}
            <div className="lg:col-span-8 space-y-6">
              {/* File comparison banner */}
              <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-numbers uppercase text-[#A78BFA] font-bold tracking-wider">
                    Blind Comparison Session
                  </span>
                  <div className="flex items-center gap-2">
                    {session.isAutoLevelMatched && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck size={11} /> Auto-Level Matched
                      </span>
                    )}
                    <span className="text-[11px] font-mono-numbers text-[#71717A]">
                      Trial {session.currentTrialIndex + 1} of {session.totalTrials}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
                    <span className="text-[10px] font-mono-numbers text-[#A78BFA] font-bold">STREAM A</span>
                    <h3 className="font-bold text-sm text-[#F5F3FF] truncate">{session.trackAName}</h3>
                    <p className="text-[11px] text-[#71717A] font-mono-numbers">
                      {session.trackA?.codec || 'Audio'} • {session.trackA?.bitrate ? `${Math.round(session.trackA.bitrate / 1000)} kbps` : ''}
                    </p>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-[#71717A]">Level Trim:</span>
                      <span className="font-mono-numbers text-[var(--accent-dynamic)] font-bold">
                        {session.levelTrimDbA > 0 ? `+${session.levelTrimDbA}` : session.levelTrimDbA} dB
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
                    <span className="text-[10px] font-mono-numbers text-sky-400 font-bold">STREAM B</span>
                    <h3 className="font-bold text-sm text-[#F5F3FF] truncate">{session.trackBName}</h3>
                    <p className="text-[11px] text-[#71717A] font-mono-numbers">
                      {session.trackB?.codec || 'Audio'} • {session.trackB?.bitrate ? `${Math.round(session.trackB.bitrate / 1000)} kbps` : ''}
                    </p>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-[#71717A]">Level Trim:</span>
                      <span className="font-mono-numbers text-sky-400 font-bold">
                        {session.levelTrimDbB > 0 ? `+${session.levelTrimDbB}` : session.levelTrimDbB} dB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Synchronized Transport Controls */}
                <div className="pt-2 space-y-2 border-t border-[#272733]/50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTogglePlay}
                      className="p-3 rounded-full bg-[var(--accent-dynamic)] text-black hover:scale-105 active:scale-95 transition-all shadow-glow-sm"
                    >
                      {playbackState.isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>

                    <div className="flex-1 space-y-1">
                      <input
                        type="range"
                        min="0"
                        max={playbackState.duration || 100}
                        step="0.1"
                        value={playbackState.currentTime}
                        onChange={handleSeek}
                        className="w-full accent-[var(--accent-dynamic)] h-1.5 bg-[#272733] rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono-numbers text-[#71717A]">
                        <span>{formatTime(playbackState.currentTime)}</span>
                        <span>{formatTime(playbackState.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audition Switcher (A, B, X) */}
              <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#F5F3FF]">Audition Comparison Streams</h3>
                    <p className="text-xs text-[#71717A]">
                      Seamlessly switch between streams during playback. Playback remains locked in frame-perfect sync.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#272733] text-[#F5F3FF]">
                    Currently Auditioning: {playbackState.activeStream}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleAudition('A')}
                    className={`py-5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      playbackState.activeStream === 'A'
                        ? 'bg-[var(--accent-dynamic)]/15 border-[var(--accent-dynamic)] shadow-glow-sm'
                        : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
                    }`}
                  >
                    <span className="text-2xl font-black text-[#F5F3FF]">A</span>
                    <span className="text-[11px] text-[#A1A1AA] font-medium">Audition Stream A</span>
                  </button>

                  <button
                    onClick={() => handleAudition('B')}
                    className={`py-5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      playbackState.activeStream === 'B'
                        ? 'bg-sky-500/15 border-sky-500 shadow-glow-sm'
                        : 'bg-[#09090B] border-[#272733] hover:border-[#3E3E4E] hover:bg-[#111116]'
                    }`}
                  >
                    <span className="text-2xl font-black text-[#F5F3FF]">B</span>
                    <span className="text-[11px] text-[#A1A1AA] font-medium">Audition Stream B</span>
                  </button>

                  <button
                    onClick={() => handleAudition('X')}
                    className={`py-5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      playbackState.activeStream === 'X'
                        ? 'bg-amber-500/20 border-amber-500 shadow-glow-sm'
                        : 'bg-[#09090B] border-[#272733] hover:border-amber-500/50 hover:bg-[#111116]'
                    }`}
                  >
                    <span className="text-2xl font-black text-amber-400">X</span>
                    <span className="text-[11px] text-amber-300 font-bold">Audition Mystery Target (X)</span>
                  </button>
                </div>

                {/* Blind Identification Voting Buttons */}
                {!session.isComplete ? (
                  <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F5F3FF]">
                        Trial #{session.currentTrialIndex + 1}: Which file is X?
                      </span>
                      <span className="text-[11px] text-[#71717A]">
                        Listen closely to transients, reverb tails, and dynamic detail
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleVote('A')}
                        className="py-3 px-4 rounded-xl bg-[#14141B] hover:bg-[var(--accent-dynamic)] hover:text-black border border-[#272733] text-xs font-bold text-[#F5F3FF] transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>Mystery X is Stream A</span>
                      </button>

                      <button
                        onClick={() => handleVote('B')}
                        className="py-3 px-4 rounded-xl bg-[#14141B] hover:bg-sky-400 hover:text-black border border-[#272733] text-xs font-bold text-[#F5F3FF] transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>Mystery X is Stream B</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                    <h4 className="font-bold text-sm text-[#F5F3FF]">ABX Comparison Test Complete</h4>
                    <p className="text-xs text-[#A1A1AA]">
                      All {session.totalTrials} trials completed. Check your statistical significance score on the right.
                    </p>
                    <button
                      onClick={handleResetSession}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#F5F3FF] transition-colors mt-2"
                    >
                      <RotateCcw size={14} />
                      <span>Retest with Same Files</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Statistical Analysis & Trials Log */}
            <div className="lg:col-span-4 space-y-6">
              {/* Statistical Score Card */}
              <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-4">
                <h3 className="font-bold text-sm text-[#F5F3FF] flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--accent-dynamic)]" />
                  <span>Statistical Analysis</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#09090B] border border-[#272733] text-center">
                    <span className="text-[10px] text-[#71717A] uppercase font-mono">Correct Score</span>
                    <p className="text-xl font-black text-[#F5F3FF] font-mono-numbers">
                      {session.correctCount} / {session.completedTrialsCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#09090B] border border-[#272733] text-center">
                    <span className="text-[10px] text-[#71717A] uppercase font-mono">Accuracy</span>
                    <p className="text-xl font-black text-[var(--accent-dynamic)] font-mono-numbers">
                      {session.correctPercentage}%
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#272733] space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A1A1AA]">p-Value (Binomial):</span>
                    <span className="font-mono-numbers font-bold text-[#F5F3FF]">{session.pValue}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#A1A1AA]">Significance (p &lt; 0.05):</span>
                    <span
                      className={`font-mono-numbers font-bold text-xs ${
                        session.isStatisticallySignificant ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {session.isStatisticallySignificant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#71717A] pt-1 leading-relaxed">
                    {session.confidenceRating}
                  </p>
                </div>

                {/* Hardware context note */}
                {session.audioGearNotes && (
                  <div className="p-3 rounded-xl bg-[#09090B] border border-[#272733] text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[#A1A1AA]">
                      <Headphones size={13} className="text-[#A78BFA]" />
                      <span className="font-bold">Listening Gear:</span>
                    </div>
                    <p className="text-[#71717A] text-[11px]">{session.audioGearNotes}</p>
                  </div>
                )}
              </div>

              {/* Trials History Log */}
              <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] shadow-card space-y-3">
                <span className="text-xs font-bold text-[#F5F3FF]">Trial Progression Log</span>
                <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                  {session.trials.map((t, idx) => {
                    const isPassed = t.isCorrect;
                    const isCurrent = idx === session.currentTrialIndex && !session.isComplete;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono-numbers ${
                          isCurrent
                            ? 'bg-[var(--accent-dynamic)]/10 border border-[var(--accent-dynamic)]/30 text-[#F5F3FF]'
                            : 'bg-[#09090B] text-[#71717A]'
                        }`}
                      >
                        <span className="font-bold">Trial #{t.trialIndex + 1}</span>
                        {t.userChoice ? (
                          <div className="flex items-center gap-2">
                            <span>Voted {t.userChoice}</span>
                            {session.isComplete && (
                              <span className="text-[10px]">
                                (Actual: {t.secretAssignment})
                              </span>
                            )}
                            {isPassed ? (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            ) : (
                              <XCircle size={14} className="text-red-400" />
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-[#52525B]">
                            {isCurrent ? 'Auditioning now...' : 'Pending'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scientific Notice */}
              <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] text-[11px] text-[#71717A] leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#A1A1AA] font-bold">
                  <Info size={13} className="text-[var(--accent-dynamic)]" />
                  <span>Scientific Notice</span>
                </div>
                <p>
                  ABX testing measures genuine perceptual discriminability. An insignificant result ($p \ge 0.05$) does not mean two files are identical, only that audible differences cannot be proven under current listening gear, room noise, and hearing conditions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-16 rounded-2xl bg-[#14141B] border border-[#272733] text-center space-y-4">
            <GitCompare size={48} className="mx-auto text-[#3F3F46]" />
            <div>
              <h3 className="text-lg font-bold text-[#F5F3FF]">No Active ABX Comparison</h3>
              <p className="text-xs text-[#A1A1AA] max-w-md mx-auto mt-1">
                Select two audio files from your music library to start a scientific blind comparison test.
              </p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:scale-105 transition-all"
            >
              <Plus size={15} />
              <span>Configure New ABX Test</span>
            </button>
          </div>
        )
      ) : (
        /* Past Sessions History Tab */
        <div className="space-y-3">
          {sessionsList.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] text-xs space-y-2">
              <Calendar size={32} className="mx-auto text-[#3F3F46]" />
              <p>No saved comparison sessions yet.</p>
            </div>
          ) : (
            sessionsList.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  abxService.loadSession(s.id);
                  setActiveTab('tester');
                }}
                className="p-4 rounded-xl bg-[#14141B] hover:bg-[#181822] border border-[#272733] hover:border-[#3E3E4E] transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#F5F3FF]">{s.name}</span>
                    {s.isComplete && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#71717A] font-mono-numbers">
                    {s.trackAName} vs {s.trackBName} • Score: {s.correctCount}/{s.completedTrialsCount} ({s.correctPercentage}%) • p = {s.pValue}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Delete session"
                    className="p-2 text-[#71717A] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <ArrowRight size={16} className="text-[#71717A]" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Session Configuration Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleStartNewSession}
            className="w-full max-w-lg p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
              <GitCompare size={18} className="text-[var(--accent-dynamic)]" />
              <span>Configure ABX Blind Test</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#A1A1AA] font-bold block mb-1">Select Track A:</label>
                <select
                  value={selectedTrackAId}
                  onChange={(e) => setSelectedTrackAId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-[#F5F3FF] focus:border-[var(--accent-dynamic)] outline-none"
                >
                  <option value="">-- Choose Track A --</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} - {t.artist} ({t.codec}, {t.bitrate ? `${Math.round(t.bitrate / 1000)}k` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] font-bold block mb-1">Select Track B:</label>
                <select
                  value={selectedTrackBId}
                  onChange={(e) => setSelectedTrackBId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-[#F5F3FF] focus:border-[var(--accent-dynamic)] outline-none"
                >
                  <option value="">-- Choose Track B --</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} - {t.artist} ({t.codec}, {t.bitrate ? `${Math.round(t.bitrate / 1000)}k` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] font-bold block mb-1">Number of Trials:</label>
                <select
                  value={totalTrialsInput}
                  onChange={(e) => setTotalTrialsInput(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-[#F5F3FF] focus:border-[var(--accent-dynamic)] outline-none font-mono-numbers"
                >
                  <option value={5}>5 Trials (Quick Test, p &lt; 0.05 requires 5/5)</option>
                  <option value={10}>10 Trials (Standard Audiophile, p &lt; 0.05 requires 9/10)</option>
                  <option value={16}>16 Trials (Rigorous Scientific Standard)</option>
                  <option value={20}>20 Trials (High Statistical Power)</option>
                </select>
              </div>

              <div>
                <label className="text-[#A1A1AA] font-bold block mb-1">Equipment / Listening Gear Notes (Optional):</label>
                <input
                  type="text"
                  value={gearNotesInput}
                  onChange={(e) => setGearNotesInput(e.target.value)}
                  placeholder="e.g. Sennheiser HD650, Topping DX3 Pro DAC"
                  className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#272733] text-[#F5F3FF] focus:border-[var(--accent-dynamic)] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#272733]">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] text-xs font-bold text-[#F5F3FF] shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
              >
                Begin Comparison
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
