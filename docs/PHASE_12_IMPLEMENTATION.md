# Phase 12: Advanced Text and HUD Tools

Phase 12 turns Data Horizon Studio's basic text element into a non-destructive typography and HUD authoring system. Text remains a normal ordered layer, so it can be transformed, animated, masked, blended, audio-modulated, and exported through the same compositor as every other element.

## Text authoring

- Multiline editing with explicit line breaks and automatic word wrapping.
- Horizontal and vertical alignment inside the authored element bounds.
- Font family, size, weight, italic styling, letter spacing, and line height.
- Configurable internal padding with automatic clipping and ellipsis when copy exceeds the available height.
- Text color, outline color/width, and glow color/blur.

## HUD plates

- Optional background plate with independent color and opacity.
- Border color and width plus rounded corners.
- Plate, border, outline, and glow remain source properties rather than destructive raster changes.
- A dedicated HUD Text toolbox action inserts a ready-to-edit signal title.
- Signal Title, Data Label, and Broadcast Alert styles provide reusable starting points.
- Applying a style resizes the element to the preset's intended geometry while preserving its top-left canvas placement.

## Shared rendering

- The renderer rasterizes text to a transparent high-resolution texture and composites it through the existing WebGL2 layer path.
- The generated texture cache is invalidated by every typography, plate, outline, glow, and geometry property.
- Studio, Live View, Quartic Pulse, and Tempest Broadcast bundles use this identical renderer implementation.
- Quartic Pulse package validation accepts the native layer and effect set, including text and HUD elements.
- Existing projects are normalized in memory with safe defaults for all new text fields.

## Verification

- All 25 automated tests pass.
- Model coverage verifies all HUD alert properties and migration of legacy text layers.
- Electron smoke creates a HUD element from the real toolbox, applies the alert style, enters two lines of copy, and verifies the autosaved values.
- The smoke confirms the element resized to 880×300, all advanced controls are present, WebGL reports no rendering error, and no browser errors occurred.
- Visual capture: `test-output/phase12-advanced-hud-text.png`.
