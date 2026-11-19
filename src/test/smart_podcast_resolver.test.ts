import { describe, it, expect, beforeEach, vi } from 'vitest';
import { podcastResolver } from '../services/podcastResolver';
import { podcastService } from '../services/podcastService';
import { PodcastFeed } from '../types/online';

describe('Harmoniq – Smart Podcast URL Importer & Resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. URL Classification', () => {
    it('classifies direct RSS, XML and Atom feed URLs', () => {
      expect(podcastResolver.classifyUrl('https://feeds.npr.org/510289/podcast.xml')).toBe('direct_rss');
      expect(podcastResolver.classifyUrl('https://podcasts.files.bbci.co.uk/b006qykl.rss')).toBe('direct_rss');
      expect(podcastResolver.classifyUrl('https://feed.songexploder.net/songexploder')).toBe('direct_rss');
      expect(podcastResolver.classifyUrl('https://example.com/show/feed')).toBe('direct_rss');
      expect(podcastResolver.classifyUrl('https://example.com/podcast.atom')).toBe('direct_rss');
    });

    it('classifies Apple Podcasts URLs with various country and path formats', () => {
      expect(
        podcastResolver.classifyUrl('https://podcasts.apple.com/us/podcast/planet-money/id510289')
      ).toBe('apple_podcasts');
      expect(
        podcastResolver.classifyUrl('https://podcasts.apple.com/podcast/id1545953110')
      ).toBe('apple_podcasts');
      expect(
        podcastResolver.classifyUrl('https://itunes.apple.com/us/podcast/id510289')
      ).toBe('apple_podcasts');
    });

    it('classifies Spotify show URLs', () => {
      expect(
        podcastResolver.classifyUrl('https://open.spotify.com/show/6f0Xf87vK5...XYZ123')
      ).toBe('spotify_show');
      expect(
        podcastResolver.classifyUrl('https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk?si=123')
      ).toBe('spotify_show');
    });

    it('classifies generic podcast websites and search queries', () => {
      expect(podcastResolver.classifyUrl('https://atp.fm')).toBe('website');
      expect(podcastResolver.classifyUrl('https://relay.fm/cortex')).toBe('website');
      expect(podcastResolver.classifyUrl('www.dithering.fm')).toBe('website');
      expect(podcastResolver.classifyUrl('Huberman Lab')).toBe('search_query');
      expect(podcastResolver.classifyUrl('Planet Money Podcast')).toBe('search_query');
    });
  });

  describe('2. Direct Feed & Apple Podcasts Resolution', () => {
    it('resolves direct RSS feeds cleanly with metadata and sample episodes', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Synthesized Sound Podcast</title>
    <itunes:author>Harmoniq Audio Lab</itunes:author>
    <description>Deep dive into high fidelity acoustics and digital signal processing.</description>
    <itunes:image href="https://example.com/art.jpg" />
    <item>
      <title>Episode 1: The Magic of Equalizers</title>
      <pubDate>Mon, 18 Nov 2026 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep1.mp3" length="123456" type="audio/mpeg" />
      <itunes:duration>45:20</itunes:duration>
    </item>
  </channel>
</rss>`;

      // Mock harmoniqApi.resolvePodcastUrl
      (globalThis as any).window = {
        harmoniqApi: {
          resolvePodcastUrl: vi.fn().mockResolvedValue({
            success: true,
            resolvedFeedUrl: 'https://example.com/synthesized.xml',
            originalInput: 'https://example.com/synthesized.xml',
            urlType: 'direct_rss',
            title: 'Synthesized Sound Podcast',
            author: 'Harmoniq Audio Lab',
            description: 'Deep dive into high fidelity acoustics and digital signal processing.',
            artworkUrl: 'https://example.com/art.jpg',
            episodeCount: 1,
            latestEpisodeTitle: 'Episode 1: The Magic of Equalizers',
            latestEpisodeDate: '11/18/2026',
          }),
        },
      };

      const result = await podcastResolver.resolve('https://example.com/synthesized.xml');
      expect(result.success).toBe(true);
      expect(result.title).toBe('Synthesized Sound Podcast');
      expect(result.author).toBe('Harmoniq Audio Lab');
      expect(result.episodeCount).toBe(1);
      expect(result.resolvedFeedUrl).toBe('https://example.com/synthesized.xml');
    });

    it('resolves Apple Podcasts URLs to their canonical RSS feed', async () => {
      (globalThis as any).window = {
        harmoniqApi: {
          resolvePodcastUrl: vi.fn().mockResolvedValue({
            success: true,
            resolvedFeedUrl: 'https://feeds.npr.org/510289/podcast.xml',
            originalInput: 'https://podcasts.apple.com/us/podcast/planet-money/id510289',
            urlType: 'apple_podcasts',
            title: 'Planet Money',
            author: 'NPR',
            description: 'The economy explained.',
            artworkUrl: 'https://media.npr.org/art.jpg',
            episodeCount: 850,
          }),
        },
      };

      const result = await podcastResolver.resolve(
        'https://podcasts.apple.com/us/podcast/planet-money/id510289'
      );
      expect(result.success).toBe(true);
      expect(result.urlType).toBe('apple_podcasts');
      expect(result.resolvedFeedUrl).toBe('https://feeds.npr.org/510289/podcast.xml');
      expect(result.title).toBe('Planet Money');
    });
  });

  describe('3. Spotify & Exclusive Podcasts Handling', () => {
    it('handles Spotify exclusive podcasts with clear user guidance', async () => {
      (globalThis as any).window = {
        harmoniqApi: {
          resolvePodcastUrl: vi.fn().mockResolvedValue({
            success: false,
            urlType: 'spotify_show',
            isExclusive: true,
            originalInput: 'https://open.spotify.com/show/exclusive123',
            title: '',
            author: '',
            description: '',
            episodeCount: 0,
            error: 'This show appears to be a Spotify-exclusive or walled-garden podcast that does not provide an open RSS feed.',
          }),
        },
      };

      const result = await podcastResolver.resolve('https://open.spotify.com/show/exclusive123');
      expect(result.success).toBe(false);
      expect(result.isExclusive).toBe(true);
      expect(result.error).toContain('Spotify-exclusive');
    });
  });

  describe('4. Subscription & Duplicate Prevention', () => {
    it('saves a new resolved podcast subscription and prevents duplicates', () => {
      const sampleFeed: PodcastFeed = {
        id: 'pod_unique_test',
        title: 'Unique Audio Insights',
        author: 'Harmoniq Team',
        description: 'Test podcast for verification.',
        feedUrl: 'https://example.com/unique_feed.xml',
        artworkUrl: 'https://example.com/art.jpg',
        lastUpdated: Date.now(),
        episodes: [
          {
            id: 'ep_1',
            podcastId: 'https://example.com/unique_feed.xml',
            title: 'Episode 1',
            description: 'First episode',
            publishedAt: '2026-11-19',
            durationSeconds: 300,
            audioUrl: 'https://example.com/ep1.mp3',
            isListened: false,
            resumePosition: 0,
          },
        ],
      };

      const saved = podcastService.saveSubscription(sampleFeed);
      expect(saved.id).toBe(sampleFeed.id);

      const allFeeds = podcastService.getFeeds();
      const countBefore = allFeeds.filter((f) => f.feedUrl === sampleFeed.feedUrl).length;
      expect(countBefore).toBe(1);

      // Attempt duplicate subscription
      const duplicateAttempt = podcastService.saveSubscription(sampleFeed);
      expect(duplicateAttempt.id).toBe(sampleFeed.id);

      const countAfter = podcastService.getFeeds().filter((f) => f.feedUrl === sampleFeed.feedUrl).length;
      expect(countAfter).toBe(1); // No duplicates allowed
    });
  });

  describe('5. Error Handling', () => {
    it('rejects empty input cleanly', async () => {
      const res = await podcastResolver.resolve('   ');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Please enter');
    });
  });
});
