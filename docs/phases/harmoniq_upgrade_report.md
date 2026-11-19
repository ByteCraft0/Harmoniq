# Harmoniq Desktop Audio Player — Upgrade & Architecture Report

## Executive Summary

The **Harmoniq Desktop Music Player** has been upgraded into an audiophile-grade, intelligent desktop music application. All additions integrate seamlessly into the existing Electron, React, TypeScript, and Tailwind architecture without breaking existing playlists, DSP pipelines, audio decoding, or state management.

---

## Architectural Upgrades & Feature Breakdown

### Part 2 — Mini-Player / Compact Floating Mode
- **Zero Playback Disruption:** Operates within the primary `BrowserWindow` instance by dynamically resizing and clamping the window (`360px × 140px`) using Electron's `win.setBounds()` and `win.setAlwaysOnTop(true, 'screen-saver')`. This guarantees uninterrupted `AudioContext` streaming, buffer persistence, and zero audio clicks or dropouts.
- **Screen Boundary Protection:** Clamps coordinates against the active display (`screen.getDisplayMatching(bounds)`), ensuring the widget cannot be lost off-screen across multi-monitor setups.
- **Widget Interface ([MiniPlayer.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/layout/MiniPlayer.tsx)):**
  - Frameless `-webkit-app-region: drag` header with custom window controls.
  - Album artwork visual anchor with hover expand button.
  - High-precision playback scrubber and elapsed/remaining tabular numbers.
  - Dynamic volume slider revealed on speaker icon hover.
  - One-click expand button restoring previous window dimensions and position.

### Part 3 — ID3 & FLAC Metadata Editor & Automatic Folder Watcher
- **Hardware-Level Tag Writing ([electron/main.ts](file:///C:/Users/a2301/Desktop/harmoniq/electron/main.ts)):**
  - **MP3:** Managed via `node-id3` (v0.2.9) with ID3v2 tag writing (Title, Artist, Album, Album Artist, Genre, Year, Track Number/Total, and Front Cover embedded artwork buffer).
  - **FLAC:** Managed via `flac-tagger` (v2.1.0) with pure JavaScript Vorbis Comment block reading/writing, preserving unedited comment blocks, embedded pictures, vendor strings, and synced lyrics blocks without file corruption.
- **Metadata Editor Modal ([MetadataEditorModal.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/inspector/MetadataEditorModal.tsx)):**
  - Accessible via "Edit Metadata" in the `AudioQualityInspector` and the `TrackContextMenu`.
  - Live cover artwork preview and native artwork replacement via `dialog:openArtworkImage`.
  - Immediate state reflection across `LibraryContext` and `PlayerContext`.
- **Recursive Automatic Folder Watcher:**
  - Powered by `chokidar` (v6.0.0) with 500ms debouncing queue to batch rapid filesystem updates.
  - Detects `add`, `change`, and `unlink` events across monitored music folders.
  - Incremental updates without expensive full-library rescans.
  - Real-time live status indicator pill in [TitleBar.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/layout/TitleBar.tsx) showing watcher state (`active`, `syncing`, `idle`, `error`), monitored folder count, and last sync timestamp.

### Part 4 — Synchronized Karaoke Lyrics (.LRC)
- **Advanced LRC Parser ([lyricsService.ts](file:///C:/Users/a2301/Desktop/harmoniq/src/services/lyricsService.ts)):**
  - Supports standard `[mm:ss.xx]` and `[mm:ss.xxx]` timestamps with millisecond accuracy.
  - Supports multi-timestamp lines (e.g. `[00:10.00][00:25.00] Chorus`) unpacked into chronologically sorted lyric lines.
  - Filters ID3 metadata tags (`[ti:]`, `[ar:]`, `[al:]`, `[by:]`, `[re:]`).
  - Respects file-level and live user offset tags (`[offset:+500]`).
- **Karaoke Interface ([NowPlayingView.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/views/NowPlayingView.tsx)):**
  - Centered auto-scroll using `scrollTo({ top, behavior: 'smooth' })`.
  - Active line illuminated with dynamic accent color (`var(--accent-dynamic)`) and glowing drop-shadow (`var(--glow-dynamic)`).
  - Inactive lines dimmed with smooth opacity transitions.
  - **Click-to-Seek:** Every timestamped line is interactive; clicking seeks the playback engine instantly.
  - **Manual Loader:** "Load .LRC File" button integrated into both `NowPlayingView` and `LyricsView` via native file dialog.

### Part 5 — Sleep Timer with Gradual Volume Fade-Out
- **Sleep Timer Popover ([BottomPlayer.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/layout/BottomPlayer.tsx)):**
  - Presets for 5, 10, 15, 30, 45, and 60 minutes, plus custom minute input.
  - Tabular numeric countdown (`mm:ss`) displaying remaining duration with progress bar.
- **Gradual Fade-Out Engine ([PlayerContext.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/context/PlayerContext.tsx)):**
  - Triggers an 18-second gradual volume reduction across 60 discrete attenuation steps (300ms interval).
  - Saves the user's initial volume in a mutable ref.
  - Automatically pauses playback upon fade completion and restores base volume for subsequent sessions.
  - Immediate user volume restoration if cancelled during an active fade.

### Part 6 — Dynamic Album-Art Color Extraction & Ambient Mesh Glow
- **Color Extraction Service ([colorExtractionService.ts](file:///C:/Users/a2301/Desktop/harmoniq/src/services/colorExtractionService.ts)):**
  - Samples artwork pixels on an offscreen HTML5 canvas (`willReadFrequently: true`).
  - Clusters color frequencies, extracts dominant primary hue, harmonic secondary hue, and muted complementary tone.
  - In-memory LRU caching prevents redundant pixel processing.
  - Applies dynamic CSS variables to `:root`:
    - `--accent-dynamic`
    - `--accent-dynamic-secondary`
    - `--ambient-primary`
    - `--ambient-secondary`
    - `--ambient-muted`
    - `--glow-dynamic`
- **Ambient Mesh Glow:**
  - Softly blurred dual radial gradients (100px blur, 0.15–0.20 opacity) rendered behind `NowPlayingView` and `BottomPlayer`.
  - CSS `transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1)` ensures gradual atmospheric shifts on track transitions.

### Part 7 — Glassmorphism & Analog Film Grain
- **Frosted Glass Styling:** Applied via `.glass-panel` and `.glass-interactive` across `BottomPlayer`, `QueueDrawer`, `MiniPlayer`, and DSP/modal dialogs (`backdrop-filter: blur(24px) saturate(160%)`, `rgba(15, 15, 22, 0.85)`).
- **Analog SVG Noise Overlay:** Fixed SVG turbulence filter (`feTurbulence type="fractalNoise" baseFrequency="0.80"`) layered at 2.5% opacity with `pointer-events: none` across the entire application viewport, giving digital obsidian surfaces an analog warmth.

### Part 8 & 9 — Tactile Micro-Interactions & Typography
- **Artwork Modes ([NowPlayingView.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/views/NowPlayingView.tsx)):**
  - **Ambient Floating:** Periodic breathing scale animation (`1.0` to `1.03`, 7s ease-in-out) with subtle glow pulsation and pause deceleration.
  - **Vinyl Record LP Mode:** 33⅓ RPM rotating grooved vinyl disc with center label sliding out of the album sleeve on playback and stopping gracefully on pause.
- **Interactive Scrubber:** Hover expansion from 4px to 8px, floating glass tooltip with formatted timestamp (`mm:ss`), and smooth drag-to-seek.
- **DiscoverView Cards ([DiscoverView.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/views/DiscoverView.tsx)):**
  - Hover elevation (`-translate-y-1.5`), artwork zoom (`scale-105`), ambient tinted glow shadow, and sliding glass play button (`opacity 0, translateY 8px` -> `opacity 1, translateY 0`).
- **Tabular Numerics:** Applied `font-variant-numeric: tabular-nums` to all timers, counters, sample rates, and bit depths to eliminate layout jitter.

---

## Verification & Test Results

```
Test Files  9 passed (9)
     Tests  55 passed (55)
  Duration  1.74s
```

| Test Suite | Tests | Result | Notes |
| :--- | :--- | :--- | :--- |
| `metadata_tagger.test.ts` | 2 | Passed | Validates ID3 & Vorbis tag payloads |
| `sleep_timer.test.ts` | 3 | Passed | Tests 18s attenuation steps and volume restoration |
| `color_extraction.test.ts` | 4 | Passed | Verifies caching, fallback palettes & CSS injection |
| `karaoke_lrc_advanced.test.ts` | 5 | Passed | Multi-timestamp, metadata tags, offset & bad line handling |
| `lyrics.test.ts` | 3 | Passed | Baseline LRC parser and sync index tests |
| `inspector.test.ts` | 7 | Passed | Audio quality tier calculation & lossless detection |
| `library.test.ts` | 5 | Passed | Track management & metadata updates |
| `functionality_fixes.test.ts` | 15 | Passed | Regressions & player controls |
| `regression.test.ts` | 11 | Passed | Playlist management & queue ordering |

- **Frontend Compilation:** `npm run build` (`tsc && vite build`) — **0 errors**
- **Electron Compilation:** `npm run build:electron` (`tsc -p tsconfig.electron.json`) — **0 errors**
- **Hardware/Filesystem Test:** Verified writing and reading real `.flac` (with Vorbis comments) and `.mp3` (with ID3v2 tags) files in `C:\Users\a2301\Music\test_music\` with 100% data integrity.
