import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { historyService } from '../../services/historyService';
import { favoritesService } from '../../services/favoritesService';
import { discoveryService, RecommendationItem } from '../../services/discoveryService';
import { statsService } from '../../services/statsService';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
import {
  FolderPlus,
  Play,
  Pause,
  Heart,
  Clock,
  Sparkles,
  Music,
  Disc,
  Users,
  Flame,
  ArrowRight,
  Compass,
  Radio,
  Headphones,
  RotateCcw,
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const {
    tracks,
    albums,
    artists,
    playlists,
    stats,
    addMusicFolders,
    openAudioFiles,
    openAlbumDetail,
    openArtistDetail,
    setActiveView,
    toggleFavorite,
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);
  const [tick, setTick] = useState(0);

  // Re-render when history or favorites update
  useEffect(() => {
    const unsubH = historyService.subscribe(() => setTick((t) => t + 1));
    const unsubF = favoritesService.subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubH();
      unsubF();
    };
  }, []);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Personalized discovery data
  const discovery = useMemo(() => {
    return discoveryService.getPersonalizedDiscovery();
  }, [tick, tracks.length]);

  // Favorites
  const favorites = useMemo(() => {
    return favoritesService.getFavorites();
  }, [tick]);

  // History entries (optimized with limit to avoid full array loads)
  const recentHistory = useMemo(() => {
    return historyService.getHistory({ limit: 8 });
  }, [tick]);

  // Top artists
  const topArtists = useMemo(() => {
    return statsService.getTopArtists(5);
  }, [tick]);

  // Continue listening candidate
  const continueTrack = useMemo<TrackMetadata | null>(() => {
    if (currentTrack) return currentTrack;
    if (recentHistory.length > 0) {
      const topHist = recentHistory[0];
      const match = tracks.find((t) => t.id === topHist.trackId);
      if (match) return match;
      return {
        id: topHist.trackId,
        filePath: topHist.filePath || '',
        fileName: topHist.title,
        fileSize: 0,
        dateModified: topHist.playedAt,
        title: topHist.title,
        artist: topHist.artist,
        album: topHist.album,
        hasArtwork: Boolean(topHist.artworkDataUrl),
        artworkDataUrl: topHist.artworkDataUrl,
        codec: 'MP3',
        container: 'mp3',
        duration: topHist.duration,
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        isLossless: false,
        playCount: 1,
        isFavorite: favoritesService.isFavorite(topHist.trackId),
        isOnline: topHist.isOnline,
        providerId: topHist.providerId,
        providerTrackId: topHist.providerTrackId,
        playbackCapability: topHist.playbackCapability,
      };
    }
    return tracks.length > 0 ? tracks[0] : null;
  }, [currentTrack, recentHistory, tracks]);

  // Recently added local tracks
  const recentlyAddedTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => (b.dateAdded ?? b.dateModified) - (a.dateAdded ?? a.dateModified))
      .slice(0, 6);
  }, [tracks]);

  const handleTrackContextMenu = (e: React.MouseEvent, track: TrackMetadata) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  const handleRefreshDiscovery = (e: React.MouseEvent) => {
    e.stopPropagation();
    discoveryService.refreshPersonalizedDiscovery();
    setTick((t) => t + 1);
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-10 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* 1. HERO GREETING & CONTINUE LISTENING BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#17132B] via-[#12121A] to-[#0D0D12] border border-[#272733] p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#7C3AED]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1B24] border border-[#272733] text-[11px] font-mono-numbers text-[#A78BFA]">
              <Sparkles size={12} className="text-[#A78BFA]" />
              <span>Harmoniq Listening Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-[#F5F3FF] tracking-tight">
              {greeting}, Audiophile
            </h1>

            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Your personalized music space. Rediscover favorites, explore intelligent mixes, and experience bit-perfect sound.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={addMusicFolders}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-95 text-[#F5F3FF] text-xs font-bold shadow-glow-sm transition-all active:scale-95"
              >
                <FolderPlus size={15} />
                <span>Add Music Folder</span>
              </button>

              <button
                onClick={openAudioFiles}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-all active:scale-95"
              >
                <Music size={15} />
                <span>Open Audio Files</span>
              </button>
            </div>
          </div>

          {/* Continue Listening Hero Card */}
          {continueTrack && (
            <div className="w-full lg:w-80 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-[#272733] flex items-center gap-4 shadow-card">
              <div className="relative w-16 h-16 rounded-xl bg-[#09090B] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center">
                {continueTrack.artworkDataUrl ? (
                  <img
                    src={continueTrack.artworkDataUrl}
                    alt={continueTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc size={28} className="text-zinc-600" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="text-[10px] font-mono-numbers uppercase tracking-wider text-[#A78BFA] font-bold">
                  Continue Listening
                </span>
                <p className="text-xs font-bold text-[#F5F3FF] truncate">{continueTrack.title}</p>
                <p className="text-[11px] text-[#A1A1AA] truncate">{continueTrack.artist}</p>
              </div>

              <button
                onClick={() => {
                  if (currentTrack?.id === continueTrack.id) {
                    togglePlayPause();
                  } else {
                    playTrack(continueTrack);
                  }
                }}
                className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm hover:scale-110 active:scale-95 transition-all shrink-0"
                title={isPlaying && currentTrack?.id === continueTrack.id ? 'Pause' : 'Play'}
              >
                {isPlaying && currentTrack?.id === continueTrack.id ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" className="ml-0.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. RECENTLY PLAYED SECTION */}
      {recentHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F5F3FF]">Recently Played</h2>
              <p className="text-xs text-[#A1A1AA]">Pick up where your last session ended</p>
            </div>
            <button
              onClick={() => setActiveView('recently_played')}
              className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View Full History</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentHistory.slice(0, 6).map((entry) => {
              const isCurrent = currentTrack?.id === entry.trackId;
              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    const t = tracks.find((tr) => tr.id === entry.trackId);
                    if (t) playTrack(t);
                  }}
                  className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#7C3AED]/40 cursor-pointer flex flex-col space-y-2.5 transition-all shadow-card"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-black/40 overflow-hidden flex items-center justify-center border border-[#272733]">
                    {entry.artworkDataUrl ? (
                      <img
                        src={entry.artworkDataUrl}
                        alt={entry.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Disc size={32} className="text-zinc-600" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm">
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      </button>
                    </div>

                    <div className="absolute bottom-1.5 left-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-numbers bg-black/70 backdrop-blur-md border border-white/10 text-zinc-300 capitalize">
                        {entry.providerId || 'Local'}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`font-semibold text-xs truncate transition-colors ${
                        isCurrent ? 'text-[#A78BFA]' : 'text-[#F5F3FF] group-hover:text-[#A78BFA]'
                      }`}
                    >
                      {entry.title}
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{entry.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MADE FOR YOU (PERSONALIZED DISCOVERY) */}
      {discovery.hasSufficientData && discovery.madeForYou.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#7C3AED]/15 text-[#A78BFA]">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#F5F3FF]">Made for You</h2>
                <p className="text-xs text-[#A1A1AA]">Curated from your listening patterns and artist affinities</p>
              </div>
            </div>

            <button
              onClick={handleRefreshDiscovery}
              title="Refresh personalized mix"
              className="p-1.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5"
            >
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {discovery.madeForYou.slice(0, 6).map((item) => {
              const isCurrent = currentTrack?.id === item.track.id;
              return (
                <div
                  key={item.track.id}
                  onClick={() => playTrack(item.track)}
                  onContextMenu={(e) => handleTrackContextMenu(e, item.track)}
                  className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#7C3AED]/40 cursor-pointer flex flex-col space-y-2.5 transition-all shadow-card"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-black/40 overflow-hidden flex items-center justify-center border border-[#272733]">
                    {item.track.artworkDataUrl ? (
                      <img
                        src={item.track.artworkDataUrl}
                        alt={item.track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Disc size={32} className="text-zinc-600" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm">
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.track);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-rose-500 hover:scale-110 transition-all z-10"
                    >
                      <Heart size={13} fill={item.track.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`font-semibold text-xs truncate transition-colors ${
                        isCurrent ? 'text-[#A78BFA]' : 'text-[#F5F3FF] group-hover:text-[#A78BFA]'
                      }`}
                    >
                      {item.track.title}
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{item.track.artist}</p>
                    <p className="text-[9px] text-[#A78BFA] truncate mt-1 italic">{item.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. YOUR FAVORITES QUICK ROW */}
      {favorites.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={18} className="text-rose-400 fill-rose-400" />
              <h2 className="text-lg font-bold text-[#F5F3FF]">Your Favorites</h2>
            </div>
            <button
              onClick={() => setActiveView('favorites')}
              className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All ({favorites.length})</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {favorites.slice(0, 6).map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, favorites)}
                onContextMenu={(e) => handleTrackContextMenu(e, track)}
                className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-rose-500/30 cursor-pointer flex flex-col space-y-2.5 transition-all shadow-card"
              >
                <div className="relative aspect-square w-full rounded-xl bg-black/40 overflow-hidden flex items-center justify-center border border-[#272733]">
                  {track.artworkDataUrl ? (
                    <img
                      src={track.artworkDataUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Disc size={32} className="text-zinc-600" />
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-xs text-[#F5F3FF] group-hover:text-[#A78BFA] truncate transition-colors">
                    {track.title}
                  </p>
                  <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TOP ARTISTS ROTATION */}
      {topArtists.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#F5F3FF]">Your Artist Rotation</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {topArtists.map((artist) => (
              <div
                key={artist.name}
                onClick={() => {
                  const match = artists.find((a) => a.name === artist.name);
                  if (match) openArtistDetail(match);
                }}
                className="p-4 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#7C3AED]/40 cursor-pointer flex flex-col items-center text-center space-y-2.5 transition-all shadow-card group"
              >
                <div className="w-16 h-16 rounded-full bg-black/50 border border-[#272733] overflow-hidden flex items-center justify-center">
                  {artist.artworkUrl ? (
                    <img src={artist.artworkUrl} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users size={24} className="text-zinc-500 group-hover:text-[#A78BFA] transition-colors" />
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <p className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[#A78BFA] transition-colors">
                    {artist.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono-numbers mt-0.5">
                    {artist.playCount} Plays
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. RECENTLY ADDED */}
      {recentlyAddedTracks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#F5F3FF]">Recently Added to Library</h2>
            <button
              onClick={() => setActiveView('songs')}
              className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All Songs</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentlyAddedTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, recentlyAddedTracks)}
                onContextMenu={(e) => handleTrackContextMenu(e, track)}
                className="group p-3 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#7C3AED]/40 cursor-pointer flex flex-col space-y-2.5 transition-all shadow-card"
              >
                <div className="relative aspect-square w-full rounded-xl bg-black/40 overflow-hidden flex items-center justify-center border border-[#272733]">
                  {track.artworkDataUrl ? (
                    <img
                      src={track.artworkDataUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Disc size={32} className="text-zinc-600" />
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white shadow-glow-sm">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-xs text-[#F5F3FF] group-hover:text-[#A78BFA] truncate transition-colors">
                    {track.title}
                  </p>
                  <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context Menu & Modal */}
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
