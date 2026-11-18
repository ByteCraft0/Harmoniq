import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { LyricsService } from '../services/lyricsService';
import { buildMediaUrl } from '../services/audioEngine';
import { TrackMetadata } from '../types/audio';

const mk = (id: string, filePath: string, extra: Partial<TrackMetadata> = {}): TrackMetadata => ({
  id,
  filePath,
  fileName: filePath.split(/[/\\]/).pop() as string,
  fileSize: 1,
  dateModified: 1,
  title: id,
  artist: 'A',
  album: 'Alb',
  codec: 'FLAC',
  container: 'FLAC',
  duration: 100,
  sampleRate: 44100,
  bitrate: 900,
  channels: 2,
  isLossless: true,
  hasArtwork: false,
  playCount: 0,
  isFavorite: false,
  ...extra,
});

describe('media URL building', () => {
  const roundTrip = (p: string) => {
    const url = new URL(buildMediaUrl(p));
    return decodeURIComponent(url.pathname);
  };

  it('keeps host constant and survives colons, spaces, # and % in paths', () => {
    const u = buildMediaUrl('C:\\Music\\My Band\\100% #1 hit.flac');
    expect(u.startsWith('harmoniq-media://local/')).toBe(true);
    expect(roundTrip('C:\\Music\\My Band\\100% #1 hit.flac')).toBe('/C:/Music/My Band/100% #1 hit.flac');
  });

  it('marks UNC paths and keeps POSIX paths absolute', () => {
    expect(roundTrip('\\\\server\\share\\a.mp3')).toBe('/UNC/server/share/a.mp3');
    expect(roundTrip('/home/u/a.mp3')).toBe('/home/u/a.mp3');
  });
});

describe('library regressions', () => {
  let lib: LibraryService;
  beforeEach(() => {
    lib = new LibraryService();
  });

  it('prunes only missing tracks inside the scanned folder', () => {
    lib.addTracks([mk('a', 'C:/Music/x/1.flac'), mk('b', 'C:/Music/x/2.flac'), mk('c', 'C:/Other/3.flac')]);
    const removed = lib.pruneFolder('C:\\Music\\x', new Set(['a']));
    expect(removed).toBe(1);
    expect(lib.getTrack('a')).toBeDefined();
    expect(lib.getTrack('b')).toBe(undefined);
    expect(lib.getTrack('c')).toBeDefined();
  });

  it('does not prune sibling folders that share a name prefix', () => {
    lib.addTracks([mk('a', 'C:/Music/rock/1.flac'), mk('b', 'C:/Music/rock2/2.flac')]);
    expect(lib.pruneFolder('C:/Music/rock', new Set())).toBe(1);
    expect(lib.getTrack('b')).toBeDefined();
  });

  it('keeps user data and dateAdded across rescans', () => {
    lib.addTracks([mk('a', 'C:/m/1.flac')]);
    lib.toggleFavorite('a');
    lib.recordPlay('a');
    const added = lib.getTrack('a')!.dateAdded;
    lib.addTracks([mk('a', 'C:/m/1.flac')]);
    const t = lib.getTrack('a')!;
    expect(t.isFavorite).toBe(true);
    expect(t.playCount).toBe(1);
    expect(t.dateAdded).toBe(added);
  });

  it('round-trips artwork once per album and restores it on load', () => {
    const art = 'data:image/jpeg;base64,' + 'A'.repeat(500);
    lib.addTracks([
      mk('a', 'C:/m/1.flac', { hasArtwork: true, artworkDataUrl: art }),
      mk('b', 'C:/m/2.flac', { hasArtwork: true, artworkDataUrl: art }),
    ]);
    const data = lib.serialize();
    expect(JSON.stringify(data).split(art).length - 1).toBe(1);
    const lib2 = new LibraryService();
    lib2.deserialize(JSON.parse(JSON.stringify(data)));
    expect(lib2.getTrack('b')!.artworkDataUrl).toBe(art);
  });

  it('notifies subscribers on play/favorite and persist-only on resume', () => {
    lib.addTracks([mk('a', 'C:/m/1.flac')]);
    const seen: string[] = [];
    lib.subscribe((k) => seen.push(k));
    lib.recordPlay('a');
    lib.saveResumePosition('a', 50);
    lib.saveResumePosition('a', 50.2); // < 1s change: ignored
    expect(seen.join(',')).toBe('data,persist');
  });

  it('artists cover album-artist albums and guest appearances', () => {
    lib.addTracks([
      mk('a', 'C:/m/1.flac', { artist: 'Main', album: 'X' }),
      mk('b', 'C:/m/2.flac', { artist: 'Guest', album: 'X', albumArtist: 'Main' }),
    ]);
    const artists = lib.getArtists();
    const guest = artists.find((x) => x.name === 'Guest')!;
    expect(guest.albumCount).toBe(1);
    expect(lib.getArtists().length).toBe(2);
  });

  it('imports M3U with BOM, mixed slashes, case and relative paths', () => {
    lib.addTracks([mk('a', 'C:/Music/Rock/Song One.flac'), mk('b', 'C:/Music/Jazz/Song Two.flac')]);
    const pl = lib.importPlaylistM3u(
      'x',
      '\uFEFF#EXTM3U\r\nC:\\music\\rock\\song one.FLAC\r\n..\\Jazz\\Song Two.flac\r\nmissing.flac\r\n'
    );
    expect(pl.trackIds.join(',')).toBe('a,b');
  });
});

describe('lyrics regressions', () => {
  it('parses 3-digit minutes, single-digit fractions and BOM', () => {
    const r = LyricsService.parseLrc('\uFEFF[100:05.5]Late line\n[00:01.250]Early', 'lrc_file');
    expect(r.lines[0].text).toBe('Early');
    expect(r.lines[1].time).toBeCloseTo(6005.5, 2);
    expect(r.lines[0].time).toBeCloseTo(1.25, 2);
  });

  it('expands multi-timestamp lines', () => {
    const r = LyricsService.parseLrc('[00:10.00][00:20.00]Chorus', 'lrc_file');
    expect(r.lines.length).toBe(2);
  });
});
