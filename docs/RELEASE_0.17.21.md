# Data Horizon Studio 0.17.21

Data Horizon Studio 0.17.21 delivers Phase 37 named layer selection sets and hierarchy-aware Solo/Restore.

## Added

- Project-portable named layer selection sets.
- Deterministic tree-order storage for multi-layer selections.
- Exact selection recall with filter clearing and ancestor expansion.
- Compact Save, Recall, and Delete controls in the Layer Navigator.
- Solo selected layers while retaining the group hierarchy required to render them.
- Restore of the exact pre-Solo visibility state.
- Automatic selection-set cleanup when referenced layers are deleted.
- Undo and Redo support for set deletion and Solo visibility changes.

## Compatibility

The project schema remains version 1. Older projects normalize the optional selection-set collection to an empty list. Shared live, OBS, Quartic Pulse, Tempest Broadcast, and export rendering remain unchanged.

## Verification

- 39 automated tests pass.
- The Electron/WebGL2 workflow verifies selection-set ordering, Save, Recall, Delete, Solo, Restore, Undo, and Redo in a 40-layer, 9-group composition with zero browser or renderer errors.
- Visual reference: `test-output/phase37-layer-selection-sets.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.21-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.21-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,554,453 bytes
- SHA-256: `D10C879C8471798099865B3983204258E84C869F07B5077C5C23029D7D321292`

The unpacked application completed the full Phase 37 Electron/WebGL2 workflow from the packaged executable.
