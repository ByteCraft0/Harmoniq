import React from 'react';
import { useLibrary, AppView } from '../../context/LibraryContext';
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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, stats, playlists, selectedPlaylist, openPlaylistDetail, createPlaylist } = useLibrary();

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
    if (view === 'favorites' && activeView === 'playlists' && selectedPlaylist?.smartCriteria === 'favorites') return true;
    if (view === 'recently_played' && activeView === 'playlists' && selectedPlaylist?.smartCriteria === 'recently_played') return true;
    if (view === 'playlists' && activeView === 'playlists' && (!selectedPlaylist || !selectedPlaylist.isSmart)) return true;
    return false;
  };

  const navSections = [
    {
      title: 'DISCOVER',
      items: [
        { view: 'home' as AppView, label: 'Home', icon: <Home size={16} /> },
        { view: 'discover' as AppView, label: 'Discover', icon: <Compass size={16} /> },
      ],
    },
    {
      title: 'LIBRARY',
      items: [
        { view: 'songs' as AppView, label: 'Songs', icon: <Music size={16} />, badge: stats.totalTracks },
        { view: 'albums' as AppView, label: 'Albums', icon: <Disc size={16} />, badge: stats.totalAlbums },
        { view: 'artists' as AppView, label: 'Artists', icon: <Users size={16} />, badge: stats.totalArtists },
        { view: 'folders' as AppView, label: 'Folders', icon: <Folder size={16} /> },
      ],
    },
    {
      title: 'PLAYLISTS',
      items: [
        { view: 'favorites' as AppView, label: 'Favorites', icon: <Heart size={16} className="text-red-400" /> },
        { view: 'recently_played' as AppView, label: 'Recently Played', icon: <Clock size={16} className="text-[#A78BFA]" /> },
        { view: 'playlists' as AppView, label: 'All Playlists', icon: <ListMusic size={16} /> },
      ],
    },
    {
      title: 'AUDIO STUDIO',
      items: [
        { view: 'equalizer' as AppView, label: 'Equalizer Studio', icon: <Sliders size={16} /> },
        { view: 'visualizer' as AppView, label: 'Audio Visualizer', icon: <Sparkles size={16} /> },
        { view: 'inspector' as AppView, label: 'Audio Quality Inspector', icon: <Gauge size={16} /> },
        { view: 'lyrics' as AppView, label: 'Synced Lyrics', icon: <FileText size={16} /> },
        { view: 'settings' as AppView, label: 'Settings', icon: <Settings size={16} /> },
      ],
    },
  ];

  return (
    <aside className="w-[240px] min-w-[240px] max-w-[240px] h-full bg-[#0D0D12] border-r border-[#272733] flex flex-col justify-between py-4 select-none shrink-0 z-30">
      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
              {section.title}
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavActive(item.view);
                return (
                  <button
                    key={item.view}
                    onClick={() => handleNavClick(item.view)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#1B1B24] text-[#F5F3FF] border border-[#272733] font-semibold shadow-sm'
                        : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-[#A78BFA]' : 'text-[#71717A]'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded-full bg-[#1B1B24] text-[#71717A]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* User Playlists Quick List */}
        <div className="space-y-1 pt-2 border-t border-[#1C1C24]">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] font-mono-numbers">
              Custom Playlists
            </span>
            <button
              onClick={handleCreateNewPlaylist}
              title="Create New Playlist"
              className="text-[#71717A] hover:text-[#A78BFA] p-0.5 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="space-y-0.5">
            {playlists.filter((p) => !p.isSmart).slice(0, 8).map((pl) => {
              const isSelected = activeView === 'playlists' && selectedPlaylist?.id === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => openPlaylistDetail(pl)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                    isSelected
                      ? 'bg-[#1B1B24] text-[#A78BFA] font-bold border border-[#272733]'
                      : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <ListMusic size={13} className={isSelected ? 'text-[#A78BFA]' : 'text-[#71717A] shrink-0'} />
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
      </div>

      {/* Footer Engine Status */}
      <div className="px-4 pt-3 border-t border-[#1C1C24] text-[11px] font-mono-numbers text-[#71717A]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-[#A1A1AA] font-semibold">HARMONIQ PRO</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span className="text-[10px] text-emerald-400 font-medium">32-bit DSP</span>
          </div>
        </div>
        <div className="text-[10px] truncate text-[#71717A]">
          {stats.totalTracks > 0
            ? `${stats.totalTracks.toLocaleString()} tracks in library`
            : 'Ready to index audio'}
        </div>
      </div>
    </aside>
  );
};
