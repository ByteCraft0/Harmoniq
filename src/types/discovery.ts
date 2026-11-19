import { UnifiedTrack, ProviderId, PlaybackCapability } from './universalMusic';

export type DiscoveryAction =
  | 'discover'
  | 'discover_similar'
  | 'refine'
  | 'playback_action';

export type DiscoveryMood =
  | 'relaxing'
  | 'happy'
  | 'sad'
  | 'energetic'
  | 'peaceful'
  | 'romantic'
  | 'motivational'
  | 'melancholic'
  | 'atmospheric'
  | 'chill';

export type DiscoveryActivity =
  | 'studying'
  | 'coding'
  | 'reading'
  | 'working'
  | 'travelling'
  | 'exercising'
  | 'sleeping'
  | 'background';

export interface DiscoveryFilters {
  query?: string;
  artist?: string;
  album?: string;
  genres?: string[];
  moods?: DiscoveryMood[];
  activities?: DiscoveryActivity[];
  yearMin?: number;
  yearMax?: number;
  isInstrumental?: boolean;
  isAcoustic?: boolean;
  tempo?: 'slow' | 'medium' | 'fast';
  energy?: 'low' | 'medium' | 'high';
  vocalPreference?: 'female' | 'male' | 'instrumental' | 'any';
  popularityFilter?: 'any' | 'popular' | 'underrated';
  localOnly?: boolean;
}

export interface DiscoveryReference {
  type: 'current_track' | 'current_artist' | 'current_album' | 'playlist' | 'track_title';
  title?: string;
  artist?: string;
  album?: string;
}

export interface PlaybackCommand {
  action: 'play_index' | 'queue_index' | 'play_next_index' | 'queue_all';
  targetIndex?: number; // 0-based index of displayed result
}

export interface DiscoveryIntent {
  action: DiscoveryAction;
  confidence: 'high' | 'medium' | 'low';
  filters: DiscoveryFilters;
  reference?: DiscoveryReference;
  playbackCommand?: PlaybackCommand;
  rawQuery: string;
}

export interface DiscoveryResult {
  intent: DiscoveryIntent;
  tracks: UnifiedTrack[];
  totalFound: number;
  providersQueried: ProviderId[];
  summary: string;
  appliedFilters: string[];
}
