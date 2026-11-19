import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Headphones,
  Sliders,
  Sparkles,
  Compass,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Volume2,
  ShieldCheck,
  Music,
  Disc,
  Radio,
  BarChart3,
  Waves,
} from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { useDSP } from '../../context/DSPContext';
import { libraryService } from '../../services/libraryService';

interface FirstRunOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstRunOnboardingModal: React.FC<FirstRunOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const { addMusicFolders, stats } = useLibrary();
  const { resetToFlat, applyPreset } = useDSP();
  const folders = libraryService.getFolders();

  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleComplete = () => {
    try {
      localStorage.setItem('harmoniq_onboarding_completed', 'true');
    } catch {}
    onClose();
  };

  const handleDismiss = () => {
    handleComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0D0D12] border border-[#272733] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-1/4 -z-10 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -z-10 w-96 h-96 rounded-full bg-fuchsia-600/10 blur-[120px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#1B1B24]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white shadow-glow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#F5F3FF]">Welcome to Harmoniq</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-dynamic)]/15 border border-[var(--accent-dynamic)] text-[var(--accent-dynamic)]">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-[#71717A]">Your audiophile listening sanctuary</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Counter */}
            <span className="text-xs font-semibold text-[#A1A1AA]">
              Step <span className="text-[var(--accent-dynamic)]">{currentStep}</span> of 3
            </span>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-xl hover:bg-[#1B1B24] text-[#71717A] hover:text-[#F5F3FF] transition-colors"
              title="Skip Tour (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1B1B24] h-1">
          <div
            className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>

        {/* Step Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          {/* STEP 1: Your Music, Your Library */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-page-enter">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-dynamic)]">
                  Step 1 • Music Collection
                </span>
                <h3 className="text-xl font-bold text-[#F5F3FF]">Your Music, Your Library</h3>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Harmoniq is local-first. We index your personal lossless audio collection directly from your Windows storage without uploading any files or metadata to the cloud.
                </p>
              </div>

              {/* Supported Audio Codecs Showcase */}
              <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#F5F3FF]">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Supported Audio Codecs
                  </span>
                  <span className="text-[11px] text-[#71717A]">Bit-Perfect Extraction</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { ext: 'FLAC', desc: 'Lossless Hi-Res', tag: 'Up to 24/192' },
                    { ext: 'ALAC', desc: 'Apple Lossless', tag: 'M4A' },
                    { ext: 'WAV', desc: 'Linear PCM', tag: 'Uncompressed' },
                    { ext: 'MP3', desc: 'MPEG Layer III', tag: 'VBR / 320k' },
                    { ext: 'M4A', desc: 'AAC Advanced', tag: 'Native' },
                    { ext: 'OGG', desc: 'Ogg Vorbis / Opus', tag: 'Container' },
                  ].map((codec) => (
                    <div
                      key={codec.ext}
                      className="p-2.5 rounded-xl bg-[#09090B] border border-[#272733] text-center space-y-1"
                    >
                      <span className="block font-bold text-xs text-[var(--accent-dynamic)]">{codec.ext}</span>
                      <span className="block text-[9px] text-[#71717A] leading-tight">{codec.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folder Selection Action Box */}
              <div className="p-5 rounded-2xl bg-[#14141B] border border-[#272733] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FolderPlus size={16} className="text-violet-400" />
                    <span className="text-xs font-bold text-[#F5F3FF]">Add Your Music Folders</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    {folders.length > 0
                      ? `${folders.length} folder${folders.length > 1 ? 's' : ''} currently monitored (${stats.totalTracks} tracks indexed)`
                      : 'Select the folders on your PC where your audio tracks are stored.'}
                  </p>
                </div>

                <button
                  onClick={addMusicFolders}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent-dynamic)] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <FolderPlus size={14} />
                  <span>Choose Music Folder</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#71717A] bg-[#14141B]/50 p-3 rounded-xl border border-[#272733]/50">
                <CheckCircle2 size={13} className="text-violet-400 shrink-0" />
                <span>
                  Automatic folder monitoring watches your music folders in real-time and indexes new downloads automatically.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Your Audio, Your Experience */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-page-enter">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-dynamic)]">
                  Step 2 • Studio DSP Engine
                </span>
                <h3 className="text-xl font-bold text-[#F5F3FF]">Your Audio, Your Experience</h3>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Tailor your playback to your headphones or speakers with professional digital signal processing, smooth parameter automations, and AutoEQ acoustic profiles.
                </p>
              </div>

              {/* DSP Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-2">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Sliders size={16} />
                    <span className="text-xs font-bold text-[#F5F3FF]">12-Band Parametric EQ</span>
                  </div>
                  <p className="text-[11px] text-[#71717A] leading-relaxed">
                    Interactive frequency response curve with drag-to-tune band control, Q adjustment, filter auditioning, and AutoEQ headphone profile import.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-2">
                  <div className="flex items-center gap-2 text-fuchsia-400">
                    <Headphones size={16} />
                    <span className="text-xs font-bold text-[#F5F3FF]">Bauer Crossfeed</span>
                  </div>
                  <p className="text-[11px] text-[#71717A] leading-relaxed">
                    Acoustically models stereo loudspeaker soundstage in headphones, reducing listening fatigue during extended sessions.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Waves size={16} />
                    <span className="text-xs font-bold text-[#F5F3FF]">Mid-Side Stereo Width</span>
                  </div>
                  <p className="text-[11px] text-[#71717A] leading-relaxed">
                    Full spatial control over center channel (vocals/bass) and side ambient width with clickless parameter transitions.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Volume2 size={16} />
                    <span className="text-xs font-bold text-[#F5F3FF]">Per-Device Audio Memory</span>
                  </div>
                  <p className="text-[11px] text-[#71717A] leading-relaxed">
                    Harmoniq automatically remembers distinct EQ curves, loudness settings, and volumes for every audio interface you plug in.
                  </p>
                </div>
              </div>

              {/* Quick Preset Selector */}
              <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] space-y-2.5">
                <span className="text-xs font-bold text-[#F5F3FF]">Choose an Initial Listening Profile</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'flat', label: 'Reference Flat', desc: 'Pure bit-perfect' },
                    { id: 'bass_boost', label: 'Bass Impact', desc: 'Warm low-end' },
                    { id: 'vocal', label: 'Vocal Presence', desc: 'Mid clarity' },
                    { id: 'treble_boost', label: 'Air & Sparkle', desc: 'Treble shimmer' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (p.id === 'flat') {
                          resetToFlat();
                        } else {
                          applyPreset(p.id);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-[#09090B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] text-left transition-all group"
                    >
                      <span className="block text-xs font-bold text-[#F5F3FF] group-hover:text-[var(--accent-dynamic)]">
                        {p.label}
                      </span>
                      <span className="block text-[10px] text-[#71717A]">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Discover Harmoniq */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-page-enter">
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-dynamic)]">
                  Step 3 • Intelligence & Discovery
                </span>
                <h3 className="text-xl font-bold text-[#F5F3FF]">Discover Harmoniq</h3>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Experience dynamic visualizers, AI conversational music discovery, and universal streaming integrations designed for true music lovers.
                </p>
              </div>

              {/* Key Capabilities */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400 shrink-0 mt-0.5">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F5F3FF]">Harmoniq Pulse Orb AI Companion</h4>
                    <p className="text-[11px] text-[#71717A] mt-1 leading-relaxed">
                      Click the floating Pulse Orb in the lower right corner to chat with your music assistant, ask for mood-based queues, generate intelligent playlists, and watch audio-reactive particle shaders pulse to your beat.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-fuchsia-600/15 border border-fuchsia-500/30 text-fuchsia-400 shrink-0 mt-0.5">
                    <Radio size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F5F3FF]">Universal Music, Podcasts & Global Radio</h4>
                    <p className="text-[11px] text-[#71717A] mt-1 leading-relaxed">
                      Stream from Jamendo Music, tune into 30,000+ live internet radio stations, and subscribe to podcast RSS feeds directly inside Harmoniq.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#14141B] border border-[#272733] flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F5F3FF]">Personal Listening Intelligence</h4>
                    <p className="text-[11px] text-[#71717A] mt-1 leading-relaxed">
                      Explore your Listening Dashboard and Calendar to visualize your musical journey, listening habits, favorite decades, and top artists over time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ready banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 via-purple-900/20 to-fuchsia-950/40 border border-violet-500/30 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#F5F3FF]">Ready to begin your listening session?</h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-0.5">Press spacebar anytime to play or pause.</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] font-mono text-[#DDD6FE]">
                  <span>Space</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[#1B1B24] bg-[#09090B]">
          <div>
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-bold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors"
              >
                Skip Tour
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent-dynamic)] text-white text-xs font-bold shadow-glow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-xs font-bold shadow-glow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Sparkles size={14} />
                <span>Get Started with Harmoniq</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
