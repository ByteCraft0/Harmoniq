import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { usePlayer } from '../../../context/PlayerContext';
import { getPlatformDriver, getArtworkUrl } from '../../../services/platform';
import {
  Search,
  Music,
  Disc,
  Users,
  Heart,
  Play,
  Pause,
  FolderPlus,
  RefreshCw,
  Folder,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ArrowDownUp,
} from 'lucide-react';
import { TrackMetadata } from '../../../types/audio';
import { useBackHandler } from '../MobileNavigationContext';
import { MobileConfirmDialog } from '../common/MobileConfirmDialog';
import { MobileSortSheet, TrackSortOption } from '../layout/MobileSortSheet';
import { MobileSongMenuSheet } from '../layout/MobileSongMenuSheet';

export const MobileLibraryView: React.FC = () => {
  const {
    tracks,
    albums,
    artists,
    folders,
    toggleFavorite,
    addMusicFolders,
    removeMusicFolder,
    rescanLibrary,
  } = useLibrary();
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const [subTab, setSubTab] = useState<'songs' | 'albums' | 'artists' | 'folders'>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<TrackSortOption>('title_asc');
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<TrackMetadata | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [folderToRemove, setFolderToRemove] = useState<string | null>(null);

  const driver = getPlatformDriver();

  // Priority 4: If active search query exists, pressing Back clears search first
  useBackHandler(
    4,
    () => {
      setSearchQuery('');
      return true;
    },
    searchQuery.trim().length > 0
  );

  // Priority 5: If in albums/artists/folders subtab, pressing Back returns to songs before navigating away
  useBackHandler(
    5,
    () => {
      setSubTab('songs');
      return true;
    },
    subTab !== 'songs'
  );

  // Check initial permissions status on Android
  useEffect(() => {
    if (driver.isAndroid && driver.library.checkPermissions) {
      driver.library.checkPermissions().then((status) => {
        setPermissionGranted(status.granted);
      });
    } else {
      setPermissionGranted(true);
    }
  }, [driver]);

  const requestPermission = async () => {
    if (driver.library.requestPermissions) {
      const res = await driver.library.requestPermissions();
      setPermissionGranted(res.granted);
      if (res.granted) {
        handleRescan();
      }
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await rescanLibrary();
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddFolder = async () => {
    setIsScanning(true);
    try {
      await addMusicFolders();
    } finally {
      setIsScanning(false);
    }
  };

  const filteredTracks = useMemo(() => {
    let result = tracks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
      );
    }

    const sorted = [...result];
    switch (sortOption) {
      case 'title_asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'artist':
        sorted.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
        break;
      case 'album':
        sorted.sort((a, b) => (a.album || '').localeCompare(b.album || '') || a.title.localeCompare(b.title));
        break;
      case 'duration_desc':
        sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'duration_asc':
        sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
      case 'date_added':
        sorted.sort((a, b) => (b.dateAdded || b.dateModified || 0) - (a.dateAdded || a.dateModified || 0));
        break;
      default:
        break;
    }
    return sorted;
  }, [tracks, searchQuery, sortOption]);

  const formatDuration = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getFolderName = (pathOrUri: string) => {
    try {
      const decoded = decodeURIComponent(pathOrUri);
      if (decoded.includes('/')) {
        const segments = decoded.split('/').filter(Boolean);
        return segments[segments.length - 1] || 'Music Folder';
      }
      if (decoded.includes('\\')) {
        const segments = decoded.split('\\').filter(Boolean);
        return segments[segments.length - 1] || 'Music Folder';
      }
      return decoded;
    } catch {
      return 'Music Folder';
    }
  };

  return (
    <div className="space-y-4 pb-40">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Music Library</h2>
          <p className="text-xs text-zinc-500">
            {tracks.length} tracks • {albums.length} albums
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddFolder}
            disabled={isScanning}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-violet-900/30 transition-all disabled:opacity-50"
            title="Add Music Folder (SAF)"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add Folder</span>
          </button>

          <button
            onClick={handleRescan}
            disabled={isScanning}
            className="p-2 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/50 text-zinc-300 hover:text-white active:scale-95 transition-all disabled:opacity-50"
            title="Refresh Library"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-violet-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Android Storage Permission Alert Banner */}
      {driver.isAndroid && permissionGranted === false && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Storage Permission Needed</p>
              <p className="text-[11px] text-zinc-400">Grant media access to discover local device audio files.</p>
            </div>
          </div>
          <button
            onClick={requestPermission}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 active:scale-95 transition-all flex-shrink-0"
          >
            Grant Access
          </button>
        </div>
      )}

      {/* Search Bar & Sort Button */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#14141b] border border-[#272733] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>

        {subTab === 'songs' && (
          <button
            onClick={() => setIsSortSheetOpen(true)}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              sortOption !== 'title_asc'
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                : 'bg-[#14141b] border-[#272733] text-zinc-400 hover:text-white'
            }`}
            title="Sort songs"
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Subtabs Navigation */}
      <div className="flex bg-[#14141b] rounded-xl p-1 border border-[#272733]">
        <button
          onClick={() => setSubTab('songs')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            subTab === 'songs' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Songs ({filteredTracks.length})
        </button>
        <button
          onClick={() => setSubTab('albums')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            subTab === 'albums' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Albums ({albums.length})
        </button>
        <button
          onClick={() => setSubTab('artists')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            subTab === 'artists' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Artists ({artists.length})
        </button>
        <button
          onClick={() => setSubTab('folders')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            subTab === 'folders' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Folders ({folders.length})
        </button>
      </div>

      {/* Songs Tab */}
      {subTab === 'songs' && (
        <div className="space-y-1">
          {filteredTracks.length === 0 ? (
            <div className="rounded-2xl bg-[#14141b] border border-[#272733] p-8 text-center space-y-4 my-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 mx-auto flex items-center justify-center">
                <Music className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {searchQuery ? 'No Matching Tracks' : 'Your Music Library is Empty'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? `No songs found matching "${searchQuery}".`
                    : 'HARMONIQ discovers high-fidelity audio from your device storage and added music folders.'}
                </p>
              </div>

              {!searchQuery && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={handleAddFolder}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-violet-900/30"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Add Music Folder</span>
                  </button>
                  <button
                    onClick={handleRescan}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1b1b24] border border-[#272733] hover:border-violet-500 text-zinc-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Scan Device Media</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const artUrl = getArtworkUrl(track.artworkDataUrl);
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, filteredTracks)}
                  className={`mobile-track-item flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-violet-950/40 border-violet-700/50'
                      : 'bg-[#14141b]/50 border-transparent hover:border-[#272733] hover:bg-[#14141b]'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                    <div className="mobile-track-thumb w-10 h-10 rounded-lg bg-[#1b1b24] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5 relative">
                      {artUrl ? (
                        <img
                          src={artUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Disc className="w-5 h-5 text-zinc-600" />
                      )}
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Pause className="w-4 h-4 text-violet-400 fill-violet-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-violet-400' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-zinc-500 truncate">
                        <span className="truncate">{track.artist}</span>
                        {track.codec && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] uppercase font-mono px-1 rounded bg-white/5 text-zinc-400">
                              {track.codec}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(track);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 active:scale-90 transition-all"
                      aria-label="Toggle favorite"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          track.isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-600'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTrackForMenu(track);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-zinc-200 active:scale-90 transition-all"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Albums Tab */}
      {subTab === 'albums' && (
        <div className="grid grid-cols-2 gap-3">
          {albums.map((album) => {
            const albumArtUrl = getArtworkUrl(album.artworkDataUrl);
            return (
              <div
                key={album.id}
                className="p-2.5 rounded-xl bg-[#14141b] border border-[#272733] flex flex-col space-y-2 hover:border-violet-500/30 transition-all"
              >
                <div className="w-full aspect-square rounded-lg bg-[#1b1b24] overflow-hidden flex items-center justify-center border border-white/5">
                  {albumArtUrl ? (
                    <img
                      src={albumArtUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Disc className="w-10 h-10 text-zinc-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{album.title}</h4>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">{album.artist}</p>
                  <span className="text-[10px] text-zinc-600">{album.trackCount} tracks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Artists Tab */}
      {subTab === 'artists' && (
        <div className="space-y-2">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="p-3 rounded-xl bg-[#14141b] border border-[#272733] flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-violet-950/40 border border-violet-800/30 flex items-center justify-center text-violet-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">{artist.name}</h4>
                  <span className="text-xs text-zinc-500">
                    {artist.albumCount} albums • {artist.trackCount} tracks
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folders Tab (Task 2 & Task 5) */}
      {subTab === 'folders' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs text-zinc-400">
              Manage configured local music storage directories
            </p>
            <button
              onClick={handleAddFolder}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Folder</span>
            </button>
          </div>

          {folders.length === 0 ? (
            <div className="rounded-xl bg-[#14141b] border border-[#272733] p-6 text-center space-y-2">
              <Folder className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs font-medium text-white">No Custom Music Folders Added</p>
              <p className="text-[11px] text-zinc-500">
                Automatic MediaStore detection is active. You can add specific folders via Storage Access Framework.
              </p>
            </div>
          ) : (
            folders.map((folderPath) => {
              const name = getFolderName(folderPath);
              return (
                <div
                  key={folderPath}
                  className="p-3 rounded-xl bg-[#14141b] border border-[#272733] flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-violet-950/40 border border-violet-800/30 flex items-center justify-center text-violet-400 flex-shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{name}</p>
                      <p className="text-[10px] font-mono text-zinc-500 truncate">{folderPath}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setFolderToRemove(folderPath)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Remove folder from library without deleting files"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Confirmation Dialog (Overlay Priority 1) */}
      <MobileConfirmDialog
        isOpen={Boolean(folderToRemove)}
        title="Remove Folder"
        message={`Remove "${getFolderName(folderToRemove || '')}" from your HARMONIQ library? Audio files on device will not be deleted.`}
        confirmLabel="Remove"
        isDestructive
        onConfirm={() => {
          if (folderToRemove) removeMusicFolder(folderToRemove);
          setFolderToRemove(null);
        }}
        onCancel={() => setFolderToRemove(null)}
      />

      {/* Sort Sheet (Overlay Priority 2) */}
      <MobileSortSheet
        isOpen={isSortSheetOpen}
        selectedOption={sortOption}
        onSelectOption={(opt) => setSortOption(opt)}
        onClose={() => setIsSortSheetOpen(false)}
      />

      {/* Song Context Menu (Overlay Priority 2) */}
      <MobileSongMenuSheet
        isOpen={selectedTrackForMenu !== null}
        track={selectedTrackForMenu}
        onClose={() => setSelectedTrackForMenu(null)}
      />
    </div>
  );
};
