# Phase 18: Editable Composition Reuse

Data Horizon Studio 0.17.2 can combine complete Data Horizon projects without flattening them into images or opaque runtime layers.

## Import workflows

- **Import Project as Editable Layers** is available in the Layers dock and File menu.
- Every managed Tempest Asset Vault card now has **Insert as Editable Layers**.
- Opening a project still replaces the current document; importing a project adds it non-destructively to the current document.

## Portable composition merge

An imported project becomes one named group containing its complete ordered layer tree. The merge carries:

- embedded image assets, deduplicated by content;
- effects and painted masks;
- parameter-level audio assignments;
- animation tracks and keyframes;
- an opaque or translucent canvas background as an editable bottom shape layer.

Every layer, effect, brush stroke, asset, audio binding, animation track, and keyframe receives a fresh ID. All target paths are remapped to those IDs, so the imported composition cannot collide with the destination project or another copy of itself.

## Canvas fitting

Source geometry is aspect-fitted and centered in the destination canvas. Layer transforms, text geometry, shape geometry, data-path measurements, transform animation values, and transform audio ranges scale with the composition. The destination timeline extends when necessary so imported keyframes are not clipped.

## Verification

- Shared-model tests cover fitted geometry, fresh IDs, remapped audio and animation targets, timeline extension, asset transfer, and editable canvas-background preservation.
- Electron smoke imports the same published Vault element through both the Vault button and the general file-import route.
- The smoke fixture confirms a new group, three carried audio assignments, a second independent project import, and clean rendering.
- Visual capture: `test-output/phase18-composition-reuse.png`.
