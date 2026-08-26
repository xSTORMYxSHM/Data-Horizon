# Data Horizon Studio 0.17.13

Data Horizon Studio 0.17.13 delivers Phase 29 canvas motion paths.

## Added

- Easing-accurate Position X/Y trajectories drawn directly over the canvas.
- Labeled spatial points for every unique position-key time.
- A live current-position marker driven by the Timeline playhead.
- One-click paired X/Y key creation at the playhead.
- Direct point dragging with canvas-center and edge snapping.
- Synchronized motion-path, key-track, Curve editor, and numeric key selection.
- A non-destructive Motion overlay visibility toggle.

## Compatibility

The project schema remains version 1. Motion paths author ordinary transform animation tracks and require no runtime-only or editor-private project format. Existing projects gain the canvas overlay automatically whenever their selected layer has Position X or Position Y animation.

## Verification

- 36 automated tests pass.
- The Electron/WebGL2 smoke workflow verifies paired tracks, spatial sampling, point dragging, current-position feedback, Timeline synchronization, and zero browser/renderer errors.
- Visual reference: `test-output/phase29-motion-paths.png`.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.13-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.13-win32-x64-release.zip`
- Archive entries: 87
- Archive size: 138,319,334 bytes
- SHA-256: `BD336B426DBA6C1A4D87EDD12185C5CE2552FF5A457A20162502FDF224359847`

The unpacked application also completed the full Electron/WebGL2 motion-path smoke workflow from the packaged executable.
