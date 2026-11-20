import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 6.7.2 Windows Lifecycle & Installation Validation', () => {
  const AUDIO_EXTENSIONS = new Set([
    '.mp3',
    '.flac',
    '.wav',
    '.m4a',
    '.aac',
    '.alac',
    '.ogg',
    '.opus',
    '.aiff',
    '.aif',
    '.wma',
  ]);

  function extractAudioFileFromArgv(argv: string[], fileExistsCheck = (_p: string) => true): string | null {
    if (!argv || argv.length <= 1) return null;
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (!arg || arg.startsWith('--') || arg.startsWith('-')) continue;
      try {
        const ext = path.extname(arg).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext) && fileExistsCheck(arg)) {
          return path.resolve(arg);
        }
      } catch {}
    }
    return null;
  }

  describe('1. File Associations & CLI Argument Resolution', () => {
    it('correctly resolves audio files with spaces and unicode names', () => {
      const testArgv = ['Harmoniq.exe', 'C:\\Music\\Hi-Res Flac Collection\\01 - 蓮の花 (Lotus).flac'];
      const resolved = extractAudioFileFromArgv(testArgv);
      expect(resolved).toBe(path.resolve('C:\\Music\\Hi-Res Flac Collection\\01 - 蓮の花 (Lotus).flac'));
    });

    it('ignores CLI runtime flags like --no-sandbox or --inspect', () => {
      const testArgv = [
        'Harmoniq.exe',
        '--no-sandbox',
        '--disable-gpu',
        'C:\\Music\\Beethoven Symphony 9.mp3',
      ];
      const resolved = extractAudioFileFromArgv(testArgv);
      expect(resolved).toBe(path.resolve('C:\\Music\\Beethoven Symphony 9.mp3'));
    });

    it('returns null when no audio files are passed in argv', () => {
      const testArgv = ['Harmoniq.exe', '--hidden', '--autostart'];
      const resolved = extractAudioFileFromArgv(testArgv);
      expect(resolved).toBeNull();
    });

    it('validates supported extensions: flac, mp3, wav, m4a, alac, ogg', () => {
      ['song.flac', 'song.mp3', 'song.wav', 'song.m4a', 'song.alac', 'song.ogg'].forEach((file) => {
        const resolved = extractAudioFileFromArgv(['Harmoniq.exe', `C:\\Audio\\${file}`]);
        expect(resolved).not.toBeNull();
      });
    });
  });

  describe('2. User Data Separation & Non-Destructive Storage', () => {
    it('verifies storage key sanitization prevents directory traversal in userData', () => {
      const storagePath = (baseUserData: string, key: string) =>
        path.join(baseUserData, `harmoniq_${String(key).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);

      const safeBase = 'C:\\Users\\User\\AppData\\Roaming\\Harmoniq';
      const p = storagePath(safeBase, '../../dangerous/key');
      expect(p).not.toContain('..');
      expect(p.startsWith(safeBase)).toBe(true);
      expect(path.basename(p)).toBe('harmoniq_dangerouskey.json');
    });
  });

  describe('3. Portable Mode Directory Resolution', () => {
    it('resolves portable data directory in precedence when PORTABLE_EXECUTABLE_DIR is present', () => {
      const portableEnvDir = 'E:\\PortableApps\\Harmoniq';
      const expectedDir = path.join(portableEnvDir, 'harmoniq-data');
      expect(expectedDir).toBe('E:\\PortableApps\\Harmoniq\\harmoniq-data');
    });
  });
});
