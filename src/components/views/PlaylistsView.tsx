import React, { useState, useEffect, useCallback } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { SongRow, SongTableHeader } from '../layout/SongRow';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { AddSongsToPlaylistModal } from '../layout/AddSongsToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
import { Playlist, PlaylistFolder } from '../../types/library';
import { playlistFolderService } from '../../services/playlistFolderService';
import { PlaylistImportExportModal } from '../library/PlaylistImportExportModal';
import { PlaylistHistoryModal } from '../library/PlaylistHistoryModal';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  ListMusic,
  Plus,
  Play,
  Shuffle,
  Trash2,
  Download,
  Upload,
  Heart,
  Clock,
  Edit2,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  History,
  FolderTree,
  FolderOutput,
} from 'lucide-react';

export const PlaylistsView: React.FC = () => {
  const {
    activeView,
    playlists,
    tracks,
    selectedPlaylist,
    openPlaylistDetail,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    importPlaylistM3u,
    toggleFavorite,
  } = useLibrary();

  const { playTrack, playNext, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  // Folder states
  const [folders, setFolders] = useState<PlaylistFolder[]>(() => playlistFolderService.getFolders());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    return new Set(playlistFolderService.getFolders().map((f) => f.id));
  });

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<PlaylistFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  // Playlist states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);
  const [showIoModal, setShowIoModal] = useState<'import' | 'export' | null>(null);

  // Subscribe to folder changes
  useEffect(() => {
    return playlistFolderService.subscribeFolders((fList) => {
      setFolders(fList);
    });
  }, []);

  // Compute active playlist reactively based on view and selection
  let activePlaylist: Playlist | null = null;
  if (selectedPlaylist) {
    activePlaylist = playlists.find((p) => p.id === selectedPlaylist.id) || selectedPlaylist;
  } else if (activeView === 'favorites') {
    activePlaylist = playlists.find((p) => p.smartCriteria === 'favorites') || null;
  } else if (activeView === 'recently_played') {
    activePlaylist = playlists.find((p) => p.smartCriteria === 'recently_played') || null;
  } else {
    activePlaylist = playlists.find((p) => !p.isSmart) || (playlists.length > 0 ? playlists[0] : null);
  }

  const playlistTracks = activePlaylist
    ? activePlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is typeof tracks[0] => !!t)
    : [];

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      const folder = playlistFolderService.createFolder(newFolderName.trim());
      setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
      setNewFolderName('');
      setShowCreateFolderModal(false);
      showToast(`Folder "${folder.name}" created`, 'success');
    }
  };

  const handleOpenRenameFolder = (f: PlaylistFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToRename(f);
    setRenameFolderName(f.name);
    setShowRenameFolderModal(true);
  };

  const handleRenameFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderToRename && renameFolderName.trim()) {
      playlistFolderService.renameFolder(folderToRename.id, renameFolderName.trim());
      setShowRenameFolderModal(false);
      setFolderToRename(null);
      setRenameFolderName('');
      showToast('Folder renamed', 'success');
    }
  };

  const handleDeleteFolder = (folder: PlaylistFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    playlistFolderService.deleteFolder(folder.id);
    showToast(`Folder "${folder.name}" deleted (all playlists safely kept at root)`, 'info');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      const pl = createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
      openPlaylistDetail(pl);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (activePlaylist && renameValue.trim()) {
      renamePlaylist(activePlaylist.id, renameValue.trim());
      setShowRenameModal(false);
      setRenameValue('');
    }
  };

  const handleOpenRename = () => {
    if (activePlaylist && !activePlaylist.isSmart) {
      setRenameValue(activePlaylist.name);
      setShowRenameModal(true);
    }
  };

  const handleDelete = () => {
    if (activePlaylist && !activePlaylist.isSmart) {
      const name = activePlaylist.name;
      deletePlaylist(activePlaylist.id);
      showToast(`Playlist "${name}" deleted`, 'info');
    }
  };

  const handleMoveActiveToFolder = (targetFolderId: string | null) => {
    if (!activePlaylist || activePlaylist.isSmart) return;
    playlistFolderService.movePlaylistToFolder(activePlaylist.id, targetFolderId);
    const targetName = targetFolderId ? folders.find((f) => f.id === targetFolderId)?.name || 'folder' : 'Root';
    showToast(`Moved "${activePlaylist.name}" to ${targetName}`, 'success');
  };

  const handlePlay = useCallback(
    (track: TrackMetadata) => {
      playTrack(track, playlistTracks);
    },
    [playTrack, playlistTracks]
  );

  const handleShuffleAll = useCallback(() => {
    if (playlistTracks.length > 0) {
      const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      showToast(`Shuffling playlist (${shuffled.length} tracks)`, 'info');
    }
  }, [playlistTracks, playTrack, showToast]);

  const handlePlayNext = useCallback(
    (track: TrackMetadata) => {
      playNext(track);
      showToast(`Playing next: "${track.title}"`, 'info');
    },
    [playNext, showToast]
  );

  const handleAddToQueue = useCallback(
    (track: TrackMetadata) => {
      addToQueue(track);
      showToast(`Added to queue: "${track.title}"`, 'success');
    },
    [addToQueue, showToast]
  );

  const handleToggleFavorite = useCallback(
    (trackId: string) => {
      toggleFavorite(trackId);
    },
    [toggleFavorite]
  );

  const handleAddToPlaylist = useCallback((track: TrackMetadata) => {
    setPlaylistModalTracks([track]);
  }, []);

  const handleRemoveTrack = useCallback(
    (index: number) => {
      if (activePlaylist) {
        removeTrackFromPlaylist(activePlaylist.id, index);
      }
    },
    [activePlaylist, removeTrackFromPlaylist]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, track: TrackMetadata, index: number) => {
      e.preventDefault();
      setContextMenu({
        track,
        x: e.clientX,
        y: e.clientY,
        playlistId: activePlaylist && !activePlaylist.isSmart ? activePlaylist.id : undefined,
        playlistIndex: index,
      });
    },
    [activePlaylist]
  );

  const totalDuration = playlistTracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  // Split playlists into smart, root/unfiled, and foldered
  const smartPlaylists = playlists.filter((p) => p.isSmart);
  const rootPlaylists = playlists.filter((p) => !p.isSmart && !p.folderId);
  const currentFolder = activePlaylist?.folderId
    ? folders.find((f) => f.id === activePlaylist.folderId)
    : null;

  // History count for active playlist
  const activeHistoryEntries = activePlaylist && !activePlaylist.isSmart
    ? playlistFolderService.getHistoryForPlaylist(activePlaylist.id)
    : [];

  return (
    <div className="h-full flex overflow-hidden select-none">
      {/* Left Column: Folders & Playlists Sidebar */}
      <div className="w-64 bg-[#0D0D12] border-r border-[#272733] p-3 flex flex-col justify-between shrink-0">
        <div className="space-y-4 overflow-y-auto">
          {/* Header & Quick Action Buttons */}
          <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
            <h2 className="font-bold text-xs uppercase tracking-wider text-[#A78BFA] flex items-center gap-1.5">
              <FolderTree size={14} />
              <span>Playlists</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCreateFolderModal(true)}
                className="p-1 rounded-lg text-[#71717A] hover:text-[#A78BFA] hover:bg-[#1B1B24] transition-colors"
                title="Create New Folder"
              >
                <FolderPlus size={15} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1 rounded-lg text-[#A78BFA] hover:text-[#C4B5FD] hover:bg-[#1B1B24] transition-colors"
                title="Create New Playlist"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Section 1: Smart Playlists */}
          {smartPlaylists.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono-numbers uppercase text-[#71717A] px-2 font-bold">
                Smart
              </span>
              {smartPlaylists.map((pl) => {
                const isSelected = activePlaylist?.id === pl.id;
                return (
                  <div
                    key={pl.id}
                    onClick={() => openPlaylistDetail(pl)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1B1B24] text-[#A78BFA] font-bold border border-[#272733]'
                        : 'hover:bg-[#14141B] text-[#A1A1AA]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {pl.smartCriteria === 'favorites' ? (
                        <Heart size={13} className="text-red-400 shrink-0" />
                      ) : (
                        <Clock size={13} className="text-[#A78BFA] shrink-0" />
                      )}
                      <span className="truncate">{pl.name}</span>
                    </div>
                    <span className="text-[10px] font-mono-numbers text-[#71717A]">
                      {pl.trackIds.length}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Section 2: Playlist Folders */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-[10px] font-mono-numbers uppercase text-[#71717A] font-bold">
                Folders ({folders.length})
              </span>
            </div>

            {folders.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-[#52525B] italic">No folders created</p>
            ) : (
              folders.map((folder) => {
                const isExpanded = expandedFolderIds.has(folder.id);
                const folderPlaylists = playlists.filter((p) => p.folderId === folder.id);
                return (
                  <div
                    key={folder.id}
                    className="space-y-0.5"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const plId = e.dataTransfer.getData('application/harmoniq-playlist-id');
                      if (plId) {
                        playlistFolderService.movePlaylistToFolder(plId, folder.id);
                        showToast(`Moved to folder "${folder.name}"`, 'success');
                      }
                    }}
                  >
                    {/* Folder Header Row */}
                    <div
                      onClick={() => toggleFolderExpand(folder.id)}
                      className="group flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-[#14141B] text-[#E4E4E7] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[#71717A]">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        {isExpanded ? (
                          <FolderOpen size={14} className="text-[#A78BFA] shrink-0" />
                        ) : (
                          <Folder size={14} className="text-[#A78BFA] shrink-0" />
                        )}
                        <span className="truncate font-semibold text-xs">{folder.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono-numbers text-[#71717A]">
                          {folderPlaylists.length}
                        </span>
                        <button
                          onClick={(e) => handleOpenRenameFolder(folder, e)}
                          title="Rename Folder"
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#71717A] hover:text-[#A78BFA] transition-opacity"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteFolder(folder, e)}
                          title="Delete Folder (Preserves Playlists)"
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#71717A] hover:text-red-400 transition-opacity"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Folder Children Playlists */}
                    {isExpanded && (
                      <div className="pl-4 space-y-0.5 border-l border-[#272733]/50 ml-2">
                        {folderPlaylists.length === 0 ? (
                          <p className="text-[10px] text-[#52525B] py-1 pl-2 italic">
                            Empty folder (drag playlists here)
                          </p>
                        ) : (
                          folderPlaylists.map((pl) => {
                            const isSelected = activePlaylist?.id === pl.id;
                            return (
                              <div
                                key={pl.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/harmoniq-playlist-id', pl.id);
                                }}
                                onClick={() => openPlaylistDetail(pl)}
                                className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#1B1B24] text-[#A78BFA] font-bold border border-[#272733]'
                                    : 'hover:bg-[#14141B] text-[#A1A1AA]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <ListMusic
                                    size={13}
                                    className={isSelected ? 'text-[#A78BFA] shrink-0' : 'text-[#71717A] shrink-0'}
                                  />
                                  <span className="truncate">{pl.name}</span>
                                </div>
                                <span className="text-[10px] font-mono-numbers text-[#71717A]">
                                  {pl.trackIds.length}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Section 3: Root / Unfiled Playlists */}
          <div
            className="space-y-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const plId = e.dataTransfer.getData('application/harmoniq-playlist-id');
              if (plId) {
                playlistFolderService.movePlaylistToFolder(plId, null);
                showToast('Moved playlist to Root', 'info');
              }
            }}
          >
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-[10px] font-mono-numbers uppercase text-[#71717A] font-bold">
                Unfiled Playlists ({rootPlaylists.length})
              </span>
            </div>

            {rootPlaylists.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-[#52525B] italic">All playlists organized in folders</p>
            ) : (
              rootPlaylists.map((pl) => {
                const isSelected = activePlaylist?.id === pl.id;
                return (
                  <div
                    key={pl.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/harmoniq-playlist-id', pl.id);
                    }}
                    onClick={() => openPlaylistDetail(pl)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1B1B24] text-[#A78BFA] font-bold border border-[#272733]'
                        : 'hover:bg-[#14141B] text-[#A1A1AA]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ListMusic
                        size={13}
                        className={isSelected ? 'text-[#A78BFA] shrink-0' : 'text-[#71717A] shrink-0'}
                      />
                      <span className="truncate">{pl.name}</span>
                    </div>
                    <span className="text-[10px] font-mono-numbers text-[#71717A]">
                      {pl.trackIds.length}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Import M3U */}
        <div className="pt-3 border-t border-[#272733]">
          <button
            onClick={() => setShowIoModal('import')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <Upload size={14} />
            <span>Import M3U / M3U8</span>
          </button>
        </div>
      </div>

      {/* Right Column: Playlist Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {activePlaylist ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#272733] gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-numbers font-bold uppercase tracking-wider text-[#A78BFA]">
                    {activePlaylist.isSmart ? 'Smart Playlist' : 'Custom Playlist'}
                  </span>

                  {/* Folder Indicator / Badge */}
                  {!activePlaylist.isSmart && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#A1A1AA] bg-[#14141B] px-2 py-0.5 rounded-md border border-[#272733]">
                      <Folder size={12} className="text-[#A78BFA]" />
                      <span>{currentFolder ? currentFolder.name : 'Root'}</span>
                      {folders.length > 0 && (
                        <select
                          value={activePlaylist.folderId || ''}
                          onChange={(e) => handleMoveActiveToFolder(e.target.value ? e.target.value : null)}
                          className="bg-transparent text-[10px] text-[#A78BFA] outline-none cursor-pointer ml-1 font-mono-numbers"
                          title="Move playlist to another folder"
                        >
                          <option value="" className="bg-[#14141B] text-[#F5F3FF]">Root</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id} className="bg-[#14141B] text-[#F5F3FF]">
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#F5F3FF]">
                    {activePlaylist.name}
                  </h1>
                  {!activePlaylist.isSmart && (
                    <button
                      onClick={handleOpenRename}
                      title="Rename Playlist"
                      className="p-1.5 rounded-lg text-[#71717A] hover:text-[#A78BFA] hover:bg-[#1B1B24] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#A1A1AA]">
                  {activePlaylist.description || `${playlistTracks.length} Tracks in playlist`}
                </p>
                <div className="text-[11px] text-[#71717A] font-mono-numbers pt-1">
                  {playlistTracks.length} Tracks • {Math.round(totalDuration / 60)} min total
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                {playlistTracks.length > 0 && (
                  <>
                    <button
                      onClick={() => playTrack(playlistTracks[0], playlistTracks)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
                    >
                      <Play size={14} className="ml-0.5" />
                      <span>Play All</span>
                    </button>
                    <button
                      onClick={handleShuffleAll}
                      title="Shuffle Playlist"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-colors"
                    >
                      <Shuffle size={14} />
                      <span>Shuffle</span>
                    </button>
                  </>
                )}

                {!activePlaylist.isSmart && (
                  <>
                    <button
                      onClick={() => setShowAddSongsModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A78BFA] hover:text-[#C4B5FD] text-xs font-semibold transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Songs</span>
                    </button>

                    {/* Playlist History Modal Trigger */}
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      title="View Version History & Restore"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#A78BFA] text-xs font-semibold transition-colors"
                    >
                      <History size={14} />
                      <span>History</span>
                      {activeHistoryEntries.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#7C3AED]/20 text-[#A78BFA] text-[10px] font-mono">
                          {activeHistoryEntries.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setShowIoModal('export')}
                      title="Export M3U / M3U8"
                      className="p-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={handleDelete}
                      title="Delete Playlist"
                      className="p-2 rounded-xl bg-[#14141B] hover:bg-red-950/40 border border-[#272733] text-[#A1A1AA] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tracks List */}
            <div className="space-y-1">
              {playlistTracks.length === 0 ? (
                <div className="py-12">
                  <HarmoniqEmptyState
                    type="empty_playlists"
                    title="Playlist is Empty"
                    description="Add songs from your music library to this playlist."
                    action={
                      !activePlaylist.isSmart
                        ? {
                            label: 'Add Songs from Library',
                            onClick: () => setShowAddSongsModal(true),
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="w-full">
                  {/* Table Header matching SongRow CSS Grid */}
                  <SongTableHeader showAlbum={true} />

                  {/* Stable, Memoized Song Rows */}
                  <div className="space-y-0.5">
                    {playlistTracks.map((track, idx) => (
                      <SongRow
                        key={`${track.id}_${idx}`}
                        track={track}
                        index={idx}
                        isCurrent={currentTrack?.id === track.id}
                        isPlaying={currentTrack?.id === track.id && isPlaying}
                        showAlbum={true}
                        onPlay={handlePlay}
                        onPlayNext={handlePlayNext}
                        onAddToQueue={handleAddToQueue}
                        onToggleFavorite={handleToggleFavorite}
                        onAddToPlaylist={handleAddToPlaylist}
                        onContextMenu={handleContextMenu}
                        onRemoveFromPlaylist={!activePlaylist.isSmart ? handleRemoveTrack : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-16">
            <HarmoniqEmptyState
              type="empty_playlists"
              title="No Playlist Selected"
              description="Choose a playlist from the left panel or create a new playlist."
              action={{
                label: 'Create Playlist',
                onClick: () => setShowCreateModal(true),
              }}
            />
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-sm p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
              <FolderPlus size={18} className="text-[#A78BFA]" />
              <span>Create Playlist Folder</span>
            </h3>
            <p className="text-xs text-[#71717A]">
              Group and organize multiple playlists together without cluttering your library.
            </p>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name (e.g., Chill Vibes, Workouts)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateFolderModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-50 text-xs font-bold text-[#F5F3FF]"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameFolderModal && folderToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleRenameFolder}
            className="w-full max-w-sm p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF]">Rename Folder</h3>
            <input
              type="text"
              autoFocus
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder="New Folder Name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameFolderModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameFolderName.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-50 text-xs font-bold text-[#F5F3FF]"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF]">Create New Playlist</h3>
            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
              />
              <textarea
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                placeholder="Description (Optional)"
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-50 text-xs font-bold text-[#F5F3FF]"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Playlist Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleRename}
            className="w-full max-w-sm p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-[#F5F3FF]">Rename Playlist</h3>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="New Playlist Name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#71717A] hover:text-[#F5F3FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameValue.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] disabled:opacity-50 text-xs font-bold text-[#F5F3FF]"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlist Version History Modal */}
      <PlaylistHistoryModal
        playlist={activePlaylist && !activePlaylist.isSmart ? activePlaylist : null}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />

      <TrackContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onOpenAddToPlaylist={(track) => setPlaylistModalTracks([track])}
      />

      <AddToPlaylistModal
        isOpen={!!playlistModalTracks}
        onClose={() => setPlaylistModalTracks(null)}
        tracks={playlistModalTracks || []}
      />

      <AddSongsToPlaylistModal
        isOpen={showAddSongsModal}
        onClose={() => setShowAddSongsModal(false)}
        playlist={activePlaylist && !activePlaylist.isSmart ? activePlaylist : null}
      />

      {showIoModal && (
        <PlaylistImportExportModal
          initialMode={showIoModal}
          activePlaylist={activePlaylist}
          onClose={() => setShowIoModal(null)}
        />
      )}
    </div>
  );
};
