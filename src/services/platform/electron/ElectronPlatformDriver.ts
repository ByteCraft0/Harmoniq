import { IPlatformDriver } from '../IPlatformDriver';
import { PlatformType, PlatformCapabilities } from '../types';
import { ElectronAudioDriver } from './ElectronAudioDriver';
import { ElectronLibraryDriver } from './ElectronLibraryDriver';
import { ElectronStorageDriver } from './ElectronStorageDriver';

export class ElectronPlatformDriver implements IPlatformDriver {
  public readonly platform: PlatformType = 'electron';
  public readonly isAndroid: boolean = false;
  public readonly isElectron: boolean = true;
  public readonly isWeb: boolean = false;

  public readonly capabilities: PlatformCapabilities = {
    hasLocalFileSystem: true,
    hasFolderPicker: true,
    hasFilePicker: true,
    hasMediaStore: false,
    hasNativeAudioService: false,
    hasHardwareEqualizer: false,
    hasSoftwareDsp: true,
    hasSystemMediaTransport: true,
    hasGlobalShortcuts: true,
    hasTrayIntegration: true,
    hasWindowManagement: true,
  };

  public readonly audio: ElectronAudioDriver;
  public readonly library: ElectronLibraryDriver;
  public readonly storage: ElectronStorageDriver;

  constructor() {
    this.audio = new ElectronAudioDriver();
    this.library = new ElectronLibraryDriver();
    this.storage = new ElectronStorageDriver();
  }

  public async initialize(): Promise<void> {
    // Initialized synchronously in constructor
  }

  public async dispose(): Promise<void> {
    this.audio.dispose();
  }
}
