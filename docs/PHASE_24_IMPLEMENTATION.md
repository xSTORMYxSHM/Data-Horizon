# Phase 24: Audio Driver Lab

Phase 24 makes parameter-level audio reactions visible, testable, and immediately useful while authoring.

## Problem corrected

The previous quick Outline assignment applied a small positive-only offset to effect strength. The renderer was reacting, but the change could be too subtle to recognize. The Audio tab also relied on generic element scrolling, and the assignment editor did not expose output minimum/maximum or show live evaluated values.

## Implemented

- Replaced the Outline quick action with **Make It Dance**, which creates or retunes one bounded Mids-to-strength reaction instead of stacking duplicate routes.
- Added target-aware reaction ranges that move below and above the authored value while respecting each parameter's valid limits.
- Added Subtle, Punchy, and Beat Pulse presets to every driver.
- Added live SOURCE, OFFSET, and RESULT values to every visible driver card.
- Added a global signal-status strip with real-time Bass, Mids, Highs, Beat, and active-driver information.
- Added one-click generated test-signal start/pause when no reference song is loaded, and song play/pause when one is loaded.
- Added the previously missing output minimum/maximum offset fields, response curve, multiple-driver combine mode, and enabled switch.
- Made changing a target automatically fit a useful Punchy range for opacity, transforms, effect strength, thickness, and other supported parameters.
- Fixed Inspector Audio-tab navigation to scroll its own panel directly and land Audio Assignments at the top.
- Collapsed unused reference-song transport controls until a song is loaded so live driver controls remain visible.

## Rendering contract

Drivers remain serialized as parameter bindings. Studio, Live View, OBS, Quartic Pulse packages, Tempest Broadcast packages, and offline export continue to use the same modulation engine and renderer.
