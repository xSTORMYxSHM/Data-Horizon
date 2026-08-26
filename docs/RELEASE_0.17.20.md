# Data Horizon Studio 0.17.20

Data Horizon Studio 0.17.20 delivers Phase 36 Layer Navigator tools for dense compositions.

## Added

- Persistent per-project group disclosure arrows.
- Collapse All and Expand All controls.
- Layer name, type, effect-name, and effect-type search.
- Ancestor-aware nested search results.
- Visible, Hidden, Locked, Has Effects, Music Driven, Animated, and Groups filters.
- Direct-match and total-layer status counts.
- Clear zero-result feedback.
- Reveal Selected with ancestor expansion and scroll-to-row behavior.
- `/` shortcut to focus Layer search.
- Escape clearing while using Layer search.

## Compatibility

The project schema remains version 1. Navigator state is Studio-local and has no effect on shared rendering or export formats.

## Verification

- 38 automated tests pass.
- The Electron/WebGL2 workflow verifies the complete Navigator against a 40-layer, 9-group composition with zero browser or renderer errors.
- Visual reference: `test-output/phase36-layer-navigator.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.20-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.20-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,538,955 bytes
- SHA-256: `5E47307915064F302A050EFBB5BA3299F3941AF3C8305565FA44153AA0E4C81C`

The unpacked application completed the full Phase 36 Electron/WebGL2 workflow from the packaged executable.
