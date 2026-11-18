import { describe, it, expect } from 'vitest';
import { maintenanceService } from '../services/maintenanceService';
import { TrackMetadata } from '../types/audio';
import { Album } from '../types/library';

const mockTracksForDuplicates: TrackMetadata[] = [
  {
    id: 't_original_flac',
    filePath: 'C:/Music/Pink Floyd/Comfortably Numb.flac',
    fileName: 'Comfortably Numb.flac',
    fileSize: 65000000,
    dateModified: 1700000000000,
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    duration: 382,
    codec: 'FLAC',
    container: 'flac',
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 1500,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 10,
    isFavorite: true,
  },
  {
    id: 't_duplicate_mp3',
    filePath: 'C:/Downloads/Comfortably Numb (Remastered).mp3',
    fileName: 'Comfortably Numb (Remastered).mp3',
    fileSize: 9000000,
    dateModified: 1700010000000,
    title: 'Comfortably Numb (Remastered)',
    artist: 'Pink Floyd',
    album: 'The Wall [Deluxe]',
    duration: 383,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: false,
    playCount: 1,
    isFavorite: false,
  },
  {
    id: 't_exact_dup_1',
    filePath: 'C:/Music/Backups/TrackA.mp3',
    fileName: 'TrackA.mp3',
    fileSize: 5242880,
    dateModified: 1700020000000,
    title: 'Track A',
    artist: 'Artist A',
    album: 'Album A',
    duration: 180,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: true,
    playCount: 0,
    isFavorite: false,
  },
  {
    id: 't_exact_dup_2',
    filePath: 'C:/Music/Copies/TrackA_copy.mp3',
    fileName: 'TrackA_copy.mp3',
    fileSize: 5242880,
    dateModified: 1700030000000,
    title: 'Track A Copy',
    artist: 'Artist A',
    album: 'Album A',
    duration: 180,
    codec: 'MP3',
    container: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: true,
    playCount: 0,
    isFavorite: false,
  },
];

describe('Batch 8 – Duplicate Track Detection', () => {
  it('detects exact file duplicates by identical size and duration', () => {
    const duplicates = maintenanceService.findDuplicates(mockTracksForDuplicates);
    const exactGroup = duplicates.find((g) => g.matchType === 'exact');
    expect(exactGroup).toBeDefined();
    expect(exactGroup!.tracks.length).toBe(2);
    expect(exactGroup!.tracks.some((t) => t.id === 't_exact_dup_1')).toBe(true);
    expect(exactGroup!.tracks.some((t) => t.id === 't_exact_dup_2')).toBe(true);
  });

  it('detects fuzzy metadata duplicates (clean title + artist + length within 3s)', () => {
    const duplicates = maintenanceService.findDuplicates(mockTracksForDuplicates);
    const metaGroup = duplicates.find((g) => g.matchType === 'fuzzy_metadata');
    expect(metaGroup).toBeDefined();
    expect(metaGroup!.tracks.length).toBe(2);
    expect(metaGroup!.tracks.some((t) => t.id === 't_original_flac')).toBe(true);
    expect(metaGroup!.tracks.some((t) => t.id === 't_duplicate_mp3')).toBe(true);
  });

  it('picks the lossless Hi-Res track as the recommended keep track', () => {
    const duplicates = maintenanceService.findDuplicates(mockTracksForDuplicates);
    const metaGroup = duplicates.find((g) => g.matchType === 'fuzzy_metadata');
    expect(metaGroup!.recommendedKeepId).toBe('t_original_flac'); // FLAC lossless 96kHz preferred over MP3 320k
  });
});

describe('Batch 8 – Missing Artwork Detection', () => {
  it('identifies albums and tracks lacking artwork', () => {
    const mockAlbums: Album[] = [
      {
        id: 'alb1',
        title: 'With Artwork',
        artist: 'Artist',
        artworkDataUrl: 'data:image/png;base64,abc',
        trackCount: 1,
        totalDuration: 180,
        tracks: [],
      },
      {
        id: 'alb2',
        title: 'Without Artwork',
        artist: 'Artist',
        artworkDataUrl: undefined,
        trackCount: 1,
        totalDuration: 180,
        tracks: [],
      },
    ];

    const res = maintenanceService.findMissingArtwork(mockAlbums, mockTracksForDuplicates);
    expect(res.missingAlbums.length).toBe(1);
    expect(res.missingAlbums[0].id).toBe('alb2');
    expect(res.missingTracks.some((t) => t.id === 't_duplicate_mp3')).toBe(true);
  });
});

describe('Batch 8 – Bulk Metadata Updates', () => {
  it('preserves untouched metadata fields while applying updated fields', async () => {
    const tracksToEdit: TrackMetadata[] = [
      {
        id: 'edit_1',
        filePath: 'C:/Music/Track1.mp3',
        fileName: 'Track1.mp3',
        fileSize: 1000,
        dateModified: 0,
        title: 'Original Title 1',
        artist: 'Original Artist',
        album: 'Old Album',
        duration: 200,
        codec: 'MP3',
        container: 'mp3',
        sampleRate: 44100,
        bitrate: 320,
        channels: 2,
        isLossless: false,
        hasArtwork: false,
        playCount: 5,
        isFavorite: true,
      },
    ];

    const result = await maintenanceService.bulkUpdateMetadata(tracksToEdit, {
      artist: 'New Artist Name',
      year: 2024,
      // title, album, isFavorite, playCount untouched
    });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });
});
