import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { maintenanceService } from '../../services/maintenanceService';
import { Album } from '../../types/library';
import {
  Image,
  Upload,
  X,
  Disc,
  CheckCircle,
  FolderOpen,
  Sparkles,
} from 'lucide-react';

interface MissingArtworkManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MissingArtworkManager: React.FC<MissingArtworkManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { albums, tracks, updateTrackMetadataInLibrary } = useLibrary();
  const { showToast } = useToast();
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const { missingAlbums, missingTracks } = useMemo(() => {
    return maintenanceService.findMissingArtwork(albums, tracks);
  }, [albums, tracks, isOpen]);

  if (!isOpen) return null;

  const handlePickArtworkForAlbum = async (album: Album) => {
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.openArtworkDialog) {
      try {
        const filePaths: string[] = await (window as any).harmoniqApi.openArtworkDialog();
        if (filePaths && filePaths.length > 0) {
          const selectedImagePath = filePaths[0];
          await applyArtworkToAlbum(album, selectedImagePath);
        }
      } catch (err: any) {
        showToast(`Failed to select artwork: ${err.message}`, 'warning');
      }
    } else {
      // Fallback file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            await applyArtworkDataUrlToAlbum(album, dataUrl);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const applyArtworkDataUrlToAlbum = async (album: Album, dataUrl: string) => {
    setIsApplying(true);
    let updatedCount = 0;

    for (const track of album.tracks) {
      const updated = {
        ...track,
        hasArtwork: true,
        artworkDataUrl: dataUrl,
      };
      updateTrackMetadataInLibrary(updated);
      updatedCount++;
    }

    setIsApplying(false);
    showToast(`Applied new artwork to ${updatedCount} tracks in "${album.title}"`, 'success');
  };

  const applyArtworkToAlbum = async (album: Album, imageFilePath: string) => {
    setIsApplying(true);
    let updatedCount = 0;

    for (const track of album.tracks) {
      try {
        if (typeof window !== 'undefined' && (window as any).harmoniqApi?.writeAudioTags) {
          await (window as any).harmoniqApi.writeAudioTags(track.filePath, {
            artworkPath: imageFilePath,
          });
        }
        const updated = {
          ...track,
          hasArtwork: true,
          artworkDataUrl: `harmoniq-media://local/${encodeURIComponent(imageFilePath.replace(/\\/g, '/'))}`,
        };
        updateTrackMetadataInLibrary(updated);
        updatedCount++;
      } catch (e) {
        console.warn(`Failed to embed artwork in ${track.filePath}`, e);
      }
    }

    setIsApplying(false);
    showToast(`Embedded artwork into ${updatedCount} tracks in "${album.title}"`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101018] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Image size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Missing Album Artwork Manager</h2>
              <p className="text-xs text-zinc-400">
                Identify and attach high-resolution covers to albums lacking artwork
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

        {/* Stats banner */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.01] text-xs">
          <span className="text-zinc-400">
            Albums without cover:{' '}
            <strong className="text-amber-400 font-mono-numbers">{missingAlbums.length}</strong> of{' '}
            {albums.length} total albums
          </span>
          <span className="text-zinc-500 text-[11px]">
            {missingTracks.length} individual tracks missing artwork
          </span>
        </div>

        {/* Albums Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {missingAlbums.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-2">
              <CheckCircle size={36} className="text-emerald-500" />
              <p className="text-sm font-semibold text-white">All albums have artwork!</p>
              <p className="text-xs text-zinc-400">
                Every album in your music library has a cover image assigned
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {missingAlbums.map((album) => (
                <div
                  key={album.id}
                  className="group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-violet-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Placeholder */}
                    <div className="relative aspect-square w-full rounded-xl bg-[#09090B] border border-white/10 flex flex-col items-center justify-center text-zinc-600 group-hover:border-violet-500/30 transition-colors overflow-hidden">
                      <Disc size={36} className="text-zinc-700" />
                      <span className="text-[10px] text-zinc-600 font-medium mt-1">No Artwork</span>

                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                        <button
                          onClick={() => handlePickArtworkForAlbum(album)}
                          disabled={isApplying}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm transition-all"
                        >
                          <Upload size={13} /> Add Cover
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 min-w-0">
                      <h4 className="font-semibold text-xs text-white truncate" title={album.title}>
                        {album.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{album.artist}</p>
                      <p className="text-[10px] text-zinc-500 font-mono-numbers mt-1">
                        {album.trackCount} tracks {album.year ? `• ${album.year}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePickArtworkForAlbum(album)}
                    className="mt-3 w-full py-1.5 rounded-lg bg-white/5 hover:bg-violet-600/20 text-zinc-300 hover:text-violet-300 text-[11px] font-medium transition-colors border border-white/5 hover:border-violet-500/30 flex items-center justify-center gap-1.5"
                  >
                    <Upload size={12} /> Assign Image
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
