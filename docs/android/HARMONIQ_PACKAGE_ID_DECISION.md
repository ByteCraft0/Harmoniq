# HARMONIQ ANDROID — PACKAGE IDENTITY & APPLICATION ID STRATEGY

**Application Name:** HARMONIQ  
**Target Platform:** Android (API 24+ / Android 7.0–15+)  
**Document Version:** 1.0.0  
**Phase:** Production Phase 01 — Official Branding, Identity & Native Integration  

---

## 1. Executive Summary

During the development and alpha testing phases (Phases 0 through 4.3), the mobile application used the temporary development moniker **Harmoniq Lite** with the Android package ID:
```
com.bytecraft.harmoniqlite
```

As the application graduates into the official **HARMONIQ** Android flagship release, an architectural decision is required regarding whether to retain `com.bytecraft.harmoniqlite` or transition to `com.bytecraft.harmoniq`.

This document evaluates the trade-offs across data migration, user upgrade paths, Android runtime sandboxing, Capacitor storage keys, and Google Play Store distribution.

---

## 2. Option Comparison

### Option A: Retain `com.bytecraft.harmoniqlite` (Selected Baseline for Phase 01)

| Dimension | Assessment | Impact |
|:---|:---|:---|
| **App Display Name** | `HARMONIQ` | 100% official branding in UI, launcher, notifications, and settings |
| **User Data Continuity** | **Seamless (Zero data loss)** | Retains existing IndexedDB databases, playlist records, favorites, and listening history |
| **Android Sandbox** | `/data/data/com.bytecraft.harmoniqlite/` | Internal app storage path remains unchanged |
| **App Upgrade Path** | **Direct in-place upgrade** | Existing beta/alpha test devices can install without uninstalling |
| **System Permissions** | **Preserved** | Audio media, SAF directory URIs, and notification permissions remain granted |
| **Capacitor Storage Group** | `HarmoniqLitePreferences` | Preferences keys continue to resolve without migration scripts |
| **Google Play Store URL** | `play.google.com/store/apps/details?id=com.bytecraft.harmoniqlite` | Application ID visible in browser URL; display name in Store is "HARMONIQ" |

### Option B: Transition to `com.bytecraft.harmoniq` (Clean Namespace)

| Dimension | Assessment | Impact |
|:---|:---|:---|
| **App Display Name** | `HARMONIQ` | Identical official branding |
| **User Data Continuity** | **Broken without explicit migration bridge** | Android treats this as a brand new app; old user data remains trapped in old sandbox |
| **Android Sandbox** | `/data/data/com.bytecraft.harmoniq/` | Fresh storage path |
| **App Upgrade Path** | **Dual install / Re-installation required** | User has two separate icons unless old package is uninstalled |
| **System Permissions** | **Revoked / Must re-request** | User must re-grant `READ_MEDIA_AUDIO`, re-grant folder SAF access |
| **Capacitor Storage Group** | New group name required | Preferences must be migrated via SAF / shared backup file |
| **Google Play Store URL** | `play.google.com/store/apps/details?id=com.bytecraft.harmoniq` | Clean canonical package ID |

---

## 3. Detailed Technical Analysis

### 3.1 Android Package Manager & User Data Preservation
Android isolates every application by its Linux UID assigned per `applicationId`. If the `applicationId` changes from `com.bytecraft.harmoniqlite` to `com.bytecraft.harmoniq`:
1. **IndexedDB & LocalStorage:** Chromium WebView stores web data in `app_webview/Default/IndexedDB/https_localhost_0.indexeddb.leveldb`. A new package ID cannot access another app's private sandbox without root or a shared user ID with identical signing keys.
2. **Storage Access Framework (SAF) Persisted Permissions:** URIs granted via `takePersistableUriPermission()` cannot be transferred between different application IDs. Users would have to manually re-select all music folders.
3. **Recently Played & Custom Playlists:** User playlists created during Phase 3B and listening history recorded during Phase 4.1 would be inaccessible on upgrade.

### 3.2 Industry Precedents & Play Store Realities
Numerous high-profile Android applications retain historical package IDs while sporting official, clean public branding:
- **Slack:** `com.Slack`
- **Twitter / X:** `com.twitter.android`
- **Instagram:** `com.instagram.android`
- **Uber Eats:** `com.ubercab.eats`
- **Spotify:** `com.spotify.music`

Android end-users never see the Android package ID during daily operation; the user sees:
- Launcher app label: **HARMONIQ**
- Notification channel: **HARMONIQ Playback**
- MediaSession title: **HARMONIQ**
- Settings / App info: **HARMONIQ**

---

## 4. Architectural Decision Matrix

```
┌─────────────────────────────────────────────────────────────┐
│               PHASE 01: BRANDING & IDENTITY                 │
│                                                             │
│  User-Facing Name: HARMONIQ (100% updated)                  │
│  Application ID:   com.bytecraft.harmoniqlite (Preserved)   │
│                                                             │
│  Benefit: Absolute zero user regression, seamless upgrades, │
│           instant testing on existing physical devices.     │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          PHASE 06 / STORE PUBLICATION EVALUATION            │
│                                                             │
│  If new package com.bytecraft.harmoniq is mandated:         │
│  - Implement ContentProvider data exporter in Phase 05      │
│  - Add import / export backup archive (.harmoniq-backup)    │
│  - Register com.bytecraft.harmoniq on Google Play Console   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Decision & Recommendation

1. **For Production Phase 01:** Retain `applicationId "com.bytecraft.harmoniqlite"` in `android/app/build.gradle` and `capacitor.config.ts`.
2. **User-Facing Branding:** All 100% user-facing strings, resources, manifest labels, notifications, and React UI components are updated to **HARMONIQ**.
3. **Forward Migration Path:** If the product team decides on `com.bytecraft.harmoniq` for the initial Google Play Store listing (before public release), it will be performed in Phase 06 with an automated data migration bridge.
