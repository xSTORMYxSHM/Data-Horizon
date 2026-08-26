# Phase 23: Contextual Paint Workspace

Phase 23 reshapes layer retouching around a Clip Studio Paint-inspired workflow without turning Data Horizon into a general-purpose raster editor.

## Implemented

- Added a contextual brush property bar above the canvas that appears only while a Painted Mask or Paint / Erase pass is active.
- Replaced the tiny mode dropdown as the primary workflow with visible Paint/Erase and Hide/Reveal subtools.
- Added Detail, Ink, and Soft brush presets while preserving fully adjustable size, softness, and opacity.
- Added a dedicated brush-color control and Clip Studio-style transparent-color switch for erasing generated layer content.
- Added one-click Undo Stroke, Clear, and Done actions in the paint workspace.
- Added B for the primary subtool, E for the secondary subtool, C to toggle color/transparency, and bracket keys to resize the brush while painting.
- Enhanced the canvas cursor with a softness guide and an unmistakable eraser indicator.
- Kept all strokes non-destructive, project-serializable, audio-reactive at the Paint / Erase effect opacity parameter, and identical in Studio, Live View, OBS, and export rendering.

## Scope

This phase improves editing ergonomics around the existing native Paint / Erase and Painted Mask effects. It does not copy Clip Studio Paint source code, assets, or visual branding.
