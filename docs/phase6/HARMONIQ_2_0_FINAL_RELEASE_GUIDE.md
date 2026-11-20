# HARMONIQ 2.0 — FINAL RELEASE & DISTRIBUTION GUIDE

**Document ID:** `HARMONIQ-PHASE6-7-6-RELEASE-GUIDE`  
**Application Target:** Harmoniq Desktop  
**Target Version:** 2.0.0  
**Target Platform:** Windows 10 & Windows 11 x64  
**Date:** 2026-11-20  
**Status:** **RELEASE-READY DOCUMENTATION**

---

## 1. Introduction

Welcome to **Harmoniq 2.0**, an advanced desktop music player designed specifically for Windows 10 and 11. Harmoniq delivers high-precision audio playback, interactive parametric equalization, mid-side soundstage expansion, local-first music intelligence, and seamless Windows native desktop integration within an elegant obsidian and violet aesthetic.

This guide provides complete instructions for installation, portable deployment, library configuration, data safety, and platform operations.

---

## 2. System Requirements

| Specification | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 (version 1809 or higher) / Windows 11 (64-bit) | Windows 11 x64 (latest build) |
| **Processor** | Dual-core 64-bit x86-64 CPU (1.8 GHz) | Quad-core Intel Core i5 / AMD Ryzen 5 or higher |
| **Memory (RAM)** | 4 GB | 8 GB or higher for large libraries (>50,000 tracks) |
| **Storage** | 300 MB available drive space for application | SSD storage for fast music indexing |
| **Audio Output** | Standard Windows audio output (DirectSound / WASAPI Shared) | Dedicated USB DAC or high-fidelity audio interface |

---

## 3. Package Options & Installation

Harmoniq 2.0 is distributed in two distinct package formats:

### Option A: Windows Setup Installer (`Harmoniq Setup 2.0.0.exe`)
- **Best for:** Standard daily desktop listening with automatic shortcuts, start menu entries, and file association integration.
- **Installation Procedure:**
  1. Download `Harmoniq Setup 2.0.0.exe`.
  2. Double-click to run the setup wizard.
  3. *(If prompted by Windows SmartScreen)*: Click **"More info"** then click **"Run anyway"**.
  4. Choose your preferred installation directory (Default: `%LOCALAPPDATA%\Programs\harmoniq`).
  5. Select optional Start Menu and Desktop shortcuts.
  6. Click **Install**. The wizard completes within seconds.
- **Installed Locations:**
  - Binaries: `%LOCALAPPDATA%\Programs\harmoniq`
  - User Data & Settings: `%APPDATA%\Harmoniq`

### Option B: Zero-Install Portable Executable (`Harmoniq 2.0.0.exe`)
- **Best for:** Running from a USB flash drive, external hard drive, or non-administrative workstation.
- **Execution Procedure:**
  1. Copy `Harmoniq 2.0.0.exe` to your chosen directory or USB drive.
  2. Double-click `Harmoniq 2.0.0.exe` to launch directly.
  3. All application settings, library indices, and playlists are automatically isolated into an adjacent `harmoniq-data\` folder.
  4. Zero writes occur to the host computer's `%APPDATA%\Harmoniq` or system registry.

---

## 4. First Launch & Library Configuration

1. **First-Run Onboarding Walkthrough:**
   - On initial launch, Harmoniq displays a 3-step interactive walkthrough introducing the obsidian dark theme, the Audio Experience Studio, and library configuration.
   - You can re-open this walkthrough anytime via **Settings -> Re-launch Onboarding Walkthrough**.
2. **Adding Your Music Collection:**
   - Click **Add Local Folder** on the welcome screen, or navigate to **Settings -> Music Folders**.
   - Select one or more directories containing your music files.
   - Harmoniq recursively scans and indexes all supported formats: `.flac`, `.mp3`, `.wav`, `.m4a`, `.alac`, `.ogg`, `.opus`, and `.aiff`.
   - The progressive DOM windowing engine allows instantaneous scrolling and 1.8ms search response across libraries containing 10,000+ tracks.
3. **Automatic Folder Watcher:**
   - Harmoniq automatically detects when new tracks are added, modified, or deleted within your indexed folders, updating your library in real-time.

---

## 5. Audio Studio & Sound Personalization

1. **Equalizer Studio (Shortcut: `E`):**
   - **10-Band ISO Graphic EQ:** Standard octave-band sliders with calibrated preamp and tone controls.
   - **Parametric EQ Studio:** Interactive frequency response visualizer supporting up to 12 configurable parametric filters with peaking, shelf, notch, and band-pass curves.
   - **AutoEQ Importing:** Import calibrated headphone profiles from the AutoEQ project or Equalizer APO parametric text configs.
2. **Mid-Side Stereo Width:**
   - Expand or focus your stereo soundstage (0% to 150%) using phase-coherent mid-side matrix DSP.
3. **Unified Sound Profiles:**
   - Switch between curated profiles: Reference Flat, Tube Warmth, Open Stage Clarity, and Late Night.
4. **Per-Track & Per-Device Memory:**
   - Individual tracks remember customized EQ adjustments.
   - Output devices (headphones vs speakers) maintain separate volume levels and acoustic profiles.

---

## 6. Windows Desktop Integration

- **Taskbar Thumbnail Toolbar:** Hover over Harmoniq's taskbar icon to reveal native Previous, Play/Pause, and Next playback controls.
- **Windows System Media Transport Controls (SMTC):** Full support for Windows 10/11 volume overlays and multimedia keyboard keys.
- **System Tray & Close-to-Tray:** Closing the window minimizes Harmoniq to the system tray, allowing seamless background listening. Right-click the tray icon to control playback or exit.
- **Global Shortcuts (Ctrl+B):** Toggle sidebar collapse; configure custom global hotkeys in Settings.

---

## 7. Data Storage, Upgrades & Uninstallation Safety

- **Data Separation Guarantee:** User data (library metadata, playlists, history, sound profiles) resides strictly in `%APPDATA%\Harmoniq` (installed) or `<Folder>\harmoniq-data` (portable).
- **Non-Destructive Upgrades:** Installing a newer version replaces application binaries only; all user playlists, ratings, and settings remain 100% intact.
- **Uninstallation Safety:** Removing Harmoniq via Windows Settings / Control Panel uninstalls program binaries. User databases are preserved so your library is not lost if reinstalled. User music files are NEVER modified or deleted.

---

## 8. Truthful Product Capabilities & Known Boundaries

In adherence to strict technical accuracy:
- **Audio Output Driver:** Audio is mixed and outputted through Windows Shared Mode (WASAPI Shared) via Chromium's Web Audio pipeline.
- **DSP Status:** "Direct Pipeline" applies neutral DSP (unity gain and flat filters).
- **Peak Limiting:** Limiter protection uses a high-speed `DynamicsCompressorNode` peak limiter to prevent digital overs; it is not an analog hardware oversampled brickwall limiter.
- **DSD Audio:** Native 1-bit DSD (`.dsf`, `.dff`) is not natively decodable by Web Audio and is unsupported.
- **Local-First Privacy:** All library management, playlists, listening statistics, and audio processing operate 100% locally on your machine with zero telemetry. Remote requests occur only when using explicit online features (Internet Radio, Podcasts, Jamendo discovery, or conversational AI).
