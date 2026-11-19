import React, { useState } from 'react';
import {
  BookmarkCheck,
  Check,
  Clock,
  ExternalLink,
  FolderPlus,
  ListMusic,
  ListPlus,
  Music,
  Pause,
  Play,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { GeneratedPlaylistPreview } from '../../types/playlistAssistant';
import { UnifiedTrack, ProviderId } from '../../types/universalMusic';

interface PlaylistPreviewCardProps {
  preview: GeneratedPlaylistPreview;
  onSave?: (preview: GeneratedPlaylistPreview) => Promise<void> | void;
  onPlayAll?: (tracks: UnifiedTrack[]) => Promise<void> | void;
  onQueueAll?: (tracks: UnifiedTrack[]) => void;
  onPlayTrack?: (track: UnifiedTrack) => Promise<void> | void;
  onRemoveTrack?: (trackId: string) => void;
  onDiscard?: () => void;
  onNavigatePlaylists?: () => void;
  currentTrackId?: string;
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

export const PlaylistPreviewCard: React.FC<PlaylistPreviewCardProps> = ({
  preview,
  onSave,
  onPlayAll,
  onQueueAll,
  onPlayTrack,
  onRemoveTrack,
  onDiscard,
  onNavigatePlaylists,
  currentTrackId,
  isPlaying = false,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const comp = preview.composition;

  const totalMin = Math.round(preview.totalDuration / 60);
  const playableTracks = preview.tracks.filter(
    (t) =>
      t.playbackCapability === 'full_stream' ||
      t.playbackCapability === 'preview_stream' ||
      t.playbackCapability === 'local_file'
  );

  const handleSaveClick = async () => {
    if (preview.isSaved || isSaving || !onSave) return;
    setIsSaving(true);
    try {
      await onSave(preview);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-3 bg-gradient-to-b from-violet-950/30 via-black/40 to-black/60 border border-violet-500/30 rounded-2xl p-3.5 shadow-xl select-none transition-all">
      {/* Header: Title, Description & Status */}
      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-violet-500/20">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300">
              <ListMusic className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-semibold text-white tracking-wide truncate">
              {preview.name}
            </h4>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
            {preview.description}
          </p>
        </div>

        {/* Saved Status Indicator */}
        {preview.isSaved ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex-shrink-0">
            <Check className="w-3 h-3" />
            Saved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
            <Sparkles className="w-3 h-3" />
            Preview
          </span>
        )}
      </div>

      {/* Composition Badges */}
      <div className="flex flex-wrap items-center gap-1.5 py-2 text-[10px]">
        {/* Track count & duration */}
        <span className="inline-flex items-center gap-1 text-zinc-300 bg-zinc-900/80 border border-zinc-700/50 px-2 py-0.5 rounded-md font-medium">
          <Clock className="w-3 h-3 text-zinc-400" />
          {preview.tracks.length} tracks • {totalMin}m
        </span>

        {/* Local tracks */}
        {comp.localCount > 0 && (
          <span className="text-violet-300 bg-violet-950/50 border border-violet-500/30 px-2 py-0.5 rounded-md">
            {comp.localCount} Local
          </span>
        )}

        {/* Full stream tracks */}
        {comp.onlineFullCount > 0 && (
          <span className="text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-md">
            {comp.onlineFullCount} Full Stream
          </span>
        )}

        {/* Previews badge (30s) */}
        {comp.previewCount > 0 && (
          <span className="text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-md" title="Track plays a 30-second official preview">
            {comp.previewCount} Preview (30s)
          </span>
        )}

        {/* Excluded external links */}
        {comp.excludedExternalCount > 0 && (
          <span
            className="text-zinc-400 bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded-md"
            title="External links from Spotify/YouTube are excluded from playable audio queue"
          >
            {comp.excludedExternalCount} Excluded
          </span>
        )}
      </div>

      {/* Track List (Scrollable) */}
      <div className="space-y-1 max-h-56 overflow-y-auto pr-1 my-1.5 scrollbar-thin scrollbar-thumb-violet-800/40">
        {preview.tracks.map((track, idx) => {
          const prov = PROVIDER_COLORS[track.providerId] || {
            bg: 'bg-zinc-900',
            text: 'text-zinc-400',
            border: 'border-zinc-700',
          };
          const isCurrent = currentTrackId === track.id;
          const isPreview = track.playbackCapability === 'preview_stream';

          return (
            <div
              key={track.id || `${track.providerId}_${idx}`}
              className={`group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border transition-all text-[11px] ${
                isCurrent
                  ? 'bg-violet-950/60 border-violet-500/50 text-white'
                  : 'bg-black/30 hover:bg-violet-950/20 border-violet-500/10 hover:border-violet-500/30 text-zinc-300'
              }`}
            >
              {/* Index & Artwork */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono text-[10px] text-zinc-500 w-3.5 text-right flex-shrink-0">
                  {idx + 1}
                </span>

                <div className="relative w-7 h-7 rounded-md overflow-hidden bg-violet-950/40 border border-violet-500/20 flex-shrink-0">
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-violet-400/60">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {onPlayTrack && (
                    <button
                      onClick={() => onPlayTrack(track)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                      title={isCurrent && isPlaying ? 'Pause' : 'Play'}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      )}
                    </button>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate leading-tight text-white">
                    {track.title}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                    <span>{track.artist}</span>
                    <span
                      className={`text-[8.5px] uppercase font-mono px-1 py-0.2 rounded border ${prov.bg} ${prov.text} ${prov.border}`}
                    >
                      {track.providerId}
                    </span>
                    {isPreview && (
                      <span className="text-[8.5px] text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1 rounded">
                        Preview
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Duration & Remove Action */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-[10px] text-zinc-500">
                  {formatDuration(track.duration)}
                </span>
                {!preview.isSaved && onRemoveTrack && (
                  <button
                    onClick={() => onRemoveTrack(track.id)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors opacity-60 group-hover:opacity-100"
                    title="Remove from preview"
                    aria-label={`Remove ${track.title}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons Footer */}
      <div className="mt-3 pt-2.5 border-t border-violet-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Primary Save Action */}
        {!preview.isSaved ? (
          <button
            onClick={handleSaveClick}
            disabled={isSaving || preview.tracks.length === 0}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium px-3.5 py-1.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save to Library'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              <Check className="w-3.5 h-3.5" />
              Saved to Library
            </span>
            {onNavigatePlaylists && (
              <button
                onClick={onNavigatePlaylists}
                className="inline-flex items-center gap-1 text-violet-300 hover:text-white text-[11px] hover:underline"
              >
                <span>View in Playlists</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Play & Queue Actions */}
        <div className="flex items-center gap-1.5">
          {playableTracks.length > 0 && onPlayAll && (
            <button
              onClick={() => onPlayAll(playableTracks)}
              className="flex items-center gap-1 bg-violet-600/80 hover:bg-violet-600 text-white font-medium px-2.5 py-1.5 rounded-xl transition-colors shadow-sm"
              title="Play all tracks now"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play All</span>
            </button>
          )}

          {playableTracks.length > 0 && onQueueAll && (
            <button
              onClick={() => onQueueAll(playableTracks)}
              className="flex items-center gap-1 bg-violet-950/50 hover:bg-violet-900/60 border border-violet-500/30 text-violet-200 px-2.5 py-1.5 rounded-xl transition-colors"
              title="Add all to current queue"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Queue</span>
            </button>
          )}

          {!preview.isSaved && onDiscard && (
            <button
              onClick={onDiscard}
              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
              title="Discard preview"
              aria-label="Discard preview"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
