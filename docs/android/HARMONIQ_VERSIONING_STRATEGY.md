# HARMONIQ ANDROID — VERSIONING & RELEASE STRATEGY

**Application Name:** HARMONIQ  
**Target Platform:** Android (API 24+ / Android 7.0–15+)  
**Document Version:** 1.0.0  
**Phase:** Production Phase 01 — Official Branding, Identity & Native Integration  

---

## 1. Executive Summary

As HARMONIQ transitions from its experimental/beta development milestones into an official production-grade Android application, a formal, deterministic versioning scheme is established.

This document formalizes the versioning rules for:
1. `versionName` (User-visible Semantic Version)
2. `versionCode` (Monotonically increasing integer required by Google Play and Android PackageManager)
3. Build variant separation (Debug vs Release vs Internal Dogfood)

---

## 2. Versioning Specification

### 2.1 Semantic Version Name (`versionName`)

HARMONIQ follows strict **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):

```
MAJOR.MINOR.PATCH[-PRERELEASE]
  │     │     │        │
  │     │     │        └─ Optional: -alpha, -beta, -rc.1
  │     │     └────────── Bug fixes, patch repairs, minor UI polish
  │     └──────────────── Feature additions, new screens, backward-compatible enhancements
  └────────────────────── Major architectural overhauls, significant platform changes
```

#### Production Baseline
- **Current Production Phase 01 Baseline:** `1.0.0`
- **Previous Experimental Alpha:** `1.0.0 (Phase 4.2)`

### 2.2 Version Code Engineering (`versionCode`)

Android requires every installed APK or Android App Bundle (AAB) to have an integer `versionCode` that strictly increases with every release. Google Play will reject any upload with a `versionCode` lower than or equal to the previous release.

#### Formulated Multi-Digit Version Code Scheme:
```
  M M m m p p b b
  │ │ │ │ │ │ │ │
  │ │ │ │ │ │ └─┴─ Build variant / ABI offset (00=universal, 01=arm64-v8a, 02=armeabi-v7a)
  │ │ │ │ └─┴───── Patch version (00 - 99)
  │ │ └─┴───────── Minor version (00 - 99)
  └─┴───────────── Major version (01 - 99)
```

Example calculations:
- `1.0.0` Universal Debug / Release $\rightarrow$ `versionCode = 1000000` or sequential integer `1` (Phase 01 baseline: sequential `1`, graduating to formula in Phase 06).
- `1.0.1` Bugfix $\rightarrow$ `versionCode = 1000100`
- `1.1.0` Feature update $\rightarrow$ `versionCode = 1010000`

---

## 3. Build Variant & Artifact Topology

| Variant | Build Command | Output Artifact | Signing | ProGuard / R8 | Logging |
|:---|:---|:---|:---|:---|:---|
| **Debug** | `./gradlew assembleDebug` | `app-debug.apk` | Android Debug Keystore | Disabled | Enabled (Verbose) |
| **Release APK** | `./gradlew assembleRelease` | `app-release-unsigned.apk` | Production Keystore | Enabled (Rules Pro) | Stripped (Timber/R8) |
| **Production AAB** | `./gradlew bundleRelease` | `app-release.aab` | Google Play App Signing | Enabled (Optimized) | Stripped |

---

## 4. Integration with Desktop & Shared Ecosystem

The HARMONIQ desktop ecosystem operates at `2.0.1` (`package.json`).

- The Android application versioning represents the **HARMONIQ Mobile Series 1.x**, which incorporates all verified desktop algorithms (listening intelligence, parametric EQ, color resonance, radio directory).
- Desktop and Android version numbers are decoupled at the minor/patch level to allow independent release cadence on the Google Play Store and desktop installers.
