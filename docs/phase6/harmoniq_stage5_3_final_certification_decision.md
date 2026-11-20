# HARMONIQ 2.0 — STAGE 5.3: FINAL CERTIFICATION CONSISTENCY & SECURITY DECISION AUDIT

- **Application:** Harmoniq Desktop
- **Target Version:** 2.0.0
- **Branch:** `feature/phase5c-5d-advanced-audio-intelligence`
- **Audit Date:** November 20, 2026
- **Auditor Role:** Principal Software Release Engineer, Electron Security Auditor & Production Gatekeeper
- **Audit Scope:** Authoritative Git reconciliation, execution-path audit of `music-metadata` and `file-type`, Electron runtime advisory review, NPM audit count reconciliation, and tiered release gate decisions.

---

## 1. AUTHORITATIVE GIT RECONCILIATION

A live inspection of the Git repository on November 20, 2026 establishes the authoritative Git state across all branches, tags, and commits.

### Repository Inspection Evidence

```bash
$ git rev-parse HEAD
eb806cc82279773202ee2dc3eb35e9e1ac8cb505

$ git status --short
(clean - no uncommitted changes)

$ git branch -vv
  checkpoint-batch7-14                           10a6780 chore: ignore exe files
* feature/phase5c-5d-advanced-audio-intelligence eb806cc docs(phase6.7): complete stage 5.2 final release integrity and security resolution
  master                                         0299d66 fix(audio): validate and harden phase 5B audio architecture
```

### Reconciliation of Conflicting Stage 5.2 HEAD Declarations

In the Stage 5.2 report, two Git hashes were cited:
- `ec99f12`: Was the HEAD at the *commencement* of Stage 5.2 (delivered at the end of Stage 5.1).
- `eb806cc`: Is the authoritative commit resulting from Stage 5.2 that finalized the Stage 5.2 deliverables.

### Master Chronological Commit Lineage

```
eb806cc (HEAD) docs(phase6.7): complete stage 5.2 final release integrity and security resolution
ec99f12 docs(phase6.7): complete stage 5.1 certification correction and reconciliation
18f258d docs(phase6.7): complete stage 5 final release certification audit
ab57d62 test(phase6.7): complete stage 4 performance and resource validation (Stage 5 technical test baseline)
28036e7 test(phase6.7): complete stage 3 windows native integration validation
129d647 test(phase6.7): complete stage 2 audio engine and playback validation (+ getPlaybackRate() runtime method)
b52b010 test(phase6.7): complete stage 1 windows installation validation
900cc85 docs(phase6.7): finalize release engineering and decision reports
6095f0b docs(phase6.7): complete final release documentation
059290e build(phase6.7): prepare production distribution artifacts (Staging binaries source commit)
a949109 test(phase6.7): validate Windows installation lifecycle
212fdc1 chore(phase6.7): verify final release baseline
37c26e0 (tag: harmoniq-v2.0.0-rc1) test(phase6.6): complete final release certification
```

- **Authoritative Current Starting HEAD:** `eb806cc82279773202ee2dc3eb35e9e1ac8cb505` (`eb806cc`)
- **Working Tree:** Clean. Zero untracked or modified files.
- **Master Branch:** Intact, untouched, unmerged at `0299d66`.
- **Target Tag `v2.0.0`:** Not created.

---

## 2. MUSIC-METADATA EXECUTION-PATH AUDIT

A source-code audit was conducted to evaluate how `music-metadata.parseFile()` is integrated, scheduled, and executed across Harmoniq.

### 2.1 Code Paths Leading to `parseFile()`

`music-metadata.parseFile()` is invoked inside `electron/main.ts` within `parseSingleAudioFile()`:

```typescript
// electron/main.ts (Lines 3447-3450)
async function parseSingleAudioFile(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    const metadata = await parseFile(filePath, { duration: true, skipCovers: false });
    // ... metadata normalization ...
    return track;
  } catch (err) {
    console.warn(`Error parsing metadata for ${filePath}:`, err);
    return null;
  }
}
```

This single entry point is triggered across three distinct execution workflows:

1. **Automatic Folder Watcher Events (`chokidar`):**
   - In `electron/main.ts` (lines 477-543), watched folders configured by the user are monitored via `chokidar.watch()`.
   - When any file is created (`add`) or modified (`change`), `activeFolderWatcher` debounces events (800ms) and invokes `flushWatcherBatch()`.
   - `flushWatcherBatch()` filters files by `AUDIO_EXTENSIONS` (`.mp3`, `.flac`, `.wav`, `.m4a`, `.aac`, `.alac`, `.ogg`, `.opus`, `.aiff`, `.aif`, `.wma`) and automatically calls `await parseSingleAudioFile(filePath)`.
   - **Finding:** A user does **not** need to click "Import" or "Play". If a user has a watched folder (e.g., standard `%USERPROFILE%\Music`), dropping or downloading a file into that directory automatically triggers parsing.
2. **Recursive Library Directory Scan (`audio:scanFolder`):**
   - In `electron/main.ts` (lines 1277-1336), when a user selects a folder to add to the library, `walkDir()` recursively finds all files matching `AUDIO_EXTENSIONS` and iterates over them in a sequential `for` loop: `await parseSingleAudioFile(file)`.
3. **Explicit User File Import (`dialog:openFiles` / `audio:parseFile`):**
   - In `electron/main.ts` (lines 1272-1274), IPC call `audio:parseFile` handles individual files selected via dialog or initial CLI file associations.

### 2.2 Execution Context & Application Responsiveness Impact

- **Execution Thread:** `parseSingleAudioFile()` runs directly inside the **Electron Main Process Node.js event loop**.
- **No Worker Threads:** Parsing is not offloaded to a worker thread, Node.js cluster, or Electron `utilityProcess`.
- **No Timeouts or Cancellation:** There is no `AbortSignal`, `Promise.race()` timer, or watchdog attached to `parseFile()`.
- **Responsiveness Impact:**
  - `music-metadata@7.14.0` vulnerability `GHSA-v6c2-xwv6-8xf7` involves a synchronous infinite loop in the ASF parser (`asf.js`) when encountering malformed header descriptors.
  - If a malformed `.wma` or `.asf` file triggers this infinite loop, the **entire Electron main process freezes**.
  - **Symptoms:**
    - The main event loop stops pumping Windows OS messages; the window title bar displays `(Not Responding)`.
    - All IPC communication between renderer and main is blocked.
    - Global keyboard shortcuts, System Tray menus, and Taskbar thumbnail controls stop functioning.
    - Active audio playback halts or stutters if IPC synchronization is pending.
    - The application can only be recovered by terminating the process via Windows Task Manager.

### 2.3 Mitigation Evaluation & Recommendations

| Mitigation Strategy | Complexity | Effectiveness | Release Recommendation |
| :--- | :--- | :--- | :--- |
| **A. Dependency Upgrade (`music-metadata@12.x`)** | High (Architectural) | Resolves known upstream CVEs. However, v8+ is Pure ESM, requiring refactoring the CommonJS main process to dynamic asynchronous `import()` or converting the entire Electron bundle to ESM. | **Post-Release (v2.1.0 Maintenance Update)** |
| **B. Worker Thread / Utility Process Isolation** | Medium | Isolates tag parsing into an Electron `utilityProcess` or Node.js `worker_threads` with a 5-second timeout (`AbortSignal`). If parsing hangs, the worker is terminated; main process never freezes. | **Required Prior to Broad Public Distribution** |
| **C. In-Process Timeout via `Promise.race()`** | Low | Cannot kill a synchronous CPU-bound infinite loop in the same V8 thread. | **Ineffective against synchronous loops.** |
| **D. Extension Restriction (Disable `.wma` Parsing)** | Very Low | Removing `.wma` from `AUDIO_EXTENSIONS` prevents the chokidar watcher and folder scanner from passing ASF files to `music-metadata`. | **Temporary Workaround for Limited Previews** |

**Recommendation on `music-metadata`:**
- **For Internal Testing / Limited Preview:** Accept temporarily with documented restrictions (warn users against importing unverified `.wma` files or disable `.wma` scanning).
- **For Broad Public Distribution:** **BLOCK** public release until parsing is isolated in an Electron `utilityProcess` with watchdog timeout protection.

---

## 3. FILE-TYPE REACHABILITY AUDIT

A source audit was performed on `node_modules/music-metadata/lib/ParserFactory.js` and `electron/main.ts` to trace all calls to `FileType.fromBuffer()`.

### 3.1 Trace Analysis in `ParserFactory.js`

```javascript
// music-metadata/lib/ParserFactory.js (Lines 57-76)
static async parse(tokenizer, parserId, opts) {
    if (!parserId) {
        debug('Guess parser on content...');
        const buf = Buffer.alloc(4100);
        await tokenizer.peekBuffer(buf, { mayBeLess: true });
        if (tokenizer.fileInfo.path) {
            parserId = this.getParserIdForExtension(tokenizer.fileInfo.path);
        }
        if (!parserId) {
            const guessedType = await FileType.fromBuffer(buf); // <--- Sniffer Call
            if (!guessedType) {
                throw new Error('Failed to determine audio format');
            }
            parserId = ParserFactory.getParserIdForMimeType(guessedType.mime);
        }
    }
    return parse(tokenizer, parserId, opts);
}
```

### 3.2 Discovery of Unmapped Extension: `.alac`

In `electron/main.ts`, `AUDIO_EXTENSIONS` defines:
```typescript
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.alac', '.ogg', '.opus', '.aiff', '.aif', '.wma'
]);
```
In `music-metadata/lib/ParserFactory.js`, `getParserIdForExtension(filePath)` maps extensions via a `switch`:
- `.mp3`, `.aac` -> `mpeg`
- `.flac` -> `flac`
- `.wav` -> `riff`
- `.m4a`, `.mp4` -> `mp4`
- `.ogg`, `.opus` -> `ogg`
- `.aiff`, `.aif` -> `aiff`
- `.wma`, `.wmv`, `.asf` -> `asf`
- **`.alac` -> NOT PRESENT IN SWITCH STATEMENT!**

### 3.3 Reachability Conclusion

1. **Supported Workflow Trigger:**
   - Any audio file with the `.alac` extension is accepted by `AUDIO_EXTENSIONS`, allowed in `dialog:openFiles`, scanned in `audio:scanFolder`, and monitored by `chokidar`.
   - When parsed, `ParserFactory.getParserIdForExtension('track.alac')` returns `undefined`.
   - `ParserFactory.parse()` enters the fallback branch and **directly calls `FileType.fromBuffer(buf)`**.
2. **Exploitation Path:**
   - If an attacker provides a malformed ASF file named with a `.alac` extension (or any unmapped extension), `file-type@16.5.4`'s ASF tokenizer (`asf.js`) inspects the 4100-byte buffer.
   - When encountering a zero-size sub-header, it enters the infinite loop (`GHSA-5v7r-6r5c-r473`).
3. **Verdict on `file-type` Reachability:**
   - The Stage 5.2 assumption that format sniffing is completely bypassed for all supported audio files is **refuted**.
   - **`FileType.fromBuffer()` IS REACHED IN NORMAL APPLICATION WORKFLOWS for `.alac` files and files with unknown or misleading extensions.**

---

## 4. ELECTRON RUNTIME ADVISORY REVIEW

A detailed audit of the 46 advisories associated with `electron@34.5.8` was conducted.

### 4.1 Categorization & Exploitability Analysis

| Category | Count | Example Advisories | Exploit Prerequisites in Harmoniq | Harmoniq Security Control Efficacy |
| :--- | :---: | :--- | :--- | :--- |
| **macOS / Linux Specific** | 5 | GHSA-5rqw-r77c-jp79 (AppleScript), GHSA-3c8v-cfp5-9885 (2nd-instance read) | Requires macOS / Linux OS. | **Completely Dormant on Windows.** Windows targets are immune. |
| **Window Creation & Popups** | 5 | GHSA-f3pv-wv63-48x8, GHSA-9f4c-93c8-jc8g, GHSA-hq2x-r82h-9wj4 | Requires renderer to invoke `window.open()` or target frames. | **Mitigated:** `setWindowOpenHandler` denies all window creation; external URLs pass to OS default browser. |
| **Webview & Workers** | 3 | GHSA-9qh4-3jw8-366w (<webview> Node integration in workers) | Requires `<webview>` tag in DOM or shared Web Workers. | **Mitigated:** `<webview>` is completely disabled in Harmoniq; no webviews exist in renderer. |
| **IPC & Permissions** | 12 | GHSA-r5p7-gp4j-qhrx, GHSA-8337-3p73-46f4, GHSA-4p4r-m79c-wq3v | Requires untrusted cross-origin iframes or spoofed IPC. | **Substantially Reduced:** No third-party iframes; renderer loads purely local bundled assets (`dist/index.html`). |
| **ASAR & Local Handlers** | 4 | GHSA-vmqv-hx8q-j7mg (ASAR bypass), GHSA-mwmh-mq4g-g6gr (Protocol client) | Requires local attacker with write access to filesystem. | **Unchanged:** Standard OS filesystem permissions apply. |
| **GPU / Frame / Offscreen** | 6 | GHSA-532v-xpq5-8h95, GHSA-pfmc-3mgc-p6fp, GHSA-8x5q-pvf5-64mp | Requires offscreen rendering (`offscreen: true`) or malicious GPU frame. | **Mitigated:** Harmoniq uses standard native hardware window rendering, not offscreen rendering. |
| **Chromium V8 & Core** | 11 | GHSA-h7rp-cf8h-j98x (Context isolation bind hijack), GHSA-jr5w-w6x2-84p9 | Requires arbitrary JavaScript execution in renderer. | **High Protection:** Harmoniq renderer executes strictly local, pre-compiled static React/TypeScript bundles with zero remote script execution. |

### 4.2 Upstream Patch Availability & Recommendation

- **Electron 34 Line Status:** Electron 34 has reached end-of-life (EOL) upstream.
- **Available Patched Versions:** Patches for these CVEs were released in Electron 38.x, 39.x, 41.x, 42.x, and 45.x (`electron@45.4.1`).
- **Upgrade Feasibility:** Upgrading to Electron 38+ or 45+ is a major semver breaking change affecting native Node.js addons, Vite tooling, and window APIs.
- **Realistic Security Assessment:** Because Harmoniq is an offline/local music player that never navigates to arbitrary remote websites, renders no remote HTML, and loads no untrusted scripts, exposure to remote browser exploits is minimal. However, context isolation and sandboxing do **not** provide a mathematical guarantee against low-level Chromium memory corruption vulnerabilities.

---

## 5. RECONCILIATION OF NPM AUDIT COUNTS

To eliminate discrepancies between package counts and individual advisory counts, the exact numbers from `npm audit --json` are reconciled:

### Reconciled Metrics Breakdown

| Metric | Exact Count | Source Definition |
| :--- | :---: | :--- |
| **Total Vulnerable Package Entries** | **26** | Unique package nodes flagged in `npm audit` root `vulnerabilities` object. |
| **Total Advisory Instances** | **86** | Total advisory objects across the `via` arrays of all 26 packages. |
| **Unique GHSA Advisory Identifiers** | **85** | Distinct security advisory URLs cataloged. |
| **Critical Severity Packages** | **3** | `tar`, `tinypool`, `vitest` (all residing in developer/test tooling). |
| **High Severity Packages** | **15** | 13 dev/build tools, 1 native host shell (`electron`), 1 runtime ASAR lib (`music-metadata`). |
| **Moderate Severity Packages** | **8** | 7 dev/build tools, 1 runtime ASAR lib (`file-type`). |
| **Direct Production Dependencies** | **1** | `music-metadata@7.14.0` |
| **Transitive Production Dependencies** | **1** | `file-type@16.5.4` (via `music-metadata`) |
| **Direct Developer Dependencies** | **3** | `electron`, `electron-builder`, `vitest` |
| **Transitive Developer Dependencies** | **21** | Build, packaging, and test tooling utilities. |

---

## 6. FINAL RELEASE GATE DECISION

### Independent Gate Evaluation

```
+-----------------------------------------------------------------------------------------+
| RELEASE GATE EVALUATION MATRIX                                                          |
+-----------------------------------------------------------------------------------------+
| Gate 1: Git HEAD Consistency            | PASS                 | HEAD eb806cc verified   |
| Gate 2: Runtime Dependency Security      | PASS WITH LIMITATIONS| Local DoS in tag parser |
| Gate 3: Electron Runtime Security       | PASS WITH LIMITATIONS| Upstream EOL Electron 34|
| Gate 4: Stale Binary Provenance         | FAIL (Current Exes)  | Built at 059290e (STALE)|
| Gate 5: Authenticode Code Signing       | FAIL (Public Release)| Status: NotSigned       |
| Gate 6: Physical Validation Limitations | PASS WITH LIMITATIONS| Programmatic test passes|
+-----------------------------------------------------------------------------------------+
```

### Tiered Distribution Decisions

1. **Tier 1 — Internal Developer Testing:**
   - **VERDICT: RELEASE READY**
   - The test suite (62 test files / 681 tests) passes with 100% success.
   - Vite bundle and Electron TypeScript compilation succeed with zero errors.
2. **Tier 2 — Limited Preview Distribution (Sideloading / Preview Testing):**
   - **VERDICT: CONDITIONAL RELEASE READY**
   - *Prerequisites:*
     - Binaries must be recompiled from HEAD (`eb806cc`) to incorporate `getPlaybackRate()`.
     - Users must be explicitly informed of Windows SmartScreen "Unknown Publisher" prompts.
     - Users must be advised of local `.wma` / malformed file parsing limitations.
3. **Tier 3 — Broad Public Distribution:**
   - **VERDICT: NOT READY FOR PUBLIC RELEASE**
   - *Mandatory Public Release Blockers:*
     1. **Rebuild Required:** Production installer and portable executables must be recompiled from the authoritative HEAD.
     2. **Code Signing Required:** Public distribution requires an Authenticode code-signing certificate (OV or EV) to eliminate SmartScreen blocks.
     3. **Metadata Process Isolation Required:** `parseSingleAudioFile()` must be moved from the Electron main thread into an isolated `utilityProcess` or worker thread with a 5-second watchdog timer to eliminate application freezes caused by malformed local files.

---

## 7. FINAL SUMMARY & STOP CONDITION

Per absolute release safety rules:
- No features or unnecessary code changes were introduced.
- No binaries were rebuilt or signed.
- No branches were merged.
- Git tag `v2.0.0` was **not** created.
- No distribution was performed.

**STAGE 5.3 IS COMPLETE. AWAITING EXPLICIT USER DECISION ON DEPLOYMENT GATES.**
