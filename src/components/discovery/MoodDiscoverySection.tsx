import React, { useState } from 'react';
import {
  MOOD_DEFINITIONS,
  MoodCategory,
  discoveryService,
} from '../../services/discoveryService';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { TrackMetadata } from '../../types/audio';
import {
  Sparkles,
  Play,
  Shuffle,
  Music,
  Tag,
  Info,
  CheckCircle,
} from 'lucide-react';

export const MoodDiscoverySection: React.FC = () => {
  const { tracks } = useLibrary();
  const { playTrack } = usePlayer();
  const [selectedMood, setSelectedMood] = useState<MoodCategory>('Chill');

  const matchingTracks = discoveryService.getTracksForMood(selectedMood, tracks);
  const activeDef = MOOD_DEFINITIONS.find((m) => m.id === selectedMood)!;

  const handlePlayMood = (isShuff = false) => {
    if (matchingTracks.length === 0) return;
    if (isShuff) {
      const shuffled = [...matchingTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(matchingTracks[0], matchingTracks);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <Sparkles size={18} />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Deterministic Mood Discovery
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Categorized using verified genre metadata, audio attributes, and your manual mood tags (100% Non-AI rules)
          </p>
        </div>

        {matchingTracks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePlayMood(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-glow-sm transition-all"
            >
              <Play size={13} fill="currentColor" /> Play {selectedMood} ({matchingTracks.length})
            </button>
            <button
              onClick={() => handlePlayMood(true)}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
              title="Shuffle Mood"
            >
              <Shuffle size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Mood Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {MOOD_DEFINITIONS.map((def) => {
          const isSelected = selectedMood === def.id;
          const count = discoveryService.getTracksForMood(def.id, tracks).length;

          return (
            <button
              key={def.id}
              onClick={() => setSelectedMood(def.id)}
              className={`p-4 rounded-2xl text-left transition-all border flex flex-col justify-between h-28 relative overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-br ' + def.gradient + ' border-violet-500/60 shadow-lg'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: def.color }}
                />
                <span className="text-[10px] font-mono-numbers text-zinc-500 font-semibold">
                  {count} tracks
                </span>
              </div>

              <div>
                <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                  {def.id}
                </h3>
                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                  {def.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mood Information Banner */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
        <Info size={16} className="text-violet-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <strong>{activeDef.name}:</strong> {activeDef.description}. Matched via genres:{' '}
          <span className="text-violet-300 font-mono">
            {activeDef.genres.slice(0, 5).join(', ')}
          </span>.
        </div>
      </div>

      {/* Matching Tracks List */}
      <div className="rounded-2xl bg-white/[0.01] border border-white/5 overflow-hidden">
        {matchingTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
            <Music size={36} className="text-zinc-600" />
            <p className="text-sm font-medium">No tracks found matching {selectedMood}</p>
            <p className="text-xs text-zinc-600">
              Add music files matching {activeDef.genres.slice(0, 3).join(', ')} or assign mood tags to tracks
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.02]">
            {matchingTracks.slice(0, 20).map((track, idx) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, matchingTracks)}
                className="group flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-[11px] text-zinc-500 font-mono-numbers w-5 text-right">
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    {track.artworkDataUrl ? (
                      <img src={track.artworkDataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={14} className="text-violet-400" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {track.artist} • {track.album}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400 shrink-0 font-mono-numbers">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-400 uppercase">
                    {track.genre || track.codec}
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
    </div>
  );
};
