import { describe, it, expect, beforeEach, vi } from 'vitest';
import { personalIntelligenceService } from '../services/audio/personalIntelligenceService';
import { soundRecommendationService } from '../services/audio/soundRecommendationService';
import { trackAudioIntelligenceService } from '../services/audio/trackAudioIntelligenceService';
import { deviceIntelligenceService } from '../services/audio/deviceIntelligenceService';
import { intelligentDiscoveryService } from '../services/audio/intelligentDiscoveryService';
import { historyService } from '../services/historyService';
import { libraryService } from '../services/libraryService';
import { detectContextIntent } from '../services/assistantContextService';
import { generateLocalAnswer } from '../services/assistantKnowledge';
import { TrackMetadata } from '../types/audio';
import { DSPSettings } from '../types/dsp';

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

function createMockTrack(
  id: string,
  title = 'Test Title',
  artist = 'Test Artist',
  genre = 'Rock',
  duration = 240
): TrackMetadata {
  return {
    id,
    title,
    artist,
    album: 'Test Album',
    genre,
    duration,
    filePath: `C:/Music/${id}.flac`,
    fileName: `${id}.flac`,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    hasArtwork: false,
    fileSize: 1048576,
    isLossless: true,
    dateAdded: Date.now(),
    dateModified: Date.now(),
  } as TrackMetadata;
}

describe('Phase 5D — Personalized Audio Intelligence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    personalIntelligenceService.setIntelligenceEnabled(true);
  });

  describe('5D.1 — Personal Listening Intelligence Service', () => {
    it('computes listening profile metrics from history telemetry', () => {
      const now = Date.now();
      const mockEntries = [
        {
          id: 'h1',
          trackId: 't1',
          title: 'Morning Sun',
          artist: 'Acoustic Band',
          album: 'Sunrise',
          genre: 'Acoustic',
          duration: 200,
          playbackDuration: 180,
          playedAt: now - 3600 * 1000, // 1 hour ago
          completionStatus: 'completed' as const,
        },
        {
          id: 'h2',
          trackId: 't2',
          title: 'Quick Skip',
          artist: 'Noisy Artist',
          album: 'Chaos',
          genre: 'Electronic',
          duration: 180,
          playbackDuration: 10,
          playedAt: now - 7200 * 1000, // 2 hours ago
          completionStatus: 'skipped' as const,
        },
      ];

      vi.spyOn(historyService, 'getHistory').mockReturnValue(mockEntries as any);

      const profile = personalIntelligenceService.getListeningProfile('7d');
      expect(profile.totalPlays).toBe(2);
      expect(profile.totalListeningSeconds).toBe(190);
      expect(profile.completedPlays).toBe(1);
      expect(profile.skippedPlays).toBe(1);
      expect(profile.completionRate).toBe(50);
      expect(profile.skipRate).toBe(50);
      expect(profile.topArtists.length).toBeGreaterThanOrEqual(1);
      expect(profile.topArtists[0].name).toBe('Acoustic Band');

      vi.restoreAllMocks();
    });

    it('returns empty profile when intelligence telemetry is disabled', () => {
      personalIntelligenceService.setIntelligenceEnabled(false);
      expect(personalIntelligenceService.isIntelligenceEnabled()).toBe(false);

      const profile = personalIntelligenceService.getListeningProfile('30d');
      expect(profile.totalPlays).toBe(0);
      expect(profile.totalListeningSeconds).toBe(0);
      expect(profile.topArtists.length).toBe(0);
    });
  });

  describe('5D.2 — Adaptive Sound Recommendations', () => {
    it('recommends Acoustic & Vocal Warmth for acoustic recordings', () => {
      const track = createMockTrack('t_folk', 'Folk Song', 'Folk Singer', 'Acoustic Folk');
      const rec = soundRecommendationService.getRecommendationForContext(track, 'Realtek Audio');

      expect(rec).not.toBeNull();
      expect(rec?.title).toContain('Acoustic');
      expect(rec?.category).toBe('genre');
      expect(rec?.confidence).toBeGreaterThan(0.8);
      expect(rec?.rationale).toContain('Acoustic');
    });

    it('recommends Dynamic Sub-Bass for Electronic/Hip-Hop recordings', () => {
      const track = createMockTrack('t_edm', 'Night Club', 'DJ Master', 'Electronic EDM');
      const rec = soundRecommendationService.getRecommendationForContext(track, 'Speakers');

      expect(rec).not.toBeNull();
      expect(rec?.title).toContain('Bass');
      expect(rec?.category).toBe('genre');
      expect(rec?.rationale).toContain('Electronic');
    });

    it('recommends Harman Target compensation when listening on headphones', () => {
      const track = createMockTrack('t_rock', 'Guitar Riff', 'Rock Band', 'Pop');
      const rec = soundRecommendationService.getRecommendationForContext(track, 'Sennheiser HD650 Headphones');

      expect(rec).not.toBeNull();
      expect(rec?.title).toContain('Harman');
      expect(rec?.category).toBe('device');
      expect(rec?.deviceContext).toContain('HD650');
    });

    it('supports non-destructive audition and revert of recommended profile', () => {
      const track = createMockTrack('t_test', 'Test Track', 'Artist', 'Classical');
      const rec = soundRecommendationService.getRecommendationForContext(track)!;
      expect(rec).not.toBeNull();

      const originalSettings: DSPSettings = {
        enabled: true,
        eqMode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        monoMix: false,
        channelMode: 'stereo',
        balance: 0,
        limiterEnabled: true,
        activePresetId: 'flat',
      };

      // Audition
      soundRecommendationService.auditionRecommendation(rec, originalSettings);
      expect(soundRecommendationService.getAuditioningId()).toBe(rec.id);

      // Revert
      const restored = soundRecommendationService.revertAudition();
      expect(restored).not.toBeNull();
      expect(restored?.preamp).toBe(0);
      expect(soundRecommendationService.getAuditioningId()).toBeNull();
    });
  });

  describe('5D.3 — Intelligent Per-Track Audio Optimization', () => {
    it('detects clipping risk when aggressive EQ boost exceeds digital ceiling', () => {
      const track = createMockTrack('t_hi', 'Loud Master', 'Artist', 'Pop');
      track.bitDepth = 16;
      (track as any).codec = 'MP3';

      const highBoostSettings: DSPSettings = {
        enabled: true,
        eqMode: 'graphic',
        bands: [6.0, 8.0, 4.0, 0, 0, 0, 0, 0, 0, 0], // +8dB bass boost
        parametricFilters: [],
        preamp: 2.0, // +2dB preamp
        bassBoost: 4.0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        monoMix: false,
        channelMode: 'stereo',
        balance: 0,
        limiterEnabled: true,
        activePresetId: 'custom',
      };

      const report = trackAudioIntelligenceService.analyzeTrack(track, highBoostSettings);
      expect(report.clippingRisk).toBe(true);
      expect(report.excessGainDb).toBeGreaterThan(0);
      // Recommends negative preamp to compensate
      expect(report.recommendedPreampDb).toBeLessThan(0);
      expect(report.reasoning).toContain('Clipping risk detected');
    });

    it('reports zero clipping risk under neutral reference settings', () => {
      const track = createMockTrack('t_clean', 'Audiophile Recording', 'Orchestra', 'Classical');
      track.bitDepth = 24;

      const neutralSettings: DSPSettings = {
        enabled: true,
        eqMode: 'graphic',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        parametricFilters: [],
        preamp: 0,
        bassBoost: 0,
        treble: 0,
        stereoWidth: 100,
        stereoWidthEnabled: false,
        monoMix: false,
        channelMode: 'stereo',
        balance: 0,
        limiterEnabled: true,
        activePresetId: 'flat',
      };

      const report = trackAudioIntelligenceService.analyzeTrack(track, neutralSettings);
      expect(report.clippingRisk).toBe(false);
      expect(report.excessGainDb).toBe(0);
      expect(report.reasoning).toContain('Optimal headroom');
    });
  });

  describe('5D.4 — Headphone & Audio Device Intelligence', () => {
    it('accurately classifies USB DACs, Bluetooth headphones, and wired headphones', () => {
      const dacReport = deviceIntelligenceService.classifyDevice({
        deviceId: 'dac_1',
        label: 'Focusrite Scarlett 2i2 USB DAC',
      });
      expect(dacReport.category).toBe('usb_dac');
      expect(dacReport.acousticCompensationTarget).toContain('Bit-Perfect');

      const btReport = deviceIntelligenceService.classifyDevice({
        deviceId: 'bt_1',
        label: 'Sony WH-1000XM4 Wireless Bluetooth',
      });
      expect(btReport.category).toBe('bluetooth_headphones');
      expect(btReport.acousticCompensationTarget).toContain('Harman Target');

      const wiredReport = deviceIntelligenceService.classifyDevice({
        deviceId: 'wired_1',
        label: 'Realtek High Definition Audio (Sennheiser HD650)',
      });
      expect(wiredReport.category).toBe('wired_headphones');
      expect(wiredReport.acousticCompensationTarget).toContain('Harman Over-Ear');

      const speakerReport = deviceIntelligenceService.classifyDevice({
        deviceId: 'spk_1',
        label: 'Yamaha HS7 Desktop Studio Monitors',
      });
      expect(speakerReport.category).toBe('desktop_speakers');
      expect(speakerReport.acousticCompensationTarget).toContain('Flat Nearfield');
    });

    it('emits event on device switch', () => {
      const switchListener = vi.fn();
      const unsub = deviceIntelligenceService.subscribeDeviceSwitch(switchListener);

      deviceIntelligenceService.onDeviceChanged({
        deviceId: 'dev_initial',
        label: 'Initial Speaker',
        groupId: '',
        isDefault: true,
      });

      deviceIntelligenceService.onDeviceChanged({
        deviceId: 'dev_headphones',
        label: 'AirPods Max Headphones',
        groupId: '',
        isDefault: false,
      });

      expect(switchListener).toHaveBeenCalledTimes(1);
      const [fromId, toId, report] = switchListener.mock.calls[0];
      expect(fromId).toBe('dev_initial');
      expect(toId).toBe('dev_headphones');
      expect(report.category).toBe('bluetooth_headphones');

      unsub();
    });
  });

  describe('5D.5 — Intelligent Music Discovery Service', () => {
    it('categorizes forgotten favorites that were played in the past but not in the last 30 days', () => {
      const t1 = createMockTrack('t_forgotten', 'Old Favorite', 'Beloved Band', 'Rock');
      t1.playCount = 10; // Heavily played

      const t2 = createMockTrack('t_active', 'Current Song', 'Current Band', 'Rock');
      t2.playCount = 5;

      vi.spyOn(libraryService, 'getAllTracks').mockReturnValue([t1, t2]);

      // t2 was played yesterday, t1 was NOT played in history
      const now = Date.now();
      vi.spyOn(historyService, 'getHistory').mockReturnValue([
        {
          id: 'h_recent',
          trackId: 't_active',
          title: 'Current Song',
          artist: 'Current Band',
          playedAt: now - 86400 * 1000,
          completionStatus: 'completed' as const,
        },
      ] as any);

      const discovery = intelligentDiscoveryService.generatePersonalizedDiscovery();
      expect(discovery.forgottenFavorites.length).toBe(1);
      expect(discovery.forgottenFavorites[0].track.id).toBe('t_forgotten');
      expect(discovery.forgottenFavorites[0].rationale).toContain('over 30 days');

      vi.restoreAllMocks();
    });
  });

  describe('5D.7 — Pulse Orb & AI Assistant Context Integration', () => {
    it('detects intelligence intents accurately', () => {
      expect(detectContextIntent('How much music did I listen to this week?')).toBe('listening_stats');
      expect(detectContextIntent('Show my listening stats and habits')).toBe('listening_stats');
      expect(detectContextIntent('Recommend a sound profile for this track')).toBe('sound_recommendation');
      expect(detectContextIntent('Optimize sound for my headphones')).toBe('sound_recommendation');
      expect(detectContextIntent('Show my forgotten favorites')).toBe('forgotten_favorites');
    });

    it('generates grounded answers with actions for listening stats and recommendations', () => {
      const statsAns = generateLocalAnswer('What are my listening stats?');
      expect(statsAns.content).toContain('Personal Listening Intelligence');
      expect(statsAns.actions.some((a) => a.target === 'stats')).toBe(true);

      const track = createMockTrack('t_ans', 'Acoustic Melody', 'Acoustic Band', 'Acoustic');
      const recAns = generateLocalAnswer('Recommend a sound profile', undefined, {
        currentTrack: track as any,
      } as any);

      expect(recAns.content).toContain('Adaptive Sound Recommendation');
      expect(recAns.actions.some((a) => a.target === 'equalizer')).toBe(true);
      expect(recAns.actions.some((a) => a.target === 'stats')).toBe(true);
    });
  });
});
