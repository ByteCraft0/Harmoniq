import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import { TrackContextMenu, ContextMenuState } from '../layout/TrackContextMenu';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { TrackMetadata } from '../../types/audio';
import {
  FolderPlus,
  Play,
  Heart,
  Clock,
  Sparkles,
  Music,
  Disc,
  Users,
  HardDrive,
  Speaker,
  Flame,
  ArrowRight,
  ShieldCheck,
  Headphones,
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
    openPlaylistDetail,
    setActiveView,
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);

  const favoritePlaylist = playlists.find((p) => p.smartCriteria === 'favorites');
  const recentlyPlayedPlaylist = playlists.find((p) => p.smartCriteria === 'recently_played');
  const recentlyAddedPlaylist = playlists.find((p) => p.smartCriteria === 'recently_added');
  const mostPlayedPlaylist = playlists.find((p) => p.smartCriteria === 'most_played');

  const favoriteTracks = favoritePlaylist
    ? tracks.filter((t) => favoritePlaylist.trackIds.includes(t.id))
    : [];

  const recentlyPlayedTracks = recentlyPlayedPlaylist
    ? recentlyPlayedPlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is typeof tracks[0] => !!t)
    : [];

  const recentlyAddedTracks = recentlyAddedPlaylist
    ? recentlyAddedPlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is typeof tracks[0] => !!t)
    : [];

  const mostPlayedTracks = mostPlayedPlaylist
    ? mostPlayedPlaylist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is typeof tracks[0] => !!t)
    : [];

  const losslessCount = tracks.filter((t) => t.isLossless).length;
  const hiresCount = tracks.filter((t) => (t.bitDepth && t.bitDepth > 16) || t.sampleRate > 48000).length;

  const formatHours = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-10 max-w-7xl mx-auto select-none">
      {/* A. WELCOME SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#17132B] via-[#12121A] to-[#0D0D12] border border-[#272733] p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1B24] border border-[#272733] text-[11px] font-mono-numbers text-[#A78BFA]">
            <Sparkles size={12} className="text-[#A78BFA]" />
            <span>Harmoniq Reference Audio Engine</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F5F3FF] tracking-tight">
            Your Music. Your Experience.
          </h1>

          <p className="text-sm text-[#A1A1AA] leading-relaxed">
            Minimalist high-fidelity playback with bit-depth transparency, a calibrated 10-band studio EQ, and recursive local library indexing.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={addMusicFolders}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-95 text-[#F5F3FF] text-xs font-bold shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95"
            >
              <FolderPlus size={16} />
              <span>Add Music Folder</span>
            </button>

            <button
              onClick={openAudioFiles}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#F5F3FF] text-xs font-semibold transition-all active:scale-95"
            >
              <Music size={16} />
              <span>Open Audio Files</span>
            </button>
          </div>
        </div>
      </div>

      {/* B. STATISTICS CARDS (6 Metrics) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
          Library Telemetry
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Total Tracks */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Total Tracks</span>
              <Music size={15} />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#F5F3FF]">
              {stats.totalTracks.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">In Database</span>
          </div>

          {/* Albums */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Albums</span>
              <Disc size={15} />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#F5F3FF]">
              {stats.totalAlbums.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">Discography</span>
          </div>

          {/* Artists */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Artists</span>
              <Users size={15} />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#F5F3FF]">
              {stats.totalArtists.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">Catalogued</span>
          </div>

          {/* Lossless Tracks */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Lossless Tracks</span>
              <Sparkles size={15} className="text-[#A78BFA]" />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#A78BFA]">
              {losslessCount.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">
              {hiresCount > 0 ? `${hiresCount} Hi-Res` : 'CD Quality'}
            </span>
          </div>

          {/* Listening Time */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Listening Time</span>
              <Clock size={15} />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#F5F3FF]">
              {formatHours(stats.totalDuration)}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">Total Runtime</span>
          </div>

          {/* Library Storage */}
          <div className="p-4 rounded-xl bg-[#14141B] border border-[#272733] space-y-1">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[11px] font-medium">Library Storage</span>
              <HardDrive size={15} />
            </div>
            <p className="text-xl font-bold font-mono-numbers text-[#F5F3FF]">
              {formatSize(stats.totalSize)}
            </p>
            <span className="text-[10px] text-[#71717A] font-mono-numbers">Local Disk</span>
          </div>
        </div>
      </div>

      {/* C. RECENTLY PLAYED HORIZONTAL CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#F5F3FF]">Recently Played</h2>
            <p className="text-xs text-[#A1A1AA]">Pick up right where you left off</p>
          </div>
          {recentlyPlayedTracks.length > 0 && (
            <button
              onClick={() => setActiveView('recently_played')}
              className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {recentlyPlayedTracks.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#14141B] border border-[#272733] text-center text-[#71717A] text-xs">
            <Clock size={28} className="mx-auto mb-2 text-[#3F3F46]" />
            <p className="font-semibold text-[#A1A1AA]">No playback history yet</p>
            <p className="mt-1">Play any track from your library to start your history.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentlyPlayedTracks.slice(0, 6).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const tier = AudioQualityInspectorService.calculateQualityTier(track);

              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, recentlyPlayedTracks)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ track, x: e.clientX, y: e.clientY });
                  }}
                  className="group p-3 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#3B3B4E] transition-all cursor-pointer flex flex-col space-y-2.5 shadow-card"
                >
                  <div className="relative aspect-square w-full rounded-lg bg-[#09090B] overflow-hidden flex items-center justify-center border border-[#272733]">
                    {track.artworkDataUrl ? (
                      <img
                        src={track.artworkDataUrl}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Disc size={36} className="text-[#3F3F46]" />
                    )}

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="p-3 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] shadow-glow-sm hover:scale-110 transition-transform">
                        <Play size={18} className="ml-0.5" />
                      </button>
                    </div>

                    <div className="absolute bottom-1.5 left-1.5">
                      <QualityBadge tier={tier} size="sm" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3
                      className={`font-semibold text-xs truncate ${
                        isCurrent ? 'text-[#A78BFA]' : 'text-[#F5F3FF] group-hover:text-[#A78BFA]'
                      } transition-colors`}
                    >
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate">{track.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D. YOUR LIBRARY: 3 COLUMN BREAKDOWN */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#F5F3FF]">Your Music Collection</h2>
          <p className="text-xs text-[#A1A1AA]">Curated insights from your local audio library</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column 1: Recently Added */}
          <div className="p-5 rounded-xl bg-[#14141B] border border-[#272733] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
              <div className="flex items-center gap-2">
                <Music size={15} className="text-[#A78BFA]" />
                <h3 className="font-bold text-xs text-[#F5F3FF] uppercase tracking-wider font-mono-numbers">
                  Recently Added
                </h3>
              </div>
              <span className="text-[10px] font-mono-numbers text-[#71717A]">
                {recentlyAddedTracks.length}
              </span>
            </div>

            <div className="space-y-1">
              {recentlyAddedTracks.length === 0 ? (
                <p className="text-xs text-[#71717A] py-6 text-center">No tracks added</p>
              ) : (
                recentlyAddedTracks.slice(0, 5).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, recentlyAddedTracks)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ track, x: e.clientX, y: e.clientY });
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1B1B24] cursor-pointer text-xs group transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-[#F5F3FF] truncate group-hover:text-[#A78BFA]">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-[#71717A] truncate">{track.artist}</p>
                    </div>
                    <QualityBadge
                      tier={AudioQualityInspectorService.calculateQualityTier(track)}
                      size="sm"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Favorite Tracks */}
          <div className="p-5 rounded-xl bg-[#14141B] border border-[#272733] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
              <div className="flex items-center gap-2">
                <Heart size={15} className="text-red-400 fill-red-400" />
                <h3 className="font-bold text-xs text-[#F5F3FF] uppercase tracking-wider font-mono-numbers">
                  Favorites
                </h3>
              </div>
              <span className="text-[10px] font-mono-numbers text-[#71717A]">
                {favoriteTracks.length}
              </span>
            </div>

            <div className="space-y-1">
              {favoriteTracks.length === 0 ? (
                <p className="text-xs text-[#71717A] py-6 text-center">Star tracks to add favorites</p>
              ) : (
                favoriteTracks.slice(0, 5).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, favoriteTracks)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ track, x: e.clientX, y: e.clientY });
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1B1B24] cursor-pointer text-xs group transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-[#F5F3FF] truncate group-hover:text-[#A78BFA]">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-[#71717A] truncate">{track.artist}</p>
                    </div>
                    <QualityBadge
                      tier={AudioQualityInspectorService.calculateQualityTier(track)}
                      size="sm"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Most Played */}
          <div className="p-5 rounded-xl bg-[#14141B] border border-[#272733] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-amber-400" />
                <h3 className="font-bold text-xs text-[#F5F3FF] uppercase tracking-wider font-mono-numbers">
                  Most Played
                </h3>
              </div>
              <span className="text-[10px] font-mono-numbers text-[#71717A]">
                {mostPlayedTracks.length}
              </span>
            </div>

            <div className="space-y-1">
              {mostPlayedTracks.length === 0 ? (
                <p className="text-xs text-[#71717A] py-6 text-center">Play tracks to compute frequency</p>
              ) : (
                mostPlayedTracks.slice(0, 5).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, mostPlayedTracks)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ track, x: e.clientX, y: e.clientY });
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1B1B24] cursor-pointer text-xs group transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-[#F5F3FF] truncate group-hover:text-[#A78BFA]">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-[#71717A] truncate">
                        {track.artist} • {track.playCount} plays
                      </p>
                    </div>
                    <QualityBadge
                      tier={AudioQualityInspectorService.calculateQualityTier(track)}
                      size="sm"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* E. AUDIO QUALITY OVERVIEW */}
      <div className="p-6 rounded-2xl bg-[#14141B] border border-[#272733] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#272733]">
          <div>
            <h2 className="text-lg font-bold text-[#F5F3FF]">Audio Quality & Hardware Pipeline</h2>
            <p className="text-xs text-[#A1A1AA]">
              Native formats, lossless codecs, and active Windows audio driver status
            </p>
          </div>
          <button
            onClick={() => setActiveView('inspector')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1B24] hover:bg-[#242432] border border-[#272733] text-xs font-semibold text-[#A78BFA] transition-colors"
          >
            <span>Open Inspector</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
            <span className="text-[11px] font-medium text-[#71717A]">Lossless Master Files</span>
            <p className="text-2xl font-bold font-mono-numbers text-emerald-400">
              {losslessCount.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A]">FLAC, WAV, ALAC, AIFF</span>
          </div>

          <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
            <span className="text-[11px] font-medium text-[#71717A]">Hi-Res Lossless (24-bit+)</span>
            <p className="text-2xl font-bold font-mono-numbers text-[#A78BFA]">
              {hiresCount.toLocaleString()}
            </p>
            <span className="text-[10px] text-[#71717A]">&gt; 48 kHz or &gt; 16-bit</span>
          </div>

          <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
            <span className="text-[11px] font-medium text-[#71717A]">Supported Codecs</span>
            <div className="flex flex-wrap gap-1 pt-1">
              {['FLAC', 'ALAC', 'WAV', 'MP3', 'AAC', 'OPUS'].map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded bg-[#14141B] border border-[#272733] text-[9px] font-mono-numbers text-[#A1A1AA]"
                >
                  {c}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-[#71717A]">Native Stream Decoding</span>
          </div>

          <div className="p-4 rounded-xl bg-[#09090B] border border-[#272733] space-y-1">
            <span className="text-[11px] font-medium text-[#71717A]">Output Endpoint</span>
            <div className="flex items-center gap-1.5 pt-1">
              <Speaker size={14} className="text-[#A78BFA]" />
              <span className="text-xs font-semibold text-[#F5F3FF] truncate">WASAPI Endpoint</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono-numbers">24-bit / 48.0 kHz Active</span>
          </div>
        </div>
      </div>

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
    </div>
  );
};
