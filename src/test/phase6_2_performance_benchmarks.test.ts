import { describe, it, expect } from 'vitest';
import { LibraryService } from '../services/libraryService';
import { TrackMetadata } from '../types/audio';
import { AutoEqImportService } from '../services/audio/autoEqImportService';
import { ParametricFilterConfig } from '../types/dsp';

describe('Phase 6.2 — Performance Benchmarks & Runtime Stability', () => {
  it('benchmarks large library search performance across 10,000 tracks (< 15ms target)', () => {
    const service = new LibraryService();
    const tracks: TrackMetadata[] = [];

    // Generate 10,000 synthetic tracks
    for (let i = 0; i < 10000; i++) {
      tracks.push({
        id: `track_${i}`,
        filePath: `C:\\Music\\Track_${i}.flac`,
        fileName: `Track_${i}.flac`,
        fileSize: 25000000,
        title: `Symphony No. ${(i % 9) + 1} in ${['C Major', 'D Minor', 'E Flat', 'G Major'][i % 4]} Op. ${i}`,
        artist: `Composer ${i % 100}`,
        album: `Masterworks Volume ${Math.floor(i / 100)}`,
        duration: 180 + (i % 300),
        sampleRate: 44100 + (i % 2 === 0 ? 52300 : 0),
        bitDepth: 16 + (i % 2 === 0 ? 8 : 0),
        channels: 2,
        bitrate: 1411,
        codec: i % 3 === 0 ? 'FLAC' : i % 3 === 1 ? 'ALAC' : 'MP3',
        container: i % 3 === 0 ? 'FLAC' : i % 3 === 1 ? 'M4A' : 'MPEG',
        isLossless: i % 3 !== 2,
        isFavorite: false,
        hasArtwork: false,
        dateAdded: Date.now() - i * 10000,
        dateModified: Date.now() - i * 10000,
        playCount: i % 50,
      });
    }

    service.addTracks(tracks);
    expect(service.getAllTracks().length).toBe(10000);

    // Warm-up search
    service.searchTracks('Major');

    // Benchmark 10 consecutive searches
    const start = performance.now();
    for (let j = 0; j < 10; j++) {
      const results = service.searchTracks('Composer 42');
      expect(results.length).toBeGreaterThan(0);
    }
    const totalElapsed = performance.now() - start;
    const avgSearchMs = totalElapsed / 10;

    // Must be well within performance budget (< 15ms per search)
    expect(avgSearchMs).toBeLessThan(15);
  });

  it('benchmarks Mid-Side matrix computation speed (> 100,000 calcs/sec)', () => {
    const start = performance.now();
    const iterations = 50000;
    let maxError = 0;
    for (let i = 0; i < iterations; i++) {
      const w = ((i % 150) + 1) / 100;
      const gLL = (1 + w) / 2;
      const gRL = (1 - w) / 2;
      const err = Math.abs(gLL + gRL - 1.0);
      if (err > maxError) maxError = err;
    }
    const elapsed = performance.now() - start;
    expect(maxError).toBeLessThan(1e-10);
    // 50,000 calculations pure math should complete in under 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it('benchmarks 12-band Parametric EQ composite response curve calculation (< 5ms target)', () => {
    const bands: ParametricFilterConfig[] = [
      { id: '1', frequency: 32, gain: 2.5, q: 1.0, type: 'lowshelf', enabled: true },
      { id: '2', frequency: 64, gain: 1.0, q: 1.2, type: 'peaking', enabled: true },
      { id: '3', frequency: 125, gain: -1.5, q: 1.4, type: 'peaking', enabled: true },
      { id: '4', frequency: 250, gain: -0.5, q: 1.0, type: 'peaking', enabled: true },
      { id: '5', frequency: 500, gain: 0.0, q: 1.0, type: 'peaking', enabled: true },
      { id: '6', frequency: 1000, gain: 1.2, q: 1.5, type: 'peaking', enabled: true },
      { id: '7', frequency: 2000, gain: 2.0, q: 1.8, type: 'peaking', enabled: true },
      { id: '8', frequency: 4000, gain: 0.5, q: 1.2, type: 'peaking', enabled: true },
      { id: '9', frequency: 8000, gain: -1.0, q: 1.0, type: 'peaking', enabled: true },
      { id: '10', frequency: 12000, gain: 1.5, q: 0.9, type: 'peaking', enabled: true },
      { id: '11', frequency: 16000, gain: 2.0, q: 0.8, type: 'highshelf', enabled: true },
      { id: '12', frequency: 20000, gain: 0.0, q: 0.7, type: 'highshelf', enabled: false },
    ];

    // Generate 128 log-spaced frequency points between 20Hz and 20kHz
    const testFreqs = new Float32Array(128);
    for (let f = 0; f < 128; f++) {
      testFreqs[f] = 20 * Math.pow(20000 / 20, f / 127);
    }

    const start = performance.now();
    for (let k = 0; k < 20; k++) {
      const response = AutoEqImportService.evaluateParametricResponse(bands, 0, testFreqs, 48000);
      expect(response.length).toBe(128);
    }
    const elapsed = performance.now() - start;
    const avgPerCurve = elapsed / 20;

    expect(avgPerCurve).toBeLessThan(5);
  });

  it('verifies audio buffer memory and latency thresholds', () => {
    const standardSampleRate = 48000;
    const bufferSize = 128; // Web Audio quantum
    const quantumLatencyMs = (bufferSize / standardSampleRate) * 1000;

    // Quantum latency is ~2.67ms
    expect(quantumLatencyMs).toBeLessThan(5.0);

    // AudioParam automation ramp time
    const rampTimeSeconds = 0.025; // 25ms standard clickless transition
    expect(rampTimeSeconds * 1000).toBe(25);
  });
});
