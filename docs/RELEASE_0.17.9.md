# Data Horizon Studio 0.17.9

Data Horizon Studio 0.17.9 introduces Phase 25 effect-stack presets and scroll-stable editing.

## Added

- Comic Ink effect preset.
- Isolated Neon Edge effect preset.
- Dream Glow effect preset.
- CRT Signal effect preset.
- Heat Distortion effect preset.
- Audio Pulse Outline preset with two live music drivers.

## Fixed

- Ordinary Inspector changes no longer scroll the panel back to the top.
- Layer, Asset, Mask, Node, Preset, Vault, and Timeline lists retain their positions across rerenders.
- Applying or undoing a preset preserves the current Effects location.

## Compatibility

The project schema remains version 1. Effect presets create the same native effect and parameter-binding records used by existing projects, Live View, OBS, Quartic Pulse, Tempest Broadcast, and offline export.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.9-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.9-win32-x64-release.zip`
- Archive entries: 87
- SHA-256: `D61352C4BFC91C8A65ECBA3A3DC327CA6988E4864E6A1984371E78216CFEBF5A`

Verified with 34 automated tests plus the Electron/WebGL2 effect-preset and scroll-stability workflow. The packaged application contains all six presets, editable audio-preset drivers, scroll restoration, the Audio Driver Lab, the Clip Studio-style paint workspace, and the shared live/export renderer.
