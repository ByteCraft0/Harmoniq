import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import {
  Minus,
  Square,
  Copy,
  X,
  Search,
  RefreshCw,
  FolderPlus,
  Sparkles,
  Minimize2,
  Radio,
} from 'lucide-react';

export const TitleBar: React.FC = () => {
  const { searchQuery, setSearchQuery, stats, addMusicFolders, rescanLibrary, setActiveView, watcherStatus } = useLibrary();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.harmoniqApi?.isWindowMaximized) {
        const max = await window.harmoniqApi.isWindowMaximized();
        setIsMaximized(max);
      }
    };
    checkMaximized();
    // Stay in sync with double-click on the drag region, Win+Up/Down, snap, etc.
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

  return (
    <header className="h-10 bg-[#09090B] border-b border-[#272733] flex items-center justify-between px-3 select-none window-drag-region z-50">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5 window-no-drag">
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-black text-[10px] tracking-tighter shadow-sm">
          H
        </div>
        <span
          onClick={() => setActiveView('home')}
          className="text-xs font-bold tracking-widest text-[#F5F3FF] cursor-pointer hover:text-[#A78BFA] transition-colors"
        >
          HARMONIQ
        </span>
        <span className="text-[9px] font-mono-numbers px-1.5 py-0.2 rounded bg-[#1B1B24] text-[#A78BFA] border border-[#272733]">
          PRO
        </span>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md mx-6 window-no-drag">
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-3 text-[#71717A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) {
                setActiveView('songs');
              }
            }}
            placeholder="Search tracks, artists, albums, or hi-res audio..."
            className="w-full h-7 pl-8 pr-3 rounded-lg bg-[#14141B] hover:bg-[#1B1B24] focus:bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-xs text-[#F5F3FF] placeholder-[#71717A] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Window Controls & Actions */}
      <div className="flex items-center gap-1.5 window-no-drag">
        {/* Real-time Folder Watcher Status Pill */}
        {watcherStatus.folderCount > 0 && (
          <div
            title={`Real-Time Folder Watcher: Monitoring ${watcherStatus.folderCount} music folder${watcherStatus.folderCount > 1 ? 's' : ''}${
              watcherStatus.status === 'syncing' ? ' (Syncing changes...)' : ' (Active)'
            }`}
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono-numbers text-[#A1A1AA]"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                watcherStatus.status === 'syncing'
                  ? 'bg-amber-400 animate-ping'
                  : watcherStatus.status === 'error'
                  ? 'bg-red-400'
                  : 'bg-emerald-400'
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
          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B] transition-colors"
        >
          <FolderPlus size={15} />
        </button>

        <button
          onClick={rescanLibrary}
          title={stats.isScanning ? 'Scanning audio files...' : 'Rescan Library'}
          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B] transition-colors"
        >
          <RefreshCw size={14} className={stats.isScanning ? 'animate-spin text-[#A78BFA]' : ''} />
        </button>

        {/* Mini-Player Toggle Button */}
        <button
          onClick={() => window.harmoniqApi?.setMiniPlayer(true)}
          title="Compact Mini-Player Mode (Floating Widget)"
          className="w-8 h-7 flex items-center justify-center text-[#A1A1AA] hover:bg-[#14141B] hover:text-[var(--accent-dynamic)] rounded transition-colors"
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
