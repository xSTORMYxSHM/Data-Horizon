# Phase 16: Tempest Asset Vault Bridge

Data Horizon Studio 0.17.0 can install and update authored elements directly in Tempest Broadcast's built-in Asset Vault.

## Studio workflow

- Select Tempest Broadcast in Publish.
- Choose the element kind and transparent-canvas behavior.
- Use **Install in Asset Vault** to write the element into the built-in Vault without choosing a folder.
- Republishing the same name updates the stable package rather than creating another indexed asset.

The default Vault root is `%APPDATA%/tempest-broadcast-system/control-deck/vault-elements`. Developers may override it with `DATA_HORIZON_ASSET_VAULT`.

## Stable Vault package

Each element is stored under `data-horizon/<slug>/` with:

- a unique `<slug>.html` entrypoint;
- `manifest.json` with a stable package ID and OVERLAY bank declaration;
- `project.horizon.json`, `project.js`, the shared renderer, and styles;
- `preview.png` and a readable installation record.

The unique entrypoint prevents the previous `Tempest Vault // index` source-name collision. The HTML declares `tempest-size` and a stable Data Horizon ID, allowing Broadcast to create the Browser Source at the authored canvas dimensions.

## Live audio behavior

Vault runtimes poll Broadcast's existing Signal Reactor telemetry file every 60 ms. Beat and RMS map directly. Until Broadcast exposes FFT bands, bass uses the desktop level, mids blend desktop and microphone levels, and highs use microphone/beat activity. Missing telemetry decays safely to zero.

## Broadcast discovery

The Asset Vault now watches configured roots and their subdirectories. File changes schedule a 650 ms debounced incremental rescan, and watcher paths refresh after indexing so newly created Data Horizon directories are included. Existing manual refresh and read-only folder indexing remain available.

## Verification

- 28 automated model, audio, export, render, and Studio tests pass.
- The Broadcast `TempestAssetVault` translation unit compiles successfully in RelWithDebInfo.
- Electron smoke publishes an isolated Vault element and verifies the stable filename, 1920 × 1080 metadata, package ID, OVERLAY bank, telemetry bootstrap, transparent output choice, and closed publish dialog.
- The complete smoke workflow reports no browser or renderer errors.
- Visual capture: `test-output/phase16-asset-vault.png`.
