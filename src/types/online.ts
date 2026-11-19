export * from './universalMusic';

export interface OnlineSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  duration?: number;
  source: string;
  streamUrl?: string;
  detailUrl?: string;
  artworkUrl?: string;
  license?: string;
  bitrate?: number;
  format?: string;
}

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  genre: string;
  country?: string;
  bitrate?: number;
  codec?: string;
  logoUrl?: string;
  isFavorite?: boolean;
  isCustom?: boolean;
  description?: string;
}

export type RadioStatus = 'idle' | 'connecting' | 'buffering' | 'playing' | 'error';

export interface RadioPlaybackState {
  currentStation: RadioStation | null;
  status: RadioStatus;
  errorMessage?: string;
  volume: number;
}

export interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date or formatted
  durationSeconds: number;
  audioUrl: string;
  isListened: boolean;
  resumePosition: number; // in seconds
  fileSizeBytes?: number;
}

export interface PodcastFeed {
  id: string;
  title: string;
  author: string;
  description: string;
  feedUrl: string;
  artworkUrl?: string;
  episodes: PodcastEpisode[];
  lastUpdated: number;
}
