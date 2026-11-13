# YouCut v2.0 Implementation Progress

Status values: `not started` | `built` | `verified (with evidence)` | `not tested`

## Feature Progress Table

| Feature / Task | Phase | Status | Evidence / Notes |
| :--- | :---: | :---: | :--- |
| **Scaffolding & Tooling** | P0 | not started | Electron + Vite + React + TS setup |
| **Fetch Binaries (yt-dlp, ffmpeg, ffprobe)** | P0 | not started | `scripts/fetch-binaries.mjs` |
| **Binary Verification in resources/bin** | P0 | not started | Version & execution check |
| **YOUCUT_HOME & Isolation** | P0 | not started | Default %APPDATA%\YouCut2, temp dir in tests |
| **Design Tokens Extraction** | P0 | not started | CSS variables + Tailwind theme from HTML/PNG |
| **Design Inventory & Visual Comparison** | P0 | not started | Native size Playwright screenshots vs PNG mocks |
| **Preview Spike Candidate A (IFrame Player)** | P0 | not started | Evaluation across 5 test video types |
| **Preview Spike Candidate B (Local Proxy + Range)** | P0 | not started | Progressive low-res stream via yt-dlp -g |
| **Preview Spike Decision & Style Guide Page** | P0 | not started | Documented spike report & token gallery screenshot |
| **Application Shell & Sidebar** | P1 | not started | 190px sidebar, logo, platforms, queue badge, status pill |
| **Router & Route IDs** | P1 | not started | Named route id navigation |
| **Design System Components** | P1 | not started | Button, Card, Chip, SegmentedToggle, Field, Badge, Toast, Dialog |
| **Home Page** | P1 | not started | Paste box, auto-routing by URL, platform cards, recent downloads |
| **Shells for Queue, History, Settings** | P1 | not started | Matching design language empty shells |
| **P1 Multi-resolution Playwright Verification** | P1 | not started | 1176x784 and 1440x900 screenshots |
| **YouTube URL Bar & Platform Chip** | P2 | not started | URL parsing, warm tint chip, green check, paste & fetch |
| **YouTube Info Card & Metadata** | P2 | not started | Green found badge, 2-line title, subtitle |
| **YouTube Trim Card & Timeline Controls** | P2 | not started | Handles, timecode cards (-1s/+1s), presets, frame-accurate toggle |
| **YouTube Full Video Toggle** | P2 | not started | Checkbox pill, accent subtitle, border, dimmed trim controls |
| **YouTube Quality & Format Selector** | P2 | not started | Video/Audio toggle, quality dropdown, MP4/MOV/GIF, MP3/M4A/WAV |
| **YouTube Save Location & Path Budgeting** | P2 | not started | Windows 260-char path budget, default save folder per platform |
| **YouTube Chapters Integration** | P2 | not started | Popover list, single chapter range or batch add |
| **YouTube Fetch State & Error Handling** | P2 | not started | Loading state, 60s timeout, Retry cards, wrong-platform banner, playlist detection |
| **YouTube Engine: Full & Clip Download** | P3 | not started | yt-dlp download execution with --newline, progress template |
| **yt-dlp Process Tree & Watchdog** | P3 | not started | 90s watchdog, taskkill /F /T /PID on stop/cancel/quit |
| **Stop / Resume / Cancel** | P3 | not started | Keep .part on stop, --continue on resume, delete only on cancel |
| **Validation via ffprobe (Lesson 5)** | P3 | not started | Exists, size > 0, streams, duration tolerance check |
| **Sequential Queue Engine** | P3 | not started | Sequential execution, fragment setting (1-32), single listener guarantee |
| **History Database & Store** | P3 | not started | SQLite / better-sqlite3 with search, open file, re-download |
| **Settings & Diagnostics** | P3 | not started | JSON settings, rotating log, copy diagnostics with redaction |
| **TrimModel Single Source of Truth** | P4 | not started | in, out, playhead, fullVideo unified state |
| **Interactive Filmstrip & Handles** | P4 | not started | Storyboard cache, draggable handles, time flags, ruler |
| **Player Controls & Shortcuts** | P4 | not started | Space, I/O, Shift+I/O, Alt+X, arrows, J/K/L, M, Ctrl+Enter, ? overlay |
| **MOV Output Format** | P5 | not started | Remux or H.264/AAC with ffprobe verification |
| **GIF Output Format** | P5 | not started | palettegen/paletteuse, max width 720, 15fps, duration/size warnings |
| **MP3 / M4A / WAV Audio Formats** | P5 | not started | Audio extraction and encoding with ffprobe verification |
