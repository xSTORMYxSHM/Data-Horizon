# Phase 37: Named Layer Selection Sets and Solo/Restore

Phase 37 extends the Layer Navigator with reusable multi-layer working selections and a safe way to inspect them in isolation.

## Named selection sets

The compact selection-set row can save the current single- or multi-layer selection under a user-defined name. Sets preserve layer-tree order rather than click order, making their contents deterministic across sessions. Recall restores the exact selection, clears navigator filters, expands every required ancestor group, and scrolls the primary layer into view.

Selection sets are stored in the project so they travel with `.horizon.json` files. Names and layer references are normalized and validated. Missing or deleted layers are removed from their sets automatically, and empty sets are discarded.

## Solo and Restore

Solo captures the complete current visibility state, then shows only the selected layers, their descendants when a group is selected, and the ancestor groups required to render the selected path. The same button changes to Restore while isolation is active.

Restore reapplies the captured visibility state exactly, including layers that were already hidden before Solo. Both transitions use the ordinary project command history and therefore work with Undo and Redo.

## Compatibility

The project schema remains version 1. The optional `layerSelectionSets` collection is normalized to an empty list for older projects. It is authoring metadata: the shared renderer safely ignores it, while project files and editable package sources retain it for Studio reuse.

## Verification

- 39 automated tests pass.
- Project-model coverage verifies creation, ordering, normalization, validation, updating, and cleanup after layer deletion.
- Electron/WebGL2 coverage verifies Save, Recall, Delete, Solo, Restore, Undo, and Redo in a 40-layer, 9-group project with zero browser or renderer errors.
- Visual reference: `test-output/phase37-layer-selection-sets.png`.
