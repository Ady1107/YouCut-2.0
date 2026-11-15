# YouCut v2.0 — Current Project State (`currentState.md`)

> **Note**: This file is maintained locally and updated with every update, feature, and architectural change in the project.

---

## 📌 Executive Summary
- **Project**: YouCut v2.0 — Windows desktop video & audio clipper (YouTube, Instagram, Facebook).
- **Core Principle**: Zero Python/Qt in the UI. Pure Electron 33 + TypeScript + React 18 frontend orchestrating standalone native Windows binaries (`yt-dlp.exe`, `ffmpeg.exe`, `ffprobe.exe`).
- **Current Branch**: `dev` (feature branch `feat/queue-v2-playlist` merged into `dev`).
- **Current State**: **Queue Redesign, YouTube Playlist, Rate-Limit IP Protection, History Grouping & Native Binary Updaters Completed & Verified**.
  - All mockups from design images (`media_1794726208336_ebcfad2e.png` for Queue board and `media_1794726208335_fe5e20f6.png` for YouTube Playlist board) strictly matched.
  - Multi-concurrency (1–3), rolling 3s speed measurement, 21-sample sparkline history buffer, auto-retry with exponential backoff (2s, 8s, 30s), drag-and-drop queue reordering (`@dnd-kit`), atomic debounced JSON persistence to `%APPDATA%\YouCut2\queue.json`.
  - YouTube Playlist downloader: `yt-dlp --flat-playlist -J`, virtualized list for 500+ items (`@tanstack/react-virtual`), range selection inputs with shift-click support, zero-padded numbering `<NN> - <title>`, playlist folder creation, archive file deduplication (`%APPDATA%\YouCut2\archives\<playlistId>.txt`), size estimation.
  - **YouTube Rate-Limit & IP Ban Protection**: Passes browser cookies (`--cookies-from-browser` / `--cookies <file>`), desktop User-Agent, and gentle playlist batch pacing (`--sleep-requests 2`, `--sleep-interval 2 --max-sleep-interval 5`) to prevent 429 triggers. Tuned safety cooldown backoff (30s -> 60s -> 180s) with `!` info tooltip explaining IP ban prevention and an instant "Resume now" action.
  - **History Tab Playlist & Shorts System (Image 4 format)**: Extended `HistoryRecord` with `groupId`, `groupTitle`, `indexInGroup`, `totalInGroup`. Renders collapsible `HistoryGroupCard` with header badges, total size, 100% progress line, item index, checkmarks, file sizes, Show in Folder, and Play File actions. Fixed History tab auto-refresh on route switch (`currentRoute === 'history'`), real-time IPC notification (`history:updated`), window focus listeners, and manual refresh buttons.
  - **Resolution & Format Selector Fix**: Dynamically matches user quality selection (e.g. `480p`, `720p`, `360p`) in `src/main/download/queue.ts` via `-f bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best` and `--audio-quality <kbps>K` for audio-only downloads, ensuring requested resolutions are strictly respected instead of defaulting to 1080p.
  - **Real Native Binary Updaters (FFmpeg & yt-dlp)**: Replaced prototype UI and dummy handlers with real streaming HTTP downloaders for `yt-dlp` and `ffmpeg` (Gyan.dev/GitHub releases), real-time byte progress & speed calculation, atomic installation in `YOUCUT_HOME/bin/`, and version verification. Implemented the SPEC 14-day threshold rule in `checkFfmpegUpdate` comparing remote build dates against local installed timestamps to prevent infinite update loops.
  - **Graphics & Startup Crash Fix**: Replaced conflicting `--disable-gpu` and `--disable-software-rasterizer` CLI switches with safe `app.disableHardwareAcceleration()` in `src/main/index.ts`, eliminating the Chromium `ContextResult::kFatalFailure: Failed to create shared context for virtualization` fatal error during app launch while preserving software rasterization fallback.
  - Dark and Light themes with ≥4.5:1 text contrast and semantic CSS tokens in `tokens.css`.
  - 195px sidebar preserved; offline bundled typography (`@fontsource/inter`, `@fontsource/space-grotesk`).

---

## 🛠 Tech Stack Involved

| Category | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Desktop Runtime** | Electron | `33.4.11` | Cross-process desktop shell (`contextIsolation: true`, isolated preload bridge) |
| **Frontend Framework** | React | `18.3.1` | Reactive UI component tree, hooks, and context |
| **Language** | TypeScript | `5.7.2` | Strict end-to-end type safety across Node main, preload, and React web |
| **Bundler & Build Tool**| `electron-vite` + Vite | `2.3.0` / `5.4.21` | Fast HMR in dev, optimized SSR main/preload & web production bundles |
| **Styling & Design System**| Tailwind CSS | `3.4.15` | Semantic CSS tokens (`tokens.css`) bound to CSS custom properties |
| **List Virtualization** | `@tanstack/react-virtual` | `3.14.26` | High-performance virtualized 52px rows for 500+ playlist entries |
| **Drag and Drop Reordering**| `@dnd-kit/core` + `sortable` + `utilities` | `6.3.1` / `10.0.0` | Accessible pointer & keyboard drag-to-reorder for queue cards |
| **Layout Animations** | `framer-motion` | `14.14.0` | Smooth layout transitions and list item insertion/removal |
| **Bundled Offline Fonts** | `@fontsource/inter` + `@fontsource/space-grotesk` | `5.3.0` | Bundled web fonts for zero-network offline typography |
| **Media Downloader** | `yt-dlp` | `2026.10.26` | Streaming extraction, flat-playlist JSON, format selection, section clipping |
| **Media Codecs & Validator**| `ffmpeg` + `ffprobe` | `7.1-essentials` | Transcoding, keyframe generation, duration and stream validation |
| **Unit Testing** | Vitest | `2.1.8` | Blazing-fast unit tests for queue data structures, errors, and playlist parsing |
| **E2E & Screenshot Verification**| Playwright | `1.49.0` | Automated headless verification screenshots across dark and light themes |

---

## 📁 Project Architecture & Directory Structure

```
YouCut v2.0/
├── currentState.md                     # [THIS FILE] Local single source of truth for project state & installation
├── README.md                           # Project introduction & GitHub repository overview
├── electron.vite.config.ts             # electron-vite configuration (main, preload, renderer targets)
├── package.json                        # Project dependencies, scripts, and engine metadata
├── tailwind.config.js                  # Tailwind CSS token bindings to var(--bg-*), var(--accent-*)
├── tsconfig.json                       # TypeScript root configuration
├── tsconfig.node.json                  # TypeScript config for main and preload
├── tsconfig.web.json                   # TypeScript config for React renderer
│
├── docs/                               # Documentation, specifications, and visual verification artifacts
│   ├── design-inventory/               # Reference design audit screenshots
│   ├── screenshots/                    # Verified feature screenshots by phase
│   │   ├── p0-styleguide-...png        # Phase 0 style guide captures
│   │   ├── p2/                         # Phase 2 metadata & error state captures
│   │   ├── p3/                         # Phase 3 engine, queue, speed/volume, light/dark theme captures
│   │   └── p4-queue-playlist/          # Phase 4 Queue v2 & YouTube Playlist verification captures
│   │       ├── 01-queue-board-dark.png
│   │       ├── 02-queue-board-light.png
│   │       ├── 03-playlist-view-dark.png
│   │       ├── 04-playlist-view-light.png
│   │       └── 05-playlist-selection-range.png
│   ├── DESIGN-INVENTORY.md             # Visual design tokens extracted from original HTML templates
│   ├── PROGRESS.md                     # Real-time task progress matrix
│   ├── SPEC.md                         # Comprehensive engineering specification
│   └── SPIKE.md                        # YouTube preview spike evaluation and architectural decisions
│
├── resources/                          # Bundled application resources
│   └── bin/                            # Standalone native binaries for Windows
│       ├── yt-dlp.exe                  # Latest yt-dlp executable
│       ├── ffmpeg.exe                  # FFmpeg 7.1 essentials build
│       └── ffprobe.exe                 # FFprobe 7.1 essentials build
│
├── scripts/                            # Automation, verification & maintenance scripts
│   ├── capture-p2-gate-screenshots.mjs # Automated screenshot suite for Phase 2
│   ├── capture-p3-gate-screenshots.mjs # Automated screenshot suite for Phase 3
│   ├── capture-queue-playlist-screenshots.mjs # Automated screenshot suite for Queue v2 & Playlist
│   ├── fetch-binaries.mjs              # Automated downloader for yt-dlp and ffmpeg/ffprobe
│   ├── inventory-design.mjs            # Design inventory automation
│   └── verify-p3-engine.mjs            # Direct CLI test runner for download engine & validator
│
├── test/                               # Unit test suites (Vitest)
│   └── queue-playlist.test.ts          # 11 unit tests for queue models, retry, playlist parsing & size estimation
│
└── src/
    ├── shared/                         # Types shared across Main, Preload, and Renderer
    │   └── types.ts                    # QueueItem, QueueGroup, PlaylistInfo, QueueProgress, IPC payloads
    │
    ├── main/                           # Electron Main Process (Node.js runtime)
    │   ├── config/
    │   │   ├── paths.ts                # Native binary paths (resources/bin) & YOUCUT_HOME resolution
    │   │   ├── settings.ts             # User settings manager (%APPDATA%\YouCut2\settings.json)
    │   │   └── updates.ts              # Native binary update checker & auto-updater
    │   ├── download/
    │   │   ├── errors.ts               # Raw yt-dlp error mapper (network, private, rate-limit, disk full)
    │   │   ├── history.ts              # Persistent history storage (%APPDATA%\YouCut2\history.json)
    │   │   ├── persist.ts              # Atomic debounced queue persistence (%APPDATA%\YouCut2\queue.json)
    │   │   ├── playlist.ts             # yt-dlp flat playlist extraction & archive file management
    │   │   ├── queue.ts                # Queue v2 manager (concurrency 1-3, rolling speed, retry backoff, sparkline)
    │   │   └── validator.ts            # validateOutputWithFFprobe (stream presence, duration tolerance)
    │   ├── ipc/
    │   │   └── index.ts                # IPC handlers: queue, playlist, clipboard, dialogs, shell
    │   └── index.ts                    # Main Electron app entry, single-instance lock, child PID tracking
    │
    ├── preload/                        # Electron Preload Bridge (Isolated & secure)
    │   └── index.ts                    # contextBridge exposing typed window.api to renderer
    │
    └── renderer/                       # Electron Renderer Process (React 18 + Tailwind)
        └── src/
            ├── components/             # Design System & UI Components
            │   ├── playlist/           # YouTube Playlist components
            │   │   ├── PlaylistList.tsx# Virtualized 52px entry rows with checkbox & keyboard selection
            │   │   ├── PlaylistView.tsx# Two-column playlist inspector matching design image
            │   │   └── SwitchRow.tsx   # Custom switch row toggle
            │   ├── queue/              # Redesigned Queue components
            │   │   ├── ActiveItemCard.tsx # Active downloading card with live speed, ETA, pause/cancel
            │   │   ├── DoneCard.tsx    # Completed card with Open Folder and Play actions
            │   │   ├── FailedCard.tsx  # Failed card with retry count, readable error & Retry button
            │   │   ├── FilterTabs.tsx  # All / Downloading / Waiting / Done / Failed filter tabs with counts
            │   │   ├── PlaylistGroupCard.tsx # Collapsible group card with nested progress & items list
            │   │   ├── ProgressBar.tsx # 6px gradient progress bar with sweep & shimmer animation
            │   │   ├── Sparkline.tsx   # Smooth SVG sparkline chart with gradient fill
            │   │   └── WaitingCard.tsx # Reorderable waiting card with drag handle & Start Now action
            │   ├── AppShell.tsx        # Multi-tab layout (preserves React state across tab switches)
            │   ├── Badge.tsx           # Status badges & FullVideoCheckbox pill
            │   ├── Button.tsx          # Styled buttons (primary, secondary, ghost)
            │   ├── Card.tsx            # Themed surface cards
            │   ├── ChaptersPopover.tsx # YouTube chapters popover & "Add all chapters" batch action
            │   ├── Chip.tsx            # Format chips (MP4/MOV/GIF/MP3/M4A/WAV) & platform pills
            │   ├── Field.tsx           # Inputs and custom dropdown selectors
            │   ├── Icons.tsx           # Lucide SVG icon wrappers
            │   ├── SegmentedToggle.tsx # Video / Playlist mode toggle
            │   ├── Sidebar.tsx         # 195px sidebar navigation with active indicator & queue count
            │   ├── Toast.tsx           # Non-intrusive toast notifications (capped to max 2)
            │   ├── UrlBar.tsx          # URL input bar with paste & platform auto-detection
            │   └── WrongPlatformBanner.tsx # Warnings for wrong platform or playlist URLs
            ├── context/
            │   ├── NavigationContext.tsx # Central router, toast manager, dynamic status pill
            │   ├── QueueContext.tsx    # Central reactive queue store with selectors & speed history
            │   └── ThemeContext.tsx    # Dark/Light theme provider with localStorage persistence
            ├── hooks/
            │   └── useQueue.ts         # Hook exposing queue state, actions, and selectors
            ├── routes/                 # Top-level view controllers
            │   ├── Home.tsx            # Landing view with quick platform selection
            │   ├── YouTube.tsx         # YouTube clipper & playlist manager
            │   ├── Instagram.tsx       # Instagram Reels clipper
            │   ├── Facebook.tsx        # Facebook video clipper
            │   ├── Queue.tsx           # Redesigned Queue v2 view matching design mockup
            │   ├── History.tsx         # Download history table
            │   └── Settings.tsx        # System settings, concurrency slider, theme toggle, binary updates
            └── styles/
                ├── index.css           # Typography imports (@fontsource/inter, @fontsource/space-grotesk)
                └── tokens.css          # Semantic design tokens for Dark (#0B0C10) and Light (#F5F6F9) themes
```

---

## 🚀 Installation & Local Development Guide

### 1. Prerequisites
- **OS**: Windows 10/11 (64-bit)
- **Node.js**: `v20.x` or higher (LTS recommended)
- **npm**: `v10.x` or higher
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+

### 2. Clone & Branch Setup
```powershell
git checkout dev
```

### 3. Install Dependencies
```powershell
npm install
```

### 4. Fetch Native Binaries (`yt-dlp`, `ffmpeg`, `ffprobe`)
Binaries are automatically downloaded into `resources/bin/` if not present:
```powershell
npm.cmd run fetch-binaries
```

### 5. Running the Application in Development Mode
Starts electron-vite dev server with hot module replacement:
```powershell
npm.cmd run dev
```

### 6. Running Unit & Integration Tests
```powershell
# Run Vitest unit tests (queue, playlist, retry, size estimation)
npm.cmd test

# Run TypeScript typechecks across node and web
npm.cmd run typecheck

# Full production build
npm.cmd run build
```

### 7. Capturing Feature Verification Screenshots
```powershell
node scripts/capture-queue-playlist-screenshots.mjs
```

---

## 🎨 Design System & Token Specifications

### Dark Theme (`.dark` / default)
- **App Background**: `#0B0C10`
- **Sidebar**: `#0F1116` (width: `195px`)
- **Card**: `#14161D`
- **Inset / Field**: `#0F1116`
- **Divider**: `#1E212B`
- **Border**: `#232733` | **Border Strong**: `#2A2E3B`
- **Progress Track**: `#2A2E3B`
- **Text**: `#F3F4F7` | **Muted**: `#9BA1B0` | **Subtle**: `#6B7285`
- **Accent**: `#FF5B4A` | **Accent Tint**: `#2A1B19` | **Accent Text**: `#FF8C7E` | **On-Accent**: `#1A0805`
- **Status**: Success `#3DDC97` (`#12261D` tint) | Danger `#FF6B6B` (`#2A1517` tint)

### Light Theme (`.light`)
- **App Background**: `#F5F6F9`
- **Sidebar**: `#FFFFFF`
- **Card**: `#FFFFFF`
- **Inset / Field**: `#F0F2F6`
- **Divider**: `#E8EAF0`
- **Border**: `#E3E6EE` | **Border Strong**: `#CDD2DE`
- **Progress Track**: `#E3E6EE`
- **Text**: `#14161D` | **Muted**: `#5B6272` | **Subtle**: `#8A91A3`
- **Accent**: `#FF5B4A` | **Accent Tint**: `#FFEFEC` | **Accent Text**: `#C2331F` | **On-Accent**: `#1A0805`
- **Status**: Success `#12A369` (`#E5F7EE` tint) | Danger `#D83A3A` (`#FDECEC` tint)

---

## 📊 Verification Evidence

- **Unit Tests**: 15/15 passing across `test/queue-playlist.test.ts` and `test/history-updates.test.ts`.
- **Type Checking**: Node and Web TypeScript compilation passed with zero errors (`tsc --noEmit`).
- **Production Build**: `electron-vite build` passed with zero errors.
- **Gate 3 Verification Suite**: 8/8 automated Playwright CDP steps passed with exit code 0 (`scripts/verify-gate3.mjs`).
- **Visual Artifacts**:
  1. `docs/screenshots/p4-queue-playlist/01-queue-board-dark.png`
  2. `docs/screenshots/p4-queue-playlist/02-queue-board-light.png`
  3. `docs/screenshots/p4-queue-playlist/03-playlist-view-dark.png`
  4. `docs/screenshots/p4-queue-playlist/04-playlist-view-light.png`
  5. `docs/screenshots/p4-queue-playlist/05-playlist-selection-range.png`
  6. `docs/screenshots/gate3/gate3-playlist-initial.png`
  7. `docs/screenshots/gate3/gate3-cooldown-banner.png`
  8. `docs/screenshots/gate3/gate3-playlist-final.png`
