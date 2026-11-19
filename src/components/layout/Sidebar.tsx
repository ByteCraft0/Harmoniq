import React, { useState, useEffect } from 'react';
import { useLibrary, AppView } from '../../context/LibraryContext';
import { appearanceService } from '../../services/appearanceService';
import {
  Home,
  Compass,
  Music,
  Disc,
  Users,
  Folder,
  Heart,
  ListMusic,
  Clock,
  Sliders,
  Gauge,
  FileText,
  Settings,
  Sparkles,
  Plus,
  BarChart3,
  Globe,
  Radio,
  Podcast,
  Pin,
  PinOff,
  Calendar as CalendarIcon,
  GitCompare,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface NavItemDef {
  view: AppView;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    stats,
    playlists,
    selectedPlaylist,
    openPlaylistDetail,
    createPlaylist,
  } = useLibrary();

  const [pinnedViews, setPinnedViews] = useState<string[]>(
    appearanceService.getSettings().sidebarPinnedViews || []
  );

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('harmoniq_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('harmoniq_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    return appearanceService.subscribe((settings) => {
      setPinnedViews(settings.sidebarPinnedViews || []);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateNewPlaylist = () => {
    const name = prompt('Enter new playlist name:');
    if (name && name.trim()) {
      const pl = createPlaylist(name.trim());
      openPlaylistDetail(pl);
    }
  };

  const handleNavClick = (view: AppView) => {
    if (view === 'favorites') {
      const fav = playlists.find((p) => p.smartCriteria === 'favorites');
      if (fav) {
        openPlaylistDetail(fav);
        return;
      }
    } else if (view === 'recently_played') {
      const rec = playlists.find((p) => p.smartCriteria === 'recently_played');
      if (rec) {
        openPlaylistDetail(rec);
        return;
      }
    } else if (view === 'playlists') {
      const firstCustom = playlists.find((p) => !p.isSmart);
      if (firstCustom) {
        openPlaylistDetail(firstCustom);
        return;
      }
    }
    setActiveView(view);
  };

  const isNavActive = (view: AppView) => {
    if (activeView === view) return true;
    if (view === 'songs' && activeView === 'library') return true;
    if (view === 'albums' && activeView === 'album_detail') return true;
    if (view === 'artists' && activeView === 'artist_detail') return true;
    if (view === 'favorites' && activeView === 'playlists' && selectedPlaylist?.smartCriteria === 'favorites')
      return true;
    if (view === 'recently_played' && activeView === 'playlists' && selectedPlaylist?.smartCriteria === 'recently_played')
      return true;
    if (view === 'playlists' && activeView === 'playlists' && (!selectedPlaylist || !selectedPlaylist.isSmart))
      return true;
    return false;
  };

  const handleTogglePin = (e: React.MouseEvent, view: string) => {
    e.stopPropagation();
    appearanceService.togglePinView(view);
  };

  const navSections: { title: string; items: NavItemDef[] }[] = [
    {
      title: 'DISCOVER',
      items: [
        { view: 'home' as AppView, label: 'Home', icon: <Home size={15} /> },
        { view: 'discover' as AppView, label: 'Discover', icon: <Compass size={15} /> },
        { view: 'vinyl_collection' as AppView, label: 'Vinyl Collection', icon: <Disc size={15} className="text-amber-400" /> },
        { view: 'immersive_album' as AppView, label: 'Immersive Album', icon: <Sparkles size={15} className="text-[var(--accent-dynamic)]" /> },
        { view: 'stats' as AppView, label: 'Listening Stats', icon: <BarChart3 size={15} /> },
        { view: 'calendar' as AppView, label: 'Listening Calendar', icon: <CalendarIcon size={15} /> },
      ],
    },
    {
      title: 'ONLINE & RADIO',
      items: [
        { view: 'online_music' as AppView, label: 'Universal Music', icon: <Globe size={15} /> },
        { view: 'radio' as AppView, label: 'Internet Radio', icon: <Radio size={15} /> },
        { view: 'podcasts' as AppView, label: 'Podcasts', icon: <Podcast size={15} /> },
      ],
    },
    {
      title: 'LIBRARY',
      items: [
        { view: 'songs' as AppView, label: 'Songs', icon: <Music size={15} />, badge: stats.totalTracks },
        { view: 'albums' as AppView, label: 'Albums', icon: <Disc size={15} />, badge: stats.totalAlbums },
        { view: 'artists' as AppView, label: 'Artists', icon: <Users size={15} />, badge: stats.totalArtists },
        { view: 'folders' as AppView, label: 'Folders', icon: <Folder size={15} /> },
      ],
    },
    {
      title: 'PLAYLISTS',
      items: [
        { view: 'favorites' as AppView, label: 'Favorites', icon: <Heart size={15} className="text-red-400" /> },
        {
          view: 'recently_played' as AppView,
          label: 'Recently Played',
          icon: <Clock size={15} className="text-[var(--accent-primary)]" />,
        },
        { view: 'playlists' as AppView, label: 'All Playlists', icon: <ListMusic size={15} /> },
      ],
    },
    {
      title: 'AUDIO STUDIO',
      items: [
        { view: 'equalizer' as AppView, label: 'Equalizer Studio', icon: <Sliders size={15} /> },
        { view: 'visualizer' as AppView, label: 'Audio Visualizer', icon: <Sparkles size={15} /> },
        { view: 'inspector' as AppView, label: 'Quality Inspector', icon: <Gauge size={15} /> },
        { view: 'abx' as AppView, label: 'ABX Comparison', icon: <GitCompare size={15} /> },
        { view: 'lyrics' as AppView, label: 'Synced Lyrics', icon: <FileText size={15} /> },
        { view: 'settings' as AppView, label: 'Settings', icon: <Settings size={15} /> },
      ],
    },
  ];

  // Lookup map for pinned views
  const allItemsMap = new Map<string, NavItemDef>();
  for (const sec of navSections) {
    for (const item of sec.items) {
      allItemsMap.set(item.view, item);
    }
  }

  const pinnedItems: NavItemDef[] = pinnedViews
    .map((v) => allItemsMap.get(v))
    .filter((it): it is NavItemDef => !!it);

  return (
    <aside
      className={`${
        isCollapsed ? 'w-[68px] min-w-[68px] max-w-[68px]' : 'w-[240px] min-w-[240px] max-w-[240px]'
      } h-full bg-[#0D0D12]/90 backdrop-blur-2xl border-r border-[#272733]/80 flex flex-col justify-between py-3 select-none shrink-0 z-30 relative overflow-hidden transition-all duration-300`}
    >
      {/* Subtle Ambient Dynamic Glow Accent */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-[var(--accent-secondary)]/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/3 right-0 w-36 h-36 bg-[var(--accent-primary)]/5 rounded-full blur-2xl pointer-events-none translate-x-1/2" />

      {/* Top Sidebar Controls: Collapse/Expand */}
      <div
        className={`flex items-center ${
          isCollapsed ? 'justify-center px-1' : 'justify-between px-3'
        } pb-2.5 mb-1 border-b border-[#1C1C24]/80 z-10 shrink-0`}
      >
        {!isCollapsed && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
            Navigation
          </span>
        )}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/[0.06] active:scale-95 transition-all"
        >
          {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 space-y-5 custom-scrollbar relative z-10">
        {/* Harmoniq 2.0 Pinned Navigation Section */}
        {pinnedItems.length > 0 && (
          <div className="space-y-1 pb-2 border-b border-[#1C1C24]/80">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)] font-mono-numbers">
                <span className="flex items-center gap-1.5">
                  <Pin size={11} className="text-[var(--accent-primary)] fill-[var(--accent-primary)]" />
                  PINNED
                </span>
                <span className="text-[10px] text-[#71717A]">{pinnedItems.length}</span>
              </div>
            )}

            <div className="space-y-0.5">
              {pinnedItems.map((item) => {
                const isActive = isNavActive(item.view);
                return (
                  <button
                    key={`pinned_${item.view}`}
                    onClick={() => handleNavClick(item.view)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
                    } rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden active:scale-[0.98] ${
                      isActive
                        ? 'bg-gradient-to-r from-[var(--ambient-primary)] via-transparent to-transparent text-[#F5F3FF] border border-[var(--accent-primary)]/40 font-semibold shadow-[0_0_15px_rgba(167,139,250,0.12)]'
                        : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />
                    )}

                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
                      <span
                        className={`transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-[var(--accent-primary)]' : 'text-[#71717A] group-hover:text-[#F5F3FF]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <button
                        onClick={(e) => handleTogglePin(e, item.view)}
                        title="Unpin View"
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#71717A] hover:text-[var(--accent-primary)] hover:bg-white/5 rounded transition-all"
                      >
                        <PinOff size={11} />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Standard Sections */}
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
                {section.title}
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavActive(item.view);
                const isPinned = pinnedViews.includes(item.view);
                return (
                  <button
                    key={item.view}
                    onClick={() => handleNavClick(item.view)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
                    } rounded-xl text-xs font-medium transition-all duration-200 relative overflow-hidden active:scale-[0.98] ${
                      isActive
                        ? 'bg-gradient-to-r from-[var(--ambient-primary)] via-transparent to-transparent text-[#F5F3FF] border border-[var(--accent-primary)]/30 font-semibold shadow-[0_0_15px_rgba(167,139,250,0.12)]'
                        : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {/* Left Active Glow Indicator Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />
                    )}

                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
                      <span
                        className={`transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-[var(--accent-primary)]' : 'text-[#71717A] group-hover:text-[#F5F3FF]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5">
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded-full bg-[#1B1B24] border border-white/5 text-[#71717A] group-hover:text-[#A1A1AA] transition-colors">
                            {item.badge}
                          </span>
                        )}

                        {/* Pin Toggle on Hover */}
                        <button
                          onClick={(e) => handleTogglePin(e, item.view)}
                          title={isPinned ? 'Unpin from Top' : 'Pin to Top'}
                          className={`p-1 rounded transition-all ${
                            isPinned
                              ? 'text-[var(--accent-primary)]'
                              : 'opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-[#F5F3FF] hover:bg-white/5'
                          }`}
                        >
                          <Pin size={11} className={isPinned ? 'fill-[var(--accent-primary)]' : ''} />
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* User Playlists Quick List */}
        {!isCollapsed && (
          <div className="space-y-1 pt-2 border-t border-[#1C1C24]/80">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
                Custom Playlists
              </span>
              <button
                onClick={handleCreateNewPlaylist}
                title="Create New Playlist"
                className="text-[#71717A] hover:text-[var(--accent-primary)] hover:bg-white/5 p-1 rounded-md transition-all active:scale-90"
              >
                <Plus size={13} />
              </button>
            </div>

            <div className="space-y-0.5">
              {playlists
                .filter((p) => !p.isSmart)
                .slice(0, 8)
                .map((pl) => {
                  const isSelected = activeView === 'playlists' && selectedPlaylist?.id === pl.id;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => openPlaylistDetail(pl)}
                      className={`group w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs truncate transition-all duration-200 active:scale-[0.98] ${
                        isSelected
                          ? 'bg-[#1B1B24] text-[var(--accent-primary)] font-bold border border-[var(--accent-primary)]/30 shadow-sm'
                          : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ListMusic
                          size={13}
                          className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            isSelected ? 'text-[var(--accent-primary)]' : 'text-[#71717A] group-hover:text-[#F5F3FF]'
                          }`}
                        />
                        <span className="truncate">{pl.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-numbers text-[#71717A]">
                        {pl.trackIds.length}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Engine Status with Glass Styling */}
      <div className="px-3 pt-3 border-t border-[#1C1C24]/80 text-[11px] font-mono-numbers text-[#71717A] relative z-10 shrink-0">
        {isCollapsed ? (
          <div className="flex items-center justify-center py-1">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
              title="Harmoniq 32-bit DSP Active"
            />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[#A1A1AA] font-semibold tracking-wide">HARMONIQ PRO</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span className="text-[10px] text-emerald-400 font-medium">32-bit DSP</span>
              </div>
            </div>
            <div className="text-[10px] truncate text-[#71717A]">
              {stats.totalTracks > 0
                ? `${stats.totalTracks.toLocaleString()} tracks in library`
                : 'Ready to index audio'}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
