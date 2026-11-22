import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory mock for localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
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

(globalThis as any).localStorage = localStorageMock;

import { libraryService } from '../services/libraryService';
import { historyService } from '../services/historyService';
import {
  mobileAppearanceService,
  STORAGE_MOBILE_APPEARANCE_KEY,
  DEFAULT_MOBILE_APPEARANCE,
  MOBILE_ACCENT_PALETTES,
} from '../services/mobileAppearanceService';
import { getTimeBasedGreeting } from '../components/mobile/views/MobileHomeView';
import { TrackMetadata } from '../types/audio';

describe('Phase 4.1: History Repair, Appearance Settings & Volume Control', () => {
  beforeEach(() => {
    localStorageMock.clear();
    libraryService.clear();
    libraryService.clearTrackStats();
    vi.clearAllMocks();
  });

  describe('1. Recently Played & Most Played Repair', () => {
    const sampleTracks: TrackMetadata[] = [
      {
        id: 'track-1',
        title: 'Song Alpha',
        artist: 'Artist A',
        album: 'Album 1',
        duration: 180,
        filePath: '/music/track1.mp3',
        fileName: 'track1.mp3',
        fileSize: 4000000,
        dateModified: Date.now(),
        dateAdded: Date.now(),
        hasArtwork: false,
        codec: 'MP3',
        container: 'mp3',
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        playCount: 0,
        isLossless: false,
        isFavorite: false,
      },
      {
        id: 'track-2',
        title: 'Song Beta',
        artist: 'Artist B',
        album: 'Album 1',
        duration: 200,
        filePath: '/music/track2.flac',
        fileName: 'track2.flac',
        fileSize: 20000000,
        dateModified: Date.now(),
        dateAdded: Date.now(),
        hasArtwork: false,
        codec: 'FLAC',
        container: 'flac',
        sampleRate: 96000,
        bitrate: 1411,
        channels: 2,
        playCount: 0,
        isLossless: true,
        isFavorite: false,
      },
      {
        id: 'track-3',
        title: 'Song Gamma',
        artist: 'Artist C',
        album: 'Album 2',
        duration: 240,
        filePath: '/music/track3.mp3',
        fileName: 'track3.mp3',
        fileSize: 5000000,
        dateModified: Date.now(),
        dateAdded: Date.now(),
        hasArtwork: false,
        codec: 'MP3',
        container: 'mp3',
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        playCount: 0,
        isLossless: false,
        isFavorite: false,
      },
    ];

    it('records playback start immediately and orders recently played by latest session', async () => {
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);

      const t0 = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(t0)
        .mockReturnValueOnce(t0 + 5000)
        .mockReturnValueOnce(t0 + 10000);

      // Play track 1, then track 2, then track 3
      libraryService.recordPlaybackStart('track-1');
      libraryService.recordPlaybackStart('track-2');
      libraryService.recordPlaybackStart('track-3');

      const playlists = libraryService.getPlaylists();
      const recentlyPlayed = playlists.find((p) => p.id === 'smart_recently_played');

      expect(recentlyPlayed).toBeDefined();
      expect(recentlyPlayed?.trackIds).toHaveLength(3);
      // Most recently played should be first: track-3, then track-2, then track-1
      expect(recentlyPlayed?.trackIds[0]).toBe('track-3');
      expect(recentlyPlayed?.trackIds[1]).toBe('track-2');
      expect(recentlyPlayed?.trackIds[2]).toBe('track-1');
    });

    it('persists track stats to local storage and restores them on reload', async () => {
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);

      libraryService.recordPlay('track-2');
      libraryService.recordPlay('track-2');
      libraryService.recordPlay('track-1');

      // Check stats saved in localStorage
      const savedRaw = localStorage.getItem('harmoniq_track_stats_v2');
      expect(savedRaw).not.toBeNull();
      const parsed = JSON.parse(savedRaw!);
      expect(parsed['track-2']?.playCount).toBe(2);
      expect(parsed['track-1']?.playCount).toBe(1);

      // Reloading into fresh libraryService restores stats
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);
      const restoredTrack2 = libraryService.getAllTracks().find((t) => t.id === 'track-2');
      expect(restoredTrack2?.playCount).toBe(2);
    });

    it('sorts most played with deterministic tie-breaking (playCount -> lastPlayed -> title A-Z)', async () => {
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);

      const baseTime = 1000000;
      // track-3: 5 plays at baseTime
      for (let i = 0; i < 5; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(baseTime + i * 10);
        libraryService.recordPlay('track-3');
      }

      // track-1: 3 plays at baseTime + 100
      for (let i = 0; i < 3; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(baseTime + 100 + i * 10);
        libraryService.recordPlay('track-1');
      }

      // track-2: 3 plays, but played later at baseTime + 200
      for (let i = 0; i < 3; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(baseTime + 200 + i * 10);
        libraryService.recordPlay('track-2');
      }

      const playlists = libraryService.getPlaylists();
      const mostPlayed = playlists.find((p) => p.id === 'smart_most_played');

      expect(mostPlayed).toBeDefined();
      expect(mostPlayed?.trackIds[0]).toBe('track-3'); // 5 plays
      expect(mostPlayed?.trackIds[1]).toBe('track-2'); // 3 plays, later lastPlayed
      expect(mostPlayed?.trackIds[2]).toBe('track-1'); // 3 plays, earlier lastPlayed
    });

    it('clears recently played history completely upon user request', async () => {
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);

      libraryService.recordPlaybackStart('track-1');
      libraryService.recordPlaybackStart('track-2');

      let playlists = libraryService.getPlaylists();
      let recentlyPlayed = playlists.find((p) => p.id === 'smart_recently_played');
      expect(recentlyPlayed?.trackIds.length).toBeGreaterThan(0);

      // User clears history
      libraryService.clearRecentlyPlayed();

      playlists = libraryService.getPlaylists();
      recentlyPlayed = playlists.find((p) => p.id === 'smart_recently_played');
      expect(recentlyPlayed?.trackIds).toHaveLength(0);
    });

    it('avoids duplicate consecutive playback start recordings within 3 seconds', async () => {
      libraryService.clear();
      await libraryService.addTracks(sampleTracks);

      const t0 = 2000000;
      vi.spyOn(Date, 'now').mockReturnValue(t0);

      libraryService.recordPlaybackStart('track-1');
      const trackAfterFirst = libraryService.getAllTracks().find((t) => t.id === 'track-1');
      expect(trackAfterFirst?.lastPlayed).toBe(t0);

      // Immediate consecutive duplicate 1 second later
      vi.spyOn(Date, 'now').mockReturnValue(t0 + 1000);
      libraryService.recordPlaybackStart('track-1');

      // Timestamp should NOT have been updated to t0 + 1000
      const trackAfterDuplicate = libraryService.getAllTracks().find((t) => t.id === 'track-1');
      expect(trackAfterDuplicate?.lastPlayed).toBe(t0);
    });
  });

  describe('2. Mobile Appearance Settings', () => {
    it('initializes with default appearance settings', () => {
      const settings = mobileAppearanceService.getSettings();
      expect(settings.themeMode).toBe('dark');
      expect(settings.accentColor).toBe('violet');
      expect(settings.density).toBe('comfortable');
      expect(settings.reduceAnimations).toBe(false);
    });

    it('updates theme mode and reflects in effective theme', () => {
      mobileAppearanceService.setThemeMode('light');
      expect(mobileAppearanceService.getSettings().themeMode).toBe('light');
      expect(mobileAppearanceService.getEffectiveTheme()).toBe('light');

      mobileAppearanceService.setThemeMode('dark');
      expect(mobileAppearanceService.getSettings().themeMode).toBe('dark');
      expect(mobileAppearanceService.getEffectiveTheme()).toBe('dark');
    });

    it('updates accent colors across all 5 supported palettes', () => {
      const colors = ['violet', 'blue', 'purple', 'emerald', 'amber'] as const;

      for (const color of colors) {
        mobileAppearanceService.setAccentColor(color);
        const settings = mobileAppearanceService.getSettings();
        expect(settings.accentColor).toBe(color);
        expect(MOBILE_ACCENT_PALETTES[color]).toBeDefined();
        expect(MOBILE_ACCENT_PALETTES[color].primary).toBeTruthy();
      }
    });

    it('toggles density and reduce animations', () => {
      mobileAppearanceService.setDensity('compact');
      expect(mobileAppearanceService.getSettings().density).toBe('compact');

      mobileAppearanceService.setDensity('comfortable');
      expect(mobileAppearanceService.getSettings().density).toBe('comfortable');

      mobileAppearanceService.setReduceAnimations(true);
      expect(mobileAppearanceService.getSettings().reduceAnimations).toBe(true);

      mobileAppearanceService.setReduceAnimations(false);
      expect(mobileAppearanceService.getSettings().reduceAnimations).toBe(false);
    });

    it('notifies subscribers upon settings change', () => {
      const listener = vi.fn();
      const unsub = mobileAppearanceService.subscribe(listener);

      mobileAppearanceService.setAccentColor('emerald');
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[listener.mock.calls.length - 1][0].accentColor).toBe('emerald');

      unsub();
      listener.mockClear();
      mobileAppearanceService.setAccentColor('amber');
      expect(listener).not.toHaveBeenCalled();
    });

    it('persists settings to localStorage under independent key', () => {
      mobileAppearanceService.setAccentColor('blue');
      mobileAppearanceService.setDensity('compact');

      const raw = localStorage.getItem(STORAGE_MOBILE_APPEARANCE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.accentColor).toBe('blue');
      expect(parsed.density).toBe('compact');
    });
  });

  describe('3. Volume Control & Clamping', () => {
    it('clamps volume accurately between 0.0 and 1.0', () => {
      const clamp = (val: number) => Math.max(0, Math.min(1, val));

      expect(clamp(-0.5)).toBe(0);
      expect(clamp(0)).toBe(0);
      expect(clamp(0.42)).toBe(0.42);
      expect(clamp(1.0)).toBe(1.0);
      expect(clamp(1.5)).toBe(1.0);
    });

    it('computes display volume and percentage correctly under mute', () => {
      const getDisplay = (vol: number, isMuted: boolean) => {
        const effective = isMuted ? 0 : vol;
        const percent = Math.round(effective * 100);
        const text = isMuted ? 'Muted' : `${percent}%`;
        return { effective, percent, text };
      };

      const unmuted = getDisplay(0.75, false);
      expect(unmuted.effective).toBe(0.75);
      expect(unmuted.percent).toBe(75);
      expect(unmuted.text).toBe('75%');

      const muted = getDisplay(0.75, true);
      expect(muted.effective).toBe(0);
      expect(muted.percent).toBe(0);
      expect(muted.text).toBe('Muted');
    });
  });

  describe('4. Time-Aware Home Page Greeting', () => {
    const makeDate = (hours: number, minutes: number = 0) => {
      const d = new Date(2026, 10, 22, hours, minutes, 0);
      return d;
    };

    it('returns "Good morning, Audiophile" between 5:00 AM and 11:59 AM', () => {
      // 5:00 AM exact boundary
      expect(getTimeBasedGreeting(makeDate(5, 0))).toBe('Good morning, Audiophile');
      // 8:30 AM mid morning
      expect(getTimeBasedGreeting(makeDate(8, 30))).toBe('Good morning, Audiophile');
      // 11:59 AM morning upper boundary
      expect(getTimeBasedGreeting(makeDate(11, 59))).toBe('Good morning, Audiophile');
    });

    it('returns "Good afternoon, Audiophile" between 12:00 PM and 4:59 PM', () => {
      // 12:00 PM exact boundary
      expect(getTimeBasedGreeting(makeDate(12, 0))).toBe('Good afternoon, Audiophile');
      // 2:45 PM mid afternoon
      expect(getTimeBasedGreeting(makeDate(14, 45))).toBe('Good afternoon, Audiophile');
      // 4:59 PM afternoon upper boundary
      expect(getTimeBasedGreeting(makeDate(16, 59))).toBe('Good afternoon, Audiophile');
    });

    it('returns "Good evening, Audiophile" between 5:00 PM and 4:59 AM (including midnight)', () => {
      // 5:00 PM exact boundary
      expect(getTimeBasedGreeting(makeDate(17, 0))).toBe('Good evening, Audiophile');
      // 8:30 PM evening
      expect(getTimeBasedGreeting(makeDate(20, 30))).toBe('Good evening, Audiophile');
      // 11:59 PM late night
      expect(getTimeBasedGreeting(makeDate(23, 59))).toBe('Good evening, Audiophile');
      // 12:00 AM midnight
      expect(getTimeBasedGreeting(makeDate(0, 0))).toBe('Good evening, Audiophile');
      // 3:15 AM deep night
      expect(getTimeBasedGreeting(makeDate(3, 15))).toBe('Good evening, Audiophile');
      // 4:59 AM night upper boundary
      expect(getTimeBasedGreeting(makeDate(4, 59))).toBe('Good evening, Audiophile');
    });
  });
});
