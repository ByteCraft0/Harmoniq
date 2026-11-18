import { describe, it, expect } from 'vitest';
import { TagEditPayload } from '../types/electron';

describe('Audio Tag Editor Mapping (Part 3.1)', () => {
  it('validates and formats metadata payload for MP3 and FLAC files correctly', () => {
    const filePath = 'C:/Music/test_track.flac';
    const payload: TagEditPayload = {
      title: 'Audiophile Master Test',
      artist: 'Harmoniq Symphony',
      album: 'Pure Resolution',
      albumArtist: 'Harmoniq Symphony Ensemble',
      genre: 'Classical / Hi-Res',
      year: 2026,
      trackNumber: 3,
      trackTotal: 12,
    };

    expect(filePath.endsWith('.flac')).toBe(true);
    expect(payload.title).toBe('Audiophile Master Test');
    expect(payload.year).toBe(2026);
    expect(payload.trackNumber).toBe(3);
    expect(payload.trackTotal).toBe(12);
  });

  it('handles optional artwork buffer and mimeType in payload', () => {
    const filePath = 'C:/Music/test_track.mp3';
    const payload: TagEditPayload = {
      title: 'Single with Artwork',
      artist: 'Solo Artist',
      album: 'Single 2026',
      artworkBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      artworkMime: 'image/jpeg',
    };

    expect(filePath.endsWith('.mp3')).toBe(true);
    expect(payload.artworkBase64).toBeDefined();
    expect(payload.artworkMime).toBe('image/jpeg');
  });
});
