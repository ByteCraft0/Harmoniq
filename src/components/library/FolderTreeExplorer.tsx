import React, { useState, useMemo } from 'react';
import { TrackMetadata } from '../../types/audio';
import { usePlayer } from '../../context/PlayerContext';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Music,
  Play,
  ListPlus,
  Shuffle,
  HardDrive,
} from 'lucide-react';

interface FolderNode {
  name: string;
  path: string;
  subFolders: Map<string, FolderNode>;
  tracks: TrackMetadata[];
}

interface FolderTreeExplorerProps {
  tracks: TrackMetadata[];
  onSelectTrack?: (track: TrackMetadata) => void;
  selectedTrackIds?: Set<string>;
  onToggleTrackSelect?: (id: string, isShift?: boolean) => void;
}

export const FolderTreeExplorer: React.FC<FolderTreeExplorerProps> = ({
  tracks,
  onSelectTrack,
  selectedTrackIds = new Set(),
  onToggleTrackSelect,
}) => {
  const { playTrack, addToQueue } = usePlayer();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFolderNode, setSelectedFolderNode] = useState<FolderNode | null>(null);

  // Build hierarchical folder tree
  const rootFolders = useMemo(() => {
    const roots = new Map<string, FolderNode>();

    for (const track of tracks) {
      if (!track.filePath) continue;
      // Normalize slashes
      const normalized = track.filePath.replace(/\\/g, '/');
      const parts = normalized.split('/');
      if (parts.length < 2) continue;

      // Extract drive / root
      const drive = parts[0] || 'Default';
      let currentRoot = roots.get(drive);
      if (!currentRoot) {
        currentRoot = {
          name: drive,
          path: drive,
          subFolders: new Map(),
          tracks: [],
        };
        roots.set(drive, currentRoot);
      }

      let current = currentRoot;
      let accumulatedPath = drive;

      // Iterate through folder segments (excluding file name)
      for (let i = 1; i < parts.length - 1; i++) {
        const seg = parts[i];
        accumulatedPath += `/${seg}`;
        let next = current.subFolders.get(seg);
        if (!next) {
          next = {
            name: seg,
            path: accumulatedPath,
            subFolders: new Map(),
            tracks: [],
          };
          current.subFolders.set(seg, next);
        }
        current = next;
      }

      current.tracks.push(track);
    }

    return Array.from(roots.values());
  }, [tracks]);

  // Set default selected folder if none
  useMemo(() => {
    if (!selectedFolderNode && rootFolders.length > 0) {
      setSelectedFolderNode(rootFolders[0]);
    }
  }, [rootFolders, selectedFolderNode]);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const copy = new Set(prev);
      if (copy.has(path)) copy.delete(path);
      else copy.add(path);
      return copy;
    });
  };

  // Helper to recursively collect all tracks in folder and subfolders
  const collectAllTracks = (node: FolderNode): TrackMetadata[] => {
    let list = [...node.tracks];
    for (const sub of node.subFolders.values()) {
      list = list.concat(collectAllTracks(sub));
    }
    return list;
  };

  const handlePlayFolder = (node: FolderNode, isShuff = false) => {
    const all = collectAllTracks(node);
    if (all.length === 0) return;
    if (isShuff) {
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(all[0], all);
    }
  };

  const handleQueueFolder = (node: FolderNode) => {
    const all = collectAllTracks(node);
    all.forEach((t) => addToQueue(t));
  };

  // Render a folder branch recursively
  const renderFolderBranch = (node: FolderNode, depth = 0) => {
    const hasChildren = node.subFolders.size > 0;
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedFolderNode?.path === node.path;
    const allTracksInSubtree = collectAllTracks(node).length;

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => setSelectedFolderNode(node)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-colors text-xs ${
            isSelected
              ? 'bg-violet-600/20 text-violet-300 font-semibold border-l-2 border-violet-500'
              : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.path, e)}
                className="p-0.5 text-zinc-500 hover:text-white transition-colors"
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {depth === 0 ? (
              <HardDrive size={13} className="text-zinc-400 shrink-0" />
            ) : isExpanded ? (
              <FolderOpen size={14} className="text-violet-400 shrink-0" />
            ) : (
              <Folder size={14} className="text-zinc-400 shrink-0" />
            )}

            <span className="truncate">{node.name}</span>
          </div>

          <span className="text-[10px] text-zinc-500 font-mono-numbers ml-2">
            {allTracksInSubtree}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {Array.from(node.subFolders.values()).map((sub) =>
              renderFolderBranch(sub, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const displayedFolderTracks = selectedFolderNode ? collectAllTracks(selectedFolderNode) : [];

  return (
    <div className="flex-1 flex h-full overflow-hidden border border-white/5 rounded-2xl bg-[#0D0D12]">
      {/* Left Tree Pane */}
      <div className="w-64 sm:w-72 border-r border-white/5 flex flex-col bg-[#0A0A0E] overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Folder Directory Tree
          </span>
          <span className="text-[11px] text-zinc-500 font-mono-numbers">
            {rootFolders.length} Root{rootFolders.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {rootFolders.map((root) => renderFolderBranch(root, 0))}
        </div>
      </div>

      {/* Right Tracks Pane */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01]">
        {/* Selected Folder Header */}
        <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2">
              <Folder size={18} className="text-violet-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                {selectedFolderNode?.name || 'Select a folder'}
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate max-w-lg">
              {selectedFolderNode?.path}
            </p>
          </div>

          {selectedFolderNode && displayedFolderTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlayFolder(selectedFolderNode, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm transition-all"
              >
                <Play size={13} fill="currentColor" /> Play Folder ({displayedFolderTracks.length})
              </button>
              <button
                onClick={() => handlePlayFolder(selectedFolderNode, true)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                title="Shuffle Folder"
              >
                <Shuffle size={14} />
              </button>
              <button
                onClick={() => handleQueueFolder(selectedFolderNode)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                title="Add Folder to Queue"
              >
                <ListPlus size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Tracks Table in Folder */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {displayedFolderTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
              <FolderOpen size={36} className="text-zinc-600" />
              <p className="text-sm font-medium">No audio tracks in this directory</p>
            </div>
          ) : (
            <div className="space-y-1">
              {displayedFolderTracks.map((track, idx) => {
                const isSelected = selectedTrackIds.has(track.id);
                return (
                  <div
                    key={track.id}
                    onClick={() => onSelectTrack?.(track)}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-violet-600/20 border border-violet-500/30'
                        : 'hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {onToggleTrackSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleTrackSelect(track.id);
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500 cursor-pointer"
                        />
                      )}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
