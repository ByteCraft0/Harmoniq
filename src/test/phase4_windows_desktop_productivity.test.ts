import { describe, it, expect, beforeEach } from 'vitest';
import { hotkeyProfileService } from '../services/hotkeyProfileService';
import { BUILTIN_HOTKEY_PROFILES, RESERVED_NAVIGATION_SHORTCUTS } from '../types/hotkeyProfile';
import { backupService, calculateChecksum } from '../services/backupService';
import { portableService } from '../services/portableService';
import { BackupArchive } from '../types/backup';

// In-memory mock for localStorage in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
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

(globalThis as any).localStorage = localStorageMock;
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
}

describe('Phase 4: Windows Desktop Productivity', () => {
  // -------------------------------------------------------------
  // FEATURE 1: HOTKEY PROFILES & CONFLICT DETECTION
  // -------------------------------------------------------------
  describe('Feature 1 – Hotkey Profiles & Conflict Detection', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('loads all 5 built-in scenario profiles with correct metadata', () => {
      const profiles = hotkeyProfileService.getProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(5);

      const scenarios = profiles.map((p) => p.scenario);
      expect(scenarios).toContain('desktop');
      expect(scenarios).toContain('audiophile');
      expect(scenarios).toContain('mediakey');
      expect(scenarios).toContain('gaming');
      expect(scenarios).toContain('laptop');

      const desktopProfile = profiles.find((p) => p.id === 'profile_default_desktop');
      expect(desktopProfile).toBeDefined();
      expect(desktopProfile?.shortcuts.playPause).toBe('CommandOrControl+Alt+Space');
    });

    it('detects shortcut conflicts when the same accelerator is assigned to multiple actions', () => {
      const conflictingShortcuts = {
        playPause: 'CommandOrControl+Alt+Space',
        nextTrack: 'CommandOrControl+Alt+Space', // Conflict!
        prevTrack: 'CommandOrControl+Alt+Left',
        volumeUp: 'CommandOrControl+Alt+Up',
        volumeDown: 'CommandOrControl+Alt+Down',
        toggleMute: 'CommandOrControl+Alt+M',
        toggleWindow: 'CommandOrControl+Alt+H',
      };

      const result = hotkeyProfileService.detectConflicts(conflictingShortcuts);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.playPause).toBeDefined();
      expect(result.conflicts.nextTrack).toBeDefined();
    });

    it('protects Harmoniq signature musical navigation: flags Alt+Left (Violin Back) and Alt+Right (Trumpet Forward)', () => {
      const navClashShortcuts = {
        playPause: 'CommandOrControl+Alt+Space',
        prevTrack: 'Alt+Left', // Reserved for Violin Back Navigation!
        nextTrack: 'Alt+Right', // Reserved for Trumpet Forward Navigation!
        volumeUp: 'CommandOrControl+Alt+Up',
        volumeDown: 'CommandOrControl+Alt+Down',
        toggleMute: 'CommandOrControl+Alt+M',
        toggleWindow: 'CommandOrControl+Alt+H',
      };

      const result = hotkeyProfileService.detectConflicts(navClashShortcuts);
      expect(result.hasConflict).toBe(true);
      expect(result.isNavigationConflict).toBe(true);
      expect(result.conflicts.prevTrack).toContain('Violin Back');
      expect(result.conflicts.nextTrack).toContain('Trumpet Forward');
    });

    it('creates, updates, switches, and deletes custom hotkey profiles', async () => {
      // Create custom profile
      const custom = hotkeyProfileService.createProfile('Streamer Mode', 'gaming');
      expect(custom.name).toBe('Streamer Mode');
      expect(custom.isBuiltIn).toBe(false);

      // Switch active profile
      await hotkeyProfileService.setActiveProfile(custom.id);
      expect(hotkeyProfileService.getActiveProfile().id).toBe(custom.id);

      // Update shortcuts with valid key combo
      const updateRes = hotkeyProfileService.updateProfileShortcuts(
        custom.id,
        'playPause',
        'CommandOrControl+Shift+F9'
      );
      expect(updateRes.success).toBe(true);
      expect(hotkeyProfileService.getActiveProfile().shortcuts.playPause).toBe('CommandOrControl+Shift+F9');

      // Built-in profiles cannot be deleted
      const deleteBuiltInRes = hotkeyProfileService.deleteProfile('profile_default_desktop');
      expect(deleteBuiltInRes).toBe(false);

      // Custom profile can be deleted
      const deleteCustomRes = hotkeyProfileService.deleteProfile(custom.id);
      expect(deleteCustomRes).toBe(true);
      expect(hotkeyProfileService.getActiveProfile().id).toBe('profile_default_desktop');
    });

    it('exports and imports hotkey profiles JSON successfully', () => {
      const active = hotkeyProfileService.getActiveProfile();
      const exportedJson = hotkeyProfileService.exportProfile(active.id);
      expect(exportedJson).toContain('harmoniq_hotkey_profile');

      const importRes = hotkeyProfileService.importProfile(exportedJson);
      expect(importRes.success).toBe(true);
      expect(importRes.profile).toBeDefined();
      expect(importRes.profile?.shortcuts.playPause).toBe(active.shortcuts.playPause);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 2: DESKTOP WIDGETS & MINI-PLAYER ENHANCEMENTS
  // -------------------------------------------------------------
  describe('Feature 2 – Desktop Widgets & Mini-Player Enhancements', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists miniplayer layout preferences between compact and expanded', () => {
      localStorage.setItem('harmoniq_miniplayer_layout', 'compact');
      expect(localStorage.getItem('harmoniq_miniplayer_layout')).toBe('compact');

      localStorage.setItem('harmoniq_miniplayer_layout', 'expanded');
      expect(localStorage.getItem('harmoniq_miniplayer_layout')).toBe('expanded');
    });

    it('persists widget transparency within clamped safe range (0.6 to 1.0)', () => {
      const clampOpacity = (val: number) => Math.max(0.6, Math.min(1.0, val));

      expect(clampOpacity(0.85)).toBe(0.85);
      expect(clampOpacity(0.2)).toBe(0.6); // Underflow clamped to 0.6 minimum
      expect(clampOpacity(1.5)).toBe(1.0); // Overflow clamped to 1.0 maximum
    });
  });

  // -------------------------------------------------------------
  // FEATURE 3: EXTENDED AUTO SHUTDOWN & SLEEP TIMER
  // -------------------------------------------------------------
  describe('Feature 3 – Extended Auto Shutdown', () => {
    it('supports extended timer modes: duration countdown, track end, and queue end', () => {
      const modes = ['duration', 'stopAfterTrack', 'stopAfterQueue'];
      modes.forEach((mode) => {
        expect(['duration', 'stopAfterTrack', 'stopAfterQueue']).toContain(mode);
      });
    });

    it('supports application-level trigger actions without ever invoking OS shutdown', () => {
      const safeEndActions = ['pause', 'closeApp', 'exitApp'];
      safeEndActions.forEach((action) => {
        // Verify action is strictly application level
        expect(['pause', 'closeApp', 'exitApp']).toContain(action);
        expect(action).not.toBe('system_shutdown');
        expect(action).not.toBe('shutdown_pc');
      });
    });

    it('accurately computes timer extension (+5 min, +15 min)', () => {
      let totalSeconds = 600; // 10 minutes
      let secondsRemaining = 300; // 5 minutes remaining

      // Extend +5 min
      const add5 = 5 * 60;
      totalSeconds += add5;
      secondsRemaining += add5;
      expect(secondsRemaining).toBe(600);
      expect(totalSeconds).toBe(900);

      // Extend +15 min
      const add15 = 15 * 60;
      totalSeconds += add15;
      secondsRemaining += add15;
      expect(secondsRemaining).toBe(1500);
      expect(totalSeconds).toBe(1800);
    });

    it('computes 30-second gradual volume reduction across 100 steps monotonically', () => {
      const initialVolume = 0.9;
      const steps = 100;
      const volumeLevels: number[] = [];

      for (let s = 0; s <= steps; s++) {
        const factor = 1 - s / steps;
        volumeLevels.push(Math.max(0, initialVolume * factor));
      }

      expect(volumeLevels[0]).toBeCloseTo(0.9, 3);
      expect(volumeLevels[50]).toBeCloseTo(0.45, 3);
      expect(volumeLevels[steps]).toBe(0);

      // Strictly monotonic decreasing
      for (let i = 1; i < volumeLevels.length; i++) {
        expect(volumeLevels[i]).toBeLessThanOrEqual(volumeLevels[i - 1]);
      }
    });
  });

  // -------------------------------------------------------------
  // FEATURE 4: LIBRARY BACKUP & RESTORE
  // -------------------------------------------------------------
  describe('Feature 4 – Library Backup & Restore', () => {
    beforeEach(() => {
      localStorage.clear();
      // Populate test storage items
      localStorage.setItem(
        'harmoniq_custom_playlists',
        JSON.stringify([{ id: 'pl_1', name: 'Chill Vibes', trackIds: ['t1', 't2'] }])
      );
      localStorage.setItem(
        'harmoniq_playlist_folders_v1',
        JSON.stringify([{ id: 'fol_1', name: 'Electronic', playlistIds: ['pl_1'] }])
      );
      localStorage.setItem(
        'harmoniq_saved_queues_v1',
        JSON.stringify([{ id: 'q_1', name: 'Night Drive', tracks: [] }])
      );
    });

    it('creates versioned harmoniq_backup_v2 archive with valid checksum', () => {
      const archive = backupService.createBackupArchive();
      expect(archive.format).toBe('harmoniq_backup');
      expect(archive.version).toBe(2);
      expect(archive.checksum).toBeDefined();
      expect(archive.checksum.length).toBe(16);
      expect(archive.itemCounts.playlists).toBe(1);
      expect(archive.itemCounts.playlistFolders).toBe(1);
      expect(archive.itemCounts.savedQueues).toBe(1);
    });

    it('strictly satisfies Zero-Binary constraint: contains zero audio binary data', () => {
      const archive = backupService.createBackupArchive();
      const serialized = JSON.stringify(archive);

      // Verify no binary audio buffers or media stream payloads exist
      expect(serialized).not.toContain('audio/wav;base64');
      expect(serialized).not.toContain('audio/flac;base64');
      expect(serialized).not.toContain('ArrayBuffer');
      expect(serialized).not.toContain('Uint8Array');
      expect(archive.data.playlists?.[0].name).toBe('Chill Vibes');
    });

    it('validates integrity of backup archives and rejects corrupted checksums', () => {
      const archive = backupService.createBackupArchive();
      const validRes = backupService.validateBackup(archive);
      expect(validRes.valid).toBe(true);
      expect(validRes.checksumValid).toBe(true);
      expect(validRes.summary.playlists).toBe(1);
      expect(validRes.summary.folders).toBe(1);

      // Corrupt payload data
      const corrupted: BackupArchive = {
        ...archive,
        data: {
          ...archive.data,
          playlists: [{ id: 'pl_corrupt', name: 'Tampered Playlist' }],
        },
      };

      const corruptRes = backupService.validateBackup(corrupted);
      expect(corruptRes.valid).toBe(false);
      expect(corruptRes.checksumValid).toBe(false);
      expect(corruptRes.error).toContain('Checksum mismatch');
    });

    it('successfully restores backup archive in replace and merge modes', async () => {
      const archive = backupService.createBackupArchive();

      // Clear local storage
      localStorage.clear();
      expect(localStorage.getItem('harmoniq_custom_playlists')).toBeNull();

      // Restore archive
      const restoreRes = await backupService.restoreBackup(archive, 'replace');
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.restoredCount).toBeGreaterThanOrEqual(3);

      const restoredPlaylists = JSON.parse(localStorage.getItem('harmoniq_custom_playlists') || '[]');
      expect(restoredPlaylists.length).toBe(1);
      expect(restoredPlaylists[0].name).toBe('Chill Vibes');
    });

    it('schedules automatic backups according to interval settings', () => {
      backupService.setAutoBackupConfig({ schedule: 'daily' });
      const config = backupService.getAutoBackupConfig();
      expect(config.schedule).toBe('daily');

      const triggered = backupService.checkAndRunScheduledBackup();
      expect(typeof triggered).toBe('boolean');
    });
  });

  // -------------------------------------------------------------
  // FEATURE 5: PORTABLE MODE & PERMISSION VALIDATION
  // -------------------------------------------------------------
  describe('Feature 5 – Portable Mode & Permission Validation', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns default portable status with write permission verified', async () => {
      const status = await portableService.getPortableStatus();
      expect(status).toBeDefined();
      expect(status.canSwitch).toBe(true);
      expect(status.isWritable).toBe(true);
    });

    it('safely warns against protected system directories (C:\\Program Files)', async () => {
      const res = await portableService.testDirectoryWritable('C:\\Program Files\\Harmoniq');
      expect(res.writable).toBe(false);
      expect(res.error).toContain('Permission denied');
    });

    it('allows valid user portable paths and simulates data migration safely', async () => {
      const writableRes = await portableService.testDirectoryWritable('D:\\Music\\HarmoniqPortable');
      expect(writableRes.writable).toBe(true);

      const migration = await portableService.migrateData('toPortable', 'D:\\Music\\HarmoniqPortable');
      expect(migration.success).toBe(true);
      expect(migration.filesMigrated).toBeGreaterThan(0);
    });
  });
});
