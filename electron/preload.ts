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
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  isMiniPlayer: () => ipcRenderer.invoke('window:isMiniPlayer'),
  setMiniPlayer: (enable: boolean) => ipcRenderer.invoke('window:setMiniPlayer', enable),
  toggleMiniPlayer: () => ipcRenderer.invoke('window:toggleMiniPlayer'),

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

  // Taskbar / Media Transport
  updateSMTC: (track: any) => ipcRenderer.invoke('system:updateSMTC', track),

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
