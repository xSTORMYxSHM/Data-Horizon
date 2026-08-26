# Data Horizon Foundation Audit

Date: 2026-08-21

## Executive result

Data Horizon should begin as its own Electron and TypeScript application with a reusable WebGL2 runtime. The current visual is a useful visual reference and migration fixture, but its implementation should not become the new architecture: it is embedded in Quartic Pulse's single large fragment shader and application state.

The safest first OBS integration is an authenticated localhost Browser Source that loads the exact same compiled Data Horizon runtime as the editor and exporter. Tempest Broadcast has Browser Source creation and OBS WebSocket extension points today; neither its source tree nor Quartic Pulse currently contains a working Spout or NDI transport.

## Workspace snapshot

| Project | State found | Consequence |
| --- | --- | --- |
| Data Horizon | Empty new root | Clean place to establish the product and repository boundaries. |
| Quartic Pulse repository | Clean `agent/v0.30-workspace-foundation` branch | Preservation source for the existing Data Horizon shader. |
| Quartic Pulse Development Build | Not a Git worktree; differs from the repository | Its `app.js` and visual catalog have already removed Data Horizon. Do not use it as the only migration source. |
| Tempest Mainframe Studio | Git repository with no commits and all files untracked | Architecture and Bridge code are usable, but this project needs a baseline commit before risky cross-project work. |
| Tempest Broadcast | `tempest-main` with one modified user file | Preserve `frontend/docks/TempestHUDComposer.cpp`; the audit made no edits in Broadcast. |

## Existing Data Horizon visual

The preserved implementation lives in `Quartic Pulse/GitHub Build/Quartic-Pulse/src/renderer/app.js`:

- `mainframeHash21`, noise, terrain height, and the full landscape shader begin around line 607.
- `renderMainframeLandscape` begins around line 649.
- The visual is selected by `uVisualStyle == 6` around line 1345.
- The same `app.js` is approximately 437 KB and also owns UI state, audio orchestration, rendering, OBS synchronization, profiles, performance mode, and export.

The scene is internally separable even though the code is not. Its shader contains distinct sky/horizon, stars and nebula, skyline and summit, terrain, grid and contours, data paths, pulse rings, digital rain, HUD panels, reticle, scanlines, and final tone mapping. Those boundaries should become the first editable layer stack.

## Reusable Quartic Pulse systems

Useful behavior to preserve or extract behind contracts:

- Audio feature vocabulary: bass, mids, highs, beat, RMS, 64-bin spectrum, and waveform.
- Adaptive beat detection and envelope behavior in `src/renderer/modules/audio-analysis-engine.js`.
- Deterministic offline frame scheduling, supersampling, framebuffer readback, and FFmpeg session management.
- BrowserWindow-based clean output and renderer-state synchronization.
- Export profiles and encoder capability checks.
- Security defaults: context isolation, renderer sandboxing, and no Node integration.

These systems should be adapted, tested, and separated from Quartic-specific UI state. They should not be copied wholesale into another monolithic application file.

## Current gaps and risks

### 1. Rendering is a single pass

The current renderer sets a large uniform set and issues one full-screen draw. It has no render graph, intermediate texture pool, independent layers, masks, per-layer blend state, or effect stacks. Adding more conditionals to that shader would increase coupling and shader compilation risk.

### 2. Live and offline audio analysis are separate implementations

Live rendering calls `audio-analysis-engine.js`, while offline export uses a second FFT implementation in `createOfflineAudioAnalyzer` around line 7445 of `app.js`. Their intent is similar, but duplication makes strict parity difficult. Data Horizon needs one feature-frame contract and one deterministic analyzer implementation that can consume either real-time samples or an offline window.

### 3. Modulation is close to the desired UX but not yet parameter-native

Quartic Pulse already supports bass, mids, highs, beat, and RMS; amount; attack; release; floor; ceiling; and additive multiple routes. However, the targets are a fixed global table, bipolar direction is target-dependent, and stored mappings are capped at eight. Data Horizon needs stable parameter paths and bindings owned by parameters or project modulation records rather than a fixed visual-level target list.

### 4. OBS output is duplicated state, not a shared render session

Quartic Pulse opens a second Electron BrowserWindow and relays snapshots over IPC at 30 or 60 Hz. The window executes the same application code, which is a valuable precedent, but the transport copies a broad mutable state object. Data Horizon should instead send immutable project revisions plus timestamped audio/transport frames to a small runtime API.

### 5. Native media transport is not available yet

Quartic Pulse reports Spout capability only if `assets/spout/QuarticPulse.SpoutSender.exe` exists; it is absent. Searches of the Tempest Broadcast source found no Spout or NDI implementation. Browser Source is therefore the only already-supported path that can run the same renderer code inside Broadcast.

### 6. Broadcast audio features are not equivalent to Quartic features

Tempest Broadcast's Signal Reactor publishes master, desktop, microphone, beat, and pulse to `telemetry.json` every 50 ms. HUD browser pages poll it every 60 ms. This is suitable for existing broadcast reactions, but it is not the authoritative bass/mids/highs/RMS/spectrum contract Data Horizon requires.

### 7. The cross-application audio payload is unspecified

Tempest Mainframe Studio reserves the `audio.features` topic, but `@tempest/contracts` currently validates only a generic message envelope. Before integration, the suite needs a versioned `AudioFeatureFrame` payload with source identity, sequence number, media timestamp, clock domain, feature values, spectrum shape, and discontinuity/reset semantics.

### 8. Centralization exposed a stale manifest path

The Mainframe Studio Quartic example still points at `Fractal Visualizer/Development Build`. The project now lives at `Quartic Pulse/Development Build`, so the Studio test that resolves the packaged executable fails. This is a path/configuration defect, not a failure of the Bridge or contracts.

### 9. Licensing must be explicit

Quartic Pulse declares GPL-3.0-or-later. Copying its shader or export implementation into a differently licensed Data Horizon distribution requires a deliberate licensing decision and confirmation that the relevant copyrights can be relicensed. Keeping Data Horizon separated from the GPL OBS code by Browser Source and WebSocket protocols also avoids accidental native linkage between the applications.

## Verification performed

- Tempest Mainframe contracts and Bridge built successfully.
- Contract tests passed: 3 of 3.
- Bridge tests passed: 2 of 2.
- Mainframe desktop tests passed 2 of 3; the only failure is the stale Quartic executable path described above.
- Quartic release metadata validation passed.
- Quartic controller/engine smoke checks passed.
- Quartic report relay tests passed: 4 of 4.
- Quartic's Electron visual smoke could not run because the repository's Electron runtime target is missing. No dependency reinstall or destructive module-store change was attempted.

## Decisions from the audit

1. Use WebGL2 as the version-one rendering floor because it is supported by Electron, OBS Browser Source, and the existing shader.
2. Build one pure runtime API and adapt it to editor, live, OBS, and export hosts.
3. Keep high-bandwidth video out of Tempest Bridge; use it for project revisions, parameter commands, transport, and normalized audio feature frames.
4. Use Browser Source first, with a random session token and localhost-only server. Add Spout as a later output adapter without changing project evaluation.
5. Preserve the Quartic implementation until the layered project passes visual, timing, and audio parity gates.
