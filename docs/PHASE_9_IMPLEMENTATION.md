# Phase 9: Animated Data Paths

Phase 9 adds native, editable data-flow paths to Data Horizon Studio. Paths are portable project layers rendered by the shared WebGL2 compositor, so Studio, Live View, Quartic Pulse, Tempest Broadcast, and published bundles all receive identical output.

## Native path layers

- A path stores between 2 and 32 normalized points in its own layer coordinate space.
- Path layers retain the standard visibility, opacity, blend mode, effects, masks, depth, parallax, and transform controls.
- Source properties include color, stroke width, glow, dash length, gap length, flow speed, and open/closed state.
- Layer duplication and project save/load preserve editable geometry without rasterizing it.

## Canvas authoring

- The new Path tool creates an animated path and enters direct-edit mode.
- Clicking inside the path layer bounds appends a point.
- Visible point handles can be dragged to reshape the path while its position, scale, and rotation are respected.
- Delete Last removes the newest point while preserving the two-point minimum.
- Finish returns to the Move tool and the normal transform controls.
- The editing overlay is separate from the rendered output and never appears in Live View or exports.

## Audio and animation

- Stroke Width, Glow, Dash Length, Gap Length, and Flow Speed are stable parameter targets.
- These properties can receive multiple audio bindings with the existing amount, direction, bounds, smoothing, attack, release, curve, and combine controls.
- The same properties are available to the keyframe timeline.
- Positive or negative Flow Speed changes the direction of the moving dash pattern.

## Shared rendering

- A dedicated WebGL2 source pass calculates distance to the authored polyline.
- The shader generates an anti-aliased core, glow falloff, and time-driven dash phase.
- Path geometry is transformed and composited through the same layer pipeline as all other native elements.
- Transparent pixels emit zero color intensity, preserving correct Screen and Add blend behavior.

## Verification

- All 21 automated tests pass.
- Model coverage verifies creation, schema validation, and every audio-addressable path parameter.
- Electron smoke creates a path, adds a point with a real canvas mouse event, drags a point handle, and verifies the serialized geometry changed.
- The smoke also confirms the Flow Speed target is exposed and the shared renderer reports no error.
- Visual capture: `test-output/phase9-animated-paths.png`.
