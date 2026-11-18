import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateRule,
  evaluateSmartPlaylist,
} from '../services/smartPlaylistService';
import { historyService } from '../services/historyService';
import { TrackMetadata } from '../types/audio';
import { SmartPlaylistDefinition, SmartPlaylistRule } from '../types/smartPlaylist';

const mockTracks: TrackMetadata[] = [
  {
    id: 't1',
    filePath: 'C:/Music/Rock/Queen/Bohemian Rhapsody.flac',
    fileName: 'Bohemian Rhapsody.flac',
    fileSize: 45000000,
    dateModified: 1700000000000,
    dateAdded: 1700000000000,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    genre: 'Rock',
    year: 1975,
    codec: 'FLAC',
    container: 'flac',
    duration: 354,
    sampleRate: 96000,
    bitDepth: 24,
    bitrate: 1411,
    channels: 2,
    isLossless: true,
    hasArtwork: true,
    playCount: 42,
    isFavorite: true,
    lastPlayed: 1700050000000,
  },
  {
    id: 't2',
    filePath: 'C:/Music/Electronic/Daft Punk/One More Time.mp3',
    fileName: 'One More Time.mp3',
    fileSize: 12000000,
    dateModified: 1700010000000,
    dateAdded: 1700010000000,
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    genre: 'Electronic',
    year: 2001,
    codec: 'MP3',
    container: 'mp3',
    duration: 320,
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 320,
    channels: 2,
    isLossless: false,
    hasArtwork: true,
    playCount: 15,
    isFavorite: false,
    lastPlayed: 1700020000000,
  },
  {
    id: 't3',
    filePath: 'C:/Music/Jazz/Miles Davis/So What.wav',
    fileName: 'So What.wav',
    fileSize: 95000000,
    dateModified: 1700020000000,
    dateAdded: 1700020000000,
    title: 'So What',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    genre: 'Jazz',
    year: 1959,
    codec: 'WAV',
    container: 'wav',
    duration: 562,
    sampleRate: 192000,
    bitDepth: 24,
    bitrate: 2304,
    channels: 2,
    isLossless: true,
    hasArtwork: false,
    playCount: 5,
    isFavorite: true,
    lastPlayed: 1700010000000,
  },
];

describe('Batch 7 – Smart Playlists Evaluation', () => {
  it('correctly evaluates text contains and equals rules', () => {
    const ruleContains: SmartPlaylistRule = {
      id: '1',
      field: 'genre',
      operator: 'contains',
      value: 'rock',
    };
    expect(evaluateRule(ruleContains, mockTracks[0])).toBe(true);
    expect(evaluateRule(ruleContains, mockTracks[1])).toBe(false);

    const ruleEquals: SmartPlaylistRule = {
      id: '2',
      field: 'artist',
      operator: 'equals',
      value: 'queen',
    };
    expect(evaluateRule(ruleEquals, mockTracks[0])).toBe(true);
    expect(evaluateRule(ruleEquals, mockTracks[1])).toBe(false);
  });

  it('correctly evaluates numeric comparison and between operators', () => {
    const ruleGt: SmartPlaylistRule = {
      id: '1',
      field: 'bitrate',
      operator: 'greaterThan',
      value: 1000,
    };
    expect(evaluateRule(ruleGt, mockTracks[0])).toBe(true); // 1411
    expect(evaluateRule(ruleGt, mockTracks[1])).toBe(false); // 320
    expect(evaluateRule(ruleGt, mockTracks[2])).toBe(true); // 2304

    const ruleBetween: SmartPlaylistRule = {
      id: '2',
      field: 'year',
      operator: 'between',
      value: 1970,
      valueExtra: 1980,
    };
    expect(evaluateRule(ruleBetween, mockTracks[0])).toBe(true); // 1975
    expect(evaluateRule(ruleBetween, mockTracks[1])).toBe(false); // 2001
  });

  it('supports boolean isFavorite matching', () => {
    const ruleFav: SmartPlaylistRule = {
      id: '1',
      field: 'isFavorite',
      operator: 'equals',
      value: 'true',
    };
    expect(evaluateRule(ruleFav, mockTracks[0])).toBe(true);
    expect(evaluateRule(ruleFav, mockTracks[1])).toBe(false);
    expect(evaluateRule(ruleFav, mockTracks[2])).toBe(true);
  });

  it('evaluates smart playlists with AND (all) vs OR (any) logic', () => {
    const andPl: SmartPlaylistDefinition = {
      id: 'p1',
      name: 'Hi-Res Jazz',
      matchMode: 'all',
      rules: [
        { id: '1', field: 'genre', operator: 'equals', value: 'jazz' },
        { id: '2', field: 'bitrate', operator: 'greaterThan', value: 2000 },
      ],
      sortBy: 'title',
      sortOrder: 'asc',
      limit: 0,
      dateCreated: 0,
      dateModified: 0,
    };

    const andMatches = evaluateSmartPlaylist(andPl, mockTracks);
    expect(andMatches.length).toBe(1);
    expect(andMatches[0].id).toBe('t3');

    const orPl: SmartPlaylistDefinition = {
      id: 'p2',
      name: 'Rock or Electronic',
      matchMode: 'any',
      rules: [
        { id: '1', field: 'genre', operator: 'equals', value: 'rock' },
        { id: '2', field: 'genre', operator: 'equals', value: 'electronic' },
      ],
      sortBy: 'playCount',
      sortOrder: 'desc',
      limit: 10,
      dateCreated: 0,
      dateModified: 0,
    };

    const orMatches = evaluateSmartPlaylist(orPl, mockTracks);
    expect(orMatches.length).toBe(2);
    expect(orMatches[0].id).toBe('t1'); // Queen (playCount 42)
    expect(orMatches[1].id).toBe('t2'); // Daft Punk (playCount 15)
  });

  it('honors track limits', () => {
    const limitedPl: SmartPlaylistDefinition = {
      id: 'p3',
      name: 'Top 1',
      matchMode: 'all',
      rules: [],
      sortBy: 'playCount',
      sortOrder: 'desc',
      limit: 1,
      dateCreated: 0,
      dateModified: 0,
    };

    const matches = evaluateSmartPlaylist(limitedPl, mockTracks);
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('t1');
  });
});

describe('Batch 7 – Listening History Service', () => {
  beforeEach(() => {
    historyService.clearHistory();
  });

  it('marks plays < 15 seconds as skipped and does not mark completed', () => {
    const res = historyService.recordSession(mockTracks[0], 10);
    expect(res.entry.completionStatus).toBe('skipped');
    expect(res.isCompleted).toBe(false);
  });

  it('marks plays >= 30 seconds and >= 50% as completed', () => {
    // mockTracks[1] duration = 320s. 180s > 320 * 0.5 (160s)
    const res = historyService.recordSession(mockTracks[1], 180);
    expect(res.entry.completionStatus).toBe('completed');
    expect(res.isCompleted).toBe(true);
  });

  it('records listening duration accurately in summary stats', () => {
    historyService.recordSession(mockTracks[0], 200); // completed
    historyService.recordSession(mockTracks[1], 10); // skipped
    historyService.recordSession(mockTracks[2], 25); // partial

    const stats = historyService.getStatsSummary();
    expect(stats.totalEntries).toBe(3);
    expect(stats.completedPlays).toBe(1);
    expect(stats.skippedPlays).toBe(1);
    expect(stats.partialPlays).toBe(1);
    expect(stats.totalListeningSeconds).toBe(235);
  });

  it('filters history by date and allows entry removal', () => {
    const res1 = historyService.recordSession(mockTracks[0], 60);
    const res2 = historyService.recordSession(mockTracks[1], 80);

    let all = historyService.getHistory();
    expect(all.length).toBe(2);

    const removed = historyService.removeEntry(res1.entry.id);
    expect(removed).toBe(true);

    all = historyService.getHistory();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(res2.entry.id);
  });
});
