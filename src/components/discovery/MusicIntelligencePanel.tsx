import React from 'react';
import { TrackMetadata } from '../../types/audio';
import { useLibrary } from '../../context/LibraryContext';
import {
  FileText,
  Sliders,
  HardDrive,
  Clock,
  Layers,
  Calendar,
  Activity,
  FolderOpen,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface MusicIntelligencePanelProps {
  track: TrackMetadata;
}

export const MusicIntelligencePanel: React.FC<MusicIntelligencePanelProps> = ({ track }) => {
  const { showFileInFolder } = useLibrary();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')} (${Math.round(sec)} seconds)`;
  };

  const formatDate = (ts?: number) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 rounded-2xl bg-[#101018] border border-white/10 space-y-6 text-xs text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Technical Music Intelligence</h3>
            <p className="text-[11px] text-zinc-400">
              Deterministic, header-verified audio stream specifications and library metadata
            </p>
          </div>
        </div>

        <button
          onClick={() => showFileInFolder(track.filePath)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 hover:text-white transition-colors"
        >
          <FolderOpen size={13} /> Show in Explorer
        </button>
      </div>

      {/* Grid of Audio Specifications */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Codec & Format</span>
          <div className="text-sm font-bold text-violet-300 mt-0.5">
            {track.codec} ({track.container})
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Bitrate</span>
          <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
            {track.bitrate} kbps
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Sampling Frequency</span>
          <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
            {(track.sampleRate / 1000).toFixed(1)} kHz
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Bit Depth</span>
          <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
            {track.bitDepth ? `${track.bitDepth}-bit` : '16-bit (Lossy stream)'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Channels</span>
          <div className="text-sm font-bold text-white mt-0.5">
            {track.channels === 1 ? 'Mono (1 Ch)' : track.channels === 2 ? 'Stereo (2 Ch)' : `${track.channels} Channels`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">File Size</span>
          <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
            {formatFileSize(track.fileSize)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Audio Duration</span>
          <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
            {formatDuration(track.duration)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Classification</span>
          <div className="text-sm font-bold mt-0.5">
            {track.isLossless ? (
              <span className="text-emerald-400">Lossless Audio</span>
            ) : (
              <span className="text-amber-400">Perceptual Lossy</span>
            )}
          </div>
        </div>
      </div>

      {/* Library & Tag Metadata Details */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Library & Tag Details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-zinc-400">
          <div>
            <span className="text-zinc-500">Track Title:</span>{' '}
            <strong className="text-white font-medium">{track.title}</strong>
          </div>
          <div>
            <span className="text-zinc-500">Artist:</span>{' '}
            <strong className="text-white font-medium">{track.artist}</strong>
          </div>
          <div>
            <span className="text-zinc-500">Album:</span>{' '}
            <strong className="text-white font-medium">{track.album}</strong>
          </div>
          <div>
            <span className="text-zinc-500">Album Artist:</span>{' '}
            <span className="text-zinc-200">{track.albumArtist || 'Same as track artist'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Release Year:</span>{' '}
            <span className="text-zinc-200 font-mono-numbers">{track.year || 'Unknown'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Genre:</span>{' '}
            <span className="text-zinc-200">{track.genre || 'Uncategorized'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Play Count:</span>{' '}
            <span className="text-violet-300 font-mono-numbers font-bold">{track.playCount || 0} plays</span>
          </div>
          <div>
            <span className="text-zinc-500">Last Played:</span>{' '}
            <span className="text-zinc-200">{formatDate(track.lastPlayed)}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <span className="text-zinc-500 block mb-1">Local File Path:</span>
          <code className="block p-2 rounded-lg bg-black/40 text-[11px] font-mono text-zinc-300 break-all select-all">
            {track.filePath}
          </code>
        </div>
      </div>
    </div>
  );
};
