import { describe, it, expect } from 'vitest';
import { LyricsService } from '../services/lyricsService';

describe('Advanced Synchronized Karaoke LRC Parser (Part 4)', () => {
  it('supports multiple timestamps on a single line and sorts them chronologically', () => {
    const multiLrc = `
[00:10.00][00:30.00] Hook repeating twice
[00:20.00] Interlude line
`;
    const result = LyricsService.parseLrc(multiLrc, 'lrc_file');
    expect(result.synced).toBe(true);
    expect(result.lines.length).toBe(3);

    // Line 0: Hook at 10.0s
    expect(result.lines[0].time).toBeCloseTo(10.0, 2);
    expect(result.lines[0].text).toBe('Hook repeating twice');

    // Line 1: Interlude at 20.0s
    expect(result.lines[1].time).toBeCloseTo(20.0, 2);
    expect(result.lines[1].text).toBe('Interlude line');

    // Line 2: Hook repeated at 30.0s
    expect(result.lines[2].time).toBeCloseTo(30.0, 2);
    expect(result.lines[2].text).toBe('Hook repeating twice');
  });

  it('filters out metadata header tags such as [ti:], [ar:], [al:], [by:], [re:]', () => {
    const metaLrc = `
[ti:Starlight Symphony]
[ar:Harmoniq Studio Ensemble]
[al:High Fidelity Masterings Vol. 1]
[by:AudioEngineer]
[re:Harmoniq LRC Generator]
[00:05.00]First real musical line
`;
    const result = LyricsService.parseLrc(metaLrc, 'lrc_file');
    expect(result.synced).toBe(true);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].text).toBe('First real musical line');
    expect(result.lines[0].time).toBeCloseTo(5.0, 2);
  });

  it('handles negative and positive offset tags accurately', () => {
    const offsetLrc = `
[offset:-1000]
[00:10.00]Subtracted offset line
`;
    const result = LyricsService.parseLrc(offsetLrc, 'lrc_file');
    expect(result.synced).toBe(true);
    expect(result.offset).toBe(-1);
    // 10s - 1s = 9s
    expect(result.lines[0].time).toBeCloseTo(9.0, 2);
  });

  it('handles malformed lines, random braces, and empty lines without crashing', () => {
    const dirtyLrc = `
Random intro without brackets
[not_a_time] Malformed bracket content
[] Empty brackets
[99:99:99] Bad timestamp
[00:15.80] Valid lyric line
`;
    const result = LyricsService.parseLrc(dirtyLrc, 'lrc_file');
    expect(result.synced).toBe(true);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].text).toBe('Valid lyric line');
    expect(result.lines[0].time).toBeCloseTo(15.8, 2);
  });

  it('finds active lyric line correctly with live offset adjustments', () => {
    const lrc = `
[00:05.00] Line 1
[00:10.00] Line 2
[00:15.00] Line 3
`;
    const result = LyricsService.parseLrc(lrc, 'lrc_file');
    // Without offset at t = 7s -> Line 1
    expect(LyricsService.findActiveLineIndex(result.lines, 7.0, 0)).toBe(0);

    // With a manual offset of +4 seconds (user delayed), at t = 7s effective time is 3s -> before line 1 (-1)
    expect(LyricsService.findActiveLineIndex(result.lines, 7.0, -4.0)).toBe(-1);

    // At t = 11s -> Line 2
    expect(LyricsService.findActiveLineIndex(result.lines, 11.0, 0)).toBe(1);
  });
});
