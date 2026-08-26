# Data Horizon Studio 0.17.3

Data Horizon Studio 0.17.3 adds linked compositions for reusable project and Asset Vault content.

## Highlights

- Imported projects and Vault elements become source-aware smart groups.
- Refresh resolved children without losing the outer group's placement or effects.
- Reveal the source or detach it into ordinary editable layers.
- Preserve current assets, audio assignments, animation tracks, and keyframes through refresh.
- Strip local source paths from presets and every published runtime.

## Compatibility

The project schema remains version 1. Earlier projects normalize to engine version 0.17.3 when opened. Projects saved by this build can include optional linked-composition authoring metadata; resolved layer content remains compatible with the existing shared renderer.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.3-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.3-win32-x64-release.zip`
- ZIP entries: 87
- SHA-256: `98EB7403C7962963A87574EE2C631218F17EDDDD793A7AB9B3413CA7EF6F2DF1`

The package is verified with all 31 automated tests and the Electron smoke workflow before release.
