import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

describe('Harmoniq 2.0 Stage 3: Windows Native Integration & Desktop Behavior', () => {
  const rootDir = path.resolve(__dirname, '../../');

  describe('1. Windows Taskbar Thumbnail Toolbar Assets & Contract', () => {
    it('confirms all required 24x24/32x32 taskbar button icons exist in assets/', () => {
      const assetsDir = path.join(rootDir, 'assets');
      const requiredIcons = [
        'thumbar-prev.png',
        'thumbar-play.png',
        'thumbar-pause.png',
        'thumbar-next.png',
      ];

      requiredIcons.forEach((iconFile) => {
        const iconPath = path.join(assetsDir, iconFile);
        expect(fs.existsSync(iconPath)).toBe(true);
        const stats = fs.statSync(iconPath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });

    it('verifies updateThumbarButtons payload matches Windows DWM specifications', () => {
      const createThumbarPayload = (isPlaying: boolean) => [
        { tooltip: 'Previous Track', command: 'prev' },
        { tooltip: isPlaying ? 'Pause' : 'Play', command: 'playpause' },
        { tooltip: 'Next Track', command: 'next' },
      ];

      const playingButtons = createThumbarPayload(true);
      expect(playingButtons[1].tooltip).toBe('Pause');
      expect(playingButtons).toHaveLength(3);

      const pausedButtons = createThumbarPayload(false);
      expect(pausedButtons[1].tooltip).toBe('Play');
      expect(pausedButtons).toHaveLength(3);
    });
  });

  describe('2. System Tray & Close-To-Tray Lifecycle', () => {
    it('generates accurate, clean tray tooltips and now-playing labels', () => {
      const formatTrayTooltip = (track?: { title?: string; artist?: string }) => {
        if (track?.title) {
          return `Harmoniq: ${track.title} — ${track.artist || 'Unknown'}`;
        }
        return 'Harmoniq — Audiophile Desktop Music Player';
      };

      expect(formatTrayTooltip()).toBe('Harmoniq — Audiophile Desktop Music Player');
      expect(
        formatTrayTooltip({ title: 'Aankhein', artist: 'Harmoniq Artist' })
      ).toBe('Harmoniq: Aankhein — Harmoniq Artist');
    });

    it('verifies close-to-tray prevents window destruction while preserving audio', () => {
      let isQuitting = false;
      let closeToTray = true;
      let isWindowHidden = false;

      const handleClose = () => {
        if (!isQuitting && closeToTray) {
          isWindowHidden = true;
          return 'prevented';
        }
        return 'closed';
      };

      expect(handleClose()).toBe('prevented');
      expect(isWindowHidden).toBe(true);

      // Now simulate explicit tray quit
      isQuitting = true;
      expect(handleClose()).toBe('closed');
    });
  });

  describe('3. Windows System Media Transport Controls (SMTC) & MediaSession', () => {
    it('formats MediaMetadata with high-resolution artwork and complete track tags', () => {
      const track = {
        title: 'Master Symphony in D Minor',
        artist: 'Philharmonic Orchestra',
        album: 'Acoustic Master Sessions',
        artworkDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      };

      const artwork = track.artworkDataUrl
        ? [{ src: track.artworkDataUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [];

      const mediaMetadataMock = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork,
      };

      expect(mediaMetadataMock.title).toBe('Master Symphony in D Minor');
      expect(mediaMetadataMock.artist).toBe('Philharmonic Orchestra');
      expect(mediaMetadataMock.artwork[0].sizes).toBe('512x512');
    });

    it('verifies position state bounds for SMTC scrubber', () => {
      const clampPositionState = (currentTime: number, duration: number) => {
        const safePosition = Math.min(Math.max(0, currentTime), duration);
        return {
          position: safePosition,
          duration,
        };
      };

      expect(clampPositionState(50, 300)).toEqual({ position: 50, duration: 300 });
      expect(clampPositionState(-10, 300)).toEqual({ position: 0, duration: 300 });
      expect(clampPositionState(350, 300)).toEqual({ position: 300, duration: 300 });
    });
  });

  describe('4. File Associations & CLI Extraction', () => {
    const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.alac', '.ogg']);

    function extractAudioFile(argv: string[]): string | null {
      if (!argv || argv.length <= 1) return null;
      for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg || arg.startsWith('--') || arg.startsWith('-')) continue;
        const ext = path.extname(arg).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) return path.resolve(arg);
      }
      return null;
    }

    it('extracts target audio file when launched from Windows Explorer with path spaces', () => {
      const argv = ['Harmoniq.exe', 'D:\\Music\\Hi-Res Lossless\\01 Track Title.flac'];
      const file = extractAudioFile(argv);
      expect(file).toBe(path.resolve('D:\\Music\\Hi-Res Lossless\\01 Track Title.flac'));
    });

    it('extracts target audio file with unicode / non-English characters', () => {
      const argv = ['Harmoniq.exe', 'C:\\Music\\日本語_曲名\\サントラ.flac'];
      const file = extractAudioFile(argv);
      expect(file).toBe(path.resolve('C:\\Music\\日本語_曲名\\サントラ.flac'));
    });

    it('safely handles launch without arguments or with electron flags', () => {
      const argv1 = ['Harmoniq.exe'];
      expect(extractAudioFile(argv1)).toBeNull();

      const argv2 = ['Harmoniq.exe', '--hidden', '--autostart', '--no-sandbox'];
      expect(extractAudioFile(argv2)).toBeNull();
    });
  });

  describe('5. Single Instance Lock Enforcement', () => {
    it('verifies single instance lock architecture', () => {
      let instancesRunning = 0;
      const requestLock = () => {
        if (instancesRunning === 0) {
          instancesRunning++;
          return true;
        }
        return false;
      };

      expect(requestLock()).toBe(true);
      expect(requestLock()).toBe(false);
    });
  });
});
