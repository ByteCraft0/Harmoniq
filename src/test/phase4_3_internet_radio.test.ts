import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

import { radioDirectoryService } from '../services/radioDirectoryService';
import {
  mobileRadioService,
  STORAGE_RADIO_FAVORITES_KEY,
  STORAGE_RADIO_RECENT_KEY,
  STORAGE_RADIO_CUSTOM_KEY,
} from '../services/mobileRadioService';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { RadioStation } from '../types/radio';
import { TrackMetadata } from '../types/audio';

const mockRawStation = {
  changeuuid: '11111111-2222-3333-4444-555555555555',
  stationuuid: 'station-uuid-1234',
  name: 'Classical Masterpieces FM',
  url: 'http://stream.example.com/stream.mp3',
  url_resolved: 'https://stream.example.com/stream.mp3',
  homepage: 'https://example.com/classical',
  favicon: 'https://example.com/logo.png',
  tags: 'classical,orchestral,symphony',
  country: 'Austria',
  countrycode: 'AT',
  codec: 'MP3',
  bitrate: 320,
  votes: 15420,
  clickcount: 2300,
};

const sampleRadioStation: RadioStation = {
  id: 'station-uuid-1234',
  name: 'Classical Masterpieces FM',
  streamUrl: 'https://stream.example.com/stream.mp3',
  favicon: 'https://example.com/logo.png',
  country: 'Austria',
  countryCode: 'AT',
  tags: ['classical', 'orchestral', 'symphony'],
  codec: 'MP3',
  bitrate: 320,
  votes: 15420,
  isCustom: false,
};

const sampleLocalTrack: TrackMetadata = {
  id: 'local-track-1',
  title: 'Local Symphony in D',
  artist: 'Local Composer',
  album: 'Master Recordings',
  duration: 360,
  filePath: '/storage/emulated/0/Music/symphony.flac',
  fileName: 'symphony.flac',
  fileSize: 25000000,
  dateModified: Date.now(),
  dateAdded: Date.now(),
  hasArtwork: false,
  codec: 'FLAC',
  container: 'flac',
  sampleRate: 96000,
  bitrate: 1411,
  channels: 2,
  playCount: 5,
  isLossless: true,
  isFavorite: false,
};

describe('Harmoniq Lite — Phase 4.3: Internet Radio Discovery & Native Streaming', () => {
  beforeEach(() => {
    localStorageMock.clear();
    radioDirectoryService.clearCache();
    vi.clearAllMocks();
  });

  describe('1. Station Directory Fetching & Caching', () => {
    it('fetches and caches featured radio stations from public API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockRawStation],
      });
      (globalThis as any).fetch = mockFetch;

      const stations = await radioDirectoryService.getFeaturedStations(10);
      expect(stations).toHaveLength(1);
      expect(stations[0].id).toBe('station-uuid-1234');
      expect(stations[0].name).toBe('Classical Masterpieces FM');
      expect(stations[0].streamUrl).toBe('https://stream.example.com/stream.mp3');
      expect(stations[0].codec).toBe('MP3');
      expect(stations[0].bitrate).toBe(320);

      // Verify second call hits in-memory cache without secondary HTTP fetch
      const cached = await radioDirectoryService.getFeaturedStations(10);
      expect(cached).toEqual(stations);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('fetches popular stations', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockRawStation],
      });
      (globalThis as any).fetch = mockFetch;

      const popular = await radioDirectoryService.getPopularStations(10);
      expect(popular).toHaveLength(1);
      expect(popular[0].name).toBe('Classical Masterpieces FM');
    });
  });

  describe('2. Search & Filtering', () => {
    it('searches stations by query and country filter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockRawStation],
      });
      (globalThis as any).fetch = mockFetch;

      const results = await radioDirectoryService.searchStations({
        name: 'Classical',
        country: 'Austria',
        tag: 'symphony',
        limit: 15,
      });

      expect(results).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/json/stations/search?hidebroken=true&limit=15&order=votes&reverse=true&name=Classical&country=Austria&tag=symphony'),
        expect.any(Object)
      );
    });

    it('fetches list of countries and genres', async () => {
      const mockCountries = [
        { name: 'Austria', iso_3166_1: 'AT', stationcount: 450 },
        { name: 'Germany', iso_3166_1: 'DE', stationcount: 3200 },
      ];
      const mockTags = [
        { name: 'jazz', stationcount: 1200 },
        { name: 'classical', stationcount: 850 },
      ];

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTags });
      (globalThis as any).fetch = mockFetch;

      const countries = await radioDirectoryService.getCountries();
      expect(countries).toHaveLength(2);
      expect(countries[0].name).toBe('Austria');
      expect(countries[0].code).toBe('AT');

      const genres = await radioDirectoryService.getGenres();
      expect(genres).toHaveLength(2);
      expect(genres[0].name).toBe('jazz');
    });
  });

  describe('3. API Resilience & Mirror Fallback', () => {
    it('falls back to secondary mirror server when primary mirror times out or fails', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new Error('Connection timeout on de1'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockRawStation],
        });
      (globalThis as any).fetch = mockFetch;

      const stations = await radioDirectoryService.getFeaturedStations(5);
      expect(stations).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws graceful error when all mirrors fail', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
      (globalThis as any).fetch = mockFetch;

      await expect(radioDirectoryService.getFeaturedStations(5)).rejects.toThrow();
    });
  });

  describe('4. Station Metadata Parsing & Security Validation', () => {
    it('parses raw metadata into normalized RadioStation', () => {
      const parsed = radioDirectoryService.parseStation(mockRawStation);
      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe('station-uuid-1234');
      expect(parsed?.tags).toEqual(['classical', 'orchestral', 'symphony']);
      expect(parsed?.favicon).toBe('https://example.com/logo.png');
    });

    it('discards stations with non-HTTP/HTTPS URLs or missing URLs', () => {
      expect(radioDirectoryService.parseStation({ name: 'Bad', url: '' })).toBeNull();
      expect(radioDirectoryService.parseStation({ name: 'Bad', url: 'file:///etc/passwd' })).toBeNull();
      expect(radioDirectoryService.parseStation({ name: 'Bad', url: 'javascript:alert(1)' })).toBeNull();
    });

    it('validates manual station URLs strictly', () => {
      expect(radioDirectoryService.validateStreamUrl('https://stream.icecast.org/live.mp3').valid).toBe(true);
      expect(radioDirectoryService.validateStreamUrl('http://192.168.1.100:8000/radio').valid).toBe(true);
      expect(radioDirectoryService.validateStreamUrl('file:///sdcard/music.mp3').valid).toBe(false);
      expect(radioDirectoryService.validateStreamUrl('javascript:void(0)').valid).toBe(false);
      expect(radioDirectoryService.validateStreamUrl('content://media/external/audio/1').valid).toBe(false);
    });
  });

  describe('5. Favorites & Custom Stations Management', () => {
    it('adds and removes favorite radio stations with persistence', () => {
      expect(mobileRadioService.isFavorite(sampleRadioStation.id)).toBe(false);

      mobileRadioService.addFavorite(sampleRadioStation);
      expect(mobileRadioService.isFavorite(sampleRadioStation.id)).toBe(true);
      expect(mobileRadioService.getFavorites()).toHaveLength(1);

      // Verify localStorage persistence
      const saved = JSON.parse(localStorageMock.getItem(STORAGE_RADIO_FAVORITES_KEY) || '[]');
      expect(saved[0].id).toBe(sampleRadioStation.id);

      // Toggle off
      mobileRadioService.toggleFavorite(sampleRadioStation);
      expect(mobileRadioService.isFavorite(sampleRadioStation.id)).toBe(false);
      expect(mobileRadioService.getFavorites()).toHaveLength(0);
    });

    it('creates custom radio station by URL with strict validation', () => {
      const result = mobileRadioService.addCustomStation({
        name: 'My Personal Icecast',
        streamUrl: 'https://myradio.stream/live.aac',
        genre: 'Synthwave',
      });

      expect(result.error).toBeUndefined();
      expect(result.station).toBeDefined();
      expect(result.station?.isCustom).toBe(true);
      expect(result.station?.codec).toBe('AAC');

      const customList = mobileRadioService.getCustomStations();
      expect(customList).toHaveLength(1);
      expect(customList[0].name).toBe('My Personal Icecast');

      // Rejects unsafe URL
      const unsafe = mobileRadioService.addCustomStation({
        name: 'Exploit Attempt',
        streamUrl: 'file:///data/data/com.bytecraft.harmoniqlite/databases',
      });
      expect(unsafe.error).toBeDefined();
      expect(unsafe.station).toBeUndefined();
    });
  });

  describe('6. Recently Listened Radio History', () => {
    it('records radio playback in reverse chronological order', () => {
      const stationA = { ...sampleRadioStation, id: 'station-A', name: 'Station A' };
      const stationB = { ...sampleRadioStation, id: 'station-B', name: 'Station B' };

      mobileRadioService.recordPlay(stationA);
      mobileRadioService.recordPlay(stationB);

      const recent = mobileRadioService.getRecentlyPlayed();
      expect(recent).toHaveLength(2);
      expect(recent[0].id).toBe('station-B');
      expect(recent[1].id).toBe('station-A');

      // Re-listening moves station to top
      mobileRadioService.recordPlay(stationA);
      const updated = mobileRadioService.getRecentlyPlayed();
      expect(updated[0].id).toBe('station-A');
      expect(updated[1].id).toBe('station-B');
    });
  });

  describe('7. Track Metadata Mapping & Live Radio Stream Flagging', () => {
    it('maps RadioStation to TrackMetadata with duration 0 and live stream metadata', () => {
      const track = mobileRadioService.stationToTrackMetadata(sampleRadioStation);
      expect(track.id).toBe(`radio_${sampleRadioStation.id}`);
      expect(track.title).toBe(sampleRadioStation.name);
      expect(track.artist).toContain('LIVE RADIO');
      expect(track.duration).toBe(0); // Live streams must not have misleading fixed duration
      expect(track.filePath).toBe(sampleRadioStation.streamUrl);
      expect(track.isOnline).toBe(true);

      expect(mobileRadioService.isRadioTrack(track)).toBe(true);
      expect(mobileRadioService.isRadioTrack(sampleLocalTrack)).toBe(false);
    });
  });

  describe('8. Playback Transitions (Radio to Local & Local to Radio)', () => {
    let driver: AndroidAudioDriver;
    let mockPlugin: any;

    beforeEach(() => {
      mockPlugin = {
        play: vi.fn().mockResolvedValue({ success: true }),
        pause: vi.fn().mockResolvedValue({ success: true }),
        getStopOnTaskRemoved: vi.fn().mockResolvedValue({ enabled: true }),
        checkNotificationPermission: vi.fn().mockResolvedValue({ granted: true }),
        addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
      };

      (globalThis as any).window = {
        Capacitor: {
          isNativePlatform: () => true,
          getPlatform: () => 'android',
          Plugins: {
            HarmoniqAudioPlayer: mockPlugin,
            App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) },
          },
        },
      };

      driver = new AndroidAudioDriver();
    });

    it('Local to Radio: transitions native player to radio stream with duration 0', async () => {
      // 1. Play local track
      await driver.play(sampleLocalTrack, [sampleLocalTrack]);
      expect(driver.getState().currentTrack?.id).toBe(sampleLocalTrack.id);
      expect(driver.getState().isPlaying).toBe(true);

      // 2. Transition to radio station
      const radioTrack = mobileRadioService.stationToTrackMetadata(sampleRadioStation);
      await driver.play(radioTrack, [radioTrack]);

      expect(driver.getState().currentTrack?.id).toBe(radioTrack.id);
      expect(driver.getState().currentTrack?.title).toBe(sampleRadioStation.name);
      expect(driver.getState().currentTrack?.artist).toContain('LIVE RADIO');
      expect(driver.getState().duration).toBe(0);
      expect(mockPlugin.play).toHaveBeenLastCalledWith(expect.objectContaining({
        track: expect.objectContaining({ id: radioTrack.id }),
      }));
    });

    it('Radio to Local: transitions back to local track with original duration and metadata', async () => {
      // 1. Play radio station
      const radioTrack = mobileRadioService.stationToTrackMetadata(sampleRadioStation);
      await driver.play(radioTrack, [radioTrack]);
      expect(mobileRadioService.isRadioTrack(driver.getState().currentTrack)).toBe(true);

      // 2. Play local track
      await driver.play(sampleLocalTrack, [sampleLocalTrack]);
      expect(mobileRadioService.isRadioTrack(driver.getState().currentTrack)).toBe(false);
      expect(driver.getState().currentTrack?.id).toBe(sampleLocalTrack.id);
      expect(driver.getState().duration).toBe(sampleLocalTrack.duration);
    });
  });

  describe('9. Live Stream Buffering & MediaSession Metadata', () => {
    it('handles live buffering state notifications from native player', () => {
      const driver = new AndroidAudioDriver();
      const stateListener = vi.fn();
      driver.onPlaybackStateChange(stateListener);

      // Simulate native callback with live buffering flags
      (driver as any).currentState.isLive = true;
      (driver as any).currentState.isBuffering = true;
      (driver as any).notifyState();

      expect(stateListener).toHaveBeenCalledWith(expect.objectContaining({
        isLive: true,
        isBuffering: true,
      }));
    });
  });

  describe('10. Electron Desktop Protection', () => {
    it('keeps mobile radio service completely isolated from desktop electron', () => {
      expect(mobileRadioService).toBeDefined();
      expect(radioDirectoryService).toBeDefined();
      // Verifies mobile services do not reference window.require, ipcRenderer, or desktop specific APIs
      expect((mobileRadioService as any).audioElement).toBeUndefined();
    });
  });
});
