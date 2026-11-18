import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';

describe('LibraryService Indexing & Playlist System', () => {
  let lib: LibraryService;

  const mockTracks: TrackMetadata[] = [
    {
      id: 't1',
      filePath: 'C:/Music/Rock/Queen - Bohemian Rhapsody.flac',
      fileName: 'Queen - Bohemian Rhapsody.flac',
      fileSize: 30000000,
      dateModified: 1000,
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      codec: 'FLAC',
      container: 'FLAC',
      duration: 354,
      sampleRate: 44100,
      bitDepth: 16,
      bitrate: 890,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
      playCount: 15,
      isFavorite: true,
    },
    {
      id: 't2',
      filePath: 'C:/Music/Jazz/Miles Davis - So What.flac',
      fileName: 'Miles Davis - So What.flac',
      fileSize: 48000000,
      dateModified: 2000,
      title: 'So What',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      codec: 'FLAC',
      container: 'FLAC',
      duration: 562,
      sampleRate: 96000,
      bitDepth: 24,
      bitrate: 2400,
      channels: 2,
      isLossless: true,
      hasArtwork: false,
      playCount: 22,
      isFavorite: true,
    },
    {
      id: 't3',
      filePath: 'C:/Music/Rock/Queen - Love of My Life.mp3',
      fileName: 'Queen - Love of My Life.mp3',
      fileSize: 8000000,
      dateModified: 1500,
      title: 'Love of My Life',
      artist: 'Queen',
      album: 'A Night at the Opera',
      codec: 'MP3',
      container: 'MPEG',
      duration: 219,
      sampleRate: 44100,
      bitrate: 320,
      channels: 2,
      isLossless: false,
      hasArtwork: false,
      playCount: 5,
      isFavorite: false,
    },
  ];

  beforeEach(() => {
    lib = new LibraryService();
    lib.addTracks(mockTracks);
  });

  it('aggregates albums accurately with track grouping and total runtime', () => {
    const albums = lib.getAlbums();
    expect(albums.length).toBe(2);

    const queenAlbum = albums.find((a) => a.title === 'A Night at the Opera');
    expect(queenAlbum).toBeDefined();
    expect(queenAlbum?.tracks.length).toBe(2);
    expect(queenAlbum?.totalDuration).toBe(354 + 219);
  });

  it('aggregates artists with discography stats', () => {
    const artists = lib.getArtists();
    expect(artists.length).toBe(2);

    const queen = artists.find((a) => a.name === 'Queen');
    expect(queen).toBeDefined();
    expect(queen?.trackCount).toBe(2);
    expect(queen?.albumCount).toBe(1);
  });

  it('performs sub-millisecond search across title, artist, album, and format', () => {
    const resultsQueen = lib.searchTracks('queen');
    expect(resultsQueen.length).toBe(2);

    const resultsMiles = lib.searchTracks('kind of blue');
    expect(resultsMiles.length).toBe(1);
    expect(resultsMiles[0].title).toBe('So What');

    const resultsFlac = lib.searchTracks('flac');
    expect(resultsFlac.length).toBe(2);
  });

  it('generates compliant M3U8 playlist export content', () => {
    const pl = lib.createPlaylist('Test Set');
    lib.addTracksToPlaylist(pl.id, ['t1', 't2']);

    const m3u = lib.exportPlaylistM3u8(pl.id);
    expect(m3u).toContain('#EXTM3U');
    expect(m3u).toContain('#EXTINF:354,Queen - Bohemian Rhapsody');
    expect(m3u).toContain('C:/Music/Rock/Queen - Bohemian Rhapsody.flac');
    expect(m3u).toContain('Miles Davis - So What.flac');
  });

  it('dynamically computes smart playlist memberships', () => {
    const playlists = lib.getPlaylists();
    const favorites = playlists.find((p) => p.smartCriteria === 'favorites');
    expect(favorites).toBeDefined();
    // t1 and t2 are marked isFavorite: true
    expect(favorites?.trackIds.length).toBe(2);
    expect(favorites?.trackIds).toContain('t1');
    expect(favorites?.trackIds).toContain('t2');
  });
});
