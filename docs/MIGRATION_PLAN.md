# Data Horizon Migration Plan

## Guardrails

- Do not delete the preserved Quartic Data Horizon shader until the replacement passes all parity gates.
- Treat `Quartic Pulse/GitHub Build/Quartic-Pulse` as the current migration source; its Development Build has already removed the visual.
- Do not overwrite the user's modified `TempestHUDComposer.cpp` in Tempest Broadcast.
- Establish commits in Data Horizon and Tempest Mainframe Studio before cross-repository edits.
- Decide the Data Horizon license before copying GPL-covered Quartic implementation code.

## Phase 0 — Freeze the reference

1. Copy the existing Data Horizon shader into a read-only migration fixture only after licensing is settled.
2. Record representative stills at 720p, 1080p, and 4K with fixed timestamps, palettes, audio feature frames, and seeds.
3. Record a short deterministic reference sequence and performance timings.
4. Add the current screenshot as the visual acceptance reference.
5. Fix the centralized Quartic path in the Mainframe Studio example and commit a baseline in each participating repository.

Exit gate: the reference can be reproduced without relying on the non-Git Development Build.

## Phase 1 — Studio and document foundation

1. Create the pnpm workspace and Electron/TypeScript desktop shell.
2. Implement the versioned project schema, validators, migrations, and atomic save/load.
3. Implement the layer tree, selection, command history, grouping, duplication, ordering, visibility, opacity, and blend modes.
4. Implement asset import/reference handling without modifying originals.
5. Build the canvas, layer panel, and parameter inspector.

Exit gate: a project with image layers and groups round-trips without data loss; undo/redo survives all supported structural edits.

## Phase 2 — Render graph and effects

1. Implement the WebGL2 runtime API and framebuffer pool.
2. Add image, solid, group, and procedural layer registration.
3. Add masks, opacity, blend modes, and depth/parallax.
4. Add cel shading, outlines, posterization, color grading, bloom, scanlines, and displacement.
5. Add sky, horizon, terrain, and foreground mask generators.
6. Add GPU capability reporting and graceful effect failure.

Exit gate: effect ordering is visibly and mathematically stable; editor preview is produced entirely by the reusable runtime package.

## Phase 3 — Parameter-level audio

1. Define `AudioFeatureFrame` in Tempest contracts.
2. Consolidate live and offline analysis behind one algorithm and feature-frame shape.
3. Implement parameter descriptors and stable target paths.
4. Implement many-to-one bindings with amount, direction, ranges, smoothing, attack, release, curve, and combine mode.
5. Build parameter assignment UI and real-time meters.
6. Add deterministic tests across 30, 60, and 120 FPS evaluation schedules.

Exit gate: the same timestamped feature sequence produces the same evaluated parameter trace in preview, OBS runtime, and export.

## Phase 4 — Rebuild Data Horizon Classic

Convert the monolithic shader into this initial project stack:

1. `Sky Base`
2. `Stars and Nebula`
3. `Horizon Glow`
4. `Spectrum Skyline`
5. `Central Summit Architecture`
6. `Terrain Base` with terrain depth output
7. `Terrain Grid and Contours`
8. `Scrolling Data Paths`
9. `Beat Pulse Rings`
10. `Digital Rain and Atmosphere`
11. `Legacy HUD Panels and Reticle`
12. `Scanlines, Grade, and Tone Map`

Each procedural layer exposes the controls that are currently constants or global uniforms. Direct audio math in shader code is replaced with saved parameter bindings, except where a source intrinsically consumes a spectrum texture.

Exit gate: the layered project meets the reference image tolerance and performance budget while allowing every listed layer to be hidden and adjusted independently.

## Phase 5 — Shared outputs

1. Add a clean live player window driven by project revisions and feature frames.
2. Add the tokenized localhost OBS runtime page.
3. Add OBS WebSocket setup that creates or updates a Browser Source in Tempest Broadcast.
4. Adapt Quartic's offline frame/FFmpeg pipeline to the Data Horizon runtime.
5. Add state-hash, screenshot, color, timing, and audio-trace parity tests across all hosts.
6. Add crash recovery and last-known-good graph fallback.

Exit gate: editor, clean live, OBS Browser Source, and export all report the same runtime/project hash and pass visual parity captures.

## Phase 6 — Quartic and Broadcast cutover

1. Make Quartic Pulse discover Data Horizon projects through the asset registry.
2. Publish Quartic transport and `audio.features` frames through the Tempest Bridge or a negotiated local endpoint.
3. Replace Quartic visual style 6 with a Data Horizon project launch/control path.
4. Add Data Horizon project deployment and health status to Tempest Broadcast.
5. Remove the legacy shader only after release and rollback testing.

Exit gate: the current visual is loaded as a Data Horizon project in Quartic Pulse and routed into Tempest Broadcast without legacy shader code.

## Later milestones

- Painted masks and brush history.
- Animated Bezier/data paths.
- Text and full HUD authoring.
- Keyframes and timeline automation.
- Expert node view over the same underlying document graph.
- Portable project archives and dependency packing.
- Spout/shared-texture output.
- Optional WebGPU backend.

## First implementation slice

The first build slice should deliberately stay small:

1. Electron shell with canvas, layer tree, and inspector.
2. Schema-versioned save/load and command history.
3. Image and group layers with opacity and four blend modes.
4. One mask type, cel shading, outline, and color grade.
5. Mock audio feature generator and one binding per effect parameter.
6. Runtime-only page using the same project and renderer.

That slice proves the document/runtime separation before the full effect set and legacy scene migration increase complexity.
