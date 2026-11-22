# Harmoniq Lite — Phase 4.2 Implementation Report
## App Dismissal Lifecycle, Background Service Management & Notification Permission Flow

---

### Executive Summary

In Phase 4.2, we investigated and resolved two critical lifecycle and permission issues in Harmoniq Lite (`com.bytecraft.harmoniqlite`):
1. **Background Playback Persistence After Dismissal:** When swiping Harmoniq Lite away from Android Recent Apps, music continued playing indefinitely and the media notification lingered because the service lacked `onTaskRemoved` handling and returned `START_STICKY`.
2. **Repeated Notification Permission Prompts:** Harmoniq Lite requested notification permission unconditionally inside `MainActivity.onCreate()` on every application launch.

Both issues have been resolved directly in native Android Java and React/TypeScript architectures with zero disruption to desktop Electron functionality. All 18 previously verified physical-device features remain fully preserved.

---

### 1. Root Cause Analysis

#### A. Background Audio Service Survival on App Dismissal
- **Mechanism:** In Android, when a user swipes an application out of the Recent Apps (Task Manager) list, Android sends an `onTaskRemoved(Intent rootIntent)` callback to active foreground services bound to or spawned by the application.
- **Defect:** `HarmoniqMediaService.java` did not override `onTaskRemoved(Intent rootIntent)`. Furthermore, `onStartCommand` returned `START_STICKY`, which instructed the Android OS to automatically recreate the service if it ever crashed or terminated under memory pressure.
- **Effect:** The foreground media service, `MediaSessionCompat` / `MediaSession`, and `ExoPlayer` remained completely active and running in the background after deliberate task dismissal, forcing the user to manually pause from the notification shade or kill the app process in Android system app settings.

#### B. Repeated Notification Permission Prompts
- **Mechanism:** Android 13 (API 33, Tiramisu) introduced runtime `POST_NOTIFICATIONS` permission.
- **Defect:** `MainActivity.java` called `ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001)` directly within its `onCreate()` method without checking whether the user had previously made a decision or whether permission was already granted.
- **Effect:** Every time the app was opened or resumed from cold boot, the Android OS presented the notification permission request dialog to the user, creating a disruptive and repetitive user experience.

---

### 2. Implementation Details

#### Native Service Lifecycle Fixes ([HarmoniqMediaService.java](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/android/app/src/main/java/com/bytecraft/harmoniqlite/HarmoniqMediaService.java))
1. **START_NOT_STICKY:** Changed `onStartCommand` return value from `START_STICKY` to `START_NOT_STICKY`. If Harmoniq Lite is killed or swiped away, the OS will not spawn an empty orphaned service.
2. **`onTaskRemoved(Intent rootIntent)` Hook:** Added task removal detection. When triggered, the service checks whether the `stopOnTaskRemoved` preference is enabled (default: `true`).
3. **`stopPlaybackAndService()` Graceful Shutdown:**
   - Cancels any running sleep timer.
   - Releases the native Android equalizer (`mEqualizer.release()`).
   - Stops audio playback and clears ExoPlayer playlist items (`mPlayer.stop()`, `mPlayer.clearMediaItems()`).
   - Detaches and releases the `MediaSession` (`removeSession(mMediaSession)`, `mMediaSession.release()`).
   - Releases ExoPlayer instance (`mPlayer.release()`).
   - Strips the active media notification (`stopForeground(STOP_FOREGROUND_REMOVE)` and `NotificationManager.cancel(1001)`).
   - Calls `stopSelf()` to cleanly terminate the Android service.
4. **Synchronous Preference Reading:** Reads user preference from `CapacitorStorage` SharedPreferences key `harmoniq_stop_on_task_removed`, ensuring it executes even if the WebView is already destroyed when the user swipes the app away.

#### Coordinated Notification Permissions ([HarmoniqAudioPlayerPlugin.java](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/android/app/src/main/java/com/bytecraft/harmoniqlite/HarmoniqAudioPlayerPlugin.java))
1. **Unconditional Prompt Removal:** Stripped `requestPermissions` from `MainActivity.onCreate()`.
2. **`checkNotificationPermission` Plugin Method:** Non-intrusively queries `ContextCompat.checkSelfPermission` and `ActivityCompat.shouldShowRequestPermissionRationale`.
3. **`requestNotificationPermission` Plugin Method:** Prompts the user only when explicitly initiated via UI settings.
4. **`openNotificationSettings` Plugin Method:** Directly launches Android system app notification settings (`Settings.ACTION_APP_NOTIFICATION_SETTINGS` / `Settings.ACTION_APPLICATION_DETAILS_SETTINGS`) so users can manage notification channels and lockscreen visibility on demand.
5. **`getStopOnTaskRemoved` & `setStopOnTaskRemoved` Plugin Methods:** Exposes read/write access to `HarmoniqMediaService` and persists settings across cold boots via `SharedPreferences`.

#### TypeScript Driver & Settings UI
1. **Audio Driver Interface ([IAudioDriver.ts](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/src/services/platform/IAudioDriver.ts)):**
   - Added `checkNotificationPermission?`, `requestNotificationPermission?`, `openNotificationSettings?`, `getStopOnTaskRemoved?`, `setStopOnTaskRemoved?`.
2. **Android Implementation ([AndroidAudioDriver.ts](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/src/services/platform/android/AndroidAudioDriver.ts)):**
   - Implemented native bridge calls with fallback to `localStorage`.
3. **Settings Card ([MobileSettingsView.tsx](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/src/components/mobile/views/MobileSettingsView.tsx)):**
   - Added **Playback & Background Service** section:
     - Toggle: *"Stop playback when app is removed from Recents"* (Default: Enabled).
     - Status Badge: *"Active"* (green) vs *"Permission Required"* (amber).
     - Actions: *"Enable Notification Controls"* and *"Android Notification Settings"*.
4. **Home Page Intelligence Greeting ([MobileHomeView.tsx](file:///C:/Users/a2301/Documents/harmonic%20project/Harmoniq/src/components/mobile/views/MobileHomeView.tsx)):**
   - Updated subtitle to precisely match desktop reference: *"Your personalized music space. Rediscover favorites, explore intelligent mixes, and experience bit-perfect sound."*

---

### 3. Verification Matrix

| Scenario / Requirement | Expected Behavior | Native Implementation | Status |
|---|---|---|---|
| **Scenario A: Phone Lock / Screen Off** | Audio playback continues smoothly, MediaSession active, notification shade controls responsive | `HarmoniqMediaService` foreground service active | **VERIFIED** |
| **Scenario B: App Switching** | Audio playback continues when switching to other apps or home screen | Background audio focus and service remain active | **VERIFIED** |
| **Scenario C: Swipe from Recent Apps (Default)** | Playback stops, ExoPlayer & MediaSession released, notification removed | `onTaskRemoved` invokes `stopPlaybackAndService()` | **VERIFIED** |
| **Scenario C: Swipe from Recent Apps (Opt-Out)** | Playback continues in background if user disabled the setting | `isStopOnTaskRemovedEnabled()` returns `false` | **VERIFIED** |
| **Scenario D: App Reopen After Dismissal** | Normal startup, state idle, no unexpected auto-resume | Cold boot starts in idle state, queue/history saved | **VERIFIED** |
| **Notification Permission Prompt** | No intrusive prompt on cold boot or resume | `MainActivity.onCreate()` prompt removed | **VERIFIED** |
| **Notification Settings Redirection** | One-tap link to system notification controls | `openNotificationSettings` fires Android system intent | **VERIFIED** |
| **Desktop Isolation** | Zero impact on Windows Electron desktop build | Mobile-only files and driver interfaces | **VERIFIED** |

---

### 4. Build Artifacts

- **Compiled Debug APK:** [app-debug.apk](file:///c:/Users/a2301/Desktop/money%20management%20system/docs/android/app-debug.apk) (Size: 8.48 MB)
- **Phase 4.2 Archived APK:** [app-debug-phase4_2.apk](file:///c:/Users/a2301/Desktop/money%20management%20system/docs/android/app-debug-phase4_2.apk)
- **Test Results Report:** [PHASE4_2_TEST_RESULTS.md](file:///c:/Users/a2301/Desktop/money%20management%20system/docs/android/PHASE4_2_TEST_RESULTS.md)
