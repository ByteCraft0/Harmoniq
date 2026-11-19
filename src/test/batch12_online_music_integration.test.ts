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
      const mockTracks = [
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
      ] as unknown as TrackMetadata[];

      vi.spyOn(libraryService, 'getAllTracks').mockReturnValue(mockTracks);

      const res = onlineMusicService.searchLocal('Floyd');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Comfortably Numb');

      const rockRes = onlineMusicService.searchLocal('Rock');
      expect(rockRes.length).toBe(2);
    });

    it('searches online catalog via window.harmoniqApi IPC for Moonlight, Imagine, Coldplay', async () => {
      const mockOnlineResults = [
        {
          id: 'it_123',
          title: 'Moonlight Sonata',
          artist: 'Ludwig van Beethoven',
          album: 'Piano Classics',
          year: 2018,
          duration: 312,
          source: 'Open Music Catalog',
          streamUrl: 'https://example.com/preview.m4a',
          artworkUrl: 'https://example.com/art.jpg',
          license: 'Official 30s Audio Preview',
          format: 'AAC',
        },
        {
          id: 'it_456',
          title: 'Imagine',
          artist: 'John Lennon',
          album: 'Imagine',
          year: 1971,
          duration: 183,
          source: 'Open Music Catalog',
          streamUrl: 'https://example.com/imagine.m4a',
          artworkUrl: 'https://example.com/imagine.jpg',
          license: 'Official 30s Audio Preview',
          format: 'AAC',
        },
        {
          id: 'it_789',
          title: 'Yellow',
          artist: 'Coldplay',
          album: 'Parachutes',
          year: 2000,
          duration: 269,
          source: 'Open Music Catalog',
          streamUrl: 'https://example.com/yellow.m4a',
          artworkUrl: 'https://example.com/yellow.jpg',
          license: 'Official 30s Audio Preview',
          format: 'AAC',
        },
      ];

      (global as any).window = {
        harmoniqApi: {
          searchOnlineMusic: vi.fn().mockResolvedValue(mockOnlineResults),
        },
      };

      const results = await onlineMusicService.searchOnline('Moonlight');
      expect(results.length).toBe(3);
      expect(results[0].title).toBe('Moonlight Sonata');
      expect(results[1].artist).toBe('John Lennon');
      expect(results[2].artist).toBe('Coldplay');
      expect(window.harmoniqApi!.searchOnlineMusic).toHaveBeenCalledWith('Moonlight', 'all');
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

    it('handles stream resolution and provides retryCurrentStation', async () => {
      const station = CURATED_RADIO_STATIONS[1]; // SomaFM Drone Zone
      expect(station.id).toBe('soma_dronezone');

      (global as any).window = {
        harmoniqApi: {
          verifyRadioStream: vi.fn().mockResolvedValue({
            accessible: true,
            directStreamUrl: 'https://ice2.somafm.com/dronezone-128-mp3',
          }),
        },
      };

      await radioService.playStation(station);
      expect(radioService.getState().currentStation?.id).toBe(station.id);
      expect(window.harmoniqApi!.verifyRadioStream).toHaveBeenCalledWith(station.streamUrl);

      // Verify retryCurrentStation triggers playStation
      const playSpy = vi.spyOn(radioService, 'playStation');
      radioService.retryCurrentStation();
      expect(playSpy).toHaveBeenCalledWith(station);

      radioService.stop();
      expect(radioService.getState().currentStation).toBeNull();
    });
  });

  describe('Podcast Service & RSS / Atom Parser', () => {
    it('parses valid podcast RSS 2.0 feed XML accurately', () => {
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

      const feed = podcastService.parseFeedXml(mockXml, 'https://example.com/feed.xml');
      expect(feed.title).toBe('The Audio Experience');
      expect(feed.author).toBe('Harmoniq Team');
      expect(feed.episodes.length).toBe(1);
      expect(feed.episodes[0].title).toBe('Episode 1: Pure Acoustics');
      expect(feed.episodes[0].durationSeconds).toBe(45 * 60 + 30);
      expect(feed.episodes[0].audioUrl).toBe('https://example.com/audio/ep1.mp3');
    });

    it('parses Atom XML feeds accurately', () => {
      const atomXml = `<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Tech Talks Atom</title>
          <subtitle>Weekly engineering discussions</subtitle>
          <author><name>Tech Group</name></author>
          <entry>
            <title>Episode 100</title>
            <summary>Centennial special episode</summary>
            <published>2026-02-15T12:00:00Z</published>
            <link rel="enclosure" href="https://example.com/audio/ep100.mp3" type="audio/mpeg" length="25000000" />
          </entry>
        </feed>`;

      const feed = podcastService.parseFeedXml(atomXml, 'https://example.com/atom.xml');
      expect(feed.title).toBe('Tech Talks Atom');
      expect(feed.author).toBe('Tech Group');
      expect(feed.episodes.length).toBe(1);
      expect(feed.episodes[0].title).toBe('Episode 100');
      expect(feed.episodes[0].audioUrl).toBe('https://example.com/audio/ep100.mp3');
    });

    it('validates URLs before network fetching in fetchRawXml', async () => {
      await expect(podcastService.fetchRawXml('')).rejects.toThrow(
        'Please enter a valid podcast RSS or Atom feed URL.'
      );
      await expect(podcastService.fetchRawXml('not-a-valid-url')).rejects.toThrow(
        'Invalid URL format. Please include http:// or https://'
      );
    });

    it('previews and saves subscriptions adhering to the 10-step workflow', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Preview Podcast</title>
            <description>Testing preview workflow</description>
            <item>
              <title>Ep 1</title>
              <enclosure url="https://example.com/1.mp3" type="audio/mpeg" />
            </item>
          </channel>
        </rss>`;

      vi.spyOn(podcastService, 'fetchRawXml').mockResolvedValue(mockXml);

      const preview = await podcastService.previewFeed('https://example.com/rss.xml');
      expect(preview.title).toBe('Preview Podcast');
      expect(preview.episodes.length).toBe(1);

      // Confirm subscription
      const saved = podcastService.saveSubscription(preview);
      expect(saved.title).toBe('Preview Podcast');
      expect(podcastService.getFeeds().some((f) => f.title === 'Preview Podcast')).toBe(true);

      // Cleanup
      podcastService.unsubscribe(saved.id);
      expect(podcastService.getFeeds().some((f) => f.title === 'Preview Podcast')).toBe(false);
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
