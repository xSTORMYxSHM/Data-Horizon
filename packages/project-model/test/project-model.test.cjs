'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../dist');

test('creates and validates a version-one project', () => {
  const project = model.createProject('Test Horizon');
  assert.equal(model.validateProject(project).ok, true);
  assert.equal(project.schemaVersion, 1);
  assert.equal(project.engineVersion, '0.20.5');
  assert.deepEqual(project.palettes, []);
  assert.deepEqual(project.guides, []);
  assert.equal(project.guidesLocked, false);
  assert.deepEqual(project.timeline, { duration: 8, fps: 60, loop: true, tracks: [] });
  assert.equal(model.createTextLayer().locked, false);
});

test('interpolates keyframes and combines animation presets into tracks', () => {
  let project = model.createProject();
  const layer = model.createTextLayer('LIVE');
  project.layers.push(layer);
  const target = `layer.${layer.id}.opacity`;
  project = model.upsertKeyframe(project, target, 0, 0, 'linear');
  project = model.upsertKeyframe(project, target, 2, 1, 'linear');
  assert.equal(model.evaluateTimeline(project.timeline, 1).get(target), 0.5);
  project = model.applyAnimationPreset(project, layer.id, 'slide-in');
  assert.ok(project.timeline.tracks.some((track) => track.target.endsWith('.transform.x')));
  assert.ok(project.timeline.tracks.some((track) => track.target.endsWith('.opacity')));
});

test('edits, mutes, removes, and evaluates advanced keyframes', () => {
  let project = model.createProject();
  const layer = model.createTextLayer('ADVANCED');
  project.layers.push(layer);
  const target = `layer.${layer.id}.opacity`;
  project = model.upsertKeyframe(project, target, 0, 0, 'easeIn');
  project = model.upsertKeyframe(project, target, 2, 1, 'bounce');
  const track = project.timeline.tracks[0];
  assert.equal(track.enabled, true);
  assert.ok(model.evaluateTimeline(project.timeline, 1).get(target) < 0.5);
  const second = track.keyframes[1];
  project = model.editAnimationKeyframes(project, [{ id: second.id, time: 3, value: 0.75, easing: 'easeOut' }]);
  assert.deepEqual(project.timeline.tracks[0].keyframes.map((keyframe) => keyframe.time), [0, 3]);
  assert.equal(project.timeline.tracks[0].keyframes[1].easing, 'easeOut');
  project = model.setAnimationTrackEnabled(project, track.id, false);
  assert.equal(model.evaluateTimeline(project.timeline, 1).has(target), false);
  project = model.removeAnimationKeyframes(project, project.timeline.tracks[0].keyframes.map((keyframe) => keyframe.id));
  assert.equal(project.timeline.tracks.length, 0);
});

test('reduces dense linear automation while preserving meaningful motion', () => {
  let project = model.createProject();
  const layer = model.createTextLayer('REDUCE');
  project.layers.push(layer);
  const target = `layer.${layer.id}.opacity`;
  for (let index = 0; index <= 10; index += 1) {
    const value = index === 5 ? .8 : index / 10;
    project = model.upsertKeyframe(project, target, index / 10, value, 'linear');
  }
  const trackId = project.timeline.tracks[0].id;
  project = model.reduceAnimationTrackKeyframes(project, trackId, .02);
  const reduced = project.timeline.tracks[0].keyframes;
  assert.ok(reduced.length < 11);
  assert.equal(reduced[0].time, 0);
  assert.equal(reduced.at(-1).time, 1);
  assert.ok(reduced.some((keyframe) => keyframe.time === .5 && keyframe.value === .8));
  assert.equal(model.validateProject(project).ok, true);
});

test('normalizes legacy projects into the 0.20.5 project contract', () => {
  const legacy = model.createProject();
  legacy.layers.push(model.createTextLayer('LEGACY'));
  delete legacy.layers[0].locked;
  delete legacy.timeline;
  delete legacy.palettes;
  delete legacy.guides;
  delete legacy.guidesLocked;
  legacy.engineVersion = '0.1.0';
  const normalized = model.normalizeProject(legacy);
  assert.equal(normalized.engineVersion, '0.20.5');
  assert.equal(normalized.timeline.duration, 8);
  assert.deepEqual(normalized.timeline.tracks, []);
  assert.deepEqual(normalized.palettes, []);
  assert.deepEqual(normalized.guides, []);
  assert.equal(normalized.guidesLocked, false);
  assert.equal(normalized.layers[0].locked, false);
});

test('normalizes and validates persistent canvas guides', () => {
  const project = model.createProject();
  project.guides = [
    { id: 'guide-v', orientation: 'vertical', position: 320 },
    { id: 'guide-h', orientation: 'horizontal', position: 240 }
  ];
  project.guidesLocked = true;
  assert.equal(model.validateProject(project).ok, true);
  const normalized = model.normalizeProject(project);
  assert.deepEqual(normalized.guides.map(guide => guide.position), [320, 240]);
  assert.equal(normalized.guidesLocked, true);
  project.guides.push({ id: 'guide-v', orientation: 'sideways', position: -1 });
  const invalid = model.validateProject(project).errors.join(' ');
  assert.match(invalid, /Duplicate guide id/);
  assert.match(invalid, /Invalid guide orientation/);
  assert.match(invalid, /Invalid guide position/);
});

test('validates portable four-role package palettes', () => {
  const project = model.createProject();
  project.palettes.push({ id: 'signal-neon', name: 'Signal Neon', colors: ['#091125', '#20466E', '#63558E', '#6BA8B5'], favorite: true });
  assert.equal(model.validateProject(project).ok, true);
  project.palettes.push({ id: 'signal-neon', name: 'Duplicate', colors: ['#000000', '#111111', '#222222', '#333333'] });
  assert.match(model.validateProject(project).errors.join(' '), /Duplicate palette id/);
  project.palettes[1].id = 'bad colors';
  project.palettes[1].colors = ['#000000'];
  const invalid = model.validateProject(project).errors.join(' ');
  assert.match(invalid, /invalid id/);
  assert.match(invalid, /exactly four/);
});

test('duplicates and removes layer animation tracks with their layer', () => {
  let project = model.createProject();
  const layer = model.createTextLayer('ANIMATED');
  project.layers.push(layer);
  project = model.upsertKeyframe(project, `layer.${layer.id}.opacity`, 0, 0);
  const duplicated = model.duplicateLayer(project, layer.id);
  assert.equal(duplicated.project.timeline.tracks.length, 2);
  const removed = model.removeLayer(duplicated.project, duplicated.selectedId);
  assert.equal(removed.timeline.tracks.length, 1);
});

test('extracts an outline into an independent audio-ready layer', () => {
  let project = model.createProject('Outline Extraction');
  project.assets.push({ id: 'asset-outline', name: 'Portrait', kind: 'image', uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' });
  const image = model.createImageLayer('asset-outline', 'Portrait');
  const outline = model.createEffect('outline');
  outline.color = '#FF38CE';
  image.effects.push(outline, model.createEffect('colorGrade'));
  project.layers.push(image);
  project.bindings.push({ id: 'binding-outline', source: 'mids', target: `layer.${image.id}.effect.${outline.id}.strength`, amount: .6, direction: 1, inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1, smoothingMs: 70, attackMs: 30, releaseMs: 180, curve: 'smoothstep', combine: 'add', enabled: true });
  project = model.upsertKeyframe(project, `layer.${image.id}.transform.x`, 0, 960);

  const result = model.extractEffectToLayer(project, image.id, outline.id);
  assert.ok(result.selectedId);
  assert.ok(result.effectId);
  assert.equal(result.project.layers.length, 2);
  const extracted = model.findLayer(result.project, result.selectedId);
  const source = model.findLayer(result.project, image.id);
  assert.equal(extracted.name, 'Portrait · Outline');
  assert.equal(extracted.assetId, 'asset-outline');
  assert.equal(extracted.blendMode, 'screen');
  assert.equal(extracted.effects.length, 1);
  assert.equal(extracted.effects[0].id, result.effectId);
  assert.equal(extracted.effects[0].outputMode, 'isolated');
  assert.equal(extracted.effects[0].color, '#FF38CE');
  assert.deepEqual(Object.keys(extracted.effects[0].parameters), ['strength', 'threshold', 'thickness', 'softness']);
  assert.equal(source.effects.length, 1);
  assert.equal(source.effects[0].type, 'colorGrade');
  assert.ok(result.project.bindings.some((binding) => binding.target === `layer.${extracted.id}.effect.${result.effectId}.strength`));
  assert.ok(result.project.timeline.tracks.some((track) => track.target === `layer.${extracted.id}.transform.x`));
  assert.equal(model.validateProject(result.project).ok, true);
});

test('creates, stores, validates, and inserts portable layer presets with fresh ids', () => {
  let project = model.createProject('Preset Source');
  project.assets.push({ id: 'asset-source', name: 'Backdrop', kind: 'image', uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' });
  const image = model.createImageLayer('asset-source', 'Preset Image');
  const title = model.createTextLayer('AUDIO READY', 'Preset Title');
  const bloom = model.createEffect('bloom');
  title.effects.push(bloom);
  const group = model.createGroupLayer('Signal Card', [title, image]);
  project.layers.push(group);
  project.bindings.push({ id: 'binding-source', source: 'beat', target: `layer.${title.id}.effect.${bloom.id}.intensity`, amount: .4, direction: 1, inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1, smoothingMs: 80, attackMs: 20, releaseMs: 140, curve: 'smoothstep', combine: 'add', enabled: true });
  project = model.applyAnimationPreset(project, title.id, 'slide-in');
  const preset = model.createLayerPreset(project, group.id, 'Reusable Signal Card', 'Portable group test');
  assert.ok(preset);
  assert.equal(model.validateLayerPreset(preset).ok, true);
  assert.equal(preset.assets.length, 1);
  assert.equal(preset.bindings.length, 1);
  assert.ok(preset.tracks.length >= 1);

  project = model.upsertLayerPreset(project, preset);
  assert.equal(project.presets.length, 1);
  const inserted = model.insertLayerPreset(project, preset);
  assert.ok(inserted.selectedId);
  assert.equal(inserted.project.assets.length, 1);
  assert.equal(inserted.project.layers[0].name, 'Reusable Signal Card');
  const insertedLayers = model.flattenLayers([inserted.project.layers[0]]);
  const originalIds = new Set(model.flattenLayers([group]).map((layer) => layer.id));
  assert.ok(insertedLayers.every((layer) => !originalIds.has(layer.id)));
  assert.notEqual(insertedLayers.find((layer) => layer.type === 'text').effects[0].id, bloom.id);
  assert.ok(inserted.project.bindings.some((binding) => insertedLayers.some((layer) => binding.target.includes(layer.id))));
  assert.equal(model.validateProject(inserted.project).ok, true);
  assert.equal(model.removeLayerPreset(inserted.project, preset.id).presets.length, 0);
});

test('imports a complete project as a fitted editable group with remapped dependencies', () => {
  const destination = model.createProject('Destination');
  destination.canvas = { width: 1920, height: 1080, background: [0, 0, 0, 1] };
  destination.timeline.duration = 4;
  let source = model.createProject('Square HUD');
  source.canvas = { width: 1000, height: 1000, background: [0, 0, 0, 0] };
  source.timeline.duration = 12;
  source.assets.push({ id: 'source-asset', name: 'Grid', kind: 'image', uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' });
  const image = model.createImageLayer('source-asset', 'Grid');
  image.transform = { x: 500, y: 500, width: 1000, height: 1000, rotation: 0 };
  const title = model.createTextLayer('READY', 'Title');
  title.transform = { x: 250, y: 200, width: 400, height: 100, rotation: 0 };
  source.layers.push(title, image);
  source.bindings.push({ id: 'source-binding', source: 'bass', target: `layer.${title.id}.transform.width`, amount: 1, direction: 1, inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 100, smoothingMs: 0, attackMs: 0, releaseMs: 0, curve: 'linear', combine: 'add', enabled: true });
  source = model.upsertKeyframe(source, `layer.${title.id}.transform.x`, 0, 100);
  source = model.upsertKeyframe(source, `layer.${title.id}.transform.x`, 10, 900);
  const inserted = model.insertProjectAsGroup(destination, source);
  assert.ok(inserted.selectedId);
  assert.equal(inserted.project.layers[0].type, 'group');
  assert.equal(inserted.project.layers[0].name, 'Square HUD');
  assert.equal(inserted.project.layers[0].children.length, 2);
  assert.equal(inserted.project.timeline.duration, 12);
  assert.equal(inserted.project.assets.length, 1);
  const importedTitle = model.flattenLayers([inserted.project.layers[0]]).find((layer) => layer.name === 'Title');
  assert.deepEqual(importedTitle.transform, { x: 690, y: 216, width: 432, height: 108, rotation: 0 });
  assert.notEqual(importedTitle.id, title.id);
  const importedBinding = inserted.project.bindings[0];
  assert.equal(importedBinding.target, `layer.${importedTitle.id}.transform.width`);
  assert.equal(importedBinding.outputMaximum, 108);
  const importedTrack = inserted.project.timeline.tracks.find((track) => track.target === `layer.${importedTitle.id}.transform.x`);
  assert.deepEqual(importedTrack.keyframes.map((keyframe) => keyframe.value), [528, 1392]);
  assert.equal(model.validateProject(inserted.project).ok, true);
});

test('preserves an imported project canvas background as an editable bottom layer', () => {
  const destination = model.createProject('Destination');
  const source = model.createProject('Opaque Scene');
  source.canvas.background = [0.1, 0.2, 0.3, 0.5];
  const inserted = model.insertProjectAsGroup(destination, source);
  assert.ok(inserted.selectedId);
  const group = inserted.project.layers[0];
  assert.equal(group.type, 'group');
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].name, 'Opaque Scene Canvas Background');
  assert.equal(group.children[0].type, 'shape');
  assert.equal(group.children[0].fill, '#1A334D');
  assert.equal(group.children[0].opacity, 0.5);
});

test('refreshes and detaches linked compositions without exposing authoring links', () => {
  const destination = model.createProject('Linked Destination');
  let source = model.createProject('Linked Source');
  source.canvas.background[3] = 0;
  const originalTitle = model.createTextLayer('VERSION ONE', 'Linked Title');
  source.layers.push(originalTitle);
  source.bindings.push({ id: 'source-binding-one', source: 'beat', target: `layer.${originalTitle.id}.opacity`, amount: 1, direction: 1, inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1, smoothingMs: 0, attackMs: 0, releaseMs: 0, curve: 'linear', combine: 'add', enabled: true });
  const linked = model.insertProjectAsGroup(destination, source, 'Reusable Link', { sourceKind: 'vault', locator: 'linked-source', displayName: 'Vault Linked Source' });
  const linkedId = linked.selectedId;
  assert.ok(linkedId);
  const customized = model.updateLayer(linked.project, linkedId, (layer) => {
    layer.opacity = 0.42;
    layer.transform.x = 720;
    layer.effects.push(model.createEffect('bloom'));
  });
  const oldChildId = model.findLayer(customized, linkedId).children[0].id;
  source = model.mutateProject(source, (draft) => {
    draft.name = 'Linked Source Updated';
    draft.layers[0].text = 'VERSION TWO';
    draft.layers.push(model.createShapeLayer('frame', 'New Frame'));
    draft.bindings = [];
  });
  const refreshed = model.refreshLinkedComposition(customized, linkedId, source);
  const group = model.findLayer(refreshed.project, linkedId);
  assert.equal(group.id, linkedId);
  assert.equal(group.opacity, 0.42);
  assert.equal(group.transform.x, 720);
  assert.equal(group.effects.length, 1);
  assert.equal(group.children.length, 2);
  assert.equal(group.children[0].text, 'VERSION TWO');
  assert.notEqual(group.children[0].id, oldChildId);
  assert.equal(refreshed.project.bindings.some((binding) => binding.target.includes(oldChildId)), false);
  assert.equal(group.linkedComposition.locator, 'linked-source');
  assert.equal(group.linkedComposition.displayName, 'Linked Source Updated');
  assert.equal(group.linkedComposition.sourceRevision, source.revision);
  const preset = model.createLayerPreset(refreshed.project, linkedId, 'Detached Preset');
  assert.equal(preset.layer.linkedComposition, undefined);
  const portable = model.stripCompositionLinks(refreshed.project);
  assert.equal(model.findLayer(portable, linkedId).linkedComposition, undefined);
  assert.ok(model.findLayer(portable, linkedId).children.length);
  const detached = model.detachLinkedComposition(refreshed.project, linkedId);
  assert.equal(model.findLayer(detached, linkedId).linkedComposition, undefined);
  assert.equal(model.validateProject(detached).ok, true);
});

test('duplicates, moves, groups, and removes nested layers immutably', () => {
  const original = model.createProject();
  original.assets.push({ id: 'asset-1', name: 'Image', kind: 'image', uri: 'data:image/png;base64,', mimeType: 'image/png' });
  const first = model.addLayer(original, model.createImageLayer('asset-1', 'Original'));
  const duplicated = model.duplicateLayer(first, first.layers[0].id);
  assert.equal(duplicated.project.layers.length, 2);
  assert.equal(first.layers.length, 1);
  const grouped = model.wrapLayerInGroup(duplicated.project, duplicated.selectedId);
  assert.equal(grouped.project.layers[0].type, 'group');
  assert.equal(grouped.project.layers[0].children.length, 1);
  const removed = model.removeLayer(grouped.project, grouped.project.layers[0].children[0].id);
  assert.equal(removed.layers[0].children.length, 0);
});

test('relocates multiple layer roots across the tree without creating nesting cycles', () => {
  const project = model.createProject('Layer Drop Test');
  const a = model.createShapeLayer('rectangle', 'A');
  const b = model.createShapeLayer('rectangle', 'B');
  const c = model.createShapeLayer('rectangle', 'C');
  const d = model.createShapeLayer('rectangle', 'D');
  const group = model.createGroupLayer('Group', [c, d]);
  project.layers = [a, group, b];

  const reordered = model.relocateLayers(project, [b.id], a.id, 'before');
  assert.deepEqual(reordered.layers.map((layer) => layer.name), ['B', 'A', 'Group']);
  assert.deepEqual(project.layers.map((layer) => layer.name), ['A', 'Group', 'B']);

  const nested = model.relocateLayers(reordered, [a.id, b.id], group.id, 'inside');
  assert.deepEqual(nested.layers.map((layer) => layer.name), ['Group']);
  assert.deepEqual(nested.layers[0].children.map((layer) => layer.name), ['B', 'A', 'C', 'D']);

  const cycled = model.relocateLayers(nested, [group.id], c.id, 'inside');
  assert.deepEqual(cycled.layers[0].children.map((layer) => layer.name), ['B', 'A', 'C', 'D']);

  const movedTogether = model.relocateLayers(nested, [c.id, b.id], d.id, 'after');
  assert.deepEqual(movedTogether.layers[0].children.map((layer) => layer.name), ['A', 'D', 'B', 'C']);

  movedTogether.layers[0].children[2].locked = true;
  const locked = model.relocateLayers(movedTogether, [b.id], '', 'root-end');
  assert.deepEqual(locked.layers[0].children.map((layer) => layer.name), ['A', 'D', 'B', 'C']);
});

test('stores, normalizes, validates, updates, and cleans named layer selection sets', () => {
  const project = model.createProject('Selection Set Test');
  const a = model.createShapeLayer('rectangle', 'A');
  const b = model.createShapeLayer('rectangle', 'B');
  const c = model.createShapeLayer('rectangle', 'C');
  project.layers = [a, model.createGroupLayer('Group', [c]), b];
  const saved = model.upsertLayerSelectionSet(project, 'Hero Elements', [b.id, c.id]);
  assert.ok(saved.setId);
  assert.deepEqual(saved.project.layerSelectionSets[0].layerIds, [c.id, b.id]);
  assert.equal(model.validateProject(saved.project).ok, true);

  const updated = model.upsertLayerSelectionSet(saved.project, 'Primary', [a.id], saved.setId);
  assert.equal(updated.project.layerSelectionSets[0].name, 'Primary');
  assert.deepEqual(updated.project.layerSelectionSets[0].layerIds, [a.id]);
  const cleaned = model.removeLayer(updated.project, a.id);
  assert.equal(cleaned.layerSelectionSets.length, 0);

  const legacy = structuredClone(project);
  delete legacy.layerSelectionSets;
  assert.deepEqual(model.normalizeProject(legacy).layerSelectionSets, []);
  saved.project.layerSelectionSets[0].layerIds.push('missing-layer');
  assert.equal(model.validateProject(saved.project).ok, false);
});

test('history store supports undo and redo', () => {
  const history = new model.HistoryStore({ value: 1 });
  history.commit({ value: 2 });
  assert.equal(history.undo().value, 1);
  assert.equal(history.redo().value, 2);
});

test('image elements expose authored transforms as audio targets', () => {
  const layer = model.createImageLayer('asset-1', 'Overlay');
  assert.deepEqual(layer.transform, { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 });
  const labels = model.parameterTargets(layer).map((target) => target.label);
  for (const label of ['Position X', 'Position Y', 'Width', 'Height', 'Rotation']) assert.ok(labels.includes(label));
});

test('creates native text, frame, and spectrum elements', () => {
  const text = model.createTextLayer('LIVE', 'Live Label');
  const frame = model.createShapeLayer('frame', 'Camera Border');
  const spectrum = model.createSpectrumLayer();
  assert.equal(text.type, 'text');
  assert.equal(frame.shape, 'frame');
  assert.equal(spectrum.type, 'spectrum');
  assert.ok(model.parameterTargets(frame).some((target) => target.label === 'Shape · Stroke Width'));
  assert.ok(model.parameterTargets(spectrum).some((target) => target.label === 'Spectrum · Gain'));
});

test('creates styled HUD text and normalizes legacy text layers', () => {
  const alert = model.createHudTextLayer('broadcast-alert');
  const project = model.createProject();
  project.layers.push(alert);
  assert.equal(model.validateProject(project).ok, true);
  assert.equal(alert.text.includes('\n'), true);
  assert.equal(alert.backgroundOpacity, .9);
  assert.equal(alert.borderWidth, 5);
  assert.equal(alert.shadowBlur, 18);

  const legacy = model.createTextLayer('LEGACY');
  for (const property of ['verticalAlignment', 'italic', 'letterSpacing', 'lineHeight', 'padding', 'backgroundColor', 'backgroundOpacity', 'borderColor', 'borderWidth', 'cornerRadius', 'outlineColor', 'outlineWidth', 'shadowColor', 'shadowBlur']) delete legacy[property];
  project.layers = [legacy];
  const normalized = model.normalizeProject(project).layers[0];
  assert.equal(normalized.verticalAlignment, 'middle');
  assert.equal(normalized.lineHeight, 1.15);
  assert.equal(normalized.backgroundOpacity, 0);
  assert.equal(normalized.shadowBlur, 0);
});

test('creates reusable vertical-region mask presets', () => {
  const sky = model.createRegionMask('sky');
  const foreground = model.createRegionMask('foreground');
  assert.equal(sky.type, 'regionMask');
  assert.equal(sky.parameters.top, 0);
  assert.ok(sky.parameters.bottom < foreground.parameters.top);
  assert.equal(foreground.parameters.bottom, 1);
});

test('creates, validates, normalizes, and duplicates painted masks', () => {
  const project = model.createProject();
  const layer = model.createShapeLayer('rectangle', 'Masked Plate');
  const mask = model.createPaintMask();
  mask.paintMask.strokes.push({ id: 'stroke-1', mode: 'hide', size: 0.2, softness: 0.5, opacity: 1, points: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }] });
  layer.effects.push(mask);
  project.layers.push(layer);
  assert.equal(model.validateProject(project).ok, true);
  const duplicate = model.duplicateLayer(project, layer.id).project.layers[0];
  assert.equal(duplicate.effects[0].type, 'paintMask');
  assert.notEqual(duplicate.effects[0].paintMask.strokes[0].id, 'stroke-1');
  const legacyMask = model.createEffect('paintMask');
  delete legacyMask.paintMask;
  project.layers[0].effects = [legacyMask];
  assert.equal(model.normalizeProject(project).layers[0].effects[0].paintMask.base, 1);
});

test('stores non-destructive paint and erase strokes on an extracted result', () => {
  const project = model.createProject('Retouch Test');
  const layer = model.createShapeLayer('rectangle', 'Extracted Outline');
  const paint = model.createPaintLayer();
  paint.paintLayer.strokes.push(
    { id: 'paint-stroke', mode: 'paint', size: .12, softness: .35, opacity: .8, color: '#FF38CE', points: [{ x: .2, y: .3 }, { x: .45, y: .5 }] },
    { id: 'erase-stroke', mode: 'erase', size: .08, softness: .2, opacity: 1, color: '#FFFFFF', points: [{ x: .35, y: .4 }] }
  );
  layer.effects.push(paint);
  project.layers.push(layer);
  assert.equal(model.validateProject(project).ok, true);
  assert.equal(model.parameterTargets(layer).some((target) => target.label === 'Paint / Erase · opacity'), true);
  const duplicate = model.duplicateLayer(project, layer.id).project.layers[0];
  assert.deepEqual(duplicate.effects[0].paintLayer.strokes.map((stroke) => stroke.mode), ['paint', 'erase']);
  assert.notEqual(duplicate.effects[0].paintLayer.strokes[0].id, 'paint-stroke');
  const legacy = model.createEffect('paintLayer');
  delete legacy.paintLayer;
  delete legacy.parameters.opacity;
  project.layers[0].effects = [legacy];
  const normalized = model.normalizeProject(project).layers[0].effects[0];
  assert.deepEqual(normalized.paintLayer.strokes, []);
  assert.equal(normalized.parameters.opacity, 1);
});

test('creates waveform, particle, and broadcast template layers', () => {
  const waveform = model.createWaveformLayer();
  const particles = model.createParticleLayer();
  const lowerThird = model.createBroadcastTemplate('lower-third');
  const alert = model.createBroadcastTemplate('alert');
  const transition = model.createBroadcastTemplate('transition');
  assert.equal(waveform.type, 'waveform');
  assert.equal(particles.type, 'particles');
  assert.ok(model.parameterTargets(waveform).some((target) => target.label === 'Waveform · Amplitude'));
  assert.ok(model.parameterTargets(particles).some((target) => target.label === 'Particles · Speed'));
  assert.deepEqual([lowerThird.children.length, alert.children.length, transition.children.length], [4, 4, 3]);
  for (const template of [lowerThird, alert, transition]) {
    const project = model.createProject();
    project.layers.push(template);
    assert.equal(model.validateProject(project).ok, true);
  }
});

test('creates complete open, Quartic Pulse, and Tempest Broadcast starter projects', () => {
  const blank = model.createProjectTemplate('blank');
  const openKit = model.createProjectTemplate('open-broadcast-kit');
  const quartic = model.createProjectTemplate('quartic-visualizer');
  const border = model.createProjectTemplate('tempest-window-border');
  const overlay = model.createProjectTemplate('tempest-hud-overlay');
  const transition = model.createProjectTemplate('tempest-transition');
  assert.equal(blank.layers.length, 0);
  assert.equal(openKit.name, 'Open Broadcast Kit');
  assert.equal(openKit.canvas.background[3], 0);
  assert.equal(openKit.layers.length, 5);
  assert.equal(openKit.presets.length, 5);
  assert.ok(openKit.bindings.length >= 8);
  assert.ok(openKit.presets.every((preset) => model.validateLayerPreset(preset).ok));
  for (const preset of openKit.presets) {
    const inserted = model.insertLayerPreset(model.createProject('Preset Target'), preset);
    assert.ok(inserted.selectedId, `${preset.name} should insert a selected root layer`);
    assert.equal(model.validateProject(inserted.project).ok, true, `${preset.name} should remain a valid project after insertion`);
    assert.equal(inserted.project.bindings.length, preset.bindings.length, `${preset.name} should preserve its audio drivers`);
    assert.equal(inserted.project.timeline.tracks.length, preset.tracks.length, `${preset.name} should preserve its animation tracks`);
  }
  assert.doesNotMatch(JSON.stringify(openKit), /TEMPEST|QUARTIC/i);
  assert.equal(quartic.name, 'Quartic Pulse Visualizer');
  assert.ok(quartic.layers.some((layer) => layer.type === 'spectrum'));
  assert.ok(quartic.bindings.length >= 6);
  assert.equal(quartic.palettes.length, 1);
  assert.equal(border.canvas.background[3], 0);
  assert.ok(border.layers.some((layer) => layer.type === 'shape' && layer.shape === 'frame'));
  assert.equal(overlay.canvas.background[3], 0);
  assert.ok(model.flattenLayers(overlay.layers).some((layer) => layer.name === 'Lower Third'));
  assert.equal(transition.canvas.background[3], 1);
  for (const project of [blank, openKit, quartic, border, overlay, transition]) {
    assert.equal(model.validateProject(project).ok, true, model.validateProject(project).errors.join(' '));
  }
});

test('creates editable animated paths with audio-addressable flow parameters', () => {
  const path = model.createPathLayer();
  const project = model.createProject();
  project.layers.push(path);
  assert.equal(path.type, 'path');
  assert.equal(path.points.length, 4);
  assert.equal(model.validateProject(project).ok, true);
  const labels = model.parameterTargets(path).map((target) => target.label);
  for (const label of ['Path · Stroke Width', 'Path · Glow', 'Path · Dash Length', 'Path · Gap Length', 'Path · Flow Speed']) assert.ok(labels.includes(label));
});
