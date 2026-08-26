# Data Horizon Studio 0.17.16

Data Horizon Studio 0.17.16 delivers Phase 32 rulers and project guides.

## Added

- Zoom-aware horizontal and vertical canvas rulers.
- Project-pixel tick labels that remain accurate under canvas and application scaling.
- Ruler-drag guide creation.
- Exact numeric horizontal and vertical guide placement.
- Direct guide dragging with coordinate feedback.
- Drag-outside removal and one-step Clear Guides.
- Persistent guide locking and guide visibility controls.
- Transform snapping against saved guide positions.
- Schema-version-1 normalization for legacy projects without guide metadata.

## Compatibility

The project schema remains version 1. Existing projects receive an empty, unlocked guide collection when opened. Guides are non-rendering Studio metadata and do not alter Live View, OBS, Quartic Pulse, Tempest Broadcast, presets, linked compositions, or offline export imagery.

## Verification

- 37 automated tests pass.
- The Electron/WebGL2 workflow verifies numeric and ruler-drag creation, repositioning, locking, adaptive ruler ticks, guide-aware snapping, live feedback, and zero browser or renderer errors.
- Visual reference: `test-output/phase32-rulers-guides.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.16-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.16-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,515,317 bytes
- SHA-256: `1E1483A080796D6D8BDC823D8224E8AF117D14106DE8E2B67B38D85E1FDA9A33`

The unpacked application completed the full Electron/WebGL2 Phase 32 workflow from the packaged executable.
