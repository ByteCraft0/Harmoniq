import React, { useMemo, useState } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { ListMusic, Plus, Sparkles, Heart } from 'lucide-react';
import { Playlist } from '../../../types/library';
import { MobilePlaylistDetailView } from './MobilePlaylistDetailView';
import { useMobileNavigation } from '../MobileNavigationContext';
import { MobilePlaylistModal } from '../playlists/MobilePlaylistModal';

interface MobilePlaylistsViewProps {
  initialPlaylistId?: string | null;
  onClearSelectedPlaylist?: () => void;
  onBrowseLibrary?: () => void;
}

export const MobilePlaylistsView: React.FC<MobilePlaylistsViewProps> = ({
  initialPlaylistId,
  onClearSelectedPlaylist,
  onBrowseLibrary,
}) => {
  const { playlists, tracks, createPlaylist } = useLibrary();
  const { openPlaylist, closePlaylist } = useMobileNavigation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Ensure Favorite Tracks smart playlist is always present
  const allPlaylists = useMemo<Playlist[]>(() => {
    const list = [...playlists];
    const favExists = list.some((p) => p.id === 'smart_favorites' || p.smartCriteria === 'favorites');
    if (!favExists) {
      list.unshift({
        id: 'smart_favorites',
        name: 'Favorite Tracks',
        description: 'All your starred favorite tracks',
        trackIds: tracks.filter((t) => t.isFavorite).map((t) => t.id),
        isSmart: true,
        smartCriteria: 'favorites',
        dateCreated: Date.now(),
        dateModified: Date.now(),
      });
    }
    return list;
  }, [playlists, tracks]);

  const selectedPlaylist = useMemo(() => {
    if (!initialPlaylistId) return null;
    return allPlaylists.find((p) => p.id === initialPlaylistId) || null;
  }, [initialPlaylistId, allPlaylists]);

  const handleCreate = (name: string, description?: string) => {
    createPlaylist(name, description);
  };

  // If a playlist is selected, render the dedicated Detail View
  if (selectedPlaylist) {
    return (
      <MobilePlaylistDetailView
        playlist={selectedPlaylist}
        onBack={() => {
          closePlaylist();
          onClearSelectedPlaylist?.();
        }}
        onBrowseLibrary={onBrowseLibrary}
      />
    );
  }

  return (
    <div className="space-y-4 pb-40">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Playlists</h2>
          <p className="text-xs text-zinc-500">Smart & custom collections</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium active:scale-95 transition-all shadow-md shadow-violet-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>New</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {allPlaylists.map((pl) => {
          const isFav = pl.id === 'smart_favorites' || pl.smartCriteria === 'favorites';
          const trackCount = isFav
            ? tracks.filter((t) => t.isFavorite).length
            : pl.trackIds.length;

          return (
            <div
              key={pl.id}
              onClick={() => openPlaylist(pl.id)}
              className="p-3.5 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/40 active:scale-98 transition-all flex flex-col justify-between space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isFav
                      ? 'bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-400'
                      : 'bg-violet-600/20 border border-violet-500/30 text-violet-400'
                  }`}
                >
                  {isFav ? <Heart className="w-5 h-5 fill-fuchsia-400/20" /> : <ListMusic className="w-5 h-5" />}
                </div>
                {pl.isSmart && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-violet-950/60 border border-violet-800/40 text-violet-300 flex items-center space-x-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Smart</span>
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white truncate">{pl.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <MobilePlaylistModal
        isOpen={isCreateModalOpen}
        title="Create Playlist"
        confirmLabel="Create"
        onConfirm={handleCreate}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
