# Phase 25: Effect Presets and Scroll-Stable Editing

Phase 25 adds ready-made effect-stack starting points and removes disruptive panel jumps during ordinary editing.

## Effect-stack presets

The Effects inspector now includes six built-in presets:

- **Comic Ink** — cel shading and a crisp illustrated outline.
- **Isolated Neon Edge** — cyan isolated edges followed by bloom.
- **Dream Glow** — saturated color grading and broad soft bloom.
- **CRT Signal** — posterization, moving scanlines, and restrained bloom.
- **Heat Distortion** — warm grading, animated displacement, and atmospheric bloom.
- **Audio Pulse Outline** — an outline plus Mids-driven strength and Beat-driven thickness.

Applying a preset appends normal native effects to the selected layer. It does not flatten the source or hide the effect stack. Every effect, parameter, order, visibility state, and generated audio assignment remains editable and removable.

## Scroll preservation

Same-selection editor rerenders now snapshot and restore horizontal and vertical scroll positions for:

- Inspector
- Layers
- Assets
- Masks
- Node View
- Presets
- Asset Vault
- Timeline tracks

Changing a parameter, applying a preset, toggling an effect, or using Undo/Redo no longer sends the active panel to its top. Selecting a different layer may still reset the Inspector intentionally so the new element can be revealed clearly.

Browser scroll anchoring is disabled on the managed authoring containers so DOM replacement cannot fight the restored position.
