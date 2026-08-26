# Phase 30: Multi-Layer Layout

Phase 30 adds the selection, locking, and layout operations needed to arrange a composition as a coordinated design instead of manipulating every layer independently.

## Multi-layer selection

The Layers panel now supports familiar graphics-editor selection behavior:

- Click replaces the selection and establishes the primary layer.
- Ctrl-click toggles individual layers.
- Shift-click selects a contiguous visible range.
- The primary layer has a stronger highlight while every selected layer remains visibly marked.
- Canvas clicking can add or remove layers from the current selection with Ctrl.

The selection is editor state only. It does not alter projects, presets, linked compositions, or exported runtimes.

## Alignment and distribution

Selected unlocked layers can be aligned by left edge, horizontal center, right edge, top edge, vertical center, or bottom edge. The reference can be either the full canvas or the current selection bounds.

Three or more unlocked layers can also be distributed evenly by their horizontal or vertical centers. These commands update ordinary layer transforms in one undoable operation, so every renderer receives the same authored geometry.

## Group canvas movement

Dragging the primary selection on the canvas now moves every selected unlocked layer by the same delta. Existing snapping and canvas guides remain active. Resizing and rotation continue to act on the primary layer, keeping multi-layer changes deliberate.

When Auto Key is enabled, group movement writes synchronized Position X and Position Y animation edits for each moved layer. With Auto Key disabled, it updates their base transforms.

## Persistent locking

Layers now carry a persistent `locked` state. Locking a selection prevents Inspector edits, direct canvas transforms, deletion, grouping, ordering, alignment, and distribution for those layers while leaving visibility and selection available. Existing schema-version-1 projects without the field normalize to unlocked, so no schema migration is required.

## Verification

- 36 automated tests pass.
- Electron/WebGL2 smoke coverage selects three layers, aligns them to the canvas, distributes them vertically, moves them together, locks them, verifies disabled editing controls, and reports no browser or renderer errors.
- Visual reference: `test-output/phase30-multi-layer-layout.png`.
