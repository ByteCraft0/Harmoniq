# HARMONIQ ANDROID — EIGHT-PHASE PRODUCTION ROADMAP
## Official Master Architecture, Milestones & Progress Tracker

**Application:** HARMONIQ
**Target Platform:** Android (API 24+ / Android 7.0–15+)
**Package ID:** `com.bytecraft.harmoniqlite`
**Document Version:** 2.1.0
**Last Updated:** November 22, 2026

---

## 1. Master Progress Summary

| Phase | Official Phase Name | Weight | Completion | Status | Acceptance Details |
|:---:|:---|:---:|:---:|:---:|:---|
| **01** | **Official Branding & Identity** | 10% | 100% | **COMPLETED** | 12/12 physical-device tests passed (commit `b44dc92`) |
| **02** | **Android Architecture & Reliability** | 15% | 100% | **COMPLETED** | 30/30 physical-device tests passed (P01–P30 verified) |
| **03** | **Features & UI Polish** | 15% | 0% | NOT STARTED | Awaiting Phase 03 initiation |
| **04** | **Performance, Security & Stability** | 15% | 0% | NOT STARTED | Awaiting Phase 04 initiation |
| **05** | **Production Signing & Builds** | 15% | 0% | NOT STARTED | Awaiting Phase 05 initiation |
| **06** | **Multi-Device Beta Testing** | 10% | 0% | NOT STARTED | Awaiting Phase 06 initiation |
| **07** | **Official GitHub Release** | 10% | 0% | NOT STARTED | Awaiting Phase 07 initiation |
| **08** | **Google Play Store Publication** | 10% | 0% | NOT STARTED | Awaiting Phase 08 initiation |

---

### Progress Calculation

$$\text{Phase 01: } 10\% \times 100\% = 10\%$$
$$\text{Phase 02: } 15\% \times 100\% = 15\%$$
$$\text{Phases 03–08: } 0\%$$

$$\mathbf{TOTAL\ WEIGHTED\ PRODUCTION\ COMPLETION:\ 25.0\%}$$

*The eight official phase names and weights are permanently fixed as mandated in Section 20 of the master specification. Future development must not alter or renumber this roadmap.*

---

## 2. Phase-by-Phase Technical Specifications & Deliverables

### Phase 01 — Official Branding & Identity
**Weight:** 10% | **Status:** **COMPLETED (100%)**

- **Objective:** Eliminate all temporary "Harmoniq Lite" references; establish official HARMONIQ application identity across native and web layers.
- **Engineering Achievements:**
  - Complete rebrand of application manifest, string resources, and UI text to **HARMONIQ**.
  - Notification channel permanently branded as `HARMONIQ Playback`.
  - Android package ID `com.bytecraft.harmoniqlite` preserved to guarantee zero user data loss.
  - Full adaptive launcher icon suite (foreground emblem, obsidian background `#09090B`, round icon, monochrome themed icon).
  - High-fidelity dark obsidian splash screens (`#09090B`) replacing white default screens.
  - Dedicated "About HARMONIQ" section featuring version 1.0.0, ByteCraft attribution, and GitHub repository link.
  - 100% desktop Electron platform isolation verified.
- **Acceptance Verification:**
  - 12/12 physical-device acceptance checks passed.
  - Baseline committed and pushed at `b44dc92`.

---

### Phase 02 — Android Architecture & Reliability
**Weight:** 15% | **Status:** **COMPLETED (100%)**

- **Objective:** Consolidate single authoritative playback session ownership in `HarmoniqMediaService` and resolve all 14 hardware, OS, and lifecycle interruption scenarios.
- **Engineering Achievements:**
  - **Single Authoritative Playback Session:** Consolidated sole `ExoPlayer` instance ownership exclusively inside `HarmoniqMediaService`. Eliminated duplicate fallback player memory leak in `HarmoniqAudioPlayerPlugin`.
  - **Non-Blocking Artwork I/O:** Migrated `setArtworkData` synchronous `FileInputStream` main-thread reads to asynchronous `setArtworkUri(parseMediaUri(qArt))`, eliminating ANR freezes during queue loading.
  - **Doze-Safe Native Auto-Skip Recovery:** Implemented autonomous native error handling in `HarmoniqMediaService.onPlayerError`. Missing or corrupt local files in the queue are automatically skipped without waiting for suspended WebView JavaScript timers during Android Doze mode.
  - **Explicit User-Pause & Audio Focus Restoration:** Implemented `mUserExplicitlyPaused` tracking and audio focus suppression handling (`onPlaybackSuppressionReasonChanged`) to ensure music does not resume after phone calls if the user had paused playback prior to the call.
  - **Native Sleep Timer ("Stop after current track"):** Connected the React UI sleep timer mode to `HarmoniqMediaService.mStopAfterCurrentTrack`, pausing playback reliably at the exact track boundary even when the device is locked.
  - **Internet Radio Network Drop Protection:** Hardened `PlayerContext.tsx` to halt playback cleanly (`isPlaying: false`) and alert the user with a warning toast upon radio stream dropout, preventing rapid skip storms through the queue.
  - **Native MediaMetadataRetriever Leak Prevention:** Wrapped scanner tag extraction in strict `try ... finally { mmr.release(); }` blocks to prevent unmanaged `libstagefright` and `libbinder` memory exhaustion.
- **Acceptance Verification:**
  - 20/20 automated Vitest reliability tests (A01–A20) passed.
  - 4/4 native Android Gradle unit tests (`HarmoniqArchitectureTest.java`) passed.
  - Full Android debug build assembled (`app-debug.apk`, 8.93 MB).
  - 30/30 physical-device acceptance checks confirmed passed (P01–P30).

---

### Phase 03 — Features & UI Polish
**Weight:** 15% | **Status:** **NOT STARTED (0%)**

- **Objective:** Improve and refine existing Android features, responsive layouts, navigation, playback controls, playlists, queue management, animations, and accessibility.
- **Scope & Deliverables:**
  - **Mobile UI & Ergonomics:** Refine Now Playing sheet, mini player, and tab views for one-handed operation across all Android display densities.
  - **Queue Management Ergonomics:** Implement fluid swipe-to-dismiss and drag-and-drop track reordering in the active playback queue.
  - **Playlist Management Polish:** Enhance custom playlist creation, inline renaming, batch track addition, and deletion confirmation flows.
  - **Navigation & Gestures:** Refine Android system Back gesture transitions, sheet dismissal physics, and smooth view switching.
  - **Theming & Aesthetics:** Ensure complete consistency across Obsidian, Dark, and Light themes with fluid dark-mode transitions.
  - **Haptic Feedback:** Integrate subtle, tactile haptic cues for transport toggles, seek gestures, and queue reordering.
  - **Accessibility:** Add comprehensive content descriptions, touch-target expansion (minimum 48dp), and dynamic font scaling support.

---

### Phase 04 — Performance, Security & Stability
**Weight:** 15% | **Status:** **NOT STARTED (0%)**

- **Objective:** Evaluate CPU, memory, battery consumption, long-duration playback, security, crash resilience, resource leaks, and performance across supported Android devices.
- **Scope & Deliverables:**
  - **ExoPlayer LoadControl Tuning:** Calibrate buffer allocation (`DefaultLoadControl` min/max buffer constraints) to optimize RAM usage during high-res playback.
  - **Battery Benchmark Testing:** Profile 24-hour continuous playback battery drain; ensure minimal wake-lock overhead and complete CPU sleep when paused.
  - **Memory Leak & LMK Profiling:** Profile heap allocations across prolonged sessions; eliminate retain cycles and DOM node leaks in WebView.
  - **Security Review:** Verify network security config, exported Android components, secure IPC, and local database encryption boundaries.
  - **Crash Resilience:** Harden exception boundaries across native-to-JavaScript bridges to guarantee zero unhandled fatal exceptions.

---

### Phase 05 — Production Signing & Builds
**Weight:** 15% | **Status:** **NOT STARTED (0%)**

- **Objective:** Prepare secure release signing, version management, reproducible release builds, signed APK and Android App Bundle (AAB) artifacts, and automated release configuration.
- **Scope & Deliverables:**
  - **Release Keystore Setup:** Secure production keystore configuration via environment variables and Gradle credentials helper.
  - **R8 / ProGuard Rules Hardening:** Optimize code shrinking, obfuscation, and resource stripping while preserving Capacitor plugins and Media3 reflection classes.
  - **Android App Bundle (AAB):** Configure modular AAB compilation optimized for dynamic feature delivery and split APK distribution.
  - **Build Reproducibility:** Ensure deterministic builds with pinned dependencies, Gradle build caching, and automated SHA-256 generation.

---

### Phase 06 — Multi-Device Beta Testing
**Weight:** 10% | **Status:** **NOT STARTED (0%)**

- **Objective:** Perform comprehensive testing across diverse Android versions, manufacturers, screen sizes, hardware configurations, and real-world playback conditions.
- **Scope & Deliverables:**
  - **Multi-OS Verification:** Validate across Android versions from API 24 (Android 7.0) through API 35 (Android 15+).
  - **OEM Battery Management Profiling:** Validate background persistence across aggressive OEM skins (Samsung One UI, Xiaomi HyperOS, OnePlus OxygenOS, Huawei EMUI).
  - **Form Factor Testing:** Test across standard phones, compact displays, large foldables, and Android tablets.
  - **Audio Hardware Matrix:** Validate wired 3.5mm, USB-C DAC dongles, Bluetooth SBC/AAC/LDAC headphones, and Android Auto.

---

### Phase 07 — Official GitHub Release
**Weight:** 10% | **Status:** **NOT STARTED (0%)**

- **Objective:** Publish the verified HARMONIQ Android release through GitHub Releases with installation files, checksums, release notes, and documentation.
- **Scope & Deliverables:**
  - **Release Tagging:** Semantic Versioning release tag (`v1.0.0`) on `feature/harmoniq-lite-android` merged to official release branch.
  - **Release Artifacts:** Signed universal APK (`HARMONIQ-v1.0.0-universal.apk`) and architecture-specific APKs (arm64-v8a, armeabi-v7a, x86_64).
  - **Verification Hashes:** Cryptographic SHA-256 checksums published alongside release binaries.
  - **Changelog & Documentation:** Comprehensive release notes detailing features, hardware support, and setup instructions.

---

### Phase 08 — Google Play Store Publication
**Weight:** 10% | **Status:** **NOT STARTED (0%)**

- **Objective:** Complete Google Play Console requirements, store listing, privacy disclosures, app review, and official publication.
- **Scope & Deliverables:**
  - **Store Listing Creative:** High-resolution icon (512x512), feature graphic (1024x500), and phone/tablet screenshot suites.
  - **Policy & Data Safety Declarations:** Complete declarations for permissions (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `READ_MEDIA_AUDIO`).
  - **Target SDK Compliance:** Full compliance with Google Play Target SDK 35 mandates.
  - **Staged Rollout & Monitoring:** Execute 10% $\rightarrow$ 50% $\rightarrow$ 100% phased rollout with Android Vitals crash rate tracking.

---

## 3. Optional Future Enhancements (Post-v1.0 / Backlog)

*The following items represent advanced audiophile capabilities planned for future post-v1.0 iterations. They are explicitly decoupled from the core Phase 03 deliverables to ensure focused, stable execution.*

1. **Direct USB Audio DAC Passthrough:** Direct USB host interface bypassing Android's 48kHz audio mixer for bit-perfect output up to 32-bit / 384kHz and DSD.
2. **High-Precision 32-Bit Float Audio Pipeline:** Full float32 internal decoding and DSP signal chain for maximum dynamic range preservation.
3. **Parametric Equalizer Studio Engine:** Multi-band parametric equalizer featuring adjustable Q-factors, low/high shelving filters, and unlimited custom user profiles.
4. **Local Network Streaming (DLNA / UPnP / Cast):** Native streaming to local network receivers, Sonos, and Google Cast endpoints.
