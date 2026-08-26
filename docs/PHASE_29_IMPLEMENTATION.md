# Phase 29: Canvas Motion Paths

Phase 29 brings spatial animation onto the canvas so Position X and Position Y no longer need to be coordinated as unrelated numeric tracks.

## Spatial path overlay

When the selected layer has either Position X or Position Y animation, the Move workspace displays an easing-accurate dashed trajectory over the artwork. The path samples the same shared Timeline evaluator used for rendering, so Linear, Ease In, Ease Out, Smooth, Bounce, and Hold motion are represented by the actual route the layer follows.

- Every unique X/Y key time becomes a draggable spatial point.
- Labels identify each point's Timeline time.
- A cyan marker follows the layer's evaluated position as the playhead moves.
- The Motion toolbar toggle hides or reveals spatial authoring without altering the animation.

## Paired position keys

The + Key canvas action records Position X and Position Y together at the current playhead. When either track does not exist, Data Horizon preserves the authored position at time zero before writing the requested point.

Dragging a motion point updates or creates both axis keys in one undoable project operation. The affected keys become the Timeline selection and Position X is revealed in the Curve editor, keeping canvas, curve, numeric, and key-track editing synchronized.

## Snapping and compatibility

Motion points use existing canvas snapping for the horizontal center, vertical center, and canvas edges. Timeline frame snapping continues to control the point time.

Motion paths introduce no new project data type. They author ordinary Position X/Y animation tracks, so Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, presets, linked compositions, and export all retain the same committed result.

## Verification

- 36 automated tests pass.
- Electron/WebGL2 smoke coverage creates paired tracks, renders three spatial points and a 97-sample path, drags a point, synchronizes two selected keys, and reports no browser or renderer errors.
- Visual reference: `test-output/phase29-motion-paths.png`.
