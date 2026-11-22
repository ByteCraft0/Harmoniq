# HARMONIQ LITE — ANDROID MVP ROADMAP & IMPLEMENTATION PLAN

**Document Version:** 1.0.0
**Audit Date:** November 2026
**Auditor Roles:** Senior Android Architect, React/TypeScript Engineer, Electron Specialist, Mobile Audio Systems Engineer
**Target Repository:** [ByteCraft0/Harmoniq](https://github.com/ByteCraft0/Harmoniq)

---

## 1. MVP Product Vision & Scope Definition

**Harmoniq Lite** is a high-fidelity, local-first Android music player that brings Harmoniq's audiophile heritage, signature neon obsidian aesthetic, and lightning-fast library indexing to mobile devices with zero battery compromise.

### 1.1 Minimum Viable Feature Set (Harmoniq Lite 1.0.0 MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARMONIQ LITE MVP SCOPE                      │
├───────────────────────────────┬─────────────────────────────────┤
│ Core Playback & Codecs        │ MP3, FLAC, WAV, AAC, OGG local  │
│                               │ playback via Media3 ExoPlayer   │
├───────────────────────────────┼─────────────────────────────────┤
│ MediaStore Scanning           │ Instant indexing (<300ms/10k)   │
│                               │ via ContentResolver             │
├───────────────────────────────┼─────────────────────────────────┤
│ Background Service            │ Compliant MediaSessionService   │
│                               │ with Android 13+ Notification   │
├───────────────────────────────┼─────────────────────────────────┤
│ Audio Focus & Headphone Rules │ Auto-ducking, auto-pause on     │
│                               │ call, pause on headphone unplug │
├───────────────────────────────┼─────────────────────────────────┤
│ Library Navigation            │ Songs, Albums, Artists,         │
│                               │ Playlists, Favorites            │
├───────────────────────────────┼─────────────────────────────────┤
│ Instant Search                │ Tokenized <15ms in-memory       │
│                               │ multi-field search              │
├───────────────────────────────┼─────────────────────────────────┤
│ Audio Equalizer               │ 10-Band Graphic EQ + Presets    │
│                               │ via Media3 AudioProcessor       │
├───────────────────────────────┼─────────────────────────────────┤
│ Synchronized Lyrics           │ Embedded + Companion .lrc +     │
│                               │ LRCLIB online fallback          │
├───────────────────────────────┼─────────────────────────────────┤
│ Sleep Timer                   │ Timed sleep with soft fade-out  │
├───────────────────────────────┼─────────────────────────────────┤
│ Offline Operation             │ 100% offline capability         │
└───────────────────────────────┴─────────────────────────────────┘
```

---

## 2. Features Deferred to Post-MVP (Phases 2 & 3)

| Feature | Desktop Implementation | Reason for Postponement | Target Phase |
| :--- | :--- | :--- | :--- |
| **Harmoniq Assistant (Pulse Orb)** | `src/components/assistant/`, Gemini / OpenAI / Groq chat | Heavy battery, high data consumption, and Web Speech API mobile constraints. | **Phase 3** |
| **Universal Streaming Providers** | `src/services/universalMusicService.ts` (Jamendo, Audius, Internet Archive) | Focus MVP 100% on bulletproof local offline playback quality and battery efficiency. | **Phase 2** |
| **3D Vinyl Turntable Collection** | `src/components/views/VinylCollectionView.tsx` | High GPU draw and thermal generation on entry-level Android devices. | **Phase 3** |
| **ABX Codec Blind Testing** | `src/components/views/ABXComparisonView.tsx` | Niche audiophile desktop diagnostic tool. | **Phase 3** |
| **Audio Tag Editing (ID3 / FLAC)** | `electron/main.ts:1483`, `node-id3`, `flac-tagger` | Android 11+ Scoped Storage requires complex `MediaStore.createWriteRequest` user approval sheets per file. | **Phase 2** |
| **Windows Desktop Integrations** | WASAPI Exclusive diagnostics, portable mode, system tray, thumbar buttons | Windows desktop exclusive. | **N/A** |

---

## 3. Implementation Dependencies & Technology Stack

```
Target Android OS: Android 8.0 (API 26) through Android 15 (API 35)
Target SDK: 35 (VanillaIceCream)
Minimum SDK: 26 (Android Oreo 8.0 — Covers >95% active global devices)
Compile SDK: 35
Capacitor Version: 7.x / 6.x
Android Media Framework: androidx.media3:media3-exoplayer:1.5.0
                         androidx.media3:media3-session:1.5.0
                         androidx.media3:media3-ui:1.5.0
UI Framework: React 19.0.0 + Tailwind CSS 3.4.19 (Unchanged)
Database / Storage: @capacitor/preferences (settings) + @capacitor-community/sqlite (library)
```

---

## 4. Development Milestones & Progress Tracker

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MIGRATION PROGRESS STATUS                       │
├───────────────────────────────────────────────────────┬────────────────┤
│ Phase 0: Architecture & Feasibility Audit             │ [COMPLETED]    │
├───────────────────────────────────────────────────────┼────────────────┤
│ Phase 1: Android Foundation & Platform Abstraction    │ [COMPLETED]    │
├───────────────────────────────────────────────────────┼────────────────┤
│ Phase 2: Native MediaStore, SAF Folders & Branding    │ [COMPLETED]    │
├───────────────────────────────────────────────────────┼────────────────┤
│ Phase 3: Hardware Equalizer & Synced Lyrics           │ [IN PROGRESS]  │
├───────────────────────────────────────────────────────┼────────────────┤
│ Phase 4: Mobile Release Hardening & Verification      │ [PLANNED]      │
└───────────────────────────────────────────────────────┴────────────────┘
```

### Detailed Milestone Breakdown

#### Milestone 1: Platform Abstraction & Project Scaffold (Phase 1 — COMPLETED)
- **Status:** **Completed & Verified**
- **Deliverables:**
  - Introduced `src/services/platform/` abstraction drivers (`IPlatformDriver`, `IAudioDriver`, `ILibraryDriver`, `IStorageDriver`).
  - Wired existing Electron desktop code to use `ElectronPlatformDriver` with 100% desktop regression-free execution.
  - Added Capacitor scaffolding (`capacitor.config.ts`, `android/` project folder, app ID `com.bytecraft.harmoniqlite`).
  - Built mobile shell layouts (`MobileShell`, `MobileHomeView`, `MobileLibraryView`, `MobilePlaylistsView`, `MobileSettingsView`, `MobileMiniPlayer`, `MobileNowPlayingSheet`).

#### Milestone 2: Native Media3 Audio Engine, MediaStore & SAF (Phase 2 — COMPLETED)
- **Status:** **Completed & Verified**
- **Deliverables:**
  - Implemented `HarmoniqMediaService.java` (`MediaSessionService`) with AndroidX Media3 ExoPlayer 1.5.0.
  - Implemented `HarmoniqAudioPlayerPlugin.java` Capacitor bridge with authoritative playback state synchronization.
  - Implemented `HarmoniqMediaScannerPlugin.java` for Android 13+ (`READ_MEDIA_AUDIO`) and legacy (`READ_EXTERNAL_STORAGE`) MediaStore scanning.
  - Implemented Storage Access Framework (`ACTION_OPEN_DOCUMENT_TREE`) with persisted URI permissions, recursive scanning, and non-destructive folder removal.
  - Generated all Android launcher icons across mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi densities from authentic `assets/icon.png` with `#09090B` background.
  - Passed all 71 Vitest test suites (803 / 803 tests).

#### Milestone 3: Hardware Equalizer, DSP & Synced Lyrics (Phase 3)
- **Deliverables:**
  - Connect `AndroidAudioDriver.setEqBands()` to Android native `android.media.audiofx.Equalizer` on the ExoPlayer audio session.
  - Build full-screen synchronized lyrics sheet using companion `.lrc` files and online LRCLIB provider.
  - Advanced playlist management and sorting on mobile.

#### Milestone 4: Battery Profiling, Device Certification & Release Packaging (Phase 4)
- **Deliverables:**
  - Battery profiling and memory leak checks on physical Android hardware.
  - Release-ready APK and AAB build pipeline.

---

## 5. Comprehensive Testing Strategy

### 5.1 Unit & Integration Testing
- **Shared TypeScript Logic:** Run existing Vitest test suite (`npm test`). All 65+ suites in `src/test/` must pass without modifications.
- **Native Android Logic:** Unit tests in Kotlin using Robolectric and JUnit for `MediaStoreScanner` and `HarmoniqDspAudioProcessor`.

### 5.2 Physical Device Verification Matrix

| Device Category | Target Test Hardware | Key Verification Objective |
| :--- | :--- | :--- |
| **Reference Clean Android** | Google Pixel 7 / 8 (Android 14/15) | Android 13+ Notification seekbar, Predictive Back gesture, MediaStore Scoped Storage. |
| **Aggressive OEM Battery Manager** | Samsung Galaxy S22 / S23 (OneUI 6) | Verify `MediaSessionService` is not killed during deep background Doze mode. |
| **Mid-Range / Budget Device** | Xiaomi Redmi Note / POCO (HyperOS) | Memory footprint verification on 4GB RAM hardware; smooth UI rendering at 60/120Hz. |
| **Legacy Android** | Motorola / Nokia (Android 8.1 / 9.0) | Backward compatibility of `AudioTrack`, `READ_EXTERNAL_STORAGE`, and notification channels. |

---

## 6. Acceptance Criteria for the First Android APK (Harmoniq Lite 1.0.0-alpha)

To pass Phase 0 and accept the first compiled Android APK, the build must satisfy all the following criteria:

```
[ ] CRITERION 1: CLEAN COMPILATION & PACKAGING
    The project builds a release-ready APK (harmoniq-lite-v1.0.0.apk) with zero warnings
    and no modifications to the desktop Windows build pipeline.

[ ] CRITERION 2: PERMISSION REQUEST FLOW
    On first launch, app requests READ_MEDIA_AUDIO (or READ_EXTERNAL_STORAGE) and
    POST_NOTIFICATIONS gracefully with an audiophile onboarding prompt.

[ ] CRITERION 3: INSTANT MEDIA SCANNING
    App discovers and indexes all local MP3, FLAC, and WAV files from Android MediaStore.
    A 5,000-track library indexes in < 3 seconds with zero UI freeze.

[ ] CRITERION 4: SEAMLESS AUDIO PLAYBACK
    Continuous playback of MP3, 16-bit/44.1kHz FLAC, 24-bit/96kHz FLAC, and WAV files
    without audible pops, clicks, or distortion.

[ ] CRITERION 5: INDESTRUCTIBLE BACKGROUND SERVICE
    Playback continues uninterrupted when:
    - The screen is locked for > 30 minutes.
    - The app is minimized and other apps (Chrome, Instagram) are used.
    - The device enters Android Doze mode.

[ ] CRITERION 6: SYSTEM MEDIA NOTIFICATION & LOCKSCREEN
    Android 13+ System Media Notification displays current track title, artist, album art,
    and functional Play/Pause, Next, Previous, and Scrubber controls.

[ ] CRITERION 7: AUDIO FOCUS & NOISY UNPLUG
    - Incoming phone call pauses playback; call completion resumes playback.
    - Disconnecting Bluetooth or 3.5mm headphones immediately pauses playback.

[ ] CRITERION 8: SEARCH & PLAYLIST INTEGRITY
    - Search input filters 10,000 tracks in < 20ms.
    - Custom playlists and favorites persist across app force-close and reboot.

[ ] CRITERION 9: EQUALIZER FUNCTIONALITY
    Adjusting any of the 10 graphic EQ sliders produces audible, real-time frequency
    adjustment without audio dropouts.

[ ] CRITERION 10: BATTERY & MEMORY BENCHMARKS
    - Background audio consumes < 5% battery per hour of continuous playback.
    - Memory usage remains strictly below 150MB RSS during extended listening.
```

---

## 7. Concrete Next Steps

Upon user approval of this Phase 0 Feasibility Audit, **Phase 1 (Platform Abstraction & Scaffolding)** will commence:
1. Define the TypeScript Platform Adapter Layer (`IPlatformDriver`).
2. Add Capacitor configuration files with strict zero-disruption guarantees to the Windows desktop build.
3. Scaffold the native Android Media3 module.
