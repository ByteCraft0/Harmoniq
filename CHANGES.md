# Harmoniq – bug-fix pass

## Playback / audio engine
- Media URL scheme rebuilt (`harmoniq-media://local/<encoded path>`): the old `%2F`-in-host form is rejected by Chromium's URL parser for standard schemes; also handles `#`, `%`, spaces and UNC paths.
- Volume, mute, speed, DSP preset, ReplayGain mode and output device are now applied when the audio graph is created (previously silently dropped until the user touched them; saved EQ never applied at startup).
- Playback speed no longer resets on every track change.
- ReplayGain actually works now (metadata was read from a non-existent field) and also applies with DSP bypassed; boosts are peak-limited.
- "Mono mix" and "Limiter" toggles are wired to the graph (they did nothing).
- Rapid track switching cancelled correctly (load token); play errors / missing files toast and skip (bounded).
- "Stop after current track" sleep timer works (stale closure).
- Shuffle can't re-pick the current track; resume position can't be overwritten by the previous track's events and is throttled; cleared on finish.
- Volume/repeat/shuffle/speed/ReplayGain preferences persist.
- Media Session (SMTC / media keys) integration; taskbar commands wired.

## Library
- Play counts, favorites, resume positions now persist (previously never saved unless something else triggered a save).
- Saves are debounced + atomic; artwork stored once per album (was once per track, rewritten on every change).
- Rescan removes tracks whose files were deleted (skipped if the folder is unreachable).
- Album/artist derivation cached and indexed (was O(n³) and ran 5x per refresh).
- M3U import: BOM, slashes, case, relative paths.

## Electron
- Protocol handler registered once (crashed on macOS `activate`), proper Range parsing (suffix ranges, 416), streams via web streams, extension allow-list, CORS headers.
- `webSecurity` and `sandbox` enabled; navigation locked down; single-instance lock.
- Missing IPC handlers added (`updateSMTC`, `writeTags`); maximize state syncs.
- Codec detection: AAC/M4A no longer labelled MP3; null-safe tag access.
- Build: preload no longer imports from `src/`, so `tsc` emits the flat `dist-electron/main.js` that `package.json` points to (it was writing to `dist-electron/electron/` and shipping a stale `main.js`). New `npm start` / `npm run electron`.

## UI
- CSP no longer blocks the Google Fonts stylesheet.
- Visualizer reads the full spectrum (log-spaced) instead of the lowest 128 bins; waveform uses real window.
- DSP controls no longer overwrite each other on fast drags; persisted settings validated; limiter meter stops re-rendering the whole app.
- Global shortcuts ignore Ctrl/Alt/Meta combos.
- LRC: 3-digit minutes, BOM, 1–3 digit fractions; companion .lrc parsed by the same parser.

## Harmoniq 2.0 – Master Upgrade (Phases 1 through 6)

### Phase 1: Personalization & Listening Experience
- **Dynamic Theme Engine**: Real-time theme palette switching with 6 custom palettes (`Obsidian Violet`, `Emerald Matrix`, `Cyberpunk Amber`, `Electric Cyan`, `Crimson Velvet`, `Rose Gold`).
- **Listening Rooms**: Acoustic environment presets (`Studio Clean`, `Warm Living Room`, `Acoustic Hall`, `Club & Bass`, `Late Night Whisper`) with custom reverb, spatial width, and tone warmth.
- **Session Recovery**: Instant persistence and automatic restore of playback position, active queue, volume, repeat/shuffle states across app restarts and crashes.

### Phase 2: Music Collection & Organization
- **Listening Calendar**: Dedicated monthly calendar view with listening duration, daily track counts, most-played song, and activity heatmaps.
- **Multiple Independent Queues**: Create, rename, duplicate, delete, reorder, and switch between multiple saved queues without losing state.
- **Playlist Folders**: Hierarchical nested playlist folders with drag-and-drop organization.
- **Playlist Revision History**: Automatic snapshot creation on playlist changes with one-click restore.

### Phase 3: Professional Audio Features
- **ABX Audio Comparison**: Double-blind randomized audio comparison tool with binomial p-value statistical significance scoring.
- **Waveform Navigation**: Asynchronous Float32 PCM audio decoding and cached peak/RMS seekbar waveform visualization.
- **Audio Routing Profiles**: Hardware output device profiles with automatic scenario detection (Headphones, Hi-Fi DAC, Studio Monitors).
- **Volume Profiles**: Time-of-day listening curves and device-specific volume limiters.

### Phase 4: Windows Desktop Productivity
- **Hotkey Profiles**: 5 usage scenario profiles (`Desktop Default`, `Audiophile`, `Media Keys Only`, `Gaming`, `Laptop`), key remapping, and conflict detection.
- **Floating Desktop Mini-Player**: Always-on-top draggable widget with compact/expanded modes, dynamic artwork mesh glow, and opacity slider (60%–100%).
- **Extended Auto-Shutdown**: Sleep timer with track and queue boundaries, gentle volume fade-out, and app termination.
- **Backup & Restore**: Complete library zip archive export/import with SHA-256 checksum verification.
- **Portable Mode**: Zero-footprint portable execution with relative path resolution.

### Phase 5: Immersive Visual Experience
- **Immersive Album Mode**: Full-screen album showcase with cover art dynamic ambient lighting, tracklisting, synced lyrics overlay (`L`), and acoustic visualizer overlay (`V`).
- **Vinyl Collection Mode**: Virtual record crate with cardboard sleeves, sliding vinyl records with realistic grooves and labels, 33⅓ RPM turntable rotation, and decade filter chips.
- **Harmoniq Signature Branding**: Custom SVG monogram logo (`HarmoniqLogo`), sinusoidal pulse waveform loader (`HarmoniqWaveformLoader`), and 6 custom line-art empty states (`HarmoniqEmptyState`).

### Phase 6: Final Visual Polish & Quality Assurance
- **Signature Waveform Volume Control**: Replaced conventional volume icons with dynamic 5-bar audiophile waveform responding to volume level, playback animation, and muting.
- **Collapsible Sidebar Rail**: Toggle between 240px and 68px rail (`Ctrl+B`) with glowing active indicators.
- **TitleBar Branding**: Harmonized top titlebar with Harmoniq monogram, dynamic page titles, and musical navigation.
- **Unified Empty/Loading States**: Standardized vector feedback across Library, Playlists, Queue, Lyrics, Search, Radio, and Podcasts.
- **Complete Test Coverage**: 27 test files, 248 passing tests, zero regressions.

---

## Known limitations (not changed)
- Crossfade slider is stored but not implemented (needs a dual-element engine).
- "WASAPI Exclusive" is cosmetic: Chromium/Electron can't open exclusive endpoints.
- Tag writing is not supported by the bundled metadata library.
