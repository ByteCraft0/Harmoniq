import React, { useEffect } from 'react';
import { Home, Music, ListMusic, Settings, Disc, ArrowLeft, Radio } from 'lucide-react';
import { MobileHomeView } from './views/MobileHomeView';
import { MobileRadioView } from './views/MobileRadioView';
import { MobileLibraryView } from './views/MobileLibraryView';
import { MobilePlaylistsView } from './views/MobilePlaylistsView';
import { MobileSettingsView } from './views/MobileSettingsView';
import { MobileMiniPlayer } from './layout/MobileMiniPlayer';
import { MobileNowPlayingSheet } from './layout/MobileNowPlayingSheet';
import { MobileNavigationProvider, useMobileNavigation, MobileTab } from './MobileNavigationContext';
import { mobileAppearanceService } from '../../services/mobileAppearanceService';

const MobileShellContent: React.FC = () => {
  const {
    activeTab,
    selectedPlaylistId,
    isNowPlayingOpen,
    canGoBack,
    navigateTab,
    openPlaylist,
    closePlaylist,
    openNowPlaying,
    closeNowPlaying,
    goBack,
  } = useMobileNavigation();

  useEffect(() => {
    mobileAppearanceService.applyToDOM();
  }, []);

  return (
    <div className="h-[100dvh] h-screen max-h-screen bg-[#09090b] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top App Header with Safe Area Inset */}
      <header
        className="flex-shrink-0 z-30 bg-[#09090b]/90 backdrop-blur-md border-b border-[#272733]/60 px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex items-center space-x-2">
          {canGoBack && activeTab !== 'home' && !selectedPlaylistId && (
            <button
              onClick={() => goBack()}
              aria-label="Navigate back"
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-all mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-900/40">
            <Disc className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            HARMONIQ <span className="text-violet-400 font-medium text-xs">LITE</span>
          </span>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 min-h-0 px-4 pt-3 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain">
        {activeTab === 'home' && (
          <MobileHomeView
            onNavigateTab={(tab) => navigateTab(tab)}
            onOpenPlaylist={(id) => openPlaylist(id)}
          />
        )}
        {activeTab === 'radio' && <MobileRadioView />}
        {activeTab === 'library' && <MobileLibraryView />}
        {activeTab === 'playlists' && (
          <MobilePlaylistsView
            initialPlaylistId={selectedPlaylistId}
            onClearSelectedPlaylist={closePlaylist}
            onBrowseLibrary={() => navigateTab('library')}
          />
        )}
        {activeTab === 'settings' && <MobileSettingsView />}
      </main>

      {/* Docked MiniPlayer */}
      <MobileMiniPlayer onExpand={openNowPlaying} />

      {/* Expandable Now Playing Sheet */}
      <MobileNowPlayingSheet
        isOpen={isNowPlayingOpen}
        onClose={closeNowPlaying}
      />

      {/* Bottom Navigation Bar with Safe Area Inset */}
      <nav
        className="fixed bottom-0 left-0 right-0 h-16 bg-[#09090b]/95 backdrop-blur-lg border-t border-[#272733]/80 flex items-center justify-around px-1 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <button
          onClick={() => navigateTab('home', { clearHistory: activeTab === 'home' })}
          aria-label="Home"
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
            activeTab === 'home' ? 'text-violet-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Home</span>
        </button>

        <button
          onClick={() => navigateTab('radio')}
          aria-label="Radio"
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
            activeTab === 'radio' ? 'text-violet-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Radio className={`w-5 h-5 ${activeTab === 'radio' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Radio</span>
        </button>

        <button
          onClick={() => navigateTab('library')}
          aria-label="Library"
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
            activeTab === 'library' ? 'text-violet-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Music className={`w-5 h-5 ${activeTab === 'library' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Library</span>
        </button>

        <button
          onClick={() => navigateTab('playlists')}
          aria-label="Playlists"
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
            activeTab === 'playlists' ? 'text-violet-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ListMusic className={`w-5 h-5 ${activeTab === 'playlists' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Playlists</span>
        </button>

        <button
          onClick={() => navigateTab('settings')}
          aria-label="Settings"
          className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
            activeTab === 'settings' ? 'text-violet-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export const MobileShell: React.FC = () => {
  return (
    <MobileNavigationProvider>
      <MobileShellContent />
    </MobileNavigationProvider>
  );
};
