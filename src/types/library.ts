import { TrackMetadata } from './audio';

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
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

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  dateCreated: number;
  dateModified: number;
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
