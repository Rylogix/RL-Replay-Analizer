# ReplayForge Architecture Plan

## Goals

- Deploy as a static site on GitHub Pages
- Keep all replay parsing, normalization, analytics, rendering, and persistence in the browser
- Avoid server APIs, backend workers, databases, authentication, and cloud storage
- Support local file upload, IndexedDB caching, JSON export/import, and a worker-based parse pipeline

## Runtime Architecture

1. The user uploads a local `.replay` or normalized `.json` file from the browser.
2. The UI sends the file to `src/workers/replayWorker.ts`.
3. The worker hashes the file, attempts replay parsing through `src/lib/parser/replayParser.ts`, normalizes the output, computes analytics, and builds timeline events.
4. The main thread stores the resulting normalized session in IndexedDB through `src/lib/storage/db.ts`.
5. Zustand state in `src/app/store.ts` drives the dashboard, viewer playback, timeline filters, event feed, and tab panels.
6. React Three Fiber renders a proxy arena and synchronized car/ball motion using interpolated frame data.
7. Charts, heatmaps, raw data inspection, and export/import run entirely client-side.

## Parser Strategy

- Current scaffold:
  - Web Worker transport and progress messaging
  - parser adapter boundary for browser-runnable replay parsing
  - normalized JSON import path
  - in-app demo replay for UI development and GitHub Pages validation
- Intended production parser path:
  - Compile a Rocket League replay parser to WASM
  - Wrap it behind `BrowserReplayAdapter`
  - Emit raw parser output into ReplayForge normalized schemas
  - Keep heavy decode and analytics inside workers

## Data Flow

`file upload -> worker parse/import -> normalizeReplay -> computeReplayAnalytics -> buildTimelineEvents -> IndexedDB cache -> dashboard state -> viewer/timeline/heatmaps/raw inspector`

## UI Composition

- Left rail: overview cards and summary panels
- Center: 3D proxy arena viewer plus playback controls
- Right rail: synchronized event feed
- Bottom: timeline scrubber with filters and event markers
- Tabs:
  - Overview
  - Players
  - Analytics
  - Heatmaps
  - Raw Data

## File Tree

```text
.
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
├─ docs/
│  └─ ARCHITECTURE.md
├─ public/
│  └─ replayforge-icon.svg
├─ sample-data/
│  └─ README.md
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  └─ store.ts
│  ├─ components/
│  │  ├─ EventFeed.tsx
│  │  ├─ LoadingOverlay.tsx
│  │  ├─ Panel.tsx
│  │  ├─ SupportBadge.tsx
│  │  └─ Tabs.tsx
│  ├─ features/
│  │  ├─ analytics/
│  │  │  ├─ AnalyticsPanel.tsx
│  │  │  ├─ OverviewPanel.tsx
│  │  │  └─ PlayersPanel.tsx
│  │  ├─ heatmaps/
│  │  │  └─ HeatmapPanel.tsx
│  │  ├─ raw-data/
│  │  │  └─ RawDataInspector.tsx
│  │  ├─ timeline/
│  │  │  └─ TimelineBar.tsx
│  │  ├─ upload/
│  │  │  └─ UploadPanel.tsx
│  │  └─ viewer/
│  │     └─ ReplayViewer3D.tsx
│  ├─ lib/
│  │  ├─ analytics/
│  │  │  ├─ formulas.ts
│  │  │  ├─ metrics.test.ts
│  │  │  ├─ metrics.ts
│  │  │  ├─ selectors.ts
│  │  │  ├─ timeline.test.ts
│  │  │  └─ timeline.ts
│  │  ├─ parser/
│  │  │  ├─ featureSupport.ts
│  │  │  ├─ normalize.test.ts
│  │  │  ├─ normalize.ts
│  │  │  ├─ replayParser.ts
│  │  │  └─ replayWorkerClient.ts
│  │  ├─ storage/
│  │  │  ├─ db.ts
│  │  │  └─ replayCache.ts
│  │  └─ utils/
│  │     ├─ field.ts
│  │     ├─ format.ts
│  │     ├─ hash.ts
│  │     └─ math.ts
│  ├─ pages/
│  │  └─ HomePage.tsx
│  ├─ sample-data/
│  │  └─ mockReplay.ts
│  ├─ styles/
│  │  └─ global.css
│  ├─ types/
│  │  └─ replay.ts
│  ├─ workers/
│  │  ├─ messages.ts
│  │  └─ replayWorker.ts
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
└─ vitest.config.ts
```

## GitHub Pages Fit

- `vite.config.ts` uses `base: './'` for relative asset loading
- No SSR, server routes, API handlers, or backend storage
- Browser-only worker and IndexedDB persistence
- GitHub Actions workflow builds the static bundle and deploys `dist/`

## Known Limitations of `.replay`-Only Browser Analysis

- Browser-only replay parsing depends on a WASM-compatible parser that is not wired in this scaffold yet.
- Some advanced events such as bumps, boost pickups, possessions, pressure windows, and challenge context are often inferred rather than directly present in replay payloads.
- Official Rocket League assets are not bundled; the 3D viewport uses proxy geometry.
- Custom analytics are transparent heuristics derived from replay state and should never be presented as official Psyonix stats.

