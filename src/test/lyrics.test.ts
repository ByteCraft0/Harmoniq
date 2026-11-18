import { describe, it, expect } from 'vitest';
import { LyricsService } from '../services/lyricsService';

describe('LyricsService LRC Parser', () => {
  const sampleLrc = `
[ti:Audiophile Dream]
[ar:Harmoniq]
[offset:+500]
[00:10.00]First verse begins right here
[00:15.50]Second line with precision timestamp
[00:22.00]Chorus arrives in high fidelity
[00:30.00]Final outro fades out
`;

  it('parses standard timestamps with millisecond accuracy', () => {
    const result = LyricsService.parseLrc(sampleLrc, 'lrc_file');
    expect(result.synced).toBe(true);
    expect(result.lines.length).toBe(4);
    // Note: global offset of +500ms adds 0.5s to each timestamp
    expect(result.lines[0].time).toBeCloseTo(10.5, 2);
    expect(result.lines[0].text).toBe('First verse begins right here');
    expect(result.lines[1].time).toBeCloseTo(16.0, 2);
  });

  it('accurately identifies active line index given current playback time', () => {
    const result = LyricsService.parseLrc(sampleLrc, 'lrc_file');
    // At 5 seconds (before first line at 10.5s)
    expect(LyricsService.findActiveLineIndex(result.lines, 5.0)).toBe(-1);

    // At 12 seconds (between 10.5s and 16.0s)
    expect(LyricsService.findActiveLineIndex(result.lines, 12.0)).toBe(0);

    // At 25 seconds (between 22.5s and 30.5s)
    expect(LyricsService.findActiveLineIndex(result.lines, 25.0)).toBe(2);

    // At 35 seconds (after last line)
    expect(LyricsService.findActiveLineIndex(result.lines, 35.0)).toBe(3);
  });

  it('handles plain text lyrics gracefully when timestamps are absent', () => {
    const plainText = 'Just some non-synchronized lyrics line 1\nLine 2 without timestamps';
    const result = LyricsService.parseLrc(plainText, 'embedded');
    expect(result.synced).toBe(false);
    expect(result.lines.length).toBe(0);
    expect(result.plainText).toContain('non-synchronized');
  });
});
