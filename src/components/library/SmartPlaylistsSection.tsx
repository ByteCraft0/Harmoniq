import React, { useState, useEffect } from 'react';
import { SmartPlaylistDefinition } from '../../types/smartPlaylist';
import {
  smartPlaylistService,
  evaluateSmartPlaylist,
} from '../../services/smartPlaylistService';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { SmartPlaylistModal } from './SmartPlaylistModal';
import {
  Sliders,
  Plus,
  Play,
  Shuffle,
  ListPlus,
  Pencil,
  Trash2,
  Sparkles,
  Music,
  CheckCircle2,
} from 'lucide-react';

export const SmartPlaylistsSection: React.FC = () => {
  const { tracks } = useLibrary();
  const { playTrack, addToQueue } = usePlayer();
  const [smartPlaylists, setSmartPlaylists] = useState<SmartPlaylistDefinition[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SmartPlaylistDefinition | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState<SmartPlaylistDefinition | null>(null);

  useEffect(() => {
    const refresh = () => {
      const all = smartPlaylistService.getAll();
      setSmartPlaylists(all);
      if (!selectedPlaylist && all.length > 0) {
        setSelectedPlaylist(all[0]);
      } else if (selectedPlaylist) {
        const updated = all.find((p) => p.id === selectedPlaylist.id);
        setSelectedPlaylist(updated || all[0] || null);
      }
    };
    refresh();
    const unsub = smartPlaylistService.subscribe(refresh);
    return unsub;
  }, []);

  const handlePlayPlaylist = (def: SmartPlaylistDefinition, isShuff = false) => {
    const matches = evaluateSmartPlaylist(def, tracks);
    if (matches.length === 0) return;
    if (isShuff) {
      const shuffled = [...matches].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(matches[0], matches);
    }
  };

  const handleQueuePlaylist = (def: SmartPlaylistDefinition) => {
    const matches = evaluateSmartPlaylist(def, tracks);
    matches.forEach((t) => addToQueue(t));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this smart playlist rule? (Audio files will NOT be deleted)')) {
      smartPlaylistService.delete(id);
    }
  };

  const activeMatches = selectedPlaylist
    ? evaluateSmartPlaylist(selectedPlaylist, tracks)
    : [];

  return (
    <div className="flex-1 flex h-full border border-white/5 rounded-2xl bg-[#0D0D12] overflow-hidden">
      {/* Left Sidebar: Smart Playlists list */}
      <div className="w-64 sm:w-72 border-r border-white/5 flex flex-col bg-[#0A0A0E] overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Smart Playlists
            </span>
          </div>
          <button
            onClick={() => {
              setPlaylistToEdit(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
          >
            <Plus size={13} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {smartPlaylists.map((pl) => {
            const count = evaluateSmartPlaylist(pl, tracks).length;
            const isSelected = selectedPlaylist?.id === pl.id;

            return (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylist(pl)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                  isSelected
                    ? 'bg-violet-600/20 text-violet-300 font-semibold border-l-2 border-violet-500'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="truncate text-white font-medium">{pl.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {pl.rules.length} rule{pl.rules.length !== 1 ? 's' : ''} • {pl.matchMode.toUpperCase()}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-numbers bg-white/5 text-zinc-400">
                    {count}
                  </span>
                  {!pl.isBuiltIn && (
                    <button
                      onClick={(e) => handleDelete(pl.id, e)}
                      className="p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete smart playlist"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Content Pane: Selected Smart Playlist details & tracks */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01]">
        {selectedPlaylist ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        {selectedPlaylist.name}
                      </h2>
                      {selectedPlaylist.isBuiltIn && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          Built-In
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {selectedPlaylist.description ||
                        `Dynamic playlist evaluating ${selectedPlaylist.rules.length} rule(s)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayPlaylist(selectedPlaylist, false)}
                  disabled={activeMatches.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white shadow-glow-sm transition-all"
                >
                  <Play size={14} fill="currentColor" /> Play ({activeMatches.length})
                </button>
                <button
                  onClick={() => handlePlayPlaylist(selectedPlaylist, true)}
                  disabled={activeMatches.length === 0}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none text-zinc-400 hover:text-white transition-colors"
                  title="Shuffle Smart Playlist"
                >
                  <Shuffle size={14} />
                </button>
                <button
                  onClick={() => handleQueuePlaylist(selectedPlaylist)}
                  disabled={activeMatches.length === 0}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none text-zinc-400 hover:text-white transition-colors"
                  title="Add to Queue"
                >
                  <ListPlus size={14} />
                </button>
                <button
                  onClick={() => {
                    setPlaylistToEdit(selectedPlaylist);
                    setModalOpen(true);
                  }}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                  title="Edit Rules"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {activeMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
                  <Music size={36} className="text-zinc-600" />
                  <p className="text-sm font-medium">No tracks in your library currently match these rules</p>
                  <p className="text-xs text-zinc-600">
                    Edit the criteria or add more tracks to your library to populate this playlist
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activeMatches.map((track, idx) => (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, activeMatches)}
                      className="group flex items-center justify-between px-3.5 py-2 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-[11px] text-zinc-500 font-mono-numbers w-5 text-right">
                          {idx + 1}
                        </span>
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                          {track.artworkDataUrl ? (
                            <img
                              src={track.artworkDataUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music size={14} className="text-violet-400" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                            {track.title}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            {track.artist} • {track.album}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono-numbers text-zinc-400 shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-400 uppercase">
                          {track.codec}
                        </span>
                        <span>
                          {Math.floor(track.duration / 60)}:
                          {Math.floor(track.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
            <Sliders size={36} className="text-zinc-600" />
            <p className="text-sm font-medium">Select a Smart Playlist to view rules and tracks</p>
          </div>
        )}
      </div>

      <SmartPlaylistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        playlistToEdit={playlistToEdit}
      />
    </div>
  );
};
