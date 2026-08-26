# Phase 14: Reusable Preset Library

Data Horizon Studio 0.15.0 adds a portable preset workflow for reusing authored elements across projects.

## Authoring workflow

- Use the fifth Layers-workspace tab to browse, insert, export, or remove reusable elements.
- Save the selected layer or group to the current project's Presets dock.
- Import and export standalone `.horizonpreset` files through the isolated desktop bridge.
- Insert a saved preset repeatedly without colliding with existing layer, effect, asset, binding, track, or keyframe IDs.
- Delete project-library entries without deleting layers that were already inserted.

## Portable content

Each preset carries the selected layer tree, only the image assets it references, and only the audio bindings and animation tracks owned by that tree. Existing identical image data is reused when a preset is inserted.

Preset documents use `data-horizon.layer-preset` format version 1 and are validated independently before entering a project.

## Compatibility

Existing schema-version 1 projects remain valid. Projects without a preset library normalize to an empty list. New projects and published packages report engine version 0.15.0.

## Verification

- 26 automated project-model, audio, export, render, and Studio tests pass.
- The desktop smoke test covers preset creation, export, deletion, import, and insertion.
- Smoke verification confirms fresh layer/effect IDs, remapped audio bindings, asset reuse, and a valid 0.15.0 project.
