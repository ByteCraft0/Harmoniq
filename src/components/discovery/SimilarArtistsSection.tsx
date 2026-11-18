import React, { useMemo } from 'react';
import { Artist } from '../../types/library';
import { discoveryService } from '../../services/discoveryService';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { Users, Disc, Play, ArrowRight, Sparkles } from 'lucide-react';

interface SimilarArtistsSectionProps {
  currentArtist: Artist;
}

export const SimilarArtistsSection: React.FC<SimilarArtistsSectionProps> = ({ currentArtist }) => {
  const { artists, openArtistDetail } = useLibrary();
  const { playTrack } = usePlayer();

  const similarMatches = useMemo(() => {
    return discoveryService.findSimilarArtists(currentArtist, artists);
  }, [currentArtist, artists]);

  if (similarMatches.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-violet-400" />
        <h3 className="text-sm font-bold text-white tracking-tight">
          Related Artists in Your Library
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {similarMatches.map(({ artist, reasons }) => (
          <div
            key={artist.id}
            onClick={() => openArtistDetail(artist)}
            className="group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-violet-500/30 transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-900/40 to-violet-700/20 border border-white/10 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0 group-hover:scale-105 transition-transform">
              {artist.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs text-white truncate group-hover:text-violet-300 transition-colors">
                {artist.name}
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono-numbers mt-0.5">
                {artist.albumCount} {artist.albumCount === 1 ? 'Album' : 'Albums'} • {artist.trackCount} Tracks
              </p>
              {reasons.length > 0 && (
                <div className="text-[10px] text-violet-400 truncate mt-1">
                  {reasons[0]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
