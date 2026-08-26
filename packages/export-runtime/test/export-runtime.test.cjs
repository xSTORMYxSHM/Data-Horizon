'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../project-model/dist');
const exporter = require('../dist');

function projectWithImage() {
  const project = model.createProject('Signal Frame');
  project.assets.push({ id: 'asset-1', name: 'Frame', kind: 'image', uri: 'data:image/png;base64,', mimeType: 'image/png' });
  project.layers.push(model.createImageLayer('asset-1', 'Frame'));
  return project;
}

test('builds a Quartic Pulse visualizer manifest', () => {
  const project = projectWithImage();
  project.palettes.push(
    { id: 'signal-neon', name: 'Signal Neon', colors: ['#091125', '#20466e', '#63558E', '#6BA8B5'], favorite: true },
    { id: 'signal-ember', name: 'Signal Ember', colors: ['#17090D', '#6E2633', '#C76543', '#F0C36C'] }
  );
  const manifest = exporter.createBundleManifest(project, { target: 'quartic-pulse', name: 'Signal World' });
  assert.equal(manifest.format, 'data-horizon.quartic-visualizer');
  assert.equal(manifest.entrypoint, 'runtime/index.html');
  assert.equal(manifest.version, '0.20.0');
  assert.equal(manifest.engine.version, '0.20.0');
  assert.equal(manifest.visualizer.acceptsOfflineFrames, true);
  assert.equal(manifest.palettes.length, 2);
  assert.deepEqual(manifest.palettes[0], { id: 'signal-neon', name: 'Signal Neon', colors: ['#091125', '#20466E', '#63558E', '#6BA8B5'], favorite: true });
});

test('builds a transparent Tempest window-border pack', () => {
  const project = projectWithImage();
  const options = { target: 'tempest-broadcast', name: 'Neon Window', tempestKind: 'window-border', transparent: true };
  assert.equal(exporter.validatePublish(project, options).ok, true);
  const manifest = exporter.createBundleManifest(project, options);
  assert.equal(manifest.format, 'data-horizon.tempest-element-pack');
  assert.equal(manifest.elementPack.kind, 'window-border');
  assert.equal(manifest.elementPack.browserSource.transparent, true);
});

test('builds a stable Tempest Asset Vault manifest', () => {
  const project = model.createProjectTemplate('tempest-hud-overlay', 'Vault HUD');
  const options = { target: 'tempest-broadcast', name: 'Vault HUD', tempestKind: 'hud', transparent: true, delivery: 'asset-vault' };
  assert.equal(exporter.validatePublish(project, options).ok, true);
  const manifest = exporter.createBundleManifest(project, options);
  assert.equal(manifest.entrypoint, 'vault-hud.html');
  assert.equal(manifest.elementPack.browserSource.localFile, 'vault-hud.html');
  assert.equal(manifest.assetVault.bank, 'OVERLAY');
  assert.equal(manifest.assetVault.stableFile, 'vault-hud.html');
  assert.equal(manifest.assetVault.updateKey, 'com.tempestmainframe.data-horizon.vault-hud');
});

test('rejects a publish with no visible visual content', () => {
  const result = exporter.validatePublish(model.createProject(), { target: 'quartic-pulse', name: 'Empty' });
  assert.equal(result.ok, false);
});

test('accepts the native layer and effect set for Quartic Pulse packages', () => {
  const textProject = projectWithImage();
  textProject.layers.push(model.createTextLayer('NOT RASTERIZED', 'Text Overlay'));
  textProject.layers.push(model.createShapeLayer('frame', 'Frame'));
  textProject.layers.push(model.createSpectrumLayer());
  textProject.layers.push(model.createWaveformLayer());
  textProject.layers.push(model.createParticleLayer());
  textProject.layers.push(model.createPathLayer());
  assert.equal(exporter.validatePublish(textProject, { target: 'quartic-pulse', name: 'Native Layers' }).ok, true);

  const effectProject = projectWithImage();
  effectProject.layers[0].effects.push(model.createEffect('bloom'));
  effectProject.layers[0].effects.push(model.createEffect('scanlines'));
  assert.equal(exporter.validatePublish(effectProject, { target: 'quartic-pulse', name: 'Native Effects' }).ok, true);
});
