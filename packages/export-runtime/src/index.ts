import { flattenLayers, validateProject, type HorizonProject } from '@data-horizon/project-model';

export type PublishTarget = 'quartic-pulse' | 'tempest-broadcast';
export type TempestElementKind = 'full-scene' | 'window-border' | 'overlay' | 'hud' | 'lower-third' | 'alert' | 'background' | 'transition';

export interface PublishOptions {
  target: PublishTarget;
  name: string;
  tempestKind?: TempestElementKind;
  transparent?: boolean;
  delivery?: 'portable' | 'asset-vault';
}

export interface PublishValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'data-horizon-export';
}

export function validatePublish(project: HorizonProject, options: PublishOptions): PublishValidation {
  const projectValidation = validateProject(project);
  const errors = [...projectValidation.errors];
  const warnings: string[] = [];
  const layers = flattenLayers(project.layers);
  if (!options.name.trim()) errors.push('The published item needs a name.');
  if (!layers.some((layer) => layer.type !== 'group' && layer.visible)) errors.push('The project has no visible visual layers.');
  if (project.canvas.width < 16 || project.canvas.height < 16) errors.push('The canvas is too small to publish.');
  if (options.target === 'tempest-broadcast' && !options.tempestKind) errors.push('Choose a Tempest Broadcast element type.');
  if (options.target === 'quartic-pulse') {
    if (options.transparent) warnings.push('Quartic Pulse visualizers normally render an opaque full-canvas scene.');
    const externalAssets = project.assets.filter((asset) => !asset.uri.startsWith('data:image/'));
    if (externalAssets.length) errors.push('Quartic Pulse packages require all image assets to be embedded in the project.');
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function createBundleManifest(project: HorizonProject, options: PublishOptions): Record<string, unknown> {
  const slug = slugify(options.name);
  const id = `com.tempestmainframe.data-horizon.${slug}`;
  const vaultDelivery = options.target === 'tempest-broadcast' && options.delivery === 'asset-vault';
  const entrypoint = vaultDelivery ? `${slug}.html` : 'runtime/index.html';
  const common = {
    schemaVersion: 1,
    id,
    name: options.name.trim(),
    version: project.engineVersion,
    createdBy: 'Data Horizon Studio',
    engine: { id: 'data-horizon-runtime', version: project.engineVersion },
    project: 'project.horizon.json',
    preview: 'preview.png',
    entrypoint,
    canvas: { ...project.canvas, transparent: Boolean(options.transparent) },
    audio: {
      contract: 'tempest.audio-features.v1',
      sources: ['bass', 'mids', 'highs', 'beat', 'rms'],
      parameterBindings: project.bindings.length
    },
    runtime: { browser: 'chromium-webgl2', localFile: true, deterministic: true }
  };
  if (options.target === 'quartic-pulse') {
    return {
      ...common,
      format: 'data-horizon.quartic-visualizer',
      target: 'quartic-pulse',
      visualizer: {
        key: slug,
        category: 'CUSTOM',
        mode: 'full-canvas',
        acceptsTransportClock: true,
        acceptsOfflineFrames: true
      },
      palettes: (project.palettes ?? []).map((palette) => ({
        id: palette.id,
        name: palette.name.trim(),
        colors: palette.colors.map((color) => color.toUpperCase()),
        favorite: Boolean(palette.favorite)
      }))
    };
  }
  const kind = options.tempestKind ?? 'overlay';
  return {
    ...common,
    format: 'data-horizon.tempest-element-pack',
    target: 'tempest-broadcast',
    elementPack: {
      kind,
      composited: true,
      sourceName: `Data Horizon // ${options.name.trim()}`,
      browserSource: {
        localFile: entrypoint,
        width: project.canvas.width,
        height: project.canvas.height,
        shutdownWhenHidden: false,
        refreshWhenActive: false,
        transparent: Boolean(options.transparent)
      },
      protocols: { starting: true, live: true, brb: true, ending: true }
    },
    ...(vaultDelivery ? {
      assetVault: {
        bank: 'OVERLAY',
        stableFile: entrypoint,
        updateKey: id
      }
    } : {})
  };
}

export function serializeRuntimeProject(project: HorizonProject): string {
  const json = JSON.stringify(project).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.__DATA_HORIZON_PROJECT__ = ${json};\n`;
}
