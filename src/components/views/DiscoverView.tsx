import React from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { QualityBadge } from '../inspector/QualityBadge';
import { AudioQualityInspectorService } from '../../services/inspectorService';
import {
  Compass,
  Sparkles,
  Disc,
  Play,
  ListMusic,
  ArrowRight,
  Music,
} from 'lucide-react';
import { MoodDiscoverySection } from '../discovery/MoodDiscoverySection';

export const DiscoverView: React.FC = () => {
  const { tracks, albums, playlists, genres, openAlbumDetail, openPlaylistDetail, setActiveView } = useLibrary();
  const { playTrack } = usePlayer();

  const hiresTracks = tracks.filter((t) => (t.bitDepth && t.bitDepth > 16) || t.sampleRate > 48000);

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-10 max-w-7xl mx-auto select-none">
      {/* Discover Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#20153D] via-[#14121F] to-[#0D0D12] border border-[#272733] p-8 shadow-card">
        <div className="max-w-xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1B24] border border-[#272733] text-[11px] font-mono-numbers text-[var(--accent-dynamic)]">
            <Compass size={12} className="text-[var(--accent-dynamic)]" />
            <span>Audiophile Curation</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F5F3FF] tracking-tight">
            Discover Your High-Fidelity Realm
          </h1>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">
            Explore uncompressed FLAC masterings, discover albums in your collection, and tune your listening setup.
          </p>
        </div>
      </div>

      {/* Deterministic Mood-Based Discovery */}
      <MoodDiscoverySection />

      {/* 1. Featured Albums & Audio Masterings */}
      {albums.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
                <Disc size={18} className="text-[var(--accent-dynamic)]" />
                <span>Featured Albums & Masterings</span>
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Full albums sorted by collection structure
              </p>
            </div>
            <button
              onClick={() => setActiveView('albums')}
              className="text-xs text-[var(--accent-dynamic)] hover:underline font-semibold"
            >
              View All ({albums.length})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {albums.slice(0, 5).map((album) => {
              const sampleTrack = album.tracks[0];
              const artwork = sampleTrack?.artworkDataUrl;
              return (
                <div
                  key={album.id}
                  onClick={() => openAlbumDetail(album)}
                  className="group relative p-3.5 rounded-2xl bg-[#14141B]/90 hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-[0_12px_28px_var(--glow-dynamic)] cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-[#0A0A0F] border border-[#272733]/50 mb-3 flex items-center justify-center">
                    {artwork ? (
                      <img
                        src={artwork}
                        alt={album.title}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <Disc size={36} className="text-[#3F3F46]" />
                    )}

                    {/* Floating Glass Play Button (Slides in: translateY 8px -> 0, Opacity 0 -> 1) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
                      }}
                      title={`Play ${album.title}`}
                      className="absolute bottom-2.5 right-2.5 p-3 rounded-full bg-black/60 hover:bg-[var(--accent-dynamic)] text-white backdrop-blur-md border border-white/20 shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out hover:scale-110 active:scale-95 z-10"
                    >
                      <Play size={16} className="ml-0.5 fill-white" />
                    </button>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[var(--accent-dynamic)] transition-colors">
                      {album.title}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate">{album.artist}</p>
                    <span className="text-[10px] text-[#71717A] font-mono-numbers">
                      {album.trackCount} Tracks {album.year ? `• ${album.year}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Curated Playlists */}
      {playlists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
                <ListMusic size={18} className="text-[var(--accent-dynamic)]" />
                <span>Playlists & Smart Mixes</span>
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Curation generated from listening habits and user collections
              </p>
            </div>
            <button
              onClick={() => setActiveView('playlists')}
              className="text-xs text-[var(--accent-dynamic)] hover:underline font-semibold"
            >
              View All ({playlists.length})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {playlists.slice(0, 5).map((pl) => {
              const plTracks = pl.trackIds
                .map((id) => tracks.find((t) => t.id === id))
                .filter((t): t is typeof tracks[0] => !!t);
              const firstArt = plTracks.find((t) => t.artworkDataUrl)?.artworkDataUrl;

              return (
                <div
                  key={pl.id}
                  onClick={() => openPlaylistDetail(pl)}
                  className="group relative p-3.5 rounded-2xl bg-[#14141B]/90 hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-[0_12px_28px_var(--glow-dynamic)] cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-[#0A0A0F] border border-[#272733]/50 mb-3 flex items-center justify-center">
                    {firstArt ? (
                      <img
                        src={firstArt}
                        alt={pl.name}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <ListMusic size={36} className="text-[#3F3F46]" />
                    )}

                    {/* Floating Glass Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
                      }}
                      title={`Play ${pl.name}`}
                      className="absolute bottom-2.5 right-2.5 p-3 rounded-full bg-black/60 hover:bg-[var(--accent-dynamic)] text-white backdrop-blur-md border border-white/20 shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out hover:scale-110 active:scale-95 z-10"
                    >
                      <Play size={16} className="ml-0.5 fill-white" />
                    </button>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[var(--accent-dynamic)] transition-colors">
                      {pl.name}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate">
                      {pl.description || `${pl.trackIds.length} tracks`}
                    </p>
                    <span className="text-[10px] text-[#71717A] font-mono-numbers">
                      {pl.trackIds.length} Tracks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Hi-Res Spotlight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--accent-dynamic)]" />
              <span>Hi-Res Lossless Spotlight</span>
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Recordings with 24-bit depth or sample rates &gt; 48,000 Hz
            </p>
          </div>
          {hiresTracks.length > 0 && (
            <span className="text-xs font-mono-numbers text-[#71717A]">
              {hiresTracks.length} Tracks
            </span>
          )}
        </div>

        {hiresTracks.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#14141B] border border-[#272733] text-center text-xs text-[#71717A]">
            <Sparkles size={24} className="mx-auto mb-2 text-[#3F3F46]" />
            <p className="font-semibold text-[#A1A1AA]">No 24-bit Hi-Res files detected yet</p>
            <p className="mt-1">Add folders with 24-bit / 96 kHz or 192 kHz FLAC files to feature them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiresTracks.slice(0, 6).map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, hiresTracks)}
                className="group relative p-3.5 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-center justify-between shadow-card hover:shadow-[0_8px_20px_var(--glow-dynamic)]"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-12 h-12 rounded-lg bg-[#09090B] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center relative">
                    {track.artworkDataUrl ? (
                      <img
                        src={track.artworkDataUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Disc size={20} className="text-[#3F3F46]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[var(--accent-dynamic)] transition-colors">
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate">{track.artist}</p>
                    <span className="text-[10px] text-[#71717A] font-mono-numbers">
                      {track.bitDepth}-bit / {(track.sampleRate / 1000).toFixed(1)} kHz
                    </span>
                  </div>
                </div>

                {/* Floating Glass Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(track, hiresTracks);
                  }}
                  className="p-2.5 rounded-full bg-black/60 hover:bg-[var(--accent-dynamic)] text-white backdrop-blur-md border border-white/20 shadow-md opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out shrink-0"
                >
                  <Play size={13} className="ml-0.5 fill-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Featured Genres */}
      {genres.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#F5F3FF]">Browse By Genre</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {genres.slice(0, 6).map((genre) => (
              <div
                key={genre.name}
                onClick={() => {
                  if (genre.tracks.length > 0) playTrack(genre.tracks[0], genre.tracks);
                }}
                className="p-4 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] hover:-translate-y-1 transition-all cursor-pointer space-y-1 shadow-card group"
              >
                <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[var(--accent-dynamic)] truncate transition-colors">
                  {genre.name}
                </h3>
                <p className="text-[10px] font-mono-numbers text-[#71717A]">
                  {genre.trackCount} Tracks
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Audio Optimization Quick Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        <div
          onClick={() => setActiveView('equalizer')}
          className="p-5 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] transition-all cursor-pointer flex items-center justify-between shadow-card group"
        >
          <div className="space-y-1 pr-3">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-dynamic)] font-mono-numbers">DSP Profile</span>
            <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[var(--accent-dynamic)] transition-colors">
              Tune Your Sound Curve in Equalizer Studio
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Switch between Flat reference, Bass Boost, Rock, and Electronic presets.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#71717A] group-hover:text-[var(--accent-dynamic)] group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        <div
          onClick={() => setActiveView('inspector')}
          className="p-5 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[var(--accent-dynamic)] transition-all cursor-pointer flex items-center justify-between shadow-card group"
        >
          <div className="space-y-1 pr-3">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-dynamic)] font-mono-numbers">Diagnostics</span>
            <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[var(--accent-dynamic)] transition-colors">
              Check Bit-Perfect Stream & DAC Status
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Verify whether Windows sample rate conversion is actively modifying your audio bits.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#71717A] group-hover:text-[var(--accent-dynamic)] group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>
    </div>
  );
};
