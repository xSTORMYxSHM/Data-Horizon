# Phase 32: Rulers and Project Guides

Phase 32 adds the persistent precision-layout system needed to reproduce broadcast frames, safe regions, HUD grids, and visualizer geometry at exact project coordinates.

## Zoom-aware rulers

Horizontal and vertical rulers now surround the canvas whenever Guides are visible. Tick intervals adapt to the rendered canvas scale, keeping labels readable at Fit zoom, fixed zoom, ultrawide layouts, floating workspaces, and 100–200% application scaling.

Ruler values always report project pixels rather than screen pixels. A 640 px guide therefore remains at 640 px regardless of canvas zoom or interface scale.

## Guide creation and editing

Guides can be created in two ways:

- Drag from the horizontal or vertical ruler directly onto the canvas.
- Choose Horizontal or Vertical in Move Tool options and enter an exact numeric position.

Each guide displays its coordinate while hovered or dragged. Dragging an unlocked guide changes its project position in one Undoable operation. Dragging it outside the canvas removes it. Clear removes the complete guide set as one recoverable project edit.

## Locking and visibility

Guide locking is stored with the project. Locked guides remain visible and continue to participate in snapping, but no longer intercept pointer input or move accidentally. The existing Guides toolbar control and Move Tool visibility option show or hide the grid, safe area, rulers, and custom guides together.

## Transform snapping

Custom horizontal and vertical coordinates are included in the Phase 31 transform candidate set. Moving or scaling a layer near a guide produces the same magenta live alignment feedback used for canvas and nearby-layer matches.

## Compatibility

Projects continue using schema version 1. Older projects normalize to an empty, unlocked guide collection. Rulers and guides are Studio authoring metadata only; rendering and export output remain unchanged.

## Verification

- 37 automated tests pass.
- Electron/WebGL2 smoke coverage adds numeric vertical and horizontal guides, creates another guide by ruler drag, repositions a guide, locks all handles, snaps a selected layer to the saved coordinate, verifies adaptive ruler ticks and guide cleanup, and reports no browser or renderer errors.
- Visual reference: `test-output/phase32-rulers-guides.png`.
