# Data Horizon Publish Formats

Data Horizon authors one canonical `HorizonProject` and publishes portable bundles for different hosts. A bundle is a directory containing:

```text
bundle-name/
├─ manifest.json
├─ project.horizon.json
├─ preview.png
├─ README.txt
└─ runtime/
   ├─ index.html
   ├─ project.js
   ├─ app.js
   └─ styles.css
```

The runtime files are the same WebGL2 renderer used by Studio. Initial portable bundles embed imported images in the project document. A later archive revision can externalize large assets while preserving the same manifest boundary.

## Quartic Pulse visualizer

Format identifier: `data-horizon.quartic-visualizer`

The manifest describes a custom full-canvas visualizer, its canvas, runtime entry point, audio-feature contract, transport-clock support, and offline-frame support. Quartic Pulse previews and installs the bundle, adds it to the visual catalog, and feeds timestamped frames to its compatible built-in renderer.

Studio's publish dialog can also author up to 32 package palettes. Each palette has a stable package-local ID, display name, optional initial-favorite flag, and exactly four HEX colors in Shadow, Field, Accent, and Detail order. Palette metadata is saved with the Data Horizon project and copied into the Quartic Pulse manifest. Quartic Pulse preserves the user's favorite choice when a stable palette ID is updated and removes managed palettes when their package is removed.

Quartic Pulse accepts Data Horizon image, group, text, shape, spectrum, waveform, particle, and path layers. Its bundled first-party Data Horizon 0.17 renderer also supports cel shading, outline, color grade, luminance and region masks, painted masks, posterize, bloom, scanlines, and displacement. Audio bindings and authored timeline animation use Quartic Pulse's deterministic transport clock in the main window, OBS output, and offline export.

## Tempest Broadcast element pack

Format identifier: `data-horizon.tempest-element-pack`

One Data Horizon composition becomes one composited OBS Browser Source. Supported classifications are:

- full scene
- window border
- overlay
- HUD
- lower third
- alert
- background
- transition

Transparent publishing sets the saved project canvas alpha to zero and declares an alpha-capable browser source. Groups let creators combine many authored layers into one deployable stream element.

## Runtime audio input

The runtime accepts `tempest.audio-features.v1` frames through either API:

```js
window.dataHorizonRuntime.setAudioFrame({ bass, mids, highs, beat, rms, timestampSeconds, sequence });
```

or:

```js
runtimeWindow.postMessage({ type: 'tempest.audio-features.v1', frame }, '*');
```

Production runtimes do not generate mock audio. Studio retains its mock-audio switch for authoring previews.

## Current integration boundary

Studio can produce and validate both bundles, and Quartic Pulse can preview, install, update, render, and remove its target format. For Tempest Broadcast, Studio can install or update a composition directly in the built-in Asset Vault, browse managed installations, reopen their editable source projects, reveal their files, and recoverably uninstall them. Vault packages use a stable unique HTML filename, declare their canvas through `tempest-size`, default to the OVERLAY bank, and carry the project, runtime, manifest, and preview together. Broadcast automatically rescans watched Vault folders after a debounced filesystem change.

Developers working with both source trees can run `node tools/verify-quartic-roundtrip.cjs` after building Data Horizon. The check creates a temporary two-palette bundle with the real Data Horizon exporter, passes it through Quartic Pulse's preview/install/load/list/remove manager, and deletes the temporary files afterward. Use `--quartic-root=<path>` when the repositories are not siblings.
