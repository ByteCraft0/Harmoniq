import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onlineMusicService } from '../services/onlineMusicService';
import { radioService, CURATED_RADIO_STATIONS } from '../services/radioService';
import { podcastService } from '../services/podcastService';
import { libraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';

describe('Batch 12: Online Music Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Online Music Search', () => {
    it('searches local library tracks matching title, artist, album, or genre', () => {
      const mockTracks: TrackMetadata[] = [
        {
          id: '1',
          filePath: '/m/1.mp3',
          fileName: '1.mp3',
          fileSize: 100,
          dateModified: 0,
          title: 'Stairway to Heaven',
          artist: 'Led Zeppelin',
          album: 'Led Zeppelin IV',
          genre: 'Hard Rock',
        },
        {
          id: '2',
          filePath: '/m/2.mp3',
          fileName: '2.mp3',
          fileSize: 100,
          dateModified: 0,
          title: 'Comfortably Numb',
          artist: 'Pink Floyd',
          album: 'The Wall',
          genre: 'Progressive Rock',
        },
      ];

      vi.spyOn(libraryService, 'getAllTracks').mockReturnValue(mockTracks);

      const res = onlineMusicService.searchLocal('Floyd');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Comfortably Numb');

      const rockRes = onlineMusicService.searchLocal('Rock');
      expect(rockRes.length).toBe(2);
    });
  });

  describe('Internet Radio Service', () => {
    it('lists curated stations and allows adding custom stations', () => {
      const initialCount = CURATED_RADIO_STATIONS.length;
      const all = radioService.getAllStations();
      expect(all.length).toBeGreaterThanOrEqual(initialCount);

      const custom = radioService.addCustomStation({
        name: 'Test Stream FM',
        streamUrl: 'https://test.stream/live.mp3',
        genre: 'Synthwave',
        country: 'Worldwide',
      });

      expect(custom.id).toBeDefined();
      expect(custom.isCustom).toBe(true);

      const updated = radioService.getAllStations();
      expect(updated.some((s) => s.id === custom.id)).toBe(true);

      // Clean up
      radioService.removeCustomStation(custom.id);
      expect(radioService.getAllStations().some((s) => s.id === custom.id)).toBe(false);
    });

    it('toggles favorite station status persistently', () => {
      const station = CURATED_RADIO_STATIONS[0];
      expect(station).toBeDefined();

      radioService.toggleFavorite(station.id);
      let found = radioService.getAllStations().find((s) => s.id === station.id);
      expect(found?.isFavorite).toBe(true);

      radioService.toggleFavorite(station.id);
      found = radioService.getAllStations().find((s) => s.id === station.id);
      expect(found?.isFavorite).toBe(false);
    });
  });

  describe('Podcast Service & RSS Parser', () => {
    it('parses valid podcast RSS feed XML accurately', () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <title>The Audio Experience</title>
            <itunes:author>Harmoniq Team</itunes:author>
            <description>A podcast about hi-fi audio and acoustics.</description>
            <item>
              <title>Episode 1: Pure Acoustics</title>
              <description>Deep dive into lossless digital sound reproduction.</description>
              <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
              <enclosure url="https://example.com/audio/ep1.mp3" type="audio/mpeg" length="45000000" />
              <itunes:duration>45:30</itunes:duration>
            </item>
          </channel>
        </rss>`;

      // Provide DOMParser mock if needed in node test environment
      if (typeof DOMParser === 'undefined') {
        // Handled if vitest running in jsdom or node
      }

      const feed = podcastService.parseFeedXml(mockXml, 'https://example.com/feed.xml');
      expect(feed.title).toBe('The Audio Experience');
      expect(feed.author).toBe('Harmoniq Team');
      expect(feed.episodes.length).toBe(1);
      expect(feed.episodes[0].title).toBe('Episode 1: Pure Acoustics');
      expect(feed.episodes[0].durationSeconds).toBe(45 * 60 + 30);
      expect(feed.episodes[0].audioUrl).toBe('https://example.com/audio/ep1.mp3');
    });

    it('toggles episode listened status', () => {
      const epId = 'test_ep_123';
      podcastService.toggleListened(epId);
      // Toggle should reflect in episode states
      const mockFeed = {
        id: 'feed_1',
        title: 'Feed',
        author: 'Author',
        description: 'Desc',
        feedUrl: 'http://test.xml',
        lastUpdated: 0,
        episodes: [
          {
            id: epId,
            podcastId: 'feed_1',
            title: 'Ep 1',
            description: '',
            publishedAt: '',
            durationSeconds: 100,
            audioUrl: 'http://test.mp3',
            isListened: false,
            resumePosition: 0,
          },
        ],
      };

      (podcastService as any).feeds = [mockFeed];
      const feeds = podcastService.getFeeds();
      expect(feeds[0].episodes[0].isListened).toBe(true);

      podcastService.toggleListened(epId);
      const updated = podcastService.getFeeds();
      expect(updated[0].episodes[0].isListened).toBe(false);
    });
  });
});
