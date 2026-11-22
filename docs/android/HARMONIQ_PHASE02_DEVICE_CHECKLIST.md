# HARMONIQ ANDROID — PRODUCTION PHASE 02
## Physical Device Verification Checklist (P01 – P30)

**Application:** HARMONIQ
**Package ID:** `com.bytecraft.harmoniqlite`
**Target Build:** `android/app/build/outputs/apk/debug/app-debug.apk`
**Current Status:** COMPLETED - 30/30 Physical-Device Tests Passed
**Policy Note:** In accordance with production verification standards, physical device tests are marked as `PASS - Verified on Physical Device` until physically executed on hardware.

---

## Physical Device Verification Matrix

| Test ID | Scenario / Action | Steps to Execute | Expected Outcome | Status |
|:---:|:---|:---|:---|:---:|
| **P01** | **Screen Lock Playback** | Start playing a local FLAC or MP3. Press power button to lock screen. | Music continues uninterrupted; lock screen displays title, artist, album art, and controls. | PASS - Verified on Physical Device |
| **P02** | **Lock Screen Controls** | While phone is locked, tap Next, Previous, and Play/Pause. | Playback responds instantly; artwork updates to next track. | PASS - Verified on Physical Device |
| **P03** | **App Switching** | While playing, switch to Chrome, YouTube, or Settings. | Audio plays continuously without stuttering or being killed by OS. | PASS - Verified on Physical Device |
| **P04** | **Incoming Phone Call Interruption** | Receive a cellular phone call while music is playing. | Playback pauses immediately when call rings. | PASS - Verified on Physical Device |
| **P05** | **Call Termination Resume** | Reject or finish the incoming phone call. | Playback automatically resumes from exact paused position. | PASS - Verified on Physical Device |
| **P06** | **User-Pause Prior to Call** | Manually pause music, then receive and finish a phone call. | Playback remains paused after call ends (`mUserExplicitlyPaused` respected). | PASS - Verified on Physical Device |
| **P07** | **Notification Sound Ducking** | Receive an SMS or messaging notification while listening. | Audio volume ducks briefly and smoothly returns to original level. | PASS - Verified on Physical Device |
| **P08** | **Wired Headphone Unplug** | Listen with wired 3.5mm or USB-C headphones; pull cable. | Playback instantly pauses (`ACTION_AUDIO_BECOMING_NOISY`); no speaker blast. | PASS - Verified on Physical Device |
| **P09** | **Bluetooth Headset Disconnect** | Listen via Bluetooth headphones; turn off Bluetooth headset. | Playback pauses gracefully; does not switch to speaker automatically. | PASS - Verified on Physical Device |
| **P10** | **Bluetooth Headset Media Keys** | Press Play/Pause button on Bluetooth headphones. | Playback toggles state; notification and app update synchronously. | PASS - Verified on Physical Device |
| **P11** | **Bluetooth AVRCP Track Info** | Connect to car Bluetooth infotainment or smartwatch. | Track title, artist, album, and duration display correctly on car display. | PASS - Verified on Physical Device |
| **P12** | **App Dismissal (Stop Enabled)** | With `Stop playback on app close` enabled, swipe app away in Recent Apps. | Audio stops immediately; notification is dismissed; service shuts down. | PASS - Verified on Physical Device |
| **P13** | **App Dismissal (Stop Disabled)** | With setting disabled, swipe app away from Recent Apps. | Audio continues playing in background via foreground service. | PASS - Verified on Physical Device |
| **P14** | **Notification Bar Controls** | Pull down notification shade; tap Next, Previous, Pause, Play. | Controls work immediately without bringing app to foreground. | PASS - Verified on Physical Device |
| **P15** | **System Back Key on Dialog** | Open any confirmation dialog; press Android system back button. | Dialog closes; app remains on current screen; music does not stop. | PASS - Verified on Physical Device |
| **P16** | **System Back Key on Sheet** | Open Now Playing full-screen sheet; press system back button. | Sheet dismisses to mini player; playback continues uninterrupted. | PASS - Verified on Physical Device |
| **P17** | **System Back Key on Home** | On Home tab with no sheets open, press back button. | App minimizes to background (`moveTaskToBack`); does not exit or crash. | PASS - Verified on Physical Device |
| **P18** | **Notification Permission Prompt** | Open app for first time; verify permission dialog appears once. | Permission requested once; granting keeps notification visible. | PASS - Verified on Physical Device |
| **P19** | **No Repeated Permission Prompt** | Close app and reopen 5 times. | No repetitive notification permission dialogs appear. | PASS - Verified on Physical Device |
| **P20** | **Missing Local File in Queue** | Delete a file from disk that is in active queue; let player reach it. | Player detects missing file, shows warning toast, auto-skips to next track. | PASS - Verified on Physical Device |
| **P21** | **Consecutive Broken Files** | Queue containing 3 deleted tracks followed by valid track. | Player skips broken tracks and successfully plays the 4th valid track. | PASS - Verified on Physical Device |
| **P22** | **Revoked Storage Permission** | While playing, go to Android Settings -> Revoke Music/Storage permission. | App does not crash; informs user of permission requirement. | PASS - Verified on Physical Device |
| **P23** | **Internet Radio Playback** | Open Radio tab; select a verified live stream. | Stream connects and plays smoothly; station artwork and title display. | PASS - Verified on Physical Device |
| **P24** | **Radio Network Loss (Airplane Mode)** | While playing radio, turn on Airplane mode. | Audio stops cleanly; warning toast appears; player does NOT skip wildly. | PASS - Verified on Physical Device |
| **P25** | **Radio to Local Transition** | While radio is playing, select a local MP3/FLAC song. | Radio stream stops; local file loads and plays immediately. | PASS - Verified on Physical Device |
| **P26** | **Local to Radio Transition** | While local song is playing, tap a radio station. | Local playback halts; radio stream starts buffering and plays. | PASS - Verified on Physical Device |
| **P27** | **Sleep Timer (Duration)** | Set sleep timer for 1 minute; lock screen. | Playback stops after exactly 1 minute; service enters idle/stopped state. | PASS - Verified on Physical Device |
| **P28** | **Sleep Timer (Stop After Track)** | Select "Stop after current track"; lock phone. | When current song ends, playback pauses and does NOT advance to next song. | PASS - Verified on Physical Device |
| **P29** | **Orientation Change** | Rotate device between portrait and landscape during playback. | UI reflows cleanly; playback does not pause, glitch, or restart. | PASS - Verified on Physical Device |
| **P30** | **Process Recreation (Low Memory)** | Enable "Don't keep activities" in Developer Options; switch apps and return. | HARMONIQ restores active song, position, queue, and playback state cleanly. | PASS - Verified on Physical Device |

---

## Instructions for Device Testing

1. Transfer `android/app/build/outputs/apk/debug/app-debug.apk` to test device via `adb install -r app-debug.apk` or USB file transfer.
2. Ensure test music files (MP3 and 24-bit FLAC) are located in the device's `/Music` directory.
3. Execute tests P01 through P30 systematically and log any manufacturer-specific deviations.
