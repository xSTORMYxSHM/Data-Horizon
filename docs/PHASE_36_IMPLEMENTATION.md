# Phase 36: Layer Navigator

Phase 36 makes large visualizer and broadcast compositions manageable without increasing the Layers panel footprint.

## Group disclosure

Groups now have familiar disclosure arrows. Collapsing a group hides its descendants from the tree while leaving composition visibility and rendering unchanged. Collapse state is stored per project in Studio preferences, so reopening the same project restores its organization without adding editor-only fields to the project file.

Collapse All reduces a dense stack to its root rows. Expand All restores every nested row. Search and filters temporarily expand matching ancestry without destroying the stored disclosure state.

## Search

The compact search field matches layer names, native layer types, effect names, and effect types. Nested results include their ancestor groups so users always see where a match lives. Matching a group name also exposes that group's children for immediate inspection.

The `/` shortcut focuses and selects the Layer search field. Escape clears the current query and filter while focus remains in the field.

## Filters

The Navigator can isolate:

- All layers
- Visible layers
- Hidden layers
- Locked layers
- Layers with effects
- Music-driven layers
- Animated layers
- Groups

The status line separates direct match count from total project layers. Ancestor rows needed as context can therefore appear without inflating the reported number of matches. A clear zero-result explanation replaces an apparently empty or broken tree.

## Reveal Selected

Reveal clears active search and filter state, expands every ancestor of the selected layer, rerenders the full tree, and scrolls the selected row into view. This provides an explicit recovery path when canvas selection or another workspace surface targets content hidden inside a collapsed group.

## Compatibility

Phase 36 adds no project-schema fields and changes no render behavior. Group disclosure, search, and filters are Studio-only navigation state, so saved projects, presets, Asset Vault elements, Live View, OBS, Quartic Pulse, and Tempest Broadcast remain compatible.

## Verification

- 38 automated tests pass.
- Electron/WebGL2 coverage exercises a 40-layer tree with 9 groups, Collapse All persistence, nested search ancestry, auto-expansion, Groups and Music Driven filters, zero-result messaging, `/` focus, Reveal Selected, and zero browser or renderer errors.
- Visual reference: `test-output/phase36-layer-navigator.png`.
