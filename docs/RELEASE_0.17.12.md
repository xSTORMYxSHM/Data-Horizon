# Data Horizon Studio 0.17.12

Data Horizon Studio 0.17.12 delivers the Phase 28 curve editor and automation-cleanup workflow.

## Added

- Switchable Key Tracks and Curves Timeline views.
- Easing-accurate curve visualization with value range, time grid, work area, and live playhead.
- Horizontal time and vertical value dragging for one or multiple selected points.
- Project-frame snapping with an optional Free Time mode.
- Keyframe copy/paste at the playhead, including Ctrl+C and Ctrl+V.
- Reduce Keys with 1%, 2%, and 5% tolerances for linear recorded automation.

## Compatibility

The project schema remains version 1. Curve view, frame snapping, clipboard state, and work-area display are editor controls. Reduce Keys produces ordinary project keyframes, so Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and export continue to share identical committed animation.

## Verification

- 36 automated tests pass.
- The Electron/WebGL2 smoke workflow renders the curve editor, moves curve points, pastes frame-aligned keys, and reduces an 11-key driver recording to 5 keys with no browser or renderer errors.
- Visual reference: `test-output/phase28-curve-editor.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.12-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.12-win32-x64-release.zip`
- Archive entries: 87
- Archive size: 138,313,605 bytes
- SHA-256: `02D9505D82B2858E5548E73A5BF05C1D8B9B9124B59EB7CD2ADC4368FA76617C`

The unpacked application also completed the full Electron/WebGL2 curve-editor smoke workflow from the packaged executable.
