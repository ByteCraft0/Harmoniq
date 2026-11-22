# HARMONIQ LITE — PHASE 4: PHYSICAL DEVICE TEST CHECKLIST
## End-to-End Manual Testing Protocol for Android Hardware Verification

**Application:** Harmoniq Lite
**Application ID:** `com.bytecraft.harmoniqlite`
**Test Build:** `android/app/build/outputs/apk/debug/app-debug.apk`
**Installation Command:** `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
**Minimum OS Required:** Android 7.0+ (API 24+)
**Recommended Verification OS:** Android 13 or Android 14+ (for notification permissions and modern foreground service checks)

---

## 1. Overview & Verification Protocol

> [!IMPORTANT]
> While all automated unit, integration, and platform driver tests have passed (885/885 tests), Android hardware features—such as real lockscreen rendering, hardware audio effect rendering, headphone disconnect handling, and physical gesture back navigation—require physical execution on an actual Android device before declaring full release completion.

Use the checklist below to systematically test Harmoniq Lite on your physical device.

---

## 2. Cross-Feature Master Test Scenarios

### Test Suite A: Background Playback, Lockscreen & Notification Controls
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **A-1** | Launch Harmoniq Lite. Grant audio permission when prompted. | App launches smoothly into Obsidian Dark theme. MediaStore scans local audio tracks. | [ ] |
| **A-2** | Tap the Heart icon on 2–3 songs to add them to Favorites. | Heart turns red with toast notification: *"Added to Favorites"*. | [ ] |
| **A-3** | Navigate to Playlists tab -> tap **Favorites**. Tap the first song. | Song begins playing. MiniPlayer appears at bottom showing track info and album art. | [ ] |
| **A-4** | Press the device Power button to lock the phone. Wait 30 seconds. | Music continues playing seamlessly without stuttering or audio cutting out. | [ ] |
| **A-5** | Wake phone to view Lock Screen. | MediaStyle lockscreen player shows track title, artist, album art, and controls (Play/Pause, Prev, Next, Scrubber). | [ ] |
| **A-6** | Tap **Next** button on the lockscreen notification. | Next track in queue plays immediately; title, artist, and artwork update on lockscreen. | [ ] |
| **A-7** | Unlock the phone and return to Harmoniq Lite. | Now Playing sheet reflects the active track playing from lockscreen, with scrubber time synchronized. | [ ] |

---

### Test Suite B: Audio Focus, Headphone Unplugging & Multi-Tasking
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **B-1** | While music is playing through headphones (or Bluetooth), unplug headphones or disconnect Bluetooth. | Playback immediately pauses automatically (Audio Becoming Noisy handling). Sound does not blast through speaker. | [ ] |
| **B-2** | Reconnect headphones, press Play. Trigger an incoming phone call or GPS announcement. | Music pauses or ducks during the interruption, then smoothly resumes when call ends. | [ ] |
| **B-3** | While playing music, press the Home button to minimize Harmoniq Lite. Open a heavy app (e.g. Chrome, YouTube, Camera). | Background audio continues uninterrupted. System does not terminate HarmoniqMediaService. | [ ] |
| **B-4** | Tap Harmoniq Lite icon to return to the app. | Full playback state, active track, progress scrubber, and queue are completely intact. | [ ] |

---

### Test Suite C: Navigation, Overlays & Android Back Button / Gesture
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **C-1** | Tap MiniPlayer to open the expanded Now Playing sheet. | Full Now Playing sheet slides up showing artwork, controls, scrubber, and 4-action bar. | [ ] |
| **C-2** | Tap the **Lyrics** button (`Mic2`). | Lyrics sheet opens showing synced lyrics (or plain text/empty message). | [ ] |
| **C-3** | Perform Android Back gesture (or press 3-button Back). | Lyrics sheet closes smoothly, returning to the expanded Now Playing sheet. | [ ] |
| **C-4** | Tap the **Equalizer** button (`SlidersHorizontal`). | Hardware Equalizer sheet opens showing band sliders and preset chips. | [ ] |
| **C-5** | Perform Android Back gesture. | Equalizer sheet closes, returning to Now Playing. | [ ] |
| **C-6** | Tap the **Sleep Timer** button (`Moon`). | Sleep Timer sheet opens. Perform Back gesture -> Sleep Timer closes. | [ ] |
| **C-7** | Tap the **Queue** button (`ListMusic`). | Queue sheet opens showing current and upcoming tracks. Perform Back gesture -> Queue closes. | [ ] |
| **C-8** | Perform Android Back gesture while on expanded Now Playing. | Now Playing collapses down to the MiniPlayer. | [ ] |
| **C-9** | Navigate to Playlists tab -> tap a playlist -> open custom playlist detail. | Playlist view opens showing tracks. Perform Back gesture -> returns to Playlists list. | [ ] |
| **C-10** | Perform Back gesture from Library or Playlists root tab. | Navigates back to the Home tab. Performing Back on Home minimizes app safely without crash. | [ ] |

---

### Test Suite D: Equalizer, Presets & Audio Effects
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **D-1** | Open Now Playing -> tap **Equalizer**. | Opens Equalizer sheet. Displays detected hardware bands (e.g., 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz). | [ ] |
| **D-2** | Toggle the master Equalizer switch to **ON**. | Violet notice displays: *"Audio effects active: Direct Stream / Bit-Perfect output is bypassed"*. | [ ] |
| **D-3** | Tap the **Bass Boost** preset chip. | Low frequency sliders automatically boost. Audible increase in bass response from audio output. | [ ] |
| **D-4** | Tap the **Vocal** preset chip. | Mid-range frequencies boost; vocal clarity increases audibly. | [ ] |
| **D-5** | Manually drag individual frequency sliders up/down. | Gains adjust in real time (e.g. +6 dB, -4 dB). Preset chip indicates "Custom". | [ ] |
| **D-6** | Tap **Reset to Flat**. | All band sliders reset to 0 dB and preset highlights "Flat". | [ ] |

---

### Test Suite E: Native Sleep Timer Background Survival
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **E-1** | Open Now Playing -> tap **Sleep Timer** (`Moon`). | Sleep Timer sheet displays quick presets (5, 10, 15, 30, 45, 60 min) and custom duration field. | [ ] |
| **E-2** | Tap **5 minutes** (or set custom 1 minute for quick testing). | Countdown begins: displays `MM:SS remaining` with animated progress bar. Moon icon shows active badge. | [ ] |
| **E-3** | Lock device screen. Wait for the timer to expire. | When timer reaches 0:00, audio playback pauses cleanly. Notification controls update to Paused. | [ ] |
| **E-4** | Unlock phone, open app. | App indicates sleep timer expired, playback paused, with no crash or freeze. | [ ] |
| **E-5** | Start another timer and tap **Cancel Timer**. | Timer cancels immediately and countdown resets. | [ ] |

---

### Test Suite F: Custom Playlists, Queue & Persistence
| Step | Action | Expected Device Behavior | Status |
|:---:|---|---|:---:|
| **F-1** | Go to Playlists tab -> tap **+ New Playlist**. Enter "Workout Beats". | Playlist created and appears in custom playlists list. | [ ] |
| **F-2** | Go to Library -> tap three dots (`⋮`) on a song -> tap **Add to Playlist**. Select "Workout Beats". | Song added with toast: *"Added to Workout Beats"*. Duplicate additions prevented. | [ ] |
| **F-3** | Open "Workout Beats" -> tap **Play All**. | All playlist songs load into the active queue in correct order. | [ ] |
| **F-4** | In Now Playing, tap **Shuffle** button. | Shuffle highlights violet. Upcoming queue order shuffles. | [ ] |
| **F-5** | Tap **Repeat** button. | Cycles: Repeat All (violet) -> Repeat One (`Repeat1` icon) -> Repeat Off. | [ ] |
| **F-6** | Completely close/kill Harmoniq Lite from Android Recent Apps. Re-launch Harmoniq Lite. | Playlists, Favorites, monitored folders, and last-saved settings persist without loss. | [ ] |

---

## 3. Test Execution Sign-off

- **Device Model:** ________________________
- **Android Version:** ________________________
- **Tester Name:** ________________________
- **Date Tested:** ________________________
- **Final Verdict:** [ ] PASSED  [ ] FAILED (see notes below)

*Notes / Discovered Issues (if any):*
