import { PodcastFeed, PodcastEpisode } from '../types/online';

const STORAGE_PODCASTS = 'harmoniq_podcast_feeds_v1';
const STORAGE_EPISODE_STATE = 'harmoniq_podcast_episode_state_v1';

export const CURATED_PODCASTS: Partial<PodcastFeed>[] = [
  {
    id: 'npr_planet_money',
    title: 'Planet Money',
    author: 'NPR',
    description: 'The economy explained. Imagine you could call up a friend and say, "Meet me at the bar and tell me what\'s going on with the economy."',
    feedUrl: 'https://feeds.npr.org/510289/podcast.xml',
    artworkUrl: 'https://media.npr.org/assets/img/2022/10/05/planetmoney_custom-48b94cebfa105151528659d47913341851e44f83.jpg',
  },
  {
    id: 'bbc_in_our_time',
    title: 'In Our Time',
    author: 'BBC Radio 4',
    description: 'Melvyn Bragg and guests discuss the history of ideas, philosophy, science, and the arts.',
    feedUrl: 'https://podcasts.files.bbci.co.uk/b006qykl.rss',
    artworkUrl: 'https://ichef.bbci.co.uk/images/ic/1008x1008/p08d51g4.jpg',
  },
  {
    id: 'song_exploder',
    title: 'Song Exploder',
    author: 'Hrishikesh Hirway',
    description: 'A podcast where musicians take apart their songs, and piece by piece, tell the story of how they were made.',
    feedUrl: 'https://feed.songexploder.net/songexploder',
    artworkUrl: 'https://songexploder.net/wp-content/uploads/2020/09/SongExploder-Square-White-Text-3000px.png',
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
        const rawFeeds = localStorage.getItem(STORAGE_PODCASTS);
        if (rawFeeds) {
          this.feeds = JSON.parse(rawFeeds);
        }
        const rawState = localStorage.getItem(STORAGE_EPISODE_STATE);
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

      // Update resume position every 5s
      const epId = this.activeEpisode.id;
      if (!this.episodeStates[epId]) {
        this.episodeStates[epId] = { isListened: false, resumePosition: 0 };
      }
      this.episodeStates[epId].resumePosition = Math.round(this.currentTime);

      // If near end (>90%), mark as listened
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
   * Parse RSS feed text into PodcastFeed
   */
  public parseFeedXml(xmlText: string, feedUrl: string): PodcastFeed {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');

      const channel = doc.querySelector('channel');
      if (!channel) {
        throw new Error('Invalid podcast RSS feed: missing <channel> element');
      }

      const title = channel.querySelector('title')?.textContent?.trim() || 'Untitled Podcast';
      const author =
        channel.querySelector('author')?.textContent?.trim() ||
        channel.querySelector('itunes\\:author, author')?.textContent?.trim() ||
        'Unknown Author';
      const description =
        channel.querySelector('description')?.textContent?.trim() || '';
      const artworkUrl =
        channel.querySelector('image > url')?.textContent?.trim() ||
        channel.querySelector('itunes\\:image')?.getAttribute('href') ||
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

        // Duration parsing (can be HH:MM:SS or integer seconds)
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
            description: epDesc.replace(/<[^>]*>?/gm, '').slice(0, 300), // Strip html tags
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

    // Node / headless fallback regex parser
    const getTag = (xml: string, tag: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
    };

    const getAttr = (xml: string, tag: string, attr: string) => {
      const m = xml.match(new RegExp(`<${tag}[^>]*?${attr}=["']([^"']+)["']`, 'i'));
      return m ? m[1] : '';
    };

    const channelMatch = xmlText.match(/<channel[\s\S]*?>([\s\S]*?)<\/channel>/i);
    const channelXml = channelMatch ? channelMatch[1] : xmlText;

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
  }

  /**
   * Fetch and subscribe to a feed URL
   */
  public async subscribeToFeed(feedUrl: string): Promise<PodcastFeed> {
    const existing = this.feeds.find((f) => f.feedUrl.toLowerCase() === feedUrl.toLowerCase().trim());
    if (existing) return existing;

    const res = await fetch(feedUrl.trim());
    if (!res.ok) {
      throw new Error(`Failed to fetch podcast feed (HTTP ${res.status})`);
    }

    const xml = await res.text();
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
