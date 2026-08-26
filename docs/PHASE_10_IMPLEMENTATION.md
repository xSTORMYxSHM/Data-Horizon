# Phase 10: Application Interface Scaling

Phase 10 replaces the editor's fixed-density assumption with persistent application-wide scaling. Scaling is applied by Electron to the complete renderer surface, so text, controls, menus, dialogs, docks, floating panels, scrollbars, and pointer targets grow together without changing project or export dimensions.

## Automatic display sizing

- New installations start in Auto mode instead of assuming 100%.
- Auto selects 140% for a typical 1920-wide display.
- Common 2560 and ultrawide displays receive 150–160% scaling.
- 4K-class desktop layouts can receive 175% scaling.
- Smaller laptop displays use a more conservative scale so the full workspace remains usable.

## Manual controls

- The Workspace dialog includes an Application Scale selector from 100% through 200%.
- A persistent footer control always displays the current effective percentage and opens the scale settings directly.
- View provides Increase, Decrease, Auto, and 100% interface-scale commands.
- `Ctrl+Shift++` and `Ctrl+Shift+-` adjust interface scale; `Ctrl+0` restores Auto.
- Existing `Ctrl++` and `Ctrl+-` canvas zoom remains independent.

## Persistence and layout behavior

- The selected mode is saved as an application preference rather than inside a visualizer project.
- Named workspace layouts remain independent and continue to store dock visibility, size, placement, and floating state.
- Auto mode reevaluates when the app moves or resizes onto a differently sized display.
- Studio rendering resizes after scale changes while project canvas coordinates and export resolution remain unchanged.
- Live and published runtime output is not subjected to editor interface scaling.

## Verification

- All 21 automated tests pass.
- Electron smoke runs the complete masking, path editing, timeline, workspace, template, and publish interaction suite at 140%.
- The smoke switches to 160%, verifies Electron's effective zoom and footer display, then restores Auto at 140%.
- Painted-mask pointer input and path-point dragging are adjusted for the active application scale and remain accurate.
- Visual capture: `test-output/phase10-interface-scaling.png`.
