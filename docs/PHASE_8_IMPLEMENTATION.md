# Phase 8: Painted Masks

Phase 8 adds direct, non-destructive mask painting to Data Horizon Studio. Painted masks are part of the same ordered effect stack used by Studio, Live View, Quartic Pulse, Tempest Broadcast, and published bundles.

## Portable mask model

- Painted masks are stored as normalized vector brush strokes rather than destructive edits to the source image.
- Every stroke stores ordered points, Hide or Reveal mode, relative diameter, softness, and opacity.
- A mask can begin with Reveal All or Hide All as its base state.
- Mask strokes survive layer duplication with refreshed identifiers.
- Older projects normalize safely; projects without painted masks are unchanged.

## Canvas painting

- The new Mask tool creates or activates a painted mask on the selected layer.
- Hide removes the selected layer from brushed areas; Reveal restores it.
- Brush diameter ranges from 8 to 600 project pixels.
- Softness ranges from a hard edge to a fully feathered radial brush.
- Painting is transformed into the selected layer's local coordinates, including position, scale, and rotation.
- Space-drag canvas panning remains available while the Mask tool is active.
- A live circular cursor shows the current diameter and distinguishes Hide from Reveal mode.

## Effect and mask controls

- Painted Mask can be inserted from the effect stack, Effects menu, Toolbox, or Masks dock.
- The effect card provides Edit Mask on Canvas, Undo Stroke, Reveal All, and Hide All.
- Effect opacity and inversion remain non-destructive parameters and can receive audio modulation or timeline animation.
- The Masks dock discovers painted, luminance, and semantic region masks and opens the correct editing mode.
- Global Undo/Redo treats each completed brush stroke as one reversible project edit.

## Shared rendering

- The renderer rasterizes normalized strokes into a cached GPU mask texture.
- Soft Hide and Reveal stamps compose in stroke order.
- Mask opacity and inversion are evaluated in the shared WebGL2 effect pass.
- Unused generated textures are released when masks or layers are removed.
- No separate Studio-only mask path exists, preserving live/export parity.

## Verification

- All 20 automated tests pass.
- Model tests cover creation, validation, legacy normalization, and duplication.
- Renderer registry tests cover the Painted Mask pass and parameters.
- Electron smoke creates a mask, drives a real mouse stroke through the canvas, verifies serialized points, and confirms an error-free render.
- Visual capture: `test-output/phase8-painted-mask.png`.
