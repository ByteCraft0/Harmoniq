# HARMONIQ 2.0.0 — OFFICIAL RELEASE NOTES
### Audiophile Desktop Music Player for Windows 10 & 11

Harmoniq 2.0.0 represents a monumental milestone in desktop music playback, uniting audiophile digital signal processing, intelligent music discovery, and deep Windows native desktop integration into an elegant, high-performance desktop player.

---

## 1. MAJOR HIGHLIGHTS & ARCHITECTURAL ADVANCEMENTS

### 1.1 Professional Dual-Deck Audio Studio
- **Dual-Deck Playback Engine**: Independent ping-pong deck architecture supporting seamless gapless track handoffs and equal-power sine/cosine crossfading (1 to 12 seconds).
- **Consolidated Equalizer Studio**: A unified audio engineering suite featuring:
  - 10-band ISO graphic equalizer (31 Hz to 16 kHz) with smooth automation.
  - 12-band parametric equalizer supporting peaking, low-shelf, high-shelf, and notch filters.
  - Interactive frequency response curve with real-time composite curve plotting.
  - AutoEQ / Equalizer APO profile import for over 2,500+ headphone models.
  - Mid-Side stereo width expansion with mono compatibility and energy preservation.
  - 2x2 channel routing matrix (Stereo, Mono downmix, Left-only, Right-only, Balance).
  - Anti-clipping dynamics limiter protection.
- **Per-Track EQ & Profile Memory**: Automatically memorizes custom EQ curves on a per-song and per-output-device basis, restoring your preferences automatically upon track transition.
- **Deterministic Audio Quality Transparency**: Real-time 5-factor bit-matched matrix diagnosis, disclosing exact sample rate conversion, bit depth, channel configuration, and ReplayGain metadata.

### 1.2 Listening Intelligence & Personalization
- **Harmoniq Pulse Orb**: Interactive, 60 FPS audio-reactive visualizer blending dynamic frequency transients with extracted album artwork palettes.
- **Natural Language Discovery**: Local intent parsing for rapid discovery queries ("play 90s rock", "acoustic focus tracks").
- **Conversational Playlist Assistant**: Automated mood and tempo-aligned playlist generator creating dynamic track sequences.
- **Listening Intelligence Dashboard**: Comprehensive personal analytics covering listening calendar, top artists, genre clusters, and time-of-day listening habits stored 100% locally.
- **Contextual Sound Recommendations**: Heuristic-based sound profile suggestions tailored to current listening genres and active playback devices.

### 1.3 Windows Native Desktop Integration
- **DWM Taskbar Thumbnail Toolbar**: Previous, Play/Pause, and Next buttons embedded directly in the Windows taskbar hover thumbnail with dynamic state icons.
- **System Tray Integration**: Full right-click control menu, dynamic now-playing tooltips, and background playback persistence when closed to tray.
- **Global Media Keyboard Shortcuts**: Control playback system-wide (`MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`, `MediaStop`) while working in other applications.
- **System Media Transport Controls (SMTC)**: Native Windows 10/11 volume flyout integration displaying 512x512 artwork, track tags, and interactive seekbar scrubbing.
- **File Associations**: Native Windows Explorer integration for `.flac`, `.mp3`, `.wav`, `.m4a`, `.alac`, and `.ogg`.
- **Single-Instance Lock**: Prevents duplicate application windows; opening audio files from Explorer seamlessly routes them into the active running player.

---

## 2. PERFORMANCE & RESOURCE EFFICIENCY

- **Blazing Fast Startup**: Cold application startup in **< 800 ms**; warm launch in **< 450 ms**.
- **Ultralight Memory Footprint**: Steady-state working set (RSS) remains under **35 MB** during active DSP playback and drops to **31.8 MB** in background tray mode.
- **Massive Library Scalability**: Instantaneous search across 10,000 tracks in **1.49 ms** and 20,000 tracks in **2.35 ms**.
- **Progressive DOM Rendering**: Bounded 150-chunk windowing ensures silky smooth 60 FPS scrolling through tens of thousands of songs.
- **Zero Memory Leaks**: Invariant Web Audio node allocation with zero object accumulation across 1,000+ continuous playback transitions.

---

## 3. SUPPORTED PLATFORMS & HARDWARE

- **Supported Operating Systems**: Microsoft Windows 11 (64-bit) & Windows 10 (64-bit, Version 1809 or later).
- **Architecture**: x64 (AMD64 / Intel 64).
- **RAM Requirement**: 4 GB minimum (8 GB+ recommended).
- **Display**: 1280x720 minimum resolution (1920x1080 or higher recommended).
- **Audio Output**: Any Windows-compatible audio endpoint (Headphones, Speakers, USB DACs, Bluetooth, HDMI, Optical).

---

## 4. SUPPORTED AUDIO FORMATS

| Format | File Extensions | Playback | Metadata Tagging | Maximum Spec |
| :--- | :--- | :---: | :---: | :--- |
| **FLAC** | `.flac` | Yes | Yes | Up to 24-bit / 192 kHz lossless |
| **WAV** | `.wav` | Yes | Yes | 16/24/32-bit float PCM |
| **MP3** | `.mp3` | Yes | Yes | Up to 320 kbps CBR/VBR |
| **AAC / M4A** | `.m4a`, `.aac` | Yes | Yes | AAC-LC / HE-AAC in MP4 |
| **ALAC** | `.alac`, `.m4a` | Yes | Yes | Apple Lossless Audio |
| **OGG Vorbis** | `.ogg` | Yes | Yes | Ogg Vorbis audio |
| **Opus** | `.opus`, `.webm`| Yes | Yes | Interactive audio codec |
| **AIFF** | `.aiff`, `.aif` | Yes | Yes | Uncompressed PCM |
| **WMA** | `.wma` | No | Yes | *Playback unsupported in Chromium* |

---

## 5. INSTALLATION & SETUP INSTRUCTIONS

### Option A: Standard NSIS Installer (`Harmoniq Setup 2.0.0.exe`)
1. Download `Harmoniq Setup 2.0.0.exe`.
2. Run the executable. It installs cleanly into `%LOCALAPPDATA%\Programs\Harmoniq` without requiring administrative privileges.
3. Windows file associations and Desktop / Start Menu shortcuts will be automatically configured.
4. *(Note: Because the release is currently self-signed, Windows SmartScreen may show an "Unknown Publisher" prompt. Click "More info" and "Run anyway" to proceed).*

### Option B: Fully Portable Executable (`Harmoniq 2.0.0.exe`)
1. Download `Harmoniq 2.0.0.exe` and place it in any folder or USB drive.
2. Launch the executable. All settings, database files, and caches will be encapsulated in a `./harmoniq-data/` folder immediately adjacent to the binary.
3. Completely clean; makes zero writes to `%APPDATA%` or the Windows registry.

---

## 6. DATA PRIVACY & EXTERNAL SERVICES DISCLOSURE

- **100% Local Sovereignty**: Your music library, playlists, listening history, sound profiles, and assistant data are stored **entirely on your local machine**. Harmoniq contains **zero telemetry or tracking**.
- **External Services**: Network communication occurs strictly when you explicitly interact with online features:
  - Streaming Creative Commons tracks from Jamendo.
  - Streaming audio from Internet Radio stations or podcast RSS feeds.
  - Fetching synchronized lyrics via the LRCLIB API.
  - Communicating with external AI providers (Google Gemini, OpenAI) if configured with your personal API key.

---

## 7. KNOWN TECHNICAL LIMITATIONS

1. **Windows Shared Mode**: Harmoniq operates through the Chromium Web Audio pipeline via WASAPI in Windows Shared Mode. Audio streams are rendered through the Windows audio mixer at your configured endpoint sample rate.
2. **WMA Audio**: Windows Media Audio (.wma) files are not decoded by Chromium; their metadata can be parsed in the library, but playback is unsupported.
3. **DRM Protected Media**: Harmoniq does not bypass DRM restrictions on protected streams (Apple FairPlay, Widevine).
4. **Code Signing**: Binaries are distributed without an EV certificate, prompting Windows SmartScreen on first launch.
