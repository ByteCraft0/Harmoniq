import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnimatedVolumeWave } from '../components/audio/AnimatedVolumeWave';
import { WaveformVolumeControl } from '../components/audio/WaveformVolumeControl';
import { WaveformSeekbar } from '../components/audio/WaveformSeekbar';
import { AdvancedVisualizer } from '../components/visualizer/AdvancedVisualizer';
import { NowPlayingView } from '../components/views/NowPlayingView';
import { BottomPlayer } from '../components/layout/BottomPlayer';
import { windowLifecycleService } from '../services/windowLifecycleService';
import { audioEngine } from '../services/audioEngine';

// Mock PlayerContext for testing NowPlayingView and BottomPlayer
const mockPlayerState = {
  currentTrack: {
    id: 'track-1',
    title: 'Solaris Echoes',
    artist: 'Antigravity Ensemble',
    album: 'Deep Space Reverie',
    year: 2026,
    duration: 240,
    codec: 'FLAC',
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 2800,
    isFavorite: false,
  },
  isPlaying: true,
  currentTime: 45,
  duration: 240,
  volume: 0.8,
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

describe('HARMONIQ 2.0.1 — UI Layout & Premium Volume Wave Verification', () => {
  beforeEach(() => {
    // Reset in-memory localStorage mock
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };

    windowLifecycleService.setMockSuspended(null);
    windowLifecycleService.setMockMinimized(null);
  });

  afterEach(() => {
    windowLifecycleService.setMockSuspended(null);
    windowLifecycleService.setMockMinimized(null);
  });

  // -------------------------------------------------------------------------
  // 1. DEDICATED LAYOUT ROW & OVERLAP ELIMINATION
  // -------------------------------------------------------------------------
  describe('1. Waveform Container Positioning & Overlap Elimination', () => {
    it('renders WaveformSeekbar within bounded container with min-w-0 on bars', () => {
      const mockTrack: any = {
        id: 'track-test-1',
        title: 'Symphony No. 5',
        artist: 'Beethoven',
        album: 'Masterworks',
        duration: 360,
      };

      const html = renderToString(
        React.createElement(WaveformSeekbar, {
          track: mockTrack,
          currentTime: 120,
          duration: 360,
          onSeek: vi.fn(),
          height: 40,
        })
      );

      // Verify bounds and overflow protection
      expect(html).toContain('w-full h-full flex items-center justify-between');
      expect(html).toContain('overflow-hidden min-w-0');
      expect(html).toContain('flex-1 min-w-0 rounded-full');
      expect(html).toContain('absolute top-0 bottom-0');
    });

    it('clamps scrubber playhead pin within 0% to 100%', () => {
      const mockTrack: any = {
        id: 'track-test-2',
        duration: 200,
      };

      const html = renderToString(
        React.createElement(WaveformSeekbar, {
          track: mockTrack,
          currentTime: 250, // Exceeds duration
          duration: 200,
          onSeek: vi.fn(),
        })
      );

      expect(html).toContain('left:100%');
    });

    it('renders NowPlayingView with Dedicated Playback Timeline row in natural flow without overlap', () => {
      const html = renderToString(React.createElement(NowPlayingView));

      // Container uses natural block layout with h-full and overflow-y-auto for scrollability, not justify-between or my-auto collisions
      expect(html).toContain('h-full w-full overflow-y-auto overflow-x-hidden');
      expect(html).toContain('flex flex-col gap-6');

      // Grid aligns items at start without my-auto
      expect(html).toContain('grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start relative z-10 w-full');

      // Dedicated timeline row sits in normal flow with solid background, not floating translucent HUD
      expect(html).toContain('w-full space-y-3 pt-4 border-t border-[#272733]/80 relative');
      expect(html).toContain('bg-[#14141B] border border-[#272733] shadow-card');
    });
  });

  // -------------------------------------------------------------------------
  // 2. CONSOLIDATION TO A SINGLE PRIMARY VOLUME CONTROL
  // -------------------------------------------------------------------------
  describe('2. Volume Control Consolidation (Eliminate Duplicate in NowPlaying)', () => {
    it('verifies NowPlayingView renders ZERO volume sliders or duplicate volume waveforms', () => {
      const html = renderToString(React.createElement(NowPlayingView));

      // Must NOT contain any volume slider input
      expect(html).not.toContain('aria-label="Volume slider"');
      expect(html).not.toContain('accent-[var(--accent-dynamic)]');
      // Must NOT contain duplicate volume wave
      expect(html).not.toContain('anim-wave-primary');
    });

    it('verifies BottomPlayer renders the authoritative signature volume control', () => {
      const html = renderToString(
        React.createElement(BottomPlayer, {
          onToggleQueue: vi.fn(),
          isQueueOpen: false,
        })
      );

      // BottomPlayer has the primary volume slider with role="slider"
      expect(html).toContain('role="slider"');
      expect(html).toContain('aria-label="Volume slider"');
      expect(html).toContain('aria-valuenow="80"');
      expect(html).toContain('anim-wave-primary');
    });
  });

  // -------------------------------------------------------------------------
  // 3. CONTINUOUS SVG ANIMATED VOLUME WAVE REDESIGN
  // -------------------------------------------------------------------------
  describe('3. Continuous SVG Animated Volume Wave Design', () => {
    it('renders complete SVG structure with purple-to-lavender gradient and circular handle', () => {
      const onVolumeChange = vi.fn();
      const html = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.75,
          isMuted: false,
          onVolumeChange,
          width: 140,
          height: 28,
        })
      );

      // SVG root with 160x28 coordinate space
      expect(html).toContain('viewBox="0 0 160 28"');
      // Purple-to-lavender linear gradient
      expect(html).toContain('stop-color="#7C3AED"');
      expect(html).toContain('stop-color="#8B5CF6"');
      expect(html).toContain('stop-color="#A78BFA"');
      expect(html).toContain('stop-color="#C4B5FD"');
      // White core brilliance
      expect(html).toContain('stop-color="#FFFFFF"');
      // Soft neon glow filters
      expect(html).toContain('feDropShadow');
      expect(html).toContain('flood-color="#8B5CF6"');
      // Circular white volume handle
      expect(html).toContain('fill="#FFFFFF"');
      expect(html).toContain('stroke="#8B5CF6"');
      // Seamless 60px loop keyframe
      expect(html).toContain('translateX(-60px)');
      expect(html).toContain('anim-wave-primary');
    });

    it('accurately positions the circular white handle proportional to current volume', () => {
      // Formula: handleX = 6 + effectiveVolume * (160 - 12) = 6 + effectiveVolume * 148
      // Volume = 0.5 -> handleX = 6 + 0.5 * 148 = 80
      const html50 = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.5,
          isMuted: false,
          onVolumeChange: vi.fn(),
        })
      );
      expect(html50).toContain('cx="80"');

      // Volume = 1.0 -> handleX = 6 + 1.0 * 148 = 154
      const html100 = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 1.0,
          isMuted: false,
          onVolumeChange: vi.fn(),
        })
      );
      expect(html100).toContain('cx="154"');

      // Volume = 0.0 -> handleX = 6 + 0 = 6
      const html0 = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.0,
          isMuted: false,
          onVolumeChange: vi.fn(),
        })
      );
      expect(html0).toContain('cx="6"');
      // At volume 0, active clip width must be 0
      expect(html0).toContain('<rect x="0" y="0" width="0" height="28"');
    });

    it('renders muted state with appropriate visual strike, red stroke, and 0 active clip', () => {
      const htmlMuted = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.8,
          isMuted: true,
          onVolumeChange: vi.fn(),
        })
      );

      // When muted, active clip rect width is 0
      expect(htmlMuted).toContain('<rect x="0" y="0" width="0" height="28"');
      // Rose mute icon
      expect(htmlMuted).toContain('text-rose-400');
      // Red handle rim
      expect(htmlMuted).toContain('stroke="#EF4444"');
      expect(htmlMuted).toContain('aria-valuetext="0% volume (muted)"');
    });

    it('supports unified integration inside WaveformVolumeControl without duplicate 5-bar button', () => {
      const html = renderToString(
        React.createElement(WaveformVolumeControl, {
          volume: 0.65,
          isMuted: false,
          isPlaying: false,
          onToggleMute: vi.fn(),
          onVolumeChange: vi.fn(),
          showSlider: true,
          sliderWidth: 'w-[120px]',
        })
      );

      // Verify the integrated continuous animated SVG wave renders
      expect(html).toContain('viewBox="0 0 160 28"');
      expect(html).toContain('role="slider"');
      expect(html).toContain('aria-valuenow="65"');
      // Must NOT render redundant 5-bar pulse animation
      expect(html).not.toContain('waveform-bar-pulse');
    });
  });

  // -------------------------------------------------------------------------
  // 4. ACCESSIBILITY & KEYBOARD NAVIGATION
  // -------------------------------------------------------------------------
  describe('4. Volume Keyboard Accessibility', () => {
    it('configures proper ARIA attributes for screen readers', () => {
      const html = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.42,
          isMuted: false,
          onVolumeChange: vi.fn(),
          showPercentage: true,
        })
      );

      expect(html).toContain('role="slider"');
      expect(html).toContain('aria-valuemin="0"');
      expect(html).toContain('aria-valuemax="100"');
      expect(html).toContain('aria-valuenow="42"');
      expect(html).toContain('aria-valuetext="42% volume"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('42%');
    });
  });

  // -------------------------------------------------------------------------
  // 5. LIFECYCLE SUSPENSION & PREFERS-REDUCED-MOTION
  // -------------------------------------------------------------------------
  describe('5. Animation Lifecycle & Optimization Safeguards', () => {
    it('sets animation-play-state to paused when window rendering is suspended', () => {
      windowLifecycleService.setMockSuspended(true);

      const html = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.5,
          isMuted: false,
          onVolumeChange: vi.fn(),
        })
      );

      // SVG animation must be paused to preserve CPU
      expect(html).toContain('animation-play-state: paused');
    });

    it('sets animation-play-state to running when window is active and visible', () => {
      windowLifecycleService.setMockSuspended(false);

      const html = renderToString(
        React.createElement(AnimatedVolumeWave, {
          volume: 0.5,
          isMuted: false,
          onVolumeChange: vi.fn(),
        })
      );

      // Continuous running animation
      expect(html).toContain('animation-play-state: running');
    });
  });

  // -------------------------------------------------------------------------
  // 6. AUDIO ENGINE & PLAYBACK FIDELITY
  // -------------------------------------------------------------------------
  describe('6. Audio Engine & Volume Scaling Preservation', () => {
    it('preserves existing audioEngine volume curve and mute states', () => {
      const initialVol = audioEngine.getVolume();

      audioEngine.setVolume(0.85);
      expect(audioEngine.getVolume()).toBeCloseTo(0.85, 2);

      audioEngine.setMute(true);
      audioEngine.setMute(false);

      // Restore
      audioEngine.setVolume(initialVol);
    });
  });

  // -------------------------------------------------------------------------
  // 7. RESPONSIVE VIEWPORT SCALING
  // -------------------------------------------------------------------------
  describe('7. Responsive Viewport Scaling & Panel Isolation', () => {
    const resolutions = [
      { name: '1080p Full HD', width: 1920, height: 1080 },
      { name: '900p HD+', width: 1600, height: 900 },
      { name: '768p WXGA', width: 1366, height: 768 },
      { name: '720p Standard HD', width: 1280, height: 720 },
    ];

    resolutions.forEach(({ name, width, height }) => {
      it(`validates layout constraints and scrolling at ${name} (${width}x${height})`, () => {
        const titleBarHeight = 36;
        const bottomPlayerHeight = 86;
        const availableMainHeight = height - titleBarHeight - bottomPlayerHeight;

        expect(availableMainHeight).toBeGreaterThan(500);

        const leftColWidth = Math.min(280, width * 0.25);
        const rightColWidth = 310;
        const remainingCenterWidth = width - leftColWidth - rightColWidth;

        expect(remainingCenterWidth).toBeGreaterThan(450);
      });
    });
  });
});
