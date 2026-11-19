import {
  PodcastUrlType,
  ResolvedPodcastPreview,
  ResolverProgressState,
  ResolverStepId,
} from '../types/podcastResolver';

class PodcastResolverService {
  /**
   * Classify input type synchronously
   */
  public classifyUrl(rawInput: string): PodcastUrlType {
    if (!rawInput || !rawInput.trim()) return 'unknown';
    const input = rawInput.trim();

    // Apple Podcasts
    if (/(?:podcasts|itunes)\.apple\.com\/(?:[a-z]{2}\/)?(?:podcast\/)?(?:[^/]+\/)?id\d+/i.test(input) || /\/id\d+/i.test(input) && input.includes('apple.com')) {
      return 'apple_podcasts';
    }

    // Spotify Show
    if (/open\.spotify\.com\/show\/[a-zA-Z0-9]+/i.test(input)) {
      return 'spotify_show';
    }

    // Direct RSS / Atom / XML Feed
    if (
      /\.(rss|xml|atom)($|\?)/i.test(input) ||
      /(?:\/feed|\/rss|\/podcast\.xml)($|\?)/i.test(input) ||
      /^https?:\/\/(?:feeds?|rss)\./i.test(input)
    ) {
      return 'direct_rss';
    }

    // Generic Website URL
    if (/^https?:\/\//i.test(input) || /^(?:www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/)/i.test(input)) {
      return 'website';
    }

    // Otherwise treat as podcast search query
    return 'search_query';
  }

  /**
   * Resolve an arbitrary podcast URL, show link or query into a verified RSS feed preview.
   */
  public async resolve(
    rawInput: string,
    onProgress?: (state: ResolverProgressState) => void
  ): Promise<ResolvedPodcastPreview> {
    const input = (rawInput || '').trim();
    if (!input) {
      return {
        success: false,
        originalInput: '',
        urlType: 'unknown',
        title: '',
        author: '',
        description: '',
        episodeCount: 0,
        error: 'Please enter a podcast URL, Spotify/Apple link, or show title.',
      };
    }

    // Step 1: Normalize
    onProgress?.({
      currentStep: 'normalize',
      message: 'Analyzing input URL and network protocol...',
      percent: 20,
    });

    const urlType = this.classifyUrl(input);

    // Step 2: Inspect
    onProgress?.({
      currentStep: 'inspect',
      message: `Identified source type: ${this.getReadableTypeName(urlType)}. Connecting...`,
      percent: 45,
    });

    // Step 3: Directory / Discovery
    onProgress?.({
      currentStep: 'directory_lookup',
      message: 'Resolving canonical RSS feed and show metadata...',
      percent: 70,
    });

    // Prefer Electron backend IPC (safe SSRF protection and no CORS restrictions)
    if (typeof window !== 'undefined' && window.harmoniqApi?.resolvePodcastUrl) {
      try {
        const result: ResolvedPodcastPreview = await window.harmoniqApi.resolvePodcastUrl(input);

        if (result.success) {
          onProgress?.({
            currentStep: 'validate',
            message: `Found ${result.title} (${result.episodeCount} episodes)`,
            percent: 100,
          });
        }
        return result;
      } catch (err: any) {
        return {
          success: false,
          originalInput: input,
          urlType,
          title: '',
          author: '',
          description: '',
          episodeCount: 0,
          error: err?.message || 'Failed to resolve podcast through desktop backend.',
        };
      }
    }

    // Fallback in test/node environments
    return this.fallbackResolve(input, urlType, onProgress);
  }

  private getReadableTypeName(type: PodcastUrlType): string {
    switch (type) {
      case 'apple_podcasts':
        return 'Apple Podcasts';
      case 'spotify_show':
        return 'Spotify Show';
      case 'direct_rss':
        return 'Direct RSS Feed';
      case 'website':
        return 'Podcast Website';
      case 'search_query':
        return 'Podcast Search';
      default:
        return 'Podcast Link';
    }
  }

  /**
   * Fallback resolver for tests and standard node/fetch environments
   */
  private async fallbackResolve(
    input: string,
    urlType: PodcastUrlType,
    onProgress?: (state: ResolverProgressState) => void
  ): Promise<ResolvedPodcastPreview> {
    try {
      // Direct Apple Podcasts ID extraction
      if (urlType === 'apple_podcasts') {
        const idMatch = input.match(/\/id(\d+)/i);
        if (idMatch) {
          const appleId = idMatch[1];
          const res = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&entity=podcast`);
          if (res.ok) {
            const data = await res.json();
            const pod = data?.results?.[0];
            if (pod && pod.feedUrl) {
              onProgress?.({
                currentStep: 'fetch_feed',
                message: 'Parsing podcast episodes...',
                percent: 90,
              });
              return {
                success: true,
                urlType: 'apple_podcasts',
                originalInput: input,
                resolvedFeedUrl: pod.feedUrl,
                title: pod.collectionName || 'Untitled Podcast',
                author: pod.artistName || 'Unknown Author',
                description: pod.description || 'Discovered via Apple Podcasts Directory.',
                artworkUrl: pod.artworkUrl600 || pod.artworkUrl100,
                episodeCount: pod.trackCount || 0,
              };
            }
          }
        }
      }

      // Spotify show detection
      if (urlType === 'spotify_show') {
        return {
          success: false,
          urlType: 'spotify_show',
          isExclusive: true,
          originalInput: input,
          title: '',
          author: '',
          description: '',
          episodeCount: 0,
          error: 'This show appears to be a Spotify-exclusive or walled-garden podcast that does not provide an open RSS feed.',
        };
      }

      // Direct search or website fallback
      const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(input)}&entity=podcast&limit=3`);
      if (searchRes.ok) {
        const data = await searchRes.json();
        const pod = data?.results?.[0];
        if (pod && pod.feedUrl) {
          return {
            success: true,
            urlType,
            originalInput: input,
            resolvedFeedUrl: pod.feedUrl,
            title: pod.collectionName || 'Untitled Podcast',
            author: pod.artistName || 'Unknown Author',
            description: pod.description || '',
            artworkUrl: pod.artworkUrl600 || pod.artworkUrl100,
            episodeCount: pod.trackCount || 0,
          };
        }
      }

      return {
        success: false,
        urlType,
        originalInput: input,
        title: '',
        author: '',
        description: '',
        episodeCount: 0,
        error: 'Could not find a valid podcast feed for the provided link.',
      };
    } catch (err: any) {
      return {
        success: false,
        urlType,
        originalInput: input,
        title: '',
        author: '',
        description: '',
        episodeCount: 0,
        error: err?.message || 'Resolution failed.',
      };
    }
  }
}

export const podcastResolver = new PodcastResolverService();
