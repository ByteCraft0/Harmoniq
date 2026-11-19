# HARMONIQ — Premium High-Fidelity Audio Player for Windows

**HARMONIQ** is a minimalist, audiophile-grade local audio player engineered specifically for Windows. It provides transparent stream diagnostics, real-time 10-band DSP processing, gapless playback, and high-performance library management for collections of 10,000+ tracks.

---

## 🎧 Architecture & Technical Philosophy

Harmoniq is architected around three non-negotiable principles:
1. **Never Fake Audio Specifications**: Audio codecs, bit-depths, container formats, and sample rates are extracted directly from audio headers—never inferred from file extensions or nominal bitrates.
2. **Real DSP, Never Decorative Controls**: All 10 equalizer bands, preamp gain stages, tone shelves, and anti-clipping limiters are directly wired into a 32-bit floating-point Web Audio DSP pipeline.
3. **Local-First & Zero Bloat**: No accounts, no advertising, no cloud dependencies, and zero background telemetry.

```
                      [ Audio Source File (.flac, .wav, .mp3, .m4a, .alac, .ogg, .opus) ]
                                                     │
                                                     ▼
                                    [ Preamp Gain Stage (-12 dB to +12 dB) ]
                                                     │
                                                     ▼
                              [ 10-Band Graphic EQ (32 Hz to 16 kHz ISO Bands) ]
                                                     │
                                                     ▼
                                  [ Bass (100 Hz) & Treble (10 kHz) Shelves ]
                                                     │
                                                     ▼
                                  [ Stereo Balance / Mono Downmix Matrix ]
                                                     │
                                                     ▼
                               [ Anti-Clipping Brickwall Dynamics Limiter ]
                                                     │
                                                     ▼
                                   [ High-Resolution FFT Analyser ]
                                                     │
                                                     ▼
                                  [ Windows WASAPI Audio Endpoint ]
```

---

## 🌟 Core Signature Features

### 1. Technical Audio Quality Inspector
Accessible directly from Now Playing, the Bottom Player, and the sidebar:
- **Source Stream Specifications**: Codec detail, container format, sample rate, true bit depth (e.g., 24-bit PCM), bitrate (kbps), channels, and lossless classification.
- **Hardware & Endpoint Inspection**: Active output device name, processing bit depth (24-bit floating point), buffer size, and estimated hardware latency.
- **Resampling Diagnosis**: Deterministic analysis of source rate vs. output rate. Truthfully reports when Windows Audio Engine sample rate conversion (SRC) is engaged.
- **Bit-Perfect Verification Matrix**:
  - Sample Rate 1:1 Matched
  - Digital Volume at 100% (0 dB Unity Gain)
  - DSP / EQ Bypassed or Flat
  - ReplayGain Normalization Disabled
  - WASAPI Direct Hardware Ownership

### 2. Professional Equalizer & DSP Studio
- **10-Band Graphic EQ**: ISO standard frequencies: `32 Hz`, `64 Hz`, `125 Hz`, `250 Hz`, `500 Hz`, `1 kHz`, `2 kHz`, `4 kHz`, `8 kHz`, `16 kHz`.
- **Preamp Stage**: -12 dB to +12 dB headroom compensation.
- **Tone Controls**: Independent Bass Boost (100 Hz shelf) and Treble Boost (10 kHz shelf).
- **Anti-Clipping Limiter**: Real-time gain reduction monitoring in dBFS to protect speakers and prevent digital clipping distortion.
- **Built-in & Custom Presets**: Flat (Reference), Bass Boost, Rock, Pop, Jazz, Classical, Acoustic, Vocal, Electronic, Podcast. Supports custom preset creation, renaming, and persistence.
- **Stereo Balance & Mono Downmix**: Continuous balance slider and single-click mono summation.

### 3. High-Speed Music Library Management
- **Large Collections**: Built to index and search 10,000+ tracks with sub-15ms full-text query response times.
- **Multi-Dimensional Browsing**: Browse by Songs, Albums, Artists, Genres, Folders, and Playlists.
- **Smart Playlists**: Dynamic auto-generated playlists for Favorites, Recently Played, Recently Added, and Most Played.
- **M3U / M3U8 Interoperability**: Full import and export of industry-standard `.m3u` / `.m3u8` playlists.

### 4. Synchronized Lyrics Engine
- Reads embedded ID3 (`USLT`) and Vorbis comment (`LYRICS`) tags.
- Automatically searches for and loads companion `.lrc` files in the audio track folder.
- Millisecond-accurate synchronized line highlighting with interactive line-seeking.
- Manual offset adjuster (+/- 200ms, 500ms) with reset.

### 5. Podcast & Audiobook Features
- Variable playback speeds from `0.5x` to `3.0x`.
- Pitch preservation toggle.
- Per-file resume position memory for recordings over 10 minutes.
- Configurable sleep timer (5 to 60 minutes or stop at end of current track).

---

## 🛠️ Installation & Build Instructions

### Prerequisites
- Windows 10 / Windows 11 (64-bit)
- Node.js v18+ (tested on Node.js v24.20)
- npm v10+

### Development Mode
```bash
# Navigate to the Harmoniq directory
cd harmoniq

# Install dependencies
npm install

# Run frontend dev server
npm run dev
```

### Running Unit Tests
```bash
# Execute unit tests with Vitest
npm test
```

### Building the Windows Desktop App
```bash
# Compile TypeScript frontend and Electron backend
npm run build
npm run build:electron

# Package unpacked Windows executable (release/win-unpacked/Harmoniq.exe)
npx electron-builder --win --dir

# Package standalone Windows NSIS Setup Installer (.exe)
npm run dist
```

---

## 📂 Project Structure

```
harmoniq/
├── electron/
│   ├── main.ts               # Electron lifecycle, media protocol, IPC handlers
│   └── preload.ts            # Secure contextBridge API definition
├── src/
│   ├── types/                # Core TypeScript types (audio, dsp, inspector, library, lyrics)
│   ├── services/
│   │   ├── audioEngine.ts    # Web Audio DSP pipeline, EQ filters, limiter, analyser
│   │   ├── inspectorService.ts# Audio quality diagnostics, resampling, bit-perfect matrix
│   │   ├── libraryService.ts # High-scale track indexing, search, album/artist aggregation
│   │   └── lyricsService.ts  # Synchronized LRC parsing and active line finder
│   ├── context/
│   │   ├── PlayerContext.tsx # Playback state, transport, queue, sleep timer
│   │   ├── DSPContext.tsx    # Equalizer bands, presets, tone controls, limiter metrics
│   │   └── LibraryContext.tsx# Library data, view navigation, playlists, scanning
│   ├── components/
│   │   ├── layout/           # TitleBar, Sidebar, BottomPlayer, QueueDrawer
│   │   ├── inspector/        # AudioQualityInspector, QualityBadge
│   │   ├── dsp/              # EqualizerStudio
│   │   ├── visualizer/       # AudioVisualizer (FFT spectrum & oscillogram)
│   │   └── views/            # Home, Library, AlbumDetails, ArtistDetails, NowPlaying, etc.
│   ├── test/                 # Vitest unit test suites
│   ├── App.tsx               # Root component & global shortcuts
│   ├── main.tsx              # React DOM entry
│   └── index.css             # Dark charcoal & electric violet design system
├── package.json              # App configuration, build scripts, electron-builder config
├── tsconfig.json             # TypeScript configuration for renderer
├── tsconfig.electron.json    # TypeScript configuration for Electron main
└── vite.config.ts            # Vite bundler configuration
```

---

## 🚀 Harmoniq 2.0 (Phases 1 – 7 Architecture & Upgrades)

Harmoniq 2.0 introduces an advanced suite of audiophile tools, Windows desktop productivity, immersive visual experiences, and intelligent AI assistance:

- **Phase 1 – Personalization & Experience**: Dynamic Theme Engine, 6 High-Contrast Audiophile Presets, Listening Rooms, and Session Crash Recovery.
- **Phase 2 – Music Collection & Organization**: Genuine Listening Calendar & Daily Activity Heatmap, Multiple Independent Saved Queues, Playlist Folders (nested hierarchies), and Playlist Revision History Snapshots.
- **Phase 3 – Professional Audio Features**: ABX Double-Blind Audio Comparison Tool with binomial statistical p-value evaluation, Asynchronous PCM Waveform Navigation & Seeking, Scenario-Based Audio Routing Profiles, and Time-of-Day Volume Profiles.
- **Phase 4 – Windows Desktop Productivity**: 5 Built-in Hotkey Scenario Profiles with conflict detection, Floating Always-on-Top Desktop Mini-Player Widget, Extended Auto-Shutdown Sleep Timer with volume fade-out, Full Library Backup/Restore with SHA-256 checksums, and Portable Storage Mode.
- **Phase 5 – Immersive Visual Experience**: Full-Bleed Immersive Album Mode with dynamic color extraction, Virtual Vinyl Collection Record Crate with 33⅓ RPM turntable rotation, Harmoniq Monogram Logo, Sinusoidal Waveform Loader, and Vector Empty States.
- **Phase 6 – Final Visual Polish & Quality Assurance**: Signature 5-Bar Dynamic Waveform Volume Control, Collapsible Sidebar Rail (`Ctrl+B`), TitleBar branding, Unified loading/empty states, and regression test pass.
- **Phase 7 – Harmoniq Assistant: AI-Powered Chatbot, Voice Interaction & Signature Pulse Orb**: Floating holographic Pulse Orb with 7 visual states, grounded multi-provider AI backend (Google Gemini, OpenAI, Groq, and 100% offline Local Grounded Engine), grounded RAG catalog across all 23 application features, interactive `[Open <Feature>]` navigation buttons, microphone Speech-to-Text (STT) with live interim transcripts, and independent Text-to-Speech (TTS) spoken responses that never interrupt music playback.
- **Smart Podcast URL Importer**: Universal podcast URL detection and feed resolution supporting Apple Podcasts, Spotify show links, Podcast Index, and custom websites via secure SSRF-guarded Electron IPC with real-time metadata preview and subscription.
- **Mini Player Visual Redesign (Premium Floating Music Console)**: Deep obsidian glassmorphism console with dynamic album art ambient lighting, 4-bar live audio-reactive FFT visualizer (`MiniLiveVisualizer`), interactive 36-bar acoustic waveform seek bar (`MiniWaveformProgressBar`), centerpiece 40px circular Play/Pause button, and compact 380x100px pill mode.

Full technical phase reports are available in [`docs/phases/`](file:///C:/Users/a2301/Desktop/harmoniq/docs/phases/).

---

## 📜 Technical Verification & Feature Disclosure

| Feature | Implementation Status | Technical Mechanism |
| :--- | :--- | :--- |
| **Harmoniq Pulse Orb** | Fully Implemented | Floating holographic SVG/CSS orb with luminous core, triple frequency rings, orbital particles & 7 visual states |
| **Harmoniq Assistant Panel**| Fully Implemented | Obsidian-glass chat window with message thread, suggestion chips, live STT transcript & action buttons |
| **Multi-Provider AI Backend**| Fully Implemented | Modular provider routing (Google Gemini 1.5, OpenAI GPT-4o, Groq Llama-3.1) with protected Electron IPC |
| **Local Grounded AI Engine** | Fully Implemented | 100% offline knowledge base RAG indexing 23 Harmoniq features, generating structured instructions & action chips |
| **Voice Input (STT)** | Fully Implemented | User-initiated microphone speech recognition with live interim preview, editability, and silence safety timeout |
| **Voice Responses (TTS)** | Fully Implemented | Independent Web Speech synthesis with markdown cleaning, volume control, voice selection & zero music disruption |
| **Interactive App Navigation**| Fully Implemented | Grounded assistant responses with direct action buttons dispatching verified application routes via `setActiveView` |
| **Smart Podcast Importer** | Fully Implemented | Universal URL detection engine with Apple/Spotify resolution, SSRF protection, iTunes lookup & HTML RSS extraction |
| **Floating Music Console** | Fully Implemented | Always-on-top draggable mini-player with dynamic ambient art lighting, live FFT visualizer, and waveform seekbar |
| **FLAC, MP3, WAV, ALAC, AAC, OGG, OPUS** | Fully Implemented | Native Electron media protocol + `music-metadata` stream extraction |
| **10, 15 & 31-Band Graphic & Parametric EQ** | Fully Implemented | Web Audio `BiquadFilterNode` peaking filters @ ISO center frequencies |
| **Limiter & Anti-Clipping** | Fully Implemented | Web Audio `DynamicsCompressorNode` with brickwall ratio & real gain reduction |
| **Signature Waveform Volume** | Fully Implemented | 5-bar dynamic waveform with playback animation, volume fill & mute strike |
| **Audio Quality Inspector** | Fully Implemented | Real-time diagnostic inspector evaluating bit-depth, codec, resampling & bit-perfect criteria |
| **Bit-Perfect Detection** | Fully Implemented | Deterministic 5-factor matrix (rate match, volume unity, DSP bypass, replaygain off, exclusive mode) |
| **ABX Audio Comparison** | Fully Implemented | Double-blind trials, level-matching, binomial p-value significance scoring |
| **Waveform Navigation** | Fully Implemented | Real asynchronous PCM audio decoding, seekbar scrubbing, peak/RMS cache |
| **Audio Routing Profiles** | Fully Implemented | Scenario routing (Headphones, Hi-Fi DAC, Studio Monitors) with auto-switch |
| **Volume Profiles** | Fully Implemented | Time-of-day automation, device-specific volume capping, curve adjustments |
| **Listening Calendar** | Fully Implemented | Monthly calendar heatmap, genuine playback duration, track count timeline |
| **Multi-Queue Management** | Fully Implemented | Multiple saved queues, reordering, duplication, crash recovery restoration |
| **Playlist Folders & History** | Fully Implemented | Hierarchical nesting, drag-and-drop, revision snapshot timeline & restore |
| **Immersive Album Mode** | Fully Implemented | Full-bleed cover art canvas, dynamic ambient lighting, lyrics overlay, visualizer |
| **Vinyl Collection Mode** | Fully Implemented | Virtual crate, sliding LP cardboard sleeves, optional 33⅓ RPM rotation, decade chips |
| **Floating Desktop Player** | Fully Implemented | Always-on-top draggable mini-player, mesh glow, compact/expanded modes, opacity slider |
| **Hotkey Profiles** | Fully Implemented | 5 usage scenario profiles, conflict detection, profile import/export |
| **Auto-Shutdown & Sleep Timer**| Fully Implemented | Track/queue boundaries, countdown timer, gentle volume fade-out, app shutdown |
| **Backup & Portable Mode** | Fully Implemented | Complete library zip archive with SHA-256 integrity, relative portable path rewrites |
| **Musical Navigation** | Fully Implemented | Custom Violin (Back) and Trumpet (Forward) vector icons with hover glow & shortcuts |
| **Synchronized Lyrics (.lrc)** | Fully Implemented | Custom millisecond LRC parser with auto-companion loading & manual offset |
| **High-Scale Library (10,000+ tracks)** | Fully Implemented | Hash-map indexing, tokenized full-text search, and indexed discography grouping |
| **Gapless Playback & Crossfade** | Fully Implemented | Preloaded audio buffers with adjustable crossfade curve (0–10s) |
| **WASAPI Shared Mode** | Fully Implemented | Standard Windows CoreAudio endpoint output via Chromium audio pipeline |
| **WASAPI Exclusive Mode** | Architected & Verified | Real Windows diagnostic query; verified status indicator and hardware locking |
| **SMTC & Taskbar Controls** | Fully Implemented | Windows Media Transport integration & thumbnail toolbar controls |
