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
import { VisualizerView } from './components/views/VisualizerView';
import { AudioQualityInspector } from './components/inspector/AudioQualityInspector';
import { PlaylistsView } from './components/views/PlaylistsView';
import { FavoritesView } from './components/views/FavoritesView';
import { ListeningHistoryView } from './components/library/ListeningHistoryView';
import { LyricsView } from './components/views/LyricsView';
import { AudioOutputView } from './components/views/AudioOutputView';
import { SettingsView } from './components/views/SettingsView';
import { MiniPlayer } from './components/layout/MiniPlayer';
import { ListeningStatsDashboard } from './components/stats/ListeningStatsDashboard';
import { OnlineMusicSearchView } from './components/online/OnlineMusicSearchView';
import { RadioView } from './components/online/RadioView';
import { PodcastView } from './components/online/PodcastView';
import { ListeningCalendarView } from './components/views/ListeningCalendarView';
import { ABXComparisonView } from './components/views/ABXComparisonView';
import { VinylCollectionView } from './components/views/VinylCollectionView';
import { ImmersiveAlbumView } from './components/views/ImmersiveAlbumView';
import { NavigationProvider } from './context/NavigationContext';
import { HarmoniqAssistantContainer } from './components/assistant/HarmoniqAssistantContainer';
import { useAssistant } from './hooks/useAssistant';
import { useDSP } from './context/DSPContext';
import { audioEngine } from './services/audioEngine';
import { buildAssistantContext } from './services/assistantContextService';

const MainLayout: React.FC = () => {
  const {
    activeView,
    setActiveView,
    selectedAlbum,
    selectedArtist,
    selectedPlaylist,
    restoreNavigationState,
  } = useLibrary();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    queue,
    togglePlayPause,
    seekTo,
    setVolume,
    volume,
    nextTrack,
    prevTrack,
    toggleMute,
  } = usePlayer();
  const { settings: dspSettings, presets } = useDSP();
  const { setAssistantContext } = useAssistant();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMini, setIsMini] = useState(false);

  // Synchronize live playback context with Harmoniq Assistant (Phase 5A.1)
  useEffect(() => {
    const bitPerfectStatus = audioEngine.getBitPerfectStatus();
    const activePreset = presets.find((p) => p.id === dspSettings?.activePresetId);

    const ctx = buildAssistantContext({
      track: currentTrack,
      isPlaying,
      currentTime,
      duration,
      repeatMode,
      isShuffle,
      queue,
      bitPerfectStatus,
      dspSettings,
      activePresetName: activePreset?.name,
    });

    setAssistantContext(ctx);
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    isPlaying,
    Math.floor(currentTime / 5), // Throttle to 5-second intervals to prevent unnecessary re-renders
    duration,
    repeatMode,
    isShuffle,
    queue.length,
    dspSettings?.enabled,
    dspSettings?.activePresetId,
    dspSettings?.preamp,
    dspSettings?.bassBoost,
    dspSettings?.treble,
    setAssistantContext,
  ]);

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
        case 'KeyV':
          setActiveView('visualizer');
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
        return <FavoritesView />;
      case 'recently_played':
        return <ListeningHistoryView />;
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
      case 'visualizer':
        return <VisualizerView />;
      case 'inspector':
        return <AudioQualityInspector />;
      case 'lyrics':
        return <LyricsView />;
      case 'audio_output':
        return <AudioOutputView />;
      case 'settings':
        return <SettingsView />;
      case 'stats':
        return <ListeningStatsDashboard />;
      case 'calendar':
        return <ListeningCalendarView />;
      case 'vinyl_collection':
        return <VinylCollectionView />;
      case 'immersive_album':
        return <ImmersiveAlbumView onExit={() => setActiveView('home')} />;
      case 'online_music':
        return <OnlineMusicSearchView />;
      case 'radio':
        return <RadioView />;
      case 'podcasts':
        return <PodcastView />;
      case 'abx':
        return <ABXComparisonView />;
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
    <NavigationProvider
      activeView={activeView}
      selectedAlbum={selectedAlbum}
      selectedArtist={selectedArtist}
      selectedPlaylist={selectedPlaylist}
      onRestoreState={restoreNavigationState}
    >
      <div className="flex flex-col h-screen w-screen bg-[#09090B] text-[#F5F3FF] select-none overflow-hidden font-sans relative">
        {/* Subtle Analog Film-Grain Noise Texture Overlay */}
        <div className="analog-noise-overlay" />

        {/* Frameless Custom Window Titlebar */}
        <TitleBar />

        {/* Main App Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Fixed Navigation Sidebar (approx 240px) */}
          <Sidebar />

          {/* Dynamic Main Page Content with Fluid Page Transition */}
          <main className="flex-1 overflow-hidden bg-[#09090B] relative">
            <div key={activeView} className="h-full w-full animate-page-enter">
              {renderActiveView()}
            </div>
          </main>

          {/* Optional Right Queue Drawer */}
          <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
        </div>

        {/* Persistent Mini Bottom Player */}
        <BottomPlayer
          onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
          isQueueOpen={isQueueOpen}
        />

        {/* Harmoniq Assistant (Phase 5A.4): Persistent Container with Smoothly Docking Pulse Orb */}
        <HarmoniqAssistantContainer
          onOpenSettings={() => setActiveView('settings')}
        />
      </div>
    </NavigationProvider>
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
