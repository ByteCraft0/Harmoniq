import React, { useState, useEffect } from 'react';
import {
  SmartPlaylistDefinition,
  SmartPlaylistRule,
  SmartPlaylistField,
  SmartPlaylistOperator,
  SmartPlaylistSortBy,
} from '../../types/smartPlaylist';
import { smartPlaylistService, evaluateSmartPlaylist } from '../../services/smartPlaylistService';
import { useLibrary } from '../../context/LibraryContext';
import { X, Plus, Trash2, Sliders, CheckCircle2, Music } from 'lucide-react';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistToEdit?: SmartPlaylistDefinition | null;
  onSaved?: (playlist: SmartPlaylistDefinition) => void;
}

const FIELD_OPTIONS: { value: SmartPlaylistField; label: string; type: 'text' | 'number' | 'boolean' }[] = [
  { value: 'title', label: 'Song Title', type: 'text' },
  { value: 'artist', label: 'Artist Name', type: 'text' },
  { value: 'album', label: 'Album Title', type: 'text' },
  { value: 'genre', label: 'Genre', type: 'text' },
  { value: 'year', label: 'Release Year', type: 'number' },
  { value: 'duration', label: 'Duration (Seconds)', type: 'number' },
  { value: 'bitrate', label: 'Bitrate (kbps)', type: 'number' },
  { value: 'codec', label: 'Audio Format (FLAC, MP3, etc.)', type: 'text' },
  { value: 'playCount', label: 'Play Count', type: 'number' },
  { value: 'isFavorite', label: 'Starred Favorite', type: 'boolean' },
];

const OPERATORS_TEXT: { value: SmartPlaylistOperator; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'equals', label: 'is exactly' },
  { value: 'notEquals', label: 'is not' },
];

const OPERATORS_NUMERIC: { value: SmartPlaylistOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'greaterThan', label: 'is greater than' },
  { value: 'lessThan', label: 'is less than' },
  { value: 'between', label: 'is between' },
];

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlistToEdit,
  onSaved,
}) => {
  const { tracks } = useLibrary();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [rules, setRules] = useState<SmartPlaylistRule[]>([]);
  const [sortBy, setSortBy] = useState<SmartPlaylistSortBy>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState<number>(0);
  const [previewMatches, setPreviewMatches] = useState<number>(0);

  useEffect(() => {
    if (playlistToEdit) {
      setName(playlistToEdit.name);
      setDescription(playlistToEdit.description || '');
      setMatchMode(playlistToEdit.matchMode || 'all');
      setRules(playlistToEdit.rules ? [...playlistToEdit.rules] : []);
      setSortBy(playlistToEdit.sortBy || 'title');
      setSortOrder(playlistToEdit.sortOrder || 'asc');
      setLimit(playlistToEdit.limit || 0);
    } else {
      setName('');
      setDescription('');
      setMatchMode('all');
      setRules([
        {
          id: `r_${Date.now()}`,
          field: 'genre',
          operator: 'contains',
          value: '',
        },
      ]);
      setSortBy('title');
      setSortOrder('asc');
      setLimit(0);
    }
  }, [playlistToEdit, isOpen]);

  // Live preview evaluation
  useEffect(() => {
    const dummy: SmartPlaylistDefinition = {
      id: 'preview',
      name: name || 'Preview',
      matchMode,
      rules,
      sortBy,
      sortOrder,
      limit,
      dateCreated: 0,
      dateModified: 0,
    };
    const matches = evaluateSmartPlaylist(dummy, tracks);
    setPreviewMatches(matches.length);
  }, [tracks, matchMode, rules, sortBy, sortOrder, limit, name]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        field: 'artist',
        operator: 'contains',
        value: '',
      },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRule = (id: string, updates: Partial<SmartPlaylistRule>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // Reset operator if field type changed
        if (updates.field) {
          const fieldDef = FIELD_OPTIONS.find((f) => f.value === updates.field);
          if (fieldDef?.type === 'number') {
            updated.operator = 'greaterThan';
            updated.value = 0;
          } else if (fieldDef?.type === 'boolean') {
            updated.operator = 'equals';
            updated.value = 'true';
          } else {
            updated.operator = 'contains';
            updated.value = '';
          }
        }
        return updated;
      })
    );
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (playlistToEdit) {
      smartPlaylistService.update(playlistToEdit.id, {
        name: trimmed,
        description: description.trim(),
        matchMode,
        rules,
        sortBy,
        sortOrder,
        limit,
      });
      if (onSaved) {
        const updated = smartPlaylistService.get(playlistToEdit.id);
        if (updated) onSaved(updated);
      }
    } else {
      const created = smartPlaylistService.create(trimmed, rules, {
        description: description.trim(),
        matchMode,
        sortBy,
        sortOrder,
        limit,
      });
      if (onSaved) onSaved(created);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#101018] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {playlistToEdit ? 'Edit Smart Playlist' : 'Create Smart Playlist'}
              </h2>
              <p className="text-xs text-zinc-400">
                Rule-based auto-updating playlist driven by your library metadata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          {/* Name & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Playlist Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chill 90s Beats"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Tracks from 1990-1999"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-all"
              />
            </div>
          </div>

          {/* Match Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-xs font-medium text-zinc-300">
              Match criteria:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMatchMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  matchMode === 'all'
                    ? 'bg-violet-600 text-white shadow-glow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Match ALL rules (AND)
              </button>
              <button
                type="button"
                onClick={() => setMatchMode('any')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  matchMode === 'any'
                    ? 'bg-violet-600 text-white shadow-glow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Match ANY rule (OR)
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Playlist Rules ({rules.length})
              </span>
              <button
                type="button"
                onClick={handleAddRule}
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                <Plus size={14} /> Add Rule
              </button>
            </div>

            {rules.map((rule) => {
              const fieldDef = FIELD_OPTIONS.find((f) => f.value === rule.field) || FIELD_OPTIONS[0];
              const isNumeric = fieldDef.type === 'number';
              const isBoolean = fieldDef.type === 'boolean';

              return (
                <div
                  key={rule.id}
                  className="flex flex-wrap md:flex-nowrap items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  {/* Field */}
                  <select
                    value={rule.field}
                    onChange={(e) => handleUpdateRule(rule.id, { field: e.target.value as SmartPlaylistField })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={rule.operator}
                    onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value as SmartPlaylistOperator })}
                    className="px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {isNumeric
                      ? OPERATORS_NUMERIC.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))
                      : OPERATORS_TEXT.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                  </select>

                  {/* Value */}
                  {isBoolean ? (
                    <select
                      value={String(rule.value)}
                      onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="true">Yes (Starred)</option>
                      <option value="false">No (Unstarred)</option>
                    </select>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 min-w-[140px]">
                      <input
                        type={isNumeric ? 'number' : 'text'}
                        value={rule.value}
                        onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                        placeholder={isNumeric ? '0' : 'Value...'}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                      />
                      {rule.operator === 'between' && (
                        <>
                          <span className="text-xs text-zinc-500">and</span>
                          <input
                            type="number"
                            value={rule.valueExtra ?? 0}
                            onChange={(e) => handleUpdateRule(rule.id, { valueExtra: Number(e.target.value) })}
                            placeholder="Max"
                            className="w-24 px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Delete Rule */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Remove rule"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Sorting & Track Limit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Sort tracks by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SmartPlaylistSortBy)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="title">Song Title</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="year">Year</option>
                <option value="duration">Duration</option>
                <option value="dateAdded">Date Added</option>
                <option value="playCount">Play Count</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="asc">Ascending (A-Z, Oldest)</option>
                <option value="desc">Descending (Z-A, Newest)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Track Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#14141E] border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value={0}>Unlimited</option>
                <option value={25}>Limit to 25 tracks</option>
                <option value={50}>Limit to 50 tracks</option>
                <option value={100}>Limit to 100 tracks</option>
                <option value={250}>Limit to 250 tracks</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Music size={14} className="text-violet-400" />
            <span>
              Live Matches: <strong className="text-white">{previewMatches}</strong> tracks found
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white shadow-glow-sm transition-all"
            >
              <CheckCircle2 size={15} />
              {playlistToEdit ? 'Save Changes' : 'Create Playlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
