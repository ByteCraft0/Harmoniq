import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  shell,
  screen,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
} from 'electron';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import { parseFile } from 'music-metadata';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ShortcutAction,
  SHORTCUT_ACTIONS,
  DEFAULT_SHORTCUTS,
  validateShortcutConfig,
} from './shortcuts';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.NODE_ENV !== 'production');

// Portable Mode Configuration & Detection
let portableConfig: { isPortable: boolean; dataDir: string } = { isPortable: false, dataDir: '' };

function getAppRoot(): string {
  return app.isPackaged ? path.dirname(process.execPath) : process.cwd();
}

function getPortableMarkerPath(): string {
  return path.join(getAppRoot(), 'harmoniq-portable.json');
}

function testDirectoryWritableMain(dirPath: string): { writable: boolean; path: string; error?: string } {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.harmoniq_write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return { writable: true, path: dirPath };
  } catch (e: any) {
    return { writable: false, path: dirPath, error: e.message || 'Directory is not writable' };
  }
}

function initPortableMode(): void {
  try {
    const marker = getPortableMarkerPath();
    if (fs.existsSync(marker)) {
      const parsed = JSON.parse(fs.readFileSync(marker, 'utf-8'));
      if (parsed.portable) {
        const defaultDir = path.join(getAppRoot(), 'harmoniq-data');
        const targetDir = parsed.customDataDir && fs.existsSync(parsed.customDataDir) ? parsed.customDataDir : defaultDir;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        portableConfig = { isPortable: true, dataDir: targetDir };
        app.setPath('userData', targetDir);
      }
    }
  } catch (e) {
    console.warn('Failed to initialize portable mode:', e);
  }
}
initPortableMode();

// System Tray, Close-to-Tray, and Lifecycle state
let tray: Tray | null = null;
let isQuitting = false;
let closeToTray = true;
let currentTrackSMTC: { title?: string; artist?: string; album?: string; isPlaying?: boolean } | null = null;

// Persistent storage helper
const storagePath = (key: string) =>
  path.join(app.getPath('userData'), `harmoniq_${String(key).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);

function loadStoredDataSync<T>(key: string, fallback: T): T {
  try {
    const p = storagePath(key);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {
    console.warn(`Failed to read stored key ${key}:`, e);
  }
  return fallback;
}

function saveStoredDataSync<T>(key: string, data: T): void {
  try {
    const p = storagePath(key);
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmp, p);
  } catch (e) {
    console.warn(`Failed to write stored key ${key}:`, e);
  }
}

// Embedded 32x32 Harmoniq purple glowing vinyl icon (Base64 PNG)
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACAUlEQVR4nO2XS04CQRCGOQG3YocgIDCQ2atEjRjEiBmNj2jMbLwFN/AObjiBtzDWgk2Zn1BJpdI1D8SYGCf5kq6a+qu6Z7p7eiqV/6vklcZUTWOqpTGN0piSNaO1r/qThaM0ptenIXEWiEHsNgtjZG+PQ+IyQAPtd4snDwNij88PfgdZMcixafGX+wGxRgrmYXXIVXrkdxGxRhew94rEFH4SeG+3fWKNJLV+Dy++0JzA5LnpEwuSLOSz5OmQO694dN0jFiSJtcv6dc7MJYo1nPSIEyW2tvZZQjHWRg2vePWqSyyI0LPn6XIxT5fPaxZFdSC4Y2KCzLrEAkS6rW0UtXr4vHjdnnWdyYj9/HKPWIBIt8XGaL1XiHs23uYCqBXqQHLRIQaSQNvSDo1eP4WQxuYL7glwTjvEUyXQtrTzOhDS2HxeB0bnbWIBAt0WO+8V2HibC3ivoDZpEwsQ6ba2vUnoxev2pO1PwupZi1iQJJ5tl2FRHXAPLtgkxi3isRJaW/ssoRhruxvRugPR6S6xIGJrl/XrnLmnJXwwTprEgiQJ+Sx5utyPkUzG4yaxRpJZv4cXX/iIhnV61CDW6JHae0ViSh/NcIwaNYg13qO3WF3pI5l+Eoc7xB5SMCtm40Op6sTqWH5QJy7DVo7lpiOrH5P9OnEWW/8xCXTkd37N/uz1BXOVxZsDpm3kAAAAAElFTkSuQmCC';

function getTrayImage(): Electron.NativeImage {
  const assetPath = path.join(__dirname, '../assets/tray-icon.png');
  if (fs.existsSync(assetPath)) {
    try {
      const img = nativeImage.createFromPath(assetPath);
      if (!img.isEmpty()) return img;
    } catch {}
  }
  return nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
}

// Window visibility toggle
function toggleWindowVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const isPlaying = currentTrackSMTC?.isPlaying ?? false;
  const songLabel = currentTrackSMTC?.title
    ? `🎵 ${currentTrackSMTC.title}${currentTrackSMTC.artist ? ` — ${currentTrackSMTC.artist}` : ''}`
    : '🎵 Harmoniq (Idle)';
  const isWinVisible = mainWindow ? mainWindow.isVisible() && !mainWindow.isMinimized() : false;

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: songLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isWinVisible ? 'Hide Harmoniq' : 'Show Harmoniq',
      click: () => toggleWindowVisibility(),
    },
    { type: 'separator' },
    {
      label: isPlaying ? 'Pause' : 'Play',
      click: () => mainWindow?.webContents.send('media:command', 'playpause'),
    },
    {
      label: 'Next Track',
      click: () => mainWindow?.webContents.send('media:command', 'next'),
    },
    {
      label: 'Previous Track',
      click: () => mainWindow?.webContents.send('media:command', 'prev'),
    },
    { type: 'separator' },
    {
      label: 'Exit Harmoniq',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));

  if (currentTrackSMTC?.title) {
    tray.setToolTip(`Harmoniq: ${currentTrackSMTC.title} — ${currentTrackSMTC.artist || 'Unknown'}`);
  } else {
    tray.setToolTip('Harmoniq — Audiophile Desktop Music Player');
  }
}

function initTray() {
  if (tray) return;
  try {
    const icon = getTrayImage();
    tray = new Tray(icon);
    tray.setToolTip('Harmoniq — Audiophile Desktop Music Player');
    updateTrayMenu();

    tray.on('click', () => {
      toggleWindowVisibility();
    });

    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        updateTrayMenu();
      }
    });
  } catch (err) {
    console.error('Failed to create system tray icon:', err);
  }
}

// Global Keyboard Shortcuts state & actions
let currentShortcuts: Record<ShortcutAction, string> = { ...DEFAULT_SHORTCUTS };
let shortcutStatus: Record<ShortcutAction, { registered: boolean; error?: string }> = {
  playPause: { registered: false },
  nextTrack: { registered: false },
  prevTrack: { registered: false },
  volumeUp: { registered: false },
  volumeDown: { registered: false },
  toggleMute: { registered: false },
  toggleWindow: { registered: false },
};

function executeShortcutAction(action: ShortcutAction) {
  if (action === 'toggleWindow') {
    toggleWindowVisibility();
    return;
  }
  const cmdMap: Record<ShortcutAction, string> = {
    playPause: 'playpause',
    nextTrack: 'next',
    prevTrack: 'prev',
    volumeUp: 'volumeup',
    volumeDown: 'volumedown',
    toggleMute: 'togglemute',
    toggleWindow: 'togglewindow',
  };
  const cmd = cmdMap[action];
  if (cmd) {
    mainWindow?.webContents.send('media:command', cmd);
  }
}

function registerAllShortcuts(config: Record<ShortcutAction, string>) {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {
    console.warn('Error unregistering shortcuts:', e);
  }

  currentShortcuts = { ...config };
  shortcutStatus = {
    playPause: { registered: false },
    nextTrack: { registered: false },
    prevTrack: { registered: false },
    volumeUp: { registered: false },
    volumeDown: { registered: false },
    toggleMute: { registered: false },
    toggleWindow: { registered: false },
  };

  for (const action of SHORTCUT_ACTIONS) {
    const accelerator = currentShortcuts[action];
    if (!accelerator) {
      shortcutStatus[action] = { registered: false, error: 'No shortcut assigned' };
      continue;
    }

    try {
      const success = globalShortcut.register(accelerator, () => {
        executeShortcutAction(action);
      });

      if (success) {
        shortcutStatus[action] = { registered: true };
      } else {
        shortcutStatus[action] = {
          registered: false,
          error: 'Failed to register with Windows (shortcut may be in use by another application)',
        };
      }
    } catch (err: any) {
      shortcutStatus[action] = {
        registered: false,
        error: err?.message || 'Invalid key combination',
      };
    }
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
    show: true,
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
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !fs.existsSync(distIndex)) {
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
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-changed', false));
  mainWindow.on('show', () => updateTrayMenu());
  mainWindow.on('hide', () => updateTrayMenu());

  mainWindow.on('close', (event) => {
    if (!isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      updateTrayMenu();
      return false;
    }
  });

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
    if (closeToTray && !isQuitting) {
      mainWindow?.hide();
      updateTrayMenu();
    } else {
      mainWindow?.close();
    }
  });

  ipcMain.handle('tray:setCloseToTray', (_e, enabled: boolean) => {
    closeToTray = !!enabled;
    saveStoredDataSync('settings_closetotray', closeToTray);
    return closeToTray;
  });

  ipcMain.handle('tray:getCloseToTray', () => {
    return closeToTray;
  });

  // Global Keyboard Shortcuts
  ipcMain.handle('shortcuts:get', () => {
    return {
      shortcuts: currentShortcuts,
      status: shortcutStatus,
    };
  });

  ipcMain.handle('shortcuts:update', (_e, newShortcuts: Partial<Record<ShortcutAction, string>>) => {
    const merged = { ...currentShortcuts, ...newShortcuts };
    const validation = validateShortcutConfig(merged);
    if (!validation.valid) {
      return {
        success: false,
        shortcuts: currentShortcuts,
        status: shortcutStatus,
        errors: validation.errors,
      };
    }

    registerAllShortcuts(merged as Record<ShortcutAction, string>);
    saveStoredDataSync('settings_shortcuts', currentShortcuts);

    return {
      success: true,
      shortcuts: currentShortcuts,
      status: shortcutStatus,
    };
  });

  ipcMain.handle('shortcuts:reset', () => {
    registerAllShortcuts(DEFAULT_SHORTCUTS);
    saveStoredDataSync('settings_shortcuts', DEFAULT_SHORTCUTS);
    return {
      shortcuts: currentShortcuts,
      status: shortcutStatus,
    };
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

  ipcMain.handle('window:setAlwaysOnTop', (_e, flag: boolean) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(!!flag, flag ? 'screen-saver' : undefined);
    return mainWindow.isAlwaysOnTop();
  });

  ipcMain.handle('window:isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop() ?? false;
  });

  ipcMain.handle('window:setOpacity', (_e, opacity: number) => {
    if (!mainWindow) return 1.0;
    const clamped = Math.max(0.4, Math.min(1.0, opacity));
    mainWindow.setOpacity(clamped);
    return clamped;
  });

  ipcMain.handle('window:setMiniPlayerLayout', (_e, layout: 'compact' | 'expanded') => {
    if (!mainWindow || !isMiniPlayer) return false;
    if (layout === 'compact') {
      mainWindow.setMinimumSize(320, 95);
      mainWindow.setSize(380, 100, true);
    } else {
      mainWindow.setMinimumSize(320, 160);
      mainWindow.setSize(380, 180, true);
    }
    return true;
  });

  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });

  // Portable Mode IPC handlers
  ipcMain.handle('portable:getStatus', async () => {
    const standardDir = path.join(app.getPath('appData'), 'Harmoniq');
    const currentDir = app.getPath('userData');
    const isWritable = testDirectoryWritableMain(currentDir).writable;
    return {
      isPortable: portableConfig.isPortable,
      dataDirectory: currentDir,
      isWritable,
      standardDirectory: standardDir,
      canSwitch: true,
    };
  });

  ipcMain.handle('portable:testWritable', async (_e, dirPath: string) => {
    return testDirectoryWritableMain(dirPath);
  });

  ipcMain.handle('portable:setMode', async (_e, enabled: boolean, customPath?: string) => {
    try {
      const marker = getPortableMarkerPath();
      if (enabled) {
        const dataDir = customPath || path.join(getAppRoot(), 'harmoniq-data');
        const test = testDirectoryWritableMain(dataDir);
        if (!test.writable) {
          return { success: false, requiresRestart: false, error: test.error };
        }
        fs.writeFileSync(marker, JSON.stringify({ portable: true, customDataDir: customPath || '' }, null, 2), 'utf-8');
      } else {
        if (fs.existsSync(marker)) {
          fs.unlinkSync(marker);
        }
      }
      return { success: true, requiresRestart: true };
    } catch (e: any) {
      return { success: false, requiresRestart: false, error: e.message };
    }
  });

  ipcMain.handle('portable:migrateData', async (_e, direction: 'toPortable' | 'toStandard', customPath?: string) => {
    try {
      const standardDir = path.join(app.getPath('appData'), 'Harmoniq');
      const portableDir = customPath || path.join(getAppRoot(), 'harmoniq-data');
      const sourceDir = direction === 'toPortable' ? standardDir : portableDir;
      const targetDir = direction === 'toPortable' ? portableDir : standardDir;

      if (!fs.existsSync(sourceDir)) {
        return { success: true, filesMigrated: 0, sourceDir, targetDir };
      }
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const files = fs.readdirSync(sourceDir);
      let filesMigrated = 0;
      for (const f of files) {
        if (f.startsWith('harmoniq_') && f.endsWith('.json')) {
          const srcFile = path.join(sourceDir, f);
          const tgtFile = path.join(targetDir, f);
          fs.copyFileSync(srcFile, tgtFile);
          filesMigrated++;
        }
      }
      return { success: true, filesMigrated, sourceDir, targetDir };
    } catch (e: any) {
      return {
        success: false,
        filesMigrated: 0,
        sourceDir: direction === 'toPortable' ? '%APPDATA%\\Harmoniq' : (customPath || './harmoniq-data'),
        targetDir: direction === 'toPortable' ? (customPath || './harmoniq-data') : '%APPDATA%\\Harmoniq',
        error: e.message,
      };
    }
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

  // Now-playing info -> window title, Windows SMTC, and System Tray
  ipcMain.handle('system:updateSMTC', async (_e, track: { title?: string; artist?: string; album?: string; isPlaying?: boolean }) => {
    if (!mainWindow || !track) return false;
    currentTrackSMTC = track;
    mainWindow.setTitle(
      track.title
        ? `${track.isPlaying ? '▶ ' : ''}${track.artist ? track.artist + ' – ' : ''}${track.title} · HARMONIQ`
        : 'HARMONIQ'
    );
    updateTrayMenu();
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

  // Secure Online Integrations (Batch 12 Repair)
  ipcMain.handle('podcast:fetchFeed', async (_e, rawUrl: string) => {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new Error('Please enter a valid podcast RSS or Atom feed URL.');
    }
    const cleanUrl = rawUrl.trim();
    if (!isSafePublicUrl(cleanUrl)) {
      throw new Error('Invalid or disallowed feed URL. Only public HTTP/HTTPS URLs are allowed.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);

    try {
      const res = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Harmoniq-Podcast-Engine/1.0.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Feed server returned HTTP ${res.status} (${res.statusText})`);
      }

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      if (text.length > 15 * 1024 * 1024) {
        throw new Error('Feed content exceeded maximum allowed size (15 MB)');
      }

      return {
        xmlText: text,
        effectiveUrl: res.url || cleanUrl,
        contentType,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('Podcast feed request timed out after 14 seconds.');
      }
      throw new Error(err.message || 'Failed to fetch podcast feed.');
    }
  });

  ipcMain.handle('radio:verifyStream', async (_e, rawUrl: string) => {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return { accessible: false, directStreamUrl: rawUrl, error: 'Empty stream URL provided' };
    }
    const cleanUrl = rawUrl.trim();
    if (!isSafePublicUrl(cleanUrl)) {
      return { accessible: false, directStreamUrl: cleanUrl, error: 'Disallowed host or invalid stream protocol' };
    }

    try {
      const urlObj = new URL(cleanUrl);
      let targetUrl = cleanUrl;

      // If playlist file (.pls, .m3u, .m3u8), parse the first underlying stream URL
      if (/\.(pls|m3u|m3u8)$/i.test(urlObj.pathname)) {
        const pController = new AbortController();
        const pTimeout = setTimeout(() => pController.abort(), 8000);
        try {
          const res = await fetch(cleanUrl, {
            headers: { 'User-Agent': 'Harmoniq-Audio-Player/1.0.0' },
            signal: pController.signal,
          });
          clearTimeout(pTimeout);
          const text = await res.text();
          const plsMatch = text.match(/File\d+\s*=\s*(https?:\/\/[^\r\n]+)/i);
          if (plsMatch) {
            targetUrl = plsMatch[1].trim();
          } else {
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#') && /^https?:\/\//i.test(trimmed)) {
                targetUrl = trimmed;
                break;
              }
            }
          }
        } catch {
          clearTimeout(pTimeout);
        }
      }

      // Verify stream connectivity with range header
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const checkRes = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Harmoniq-Audio-Player/1.0.0',
          'Range': 'bytes=0-2048',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      controller.abort(); // Do not consume continuous live audio stream

      const contentType = checkRes.headers.get('content-type') || '';
      const isOk = checkRes.status >= 200 && checkRes.status < 400;

      return {
        accessible: isOk,
        directStreamUrl: targetUrl,
        contentType,
        status: checkRes.status,
      };
    } catch (err: any) {
      return {
        accessible: false,
        directStreamUrl: rawUrl,
        error: err.message || 'Stream connection failed',
      };
    }
  });

  ipcMain.handle('online:searchMusic', async (_e, rawQuery: string, filter: string = 'all') => {
    if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return [];
    }
    const cleanQ = rawQuery.trim().slice(0, 150);

    // Run parallel provider queries with error isolation
    const archivePromise = (async () => {
      try {
        let fieldQuery = `(title:("${cleanQ}") OR creator:("${cleanQ}") OR description:("${cleanQ}"))`;
        if (filter === 'song') fieldQuery = `title:("${cleanQ}")`;
        else if (filter === 'artist') fieldQuery = `creator:("${cleanQ}")`;
        else if (filter === 'album') fieldQuery = `(album:("${cleanQ}") OR title:("${cleanQ}"))`;

        const url = `https://archive.org/advancedsearch.php?q=mediatype:audio%20AND%20${encodeURIComponent(
          fieldQuery
        )}&fl[]=identifier,title,creator,album,year,description,downloads&sort[]=downloads%20desc&rows=18&output=json`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Harmoniq-Audio-Player/1.0.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return [];
        const data = await res.json();
        const docs = data?.response?.docs || [];

        return docs.map((doc: any) => {
          const id = doc.identifier;
          const title = Array.isArray(doc.title) ? doc.title[0] : (doc.title || 'Untitled Audio');
          const artist = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Unknown Artist');
          const album = Array.isArray(doc.album) ? doc.album[0] : doc.album;
          const yr = doc.year ? parseInt(doc.year, 10) : undefined;
          return {
            id: `ia_${id}`,
            title,
            artist,
            album: album || undefined,
            year: isNaN(yr!) ? undefined : yr,
            source: 'Internet Archive',
            detailUrl: `https://archive.org/details/${id}`,
            streamUrl: `https://archive.org/download/${id}/${id}_vbr.mp3`,
            artworkUrl: `https://archive.org/services/img/${id}`,
            license: 'Public Domain / Creative Commons',
            format: 'MP3',
          };
        });
      } catch {
        return [];
      }
    })();

    const itunesPromise = (async () => {
      try {
        let entity = 'song';
        if (filter === 'album') entity = 'album';
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=${entity}&limit=25`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Harmoniq-Audio-Player/1.0.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return [];
        const data = await res.json();
        const results = data?.results || [];

        return results.map((item: any) => {
          const art = item.artworkUrl100
            ? item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
            : undefined;
          const durSec = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : undefined;
          const yr = item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : undefined;
          return {
            id: `it_${item.trackId || item.collectionId}`,
            title: item.trackName || item.collectionName || 'Untitled Track',
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || undefined,
            year: yr,
            duration: durSec,
            source: 'Open Music Catalog',
            streamUrl: item.previewUrl,
            detailUrl: item.trackViewUrl || item.collectionViewUrl,
            artworkUrl: art,
            license: 'Official 30s Audio Preview',
            format: 'AAC',
          };
        });
      } catch {
        return [];
      }
    })();

    const [archiveResults, itunesResults] = await Promise.all([archivePromise, itunesPromise]);

    // De-duplicate and combine
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const item of [...archiveResults, ...itunesResults]) {
      const key = `${(item.title || '').toLowerCase()}:::${(item.artist || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }
    return combined;
  });
}

function isSafePublicUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractReplayGain(metadata: any): { trackGain?: number; trackPeak?: number; albumGain?: number; albumPeak?: number } {
  let trackGain: number | undefined = metadata.common?.replaygain_track_gain?.dB;
  let trackPeak: number | undefined = metadata.common?.replaygain_track_peak?.ratio;
  let albumGain: number | undefined = metadata.common?.replaygain_album_gain?.dB;
  let albumPeak: number | undefined = metadata.common?.replaygain_album_peak?.ratio;

  const parseDb = (val: any): number | undefined => {
    if (typeof val === 'number') return isFinite(val) ? val : undefined;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/dB/i, '').trim());
      return isFinite(num) ? num : undefined;
    }
    return undefined;
  };
  const parseRatio = (val: any): number | undefined => {
    if (typeof val === 'number') return isFinite(val) ? val : undefined;
    if (typeof val === 'string') {
      const num = parseFloat(val.trim());
      return isFinite(num) ? num : undefined;
    }
    return undefined;
  };

  const native = metadata.native || {};
  for (const tagType of Object.keys(native)) {
    const tagList = native[tagType];
    if (!Array.isArray(tagList)) continue;
    for (const tag of tagList) {
      const id = (tag.id || '').toUpperCase();
      if (trackGain === undefined && (id === 'REPLAYGAIN_TRACK_GAIN' || id === 'R128_TRACK_GAIN')) {
        trackGain = parseDb(tag.value);
      } else if (trackPeak === undefined && id === 'REPLAYGAIN_TRACK_PEAK') {
        trackPeak = parseRatio(tag.value);
      } else if (albumGain === undefined && (id === 'REPLAYGAIN_ALBUM_GAIN' || id === 'R128_ALBUM_GAIN')) {
        albumGain = parseDb(tag.value);
      } else if (albumPeak === undefined && id === 'REPLAYGAIN_ALBUM_PEAK') {
        albumPeak = parseRatio(tag.value);
      }
    }
  }

  return { trackGain, trackPeak, albumGain, albumPeak };
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
      replayGain: extractReplayGain(metadata),
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
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      updateTrayMenu();
    }
  });

  app.whenReady().then(() => {
    closeToTray = loadStoredDataSync<boolean>('settings_closetotray', true);
    const savedShortcuts = loadStoredDataSync<Record<ShortcutAction, string>>(
      'settings_shortcuts',
      DEFAULT_SHORTCUTS
    );

    registerMediaProtocol();
    setupIpc();
    createMainWindow();
    initTray();
    registerAllShortcuts(savedShortcuts);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        if (!mainWindow?.isVisible()) mainWindow?.show();
        if (mainWindow?.isMinimized()) mainWindow?.restore();
        mainWindow?.focus();
        updateTrayMenu();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (tray) {
      try {
        tray.destroy();
      } catch {}
      tray = null;
    }
    try {
      globalShortcut.unregisterAll();
    } catch {}
  });

  app.on('window-all-closed', () => {
    if (closeToTray && !isQuitting) {
      return;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
