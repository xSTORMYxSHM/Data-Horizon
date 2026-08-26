# Phase 19: Linked Compositions

Data Horizon Studio 0.17.3 adds Photoshop-style smart groups for project and Tempest Asset Vault imports.

## Linked import behavior

- Project-file imports remember the selected `.horizon.json` source.
- Asset Vault insertions remember the managed Vault slug rather than a fragile absolute package path.
- Linked groups are identified in the layer tree and show their source in the Inspector.
- The resolved children remain visible and editable, so the shared renderer does not need a separate nested-runtime layer type.

## Inspector controls

The Source section for a linked group shows its source kind, display name, locator, source engine version, source revision, and last refresh time.

- **Refresh Source** rebuilds the resolved children from the latest source.
- **Reveal Source** opens the linked project or managed Vault entry on disk.
- **Detach** removes the link while keeping every resolved child as ordinary editable content. Undo restores the link.

## Refresh guarantees

Refreshing preserves the outer group's ID, name, transform, opacity, blend mode, depth, parallax, and group-level effects. Its previous child bindings, tracks, and exclusive assets are removed; the replacement children receive fresh IDs and their current assets, audio assignments, and keyframes are remapped into the destination project.

## Privacy and portability

Local link locators are authoring metadata saved in the Studio project. Exported layer presets, Quartic Pulse bundles, portable Tempest bundles, and Asset Vault runtimes contain only the fully resolved layers. Link metadata and local file paths are stripped before publishing.

## Verification

- Shared-model tests cover link validation, in-place refresh, outer-group preservation, child replacement, detach, preset stripping, and project stripping.
- Electron smoke verifies Vault linking, three Inspector actions, same-group refresh, fresh child IDs, detach, file linking, and clean Vault removal.
- Smoke also publishes a file-linked composition and confirms the generated runtime project contains resolved layers but no linked metadata or local path.
- Visual capture: `test-output/phase19-linked-compositions.png`.
