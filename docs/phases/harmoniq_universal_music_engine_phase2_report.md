# HARMONIQ UNIVERSAL MUSIC ENGINE — PHASE 2 REPORT
## UNIVERSAL MUSIC UI TRANSFORMATION & REAL PLAYBACK INTEGRATION

**Project:** Harmoniq 2.0  
**Phase:** Phase 2 (Completed)  
**Reference Commit:** `37e5773` (`master`)  
**Status:** Verification & Build Clean (32 test files, 316 passed unit tests, 0 regressions)

---

## 1. Executive Summary

Phase 2 successfully transforms Harmoniq's existing Online Music Search into **Universal Music** in place, delivering a unified discovery experience across legitimate online catalogs alongside the local library, backed by real Web Audio DSP playback and on-demand stream resolution.

### Core Achievements
1. **In-Place Navigation Upgrade:** Renamed the sidebar navigation item in `Sidebar.tsx` to `Universal Music` while preserving the existing route key `online_music` and sidebar hierarchy. `Discover` remains an independent section for recommendations and exploration.
2. **Premium Obsidian UI:** Transformed `OnlineMusicSearchView.tsx` into a console featuring obsidian dark backgrounds, ambient violet/lavender accents, category filtering (`all`, `song`, `artist`, `album`), 350ms debounced input, and interactive provider filter chips (`All Sources`, `Apple Music`, `Audius`, `Internet Archive`, `Jamendo`, `Local Library`) with real-time result counts.
3. **On-Demand Stream Resolution:** Built a stream resolution layer in the Electron main process (`universal:resolveStream`) and `UniversalMusicService.resolveTrackStream()`:
   - **Audius:** Resolves fresh signed URLs dynamically at playback time from discovery provider 302 redirects, handling Cloudflare R2 300s token expirations without storing stale links.
   - **Internet Archive:** Resolves real audio filenames from item metadata manifests (`https://archive.org/metadata/{id}/files`), selecting high-quality VBR MP3 streams while ignoring auxiliary `.xml`, `.png`, `.afpk` files to prevent 404 errors.
   - **Apple Music:** Validates legitimate 30-second AAC previews (`preview_stream`) with clear capability badges.
   - **Jamendo:** Validates full-track Creative Commons MP3 streams and provides quota exhaustion handling.
   - **Local Library:** Resolves offline local files instantly.
4. **Real Playback & Queue Integration:** Integrated directly with `PlayerContext.tsx` and `audioEngine.ts`. Tracks stream through the 32-bit floating-point Web Audio graph (10-band EQ, reverb acoustic rooms, ReplayGain, visualizers, Now Playing, and Mini Player). "Add to Queue" and "Play Next" preserve provider descriptors, allowing seamless queueing of online and offline tracks.
5. **Jamendo Settings Card:** Added a dedicated Jamendo developer Client ID card in `SettingsView.tsx` with validation, dual-layer persistence (localStorage + Electron store), and non-blocking failure isolation.
6. **Security Hardening:** Enforced HTTP/HTTPS restrictions, private/loopback IP blocking (`isSafePublicUrl`), 9-second hard request timeouts, credential protection, and error isolation.

---

## 2. Files Created and Modified

| File | Status | Description |
| :--- | :---: | :--- |
| `src/components/online/OnlineMusicSearchView.tsx` | Modified | Complete UI transformation to Universal Music console with provider filter chips, capability badges, play/pause controls, queue buttons, and states |
| `src/components/layout/Sidebar.tsx` | Modified | Renamed navigation item label from `'Online Search'` to `'Universal Music'` while preserving route `'online_music'` |
| `electron/main.ts` | Modified | Implemented `universal:resolveStream`, `universal:getJamendoConfig`, `universal:saveJamendoConfig`, and updated `universal:search` with custom Jamendo key support |
| `electron/preload.ts` | Modified | Exposed `resolveUniversalStream`, `getJamendoConfig`, and `saveJamendoConfig` to the renderer via `harmoniqApi` |
| `src/types/electron.ts` | Modified | Declared TypeScript interfaces for `resolveUniversalStream`, `getJamendoConfig`, and `saveJamendoConfig` on `HarmoniqApi` |
| `src/types/universalMusic.ts` | Modified | Updated `unifiedTrackToTrackMetadata` and `trackMetadataToUnifiedTrack` to preserve online descriptors (`providerId`, `providerTrackId`, `playbackCapability`, `isOnline`) |
| `src/services/providers/archiveProvider.ts` | Modified | Implemented `resolveAudioFile()` querying `/metadata/{id}/files` to select the highest-quality audio file |
| `src/services/providers/jamendoProvider.ts` | Modified | Added `getClientId()` and `setClientId()` with fallback to demo key |
| `src/services/universalMusicService.ts` | Modified | Added `resolveTrackStream()`, `getJamendoClientId()`, `setJamendoClientId()`, and integrated Electron IPC resolver |
| `src/context/PlayerContext.tsx` | Modified | Added on-demand stream resolution in `playTrack()` for online tracks and queue items |
| `src/components/views/SettingsView.tsx` | Modified | Added Universal Music — Jamendo API Settings card under the Playback settings tab |
| `src/test/universal_music_phase2.test.ts` | Created | 14 comprehensive unit tests verifying stream resolution, manifest parsing, Jamendo settings, queue preservation, and error isolation |
| `CHANGES.md` | Modified | Documented all Phase 2 changes |
| `README.md` | Modified | Updated feature matrix and documentation for Universal Music Engine Phase 2 |

---

## 3. UI Changes & Component Architecture

### Header & Discovery Section
- **Branding:** Displays **Universal Music** with gradient icon and "Multi-Source Engine" badge.
- **Search Bar:** Centered input with search icon, loading spinner, clear (`X`) button, Enter key trigger, and 350ms debouncing.
- **Category Filter Tabs:** Fast switching between `'all'`, `'song'`, `'artist'`, and `'album'`.

### Provider Filter Chips
Interactive chips showing live result counts per provider:
- `All Sources` (`allTracks.length`)
- `Apple Music` (`providerCounts.apple`)
- `Audius` (`providerCounts.audius`)
- `Internet Archive` (`providerCounts.archive`)
- `Jamendo` (`providerCounts.jamendo`)
- `Local Library` (`providerCounts.local`)

### Track Cards & Action Controls
Each card renders:
- **Artwork Container:** 52x52px rounded album art with hover zoom, fallback `<Music />` icon, and hover overlay play button.
- **Typography:** Track title, artist, album name, release year, and duration.
- **Badges:**
  - Provider Badge: Apple Music (violet), Audius (fuchsia), Internet Archive (amber), Jamendo (emerald), Local Library (sky).
  - Capability Pill: `Full Track` (emerald), `30s Preview` (violet), `Local File` (sky).
  - Quality Indicator: e.g. `320k MP3`, `256k AAC` (only displayed when verified).
- **Actions:**
  - **Play / Pause Button:** Resolves stream on-demand, streams directly into Harmoniq's audio engine, and displays animated state when currently playing.
  - **Add to Queue Button:** Queues the track with complete metadata.
  - **Play Next Button:** Inserts the track immediately after the active song.
  - **External Link:** Opens the original track page in the default web browser.

### States
- **Initial Discovery Screen:** Feature highlights for all four online providers + local library, and quick-search chips for popular queries (`Moonlight`, `Arijit Singh`, `The Weeknd`, `Coldplay`, `Imagine Dragons`, `Chopin`).
- **Searching:** Sinusoidal `HarmoniqWaveformLoader` with active query indication.
- **No Results:** Vector `HarmoniqEmptyState` with query feedback and one-click "Clear Search" button.
- **Provider Failure Notice:** Non-blocking notification banner identifying any provider experiencing issues (e.g. Jamendo quota limits) while continuing to display all other results.
- **Fatal / Offline Error:** Friendly error state with a "Retry Search" action.

---

## 4. Playback & Stream Resolution Architecture

```
User clicks "Play" on Track Card (or Queue transition)
  │
  ▼
universalMusicService.resolveTrackStream(track)
  │
  ├──► [Electron Desktop] ipcRenderer.invoke('universal:resolveStream')
  │      │
  │      ├── Audius:
  │      │     Query https://discoveryprovider.audius.co/v1/tracks/{id}/stream
  │      │     Follow 302 redirect -> Validate Cloudflare R2 URL via isSafePublicUrl()
  │      │     Return fresh signed stream URL (resolves 300s expiry)
  │      │
  │      ├── Internet Archive:
  │      │     Fetch https://archive.org/metadata/{id}/files
  │      │     Filter valid audio files (ignore .xml, .afpk, .png)
  │      │     Select highest-quality VBR MP3 -> Construct direct download URL
  │      │     Validate via isSafePublicUrl() -> Return verified stream URL
  │      │
  │      ├── Apple Music:
  │      │     Validate 30s preview URL via isSafePublicUrl()
  │      │     Return stream URL with capability: 'preview_stream'
  │      │
  │      ├── Jamendo:
  │      │     Query API with custom Client ID -> Validate audio stream URL
  │      │     Return stream URL with capability: 'full_stream'
  │      │
  │      └── Local: Return file path with capability: 'local_file'
  │
  ▼
unifiedTrackToTrackMetadata(resolvedTrack)
  │
  ▼
PlayerContext.playTrack(metadata)
  │
  ▼
audioEngine.loadAndPlay(metadata)
  │
  ├── Direct HTML5 Audio Deck stream loading
  ├── 32-bit Floating-Point Web Audio DSP Graph
  │     ├── ReplayGain Normalization
  │     ├── 10-Band Graphic / Parametric Equalizer
  │     ├── Reverb Room Acoustic Simulation
  │     └── Anti-Clipping Brickwall Limiter
  │
  ▼
Now Playing, Bottom Player, Visualizers & Mini Player update simultaneously
```

---

## 5. Security & SSRF Defense

All external streaming URLs and API calls are validated through the Electron main process:
1. **Protocol Restriction:** Only `http:` and `https:` schemes are permitted. Malicious schemes (`javascript:`, `file:`, `data:`, `blob:`, `ftp:`) are rejected.
2. **SSRF & Private IP Blocking:** URLs targeting `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `10.*`, `192.168.*`, `172.16-31.*`, or `169.254.*` are blocked by `isSafePublicUrl()`.
3. **Request Timeouts:** All external HTTP requests are bounded by `AbortController` with a 9000ms hard timeout.
4. **Credential Privacy:** API keys and credentials are stored securely in Electron local storage and never exposed to the DOM.
5. **Web Security:** Electron's `webSecurity` remains strictly enabled; no global CORS bypasses or insecure settings were introduced.

---

## 6. Test Execution & Verification

### Unit Test Results
- **Phase 2 Test Suite:** `src/test/universal_music_phase2.test.ts` (14 new tests)
  - On-Demand Stream Resolution (Audius, Apple, Archive, Local, Electron IPC)
  - Internet Archive manifest parsing and audio file selection
  - Jamendo Client ID configuration and persistence
  - Queue metadata round-tripping (`unifiedTrackToTrackMetadata` & `trackMetadataToUnifiedTrack`)
  - Media URL security and protocol restrictions (`buildMediaUrl`)
  - Multi-provider error isolation and failure resilience
- **Full Test Suite:** 32 test files, 316 unit tests passed, 0 failures, 0 regressions.

### Build Verification
- **TypeScript Typecheck (`npx tsc --noEmit`):** Clean (0 errors).
- **Electron Build (`npm run build:electron`):** Clean (0 errors).
- **Vite Production Bundle (`npm run build`):** Clean (2262 modules transformed, 0 errors, built in 3.89s).

---

## 7. Known Limitations

1. **Apple Music Full Streaming:** Apple Music provides 30-second AAC previews under its public search API; full track streaming requires official MusicKit user authentication and active Apple Music subscriptions.
2. **Jamendo Public Quota:** The public demo key (`b6747d04`) is subject to global rate limits; users can supply their own free Jamendo Client ID in Settings for unrestricted access.
3. **Internet Archive Seeking:** Seeking within some large historical recordings depends on the Internet Archive server's HTTP 206 byte-range response latency.

---

> [!NOTE]
> **STRICT STOP CONDITION OBSERVED:**
> Phase 2 implementation is complete. All code has been built, tested, and verified. No work on Phase 3 has been started. Awaiting your explicit approval to proceed.
