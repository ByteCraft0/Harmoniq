import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AudioQualityService } from '../services/audio/audioQualityService';
import { AudioQualityInspectorService } from '../services/inspectorService';
import { DEFAULT_PARAMETRIC_FILTERS, EQ_FREQUENCIES } from '../types/dsp';
import { TrackMetadata } from '../types/audio';

describe('Phase 6.6 Final Release Certification Test Matrix', () => {
  const rootDir = path.resolve(__dirname, '../../');

  describe('1. Version Consistency & Release Identity', () => {
    it('verifies package.json version target is exactly 2.0.1', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.name).toBe('harmoniq');
      expect(pkg.version).toBe('2.0.1');
      expect(pkg.build.productName).toBe('Harmoniq');
      expect(pkg.build.appId).toBe('com.harmoniq.player');
    });

    it('verifies Windows file associations cover all primary lossless and lossy formats', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const exts = pkg.build.fileAssociations.map((fa: any) => fa.ext);
      expect(exts).toContain('flac');
      expect(exts).toContain('mp3');
      expect(exts).toContain('wav');
      expect(exts).toContain('m4a');
      expect(exts).toContain('alac');
      expect(exts).toContain('ogg');
    });
  });

  describe('2. Electron Hardening & Security Audit', () => {
    const mainTsPath = path.join(rootDir, 'electron/main.ts');
    const mainTsContent = fs.readFileSync(mainTsPath, 'utf8');

    it('enforces webPreferences security flags (contextIsolation, no nodeIntegration, sandbox, webSecurity)', () => {
      expect(mainTsContent).toContain('contextIsolation: true');
      expect(mainTsContent).toContain('nodeIntegration: false');
      expect(mainTsContent).toContain('sandbox: true');
      expect(mainTsContent).toContain('webSecurity: true');
    });

    it('enforces navigation and external link security restrictions', () => {
      expect(mainTsContent).toContain('setWindowOpenHandler');
      expect(mainTsContent).toContain("action: 'deny'");
      expect(mainTsContent).toContain("mainWindow.webContents.on('will-navigate'");
      expect(mainTsContent).toContain('event.preventDefault()');
    });

    it('verifies safeStorage DPAPI hardware-backed encryption with graceful fallback', () => {
      expect(mainTsContent).toContain('safeStorage.isEncryptionAvailable()');
      expect(mainTsContent).toContain('safeStorage.encryptString');
      expect(mainTsContent).toContain('safeStorage.decryptString');
    });

    it('verifies single-instance lock and protocol handling for external audio files', () => {
      expect(mainTsContent).toContain('requestSingleInstanceLock');
      expect(mainTsContent).toContain('extractAudioFileFromArgv');
    });
  });

  describe('3. Audio Integrity & Truthful Capabilities', () => {
    it('verifies 10-band ISO graphic frequencies and parametric filter defaults', () => {
      expect(EQ_FREQUENCIES).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
      expect(DEFAULT_PARAMETRIC_FILTERS).toHaveLength(5);
      expect(DEFAULT_PARAMETRIC_FILTERS[0].frequency).toBe(80);
      expect(DEFAULT_PARAMETRIC_FILTERS[4].frequency).toBe(12000);
    });

    it('certifies truthful audio path diagnostics: Windows Shared Mode reporting', () => {
      const mockTrack: TrackMetadata = {
        id: 'cert_1',
        title: 'Master Track',
        artist: 'Master Artist',
        album: 'Master Album',
        duration: 200,
        bitrate: 1411,
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        codec: 'FLAC',
        container: 'flac',
        isLossless: true,
        filePath: 'C:\\Music\\master.flac',
        fileName: 'master.flac',
        fileSize: 40000000,
        dateModified: Date.now(),
        hasArtwork: false,
        playCount: 0,
        isFavorite: false,
      };

      const mockCtx = { sampleRate: 48000 } as unknown as AudioContext;
      const report = AudioQualityService.generateReport(
        mockTrack,
        mockCtx,
        {
          enabled: false,
          eqMode: 'graphic',
          bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          parametricFilters: [],
          preamp: 0,
          bassBoost: 0,
          treble: 0,
          balance: 0,
          monoMix: false,
          channelMode: 'stereo',
          limiterEnabled: true,
          activePresetId: null,
        },
        { gainReductionDb: 0, peakLevel: -10, isClippingPrevented: false },
        1.0,
        false
      );

      expect(report).not.toBeNull();
      expect(report?.output.driverMode).toContain('Windows Shared Mode');
      expect(report?.bitPerfect.isBitPerfect).toBe(false); // Truthful: Web Audio on Windows Shared Mode
      expect(report?.bitPerfect.status).toBe('shared_mode');
      expect(report?.source.qualityTier).toBe('Hi-Res Lossless');
    });

    it('certifies quality tier distinction across lossy and lossless formats', () => {
      const flacTrack = { isLossless: true, bitrate: 1411, sampleRate: 44100, bitDepth: 16 } as TrackMetadata;
      const mp3Track = { isLossless: false, bitrate: 320, sampleRate: 44100 } as TrackMetadata;
      const lowMp3Track = { isLossless: false, bitrate: 128, sampleRate: 44100 } as TrackMetadata;

      expect(AudioQualityInspectorService.calculateQualityTier(flacTrack)).toBe('Lossless');
      expect(AudioQualityInspectorService.calculateQualityTier(mp3Track)).toBe('High Quality');
      expect(AudioQualityInspectorService.calculateQualityTier(lowMp3Track)).toBe('Standard');
    });
  });

  describe('4. User Data & Storage Architecture Safety', () => {
    it('verifies user data path safety in portable and installed modes', () => {
      const mainTsPath = path.join(rootDir, 'electron/main.ts');
      const mainTsContent = fs.readFileSync(mainTsPath, 'utf8');
      expect(mainTsContent).toContain('harmoniq-portable.json');
      expect(mainTsContent).toContain("app.setPath('userData', targetDir)");
      expect(mainTsContent).toContain('userData');
    });
  });
});
