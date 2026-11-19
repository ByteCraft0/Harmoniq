import React from 'react';

export interface MusicalNavigationProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  className?: string;
}

/**
 * Signature Musical Back & Forward Navigation Controls
 * Back: Violin with left-oriented bow detail
 * Forward: Trumpet oriented to the right
 * Designed as a matching pair with glassmorphism hover glow and tactile click animations.
 */
export const MusicalNavigation: React.FC<MusicalNavigationProps> = ({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 p-1 rounded-xl bg-[#14141B]/70 border border-white/5 backdrop-blur-md shadow-inner ${className}`}
      role="navigation"
      aria-label="History navigation"
    >
      {/* 1. Back Navigation – Violin with left-oriented bow */}
      <button
        onClick={onGoBack}
        disabled={!canGoBack}
        type="button"
        title={canGoBack ? 'Go Back (Alt + Left)' : 'No previous page'}
        aria-label="Go Back"
        className={`relative group w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 outline-none select-none ${
          canGoBack
            ? 'text-[#C4B5FD] hover:text-[#F5F3FF] hover:bg-violet-600/20 active:scale-90 hover:shadow-[0_0_12px_rgba(167,139,250,0.35)] cursor-pointer'
            : 'text-[#52525B] opacity-35 cursor-not-allowed'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Left-Oriented Bow Detail */}
          <path
            d="M20 5 L4.5 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Bow Tip pointing leftwards */}
          <path
            d="M6 11.5 L3.2 13.5 L5.5 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Violin Body Silhouette with f-hole curves */}
          <path
            d="M11 6 C9 8, 8.5 9.5, 10 11 C8 12.5, 8.5 15.5, 12.5 17.5 C15.5 18, 17 15.5, 16 13 C17.5 11.5, 17 8.5, 13.5 7 Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Neck & Scroll */}
          <path
            d="M12.5 6.5 L15 2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle
            cx="15.8"
            cy="2"
            r="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          {/* Delicate f-holes */}
          <path
            d="M11 11.5 C10.6 12.3 11 13 10.7 13.7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M14 12.5 C13.6 13.3 14 14 13.7 14.7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>

        {/* Ambient violet glow pill on hover */}
        {canGoBack && (
          <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 pointer-events-none transition-opacity duration-200" />
        )}
      </button>

      {/* 2. Forward Navigation – Trumpet oriented to the right */}
      <button
        onClick={onGoForward}
        disabled={!canGoForward}
        type="button"
        title={canGoForward ? 'Go Forward (Alt + Right)' : 'No forward page'}
        aria-label="Go Forward"
        className={`relative group w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 outline-none select-none ${
          canGoForward
            ? 'text-[#C4B5FD] hover:text-[#F5F3FF] hover:bg-violet-600/20 active:scale-90 hover:shadow-[0_0_12px_rgba(167,139,250,0.35)] cursor-pointer'
            : 'text-[#52525B] opacity-35 cursor-not-allowed'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mouthpiece */}
          <path
            d="M2.5 10.5 H4.5 V13.5 H2.5 Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Leadpipe */}
          <line
            x1="4.5"
            y1="12"
            x2="9"
            y2="12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Valve block casing */}
          <rect
            x="9"
            y="8"
            width="6"
            height="8"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          {/* 3 Piston Valves & Buttons */}
          <line
            x1="10"
            y1="5.5"
            x2="10"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="10" cy="4.5" r="0.9" fill="currentColor" />
          <line
            x1="12"
            y1="5.5"
            x2="12"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="4.5" r="0.9" fill="currentColor" />
          <line
            x1="14"
            y1="5.5"
            x2="14"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="14" cy="4.5" r="0.9" fill="currentColor" />
          {/* Bell flare expanding rightwards */}
          <path
            d="M15 10.5 H17 Q19.5 10.5 21.5 8 V16 Q19.5 13.5 17 13.5 H15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Bell Rim */}
          <ellipse
            cx="21.5"
            cy="12"
            rx="0.8"
            ry="4"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          {/* Subtle Forward Projection Waves */}
          <path
            d="M23 10 Q24 12 23 14"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>

        {/* Ambient violet glow pill on hover */}
        {canGoForward && (
          <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 pointer-events-none transition-opacity duration-200" />
        )}
      </button>
    </div>
  );
};
