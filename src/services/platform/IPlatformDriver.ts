import { PlatformType, PlatformCapabilities } from './types';
import { IAudioDriver } from './IAudioDriver';
import { ILibraryDriver } from './ILibraryDriver';
import { IStorageDriver } from './IStorageDriver';

export interface IPlatformDriver {
  readonly platform: PlatformType;
  readonly isAndroid: boolean;
  readonly isElectron: boolean;
  readonly isWeb: boolean;
  readonly capabilities: PlatformCapabilities;
  readonly audio: IAudioDriver;
  readonly library: ILibraryDriver;
  readonly storage: IStorageDriver;

  initialize(): Promise<void>;
  dispose?(): Promise<void>;
}
