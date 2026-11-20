# HARMONIQ 2.0 — PHASE 6.7.1 RELEASE BASELINE & REPOSITORY INTEGRITY

**Document ID:** `HARMONIQ-PHASE6-7-1-BASELINE`  
**Phase:** Phase 6.7.1 — Release Baseline & Repository Integrity  
**Application Target:** Harmoniq Desktop  
**Target Version:** 2.0.0  
**Baseline Git Tag:** `harmoniq-v2.0.0-rc1`  
**Audit Date:** 2026-11-20  
**Auditor:** Release Engineering Team  
**Status:** **AUDIT PASSED & INTEGRITY VERIFIED**

---

## 1. Executive Summary

A comprehensive repository and artifact integrity audit was conducted prior to executing final release engineering for Harmoniq 2.0.0. The repository is confirmed in a pristine, reproducible state. The release candidate tag `harmoniq-v2.0.0-rc1` directly references the verified Phase 6.6 certification commit, and both physical release binaries (`Harmoniq Setup 2.0.0.exe` and `Harmoniq 2.0.0.exe`) were independently hashed and validated against their build manifests.

---

## 2. Git Repository & Tag Integrity

| Property | Verified Value | Inspection Status |
| :--- | :--- | :--- |
| **Active Branch** | `feature/phase5c-5d-advanced-audio-intelligence` | PASS |
| **HEAD Commit Hash** | `37c26e08cc7930025b0b38bcd93fa07153c56f4a` | PASS |
| **Working Tree Status** | Clean (0 modified, 0 untracked) | PASS |
| **RC1 Tag Target** | `harmoniq-v2.0.0-rc1` -> `37c26e08cc7930025b0b38bcd93fa07153c56f4a` | PASS |
| **Tag Pointer Match** | Matches HEAD commit exactly | PASS |

### Phase 6 Commit Ancestry

1. `37c26e0` (2026-11-20) `test(phase6.6): complete final release certification`
2. `cb3f9bb` (2026-11-20) `polish(phase6.5): refine application UX and design consistency`
3. `01defe8` (2026-11-20) `fix(phase6.4): validate onboarding and correct product claims`
4. `e3d883c` (2026-11-20) `feat(phase6.3): add onboarding and final UX polish`
5. `0354fbb` (2026-11-20) `perf(phase6.2): benchmark and optimize runtime performance`
6. `3058c8b` (2026-11-20) `feat(phase6.1): add Windows production packaging and native integration`

---

## 3. Physical Release Binaries & Recalculated Checksums

The release binaries present on disk in `release/` were re-hashed using SHA-256 via Windows PowerShell:

| Binary File | Target | Size (Bytes) | SHA-256 Recalculated Hash | Last Modified (UTC+5:30) |
| :--- | :--- | :--- | :--- | :--- |
| **`Harmoniq Setup 2.0.0.exe`** | NSIS Installer | 85,831,804 | `4BA2B33630143ED9E9E6AE978D66D89E7657B71DEE29BA11C605F6030D18572E` | 2026-11-20 02:52:28 |
| **`Harmoniq 2.0.0.exe`** | Portable Executable | 85,502,623 | `AFBDD73549BD3246FC0C288AEFBD16D714ABFE6703EE1D1EF9234EA225B0CB7E` | 2026-11-20 02:52:29 |
| **`Harmoniq Setup 2.0.0.exe.blockmap`** | Blockmap | 91,174 | — | 2026-11-20 02:52:29 |

*Note: The calculated hashes match the previously recorded values with 100% byte fidelity.*

---

## 4. Application Metadata & Packaging Specifications

Inspection of `package.json` confirms:
- **Application Name:** `harmoniq`
- **Product Name:** `Harmoniq`
- **App ID:** `com.harmoniq.player`
- **Target Version:** `2.0.0`
- **Architecture Target:** `win32` / `x64`
- **Electron Version:** `34.5.8`
- **Electron Builder:** `25.1.8`
- **NSIS Configuration:**
  - Custom install directory allowed: `allowToChangeInstallationDirectory: true`
  - Multi-user/per-machine prompt: `oneClick: false`
  - Shortcuts: Desktop (`true`), Start Menu (`true`)
  - Icons: Multi-resolution `assets/icon.ico` for installer, uninstaller, and header
- **Registered File Associations:** `.flac`, `.mp3`, `.wav`, `.m4a`, `.alac`, `.ogg`
- **Bundled Payloads:** `dist/`, `dist-electron/`, `assets/`, `node_modules/`, `package.json`

---

## 5. Baseline Certification Decision

The release candidate baseline `harmoniq-v2.0.0-rc1` is **CONFIRMED VALID AND INTACT**. We proceed to **Stage 6.7.2: Windows Installation & Lifecycle Validation**.
