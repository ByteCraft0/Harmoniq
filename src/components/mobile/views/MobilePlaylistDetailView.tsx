import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { usePlayer } from '../../../context/PlayerContext';
import { Playlist } from '../../../types/library';
import { TrackMetadata } from '../../../types/audio';
import { getArtworkUrl } from '../../../services/platform';
import { MobileConfirmDialog } from '../common/MobileConfirmDialog';
import { MobilePlaylistModal } from '../playlists/MobilePlaylistModal';
import { MobileSongMenuSheet } from '../layout/MobileSongMenuSheet';
import { useBackHandler } from '../MobileNavigationContext';
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Heart,
  Music,
  Sparkles,
  ListMusic,
  Disc,
  Edit3,
  Trash2,
  Plus,
  MoreVertical,
  Search,
  Check,
  X,
  History,
} from 'lucide-react';

interface MobilePlaylistDetailViewProps {
  playlist: Playlist;
  onBack: () => void;
  onBrowseLibrary?: () => void;
}

export const MobilePlaylistDetailView: React.FC<MobilePlaylistDetailViewProps> = ({
  playlist,
  onBack,
  onBrowseLibrary,
}) => {
  const {
    tracks,
    toggleFavorite,
    renamePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    clearHistory,
  } = useLibrary();
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [isAddSongsOpen, setIsAddSongsOpen] = useState(false);
  const [addSongsSearch, setAddSongsSearch] = useState('');
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<TrackMetadata | null>(null);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);

  const isFavorites = playlist.id === 'smart_favorites' || playlist.smartCriteria === 'favorites';
  const isRecentlyPlayed = playlist.id === 'smart_recently_played' || playlist.smartCriteria === 'recently_played';
  const isMostPlayed = playlist.id === 'smart_most_played' || playlist.smartCriteria === 'most_played';
  const isCustom = !isFavorites && !playlist.isSmart;

  // Priority 1: Dialogs and modals
  useBackHandler(
    1,
    () => {
      if (isAddSongsOpen) {
        setIsAddSongsOpen(false);
        return true;
      }
      if (isRenameOpen) {
        setIsRenameOpen(false);
        return true;
      }
      if (isDeleteConfirmOpen) {
        setIsDeleteConfirmOpen(false);
        return true;
      }
      if (isClearHistoryConfirmOpen) {
        setIsClearHistoryConfirmOpen(false);
        return true;
      }
      return false;
    },
    isAddSongsOpen || isRenameOpen || isDeleteConfirmOpen || isClearHistoryConfirmOpen
  );

  // Resolve playlist tracks
  const playlistTracks = useMemo<TrackMetadata[]>(() => {
    if (isFavorites) {
      return tracks.filter((t) => t.isFavorite);
    }
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return playlist.trackIds
      .map((id) => trackMap.get(id))
      .filter((t): t is TrackMetadata => Boolean(t));
  }, [isFavorites, tracks, playlist.trackIds]);

  const totalDurationSecs = useMemo(() => {
    return playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  }, [playlistTracks]);

  const formatTotalTime = (totalSecs: number) => {
    if (!totalSecs || totalSecs <= 0) return '0 min';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) {
      return `${hrs} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  const formatTrackDuration = (secs?: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayAll = () => {
    if (playlistTracks.length === 0) return;
    playTrack(playlistTracks[0], playlistTracks);
  };

  const handleShuffle = () => {
    if (playlistTracks.length === 0) return;
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  const handleRename = (newName: string, newDesc?: string) => {
    renamePlaylist(playlist.id, newName, newDesc);
    setIsRenameOpen(false);
  };

  const handleDelete = () => {
    deletePlaylist(playlist.id);
    setIsDeleteConfirmOpen(false);
    onBack();
  };

  const handleRemoveTrack = (index: number) => {
    removeTrackFromPlaylist(playlist.id, index);
  };

  // Filter available library tracks for Add Songs modal
  const filteredLibraryTracks = useMemo(() => {
    if (!addSongsSearch.trim()) return tracks;
    const q = addSongsSearch.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, addSongsSearch]);

  return (
    <div className="space-y-4 pb-40 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
          <button
            onClick={onBack}
            aria-label="Back to playlists"
            className="p-2 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/50 text-zinc-300 hover:text-white active:scale-95 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-white tracking-tight truncate">
              {playlist.name}
            </h2>
            <p className="text-xs text-zinc-500">
              {playlistTracks.length} tracks • {formatTotalTime(totalDurationSecs)}
            </p>
          </div>
        </div>

        {/* Custom Playlist Header Actions */}
        {isCustom && (
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={() => setIsRenameOpen(true)}
              className="p-2 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/50 text-zinc-300 hover:text-white active:scale-95 transition-all"
              title="Rename Playlist"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="p-2 rounded-xl bg-[#14141b] border border-[#272733] hover:border-red-500/50 text-zinc-400 hover:text-red-400 active:scale-95 transition-all"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Recently Played Header Actions (Clear History) */}
        {isRecentlyPlayed && playlistTracks.length > 0 && (
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={() => setIsClearHistoryConfirmOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#14141b] border border-[#272733] hover:border-red-500/50 text-zinc-400 hover:text-red-400 active:scale-95 transition-all text-xs font-medium flex items-center space-x-1.5"
              title="Clear History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Playlist Hero Banner Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl ${
          isFavorites
            ? 'bg-gradient-to-br from-fuchsia-950/40 via-[#14141b] to-[#09090b] border-fuchsia-800/30'
            : isRecentlyPlayed
            ? 'bg-gradient-to-br from-blue-950/40 via-[#14141b] to-[#09090b] border-blue-800/30'
            : isMostPlayed
            ? 'bg-gradient-to-br from-amber-950/40 via-[#14141b] to-[#09090b] border-amber-800/30'
            : 'bg-gradient-to-br from-violet-950/40 via-[#14141b] to-[#09090b] border-violet-800/30'
        }`}
      >
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
              isFavorites
                ? 'bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-900/40'
                : isRecentlyPlayed
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-900/40'
                : isMostPlayed
                ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-amber-900/40'
                : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-900/40'
            }`}
          >
            {isFavorites ? (
              <Heart className="w-7 h-7 fill-white" />
            ) : isRecentlyPlayed ? (
              <History className="w-7 h-7" />
            ) : isMostPlayed ? (
              <Sparkles className="w-7 h-7" />
            ) : playlist.isSmart ? (
              <Sparkles className="w-7 h-7" />
            ) : (
              <ListMusic className="w-7 h-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white truncate">{playlist.name}</h3>
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
              {playlist.description ||
                (isFavorites
                  ? 'All your starred favorite tracks in one collection.'
                  : 'Custom audio playlist.')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-white/5">
          {playlistTracks.length > 0 && (
            <>
              <button
                onClick={handlePlayAll}
                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-98 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-lg shadow-violet-900/40 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play All</span>
              </button>
              <button
                onClick={handleShuffle}
                className="flex-1 py-2 rounded-xl bg-[#1b1b24] hover:bg-[#232330] active:scale-98 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center space-x-1.5 border border-[#272733] transition-all"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
            </>
          )}

          {isCustom && (
            <button
              onClick={() => setIsAddSongsOpen(true)}
              className="py-2 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 active:scale-98 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-violet-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Songs</span>
            </button>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-1">
        {playlistTracks.length === 0 ? (
          <div className="rounded-2xl bg-[#14141b] border border-[#272733] p-8 text-center space-y-4 my-2">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${
                isFavorites
                  ? 'bg-fuchsia-600/10 border-fuchsia-500/20 text-fuchsia-400'
                  : isRecentlyPlayed
                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                  : isMostPlayed
                  ? 'bg-amber-600/10 border-amber-500/20 text-amber-400'
                  : 'bg-violet-600/10 border-violet-500/20 text-violet-400'
              }`}
            >
              {isFavorites ? (
                <Heart className="w-7 h-7" />
              ) : isRecentlyPlayed ? (
                <History className="w-7 h-7" />
              ) : isMostPlayed ? (
                <Sparkles className="w-7 h-7" />
              ) : (
                <Music className="w-7 h-7" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {isFavorites
                  ? 'No Favorite Tracks Yet'
                  : isRecentlyPlayed
                  ? 'No Recently Played Tracks'
                  : isMostPlayed
                  ? 'No Play Statistics Yet'
                  : 'This Playlist is Empty'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {isFavorites
                  ? 'Tap the heart icon on any song in your library to add it to your favorites.'
                  : isRecentlyPlayed
                  ? 'Songs you play will automatically appear here, ordered by your latest listening sessions.'
                  : isMostPlayed
                  ? 'Tracks will appear here as you listen to them, ranked by play count.'
                  : 'Add songs to this playlist from your library or using the button below.'}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              {isCustom && (
                <button
                  onClick={() => setIsAddSongsOpen(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-semibold shadow-lg shadow-violet-900/30 transition-all flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Songs to Playlist</span>
                </button>
              )}
              {onBrowseLibrary && (
                <button
                  onClick={onBrowseLibrary}
                  className="px-4 py-2 rounded-xl bg-[#1b1b24] border border-[#272733] hover:border-violet-500 active:scale-95 text-zinc-300 hover:text-white text-xs font-semibold transition-all"
                >
                  Browse Music Library
                </button>
              )}
            </div>
          </div>
        ) : (
          playlistTracks.map((track, trackIdx) => {
            const isCurrent = currentTrack?.id === track.id;
            const artUrl = getArtworkUrl(track.artworkDataUrl);
            return (
              <div
                key={`${track.id}_${trackIdx}`}
                onClick={() => playTrack(track, playlistTracks)}
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
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-violet-400' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-zinc-500 truncate">
                      <span className="truncate">{track.artist}</span>
                      {isMostPlayed && (track.playCount ?? 0) > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono font-medium">
                            {track.playCount} {track.playCount === 1 ? 'play' : 'plays'}
                          </span>
                        </>
                      )}
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
                    {formatTrackDuration(track.duration)}
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
                        track.isFavorite
                          ? 'fill-red-500 text-red-500'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackForMenu(track);
                      setSelectedTrackIndex(trackIdx);
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

      {/* Rename Playlist Modal */}
      <MobilePlaylistModal
        isOpen={isRenameOpen}
        title="Rename Playlist"
        initialName={playlist.name}
        initialDescription={playlist.description}
        confirmLabel="Save"
        onConfirm={handleRename}
        onClose={() => setIsRenameOpen(false)}
      />

      {/* Delete Playlist Confirmation Dialog */}
      <MobileConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Delete Playlist?"
        message={`Are you sure you want to delete "${playlist.name}"? Your music files will remain safe on your device.`}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      {/* Clear History Confirmation Dialog */}
      <MobileConfirmDialog
        isOpen={isClearHistoryConfirmOpen}
        title="Clear Listening History?"
        message="Are you sure you want to clear your listening history? This will remove all songs from Recently Played."
        confirmLabel="Clear"
        isDestructive={true}
        onConfirm={() => {
          clearHistory();
          setIsClearHistoryConfirmOpen(false);
        }}
        onCancel={() => setIsClearHistoryConfirmOpen(false)}
      />

      {/* Song Options Sheet */}
      <MobileSongMenuSheet
        isOpen={selectedTrackForMenu !== null}
        track={selectedTrackForMenu}
        playlistContextId={isCustom ? playlist.id : null}
        onRemoveFromPlaylist={
          selectedTrackIndex !== null
            ? () => handleRemoveTrack(selectedTrackIndex)
            : undefined
        }
        onClose={() => {
          setSelectedTrackForMenu(null);
          setSelectedTrackIndex(null);
        }}
      />

      {/* Add Songs Picker Modal */}
      {isAddSongsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#14141b] border border-[#272733] p-4 flex flex-col max-h-[85vh] text-white shadow-2xl animate-in slide-in-from-bottom duration-250"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#272733]">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Add Songs</h3>
                <p className="text-xs text-zinc-400">Tap a song to add to "{playlist.name}"</p>
              </div>
              <button
                onClick={() => setIsAddSongsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                aria-label="Close add songs dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={addSongsSearch}
                onChange={(e) => setAddSongsSearch(e.target.value)}
                placeholder="Search tracks to add..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#1b1b24] border border-[#2b2b3a] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {addSongsSearch && (
                <button
                  onClick={() => setAddSongsSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-72 overscroll-contain pr-1">
              {filteredLibraryTracks.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No matching tracks in library
                </div>
              ) : (
                filteredLibraryTracks.map((t) => {
                  const alreadyInPlaylist = playlist.trackIds.includes(t.id);
                  const artUrl = getArtworkUrl(t.artworkDataUrl);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (!alreadyInPlaylist) {
                          addTracksToPlaylist(playlist.id, [t.id]);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        alreadyInPlaylist
                          ? 'bg-violet-950/20 border-violet-800/30 text-zinc-400 opacity-75'
                          : 'bg-[#1b1b24] hover:bg-[#232330] border-[#2b2b3a] text-white cursor-pointer active:scale-99'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 overflow-hidden min-w-0 pr-2">
                        <div className="w-8 h-8 rounded-lg bg-[#272738] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
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
                            <Disc className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{t.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{t.artist}</p>
                        </div>
                      </div>

                      {alreadyInPlaylist ? (
                        <span className="flex items-center space-x-1 text-[11px] text-violet-400 font-medium px-2 py-0.5 rounded bg-violet-950/50 border border-violet-800/50 flex-shrink-0">
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="p-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 active:scale-90 transition-all flex-shrink-0"
                          title="Add track"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Done button */}
            <div className="pt-3 border-t border-[#272733] mt-2">
              <button
                onClick={() => setIsAddSongsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold active:scale-98 transition-all shadow-lg shadow-violet-900/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
