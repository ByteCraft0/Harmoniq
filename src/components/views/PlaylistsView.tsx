import React, { useState, useCallback } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import { SongRow, SongTableHeader } from '../layout/SongRow';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { AddSongsToPlaylistModal } from '../layout/AddSongsToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
import { Playlist } from '../../types/library';
import { PlaylistImportExportModal } from '../library/PlaylistImportExportModal';
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
    exportPlaylistM3u,
    importPlaylistM3u,
    toggleFavorite,
  } = useLibrary();

  const { playTrack, playNext, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);
  const [showIoModal, setShowIoModal] = useState<'import' | 'export' | null>(null);

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

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const name = file.name.replace(/\.[^/.]+$/, '');
          importPlaylistM3u(name, content);
        }
      };
      reader.readAsText(file);
    }
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

  return (
    <div className="h-full flex overflow-hidden select-none">
      {/* Left Column: Playlists Sidebar */}
      <div className="w-64 bg-[#0D0D12] border-r border-[#272733] p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
            <h2 className="font-bold text-sm text-[#F5F3FF]">Playlists</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 rounded-lg text-[#A78BFA] hover:text-[#C4B5FD] hover:bg-[#1B1B24] transition-colors"
              title="Create New Playlist"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            {playlists.map((pl) => {
              const isSelected = activePlaylist?.id === pl.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => openPlaylistDetail(pl)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1B1B24] text-[#A78BFA] font-bold border border-[#272733]'
                      : 'hover:bg-[#14141B] text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {pl.smartCriteria === 'favorites' ? (
                      <Heart size={14} className="text-red-400 shrink-0" />
                    ) : pl.smartCriteria === 'recently_played' ? (
                      <Clock size={14} className="text-[#A78BFA] shrink-0" />
                    ) : (
                      <ListMusic size={14} className={isSelected ? 'text-[#A78BFA] shrink-0' : 'text-[#71717A] shrink-0'} />
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
            <div className="flex items-center justify-between pb-6 border-b border-[#272733]">
              <div className="space-y-1">
                <span className="text-xs font-mono-numbers font-bold uppercase tracking-wider text-[#A78BFA]">
                  {activePlaylist.isSmart ? 'Smart Playlist' : 'Custom Playlist'}
                </span>
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

              <div className="flex items-center gap-2.5">
                {playlistTracks.length > 0 && (
                  <>
                    <button
                      onClick={() => playTrack(playlistTracks[0], playlistTracks)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
                    >
                      <Play size={15} className="ml-0.5" />
                      <span>Play All</span>
                    </button>
                    <button
                      onClick={handleShuffleAll}
                      title="Shuffle Playlist"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-colors"
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A78BFA] hover:text-[#C4B5FD] text-xs font-semibold transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Songs</span>
                    </button>
                    <button
                      onClick={() => setShowIoModal('export')}
                      title="Export M3U / M3U8"
                      className="p-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={handleDelete}
                      title="Delete Playlist"
                      className="p-2.5 rounded-xl bg-[#14141B] hover:bg-red-950/40 border border-[#272733] text-[#A1A1AA] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tracks List */}
            <div className="space-y-1">
              {playlistTracks.length === 0 ? (
                <div className="p-12 text-center text-[#71717A] text-xs space-y-3">
                  <ListMusic size={38} className="mx-auto text-[#3F3F46]" />
                  <div>
                    <p className="font-bold text-[#F5F3FF] text-sm">Playlist is Empty</p>
                    <p className="mt-1 text-[#A1A1AA]">Add songs from your music library to this playlist.</p>
                  </div>
                  {!activePlaylist.isSmart && (
                    <button
                      onClick={() => setShowAddSongsModal(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95 mt-2"
                    >
                      <Plus size={15} />
                      <span>Add Songs from Library</span>
                    </button>
                  )}
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
          <div className="p-8 text-center text-[#71717A]">
            <p>Select a playlist to view tracks.</p>
          </div>
        )}
      </div>

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
