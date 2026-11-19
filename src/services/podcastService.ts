import { PodcastFeed, PodcastEpisode } from '../types/online';

const STORAGE_PODCASTS = 'harmoniq_podcast_feeds_v2';
const STORAGE_EPISODE_STATE = 'harmoniq_podcast_episode_state_v2';

export const CURATED_PODCASTS: Partial<PodcastFeed>[] = [
  {
    id: 'npr_planet_money',
    title: 'Planet Money',
    author: 'NPR',
    description: 'The economy explained. Imagine you could call up a friend and say, "Meet me at the bar and tell me what\'s going on with the economy."',
    feedUrl: 'https://feeds.npr.org/510289/podcast.xml',
    artworkUrl: 'https://media.npr.org/assets/img/2022/10/24/pm_new_tile_2022_sq-e543deddd0a46a98be481b46e6a72efa6b52236f.jpg?s=1400&c=66&f=jpg',
  },
  {
    id: 'bbc_in_our_time',
    title: 'In Our Time',
    author: 'BBC Radio 4',
    description: 'Melvyn Bragg and guests discuss the history of ideas, philosophy, science, and the arts.',
    feedUrl: 'https://podcasts.files.bbci.co.uk/b006qykl.rss',
    artworkUrl: 'http://ichef.bbci.co.uk/images/ic/3000x3000/p0p8dsw0.jpg',
  },
  {
    id: 'song_exploder',
    title: 'Song Exploder',
    author: 'Hrishikesh Hirway',
    description: 'A podcast where musicians take apart their songs, and piece by piece, tell the story of how they were made.',
    feedUrl: 'https://feed.songexploder.net/songexploder',
    artworkUrl: 'https://f.prxu.org/song-exploder/images/3b97a9c5-fef1-4c84-8038-3c6efa808016/songexploder-logo-2025-with-title.jpg',
  },
];

interface EpisodeState {
  isListened: boolean;
  resumePosition: number;
}

export class PodcastService {
  private feeds: PodcastFeed[] = [];
  private episodeStates: Record<string, EpisodeState> = {};
  private listeners: Set<() => void> = new Set();

  // Active episode player
  private audio: HTMLAudioElement | null = null;
  private activeEpisode: PodcastEpisode | null = null;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;

  constructor() {
    this.loadPersisted();
    this.initAudio();
  }

  private loadPersisted(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawFeeds = localStorage.getItem(STORAGE_PODCASTS) || localStorage.getItem('harmoniq_podcast_feeds_v1');
        if (rawFeeds) {
          this.feeds = JSON.parse(rawFeeds);
        }
        const rawState = localStorage.getItem(STORAGE_EPISODE_STATE) || localStorage.getItem('harmoniq_podcast_episode_state_v1');
        if (rawState) {
          this.episodeStates = JSON.parse(rawState);
        }
      }
    } catch (e) {
      console.warn('Failed to load podcasts from localStorage:', e);
    }
  }

  private save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_PODCASTS, JSON.stringify(this.feeds));
        localStorage.setItem(STORAGE_EPISODE_STATE, JSON.stringify(this.episodeStates));
      }
    } catch (e) {
      console.warn('Failed to save podcasts to localStorage:', e);
    }
    this.notify();
  }

  private initAudio(): void {
    if (typeof Audio === 'undefined') return;
    this.audio = new Audio();

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.notify();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.notify();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio || !this.activeEpisode) return;
      this.currentTime = this.audio.currentTime;
      this.duration = this.audio.duration || 0;

      const epId = this.activeEpisode.id;
      if (!this.episodeStates[epId]) {
        this.episodeStates[epId] = { isListened: false, resumePosition: 0 };
      }
      this.episodeStates[epId].resumePosition = Math.round(this.currentTime);

      if (this.duration > 0 && this.currentTime >= this.duration * 0.9) {
        this.episodeStates[epId].isListened = true;
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.activeEpisode) {
        const epId = this.activeEpisode.id;
        if (!this.episodeStates[epId]) {
          this.episodeStates[epId] = { isListened: true, resumePosition: 0 };
        } else {
          this.episodeStates[epId].isListened = true;
          this.episodeStates[epId].resumePosition = 0;
        }
        this.save();
      }
      this.isPlaying = false;
      this.notify();
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  public getFeeds(): PodcastFeed[] {
    return this.feeds.map((f) => ({
      ...f,
      episodes: f.episodes.map((ep) => {
        const st = this.episodeStates[ep.id];
        return {
          ...ep,
          isListened: st?.isListened ?? ep.isListened ?? false,
          resumePosition: st?.resumePosition ?? ep.resumePosition ?? 0,
        };
      }),
    }));
  }

  public getPlaybackState(): {
    activeEpisode: PodcastEpisode | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  } {
    return {
      activeEpisode: this.activeEpisode,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }

  /**
   * Helper to fetch XML feed safely using IPC main process or fallback fetch
   */
  public async fetchRawXml(feedUrl: string): Promise<string> {
    const cleanUrl = feedUrl.trim();
    if (!cleanUrl) {
      throw new Error('Please enter a valid podcast RSS or Atom feed URL.');
    }

    try {
      new URL(cleanUrl);
    } catch {
      throw new Error('Invalid URL format. Please include http:// or https://');
    }

    // 1. Prefer Electron main-process IPC (bypasses CORS restrictions safely)
    if (typeof window !== 'undefined' && window.harmoniqApi?.fetchPodcastFeed) {
      const result = await window.harmoniqApi.fetchPodcastFeed(cleanUrl);
      if (!result?.xmlText) {
        throw new Error('Empty response received from podcast feed.');
      }
      return result.xmlText;
    }

    // 2. Direct fetch fallback (Node tests or standard environment)
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Harmoniq-Podcast-Engine/1.0.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });

    if (!res.ok) {
      throw new Error(`Feed server returned status HTTP ${res.status}`);
    }

    return await res.text();
  }

  /**
   * Parse RSS 2.0 or Atom XML feed text into PodcastFeed
   */
  public parseFeedXml(xmlText: string, feedUrl: string): PodcastFeed {
    const cleanText = xmlText.replace(/^\uFEFF/, '').trim();

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanText, 'application/xml');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        // Fall through to regex parser if DOMParser choked on XML entity
      } else {
        const channel = doc.querySelector('channel');
        const atomFeed = doc.querySelector('feed');

        if (channel) {
          // RSS 2.0
          const title = channel.querySelector('title')?.textContent?.trim() || 'Untitled Podcast';
          const author =
            channel.querySelector('author')?.textContent?.trim() ||
            channel.querySelector('itunes\\:author, author')?.textContent?.trim() ||
            'Unknown Author';
          const description =
            channel.querySelector('description')?.textContent?.trim() || '';
          const artworkUrl =
            channel.querySelector('itunes\\:image')?.getAttribute('href') ||
            channel.querySelector('image > url')?.textContent?.trim() ||
            undefined;

          const itemNodes = channel.querySelectorAll('item');
          const episodes: PodcastEpisode[] = [];

          itemNodes.forEach((item, index) => {
            const epTitle = item.querySelector('title')?.textContent?.trim() || `Episode ${index + 1}`;
            const epDesc =
              item.querySelector('description')?.textContent?.trim() ||
              item.querySelector('itunes\\:summary')?.textContent?.trim() ||
              '';
            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
            const enclosure = item.querySelector('enclosure');
            const audioUrl = enclosure?.getAttribute('url') || '';
            const lengthBytes = enclosure?.getAttribute('length');

            const rawDur = item.querySelector('itunes\\:duration')?.textContent?.trim() || '';
            let durationSec = 0;
            if (rawDur.includes(':')) {
              const parts = rawDur.split(':').map((p) => parseInt(p, 10));
              if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
            } else if (rawDur) {
              durationSec = parseInt(rawDur, 10) || 0;
            }

            if (audioUrl) {
              const epId = `ep_${feedUrl}_${index}_${item.querySelector('guid')?.textContent?.trim() || index}`;
              const st = this.episodeStates[epId];
              episodes.push({
                id: epId,
                podcastId: feedUrl,
                title: epTitle,
                description: epDesc.replace(/<[^>]*>?/gm, '').slice(0, 300),
                publishedAt: pubDate ? new Date(pubDate).toLocaleDateString() : '',
                durationSeconds: durationSec,
                audioUrl,
                isListened: st?.isListened || false,
                resumePosition: st?.resumePosition || 0,
                fileSizeBytes: lengthBytes ? parseInt(lengthBytes, 10) : undefined,
              });
            }
          });

          return {
            id: `pod_${encodeURIComponent(feedUrl)}`,
            title,
            author,
            description: description.replace(/<[^>]*>?/gm, '').slice(0, 300),
            feedUrl,
            artworkUrl,
            episodes,
            lastUpdated: Date.now(),
          };
        } else if (atomFeed) {
          // Atom Feed
          const title = atomFeed.querySelector('title')?.textContent?.trim() || 'Untitled Podcast';
          const author =
            atomFeed.querySelector('author > name')?.textContent?.trim() ||
            atomFeed.querySelector('author')?.textContent?.trim() ||
            'Unknown Author';
          const description =
            atomFeed.querySelector('subtitle')?.textContent?.trim() ||
            atomFeed.querySelector('summary')?.textContent?.trim() ||
            '';
          const artworkUrl =
            atomFeed.querySelector('logo')?.textContent?.trim() ||
            atomFeed.querySelector('icon')?.textContent?.trim() ||
            atomFeed.querySelector('itunes\\:image')?.getAttribute('href') ||
            undefined;

          const entries = atomFeed.querySelectorAll('entry');
          const episodes: PodcastEpisode[] = [];

          entries.forEach((entry, index) => {
            const epTitle = entry.querySelector('title')?.textContent?.trim() || `Entry ${index + 1}`;
            const epDesc =
              entry.querySelector('summary')?.textContent?.trim() ||
              entry.querySelector('content')?.textContent?.trim() ||
              '';
            const pubDate =
              entry.querySelector('published')?.textContent?.trim() ||
              entry.querySelector('updated')?.textContent?.trim() ||
              '';
            const linkEnclosure =
              entry.querySelector('link[rel="enclosure"]') ||
              entry.querySelector('link[type^="audio/"]');
            const audioUrl = linkEnclosure?.getAttribute('href') || '';
            const lengthBytes = linkEnclosure?.getAttribute('length');

            const rawDur = entry.querySelector('itunes\\:duration')?.textContent?.trim() || '';
            let durationSec = 0;
            if (rawDur.includes(':')) {
              const parts = rawDur.split(':').map((p) => parseInt(p, 10));
              if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
            } else if (rawDur) {
              durationSec = parseInt(rawDur, 10) || 0;
            }

            if (audioUrl) {
              const epId = `ep_${feedUrl}_${index}_${entry.querySelector('id')?.textContent?.trim() || index}`;
              const st = this.episodeStates[epId];
              episodes.push({
                id: epId,
                podcastId: feedUrl,
                title: epTitle,
                description: epDesc.replace(/<[^>]*>?/gm, '').slice(0, 300),
                publishedAt: pubDate ? new Date(pubDate).toLocaleDateString() : '',
                durationSeconds: durationSec,
                audioUrl,
                isListened: st?.isListened || false,
                resumePosition: st?.resumePosition || 0,
                fileSizeBytes: lengthBytes ? parseInt(lengthBytes, 10) : undefined,
              });
            }
          });

          return {
            id: `pod_${encodeURIComponent(feedUrl)}`,
            title,
            author,
            description: description.replace(/<[^>]*>?/gm, '').slice(0, 300),
            feedUrl,
            artworkUrl,
            episodes,
            lastUpdated: Date.now(),
          };
        }
      }
    }

    // Node / Headless Regex Parser (Supports both RSS 2.0 and Atom)
    const getTag = (xml: string, tag: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
    };

    const getAttr = (xml: string, tag: string, attr: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*?${attr}=["']([^"']+)["']`, 'i'));
      return m ? m[1] : '';
    };

    const channelMatch = cleanText.match(/<channel[\s\S]*?>([\s\S]*?)<\/channel>/i);
    const isAtom = !channelMatch && /<feed[\s\S]*?>/i.test(cleanText);

    if (channelMatch) {
      // RSS 2.0 Regex
      const channelXml = channelMatch[1];
      const title = getTag(channelXml, 'title') || 'Untitled Podcast';
      const author = getTag(channelXml, 'itunes:author') || getTag(channelXml, 'author') || 'Unknown Author';
      const description = getTag(channelXml, 'description') || '';
      const artworkUrl = getAttr(channelXml, 'itunes:image', 'href') || getTag(channelXml, 'url') || undefined;

      const episodes: PodcastEpisode[] = [];
      const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
      let itemMatch: RegExpExecArray | null;
      let index = 0;

      while ((itemMatch = itemRegex.exec(channelXml)) !== null) {
        const itemXml = itemMatch[1];
        const epTitle = getTag(itemXml, 'title') || `Episode ${index + 1}`;
        const epDesc = getTag(itemXml, 'description') || getTag(itemXml, 'itunes:summary') || '';
        const pubDate = getTag(itemXml, 'pubDate') || '';
        const audioUrl = getAttr(itemXml, 'enclosure', 'url') || '';
        const rawDur = getTag(itemXml, 'itunes:duration') || '';

        let durationSec = 0;
        if (rawDur.includes(':')) {
          const parts = rawDur.split(':').map((p) => parseInt(p, 10));
          if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        } else if (rawDur) {
          durationSec = parseInt(rawDur, 10) || 0;
        }

        if (audioUrl) {
          const epId = `ep_${feedUrl}_${index}_${getTag(itemXml, 'guid') || index}`;
          const st = this.episodeStates[epId];
          episodes.push({
            id: epId,
            podcastId: feedUrl,
            title: epTitle,
            description: epDesc.replace(/<[^>]*>?/gm, '').slice(0, 300),
            publishedAt: pubDate ? new Date(pubDate).toLocaleDateString() : '',
            durationSeconds: durationSec,
            audioUrl,
            isListened: st?.isListened || false,
            resumePosition: st?.resumePosition || 0,
          });
        }
        index++;
      }

      return {
        id: `pod_${encodeURIComponent(feedUrl)}`,
        title,
        author,
        description: description.replace(/<[^>]*>?/gm, '').slice(0, 300),
        feedUrl,
        artworkUrl,
        episodes,
        lastUpdated: Date.now(),
      };
    } else if (isAtom) {
      // Atom Regex
      const title = getTag(cleanText, 'title') || 'Untitled Podcast';
      const author = getTag(cleanText, 'name') || 'Unknown Author';
      const description = getTag(cleanText, 'subtitle') || getTag(cleanText, 'summary') || '';
      const artworkUrl = getTag(cleanText, 'logo') || getTag(cleanText, 'icon') || undefined;

      const episodes: PodcastEpisode[] = [];
      const entryRegex = /<entry[\s\S]*?>([\s\S]*?)<\/entry>/gi;
      let entryMatch: RegExpExecArray | null;
      let index = 0;

      while ((entryMatch = entryRegex.exec(cleanText)) !== null) {
        const entryXml = entryMatch[1];
        const epTitle = getTag(entryXml, 'title') || `Entry ${index + 1}`;
        const epDesc = getTag(entryXml, 'summary') || getTag(entryXml, 'content') || '';
        const pubDate = getTag(entryXml, 'published') || getTag(entryXml, 'updated') || '';
        const audioUrl = getAttr(entryXml, 'link', 'href') || '';
        const rawDur = getTag(entryXml, 'itunes:duration') || '';

        let durationSec = 0;
        if (rawDur.includes(':')) {
          const parts = rawDur.split(':').map((p) => parseInt(p, 10));
          if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        } else if (rawDur) {
          durationSec = parseInt(rawDur, 10) || 0;
        }

        if (audioUrl) {
          const epId = `ep_${feedUrl}_${index}_${getTag(entryXml, 'id') || index}`;
          const st = this.episodeStates[epId];
          episodes.push({
            id: epId,
            podcastId: feedUrl,
            title: epTitle,
            description: epDesc.replace(/<[^>]*>?/gm, '').slice(0, 300),
            publishedAt: pubDate ? new Date(pubDate).toLocaleDateString() : '',
            durationSeconds: durationSec,
            audioUrl,
            isListened: st?.isListened || false,
            resumePosition: st?.resumePosition || 0,
          });
        }
        index++;
      }

      return {
        id: `pod_${encodeURIComponent(feedUrl)}`,
        title,
        author,
        description: description.replace(/<[^>]*>?/gm, '').slice(0, 300),
        feedUrl,
        artworkUrl,
        episodes,
        lastUpdated: Date.now(),
      };
    }

    throw new Error('Invalid podcast feed format: expected RSS 2.0 or Atom XML feed.');
  }

  /**
   * Preview feed without saving (Workflow step 4-7)
   */
  public async previewFeed(feedUrl: string): Promise<PodcastFeed> {
    const xml = await this.fetchRawXml(feedUrl);
    return this.parseFeedXml(xml, feedUrl.trim());
  }

  /**
   * Save confirmed subscription (Workflow step 8-9)
   */
  public saveSubscription(feed: PodcastFeed): PodcastFeed {
    const existing = this.feeds.find(
      (f) => f.feedUrl.toLowerCase() === feed.feedUrl.toLowerCase().trim() || f.id === feed.id
    );
    if (existing) return existing;

    this.feeds.push(feed);
    this.save();
    return feed;
  }

  /**
   * Fetch and subscribe directly (for featured 1-click subscribe)
   */
  public async subscribeToFeed(feedUrl: string): Promise<PodcastFeed> {
    const existing = this.feeds.find((f) => f.feedUrl.toLowerCase() === feedUrl.toLowerCase().trim());
    if (existing) return existing;

    const xml = await this.fetchRawXml(feedUrl);
    const feed = this.parseFeedXml(xml, feedUrl.trim());

    this.feeds.push(feed);
    this.save();
    return feed;
  }

  public unsubscribe(feedId: string): void {
    this.feeds = this.feeds.filter((f) => f.id !== feedId && f.feedUrl !== feedId);
    if (this.activeEpisode?.podcastId === feedId) {
      this.stop();
    }
    this.save();
  }

  public toggleListened(episodeId: string): void {
    if (!this.episodeStates[episodeId]) {
      this.episodeStates[episodeId] = { isListened: true, resumePosition: 0 };
    } else {
      this.episodeStates[episodeId].isListened = !this.episodeStates[episodeId].isListened;
    }
    this.save();
  }

  public playEpisode(episode: PodcastEpisode): void {
    if (!this.audio) this.initAudio();
    if (!this.audio) return;

    this.activeEpisode = episode;
    this.audio.src = episode.audioUrl;

    const resume = episode.resumePosition || 0;
    if (resume > 0) {
      this.audio.currentTime = resume;
    }

    this.audio.play().catch((err) => {
      console.warn('Failed to play episode audio:', err);
    });
    this.notify();
  }

  public togglePlayPause(): void {
    if (!this.audio || !this.activeEpisode) return;
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(console.warn);
    }
  }

  public seek(positionSeconds: number): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, positionSeconds);
    }
  }

  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.activeEpisode = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.notify();
  }
}

export const podcastService = new PodcastService();
