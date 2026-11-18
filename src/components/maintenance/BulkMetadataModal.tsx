import React, { useState } from 'react';
import { TrackMetadata } from '../../types/audio';
import { maintenanceService, BulkMetadataPayload, BulkUpdateResult } from '../../services/maintenanceService';
import { useToast } from '../../context/ToastContext';
import {
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface BulkMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackMetadata[];
  onComplete?: () => void;
}

export const BulkMetadataModal: React.FC<BulkMetadataModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onComplete,
}) => {
  const { showToast } = useToast();

  // Form fields
  const [applyArtist, setApplyArtist] = useState(false);
  const [artist, setArtist] = useState('');

  const [applyAlbum, setApplyAlbum] = useState(false);
  const [album, setAlbum] = useState('');

  const [applyAlbumArtist, setApplyAlbumArtist] = useState(false);
  const [albumArtist, setAlbumArtist] = useState('');

  const [applyGenre, setApplyGenre] = useState(false);
  const [genre, setGenre] = useState('');

  const [applyYear, setApplyYear] = useState(false);
  const [year, setYear] = useState<number>(0);

  const [applyArtwork, setApplyArtwork] = useState(false);
  const [artworkDataUrl, setArtworkDataUrl] = useState<string>('');

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<BulkUpdateResult | null>(null);

  if (!isOpen) return null;

  const handlePickArtwork = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setArtworkDataUrl(reader.result as string);
          setApplyArtwork(true);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleApply = async () => {
    const payload: BulkMetadataPayload = {};
    if (applyArtist && artist.trim()) payload.artist = artist.trim();
    if (applyAlbum && album.trim()) payload.album = album.trim();
    if (applyAlbumArtist && albumArtist.trim()) payload.albumArtist = albumArtist.trim();
    if (applyGenre && genre.trim()) payload.genre = genre.trim();
    if (applyYear && year > 0) payload.year = year;
    if (applyArtwork && artworkDataUrl) payload.artworkDataUrl = artworkDataUrl;

    if (Object.keys(payload).length === 0) {
      showToast('Please check at least one field to update', 'warning');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: tracks.length });

    const res = await maintenanceService.bulkUpdateMetadata(tracks, payload, (cur, tot) => {
      setProgress({ current: cur, total: tot });
    });

    setIsProcessing(false);
    setResult(res);

    if (res.succeeded > 0) {
      showToast(`Successfully updated metadata for ${res.succeeded} tracks`, 'success');
      onComplete?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101018] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Bulk Metadata Editor ({tracks.length} tracks selected)
              </h2>
              <p className="text-xs text-zinc-400">
                Modify tags across multiple selected tracks simultaneously. Untouched fields are preserved.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {result ? (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 space-y-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Bulk Update Complete</h3>
              <p className="text-xs text-zinc-300">
                Updated {result.succeeded} of {result.total} tracks successfully.
              </p>
              {result.failed > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-left">
                  <div className="font-semibold mb-1">Errors encountered ({result.failed}):</div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, idx) => (
                      <li key={idx}>
                        {e.filePath}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                Only checked fields will be modified. All other ID3 tag fields will be safely preserved.
              </div>

              {/* Artist */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyArtist}
                  onChange={(e) => setApplyArtist(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Artist</span>
                <input
                  type="text"
                  value={artist}
                  disabled={!applyArtist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Leave untouched or enter new artist..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Album */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyAlbum}
                  onChange={(e) => setApplyAlbum(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Album</span>
                <input
                  type="text"
                  value={album}
                  disabled={!applyAlbum}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="Enter new album title..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Album Artist */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyAlbumArtist}
                  onChange={(e) => setApplyAlbumArtist(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Album Artist</span>
                <input
                  type="text"
                  value={albumArtist}
                  disabled={!applyAlbumArtist}
                  onChange={(e) => setAlbumArtist(e.target.value)}
                  placeholder="Enter album artist..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Genre */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyGenre}
                  onChange={(e) => setApplyGenre(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Genre</span>
                <input
                  type="text"
                  value={genre}
                  disabled={!applyGenre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Progressive Rock, Jazz, Synthwave..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Year */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyYear}
                  onChange={(e) => setApplyYear(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Year</span>
                <input
                  type="number"
                  value={year || ''}
                  disabled={!applyYear}
                  onChange={(e) => setYear(Number(e.target.value))}
                  placeholder="e.g. 1982"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Artwork */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  checked={applyArtwork}
                  onChange={(e) => setApplyArtwork(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-0 cursor-pointer"
                />
                <span className="w-24 text-xs font-medium text-zinc-300">Artwork</span>
                <div className="flex items-center gap-3">
                  {artworkDataUrl && (
                    <img
                      src={artworkDataUrl}
                      alt="Selected"
                      className="w-10 h-10 rounded-lg object-cover border border-white/10"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handlePickArtwork}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    <Upload size={13} /> Select Cover Image
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Writing ID3 tags & updating library...</span>
                <span className="font-mono-numbers">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-all duration-100"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <span className="text-xs text-zinc-500">
            {tracks.length} track(s) will be updated
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-xs font-semibold text-white shadow-glow-sm transition-all"
              >
                <CheckCircle2 size={14} /> Apply to {tracks.length} Tracks
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
