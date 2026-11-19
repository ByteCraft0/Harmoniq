import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { favoritesService, FavoritesFilterOptions } from '../../services/favoritesService';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  Heart,
  Play,
  Shuffle,
  Plus,
  Search,
  Filter,
  Globe,
  Music,
  FolderPlus,
  ListPlus,
  Disc,
} from 'lucide-react';

export const FavoritesView: React.FC = () => {
  const { playTrack, addToQueue, playNext, currentTrack, isPlaying } = usePlayer();
  const { toggleFavorite } = useLibrary();
  const { showToast } = useToast();

  const [favoritesList, setFavoritesList] = useState<TrackMetadata[]>([]);
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [artistFilter, setArtistFilter] = useState<string>('all');
  const [albumFilter, setAlbumFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dateAdded' | 'title' | 'artist' | 'lastPlayed'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  const refresh = useCallback(() => {
    setFavoritesList(
      favoritesService.getFavorites({
        provider: providerFilter === 'all' ? undefined : providerFilter,
        artist: artistFilter === 'all' ? undefined : artistFilter,
        album: albumFilter === 'all' ? undefined : albumFilter,
        searchQuery,
        sortBy,
        sortOrder,
      })
    );
  }, [providerFilter, artistFilter, albumFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
    const unsub = favoritesService.subscribe(refresh);
    return unsub;
  }, [refresh]);

  const uniqueArtists = useMemo(() => favoritesService.getUniqueArtists(), [favoritesList]);
  const uniqueAlbums = useMemo(() => favoritesService.getUniqueAlbums(), [favoritesList]);
  const uniqueProviders = useMemo(() => favoritesService.getUniqueProviders(), [favoritesList]);

  const handlePlayAll = () => {
    if (favoritesList.length > 0) {
      playTrack(favoritesList[0], favoritesList);
      showToast(`Playing all favorites (${favoritesList.length} tracks)`, 'info');
    }
  };

  const handleShuffleAll = () => {
    if (favoritesList.length > 0) {
      const shuffled = [...favoritesList].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      showToast(`Shuffling all favorites (${shuffled.length} tracks)`, 'info');
    }
  };

  const handleToggleFavorite = (track: TrackMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track);
  };

  const handleContextMenu = (e: React.MouseEvent, track: TrackMetadata, index: number) => {
    e.preventDefault();
    setContextMenu({
      track,
      x: e.clientX,
      y: e.clientY,
      playlistIndex: index,
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#09090B] text-white overflow-hidden p-6 space-y-6 select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#272733]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Heart size={24} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#F5F3FF] tracking-tight">Your Favorites</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono-numbers bg-[#1B1B24] border border-[#272733] text-[#A78BFA]">
                {favoritesList.length} Tracks
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Unified favorite collection across your local library and connected music discovery engines
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePlayAll}
            disabled={favoritesList.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-95 text-white text-xs font-bold shadow-glow-sm transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
          >
            <Play size={14} fill="currentColor" />
            <span>Play All</span>
          </button>

          <button
            onClick={handleShuffleAll}
            disabled={favoritesList.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#F5F3FF] transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
          >
            <Shuffle size={14} />
            <span>Shuffle</span>
          </button>

          <button
            onClick={() => setPlaylistModalTracks(favoritesList)}
            disabled={favoritesList.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
          >
            <FolderPlus size={14} />
            <span>Add to Playlist</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#14141B] border border-[#272733]">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-[#272733] w-full sm:w-64">
          <Search size={14} className="text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search favorites..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Filters and Sorters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Provider Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Globe size={12} /> Source:
            </span>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="bg-[#1B1B24] border border-[#272733] text-xs text-zinc-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="local">Local Library</option>
              {uniqueProviders
                .filter((p) => p !== 'local')
                .map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
            </select>
          </div>

          {/* Artist Filter */}
          {uniqueArtists.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Filter size={12} /> Artist:
              </span>
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                className="bg-[#1B1B24] border border-[#272733] text-xs text-zinc-200 rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[130px]"
              >
                <option value="all">All Artists</option>
                {uniqueArtists.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#1B1B24] border border-[#272733] text-xs text-zinc-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="dateAdded">Recently Added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="lastPlayed">Recently Played</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title="Toggle sort direction"
              className="px-2 py-1 bg-[#1B1B24] border border-[#272733] text-xs rounded-lg text-zinc-400 hover:text-white"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {favoritesList.length === 0 ? (
          <HarmoniqEmptyState
            type="empty_favorites"
            title="No Favorite Tracks Yet"
            description="Click the heart icon on any track in your library or Universal Music to curate your personal collection of favorites."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {favoritesList.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const provider = track.providerId || (track.isOnline ? 'Online' : 'Local');

              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, favoritesList)}
                  onContextMenu={(e) => handleContextMenu(e, track, idx)}
                  className="group relative p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#7C3AED]/50 transition-all cursor-pointer flex flex-col space-y-2.5 shadow-card"
                >
                  {/* Artwork Container */}
                  <div className="relative aspect-square w-full rounded-xl bg-black/40 overflow-hidden flex items-center justify-center border border-[#272733]">
                    {track.artworkDataUrl ? (
                      <img
                        src={track.artworkDataUrl}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Disc size={36} className="text-zinc-600" />
                    )}

                    {/* Hover Floating Play Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(track, favoritesList);
                        }}
                        className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm hover:scale-110 active:scale-95 transition-all"
                      >
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      </button>
                    </div>

                    {/* Favorite Heart Badge */}
                    <button
                      onClick={(e) => handleToggleFavorite(track, e)}
                      title="Remove from Favorites"
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-rose-500 hover:text-rose-400 hover:scale-110 transition-all z-10"
                    >
                      <Heart size={14} fill="currentColor" />
                    </button>

                    {/* Provider Pill */}
                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-mono-numbers font-bold uppercase tracking-wider bg-black/70 backdrop-blur-md border border-white/10 text-zinc-300">
                        {provider}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0">
                    <h3
                      className={`font-semibold text-xs truncate transition-colors ${
                        isCurrent ? 'text-[#A78BFA]' : 'text-[#F5F3FF] group-hover:text-[#A78BFA]'
                      }`}
                    >
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{track.artist}</p>
                    {track.album && (
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">{track.album}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {contextMenu && (
        <TrackContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenAddToPlaylist={(track: TrackMetadata) => setPlaylistModalTracks([track])}
        />
      )}

      {playlistModalTracks && (
        <AddToPlaylistModal
          isOpen={true}
          tracks={playlistModalTracks}
          onClose={() => setPlaylistModalTracks(null)}
        />
      )}
    </div>
  );
};
