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

## Known limitations (not changed)
- Crossfade slider is stored but not implemented (needs a dual-element engine).
- "WASAPI Exclusive" is cosmetic: Chromium/Electron can't open exclusive endpoints.
- Tag writing is not supported by the bundled metadata library.
