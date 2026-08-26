# Phase 21: Layer Retouching

Data Horizon Studio 0.17.5 makes extracted effect results directly paintable and erasable while preserving the original source and the generated effect stack.

## Workflow

1. Extract an Outline into its own layer.
2. Choose **Paint / Erase** on the Outline card.
3. Select Paint or Erase in the brush options.
4. Adjust brush size, softness, and opacity.
5. Choose the Paint color with the foreground color well.
6. Brush directly over the transformed layer on the canvas.
7. Undo the latest stroke, clear all retouching, or disable/remove the Paint / Erase pass at any time.

Paint adds new colored material even where the generated outline did not exist. Erase removes pixels from the complete generated result, including the outline beneath the retouch pass. Later paint strokes can restore areas erased earlier.

## Project model

- Added a native `paintLayer` effect containing ordered paint/erase strokes.
- Each stroke stores mode, normalized transformed points, diameter, softness, opacity, and six-digit HEX color.
- Normalization supplies safe defaults for older or incomplete data.
- Validation rejects malformed modes, colors, or points.
- Layer duplication and preset insertion generate fresh stroke IDs while preserving authored retouching.
- Paint / Erase opacity remains available to animation and audio modulation.

## Shared renderer

The WebGL2 renderer generates ordered color and erase textures from the stroke list. Repainting clears the erase mask under the new stroke; erasing removes both earlier paint and the generated input. A final GPU pass composites the retouched result with correct alpha.

Studio, Live View, Quartic Pulse, Tempest Broadcast, OBS browser sources, and exported packages all use this same renderer path.

## Verification

- Model tests cover paint/erase storage, validation, normalization, audio targeting, duplication, and fresh stroke IDs.
- Renderer tests cover the native Paint / Erase effect registry.
- Desktop tests cover brush opacity and retouch controls.
- Electron smoke testing paints a magenta stroke, erases through it, verifies ordered modes and undo availability, confirms clean WebGL2 rendering, and captures `test-output/phase21-layer-retouching.png`.
