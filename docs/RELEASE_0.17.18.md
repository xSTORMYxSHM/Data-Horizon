# Data Horizon Studio 0.17.18

Data Horizon Studio 0.17.18 delivers Phase 34 persistent cross-project layer clipboard support.

## Added

- Cut, Copy, Paste, and Paste in Place controls in the Layers panel.
- Matching Edit-menu and Layer-menu commands.
- Standard `Ctrl+X`, `Ctrl+C`, `Ctrl+V`, and `Ctrl+Shift+V` shortcuts.
- Single-root and multi-root clipboard payloads.
- Persistent clipboard availability across project changes and Studio sessions.
- Exact-coordinate Paste in Place and visibly offset ordinary Paste.
- Complete transport of nested groups, referenced images, effects, masks, music drivers, and Timeline tracks.
- Fresh-ID generation and dependency-target remapping on every paste.
- Safe detached snapshots when copying linked compositions.

## Compatibility

The project schema remains version 1. The clipboard is Studio-local state and adds no fields to saved projects or exported runtimes.

## Verification

- 37 automated tests pass.
- The Electron/WebGL2 workflow verifies cross-project persistence, exact and offset placement, fresh IDs, dependency restoration, Cut, and subsequent restoration.
- Visual reference: `test-output/phase34-layer-clipboard.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.18-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.18-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,525,417 bytes
- SHA-256: `AE7EC9E4C155DF383BA4A0446EABB8D6289DA3C9DBD06079420D87353A29EEAB`

The unpacked application completed the full Electron/WebGL2 Phase 34 workflow from the packaged executable.
