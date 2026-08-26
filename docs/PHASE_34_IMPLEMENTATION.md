# Phase 34: Persistent Layer Clipboard

Phase 34 makes reusable composition work feel like a graphics editor: layers can be cut or copied in one project and pasted into another without flattening their editable behavior.

## Clipboard commands

The Layers panel and the Edit and Layer menus now provide Cut, Copy, Paste, and Paste in Place. The standard shortcuts are available:

- `Ctrl+X` cuts selected layer roots.
- `Ctrl+C` copies selected layer roots, while selected Timeline keys retain their existing keyframe-copy behavior.
- `Ctrl+V` pastes layers with a visible 24-pixel offset, while an active keyframe selection can still paste copied keys.
- `Ctrl+Shift+V` pastes layers at their original authored coordinates.

Multi-selection is supported. When both a group and one of its descendants are selected, only the independent group root is copied so the child is not duplicated twice.

## Portable dependencies

Each copied root uses Data Horizon's validated portable layer-preset contract. A clipboard item carries its complete nested layer tree together with referenced image assets, effects and painted data, parameter-level audio bindings, and Timeline tracks. Paste assigns fresh IDs and remaps every binding and track target to the inserted layers.

Linked compositions are copied as detached editable snapshots. This keeps authoring-only file or Asset Vault paths out of the persistent clipboard while preserving the resolved visual content.

## Persistence and placement

The clipboard is stored locally as `data-horizon.layer-clipboard` version 1 and survives project replacement and Studio restarts. The Layers panel reports the number of stored roots and their source project.

Paste in Place preserves exact transforms. Ordinary Paste offsets each operation by another 24 pixels so the new content is visibly distinguishable from its source. Cut updates the project through normal history, so it remains undoable, and leaves the removed content available for pasting.

## Compatibility

Phase 34 adds no project-schema fields and does not alter rendering. Live View, OBS, Quartic Pulse, Tempest Broadcast, project files, presets, and Asset Vault packages continue to use the same shared renderer and schema-version-one project model.

## Verification

- 37 automated tests pass.
- Electron/WebGL2 smoke coverage copies two roots, creates a blank project, restores them in place with fresh IDs, verifies image/audio/Timeline dependency remapping, verifies the 24-pixel Paste offset, cuts the pasted roots, and restores them again.
- Visual reference: `test-output/phase34-layer-clipboard.png`.
