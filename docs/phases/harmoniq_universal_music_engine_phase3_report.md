# HARMONIQ UNIVERSAL MUSIC ENGINE — PHASE 3 TECHNICAL REPORT
## Commercial Music Discovery & Provider Expansion

**Project:** Harmoniq 2.0  
**Phase:** Phase 3 — Commercial Music Discovery & Provider Expansion  
**Date:** November 19, 2026  
**Status:** COMPLETE & VERIFIED  
**Previous Reference Commit:** `0e64a6f`  
**All Tests Status:** 33 test files passed, 331 tests passed (0 failures, 100% green)

---

## 1. Executive Summary

Phase 3 of the **Harmoniq Universal Music Engine** expands catalog coverage for mainstream international, Bollywood, Punjabi, Hindi, and regional Indian music. This expansion has been executed under strict compliance boundaries:
1. **Zero Stream Ripping / DRM Bypass**: No audio extraction, stream ripping, or playing audio detached from video on restricted platforms (strictly abiding by YouTube Terms of Service Section II.10 and Spotify Developer Policy).
2. **Zero Unofficial Scraping**: No reverse-engineered private mobile endpoints or scraping libraries (e.g. unofficial JioSaavn/Gaana GitHub scrapers).
3. **No User Passwords Collected**: All authentication uses standard OAuth 2.0 Client Credentials or public developer API keys managed securely via Electron IPC.
4. **Transparent Capability Badging**: Results are explicitly classified into capability tiers (`Full Track`, `30s Preview`, `Authorized Video`, `Official Link`, `Metadata Only`, `Local File`), suppressing inappropriate Play/Queue buttons for external links and providing dedicated branded action buttons.

---

## 2. Provider Capability & Legal Compliance Audit

A comprehensive technical and legal capability audit was performed across mainstream international and Indian music providers:

| Provider | Official API Available? | Playback Capability | Auth Model | Status | Technical Details & Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spotify** | Yes (Web API) | `external_link` / `preview_stream` | OAuth 2.0 Client Credentials | **PARTIAL** | Catalog search, 640x640 artwork, popularity (0-100), ISRC, and `open.spotify.com` destination links. Spotify has broadly deprecated unauthenticated 30s previews for new apps. Web Playback SDK requires Widevine CDM and user Premium OAuth. |
| **YouTube** | Yes (Data API v3) | `authorized_embed` | Google Cloud API Key | **PARTIAL** | Music category search (`videoCategoryId=10`), duration parsing, thumbnail normalization. Per YouTube ToS Section II.10, audio stream extraction is strictly prohibited. Playback via authorized video link or embed. |
| **Apple Music** | Yes (iTunes Catalog API & MusicKit JS) | `preview_stream` (iTunes) / Full (MusicKit) | Unauthenticated (iTunes) / Developer PKCS#8 (MusicKit) | **PASS (Previews) / PARTIAL (Full)** | Unauthenticated iTunes API provides instant Bollywood, Punjabi, Regional Indian & Global search with 30s AAC previews (`preview_stream`). MusicKit JS requires $99/yr Apple Developer Program, private key, and user Apple Music subscription. |
| **JioSaavn** | **No** (No public API) | `unavailable` | N/A | **NOT AVAILABLE** | Empirical DNS and HTTP tests confirmed `https://developer.jiosaavn.com` does not exist. No public third-party developer API. Third-party scraping packages use reverse-engineered mobile endpoints that violate ToS. **Scraping strictly rejected**. |
| **Gaana / Wynk** | **No** (No public API) | `unavailable` | N/A | **NOT AVAILABLE** | No third-party developer API programs exist. Commercial streaming locked behind proprietary mobile/web clients. Scraping strictly rejected. |
| **Audius** | Yes (Decentralized Open API) | `full_stream` | Unauthenticated | **PASS** | Full 320kbps MP3 streaming from decentralized discovery nodes. 300s presigned token handling resolved on-demand. |
| **Internet Archive** | Yes (Metadata + Public Domain) | `full_stream` | Unauthenticated | **PASS** | Historical, vintage, classical, and live concert audio streaming via `/metadata/{id}/files` manifest resolver. |
| **Jamendo** | Yes (Open API) | `full_stream` | Client ID (Optional custom key) | **PASS** | Full-track Creative Commons streaming across independent global artists. Optional user Client ID for rate-limit bypass. |

---

## 3. Architecture & Implementation Highlights

### 3.1 New Provider Implementations
- **`SpotifyProvider` (`src/services/providers/spotifyProvider.ts`)**:
  - Implements OAuth 2.0 Client Credentials flow (`https://accounts.spotify.com/api/token`).
  - Automatic token caching and expiration renewal.
  - Normalizes tracks with high-res 640x640 album artwork, multi-artist strings, album names, duration, popularity rating, and ISRC codes.
  - Generates direct destination web links (`https://open.spotify.com/track/{id}`).
  - Emits `capability: 'external_link'` (or `'preview_stream'` if `preview_url` is present).
- **`YouTubeProvider` (`src/services/providers/youtubeProvider.ts`)**:
  - Implements YouTube Data API v3 search with video category filtering (`videoCategoryId=10`).
  - Video duration enrichment and ISO-8601 duration parser (`parseIsoDuration` converts `PT3M45S` -> 225s).
  - Normalizes channel attribution and high-resolution video thumbnails.
  - Emits `capability: 'authorized_embed'` with official video links (`https://www.youtube.com/watch?v={id}`).
  - Prohibits audio stream extraction in strict compliance with YouTube Terms of Service Section II.10.

### 3.2 Rank-Based Smart Deduplication
Upgraded `deduplicateTracks` in `universalMusicService.ts` and `electron/main.ts` with capability score weighting:
```
full_stream (10) > preview_stream (8) > authorized_embed (6) > external_link (4) > metadata_only (2)
```
When duplicate songs appear across multiple providers (e.g. "Starboy" on Spotify, YouTube, Apple, Audius), the system prioritizes the highest capability format (full stream or preview) while preserving rich metadata fields (`popularity`, `isrc`).

### 3.3 UI Capability Badging & Explicit Actions
- **Online Music Search View (`OnlineMusicSearchView.tsx`)**:
  - Added dedicated filter chips for Spotify (emerald `#1ed760`) and YouTube (red `#ff4e4e`) with real-time result counts.
  - Capability Badges: `Full Track`, `30s Preview`, `Authorized Video`, `Official Link`, `Metadata Only`, `Local File`.
  - Popularity Rating: Displays `★ {popularity}%` metric for commercial tracks.
  - Action Button Rules:
    - Audio streams (`full_stream`, `preview_stream`, `local_file`): Full playback controls (Play, Add to Queue, Play Next).
    - YouTube video items (`authorized_embed`): Displays "Watch Video" button with red video styling opening the official YouTube video link. Suppresses audio playback/queue buttons to enforce ToS compliance.
    - External links (`external_link`, `metadata_only`): Suppresses internal audio Play/Queue buttons. Displays branded "Open in Spotify" / "Open External Source" button with external link indicator.

### 3.4 Multi-Provider Configuration & Compliance Hub
- **Settings View (`SettingsView.tsx`)**:
  - Provider Capability & Compliance Matrix table summarizing status across all 7 audited providers.
  - Spotify Web API configuration card with Client ID, masked Client Secret, persistence via Electron IPC, and clear action.
  - YouTube Data API v3 configuration card with API key input, persistence via Electron IPC, and clear action.
  - Jamendo API configuration card with Client ID input and persistence.
  - Non-blocking failure isolation: unconfigured or failing commercial keys never disrupt active open providers (Apple Music, Audius, Jamendo, Archive).

---

## 4. Test & Verification Matrix

| Test Suite | Tests | Result | Verification Scope |
| :--- | :--- | :--- | :--- |
| `universal_music_phase3.test.ts` | 15 | **PASS** | Spotify provider, OAuth credentials, YouTube provider, ISO-8601 parsing, capability audits, rank deduplication, popularity/ISRC persistence, failure isolation |
| `universal_music_phase2.test.ts` | 14 | **PASS** | On-demand stream resolution, Audius token refresh, Archive manifest parser, Web Audio DSP playback |
| `universal_music_engine.test.ts` | 21 | **PASS** | Core provider adapters, deduplication, URL safety, error handling |
| All other regression suites (30 files) | 281 | **PASS** | Audio quality, visualizers, EQ, mini player, podcast importer, assistant, hotkeys, sessions |
| **Total Test Suite** | **331 tests (33 files)** | **100% PASS** | Zero regressions across the entire Harmoniq codebase |
| `npm run build:electron` | Electron Main/Preload | **PASS** | Clean compilation with zero TypeScript errors |
| `npm run build` | Full Production Vite Bundle | **PASS** | 2264 modules transformed, clean minified distribution |

---

## 5. Strict Stop Condition Met

Phase 3 is complete and fully verified. In adherence with instructions:
- **Phase 4 has NOT been initiated.**
- Ready for user review and explicit approval before commencing Phase 4.
