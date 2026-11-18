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
  Heart,
  Music,
  Headphones,
  Sliders,
  Gauge,
  ArrowRight,
} from 'lucide-react';

export const DiscoverView: React.FC = () => {
  const { tracks, albums, artists, genres, openAlbumDetail, setActiveView } = useLibrary();
  const { playTrack } = usePlayer();

  const hiresTracks = tracks.filter((t) => (t.bitDepth && t.bitDepth > 16) || t.sampleRate > 48000);
  const losslessTracks = tracks.filter((t) => t.isLossless);

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none">
      {/* Discover Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#20153D] via-[#14121F] to-[#0D0D12] border border-[#272733] p-8 shadow-card">
        <div className="max-w-xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1B24] border border-[#272733] text-[11px] font-mono-numbers text-[#A78BFA]">
            <Compass size={12} className="text-[#A78BFA]" />
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

      {/* Hi-Res Spotlight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#F5F3FF] flex items-center gap-2">
              <Sparkles size={18} className="text-[#A78BFA]" />
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
                className="group p-4 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#3B3B4E] cursor-pointer flex items-center justify-between transition-all shadow-card"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-12 h-12 rounded-lg bg-[#09090B] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center">
                    {track.artworkDataUrl ? (
                      <img src={track.artworkDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc size={20} className="text-[#3F3F46]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-[#F5F3FF] truncate group-hover:text-[#A78BFA]">
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-[#A1A1AA] truncate">{track.artist}</p>
                    <span className="text-[10px] text-[#71717A] font-mono-numbers">
                      {track.bitDepth}-bit / {(track.sampleRate / 1000).toFixed(1)} kHz
                    </span>
                  </div>
                </div>
                <button className="p-2.5 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-[#F5F3FF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Play size={14} className="ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Genres */}
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
                className="p-4 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#A78BFA] transition-all cursor-pointer space-y-1 shadow-card group"
              >
                <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[#A78BFA] truncate">
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

      {/* Audio Optimization Quick Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        <div
          onClick={() => setActiveView('equalizer')}
          className="p-5 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#A78BFA] transition-all cursor-pointer flex items-center justify-between shadow-card group"
        >
          <div className="space-y-1 pr-3">
            <span className="text-[10px] uppercase font-bold text-[#A78BFA] font-mono-numbers">DSP Profile</span>
            <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[#A78BFA]">
              Tune Your Sound Curve in Equalizer Studio
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Switch between Flat reference, Bass Boost, Rock, and Electronic presets.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#71717A] group-hover:text-[#A78BFA] group-hover:translate-x-1 transition-all shrink-0" />
        </div>

        <div
          onClick={() => setActiveView('inspector')}
          className="p-5 rounded-2xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] hover:border-[#A78BFA] transition-all cursor-pointer flex items-center justify-between shadow-card group"
        >
          <div className="space-y-1 pr-3">
            <span className="text-[10px] uppercase font-bold text-[#A78BFA] font-mono-numbers">Diagnostics</span>
            <h3 className="font-bold text-sm text-[#F5F3FF] group-hover:text-[#A78BFA]">
              Check Bit-Perfect Stream & DAC Status
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Verify whether Windows sample rate conversion is actively modifying your audio bits.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#71717A] group-hover:text-[#A78BFA] group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>
    </div>
  );
};
