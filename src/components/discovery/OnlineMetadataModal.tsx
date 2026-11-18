import React, { useState } from 'react';
import { TrackMetadata } from '../../types/audio';
import { discoveryService, OnlineMetadataResult } from '../../services/discoveryService';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import {
  Globe,
  Search,
  X,
  Check,
  Disc,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface OnlineMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackMetadata;
}

export const OnlineMetadataModal: React.FC<OnlineMetadataModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const { updateTrackMetadataInLibrary } = useLibrary();
  const { showToast } = useToast();

  const [searchTitle, setSearchTitle] = useState(track.title || '');
  const [searchArtist, setSearchArtist] = useState(track.artist || '');
  const [searchAlbum, setSearchAlbum] = useState(track.album || '');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<OnlineMetadataResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OnlineMetadataResult | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchTitle && !searchArtist && !searchAlbum) return;

    setIsSearching(true);
    setResults([]);
    setSelectedResult(null);

    const data = await discoveryService.searchOnlineMetadata({
      title: searchTitle,
      artist: searchArtist,
      album: searchAlbum,
    });

    setIsSearching(false);
    setResults(data);
    if (data.length > 0) {
      setSelectedResult(data[0]);
    } else {
      showToast('No matching releases found on MusicBrainz', 'info');
    }
  };

  const handleApply = async () => {
    if (!selectedResult) return;

    const updated: TrackMetadata = {
      ...track,
      title: selectedResult.title || track.title,
      artist: selectedResult.artist || track.artist,
      album: selectedResult.album || track.album,
      year: selectedResult.year || track.year,
      artworkDataUrl: selectedResult.artworkUrl || track.artworkDataUrl,
      hasArtwork: !!selectedResult.artworkUrl || track.hasArtwork,
    };

    // Embed tags to file if Electron writer is available
    if (typeof window !== 'undefined' && (window as any).harmoniqApi?.writeAudioTags) {
      try {
        await (window as any).harmoniqApi.writeAudioTags(track.filePath, {
          title: updated.title,
          artist: updated.artist,
          album: updated.album,
          year: updated.year,
        });
      } catch (e) {
        console.warn('Failed to embed online tags to disk file:', e);
      }
    }

    updateTrackMetadataInLibrary(updated);
    showToast(`Updated "${track.title}" with verified MusicBrainz metadata`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101018] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Online Metadata Retrieval</h2>
              <p className="text-xs text-zinc-400">
                Search and fetch verified metadata from MusicBrainz and Cover Art Archive
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

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-white/5 bg-white/[0.01]"
        >
          <input
            type="text"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="Title..."
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={searchArtist}
            onChange={(e) => setSearchArtist(e.target.value)}
            placeholder="Artist..."
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={searchAlbum}
            onChange={(e) => setSearchAlbum(e.target.value)}
            placeholder="Album..."
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm disabled:opacity-40 transition-all"
          >
            <Search size={13} /> {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results & Side-by-Side Diff */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {results.length > 0 ? (
            <div className="space-y-4">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Search Results ({results.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.map((res) => {
                  const isSelected = selectedResult?.id === res.id;
                  return (
                    <div
                      key={res.id}
                      onClick={() => setSelectedResult(res)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-violet-600/20 border-violet-500/60 shadow-md'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#09090B] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {res.artworkUrl ? (
                          <img
                            src={res.artworkUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Disc size={20} className="text-zinc-600" />
                        )}
                      </div>

                      <div className="truncate min-w-0 flex-1 text-xs">
                        <div className="font-semibold text-white truncate">{res.album}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{res.artist}</div>
                        <div className="text-[10px] text-zinc-500 font-mono-numbers mt-0.5">
                          {res.year ? `${res.year}` : 'Unknown year'}
                          {res.country ? ` • ${res.country}` : ''}
                          {res.trackCount ? ` • ${res.trackCount} tracks` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Side-by-side comparison */}
              {selectedResult && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Metadata Preview Diff
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Current Metadata</span>
                      <div><strong>Title:</strong> {track.title}</div>
                      <div><strong>Artist:</strong> {track.artist}</div>
                      <div><strong>Album:</strong> {track.album}</div>
                      <div><strong>Year:</strong> {track.year || 'Unknown'}</div>
                    </div>

                    <div className="p-3 rounded-lg bg-violet-950/20 border border-violet-500/20 space-y-1 text-violet-200">
                      <span className="text-[10px] text-violet-400 font-bold uppercase">MusicBrainz Verified</span>
                      <div><strong>Title:</strong> {selectedResult.title}</div>
                      <div><strong>Artist:</strong> {selectedResult.artist}</div>
                      <div><strong>Album:</strong> {selectedResult.album}</div>
                      <div><strong>Year:</strong> {selectedResult.year || 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
              <Globe size={36} className="text-zinc-600" />
              <p className="text-sm font-medium">Search MusicBrainz to view verified online metadata</p>
              <p className="text-xs text-zinc-600">
                You can adjust title, artist, or album keywords in the search fields above
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <span className="text-xs text-zinc-500">
            Source: MusicBrainz & Cover Art Archive
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedResult}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-xs font-semibold text-white shadow-glow-sm transition-all"
            >
              <Check size={14} /> Apply Verified Metadata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
