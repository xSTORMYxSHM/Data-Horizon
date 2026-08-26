# Phase 28: Curve Editor and Automation Cleanup

Phase 28 adds the visual animation-curve workflow needed to shape hand-authored motion and clean up music-driver recordings without crowding the normal key-track view.

## Curve view

The Timeline now switches between Key Tracks and Curves. Curve view displays the selected animation track using the actual shared evaluator, including Linear, Ease In, Ease Out, Smooth, Bounce, and Hold interpolation.

- The value axis fits itself to the authored keys and exposes minimum/maximum context.
- Time grid lines, work-area shading, and a live playhead make the curve readable while previewing.
- Curve points share selection with the key tracks and numeric key editor.
- Dragging horizontally changes time; dragging vertically changes value. Multi-selected points move together.
- Parameter limits remain enforced during graphical editing.

## Precision workflow

Frame snapping is enabled by default and uses the project's Timeline frame rate. It applies to rail dragging, curve dragging, numeric time changes, and pasted keys. Free Time can be enabled for subframe animation.

Selected keys on the active track can be copied and pasted at the playhead with either the visible controls or Ctrl+C / Ctrl+V. Relative timing, values, and easing are retained, while pasted keys receive fresh IDs.

## Recorded automation cleanup

Reduce Keys removes redundant samples from fully linear tracks at a 1%, 2%, or 5% value-range tolerance. The shared project-model command preserves the first and last key plus meaningful deviations such as music peaks. Tracks containing authored non-linear easing are deliberately left unchanged.

This turns dense music-driver captures into curves that are easier to edit while keeping their visible motion within the selected tolerance. The smoke workflow reduces an 11-key capture to 5 keys.

## Verification

- 36 automated tests pass, including shared-model coverage for linear automation reduction.
- Electron/WebGL2 smoke coverage verifies curve rendering, grid/playhead state, two-axis dragging, copy/paste, frame alignment, and 11-to-5 recorded-key reduction.
- No browser or renderer errors are reported.
- Visual reference: `test-output/phase28-curve-editor.png`.
