# Phase 6: Functional UI

This phase audited the visible Studio interface and converted previously decorative controls into working authoring surfaces.

## Application menus

- File: new, open, save, save as, publish, and Live View.
- Edit: undo, redo, duplicate, and delete.
- Select: previous layer, next layer, clear selection, and properties navigation.
- Layer: duplicate, group, delete, and ordering.
- Effects: inspector navigation and direct effect/mask insertion.
- Audio: assignment navigation, binding creation, and mock-audio toggle.
- View: fit, 100%, zoom stepping, guides, and snapping.
- Window: independent toolbox, inspector-dock, and timeline visibility.
- Help: keyboard shortcut reference and a versioned About surface.

Menu actions route through the same command handlers as toolbar controls and keyboard shortcuts so their behavior stays consistent.

## Toolbox behavior

- Auto-select identifies the top visible layer under a canvas click, including rotation-aware bounds and frame-edge hit testing.
- Show Transform immediately toggles the canvas transform box.
- The Move tool restores transform controls.
- Foreground color applies to editable text, waveform, shape stroke, spectrum, or particle color properties.
- Background color edits the project canvas color.
- Color swapping updates both authored values.

## Layer dock

- Layers retains ordering and editing commands.
- Assets displays previews, MIME types, usage counts, and a Place command for creating another non-destructive image layer.
- Remove Unused deletes only assets with no image-layer references.
- Masks discovers luminance and semantic region masks across the project and opens the owning layer's effect stack.
- Sky, Horizon, Terrain, and Foreground masks can be added directly from the Masks dock.

## Keyboard workflow

- Ctrl+N/O/S/Shift+S for project commands.
- Ctrl+Z/Y/D for undo, redo, and duplication.
- Delete removes the selected layer.
- Brackets select adjacent layers.
- K and Home control timeline playback.
- F and G control canvas fit and guides.
- Ctrl plus/minus changes zoom.
- Escape closes menus/dialogs or clears selection.

## Verification

- All 19 automated tests pass.
- Functional smoke verifies asset browsing/placement/undo, mask discovery, transform visibility, File menu population, About dialog, Window panel toggling, templates, publishing, timeline controls, and renderer health.
- WebGL2 smoke remains clean at 14 passes and 21 draw calls.
- Visual capture: `test-output/phase6-functional-ui.png`.
