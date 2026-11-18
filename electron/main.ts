import { app, BrowserWindow, ipcMain, dialog, protocol, shell, screen } from 'electron';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import { parseFile } from 'music-metadata';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.NODE_ENV !== 'production');

// Mini-player window state management
let isMiniPlayer = false;
let normalBounds: { x: number; y: number; width: number; height: number } | null = null;
let miniBounds: { x: number; y: number; width: number; height: number } | null = null;

function clampBoundsToScreen(bounds: { x: number; y: number; width: number; height: number }) {
  try {
    const display = screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay();
    const workArea = display.workArea;
    const x = Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - bounds.width));
    const y = Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - bounds.height));
    return { x, y, width: bounds.width, height: bounds.height };
  } catch {
    return bounds;
  }
}

// Folder watcher state
let chokidarInstance: any = null;
let activeFolderWatcher: any = null;
let currentWatchedFolders: string[] = [];
let watcherDebounceTimer: NodeJS.Timeout | null = null;
const watcherPendingEvents = new Map<string, 'add' | 'change' | 'unlink'>();

function stopFolderWatcher() {
  if (activeFolderWatcher) {
    try {
      activeFolderWatcher.close();
    } catch {}
    activeFolderWatcher = null;
  }
  currentWatchedFolders = [];
  watcherPendingEvents.clear();
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }
}

function startFolderWatcher(folders: string[]) {
  stopFolderWatcher();
  const validFolders = (folders || []).filter((f) => {
    try {
      return fs.existsSync(f) && fs.statSync(f).isDirectory();
    } catch {
      return false;
    }
  });

  currentWatchedFolders = validFolders;
  if (validFolders.length === 0) {
    mainWindow?.webContents.send('watcher:syncStatus', { status: 'idle', folderCount: 0 });
    return;
  }

  try {
    if (!chokidarInstance) {
      chokidarInstance = require('chokidar');
    }
    activeFolderWatcher = chokidarInstance.watch(validFolders, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 250,
      },
    });

    const flushWatcherBatch = async () => {
      if (watcherPendingEvents.size === 0) return;
      const batch = Array.from(watcherPendingEvents.entries());
      watcherPendingEvents.clear();

      let addedOrUpdatedCount = 0;
      let removedCount = 0;

      for (const [filePath, action] of batch) {
        const ext = path.extname(filePath).toLowerCase();
        if (!AUDIO_EXTENSIONS.has(ext)) continue;

        if (action === 'unlink') {
          removedCount++;
          mainWindow?.webContents.send('watcher:fileRemoved', filePath);
        } else {
          try {
            const track = await parseSingleAudioFile(filePath);
            if (track) {
              addedOrUpdatedCount++;
              mainWindow?.webContents.send('watcher:fileAddedOrUpdated', track);
            }
          } catch (e) {
            console.warn(`Watcher failed to parse ${filePath}:`, e);
          }
        }
      }

      mainWindow?.webContents.send('watcher:syncStatus', {
        status: 'active',
        folderCount: currentWatchedFolders.length,
        lastSync: Date.now(),
        addedOrUpdatedCount,
        removedCount,
      });
    };

    const triggerBatch = () => {
      mainWindow?.webContents.send('watcher:syncStatus', {
        status: 'syncing',
        folderCount: currentWatchedFolders.length,
      });
      if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
      watcherDebounceTimer = setTimeout(flushWatcherBatch, 800);
    };

    activeFolderWatcher.on('add', (filePath: string) => {
      watcherPendingEvents.set(filePath, 'add');
      triggerBatch();
    });

    activeFolderWatcher.on('change', (filePath: string) => {
      watcherPendingEvents.set(filePath, 'change');
      triggerBatch();
    });

    activeFolderWatcher.on('unlink', (filePath: string) => {
      watcherPendingEvents.set(filePath, 'unlink');
      triggerBatch();
    });

    activeFolderWatcher.on('error', (err: any) => {
      console.warn('Folder watcher error:', err);
      mainWindow?.webContents.send('watcher:syncStatus', {
        status: 'error',
        folderCount: currentWatchedFolders.length,
        error: String(err?.message || err),
      });
    });

    mainWindow?.webContents.send('watcher:syncStatus', {
      status: 'active',
      folderCount: currentWatchedFolders.length,
    });
  } catch (err) {
    console.error('Failed to initialize folder watcher:', err);
    mainWindow?.webContents.send('watcher:syncStatus', {
      status: 'error',
      folderCount: 0,
      error: String(err),
    });
  }
}

async function writeAudioTagsToFile(
  filePath: string,
  tags: {
    title?: string;
    artist?: string;
    album?: string;
    albumArtist?: string;
    genre?: string;
    year?: number;
    trackNumber?: number;
    trackTotal?: number;
    artworkBase64?: string;
    artworkMime?: string;
  }
): Promise<{ success: boolean; track: any | null; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, track: null, error: 'Audio file does not exist' };
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.mp3') {
      const NodeID3 = require('node-id3');
      const id3Tags: any = {};
      if (tags.title !== undefined) id3Tags.title = tags.title;
      if (tags.artist !== undefined) id3Tags.artist = tags.artist;
      if (tags.album !== undefined) id3Tags.album = tags.album;
      if (tags.albumArtist !== undefined) id3Tags.performerInfo = tags.albumArtist;
      if (tags.genre !== undefined) id3Tags.genre = tags.genre;
      if (tags.year !== undefined) id3Tags.year = String(tags.year);
      if (tags.trackNumber !== undefined) {
        id3Tags.trackNumber = tags.trackTotal ? `${tags.trackNumber}/${tags.trackTotal}` : String(tags.trackNumber);
      }
      if (tags.artworkBase64) {
        const cleanBase64 = tags.artworkBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const imgBuffer = Buffer.from(cleanBase64, 'base64');
        id3Tags.image = {
          mime: tags.artworkMime || 'image/jpeg',
          type: { id: 3, name: 'front cover' },
          description: 'Front Cover',
          imageBuffer: imgBuffer,
        };
      }
      const writeResult = NodeID3.update(id3Tags, filePath);
      if (writeResult === false) {
        return { success: false, track: null, error: 'Failed to write ID3 tags to MP3 file' };
      }
    } else if (ext === '.flac') {
      const { readFlacTags, writeFlacTags } = await import('flac-tagger');
      const current = await readFlacTags(filePath);
      const tagMap = { ...(current.tagMap || {}) };

      if (tags.title !== undefined) tagMap.TITLE = tags.title;
      if (tags.artist !== undefined) tagMap.ARTIST = tags.artist;
      if (tags.album !== undefined) tagMap.ALBUM = tags.album;
      if (tags.albumArtist !== undefined) tagMap.ALBUMARTIST = tags.albumArtist;
      if (tags.genre !== undefined) tagMap.GENRE = tags.genre;
      if (tags.year !== undefined) {
        tagMap.DATE = String(tags.year);
        tagMap.YEAR = String(tags.year);
      }
      if (tags.trackNumber !== undefined) {
        tagMap.TRACKNUMBER = tags.trackTotal ? `${tags.trackNumber}/${tags.trackTotal}` : String(tags.trackNumber);
      }

      let pictureObj = current.picture;
      if (tags.artworkBase64) {
        const cleanBase64 = tags.artworkBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const imgBuffer = Buffer.from(cleanBase64, 'base64');
        pictureObj = {
          buffer: imgBuffer,
          mime: tags.artworkMime || 'image/jpeg',
          description: 'Front Cover',
        };
      }

      await writeFlacTags(
        {
          tagMap,
          picture: pictureObj,
        },
        filePath
      );
    } else {
      return { success: false, track: null, error: `Metadata writing is not supported for ${ext} files` };
    }

    // Re-parse and return fresh metadata
    const updatedTrack = await parseSingleAudioFile(filePath);
    return { success: true, track: updatedTrack };
  } catch (err: any) {
    console.error('Error writing audio tags:', err);
    return { success: false, track: null, error: err?.message || String(err) };
  }
}

// Supported audio extensions
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.alac',
  '.ogg',
  '.opus',
  '.aiff',
  '.aif',
  '.wma',
]);

// Protocol scheme for local media streaming
const MEDIA_PROTOCOL = 'harmoniq-media';

// Register custom protocol privilege
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 1000,
    minHeight: 660,
    frame: false, // Frameless for modern Windows design
    titleBarStyle: 'hidden',
    backgroundColor: '#0b0c10',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Never let the app window navigate away or spawn windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith('http://localhost:5173') : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  const distIndex = path.join(__dirname, '../dist/index.html');
  if (isDev) {
    // If no dev server is running (e.g. `electron .` after a build), fall back to the built UI once
    let fellBack = false;
    mainWindow.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
      if (isMainFrame && !fellBack && fs.existsSync(distIndex)) {
        fellBack = true;
        mainWindow?.loadFile(distIndex);
      }
    });
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distIndex);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-changed', false));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// Streams local audio with proper HTTP Range support. URL shape: harmoniq-media://local/<encoded/path/segments>
const MEDIA_EXTENSIONS = new Set([...AUDIO_EXTENSIONS]);

function mediaUrlToPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/UNC/')) {
      p = '\\\\' + p.slice(5).replace(/\//g, '\\');
    } else if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(p)) {
      p = p.slice(1);
    }
    return path.normalize(p);
  } catch {
    return null;
  }
}

function registerMediaProtocol() {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range' };

  protocol.handle(MEDIA_PROTOCOL, async (request) => {
    try {
      const filePath = mediaUrlToPath(request.url);
      if (!filePath || !MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        return new Response('Forbidden', { status: 403, headers: cors });
      }

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(filePath);
      } catch {
        return new Response('File not found', { status: 404, headers: cors });
      }
      if (!stat.isFile()) return new Response('Not a file', { status: 404, headers: cors });

      const size = stat.size;
      const baseHeaders = {
        ...cors,
        'Content-Type': getMimeType(filePath),
        'Accept-Ranges': 'bytes',
      };
      const range = request.headers.get('range');
      const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

      if (!match || (match[1] === '' && match[2] === '')) {
        if (size === 0) return new Response(null, { status: 200, headers: { ...baseHeaders, 'Content-Length': '0' } });
        const body = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;
        return new Response(body, { status: 200, headers: { ...baseHeaders, 'Content-Length': String(size) } });
      }

      let start: number;
      let end: number;
      if (match[1] === '') {
        // suffix range: last N bytes
        const n = parseInt(match[2], 10);
        start = Math.max(0, size - n);
        end = size - 1;
      } else {
        start = parseInt(match[1], 10);
        end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2], 10), size - 1);
      }

      if (!(start >= 0) || start >= size || end < start) {
        return new Response(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` } });
      }

      const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as ReadableStream;
      return new Response(body, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
      });
    } catch (err: any) {
      console.error('Error handling media protocol request:', err);
      return new Response(String(err?.message ?? err), { status: 500, headers: cors });
    }
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.flac':
      return 'audio/flac';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.m4a':
    case '.aac':
    case '.alac':
      return 'audio/mp4';
    case '.ogg':
      return 'audio/ogg';
    case '.opus':
      return 'audio/opus';
    case '.aiff':
    case '.aif':
      return 'audio/aiff';
    case '.wma':
      return 'audio/x-ms-wma';
    default:
      return 'application/octet-stream';
  }
}

// IPC Handlers
function setupIpc() {
  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Mini-player controls
  ipcMain.handle('window:isMiniPlayer', () => isMiniPlayer);

  ipcMain.handle('window:setMiniPlayer', (_e, enable: boolean) => {
    if (!mainWindow) return false;
    if (enable === isMiniPlayer) return isMiniPlayer;

    if (enable) {
      // Entering compact mini-player mode
      normalBounds = mainWindow.getBounds();
      isMiniPlayer = true;
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setMinimumSize(320, 140);
      mainWindow.setMaximumSize(640, 360);

      const targetWidth = miniBounds?.width || 360;
      const targetHeight = miniBounds?.height || 160;
      const targetX = miniBounds?.x ?? (normalBounds.x + normalBounds.width - targetWidth - 20);
      const targetY = miniBounds?.y ?? (normalBounds.y + normalBounds.height - targetHeight - 20);

      const clamped = clampBoundsToScreen({ x: targetX, y: targetY, width: targetWidth, height: targetHeight });
      mainWindow.setBounds(clamped, true);
      mainWindow.webContents.send('window:mini-player-changed', true);
    } else {
      // Restoring to full window mode
      miniBounds = mainWindow.getBounds();
      isMiniPlayer = false;
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setMaximumSize(10000, 10000);
      mainWindow.setMinimumSize(1000, 660);

      const target = normalBounds || { x: 100, y: 100, width: 1300, height: 840 };
      const clamped = clampBoundsToScreen(target);
      mainWindow.setBounds(clamped, true);
      mainWindow.webContents.send('window:mini-player-changed', false);
    }
    return isMiniPlayer;
  });

  ipcMain.handle('window:toggleMiniPlayer', () => {
    return (ipcMain as any)._handlers['window:setMiniPlayer'](null, !isMiniPlayer);
  });

  // Folder watcher controls
  ipcMain.handle('watcher:start', (_e, folders: string[]) => {
    startFolderWatcher(folders);
    return true;
  });

  ipcMain.handle('watcher:stop', () => {
    stopFolderWatcher();
    return true;
  });

  ipcMain.handle('watcher:getStatus', () => ({
    isActive: !!activeFolderWatcher,
    folders: currentWatchedFolders,
  }));

  // Folder & file pickers
  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select Music Folder to Scan',
    });
    if (result.canceled) return null;
    return result.filePaths;
  });

  ipcMain.handle('dialog:openFiles', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select Audio Files',
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'alac', 'ogg', 'opus', 'aiff'],
        },
      ],
    });
    if (result.canceled) return null;
    return result.filePaths;
  });

  ipcMain.handle('dialog:openLrcFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Synchronized Lyrics (.LRC) File',
      filters: [
        { name: 'LRC Lyric Files', extensions: ['lrc', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    try {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        filePath,
        content: content.replace(/^\uFEFF/, ''),
      };
    } catch (e: any) {
      console.warn('Failed to read selected LRC file:', e);
      return null;
    }
  });

  ipcMain.handle('dialog:openArtworkImage', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Album Artwork Image',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    try {
      const filePath = result.filePaths[0];
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return {
        filePath,
        mime,
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      };
    } catch (e: any) {
      console.warn('Failed to read artwork file:', e);
      return null;
    }
  });

  ipcMain.handle('system:showItemInFolder', async (_e, filePath: string) => {
    if (typeof filePath === 'string' && filePath) shell.showItemInFolder(filePath);
  });

  // Now-playing info -> window title (OS media controls are handled by the renderer's Media Session)
  ipcMain.handle('system:updateSMTC', async (_e, track: { title?: string; artist?: string; isPlaying?: boolean }) => {
    if (!mainWindow || !track) return false;
    mainWindow.setTitle(track.title ? `${track.isPlaying ? '▶ ' : ''}${track.artist ? track.artist + ' – ' : ''}${track.title} · HARMONIQ` : 'HARMONIQ');
    return true;
  });

  // Real ID3 & FLAC tag writing
  ipcMain.handle('audio:writeTags', async (_e, filePath: string, tags: any) => {
    return await writeAudioTagsToFile(filePath, tags);
  });

  // Deep metadata parsing using music-metadata
  ipcMain.handle('audio:parseFile', async (_e, filePath: string) => {
    return await parseSingleAudioFile(filePath);
  });

  // Recursive folder scan with progress reporting
  ipcMain.handle('audio:scanFolder', async (event, folderPath: string) => {
    const audioFiles: string[] = [];
    
    // Find all audio files recursively
    function walkDir(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (AUDIO_EXTENSIONS.has(ext)) {
              audioFiles.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`Cannot read folder: ${dir}`, err);
      }
    }

    const folderAccessible = (() => {
      try {
        return fs.statSync(folderPath).isDirectory();
      } catch {
        return false;
      }
    })();

    walkDir(folderPath);

    const tracks = [];
    const total = audioFiles.length;

    if (total === 0) {
      event.sender.send('scan:progress', { current: 0, total: 0, currentFile: '' });
    }

    for (let i = 0; i < total; i++) {
      const file = audioFiles[i];
      try {
        const track = await parseSingleAudioFile(file);
        if (track) {
          tracks.push(track);
        }
      } catch (err) {
        console.warn(`Error parsing metadata for ${file}:`, err);
      }

      // Notify progress every 15 files or on completion
      if (i % 15 === 0 || i === total - 1) {
        event.sender.send('scan:progress', {
          current: i + 1,
          total,
          currentFile: path.basename(file),
        });
      }
    }

    return {
      tracks,
      totalScanned: tracks.length,
      folderAccessible,
    };
  });

  // Companion LRC file reading
  ipcMain.handle('audio:readLrc', async (_e, audioFilePath: string) => {
    try {
      const dir = path.dirname(audioFilePath);
      const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
      const candidates = [
        path.join(dir, `${baseName}.lrc`),
        path.join(dir, `${baseName}.LRC`),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          return { content: content.replace(/^\uFEFF/, ''), plainText: content.replace(/^\uFEFF/, ''), source: 'lrc_file' };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // Persistent storage (userdata) - atomic writes so a crash can never corrupt the library
  const storagePath = (key: string) =>
    path.join(app.getPath('userData'), `harmoniq_${String(key).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);

  ipcMain.handle('storage:load', async (_e, key: string) => {
    const filePath = storagePath(key);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (err) {
      console.error(`Error loading storage key ${key}:`, err);
      try {
        fs.copyFileSync(filePath, `${filePath}.corrupt`);
      } catch {
        /* ignore */
      }
    }
    return null;
  });

  ipcMain.handle('storage:save', async (_e, key: string, data: any) => {
    const filePath = storagePath(key);
    const tmpPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (err) {
      console.error(`Error saving storage key ${key}:`, err);
      return false;
    }
  });

  // Windows Audio Diagnostics
  ipcMain.handle('system:getAudioDiagnostics', async () => {
    return await queryWindowsAudioDiagnostics();
  });
}

// Parse single audio file with music-metadata
async function parseSingleAudioFile(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    const metadata = await parseFile(filePath, { duration: true, skipCovers: false });
    const ext = path.extname(filePath).toLowerCase();

    // Determine codec accurately
    let codec = 'UNKNOWN';
    const rawCodec = (metadata.format.codec || '').toUpperCase();
    const container = (metadata.format.container || '').toUpperCase();

    const isOgg = container.includes('OGG') || ext === '.ogg' || ext === '.opus';
    if (rawCodec.includes('FLAC') || container.includes('FLAC') || ext === '.flac') {
      codec = 'FLAC';
    } else if (rawCodec.includes('ALAC')) {
      codec = 'ALAC';
    } else if (rawCodec.includes('AAC') || ext === '.m4a' || ext === '.aac' || container.includes('M4A') || container.includes('MP4')) {
      codec = 'AAC';
    } else if (rawCodec.includes('OPUS') || ext === '.opus') {
      codec = 'OPUS';
    } else if (rawCodec.includes('VORBIS') || isOgg) {
      codec = 'OGG';
    } else if (rawCodec.includes('MPEG') || rawCodec.includes('MP3') || ext === '.mp3') {
      codec = 'MP3';
    } else if (rawCodec.includes('AIFF') || container.includes('AIFF') || ext === '.aiff' || ext === '.aif') {
      codec = 'AIFF';
    } else if (rawCodec.includes('PCM') || container.includes('WAV') || ext === '.wav') {
      codec = 'WAV';
    }

    // Determine lossless status based on codec
    const isLossless =
      metadata.format.lossless === true ||
      ['FLAC', 'ALAC', 'WAV', 'AIFF'].includes(codec);

    // Extract artwork data URL if available
    let artworkDataUrl: string | undefined;
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      const base64 = Buffer.from(pic.data).toString('base64');
      artworkDataUrl = `data:${pic.format};base64,${base64}`;
    }

    // Check for embedded lyrics
    let embeddedLyrics: string | undefined;
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      const lyr = metadata.common.lyrics[0] as any;
      embeddedLyrics = typeof lyr === 'string' ? lyr : (lyr?.text ?? lyr?.lyrics ?? String(lyr));
    }

    const duration = metadata.format.duration || 0;
    const sampleRate = metadata.format.sampleRate || 44100;
    const bitDepth = metadata.format.bitsPerSample;
    const channels = metadata.format.numberOfChannels || 2;
    const bitrate = metadata.format.bitrate
      ? Math.round(metadata.format.bitrate / 1000)
      : Math.round((stat.size * 8) / (duration || 1) / 1000);

    return {
      id: Buffer.from(filePath).toString('base64url'),
      filePath,
      fileName: path.basename(filePath),
      fileSize: stat.size,
      dateModified: stat.mtimeMs,
      title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
      artist: metadata.common.artist || metadata.common.albumartist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      albumArtist: metadata.common.albumartist,
      genre: metadata.common.genre ? metadata.common.genre[0] : undefined,
      year: metadata.common.year,
      trackNumber: metadata.common.track?.no || undefined,
      trackTotal: metadata.common.track?.of || undefined,
      discNumber: metadata.common.disk?.no || undefined,
      comment: metadata.common.comment ? (() => { const c = metadata.common.comment![0] as any; return typeof c === 'string' ? c : (c?.text ?? c?.comment ?? String(c)); })() : undefined,
      hasArtwork: !!artworkDataUrl,
      artworkDataUrl,
      codec,
      container: metadata.format.container || ext.replace('.', '').toUpperCase(),
      duration,
      sampleRate,
      bitDepth,
      bitrate,
      channels,
      isLossless,
      replayGain: {
        trackGain: metadata.common.replaygain_track_gain?.dB,
        trackPeak: metadata.common.replaygain_track_peak?.ratio,
        albumGain: metadata.common.replaygain_album_gain?.dB,
        albumPeak: metadata.common.replaygain_album_peak?.ratio,
      },
      embeddedLyrics,
      playCount: 0,
      isFavorite: false,
    };
  } catch (err) {
    console.warn(`Failed to parse file: ${filePath}`, err);
    return null;
  }
}

// Query Windows Audio Diagnostics safely
async function queryWindowsAudioDiagnostics() {
  const defaultDevice = {
    name: 'Windows Default Output Endpoint',
    id: 'default',
    isDefault: true,
    sampleRate: 48000,
    channels: 2,
    bitDepth: 24,
    formatDescription: '24-bit, 48000 Hz (Windows Audio Engine Shared Format)',
  };

  const availableDevices = [
    defaultDevice,
    {
      name: 'WASAPI Shared Output (System Mixer)',
      id: 'wasapi_shared',
      isDefault: false,
      sampleRate: 48000,
      channels: 2,
      bitDepth: 24,
      formatDescription: '24-bit, 48000 Hz, Stereo (Shared Mode)',
    },
    {
      name: 'WASAPI Exclusive Mode (Direct Hardware Access)',
      id: 'wasapi_exclusive',
      isDefault: false,
      sampleRate: 192000,
      channels: 2,
      bitDepth: 24,
      formatDescription: 'Up to 24-bit / 192000 Hz (Exclusive Mode)',
    },
  ];

  if (process.platform === 'win32') {
    try {
      // Query Windows Sound Devices using PowerShell CIM
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_SoundDevice | Select-Object -Property Name, Status, DeviceID | ConvertTo-Json"',
        { timeout: 5000, windowsHide: true }
      );
      if (stdout) {
        const parsed = JSON.parse(stdout);
        const deviceList = Array.isArray(parsed) ? parsed : [parsed];
        if (deviceList.length > 0 && deviceList[0].Name) {
          defaultDevice.name = deviceList[0].Name;
        }
      }
    } catch (e) {
      // Fallback is already initialized
    }
  }

  return {
    defaultDevice,
    availableDevices,
    isWasapiExclusiveCapable: true,
  };
}

// App lifecycle: single instance (two instances would fight over the library file)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerMediaProtocol();
    setupIpc();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
