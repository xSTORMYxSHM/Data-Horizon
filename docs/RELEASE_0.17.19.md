# Data Horizon Studio 0.17.19

Data Horizon Studio 0.17.19 delivers Phase 35 layer-tree drag and drop.

## Added

- Direct layer-row dragging in the Layers panel.
- Above and below insertion targets with cyan line feedback.
- Inside-group targets with violet framed feedback.
- Empty-space drops to the bottom of the root stack.
- Ordered movement of multiple selected layer roots.
- Single-row dragging without a preliminary selection click.
- Automatic suppression of duplicate descendant movement.
- Nesting-cycle, locked-layer, locked-target, and linked-group protection.
- One-step Undo and Redo for every completed drop.

## Compatibility

The project schema remains version 1. Drag and drop reorganizes existing project layers without changing renderer or export contracts.

## Verification

- 38 automated tests pass.
- The Electron/WebGL2 workflow verifies actual drag events, all major placement modes, multi-root order preservation, and Undo with zero browser or renderer errors.
- Visual reference: `test-output/phase35-layer-drag-drop.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.19-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.19-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,532,382 bytes
- SHA-256: `4FE4A43533A34E4FF800662CE06B7FB6EBA859C5C16CD85ACD528C9BA2855C28`

The unpacked application completed the full Phase 35 Electron/WebGL2 workflow from the packaged executable.
