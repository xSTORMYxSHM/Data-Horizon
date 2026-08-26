# Phase 22: Eraser Correctness

Data Horizon Studio 0.17.6 fixes erased pixels remaining visible on isolated, screen-blended Outline layers.

## Root cause

The Paint / Erase pass correctly reduced alpha, but the Screen blend path used source RGB without weighting it by that alpha. An erased pixel could therefore retain invisible cyan color data and still brighten the composition. Before extraction, retouching also operated on the combined source image and Outline rather than targeting the effect independently.

## Renderer fix

- Isolated Outline output now writes zero RGB when its alpha is zero.
- Screen-blended layers premultiply their copy color by effective layer alpha.
- The Screen blend uses separate RGB and alpha factors, preserving the screen appearance while ensuring fully erased pixels contribute no color.
- Paint / Erase continues to clear both generated input and prior paint strokes.

## Workflow fix

Choosing **Paint / Erase** on an Outline that has not been extracted now automatically:

1. Creates a separate isolated Outline layer above the source.
2. Removes the Outline effect from the source layer.
3. Adds a Paint / Erase pass to the extracted layer.
4. Selects the extracted layer and activates its brush.

The original image remains present and untouched. Choosing Paint / Erase on an already extracted Outline continues directly into retouching.

## Verification

- Desktop coverage checks the automatic-extraction affordance and alpha-aware blend path.
- Electron smoke coverage verifies the source remains, the source Outline is removed, the new Outline is isolated, Paint / Erase is ready, and WebGL2 reports no error.
- A painted-and-erased fixture is captured in `test-output/phase21-layer-retouching.png`; the erased center contributes neither color nor alpha.
