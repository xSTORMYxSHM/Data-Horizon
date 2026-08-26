# Phase 7: Custom Workspaces

Data Horizon Studio 0.10.0 now treats the editor arrangement as a persistent user workspace, similar to professional image and video tools. Workspace state is independent from project files, so opening or publishing a visualizer never changes the user's preferred interface.

## Resizable docks

- Toolbox width, right-dock width, Timeline height, and the Inspector/Layers split have live drag handles.
- Dock dimensions are clamped to usable minimum and maximum sizes.
- Widening the Toolbox automatically creates additional tool columns.
- The canvas refits and its selection/guides realign after every layout change.

## Compact Timeline

- The Timeline chevron collapses the complete authoring area into a 38-pixel transport strip and restores it with one click.
- Collapsed state is stored with the active and named workspace layouts.
- The four separate animation-preset buttons are consolidated into one preset selector and Apply button.
- Expanded tracks now consume the available Timeline height instead of being restricted to a small fixed region.
- At narrower window widths, secondary Timeline labels are removed while playback, scrubbing, duration, keyframes, presets, collapse, and docking remain available.

## Floating panels

- Toolbox, Inspector, Layers/Assets/Masks, and Timeline can each be floated or redocked with the diamond control.
- Floating panels can be dragged by their title/tab bar and resized from the lower-right corner.
- Double-clicking an unused title/tab-bar area also toggles docking.
- Floating positions and dimensions are kept inside the current application window and restored on restart.
- Any combination of hidden, docked, and floating panels is supported, including floating both right-side panels with the dock column collapsed.

## Workspace management

- The new Workspace menu opens the layout editor, saves named workspaces, and loads the built-in Editing or Preview layouts.
- The Customize Layout dialog controls visibility, floating state, and exact dock dimensions.
- Named layouts can be saved, loaded, overwritten, and deleted.
- Editing restores the complete docked authoring workspace; Preview hides all panels for an unobstructed canvas.
- Window menu commands now update the same persistent workspace state.

## Persistence

- The active workspace is stored under `dataHorizonWorkspaceCurrentV1`.
- Named layouts are stored under `dataHorizonWorkspaceLayoutsV1`.
- Workspace values are normalized and clamped when restored so malformed or older local state cannot prevent startup.
- Workspace settings are not serialized into `.horizon.json` files or published Quartic Pulse/Tempest Broadcast bundles.

## Verification

- All 19 automated tests pass.
- Electron smoke verifies dock resizing, Inspector and Layers floating together, named-workspace saving, 38-pixel Timeline collapse/expansion, Editing-layout restoration, and existing editor workflows.
- WebGL2 smoke remains clean at 14 passes and 21 draw calls.
- Visual capture: `test-output/phase7-custom-workspace.png`.
