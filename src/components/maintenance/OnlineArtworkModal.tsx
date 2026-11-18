import React, { useState, useEffect } from 'react';
import { Image, Search, Loader2, Check, X, AlertCircle, Sparkles } from 'lucide-react';

interface ArtworkCandidate {
  id: string;
  source: 'Cover Art Archive' | 'iTunes' | 'MusicBrainz';
  thumbnailUrl: string;
  fullUrl: string;
  resolution: string;
  albumTitle: string;
  artistName: string;
  releaseYear?: string;
}

const ARTWORK_CACHE = new Map<string, ArtworkCandidate[]>();

interface OnlineArtworkModalProps {
  albumTitle: string;
  artistName: string;
  existingArtworkUrl?: string;
  onApplyArtwork: (artworkUrl: string) => void;
  onClose: () => void;
}

export const OnlineArtworkModal: React.FC<OnlineArtworkModalProps> = ({
  albumTitle,
  artistName,
  existingArtworkUrl,
  onApplyArtwork,
  onClose,
}) => {
  const [queryAlbum, setQueryAlbum] = useState(albumTitle || '');
  const [queryArtist, setQueryArtist] = useState(artistName || '');
  const [candidates, setCandidates] = useState<ArtworkCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ArtworkCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArtwork = async (album: string, artist: string) => {
    const cleanAlbum = album.trim();
    const cleanArtist = artist.trim();
    if (!cleanAlbum && !cleanArtist) return;

    const cacheKey = `${cleanArtist}:::${cleanAlbum}`.toLowerCase();
    if (ARTWORK_CACHE.has(cacheKey)) {
      setCandidates(ARTWORK_CACHE.get(cacheKey)!);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedCandidate(null);

    const results: ArtworkCandidate[] = [];

    try {
      // 1. Search iTunes official high-res album catalog (legitimate, non-AI, fast, high-res)
      const term = `${cleanArtist} ${cleanAlbum}`.trim();
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        term
      )}&entity=album&limit=8`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(itunesUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const items = data?.results || [];

        items.forEach((item: any, idx: number) => {
          if (item.artworkUrl100) {
            // Replace thumbnail dimensions with 600x600 and 1200x1200bb.jpg
            const highRes = item.artworkUrl100.replace('100x100bb.jpg', '1000x1000bb.jpg');
            const thumb = item.artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg');
            results.push({
              id: `itunes_${item.collectionId || idx}`,
              source: 'iTunes',
              thumbnailUrl: thumb,
              fullUrl: highRes,
              resolution: '1000 x 1000',
              albumTitle: item.collectionName || cleanAlbum,
              artistName: item.artistName || cleanArtist,
              releaseYear: item.releaseDate ? item.releaseDate.substring(0, 4) : undefined,
            });
          }
        });
      }
    } catch (err: any) {
      console.warn('Artwork search error:', err);
    }

    if (results.length > 0) {
      ARTWORK_CACHE.set(cacheKey, results);
      setCandidates(results);
    } else {
      setError('No matching online album artwork found. Try adjusting the artist or album name.');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchArtwork(albumTitle, artistName);
  }, []);

  const handleApply = () => {
    if (!selectedCandidate) return;
    if (
      existingArtworkUrl &&
      !confirm('This album already has artwork. Are you sure you want to replace it with the selected online cover?')
    ) {
      return;
    }

    onApplyArtwork(selectedCandidate.fullUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#272733] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Image size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F3FF]">Find Online Album Artwork</h2>
              <p className="text-xs text-[#A1A1AA]">
                Search high-resolution artwork from legitimate public releases
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF]">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 bg-[#111116] border-b border-[#272733] flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={queryArtist}
            onChange={(e) => setQueryArtist(e.target.value)}
            placeholder="Artist Name"
            className="flex-1 bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] rounded-lg px-3 py-2 outline-none"
          />
          <input
            type="text"
            value={queryAlbum}
            onChange={(e) => setQueryAlbum(e.target.value)}
            placeholder="Album Title"
            className="flex-1 bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] rounded-lg px-3 py-2 outline-none"
          />
          <button
            onClick={() => fetchArtwork(queryAlbum, queryArtist)}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-50 text-[#09090B] text-xs font-bold rounded-lg transition shrink-0"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>Search</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-20 text-center text-[#71717A] space-y-2">
              <Loader2 size={28} className="animate-spin mx-auto text-[#A78BFA]" />
              <p className="text-xs">Searching official online music metadata releases...</p>
            </div>
          ) : candidates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {candidates.map((cand) => {
                const isSelected = selectedCandidate?.id === cand.id;
                return (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedCandidate(cand)}
                    className={`p-3 bg-[#1B1B24] border rounded-2xl cursor-pointer transition flex flex-col justify-between group relative ${
                      isSelected
                        ? 'border-[#A78BFA] ring-2 ring-violet-500/50 shadow-lg'
                        : 'border-[#272733] hover:border-violet-500/40'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-xl bg-[#09090B] border border-[#272733] overflow-hidden mb-2 relative">
                      <img
                        src={cand.thumbnailUrl}
                        alt={cand.albumTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#A78BFA] text-[#09090B] flex items-center justify-center shadow-md">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/80 text-[#F5F3FF]">
                        {cand.resolution}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#F5F3FF] truncate">{cand.albumTitle}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">{cand.artistName}</p>
                      <p className="text-[10px] text-[#71717A] font-mono mt-0.5">
                        {cand.source} {cand.releaseYear ? `• ${cand.releaseYear}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-[#71717A] text-xs">
              Enter the artist and album name above and click Search.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#272733] flex items-center justify-between bg-[#111116]">
          <div className="text-xs text-[#71717A]">
            {selectedCandidate ? (
              <span className="text-[#F5F3FF]">
                Selected: <span className="font-semibold text-violet-400">{selectedCandidate.albumTitle}</span> (
                {selectedCandidate.resolution})
              </span>
            ) : (
              'Click a cover above to select it'
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedCandidate}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-40 text-[#09090B] text-xs font-bold rounded-xl transition shadow-md"
            >
              <Sparkles size={14} />
              <span>Apply Cover Art</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
