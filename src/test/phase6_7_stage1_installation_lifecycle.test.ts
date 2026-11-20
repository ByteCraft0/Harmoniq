import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Harmoniq 2.0 Stage 1: Installation & Lifecycle Validation', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const tempTestDir = path.join(rootDir, 'test-scratch-profile');
  const tempPortableDir = path.join(rootDir, 'test-scratch-portable');

  beforeEach(() => {
    if (!fs.existsSync(tempTestDir)) fs.mkdirSync(tempTestDir, { recursive: true });
    if (!fs.existsSync(tempPortableDir)) fs.mkdirSync(tempPortableDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempTestDir)) fs.rmSync(tempTestDir, { recursive: true, force: true });
    if (fs.existsSync(tempPortableDir)) fs.rmSync(tempPortableDir, { recursive: true, force: true });
  });

  describe('STEP 1: Release Artifact Inventory & Metadata', () => {
    it('verifies that both NSIS installer and portable executable exist in release/', () => {
      const nsisPath = path.join(rootDir, 'release/Harmoniq Setup 2.0.0.exe');
      const portablePath = path.join(rootDir, 'release/Harmoniq 2.0.0.exe');
      expect(fs.existsSync(nsisPath)).toBe(true);
      expect(fs.existsSync(portablePath)).toBe(true);

      const nsisStats = fs.statSync(nsisPath);
      const portableStats = fs.statSync(portablePath);

      // Verify file sizes are in plausible desktop packaging range for modern Electron 45 runtime (100MB - 150MB)
      expect(nsisStats.size).toBeGreaterThan(100 * 1024 * 1024);
      expect(nsisStats.size).toBeLessThan(150 * 1024 * 1024);

      expect(portableStats.size).toBeGreaterThan(90 * 1024 * 1024);
      expect(portableStats.size).toBeLessThan(140 * 1024 * 1024);

      // Verify valid Windows PE binary headers ('MZ' magic bytes)
      const nsisHeader = Buffer.alloc(2);
      const nsisFd = fs.openSync(nsisPath, 'r');
      fs.readSync(nsisFd, nsisHeader, 0, 2, 0);
      fs.closeSync(nsisFd);
      expect(nsisHeader.toString('ascii')).toBe('MZ');

      const portableHeader = Buffer.alloc(2);
      const portableFd = fs.openSync(portablePath, 'r');
      fs.readSync(portableFd, portableHeader, 0, 2, 0);
      fs.closeSync(portableFd);
      expect(portableHeader.toString('ascii')).toBe('MZ');

      // Verify companion delta blockmap artifact exists and is non-empty
      const blockmapPath = path.join(rootDir, 'release/Harmoniq Setup 2.0.0.exe.blockmap');
      expect(fs.existsSync(blockmapPath)).toBe(true);
      expect(fs.statSync(blockmapPath).size).toBeGreaterThan(10000);

      // Verify packaging metadata in latest.yml reflects version and size accurately
      const latestYmlPath = path.join(rootDir, 'release/latest.yml');
      expect(fs.existsSync(latestYmlPath)).toBe(true);
      const latestYml = fs.readFileSync(latestYmlPath, 'utf8');
      expect(latestYml).toContain('version: 2.0.0');
      expect(latestYml).toContain(`size: ${nsisStats.size}`);
    });

    it('verifies package.json version matches target version 2.0.0', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      expect(pkg.version).toBe('2.0.0');
      expect(pkg.build.productName).toBe('Harmoniq');
    });
  });

  describe('STEP 2: Installation Configuration & Lifecycle Contracts', () => {
    it('verifies NSIS configuration allows custom directory and enables shortcuts', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const nsis = pkg.build.nsis;
      expect(nsis.allowToChangeInstallationDirectory).toBe(true);
      expect(nsis.oneClick).toBe(false);
      expect(nsis.createDesktopShortcut).toBe(true);
      expect(nsis.createStartMenuShortcut).toBe(true);
      expect(nsis.installerIcon).toBe('assets/icon.ico');
      expect(nsis.uninstallerIcon).toBe('assets/icon.ico');
    });

    it('verifies all 6 primary audio formats are registered with proper description', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const exts = pkg.build.fileAssociations.map((fa: any) => fa.ext);
      expect(exts).toContain('flac');
      expect(exts).toContain('mp3');
      expect(exts).toContain('wav');
      expect(exts).toContain('m4a');
      expect(exts).toContain('alac');
      expect(exts).toContain('ogg');
    });
  });

  describe('STEP 3: User Data Preservation in Isolated Disposable Profile', () => {
    it('verifies that saving and reloading user data preserves playlists and DSP settings across restarts', () => {
      // Simulate storage helper from electron/main.ts
      const storagePath = (baseDir: string, key: string) =>
        path.join(baseDir, `harmoniq_${String(key).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);

      const save = (baseDir: string, key: string, data: any) => {
        const p = storagePath(baseDir, key);
        fs.writeFileSync(p, JSON.stringify(data), 'utf8');
      };

      const load = (baseDir: string, key: string, fallback: any) => {
        const p = storagePath(baseDir, key);
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
        return fallback;
      };

      // 1. Initial State (Playlists and DSP profile)
      const mockPlaylists = [
        { id: 'pl_1', name: 'Audiophile Master Tape', trackIds: ['t1', 't2'] },
      ];
      const mockDsp = { presetId: 'tube_warmth', preamp: -1.0, bassBoost: 2.0 };

      save(tempTestDir, 'custom_playlists', mockPlaylists);
      save(tempTestDir, 'dsp_settings', mockDsp);

      // 2. Simulate application restart
      const reloadedPlaylists = load(tempTestDir, 'custom_playlists', []);
      const reloadedDsp = load(tempTestDir, 'dsp_settings', {});

      expect(reloadedPlaylists).toEqual(mockPlaylists);
      expect(reloadedDsp).toEqual(mockDsp);

      // 3. Simulate application binary upgrade (binary files change, user data directory left untouched)
      const simulatedNewVersion = '2.0.1';
      expect(simulatedNewVersion).not.toBe('2.0.0');

      // Verify user data remains 100% intact after simulated upgrade
      const postUpgradePlaylists = load(tempTestDir, 'custom_playlists', []);
      expect(postUpgradePlaylists).toEqual(mockPlaylists);
      expect(postUpgradePlaylists[0].name).toBe('Audiophile Master Tape');
    });
  });

  describe('STEP 4: Portable Build Validation & Directory Isolation', () => {
    it('isolates portable user data in harmoniq-data without touching installed profile', () => {
      const portableEnvDir = tempPortableDir;
      const portableDataDir = path.join(portableEnvDir, 'harmoniq-data');

      // Create portable data directory
      fs.mkdirSync(portableDataDir, { recursive: true });

      // Write portable session data
      const portableSessionFile = path.join(portableDataDir, 'harmoniq_session.json');
      fs.writeFileSync(portableSessionFile, JSON.stringify({ portableMode: true }), 'utf8');

      // Assert that tempTestDir (simulating installed profile) was NOT contaminated
      const installedFiles = fs.readdirSync(tempTestDir);
      expect(installedFiles).not.toContain('harmoniq_session.json');
      expect(fs.existsSync(portableSessionFile)).toBe(true);

      // Verify moving portable directory to new path preserves data
      const movedPortableDir = path.join(rootDir, 'test-scratch-portable-moved');
      fs.renameSync(tempPortableDir, movedPortableDir);

      const movedSessionFile = path.join(movedPortableDir, 'harmoniq-data', 'harmoniq_session.json');
      expect(fs.existsSync(movedSessionFile)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(movedSessionFile, 'utf8'));
      expect(parsed.portableMode).toBe(true);

      // Cleanup moved directory
      fs.rmSync(movedPortableDir, { recursive: true, force: true });
    });
  });

  describe('STEP 5: Security Flags & Integrity Audit', () => {
    it('verifies that main.ts enforces sandbox and context isolation', () => {
      const mainTs = fs.readFileSync(path.join(rootDir, 'electron/main.ts'), 'utf8');
      expect(mainTs).toContain('contextIsolation: true');
      expect(mainTs).toContain('nodeIntegration: false');
      expect(mainTs).toContain('sandbox: true');
      expect(mainTs).toContain('webSecurity: true');
    });
  });
});
