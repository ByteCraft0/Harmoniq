import { TrackMetadata } from './audio';

export type SmartPlaylistField =
  | 'title'
  | 'artist'
  | 'album'
  | 'genre'
  | 'year'
  | 'duration'
  | 'bitrate'
  | 'codec'
  | 'dateAdded'
  | 'lastPlayed'
  | 'playCount'
  | 'isFavorite';

export type SmartPlaylistOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'between';

export interface SmartPlaylistRule {
  id: string;
  field: SmartPlaylistField;
  operator: SmartPlaylistOperator;
  value: string | number;
  valueExtra?: number; // for 'between' operator
}

export type SmartPlaylistSortBy =
  | 'title'
  | 'artist'
  | 'album'
  | 'year'
  | 'duration'
  | 'bitrate'
  | 'dateAdded'
  | 'lastPlayed'
  | 'playCount';

export interface SmartPlaylistDefinition {
  id: string;
  name: string;
  description?: string;
  matchMode: 'all' | 'any'; // AND vs OR
  rules: SmartPlaylistRule[];
  sortBy: SmartPlaylistSortBy;
  sortOrder: 'asc' | 'desc';
  limit: number; // 0 = unlimited
  dateCreated: number;
  dateModified: number;
  isBuiltIn?: boolean;
}
