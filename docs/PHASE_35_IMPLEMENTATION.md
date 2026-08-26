# Phase 35: Layer-Tree Drag and Drop

Phase 35 replaces button-only layer ordering with direct graphics-editor organization in the Layers panel.

## Drop positions

Every unlocked layer row is draggable. The pointer position over a destination selects one of three contextual operations:

- The upper edge inserts the dragged roots above the destination.
- The lower edge inserts them below the destination.
- The center of an editable group moves them inside that group at the top of its child stack.

Dropping over empty layer-tree space moves the selection to the bottom of the root stack. Cyan insertion lines identify above and below targets, while an inside-group target receives a violet framed highlight.

## Multi-layer movement

Dragging any row in the current multi-selection moves every independent unlocked selection root as one ordered set. If a group and one of its descendants are both selected, the group moves once and carries the descendant with it. The original visual stack order is preserved even when roots come from different containers.

Dragging an unselected row moves only that row, matching common Photoshop and GIMP behavior without requiring an extra selection click.

## Safety

The immutable project-model relocation command prevents a group from being dropped into itself or one of its descendants. Locked layers and locked destinations reject moves. Linked-composition groups reject inside drops until they are detached, preventing edits that a future source refresh would overwrite.

Effects, masks, image assets, audio bindings, Timeline tracks, IDs, and authored transforms remain attached because relocation moves existing layer objects rather than cloning or flattening them. Each completed drop is one history operation and can be undone or redone.

## Compatibility

Phase 35 adds no project fields and does not alter the renderer. Saved projects, presets, Asset Vault packages, Live View, OBS, Quartic Pulse, and Tempest Broadcast remain schema-version-one compatible.

## Verification

- 38 automated tests pass.
- Project-model coverage verifies immutable reordering, cross-container multi-root moves, preserved ordering, nesting-cycle prevention, and locked-layer rejection.
- Electron/WebGL2 coverage performs real Chromium drag events, verifies inside-group and above-target feedback, moves two selected roots together, moves a root to stack bottom, and confirms Undo restoration with zero browser or renderer errors.
- Visual reference: `test-output/phase35-layer-drag-drop.png`.
