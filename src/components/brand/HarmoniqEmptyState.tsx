import React from 'react';

export type EmptyStateType =
  | 'empty_library'
  | 'empty_playlists'
  | 'empty_search'
  | 'empty_favorites'
  | 'empty_history'
  | 'empty_queue';

interface HarmoniqEmptyStateProps {
  type: EmptyStateType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const HarmoniqEmptyState: React.FC<HarmoniqEmptyStateProps> = ({
  type,
  title,
  description,
  action,
  className = '',
}) => {
  const renderArt = () => {
    switch (type) {
      case 'empty_library':
        // Acoustic Violin & Harmonic Waves Line Art
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-90">
            <defs>
              <linearGradient id="artGradViolin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#4C1D95" />
              </linearGradient>
            </defs>
            {/* Ambient concentric harmonic resonance rings */}
            <circle cx="60" cy="60" r="48" stroke="url(#artGradViolin)" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />
            <circle cx="60" cy="60" r="36" stroke="url(#artGradViolin)" strokeWidth="1" opacity="0.6" />
            {/* Violin Body Silhouette */}
            <path
              d="M 54 32 C 46 40, 44 48, 48 54 C 52 60, 48 64, 46 72 C 44 82, 52 90, 60 90 C 68 90, 76 82, 74 72 C 72 64, 68 60, 72 54 C 76 48, 74 40, 66 32 Z"
              stroke="url(#artGradViolin)"
              strokeWidth="1.75"
              fill="#100E17"
            />
            {/* Fingerboard & Scroll */}
            <rect x="58.5" y="16" width="3" height="34" rx="1.5" fill="url(#artGradViolin)" />
            <circle cx="60" cy="14" r="3" stroke="url(#artGradViolin)" strokeWidth="1.5" />
            {/* F-Holes */}
            <path d="M 52 56 Q 54 62, 52 68" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 68 56 Q 66 62, 68 68" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" />
            {/* Fine strings */}
            <line x1="59" y1="18" x2="59" y2="82" stroke="#E4E4E7" strokeWidth="0.5" opacity="0.7" />
            <line x1="61" y1="18" x2="61" y2="82" stroke="#E4E4E7" strokeWidth="0.5" opacity="0.7" />
          </svg>
        );

      case 'empty_playlists':
        // Vinyl Turntable & Stylus
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-90">
            <defs>
              <linearGradient id="artGradVinyl" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            {/* Outer vinyl disc */}
            <circle cx="56" cy="62" r="42" fill="#0C0A14" stroke="url(#artGradVinyl)" strokeWidth="1.5" />
            {/* Grooves */}
            <circle cx="56" cy="62" r="35" stroke="#2E244B" strokeWidth="1" />
            <circle cx="56" cy="62" r="28" stroke="#3D2F66" strokeWidth="1" />
            <circle cx="56" cy="62" r="21" stroke="#4C3A7E" strokeWidth="1" />
            {/* Center label */}
            <circle cx="56" cy="62" r="14" fill="url(#artGradVinyl)" />
            <circle cx="56" cy="62" r="3" fill="#09090B" />
            {/* Tonearm & Stylus */}
            <path d="M 94 22 L 80 50 L 64 56" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="94" cy="22" r="4" fill="#8B5CF6" />
          </svg>
        );

      case 'empty_search':
        // Ultrasonic Resonant Tuning Fork
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-90">
            <defs>
              <linearGradient id="artGradFork" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
            {/* Sonic dispersion waves */}
            <path d="M 28 32 A 40 40 0 0 1 92 32" stroke="url(#artGradFork)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <path d="M 36 40 A 28 28 0 0 1 84 40" stroke="url(#artGradFork)" strokeWidth="1" opacity="0.7" />
            {/* Tuning Fork Prongs & Stem */}
            <path
              d="M 50 28 L 50 58 C 50 66, 56 70, 60 70 C 64 70, 70 66, 70 58 L 70 28"
              stroke="url(#artGradFork)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <line x1="60" y1="70" x2="60" y2="96" stroke="url(#artGradFork)" strokeWidth="4" strokeLinecap="round" />
            <circle cx="60" cy="98" r="4" fill="#A78BFA" />
          </svg>
        );

      case 'empty_favorites':
        // Harmonic Heart Clef
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-90">
            <defs>
              <linearGradient id="artGradHeart" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="60%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            {/* Radiant harmonic halo */}
            <circle cx="60" cy="56" r="40" stroke="url(#artGradHeart)" strokeWidth="0.75" strokeDasharray="4 4" opacity="0.4" />
            {/* Heart-Shaped Treble Clef Interlock */}
            <path
              d="M 60 84 C 40 68, 32 54, 34 42 C 36 28, 50 26, 60 38 C 70 26, 84 28, 86 42 C 88 54, 80 68, 60 84 Z"
              stroke="url(#artGradHeart)"
              strokeWidth="2"
              fill="#100E17"
            />
            {/* Music note inside heart */}
            <circle cx="53" cy="58" r="4" fill="#FB7185" />
            <circle cx="67" cy="54" r="4" fill="#FB7185" />
            <line x1="57" y1="58" x2="57" y2="44" stroke="#FB7185" strokeWidth="1.5" />
            <line x1="71" y1="54" x2="71" y2="40" stroke="#FB7185" strokeWidth="1.5" />
            <path d="M 57 44 L 71 40" stroke="#FB7185" strokeWidth="2" />
          </svg>
        );

      case 'empty_history':
      default:
        // Musical Hourglass Metronome
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="opacity-90">
            <defs>
              <linearGradient id="artGradTime" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="44" stroke="url(#artGradTime)" strokeWidth="0.8" opacity="0.4" />
            {/* Hourglass Contour */}
            <path
              d="M 44 32 L 76 32 L 64 58 L 76 86 L 44 86 L 56 58 Z"
              stroke="url(#artGradTime)"
              strokeWidth="2"
              fill="#100E17"
              strokeLinejoin="round"
            />
            {/* Flowing melody nodes */}
            <circle cx="60" cy="46" r="2" fill="#A78BFA" />
            <circle cx="60" cy="58" r="2.5" fill="#FFFFFF" />
            <circle cx="60" cy="74" r="2" fill="#A78BFA" />
          </svg>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4 select-none ${className}`}>
      {/* Custom SVG Graphic */}
      <div className="p-4 rounded-3xl bg-[#14141B]/80 border border-white/5 shadow-2xl backdrop-blur-xl flex items-center justify-center">
        {renderArt()}
      </div>

      {/* Title & Description */}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-[#F5F3FF] tracking-tight">{title}</h3>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">{description}</p>
      </div>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent-dynamic)] hover:opacity-90 text-xs font-semibold text-white transition-all shadow-glow-sm hover:scale-105 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
