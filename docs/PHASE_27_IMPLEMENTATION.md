# Phase 27: Animation Editing Workspace

Phase 27 turns the Timeline from a keyframe display into a practical animation editor and makes audio-driven motion reusable as normal animation data.

## Keyframe editing

- Click a key to select it, Ctrl-click to build a multi-selection, or drag an empty rail area to marquee-select keys.
- Drag any selected key to move the entire selection while preserving its relative timing.
- Edit selected keys numerically with Time, Value, and Easing controls.
- Duplicate selected keys one frame forward or backward and delete them without affecting unrelated tracks.
- Choose Linear, Ease In, Ease Out, Ease In/Out, Bounce, or Hold interpolation.

Track rows now expose Mute and Solo preview controls, a playhead on every rail, a Selected Layer / All Animated filter, and clickable animation badges that reveal the matching track from the Effects inspector.

## Work area and effect previews

The adjustable Timeline work area provides In and Out points for focused looping while authoring. It also constrains reference-song Timeline synchronization. This is an editor preview range and does not truncate the exported composition.

Effect-stack presets now have an adjustable cycle length and a non-committing Preview action. Preview renders the proposed stack and motion without changing the project, autosave, or undo history. Apply Preset commits the same editable effects and Timeline tracks.

## Recording music drivers

Record Drivers to Keys samples enabled music assignments on the selected layer at 15 frames per second. It can record a loaded reference song, generated test audio, or live host modulation. Stopping the recording replaces keys only inside the captured range and commits the result as one undoable operation.

The baked result consists of ordinary linear animation keys. Users can then reduce, move, retime, ease, mute, or combine those keys with other animation exactly like hand-authored motion.

## Shared runtime behavior

Track enable state and the expanded easing modes are part of the shared project model. Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and exported bundles therefore evaluate committed animation identically. Solo and work-area controls remain intentionally local to the editor preview.

## Verification

- 35 automated model, audio, export, renderer, and desktop tests pass.
- Electron/WebGL2 smoke coverage exercises preset preview, key selection, Bounce easing, duplication, group dragging, mute/solo, work-area looping, track filtering, and music-driver recording.
- The smoke records 11 editable driver keys and reports no browser or renderer errors.
- Visual reference: `test-output/phase27-animation-editor.png`.
