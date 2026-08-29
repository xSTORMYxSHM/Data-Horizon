# Data Horizon Studio

Current development build: **0.20.5**

Data Horizon Studio is a purpose-built, non-destructive visual compositor for authoring audio-reactive visualizers, scenes, and broadcast elements for Quartic Pulse and Tempest Broadcast. Its primary composition workflow is deliberately familiar to GIMP and Photoshop users: begin with a picture, stack independent visual elements above it, manipulate them on the canvas, and assign audio sources to individual properties. Layer retouching uses a Clip Studio Paint-inspired contextual brush workflow.

Source code is released under the GNU General Public License version 3. Packaged third-party runtime components retain their own included license notices.

The product is an editor and runtime, not a general-purpose raster editor. A project is an ordered graph of groups and layers. Each layer can own masks, effects, blend state, depth/parallax, and parameter-level audio modulation. The original media is never modified.

## Current public release

Data Horizon Studio 0.20.5 is a portable, unsigned Windows x64 release candidate that adds the Open Broadcast Kit example and preserves the verified 0.20 release pipeline. Download the ZIP, checksum, and manifest together, verify the SHA-256 value, extract the complete folder, and then launch `Data Horizon Studio.exe`. See [installation and provenance verification](docs/INSTALLATION.md) before running the build.

- [0.20.5 release notes](docs/RELEASE_0.20.5.md)
- [Open Broadcast Kit guide](docs/OPEN_BROADCAST_KIT.md)
- [Privacy](PRIVACY.md)
- [Support](SUPPORT.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Version-one outcome

- Create, duplicate, order, group, hide, mask, and blend layers.
- Apply cel shading, outlines, posterization, color grading, bloom, scanlines, and displacement.
- Route bass, mids, highs, beat, RMS, and future feature sources to individual parameters.
- Generate and edit sky, horizon, terrain, and foreground depth masks.
- Save projects and reusable presets with schema-versioned migrations.
- Run the same renderer in the editor, the live player, an OBS Browser Source, and offline export.
- Rebuild the existing Quartic Pulse Data Horizon scene as the first editable project.

## Foundation documents

- [Foundation audit](docs/FOUNDATION_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Migration plan](docs/MIGRATION_PLAN.md)
- [Phase 1 implementation record](docs/PHASE_1_IMPLEMENTATION.md)
- [Phase 2 authoring slice](docs/PHASE_2_IMPLEMENTATION.md)
- [Phase 3 canvas and masks](docs/PHASE_3_IMPLEMENTATION.md)
- [Phase 4 stream elements](docs/PHASE_4_IMPLEMENTATION.md)
- [Phase 5 animation and 0.10.0 build](docs/PHASE_5_IMPLEMENTATION.md)
- [Phase 6 functional UI](docs/PHASE_6_IMPLEMENTATION.md)
- [Phase 7 custom workspaces](docs/PHASE_7_IMPLEMENTATION.md)
- [Phase 8 painted masks](docs/PHASE_8_IMPLEMENTATION.md)
- [Phase 9 animated data paths](docs/PHASE_9_IMPLEMENTATION.md)
- [Phase 10 application interface scaling](docs/PHASE_10_IMPLEMENTATION.md)
- [Phase 11 reference song preview](docs/PHASE_11_IMPLEMENTATION.md)
- [Phase 12 advanced text and HUD tools](docs/PHASE_12_IMPLEMENTATION.md)
- [Phase 13 expert Node View](docs/PHASE_13_IMPLEMENTATION.md)
- [Phase 14 reusable preset library](docs/PHASE_14_IMPLEMENTATION.md)
- [0.15.0 release](docs/RELEASE_0.15.0.md)
- [Phase 15 project starter gallery](docs/PHASE_15_IMPLEMENTATION.md)
- [0.16.0 release](docs/RELEASE_0.16.0.md)
- [Phase 16 Tempest Asset Vault bridge](docs/PHASE_16_IMPLEMENTATION.md)
- [0.17.0 release](docs/RELEASE_0.17.0.md)
- [Phase 17 bidirectional Asset Vault library](docs/PHASE_17_IMPLEMENTATION.md)
- [0.17.1 release](docs/RELEASE_0.17.1.md)
- [Phase 18 editable composition reuse](docs/PHASE_18_IMPLEMENTATION.md)
- [0.17.2 release](docs/RELEASE_0.17.2.md)
- [Phase 19 linked compositions](docs/PHASE_19_IMPLEMENTATION.md)
- [0.17.3 release](docs/RELEASE_0.17.3.md)
- [Phase 20 extractable effect layers](docs/PHASE_20_IMPLEMENTATION.md)
- [0.17.4 release](docs/RELEASE_0.17.4.md)
- [Phase 21 layer retouching](docs/PHASE_21_IMPLEMENTATION.md)
- [0.17.5 release](docs/RELEASE_0.17.5.md)
- [Phase 22 eraser correctness](docs/PHASE_22_IMPLEMENTATION.md)
- [0.17.6 release](docs/RELEASE_0.17.6.md)
- [Phase 23 contextual paint workspace](docs/PHASE_23_IMPLEMENTATION.md)
- [0.17.7 release](docs/RELEASE_0.17.7.md)
- [Phase 24 Audio Driver Lab](docs/PHASE_24_IMPLEMENTATION.md)
- [0.17.8 release](docs/RELEASE_0.17.8.md)
- [Phase 25 effect-stack presets and scroll stability](docs/PHASE_25_IMPLEMENTATION.md)
- [0.17.9 release](docs/RELEASE_0.17.9.md)
- [Phase 26 Auto Key and animated effect presets](docs/PHASE_26_IMPLEMENTATION.md)
- [0.17.10 release](docs/RELEASE_0.17.10.md)
- [Phase 27 animation editor](docs/PHASE_27_IMPLEMENTATION.md)
- [0.17.11 release](docs/RELEASE_0.17.11.md)
- [Phase 28 curve editor and automation cleanup](docs/PHASE_28_IMPLEMENTATION.md)
- [0.17.12 release](docs/RELEASE_0.17.12.md)
- [Phase 29 canvas motion paths](docs/PHASE_29_IMPLEMENTATION.md)
- [0.17.13 release](docs/RELEASE_0.17.13.md)
- [Phase 30 multi-layer layout](docs/PHASE_30_IMPLEMENTATION.md)
- [0.17.14 release](docs/RELEASE_0.17.14.md)
- [Phase 31 shared group transforms](docs/PHASE_31_IMPLEMENTATION.md)
- [0.17.15 release](docs/RELEASE_0.17.15.md)
- [Phase 32 rulers and project guides](docs/PHASE_32_IMPLEMENTATION.md)
- [0.17.16 release](docs/RELEASE_0.17.16.md)
- [Phase 33 canvas marquee selection](docs/PHASE_33_IMPLEMENTATION.md)
- [0.17.17 release](docs/RELEASE_0.17.17.md)
- [Phase 34 persistent layer clipboard](docs/PHASE_34_IMPLEMENTATION.md)
- [0.17.18 release](docs/RELEASE_0.17.18.md)
- [Phase 35 layer-tree drag and drop](docs/PHASE_35_IMPLEMENTATION.md)
- [0.17.19 release](docs/RELEASE_0.17.19.md)
- [Phase 36 Layer Navigator](docs/PHASE_36_IMPLEMENTATION.md)
- [0.17.20 release](docs/RELEASE_0.17.20.md)
- [Phase 37 named layer selection sets and Solo/Restore](docs/PHASE_37_IMPLEMENTATION.md)
- [0.17.21 release](docs/RELEASE_0.17.21.md)
- [Phase 38 verified Git release pipeline](docs/PHASE_38_IMPLEMENTATION.md)
- [0.20.0 release](docs/RELEASE_0.20.0.md)
- [Open Broadcast Kit](docs/OPEN_BROADCAST_KIT.md)
- [0.20.5 release](docs/RELEASE_0.20.5.md)
- [Publish and export formats](docs/EXPORT_FORMATS.md)

## Current status

Phases 1–38 and the Open Broadcast Kit are implemented. The repository now contains:

- An Electron and TypeScript workspace with isolated renderer security defaults.
- A schema-versioned project model and immutable layer commands.
- Layer creation, image import, direct canvas positioning/resizing, numeric transforms, duplication, ordering, grouping, visibility, opacity, blending, depth, and parallax.
- Command-based undo and redo.
- Atomic project save/load plus local draft autosave.
- A Studio canvas, layer tree, parameter inspector, effect-stack foundation, and clean runtime view.
- Initial reusable renderer and audio-modulation package boundaries for later phases.
- Portable Quartic Pulse visualizer and Tempest Broadcast element-pack exporters with one shared runtime, including validated Quartic compatibility and package-owned four-role color palettes.
- Native text, shape/frame, and audio-spectrum elements plus posterize, bloom, scanline, and displacement passes.
- Graphics-editor canvas controls: fit/fixed zoom, Ctrl-wheel zoom, Space/middle-button pan, guides, transform snapping, and direct rotation.
- Reusable Sky, Horizon, Terrain, and Foreground vertical-region masks in the non-destructive effect stack.
- Native audio waveform and particle-atmosphere layers with editable source parameters.
- Insertable Lower Third, Alert, and Transition layer-group templates for Tempest Broadcast authoring.
- Keyframe timeline with playback, scrubbing, looping, editable duration, deterministic interpolation, and entrance/exit presets.
- Timeline animation and parameter-level audio modulation combine in the shared Studio, Live View, Quartic Pulse, and Tempest Broadcast renderer.
- Working application menus, canvas auto-selection, transform visibility, foreground/background color wells, asset placement, mask browsing, panel visibility controls, help/about surfaces, and expanded keyboard shortcuts.
- Persistent Photoshop-style custom workspaces with resizable dock splits, independently floating/dragging/resizing Toolbox, Inspector, Layers, and Timeline panels, plus named layout presets.
- A compact persistent Timeline mode, responsive controls, consolidated animation presets, and track rows that use the available panel height.
- Direct non-destructive painted masks with Hide/Reveal brushes, diameter and softness controls, transformed layer-local painting, stroke undo, mask clearing/inversion, and shared live/export rendering.
- Native animated data-path layers with canvas point creation and dragging, editable stroke/glow/dash/flow controls, timeline targets, audio modulation, and shared live/export rendering.
- Persistent 100–200% application-wide interface scaling with automatic 1080p, ultrawide, and 4K sizing, plus independent canvas zoom.
- Local reference-song loading with playback, scrubbing, looping, monitor volume, optional timeline sync, and real-time Bass/Mids/Highs/Beat/RMS analysis.
- Advanced multiline text and HUD layers with typography, alignment, spacing, plate, border, outline, glow, padding, wrapping, and reusable Signal Title, Data Label, and Broadcast Alert styles.
- A synchronized expert Node View showing each selected layer's source, ordered effects and masks, audio/animation activity, and final composite output, with add, enable, select, reorder, drag, and remove controls in the floatable workspace.
- A reusable preset library for saving, importing, exporting, inserting, and deleting portable layers or groups together with their dependent images, audio mappings, and keyframes.
- A New Project gallery with complete editable starters for blank compositions, Quartic Pulse visualizers, transparent Tempest window borders, HUD overlays, and full-scene transitions.
- Direct install/update publishing into Tempest Broadcast's Asset Vault with stable source filenames, canvas metadata, transparent browser output, and Signal Reactor telemetry input.
- A bidirectional Asset Vault library for listing installed elements, previewing their metadata, reopening editable source projects, updating from the current canvas, revealing package files, and recoverably uninstalling elements.
- Complete project composition reuse: import a `.horizon.json` file or installed Vault element as one editable group with fitted geometry, embedded assets, effects, audio assignments, keyframes, and canvas background preserved under fresh IDs.
- Photoshop-style linked compositions that remember a project file or Vault source, refresh their resolved children in place, preserve outer group styling, detach on demand, and strip authoring-only paths from presets and published runtimes.
- Extractable Outline layers with independent color, strength, threshold, thickness, softness, output mode, blend state, effect stack, animation tracks, and multi-source audio assignments.
- Non-destructive Paint / Erase retouching for extracted results, with colored soft brushes, opacity, ordered repaint/erase strokes, per-stroke undo, clear, duplication, presets, and shared live/export rendering.
- Alpha-correct erasing for isolated screen-blended effects plus automatic Outline extraction when Paint / Erase is chosen before manually extracting.
- A Clip Studio Paint-inspired contextual brush bar with visible Paint/Erase or Hide/Reveal subtools, Detail/Ink/Soft presets, synchronized size/softness/opacity/color properties, transparent-color switching, stroke undo/clear, a hardness-aware cursor, and B/E/C/bracket shortcuts.
- A live Audio Driver Lab with reliable Audio-tab navigation, generated-signal start/pause, live source meters, per-driver source/offset/result readouts, bounded Subtle/Punchy/Beat Pulse reaction presets, output-offset min/max editing, response curves, multi-driver combine controls, and a clearly visible Outline “Make It Dance” setup.
- Built-in non-destructive effect-stack presets for Comic Ink, Isolated Neon Edge, Dream Glow, CRT Signal, Heat Distortion, and Audio Pulse Outline; every inserted effect and music driver remains independently editable.
- Scroll-stable authoring panels that retain Inspector, Layers, Assets, Masks, Nodes, Presets, Vault, and Timeline positions across parameter edits, preset application, Undo, and Redo.
- Auto Key recording for effect parameters, opacity, depth, parallax, numeric transforms, and direct canvas transforms, including automatic baseline keys and playhead selection.
- Gentle Loop, Strong Loop, and Static modes for effect-stack presets, with immediate playback, live slider values, and visible timeline/audio/time badges on effect cards.
- A full animation editing workspace with key selection, marquee and group dragging, numeric time/value editing, six easing modes, duplication/deletion, track filtering, mute/solo, visible playheads, and an adjustable preview work area.
- Non-committing effect-preset previews with adjustable cycle length, plus recording of live music-driver results into ordinary editable Timeline keys.
- A switchable value-curve editor with evaluated easing visualization, two-axis point dragging, frame snapping, key copy/paste, work-area shading, and live playhead feedback.
- Safe recorded-automation cleanup that reduces redundant linear samples to a chosen error tolerance while retaining meaningful peaks and endpoints.
- Canvas motion-path overlays that combine Position X and Y tracks into an easing-accurate spatial trajectory with labeled key times, a live playhead marker, paired-key creation, and directly draggable points.
- Photoshop-style multi-layer selection with Ctrl-click toggling, Shift-click ranges, persistent layer locking, canvas or selection-relative alignment, even horizontal/vertical distribution, and direct group movement from the canvas.
- Shared-bounds scaling and rotation for multi-layer selections, live transform dimensions and deltas, 15-degree rotation snapping, and magenta smart guides that align selection edges and centers to the canvas or nearby visible layers.
- Zoom-aware horizontal and vertical canvas rulers plus persistent draggable or numerically placed project guides, with guide locking, clearing, project-coordinate labels, Undo support, and guide-aware transform snapping.
- Direct canvas marquee selection with Fully Enclosed and Touching geometry modes, live hit counts, Shift-add, Alt-subtract, Ctrl-toggle, and selection bounds evaluated at the current animation playhead.
- A persistent layer clipboard with Cut, Copy, Paste, and Paste in Place for single or multi-layer selections, preserving nested groups, image assets, effects, masks, audio assignments, and Timeline tracks across projects and Studio sessions.
- Photoshop-style layer-tree drag and drop with above, below, inside-group, and stack-bottom targets, multi-selection moves, visible insertion feedback, nesting-cycle prevention, and Undo support.
- A compact Layer Navigator for dense projects with persistent group disclosure, ancestor-aware name/type/effect search, eight activity and state filters, match counts, Collapse All, Expand All, Reveal Selected, and `/` search focus.
- Project-portable named layer selection sets with exact multi-selection recall, ancestor expansion, and hierarchy-aware Solo/Restore that preserves every layer's prior visibility state.
- A verified GitHub release pipeline with version/tag consistency checks, frozen-lockfile CI, packaged WebGL2 smoke validation, clean ZIP auditing, SHA-256 checksums, and machine-readable release manifests.
- A neutral Open Broadcast Kit reference project containing five editable, reusable, audio-reactive broadcast presets with transparent Tempest/OBS publishing.

## Windows build

For a local verified build, run `release/Data Horizon Studio 0.20.5-win32-x64/Data Horizon Studio.exe`, or extract `release/Data-Horizon-Studio-0.20.5-win32-x64-release.zip` first. The GitHub release workflow rebuilds, tests, audits, attests, and publishes its own artifact from tag `v0.20.5`.

## Development

Requirements: Node.js 22.12.0 or newer and pnpm 11 or newer.

Version builds advance by one patch number. The release after 0.20.5 is 0.20.6, followed by 0.20.7, 0.20.8, and so on. Minor or major version changes are reserved for an explicitly chosen product milestone rather than every development phase.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm start
```

New projects open on a blank canvas ready for a foundation image. The automated smoke fixture demonstrates the editor without copying the GPL-covered Quartic Pulse shader.
