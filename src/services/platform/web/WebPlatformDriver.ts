import { IPlatformDriver } from '../IPlatformDriver';
import { PlatformType, PlatformCapabilities } from '../types';
import { WebAudioDriver } from './WebAudioDriver';
import { WebLibraryDriver } from './WebLibraryDriver';
import { WebStorageDriver } from './WebStorageDriver';

export class WebPlatformDriver implements IPlatformDriver {
  public readonly platform: PlatformType = 'web';
  public readonly isAndroid: boolean = false;
  public readonly isElectron: boolean = false;
  public readonly isWeb: boolean = true;

  public readonly capabilities: PlatformCapabilities = {
    hasLocalFileSystem: false,
    hasFolderPicker: false,
    hasFilePicker: false,
    hasMediaStore: false,
    hasNativeAudioService: false,
    hasHardwareEqualizer: false,
    hasSoftwareDsp: true,
    hasSystemMediaTransport: false,
    hasGlobalShortcuts: false,
    hasTrayIntegration: false,
    hasWindowManagement: false,
  };

  public readonly audio: WebAudioDriver;
  public readonly library: WebLibraryDriver;
  public readonly storage: WebStorageDriver;

  constructor() {
    this.audio = new WebAudioDriver();
    this.library = new WebLibraryDriver();
    this.storage = new WebStorageDriver();
  }

  public async initialize(): Promise<void> {}

  public async dispose(): Promise<void> {
    this.audio.dispose();
  }
}
