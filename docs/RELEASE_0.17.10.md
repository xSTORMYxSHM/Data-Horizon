# Data Horizon Studio 0.17.10

Data Horizon Studio 0.17.10 introduces Phase 26 Auto Key recording, animated effect presets, and live parameter feedback.

## Added

- Mirrored Auto Key controls in the Timeline and Effects inspector.
- Automatic baseline and playhead keys for supported parameter edits.
- Auto Key support for effect sliders, core layer properties, numeric transforms, and direct canvas transforms.
- Gentle Loop, Strong Loop, and Static modes for all six built-in effect-stack presets.
- Immediate Timeline playback after applying a motion-enabled preset.
- Timeline, audio-driver, and inherently timed activity badges on effect cards.
- Live effect sliders and outputs that show the actual combined animation and music-driven result.

## Compatibility

The project schema remains version 1. Auto Key and animated presets create ordinary animation tracks and keyframes; no private editor-only animation format was introduced. Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and export continue to use the same renderer and evaluated values.

## Verification

- 34 automated tests pass.
- Electron/WebGL2 smoke coverage verifies that a playhead edit creates baseline and current-time keys, selects the new animation target, marks the parameter and effect, and preserves Effects inspector scroll position.
- Visual reference: `test-output/phase26-auto-keyframing.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.10-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.10-win32-x64-release.zip`
- Archive entries: 87
- Archive size: 138,278,670 bytes
- SHA-256: `0209F55423D68ED879FC6F9C60D429B307A891034C45690ACF5AFA26666ADAA9`

The unpacked application also completed the full Electron/WebGL2 smoke workflow from the packaged executable.
