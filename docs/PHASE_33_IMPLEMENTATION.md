# Phase 33: Canvas Marquee Selection

Phase 33 makes dense compositions selectable directly from the artwork instead of requiring every multi-selection to begin in the Layers panel.

## Drag selection

Dragging an empty region of the canvas with the Move tool creates a visible magenta marquee. Its label reports the active selection operation and live number of matching layers. The existing selection remains unchanged during the drag and updates only when the pointer is released.

A movement threshold separates clicks from drags, so ordinary canvas auto-selection remains reliable. Space-drag panning, mask painting, path authoring, transform handles, rulers, and custom guides keep their existing pointer priority.

## Geometry modes

Move Tool options provide two modes:

- **Fully enclosed** selects layers whose complete evaluated bounds are inside the marquee. This is the default and avoids unintentionally selecting full-canvas background layers.
- **Touching selection** selects every layer whose evaluated bounds intersect the marquee.

Bounds include the current Timeline-evaluated position, size, and rotation. A moving or rotating layer is therefore selected according to what the user sees at the current playhead.

## Selection modifiers

The canvas follows familiar graphics-editor modifiers:

- Drag with no modifier to replace the selection.
- Shift-drag to add matching layers.
- Alt-drag to subtract matching layers.
- Ctrl-drag to toggle matching layers.

The marquee color and label identify the active behavior. The same Ctrl toggle behavior remains available for single canvas clicks.

## Compatibility

Marquee mode and the current selection are Studio editor state. Phase 33 adds no project fields, changes no schema, and has no effect on Live View, OBS, Quartic Pulse, Tempest Broadcast, presets, linked compositions, or exported imagery.

## Verification

- 37 automated tests pass.
- Electron/WebGL2 smoke coverage creates three known canvas elements and verifies enclosed replacement, Shift-add, Alt-subtract, Ctrl-toggle, touching selection, live hit feedback, release cleanup, and zero browser or renderer errors.
- Visual reference: `test-output/phase33-canvas-marquee.png`.
