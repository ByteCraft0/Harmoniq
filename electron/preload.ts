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

  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('system:showItemInFolder', filePath),

  // Metadata parsing
  parseAudioFile: (filePath: string) => ipcRenderer.invoke('audio:parseFile', filePath),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('audio:scanFolder', folderPath),
  readLrcFile: (audioFilePath: string) => ipcRenderer.invoke('audio:readLrc', audioFilePath),

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
};

contextBridge.exposeInMainWorld('harmoniqApi', harmoniqApi);
