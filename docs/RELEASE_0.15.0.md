# Data Horizon Studio 0.15.0

Data Horizon Studio 0.15.0 promotes the complete shared renderer and portable authoring model consumed by Quartic Pulse 0.45.0.

## Release scope

- Seven native visual layer types plus nested groups.
- Shared deterministic timeline and audio-modulation evaluation across Studio, Live View, exported bundles, and Quartic Pulse.
- Portable four-role color palettes in Quartic visualizer packages.
- A reusable layer-preset library with isolated import/export and fresh-ID insertion.
- Non-destructive effects and masks, including painted and semantic region masks.
- Expert Node View, reference-song analysis, custom workspaces, advanced HUD text, animated paths, and interface scaling.

The project schema remains version 1. Existing projects normalize when opened and retain their layers, palettes, timeline, and effects. The application writes engine version 0.15.0 into new projects and published bundles.

The Quartic Pulse package target uses first-party Data Horizon runtime code and adds no third-party shader licenses.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.15.0-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.15.0-win32-x64-release.zip`
- ZIP size: 138,203,363 bytes
- SHA-256: `CD7878FEEFA1364749010E36914B3CFC2E5632363C741AF409BBB44D702A54EA`

The packaged application was checked for the 0.15.0 manifest, executable, shared renderer, Node View, and Presets workspace after the final desktop smoke run.
