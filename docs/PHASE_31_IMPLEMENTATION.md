# Phase 31: Shared Group Transforms

Phase 31 turns the Phase 30 multi-selection into one directly manipulable canvas object while preserving the independent, non-destructive transform of every layer.

## Shared selection bounds

When multiple visible, unlocked layers are selected, Studio draws one axis-aligned box around their combined rotated bounds. The selection label reports the layer count and total dimensions. Selecting both a group and one of its children transforms the group only, preventing the child from receiving the same operation twice.

Locked layers remain selected but are excluded from the editable bounds. If the full selection is locked, the shared controls remain visibly blocked.

## Group scaling

Dragging a shared corner scales every selected unlocked layer around the opposite selection corner:

- Layer positions retain their proportional relationship inside the selection.
- Width and height scale independently on each axis.
- Individual layer rotations remain unchanged.
- The operation commits as one Undo step.

With Auto Key enabled, Studio records the changed X, Y, Width, and Height properties as ordinary animation keys for every affected layer.

## Group rotation

The shared rotation handle rotates every selected layer around the selection center. Layer positions follow the shared orbit while each authored rotation receives the same angular delta. Transform snapping rounds the delta to 15-degree increments.

Auto Key records Position X, Position Y, and Rotation edits for the affected layers, keeping Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and offline export identical.

## Smart guides and feedback

The new SMART canvas control enables snapping against:

- Canvas left, center, right, top, middle, and bottom.
- The rotated bounds and centers of every other visible layer.

Magenta guide lines identify the active horizontal and vertical match during movement or scaling. A transform readout remains inside the selection and reports movement delta, dimensions, rotation delta, and affected layer count. Guides and readouts clear immediately when the operation ends.

## Compatibility

Phase 31 adds no project fields and keeps schema version 1. It authors the same layer transforms and Timeline targets already supported by every renderer and export format.

## Verification

- 36 automated tests pass.
- Electron/WebGL2 smoke coverage selects three layers, scales their shared bounds, rotates their positions and angles, snaps the group to a smart guide, verifies live feedback and guide cleanup, and reports no browser or renderer errors.
- Visual reference: `test-output/phase31-group-transforms.png`.
