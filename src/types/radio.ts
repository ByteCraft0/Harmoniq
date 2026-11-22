export interface RadioStation {
  id: string; // stationuuid or custom generated ID
  name: string;
  streamUrl: string; // url_resolved or direct stream URL
  homepageUrl?: string;
  favicon?: string;
  country?: string;
  countryCode?: string;
  tags: string[];
  codec?: string; // MP3, AAC, etc.
  bitrate?: number; // kbps
  votes?: number;
  clickCount?: number;
  isCustom?: boolean;
  isFavorite?: boolean;
  lastPlayed?: number; // timestamp
}

export interface RadioCountry {
  name: string;
  code: string;
  stationCount: number;
}

export interface RadioGenre {
  name: string;
  stationCount: number;
}

export interface RadioSearchParams {
  name?: string;
  country?: string;
  countryCode?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  order?: 'votes' | 'clickcount' | 'name';
}
