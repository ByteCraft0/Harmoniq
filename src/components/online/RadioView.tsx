import React, { useState, useEffect } from 'react';
import { radioService } from '../../services/radioService';
import { RadioStation, RadioPlaybackState } from '../../types/online';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
import {
  Radio,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Heart,
  Plus,
  Trash2,
  RadioTower,
  Wifi,
  AlertCircle,
  ExternalLink,
  X,
  RotateCcw,
  Loader2,
} from 'lucide-react';

export const RadioView: React.FC = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [playbackState, setPlaybackState] = useState<RadioPlaybackState>(radioService.getState());
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New station form state
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    setStations(radioService.getAllStations());
    const unsub = radioService.subscribe((st) => {
      setPlaybackState(st);
      setStations(radioService.getAllStations());
    });
    return unsub;
  }, []);

  const genres = ['all', 'favorites', ...Array.from(new Set(stations.map((s) => s.genre)))];

  const filteredStations = stations.filter((s) => {
    if (selectedGenre === 'favorites') return s.isFavorite;
    if (selectedGenre === 'all') return true;
    return s.genre === selectedGenre;
  });

  const handleOpenAddModal = () => {
    setNewName('');
    setNewUrl('');
    setNewGenre('');
    setNewCountry('');
    setAddError(null);
    setShowAddModal(true);
  };

  const handleAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) {
      setAddError('Station Name and Stream URL are required.');
      return;
    }
    try {
      new URL(newUrl.trim());
    } catch {
      setAddError('Please enter a valid HTTP or HTTPS stream URL.');
      return;
    }

    radioService.addCustomStation({
      name: newName.trim(),
      streamUrl: newUrl.trim(),
      genre: newGenre.trim() || 'Custom',
      country: newCountry.trim() || undefined,
    });

    setNewName('');
    setNewUrl('');
    setNewGenre('');
    setNewCountry('');
    setAddError(null);
    setShowAddModal(false);
  };

  const currentStation = playbackState.currentStation;
  const isPlayingThisStation = (s: RadioStation) =>
    currentStation?.id === s.id && (playbackState.status === 'playing' || playbackState.status === 'buffering' || playbackState.status === 'connecting');

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center text-pink-400">
            <Radio size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F5F3FF]">Internet Radio</h1>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Live broadcast streams & audio stations. Direct audio streaming with automated stream resolution.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-[#F5F3FF] text-xs font-semibold rounded-xl shadow-md transition shrink-0"
        >
          <Plus size={16} />
          <span>Add Custom Station</span>
        </button>
      </div>

      {/* Persistent Radio Player Deck */}
      {currentStation && (
        <div className="p-4 bg-[#14141B] border border-violet-500/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
            <div className="w-12 h-12 rounded-xl bg-[#1B1B24] border border-[#272733] flex items-center justify-center shrink-0 overflow-hidden relative">
              <RadioTower size={24} className="text-violet-400 absolute" />
              {currentStation.logoUrl && (
                <img
                  src={currentStation.logoUrl}
                  alt={currentStation.name}
                  className="w-full h-full object-cover relative z-10"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#F5F3FF] truncate">{currentStation.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold flex items-center gap-1 ${
                    playbackState.status === 'playing'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : playbackState.status === 'buffering' || playbackState.status === 'connecting'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {playbackState.status === 'connecting' || playbackState.status === 'buffering' ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Wifi size={10} />
                  )}
                  {playbackState.status === 'playing' ? 'LIVE' : playbackState.status}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
                {currentStation.genre} {currentStation.country ? `• ${currentStation.country}` : ''}{' '}
                {currentStation.bitrate ? `• ${currentStation.bitrate} kbps` : ''}
              </p>
              {playbackState.status === 'error' && playbackState.errorMessage && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1.5">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{playbackState.errorMessage}</span>
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {playbackState.status === 'error' ? (
              <button
                onClick={() => radioService.retryCurrentStation()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-[#F5F3FF] text-xs font-semibold rounded-xl transition shadow-md"
              >
                <RotateCcw size={14} />
                <span>Retry Connection</span>
              </button>
            ) : (
              <button
                onClick={() => radioService.togglePlayPause()}
                className="p-3 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] rounded-full transition shadow-md"
              >
                {playbackState.status === 'playing' ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
            )}

            <button
              onClick={() => radioService.stop()}
              className="p-2.5 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-full transition"
              title="Stop stream"
            >
              <Square size={16} />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-[#272733]">
              <Volume2 size={16} className="text-[#71717A]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={playbackState.volume}
                onChange={(e) => radioService.setVolume(parseFloat(e.target.value))}
                className="w-20 accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize shrink-0 transition ${
              selectedGenre === g
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                : 'bg-[#14141B] text-[#A1A1AA] hover:text-[#F5F3FF] border border-[#272733]'
            }`}
          >
            {g === 'favorites' ? '★ Favorites' : g}
          </button>
        ))}
      </div>

      {/* Stations Grid */}
      {filteredStations.length === 0 ? (
        <div className="py-16">
          <HarmoniqEmptyState
            type="empty_search"
            title="No Radio Stations Found"
            description="No stations match the selected filter. Try choosing another genre or add a custom radio stream."
            action={{
              label: 'Add Custom Station',
              onClick: () => setShowAddModal(true),
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStations.map((station) => {
          const isPlaying = isPlayingThisStation(station);
          return (
            <div
              key={station.id}
              className={`p-4 bg-[#14141B] border rounded-2xl flex flex-col justify-between transition group relative ${
                isPlaying ? 'border-violet-500/50 shadow-lg shadow-violet-950/20' : 'border-[#272733] hover:border-[#38BDF8]/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1B1B24] border border-[#272733] flex items-center justify-center shrink-0 overflow-hidden relative">
                    <Radio size={22} className="text-[#71717A] absolute" />
                    {station.logoUrl && (
                      <img
                        src={station.logoUrl}
                        alt={station.name}
                        className="w-full h-full object-cover relative z-10"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => radioService.toggleFavorite(station.id)}
                      className={`p-1.5 rounded-lg transition ${
                        station.isFavorite
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-[#71717A] hover:text-[#F5F3FF]'
                      }`}
                      title={station.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart size={16} fill={station.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    {station.isCustom && (
                      <button
                        onClick={() => radioService.removeCustomStation(station.id)}
                        className="p-1.5 rounded-lg text-[#71717A] hover:text-red-400 transition"
                        title="Delete custom station"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-bold text-[#F5F3FF] truncate">{station.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-violet-950/40 text-violet-300 border border-violet-800/30">
                      {station.genre}
                    </span>
                    {station.bitrate && (
                      <span className="text-[10px] font-mono text-[#71717A]">{station.bitrate} kbps</span>
                    )}
                  </div>
                  {station.description && (
                    <p className="text-xs text-[#A1A1AA] line-clamp-2 mt-2 leading-relaxed">
                      {station.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Station Play Button */}
              <div className="mt-4 pt-3 border-t border-[#272733] flex items-center justify-between">
                <span className="text-[11px] text-[#71717A] font-medium">
                  {station.country || (station.isCustom ? 'Custom URL' : 'Live')}
                </span>
                <button
                  onClick={() => {
                    if (isPlaying) {
                      radioService.togglePlayPause();
                    } else {
                      radioService.playStation(station);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isPlaying
                      ? 'bg-violet-600 text-[#F5F3FF]'
                      : 'bg-[#1B1B24] text-[#F5F3FF] hover:bg-[#272733]'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause size={14} />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" />
                      <span>Tune In</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add Custom Station Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F5F3FF]">Add Custom Radio Station</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError(null);
                }}
                className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF]"
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddStation} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A1A1AA] mb-1 font-medium">Station Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. My Favorite Synthwave Stream"
                  className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[#A1A1AA] mb-1 font-medium">Stream URL (Icecast / Shoutcast / MP3) *</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/stream.mp3"
                  className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">Genre</label>
                  <input
                    type="text"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="e.g. Electronic"
                    className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">Country / Region</label>
                  <input
                    type="text"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="e.g. UK"
                    className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#272733]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] rounded-lg font-bold transition shadow-sm"
                >
                  Save Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
