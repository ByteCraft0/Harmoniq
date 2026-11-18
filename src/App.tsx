import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { DSPProvider } from './context/DSPContext';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomPlayer } from './components/layout/BottomPlayer';
import { QueueDrawer } from './components/layout/QueueDrawer';
import { HomeView } from './components/views/HomeView';
import { DiscoverView } from './components/views/DiscoverView';
import { LibraryView } from './components/views/LibraryView';
import { AlbumDetailsView } from './components/views/AlbumDetailsView';
import { ArtistDetailsView } from './components/views/ArtistDetailsView';
import { NowPlayingView } from './components/views/NowPlayingView';
import { EqualizerStudio } from './components/dsp/EqualizerStudio';
import { AudioQualityInspector } from './components/inspector/AudioQualityInspector';
import { PlaylistsView } from './components/views/PlaylistsView';
import { LyricsView } from './components/views/LyricsView';
import { AudioOutputView } from './components/views/AudioOutputView';
import { SettingsView } from './components/views/SettingsView';
import { MiniPlayer } from './components/layout/MiniPlayer';

const MainLayout: React.FC = () => {
  const { activeView, setActiveView } = useLibrary();
  const { togglePlayPause, seekTo, currentTime, setVolume, volume, nextTrack, prevTrack, toggleMute } = usePlayer();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMini, setIsMini] = useState(false);

  useEffect(() => {
    if (window.harmoniqApi?.isMiniPlayer) {
      window.harmoniqApi.isMiniPlayer().then(setIsMini);
    }
    const off = window.harmoniqApi?.onMiniPlayerChange?.(setIsMini);
    return () => off?.();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Leave OS/browser combos alone (Ctrl+M, Alt+Left, ...) except the explicit Ctrl+Arrow shortcuts below
      if ((e.altKey || e.metaKey) || (e.ctrlKey && !e.code.startsWith('Arrow'))) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) {
            prevTrack();
          } else {
            seekTo(Math.max(0, currentTime - 5));
          }
          break;
        case 'ArrowRight':
          if (e.ctrlKey) {
            nextTrack();
          } else {
            seekTo(currentTime + 5);
          }
          break;
        case 'ArrowUp':
          if (e.ctrlKey) {
            e.preventDefault();
            setVolume(Math.min(1, volume + 0.05));
          }
          break;
        case 'ArrowDown':
          if (e.ctrlKey) {
            e.preventDefault();
            setVolume(Math.max(0, volume - 0.05));
          }
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyE':
          setActiveView('equalizer');
          break;
        case 'KeyI':
          setActiveView('inspector');
          break;
        case 'KeyL':
          setActiveView('lyrics');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seekTo, currentTime, setVolume, volume, nextTrack, prevTrack, toggleMute, setActiveView]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'home':
        return <HomeView />;
      case 'discover':
        return <DiscoverView />;
      case 'songs':
        return <LibraryView initialTab="songs" />;
      case 'albums':
        return <LibraryView initialTab="albums" />;
      case 'artists':
        return <LibraryView initialTab="artists" />;
      case 'folders':
        return <LibraryView initialTab="folders" />;
      case 'favorites':
      case 'recently_played':
      case 'playlists':
        return <PlaylistsView />;
      case 'library':
        return <LibraryView initialTab="songs" />;
      case 'album_detail':
        return <AlbumDetailsView />;
      case 'artist_detail':
        return <ArtistDetailsView />;
      case 'now_playing':
        return <NowPlayingView />;
      case 'equalizer':
        return <EqualizerStudio />;
      case 'inspector':
        return <AudioQualityInspector />;
      case 'lyrics':
        return <LyricsView />;
      case 'audio_output':
        return <AudioOutputView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  if (isMini) {
    return (
      <div className="h-screen w-screen bg-transparent p-0 overflow-hidden select-none">
        <div className="analog-noise-overlay" />
        <MiniPlayer onExpand={() => window.harmoniqApi?.setMiniPlayer(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#09090B] text-[#F5F3FF] select-none overflow-hidden font-sans relative">
      {/* Subtle Analog Film-Grain Noise Texture Overlay */}
      <div className="analog-noise-overlay" />

      {/* Frameless Custom Window Titlebar */}
      <TitleBar />

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Fixed Navigation Sidebar (approx 240px) */}
        <Sidebar />

        {/* Dynamic Main Page Content */}
        <main className="flex-1 overflow-hidden bg-[#09090B] relative">
          {renderActiveView()}
        </main>

        {/* Optional Right Queue Drawer */}
        <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
      </div>

      {/* Persistent Mini Bottom Player */}
      <BottomPlayer
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        isQueueOpen={isQueueOpen}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <LibraryProvider>
        <PlayerProvider>
          <DSPProvider>
            <MainLayout />
          </DSPProvider>
        </PlayerProvider>
      </LibraryProvider>
    </ToastProvider>
  );
};
