# HARMONIQ 2.0 — STAGE 5: FINAL RELEASE CERTIFICATION
## STAGE 5.4 & 5.7: RELEASE ARTIFACTS, DATA SAFETY & TRACEABILITY AUDIT

- **Application:** Harmoniq Desktop
- **Version:** 2.0.0
- **Validation Stage:** Stage 5.3 — Final Certification Consistency & Security Decision Audit
- **Authoritative Current HEAD:** `eb806cc82279773202ee2dc3eb35e9e1ac8cb505` (`eb806cc`)
- **Reconciliation Date:** November 20, 2026
- **Auditor Role:** Production Release Engineer & QA Auditor

---

## 1. RELEASE ARTIFACT INVENTORY & TRACEABILITY MANIFEST

The release candidate artifacts residing in `release/staging/v2.0.0/` and the preserved baseline in `release/rc1/` were audited for file integrity, source commit traceability, and cryptographic checksums:

### Production Release Candidate Manifest (`release/staging/v2.0.0/`)

| Artifact Filename | Version | Architecture | File Size (Bytes) | SHA-256 Checksum | Build Timestamp | Source Commit Traceability | Authenticode Signature Status | Artifact State |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: |
| **`Harmoniq Setup 2.0.0.exe`** | 2.0.0 | x64 | 85,831,955 bytes | `394B216E2B5DCE0F613F0F997AFFF5BCE30B349D0B766B79CEF2CA96A3912704` | 2026-11-20 10:38:34 AM | Commit `059290e` (`build: prepare production distribution artifacts`) | **NotSigned** (Unsigned) | **STALE** (Missing `getPlaybackRate`) |
| **`Harmoniq 2.0.0.exe`** | 2.0.0 | x64 | 85,502,772 bytes | `705B8FD3FC6E2153A7BC01CBCD73F63AFEC2BEF87D43FDD9774EC0DA2FBCFE36` | 2026-11-20 10:38:36 AM | Commit `059290e` (`build: prepare production distribution artifacts`) | **NotSigned** (Unsigned) | **STALE** (Missing `getPlaybackRate`) |

### Preserved RC1 Baseline Manifest (`release/rc1/`)

| Artifact Filename | Version | Architecture | File Size (Bytes) | SHA-256 Checksum | Build Timestamp | Source Tag Target | Authenticode Signature Status |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **`Harmoniq Setup 2.0.0.exe`** | 2.0.0 | x64 | 85,831,804 bytes | `4BA2B33630143ED9E9E6AE978D66D89E7657B71DEE29BA11C605F6030D18572E` | 2026-11-20 02:52:26 AM | Commit `37c26e0` (`harmoniq-v2.0.0-rc1`) | **NotSigned** (Unsigned) |
| **`Harmoniq 2.0.0.exe`** | 2.0.0 | x64 | 85,502,623 bytes | `AFBDD73549BD3246FC0C288AEFBD16D714ABFE6703EE1D1EF9234EA225B0CB7E` | 2026-11-20 02:52:27 AM | Commit `37c26e0` (`harmoniq-v2.0.0-rc1`) | **NotSigned** (Unsigned) |

### Source Revision Reconciliation & Staleness Finding:
- Both staging binaries (`Harmoniq Setup 2.0.0.exe` and `Harmoniq 2.0.0.exe`) were compiled simultaneously at 10:38 AM UTC+5:30 corresponding to commit `059290e7dba0875513ec5be04d674fa89326acf9`, which established the final packaged assets and portable directory precedence.
- In commit `129d647b9b7a2571d49d060429528e9f2fc4995c`, runtime method `public getPlaybackRate(): number` was added to `src/services/audioEngine.ts`.
- Because this commit postdates `059290e`, the staging binaries in `release/staging/v2.0.0/` do not contain this runtime getter.
- **Formal Classification**: The staging binaries are **STALE**.
- **Action Policy**: In strict adherence to release safety rules ("Do not rebuild or replace binaries without authorization"), the staging binaries have NOT been overwritten or rebuilt. A fresh production compilation (`npm run build && npm run build:electron && npx electron-builder --win --x64`) from the authoritative HEAD (`eb806cc`) must be authorized prior to release distribution.

---

## 2. PACKAGING CONFIGURATION & DATA SEPARATION AUDIT

### 2.1 NSIS Installer Package (`Harmoniq Setup 2.0.0.exe`)
- **Installation Path**: `%LOCALAPPDATA%\Programs\Harmoniq` (per-user installation; requires zero Administrator UAC elevation).
- **User Data Storage**: `%APPDATA%\Harmoniq` containing `playlists.json`, `settings.json`, and database records.
- **Upgrade Safety**: Reinstalling or upgrading over an existing installation replaces executable binaries while **strictly preserving** all user library databases, listening history, and custom presets in `%APPDATA%\Harmoniq`.
- **Uninstaller Hygiene**: Clean uninstaller removes binaries and registry associations without deleting user music or data unless requested.
- **File Associations**: Automatically associates `.flac`, `.mp3`, `.wav`, `.m4a`, `.alac`, and `.ogg` files.

### 2.2 Portable Executable Package (`Harmoniq 2.0.0.exe`)
- **Directory Isolation**: Enforces `PORTABLE_EXECUTABLE_DIR` precedence in `electron/main.ts`.
- **Local Data Encapsulation**: Automatically stores all application state, cache, and database records in a relative `./harmoniq-data/` folder immediately adjacent to the portable executable.
- **Zero Host Pollution**: Runs completely isolated from USB drives or arbitrary folders with **zero writes** to `%APPDATA%\Harmoniq` or Windows registry settings.

---

## 3. CODE SIGNING AUDIT (AUTHENTICODE VERIFICATION)

Both staging executables were evaluated using Windows PowerShell `Get-AuthenticodeSignature`:

```powershell
Get-AuthenticodeSignature -FilePath "release/staging/v2.0.0/Harmoniq Setup 2.0.0.exe"
# Result: Status: NotSigned, SignatureType: None, SignerCertificate: $null

Get-AuthenticodeSignature -FilePath "release/staging/v2.0.0/Harmoniq 2.0.0.exe"
# Result: Status: NotSigned, SignatureType: None, SignerCertificate: $null
```

- **Actual Status**: **UNSIGNED** (`Status: NotSigned`).
- **Windows SmartScreen Impact**: Will prompt an "Unknown Publisher" protection banner upon download/execution.

---

## 4. AUDIT CONCLUSION & TIERED DECISION

Both release candidate packages have verified checksums, validated data directory isolation, and verified source traceability.

However:
- The existing staging binaries are **STALE** and omit `getPlaybackRate()` from commit `129d647`.
- The binaries are **UNSIGNED** and trigger Windows SmartScreen warnings.
- **Tier 1 (Internal Testing):** Pass.
- **Tier 2 (Limited Preview):** Conditional Pass (Requires recompilation from HEAD).
- **Tier 3 (Broad Public Distribution):** Blocked until recompilation from HEAD, Authenticode code signing, and audio parser process isolation are completed.
