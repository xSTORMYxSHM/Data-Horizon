# Data Horizon Studio 0.17.11

Data Horizon Studio 0.17.11 delivers the Phase 27 animation editing workspace.

## Added

- Multi-key selection, marquee selection, group dragging, numeric time/value editing, duplication, and deletion.
- Linear, Ease In, Ease Out, Ease In/Out, Bounce, and Hold interpolation.
- Per-track Mute and editor-preview Solo controls.
- Selected Layer / All Animated track filtering and animation-target reveal links.
- A visible playhead on every track and adjustable work-area In/Out looping.
- Adjustable effect-preset cycle length and non-committing preset preview.
- Recording of live music-driver output into normal editable Timeline keys.

## Fixed

- Docked Timeline placement is now deterministic when the contextual paint bar is hidden, so the animation editor remains visible in custom workspaces and at scaled UI sizes.
- Audio recording button state updates immediately when capture starts or stops.

## Compatibility

The project schema remains version 1. Older tracks load enabled by default, and older easing values remain valid. Muted tracks and the new easing modes use the same project evaluator in Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and export.

## Verification

- 35 automated tests pass.
- The Electron/WebGL2 smoke workflow covers animation editing, preset preview, and music-driver baking with no browser or renderer errors.
- Visual reference: `test-output/phase27-animation-editor.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.11-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.11-win32-x64-release.zip`
- Archive entries: 87
- Archive size: 138,301,148 bytes
- SHA-256: `926D7841E09CFD3F9806A867859F86C011D5FE25E369C0C8434A1F9B71CC8CD1`

The unpacked application also completed the full Electron/WebGL2 smoke workflow from the packaged executable.
