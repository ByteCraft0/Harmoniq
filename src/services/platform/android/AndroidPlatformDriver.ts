import { IPlatformDriver } from '../IPlatformDriver';
import { PlatformType, PlatformCapabilities } from '../types';
import { AndroidAudioDriver } from './AndroidAudioDriver';
import { AndroidLibraryDriver } from './AndroidLibraryDriver';
import { AndroidStorageDriver } from './AndroidStorageDriver';

export class AndroidPlatformDriver implements IPlatformDriver {
  public readonly platform: PlatformType = 'android';
  public readonly isAndroid: boolean = true;
  public readonly isElectron: boolean = false;
  public readonly isWeb: boolean = false;

  public readonly capabilities: PlatformCapabilities = {
    hasLocalFileSystem: false,
    hasFolderPicker: true,
    hasFilePicker: false,
    hasMediaStore: true,
    hasNativeAudioService: true,
    hasHardwareEqualizer: false,
    hasSoftwareDsp: true,
    hasSystemMediaTransport: true,
    hasGlobalShortcuts: false,
    hasTrayIntegration: false,
    hasWindowManagement: false,
  };

  public readonly audio: AndroidAudioDriver;
  public readonly library: AndroidLibraryDriver;
  public readonly storage: AndroidStorageDriver;

  constructor() {
    this.audio = new AndroidAudioDriver();
    this.library = new AndroidLibraryDriver();
    this.storage = new AndroidStorageDriver();
  }

  public async initialize(): Promise<void> {}

  public async dispose(): Promise<void> {}
}
