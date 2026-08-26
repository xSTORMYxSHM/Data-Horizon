'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const requestedQuarticRoot = process.argv.find((argument) => argument.startsWith('--quartic-root='))?.slice('--quartic-root='.length);
const quarticRoot = path.resolve(requestedQuarticRoot || path.join(root, '..', 'Quartic Pulse', 'Development Build'));
const model = require(path.join(root, 'packages', 'project-model', 'dist'));
const exporter = require(path.join(root, 'packages', 'export-runtime', 'dist'));
const { VisualizerPackageManager } = require(path.join(quarticRoot, 'src', 'main', 'visualizer-package-manager'));

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'data-horizon-quartic-roundtrip-'));
  const source = path.join(temporary, 'signal-roundtrip');
  const runtime = path.join(source, 'runtime');
  try {
    let project = model.createProject('Data Horizon Round Trip');
    project.assets.push({
      id: 'asset-signal',
      name: 'Signal',
      kind: 'image',
      mimeType: 'image/svg+xml',
      uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Crect width="16" height="16" fill="cyan"/%3E%3C/svg%3E'
    });
    project.layers.push(model.createImageLayer('asset-signal', 'Signal'));
    project.layers.push(model.createTextLayer('NATIVE LAYERS ONLINE', 'Native Text'));
    project.layers.push(model.createShapeLayer('frame', 'Native Frame'));
    project.layers.push(model.createSpectrumLayer('Native Spectrum'));
    project.layers.push(model.createWaveformLayer('Native Waveform'));
    project.layers.push(model.createParticleLayer('Native Particles'));
    const pathLayer = model.createPathLayer('Native Path');
    project.layers.push(pathLayer);
    project.layers[0].effects.push(model.createEffect('bloom'), model.createEffect('scanlines'));
    project = model.upsertKeyframe(project, `layer.${pathLayer.id}.source.flowSpeed`, 0, 80, 'easeInOut');
    project = model.upsertKeyframe(project, `layer.${pathLayer.id}.source.flowSpeed`, 4, 180, 'easeInOut');
    project.palettes.push(
      { id: 'signal-neon', name: 'Signal Neon', colors: ['#091125', '#20466E', '#63558E', '#6BA8B5'], favorite: true },
      { id: 'signal-ember', name: 'Signal Ember', colors: ['#17090D', '#6E2633', '#C76543', '#F0C36C'] }
    );
    const options = { target: 'quartic-pulse', name: 'Data Horizon Round Trip' };
    const validation = exporter.validatePublish(project, options);
    assert.equal(validation.ok, true, validation.errors.join(' '));
    const manifest = exporter.createBundleManifest(project, options);
    await fs.mkdir(runtime, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(source, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
      fs.writeFile(path.join(source, 'project.horizon.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8'),
      fs.writeFile(path.join(runtime, 'project.js'), exporter.serializeRuntimeProject(project), 'utf8'),
      fs.copyFile(path.join(root, 'apps', 'studio-desktop', 'dist', 'renderer', 'runtime.html'), path.join(runtime, 'index.html')),
      fs.copyFile(path.join(root, 'apps', 'studio-desktop', 'dist', 'renderer', 'app.js'), path.join(runtime, 'app.js')),
      fs.copyFile(path.join(root, 'apps', 'studio-desktop', 'dist', 'renderer', 'styles.css'), path.join(runtime, 'styles.css'))
    ]);

    const manager = new VisualizerPackageManager(path.join(temporary, 'quartic-installed'));
    const preview = await manager.preview(source);
    assert.equal(preview.paletteCount, 2);
    assert.equal(preview.updating, false);
    const installed = await manager.install(source);
    assert.equal(installed.packageId, manifest.id);
    assert.deepEqual(installed.palettes[0].colors, project.palettes[0].colors);
    const loaded = await manager.load(installed.styleId);
    assert.equal(loaded.project.name, project.name);
    assert.deepEqual(loaded.project.layers.map((layer) => layer.type), ['image', 'text', 'shape', 'spectrum', 'waveform', 'particles', 'path']);
    assert.equal(loaded.project.timeline.tracks.length, 1);
    assert.equal((await manager.list()).length, 1);
    assert.equal(await manager.remove(installed.styleId), true);
    assert.equal((await manager.list()).length, 0);
    console.log(`DATA_HORIZON_QUARTIC_ROUNDTRIP_OK ${installed.packageId} ${installed.paletteCount} palettes ${loaded.project.layers.length} native layers`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
