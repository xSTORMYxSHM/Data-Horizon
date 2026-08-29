# Open Broadcast Kit

The Open Broadcast Kit is a neutral, transparent 1920 × 1080 project starter for learning how Data Horizon broadcast elements are assembled. It intentionally contains no Tempest Mainframe or Quartic Pulse branding.

Open **New Composition**, choose **Open Broadcast Kit**, and inspect the normal Layers, Effects, Audio Drivers, and Timeline panels. Nothing is flattened or hidden behind a custom runtime.

The starter begins timeline playback automatically so the entrance tracks and all five examples are immediately visible. Pause or scrub the Timeline to inspect individual animation keys.

The starter includes five reusable presets:

- **Open Event Alert** — editable surfaces and typography, a waveform, beat-driven bloom, RMS response, and a fade-in track.
- **Open Chat Panel** — a portrait-friendly shell for placing around a browser-based chat source, plus a mids-reactive activity waveform.
- **Open Lower Third** — two editable text lines, a bass-reactive accent rail, and a slide-in track.
- **Open Audio Meter** — a native spectrum with separate bass-gain and high-frequency glow routes.
- **Reactive Canvas Frame** — a full-canvas border with beat-driven thickness and high-frequency bloom.

Every item appears both on the starter canvas and in the project’s **Presets** dock. A creator can inspect the assembled layers in place, remove pieces they do not need, or insert fresh copies from Presets. Saving produces an ordinary `.horizon.json` project, and publishing uses Data Horizon’s standard live/OBS/export pipeline.

The chat panel is a visual shell, not a chat client. Put the BotRix or other chat URL in its own browser source and layer the exported shell above it in the broadcast compositor.
