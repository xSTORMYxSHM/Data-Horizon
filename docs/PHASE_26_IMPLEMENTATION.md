# Phase 26: Auto Key and Animated Effect Presets

Phase 26 makes animation authoring visible and immediate instead of requiring a manual keyframe workflow for every change.

## Auto Key recording

Auto Key is available in both the Timeline and Effects inspector. While it is active, editing any supported property writes a keyframe at the current playhead instead of replacing the static authored value.

Supported controls include:

- Every numeric effect parameter.
- Layer opacity, depth, and parallax.
- X, Y, width, height, and rotation fields.
- Direct canvas move, resize, and rotation gestures.

When a parameter has no existing animation track and the playhead is later than zero, Data Horizon automatically preserves the original authored value as a baseline key at time zero before writing the new key. The edited target becomes the selected Timeline parameter and the change remains one undoable project operation.

## Animated effect presets

Every built-in effect-stack preset now offers three motion modes:

- **Gentle Loop** creates a restrained looping animation and begins playback immediately.
- **Strong Loop** creates a wider, more visible loop.
- **Static** inserts only the editable effect stack.

The motion generator chooses up to two useful parameters from the inserted stack, writes start, midpoint, and end keys across the composition duration, selects the first animated target, and starts the Timeline. Audio Pulse Outline can combine its Timeline motion with its Mids and Beat drivers because both systems use the same shared render path.

## Visible parameter state

Effect headers now display activity badges:

- `◆` counts Timeline tracks.
- `♫` counts enabled music drivers.
- `TIME` marks effects such as scanlines and displacement that move continuously from a speed parameter.

Animated and audio-reactive parameter labels are marked individually. Their sliders and numeric outputs follow the evaluated live result during playback, including the combined Timeline and audio value, so the inspector matches what the canvas is rendering.

Auto Key recording state is stored as an editor preference. Project animation data remains ordinary schema-versioned Timeline tracks and therefore renders identically in Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and export.
