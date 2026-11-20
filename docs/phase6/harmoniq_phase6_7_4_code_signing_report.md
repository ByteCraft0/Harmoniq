# HARMONIQ 2.0 — PHASE 6.7.4 CODE SIGNING & WINDOWS TRUST READINESS

**Document ID:** `HARMONIQ-PHASE6-7-4-CODE-SIGNING`  
**Phase:** Phase 6.7.4 — Code Signing & Windows Trust Readiness  
**Application Target:** Harmoniq Desktop  
**Target Version:** 2.0.0  
**Audit Date:** 2026-11-20  
**Signing Verdict:** **UNSIGNED (VERIFIED HONEST REPORTING)**

---

## 1. Executive Summary

An audit of the build environment, local certificate stores (`Cert:\CurrentUser\My`, `Cert:\LocalMachine\My`), and electron-builder build logs was performed to verify Authenticode code signing readiness. No commercial Authenticode Code Signing Certificate or hardware security module (HSM) was identified. In accordance with strict release engineering rules, the binaries remain **unsigned**, their unsigned status is explicitly disclosed, and the practical implications for Windows 10/11 users are documented below.

---

## 2. Environment Inspection Findings

| Inspection Target | Command / Tool | Finding |
| :--- | :--- | :--- |
| **Windows Certificate Stores** | PowerShell `Get-ChildItem Cert:\...` | Zero code-signing certificates found |
| **Electron Builder Signing** | `npx electron-builder --win` | `no signing info identified, signing is skipped signHook=false cscInfo=null` |
| **Windows SDK Signtool** | `where.exe signtool` | Not installed in standard PATH |
| **Release Binaries Signature** | PowerShell `Get-AuthenticodeSignature` | `Status: NotSigned` |

---

## 3. Practical Windows SmartScreen Implications

Because the binaries are unsigned:

1. **Microsoft Defender SmartScreen Warning:**
   - On Windows 10 and Windows 11, users who download `Harmoniq Setup 2.0.0.exe` or `Harmoniq 2.0.0.exe` from a web browser will encounter the standard SmartScreen dialog:
     > *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk."*
   - **Bypass Procedure:** The user must click **"More info"** followed by **"Run anyway"**.
2. **Reputational Telemetry:**
   - Standard code signing certificates require a period of downloads before SmartScreen reputation is established.
   - Unsigned executables do not build persistent SmartScreen identity across version releases.
3. **Enterprise & Managed Workspaces:**
   - Systems enforcing strict AppLocker, Windows Defender Application Control (WDAC), or Group Policies that mandate signed binaries will block execution until an administrator whitelists the application hash or signs the binary.

---

## 4. Production Code-Signing Implementation Guide

When an official Authenticode certificate is procured prior to public general availability (GA), follow this procedure:

### Option A: EV Hardware Token (YubiKey / SafeNet USB)
1. Insert the cryptographic hardware token into the signing machine.
2. Ensure the SafeNet Authentication Client driver is active.
3. Locate `signtool.exe` (part of the Windows 10/11 SDK):
   ```cmd
   "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "release\staging\v2.0.0\Harmoniq Setup 2.0.0.exe"
   "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "release\staging\v2.0.0\Harmoniq 2.0.0.exe"
   ```
4. Verify the signatures:
   ```cmd
   signtool verify /pa /v "release\staging\v2.0.0\Harmoniq Setup 2.0.0.exe"
   signtool verify /pa /v "release\staging\v2.0.0\Harmoniq 2.0.0.exe"
   ```

### Option B: Cloud HSM / Azure Trusted Signing
1. Register Azure Trusted Signing in your CI/CD workflow.
2. Configure `electron-builder` with the Azure Trusted Signing plugin or custom signing hook (`signHook: "./sign.js"`).
3. Sign directly during automated release packaging.

---

## 5. Certification Summary

- **Digital Signature Status:** Unsigned.
- **Packaging Integrity:** Valid (SHA-256 hashes generated and verified).
- **Public Distribution Guidance:** Document SmartScreen "More Info -> Run Anyway" instructions in release documentation until commercial signing is completed.
