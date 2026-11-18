import React, { useState } from 'react';
import { LyricsService } from '../../services/lyricsService';
import { TrackMetadata } from '../../types/audio';
import { LyricsData } from '../../types/lyrics';
import { Search, Loader2, Sparkles, Check, X, FileText, Music } from 'lucide-react';

interface LrclibSearchResult {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  syncedLyrics?: string;
  plainLyrics?: string;
}

interface SearchOnlineLyricsModalProps {
  currentTrack: TrackMetadata;
  onApplyLyrics: (data: LyricsData) => void;
  onClose: () => void;
}

export const SearchOnlineLyricsModal: React.FC<SearchOnlineLyricsModalProps> = ({
  currentTrack,
  onApplyLyrics,
  onClose,
}) => {
  const [query, setQuery] = useState(
    `${currentTrack.title || ''} ${currentTrack.artist || ''}`.trim()
  );
  const [results, setResults] = useState<LrclibSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchTerm: string) => {
    const q = searchTerm.trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Harmoniq-Audio-Player/1.0.0' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Search provider returned status ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setResults(data);
      } else {
        setError('No lyrics found for this query.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search online lyrics catalog');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectResult = (item: LrclibSearchResult) => {
    const rawLyrics = item.syncedLyrics || item.plainLyrics;
    if (!rawLyrics) return;

    const parsed = LyricsService.parseLrc(rawLyrics, 'online');
    onApplyLyrics(parsed);
    onClose();
  };

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec)) return '';
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#272733] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F3FF]">Search Lyrics Online</h2>
              <p className="text-xs text-[#A1A1AA]">
                Find synchronized LRC or plain lyrics from licensed open provider (LRCLIB)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF]">
            <X size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 py-3 bg-[#111116] border-b border-[#272733] flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search song title and artist..."
            className="flex-1 bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none"
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-50 text-[#09090B] text-xs font-bold rounded-lg transition"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>Search</span>
          </button>
        </div>

        {/* Results */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-[#71717A] space-y-2">
              <Loader2 size={24} className="animate-spin mx-auto text-[#A78BFA]" />
              <p className="text-xs">Searching lyrics database...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((item) => {
                const isSynced = !!(item.syncedLyrics && item.syncedLyrics.trim());
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-[#1B1B24] border border-[#272733] hover:border-violet-500/40 rounded-xl flex items-center justify-between gap-4 group transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F5F3FF] truncate">
                          {item.trackName || item.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            isSynced
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-[#272733] text-[#A1A1AA]'
                          }`}
                        >
                          {isSynced ? 'SYNCHRONIZED (LRC)' : 'PLAIN TEXT'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                        {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}{' '}
                        {item.duration > 0 ? `(${formatDuration(item.duration)})` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSelectResult(item)}
                      className="px-3 py-1.5 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] text-xs font-bold rounded-lg transition shrink-0 shadow-sm"
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-[#71717A] text-xs">
              Type song title or artist above and click Search to query available lyrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
