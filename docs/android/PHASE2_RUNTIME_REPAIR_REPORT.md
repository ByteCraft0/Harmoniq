# Harmoniq Lite — Phase 2.5: Physical-Device Runtime Stability, Playback & UI Repair Report

## 1. Executive Summary

During physical device testing of **Harmoniq Lite** (`com.bytecraft.harmoniqlite`), five distinct runtime defects were confirmed:
1. **Defect A (Native Crash):** App stopped unexpectedly on launch or service startup ("Harmoniq Lite keeps stopping").
2. **Defect B (Playback Failure):** MediaStore-discovered local tracks (including FLAC) triggered the error *"Unsupported or missing audio file"* and failed to produce sound.
3. **Defect C (Scrolling Failure):** The music library list could not be scrolled down via touch gestures, hiding tracks below the initial viewport.
4. **Defect D (Error Toast Storm):** Multiple stacked error notifications covered the interface in an infinite retry cascade.
5. **Defect E (Broken Artwork):** Album art placeholders appeared broken due to unreachable `content://` URIs.

This phase resolved all root causes through targeted native Android Kotlin/Java fixes, platform driver routing in React/TypeScript, Flexbox layout constraints, toast deduplication, and local artwork disk caching.

---

## 2. Comprehensive Root Cause Analysis & Solutions

### Defect A — Native Android Application Crash

#### Root Causes Identified
1. **Premature Foreground Service Execution:** `MainActivity.java` previously invoked `ContextCompat.startForegroundService(this, intent)` during activity creation. Under Android 8.0+ (API 26+), if a foreground service does not call `startForeground(id, notification)` within 5 seconds, the OS terminates the process with `ForegroundServiceDidNotStartInTimeException`.
2. **Missing Notification Channel & Receiver Export Flags:** `HarmoniqMediaService.java` attempted to register a broadcast receiver on Android 14+ (API 34) without `RECEIVER_NOT_EXPORTED`, throwing a fatal `SecurityException`, and lacked an active `NotificationChannel`.
3. **Desynchronized Player Instances:** `HarmoniqAudioPlayerPlugin.java` held a distinct ExoPlayer instance from `HarmoniqMediaService`, leading to resource contention and unhandled state transitions.

#### Engineering Fixes
- **Safe Service Lifecycle:** Removed premature `startForegroundService` from `MainActivity.java`. The service now initializes cleanly when playback is initiated.
- **AndroidX MediaSession Notification Channel:** Configured `"harmoniq_playback_channel"` with `IMPORTANCE_LOW` inside `HarmoniqMediaService.onCreate()`.
- **Native Audio Becoming Noisy:** Replaced manual broadcast receiver with ExoPlayer's built-in `.setHandleAudioBecomingNoisy(true)`.
- **Instance Synchronization:** Updated `HarmoniqAudioPlayerPlugin.java` to synchronize with `HarmoniqMediaService.getInstance().getPlayer()`, ensuring seamless lock-screen and notification controls.

---

### Defect B — Playback Engine Routing ("Unsupported or missing audio file")

#### Root Cause Identified
In `PlayerContext.tsx:649`, `playTrack()` directly called `audioEngine.loadAndPlay(playableTrack, startPos)`.
`audioEngine.ts` is the desktop Web Audio / HTML5 `<audio>` engine designed for Electron file paths. It assigned `audio.src = playableTrack.filePath`.
On Android, `playableTrack.filePath` is a native URI (e.g., `content://media/external/audio/media/12345`). HTML5 `<audio>` in Android WebViews cannot resolve `content://` URIs, throwing HTML5 Media Error 4 (`MEDIA_ERR_SRC_NOT_SUPPORTED`). `audioEngine.ts:460` mapped this code to the string *"Unsupported or missing audio file"*.

#### Engineering Fixes
- **Authoritative Platform Routing:** Updated `PlayerContext.tsx` so that when `getPlatformDriver().isAndroid` is `true`, all audio operations route strictly to `driver.audio` (`AndroidAudioDriver`), completely bypassing the desktop HTML5 `audioEngine`:
  - `playTrack()` -> `driver.audio.play(playableTrack, queue)`
  - `togglePlayPause()` -> `driver.audio.pause()` / `driver.audio.resume()`
  - `pause()` -> `driver.audio.pause()`
  - `seekTo()` -> `driver.audio.seekTo(seconds)`
  - `setVolume()` -> `driver.audio.setVolume(clamped)`
  - `toggleMute()` -> `driver.audio.setMuted(nextMuted)`
  - `setPlaybackRate()` -> `driver.audio.setPlaybackRate(clamped)`
- **Native Media3 ExoPlayer Parsing:** `HarmoniqAudioPlayerPlugin.java` parses `content://`, `file://`, and raw file paths with `parseMediaUri()`, builds `MediaItem` instances with metadata, and streams lossless FLAC, MP3, and WAV audio through hardware decoders.

---

### Defect C — Viewport Scrolling & Flexbox Constraints

#### Root Causes Identified
1. **Unbounded Parent Container:** `MobileShell.tsx` applied `min-h-screen flex flex-col`. In CSS Flexbox, `min-height: 100vh` allows the flex container to expand to fit the total height of all rendered tracks (e.g., 20,000px).
2. **Missing `min-h-0` on Main Child:** Flex children have `min-height: auto` by default. Without `min-h-0`, `<main>` will not shrink below content size, preventing `overflow-y-auto` from creating a scroll container.
3. **Global Body Overflow:** `src/index.css:49` specifies `body { overflow: hidden; }`. Because neither the parent nor the child had a constrained scroll viewport, touch scrolling was completely blocked.
4. **Docked Navigation Overlap:** The mobile views used `pb-28` (112px), which was shorter than the combined height of the docked mini-player (`bottom-16` + `h-14` = 120px) and bottom navigation bar (64px), hiding the bottom tracks.

#### Engineering Fixes
- **Strict Viewport Constraint:** Updated outer container in `MobileShell.tsx` to:
  `h-[100dvh] h-screen max-h-screen overflow-hidden flex flex-col`
- **Flex Child Scrollable Area:** Updated `<main>` in `MobileShell.tsx` to:
  `flex-1 min-h-0 px-4 pt-3 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-y-contain`
- **Generous Bottom Clearance:** Updated padding to `pb-40` (160px) in `MobileLibraryView.tsx`, `MobileHomeView.tsx`, `MobilePlaylistsView.tsx`, and `MobileSettingsView.tsx`, ensuring all tracks scroll completely above the docked player.

---

### Defect D — Toast Notification Storm & Cascading Error Loops

#### Root Causes Identified
1. **Infinite Skip Loop:** In `PlayerContext.tsx:516`, an audio playback error immediately invoked `nextTrack()`. When multiple files failed, this triggered a recursion loop iterating through the queue.
2. **Unbounded Toast Queue:** `ToastContext.tsx` lacked message deduplication or rate limiting, stacking dozens of identical error cards over the user interface.

#### Engineering Fixes
- **Toast Deduplication & Throttling:** Updated `ToastContext.tsx` with a timestamp ref map (`lastToastMap`). Identical toast messages are suppressed within 2500ms.
- **Queue Ceiling:** Capped active visible toasts to a maximum of 2 (`prev.slice(-1)`).
- **Rate-Limited Skip Streak:** Updated `PlayerContext.tsx` error listener to limit error retries to a maximum streak of 3 with a 600ms debounce before halting playback cleanly.

---

### Defect E — Broken Album Artwork Rendering

#### Root Causes Identified
1. **Deprecated MediaStore Album Art URI:** `HarmoniqMediaScannerPlugin.java` queried `content://media/external/audio/albumart/<id>`, which is restricted on Android 10+ (API 29+) and throws `FileNotFoundException` or `SecurityException`.
2. **Direct Content URI Injection in Web Image Tag:** `<img src="content://...">` cannot be fetched by Chromium WebView security policies without being converted to a safe scheme.

#### Engineering Fixes
- **Native Disk Cache:** Created `getOrExtractAlbumArt(context, albumId)` in `HarmoniqMediaScannerPlugin.java`:
  - On API 29+: extracts bitmaps via `ContentResolver.loadThumbnail(albumUri, Size(300, 300), null)`.
  - On API <29: decodes stream via `BitmapFactory.decodeStream()`.
  - Compresses bitmap to JPEG in internal cache directory: `cacheDir/album_art/<albumId>.jpg`.
  - Returns cached file path or `null` if no artwork exists (`hasArtwork: false`).
- **SAF Embedded Artwork:** In `scanDocumentFileRecursively()`, extracts embedded cover pictures via `MediaMetadataRetriever.getEmbeddedPicture()` and writes to `cacheDir/album_art/saf_<hash>.jpg`.
- **WebView Image Converter:** Created `getArtworkUrl(pathOrUri)` in `src/services/platform/artworkHelper.ts`, converting local file paths to WebView-loadable URLs using `Capacitor.convertFileSrc()`.
- **Silent Fallback:** Added `onError={(e) => { e.currentTarget.style.display = 'none'; }}` on all artwork `<img>` elements in mobile views, seamlessly showing the vector disc placeholder if art is absent or corrupt.

---

## 3. Files Modified

| File | Subsystem | Nature of Change |
| --- | --- | --- |
| `android/.../MainActivity.java` | Native Android Shell | Removed premature foreground service start |
| `android/.../HarmoniqMediaService.java` | AndroidX Media3 | Configured notification channel, native noisy receiver |
| `android/.../HarmoniqAudioPlayerPlugin.java` | Capacitor Bridge | Service sync, URI parsing, ExoPlayer state management |
| `android/.../HarmoniqMediaScannerPlugin.java` | MediaStore / SAF | Album art thumbnail extraction & disk cache |
| `src/services/platform/types.ts` | Platform Types | Added optional `code` to `PlaybackErrorListener` |
| `src/services/platform/artworkHelper.ts` | Utilities | `getArtworkUrl` helper with `Capacitor.convertFileSrc` |
| `src/services/platform/index.ts` | Platform Driver | Exported `artworkHelper` |
| `src/services/platform/android/AndroidAudioDriver.ts` | Platform Driver | Added `playbackError` listener |
| `src/context/PlayerContext.tsx` | State Management | Routed playback, pause, seek, volume to native driver |
| `src/context/ToastContext.tsx` | UI State | Added toast deduplication (2.5s) & max 2 queue cap |
| `src/components/mobile/MobileShell.tsx` | Mobile Layout | Constrained viewport (`h-[100dvh]`), `min-h-0` on main |
| `src/components/mobile/views/MobileLibraryView.tsx` | Mobile UI | Applied `pb-40`, `getArtworkUrl`, `onError` fallback |
| `src/components/mobile/views/MobileHomeView.tsx` | Mobile UI | Applied `pb-40`, `getArtworkUrl`, `onError` fallback |
| `src/components/mobile/views/MobilePlaylistsView.tsx` | Mobile UI | Applied `pb-40` |
| `src/components/mobile/views/MobileSettingsView.tsx` | Mobile UI | Applied `pb-40` |
| `src/components/mobile/layout/MobileMiniPlayer.tsx` | Mobile UI | Applied `getArtworkUrl` and `onError` fallback |
| `src/components/mobile/layout/MobileNowPlayingSheet.tsx` | Mobile UI | Applied `getArtworkUrl` and `onError` fallback |

---

## 4. Verification & Build Results

1. **TypeScript Build:** `npm run build` completed with code `0` (0 errors).
2. **Electron Build:** `npm run build:electron` completed with code `0`.
3. **Automated Test Suite:** `npm test` executed 71 test files and 803 tests — all 803 passed with 0 failures.
4. **Capacitor Sync:** `npx cap sync android` updated web assets and configs.
5. **Gradle Debug APK Build:** `gradlew.bat assembleDebug` succeeded with code `0` (`BUILD SUCCESSFUL in 3s`).
6. **Artifact Generation:** `android/app/build/outputs/apk/debug/app-debug.apk` compiled and synchronized to docs.
