import { TrackMetadata } from './audio';

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkDataUrl?: string;
  trackCount: number;
  totalDuration: number; // in seconds
  tracks: TrackMetadata[];
}

export interface Artist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  albums: Album[];
}

export interface PlaylistFolder {
  id: string;
  name: string;
  parentId: string | null; // For nested folders
  dateCreated: number;
  dateModified: number;
  isExpanded?: boolean;
}

export type PlaylistHistoryAction =
  | 'created'
  | 'tracks_added'
  | 'tracks_removed'
  | 'tracks_reordered'
  | 'renamed'
  | 'restored';

export interface PlaylistHistoryEntry {
  id: string;
  playlistId: string;
  timestamp: number;
  action: PlaylistHistoryAction;
  description: string;
  trackCount: number;
  snapshotTrackIds: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  dateCreated: number;
  dateModified: number;
  folderId?: string | null; // Harmoniq 2.0: Playlist folder organization
  isSmart?: boolean;
  smartCriteria?: 'recently_added' | 'recently_played' | 'favorites' | 'most_played';
}

export interface FolderNode {
  path: string;
  name: string;
  trackCount: number;
  subFolders: FolderNode[];
  trackIds: string[];
}

export interface LibraryStats {
  totalTracks: number;
  totalAlbums: number;
  totalArtists: number;
  totalDuration: number;
  totalSize: number;
  isScanning: boolean;
  scannedFilesCount: number;
  totalFilesCount: number;
}
