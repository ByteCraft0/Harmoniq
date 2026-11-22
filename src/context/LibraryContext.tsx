import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TrackMetadata } from '../types/audio';
import { Album, Artist, Playlist, FolderNode, LibraryStats } from '../types/library';
import { WatcherSyncStatus } from '../types/electron';
import { libraryService } from '../services/libraryService';
import { playlistFolderService } from '../services/playlistFolderService';
import { favoritesService } from '../services/favoritesService';
import { historyService } from '../services/historyService';
import { useToast } from './ToastContext';
import { getPlatformDriver } from '../services/platform';

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
  folders: string[];
  stats: LibraryStats;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: TrackMetadata[];

  // Library Management Actions
  addMusicFolders: () => Promise<void>;
  removeMusicFolder: (folderPathOrUri: string) => Promise<void>;
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
  clearHistory: () => void;
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
  const [folders, setFolders] = useState<string[]>([]);
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
      await getPlatformDriver().storage.set(STORAGE_LIBRARY_KEY, data);
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
    setFolders(libraryService.getFolders());
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
        savedData = await getPlatformDriver().storage.get(STORAGE_LIBRARY_KEY);
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

      // Also ensure custom playlists stored in preferences are loaded
      await libraryService.loadSavedPlaylistsAsync();
      refreshLibraryState();

      // If on Android, automatically populate or sync device media if permission is already granted
      if (getPlatformDriver().isAndroid) {
        const driver = getPlatformDriver().library;
        if (driver.checkPermissions) {
          try {
            const perm = await driver.checkPermissions();
            if (perm.granted) {
              const result = await driver.scanLibrary();
              if (result && result.tracks && result.tracks.length > 0) {
                libraryService.addTracks(result.tracks);
                refreshLibraryState();
              }
            }
          } catch {}
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
    const driver = getPlatformDriver().library;
    let paths: string[] | null = null;
    if (driver.pickFolder) {
      paths = await driver.pickFolder();
    } else if (window.harmoniqApi?.openFolderDialog) {
      paths = await window.harmoniqApi.openFolderDialog();
    }

    if (paths && paths.length > 0) {
      for (const p of paths) {
        await scanFolder(p);
      }
    } else if (!paths) {
      showToast('Opening native folder picker...', 'info');
    }
  };

  const removeMusicFolder = async (folderPathOrUri: string) => {
    const driver = getPlatformDriver().library;
    if (driver.removeFolder) {
      await driver.removeFolder(folderPathOrUri);
    }
    const currentFolders = libraryService.getFolders();
    const nextFolders = currentFolders.filter((f) => f !== folderPathOrUri);
    libraryService.setFolders(nextFolders);
    libraryService.pruneFolder(folderPathOrUri, new Set());
    refreshLibraryState();
    showToast('Folder removed from library', 'info');
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
    const driver = getPlatformDriver().library;
    libraryService.setScanning(true);
    setStats(libraryService.getStats());
    try {
      let result: any = null;
      if (driver.scanFolder) {
        result = await driver.scanFolder(folderPath);
      } else if (window.harmoniqApi?.scanFolder) {
        result = await window.harmoniqApi.scanFolder(folderPath);
      } else {
        result = await driver.scanLibrary({ folderPaths: [folderPath] });
      }

      if (result && result.tracks) {
        libraryService.addTracks(result.tracks);
        // Drop tracks whose files disappeared (only when the folder itself was readable, e.g. not an unplugged drive)
        let removedNote = '';
        if (result.folderAccessible !== false) {
          const removed = libraryService.pruneFolder(folderPath, new Set(result.tracks.map((t: TrackMetadata) => t.id)));
          if (removed > 0) removedNote = `, removed ${removed} missing`;
        }
        const currentFolders = libraryService.getFolders();
        if (!currentFolders.includes(folderPath)) {
          const nextFolders = [...currentFolders, folderPath];
          libraryService.setFolders(nextFolders);
          if (driver.startWatcher) {
            driver.startWatcher(nextFolders);
          } else if (window.harmoniqApi?.startFolderWatcher) {
            window.harmoniqApi.startFolderWatcher(nextFolders);
          }
        }
        const displayName = folderPath.includes('/') ? folderPath.split('/').pop() : folderPath.split('\\').pop();
        showToast(`Indexed ${result.tracks.length} tracks from ${decodeURIComponent(displayName || 'folder')}${removedNote}`, 'success');
      }
    } catch (err) {
      console.error('Scan folder failed:', err);
      showToast('Error scanning folder', 'warning');
    } finally {
      libraryService.setScanning(false);
      refreshLibraryState();
    }
  };

  const clearHistory = () => {
    libraryService.clearRecentlyPlayed();
    historyService.clearHistory();
    refreshLibraryState();
    showToast('Listening history cleared', 'info');
  };

  const updateTrackMetadataInLibrary = (updatedTrack: TrackMetadata) => {
    libraryService.updateTrack(updatedTrack);
    refreshLibraryState();
  };

  const rescanLibrary = async () => {
    const driver = getPlatformDriver().library;
    const isAndroid = getPlatformDriver().isAndroid;
    const folders = libraryService.getFolders();

    if (!isAndroid && folders.length === 0) {
      showToast('No folders added yet. Click "Add Music Folder"', 'info');
      return;
    }

    showToast('Rescanning music library...', 'info');
    libraryService.setScanning(true);
    setStats(libraryService.getStats());

    try {
      if (isAndroid) {
        const scanRes = await driver.scanLibrary();
        if (scanRes && scanRes.tracks && scanRes.tracks.length > 0) {
          libraryService.addTracks(scanRes.tracks);
        }
      }

      for (const f of folders) {
        let result: any = null;
        if (driver.scanFolder) {
          result = await driver.scanFolder(f);
        } else if (window.harmoniqApi?.scanFolder) {
          result = await window.harmoniqApi.scanFolder(f);
        } else {
          result = await driver.scanLibrary({ folderPaths: [f] });
        }
        if (result && result.tracks) {
          libraryService.addTracks(result.tracks);
        }
      }
      showToast('Library scan complete', 'success');
    } catch (err) {
      console.error('Rescan library failed:', err);
      showToast('Scan completed with warnings', 'warning');
    } finally {
      libraryService.setScanning(false);
      refreshLibraryState();
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
        folders,
        stats,
        searchQuery,
        setSearchQuery,
        searchResults,
        addMusicFolders,
        removeMusicFolder,
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
        clearHistory,
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
