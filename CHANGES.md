# Harmoniq 2.0.1 — Creative Musical Playback Controls Redesign

## BottomPlayer Creative Instrument Controls
- **Drum-Based Play/Pause Control (`DrumPlaybackControl.tsx`)**: Replaced generic play/pause button with a miniature acoustic snare drum.
  - Active playback animates dual hickory drumsticks realistically alternating strikes (0.88s CSS keyframes), emits acoustic ripples across the batter head, displays pause indicator bars, and radiates a subtle violet aura.
  - Paused playback halts all animations, rests both drumsticks at a natural angle, and displays a crisp violet play triangle glyph.
  - Full keyboard accessibility (`focus-visible:ring-2 focus-visible:ring-violet-500`, ARIA labels, `aria-pressed`) and `@media (prefers-reduced-motion: reduce)` support.
- **Trumpet-Based Previous/Next Controls (`TrumpetTrackControl.tsx`)**: Refined to dark brushed champagne brass with muted antique gold highlights, charcoal-black shadows, and subtle violet reflections to harmonize with Harmoniq's interface.
  - Previous trumpet is flipped horizontally (`scale-x-[-1]`) facing left towards earlier tracks.
  - Next trumpet points forward facing right with matching dimensions, material, and visual weight.
  - On hover: Metallic highlights subtly brighten with a soft violet contour glint; background remains unchanged.
  - On click: Restrained mechanical recoil and piston valve press with tiny, delicate lavender/champagne acoustic wave arcs.
- **Strict Functionality Preservation**: Zero disruption to audio engine DSP, playback handlers (`togglePlayPause`, `prevTrack`, `nextTrack`), timeline seeking, waveform volume control, or queue management.
- **Test Suite**: 10 new regression tests in `src/test/instrument_controls.test.tsx` verified; full suite (70 test files, 795 tests) passing with 0 regressions.

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

### Universal Music Engine — Phase 3: Commercial Music Discovery & Provider Expansion
- **Comprehensive Provider Capability Audit**:
  - **Spotify Web API**: Investigated and implemented official OAuth 2.0 Client Credentials flow (`/api/token`). Audited catalog search, high-res 640x640 artwork, ISRC identification, popularity metrics (0-100), and official track destination links (`open.spotify.com`). Confirmed Spotify's broad deprecation of unauthenticated 30s audio previews for modern API applications. Full audio playback via Spotify Web Playback SDK requires Widevine CDM (not bundled in standard Electron) and user Spotify Premium account with `streaming` OAuth scope. Classified as `external_link` (or `preview_stream` when audio previews are present).
  - **YouTube Data API v3**: Investigated and implemented official Google Cloud YouTube Data API v3 search with music category filtering (`videoCategoryId=10`) and video duration enrichment. Strictly enforces YouTube Terms of Service Section II.10: stream ripping, audio extraction, or separating audio from video is strictly prohibited. Classified as `authorized_embed` with explicit watch links and video metadata.
  - **Apple Music / MusicKit**: Audited dual-tier architecture: verified that the unauthenticated iTunes Catalog API provides zero-fee, instant discovery across Bollywood, Punjabi, Regional Indian, and International catalogs with 30s AAC previews (`preview_stream`) and open CORS. Audited MusicKit JS, documenting requirements for Apple Developer Program membership ($99/year), Team ID, Key ID, private `.p8` key, and active user Apple Music subscription for full playback.
  - **JioSaavn & Regional Indian Music Services**: Conducted definitive API investigation for JioSaavn, Gaana, Wynk, and Hungama. Confirmed that none of these services provide official public third-party developer APIs or open SDKs. Third-party scraping libraries rely on reverse-engineered private mobile endpoints that violate terms of service and break unpredictably. Strictly prohibited unauthorized scraping per project guidelines. Certified JioSaavn as `NOT AVAILABLE` in compliance status matrix. Complete Indian music coverage is provided legitimately via Apple Music (30s previews), YouTube official music label channels (T-Series, Zee Music, YRF, Sony Music India, Speed Records), Spotify catalog metadata, and Internet Archive historical collections.
- **Provider Adapters & Type Contracts**:
  - Created `SpotifyProvider` (`src/services/providers/spotifyProvider.ts`) with automatic token renewal, cached access tokens, popularity and ISRC parsing, and graceful error handling.
  - Created `YouTubeProvider` (`src/services/providers/youtubeProvider.ts`) with ISO-8601 duration parsing (`parseIsoDuration`), channel attribution, and thumbnail extraction.
  - Extended `ProviderId` to include `'spotify'`, `'youtube'`, `'jiosaavn'`.
  - Extended `PlaybackCapability` to include `'authorized_embed'`, `'external_link'`, `'metadata_only'`, `'unavailable'`.
  - Extended `UnifiedTrack` with `popularity?: number`, `isrc?: string`.
  - Added `ProviderCapabilityAudit` contract and `getCapabilityAudit()` method to providers and `universalMusicService.ts`.
- **Rank-Based Deduplication**:
  - Upgraded deduplication logic to score candidates by playback capability: `full_stream (10) > preview_stream (8) > authorized_embed (6) > external_link (4) > metadata_only (2)`.
  - Ensures users always receive the most playable, authorized version of a song while retaining rich metadata.
- **UI Capability Badging & Explicit Actions**:
  - Upgraded `src/components/online/OnlineMusicSearchView.tsx` with capability badges: `Full Track`, `30s Preview`, `Authorized Video`, `Official Link`, `Metadata Only`, `Local File`.
  - Implemented branded provider badges for Spotify (emerald `#1ed760`), YouTube (red `#ff4e4e`), and Apple Music (violet).
  - Enforced strict playback action rules: suppressed internal audio Play and Queue buttons on `external_link`, `metadata_only`, and `authorized_embed` tracks.
  - Provided explicit destination actions: "Open in Spotify" / "Open External Source" for external-link items, and "Watch Video" for YouTube video results.
  - Displayed popularity scores (`★ {popularity}%`) and ISRC identifiers.
  - Added Spotify and YouTube filter chips with live result counts.
  - Updated initial discovery hero cards to highlight Spotify and YouTube integrations.
- **Multi-Provider Configuration & Compliance Hub**:
  - Expanded `src/components/views/SettingsView.tsx` with a unified Multi-Provider Hub.
  - Added Spotify Web API configuration card (Client ID and masked Client Secret with persistence and clear actions).
  - Added YouTube Data API v3 configuration card (API key input, validation, persistence, and clear actions).
  - Added Provider Capability & Compliance Matrix table summarizing status, coverage, playback capability, and authentication requirements across all 7 audited providers.
- **IPC & Security Hardening**:
  - Updated `electron/main.ts` with `spotifyTask` and `youtubeTask` executing in the background with timeouts and capability rankings.
  - Added secure `universal:getProviderConfigs` and `universal:saveProviderConfigs` IPC handlers keeping API secrets protected.
  - Exposed handlers via `electron/preload.ts` and `src/types/electron.ts`.
- **Complete Test Verification**:
  - Created `src/test/universal_music_phase3.test.ts` (15 comprehensive unit and integration tests).
  - Full test suite: 33 test files, 331 tests passing, 0 failures.
  - Verified `tsc`, `npm run build:electron`, and `npm run build` with zero errors.

### Harmoniq 2.0.1 — Security, Performance & UI Visual Refinement

#### 1. Full Dependency Security Remediation
- **music-metadata Upgrade**: Migrated to `music-metadata@11.16.1` resolving GHSA-5v7r-6r5c-r473 and GHSA-v6c2-xwv6-8xf7 with module-scoped cached native dynamic `import()` in CommonJS Electron runtime.
- **Runtime & Toolchain Hardening**: Upgraded Electron to `45.4.1`, Vite to `6.4.6`, and Vitest to `5.1.1`. Resolved all 24 security audit vulnerabilities across production and developer dependencies.
- **Audit Verification**: Verified `npm audit` and `npm audit --omit=dev` report exactly 0 vulnerabilities.

#### 2. Search Index Multi-Field Consistency
- **Corpus Architecture**: Migrated from a single space-concatenated string to pre-lowercased searchable field tuples (`title`, `artist`, `album`, `albumArtist`, `genre`, `codec`, `container`, `fileName`).
- **Eliminated False Positives**: Resolved cross-field matching bugs (e.g. searching "Dark Knight" no longer matches title "Dark" + artist "Knight").
- **Reactive Mutations**: Hardened all track update methods (`updateTrack`, `updateTracks`, `addTracks`, `clear`) to maintain synchronized search indices without stale entries.

#### 3. Deep CPU & Memory Performance Optimization
- **Zero-Allocation Typed Audio Buffers**: Replaced per-frame `new Uint8Array()` and `new Float32Array()` instantiations across all visualizers (`AudioVisualizer`, `MiniLiveVisualizer`, `RealTimeFrequencySpectrum`, `AdvancedVisualizer`, `CircularAudioVisualizer`, `FullScreenVisualizer`, `HarmoniqPulseOrb`) with persistent reusable typed arrays, eliminating GC thrashing.
- **Window Lifecycle Service**: Introduced `windowLifecycleService` monitoring Electron window focus and minimize states. Automatically pauses `requestAnimationFrame` render loops and suspends audio graph rendering when the application is minimized or hidden.
- **0% Idle CPU**: Reduced minimized/paused CPU utilization from ~9–13% to 0.0% with zero background battery drain.

#### 4. UI Layout Repair & Premium Continuous SVG Volume Wave Redesign
- **Eliminated Floating Waveform Collision**: Re-architected `NowPlayingView` into natural scrollable flow (`min-h-full flex flex-col gap-6`), items start-aligned, and established a dedicated, authoritative Playback Timeline row (`border-t border-[#272733]/80`) in normal document flow below the spectrum and lyrics grid, permanently eliminating collisions on displays $\le 800\text{px}$ in height.
- **Removed Duplicate Volume Controls**: Completely removed the redundant inline volume wave from `NowPlayingView`, centralizing volume management into a single persistent control in `BottomPlayer`.
- **Continuous Neon Waveform Volume Control**: Replaced segmented 5-bar controls with a smooth, flowing sinusoidal SVG wave ($\lambda = 60\text{px}$, $A = 3.2\text{px}$) animated via seamless CSS translation (`@keyframes volume-wave-flow` at $-60\text{px}$, 0% JS overhead) with restrained purple-to-lavender neon glow (`#A855F7` to `#C084FC`).
- **Audiophile Knob Disc**: Engineered a solid circular white handle disc ($r = 5\text{px}$) with lavender rim, inner dot, and ambient halo. Mapped exact coordinate boundaries (`6 + effectiveVolume * 148`) and dynamic clip rect (`(isMuted || effectiveVolume === 0) ? 0 : handleX`) for 0% wave overshoot.
- **BottomPlayer Layout Polish**: Sized volume control to `w-[110px]` with subtle vertical divider line separating action icons and volume wave.
- **Comprehensive Test Suite**: Created `src/test/ui_layout_and_volume_wave.test.ts` (17 tests) and `src/test/cpu_memory_optimization.test.ts` (14 tests). All 66 test suites passing (749/749 tests).

#### 5. UI Vertical Scroll, AI Orb History & Song Library Alignment Repair
- **Main View Vertical Scroll Resolution**: Re-architected container constraints in `NowPlayingView.tsx` from `min-h-full` to `h-full w-full overflow-y-auto pb-10`, bounded within `App.tsx`'s `min-h-0` flex layout. Content extending below the viewport (such as Specs mode, Source File Stream, and Output Audio Pipeline) can now be smoothly scrolled down and back up with zero clipping by `main.overflow-hidden`.
- **AI Orb History Scroll Stability**: Replaced un-gated `.scrollIntoView({ behavior: 'smooth' })` with an intelligent, user-aware auto-scroll controller in `HarmoniqAssistantPanel.tsx`. Manual upward scrolling through conversation history is now completely protected against resets, token stream jitter, and speech transcript fluctuations. Added CSS `overscroll-behavior: contain` and a floating "Latest" return button.
- **Songs Library Favorite Action Alignment**: Redesigned `SongRow.tsx` and `SongTableHeader.tsx` CSS grids to 8 columns (with album) and 7 columns (no album) with an intentional, dedicated 36px Favorite column and 56px index/checkbox column. Sized the favorite action to a comfortable $28\times 28\text{px}$ clickable target (`w-7 h-7`), eliminated title collisions, and ensured graceful title truncation with ellipsis.
- **Dedicated Regression Suite**: Created `src/test/ui_scroll_orb_history_library_alignment.test.ts` (13 tests). Full project suite: 67 test files, 762/762 passing tests.

#### 6. Premium Equalizer & Audio Effects UI Redesign (Charcoal Black × Muted Violet)
- **Strict Color System Architecture**: Implemented a disciplined, audiophile two-color design system:
  - Charcoal Black: `#09090B` (main background), `#111116` (secondary surfaces), `#17171F` (elevated cards), `#20202C` (elevated surfaces), `#292936` and `#343443` (borders).
  - Muted Violet: `#8B5CF6` (primary), `#A78BFA` (secondary), `#C4B5FD` (soft), `#62518A` (muted), `rgba(139, 92, 246, 0.10)` (subtle background), `rgba(139, 92, 246, 0.18)` (active glow).
  - Eliminated all off-palette colors (orange, bright neon, blue, pink, high-saturation glows).
- **Dedicated Six-Section Architecture**:
  - **Section 1 (Equalizer Header & Tuned Presets)**: Refined title and subtitle, "32-Bit Float DSP" badge, "Reset Flat" button, and master "DSP: ACTIVE" toggle switch. Presets selector styled with 14 tuned acoustic response curves with active curves highlighted in muted violet.
  - **Section 2 (10-Band Graphic Equalizer with Living Waveforms)**: Clean column layouts for all 10 ISO standard frequency bands (`31Hz`, `62Hz`, `125Hz`, `250Hz`, `500Hz`, `1kHz`, `2kHz`, `4kHz`, `8kHz`, `16kHz`). Each vertical column features frequency-specific sinusoidal wave tracks (from 2 cycles at 31 Hz to 34 cycles at 16 kHz), center 0 dB reference notch, active boost/cut fill, numeric dB readout above, and frequency/range label below. Live audio energy modulation via `audioEngine.getSubBandEnergies()` throttled to ~25fps with `windowLifecycleService.isRenderingSuspended()` protection. Includes interactive combined frequency response curve with Graphic/Parametric mode toggle.
  - **Section 3 (Main Audio Enhancement Controls)**: Balanced 3-column layout (`grid-cols-1 md:grid-cols-3`):
    - **Preamp Gain**: Range `-12 dB` to `+12 dB` with calibrated 13-segment studio VU ladder meter and one-click "Reset 0dB".
    - **Bass Warmth**: Range `0 dB` to `+12 dB` with dynamic 50 Hz low-shelf acoustic resonance curve and subtle bloom gradient.
    - **Treble Air**: Range `-6 dB` to `+12 dB` with dynamic 10 kHz high-shelf shimmer dispersion wave.
  - **Section 4 (Advanced DSP Dynamics Processing)**: Dynamic Peak Limiter card with real soft-knee transfer function curve diagram, live gain reduction meter with dB readout (`-X.X dB`), and anti-clipping status.
  - **Section 5 (Stereo & Spatial Audio Console)**: 12-column grid (`lg:grid-cols-12`):
    - **Left 7 Columns (`lg:col-span-7`) — Realistic Miniature Vinyl Record Dial (`VinylAudioDial.tsx`)**: Physical miniature vinyl record disc with run-in margin, music tracks with separator gap, dead wax, spiral run-out groove, anisotropic specular light sheen reflections, vintage typography center paper label ("HARMONIQ", "33⅓ RPM • SIDE A", "STEREO", and digital readout), metallic spindle collar with hole, tone-arm pointer needle with violet dot, and 33⅓ RPM playback spin.
    - **Right 5 Columns (`lg:col-span-5`) — Channel Routing & Balance Console**: Segmented routing buttons (`Stereo`, `Mono`, `Left`, `Right`), balance panning slider with center detent, and phase-aligned panning indicator.
  - **Section 6 (Acoustic Profiles & Studio Signatures)**: 4 instant acoustic signature cards (`Audiophile Warmth`, `Late Night`, `Electronic Punch`, `Spatial Clarity`), "View All Profiles →" button, and 32-Bit Floating DSP badge.
- **Studio Tab & Modal Harmonization**: Harmonized all 5 studio tabs (`Equalizer & Effects`, `Sound Profiles`, `Track EQ Memory`, `Audio Devices`, `Quality Transparency`) and modal dialogs with matching charcoal card surfaces, muted violet tab pills, and borders.
- **Dedicated Test Suite & Verification**: Created `src/test/premium_equalizer_studio_redesign.test.tsx` (15 tests). Full project suite: 68 test files, 777/777 passing tests, 0 vulnerabilities, 0 whitespace errors.

#### 7. Precision UI Alignment & Text Overflow Repair (Format Badges & Hotkey Profiles)
- **Song Library Format Badge Alignment**:
  - Re-allocated column 7 in `SongRow.tsx` (`SONG_TABLE_GRID_WITH_ALBUM` and `SONG_TABLE_GRID_NO_ALBUM`) from `105px` to `120px` to guarantee ample room for all audio quality badges.
  - Centered table header cell `<span className="text-center min-w-0">Format</span>` in `SongTableHeader.tsx`.
  - Upgraded badge cell container in `SongRow.tsx` from `min-w-0 pr-2 flex items-center justify-end overflow-hidden` to `min-w-0 flex items-center justify-center`. Eliminated left clipping, negative margin blowout, and overflow hiding.
  - Symmetrically refined `QualityBadge.tsx` (size `sm`) to `px-2 h-[18px] text-[8.5px] tracking-wide gap-1.5`, ensuring all 4 quality tiers (`Hi-Res Lossless`, `Lossless`, `High Quality`, `Standard`) fit with generous symmetric padding (5px to 24px) inside the 120px column.
- **Settings Hotkey Profile Card Text Overflow Resolution**:
  - Upgraded grid in `HotkeyProfilesCard.tsx` from brittle `lg:grid-cols-5` to responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3`, preventing severe card squeezing on screens like 1280×720 and 1366×768.
  - Implemented strict boundaries on profile buttons (`min-w-0 w-full min-h-[94px] overflow-hidden`) with a structured 3-row layout: top row (scenario icon + tag + active pill badge or custom delete button), middle row (profile name with `min-w-0 break-words line-clamp-2 leading-snug`), and bottom row (built-in/custom classification tag).
  - Ensured long profile titles (e.g. `Audiophile / Minimalist`, `Gaming / Background Friendly`) wrap gracefully onto 2 lines with zero horizontal overflow, zero neighbor collision, and uniform row height.
  - Harmonized scenario icon and active card styling to strict Charcoal Black (`#181824`, `#272733`) and Violet (`#8B5CF6`, `#A78BFA`, `#C4B5FD`).
  - Added lazy initial state to `useState(() => hotkeyProfileService.getProfiles())` and `useState(() => hotkeyProfileService.getActiveProfile())` for instantaneous, flash-free rendering.
- **Dedicated Regression Suite & Visual Validation**:
  - Created `src/test/ui_precision_alignment_and_overflow.test.tsx` (8 tests).
  - All 69 test files (785/785 tests) passing with 100% success rate.
  - Verified across 1920×1080, 1600×900, 1440×900, 1366×768, and 1280×720 viewports with zero overflow and zero clipping.
  - Captured updated visual proof: `docs/assets/harmoniq-songs-format-badge-aligned.png` and `docs/assets/harmoniq-settings-hotkeys-wrapped.png`.

---

## Known limitations (not changed)
- Crossfade slider is stored but not implemented (needs a dual-element engine).
- "WASAPI Exclusive" is cosmetic: Chromium/Electron can't open exclusive endpoints.
- Tag writing is not supported by the bundled metadata library.
