# Data Horizon Studio 0.17.5

Data Horizon Studio 0.17.5 adds direct non-destructive painting and erasing on extracted effect layers.

## Highlights

- Paint new colored details into an extracted Outline result.
- Erase unwanted parts of the generated effect layer without touching the original image.
- Adjust brush size, softness, opacity, and color.
- Preserve ordered paint/erase behavior so later paint can restore erased areas.
- Undo the latest stroke, clear all retouching, or disable the complete pass.
- Duplicate, save, import, animate, audio-modulate, and publish the retouched layer normally.
- Render identically in Studio, Live View, Quartic Pulse, Tempest Broadcast, OBS, and exports.

## Compatibility

The project schema remains version 1. Existing projects normalize to engine version 0.17.5. Projects without Paint / Erase data are unchanged.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.5-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.5-win32-x64-release.zip`
- ZIP entries: 87
- SHA-256: `1C7F454E05FCC031276937FF9844667BB0116DB0D5F062F32D9983B13B59D502`

The package is verified with all 33 automated tests and the Electron/WebGL2 paint-and-erase smoke workflow.
