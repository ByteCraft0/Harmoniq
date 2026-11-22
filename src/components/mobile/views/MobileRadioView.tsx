import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePlayer } from '../../../context/PlayerContext';
import { mobileRadioService } from '../../../services/mobileRadioService';
import { radioDirectoryService } from '../../../services/radioDirectoryService';
import { RadioStation, RadioCountry, RadioGenre } from '../../../types/radio';
import { useBackHandler } from '../MobileNavigationContext';
import {
  Radio,
  Search,
  Heart,
  Play,
  Pause,
  Plus,
  Globe,
  Sparkles,
  Flame,
  Clock,
  Music2,
  X,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Check,
} from 'lucide-react';

type RadioSection = 'featured' | 'popular' | 'favorites' | 'recent' | 'countries' | 'genres';

export const MobileRadioView: React.FC = () => {
  const { currentTrack, isPlaying, playRadioStation, togglePlayPause } = usePlayer();

  const [activeSection, setActiveSection] = useState<RadioSection>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Station data
  const [featuredStations, setFeaturedStations] = useState<RadioStation[]>([]);
  const [popularStations, setPopularStations] = useState<RadioStation[]>([]);
  const [favorites, setFavorites] = useState<RadioStation[]>(() => mobileRadioService.getFavorites());
  const [recentStations, setRecentStations] = useState<RadioStation[]>(() => mobileRadioService.getRecentlyPlayed());
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);

  // Category browse data
  const [countries, setCountries] = useState<RadioCountry[]>([]);
  const [genres, setGenres] = useState<RadioGenre[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [categoryStations, setCategoryStations] = useState<RadioStation[]>([]);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add station modal form state
  const [modalName, setModalName] = useState('');
  const [modalUrl, setModalUrl] = useState('');
  const [modalLogo, setModalLogo] = useState('');
  const [modalGenre, setModalGenre] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Priority 4 Back Handler: Close modal or exit drill-down before navigating away
  useBackHandler(
    4,
    () => {
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
        return true;
      }
      if (selectedCountry) {
        setSelectedCountry(null);
        setCategoryStations([]);
        return true;
      }
      if (selectedGenre) {
        setSelectedGenre(null);
        setCategoryStations([]);
        return true;
      }
      if (searchQuery) {
        setSearchQuery('');
        setSearchResults([]);
        return true;
      }
      if (activeSection !== 'featured') {
        setActiveSection('featured');
        return true;
      }
      return false;
    },
    isAddModalOpen || Boolean(selectedCountry) || Boolean(selectedGenre) || Boolean(searchQuery) || activeSection !== 'featured'
  );

  // Listen to favorites & history changes
  useEffect(() => {
    return mobileRadioService.subscribe(() => {
      setFavorites(mobileRadioService.getFavorites());
      setRecentStations(mobileRadioService.getRecentlyPlayed());
    });
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    setError(null);

    radioDirectoryService
      .searchStations({ name: debouncedQuery, limit: 30 })
      .then((results) => {
        if (isMounted) {
          setSearchResults(results);
          setIsSearching(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Search failed. Please try again.');
          setIsSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Load section data
  const loadSectionData = (section: RadioSection) => {
    setError(null);
    setLoading(true);

    if (section === 'featured') {
      radioDirectoryService
        .getFeaturedStations(25)
        .then((data) => {
          setFeaturedStations(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load featured stations.');
          setLoading(false);
        });
    } else if (section === 'popular') {
      radioDirectoryService
        .getPopularStations(25)
        .then((data) => {
          setPopularStations(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load popular stations.');
          setLoading(false);
        });
    } else if (section === 'countries') {
      radioDirectoryService
        .getCountries(50)
        .then((data) => {
          setCountries(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load countries list.');
          setLoading(false);
        });
    } else if (section === 'genres') {
      radioDirectoryService
        .getGenres(50)
        .then((data) => {
          setGenres(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load genres list.');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      loadSectionData(activeSection);
    }
  }, [activeSection]);

  // Drill down by country
  const handleSelectCountry = (country: string) => {
    setSelectedCountry(country);
    setLoading(true);
    setError(null);
    radioDirectoryService
      .searchStations({ country, limit: 30 })
      .then((res) => {
        setCategoryStations(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || `Failed to load stations in ${country}.`);
        setLoading(false);
      });
  };

  // Drill down by genre
  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setLoading(true);
    setError(null);
    radioDirectoryService
      .searchStations({ tag: genre, limit: 30 })
      .then((res) => {
        setCategoryStations(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || `Failed to load ${genre} stations.`);
        setLoading(false);
      });
  };

  const handlePlayStation = (station: RadioStation) => {
    const isCurrent = currentTrack && currentTrack.id === `radio_${station.id}`;
    if (isCurrent) {
      togglePlayPause().catch(() => {});
    } else {
      playRadioStation(station).catch((err) => {
        console.error('Failed to play radio station:', err);
      });
    }
  };

  const handleToggleFavorite = (station: RadioStation, e: React.MouseEvent) => {
    e.stopPropagation();
    mobileRadioService.toggleFavorite(station);
  };

  const handleAddCustomStation = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const result = mobileRadioService.addCustomStation({
      name: modalName,
      streamUrl: modalUrl,
      favicon: modalLogo || undefined,
      genre: modalGenre || undefined,
    });

    if (result.error) {
      setModalError(result.error);
      return;
    }

    if (result.station) {
      setIsAddModalOpen(false);
      setModalName('');
      setModalUrl('');
      setModalLogo('');
      setModalGenre('');
      setActiveSection('favorites');
      handlePlayStation(result.station);
    }
  };

  const currentPlayingId = currentTrack?.id?.startsWith('radio_')
    ? currentTrack.id.replace('radio_', '')
    : null;

  return (
    <div className="space-y-4 pb-44 animate-in fade-in duration-200">
      {/* Header with Title and Add Station Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Radio className="w-5 h-5 text-violet-400" />
            <span>Internet Radio</span>
          </h2>
          <p className="text-xs text-zinc-400">Discover and stream live global radio stations</p>
        </div>

        <button
          onClick={() => {
            setModalError(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-all active:scale-95"
          title="Add Station by URL"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add URL</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by station name, country, or genre..."
          className="w-full bg-[#14141b] border border-[#272733] rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills (Hidden while search is active or in drill-down) */}
      {!searchQuery && !selectedCountry && !selectedGenre && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'featured', label: 'Featured', icon: Sparkles },
            { id: 'popular', label: 'Popular', icon: Flame },
            { id: 'favorites', label: `Favorites (${favorites.length})`, icon: Heart },
            { id: 'recent', label: 'Recent', icon: Clock },
            { id: 'countries', label: 'Countries', icon: Globe },
            { id: 'genres', label: 'Genres', icon: Music2 },
          ].map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id as RadioSection)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95 ${
                  active
                    ? 'bg-violet-600 text-white font-medium shadow-sm shadow-violet-900/40'
                    : 'bg-[#14141b] text-zinc-400 hover:text-zinc-200 border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category Drill-Down Banner */}
      {(selectedCountry || selectedGenre) && (
        <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-violet-950/30 border border-violet-800/30">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedCountry(null);
                setSelectedGenre(null);
                setCategoryStations([]);
              }}
              className="p-1 rounded-lg bg-white/5 text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white capitalize">
              {selectedCountry ? `Country: ${selectedCountry}` : `Genre: ${selectedGenre}`}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">{categoryStations.length} stations</span>
        </div>
      )}

      {/* Loading State */}
      {(loading || isSearching) && (
        <div className="space-y-2 py-4">
          <div className="flex items-center justify-center space-x-2 text-violet-400 text-xs py-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Connecting to Global Radio Directory...</span>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-[#14141b]/60 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && !isSearching && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-800/30 text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-red-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Connection Error</span>
          </div>
          <p className="text-[11px] text-zinc-400">{error}</p>
          <button
            onClick={() => {
              if (searchQuery) {
                setDebouncedQuery(searchQuery);
              } else {
                loadSectionData(activeSection);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-medium inline-flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Station List Views */}
      {!loading && !isSearching && !error && (
        <>
          {/* SEARCH RESULTS */}
          {searchQuery && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
                <span>Search Results for "{searchQuery}"</span>
                <span>{searchResults.length} stations</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#14141b]/40 border border-white/5 space-y-2">
                  <Radio className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No stations found matching "{searchQuery}"</p>
                  <p className="text-[11px] text-zinc-500">
                    Try searching for another country, genre, or station name.
                  </p>
                </div>
              ) : (
                searchResults.map((station) => (
                  <StationRow
                    key={station.id}
                    station={station}
                    isPlaying={currentPlayingId === station.id && isPlaying}
                    isFavorite={mobileRadioService.isFavorite(station.id)}
                    onPlay={() => handlePlayStation(station)}
                    onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                  />
                ))
              )}
            </div>
          )}

          {/* DRILL-DOWN STATIONS (Country or Genre) */}
          {!searchQuery && (selectedCountry || selectedGenre) && (
            <div className="space-y-2">
              {categoryStations.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#14141b]/40 border border-white/5">
                  <p className="text-xs text-zinc-400">No active stations found in this category.</p>
                </div>
              ) : (
                categoryStations.map((station) => (
                  <StationRow
                    key={station.id}
                    station={station}
                    isPlaying={currentPlayingId === station.id && isPlaying}
                    isFavorite={mobileRadioService.isFavorite(station.id)}
                    onPlay={() => handlePlayStation(station)}
                    onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                  />
                ))
              )}
            </div>
          )}

          {/* FEATURED SECTION */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'featured' && (
            <div className="space-y-2">
              {featuredStations.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  isPlaying={currentPlayingId === station.id && isPlaying}
                  isFavorite={mobileRadioService.isFavorite(station.id)}
                  onPlay={() => handlePlayStation(station)}
                  onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                />
              ))}
            </div>
          )}

          {/* POPULAR SECTION */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'popular' && (
            <div className="space-y-2">
              {popularStations.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  isPlaying={currentPlayingId === station.id && isPlaying}
                  isFavorite={mobileRadioService.isFavorite(station.id)}
                  onPlay={() => handlePlayStation(station)}
                  onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                />
              ))}
            </div>
          )}

          {/* FAVORITES SECTION */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'favorites' && (
            <div className="space-y-2">
              {favorites.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#14141b]/40 border border-white/5 space-y-2">
                  <Heart className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">No Favorite Stations Yet</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                    Tap the heart icon on any station to add it to your quick-access favorites list.
                  </p>
                </div>
              ) : (
                favorites.map((station) => (
                  <StationRow
                    key={station.id}
                    station={station}
                    isPlaying={currentPlayingId === station.id && isPlaying}
                    isFavorite={true}
                    onPlay={() => handlePlayStation(station)}
                    onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                  />
                ))
              )}
            </div>
          )}

          {/* RECENT SECTION */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'recent' && (
            <div className="space-y-2">
              {recentStations.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#14141b]/40 border border-white/5 space-y-2">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">No Recent Radio History</p>
                  <p className="text-[11px] text-zinc-500">
                    Stations you listen to will automatically appear here.
                  </p>
                </div>
              ) : (
                recentStations.map((station) => (
                  <StationRow
                    key={station.id}
                    station={station}
                    isPlaying={currentPlayingId === station.id && isPlaying}
                    isFavorite={mobileRadioService.isFavorite(station.id)}
                    onPlay={() => handlePlayStation(station)}
                    onToggleFavorite={(e) => handleToggleFavorite(station, e)}
                  />
                ))
              )}
            </div>
          )}

          {/* COUNTRIES BROWSE */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'countries' && (
            <div className="grid grid-cols-2 gap-2">
              {countries.map((c) => (
                <button
                  key={c.code || c.name}
                  onClick={() => handleSelectCountry(c.name)}
                  className="p-3 rounded-xl bg-[#14141b] border border-white/5 flex items-center justify-between text-left hover:border-violet-500/40 active:scale-98 transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-zinc-500">{c.stationCount} stations</p>
                  </div>
                  <Globe className="w-4 h-4 text-violet-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* GENRES BROWSE */}
          {!searchQuery && !selectedCountry && !selectedGenre && activeSection === 'genres' && (
            <div className="grid grid-cols-2 gap-2">
              {genres.map((g) => (
                <button
                  key={g.name}
                  onClick={() => handleSelectGenre(g.name)}
                  className="p-3 rounded-xl bg-[#14141b] border border-white/5 flex items-center justify-between text-left hover:border-violet-500/40 active:scale-98 transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-white capitalize truncate">{g.name}</p>
                    <p className="text-[10px] text-zinc-500">{g.stationCount} stations</p>
                  </div>
                  <Music2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Custom Station Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#14141b] border border-[#272733] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2 text-violet-400">
                <Plus className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Add Station by URL</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/40 text-[11px] text-red-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddCustomStation} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Station Name *
                </label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. SomaFM Groove Salad"
                  className="w-full bg-[#1b1b24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Audio Stream URL *
                </label>
                <input
                  type="url"
                  required
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                  placeholder="https://... (.mp3, .aac, or .m3u8)"
                  className="w-full bg-[#1b1b24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Only HTTP and HTTPS stream URLs are supported.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Station Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={modalLogo}
                  onChange={(e) => setModalLogo(e.target.value)}
                  placeholder="https://... (.png, .jpg)"
                  className="w-full bg-[#1b1b24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Genre (Optional)
                </label>
                <input
                  type="text"
                  value={modalGenre}
                  onChange={(e) => setModalGenre(e.target.value)}
                  placeholder="e.g. Ambient, Jazz, Electronic"
                  className="w-full bg-[#1b1b24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-md shadow-violet-900/30"
                >
                  Save & Play
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface StationRowProps {
  station: RadioStation;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const StationRow: React.FC<StationRowProps> = ({
  station,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onPlay}
      className={`p-3 rounded-xl border flex items-center justify-between space-x-3 transition-all cursor-pointer active:scale-[0.99] ${
        isPlaying
          ? 'bg-violet-950/30 border-violet-500/50 shadow-sm shadow-violet-900/30'
          : 'bg-[#14141b] border-white/5 hover:border-white/10'
      }`}
    >
      {/* Station Logo / Placeholder */}
      <div className="w-11 h-11 rounded-lg bg-[#1b1b24] border border-white/5 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
        {station.favicon && !imgError ? (
          <img
            src={station.favicon}
            alt={station.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <Radio className="w-5 h-5 text-violet-400/70" />
        )}
        {isPlaying && (
          <div className="absolute inset-0 bg-violet-600/40 backdrop-blur-[1px] flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-white animate-ping" />
          </div>
        )}
      </div>

      {/* Station Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center space-x-1.5">
          <h4
            className={`text-xs font-semibold truncate ${
              isPlaying ? 'text-violet-300' : 'text-white'
            }`}
          >
            {station.name}
          </h4>
          <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-red-600/20 text-red-400 border border-red-500/30 flex-shrink-0">
            LIVE
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-0.5 truncate">
          {station.country && <span>{station.country}</span>}
          {station.country && station.tags.length > 0 && <span>•</span>}
          {station.tags.length > 0 && (
            <span className="capitalize truncate text-zinc-500">
              {station.tags.slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 mt-1">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-zinc-400 border border-white/5">
            {station.codec || 'MP3'}
          </span>
          {station.bitrate ? (
            <span className="text-[9px] font-mono text-zinc-500">
              {station.bitrate} kbps
            </span>
          ) : null}
        </div>
      </div>

      {/* Action Buttons: Favorite and Play/Pause */}
      <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggleFavorite}
          aria-label="Toggle radio favorite"
          className="p-2 text-zinc-500 hover:text-red-400 active:scale-90 transition-transform"
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-500'
            }`}
          />
        </button>

        <button
          onClick={onPlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isPlaying
              ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      </div>
    </div>
  );
};
