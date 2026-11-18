import { describe, it, expect } from 'vitest';
import { discoveryService, MOOD_DEFINITIONS } from '../services/discoveryService';
import { TrackMetadata } from '../types/audio';
import { Artist } from '../types/library';

const mockTracks: TrackMetadata[] = [
  {
    id: 'm1',
    filePath: 'C:/Music/Miles Davis/Blue in Green.flac',
    fileName: 'Blue in Green.flac',
    fileSize: 1000,
    dateModified: 0,
    title: 'Blue in Green',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    genre: 'Cool Jazz',
    duration: 337,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 96000,
    bitrate: 1411,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 10,
    isFavorite: true,
  },
  {
    id: 'm2',
    filePath: 'C:/Music/Metallica/Enter Sandman.flac',
    fileName: 'Enter Sandman.flac',
    fileSize: 1000,
    dateModified: 0,
    title: 'Enter Sandman',
    artist: 'Metallica',
    album: 'Metallica',
    genre: 'Heavy Metal',
    duration: 331,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 44100,
    bitrate: 1000,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 8,
    isFavorite: false,
  },
  {
    id: 'm3',
    filePath: 'C:/Music/Tycho/Awake.mp3',
    fileName: 'Awake.mp3',
    fileSize: 1000,
    dateModified: 0,
    title: 'Awake',
    artist: 'Tycho',
    album: 'Awake',
    genre: 'Ambient Downtempo',
    duration: 283,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: true,
    playCount: 15,
    isFavorite: true,
  },
];

describe('Batch 9 – Deterministic Mood Discovery', () => {
  it('categorizes tracks by mood rules based on genre keywords without AI', () => {
    const chillTracks = discoveryService.getTracksForMood('Chill', mockTracks);
    expect(chillTracks.some((t) => t.id === 'm3')).toBe(true); // Ambient Downtempo

    const energeticTracks = discoveryService.getTracksForMood('Energetic', mockTracks);
    expect(energeticTracks.some((t) => t.id === 'm2')).toBe(true); // Heavy Metal

    const relaxTracks = discoveryService.getTracksForMood('Relax', mockTracks);
    expect(relaxTracks.some((t) => t.id === 'm1')).toBe(true); // Cool Jazz
  });

  it('allows user to toggle custom mood tags', () => {
    // Manually tag Metallica as "Relax"
    const tagged = discoveryService.toggleTrackMood('m2', 'Relax');
    expect(tagged).toBe(true);

    const relaxTracks = discoveryService.getTracksForMood('Relax', mockTracks);
    expect(relaxTracks.some((t) => t.id === 'm2')).toBe(true);

    // Toggle off
    const untagged = discoveryService.toggleTrackMood('m2', 'Relax');
    expect(untagged).toBe(false);
  });
});

describe('Batch 9 – Similar Artist Recommendations', () => {
  it('computes similarity based on shared genres and musical eras', () => {
    const artistA: Artist = {
      id: 'art_a',
      name: 'Pink Floyd',
      albumCount: 1,
      trackCount: 1,
      albums: [
        {
          id: 'alb_a',
          title: 'The Dark Side of the Moon',
          artist: 'Pink Floyd',
          year: 1973,
          trackCount: 1,
          totalDuration: 2500,
          tracks: [
            {
              id: 'ta',
              filePath: '',
              fileName: '',
              fileSize: 0,
              dateModified: 0,
              title: 'Time',
              artist: 'Pink Floyd',
              album: 'The Dark Side of the Moon',
              genre: 'Progressive Rock',
              year: 1973,
              duration: 413,
              codec: 'FLAC',
              container: 'flac',
              sampleRate: 44100,
              bitrate: 1000,
              channels: 2,
              isLossless: true,
              hasArtwork: false,
              playCount: 10,
              isFavorite: true,
            },
          ],
        },
      ],
    };

    const artistB: Artist = {
      id: 'art_b',
      name: 'King Crimson',
      albumCount: 1,
      trackCount: 1,
      albums: [
        {
          id: 'alb_b',
          title: 'Red',
          artist: 'King Crimson',
          year: 1974,
          trackCount: 1,
          totalDuration: 2400,
          tracks: [
            {
              id: 'tb',
              filePath: '',
              fileName: '',
              fileSize: 0,
              dateModified: 0,
              title: 'Starless',
              artist: 'King Crimson',
              album: 'Red',
              genre: 'Progressive Rock',
              year: 1974,
              duration: 738,
              codec: 'FLAC',
              container: 'flac',
              sampleRate: 44100,
              bitrate: 1000,
              channels: 2,
              isLossless: true,
              hasArtwork: false,
              playCount: 5,
              isFavorite: false,
            },
          ],
        },
      ],
    };

    const artistC: Artist = {
      id: 'art_c',
      name: 'Daft Punk',
      albumCount: 1,
      trackCount: 1,
      albums: [
        {
          id: 'alb_c',
          title: 'Discovery',
          artist: 'Daft Punk',
          year: 2001,
          trackCount: 1,
          totalDuration: 3000,
          tracks: [
            {
              id: 'tc',
              filePath: '',
              fileName: '',
              fileSize: 0,
              dateModified: 0,
              title: 'One More Time',
              artist: 'Daft Punk',
              album: 'Discovery',
              genre: 'French House',
              year: 2001,
              duration: 320,
              codec: 'MP3',
              container: 'mp3',
              sampleRate: 44100,
              bitrate: 320,
              channels: 2,
              isLossless: false,
              hasArtwork: false,
              playCount: 20,
              isFavorite: true,
            },
          ],
        },
      ],
    };

    const similar = discoveryService.findSimilarArtists(artistA, [artistA, artistB, artistC]);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar[0].artist.name).toBe('King Crimson');
    expect(similar[0].reasons.some((r) => r.includes('Progressive Rock'))).toBe(true);
    expect(similar[0].reasons.some((r) => r.includes('1970s'))).toBe(true);
  });
});
