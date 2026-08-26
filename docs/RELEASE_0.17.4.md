# Data Horizon Studio 0.17.4

Data Horizon Studio 0.17.4 adds extractable, audio-reactive effect layers, beginning with Outline.

## Highlights

- Move an Outline effect into its own ordinary editable layer above the source.
- Preserve the original image and shared asset while giving the result independent opacity, blend, transform, depth, parallax, masks, effects, audio, and animation.
- Edit Outline color, strength, threshold, thickness, softness, and composite/isolated output.
- Add a Mids-to-strength music assignment in one click and refine every modulation setting in the full Audio Assignments editor.
- Combine multiple audio sources on the new layer or its effect parameters.
- Use the same rendering path in Studio, Live View, Quartic Pulse, Tempest Broadcast, OBS, and exported bundles.

## Compatibility

The project schema remains version 1. Earlier Outline effects normalize to the expanded 0.17.4 contract when opened. Existing projects, presets, linked compositions, and published targets remain supported.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.4-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.4-win32-x64-release.zip`
- ZIP entries: 87
- SHA-256: `825944ECEDBC4F2F497BAFA2C9F6398EE0F95444C7C219F599236A4C679086D9`

The package is verified with all 32 automated tests and the Electron/WebGL2 extraction smoke workflow.
