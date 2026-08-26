# Phase 15: Project Starter Gallery

Data Horizon Studio 0.16.0 adds a New Project gallery for starting with complete, editable Quartic Pulse and Tempest Broadcast compositions.

## Starter projects

- Blank Canvas provides the original empty 1920 × 1080 workflow.
- Reactive Visualizer creates a Quartic Pulse scene with a HUD title, frame, data path, waveform, spectrum, particles, six parameter-level audio routes, timeline animation, and a portable four-role palette.
- Window Border creates a transparent Tempest Broadcast border with two editable signal labels, bloom, a flowing data route, and three music assignments.
- HUD Overlay creates a transparent title, lower third, spectrum, and animated data route ready to layer over live video.
- Signal Transition creates a complete full-canvas transition with title, signal field, particles, effects, music response, and entrance animation.

## Authoring behavior

The gallery opens from New or Ctrl+N without changing the current project. Choosing a starter performs the existing unsaved-change check, assigns fresh IDs, resets project history and transport, and creates a normal schema-version 1 project. An optional name can be supplied before creation.

Starters are factory functions in the shared project model. They do not use editor-only state, so every layer, audio route, keyframe, palette, transparent-canvas setting, and effect is preserved in project saves, Live View, Quartic Pulse packages, and Tempest Broadcast bundles.

## Verification

- All five starters pass shared project validation.
- 27 automated model, audio, export, render, and Studio tests pass.
- The Electron smoke test opens all five gallery choices and creates a named transparent HUD Overlay.
- Smoke verification confirms eight editable layers, three audio assignments, three animation tracks, unique IDs, engine version 0.16.0, and no renderer or browser errors.
- Visual capture: `test-output/phase15-project-starters.png`.
