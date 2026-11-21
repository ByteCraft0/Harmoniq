import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DrumPlaybackControl } from '../components/audio/DrumPlaybackControl';
import { TrumpetTrackControl } from '../components/audio/TrumpetTrackControl';
import { BottomPlayer } from '../components/layout/BottomPlayer';

// Mock contexts for BottomPlayer testing
const mockPlayerState = {
  currentTrack: {
    id: 'track-test-inst',
    title: 'Clair de Lune',
    artist: 'Claude Debussy',
    album: 'Suite bergamasque',
    year: 1905,
    duration: 300,
    codec: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 2800,
    isFavorite: false,
  },
  isPlaying: false,
  currentTime: 100,
  duration: 300,
  volume: 0.75,
  isMuted: false,
  repeatMode: 'off' as const,
  isShuffle: false,
  playbackRate: 1.0,
  sleepTimer: {
    isActive: false,
    secondsRemaining: 0,
    totalSeconds: 0,
    mode: 'duration' as const,
    endAction: 'pause' as const,
    stopAfterCurrentTrack: false,
    stopAfterQueue: false,
    isFading: false,
  },
  abRepeat: {
    pointA: null,
    pointB: null,
    enabled: false,
  },
  setABRepeatPointA: vi.fn(),
  setABRepeatPointB: vi.fn(),
  toggleABRepeat: vi.fn(),
  clearABRepeat: vi.fn(),
  togglePlayPause: vi.fn(),
  seekTo: vi.fn(),
  nextTrack: vi.fn(),
  prevTrack: vi.fn(),
  setVolume: vi.fn(),
  toggleMute: vi.fn(),
  cycleRepeatMode: vi.fn(),
  toggleShuffle: vi.fn(),
  setPlaybackRate: vi.fn(),
  setSleepTimer: vi.fn(),
  extendSleepTimer: vi.fn(),
  cancelSleepTimer: vi.fn(),
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => mockPlayerState,
}));

vi.mock('../context/LibraryContext', () => ({
  useLibrary: () => ({
    activeView: 'now_playing',
    setActiveView: vi.fn(),
    toggleFavorite: vi.fn(),
  }),
}));

describe('HARMONIQ 2.0.1 — Creative Musical Playback Controls Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. DRUM PLAY/PAUSE CONTROL SPECIFICATION
  // ---------------------------------------------------------------------------
  describe('1. Drum Playback Control Architecture & Physics', () => {
    it('1. Drum renders play indicator and resting state when paused', () => {
      const handleClick = vi.fn();
      const html = renderToString(
        React.createElement(DrumPlaybackControl, {
          isPlaying: false,
          onClick: handleClick,
        })
      );

      // Play button accessibility attributes
      expect(html).toContain('aria-label="Play"');
      expect(html).toContain('title="Play"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).toContain('type="button"');

      // Drum components
      expect(html).toContain('drum-shell-grad');
      expect(html).toContain('drum-rim-grad');
      expect(html).toContain('drum-head-grad');
      expect(html).toContain('stick-wood-left');
      expect(html).toContain('stick-wood-right');

      // Play glyph triangle
      expect(html).toContain('points="-2.2,-3.8 4.2,0 -2.2,3.8"');

      // Animated classes must NOT be applied to elements when paused
      expect(html).not.toContain('class="drumhead-anim"');
      expect(html).not.toContain('class="drumstick-left-anim"');
      expect(html).not.toContain('class="drumstick-right-anim"');
      expect(html).not.toContain('class="drum-ripple-left"');
      expect(html).not.toContain('class="drum-ripple-right"');
    });

    it('2. Drum animation activates alternating drumstick strikes and acoustic ripples when playing', () => {
      const handleClick = vi.fn();
      const html = renderToString(
        React.createElement(DrumPlaybackControl, {
          isPlaying: true,
          onClick: handleClick,
        })
      );

      // Pause button accessibility attributes
      expect(html).toContain('aria-label="Pause"');
      expect(html).toContain('title="Pause"');
      expect(html).toContain('aria-pressed="true"');

      // Drum animations active on elements
      expect(html).toContain('class="drumstick-left-anim"');
      expect(html).toContain('class="drumstick-right-anim"');
      expect(html).toContain('class="drumhead-anim"');
      expect(html).toContain('class="drum-ripple-left"');
      expect(html).toContain('class="drum-ripple-right"');

      // Glowing acoustic aura
      expect(html).toContain('bg-violet-600/35 opacity-100 scale-110');

      // Pause indicator bars rendered on drumhead
      expect(html).toContain('height="7"');
    });

    it('3. Drum animation stops immediately and returns to resting position when paused', () => {
      const handleClick = vi.fn();
      // Render paused state
      const html = renderToString(
        React.createElement(DrumPlaybackControl, {
          isPlaying: false,
          onClick: handleClick,
        })
      );

      // Drumstick groups do not have animation classes
      expect(html).not.toContain('class="drumstick-left-anim"');
      expect(html).not.toContain('class="drumstick-right-anim"');
      expect(html).not.toContain('class="drumhead-anim"');
      expect(html).not.toContain('class="drum-ripple-left"');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. TRUMPET TRACK NAVIGATION CONTROLS SPECIFICATION
  // ---------------------------------------------------------------------------
  describe('2. Trumpet Track Navigation Controls Architecture', () => {
    it('4. Previous trumpet is facing left and carries Previous Track semantics', () => {
      const handleClick = vi.fn();
      const html = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'previous',
          onClick: handleClick,
        })
      );

      expect(html).toContain('aria-label="Previous Track"');
      expect(html).toContain('title="Previous Track"');
      expect(html).toContain('type="button"');

      // Flipped horizontally to face left towards previous track
      expect(html).toContain('scale-x-[-1]');

      // Metallic brass gradients and valves
      expect(html).toContain('id="trumpet-brass-previous"');
      expect(html).toContain('id="trumpet-bell-previous"');
      expect(html).toContain('id="trumpet-valve-previous"');
      expect(html).toContain('id="trumpet-bell-interior-previous"');
    });

    it('5. Next trumpet is facing right and carries Next Track semantics', () => {
      const handleClick = vi.fn();
      const html = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'next',
          onClick: handleClick,
        })
      );

      expect(html).toContain('aria-label="Next Track"');
      expect(html).toContain('title="Next Track"');
      expect(html).toContain('type="button"');

      // NOT flipped horizontally (points forward/right)
      expect(html).not.toContain('scale-x-[-1]');

      // Metallic brass gradients and valves
      expect(html).toContain('id="trumpet-brass-next"');
      expect(html).toContain('id="trumpet-bell-next"');
    });

    it('6. Both trumpets include realistic 3-valve details, tuning slide, and flare', () => {
      const html = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'next',
          onClick: vi.fn(),
        })
      );

      // Piston valve pearls and caps
      expect(html).toContain('ry="0.7"'); // Finger pearls
      // Leadpipe & tuning slide braces
      expect(html).toContain('x1="13.5" y1="10.4"');
      // Mouthpiece cup & rim
      expect(html).toContain('cx="4.5" cy="14"');
      // Inner bell depth
      expect(html).toContain('cx="38.5" cy="14"');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ACCESSIBILITY, FOCUS, AND REDUCED MOTION SPECIFICATION
  // ---------------------------------------------------------------------------
  describe('3. Performance & Accessibility Compliance', () => {
    it('7. Preserves keyboard focus indicators and standard button semantics', () => {
      const drumHtml = renderToString(
        React.createElement(DrumPlaybackControl, {
          isPlaying: false,
          onClick: vi.fn(),
        })
      );
      expect(drumHtml).toContain('focus-visible:ring-2 focus-visible:ring-violet-500');

      const trumpetHtml = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'next',
          onClick: vi.fn(),
        })
      );
      expect(trumpetHtml).toContain('focus-visible:ring-2 focus-visible:ring-violet-500');
    });

    it('8. Embeds prefers-reduced-motion media queries to disable animations for accessibility', () => {
      const drumHtml = renderToString(
        React.createElement(DrumPlaybackControl, {
          isPlaying: true,
          onClick: vi.fn(),
        })
      );
      expect(drumHtml).toContain('@media (prefers-reduced-motion: reduce)');
      expect(drumHtml).toContain('animation: none !important');

      const trumpetHtml = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'previous',
          onClick: vi.fn(),
        })
      );
      expect(trumpetHtml).toContain('@media (prefers-reduced-motion: reduce)');
      expect(trumpetHtml).toContain('animation: none !important');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. BOTTOM PLAYER INTEGRATION & FUNCTIONALITY PRESERVATION
  // ---------------------------------------------------------------------------
  describe('4. BottomPlayer Integration & Functional Integrity', () => {
    it('9. BottomPlayer seamlessly hosts Drum and Trumpet controls in centered layout', () => {
      const html = renderToString(
        React.createElement(BottomPlayer, {
          onToggleQueue: vi.fn(),
          isQueueOpen: false,
        })
      );

      // Transport controls container with centered alignment
      expect(html).toContain('flex flex-col items-center justify-center flex-1 min-w-0 max-w-lg mx-2 z-10');

      // Drum control integrated
      expect(html).toContain('drum-shell-grad');
      expect(html).toContain('aria-label="Play"');

      // Trumpet controls integrated
      expect(html).toContain('aria-label="Previous Track"');
      expect(html).toContain('aria-label="Next Track"');

      // Shuffle and Repeat buttons preserved
      expect(html).toContain('title="Shuffle: Off"');
      expect(html).toContain('title="Repeat: off"');

      // A-B repeat looper preserved
      expect(html).toContain('A-B Repeat Looper');

      // Scrubber and Volume controls preserved
      expect(html).toContain('cursor-pointer transition-all');
    });

    it('10. Disabled state is handled properly when track navigation is unavailable', () => {
      const html = renderToString(
        React.createElement(TrumpetTrackControl, {
          direction: 'previous',
          onClick: vi.fn(),
          disabled: true,
        })
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('opacity-35 cursor-not-allowed');
    });
  });
});
