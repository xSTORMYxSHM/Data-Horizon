# Phase 3: Canvas Workflow and Region Masks

This phase turns the central preview into a practical graphics-editor canvas and adds the first semantic masking workflow.

## Canvas workflow

- Fit, 25%, 50%, 75%, 100%, 150%, and 200% zoom controls.
- Ctrl/Cmd + mouse wheel zoom stepping.
- Space + primary-button or middle-button canvas panning.
- Toggleable composition grid, center guides, and title-safe boundary.
- Canvas-edge and center snapping while moving and resizing elements.
- A direct rotation handle with 15-degree snapping.

## Region masks

- New non-destructive `regionMask` render pass.
- One-click Sky, Horizon, Terrain, and Foreground presets.
- Editable top, bottom, feather, and invert parameters.
- Every mask parameter is exposed to the same audio-assignment system as other effect values.
- Masks serialize with the project and run unchanged in Studio, Live View, Quartic Pulse bundles, and Tempest Broadcast bundles.

The current implementation uses vertical semantic regions. Painted masks and image-derived depth segmentation remain future authoring tools; they can be added without changing the layer/effect contract.

## Verification

- 15 automated tests pass across the project model, modulation engine, renderer registry, export runtime, and desktop shell.
- Electron smoke fixture: WebGL2 active, one asset, five mixed layer types, 12 render passes, 17 draw calls, and no renderer error.
- Smoke interactions verify layer duplicate/undo, 50% manual zoom, guide toggling, snap toggling, and publish-dialog contents.
- Visual capture: `test-output/phase3-canvas-masks.png`.
