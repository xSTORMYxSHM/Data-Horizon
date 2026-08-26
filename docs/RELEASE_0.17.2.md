# Data Horizon Studio 0.17.2

Data Horizon Studio 0.17.2 adds complete editable composition reuse.

## Highlights

- Import another `.horizon.json` project as a grouped editable element.
- Insert an installed Tempest Asset Vault element directly into the current composition.
- Preserve the imported layer tree, assets, effects, masks, audio assignments, keyframes, and authored background.
- Fit compositions across different canvas sizes while keeping animation and audio transform ranges aligned.
- Generate fresh internal IDs on every insertion so elements can be combined repeatedly.

## Compatibility

The project schema remains version 1. Earlier projects normalize to engine version 0.17.2 when opened. Published Quartic Pulse and Tempest Broadcast bundles continue to use the shared 0.17 runtime contract.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.2-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.2-win32-x64-release.zip`
- ZIP SHA-256: `E387A4010CCF733E9BD7E00C38E76BCD9AC441F7DF94D7324FDDF9EE213D59EC`

The final archive contains 87 entries and was inspected for the 0.17.2 manifest, executable, shared renderer, Phase 18 interface, project-import IPC, and Vault-import IPC. All 30 automated tests and the Electron smoke workflow pass.
