import React, { useState, useEffect } from 'react';
import { TrackMetadata } from '../../types/audio';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Save,
  Image as ImageIcon,
  FileAudio,
  Tag,
  Calendar,
  Hash,
  User,
  Music,
  Disc,
} from 'lucide-react';

interface MetadataEditorModalProps {
  track: TrackMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MetadataEditorModal: React.FC<MetadataEditorModalProps> = ({
  track,
  isOpen,
  onClose,
}) => {
  const { updateTrackMetadataInLibrary } = useLibrary();
  const { currentTrack, updateCurrentTrackMetadata } = usePlayer();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [trackTotal, setTrackTotal] = useState('');
  const [artworkDataUrl, setArtworkDataUrl] = useState<string | undefined>(undefined);
  const [artworkMime, setArtworkMime] = useState<string | undefined>(undefined);
  const [hasArtworkChanged, setHasArtworkChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setAlbumArtist(track.albumArtist || '');
      setGenre(track.genre || '');
      setYear(track.year ? String(track.year) : '');
      setTrackNumber(track.trackNumber ? String(track.trackNumber) : '');
      setTrackTotal(track.trackTotal ? String(track.trackTotal) : '');
      setArtworkDataUrl(track.artworkDataUrl);
      setHasArtworkChanged(false);
    }
  }, [track]);

  if (!isOpen || !track) return null;

  const handlePickArtwork = async () => {
    if (!window.harmoniqApi?.openArtworkDialog) {
      showToast('Artwork picker not available', 'warning');
      return;
    }
    const res = await window.harmoniqApi.openArtworkDialog();
    if (res && res.dataUrl) {
      setArtworkDataUrl(res.dataUrl);
      setArtworkMime(res.mime);
      setHasArtworkChanged(true);
      showToast('Artwork selected. Click Save to write to file.', 'info');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track.filePath) {
      showToast('Cannot save metadata: file path missing', 'warning');
      return;
    }

    setIsSaving(true);

    try {
      const payload: any = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        albumArtist: albumArtist.trim() || undefined,
        genre: genre.trim() || undefined,
        year: year ? parseInt(year, 10) : undefined,
        trackNumber: trackNumber ? parseInt(trackNumber, 10) : undefined,
        trackTotal: trackTotal ? parseInt(trackTotal, 10) : undefined,
      };

      if (hasArtworkChanged && artworkDataUrl) {
        payload.artworkBase64 = artworkDataUrl;
        payload.artworkMime = artworkMime || 'image/jpeg';
      }

      if (window.harmoniqApi?.writeAudioTags) {
        const result: any = await window.harmoniqApi.writeAudioTags(track.filePath, payload);

        if (result && result.success && result.track) {
          updateTrackMetadataInLibrary(result.track);
          if (currentTrack?.id === track.id) {
            updateCurrentTrackMetadata(result.track);
          }
          showToast(`Updated tags for "${result.track.title}"`, 'success');
          onClose();
        } else {
          const errMsg = result?.error || 'Failed to update audio file tags';
          showToast(errMsg, 'warning');
        }
      } else {
        showToast('Tag writing is not supported in this runtime environment', 'warning');
      }
    } catch (err: any) {
      console.error('Error saving metadata:', err);
      showToast(err?.message || 'Error writing metadata', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-dynamic)]/15 border border-[var(--accent-dynamic)]/30 flex items-center justify-center text-[var(--accent-dynamic)]">
              <Tag size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F3FF]">ID3 Metadata Editor</h2>
              <p className="text-[11px] text-[#A1A1AA] truncate max-w-md font-mono-numbers">
                {track.filePath}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
          {/* Top Section: Artwork & Core Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-4 border-b border-white/5">
            {/* Artwork Container */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative group w-32 h-32 rounded-xl overflow-hidden bg-[#14141B] border border-white/10 shadow-lg flex items-center justify-center">
                {artworkDataUrl ? (
                  <img
                    src={artworkDataUrl}
                    alt="Album Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc size={48} className="text-[#3F3F46]" />
                )}
                <div
                  onClick={handlePickArtwork}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity"
                >
                  <ImageIcon size={20} className="mb-1" />
                  <span className="text-[10px] font-semibold">Change Art</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePickArtwork}
                className="text-[11px] text-[var(--accent-dynamic)] hover:underline flex items-center gap-1 font-medium"
              >
                <ImageIcon size={12} />
                <span>Replace Cover</span>
              </button>
            </div>

            {/* Title & Artist */}
            <div className="flex-1 w-full space-y-3.5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                  Track Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Song Title"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                  Artist *
                </label>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Track Artist"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Album & Album Artist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                Album
              </label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album Name"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                Album Artist
              </label>
              <input
                type="text"
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                placeholder="Various Artists / Album Artist"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] transition-colors"
              />
            </div>
          </div>

          {/* Genre, Year, Track Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Rock, Classical, Jazz"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2023"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] font-mono-numbers transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1">
                Track #
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  placeholder="1"
                  className="w-full px-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] font-mono-numbers transition-colors"
                />
                <span className="text-[#71717A] text-xs">/</span>
                <input
                  type="number"
                  value={trackTotal}
                  onChange={(e) => setTrackTotal(e.target.value)}
                  placeholder="10"
                  className="w-full px-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[var(--accent-dynamic)] focus:outline-none text-xs text-[#F5F3FF] font-mono-numbers transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-[#71717A] flex items-center gap-2">
            <FileAudio size={14} className="text-[var(--accent-dynamic)] shrink-0" />
            <span>
              Format: <strong className="text-[#A1A1AA]">{track.codec}</strong> ({track.container}) • Changes will be safely written directly into the audio file stream.
            </span>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[var(--accent-dynamic)] hover:opacity-90 active:scale-95 text-xs font-bold text-white shadow-glow-sm flex items-center gap-1.5 transition-all"
            >
              <Save size={14} />
              <span>{isSaving ? 'Writing Tags...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
