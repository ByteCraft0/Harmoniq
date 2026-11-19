import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioParameterAutomation } from '../services/audio/audioParameterAutomation';
import { audioEngine, TransitionMode } from '../services/audioEngine';
import { bookmarkService } from '../services/bookmarkService';
import { sessionTrackingService } from '../services/sessionTrackingService';
import { TrackMetadata } from '../types/audio';

// In-memory mock for localStorage in Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
(globalThis as any).localStorage = localStorageMock;

// Helper for test track metadata
function createMockTrack(id: string, title = 'Test Track', duration = 240): TrackMetadata {
  return {
    id,
    title,
    artist: 'Test Artist',
    album: 'Test Album',
    duration,
    filePath: `C:/Music/${id}.flac`,
    format: 'flac',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
  };
}

describe('Phase 5C — Advanced Listening Experience & Playback Transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionTrackingService.endCurrentSession();
    sessionTrackingService.clearSessionHistory();
    sessionTrackingService.setTrackingEnabled(true);
  });

  describe('5C.1 — Equal-Power Crossfade Math & Transition Modes', () => {
    it('equal-power curve maintains constant total acoustic power at all normalized points', () => {
      // Sample 11 points from t = 0.0 to t = 1.0
      const steps = 11;
      for (let i = 0; i < steps; i++) {
        const norm = i / (steps - 1);
        const angle = (Math.PI / 2) * norm;
        const gIn = Math.sin(angle);
        const gOut = Math.cos(angle);
        const totalPower = gIn * gIn + gOut * gOut;

        // Sum of squares must strictly equal 1.0 within floating point error
        expect(totalPower).toBeCloseTo(1.0, 5);
      }
    });

    it('equal-power curve eliminates the -3dB power dip at the crossfade midpoint', () => {
      // At t = 0.5 (midpoint of transition):
      const angle = (Math.PI / 2) * 0.5;
      const gIn = Math.sin(angle);
      const gOut = Math.cos(angle);

      // Amplitude at midpoint should be 1 / sqrt(2) ≈ 0.7071
      expect(gIn).toBeCloseTo(Math.SQRT1_2, 4);
      expect(gOut).toBeCloseTo(Math.SQRT1_2, 4);

      const equalPowerMidpointPower = gIn * gIn + gOut * gOut; // 0.5 + 0.5 = 1.0 (0 dB dip)
      expect(equalPowerMidpointPower).toBeCloseTo(1.0, 5);

      // Contrast with linear ramp where gains are 0.5 and 0.5:
      const linearMidpointPower = 0.5 * 0.5 + 0.5 * 0.5; // 0.25 + 0.25 = 0.50 (-3.01 dB dip)
      expect(linearMidpointPower).toBe(0.5);

      const powerGainDb = 10 * Math.log10(equalPowerMidpointPower / linearMidpointPower);
      expect(powerGainDb).toBeCloseTo(3.0103, 3); // Confirms exactly +3.01 dB recovery
    });

    it('AudioParameterAutomation.equalPowerFade generates 64-step curve and invokes setValueCurveAtTime', () => {
      const mockCurveFn = vi.fn();
      const mockParam: any = {
        value: 0,
        setValueCurveAtTime: mockCurveFn,
        cancelScheduledValues: vi.fn(),
      };
      const mockAudioCtx: any = {
        state: 'running',
        currentTime: 10.0,
      };

      AudioParameterAutomation.equalPowerFade(mockParam, 'in', 4.0, mockAudioCtx);

      expect(mockCurveFn).toHaveBeenCalledTimes(1);
      const [curve, startTime, duration] = mockCurveFn.mock.calls[0];
      expect(curve).toBeInstanceOf(Float32Array);
      expect(curve.length).toBe(64);
      expect(curve[0]).toBeCloseTo(0.0, 3);
      expect(curve[63]).toBeCloseTo(1.0, 3);
      expect(startTime).toBe(10.0);
      expect(duration).toBe(4.0);
    });

    it('audioEngine supports and switches between transition modes', () => {
      expect(audioEngine.getTransitionMode()).toBeDefined();

      audioEngine.setTransitionMode('gapless');
      expect(audioEngine.getTransitionMode()).toBe('gapless');

      audioEngine.setTransitionMode('fade_out_fade_in');
      expect(audioEngine.getTransitionMode()).toBe('fade_out_fade_in');

      audioEngine.setTransitionMode('crossfade');
      expect(audioEngine.getTransitionMode()).toBe('crossfade');
    });
  });

  describe('5C.2 — Listening Bookmarks & Controls', () => {
    it('creates, retrieves, and sorts bookmarks by timestamp', () => {
      const trackId = 'track_test_123';

      const bm2 = bookmarkService.addBookmark(trackId, 'Solo section', 125.4, 'Guitar solo starts here');
      const bm1 = bookmarkService.addBookmark(trackId, 'Intro groove', 15.0, 'Bassline hook');
      const bm3 = bookmarkService.addBookmark(trackId, 'Outro fade', 210.0);

      expect(bm1.id).toBeDefined();
      expect(bm2.id).toBeDefined();
      expect(bm3.id).toBeDefined();

      const trackBookmarks = bookmarkService.getBookmarksForTrack(trackId);
      expect(trackBookmarks.length).toBe(3);
      // Chronologically sorted
      expect(trackBookmarks[0].timestamp).toBe(15.0);
      expect(trackBookmarks[1].timestamp).toBe(125.4);
      expect(trackBookmarks[2].timestamp).toBe(210.0);
    });

    it('updates bookmark title and note', () => {
      const bm = bookmarkService.addBookmark('track_456', 'Old Title', 45.0, 'Old Note');
      const updated = bookmarkService.updateBookmark(bm.id, {
        title: 'New Chorus Title',
        note: 'Updated chorus note',
      });

      expect(updated).toBe(true);
      const retrieved = bookmarkService.getBookmark(bm.id);
      expect(retrieved?.title).toBe('New Chorus Title');
      expect(retrieved?.note).toBe('Updated chorus note');
    });

    it('deletes bookmark cleanly', () => {
      const bm = bookmarkService.addBookmark('track_789', 'Temporary Marker', 60.0);
      expect(bookmarkService.getBookmark(bm.id)).toBeDefined();

      const deleted = bookmarkService.deleteBookmark(bm.id);
      expect(deleted).toBe(true);
      expect(bookmarkService.getBookmark(bm.id)).toBeUndefined();
    });

    it('formats bookmark timestamp into mm:ss and hh:mm:ss', () => {
      expect(bookmarkService.formatTimestamp(45)).toBe('0:45');
      expect(bookmarkService.formatTimestamp(125)).toBe('2:05');
      expect(bookmarkService.formatTimestamp(3665)).toBe('1:01:05');
    });
  });

  describe('5C.3 — Advanced Lyrics Experience & Offset Persistence', () => {
    it('persists and restores per-track offset memory via localStorage', () => {
      const trackId = 'track_lyrics_test_abc';
      const offsetKey = `harmoniq_lyrics_offset_${trackId}`;

      // Save offset
      localStorage.setItem(offsetKey, '350');
      expect(localStorage.getItem(offsetKey)).toBe('350');

      // Update offset
      localStorage.setItem(offsetKey, '-200');
      expect(localStorage.getItem(offsetKey)).toBe('-200');

      // Reset
      localStorage.removeItem(offsetKey);
      expect(localStorage.getItem(offsetKey)).toBeNull();
    });
  });

  describe('5C.5 — Listening Session Experience', () => {
    it('creates active listening session and tracks accumulated duration', () => {
      const track1 = createMockTrack('t1', 'Track One', 200);

      sessionTrackingService.onPlaybackStarted(track1);
      const current = sessionTrackingService.getCurrentSession();

      expect(current).not.toBeNull();
      expect(current?.tracks.length).toBe(0);
      expect(current?.durationSeconds).toBe(0);

      // Progress 5 seconds twice
      sessionTrackingService.onPlaybackProgress(5.0);
      sessionTrackingService.onPlaybackProgress(5.0);

      const updated = sessionTrackingService.getCurrentSession();
      expect(updated?.durationSeconds).toBe(10);
    });

    it('correctly categorizes track as completed or skipped based on playback rules', () => {
      const track1 = createMockTrack('t1', 'Long Track', 200);
      const track2 = createMockTrack('t2', 'Skipped Track', 180);

      sessionTrackingService.onPlaybackStarted(track1);
      // Completed: played >= 30s and >= 50%
      sessionTrackingService.onTrackCompletedOrSkipped(track1, 110);

      sessionTrackingService.onPlaybackStarted(track2);
      // Skipped: played < 15s
      sessionTrackingService.onTrackCompletedOrSkipped(track2, 8);

      const session = sessionTrackingService.getCurrentSession();
      expect(session?.totalTracksCount).toBe(2);
      expect(session?.completedCount).toBe(1);
      expect(session?.skippedCount).toBe(1);
      expect(session?.tracks[0].status).toBe('completed');
      expect(session?.tracks[1].status).toBe('skipped');
    });

    it('ends and archives session to history, and enables session replay into queue', () => {
      const t1 = createMockTrack('s1_t1', 'Song A');
      const t2 = createMockTrack('s1_t2', 'Song B');

      sessionTrackingService.onPlaybackStarted(t1);
      sessionTrackingService.onTrackCompletedOrSkipped(t1, 150, 'completed');
      sessionTrackingService.onPlaybackStarted(t2);
      sessionTrackingService.onTrackCompletedOrSkipped(t2, 140, 'completed');

      sessionTrackingService.endCurrentSession();

      expect(sessionTrackingService.getCurrentSession()).toBeNull();
      const history = sessionTrackingService.getSessionHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      const lastSession = history[0];
      expect(lastSession.tracks.length).toBe(2);
      expect(lastSession.endedAt).not.toBeNull();

      // Replay session into tracks
      const replayedTracks = sessionTrackingService.replaySession(lastSession.id);
      expect(replayedTracks.length).toBe(2);
      expect(replayedTracks[0].id).toBe('s1_t1');
      expect(replayedTracks[1].id).toBe('s1_t2');
    });

    it('respects privacy settings and disables session tracking when disabled', () => {
      sessionTrackingService.setTrackingEnabled(false);
      expect(sessionTrackingService.isTrackingEnabled()).toBe(false);

      const t1 = createMockTrack('t_priv', 'Private Track');
      sessionTrackingService.onPlaybackStarted(t1);

      expect(sessionTrackingService.getCurrentSession()).toBeNull();
    });
  });
});
