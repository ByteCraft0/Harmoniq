import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { Album } from '../../types/library';
import { TrackMetadata } from '../../types/audio';
import {
  Disc,
  Play,
  ListPlus,
  SlidersHorizontal,
  Search,
  Sparkles,
  Maximize2,
  Clock,
  User,
  X,
  Plus,
  Check,
  Eye,
  Filter,
} from 'lucide-react';
import { AddToPlaylistModal } from '../layout/AddToPlaylistModal';
import { ImmersiveAlbumView } from './ImmersiveAlbumView';

export const VinylCollectionView: React.FC = () => {
  const { albums, artists, tracks, setActiveView, openAlbumDetail, openArtistDetail } = useLibrary();
  const { currentTrack, isPlaying, playTrack, addToQueue } = usePlayer();

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'year' | 'trackCount'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isVinylSpinEnabled, setIsVinylSpinEnabled] = useState<boolean>(true);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<TrackMetadata[] | null>(null);
  const [immersiveAlbum, setImmersiveAlbum] = useState<Album | null>(null);

  // Extract distinct genres
  const genres = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((a) => {
      if (a.genre && a.genre.trim()) set.add(a.genre.trim());
    });
    return Array.from(set).sort();
  }, [albums]);

  // Decades options
  const decades = ['2020s', '2010s', '2000s', '1990s', '1980s'];

  // Filtered & Sorted Albums
  const filteredAlbums = useMemo(() => {
    let result = [...albums];

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.artist.toLowerCase().includes(q) ||
          (a.genre && a.genre.toLowerCase().includes(q))
      );
    }

    if (selectedGenre !== 'all') {
      result = result.filter(
        (a) => a.genre && a.genre.toLowerCase() === selectedGenre.toLowerCase()
      );
    }

    if (selectedDecade !== 'all') {
      result = result.filter((a) => {
        if (!a.year) return false;
        const y = a.year;
        if (selectedDecade === '2020s') return y >= 2020 && y <= 2029;
        if (selectedDecade === '2010s') return y >= 2010 && y <= 2019;
        if (selectedDecade === '2000s') return y >= 2000 && y <= 2009;
        if (selectedDecade === '1990s') return y >= 1990 && y <= 1999;
        if (selectedDecade === '1980s') return y >= 1980 && y <= 1989;
        return false;
      });
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'artist') cmp = a.artist.localeCompare(b.artist);
      else if (sortBy === 'year') cmp = (a.year || 0) - (b.year || 0);
      else if (sortBy === 'trackCount') cmp = a.tracks.length - b.tracks.length;
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [albums, searchFilter, selectedGenre, selectedDecade, sortBy, sortOrder]);

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayAlbum = (album: Album) => {
    if (album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
    }
  };

  const handleQueueAlbum = (album: Album) => {
    album.tracks.forEach((t) => addToQueue(t));
  };

  if (immersiveAlbum) {
    return (
      <ImmersiveAlbumView
        albumOverride={immersiveAlbum}
        onExit={() => setImmersiveAlbum(null)}
      />
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090B] text-[#F5F3FF] select-none overflow-hidden relative font-sans">
      {/* Top Header: Brand Title, Search, Spin Toggle & Sort Controls */}
      <div className="p-6 border-b border-[#272733]/80 space-y-4 shrink-0 bg-[#0D0D12]/60 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#F5F3FF] flex items-center gap-2.5">
              <Disc size={22} className="text-[var(--accent-dynamic)]" />
              <span>Vinyl Collection Mode</span>
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Explore your digital record crate with authentic sleeve slide-outs and spinning vinyl records.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Vinyl Animation Toggle Button */}
            <button
              onClick={() => setIsVinylSpinEnabled(!isVinylSpinEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isVinylSpinEnabled
                  ? 'bg-[var(--accent-dynamic)]/15 border-[var(--accent-dynamic)] text-[var(--accent-dynamic)] shadow-glow-sm'
                  : 'bg-white/5 border-white/10 text-[#71717A] hover:text-[#A1A1AA]'
              }`}
              title="Toggle 33⅓ RPM rotating vinyl animation"
            >
              <Disc size={13} className={isVinylSpinEnabled ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
              <span>Spin: {isVinylSpinEnabled ? 'On' : 'Off'}</span>
            </button>

            {/* Sort Order Button */}
            <div className="flex items-center gap-1 bg-[#14141B] p-1 rounded-xl border border-[#272733]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-[#E4E4E7] focus:outline-none px-2 font-mono-numbers"
              >
                <option value="title">Sort: Title</option>
                <option value="artist">Sort: Artist</option>
                <option value="year">Sort: Release Year</option>
                <option value="trackCount">Sort: Track Count</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 text-[#A1A1AA] hover:text-white transition-colors text-xs font-mono-numbers px-1.5"
                title="Toggle Sort Direction"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Chips Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search vinyl records by album, artist, or genre..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#14141B] border border-[#272733] text-xs text-[#F5F3FF] placeholder-[#71717A] focus:border-[var(--accent-dynamic)] focus:outline-none"
            />
          </div>

          {/* Genre / Decade Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
            <button
              onClick={() => {
                setSelectedGenre('all');
                setSelectedDecade('all');
              }}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-all ${
                selectedGenre === 'all' && selectedDecade === 'all'
                  ? 'bg-[var(--accent-dynamic)] border-transparent text-white shadow-glow-sm'
                  : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white'
              }`}
            >
              All Records ({albums.length})
            </button>

            {decades.map((dec) => (
              <button
                key={dec}
                onClick={() => {
                  setSelectedDecade(selectedDecade === dec ? 'all' : dec);
                  setSelectedGenre('all');
                }}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-mono-numbers whitespace-nowrap transition-all ${
                  selectedDecade === dec
                    ? 'bg-[var(--accent-dynamic)] border-transparent text-white shadow-glow-sm'
                    : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white'
                }`}
              >
                {dec}
              </button>
            ))}

            {genres.slice(0, 6).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGenre(selectedGenre === g ? 'all' : g);
                  setSelectedDecade('all');
                }}
                className={`px-3 py-1.5 rounded-full border text-[11px] whitespace-nowrap transition-all ${
                  selectedGenre === g
                    ? 'bg-[var(--accent-dynamic)] border-transparent text-white shadow-glow-sm'
                    : 'bg-white/5 border-white/10 text-[#A1A1AA] hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Showcase: Virtual Record Crate Grid & Detail Slideout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Vinyl Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {filteredAlbums.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-xs text-[#71717A] space-y-2">
              <Disc size={40} className="text-[#3F3F46] animate-pulse" />
              <p className="font-semibold text-[#A1A1AA]">No matching vinyl records found</p>
              <p>Try refining your search terms or genre filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredAlbums.map((album) => {
                const isAlbumPlaying =
                  isPlaying &&
                  currentTrack &&
                  album.tracks.some((t) => t.id === currentTrack.id);
                const isSelected = selectedAlbum?.id === album.id;

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbum(album)}
                    className="group relative flex flex-col cursor-pointer transition-all duration-300"
                  >
                    {/* Vinyl Record & Cardboard Sleeve Presentation */}
                    <div className="relative aspect-square w-full rounded-xl overflow-visible mb-2.5">
                      {/* Realistic Vinyl Disc (Slides out of sleeve on hover or selection) */}
                      <div
                        className={`absolute top-0 bottom-0 aspect-square rounded-full bg-[#0E0C13] border-2 border-[#1E1B26] shadow-2xl transition-all duration-500 ease-out flex items-center justify-center overflow-hidden ${
                          isSelected
                            ? 'translate-x-[42%] z-0'
                            : 'translate-x-[2%] group-hover:translate-x-[36%] z-0'
                        } ${isAlbumPlaying && isVinylSpinEnabled ? 'animate-spin' : ''}`}
                        style={{
                          animationDuration: '2.5s',
                          animationTimingFunction: 'linear',
                        }}
                      >
                        {/* Realistic Concentric Audio Grooves */}
                        <div className="absolute inset-1.5 rounded-full border border-white/5 pointer-events-none" />
                        <div className="absolute inset-3 rounded-full border border-white/5 pointer-events-none" />
                        <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
                        <div className="absolute inset-7 rounded-full border border-white/5 pointer-events-none" />
                        <div className="absolute inset-9 rounded-full border border-white/5 pointer-events-none" />

                        {/* Circular Spindle Paper Center Label with Artwork */}
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-md flex items-center justify-center bg-[#181624]">
                          {album.artworkDataUrl ? (
                            <img
                              src={album.artworkDataUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Disc size={20} className="text-[#52525B]" />
                          )}
                          <div className="absolute w-2 h-2 rounded-full bg-[#09090B] border border-white/40 shadow-inner" />
                        </div>
                      </div>

                      {/* Cardboard Album Sleeve Cover */}
                      <div className="relative z-10 w-full h-full rounded-xl overflow-hidden bg-[#14141B] border border-white/10 shadow-xl transition-transform duration-300 group-hover:scale-[1.02] flex items-center justify-center">
                        {album.artworkDataUrl ? (
                          <img
                            src={album.artworkDataUrl}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc size={48} className="text-[#3F3F46]" />
                        )}

                        {/* Cardboard Sleeve Spine Sheen Highlight */}
                        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />

                        {/* Quick Play Hover Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAlbum(album);
                          }}
                          className="absolute bottom-2 right-2 p-2.5 rounded-full bg-[var(--accent-dynamic)] text-white shadow-glow opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                          title="Play Album"
                        >
                          <Play size={15} className="fill-white ml-0.5" />
                        </button>

                        {/* Active Playing Indicator Ribbon */}
                        {isAlbumPlaying && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[var(--accent-dynamic)]/90 backdrop-blur-sm text-white font-mono-numbers text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>Playing</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Album Info */}
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-[#F5F3FF] truncate group-hover:text-[var(--accent-dynamic)] transition-colors">
                        {album.title}
                      </h4>
                      <p className="text-[11px] text-[#A1A1AA] truncate">{album.artist}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[#71717A] font-mono-numbers">
                        {album.year && <span>{album.year}</span>}
                        {album.year && <span>•</span>}
                        <span>{album.tracks.length} tracks</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Album Detail Drawer (Side Panel) */}
        {selectedAlbum && (
          <aside className="w-80 md:w-96 h-full bg-[#0D0D12]/95 border-l border-[#272733] p-5 flex flex-col justify-between overflow-hidden shadow-2xl animate-in slide-in-from-right duration-200 shrink-0 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[#272733] pb-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-dynamic)] font-mono-numbers">
                ALBUM DETAILS
              </span>
              <button
                onClick={() => setSelectedAlbum(null)}
                className="p-1 rounded-lg text-[#71717A] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Album Header */}
            <div className="space-y-3 mb-4">
              <div className="w-36 h-36 mx-auto rounded-2xl overflow-hidden bg-[#14141B] border border-white/10 shadow-xl flex items-center justify-center">
                {selectedAlbum.artworkDataUrl ? (
                  <img
                    src={selectedAlbum.artworkDataUrl}
                    alt={selectedAlbum.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc size={48} className="text-[#3F3F46]" />
                )}
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-extrabold text-[#F5F3FF] truncate">
                  {selectedAlbum.title}
                </h3>
                <button
                  onClick={() => {
                    if (selectedAlbum.artist) {
                      const found = artists.find(
                        (a) => a.name.toLowerCase() === selectedAlbum.artist.toLowerCase()
                      );
                      if (found) {
                        openArtistDetail(found);
                      } else {
                        openArtistDetail({
                          id: selectedAlbum.artist,
                          name: selectedAlbum.artist,
                          albumCount: 1,
                          trackCount: selectedAlbum.tracks.length,
                          albums: [selectedAlbum],
                        });
                      }
                    }
                  }}
                  className="text-xs text-[#A1A1AA] hover:text-[var(--accent-dynamic)] font-medium transition-colors"
                >
                  {selectedAlbum.artist}
                </button>
                <div className="flex items-center justify-center gap-2 text-[10px] text-[#71717A] font-mono-numbers">
                  {selectedAlbum.year && <span>{selectedAlbum.year}</span>}
                  {selectedAlbum.genre && <span>• {selectedAlbum.genre}</span>}
                  <span>• {selectedAlbum.tracks.length} tracks</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handlePlayAlbum(selectedAlbum)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--accent-dynamic)] hover:opacity-90 text-white font-bold text-xs shadow-glow-sm transition-all"
                >
                  <Play size={13} className="fill-white" />
                  <span>Play</span>
                </button>
                <button
                  onClick={() => handleQueueAlbum(selectedAlbum)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#E4E4E7] hover:text-white transition-colors"
                  title="Queue All Tracks"
                >
                  <ListPlus size={15} />
                </button>
                <button
                  onClick={() => setPlaylistModalTracks(selectedAlbum.tracks)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#E4E4E7] hover:text-white transition-colors"
                  title="Add to Playlist"
                >
                  <Plus size={15} />
                </button>
                <button
                  onClick={() => setImmersiveAlbum(selectedAlbum)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#E4E4E7] hover:text-white transition-colors"
                  title="Open in Immersive Fullscreen"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>

            {/* Tracklist */}
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar border-t border-[#272733] pt-3 pr-1">
              <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider font-mono-numbers block mb-1">
                Tracklist
              </span>
              {selectedAlbum.tracks.map((t, idx) => {
                const isCurrent = currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => playTrack(t, selectedAlbum.tracks)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-colors cursor-pointer text-xs ${
                      isCurrent
                        ? 'bg-[var(--accent-dynamic)]/15 border-[var(--accent-dynamic)] text-white shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 border-transparent text-[#A1A1AA] hover:text-[#F5F3FF]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-4 text-center font-mono-numbers text-[10px] text-[#71717A]">
                        {t.trackNumber || idx + 1}
                      </span>
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <span className="font-mono-numbers text-[10px] text-[#71717A] shrink-0">
                      {formatDuration(t.duration || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Playlist Modal */}
      {playlistModalTracks && (
        <AddToPlaylistModal
          isOpen={true}
          tracks={playlistModalTracks}
          onClose={() => setPlaylistModalTracks(null)}
        />
      )}
    </div>
  );
};
