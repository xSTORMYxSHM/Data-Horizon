# Phase 4: Stream Elements

This phase adds native audio-reactive stream elements and the first composition-template browser.

## Native source layers

### Waveform

- Editable color, amplitude, frequency, thickness, glow, and mirroring.
- Uses bass, mids, highs, beat, and RMS features in the shared WebGL2 source pass.
- Amplitude, frequency, thickness, and glow are available as parameter-level audio targets.

### Particles

- Editable count, low/high colors, size, speed, spread, and audio gain.
- Deterministic GPU particle field with bass-driven motion, high-frequency color response, and beat/RMS brightness and size response.
- Size, speed, spread, and audio gain are available as parameter-level audio targets.

Both layer types support the complete layer contract: transforms, opacity, blend mode, masks, effects, depth/parallax, grouping, saving, Live View, Quartic Pulse publishing, and Tempest Broadcast publishing.

## Broadcast template browser

- Lower Third: editable two-line identity plate with accent rail.
- Alert: glowing event plate with editable copy and waveform pulse.
- Transition: full-canvas signal field with particles, title, scanlines, and displacement.

Templates are inserted as ordinary nested layer groups. Nothing is flattened, and every child remains editable.

## Verification

- 16 automated tests pass across the project model, modulation engine, renderer registry, export runtime, and desktop shell.
- Electron smoke fixture: WebGL2 active, one asset, seven mixed source layers, 14 passes, 21 draw calls, and no renderer error.
- Smoke interactions verify zoom, guides, snapping, duplicate/undo, three template choices, and all publish choices.
- Visual captures: `test-output/phase4-stream-elements.png` and `test-output/phase4-templates.png`.
