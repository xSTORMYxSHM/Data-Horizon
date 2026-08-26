# Data Horizon Studio Architecture

## Product boundary

Data Horizon owns visual project authoring and the renderer required to play those projects. It does not own music-library management, show sequencing, broadcast scene operation, or suite administration.

| Product | Data Horizon relationship |
| --- | --- |
| Quartic Pulse | Supplies transport and rich audio features; loads and controls Data Horizon visual projects. |
| Tempest Broadcast | Hosts the live runtime as a Browser Source and controls visibility, scenes, and broadcast safety. |
| Tempest Mainframe Studio | Registers applications/assets and provides the Tempest Bridge control plane. |

## Core model

```text
Project
├─ canvas, color space, frame-rate policy
├─ assets
├─ layer tree
│  ├─ group
│  └─ layer
│     ├─ source
│     ├─ transform and depth/parallax
│     ├─ mask stack
│     ├─ effect stack
│     └─ blend and opacity
├─ parameter bindings
├─ presets
└─ output settings
```

Every authored value is immutable input to evaluation. Audio envelopes, clocks, cached textures, compiled shaders, and framebuffer allocations are runtime state and never mutate the saved project.

## Proposed repository layout

```text
Data Horizon/
├─ apps/
│  └─ studio-desktop/       Electron main process, preload, and editor UI
├─ packages/
│  ├─ project-model/        schemas, migrations, commands, history, presets
│  ├─ render-runtime/       WebGL2 render graph, passes, textures, and player API
│  ├─ audio-modulation/     feature frames, envelopes, bindings, and evaluation
│  ├─ output-runtime/       live, OBS browser, and offline frame sinks
│  └─ tempest-client/       Bridge discovery, topics, and application registration
├─ projects/
│  └─ data-horizon-classic/ first editable bundled project
├─ docs/
├─ package.json
├─ pnpm-workspace.yaml
└─ tempest.app.json
```

The packages start here so the product can move independently. Stable generic pieces can later move into the planned Mainframe Engine without changing their public contracts.

## Technology baseline

- Electron 37-compatible desktop host, matching Quartic Pulse.
- TypeScript 5.9-compatible source, matching Tempest Mainframe Studio.
- Node.js 22 and pnpm 11 workspace conventions.
- WebGL2 and GLSL ES 3.00 as the common Electron/OBS renderer floor.
- DOM editor UI with a typed central document store and command-based undo/redo.
- FFmpeg frame sink adapted from the proven Quartic workflow after its renderer dependencies are separated.

WebGPU can be evaluated later, but it must be an additional backend. It cannot be the version-one requirement while OBS Browser Source parity is mandatory.

## Render runtime contract

The runtime must be usable without the editor:

```ts
interface RenderRuntime {
  loadProject(project: HorizonProject, assets: AssetResolver): Promise<void>;
  applyRevision(revision: ProjectRevision): Promise<void>;
  resize(viewport: RenderViewport): void;
  render(frame: EvaluationFrame, sink: FrameSink): Promise<FrameResult>;
  dispose(): void;
}

interface EvaluationFrame {
  frameIndex: number;
  timeSeconds: number;
  deltaSeconds: number;
  audio: AudioFeatureFrame;
  transport: TransportFrame;
  seed: number;
}
```

The editor, clean live window, OBS Browser Source, and exporter all instantiate this runtime. None may have a private effect implementation.

## Render graph

```text
source texture / procedural source
              │
              ▼
       source preprocessing
              │
              ▼
       layer effect stack ◄──── parameter evaluation
              │
              ├──── mask stack
              │
              ▼
       layer render target
              │
              ▼
 ordered group/layer composite ── blend + opacity + depth/parallax
              │
              ▼
        project post stack
              │
              ▼
  editor canvas / live canvas / OBS canvas / export readback
```

Each effect is a registered pass with a typed parameter descriptor, shader factory, input requirements, output format, and deterministic capability flag. A framebuffer pool reuses compatible textures. Effects never reach directly into editor state.

## Layer and effect model

Version one layer types:

- `image`
- `solid`
- `procedural.terrain`
- `procedural.dataPaths`
- `procedural.spectrum`
- `procedural.particles`
- `procedural.legacyHud`
- `group`

Version one effects:

- cel shading
- outline/edge extraction
- posterization
- color grading
- bloom
- scanlines
- displacement
- mask application

All layers expose visibility, opacity, transform, blend mode, mask stack, effect stack, and depth/parallax. Derived visual copies reference their source asset or layer result; they do not duplicate or alter original media.

## Masks and depth

Masks are first-class resources with stable IDs and can be reused by multiple layers. Version one supports:

- imported grayscale masks;
- luminance, color-range, and edge-derived masks;
- vertical-region masks with adjustable horizon, range, and feather;
- renderer-generated terrain hit/depth masks;
- named semantic slots: sky, horizon, terrain, and foreground;
- invert, level, feather, and combine operations.

For arbitrary images, the initial semantic masks are assisted/heuristic and editable. A future segmentation model can implement the same mask-generator interface without changing project files.

## Parameters and music assignments

Every modulatable parameter has a stable target path and descriptor. A binding is independent from the layer so multiple sources can affect one parameter.

```ts
interface ParameterBinding {
  id: string;
  source: 'bass' | 'mids' | 'highs' | 'beat' | 'rms' | `spectrum.${number}`;
  target: string;                 // layer/effect/parameter stable path
  amount: number;
  direction: 1 | -1;
  inputMinimum: number;
  inputMaximum: number;
  outputMinimum: number;
  outputMaximum: number;
  smoothingMs: number;
  attackMs: number;
  releaseMs: number;
  curve: 'linear' | 'smoothstep' | 'exponential';
  combine: 'add' | 'multiply' | 'max';
  enabled: boolean;
}
```

Evaluation order:

1. Normalize the source inside its input range.
2. Apply curve and direction.
3. Apply attack/release envelope and smoothing using `deltaSeconds`.
4. Map into the binding output range and amount.
5. Combine all enabled bindings for the parameter in stable binding-ID order.
6. Combine modulation with the authored base value and clamp to the parameter descriptor.

Runtime envelope state is keyed by binding ID. Reset/discontinuity events clear it identically in live, OBS, and export sessions.

## Project persistence

The canonical version-one document is `project.horizon.json` inside a project directory. Assets may be project-relative files or Tempest asset URIs. Absolute external paths are recorded only as explicit linked assets.

Required top-level fields:

```json
{
  "schemaVersion": 1,
  "engineVersion": "0.1.0",
  "id": "...",
  "name": "...",
  "canvas": {},
  "assets": [],
  "layers": [],
  "bindings": [],
  "presets": [],
  "outputs": {}
}
```

Saving uses atomic replace and an autosave journal. Migrations are sequential pure functions and never overwrite the only copy of an older project. A portable archive export can be added after directory projects are stable.

## Undo and redo

All authored changes go through document commands. Continuous gestures coalesce into one transaction. Runtime audio, render caches, selection, viewport navigation, and meter values are not stored in history. Removing an asset reference does not delete the source file.

## Shared output architecture

### Editor and clean live output

Both use the same runtime bundle and project revision stream. The editor adds selection and guides as a separate, non-output overlay.

### OBS

Data Horizon hosts a localhost-only runtime page with a random per-session token in its URL. Tempest Broadcast loads that URL as a Browser Source. Project revisions and timestamped feature frames arrive through a local WebSocket. The page contains no editor code.

OBS WebSocket can create/update the Browser Source in version one. A dedicated Tempest vendor request can later make this a one-click Broadcast workflow.

### Offline export

The export host drives `frameIndex`, time, audio features, and seeded randomness explicitly. The runtime renders to the same WebGL2 graph, reads the final framebuffer, and passes frames to FFmpeg. Preview-only overlays are excluded by sink policy, not renderer forks.

### Later native output

Spout or another shared-texture sink can consume the final render target. It is an output adapter and must not introduce a second rendering implementation.

## Tempest contracts

Data Horizon registers the capabilities already described by Tempest Mainframe Studio. Before cross-application playback, add typed contracts for:

- `AudioFeatureFrame`
- `TransportFrame`
- `ProjectRevision`
- `ParameterCommand`
- `OutputEndpoint`
- Data Horizon project, visual, scene, effect, and preset asset metadata

The Bridge remains optional. Data Horizon must continue local editing and export when it is unavailable.

## Security and reliability

- Keep Electron context isolation and sandboxing enabled.
- Expose a narrow preload API; never pass arbitrary paths or shell commands from the renderer.
- Bind runtime HTTP/WebSocket services only to `127.0.0.1`.
- Require random session tokens and expire them when output stops.
- Resolve asset URIs through an allow-listed project/registry resolver.
- Compile shaders ahead of activation when possible; keep the last valid graph if a pass fails.
- Put resource limits on image dimensions, effect stack depth, group recursion, and GPU target allocation.

## Parity definition

"Identical renderer" means the same project revision, runtime build, shader sources, effect ordering, parameter evaluator, clock values, audio feature frames, random seed, color transforms, and output dimensions.

Different Chromium/CEF and GPU drivers may still produce small pixel differences. Automated parity uses exact state hashes and tolerance-based image comparison. Offline repeatability on the same runtime/GPU should be byte-stable where formats permit it.
