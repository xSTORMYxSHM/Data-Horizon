# Phase 13: Expert Node View

Phase 13 adds a synchronized Node View for inspecting and editing the selected layer's real rendering chain. It is a visual projection of the existing ordered compositor rather than a second project format, so node edits immediately affect Studio, Live View, Quartic Pulse, Tempest Broadcast, and saved projects.

## Render graph

- Every selected layer is shown as Source → ordered effects and masks → Layer Composite.
- Source nodes identify the authored generator, image asset, or group contents.
- Effect nodes show their stack position, enabled state, leading parameter values, audio assignments, and animation-track counts.
- Mask effects are labeled as masks while retaining their exact position in the processing chain.
- Output nodes show blend mode, opacity, depth, and parallax.

## Graph editing

- Add cel shading, outlines, posterization, color grading, bloom, scanlines, displacement, luminance masks, painted masks, or semantic region masks directly from Node View.
- Enable or disable an effect without removing its settings.
- Reorder processing with drag and drop or accessible earlier/later buttons.
- Remove processing nodes from the graph.
- Clicking an effect node selects and scrolls to the same effect card in the full Inspector.
- Selecting an effect card also highlights its graph node.

## Workspace behavior

- Nodes is the fourth tab in the Layers / Assets / Masks workspace.
- The complete workspace can already be docked, floated, dragged, resized, shown or hidden, and stored in named workspace layouts.
- The graph uses horizontal scrolling when docked and expands into a wide left-to-right chain when floated.
- `Shift+N` and Effects → Open Node View reveal the graph without adding controls to the crowded timeline.

## Project compatibility

- No node positions or duplicate graph schema are written to `.horizon.json`.
- Effect order, enabled state, parameters, animation, and audio routes remain the established portable project values.
- The graph therefore cannot drift from the renderer or export representation.
- Phase 13 intentionally represents the current linear per-layer compositor; arbitrary branching is reserved for a future graph-format revision.

## Verification

- All 25 automated tests pass.
- Static coverage verifies the complete Node View surface and fourth workspace tab ship in the desktop build.
- Electron smoke opens Nodes, adds Bloom and Outline, reorders them to Outline → Bloom, disables Outline, selects it into the Inspector, and floats the graph workspace.
- The smoke confirms Source / FX / Output nodes, three connectors, draggable effects, synchronized selection, matching autosaved order, and no WebGL or browser errors.
- Visual capture: `test-output/phase13-node-view.png`.
