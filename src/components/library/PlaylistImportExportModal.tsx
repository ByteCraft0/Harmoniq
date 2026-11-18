import React, { useState } from 'react';
import { playlistIoService, ParsedM3uResult } from '../../services/playlistIoService';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { Playlist } from '../../types/library';
import {
  Upload,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  ListMusic,
  Save,
  Music,
} from 'lucide-react';

interface PlaylistImportExportModalProps {
  initialMode?: 'import' | 'export';
  activePlaylist?: Playlist | null;
  onClose: () => void;
}

export const PlaylistImportExportModal: React.FC<PlaylistImportExportModalProps> = ({
  initialMode = 'import',
  activePlaylist,
  onClose,
}) => {
  const { tracks, playlists, createPlaylist } = useLibrary();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'import' | 'export'>(initialMode);

  // Import State
  const [importFileName, setImportFileName] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedM3uResult | null>(null);

  // Export State
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    activePlaylist?.id || (playlists.find((p) => !p.isSmart)?.id || '')
  );
  const [exportFormat, setExportFormat] = useState<'m3u' | 'm3u8'>('m3u8');
  const [useRelativePaths, setUseRelativePaths] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const suggestedName = file.name.replace(/\.[^/.]+$/, '');
    setPlaylistName(suggestedName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = playlistIoService.parseM3u(content, {
          libraryTracks: tracks,
          allowDuplicates,
        });
        if (result.playlistName) {
          setPlaylistName(result.playlistName);
        }
        setParsedResult(result);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.matchedTracks.length === 0) {
      showToast('No tracks matched to import', 'error');
      return;
    }

    const finalName = playlistName.trim() || importFileName || 'Imported Playlist';
    const newPl = createPlaylist(
      finalName,
      `Imported from ${importFileName} (${parsedResult.matchedTracks.length} tracks)`
    );

    newPl.trackIds = parsedResult.matchedTracks.map((t) => t.id);
    showToast(`Successfully imported playlist "${finalName}" (${parsedResult.matchedTracks.length} tracks)`, 'success');
    onClose();
  };

  const handleExport = () => {
    const pl = playlists.find((p) => p.id === selectedPlaylistId);
    if (!pl) {
      showToast('Please select a playlist to export', 'error');
      return;
    }

    const plTracks = pl.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is typeof tracks[0] => !!t);

    if (plTracks.length === 0) {
      showToast('Playlist has no tracks to export', 'error');
      return;
    }

    const content = playlistIoService.generateM3u(plTracks, {
      playlistName: pl.name,
      useRelativePaths,
    });

    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pl.name.replace(/[/\\?%*:|"<>]/g, '_')}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported "${pl.name}" to ${exportFormat.toUpperCase()}`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#272733] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex bg-[#1B1B24] p-1 rounded-xl border border-[#272733]">
              <button
                onClick={() => setMode('import')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === 'import' ? 'bg-[#A78BFA] text-[#09090B]' : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
                }`}
              >
                <Upload size={14} />
                <span>Import M3U / M3U8</span>
              </button>
              <button
                onClick={() => setMode('export')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === 'export' ? 'bg-[#A78BFA] text-[#09090B]' : 'text-[#A1A1AA] hover:text-[#F5F3FF]'
                }`}
              >
                <Download size={14} />
                <span>Export M3U / M3U8</span>
              </button>
            </div>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF]">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {mode === 'import' ? (
            <div className="space-y-5">
              {/* File selector drop zone */}
              <div className="border-2 border-dashed border-[#272733] hover:border-violet-500/50 rounded-2xl p-6 text-center space-y-2 transition bg-[#1B1B24]/40">
                <FileText size={32} className="mx-auto text-violet-400" />
                <p className="text-xs font-medium text-[#F5F3FF]">
                  {importFileName ? importFileName : 'Select an M3U or M3U8 playlist file'}
                </p>
                <p className="text-[11px] text-[#71717A]">Preserves track sequence and supports relative/absolute paths</p>
                <label className="inline-block mt-2 px-4 py-2 bg-[#272733] hover:bg-[#323242] text-[#F5F3FF] text-xs font-semibold rounded-xl cursor-pointer transition">
                  Browse File
                  <input type="file" accept=".m3u,.m3u8" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {parsedResult && (
                <div className="space-y-4">
                  {/* Playlist Name Input */}
                  <div>
                    <label className="block text-xs text-[#A1A1AA] mb-1 font-medium">Playlist Name</label>
                    <input
                      type="text"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      placeholder="My Imported Playlist"
                      className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2 outline-none"
                    />
                  </div>

                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2.5 text-emerald-300">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <div>
                        <p className="font-bold">{parsedResult.matchedTracks.length} tracks matched</p>
                        <p className="text-[10px] text-emerald-400/80">Found in local music library</p>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-center gap-2.5 text-amber-300">
                      <AlertTriangle size={18} className="shrink-0" />
                      <div>
                        <p className="font-bold">{parsedResult.missingEntries.length} missing tracks</p>
                        <p className="text-[10px] text-amber-400/80">Files not located in library</p>
                      </div>
                    </div>
                  </div>

                  {/* Duplicates toggle */}
                  {parsedResult.duplicateCount > 0 && (
                    <label className="flex items-center gap-2 text-xs text-[#A1A1AA] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowDuplicates}
                        onChange={(e) => setAllowDuplicates(e.target.checked)}
                        className="rounded accent-violet-400"
                      />
                      <span>
                        Include {parsedResult.duplicateCount} duplicate track occurrences (otherwise skipped)
                      </span>
                    </label>
                  )}

                  {/* Missing tracks details preview if any */}
                  {parsedResult.missingEntries.length > 0 && (
                    <div className="p-3 bg-[#1B1B24] border border-[#272733] rounded-xl space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                      <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                        Unmatched Paths in Playlist:
                      </p>
                      {parsedResult.missingEntries.slice(0, 10).map((miss, idx) => (
                        <div key={idx} className="text-[11px] text-[#A1A1AA] font-mono truncate">
                          {miss.artist ? `${miss.artist} - ` : ''}
                          {miss.title || miss.rawPath}
                        </div>
                      ))}
                      {parsedResult.missingEntries.length > 10 && (
                        <p className="text-[10px] text-[#71717A]">
                          + {parsedResult.missingEntries.length - 10} more missing items
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select Playlist to Export */}
              <div>
                <label className="block text-xs text-[#A1A1AA] mb-1 font-medium">Select Playlist to Export</label>
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none"
                >
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.trackIds.length} tracks)
                    </option>
                  ))}
                </select>
              </div>

              {/* Format selection */}
              <div>
                <label className="block text-xs text-[#A1A1AA] mb-1 font-medium">Format</label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setExportFormat('m3u8')}
                    className={`p-3 rounded-xl border text-left transition ${
                      exportFormat === 'm3u8'
                        ? 'border-violet-500 bg-violet-950/20 text-[#F5F3FF]'
                        : 'border-[#272733] bg-[#1B1B24] text-[#A1A1AA]'
                    }`}
                  >
                    <p className="font-bold">M3U8 (Recommended)</p>
                    <p className="text-[11px] text-[#71717A] mt-0.5">UTF-8 encoding with full Unicode metadata</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('m3u')}
                    className={`p-3 rounded-xl border text-left transition ${
                      exportFormat === 'm3u'
                        ? 'border-violet-500 bg-violet-950/20 text-[#F5F3FF]'
                        : 'border-[#272733] bg-[#1B1B24] text-[#A1A1AA]'
                    }`}
                  >
                    <p className="font-bold">Standard M3U</p>
                    <p className="text-[11px] text-[#71717A] mt-0.5">Legacy compatibility format</p>
                  </button>
                </div>
              </div>

              {/* Path mode */}
              <label className="flex items-center gap-2 text-xs text-[#A1A1AA] cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={useRelativePaths}
                  onChange={(e) => setUseRelativePaths(e.target.checked)}
                  className="rounded accent-violet-400"
                />
                <span>Generate relative file paths (portable across folder structures)</span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#272733] flex items-center justify-end gap-3 bg-[#111116]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] text-xs font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          {mode === 'import' ? (
            <button
              onClick={handleConfirmImport}
              disabled={!parsedResult || parsedResult.matchedTracks.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-40 text-[#09090B] text-xs font-bold rounded-xl transition shadow-md"
            >
              <Save size={14} />
              <span>Import to Library</span>
            </button>
          ) : (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] text-xs font-bold rounded-xl transition shadow-md"
            >
              <Download size={14} />
              <span>Export Playlist</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
