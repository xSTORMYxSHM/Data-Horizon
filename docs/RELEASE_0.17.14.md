# Data Horizon Studio 0.17.14

Data Horizon Studio 0.17.14 delivers Phase 30 multi-layer layout.

## Added

- Ctrl-click layer toggling and Shift-click range selection.
- Clear primary and secondary selection states in the Layers panel.
- Canvas or selection-relative alignment on six edges and centers.
- Even horizontal and vertical distribution for three or more layers.
- Direct canvas movement of selected layer groups.
- Auto Key support for synchronized multi-layer position edits.
- Persistent per-layer locking with batch Lock/Unlock controls.
- Lock-aware Inspector, canvas transform, delete, order, group, align, and distribute operations.

## Compatibility

The project schema remains version 1. Existing projects without a lock field normalize every layer to unlocked. Multi-selection remains Studio-only editor state, while alignment, distribution, and group movement author ordinary layer transforms shared by Live View, OBS, Quartic Pulse, Tempest Broadcast, presets, and offline export.

## Verification

- 36 automated tests pass.
- The Electron/WebGL2 smoke workflow verifies multi-selection, canvas alignment, vertical distribution, group movement, persistent locking, disabled editing controls, and zero browser/renderer errors.
- Visual reference: `test-output/phase30-multi-layer-layout.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.14-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.14-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,407,869 bytes
- SHA-256: `16324FB4FE103F3C8C3E95F6A70D4D3F636DB276285D13C2829747DCC94B3994`

The unpacked application completed the full Electron/WebGL2 Phase 30 smoke workflow from the packaged executable.
