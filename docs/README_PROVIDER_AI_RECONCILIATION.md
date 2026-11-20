# HARMONIQ 2.0 — TECHNICAL RECONCILIATION REPORT: MUSIC PROVIDERS & PULSE ORB AI

**Application:** Harmoniq Desktop  
**Target Version:** 2.0.0  
**Audit Type:** Deep Implementation & Source Verification (Music Providers, AI Backends, Speech Services)  
**Deliverable:** `docs/README_PROVIDER_AI_RECONCILIATION.md`  

---

## 1. SOURCE FILES & FUNCTION REFERENCES

The audit is based exclusively on the actual source code, type definitions, IPC handlers, and test suites in the repository:

| Component / Subsystem | Primary Source Files | Key Functions & Handlers |
|---|---|---|
| **Universal Music Service** | `src/services/universalMusicService.ts` | `searchUniversal()`, `resolveTrackStream()`, `deduplicateTracks()`, `getCapabilityRank()`, `setSpotifyCredentials()`, `setYouTubeApiKey()` |
| **Provider Base & Types** | `src/services/providers/baseProvider.ts`<br>`src/types/universalMusic.ts` | `BaseMusicProvider`, `UnifiedTrack`, `PlaybackCapability`, `ProviderCapabilityAudit`, `unifiedTrackToTrackMetadata()` |
| **Jamendo Provider** | `src/services/providers/jamendoProvider.ts` | `JamendoProvider.search()`, `normalize()`, `setClientId()` |
| **Audius Provider** | `src/services/providers/audiusProvider.ts` | `AudiusProvider.search()`, `normalize()` |
| **Internet Archive Provider** | `src/services/providers/archiveProvider.ts` | `ArchiveProvider.search()`, `resolveAudioFile()`, `normalize()` |
| **Apple Music Provider** | `src/services/providers/applePreviewProvider.ts` | `ApplePreviewProvider.search()`, `normalize()`, `getCapabilityAudit()` |
| **Spotify Provider** | `src/services/providers/spotifyProvider.ts` | `SpotifyProvider.search()`, `getAccessToken()`, `normalize()`, `getCapabilityAudit()` |
| **YouTube Provider** | `src/services/providers/youtubeProvider.ts` | `YouTubeProvider.search()`, `normalize()`, `parseIsoDuration()`, `getCapabilityAudit()` |
| **Local Library Provider** | `src/services/providers/localProvider.ts` | `LocalLibraryProvider.search()`, `normalize()` |
| **Electron Main IPC (Music & AI)** | `electron/main.ts` | `ipcMain.handle('universal:search')` (lines 2211–2712)<br>`ipcMain.handle('universal:resolveStream')` (lines 2715–2986)<br>`ipcMain.handle('assistant:sendChat')` (lines 3162–3305) |
| **Assistant Core & State** | `src/services/assistantService.ts`<br>`src/types/assistant.ts` | `AssistantService.sendMessage()`, `parseActionsFromContent()`, `updateConfig()`, `speakMessage()` |
| **Offline Knowledge Engine (RAG)** | `src/services/assistantKnowledge.ts` | `searchKnowledge()`, `generateLocalAnswer()`, `HARMONIQ_KNOWLEDGE_BASE` (23 features) |
| **Pulse Orb Visual Component** | `src/components/assistant/HarmoniqPulseOrb.tsx` | 60 FPS animation loop, 7 visual states, audio-reactive FFT integration |
| **Speech Recognition & TTS** | `src/services/speechService.ts` | `startRecognition()`, `stopRecognition()`, `speak()`, `getVoices()` |
| **Unit & Integration Tests** | `src/test/universal_music_engine.test.ts`<br>`src/test/universal_music_phase2.test.ts`<br>`src/test/universal_music_phase3.test.ts`<br>`src/test/phase7_harmoniq_assistant.test.ts` | Test suites verifying provider failures, capability ranking, deduplication, knowledge retrieval, and action parsing |

---

## 2. PART A — UNIVERSAL MUSIC PROVIDER AUDIT

### 2.1 Detailed Provider Analysis

#### 1. Jamendo Music (`jamendo`)
- **Metadata / Search Discovery:** Implemented. Queries `https://api.jamendo.com/v3.0/tracks/` via fetch with query string and parameters.
- **Audio Stream URL:** Receives direct audio download/stream URL (`raw.audio` or `raw.audiodl`).
- **Playback Extent:** Complete full-track streaming.
- **Mechanism:** Direct HTTPS MP3 stream URL fed to Harmoniq's HTML5 Audio / Web Audio DSP pipeline.
- **Bitrate:** Nominal 128 kbps MP3 stream (set in normalized metadata).
- **Credentials:** Uses an open public client ID (`b6747d04`) by default; users can optionally configure their own custom client ID in Settings.
- **Catalog Restrictions:** Limited to independent Creative Commons music catalog. No mainstream commercial catalog.
- **Classification:** **Full-track playback implemented** (for CC tracks).

#### 2. Audius (`audius`)
- **Metadata / Search Discovery:** Implemented. Queries decentralized discovery nodes at `https://discoveryprovider.audius.co/v1/tracks/search`.
- **Audio Stream URL:** Resolves stream URL via `https://discoveryprovider.audius.co/v1/tracks/${rawId}/stream?app_name=HarmoniqAudioPlayer`, which redirects (HTTP 302) to decentralized content storage nodes.
- **Playback Extent:** Complete full-track streaming.
- **Mechanism:** Direct HTTPS stream URL fed into HTML5 Audio / Web Audio pipeline.
- **Bitrate:** Nominal 320 kbps MP3 (actual stream encoding depends on creator upload).
- **Credentials:** None required (open public decentralized API).
- **Catalog Restrictions:** Creator and indie artist community. No major-label commercial music.
- **Classification:** **Full-track playback implemented** (for Audius community tracks).

#### 3. Internet Archive (`archive`)
- **Metadata / Search Discovery:** Implemented. Queries `https://archive.org/advancedsearch.php?q=mediatype:audio...`.
- **Audio Stream URL:** Resolves audio files via `https://archive.org/metadata/${id}/files` manifest, filtering for valid audio extensions (`.mp3`, `.ogg`, `.flac`, `.m4a`) and prioritizing VBR MP3 / high quality, with fallback to `${id}_vbr.mp3`.
- **Playback Extent:** Complete track playback when an audio manifest entry exists.
- **Mechanism:** Direct HTTPS audio file stream URL (`https://archive.org/download/...`) routed through Harmoniq's audio pipeline.
- **Bitrate & Formats:** Variable and item-dependent (VBR MP3, FLAC, OGG, or 64–320 kbps). Not fixed. Not all items have audio; manifest parsing gracefully checks availability.
- **Credentials:** None required.
- **Catalog Restrictions:** Public domain, live concert recordings (e.g. Live Music Archive), historical radio, and 78rpm archives. Audio quality and recording fidelity vary significantly by archive item.
- **Classification:** **Full-track playback implemented** (for valid audio archive items).

#### 4. Apple Music (`apple`)
- **Metadata / Search Discovery:** Implemented. Queries open iTunes Catalog API (`https://itunes.apple.com/search` and `itunes.apple.com/lookup`).
- **Audio Stream URL:** Receives promotional audio preview URL (`raw.previewUrl`).
- **Playback Extent:** **30-second preview only**. Never full track.
- **Mechanism:** Direct AAC preview stream (256 kbps) played through Harmoniq's audio pipeline.
- **Credentials:** None required for search and 30-second previews.
- **Full-Track Reality Check:** Full-track playback requires Apple MusicKit JS SDK, an active user subscription, and FairPlay/Widevine DRM CDM decryption, which Harmoniq **does not implement**.
- **Classification:** **Preview playback implemented** (30-second promotional audio previews). Full-track playback is **Not implemented**.

#### 5. Spotify (`spotify`)
- **Metadata / Search Discovery:** Implemented. Queries Spotify Web API (`https://api.spotify.com/v1/search`) with client credentials OAuth token.
- **Audio Stream URL:** Receives `preview_url` if returned by Spotify's API. When `preview_url` is `null` (the standard behavior for Spotify apps created after 2024), `streamUrl` is undefined.
- **Playback Extent:** **Preview playback** (if `preview_url` exists) or **External link only** (when `preview_url` is null). **Never full-track playback**.
- **Mechanism:** If `preview_url` exists, plays 30-second MP3 preview (160 kbps). Otherwise provides external watch/listen link (`open.spotify.com/track/...`).
- **Credentials:** User must provide Spotify Developer Client ID & Client Secret in Settings. Uses Client Credentials flow (`grant_type=client_credentials`).
- **Full-Track Reality Check:** Client Credentials flow does **not** grant user playback permissions. Full-track streaming on Spotify requires user OAuth login, an active Spotify Premium subscription, Widevine CDM DRM, and the Spotify Web Playback SDK, none of which Harmoniq implements.
- **Classification:** **Preview playback implemented** (conditional on API preview availability) / **External link only** / **Metadata/search only**. Full-track playback is **Not implemented**.

#### 6. YouTube Data API v3 (`youtube`)
- **Metadata / Search Discovery:** Implemented. Queries `https://www.googleapis.com/youtube/v3/search` for video category 10 (Music) and enriches durations via `videos?part=contentDetails`.
- **Audio Stream URL:** **None**.
- **Playback Extent:** **Neither full-track nor preview**.
- **Mechanism:** Dispatches external destination URL (`https://www.youtube.com/watch?v=${videoId}`).
- **Credentials:** User must configure a Google Cloud YouTube Data API v3 key in Settings.
- **Compliance & Legal Reality:** Harmoniq explicitly respects YouTube Terms of Service Section II.10. There is zero audio extraction, stream ripping, or headless video scraping.
- **Classification:** **Metadata/search only** with **External link only**. Direct audio playback is **Not implemented** (by design for ToS compliance).

#### 7. Local Library (`local`)
- **Metadata / Search Discovery:** Implemented. In-memory indexing and multi-field search across title, artist, album, and genre via `libraryService.getAllTracks()`.
- **Audio Stream URL:** Native custom protocol URL `harmoniq-media://local/...`.
- **Playback Extent:** Complete full-track playback.
- **Mechanism:** Electron custom protocol handler streaming directly to Web Audio DSP pipeline.
- **Credentials:** None (local filesystem).
- **Classification:** **Full-track playback implemented**.

---

### 2.2 Provider Capability Matrix

The following table enforces strict, mutually exclusive categorization without combining capabilities:

| Provider | Search / Metadata Discovery | Playable Audio URL Received? | Full-Track Playback Implemented | Preview Playback Implemented | Metadata / Search Only | Authorized Embedded Playback | External Link Only | Not Implemented / Placeholder | Credentials Required |
|---|---|---|---|---|---|---|---|---|---|
| **Local Library** | ✅ Yes | ✅ Yes (`harmoniq-media://`) | ✅ **Yes** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | None |
| **Jamendo Music** | ✅ Yes | ✅ Yes (HTTPS MP3) | ✅ **Yes** (CC tracks) | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | None (Open key included; custom key optional) |
| **Audius** | ✅ Yes | ✅ Yes (HTTPS MP3 redirect) | ✅ **Yes** (Indie tracks) | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | None |
| **Internet Archive** | ✅ Yes | ✅ Yes (HTTPS MP3/FLAC/OGG) | ✅ **Yes** (Audio items) | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | None |
| **Apple Music** | ✅ Yes | ✅ Yes (30s AAC preview) | ❌ No | ✅ **Yes** (30s previews) | ❌ No | ❌ No | ❌ No | ❌ No (Full tracks: Not Implemented) | None for search & previews |
| **Spotify** | ✅ Yes | ⚠️ Conditional (`preview_url`) | ❌ No | ✅ **Yes** (When preview returned) | ❌ No | ❌ No | ✅ **Yes** (When preview is null) | ❌ No (Full tracks: Not Implemented) | Spotify Client ID & Secret |
| **YouTube Data API** | ✅ Yes | ❌ No (Zero audio streams) | ❌ No | ❌ No | ✅ **Yes** | ❌ No | ✅ **Yes** (Watch URLs) | ❌ No (In-app audio: Not Implemented) | Google Cloud YouTube API Key |
| **JioSaavn** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ **Audited as Unavailable** (No official public API) | N/A |

---

## 3. PART B — PULSE ORB AI BACKENDS AUDIT

### 3.1 AI Backend Architecture & Implementation Details

The AI assistant subsystem is implemented in `src/services/assistantService.ts`, `src/services/assistantKnowledge.ts`, and `electron/main.ts` (`ipcMain.handle('assistant:sendChat')`):

```
                                [ User Prompt / Voice Input ]
                                              │
                                              ▼
                             [ AssistantService.sendMessage() ]
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        [ Intent Pre-Check ]                                 [ Feature Knowledge RAG ]
     - Conversational Playlists                           - searchKnowledge() (23 docs)
     - Music Discovery & Queue                            - formatContextForPrompt()
                     │                                                 │
                     ▼                                                 ▼
      ┌──────────────────────────────┐              ┌─────────────────────────────────────┐
      │ Provider == 'local' OR No Key│              │ Provider != 'local' AND Has API Key │
      └──────────────┬───────────────┘              └──────────────────┬──────────────────┘
                     │                                                 │
                     ▼                                                 ▼
          [ Local Grounded Engine ]                        [ IPC: assistant:sendChat ]
       generateLocalAnswer() on-device                Sanitizes file paths -> Cloud API
          100% Offline / Zero Leaks                                    │
                     │                             ┌───────────────────┼───────────────────┐
                     │                             ▼                   ▼                   ▼
                     │                         [ Gemini ]          [ OpenAI ]           [ Groq ]
                     │                     gemini-1.5-flash        gpt-4o-mini    llama-3.1-8b-instant
                     │                             │                   │                   │
                     └─────────────────────────────┴───────────────────┴───────────────────┘
                                                   │
                                                   ▼
                                [ Response Parsing & Action Extraction ]
                                   e.g. [Open Equalizer Studio]
                                                   │
                                                   ▼
                               [ Pulse Orb State & Speech Synthesis ]
                                   TTS cleans markdown & speaks
```

### 3.2 AI Backend Verification

| Backend | Implemented Model Identifier | User API Key Required? | Requests Leave Device? | Works Without Internet? | Selection Method | Genuine Fallback vs Placeholder |
|---|---|---|---|---|---|---|
| **Local Grounded Engine** | Built-in Deterministic RAG Knowledge Engine | **No** | **No** (100% on-device) | **Yes** (100% offline) | Select `'local'` in Settings / Assistant Config | **Genuine, fully functional offline engine** with 23 indexed features, step-by-step guidance, and clickable navigation actions. |
| **Google Gemini** | `gemini-1.5-flash` (or custom user model override) | **Yes** (Gemini API Key) | **Yes** (`generativelanguage.googleapis.com`) | **No** (Network required) | Select `'gemini'` in Settings; stored via DPAPI encrypted storage | Cloud LLM integration with automatic fallback to local engine on error/timeout. |
| **OpenAI** | `gpt-4o-mini` (or custom user model override) | **Yes** (OpenAI API Key) | **Yes** (`api.openai.com`) | **No** (Network required) | Select `'openai'` in Settings; stored via DPAPI encrypted storage | Cloud LLM integration with automatic fallback to local engine on error/timeout. |
| **Groq** | `llama-3.1-8b-instant` (or custom user model override) | **Yes** (Groq API Key) | **Yes** (`api.groq.com`) | **No** (Network required) | Select `'groq'` in Settings; stored via DPAPI encrypted storage | Cloud LLM integration with automatic fallback to local engine on error/timeout. |

---

## 4. PART C — SPEECH RECOGNITION & SYNTHESIS AUDIT

### 4.1 Speech-to-Text (STT) — `speechService.startRecognition()`
- **Technology Used:** Web Speech API (`window.SpeechRecognition` or `window.webkitSpeechRecognition`).
- **Offline Guarantee:** **NOT guaranteed to work offline**. In Electron and Chromium, `webkitSpeechRecognition` delegates to Google's speech recognition cloud services.
- **Privacy & Remote Transmission:** When active, microphone audio is transmitted over the network to external speech servers. If disconnected from the internet, it fires an `event.error === 'network'` error.
- **Conclusion:** STT must **never** be advertised as "100% offline" or "private on-device voice processing".

### 4.2 Text-to-Speech (TTS) — `speechService.speak()`
- **Technology Used:** Web Speech API (`window.speechSynthesis` and `SpeechSynthesisUtterance`).
- **Voice Dependencies:** Relies entirely on installed operating system voices (Windows SAPI5 / Windows OneCore voices via `speechSynthesis.getVoices()`).
- **Offline Operation:** Runs locally on the operating system without external network requests.
- **Audio Protection:** Pre-processes text to strip markdown formatting (`###`, `**`, `> [!TIP]`) and action brackets (`[Open ...]`) before speaking. Operates on a separate Web Audio channel so spoken responses never interrupt or duck music playback.

### 4.3 Independence from LLM Backend
- Voice input and output operate on the frontend independent of the LLM. Users can speak and hear responses while using the **Local Grounded Engine**, **Gemini**, **OpenAI**, or **Groq**.

---

## 5. DISCREPANCIES IN PREVIOUS AUDITS & RECONCILIATION

The following table records discrepancies between earlier audit summaries and the verified source code:

| Item | Previous Audit Claim | Actual Source Code Reality | Impact / Resolution |
|---|---|---|---|
| **Spotify Playback** | Claimed "full tracks for premium users" | Client credentials flow only retrieves metadata and 30s previews (if available). Web Playback SDK is not present. | Strip any claim of Spotify full-track playback. State clearly: commercial discovery, metadata, previews (when available), and external links. |
| **Apple Music Playback** | Claimed "full tracks for regions where user has a subscription" | Code calls open iTunes Search API which strictly provides 30s audio previews. No MusicKit SDK or Apple DRM is implemented. | Correct to: 30-second promotional audio previews for global Bollywood, Punjabi, and international catalogs. |
| **YouTube Playback** | Claimed "authorized video/audio stream" | No audio streams are extracted. YouTube provider assigns `playbackCapability: 'external_link'` with `https://www.youtube.com/watch?v=...`. | State clearly: official music video discovery, duration enrichment, and direct YouTube watch links. |
| **AI Architecture Files** | Referenced fictitious `assistantBackendService.ts` | IPC handlers are in `electron/main.ts`, RAG knowledge base is in `src/services/assistantKnowledge.ts`, and core service is in `src/services/assistantService.ts`. | Use verified file names and line references. |
| **OpenAI Model** | Labeled as `GPT-4o` | Default model in code is `gpt-4o-mini` (`electron/main.ts` line 3260). | Accurately report `gpt-4o-mini` as the default model. |
| **Groq Model** | Labeled as `Llama-3.1` | Default model in code is `llama-3.1-8b-instant` (`electron/main.ts` line 3260). | Accurately report `llama-3.1-8b-instant` as the default model. |
| **Speech Privacy** | Implied voice input was fully private/offline | `webkitSpeechRecognition` in Chromium transmits voice data to Google servers and fails offline. | Clearly state that speech recognition relies on Chromium's web speech service requiring internet, while local knowledge answers are on-device. |

---

## 6. APPROVED README WORDING

### Universal Music Engine (Section Replacement)
> **Universal Music Discovery & Multi-Provider Search**  
> Harmoniq integrates an extensible multi-provider search engine that unifies local and online audio discovery with strict terms-of-service compliance:  
> - **Local Library**: Instant full-track playback of your local audio collection.  
> - **Jamendo Music**: Full-track streaming of over 500,000 Creative Commons indie tracks (128 kbps MP3).  
> - **Audius**: Full-track streaming from decentralized creator community nodes (320 kbps MP3).  
> - **Internet Archive**: Full-track playback of public domain recordings, live concert archives, and historical audio (VBR MP3, FLAC, OGG).  
> - **Apple Music**: Comprehensive Bollywood, Punjabi, and International catalog search with 30-second audio previews (no account required).  
> - **Spotify**: Commercial track discovery, popularity metrics, ISRC, 30-second previews (where provided by API), and direct Spotify links (requires user Spotify Developer API keys).  
> - **YouTube**: Official music video discovery and direct destination watch links with zero audio ripping (requires user YouTube Data API key).  
> Every search result displays an explicit capability badge (`Full Track`, `30s Preview`, or `External Link`) so you always know what can be played in-app.

### Pulse Orb & Harmoniq Assistant (Section Replacement)
> **Pulse Orb & Harmoniq Assistant**  
> An intelligent music player companion featuring the signature floating holographic Pulse Orb:  
> - **7 Visual States & Audio Reactivity**: 60 FPS real-time audio reactivity responding to bass and frequency intensity during playback.  
> - **100% Offline Local Grounded Engine**: Built-in knowledge base covering 23 Harmoniq features, generating step-by-step guidance and one-click navigation buttons (`[Open Equalizer Studio]`, `[Open Audio Inspector]`) completely on-device without internet or API keys.  
> - **Optional Cloud AI Backends**: Connect your own API key to use Google Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), or Groq (`llama-3.1-8b-instant`) with automatic fallback to the local engine.  
> - **Voice Interaction**: Microphone speech-to-text input with live interim preview (via Web Speech API) and hands-free text-to-speech spoken responses that never interrupt music playback.

---

## 7. PROHIBITED CLAIMS FOR README.MD

The following claims are unverified or inaccurate and **MUST NOT** appear in the root `README.md`:

1. ❌ **"Unrestricted full-track playback from Spotify"** — Spotify playback in Harmoniq is limited to 30s previews (if available) or external links. Full tracks require Widevine DRM and Spotify Web Playback SDK, which are not implemented.
2. ❌ **"Full-track Apple Music playback with developer token"** — Harmoniq uses open iTunes APIs for 30-second previews only. Full track playback via MusicKit is not implemented.
3. ❌ **"Direct YouTube audio stream playback / ripping"** — Harmoniq strictly complies with YouTube ToS Section II.10. It does not rip audio; it provides metadata and official watch links.
4. ❌ **"Fixed 320 kbps streaming for all Jamendo and Archive tracks"** — Jamendo returns nominal 128 kbps MP3; Internet Archive items vary widely across formats and bitrates.
5. ❌ **"100% offline speech recognition"** — Web Speech API `SpeechRecognition` in Chromium transmits voice data to Google servers and requires internet.
6. ❌ **"WASAPI Exclusive bit-perfect direct hardware ownership"** — Harmoniq runs in WASAPI Shared mode through Web Audio; Exclusive mode is not implemented in executable code.
7. ❌ **"Guaranteed brickwall peak limiter"** — The limiter is a `DynamicsCompressorNode` (soft-knee compressor), not an oversampled true-peak brickwall limiter.
8. ❌ **"15-band and 31-band graphic equalizers"** — Harmoniq has a 10-band ISO graphic equalizer and up to 12 configurable parametric filter nodes.

---
*Report completed and verified against source repository on 2026-11-20.*
