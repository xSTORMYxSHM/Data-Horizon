# Data Horizon Studio 0.17.17

Data Horizon Studio 0.17.17 delivers Phase 33 canvas marquee selection.

## Added

- Direct drag selection from the Move-tool canvas.
- Fully Enclosed and Touching geometry modes.
- Current-playhead transform evaluation for marquee hit testing.
- Live matching-layer count inside the marquee.
- Shift-drag additive selection.
- Alt-drag subtractive selection.
- Ctrl-drag toggle selection.
- Distinct visual states for replace, add, subtract, and toggle operations.
- Pointer routing compatible with canvas transforms, panning, painting, paths, rulers, and guides.

## Compatibility

The project schema remains version 1. Marquee settings and selections are Studio-only state, so projects and every shared renderer/export target remain unchanged.

## Verification

- 37 automated tests pass.
- The Electron/WebGL2 workflow verifies both geometry modes, every modifier operation, live feedback, release cleanup, and zero browser or renderer errors.
- Visual reference: `test-output/phase33-canvas-marquee.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.17-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.17-win32-x64-release.zip`
- Archive entries: 91
- Archive size: 138,519,572 bytes
- SHA-256: `9336CC4C4C69008664D48CE3893F29A1FE1D840756C6528A5DBC9AEC26450D04`

The unpacked application completed the full Electron/WebGL2 Phase 33 workflow from the packaged executable.
