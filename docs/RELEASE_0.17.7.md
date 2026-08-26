# Data Horizon Studio 0.17.7

Data Horizon Studio 0.17.7 introduces the Phase 23 contextual paint workspace.

## Added

- Visible contextual Paint/Erase and Hide/Reveal subtools.
- Detail, Ink, and Soft brush presets.
- Synchronized size, softness, opacity, and retouch color controls above the canvas.
- Transparent-color erasing with the C shortcut.
- B/E subtool shortcuts and bracket-key brush resizing.
- Contextual Undo Stroke, Clear, and Done actions.
- A brush cursor that communicates softness and erase mode.

## Compatibility

The project schema remains version 1. Existing projects, Painted Masks, and 0.17.5–0.17.6 Paint / Erase strokes load without conversion.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.7-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.7-win32-x64-release.zip`
- Archive entries: 87
- SHA-256: `E03548FC3F483B27D99048BCC8FD2757C974AF284D6DB5D61F7C1220DE85E161`

Verified with 33 automated tests plus the Electron/WebGL2 paint-and-erase smoke workflow. The packaged application contains the executable, shared renderer, contextual paint workspace, brush presets, transparent-color erasing, automatic Outline extraction, and alpha-correct Screen composition.
