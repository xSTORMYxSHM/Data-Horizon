# Phase 11: Reference Song Preview

Phase 11 adds a local reference-song transport to Data Horizon Studio. A loaded song drives the same Bass, Mids, Highs, Beat, and RMS sources used by every existing parameter assignment, allowing visualizers and broadcast elements to be tuned against real music while they are edited.

## Local song workflow

- Load Reference Song is available from the Audio inspector and Audio menu.
- Supported picker formats include MP3, WAV, OGG/Opus, M4A/AAC, and FLAC, subject to Chromium codec support.
- Play/Pause, Stop, scrub position, monitor volume, loop, and optional timeline synchronization are available in the inspector.
- The transport shows the filename, playback state, elapsed time, and total duration.
- Loading a song disables generated preview audio so only the selected song drives assignments.

## Real-time analysis

- Web Audio analyzes a 2048-sample FFT and time-domain waveform inside the isolated Studio renderer.
- Frequency energy is divided into Bass (30–180 Hz), Mids (180–2400 Hz), and Highs (2400–16000 Hz).
- RMS is calculated from the live waveform and normalized for useful parameter routing.
- Beat detection compares low-frequency onsets against a moving baseline with a retrigger cooldown and decay envelope.
- The existing audio meters display the analyzed values while the main compositor renders the resulting changes.

## Project and export behavior

- Reference songs remain local to the current editing session.
- Audio bytes and local file paths are not written into `.horizon.json` projects.
- Songs are never bundled into Quartic Pulse or Tempest Broadcast exports.
- Published and Live runtimes continue to accept their normal external audio-feature frames.
- Optional Sync Timeline follows the song position without changing the saved timeline duration or keyframes.

## Security and resilience

- File selection runs through the narrow Electron preload API with renderer isolation retained.
- The desktop host limits preview songs to 250 MB.
- The content policy permits local `blob:` media without enabling remote media or unsafe scripts.
- Unsupported or damaged audio files surface a decode error without affecting the project.

## Verification

- All 22 automated tests pass.
- Analyzer tests verify bass-band isolation and waveform RMS extraction.
- Electron smoke securely supplies a generated three-second WAV, loads and plays it through the real transport, confirms playback advancement, and observes non-zero audio features.
- The full scaled masking, path, timeline, workspace, and rendering smoke remains error-free.
- Visual capture: `test-output/phase11-reference-audio.png`.
