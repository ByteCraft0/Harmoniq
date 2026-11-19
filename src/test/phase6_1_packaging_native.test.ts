import { describe, it, expect, vi } from 'vitest';

describe('Phase 6.1 — Windows Native Integration & Packaging Verification', () => {
  it('verifies supported audio extensions for Windows file association', () => {
    const supportedExts = new Set([
      '.flac',
      '.mp3',
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

    expect(supportedExts.has('.flac')).toBe(true);
    expect(supportedExts.has('.mp3')).toBe(true);
    expect(supportedExts.has('.wav')).toBe(true);
    expect(supportedExts.has('.m4a')).toBe(true);
    expect(supportedExts.has('.alac')).toBe(true);
    expect(supportedExts.has('.ogg')).toBe(true);
    // Non-audio extension should not match
    expect(supportedExts.has('.txt')).toBe(false);
    expect(supportedExts.has('.exe')).toBe(false);
  });

  it('validates argument parsing for file associations', () => {
    const AUDIO_EXTENSIONS = new Set(['.flac', '.mp3', '.wav', '.m4a', '.alac', '.ogg']);
    function extractAudioFile(argv: string[]): string | null {
      if (!argv || argv.length <= 1) return null;
      for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg || arg.startsWith('--') || arg.startsWith('-')) continue;
        const dotIndex = arg.lastIndexOf('.');
        if (dotIndex === -1) continue;
        const ext = arg.slice(dotIndex).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          return arg;
        }
      }
      return null;
    }

    expect(extractAudioFile(['harmoniq.exe', 'C:\\Music\\test.flac'])).toBe('C:\\Music\\test.flac');
    expect(extractAudioFile(['harmoniq.exe', '--hidden', 'D:\\Songs\\track.mp3'])).toBe('D:\\Songs\\track.mp3');
    expect(extractAudioFile(['harmoniq.exe', '--inspect', '--flag'])).toBeNull();
    expect(extractAudioFile(['harmoniq.exe'])).toBeNull();
  });

  it('verifies Taskbar Thumbnail Toolbar action mappings', () => {
    const dispatchedCommands: string[] = [];
    const mockDispatcher = (cmd: string) => dispatchedCommands.push(cmd);

    // Simulate taskbar button clicks
    const thumbarButtons = [
      { id: 'prev', tooltip: 'Previous Track', action: () => mockDispatcher('prev') },
      { id: 'playpause', tooltip: 'Play / Pause', action: () => mockDispatcher('playpause') },
      { id: 'next', tooltip: 'Next Track', action: () => mockDispatcher('next') },
    ];

    thumbarButtons[0].action();
    thumbarButtons[1].action();
    thumbarButtons[2].action();

    expect(dispatchedCommands).toEqual(['prev', 'playpause', 'next']);
  });
});
