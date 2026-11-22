# HARMONIQ ANDROID — PRODUCTION PHASE 02
## Known Limitations, OEM Behaviors & Technical Constraints

**Application:** HARMONIQ
**Package ID:** `com.bytecraft.harmoniqlite`
**Document Version:** 1.0.0
**Date:** November 22, 2026

---

## 1. Overview

While Phase 02 establishes rock-solid reliability across the core Media3 architecture, several platform, hardware, and manufacturer-specific constraints exist across the diverse Android ecosystem. This document transparently details these limitations and outlines mitigation strategies for Phase 03 and subsequent phases.

---

## 2. OEM Battery Management & Background Restrictions

Modern Android OEMs implement custom aggressive process termination heuristics outside standard AOSP Doze specifications.

### 2.1. Samsung (One UI)
- **Behavior:** Puts background apps into "Deep Sleeping Apps" if not opened in several days. While a foreground service is actively playing audio, Samsung devices respect the notification. However, if paused for more than 10 minutes, the OS may kill the service process.
- **Mitigation:** When playback is paused, HARMONIQ maintains the notification in an idle state. Users desiring infinite standby without process recreation can add HARMONIQ to "Never sleeping apps" in Settings -> Battery -> Background usage limits.

### 2.2. Xiaomi (MIUI / HyperOS)
- **Behavior:** Default battery saver mode restricts background network access for internet radio streams when the screen is locked, potentially causing internet radio drops after 5–10 minutes of screen-off time.
- **Mitigation:** Local music playback (FLAC/MP3) is unaffected because it requires no network. For internet radio, users should set Battery Saver for HARMONIQ to "No restrictions".

### 2.3. Huawei (EMUI) / Vivo / Oppo (ColorOS)
- **Behavior:** Aggressive background app killers may kill bound services when swiping from Recent Apps even if a foreground notification is active unless the app is "locked" in the recents tray.
- **Mitigation:** In Phase 02, `HarmoniqMediaService` sets `START_STICKY`, ensuring that if killed by low memory pressure, Android attempts to restart the service once memory stabilizes.

---

## 3. Storage & Android Scoped Storage (API 30–35)

### 3.1. Content URIs vs File Paths
- **Constraint:** Android 11+ (API 30+) strictly enforces Scoped Storage. Direct POSIX filesystem paths (e.g. `/storage/emulated/0/...`) may have restricted access permissions if files were placed by other applications.
- **Current Architecture:** HARMONIQ uses `MediaStore.Audio.Media.EXTERNAL_CONTENT_URI` with `ContentUris` (`content://media/external/audio/media/...`). ExoPlayer natively resolves content URIs seamlessly via Android's `ContentResolver`.
- **Limitation:** If a user stores audio files in custom hidden folders or app-private storage of other apps, standard MediaStore queries will not index them without Storage Access Framework (SAF) tree permissions.

---

## 4. Internet Radio Stream Variations

### 4.1. Non-Standard Streaming Formats & Redirects
- **Constraint:** Public internet radio streams frequently use icy-metadata protocols, continuous chunked HTTP transfers, or HTTP 302 redirects to geographic load-balancers.
- **Current Architecture:** Phase 02 uses ExoPlayer's `DefaultHttpDataSource` with cross-protocol redirects enabled (`setAllowCrossProtocolRedirects(true)`).
- **Limitation:** Streams requiring RTSP, proprietary MMS, or unstandardized WMA streaming protocols are not supported. Only standard HTTP/HTTPS Shoutcast/Icecast MP3, AAC, and HLS streams are supported.

---

## 5. Technical Recommendations for Phase 03

1. **Direct USB Audio Passthrough:** Implement USB host permission detection to bypass Android's fixed 48kHz audio mixer for external audiophile DACs.
2. **Audio Track Offload:** Evaluate `AudioTrack.isDirectPlaybackSupported()` for supported compressed bitstreams (FLAC/ALAC) to reduce battery consumption even further on compatible Qualcomm/MediaTek DSPs.
3. **Parametric Equalizer Hardware Limitations:** Android's native `android.media.audiofx.Equalizer` provides 5 to 10 fixed frequency bands depending on hardware audio HAL. Phase 03 will integrate custom native DSP or float32 filtering for true parametric equalization.
