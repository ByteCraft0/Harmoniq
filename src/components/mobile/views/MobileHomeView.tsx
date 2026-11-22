import React, { useState, useEffect, useMemo } from 'react';
import { useLibrary } from '../../../context/LibraryContext';
import { usePlayer } from '../../../context/PlayerContext';
import { Music, Disc, Heart, ListMusic, Sparkles, FolderSync, Radio } from 'lucide-react';
import { TrackMetadata } from '../../../types/audio';
import { getArtworkUrl } from '../../../services/platform';
import { MobileTab } from '../MobileNavigationContext';
import {
  mobileAppearanceService,
  MobileAppearanceSettings,
  MOBILE_ACCENT_PALETTES,
} from '../../../services/mobileAppearanceService';

export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // 5:00 AM (300 mins) to 11:59 AM (719 mins): Good morning, Audiophile
  if (timeInMinutes >= 5 * 60 && timeInMinutes < 12 * 60) {
    return 'Good morning, Audiophile';
  }
  // 12:00 PM (720 mins) to 4:59 PM (1019 mins): Good afternoon, Audiophile
  if (timeInMinutes >= 12 * 60 && timeInMinutes < 17 * 60) {
    return 'Good afternoon, Audiophile';
  }
  // 5:00 PM (1020 mins) to 4:59 AM (299 mins): Good evening, Audiophile
  return 'Good evening, Audiophile';
}

interface MobileHomeViewProps {
  onNavigateTab: (tab: MobileTab) => void;
  onOpenPlaylist?: (playlistId: string) => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({ onNavigateTab, onOpenPlaylist }) => {
  const { tracks, albums, playlists, stats } = useLibrary();
  const { playTrack, currentTrack } = usePlayer();

  const [greeting, setGreeting] = useState<string>(() => getTimeBasedGreeting());
  const [appearance, setAppearance] = useState<MobileAppearanceSettings>(() =>
    mobileAppearanceService.getSettings()
  );

  // Subscribe to appearance changes from Settings
  useEffect(() => {
    return mobileAppearanceService.subscribe((next) => {
      setAppearance(next);
    });
  }, []);

  // Time-aware greeting: refresh on interval, focus, visibility change, and Capacitor app resume
  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getTimeBasedGreeting());
    };

    // Immediate check
    updateGreeting();

    // Check periodically (every 30 seconds) for hour boundary crossings
    const interval = setInterval(updateGreeting, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateGreeting();
      }
    };

    window.addEventListener('focus', updateGreeting);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let appListenerHandle: { remove: () => void } | null = null;
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.App?.addListener) {
      cap.Plugins.App.addListener('appStateChange', (state: { isActive: boolean }) => {
        if (state.isActive) {
          updateGreeting();
        }
      })
        .then((handle: any) => {
          appListenerHandle = handle;
        })
        .catch(() => {});
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', updateGreeting);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (appListenerHandle?.remove) {
        appListenerHandle.remove();
      }
    };
  }, []);

  const favoriteTracks = useMemo(() => tracks.filter((t) => t.isFavorite), [tracks]);
  const recentTracks = useMemo(() => tracks.slice(0, 6), [tracks]);
  const activePalette = MOBILE_ACCENT_PALETTES[appearance.accentColor] || MOBILE_ACCENT_PALETTES.violet;

  return (
    <div className="space-y-6 pb-40">
      {/* 1. Hero Welcome Card & Listening Intelligence Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950/40 via-[#14141b] to-[#09090b] border border-violet-800/20 p-5 shadow-xl">
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-30"
          style={{ backgroundColor: activePalette.secondary }}
        />

        <div className="relative z-10 space-y-2.5">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#1b1b24] border border-[#272733] text-[11px] font-medium text-violet-300">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="tracking-tight">Harmoniq Listening Intelligence</span>
          </div>

          {/* Large Bold Time-Aware Greeting */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {greeting}
          </h1>

          {/* Subtitle Description */}
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
            Your personalized music space. Rediscover favorites, explore intelligent mixes, and experience bit-perfect sound.
          </p>

          {/* Music Library Quick Statistics Grid */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5 text-center">
            <div className="bg-black/30 rounded-xl py-2 px-1 border border-white/5">
              <span className="text-base font-bold text-violet-300">
                {stats.totalTracks || tracks.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">
                Tracks
              </p>
            </div>
            <div className="bg-black/30 rounded-xl py-2 px-1 border border-white/5">
              <span className="text-base font-bold text-violet-300">
                {stats.totalAlbums || albums.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">
                Albums
              </p>
            </div>
            <div className="bg-black/30 rounded-xl py-2 px-1 border border-white/5">
              <span className="text-base font-bold text-violet-300">{playlists.length}</span>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">
                Playlists
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Navigation Cards */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onNavigateTab('library')}
          className="flex flex-col items-center p-3 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/40 active:scale-98 transition-all text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-1.5">
            <Music className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-white">All Songs</h3>
          <span className="text-[10px] text-zinc-500">{tracks.length} tracks</span>
        </button>

        <button
          onClick={() => onNavigateTab('radio')}
          className="flex flex-col items-center p-3 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/40 active:scale-98 transition-all text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-1.5 relative">
            <Radio className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>
          <h3 className="text-xs font-semibold text-white">Live Radio</h3>
          <span className="text-[10px] text-zinc-500">Global Stations</span>
        </button>

        <button
          onClick={() => {
            if (onOpenPlaylist) {
              onOpenPlaylist('smart_favorites');
            } else {
              onNavigateTab('playlists');
            }
          }}
          className="flex flex-col items-center p-3 rounded-xl bg-[#14141b] border border-[#272733] hover:border-violet-500/40 active:scale-98 transition-all text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-1.5">
            <Heart className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-white">Favorites</h3>
          <span className="text-[10px] text-zinc-500">{favoriteTracks.length} starred</span>
        </button>
      </div>

      {/* 3. Recently Added Section */}
      {recentTracks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white tracking-tight">Recent Tracks</h2>
            <button
              onClick={() => onNavigateTab('library')}
              className="text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              See all
            </button>
          </div>

          <div className="space-y-1.5">
            {recentTracks.map((track) => {
              const artUrl = getArtworkUrl(track.artworkDataUrl);
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, tracks)}
                  className={`mobile-track-item flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    currentTrack?.id === track.id
                      ? 'bg-violet-950/30 border-violet-700/50'
                      : 'bg-[#14141b]/70 border-[#272733]/60 hover:bg-[#1b1b24]'
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                    <div className="mobile-track-thumb w-10 h-10 rounded-lg bg-[#1b1b24] overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
                      {artUrl ? (
                        <img
                          src={artUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Disc className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          currentTrack?.id === track.id ? 'text-violet-400' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 flex-shrink-0">
                    {track.codec || 'MP3'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
