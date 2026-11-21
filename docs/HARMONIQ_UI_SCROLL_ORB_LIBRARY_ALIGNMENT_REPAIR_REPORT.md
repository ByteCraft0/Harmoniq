# Harmoniq 2.0.1 — UI Scroll, AI Orb History & Song Library Alignment Repair Report

**Date:** 2026-11-21  
**Repository:** `C:\Users\a2301\Desktop\harmoniq`  
**Branch:** `feature/phase5c-5d-advanced-audio-intelligence`  
**Target Platform:** Windows 10/11 x64  
**Status:** Complete, Verified & Packaged

---

## Executive Summary

This engineering phase addressed and resolved three critical user interaction and layout defects in Harmoniq Desktop 2.0.1 without compromising prior performance optimizations, continuous SVG volume controls, or audio pipeline behavior:

1. **Main Application Vertical Scroll Repair:** Fixed the container hierarchy in `NowPlayingView`, `VisualizerView`, and `App.tsx` so that main content extending below the viewport (such as the Source File Stream, Output Audio Pipeline, and Audio Quality Analyzer) can be scrolled smoothly, while `Sidebar`, `TitleBar`, and `BottomPlayer` remain firmly anchored.
2. **AI Orb Conversation History Scroll Stability:** Replaced unconditional and conflicting smooth-scroll `scrollIntoView()` calls in `HarmoniqAssistantPanel` with an intelligent, user-aware auto-scroll controller. Manual upward scrolling through dozens of conversation records is now completely stable, jitter-free, and protected against automated resets, with a convenient floating return-to-bottom action and CSS overscroll containment.
3. **Songs Library Favorite Heart Alignment:** Redesigned the CSS grid and row structure in `SongRow.tsx` and `SongTableHeader.tsx` to give the Favorite action an intentional, dedicated 36px column with a generous $28\times 28\text{px}$ clickable target. Eliminated horizontal collisions where the heart previously overflowed into and behind song titles.

---

## Root Cause Analysis

### 1. Main Application Vertical Scroll
- **Root Cause:** In [src/components/views/NowPlayingView.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/views/NowPlayingView.tsx), the root container was configured with `min-h-full` rather than `h-full`. In CSS flexbox layouts, `min-height: 100%` without an explicit `height` constraint defaults `height` to `auto`, causing the container to expand to fit its entire content (1200px+). Because `NowPlayingView` never experienced internal overflow, its `overflow-y: auto` was never triggered. Instead, the 1200px container overflowed its parent `main.overflow-hidden` in [src/App.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/App.tsx), resulting in hard visual clipping of all lower panels with zero scrollability. In addition, flex containers in `App.tsx` lacked `min-h-0` constraints, and `VisualizerView.tsx` utilized `justify-between` and `my-auto` on scrollable wrappers, causing layout collisions on viewports $\le 800\text{px}$ in height.

### 2. AI Orb Conversation History Scroll Instability
- **Root Cause:** In [src/components/assistant/HarmoniqAssistantPanel.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/assistant/HarmoniqAssistantPanel.tsx), an un-gated `useEffect` called `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` whenever `messages`, `interimTranscript`, or `isPanelOpen` changed. In Chromium/Electron, calling `.scrollIntoView({ behavior: 'smooth' })` on a nested element triggers asynchronous browser smooth-scroll animation frames. When a user attempted to scroll upward with their mouse wheel or trackpad, the downward smooth-scroll animation clashed with user wheel inputs, producing rapid alternating scroll deltas (visible as severe jitter, jumping, and fluctuating message positions). Furthermore, the scroll container lacked a ref, scroll position tracking, and `overscroll-behavior: contain`.

### 3. Songs Library Favorite Heart Alignment
- **Root Cause:** In [src/components/layout/SongRow.tsx](file:///C:/Users/a2301/Desktop/harmoniq/src/components/layout/SongRow.tsx), column 1 in `SONG_TABLE_GRID_WITH_ALBUM` and `SONG_TABLE_GRID_NO_ALBUM` was allocated a fixed width of only `48px`. Inside this 48px slot, the component rendered the selection checkbox (16px), track index / play button (24px), and the favorite heart button (16px) with gaps ($16 + 4 + 24 + 4 + 16 = 64\text{px}$). Because $64\text{px} > 48\text{px}$, the favorite button overflowed 16px past its column boundary directly into Column 2 (`Title`). Consequently, song titles rendered directly on top of, underneath, or obscured the favorite button. The table header (`SongTableHeader`) also lacked a Favorite column, causing visual misalignment across rows.

---

## Detailed Implementation Changes

### 1. Main Application Vertical Scroll
- **`src/App.tsx`**:
  - Added `min-h-0` to the main flex body: `<div className="flex-1 flex min-h-0 overflow-hidden relative">`.
  - Added `min-h-0 min-w-0` to `<main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[#09090B] relative">`.
  - Added `min-h-0` to `<div key={activeView} className="h-full w-full min-h-0 animate-page-enter">`.
- **`src/components/layout/BottomPlayer.tsx`**:
  - Added `shrink-0` to `<footer className="h-[86px] min-h-[86px] shrink-0 glass-panel border-t border-white/10 px-5 flex items-center justify-between select-none relative z-40">` to guarantee invariant height and prevent flex shrinking under constrained viewports.
- **`src/components/views/NowPlayingView.tsx`**:
  - Updated root container from `min-h-full` to `h-full w-full overflow-y-auto overflow-x-hidden px-6 sm:px-8 pt-5 pb-10 flex flex-col gap-6 max-w-6xl mx-auto relative select-none scrollbar-thin`.
  - Bounded container height to 100% of the available main workspace, allowing natural scroll triggers when content extends downward.
  - Added `pb-10` clearance to ensure lower controls remain completely unobstructed above the BottomPlayer.
- **`src/components/views/VisualizerView.tsx`**:
  - Replaced `justify-between` with natural vertical stacking: `<div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col gap-5 select-none relative p-6 sm:p-8 pb-10 max-w-6xl mx-auto scrollbar-thin">`.

### 2. AI Orb Conversation History Scroll Stability
- **`src/components/assistant/HarmoniqAssistantPanel.tsx`**:
  - Attached `scrollContainerRef = useRef<HTMLDivElement>(null)` to the message history container.
  - Added `style={{ overscrollBehavior: 'contain' }}` to isolate chat wheel events from document scrolling.
  - Implemented `handleScroll` to detect `distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight`:
    - `nearBottom <= 48px`: sets `isNearBottomRef.current = true`, `userScrolledUpRef.current = false`, hides return button.
    - `distanceFromBottom > 80px`: sets `userScrolledUpRef.current = true`, surfaces floating "Latest" button.
  - Implemented intelligent auto-scroll without `.scrollIntoView({ behavior: 'smooth' })`:
    - User message sent (`role === 'user'`): scrolls to bottom with smooth behavior.
    - Assistant response streaming / completion: only scrolls to bottom if `isNearBottomRef.current && !userScrolledUpRef.current`.
    - User scrolled up: reading position is 100% preserved; no downward jumps or resets occur.
    - Initial panel open: directly sets `container.scrollTop = container.scrollHeight` on a 50ms tick to show recent messages without animation jitter.
  - Added floating "Scroll to Latest" pill button (`ChevronDown`) when user is reviewing historical messages.

### 3. Songs Library Favorite Heart Alignment
- **`src/components/layout/SongRow.tsx`**:
  - Redefined CSS Grid constants to 8 columns (with album) and 7 columns (without album):
    ```ts
    export const SONG_TABLE_GRID_WITH_ALBUM =
      '56px minmax(140px, 3fr) minmax(120px, 2fr) minmax(100px, 1.8fr) 36px 52px 105px 76px';

    export const SONG_TABLE_GRID_NO_ALBUM =
      '56px minmax(180px, 3.5fr) minmax(140px, 2.5fr) 36px 52px 105px 76px';
    ```
  - **Column 1 (56px):** Checkbox + Track Index / Play button. Checkbox is 16px, gap 6px, Index/Play is 24px ($46\text{px} \le 56\text{px}$). Zero overflow into adjacent columns.
  - **Column 2 (minmax 140px, 3fr):** Title only, with `truncate pr-4 min-w-0`. Long titles truncate gracefully with ellipsis. Zero collisions with heart or metadata.
  - **Column 3 & 4:** Artist and Album columns with dedicated minmax widths.
  - **Column 5 (36px):** Dedicated Favorite Heart column. Centered with `w-7 h-7` ($28\times 28\text{px}$ clickable target) and `size={14}` Heart icon:
    - Favorite: `fill-red-500 text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]`.
    - Non-favorite: subtle outline `text-[#52525B] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity`.
  - **Columns 6, 7 & 8:** Time (52px), Format Badge (105px), and Actions (76px).
  - Updated `SongTableHeader` to include matching centered `<Heart size={11} className="text-[#52525B]" />` column header.

---

## Visual Verification Artifacts

Actual live Electron captures confirming the repairs:

| Feature Area | Live Electron Screenshot | Verification Notes |
| :--- | :---: | :--- |
| **Songs Library Favorite Alignment** | ![Songs Favorite Aligned](file:///C:/Users/a2301/Desktop/harmoniq/docs/assets/harmoniq-songs-favorite-aligned.png) | Dedicated 36px Favorite column, red filled hearts, zero title overlap, graceful truncation. |
| **Now Playing Vertical Scroll** | ![Now Playing Scrolled](file:///C:/Users/a2301/Desktop/harmoniq/docs/assets/harmoniq-now-playing-scrolled.png) | Scrolled down to reveal Specs mode, Source File Stream & Output Audio Pipeline panels without obstruction. |
| **AI Assistant Orb History** | ![AI Orb History](file:///C:/Users/a2301/Desktop/harmoniq/docs/assets/harmoniq-ai-orb-history.png) | Stable upward scrolling through conversation history, zero fluctuation or jitter, docked orb intact. |

---

## Verification & Test Results

### Automated Test Suite Execution
- **New Regression Test Suite:** [`src/test/ui_scroll_orb_history_library_alignment.test.ts`](file:///C:/Users/a2301/Desktop/harmoniq/src/test/ui_scroll_orb_history_library_alignment.test.ts)
  - 13 dedicated unit and integration tests passing (`60ms`).
  - Covers scroll ownership, BottomPlayer clearance, overscroll containment, history persistence across open/close, intelligent auto-scroll behavior, grid dimensions, truncation, and favorite states.
- **Previous UI Layout & Volume Wave Test Suite:** [`src/test/ui_layout_and_volume_wave.test.ts`](file:///C:/Users/a2301/Desktop/harmoniq/src/test/ui_layout_and_volume_wave.test.ts)
  - 17/17 tests passing (`54ms`).
- **Full Project Test Suite:**
  - **67 test files passed, 762 / 762 tests passed** (0 failures, `2.87s`).
- **Security Audit:** `npm audit` returned **0 vulnerabilities**.
- **Formatting & Lint:** `git diff --check` returned **0 errors**.

### Build Results
- `npm run build`: Succeeded with `0` errors (Vite production bundle + typecheck).
- `npm run build:electron`: Succeeded with `0` errors (CommonJS Node16 bundle).
- `npm run dist`: Built and updated:
  - `release/win-unpacked/Harmoniq.exe`
  - `release/Harmoniq Setup 2.0.0.exe`
  - `release/Harmoniq 2.0.0.exe` (Portable)

---

## Conclusion

All three target defects have been permanently corrected at their architectural root causes:
1. Main application content scrolls vertically to its fullest extent with independent, fixed navigation and player chrome.
2. AI Orb conversation history scrolls smoothly and stably in both directions without animation jitter or unwanted scroll resets.
3. Songs library rows possess clean, consistent vertical alignment with completely unobstructed, accessible Favorite heart actions.
