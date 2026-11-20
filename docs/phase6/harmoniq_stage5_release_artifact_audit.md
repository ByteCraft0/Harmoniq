# HARMONIQ 2.0 — STAGE 5: FINAL RELEASE CERTIFICATION
## STAGE 5.4 & 5.7: RELEASE ARTIFACTS & DATA SAFETY AUDIT

- **Application:** Harmoniq Desktop
- **Version:** 2.0.0
- **Validation Stage:** Stage 5 — Final Release Certification & Delivery Readiness Gate
- **Evaluation Date:** November 20, 2026
- **Auditor Role:** Production Release Engineer & QA Auditor

---

## 1. RELEASE ARTIFACT INVENTORY & CRYPTOGRAPHIC MANIFEST

The release candidate artifacts residing in `release/staging/v2.0.0/` and the preserved baseline in `release/rc1/` were audited for file integrity and checksum verification:

### Production Release Candidate Manifest (`release/staging/v2.0.0/`)

| Artifact Filename | Version | Architecture | File Size (Bytes) | SHA-256 Checksum | Source Baseline | Code Signing Status |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: |
| **`Harmoniq Setup 2.0.0.exe`** | 2.0.0 | x64 | 85,831,955 bytes | `394B216E2B5DCE0F613F0F997AFFF5BCE30B349D0B766B79CEF2CA96A3912704` | Phase 6.7 Staging | Unsigned / Test Signed |
| **`Harmoniq 2.0.0.exe`** | 2.0.0 | x64 | 85,502,772 bytes | `705B8FD3FC6E2153A7BC01CBCD73F63AFEC2BEF87D43FDD9774EC0DA2FBCFE36` | Phase 6.7 Staging | Unsigned / Test Signed |

### Preserved RC1 Baseline Manifest (`release/rc1/`)

| Artifact Filename | Version | Architecture | File Size (Bytes) | SHA-256 Checksum | Source Tag |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **`Harmoniq Setup 2.0.0.exe`** | 2.0.0 | x64 | 85,831,804 bytes | `4BA2B33630143ED9E9E6AE978D66D89E7657B71DEE29BA11C605F6030D18572E` | `harmoniq-v2.0.0-rc1` |
| **`Harmoniq 2.0.0.exe`** | 2.0.0 | x64 | 85,502,623 bytes | `AFBDD73549BD3246FC0C288AEFBD16D714ABFE6703EE1D1EF9234EA225B0CB7E` | `harmoniq-v2.0.0-rc1` |

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

## 3. CODE SIGNING & WINDOWS SMARTSCREEN TRANSPARENCY

- **Signature Status**: The current binaries are built without an EV (Extended Validation) code-signing certificate.
- **Windows SmartScreen Disclosure**: Because the binaries are unsigned, Windows SmartScreen will display an "Unknown Publisher" prompt upon first execution ("Windows protected your PC").
- **User Guidance**: The installation documentation transparently guides users to click *"More info"* and *"Run anyway"*, honestly explaining that this is standard for open-source and independent desktop software prior to acquiring commercial certificates.

---

## 4. AUDIT CONCLUSION

Both the NSIS installer and portable executable have verified checksums, maintain strict data directory isolation, and preserve user libraries. Release candidate integrity is certified.
