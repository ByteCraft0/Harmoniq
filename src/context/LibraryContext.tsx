import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TrackMetadata } from '../types/audio';
import { Album, Artist, Playlist, FolderNode, LibraryStats } from '../types/library';
import { WatcherSyncStatus } from '../types/electron';
import { libraryService } from '../services/libraryService';
import { playlistFolderService } from '../services/playlistFolderService';
import { favoritesService } from '../services/favoritesService';
import { useToast } from './ToastContext';

export type AppView =
  | 'home'
  | 'discover'
  | 'calendar'
  | 'songs'
  | 'albums'
  | 'vinyl_collection'
  | 'immersive_album'
  | 'artists'
  | 'folders'
  | 'favorites'
  | 'recently_played'
  | 'library'
  | 'album_detail'
  | 'artist_detail'
  | 'now_playing'
  | 'equalizer'
  | 'visualizer'
  | 'inspector'
  | 'playlists'
  | 'lyrics'
  | 'audio_output'
  | 'settings'
  | 'stats'
  | 'online_music'
  | 'radio'
  | 'podcasts'
  | 'abx';

interface LibraryContextType {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  selectedAlbum: Album | null;
  selectedArtist: Artist | null;
  selectedPlaylist: Playlist | null;
  openAlbumDetail: (album: Album) => void;
  openArtistDetail: (artist: Artist) => void;
  openPlaylistDetail: (playlist: Playlist) => void;
  restoreNavigationState: (state: {
    view: AppView;
    selectedAlbum?: Album | null;
    selectedArtist?: Artist | null;
    selectedPlaylist?: Playlist | null;
  }) => void;

  // Data
  tracks: TrackMetadata[];
  albums: Album[];
  artists: Artist[];
  genres: { name: string; trackCount: number; tracks: TrackMetadata[] }[];
  folderTree: FolderNode[];
  playlists: Playlist[];
  stats: LibraryStats;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: TrackMetadata[];

  // Library Management Actions
  addMusicFolders: () => Promise<void>;
  openAudioFiles: () => Promise<void>;
  scanFolder: (path: string) => Promise<void>;
  toggleFavorite: (trackOrId: TrackMetadata | string) => void;
  createPlaylist: (name: string, desc?: string) => Playlist;
  renamePlaylist: (id: string, newName: string, desc?: string) => boolean;
  deletePlaylist: (id: string) => void;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeTrackFromPlaylist: (playlistId: string, index: number) => void;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => boolean;
  exportPlaylistM3u: (playlistId: string) => void;
  importPlaylistM3u: (name: string, content: string) => void;
  showFileInFolder: (filePath: string) => void;
  rescanLibrary: () => Promise<void>;
  updateTrackMetadataInLibrary: (track: TrackMetadata) => void;
  watcherStatus: WatcherSyncStatus;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

const STORAGE_LIBRARY_KEY = 'library_cache';

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [tracks, setTracks] = useState<TrackMetadata[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<{ name: string; trackCount: number; tracks: TrackMetadata[] }[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [stats, setStats] = useState<LibraryStats>(libraryService.getStats());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackMetadata[]>([]);
  const [watcherStatus, setWatcherStatus] = useState<WatcherSyncStatus>({
    status: 'idle',
    folderCount: 0,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveLibraryToStorage = useCallback(async () => {
    saveTimerRef.current = null;
    const data = libraryService.serialize();
    try {
      if (window.harmoniqApi?.savePersistentData) {
        await window.harmoniqApi.savePersistentData(STORAGE_LIBRARY_KEY, data);
      } else {
        localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Failed to save library:', e);
    }
  }, []);

  // Debounced persistence so rapid changes (favorites, play counts, scans) cause a single write
  const scheduleSave = useCallback(
    (delay = 1500) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveLibraryToStorage, delay);
    },
    [saveLibraryToStorage]
  );

  // Refresh reactive state from library service
  const refreshLibraryState = useCallback(() => {
    setTracks(libraryService.getAllTracks());
    setAlbums(libraryService.getAlbums());
    setArtists(libraryService.getArtists());
    setGenres(libraryService.getGenres());
    setFolderTree(libraryService.getFolderTree());
    const allPlaylists = libraryService.getPlaylists();
    setPlaylists(allPlaylists);
    setSelectedPlaylist((prev) => {
      if (!prev) return null;
      return allPlaylists.find((p) => p.id === prev.id) || null;
    });
    setStats(libraryService.getStats());
    scheduleSave();
  }, [scheduleSave]);

  // React to changes made inside the service (play counts, favorites, resume positions)
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = libraryService.subscribe((kind) => {
      if (kind === 'data') {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshLibraryState, 250);
      } else {
        scheduleSave(5000);
      }
    });
    const unsubFavorites = favoritesService.subscribe(() => {
      refreshLibraryState();
    });
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveLibraryToStorage();
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      unsubscribe();
      unsubFavorites();
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('beforeunload', flush);
    };
  }, [refreshLibraryState, scheduleSave, saveLibraryToStorage]);

  // Load saved library on launch
  useEffect(() => {
    const loadSaved = async () => {
      let savedData: any = null;
      try {
        if (window.harmoniqApi?.loadPersistentData) {
          savedData = await window.harmoniqApi.loadPersistentData(STORAGE_LIBRARY_KEY);
        } else {
          const raw = localStorage.getItem(STORAGE_LIBRARY_KEY);
          if (raw) savedData = JSON.parse(raw);
        }
      } catch (e) {
        console.warn('Failed to load saved library:', e);
      }

      if (savedData) {
        libraryService.deserialize(savedData);
        refreshLibraryState();

        // Start real-time folder watching on stored music folders
        const savedFolders = libraryService.getFolders();
        if (savedFolders.length > 0 && window.harmoniqApi?.startFolderWatcher) {
          window.harmoniqApi.startFolderWatcher(savedFolders);
        }
      }
    };

    loadSaved();

    // Listen to background scanning progress events if available
    const unsubs: (() => void)[] = [];

    if (window.harmoniqApi?.onScanProgress) {
      unsubs.push(
        window.harmoniqApi.onScanProgress((prog) => {
          libraryService.setScanning(true, prog);
          setStats(libraryService.getStats());
        })
      );
    }

    // Real-time automatic folder watcher events
    if (window.harmoniqApi?.onWatcherFileAddedOrUpdated) {
      unsubs.push(
        window.harmoniqApi.onWatcherFileAddedOrUpdated((track) => {
          libraryService.updateTrack(track);
          refreshLibraryState();
        })
      );
    }

    if (window.harmoniqApi?.onWatcherFileRemoved) {
      unsubs.push(
        window.harmoniqApi.onWatcherFileRemoved((filePath) => {
          libraryService.removeTrackByPath(filePath);
          refreshLibraryState();
        })
      );
    }

    if (window.harmoniqApi?.onWatcherSyncStatus) {
      unsubs.push(
        window.harmoniqApi.onWatcherSyncStatus((status) => {
          setWatcherStatus(status);
        })
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [refreshLibraryState]);

  // Update search results whenever searchQuery or tracks change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
    } else {
      setSearchResults(libraryService.searchTracks(searchQuery));
    }
  }, [searchQuery, tracks]);

  // Folder scanning
  const addMusicFolders = async () => {
    if (window.harmoniqApi?.openFolderDialog) {
      const paths = await window.harmoniqApi.openFolderDialog();
      if (paths && paths.length > 0) {
        for (const p of paths) {
          await scanFolder(p);
        }
      }
    } else {
      showToast('Opening native folder picker...', 'info');
    }
  };

  const openAudioFiles = async () => {
    if (window.harmoniqApi?.openFileDialog) {
      const paths = await window.harmoniqApi.openFileDialog();
      if (paths && paths.length > 0) {
        const parsedTracks: TrackMetadata[] = [];
        for (const p of paths) {
          const t = await window.harmoniqApi.parseAudioFile(p);
          if (t) parsedTracks.push(t);
        }
        libraryService.addTracks(parsedTracks);
        refreshLibraryState();
        showToast(`Loaded ${parsedTracks.length} audio tracks`, 'success');
      }
    }
  };

  const scanFolder = async (folderPath: string) => {
    if (window.harmoniqApi?.scanFolder) {
      libraryService.setScanning(true);
      setStats(libraryService.getStats());
      try {
        const result = await window.harmoniqApi.scanFolder(folderPath);
        if (result && result.tracks) {
          libraryService.addTracks(result.tracks);
          // Drop tracks whose files disappeared (only when the folder itself was readable, e.g. not an unplugged drive)
          let removedNote = '';
          if (result.folderAccessible !== false) {
            const removed = libraryService.pruneFolder(folderPath, new Set(result.tracks.map((t) => t.id)));
            if (removed > 0) removedNote = `, removed ${removed} missing`;
          }
          const currentFolders = libraryService.getFolders();
          if (!currentFolders.includes(folderPath)) {
            const nextFolders = [...currentFolders, folderPath];
            libraryService.setFolders(nextFolders);
            if (window.harmoniqApi?.startFolderWatcher) {
              window.harmoniqApi.startFolderWatcher(nextFolders);
            }
          }
          showToast(`Indexed ${result.tracks.length} tracks from ${folderPath.split(/[\\/]/).pop()}${removedNote}`, 'success');
        }
      } catch (err) {
        console.error('Scan folder failed:', err);
        showToast('Error scanning folder', 'warning');
      } finally {
        libraryService.setScanning(false);
        refreshLibraryState();
      }
    }
  };

  const updateTrackMetadataInLibrary = (updatedTrack: TrackMetadata) => {
    libraryService.updateTrack(updatedTrack);
    refreshLibraryState();
  };

  const rescanLibrary = async () => {
    const folders = libraryService.getFolders();
    if (folders.length === 0) {
      showToast('No folders added yet. Click "Add Music Folder"', 'info');
      return;
    }
    showToast('Rescanning music library...', 'info');
    for (const f of folders) {
      await scanFolder(f);
    }
  };

  const toggleFavorite = (trackOrId: TrackMetadata | string) => {
    let targetTrack: TrackMetadata | undefined;
    if (typeof trackOrId === 'string') {
      targetTrack =
        tracks.find((t) => t.id === trackOrId) ||
        favoritesService.getFavorites().find((f) => f.id === trackOrId);
      if (!targetTrack) {
        targetTrack = {
          id: trackOrId,
          filePath: '',
          fileName: trackOrId,
          fileSize: 0,
          dateModified: Date.now(),
          title: 'Unknown Title',
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          hasArtwork: false,
          codec: 'MP3',
          container: 'mp3',
          duration: 0,
          sampleRate: 44100,
          bitrate: 320,
          channels: 2,
          isLossless: false,
          playCount: 0,
          isFavorite: false,
        };
      }
    } else {
      targetTrack = trackOrId;
    }

    const isFav = favoritesService.toggleFavorite(targetTrack);
    libraryService.syncFavorites(targetTrack.id, isFav);
    refreshLibraryState();
    showToast(isFav ? 'Added to Favorites' : 'Removed from Favorites', 'info');
  };

  const createPlaylist = (name: string, desc?: string): Playlist => {
    const pl = libraryService.createPlaylist(name, desc);
    playlistFolderService.recordHistory(pl.id, 'created', `Created playlist "${name}"`, []);
    refreshLibraryState();
    showToast(`Playlist "${name}" created`, 'success');
    return pl;
  };

  const renamePlaylist = (id: string, newName: string, desc?: string): boolean => {
    const success = libraryService.renamePlaylist(id, newName, desc);
    if (success) {
      const pl = libraryService.getPlaylists().find((p) => p.id === id);
      if (pl) {
        playlistFolderService.recordHistory(
          id,
          'renamed',
          `Renamed playlist to "${newName.trim()}"`,
          pl.trackIds
        );
      }
      refreshLibraryState();
      showToast(`Playlist renamed to "${newName.trim()}"`, 'success');
    }
    return success;
  };

  const deletePlaylist = (id: string) => {
    libraryService.deletePlaylist(id);
    if (selectedPlaylist?.id === id) {
      setSelectedPlaylist(null);
      setActiveView('playlists');
    }
    refreshLibraryState();
    showToast('Playlist deleted', 'info');
  };

  const addTracksToPlaylist = (playlistId: string, trackIds: string[]) => {
    const target = playlists.find((p) => p.id === playlistId);
    const targetName = target ? target.name : 'playlist';
    const success = libraryService.addTracksToPlaylist(playlistId, trackIds);
    if (success) {
      const pl = libraryService.getPlaylists().find((p) => p.id === playlistId);
      if (pl) {
        playlistFolderService.recordHistory(
          playlistId,
          'tracks_added',
          `Added ${trackIds.length} track(s)`,
          pl.trackIds
        );
      }
      refreshLibraryState();
      showToast(`Added ${trackIds.length} track(s) to "${targetName}"`, 'success');
    } else {
      refreshLibraryState();
      showToast(`Track(s) already in "${targetName}"`, 'info');
    }
  };

  const removeTrackFromPlaylist = (playlistId: string, index: number) => {
    libraryService.removeTrackFromPlaylist(playlistId, index);
    const pl = libraryService.getPlaylists().find((p) => p.id === playlistId);
    if (pl) {
      playlistFolderService.recordHistory(
        playlistId,
        'tracks_removed',
        `Removed track at index ${index + 1}`,
        pl.trackIds
      );
    }
    refreshLibraryState();
    showToast('Track removed from playlist', 'info');
  };

  const reorderPlaylist = (playlistId: string, fromIndex: number, toIndex: number): boolean => {
    const success = libraryService.reorderPlaylist(playlistId, fromIndex, toIndex);
    if (success) {
      const pl = libraryService.getPlaylists().find((p) => p.id === playlistId);
      if (pl) {
        playlistFolderService.recordHistory(
          playlistId,
          'tracks_reordered',
          `Reordered track from ${fromIndex + 1} to ${toIndex + 1}`,
          pl.trackIds
        );
      }
      refreshLibraryState();
    }
    return success;
  };

  const exportPlaylistM3u = (playlistId: string) => {
    const m3uContent = libraryService.exportPlaylistM3u8(playlistId);
    const pl = playlists.find((p) => p.id === playlistId);
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pl ? pl.name : 'playlist'}.m3u8`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported M3U8 playlist', 'success');
  };

  const importPlaylistM3u = (name: string, content: string) => {
    libraryService.importPlaylistM3u(name, content);
    refreshLibraryState();
    showToast(`Imported playlist "${name}"`, 'success');
  };

  const showFileInFolder = (filePath: string) => {
    if (window.harmoniqApi?.showItemInFolder) {
      window.harmoniqApi.showItemInFolder(filePath);
    }
  };

  const openAlbumDetail = (album: Album) => {
    setSelectedAlbum(album);
    setActiveView('album_detail');
  };

  const openArtistDetail = (artist: Artist) => {
    setSelectedArtist(artist);
    setActiveView('artist_detail');
  };

  const openPlaylistDetail = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setActiveView('playlists');
  };

  const restoreNavigationState = useCallback(
    (navState: {
      view: AppView;
      selectedAlbum?: Album | null;
      selectedArtist?: Artist | null;
      selectedPlaylist?: Playlist | null;
    }) => {
      setActiveView(navState.view);
      setSelectedAlbum(navState.selectedAlbum ?? null);
      setSelectedArtist(navState.selectedArtist ?? null);
      setSelectedPlaylist(navState.selectedPlaylist ?? null);
    },
    []
  );

  return (
    <LibraryContext.Provider
      value={{
        activeView,
        setActiveView,
        selectedAlbum,
        selectedArtist,
        selectedPlaylist,
        openAlbumDetail,
        openArtistDetail,
        openPlaylistDetail,
        restoreNavigationState,
        tracks,
        albums,
        artists,
        genres,
        folderTree,
        playlists,
        stats,
        searchQuery,
        setSearchQuery,
        searchResults,
        addMusicFolders,
        openAudioFiles,
        scanFolder,
        toggleFavorite,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTracksToPlaylist,
        removeTrackFromPlaylist,
        reorderPlaylist,
        exportPlaylistM3u,
        importPlaylistM3u,
        showFileInFolder,
        rescanLibrary,
        updateTrackMetadataInLibrary,
        watcherStatus,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = (): LibraryContextType => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
