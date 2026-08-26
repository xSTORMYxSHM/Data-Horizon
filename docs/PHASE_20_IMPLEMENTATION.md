# Phase 20: Extractable Effect Layers

Data Horizon Studio 0.17.4 turns an image Outline effect into an independently editable and audio-reactive layer without rasterizing or changing the original media.

## Authoring workflow

1. Add Outline to an image, text, group, or other visual layer.
2. Tune strength, threshold, thickness, softness, color, and output mode in the effect card.
3. Choose **Extract to Layer** to move the effect into a new screen-blended layer above its source.
4. Add Bloom, Displacement, masks, grading, animation, or other effects to the extracted layer.
5. Choose **Add Music Driver** for a ready-made Mids-to-strength route, then edit its source, amount, direction, input range, smoothing, attack, and release in Audio Assignments.

The general Audio Assignments editor can add multiple music sources to strength, threshold, thickness, softness, layer opacity, transform, depth, parallax, or any additional numeric effect parameter.

## Project model

- Outline effects now carry optional HEX color and composite/isolated output metadata.
- Legacy outlines normalize with stable defaults for the new fields.
- `extractEffectToLayer` creates fresh layer/effect IDs, preserves the shared asset reference, transfers selected-effect routes, duplicates relevant transform animation, removes the effect from the source, and selects the new layer.
- Extracted linked groups are detached snapshots so their editable effect copy does not unexpectedly refresh from the source composition.

## Shared rendering

The common WebGL2 outline pass now supports adjustable sample thickness, edge softness, custom color, and transparent isolated output. Studio, Live View, Quartic Pulse packages, Tempest Broadcast packages, OBS browser sources, and exported runtimes continue to use this same implementation.

## Verification

- Model coverage verifies extraction, fresh IDs, effect transfer, audio-route remapping, transform-track duplication, output mode, color, and project validity.
- Renderer coverage verifies the expanded Outline parameter registry.
- Desktop coverage verifies the extraction and quick-audio controls ship in the isolated renderer.
- Electron smoke coverage creates an extracted Outline layer, confirms its source is preserved, confirms the source effect is removed, adds a Mids driver, renders the result on WebGL2, and captures `test-output/phase20-effect-layers.png`.
