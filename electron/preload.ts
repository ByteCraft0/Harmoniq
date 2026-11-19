import { contextBridge, ipcRenderer } from 'electron';

// NOTE: intentionally no import from ../src so tsc emits a flat dist-electron/ layout.
// The matching renderer-side type lives in src/types/electron.ts (HarmoniqApi).
const subscribe = (channel: string, callback: (...args: any[]) => void) => {
  const handler = (_event: unknown, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

const harmoniqApi = {
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  isMiniPlayer: () => ipcRenderer.invoke('window:isMiniPlayer'),
  setMiniPlayer: (enable: boolean) => ipcRenderer.invoke('window:setMiniPlayer', enable),
  toggleMiniPlayer: () => ipcRenderer.invoke('window:toggleMiniPlayer'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
  setWindowOpacity: (opacity: number) => ipcRenderer.invoke('window:setOpacity', opacity),
  setMiniPlayerLayout: (layout: 'compact' | 'expanded') => ipcRenderer.invoke('window:setMiniPlayerLayout', layout),

  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  openLrcFileDialog: () => ipcRenderer.invoke('dialog:openLrcFile'),
  openArtworkDialog: () => ipcRenderer.invoke('dialog:openArtworkImage'),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('system:showItemInFolder', filePath),

  // Metadata parsing & folder scanning
  parseAudioFile: (filePath: string) => ipcRenderer.invoke('audio:parseFile', filePath),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('audio:scanFolder', folderPath),
  readLrcFile: (audioFilePath: string) => ipcRenderer.invoke('audio:readLrc', audioFilePath),

  // Automatic Folder Watcher
  startFolderWatcher: (folders: string[]) => ipcRenderer.invoke('watcher:start', folders),
  stopFolderWatcher: () => ipcRenderer.invoke('watcher:stop'),
  getFolderWatcherStatus: () => ipcRenderer.invoke('watcher:getStatus'),

  // Tag editing
  writeAudioTags: (filePath: string, tags: any) => ipcRenderer.invoke('audio:writeTags', filePath, tags),

  // Storage
  loadPersistentData: (key: string) => ipcRenderer.invoke('storage:load', key),
  savePersistentData: (key: string, data: any) => ipcRenderer.invoke('storage:save', key, data),

  // Windows Audio Diagnostics
  getWindowsAudioDiagnostics: () => ipcRenderer.invoke('system:getAudioDiagnostics'),

  // Taskbar / Media Transport & Tray
  updateSMTC: (track: any) => ipcRenderer.invoke('system:updateSMTC', track),
  setCloseToTray: (enabled: boolean) => ipcRenderer.invoke('tray:setCloseToTray', enabled),
  getCloseToTray: () => ipcRenderer.invoke('tray:getCloseToTray'),

  // Global Keyboard Shortcuts
  getGlobalShortcuts: () => ipcRenderer.invoke('shortcuts:get'),
  updateGlobalShortcuts: (shortcuts: any) => ipcRenderer.invoke('shortcuts:update', shortcuts),
  resetGlobalShortcuts: () => ipcRenderer.invoke('shortcuts:reset'),

  // Online Integrations
  fetchPodcastFeed: (feedUrl: string) => ipcRenderer.invoke('podcast:fetchFeed', feedUrl),
  resolvePodcastUrl: (urlOrQuery: string) => ipcRenderer.invoke('podcast:resolveUrl', urlOrQuery),
  searchOnlineMusic: (query: string, filter?: string) => ipcRenderer.invoke('online:searchMusic', query, filter),
  universalSearch: (request: any) => ipcRenderer.invoke('universal:search', request),
  verifyRadioStream: (streamUrl: string) => ipcRenderer.invoke('radio:verifyStream', streamUrl),

  // Portable Mode
  getPortableStatus: () => ipcRenderer.invoke('portable:getStatus'),
  testDirectoryWritable: (dirPath: string) => ipcRenderer.invoke('portable:testWritable', dirPath),
  setPortableMode: (enabled: boolean, customPath?: string) => ipcRenderer.invoke('portable:setMode', enabled, customPath),
  migratePortableData: (direction: 'toPortable' | 'toStandard', customPath?: string) => ipcRenderer.invoke('portable:migrateData', direction, customPath),

  // Harmoniq Assistant (Phase 7)
  getAssistantConfig: () => ipcRenderer.invoke('assistant:getConfig'),
  saveAssistantConfig: (config: any) => ipcRenderer.invoke('assistant:saveConfig', config),
  testAssistantConnection: (config: any) => ipcRenderer.invoke('assistant:testConnection', config),
  sendAssistantChat: (payload: any) => ipcRenderer.invoke('assistant:sendChat', payload),

  // Events
  onScanProgress: (callback: (progress: any) => void) => subscribe('scan:progress', callback),
  onMediaCommand: (callback: (command: string) => void) => subscribe('media:command', callback),
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => subscribe('window:maximized-changed', callback),
  onMiniPlayerChange: (callback: (isMini: boolean) => void) => subscribe('window:mini-player-changed', callback),
  onWatcherFileAddedOrUpdated: (callback: (track: any) => void) => subscribe('watcher:fileAddedOrUpdated', callback),
  onWatcherFileRemoved: (callback: (filePath: string) => void) => subscribe('watcher:fileRemoved', callback),
  onWatcherSyncStatus: (callback: (status: any) => void) => subscribe('watcher:syncStatus', callback),
};

contextBridge.exposeInMainWorld('harmoniqApi', harmoniqApi);
