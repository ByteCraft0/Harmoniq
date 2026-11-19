import { UnifiedTrack } from './universalMusic';

export type PlaylistAssistantAction =
  | 'create'
  | 'edit'
  | 'inspect'
  | 'save'
  | 'cancel'
  | 'refine';

export type PlaylistSourceType =
  | 'local_library'
  | 'favorites'
  | 'universal_discovery'
  | 'current_track'
  | 'existing_playlist';

export interface PlaylistPreferences {
  moods?: string[];
  genres?: string[];
  activities?: string[];
  energy?: 'low' | 'medium' | 'high';
  isAcoustic?: boolean;
  isInstrumental?: boolean;
  vocalPreference?: 'female' | 'male' | 'instrumental' | 'any';
  targetCount?: number;
  yearMin?: number;
  yearMax?: number;
}

export interface PlaylistEditOperation {
  type: 'add_tracks' | 'remove_tracks' | 'reorder' | 'rename' | 'replace_tracks' | 'undo';
  trackIds?: string[];
  targetIndex?: number;
  newName?: string;
  countToAdd?: number;
}

export interface PlaylistIntent {
  action: PlaylistAssistantAction;
  name?: string;
  description?: string;
  sourceType?: PlaylistSourceType;
  referencePlaylistName?: string;
  preferences: PlaylistPreferences;
  editOperation?: PlaylistEditOperation;
  rawQuery: string;
}

export interface PlaylistComposition {
  localCount: number;
  onlineFullCount: number;
  previewCount: number;
  excludedExternalCount: number;
}

export interface GeneratedPlaylistPreview {
  id: string;
  name: string;
  description: string;
  tracks: UnifiedTrack[];
  totalDuration: number;
  composition: PlaylistComposition;
  sourceDescription: string;
  isSaved: boolean;
  savedPlaylistId?: string;
}
