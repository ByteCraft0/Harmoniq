import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPlatform,
  getPlatformDriver,
  setPlatformDriverForTesting,
  getGlobalContext,
} from '../services/platform';
import { ElectronPlatformDriver } from '../services/platform/electron/ElectronPlatformDriver';
import { AndroidPlatformDriver } from '../services/platform/android/AndroidPlatformDriver';
import { AndroidLibraryDriver } from '../services/platform/android/AndroidLibraryDriver';
import { AndroidAudioDriver } from '../services/platform/android/AndroidAudioDriver';
import { TrackMetadata } from '../types/audio';

describe('Harmoniq Platform Abstraction Layer', () => {
  const ctx = getGlobalContext();
  const originalHarmoniqApi = ctx.harmoniqApi;
  const originalCapacitor = ctx.Capacitor;

  beforeEach(() => {
    setPlatformDriverForTesting(null);
  });

  afterEach(() => {
    ctx.harmoniqApi = originalHarmoniqApi;
    ctx.Capacitor = originalCapacitor;
    setPlatformDriverForTesting(null);
  });

  it('detects Electron environment when harmoniqApi is present', () => {
    ctx.harmoniqApi = {
      windowMinimize: vi.fn(),
    };
    ctx.Capacitor = undefined;

    expect(detectPlatform()).toBe('electron');
    const driver = getPlatformDriver();
    expect(driver.platform).toBe('electron');
    expect(driver.isElectron).toBe(true);
    expect(driver.isAndroid).toBe(false);
    expect(driver.isWeb).toBe(false);
    expect(driver.capabilities.hasLocalFileSystem).toBe(true);
    expect(driver.capabilities.hasSystemMediaTransport).toBe(true);
    expect(driver.capabilities.hasMediaStore).toBe(false);
  });

  it('detects Android environment when Capacitor.isNativePlatform() is true', () => {
    ctx.harmoniqApi = undefined;
    ctx.Capacitor = {
      isNativePlatform: () => true,
    };

    expect(detectPlatform()).toBe('android');
    const driver = getPlatformDriver();
    expect(driver.platform).toBe('android');
    expect(driver.isAndroid).toBe(true);
    expect(driver.isElectron).toBe(false);
    expect(driver.isWeb).toBe(false);
    expect(driver.capabilities.hasMediaStore).toBe(true);
    expect(driver.capabilities.hasNativeAudioService).toBe(true);
    expect(driver.capabilities.hasLocalFileSystem).toBe(false);
  });

  it('falls back to web platform when neither native bridge is present', () => {
    ctx.harmoniqApi = undefined;
    ctx.Capacitor = undefined;

    expect(detectPlatform()).toBe('web');
    const driver = getPlatformDriver();
    expect(driver.platform).toBe('web');
    expect(driver.isWeb).toBe(true);
    expect(driver.isAndroid).toBe(false);
    expect(driver.isElectron).toBe(false);
    expect(driver.capabilities.hasMediaStore).toBe(false);
    expect(driver.capabilities.hasLocalFileSystem).toBe(false);
  });

  it('ElectronStorageDriver persists and retrieves data with fallback', async () => {
    const driver = new ElectronPlatformDriver();

    await driver.storage.set('test_key_str', { value: 42 });
    const result = await driver.storage.get<{ value: number }>('test_key_str');
    expect(result).toEqual({ value: 42 });

    const nonExistent = await driver.storage.get('unknown_key', 'default_val');
    expect(nonExistent).toBe('default_val');

    await driver.storage.remove('test_key_str');
    const removedResult = await driver.storage.get('test_key_str');
    expect(removedResult).toBeNull();
  });

  it('ElectronAudioDriver manages track queue and state subscriptions', async () => {
    const driver = new ElectronPlatformDriver();

    const mockTrack: TrackMetadata = {
      id: 'mock_1',
      filePath: 'C:/Music/test.flac',
      fileName: 'test.flac',
      fileSize: 1024,
      dateModified: 1000,
      title: 'Platform Test Track',
      artist: 'Harmoniq Audio',
      album: 'Test Suite',
      codec: 'FLAC',
      container: 'FLAC',
      duration: 180,
      sampleRate: 44100,
      bitrate: 1000,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
      playCount: 0,
      isFavorite: false,
    };

    let latestState = driver.audio.getState();
    const unsub = driver.audio.onPlaybackStateChange((state) => {
      latestState = state;
    });

    expect(latestState.isPlaying).toBe(false);

    await driver.audio.setQueue([mockTrack]);
    await driver.audio.addToQueue({ ...mockTrack, id: 'mock_2' });
    await driver.audio.removeFromQueue(1);

    await driver.audio.setVolume(0.75);
    expect(driver.audio.getState().volume).toBe(0.75);

    unsub();
    await driver.dispose();
  });

  it('AndroidPlatformDriver initializes with expected Android capabilities', () => {
    const driver = new AndroidPlatformDriver();
    expect(driver.platform).toBe('android');
    expect(driver.capabilities.hasMediaStore).toBe(true);
    expect(driver.capabilities.hasNativeAudioService).toBe(true);
    expect(driver.capabilities.hasSoftwareDsp).toBe(true);
  });

  it('AndroidLibraryDriver bridges MediaStore, SAF folder scanning, and permissions', async () => {
    const mockTracks = [
      {
        id: 'android_ms_101',
        filePath: 'content://media/external/audio/media/101',
        fileName: 'track101.mp3',
        fileSize: 5000000,
        dateModified: 1700000000000,
        title: 'MediaStore Song',
        artist: 'Android Artist',
        album: 'Mobile Album',
        codec: 'MP3',
        container: 'mp3',
        duration: 210,
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        isLossless: false,
        hasArtwork: true,
        artworkDataUrl: 'content://media/external/audio/albumart/12',
        playCount: 0,
        isFavorite: false,
      },
    ];

    ctx.Capacitor = {
      Plugins: {
        HarmoniqMediaScanner: {
          checkAudioPermission: vi.fn().mockResolvedValue({ granted: true, permissionRequired: 'READ_MEDIA_AUDIO' }),
          requestAudioPermission: vi.fn().mockResolvedValue({ granted: true }),
          scanMediaStore: vi.fn().mockResolvedValue({ status: 'success', tracks: mockTracks, totalScanned: 1 }),
          openFolderPicker: vi.fn().mockResolvedValue({ uri: 'content://tree/primary%3AMusic', name: 'Music' }),
          scanFolder: vi.fn().mockResolvedValue({ status: 'success', tracks: mockTracks, totalScanned: 1, folderAccessible: true }),
          removeFolder: vi.fn().mockResolvedValue({ success: true }),
          getPersistedFolders: vi.fn().mockResolvedValue({ folders: [{ uri: 'content://tree/primary%3AMusic', name: 'Music' }] }),
          readCompanionLrc: vi.fn().mockResolvedValue({ content: '[00:01.00] Synced Lyrics' }),
        },
      },
    };

    const libDriver = new AndroidLibraryDriver();

    const perm = await libDriver.checkPermissions();
    expect(perm.granted).toBe(true);

    const reqPerm = await libDriver.requestPermissions();
    expect(reqPerm.granted).toBe(true);

    const scanResult = await libDriver.scanLibrary();
    expect(scanResult.tracks.length).toBe(1);
    expect(scanResult.tracks[0].title).toBe('MediaStore Song');
    expect(scanResult.tracks[0].artworkDataUrl).toBe('content://media/external/audio/albumart/12');

    const folderPicked = await libDriver.pickFolder();
    expect(folderPicked).toEqual(['content://tree/primary%3AMusic']);

    const folderScan = await libDriver.scanFolder('content://tree/primary%3AMusic');
    expect(folderScan.tracks.length).toBe(1);

    const removed = await libDriver.removeFolder('content://tree/primary%3AMusic');
    expect(removed).toBe(true);

    const persisted = await libDriver.getPersistedFolders();
    expect(persisted.length).toBe(1);
    expect(persisted[0].name).toBe('Music');

    const lrc = await libDriver.readCompanionLrc('content://media/external/audio/media/101');
    expect(lrc).toBe('[00:01.00] Synced Lyrics');
  });

  it('AndroidAudioDriver controls native ExoPlayer and reacts to state events', async () => {
    let stateListener: any = null;
    let trackEndedListener: any = null;

    ctx.Capacitor = {
      Plugins: {
        HarmoniqAudioPlayer: {
          play: vi.fn().mockResolvedValue({ status: 'playing' }),
          pause: vi.fn().mockResolvedValue({ status: 'paused' }),
          resume: vi.fn().mockResolvedValue({ status: 'resumed' }),
          seekTo: vi.fn().mockResolvedValue({ position: 30 }),
          setVolume: vi.fn().mockResolvedValue({ volume: 0.8 }),
          addListener: vi.fn().mockImplementation((event: string, callback: any) => {
            if (event === 'playbackStateChange') stateListener = callback;
            if (event === 'trackEnded') trackEndedListener = callback;
          }),
        },
      },
    };

    const audioDriver = new AndroidAudioDriver();

    const mockTrack: TrackMetadata = {
      id: 'android_ms_101',
      filePath: 'content://media/external/audio/media/101',
      fileName: 'track101.mp3',
      fileSize: 5000000,
      dateModified: 1700000000000,
      title: 'MediaStore Song',
      artist: 'Android Artist',
      album: 'Mobile Album',
      codec: 'MP3',
      container: 'mp3',
      duration: 210,
      sampleRate: 44100,
      bitrate: 320,
      channels: 2,
      isLossless: false,
      hasArtwork: false,
      playCount: 0,
      isFavorite: false,
    };

    let trackEndedFired = false;
    audioDriver.onTrackEnded(() => {
      trackEndedFired = true;
    });

    await audioDriver.play(mockTrack);
    expect(ctx.Capacitor.Plugins.HarmoniqAudioPlayer.play).toHaveBeenCalledWith({
      track: mockTrack,
      queue: [],
    });

    await audioDriver.pause();
    expect(ctx.Capacitor.Plugins.HarmoniqAudioPlayer.pause).toHaveBeenCalled();

    await audioDriver.resume();
    expect(ctx.Capacitor.Plugins.HarmoniqAudioPlayer.resume).toHaveBeenCalled();

    await audioDriver.seekTo(30);
    expect(ctx.Capacitor.Plugins.HarmoniqAudioPlayer.seekTo).toHaveBeenCalledWith({ position: 30 });

    await audioDriver.setVolume(0.8);
    expect(ctx.Capacitor.Plugins.HarmoniqAudioPlayer.setVolume).toHaveBeenCalledWith({ volume: 0.8 });

    // Simulate native player state broadcast
    if (stateListener) {
      stateListener({
        isPlaying: true,
        currentTime: 45.5,
        duration: 210,
        trackId: 'android_ms_101',
        volume: 0.8,
      });
    }

    const state = audioDriver.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.currentTime).toBe(45.5);
    expect(state.duration).toBe(210);

    // Simulate track ended event
    if (trackEndedListener) {
      trackEndedListener({ trackId: 'android_ms_101' });
    }
    expect(trackEndedFired).toBe(true);
  });
});
