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

### Phase 7: Harmoniq Assistant: AI-Powered Chatbot, Voice Interaction & Signature Pulse Orb
- **Harmoniq Pulse Orb**: Created a signature floating holographic orb at `fixed bottom-24 right-6 z-40` with 7 distinct interactive states (`idle`, `hover`, `listening`, `processing`, `responding`, `error`, `inactive`), luminous central energy core, triple audio frequency rings, orbital particles, and reduced-motion support. Automatically hidden in Mini-Player mode.
- **Harmoniq Assistant Panel**: Floating obsidian-glass chat window with conversation thread, user and assistant message styling, suggested question chips, multiline input (`Enter` sends, `Shift+Enter` for newline), response copy button, and live interim speech transcript preview.
- **Multi-Provider AI Architecture**: Configurable connectivity to Google Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), Groq (`llama-3.1-8b-instant`), and a built-in Local Grounded Engine. API keys stored securely in Electron main process `harmoniq_assistant_config.json` with zero renderer or source code exposure.
- **Harmoniq Knowledge Base & Grounded RAG**: Comprehensive structured catalog indexing all 23 genuine Harmoniq 2.0 features with keyword matching, active-view boost, step-by-step guidance, and direct action navigation buttons.
- **Interactive App Guidance with Action Buttons**: Answers generate direct action buttons (e.g. `[Open Equalizer Studio]`, `[Open Playlists]`, `[Open Listening Calendar]`) that drive `LibraryContext.setActiveView` safely.
- **Microphone Voice Input (STT)**: User-initiated speech recognition via Web Speech API with live interim transcript, editability before send, and 10-second silence timeout safeguard.
- **Spoken Voice Responses (TTS)**: Web Speech Synthesis reading responses aloud with markdown cleaning, independent audio output stream (never interrupts music playback), volume slider, and system voice selection.
- **Assistant Settings Card**: Integrated into `SettingsView.tsx` with provider selector, API key input, connection tester, voice controls, and conversation history management.
- **Full Test Verification**: 28 test suites, 262 passing tests, zero regressions. All phase reports updated in `docs/phases/`.

### Smart Podcast URL Importer
- **Universal URL Resolver**: Resolves raw podcast URLs, Apple Podcasts show links, Spotify show links, Podcast Index, and custom podcast websites directly to their underlying RSS/Atom feed.
- **Electron IPC Backend**: Added `podcast:resolveUrl` with strict SSRF defense (`isSafePublicUrl`), HTTPS redirection following, HTML `<link rel="alternate">` feed detection, and Apple iTunes Search API integration.
- **Add Podcast Modal**: Glassmorphism modal with animated detection states, real-time discovery card (artwork, show title, author, description, episode count), and one-click subscription.
- **Zero Duplicate Feeds**: Automatically checks existing podcast subscriptions and updates feed metadata safely.

### Mini Player Visual Redesign: Premium Floating Music Console
- **Deep Obsidian & Glassmorphism Aesthetic**: Redesigned `MiniPlayer.tsx` with obsidian `#0B0813` background, layered backdrop blur (`backdrop-blur-2xl`), subtle violet border (`border-violet-500/20`), and smooth transitions.
- **Dynamic Ambient Artwork Lighting**: Multi-layer radial ambient lighting driven by dominant colors extracted from the active album cover via `colorExtractionService`, with smooth 1000ms CSS transitions and low-opacity diffusion for maximum readability.
- **Audio-Reactive Live Visualizer**: Created `MiniLiveVisualizer.tsx` with 4-5 dynamic frequency bars driven by real-time Web Audio FFT spectrum data via `audioEngine.getFrequencyData`. Gracefully freezes when paused and dims when muted.
- **Interactive Waveform Progress Scrubber**: Created `MiniWaveformProgressBar.tsx` with 36-38 sculpted vertical waveform bars matching track acoustics, highlighted played section, hover timestamp preview tooltip, and smooth click/drag scrub seeking.
- **Centerpiece Transport Console**: Signature 40px circular Play/Pause button with violet-to-indigo gradient (`from-[#7C3AED] via-[#8B5CF6] to-[#6366F1]`), outer glow, and tactile active press response.
- **Streamlined Compact Pill Mode**: Compact 380x100px layout with mini artwork, 30-bar compact waveform progress bar, audio-reactive live visualizer, and compact transport buttons.
- **Complete Test Coverage**: 30 test files, 281 passing tests, zero regressions.

### Universal Music Engine — Phase 1: Core Architecture, Data Contracts & Streaming Foundation
- **Unified Track Data Contracts**: Created `src/types/universalMusic.ts` defining `UnifiedTrack`, `ProviderId`, `PlaybackCapability`, `MusicProvider`, and bi-directional adapters (`unifiedTrackToTrackMetadata`, `trackMetadataToUnifiedTrack`).
- **Web Audio Streaming Extension**: Updated `buildMediaUrl()` in `src/services/audioEngine.ts` to pass validated external HTTP/HTTPS streams directly into the dual-deck pipeline while rejecting malicious protocol schemes and preserving local `harmoniq-media://` routing.
- **Modular Provider Architecture**: Created `src/services/providers/` featuring `BaseMusicProvider` and Tier 1 foundation adapters:
  - `JamendoProvider`: Full-length Creative Commons MP3 streaming.
  - `AudiusProvider`: 320kbps modern creator streaming via decentralized discovery nodes.
  - `ArchiveProvider`: Public domain classical, historical, and South Asian archival streaming.
  - `ApplePreviewProvider`: Universal Bollywood, Punjabi, Regional Indian, and International catalog discovery with legitimate 30-second AAC previews.
  - `LocalLibraryProvider`: Seamless offline library search integration.
- **Universal Music Orchestrator**: Built `src/services/universalMusicService.ts` providing parallel provider dispatch, failure isolation (`Promise.allSettled`), smart deduplication prioritizing full streams over previews, 15-minute LRU caching, and search cancellation.
- **Secure Electron IPC Foundation**: Implemented `universal:search` in `electron/main.ts` with timeout safeguards (9s), input validation (150 chars), and exposed it via `electron/preload.ts`.
- **Complete Test Verification**: 31 test files, 302 passing tests, zero regressions. All builds verified.

### Universal Music Engine — Phase 2: UI Transformation & Real Playback Integration
- **In-Place Navigation Upgrade**: Renamed sidebar navigation item in `src/components/layout/Sidebar.tsx` to "Universal Music" while preserving the exact view position and route key `online_music`. Discover remains separate for recommendations and exploration.
- **Premium Universal Music UI**: Upgraded `src/components/online/OnlineMusicSearchView.tsx` with obsidian aesthetic, ambient violet/lavender glow, 350ms debounced search, category filter tabs (`all`, `song`, `artist`, `album`), and interactive provider chips (`All Sources`, `Apple Music`, `Audius`, `Internet Archive`, `Jamendo`, `Local Library`) with live result counts.
- **On-Demand Stream Resolution Engine**: Implemented `universal:resolveStream` in `electron/main.ts` and `resolveTrackStream()` in `universalMusicService.ts`:
  - **Audius**: Resolves ephemeral 300s presigned streaming URLs on-demand from discovery node redirects without storing expiring tokens.
  - **Internet Archive**: Resolves real audio filenames from item metadata manifest (`/metadata/{id}/files`), prioritizing VBR MP3 and ignoring auxiliary `.xml`, `.png`, `.afpk` files, avoiding 404s on custom file names.
  - **Apple Music**: Accurately classifies and verifies 30-second AAC previews (`preview_stream`).
  - **Jamendo**: Verifies full-track streaming with customizable developer Client ID.
  - **Local**: Resolves offline local files instantly.
- **Real Playback & Queue Integration**: Connected search results directly to `PlayerContext.tsx` and `audioEngine.ts`:
  - Play button streams tracks through Harmoniq's 32-bit floating-point Web Audio graph with 10-band EQ, reverb rooms, visualizers, Now Playing, and Mini Player updates.
  - "Add to Queue" and "Play Next" preserve full online track descriptors (`providerId`, `providerTrackId`, `isOnline`, `playbackCapability`), allowing seamless queue transitions between local and online songs with on-demand stream resolution.
- **Jamendo Settings Card**: Added developer Client ID configuration in `SettingsView.tsx` with validation, persistence via `localStorage` and Electron storage, and non-blocking failure isolation.
- **Comprehensive State Architecture**: Designed rich states for initial exploration with quick query chips (`Moonlight`, `Arijit Singh`, `The Weeknd`, etc.), waveform loading, provider failure banners, empty states, and track card loading indicators.
- **Security & SSRF Hardening**: Enforced HTTP/HTTPS restrictions, private/loopback IP blocking (`isSafePublicUrl`), 9-second request timeouts, and sanitized responses.
- **Complete Test Coverage**: Created `src/test/universal_music_phase2.test.ts` (14 new tests). Full suite: 32 test files, 316 passed tests, zero regressions. All Vite and Electron builds verified.

---

## Known limitations (not changed)
- Crossfade slider is stored but not implemented (needs a dual-element engine).
- "WASAPI Exclusive" is cosmetic: Chromium/Electron can't open exclusive endpoints.
- Tag writing is not supported by the bundled metadata library.
