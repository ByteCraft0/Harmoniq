import { describe, it, expect, beforeEach } from 'vitest';
import { playlistIoService } from '../services/playlistIoService';
import { LyricsService } from '../services/lyricsService';
import { TrackMetadata } from '../types/audio';

describe('Batch 13: Online Music Management (M3U/M3U8 & Lyrics)', () => {
  const mockLibraryTracks = [
    {
      id: 't1',
      filePath: 'C:/Music/Rock/Queen/Bohemian Rhapsody.mp3',
      fileName: 'Bohemian Rhapsody.mp3',
      fileSize: 1000,
      dateModified: 0,
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      duration: 354,
    },
    {
      id: 't2',
      filePath: 'C:/Music/Rock/Queen/Don\'t Stop Me Now.mp3',
      fileName: 'Don\'t Stop Me Now.mp3',
      fileSize: 1000,
      dateModified: 0,
      title: 'Don\'t Stop Me Now',
      artist: 'Queen',
      album: 'Jazz',
      duration: 210,
    },
  ] as unknown as TrackMetadata[];

  describe('Playlist Import & Export (M3U / M3U8)', () => {
    it('generates standard M3U/M3U8 content with EXTINF and playlist name headers', () => {
      const m3u = playlistIoService.generateM3u(mockLibraryTracks, {
        playlistName: 'Best of Queen',
      });

      expect(m3u).toContain('#EXTM3U');
      expect(m3u).toContain('#PLAYLIST:Best of Queen');
      expect(m3u).toContain('#EXTINF:354,Queen - Bohemian Rhapsody');
      expect(m3u).toContain('C:/Music/Rock/Queen/Bohemian Rhapsody.mp3');
      expect(m3u).toContain('#EXTINF:210,Queen - Don\'t Stop Me Now');
    });

    it('parses M3U/M3U8 file content, matching tracks and identifying missing entries', () => {
      const input = `#EXTM3U
#PLAYLIST:Road Trip
#EXTINF:354,Queen - Bohemian Rhapsody
C:/Music/Rock/Queen/Bohemian Rhapsody.mp3
#EXTINF:180,Unknown Artist - Ghost Song
C:/Music/Unsorted/ghost.mp3
`;

      const result = playlistIoService.parseM3u(input, {
        libraryTracks: mockLibraryTracks,
      });

      expect(result.playlistName).toBe('Road Trip');
      expect(result.matchedTracks.length).toBe(1);
      expect(result.matchedTracks[0].id).toBe('t1');
      expect(result.missingEntries.length).toBe(1);
      expect(result.missingEntries[0].title).toBe('Ghost Song');
      expect(result.missingEntries[0].artist).toBe('Unknown Artist');
    });

    it('identifies and skips or includes duplicate entries based on user option', () => {
      const input = `#EXTM3U
C:/Music/Rock/Queen/Bohemian Rhapsody.mp3
C:/Music/Rock/Queen/Bohemian Rhapsody.mp3
`;

      const withoutDups = playlistIoService.parseM3u(input, {
        libraryTracks: mockLibraryTracks,
        allowDuplicates: false,
      });
      expect(withoutDups.matchedTracks.length).toBe(1);
      expect(withoutDups.duplicateCount).toBe(1);

      const withDups = playlistIoService.parseM3u(input, {
        libraryTracks: mockLibraryTracks,
        allowDuplicates: true,
      });
      expect(withDups.matchedTracks.length).toBe(2);
    });
  });

  describe('Online & Local Lyrics Integration', () => {
    it('parses synchronized LRC lines with millisecond precision', () => {
      const lrcContent = `[00:12.50]Is this the real life?
[00:15.20]Is this just fantasy?
[00:20.00]Caught in a landslide, no escape from reality
`;

      const parsed = LyricsService.parseLrc(lrcContent, 'online');
      expect(parsed.synced).toBe(true);
      expect(parsed.lines.length).toBe(3);
      expect(parsed.lines[0].time).toBeCloseTo(12.5);
      expect(parsed.lines[0].text).toBe('Is this the real life?');
      expect(parsed.lines[1].time).toBeCloseTo(15.2);
    });

    it('finds active lyric line index accurately for playback position', () => {
      const lines = [
        { time: 10, text: 'Line 1' },
        { time: 20, text: 'Line 2' },
        { time: 30, text: 'Line 3' },
      ];

      expect(LyricsService.findActiveLineIndex(lines, 5)).toBe(-1);
      expect(LyricsService.findActiveLineIndex(lines, 12)).toBe(0);
      expect(LyricsService.findActiveLineIndex(lines, 25)).toBe(1);
      expect(LyricsService.findActiveLineIndex(lines, 35)).toBe(2);
    });
  });
});
