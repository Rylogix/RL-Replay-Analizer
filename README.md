# ReplayForge

ReplayForge is a static Vite + React + TypeScript dashboard for analyzing Rocket League replay sessions entirely in the browser. It is built for GitHub Pages: no backend, no cloud storage, no server-side replay processing.

## What It Includes

- local `.replay` and normalized `.json` upload
- Web Worker parsing and import flow
- strongly typed normalized replay schemas
- local analytics and timeline generation
- IndexedDB replay session caching
- React Three Fiber replay viewer with free POV, follow-ball, follow-player, and tactical cameras
- client-side heatmaps
- raw normalized JSON inspection
- unit tests for normalization, analytics, and timeline logic

## Browser-Only Parser Integration

ReplayForge already includes:

- a worker message protocol
- a parser adapter abstraction in `src/lib/parser/replayParser.ts`
- a browser-loaded WASM parser integration using `rl-replay-subtr-actor`
- normalized schema and analytics layers that do not depend on parser internals
- JSON import/export for offline persistence and debugging

Current `.replay` support uses a browser-loaded WASM adapter and normalizes its ndarray/meta output into ReplayForge's schema. Direct replay summary stats are available, while some timed event layers still rely on transparent inference from frame state.

## Local Development

```bash
npm install
npm run dev
```

Then open the local Vite URL and upload a replay or normalized JSON export.

## Build and Test

```bash
npm run test
npm run build
```

The production bundle is emitted to `dist/`.

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy.yml`.

To deploy:

1. Push the repository to GitHub.
2. In repository settings, open `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to `main`.

The workflow installs dependencies, runs the production build, and publishes the static `dist/` output to GitHub Pages.

## Notes

- `vite.config.ts` uses `base: './'` so relative assets work in GitHub Pages project sites.
- No backend services are required.
- IndexedDB persistence stays in the user's browser on the deployed Pages site.

## Sample Flow

1. `npm install`
2. `npm run dev`
3. Open the Vite dev URL
4. Upload a `.replay` or import a normalized JSON file
5. Inspect the overview, 3D viewer, timeline, analytics, heatmaps, and raw data tabs

## Feature Support Labels

ReplayForge explicitly labels requested features as one of:

- `direct`
- `derived`
- `inferred`
- `unsupported`

The support matrix is available inside the app and originates from `src/lib/parser/featureSupport.ts`.

## Requested Feature Classification

### Direct from replay

- match metadata
- map and playlist, when present in parser output
- player and team identities
- summary goals, assists, saves, shots
- ball and car frame transforms
- demolitions when exposed by the replay parser

### Derived from replay

- timeline aggregation
- interpolated motion
- speed metrics
- aerial score
- movement score
- boost management score
- shooting score

### Inferred or estimated

- timed goals, touches, shots, and saves when reconstructed from frame state
- boost pickups
- possessions
- pressure windows
- positioning score
- pressure score
- recovery score
- challenge score
- rotation score

### Unsupported in the current browser implementation

- official Rocket League map and car assets
- exact shot trajectory reconstruction
- reliable bump extraction from every replay variant

## Known Limitations of `.replay`-Only Browser Analysis

- Replay files do not inherently expose every high-level coaching concept. Several requested metrics require transparent inference rules.
- Browser memory and CPU ceilings are lower than a native desktop parser, so very large replays may require chunked worker processing and more aggressive sampling.
- Some timed event layers are reconstructed from replay state because the browser parser currently exposes stronger summary/frame data than rich event timelines.

## Architecture and File Tree

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
