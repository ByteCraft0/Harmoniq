import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNavigation } from '../../context/NavigationContext';
import { MusicalNavigation } from './MusicalNavigation';
import { HarmoniqLogo } from '../brand/HarmoniqLogo';
import {
  Minus,
  Square,
  Copy,
  X,
  Search,
  RefreshCw,
  FolderPlus,
  Minimize2,
} from 'lucide-react';

export const TitleBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    stats,
    addMusicFolders,
    rescanLibrary,
    setActiveView,
    watcherStatus,
    activeView,
    selectedAlbum,
    selectedArtist,
    selectedPlaylist,
  } = useLibrary();

  const { canGoBack, canGoForward, goBack, goForward } = useNavigation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.harmoniqApi?.isWindowMaximized) {
        const max = await window.harmoniqApi.isWindowMaximized();
        setIsMaximized(max);
      }
    };
    checkMaximized();
    const off = window.harmoniqApi?.onWindowMaximizedChange?.(setIsMaximized);
    return () => off?.();
  }, []);

  const handleMinimize = () => {
    window.harmoniqApi?.windowMinimize();
  };

  const handleMaximize = async () => {
    if (window.harmoniqApi?.windowMaximize) {
      await window.harmoniqApi.windowMaximize();
      const max = await window.harmoniqApi.isWindowMaximized();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.harmoniqApi?.windowClose();
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'home':
        return 'Home';
      case 'discover':
        return 'Discover';
      case 'songs':
        return 'Music Library';
      case 'albums':
        return 'Albums';
      case 'artists':
        return 'Artists';
      case 'folders':
        return 'Folders';
      case 'favorites':
        return 'Favorites';
      case 'recently_played':
        return 'Recently Played';
      case 'playlists':
        return selectedPlaylist ? `Playlist / ${selectedPlaylist.name}` : 'Playlists';
      case 'album_detail':
        return selectedAlbum ? `Album / ${selectedAlbum.title}` : 'Album Details';
      case 'artist_detail':
        return selectedArtist ? `Artist / ${selectedArtist.name}` : 'Artist Details';
      case 'now_playing':
        return 'Now Playing';
      case 'equalizer':
        return 'EQ Studio';
      case 'visualizer':
        return 'Visualizer';
      case 'inspector':
        return 'Audio Inspector';
      case 'lyrics':
        return 'Synced Lyrics';
      case 'audio_output':
        return 'Audio Devices';
      case 'settings':
        return 'Settings';
      case 'stats':
        return 'Listening Stats';
      case 'vinyl_collection':
        return 'Vinyl Record Crate';
      case 'immersive_album':
        return 'Immersive Album';
      case 'calendar':
        return 'Listening Calendar';
      case 'abx':
        return 'ABX Blind Audio Comparison';
      case 'online_music':
        return 'Online Search';
      case 'radio':
        return 'Internet Radio';
      case 'podcasts':
        return 'Podcasts';
      default:
        return 'Harmoniq';
    }
  };

  return (
    <header className="h-11 bg-[#09090B]/90 backdrop-blur-md border-b border-[#272733] flex items-center justify-between px-3 select-none window-drag-region z-50 transition-colors">
      {/* Left: Brand Logo, Musical Navigation (Violin Back & Trumpet Forward), & Breadcrumbs */}
      <div className="flex items-center gap-3 window-no-drag shrink-0">
        <div
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2 cursor-pointer group"
          title="Harmoniq Home"
        >
          <HarmoniqLogo size="sm" />
          <span className="text-xs font-bold tracking-widest text-[#F5F3FF] group-hover:text-[var(--accent-primary)] transition-colors">
            HARMONIQ
          </span>
          <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-[#1B1B24] text-[var(--accent-primary)] border border-[#272733]">
            PRO
          </span>
        </div>

        {/* Signature Musical Navigation Icons: Violin (Back) and Trumpet (Forward) */}
        <MusicalNavigation
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={goBack}
          onGoForward={goForward}
        />

        {/* Breadcrumb / Current View Identifier */}
        <div className="hidden lg:flex items-center text-xs text-[#71717A] font-medium border-l border-[#272733] pl-3 max-w-[220px]">
          <span className="text-[#A1A1AA] truncate tracking-wide">{getViewTitle()}</span>
        </div>
      </div>

      {/* Center: Global Search Bar with Micro-Interactions */}
      <div className="flex-1 max-w-md mx-4 window-no-drag">
        <div className="relative flex items-center group">
          <Search size={13} className="absolute left-3 text-[#71717A] group-focus-within:text-[#A78BFA] transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() && activeView !== 'songs' && activeView !== 'online_music') {
                setActiveView('songs');
              }
            }}
            placeholder="Search tracks, artists, albums, or hi-res audio..."
            className="w-full h-7 pl-8 pr-7 rounded-lg bg-[#14141B]/80 hover:bg-[#1B1B24] focus:bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA]/70 focus:ring-2 focus:ring-[#A78BFA]/15 text-xs text-[#F5F3FF] placeholder-[#71717A] focus:outline-none transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 rounded text-[#71717A] hover:text-[#F5F3FF] hover:bg-[#272733] transition-colors"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions, Sync Status & Windows Controls */}
      <div className="flex items-center gap-1.5 window-no-drag">
        {/* Real-time Folder Watcher Status Pill */}
        {watcherStatus.folderCount > 0 && (
          <div
            title={`Real-Time Folder Watcher: Monitoring ${watcherStatus.folderCount} music folder${
              watcherStatus.folderCount > 1 ? 's' : ''
            }${watcherStatus.status === 'syncing' ? ' (Syncing changes...)' : ' (Active)'}`}
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono-numbers text-[#A1A1AA]"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                watcherStatus.status === 'syncing'
                  ? 'bg-amber-400 animate-ping'
                  : watcherStatus.status === 'error'
                  ? 'bg-red-400'
                  : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              }`}
            />
            <span className="truncate max-w-[100px]">
              {watcherStatus.status === 'syncing' ? 'Syncing...' : 'Live Sync'}
            </span>
          </div>
        )}

        <button
          onClick={addMusicFolders}
          title="Add Music Folder"
          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B] active:scale-90 transition-all"
        >
          <FolderPlus size={15} />
        </button>

        <button
          onClick={rescanLibrary}
          title={stats.isScanning ? 'Scanning audio files...' : 'Rescan Library'}
          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B] active:scale-90 transition-all"
        >
          <RefreshCw size={14} className={stats.isScanning ? 'animate-spin text-[#A78BFA]' : ''} />
        </button>

        {/* Mini-Player Toggle Button */}
        <button
          onClick={() => window.harmoniqApi?.setMiniPlayer(true)}
          title="Compact Mini-Player Mode (Floating Widget)"
          className="w-8 h-7 flex items-center justify-center text-[#A1A1AA] hover:bg-[#14141B] hover:text-[var(--accent-dynamic)] rounded active:scale-90 transition-all"
        >
          <Minimize2 size={13} />
        </button>

        <div className="h-4 w-[1px] bg-[#272733] mx-1" />

        {/* Windows titlebar control buttons */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-8 h-7 flex items-center justify-center text-[#A1A1AA] hover:bg-[#14141B] hover:text-[#F5F3FF] rounded transition-colors"
        >
          <Minus size={13} />
        </button>

        <button
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          className="w-8 h-7 flex items-center justify-center text-[#A1A1AA] hover:bg-[#14141B] hover:text-[#F5F3FF] rounded transition-colors"
        >
          {isMaximized ? <Copy size={11} /> : <Square size={11} />}
        </button>

        <button
          onClick={handleClose}
          title="Close"
          className="w-8 h-7 flex items-center justify-center text-[#A1A1AA] hover:bg-red-950/80 hover:text-red-300 rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
