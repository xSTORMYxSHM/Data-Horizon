# Data Horizon Studio 0.17.15

Data Horizon Studio 0.17.15 delivers Phase 31 shared group transforms.

## Added

- One combined canvas box for multi-layer selections.
- Proportional shared-bounds position and size scaling.
- Group rotation around the shared selection center.
- 15-degree group rotation snapping.
- Auto Key recording for every transform changed by a group operation.
- Smart snapping to canvas and nearby visible-layer edges and centers.
- Live magenta horizontal and vertical alignment guides.
- In-selection movement, size, angle, and layer-count feedback.
- Parent-aware selection transforms that avoid double-transforming group children.

## Compatibility

The project schema remains version 1. Phase 31 writes ordinary layer transforms and existing animation targets, so saved projects, presets, linked compositions, Live View, OBS, Quartic Pulse, Tempest Broadcast, and offline export retain the same committed result.

## Verification

- 36 automated tests pass.
- The Electron/WebGL2 workflow verifies three-layer scaling, arrangement-preserving rotation, smart-guide snapping, transform feedback, guide cleanup, and zero browser or renderer errors.
- Visual reference: `test-output/phase31-group-transforms.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.15-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.15-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,494,611 bytes
- SHA-256: `D6A29ECA1E9530969BC93BE6189495D948B4AB6727E38EE78BCD6DBCD58E0951`

The unpacked application completed the full Electron/WebGL2 Phase 31 workflow from the packaged executable.
