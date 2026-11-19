import React from 'react';
import { Play, Pause, Plus, ListPlus, ExternalLink, Music, Radio } from 'lucide-react';
import { UnifiedTrack, PlaybackCapability, ProviderId } from '../../types/universalMusic';

interface DiscoveryResultCardProps {
  track: UnifiedTrack;
  index: number;
  onPlay?: (track: UnifiedTrack) => void;
  onAddToQueue?: (track: UnifiedTrack) => void;
  onPlayNext?: (track: UnifiedTrack) => void;
  isPlaying?: boolean;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PROVIDER_COLORS: Record<ProviderId, { bg: string; text: string; border: string }> = {
  jamendo: { bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-500/40' },
  audius: { bg: 'bg-fuchsia-950/60', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40' },
  archive: { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-500/40' },
  apple: { bg: 'bg-rose-950/60', text: 'text-rose-300', border: 'border-rose-500/40' },
  spotify: { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  youtube: { bg: 'bg-red-950/60', text: 'text-red-300', border: 'border-red-500/40' },
  jiosaavn: { bg: 'bg-teal-950/60', text: 'text-teal-300', border: 'border-teal-500/40' },
  local: { bg: 'bg-violet-950/60', text: 'text-violet-300', border: 'border-violet-500/40' },
};

export const DiscoveryResultCard: React.FC<DiscoveryResultCardProps> = ({
  track,
  index,
  onPlay,
  onAddToQueue,
  onPlayNext,
  isPlaying = false,
}) => {
  const isPlayable =
    track.playbackCapability === 'full_stream' ||
    track.playbackCapability === 'preview_stream' ||
    track.playbackCapability === 'local_file';

  const isPreview = track.playbackCapability === 'preview_stream';
  const isExternal = track.playbackCapability === 'external_link' || track.playbackCapability === 'metadata_only';

  const provStyle = PROVIDER_COLORS[track.providerId] || {
    bg: 'bg-zinc-900',
    text: 'text-zinc-300',
    border: 'border-zinc-700',
  };

  const handleOpenExternal = () => {
    if (track.providerWebUrl) {
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.openExternalUrl) {
        (window as any).harmoniqApi.openExternalUrl(track.providerWebUrl);
      } else {
        window.open(track.providerWebUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      aria-label={`Track #${index + 1}: ${track.title} by ${track.artist}`}
      className="group relative flex items-center justify-between gap-2.5 p-2 bg-black/40 hover:bg-violet-950/30 border border-violet-500/20 hover:border-violet-500/40 rounded-xl transition-all duration-200 shadow-sm"
    >
      {/* Index Badge & Artwork */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-zinc-500 w-3 text-right">
          {index + 1}
        </span>
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-violet-950/50 border border-violet-500/20 flex-shrink-0">
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-violet-400/60">
              <Music className="w-4 h-4" />
            </div>
          )}

          {/* Quick Play Overlay on Artwork for Playable Tracks */}
          {isPlayable && onPlay && (
            <button
              onClick={() => onPlay(track)}
              title={isPlaying ? 'Pause' : 'Play'}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Track Metadata & Badges */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5">
          <h5 className="text-[11px] font-semibold text-zinc-100 truncate tracking-tight">
            {track.title}
          </h5>
          {track.releaseYear && (
            <span className="text-[9px] text-zinc-500 flex-shrink-0">
              ({track.releaseYear})
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 truncate">
          {track.artist} {track.album ? `• ${track.album}` : ''}
        </p>

        {/* Badges Row */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {/* Provider Badge */}
          <span
            className={`px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider rounded border ${provStyle.bg} ${provStyle.text} ${provStyle.border}`}
          >
            {track.providerId}
          </span>

          {/* Capability Indicator */}
          {track.playbackCapability === 'full_stream' && (
            <span className="text-[8px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-1 py-0.2 rounded">
              Full Audio
            </span>
          )}
          {isPreview && (
            <span className="text-[8px] font-medium text-amber-300 bg-amber-950/50 border border-amber-500/30 px-1 py-0.2 rounded">
              30s Preview
            </span>
          )}
          {isExternal && (
            <span className="text-[8px] font-medium text-sky-300 bg-sky-950/50 border border-sky-500/30 px-1 py-0.2 rounded">
              Official Link
            </span>
          )}

          {track.duration > 0 && (
            <span className="text-[9px] font-mono text-zinc-500">
              {formatDuration(track.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isPlayable ? (
          <>
            {onPlay && (
              <button
                onClick={() => onPlay(track)}
                title={isPreview ? 'Play 30s Preview' : 'Play'}
                className="p-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-400/40 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
            {onAddToQueue && (
              <button
                onClick={() => onAddToQueue(track)}
                title="Add to Queue"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ListPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {onPlayNext && (
              <button
                onClick={() => onPlayNext(track)}
                title="Play Next"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleOpenExternal}
            title={`Open on ${track.providerId.toUpperCase()}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-400/40 text-[10px] text-zinc-300 hover:text-violet-200 transition-all"
          >
            <span>Open</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
};
