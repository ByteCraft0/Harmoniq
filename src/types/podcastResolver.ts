export type PodcastUrlType =
  | 'direct_rss'
  | 'apple_podcasts'
  | 'spotify_show'
  | 'podcast_index'
  | 'website'
  | 'search_query'
  | 'unknown';

export interface ResolvedPodcastPreview {
  success: boolean;
  resolvedFeedUrl?: string;
  originalInput: string;
  urlType: PodcastUrlType;
  title: string;
  author: string;
  description: string;
  artworkUrl?: string;
  episodeCount: number;
  latestEpisodeTitle?: string;
  latestEpisodeDate?: string;
  websiteUrl?: string;
  isExclusive?: boolean;
  error?: string;
  warning?: string;
  episodesSample?: {
    title: string;
    publishedAt: string;
    durationSeconds: number;
    audioUrl: string;
  }[];
}

export type ResolverStepId = 'normalize' | 'inspect' | 'directory_lookup' | 'fetch_feed' | 'validate';

export interface ResolverProgressState {
  currentStep: ResolverStepId;
  message: string;
  percent: number;
}
