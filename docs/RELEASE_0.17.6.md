# Data Horizon Studio 0.17.6

Data Horizon Studio 0.17.6 fixes Outline erasing before and after effect extraction.

## Fixed

- Erased cyan lines no longer remain visible through Screen blending.
- Fully erased isolated pixels now contribute neither RGB nor alpha.
- Screen-blended effect layers preserve their intended bright appearance with alpha-correct composition.
- Paint / Erase automatically extracts a composite Outline before retouching it.
- The source image remains untouched while the new outline-only layer receives the brush edits.

## Compatibility

The project schema remains version 1. Existing 0.17.5 Paint / Erase strokes load normally and render with the corrected alpha behavior.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.6-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.6-win32-x64-release.zip`
- Archive entries: 87
- SHA-256: `F70C85B201C5DB8BF6BDD23893B36B13765D5541E9216204569894110D858003`

Verified with 33 automated tests plus the Electron/WebGL2 eraser smoke workflow. The packaged application contains the executable, main process, renderer, automatic Outline extraction, Paint / Erase layer support, and alpha-correct Screen composition.
