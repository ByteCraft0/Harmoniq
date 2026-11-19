import { describe, it, expect, beforeEach } from 'vitest';
import { calendarService } from '../services/calendarService';
import { queueManagerService } from '../services/queueManagerService';
import { playlistFolderService } from '../services/playlistFolderService';
import { bookmarkService } from '../services/bookmarkService';
import { sessionRecoveryService } from '../services/sessionRecoveryService';
import { libraryService } from '../services/libraryService';
import { historyService } from '../services/historyService';
import { TrackMetadata } from '../types/audio';
import { DEFAULT_SAVED_QUEUES } from '../types/queue';

// In-memory mock for localStorage in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (globalThis as any).localStorage = localStorageMock;
}

const mockTrack1: TrackMetadata = {
  id: 'track-1',
  filePath: '/music/song1.flac',
  fileName: 'song1.flac',
  fileSize: 1024000,
  dateModified: Date.now(),
  hasArtwork: false,
  title: 'Midnight Sonata',
  artist: 'Harmoniq Ensemble',
  album: 'Night Visions',
  duration: 240,
  codec: 'FLAC',
  container: 'flac',
  bitrate: 1411000,
  sampleRate: 44100,
  channels: 2,
  isLossless: true,
  playCount: 5,
  isFavorite: true,
};

const mockTrack2: TrackMetadata = {
  id: 'track-2',
  filePath: '/music/song2.mp3',
  fileName: 'song2.mp3',
  fileSize: 512000,
  dateModified: Date.now(),
  hasArtwork: false,
  title: 'Neon Drift',
  artist: 'Cyber Pulse',
  album: 'Retrowave Drive',
  duration: 180,
  codec: 'MP3',
  container: 'mp3',
  bitrate: 320000,
  sampleRate: 48000,
  channels: 2,
  isLossless: false,
  playCount: 2,
  isFavorite: false,
};

const mockTrack3: TrackMetadata = {
  id: 'track-3',
  filePath: '/music/song3.wav',
  fileName: 'song3.wav',
  fileSize: 2048000,
  dateModified: Date.now(),
  hasArtwork: false,
  title: 'Acoustic Sunrise',
  artist: 'Acoustic Dreams',
  album: 'Morning Mist',
  duration: 210,
  codec: 'WAV',
  container: 'wav',
  bitrate: 1411000,
  sampleRate: 44100,
  channels: 2,
  isLossless: true,
  playCount: 1,
  isFavorite: false,
};

describe('Harmoniq 2.0 – Phase 2: Music Collection & Organization', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // --------------------------------------------------------------------------
  // FEATURE 1: LISTENING CALENDAR
  // --------------------------------------------------------------------------
  describe('Feature 1: Listening Calendar (calendarService)', () => {
    it('calculates proper heatmap levels based on listening duration', () => {
      expect(calendarService.calculateHeatmapLevel(0)).toBe(0);
      expect(calendarService.calculateHeatmapLevel(500)).toBe(1); // < 15 min
      expect(calendarService.calculateHeatmapLevel(1200)).toBe(2); // 15-45 min
      expect(calendarService.calculateHeatmapLevel(3000)).toBe(3); // 45-90 min
      expect(calendarService.calculateHeatmapLevel(6000)).toBe(4); // >= 90 min
    });

    it('generates accurate monthly calendar grid with padding days', () => {
      const monthDays = calendarService.getCalendarDaysForMonth(2026, 10); // November 2026 (0-indexed: 10 = Nov)
      expect(monthDays.length).toBe(30);
      expect(monthDays[0].dayNumber).toBe(1);
      expect(monthDays[29].dayNumber).toBe(30);

      const monthData = calendarService.getMonthData(2026, 10);
      expect(monthData.daysInMonth).toBe(30);
      expect(monthData.firstDayOfWeek).toBeGreaterThanOrEqual(0);
      expect(monthData.firstDayOfWeek).toBeLessThanOrEqual(6);
    });

    it('aggregates daily listening timeline and summary correctly', () => {
      // Record playback history
      const now = Date.now();
      historyService.recordSession(mockTrack1, 240);
      historyService.recordSession(mockTrack1, 240);
      historyService.recordSession(mockTrack2, 180);

      const todayStr = calendarService.formatDateKey(new Date(now));
      const timeline = calendarService.getDailyTimeline(todayStr);

      expect(timeline.totalTracksPlayed).toBeGreaterThanOrEqual(3);
      expect(timeline.totalDurationSeconds).toBeGreaterThanOrEqual(660);
      expect(timeline.mostPlayedTrack?.title).toBe('Midnight Sonata');
      expect(timeline.events.length).toBeGreaterThanOrEqual(3);

      const summary = calendarService.getMonthlySummary(
        new Date(now).getFullYear(),
        new Date(now).getMonth()
      );
      expect(summary.totalSeconds).toBeGreaterThanOrEqual(660);
      expect(summary.totalTracks).toBeGreaterThanOrEqual(3);
      expect(summary.daysActive).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: MULTIPLE SAVED QUEUES
  // --------------------------------------------------------------------------
  describe('Feature 2: Multiple Saved Queues (queueManagerService)', () => {
    it('initializes default curated queues (Study, Night Drive, Workout, etc.)', () => {
      const queues = queueManagerService.getSavedQueues();
      expect(queues.length).toBeGreaterThanOrEqual(DEFAULT_SAVED_QUEUES.length);

      const names = queues.map((q) => q.name);
      expect(names).toContain('Study Queue');
      expect(names).toContain('Night Drive');
      expect(names).toContain('Workout');
      expect(names).toContain('Relaxation');
      expect(names).toContain('Weekend');
    });

    it('creates, renames, duplicates, and deletes saved queues', () => {
      const newQueue = queueManagerService.createQueue('Lo-Fi Focus', [mockTrack1, mockTrack2]);
      expect(newQueue.name).toBe('Lo-Fi Focus');
      expect(newQueue.trackIds.length).toBe(2);
      expect(newQueue.tracks?.length).toBe(2);

      // Rename
      const renamed = queueManagerService.renameQueue(newQueue.id, 'Deep Work');
      expect(renamed).toBe(true);
      expect(queueManagerService.getQueue(newQueue.id)?.name).toBe('Deep Work');

      // Duplicate
      const duplicated = queueManagerService.duplicateQueue(newQueue.id);
      expect(duplicated).not.toBeNull();
      expect(duplicated?.name).toBe('Deep Work (Copy)');
      expect(duplicated?.trackIds.length).toBe(2);
      expect(duplicated?.tracks?.length).toBe(2);

      // Delete
      const deleted = queueManagerService.deleteQueue(newQueue.id);
      expect(deleted).toBe(true);
      expect(queueManagerService.getQueue(newQueue.id)).toBeUndefined();
    });

    it('modifies tracks inside a saved queue (add, remove, reorder)', () => {
      const q = queueManagerService.createQueue('Test Queue', [mockTrack1, mockTrack2]);

      // Add track
      queueManagerService.addTrackToQueue(q.id, mockTrack3);
      expect(queueManagerService.getQueue(q.id)?.trackIds.length).toBe(3);
      expect(queueManagerService.getQueue(q.id)?.tracks?.length).toBe(3);

      // Remove track
      queueManagerService.removeTrackFromQueue(q.id, 0); // removes mockTrack1
      const updated = queueManagerService.getQueue(q.id);
      expect(updated?.trackIds.length).toBe(2);
      expect(updated?.trackIds[0]).toBe('track-2');

      // Reorder tracks
      queueManagerService.reorderQueueTracks(q.id, 0, 1);
      const reordered = queueManagerService.getQueue(q.id);
      expect(reordered?.trackIds[0]).toBe('track-3');
      expect(reordered?.trackIds[1]).toBe('track-2');
    });

    it('supports switching active queue preserving current playback', () => {
      const q1 = queueManagerService.createQueue('Switch Queue A', [mockTrack1]);
      const q2 = queueManagerService.createQueue('Switch Queue B', [mockTrack2]);

      queueManagerService.setActiveQueue(q1.id);
      expect(queueManagerService.getActiveQueueId()).toBe(q1.id);

      queueManagerService.setActiveQueue(q2.id);
      expect(queueManagerService.getActiveQueueId()).toBe(q2.id);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: PLAYLIST FOLDERS
  // --------------------------------------------------------------------------
  describe('Feature 3: Playlist Folders (playlistFolderService)', () => {
    it('creates, renames, and moves playlist folders', () => {
      const f1 = playlistFolderService.createFolder('Electronic');
      expect(f1.name).toBe('Electronic');
      expect(f1.parentId).toBeNull();

      // Rename
      playlistFolderService.renameFolder(f1.id, 'Synth & Electronic');
      expect(playlistFolderService.getFolder(f1.id)?.name).toBe('Synth & Electronic');

      // Subfolder
      const f2 = playlistFolderService.createFolder('Cyberpunk', f1.id);
      expect(f2.parentId).toBe(f1.id);

      // Cycle prevention
      const invalidMove = playlistFolderService.moveFolder(f1.id, f2.id);
      expect(invalidMove).toBe(false); // cannot move parent into child
    });

    it('moves playlists into folders and out of folders (root)', () => {
      const folder = playlistFolderService.createFolder('Favorites Group');
      const pl = libraryService.createPlaylist('Synthwave Hits');

      expect(pl.folderId).toBeNull();

      // Move into folder
      const moved = playlistFolderService.movePlaylistToFolder(pl.id, folder.id);
      expect(moved).toBe(true);
      expect(libraryService.getPlaylists().find((p) => p.id === pl.id)?.folderId).toBe(folder.id);

      // Move back to root
      playlistFolderService.movePlaylistToFolder(pl.id, null);
      expect(libraryService.getPlaylists().find((p) => p.id === pl.id)?.folderId).toBeNull();
    });

    it('SAFETY RULE: deleting a folder never deletes child playlists (moves them to root)', () => {
      const folder = playlistFolderService.createFolder('Temporary Folder');
      const pl1 = libraryService.createPlaylist('Safe Playlist 1');
      const pl2 = libraryService.createPlaylist('Safe Playlist 2');

      playlistFolderService.movePlaylistToFolder(pl1.id, folder.id);
      playlistFolderService.movePlaylistToFolder(pl2.id, folder.id);

      expect(libraryService.getPlaylists().find((p) => p.id === pl1.id)?.folderId).toBe(folder.id);
      expect(libraryService.getPlaylists().find((p) => p.id === pl2.id)?.folderId).toBe(folder.id);

      // Delete the folder
      const deleted = playlistFolderService.deleteFolder(folder.id);
      expect(deleted).toBe(true);
      expect(playlistFolderService.getFolder(folder.id)).toBeUndefined();

      // Both playlists MUST still exist, safely reassigned to root (folderId = null)
      const afterPl1 = libraryService.getPlaylists().find((p) => p.id === pl1.id);
      const afterPl2 = libraryService.getPlaylists().find((p) => p.id === pl2.id);

      expect(afterPl1).toBeDefined();
      expect(afterPl2).toBeDefined();
      expect(afterPl1?.folderId).toBeNull();
      expect(afterPl2?.folderId).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: PLAYLIST HISTORY & VERSION RESTORATION
  // --------------------------------------------------------------------------
  describe('Feature 4: Playlist History & Version Restoration', () => {
    it('records playlist modification snapshots and actions', () => {
      const pl = libraryService.createPlaylist('History Test');
      playlistFolderService.recordHistory(pl.id, 'created', 'Created playlist', []);

      libraryService.addTracksToPlaylist(pl.id, [mockTrack1.id, mockTrack2.id]);
      playlistFolderService.recordHistory(
        pl.id,
        'tracks_added',
        'Added 2 tracks',
        [mockTrack1.id, mockTrack2.id]
      );

      const history = playlistFolderService.getHistoryForPlaylist(pl.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].action).toBe('tracks_added');
      expect(history[0].trackCount).toBe(2);
      expect(history[0].snapshotTrackIds).toEqual([mockTrack1.id, mockTrack2.id]);
    });

    it('restores previous playlist version faithfully from snapshot', () => {
      const pl = libraryService.createPlaylist('Restore Test');
      const v1Snapshot = [mockTrack1.id, mockTrack2.id];

      // Version 1 snapshot
      const v1Entry = playlistFolderService.recordHistory(
        pl.id,
        'tracks_added',
        'Version 1 with 2 tracks',
        v1Snapshot
      );

      // Now add a 3rd track (Version 2)
      libraryService.addTracksToPlaylist(pl.id, [mockTrack1.id, mockTrack2.id, mockTrack3.id]);
      expect(libraryService.getPlaylists().find((p) => p.id === pl.id)?.trackIds.length).toBe(3);

      // Restore Version 1
      const restored = playlistFolderService.restoreVersion(pl.id, v1Entry.id);
      expect(restored).toBe(true);

      const updatedPl = libraryService.getPlaylists().find((p) => p.id === pl.id);
      expect(updatedPl?.trackIds).toEqual(v1Snapshot);
      expect(updatedPl?.trackIds.length).toBe(2);

      // Verify restore is recorded in history
      const latestHistory = playlistFolderService.getHistoryForPlaylist(pl.id);
      expect(latestHistory[0].action).toBe('restored');
    });

    it('caps history entries at 30 to prevent unbounded memory growth', () => {
      const pl = libraryService.createPlaylist('Cap Test');
      for (let i = 0; i < 40; i++) {
        playlistFolderService.recordHistory(pl.id, 'tracks_reordered', `Step ${i}`, [mockTrack1.id]);
      }

      const history = playlistFolderService.getHistoryForPlaylist(pl.id);
      expect(history.length).toBeLessThanOrEqual(30);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: MUSIC BOOKMARKS
  // --------------------------------------------------------------------------
  describe('Feature 5: Music Bookmarks (bookmarkService)', () => {
    it('creates, sorts, updates, and deletes track bookmarks', () => {
      const bm1 = bookmarkService.addBookmark('track-1', 'Guitar Solo', 65.5, 'Incredible riff');
      const bm2 = bookmarkService.addBookmark('track-1', 'Intro Beat', 12.0, 'Crisp 808s');
      const bm3 = bookmarkService.addBookmark('track-1', 'Outro Drop', 180.2);

      const track1Bookmarks = bookmarkService.getBookmarksForTrack('track-1');
      expect(track1Bookmarks.length).toBe(3);

      // Must be sorted chronologically by timestamp
      expect(track1Bookmarks[0].timestamp).toBe(12.0);
      expect(track1Bookmarks[0].title).toBe('Intro Beat');
      expect(track1Bookmarks[1].timestamp).toBe(65.5);
      expect(track1Bookmarks[2].timestamp).toBe(180.2);

      // Update
      const updated = bookmarkService.updateBookmark(bm1.id, {
        title: 'Master Guitar Solo',
        note: 'Solo starts here',
      });
      expect(updated).toBe(true);
      const fetched = bookmarkService.getBookmark(bm1.id);
      expect(fetched?.title).toBe('Master Guitar Solo');
      expect(fetched?.note).toBe('Solo starts here');

      // Delete
      const deleted = bookmarkService.deleteBookmark(bm2.id);
      expect(deleted).toBe(true);
      expect(bookmarkService.getBookmarksForTrack('track-1').length).toBe(2);
    });

    it('correctly formats timestamps for bookmarks', () => {
      expect(bookmarkService.formatTimestamp(0)).toBe('0:00');
      expect(bookmarkService.formatTimestamp(45)).toBe('0:45');
      expect(bookmarkService.formatTimestamp(75)).toBe('1:15');
      expect(bookmarkService.formatTimestamp(3665)).toBe('1:01:05');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: QUEUE RECOVERY & SESSION PERSISTENCE
  // --------------------------------------------------------------------------
  describe('Feature 6: Playback Session & Queue Recovery (sessionRecoveryService)', () => {
    it('manages session settings and respects restoreSessionOnLaunch flag', () => {
      sessionRecoveryService.updateSettings({
        restoreSessionOnLaunch: true,
        autoResumePlaybackOnLaunch: false,
      });

      expect(sessionRecoveryService.getSettings().restoreSessionOnLaunch).toBe(true);
      expect(sessionRecoveryService.getSettings().autoResumePlaybackOnLaunch).toBe(false);

      // Save session immediately
      sessionRecoveryService.saveSessionImmediate({
        currentTrackId: mockTrack1.id,
        playbackPosition: 85.5,
        queueTrackIds: [mockTrack1.id, mockTrack2.id],
        currentQueueIndex: 0,
        isShuffle: true,
        repeatMode: 'all',
        volume: 0.85,
        activeView: 'home',
      });

      const saved = sessionRecoveryService.getSavedSession();
      expect(saved).not.toBeNull();
      expect(saved?.currentTrackId).toBe('track-1');
      expect(saved?.playbackPosition).toBe(85.5);
      expect(saved?.queueTrackIds.length).toBe(2);
      expect(saved?.isShuffle).toBe(true);
      expect(saved?.repeatMode).toBe('all');

      // When restoreSessionOnLaunch is disabled, returns null
      sessionRecoveryService.updateSettings({ restoreSessionOnLaunch: false });
      expect(sessionRecoveryService.getSavedSession()).toBeNull();

      // Clear session
      sessionRecoveryService.clearSession();
      sessionRecoveryService.updateSettings({ restoreSessionOnLaunch: true });
      expect(sessionRecoveryService.getSavedSession()).toBeNull();
    });
  });
});
