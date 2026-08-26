# Data Horizon Studio 0.17.8

Data Horizon Studio 0.17.8 introduces the Phase 24 Audio Driver Lab and fixes hard-to-see Outline reactions.

## Added

- Outline **Make It Dance** quick setup.
- Subtle, Punchy, and Beat Pulse driver reactions.
- Live source, applied offset, and final-result values.
- Output minimum/maximum offset controls.
- Response-curve, combine-mode, and enabled controls.
- Generated test-signal start/pause directly from the Audio section.

## Fixed

- Quick Outline reactions now use a strong bounded range instead of a subtle positive-only offset.
- Retuning the same quick Outline driver no longer adds a duplicate route.
- The Audio tab reliably reveals Audio Assignments.
- New generic opacity drivers work even when authored opacity is already 100%.
- Empty reference-song transport controls collapse until a song is loaded.

## Compatibility

The project schema remains version 1. Existing audio assignments remain valid. Older subtle drivers can be upgraded by pressing **Punchy**, **Beat Pulse**, or the Outline **Make It Dance** button.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.8-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.8-win32-x64-release.zip`
- Archive entries: 87
- SHA-256: `C5AF5E5815AD6E32BADA44CB784FEF67DB8D31674BF2A4AEABEB6D020293AAB8`

Verified with 34 automated tests plus the Electron/WebGL2 Audio Driver Lab smoke workflow. The packaged application contains the executable, shared renderer, live driver feedback, reaction presets, bounded output-offset mapping, generated test signal, Clip Studio-style paint workspace, and automatic Outline extraction.
