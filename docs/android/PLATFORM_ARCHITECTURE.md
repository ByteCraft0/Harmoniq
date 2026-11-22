# HARMONIQ LITE — PLATFORM ARCHITECTURE SPECIFICATION

**Document Version:** 1.0.0
**Target:** Harmoniq (Windows Desktop) & Harmoniq Lite (Android)
**Location:** `docs/android/PLATFORM_ARCHITECTURE.md`

---

## 1. Architectural Philosophy

Harmoniq Lite employs a **Decoupled Platform Adapter Pattern**. The system separates business logic and UI presentation from host runtime primitives (audio decoding, filesystem traversal, system notifications, and persistence).

### Core Design Rules:
1. **Shared Domain Core:** Domain types (`src/types/`) and core logic (`src/services/libraryService.ts`, `favoritesService.ts`, `lyricsService.ts`) are completely platform-agnostic.
2. **Interface Isolation:** The renderer never makes direct native calls; all interactions pass through typed drivers in `src/services/platform/`.
3. **Graceful Fallback:** If a native capability is absent (e.g., MediaStore in web or Electron file dialogs in Android), the driver exposes explicit capability flags rather than throwing runtime errors.

---

## 2. Platform Driver Interfaces & Contracts

### 2.1 Interface Hierarchy
```
src/services/platform/
├── types.ts                      # PlatformType, Capabilities, PlaybackState
├── IPlatformDriver.ts            # Root container interface
├── IAudioDriver.ts               # Playback, queue, DSP, SMTC/MediaSession contracts
├── ILibraryDriver.ts             # Scanning, LRC file, folder watching contracts
├── IStorageDriver.ts             # Key-value persistent storage contract
├── index.ts                      # Environment detection & getPlatformDriver()
├── electron/
│   ├── ElectronAudioDriver.ts    # Wraps audioEngine + window.harmoniqApi.updateSMTC
│   ├── ElectronLibraryDriver.ts  # Wraps window.harmoniqApi.scanFolder + dialogs
│   ├── ElectronStorageDriver.ts  # Wraps window.harmoniqApi.loadPersistentData
│   └── ElectronPlatformDriver.ts # Master Electron driver
├── android/
│   ├── AndroidAudioDriver.ts     # Communicates via Capacitor HarmoniqAudioPlayer
│   ├── AndroidLibraryDriver.ts   # Communicates via Capacitor HarmoniqMediaScanner
│   ├── AndroidStorageDriver.ts   # Communicates via @capacitor/preferences
│   └── AndroidPlatformDriver.ts  # Master Android driver
└── web/
    ├── WebAudioDriver.ts         # Fallback HTML5 audio driver
    ├── WebLibraryDriver.ts       # Fallback in-memory driver
    ├── WebStorageDriver.ts       # Fallback localStorage driver
    └── WebPlatformDriver.ts      # Master Web driver
```

---

## 3. Platform Detection Logic

Detection executes in `detectPlatform()` in `src/services/platform/index.ts`:

```typescript
export function detectPlatform(): PlatformType {
  const ctx = getGlobalContext();

  // 1. Electron: window.harmoniqApi exposed via preload script
  if (Boolean(ctx.harmoniqApi)) {
    return 'electron';
  }

  // 2. Android: running within Capacitor native mobile shell
  if (Boolean(ctx.Capacitor?.isNativePlatform?.())) {
    return 'android';
  }

  // 3. Fallback: Browser environment
  return 'web';
}
```

---

## 4. Capability Matrix

| Capability Flag | Electron Driver | Android Driver | Web Driver |
| :--- | :---: | :---: | :---: |
| `hasLocalFileSystem` | **true** | false | false |
| `hasFolderPicker` | **true** | false | false |
| `hasFilePicker` | **true** | false | false |
| `hasMediaStore` | false | **true** | false |
| `hasNativeAudioService` | false | **true** | false |
| `hasHardwareEqualizer` | false | false | false |
| `hasSoftwareDsp` | **true** (Web Audio) | **true** (Media3 Processor) | **true** (Web Audio) |
| `hasSystemMediaTransport`| **true** (Windows SMTC) | **true** (MediaNotification) | false |
| `hasGlobalShortcuts` | **true** | false | false |
| `hasTrayIntegration` | **true** | false | false |
| `hasWindowManagement` | **true** | false | false |

---

## 5. UI Shell Routing Architecture

`src/App.tsx` conditionally routes between desktop and mobile presentation layers based on `detectPlatform()`:

```tsx
export const App: React.FC = () => {
  const isMobile =
    detectPlatform() === 'android' ||
    (typeof window !== 'undefined' && window.location.search.includes('mobile=1'));

  return (
    <ToastProvider>
      <LibraryProvider>
        <PlayerProvider>
          <DSPProvider>
            {isMobile ? <MobileShell /> : <MainLayout />}
          </DSPProvider>
        </PlayerProvider>
      </LibraryProvider>
    </ToastProvider>
  );
};
```

This guarantees that:
- Desktop Electron users receive the full desktop UI (`MainLayout.tsx`, multi-column sidebar, window controls).
- Android mobile users receive the touch-optimized `MobileShell.tsx` with bottom tabs, safe-area insets, and expandable Now Playing sheets.
- Developers can test the mobile shell in any web browser by appending `?mobile=1`.
