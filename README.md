# ReplayForge

ReplayForge is a static Vite + React + TypeScript dashboard for analyzing Rocket League replay sessions entirely in the browser. It is designed to run on GitHub Pages with no backend, no cloud storage, and no server-side replay processing.

## What It Includes

- local file upload for `.replay` and normalized `.json`
- Web Worker pipeline for parsing/import flow
- strongly typed normalized replay schemas
- local analytics and timeline generation
- IndexedDB session caching
- React Three Fiber proxy replay viewer
- event timeline and synchronized event feed
- client-side heatmaps
- raw normalized JSON inspector
- unit tests for normalization, analytics, and timeline logic

## Browser-Only Parser Integration Strategy

ReplayForge already includes:

- a worker message protocol
- a parser adapter abstraction in `src/lib/parser/replayParser.ts`
- normalized schema and analytics layers that do not depend on parser internals
- JSON import/export for offline persistence and debugging
- a demo replay session for UI development before a browser parser is connected

To complete `.replay` parsing in production:

1. Compile a Rocket League replay parser to browser-safe WASM.
2. Wrap it in a `BrowserReplayAdapter`.
3. Convert raw parser output to ReplayForge normalized schemas.
4. Keep parsing and heavy analytics inside Web Workers.

## Local Development

```bash
npm install
npm run dev
```

Then open the local Vite URL, upload a replay or normalized JSON, or use the built-in demo session.

## Build and Test

```bash
npm run test
npm run build
```

The production bundle is emitted to `dist/`.

## GitHub Pages Deployment

### GitHub Actions

This repository includes `.github/workflows/deploy.yml`.

To deploy:

1. Push the repository to GitHub.
2. In repository settings, open `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to `main`.

The workflow installs dependencies, runs the production build, and publishes the static `dist/` output to GitHub Pages.

### Notes

- `vite.config.ts` uses `base: './'` so relative assets work in GitHub Pages project sites.
- No backend services are required.
- IndexedDB persistence stays in the user’s browser on the deployed Pages site.

## Sample Flow

1. `npm install`
2. `npm run dev`
3. Open the Vite dev URL
4. Click `Load demo session` or import a normalized JSON file
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
- goals, assists, saves, shots

### Derived from replay

- timeline aggregation
- ball and car interpolated transforms
- speed
- aerial score
- movement score
- boost management score
- shooting score

### Inferred or estimated

- touches when reconstructed from frame state
- demos and bumps when only detectable from state transitions
- boost pickups
- possessions
- pressure windows
- positioning score
- pressure score
- recovery score
- challenge score
- rotation score

### Unsupported in the scaffold

- live `.replay` parsing until a browser-safe WASM parser is connected
- official Rocket League map and car assets
- exact shot trajectory highlight reconstruction

## Known Limitations of `.replay`-Only Browser Analysis

- Replay files do not inherently expose every high-level coaching concept. Several requested metrics require transparent inference rules.
- Browser memory and CPU ceilings are lower than a native desktop parser, so very large replays may require chunked worker processing and more aggressive sampling.
- Cross-platform replay parser availability in the browser is the main implementation dependency. The UI, storage, worker protocol, and analytics layers are ready for that integration, but the adapter itself is still a placeholder in this scaffold.

## Architecture and File Tree

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
