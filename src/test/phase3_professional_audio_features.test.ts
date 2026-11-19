import { describe, it, expect, beforeEach } from 'vitest';
import { abxService, ABXService } from '../services/abxService';
import { waveformService, WaveformService } from '../services/waveformService';
import { audioRoutingService, DEFAULT_ROUTING_PROFILES } from '../services/audioRoutingService';
import { volumeProfileService } from '../services/volumeProfileService';
import { DEFAULT_VOLUME_PROFILES } from '../types/volumeProfile';
import { TrackMetadata } from '../types/audio';

// In-memory mock for localStorage and Audio in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (globalThis as any).localStorage = localStorageMock;
}

const mockTrackA: TrackMetadata = {
  id: 'track-flac-hi-res',
  filePath: '/music/symphony_24bit_96k.flac',
  fileName: 'symphony_24bit_96k.flac',
  fileSize: 45000000,
  dateModified: Date.now(),
  hasArtwork: false,
  title: 'Symphony No. 5 (Master A - 24/96 FLAC)',
  artist: 'Philharmonic Orchestra',
  album: 'Audiophile Masterworks',
  duration: 320,
  codec: 'FLAC',
  container: 'flac',
  bitrate: 4608000,
  sampleRate: 96000,
  bitDepth: 24,
  channels: 2,
  isLossless: true,
  playCount: 10,
  isFavorite: true,
  replayGain: {
    trackGain: -2.5,
    trackPeak: 0.95,
  },
};

const mockTrackB: TrackMetadata = {
  id: 'track-mp3-lossy',
  filePath: '/music/symphony_320k.mp3',
  fileName: 'symphony_320k.mp3',
  fileSize: 12000000,
  dateModified: Date.now(),
  hasArtwork: false,
  title: 'Symphony No. 5 (Master B - 320k MP3)',
  artist: 'Philharmonic Orchestra',
  album: 'Audiophile Masterworks',
  duration: 320,
  codec: 'MP3',
  container: 'mp3',
  bitrate: 320000,
  sampleRate: 44100,
  channels: 2,
  isLossless: false,
  playCount: 4,
  isFavorite: false,
  replayGain: {
    trackGain: -1.0,
    trackPeak: 0.98,
  },
};

describe('Harmoniq 2.0 – Phase 3: Professional Audio Features', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // --------------------------------------------------------------------------
  // FEATURE 1: ABX AUDIO COMPARISON
  // --------------------------------------------------------------------------
  describe('Feature 1: ABX Audio Comparison (abxService)', () => {
    it('accurately computes binomial combinations and one-tailed p-values', () => {
      expect(ABXService.combinations(10, 0)).toBe(1);
      expect(ABXService.combinations(10, 1)).toBe(10);
      expect(ABXService.combinations(10, 5)).toBe(252);
      expect(ABXService.combinations(10, 10)).toBe(1);

      // 10 out of 10 correct: p = 0.5^10 = 0.0009765625 (p < 0.001)
      const p10 = ABXService.computeBinomialPValue(10, 10);
      expect(p10).toBeLessThan(0.001);

      // 9 out of 10 correct: p = (1 + 10) * 0.5^10 = 0.01074 (p < 0.05, statistically significant)
      const p9 = ABXService.computeBinomialPValue(10, 9);
      expect(p9).toBeCloseTo(0.0107, 3);
      expect(p9).toBeLessThan(0.05);

      // 5 out of 10 correct: random chance guessing (p > 0.6)
      const p5 = ABXService.computeBinomialPValue(10, 5);
      expect(p5).toBeGreaterThan(0.5);
    });

    it('analyzes results with accurate statistical significance thresholds', () => {
      const sigResult = ABXService.analyzeResults(16, 13); // 13/16 = 81.25%, p = 0.0106
      expect(sigResult.isSignificant).toBe(true);
      expect(sigResult.pValue).toBeLessThan(0.05);
      expect(sigResult.percentage).toBe(81.3);

      const nonSigResult = ABXService.analyzeResults(10, 6); // 6/10 = 60%, p = 0.377
      expect(nonSigResult.isSignificant).toBe(false);
      expect(nonSigResult.pValue).toBeGreaterThan(0.05);
      expect(nonSigResult.interpretation).toContain('Not Statistically Significant');
    });

    it('creates an ABX session with randomized blind trials and auto-level matching', () => {
      const session = abxService.createSession(mockTrackA, mockTrackB, 10);
      expect(session.totalTrials).toBe(10);
      expect(session.trials.length).toBe(10);
      expect(session.currentTrialIndex).toBe(0);
      expect(session.isComplete).toBe(false);

      // Verify that secret assignments are genuine 'A' or 'B'
      for (const t of session.trials) {
        expect(['A', 'B']).toContain(t.secretAssignment);
        expect(t.userChoice).toBeNull();
      }

      // Verify auto-level match difference based on ReplayGain (-1.0 - (-2.5) = +1.5 dB trim on B)
      expect(session.isAutoLevelMatched).toBe(true);
      expect(session.levelTrimDbB).toBeCloseTo(1.5, 1);
    });

    it('advances trials, tracks user choices, and concludes session on final trial', () => {
      const session = abxService.createSession(mockTrackA, mockTrackB, 5);

      // Trial 1: Vote matching secret assignment
      const secret1 = session.trials[0].secretAssignment;
      abxService.submitChoice(secret1);
      expect(session.trials[0].userChoice).toBe(secret1);
      expect(session.trials[0].isCorrect).toBe(true);
      expect(session.correctCount).toBe(1);
      expect(session.currentTrialIndex).toBe(1);

      // Submit remaining 4 trials
      for (let i = 1; i < 5; i++) {
        const secret = session.trials[i].secretAssignment;
        abxService.submitChoice(secret);
      }

      expect(session.isComplete).toBe(true);
      expect(session.completedTrialsCount).toBe(5);
      expect(session.correctCount).toBe(5);
      expect(session.correctPercentage).toBe(100);
      expect(session.isStatisticallySignificant).toBe(true);
    });

    it('persists and retrieves past comparison sessions', () => {
      const s = abxService.createSession(mockTrackA, mockTrackB, 5, {
        name: 'FLAC vs MP3 Listening Test',
        audioGearNotes: 'Sennheiser HD650 + JDS Atom',
      });

      const list = abxService.getSessions();
      expect(list.length).toBeGreaterThanOrEqual(1);

      const found = list.find((item) => item.id === s.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('FLAC vs MP3 Listening Test');
      expect(found?.audioGearNotes).toBe('Sennheiser HD650 + JDS Atom');

      // Delete session
      abxService.deleteSession(s.id);
      expect(abxService.getSessions().find((item) => item.id === s.id)).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: WAVEFORM NAVIGATION
  // --------------------------------------------------------------------------
  describe('Feature 2: Waveform Navigation (waveformService)', () => {
    it('downsamples Float32 PCM audio data into normalized peak and RMS envelopes', () => {
      // Create synthetic audio channel data (1000 samples)
      const samples = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        samples[i] = Math.sin((i / 50) * Math.PI) * 0.8;
      }
      samples[500] = 1.0; // Peak sample

      const bucketCount = 50;
      const { peaks, rms } = waveformService.downsampleChannel(samples, bucketCount);

      expect(peaks.length).toBe(bucketCount);
      expect(rms.length).toBe(bucketCount);

      // Normalized to [0.06, 1.0]
      const maxPeak = Math.max(...peaks);
      expect(maxPeak).toBe(1.0);

      for (const p of peaks) {
        expect(p).toBeGreaterThanOrEqual(0.06);
        expect(p).toBeLessThanOrEqual(1.0);
      }
    });

    it('generates acoustic fallback contour for streams and remote files gracefully', () => {
      const fallback = waveformService.generateFallbackEnvelope(mockTrackA, 100);
      expect(fallback.trackId).toBe(mockTrackA.id);
      expect(fallback.peaks.length).toBe(100);
      expect(fallback.isEstimated).toBe(true);
      expect(fallback.duration).toBe(320);

      // Verify no NaN or non-finite values
      for (const p of fallback.peaks) {
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThan(0);
      }
    });

    it('caches waveform data in memory and storage to avoid redundant decodes', async () => {
      const wf = await waveformService.getWaveform(mockTrackA, 80);
      expect(wf).toBeDefined();
      expect(wf.peaks.length).toBe(80);

      // Subsequent call retrieves from cache
      const cached = waveformService.getCachedWaveform(mockTrackA.id);
      expect(cached).toBeDefined();
      expect(cached?.trackId).toBe(mockTrackA.id);
      expect(cached?.peaks.length).toBe(80);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: AUDIO ROUTING PROFILES & LISTENING ROOMS
  // --------------------------------------------------------------------------
  describe('Feature 3: Audio Routing Profiles & Listening Rooms (audioRoutingService)', () => {
    it('initializes with default routing profiles (Headphones, Speakers, DAC, etc.)', () => {
      const profiles = audioRoutingService.getProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(DEFAULT_ROUTING_PROFILES.length);

      const names = profiles.map((p) => p.name);
      expect(names).toContain('Headphones');
      expect(names).toContain('Speakers');
      expect(names).toContain('External DAC');
      expect(names).toContain('Bluetooth Audio');
      expect(names).toContain('Custom Output');
    });

    it('evaluates device connection states and detects disconnected endpoints', () => {
      const profile = audioRoutingService.getProfiles()[0];

      // Default endpoint is always connected
      const defaultState = audioRoutingService.getProfileConnectionState(profile);
      expect(['active', 'connected']).toContain(defaultState);

      // Profile pointing to nonexistent hardware ID
      const missingProfile = audioRoutingService.createProfile(
        'Missing USB DAC',
        'dac',
        'nonexistent_hardware_guid_123',
        'DAC 384kHz'
      );
      const missingState = audioRoutingService.getProfileConnectionState(missingProfile);
      expect(missingState).toBe('disconnected');
    });

    it('manages listening rooms and links routing profiles to rooms', async () => {
      const rooms = audioRoutingService.getRooms();
      expect(rooms.length).toBeGreaterThanOrEqual(4);

      const roomNames = rooms.map((r) => r.name);
      expect(roomNames).toContain('Living Room (Hi-Fi)');
      expect(roomNames).toContain('Studio Desk');
      expect(roomNames).toContain('Bedside / Late Night');
      expect(roomNames).toContain('Commute / Mobile');

      // Switch to Studio Desk room
      const studioRoom = rooms.find((r) => r.name === 'Studio Desk')!;
      await audioRoutingService.setActiveRoom(studioRoom.id);

      expect(audioRoutingService.getActiveRoom().id).toBe(studioRoom.id);
      expect(audioRoutingService.getActiveProfile().id).toBe(studioRoom.routingProfileId);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: ADVANCED VOLUME PROFILES
  // --------------------------------------------------------------------------
  describe('Feature 4: Advanced Volume Profiles (volumeProfileService)', () => {
    it('initializes with built-in volume profiles (Daytime, Late Night, Audiophile, Party)', () => {
      const profiles = volumeProfileService.getProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(DEFAULT_VOLUME_PROFILES.length);

      const names = profiles.map((p) => p.name);
      expect(names).toContain('Daytime / Standard');
      expect(names).toContain('Late Night / Quiet');
      expect(names).toContain('Audiophile Critical Listening');
      expect(names).toContain('Party / High Output');
    });

    it('switches volume profile and snapshots previous settings for restoration', async () => {
      // Initial activation
      const lateNightProfile = volumeProfileService.getProfiles().find((p) => p.name === 'Late Night / Quiet')!;
      await volumeProfileService.setActiveProfile(lateNightProfile.id);

      expect(volumeProfileService.getActiveProfile().id).toBe(lateNightProfile.id);
      expect(volumeProfileService.getActiveProfile().targetLufs).toBe(-23);
      expect(volumeProfileService.getActiveProfile().limiterMarginDb).toBe(-1.0);

      // Verify previous settings were captured
      const prev = volumeProfileService.getPreviousSettings();
      expect(prev).not.toBeNull();
      expect(typeof prev?.volume).toBe('number');

      // Restore previous settings
      const restored = volumeProfileService.restorePreviousSettings();
      expect(restored).toBe(true);
      expect(volumeProfileService.getPreviousSettings()).toBeNull();
    });

    it('creates, updates, and deletes custom volume profiles', () => {
      const custom = volumeProfileService.createProfile(
        'Acoustic Evening',
        'Warm mids with gentle dynamic compression',
        0.65,
        -1.5,
        'track',
        -16
      );

      expect(custom.name).toBe('Acoustic Evening');
      expect(custom.targetVolume).toBe(0.65);
      expect(custom.preampGainDb).toBe(-1.5);
      expect(custom.targetLufs).toBe(-16);

      // Update
      volumeProfileService.updateProfile(custom.id, {
        targetVolume: 0.7,
        preampGainDb: 0,
      });
      const updated = volumeProfileService.getProfile(custom.id);
      expect(updated?.targetVolume).toBe(0.7);
      expect(updated?.preampGainDb).toBe(0);

      // Delete custom profile
      const deleted = volumeProfileService.deleteProfile(custom.id);
      expect(deleted).toBe(true);
      expect(volumeProfileService.getProfile(custom.id)).toBeUndefined();
    });
  });
});
