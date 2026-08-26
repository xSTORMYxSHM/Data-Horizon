import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createBundleManifest,
  serializeRuntimeProject,
  slugify,
  validatePublish,
  type PublishOptions
} from '@data-horizon/export-runtime';
import { stripCompositionLinks, validateLayerPreset, validateProject, type HorizonLayerPreset, type HorizonProject } from '@data-horizon/project-model';

let mainWindow: BrowserWindow | null = null;
let activeProjectPath = '';
let smokePreset: HorizonLayerPreset | null = null;
const smokeTest = process.argv.includes('--smoke-test');

interface PublishBundleRequest {
  project: HorizonProject;
  options: PublishOptions;
  previewPng: string;
}

interface VaultElementSummary {
  slug: string;
  id: string;
  name: string;
  kind: string;
  width: number;
  height: number;
  transparent: boolean;
  version: string;
  sourceName: string;
  previewPng: string;
  updatedAt: number;
}

async function waitForSmokeReady(window: BrowserWindow): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await window.webContents.executeJavaScript(`({
      ready: Boolean(window.__dataHorizonReady),
      diagnostics: window.__dataHorizonDiagnostics || null,
      layerRows: document.querySelectorAll('.layer-row').length,
      effectCards: document.querySelectorAll('.effect-card').length,
      canvasWidth: document.querySelector('#horizonCanvas')?.width || 0,
      canvasHeight: document.querySelector('#horizonCanvas')?.height || 0
    })`) as Record<string, unknown>;
    if (state.ready) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The Data Horizon renderer did not become ready.');
}

async function captureSmoke(window: BrowserWindow): Promise<void> {
  const outputDirectory = path.resolve(__dirname, '..', '..', '..', 'test-output');
  await fs.mkdir(outputDirectory, { recursive: true });
  const state = await waitForSmokeReady(window);
  const inputScale = window.webContents.getZoomFactor();
  state.uiScale = inputScale;
  const interactions = await window.webContents.executeJavaScript(`(() => {
    const errors = [];
    window.addEventListener('error', event => errors.push(event.error?.message || event.message), { once: false });
    const timelineTracksBefore = document.querySelectorAll('.timeline-track').length;
    const scrubber = document.querySelector('#timelineScrubber');
    if (scrubber) {
      scrubber.value = '0.5';
      scrubber.dispatchEvent(new Event('input'));
    }
    document.querySelector('#addKeyframeButton')?.click();
    const timelineKeysAfterAdd = document.querySelectorAll('.timeline-key').length;
    document.querySelector('#undoButton')?.click();
    const play = document.querySelector('#timelinePlayButton');
    play?.click();
    const timelinePlaying = play?.classList.contains('active');
    play?.click();
    const collapseTimeline = document.querySelector('#timelineCollapseButton');
    collapseTimeline?.click();
    const timelineCollapsed = document.querySelector('.timeline-panel')?.classList.contains('timeline-collapsed');
    const collapsedTimelineHeight = getComputedStyle(document.querySelector('.studio-shell')).getPropertyValue('--timeline-height').trim();
    collapseTimeline?.click();
    const timelineExpanded = !document.querySelector('.timeline-panel')?.classList.contains('timeline-collapsed');
    document.querySelector('[data-layer-tab="assets"]')?.click();
    const assetCards = document.querySelectorAll('.asset-card').length;
    document.querySelector('.asset-card button')?.click();
    const afterAssetPlace = document.querySelectorAll('.layer-row').length;
    document.querySelector('#undoButton')?.click();
    document.querySelector('[data-layer-tab="masks"]')?.click();
    const maskCards = document.querySelectorAll('.mask-card').length;
    document.querySelector('[data-layer-tab="layers"]')?.click();
    const transformToggle = document.querySelector('#showTransformInput');
    transformToggle?.click();
    const transformHidden = Boolean(document.querySelector('#canvasSelection')?.hidden);
    transformToggle?.click();
    const before = document.querySelectorAll('.layer-row').length;
    const duplicate = document.querySelector('#duplicateLayerButton');
    const duplicateDisabled = Boolean(duplicate?.disabled);
    duplicate?.click();
    const afterDuplicate = document.querySelectorAll('.layer-row').length;
    const undo = document.querySelector('#undoButton');
    const undoDisabled = Boolean(undo?.disabled);
    undo?.click();
    const afterUndo = document.querySelectorAll('.layer-row').length;
    const zoom = document.querySelector('#zoomPresetInput');
    if (zoom) {
      zoom.value = '0.5';
      zoom.dispatchEvent(new Event('change'));
    }
    const manualZoomWidth = Math.round(document.querySelector('#horizonCanvas')?.getBoundingClientRect().width || 0);
    if (zoom) {
      zoom.value = 'fit';
      zoom.dispatchEvent(new Event('change'));
    }
    const guides = document.querySelector('#guidesToggleButton');
    guides?.click();
    const guidesHidden = document.querySelector('#canvasGuides')?.classList.contains('hidden');
    guides?.click();
    const snap = document.querySelector('#snapToggleButton');
    snap?.click();
    const snapDisabled = !snap?.classList.contains('active');
    snap?.click();
    document.querySelector('[data-menu="file"]')?.click();
    return { before, afterDuplicate, afterUndo, duplicateDisabled, undoDisabled, selectedRows: document.querySelectorAll('.layer-row.selected').length, timelineTracksBefore, timelineKeysAfterAdd, timelinePlaying, timelineCollapsed, collapsedTimelineHeight, timelineExpanded, timelineTime: document.querySelector('#timelineTimeValue')?.textContent, assetCards, afterAssetPlace, maskCards, transformHidden, menuOpen: !document.querySelector('#menuPopover')?.hidden, menuItems: document.querySelectorAll('#menuPopover button').length, manualZoomWidth, guidesHidden, snapDisabled, uiScaleButtonText: document.querySelector('#uiScaleButton')?.textContent, uiScaleSelectValue: document.querySelector('#uiScaleInput')?.value, uiScaleOutput: document.querySelector('#uiScaleValue')?.textContent, errors };
  })()`) as Record<string, unknown>;
  state.interactions = interactions;
  const effectPresetState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#menuPopover').hidden = true;
    document.querySelector('[data-scroll-target="effectSection"]')?.click();
    const inspector = document.querySelector('.inspector-panel');
    const effectSection = document.querySelector('#effectSection');
    if (inspector && effectSection) inspector.scrollTop = Math.max(0, effectSection.getBoundingClientRect().top - inspector.getBoundingClientRect().top + inspector.scrollTop - 32);
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const selected = before.layers.find(layer => document.querySelector('.layer-row.selected')?.dataset.layerId === layer.id) || before.layers[0];
    const beforeEffects = selected?.effects?.length || 0;
    const beforeTracks = before.timeline?.tracks?.length || 0;
    const beforeScroll = inspector?.scrollTop || 0;
    const preset = document.querySelector('#effectPresetInput');
    if (preset) { preset.value = 'dream-glow'; preset.dispatchEvent(new Event('change')); }
    const motion = document.querySelector('#effectPresetMotionInput');
    if (motion) { motion.value = 'gentle'; motion.dispatchEvent(new Event('change')); }
    const cycle = document.querySelector('#effectPresetCycleInput');
    if (cycle) { cycle.value = '1.5'; cycle.dispatchEvent(new Event('change')); }
    document.querySelector('#previewEffectPresetButton')?.click();
    const previewAutosave = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const previewNonDestructive = (previewAutosave.layers.find(layer => layer.id === selected?.id)?.effects?.length || 0) === beforeEffects;
    const previewActive = document.querySelector('#previewEffectPresetButton')?.textContent?.includes('Stop') || false;
    document.querySelector('#previewEffectPresetButton')?.click();
    document.querySelector('#applyEffectPresetButton')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const afterLayer = after.layers.find(layer => layer.id === selected?.id);
    return {
      effectPresetOptions: document.querySelectorAll('#effectPresetInput option').length,
      effectPresetDescription: document.querySelector('#effectPresetDescription')?.textContent || '',
      effectPresetAddedCount: (afterLayer?.effects?.length || 0) - beforeEffects,
      effectPresetAddedTypes: afterLayer?.effects?.slice(beforeEffects).map(effect => effect.type) || [],
      effectPresetMotionOptions: document.querySelectorAll('#effectPresetMotionInput option').length,
      effectPresetCycleSeconds: document.querySelector('#effectPresetCycleInput')?.value,
      effectPresetPreviewNonDestructive: previewNonDestructive,
      effectPresetPreviewActive: previewActive,
      effectPresetAddedTracks: (after.timeline?.tracks?.length || 0) - beforeTracks,
      effectPresetTimelinePlaying: document.querySelector('#timelinePlayButton')?.classList.contains('active') || false,
      effectPresetBadges: [...document.querySelectorAll('.effect-status-badges')].map(badge => badge.textContent || ''),
      effectPresetScrollBefore: beforeScroll,
      effectPresetScrollAfterApply: inspector?.scrollTop || 0,
      effectPresetScrollStableAfterApply: Math.abs((inspector?.scrollTop || 0) - beforeScroll) < 2
    };
  })()`);
  Object.assign(interactions, effectPresetState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 260));
  const effectPresetImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase25-effect-presets.png'), effectPresetImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const effectPresetUndoState = await window.webContents.executeJavaScript(`(() => {
    const inspector = document.querySelector('.inspector-panel');
    const beforeUndoScroll = inspector?.scrollTop || 0;
    document.querySelector('#undoButton')?.click();
    return {
      effectPresetScrollAfterUndo: inspector?.scrollTop || 0,
      effectPresetScrollStableAfterUndo: Math.abs((inspector?.scrollTop || 0) - beforeUndoScroll) < 2
    };
  })()`);
  Object.assign(interactions, effectPresetUndoState);
  const autoKeyState = await window.webContents.executeJavaScript(`(() => {
    const scrubber = document.querySelector('#timelineScrubber');
    if (scrubber) { scrubber.value = '2.25'; scrubber.dispatchEvent(new Event('input')); }
    const autoKey = document.querySelector('#autoKeyButton');
    if (autoKey?.getAttribute('aria-pressed') === 'true') autoKey.click();
    autoKey?.click();
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const row = document.querySelector('.effect-parameter[data-parameter-target]');
    const target = row?.dataset.parameterTarget || '';
    const input = row?.querySelector('input[type="range"]');
    if (input) {
      const maximum = Number(input.max || 1);
      const minimum = Number(input.min || 0);
      input.value = String(Math.min(maximum, Math.max(minimum, Number(input.value) + (maximum - minimum) * .17)));
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    }
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const track = after.timeline?.tracks?.find(item => item.target === target);
    const renderedRow = document.querySelector('.effect-parameter[data-parameter-target="' + target + '"]');
    return {
      autoKeyActive: document.querySelector('#autoKeyButton')?.getAttribute('aria-pressed') === 'true',
      autoKeyTarget: target,
      autoKeyTrackCreated: Boolean(track),
      autoKeyTimes: track?.keyframes?.map(keyframe => keyframe.time) || [],
      autoKeyTrackDelta: (after.timeline?.tracks?.length || 0) - (before.timeline?.tracks?.length || 0),
      autoKeyTargetSelected: document.querySelector('#animationTargetInput')?.value === target,
      autoKeyAnimatedRow: renderedRow?.classList.contains('animated') || false,
      autoKeyEffectBadge: renderedRow?.closest('.effect-card')?.querySelector('.effect-status-badges')?.textContent || '',
      autoKeyOutput: renderedRow?.querySelector('output')?.textContent || ''
    };
  })()`);
  Object.assign(interactions, autoKeyState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const autoKeyImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase26-auto-keyframing.png'), autoKeyImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const animationEditorState = await window.webContents.executeJavaScript(`(() => {
    const visible = document.querySelector('[data-workspace-visible="timeline"]');
    if (visible && !visible.checked) { visible.checked = true; visible.dispatchEvent(new Event('change')); }
    const floating = document.querySelector('[data-workspace-floating="timeline"]');
    if (floating?.checked) { floating.checked = false; floating.dispatchEvent(new Event('change')); }
    if (document.querySelector('.timeline-panel')?.classList.contains('timeline-collapsed')) document.querySelector('#timelineCollapseButton')?.click();
    const height = document.querySelector('#workspaceTimelineHeight');
    if (height) { height.value = '230'; height.dispatchEvent(new Event('change')); }
    const filter = document.querySelector('#timelineTrackFilterInput');
    if (filter) { filter.value = 'selected'; filter.dispatchEvent(new Event('change')); }
    const keys = [...document.querySelectorAll('.timeline-key')];
    const key = keys[keys.length - 1];
    if (key) {
      const rect = key.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, button: 0 }));
    }
    const easing = document.querySelector('#timelineKeyEasingInput');
    if (easing && !easing.disabled) { easing.value = 'bounce'; easing.dispatchEvent(new Event('change')); }
    document.querySelector('#duplicateKeyframesButton')?.click();
    const selectedBeforeDrag = [...document.querySelectorAll('.timeline-key.selected')].map(marker => marker.title);
    const dragged = document.querySelector('.timeline-key.selected');
    if (dragged) {
      const rect = dragged.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      dragged.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 34, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 34, clientY: y, button: 0 }));
    }
    const work = document.querySelector('#timelineWorkAreaButton');
    if (work?.getAttribute('aria-pressed') !== 'true') work?.click();
    const loopStart = document.querySelector('#timelineLoopStartInput');
    const loopEnd = document.querySelector('#timelineLoopEndInput');
    if (loopStart) loopStart.value = '0.5';
    if (loopEnd) loopEnd.value = '3.5';
    loopEnd?.dispatchEvent(new Event('change'));
    const firstTrack = document.querySelector('.timeline-track');
    const mute = firstTrack?.querySelector('.timeline-track-identity button:first-child');
    mute?.click();
    const mutedProject = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const muted = mutedProject.timeline?.tracks?.some(track => track.enabled === false) || false;
    const solo = document.querySelector('.timeline-track .timeline-track-identity button:nth-child(2)');
    solo?.click();
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const selectedAfterDrag = [...document.querySelectorAll('.timeline-key.selected')].map(marker => marker.title);
    return {
      animationEditorVisible: getComputedStyle(document.querySelector('.timeline-panel')).display !== 'none',
      animationTrackRows: document.querySelectorAll('.timeline-track').length,
      animationSelectedKeys: document.querySelectorAll('.timeline-key.selected').length,
      animationKeyEditorVisible: !document.querySelector('#timelineKeyEditor')?.hidden,
      animationSelectedBeforeDrag: selectedBeforeDrag,
      animationSelectedAfterDrag: selectedAfterDrag,
      animationBounceKeys: project.timeline.tracks.flatMap(track => track.keyframes).filter(keyframe => keyframe.easing === 'bounce').length,
      animationTrackMuted: muted,
      animationTrackSolo: Boolean(document.querySelector('.timeline-track .timeline-track-identity button:nth-child(2).active')),
      animationWorkAreaActive: document.querySelector('#timelineWorkAreaButton')?.getAttribute('aria-pressed') === 'true',
      animationLoopStart: document.querySelector('#timelineLoopStartInput')?.value,
      animationLoopEnd: document.querySelector('#timelineLoopEndInput')?.value,
      animationPlayheads: document.querySelectorAll('.timeline-playhead').length,
      animationFilterOptions: document.querySelectorAll('#timelineTrackFilterInput option').length
    };
  })()`);
  Object.assign(interactions, animationEditorState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const animationEditorImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase27-animation-editor.png'), animationEditorImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const curveEditorState = await window.webContents.executeJavaScript(`(() => {
    const toggle = document.querySelector('#timelineViewToggleButton');
    if (toggle?.getAttribute('aria-pressed') !== 'true') toggle?.click();
    const target = document.querySelector('#animationTargetInput')?.value || '';
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const beforeTrack = before.timeline?.tracks?.find(track => track.target === target);
    const point = document.querySelector('.curve-key.selected') || document.querySelector('.curve-key');
    const beforePoint = point ? { x: point.getAttribute('cx'), y: point.getAttribute('cy') } : null;
    if (point) {
      const rect = point.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      point.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 24, clientY: y - 16, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 24, clientY: y - 16, button: 0 }));
    }
    const movedPoint = document.querySelector('.curve-key.selected');
    document.querySelector('#copyKeyframesButton')?.click();
    const scrubber = document.querySelector('#timelineScrubber');
    if (scrubber) { scrubber.value = '4'; scrubber.dispatchEvent(new Event('input')); }
    document.querySelector('#pasteKeyframesButton')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const afterTrack = after.timeline?.tracks?.find(track => track.target === target);
    return {
      curveViewActive: document.querySelector('.timeline-panel')?.classList.contains('curve-view') || false,
      curveEditorVisible: !document.querySelector('#timelineCurveEditor')?.hidden,
      curvePoints: document.querySelectorAll('.curve-key').length,
      curvePathVisible: Boolean(document.querySelector('.curve-line')),
      curveGridLines: document.querySelectorAll('.curve-grid').length,
      curveDragChanged: Boolean(beforePoint && movedPoint && (beforePoint.x !== movedPoint.getAttribute('cx') || beforePoint.y !== movedPoint.getAttribute('cy'))),
      curvePastedDelta: (afterTrack?.keyframes?.length || 0) - (beforeTrack?.keyframes?.length || 0),
      curvePastedKeys: document.querySelectorAll('.curve-key.selected').length,
      curveFrameSnapping: document.querySelector('#timelineSnapFramesButton')?.getAttribute('aria-pressed') === 'true',
      curveKeysOnFrames: afterTrack?.keyframes?.every(key => Math.abs(key.time * after.timeline.fps - Math.round(key.time * after.timeline.fps)) < .001) || false
    };
  })()`);
  Object.assign(interactions, curveEditorState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const curveEditorImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase28-curve-editor.png'), curveEditorImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const motionPathState = await window.webContents.executeJavaScript(`(() => {
    const selectedId = document.querySelector('.layer-row.selected')?.dataset.layerId || '';
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const xTarget = 'layer.' + selectedId + '.transform.x';
    const yTarget = 'layer.' + selectedId + '.transform.y';
    document.querySelector('#addMotionKeyButton')?.click();
    const added = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const addedX = added.timeline?.tracks?.find(track => track.target === xTarget);
    const addedY = added.timeline?.tracks?.find(track => track.target === yTarget);
    const point = [...document.querySelectorAll('.motion-path-key')].sort((left, right) => Number(left.dataset.motionTime) - Number(right.dataset.motionTime)).at(-1);
    const pointTime = Number(point?.dataset.motionTime || 0);
    const xBefore = addedX?.keyframes?.find(key => Math.abs(key.time - pointTime) < .001)?.value;
    const yBefore = addedY?.keyframes?.find(key => Math.abs(key.time - pointTime) < .001)?.value;
    if (point) {
      const rect = point.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      point.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 29, clientX: x, clientY: y, button: 0 }));
      point.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 29, clientX: x + 38, clientY: y + 22, button: 0 }));
      point.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 29, clientX: x + 38, clientY: y + 22, button: 0 }));
    }
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const xTrack = after.timeline?.tracks?.find(track => track.target === xTarget);
    const yTrack = after.timeline?.tracks?.find(track => track.target === yTarget);
    const xAfter = xTrack?.keyframes?.find(key => Math.abs(key.time - pointTime) < .001)?.value;
    const yAfter = yTrack?.keyframes?.find(key => Math.abs(key.time - pointTime) < .001)?.value;
    return {
      motionPathVisible: !document.querySelector('#motionPathOverlay')?.hasAttribute('hidden'),
      motionPathToggleActive: document.querySelector('#motionPathToggleButton')?.getAttribute('aria-pressed') === 'true',
      motionPathKeys: document.querySelectorAll('.motion-path-key').length,
      motionPathSamples: (document.querySelector('#motionPathLine')?.getAttribute('points') || '').split(' ').filter(Boolean).length,
      motionPathCurrentMarker: Boolean(document.querySelector('.motion-path-current')),
      motionPathPairedTracks: Boolean(xTrack && yTrack),
      motionPathPairedTime: Boolean(xTrack?.keyframes?.some(key => Math.abs(key.time - pointTime) < .001) && yTrack?.keyframes?.some(key => Math.abs(key.time - pointTime) < .001)),
      motionPathDragChanged: xBefore !== xAfter || yBefore !== yAfter,
      motionPathSelectedKeys: document.querySelectorAll('.curve-key.selected, .timeline-key.selected').length,
      motionPathPointTime: pointTime,
      motionPathVersion: after.engineVersion
    };
  })()`);
  Object.assign(interactions, motionPathState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const motionPathImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase29-motion-paths.png'), motionPathImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const multiLayerLayoutState = await window.webContents.executeJavaScript(`(() => {
    if (document.querySelector('#autoKeyButton')?.getAttribute('aria-pressed') === 'true') document.querySelector('#autoKeyButton')?.click();
    const rows = [...document.querySelectorAll('.layer-row')].slice(0, 3);
    if (rows[0]) rows[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    if (rows[1]) rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    if (rows[2]) rows[2].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    const selectedIds = [...document.querySelectorAll('.layer-row.selected')].map(row => row.dataset.layerId);
    document.querySelector('[data-align-layers="hcenter"]')?.click();
    document.querySelector('[data-distribute-layers="vertical"]')?.click();
    const arranged = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const flat = layers => layers.flatMap(layer => [layer, ...(layer.children ? flat(layer.children) : [])]);
    const arrangedLayers = flat(arranged.layers).filter(layer => selectedIds.includes(layer.id));
    const arrangedPositions = arrangedLayers.map(layer => ({ id: layer.id, x: layer.transform?.x, y: layer.transform?.y }));
    const selection = document.querySelector('#canvasSelection');
    if (selection) {
      const rect = selection.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      selection.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 30, clientX: x, clientY: y, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 30, clientX: x + 32, clientY: y + 18, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 30, clientX: x + 32, clientY: y + 18, button: 0 }));
    }
    const moved = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const movedLayers = flat(moved.layers).filter(layer => selectedIds.includes(layer.id));
    const deltas = movedLayers.map(layer => {
      const before = arrangedPositions.find(item => item.id === layer.id);
      return { x: (layer.transform?.x || 0) - (before?.x || 0), y: (layer.transform?.y || 0) - (before?.y || 0) };
    });
    document.querySelector('#lockLayersButton')?.click();
    const locked = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const lockedLayers = flat(locked.layers).filter(layer => selectedIds.includes(layer.id));
    const ys = arrangedPositions.map(item => item.y).filter(value => Number.isFinite(value)).sort((left, right) => left - right);
    const spacing = ys.length >= 3 ? [ys[1] - ys[0], ys[2] - ys[1]] : [];
    return {
      multiLayerSelected: document.querySelectorAll('.layer-row.selected').length,
      multiLayerPrimary: document.querySelectorAll('.layer-row.primary').length,
      multiLayerSelectionLabel: document.querySelector('#layoutSelectionCount')?.textContent || '',
      multiLayerCanvasCentered: arrangedLayers.every(layer => Math.abs((layer.transform?.x || 0) - arranged.canvas.width / 2) < .01),
      multiLayerDistributed: spacing.length === 2 && Math.abs(spacing[0] - spacing[1]) < .01,
      multiLayerGroupMoved: deltas.length === selectedIds.length && deltas.every(delta => Math.abs(delta.x - deltas[0].x) < .01 && Math.abs(delta.y - deltas[0].y) < .01) && Math.abs(deltas[0]?.x || 0) > .01,
      multiLayerLocked: lockedLayers.length === selectedIds.length && lockedLayers.every(layer => layer.locked === true),
      multiLayerLockedRows: document.querySelectorAll('.layer-row.locked.selected').length,
      multiLayerInspectorDisabled: document.querySelector('#layerNameInput')?.disabled || false,
      multiLayerDeleteDisabled: document.querySelector('#deleteLayerButton')?.disabled || false,
      multiLayerAlignButtons: document.querySelectorAll('[data-align-layers]').length,
      multiLayerDistributeButtons: document.querySelectorAll('[data-distribute-layers]').length,
      multiLayerReferenceOptions: document.querySelectorAll('#alignmentReferenceInput option').length,
      multiLayerVersion: locked.engineVersion
    };
  })()`);
  Object.assign(interactions, multiLayerLayoutState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const multiLayerLayoutImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase30-multi-layer-layout.png'), multiLayerLayoutImage.toPNG());
  window.hide();
  window.setOpacity(1);
  await window.webContents.executeJavaScript(`(() => { const button = document.querySelector('#lockLayersButton'); if (button?.textContent === 'Unlock') button.click(); })()`);
  const groupTransformState = await window.webContents.executeJavaScript(`(() => {
    const flat = layers => layers.flatMap(layer => [layer, ...(layer.children ? flat(layer.children) : [])]);
    const selectedIds = [...document.querySelectorAll('.layer-row.selected')].map(row => row.dataset.layerId);
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const fixtures = [
      { x: 560, y: 350, width: 260, height: 150, rotation: 0 },
      { x: 960, y: 540, width: 300, height: 180, rotation: 0 },
      { x: 1360, y: 730, width: 240, height: 140, rotation: 0 }
    ];
    selectedIds.forEach((id, index) => {
      document.querySelector('.layer-row[data-layer-id="' + id + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (const [selector, key] of [['#layerXInput', 'x'], ['#layerYInput', 'y'], ['#layerWidthInput', 'width'], ['#layerHeightInput', 'height'], ['#layerRotationInput', 'rotation']]) {
        const input = document.querySelector(selector);
        if (input) { input.value = String(fixtures[index][key]); input.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });
    selectedIds.forEach((id, index) => document.querySelector('.layer-row[data-layer-id="' + id + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: index > 0 })));
    const before = readProject();
    const beforeLayers = flat(before.layers).filter(layer => selectedIds.includes(layer.id));
    const beforeTransforms = new Map(beforeLayers.map(layer => [layer.id, { ...layer.transform }]));
    const selection = document.querySelector('#canvasSelection');
    const resize = selection?.querySelector('[data-handle="se"]');
    if (selection && resize) {
      const rect = resize.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      resize.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, clientX: x, clientY: y, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, clientX: x + 48, clientY: y + 32, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31, clientX: x + 48, clientY: y + 32, button: 0 }));
    }
    const resized = readProject();
    const resizedLayers = flat(resized.layers).filter(layer => selectedIds.includes(layer.id));
    const resizeChanged = resizedLayers.length === selectedIds.length && resizedLayers.every(layer => {
      const prior = beforeTransforms.get(layer.id);
      return prior && layer.transform.width > prior.width && layer.transform.height > prior.height;
    });
    const resizedTransforms = new Map(resizedLayers.map(layer => [layer.id, { ...layer.transform }]));
    const rotate = selection?.querySelector('[data-handle="rotate"]');
    if (selection && rotate) {
      const selectionRect = selection.getBoundingClientRect();
      const handleRect = rotate.getBoundingClientRect();
      const x = handleRect.left + handleRect.width / 2;
      const y = handleRect.top + handleRect.height / 2;
      const centerX = selectionRect.left + selectionRect.width / 2;
      const centerY = selectionRect.top + selectionRect.height / 2;
      rotate.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 32, clientX: x, clientY: y, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 32, clientX: centerX + 90, clientY: centerY, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 32, clientX: centerX + 90, clientY: centerY, button: 0 }));
    }
    const rotated = readProject();
    const rotatedLayers = flat(rotated.layers).filter(layer => selectedIds.includes(layer.id));
    const rotationDeltas = rotatedLayers.map(layer => layer.transform.rotation - (resizedTransforms.get(layer.id)?.rotation || 0));
    const rotationChanged = rotationDeltas.length === selectedIds.length && Math.abs(rotationDeltas[0] || 0) >= 15 && rotationDeltas.every(delta => Math.abs(delta - rotationDeltas[0]) < .01);
    const arrangementRotated = rotatedLayers.some(layer => {
      const prior = resizedTransforms.get(layer.id);
      return prior && (Math.abs(layer.transform.x - prior.x) > .01 || Math.abs(layer.transform.y - prior.y) > .01);
    });
    if (selection) {
      const rect = selection.getBoundingClientRect();
      const canvasRect = document.querySelector('#horizonCanvas').getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endX = canvasRect.left + canvasRect.width / 2;
      selection.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 33, clientX: x, clientY: y, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 33, clientX: endX, clientY: y, button: 0 }));
      selection.dataset.smokePointerX = String(endX);
      selection.dataset.smokePointerY = String(y);
    }
    return {
      groupTransformSelected: selectedIds.length,
      groupTransformResizeChanged: resizeChanged,
      groupTransformRotationChanged: rotationChanged,
      groupTransformArrangementRotated: arrangementRotated,
      groupTransformSmartGuideVisible: !document.querySelector('#smartGuideOverlay')?.hidden && document.querySelector('#smartGuideOverlay')?.classList.contains('show-x'),
      groupTransformReadoutVisible: !document.querySelector('#canvasTransformReadout')?.hidden,
      groupTransformReadout: document.querySelector('#canvasTransformReadout')?.textContent || '',
      groupTransformSelectionLabel: document.querySelector('#canvasSelectionLabel')?.textContent || '',
      groupTransformSmartToggle: document.querySelector('#smartGuidesToggleButton')?.getAttribute('aria-pressed') || ''
    };
  })()`);
  Object.assign(interactions, groupTransformState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const groupTransformImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase31-group-transforms.png'), groupTransformImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const groupTransformCompletion = await window.webContents.executeJavaScript(`(() => {
    const selection = document.querySelector('#canvasSelection');
    const x = Number(selection?.dataset.smokePointerX || 0);
    const y = Number(selection?.dataset.smokePointerY || 0);
    selection?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 33, clientX: x, clientY: y, button: 0 }));
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const result = {
      groupTransformGuideCleared: document.querySelector('#smartGuideOverlay')?.hidden || false,
      groupTransformVersion: project.engineVersion
    };
    document.querySelector('.layer-row.primary')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return result;
  })()`);
  Object.assign(interactions, groupTransformCompletion);
  const rulerGuideState = await window.webContents.executeJavaScript(`(() => {
    const orientation = document.querySelector('#guideOrientationInput');
    const position = document.querySelector('#guidePositionInput');
    if (orientation && position) {
      orientation.value = 'vertical';
      orientation.dispatchEvent(new Event('change', { bubbles: true }));
      position.value = '640';
      document.querySelector('#addGuideButton')?.click();
      orientation.value = 'horizontal';
      orientation.dispatchEvent(new Event('change', { bubbles: true }));
      position.value = '360';
      document.querySelector('#addGuideButton')?.click();
    }
    const canvas = document.querySelector('#horizonCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    const ruler = document.querySelector('#horizontalRuler');
    if (ruler) {
      const rect = ruler.getBoundingClientRect();
      const x = rect.left + rect.width * .7;
      const y = rect.top + rect.height / 2;
      ruler.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 34, clientX: x, clientY: y, button: 0 }));
      const targetY = canvasRect.top + canvasRect.height * .62;
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 34, clientX: x, clientY: targetY, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 34, clientX: x, clientY: targetY, button: 0 }));
    }
    const vertical = document.querySelector('.custom-guide.vertical');
    if (vertical) {
      const rect = vertical.getBoundingClientRect();
      const x = rect.left;
      const y = rect.top + 80;
      const targetX = canvasRect.left + canvasRect.width * (720 / 1920);
      vertical.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 35, clientX: x, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 35, clientX: targetX, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 35, clientX: targetX, clientY: y, button: 0 }));
    }
    document.querySelector('#lockGuidesButton')?.click();
    const selection = document.querySelector('#canvasSelection');
    if (selection) {
      const rect = selection.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const targetX = canvasRect.left + canvasRect.width * (720 / 1920);
      selection.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 36, clientX: x, clientY: y, button: 0 }));
      selection.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 36, clientX: targetX, clientY: y, button: 0 }));
      selection.dataset.guideSmokePointerX = String(targetX);
      selection.dataset.guideSmokePointerY = String(y);
    }
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    return {
      rulerGuideCount: project.guides?.length || 0,
      rulerGuideVerticalPosition: project.guides?.find(guide => guide.orientation === 'vertical')?.position,
      rulerGuideHorizontalCount: project.guides?.filter(guide => guide.orientation === 'horizontal').length || 0,
      rulerGuideLocked: project.guidesLocked === true,
      rulerGuideDomCount: document.querySelectorAll('.custom-guide').length,
      rulerGuideLockedDomCount: document.querySelectorAll('.custom-guide.locked').length,
      rulerHorizontalTicks: document.querySelectorAll('#horizontalRuler .ruler-tick').length,
      rulerVerticalTicks: document.querySelectorAll('#verticalRuler .ruler-tick').length,
      rulerGuideCountLabel: document.querySelector('#guideCountLabel')?.textContent || '',
      rulerGuideSmartSnap: !document.querySelector('#smartGuideOverlay')?.hidden && document.querySelector('#smartGuideOverlay')?.classList.contains('show-x'),
      rulerGuideReadout: document.querySelector('#canvasTransformReadout')?.textContent || '',
      rulerGuideVersion: project.engineVersion
    };
  })()`);
  Object.assign(interactions, rulerGuideState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const rulerGuideImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase32-rulers-guides.png'), rulerGuideImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const rulerGuideCompletion = await window.webContents.executeJavaScript(`(() => {
    const selection = document.querySelector('#canvasSelection');
    const x = Number(selection?.dataset.guideSmokePointerX || 0);
    const y = Number(selection?.dataset.guideSmokePointerY || 0);
    selection?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 36, clientX: x, clientY: y, button: 0 }));
    const smartCleared = document.querySelector('#smartGuideOverlay')?.hidden || false;
    if (document.querySelector('#lockGuidesButton')?.textContent === 'Unlock') document.querySelector('#lockGuidesButton')?.click();
    return { rulerGuideSmartCleared: smartCleared, rulerGuideUnlockedAfterTest: document.querySelector('#lockGuidesButton')?.textContent === 'Lock' };
  })()`);
  Object.assign(interactions, rulerGuideCompletion);
  const marqueeSelectionState = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('#horizonCanvas');
    const rect = canvas.getBoundingClientRect();
    const fixtures = [
      { x: 400, y: 450, width: 140, height: 140 },
      { x: 800, y: 450, width: 140, height: 140 },
      { x: 1200, y: 450, width: 140, height: 140 }
    ];
    const ids = [];
    for (const fixture of fixtures) {
      document.querySelector('#addShapeButton')?.click();
      const id = document.querySelector('.layer-row.primary')?.dataset.layerId;
      if (id) ids.push(id);
      for (const [selector, key] of [['#layerXInput', 'x'], ['#layerYInput', 'y'], ['#layerWidthInput', 'width'], ['#layerHeightInput', 'height']]) {
        const input = document.querySelector(selector);
        if (input) { input.value = String(fixture[key]); input.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }
    const point = (x, y) => ({ x: rect.left + x / 1920 * rect.width, y: rect.top + y / 1080 * rect.height });
    const drag = (left, top, right, bottom, modifiers = {}, release = true, pointerId = 40) => {
      const start = point(left, top);
      const end = point(right, bottom);
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, clientX: start.x, clientY: start.y, button: 0, ...modifiers }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId, clientX: end.x, clientY: end.y, button: 0, ...modifiers }));
      if (release) canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId, clientX: end.x, clientY: end.y, button: 0, ...modifiers }));
      return end;
    };
    const selected = () => new Set([...document.querySelectorAll('.layer-row.selected')].map(row => row.dataset.layerId));
    drag(300, 350, 900, 550, {}, true, 40);
    const contained = selected();
    drag(1120, 350, 1280, 550, { shiftKey: true }, true, 41);
    const added = selected();
    drag(320, 370, 480, 530, { altKey: true }, true, 42);
    const subtracted = selected();
    drag(720, 370, 880, 530, { ctrlKey: true }, true, 43);
    const toggled = selected();
    const mode = document.querySelector('#marqueeModeInput');
    if (mode) { mode.value = 'intersect'; mode.dispatchEvent(new Event('change', { bubbles: true })); }
    drag(465, 430, 500, 480, {}, true, 44);
    const intersected = selected();
    if (mode) { mode.value = 'contain'; mode.dispatchEvent(new Event('change', { bubbles: true })); }
    const activeEnd = drag(300, 340, 1300, 560, {}, false, 45);
    canvas.dataset.marqueeFixtureIds = JSON.stringify(ids);
    canvas.dataset.marqueePointerX = String(activeEnd.x);
    canvas.dataset.marqueePointerY = String(activeEnd.y);
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    return {
      marqueeFixtureCount: ids.length,
      marqueeContainTargets: ids.slice(0, 2).every(id => contained.has(id)),
      marqueeAddTarget: ids.every(id => added.has(id)),
      marqueeSubtractTarget: !subtracted.has(ids[0]) && subtracted.has(ids[1]) && subtracted.has(ids[2]),
      marqueeToggleTarget: !toggled.has(ids[1]) && toggled.has(ids[2]),
      marqueeIntersectTarget: intersected.has(ids[0]),
      marqueeVisible: !document.querySelector('#canvasMarquee')?.hidden,
      marqueeLabel: document.querySelector('#canvasMarqueeLabel')?.textContent || '',
      marqueeModeOptions: document.querySelectorAll('#marqueeModeInput option').length,
      marqueeVersion: project.engineVersion
    };
  })()`);
  Object.assign(interactions, marqueeSelectionState);
  window.setOpacity(0);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 320));
  const marqueeSelectionImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase33-canvas-marquee.png'), marqueeSelectionImage.toPNG());
  window.hide();
  window.setOpacity(1);
  const marqueeSelectionCompletion = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('#horizonCanvas');
    const ids = JSON.parse(canvas.dataset.marqueeFixtureIds || '[]');
    const x = Number(canvas.dataset.marqueePointerX || 0);
    const y = Number(canvas.dataset.marqueePointerY || 0);
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 45, clientX: x, clientY: y, button: 0 }));
    const selected = new Set([...document.querySelectorAll('.layer-row.selected')].map(row => row.dataset.layerId));
    const result = {
      marqueeCleared: document.querySelector('#canvasMarquee')?.hidden || false,
      marqueeFinalTargets: ids.every(id => selected.has(id)),
      marqueeFinalSelected: selected.size
    };
    ids.forEach((id, index) => document.querySelector('.layer-row[data-layer-id="' + id + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: index > 0 })));
    document.querySelector('#deleteLayerButton')?.click();
    document.querySelector('.layer-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return result;
  })()`);
  Object.assign(interactions, marqueeSelectionCompletion);
  await window.webContents.executeJavaScript(`(() => {
    if (document.querySelector('#autoKeyButton')?.getAttribute('aria-pressed') === 'true') document.querySelector('#autoKeyButton')?.click();
  })()`);
  const audioEffectPresetState = await window.webContents.executeJavaScript(`(() => {
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const selectedId = document.querySelector('.layer-row.selected')?.dataset.layerId;
    const beforeLayer = before.layers.find(layer => layer.id === selectedId);
    const beforeEffects = beforeLayer?.effects?.length || 0;
    const beforeBindings = before.bindings.length;
    const preset = document.querySelector('#effectPresetInput');
    if (preset) { preset.value = 'audio-pulse-outline'; preset.dispatchEvent(new Event('change')); }
    document.querySelector('#applyEffectPresetButton')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const afterLayer = after.layers.find(layer => layer.id === selectedId);
    const addedEffects = afterLayer?.effects?.slice(beforeEffects) || [];
    const addedIds = new Set(addedEffects.map(effect => effect.id));
    const addedBindings = after.bindings.slice(beforeBindings).filter(binding => addedIds.has(binding.target.split('.')[3]));
    document.querySelector('#undoButton')?.click();
    return {
      audioEffectPresetEffectTypes: addedEffects.map(effect => effect.type),
      audioEffectPresetBindingSources: addedBindings.map(binding => binding.source),
      audioEffectPresetBindingTargets: addedBindings.map(binding => binding.target.split('.').pop()),
      audioEffectPresetGeneratedPreview: document.querySelector('#mockAudioToggle')?.checked || false
    };
  })()`);
  Object.assign(interactions, audioEffectPresetState);
  const paintMaskSetup = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#menuPopover').hidden = true;
    document.querySelector('[data-add-effect="paintMask"]')?.click();
    const size = document.querySelector('#maskBrushSizeInput');
    if (size) { size.value = '180'; size.dispatchEvent(new Event('input')); }
    const canvas = document.querySelector('#horizonCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      maskToolActive: document.querySelector('#maskBrushToolButton')?.classList.contains('active'),
      paintMaskCards: [...document.querySelectorAll('.effect-card')].filter(card => card.textContent.includes('Painted Mask')).length,
      start: { x: Math.round(rect.left + rect.width * .42), y: Math.round(rect.top + rect.height * .1) },
      end: { x: Math.round(rect.left + rect.width * .58), y: Math.round(rect.top + rect.height * .1) }
    };
  })()`);
  const paintStart = paintMaskSetup.start as { x: number; y: number };
  const paintEnd = paintMaskSetup.end as { x: number; y: number };
  const start = { x: Math.round(paintStart.x * inputScale), y: Math.round(paintStart.y * inputScale) };
  const end = { x: Math.round(paintEnd.x * inputScale), y: Math.round(paintEnd.y * inputScale) };
  window.webContents.sendInputEvent({ type: 'mouseMove', x: start.x, y: start.y });
  window.webContents.sendInputEvent({ type: 'mouseDown', x: start.x, y: start.y, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: end.x, y: end.y, movementX: end.x - start.x, movementY: end.y - start.y });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: end.x, y: end.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const paintMaskState = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const masks = project.layers.flatMap(layer => layer.effects || []).filter(effect => effect.type === 'paintMask');
    return {
      paintedMaskStrokes: masks.reduce((total, effect) => total + (effect.paintMask?.strokes?.length || 0), 0),
      paintedMaskPoints: masks.reduce((total, effect) => total + (effect.paintMask?.strokes || []).reduce((sum, stroke) => sum + stroke.points.length, 0), 0),
      paintedMaskValid: masks.every(effect => effect.paintMask && Array.isArray(effect.paintMask.strokes)),
      maskCursorExists: Boolean(document.querySelector('#maskBrushCursor')),
      paintedMaskPasses: window.__dataHorizonDiagnostics?.passes,
      paintedMaskDraws: window.__dataHorizonDiagnostics?.drawCalls,
      paintedMaskRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, paintMaskSetup, paintMaskState);
  const pathSetup = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#addPathButton')?.click();
    const canvas = document.querySelector('#horizonCanvas');
    const rect = canvas.getBoundingClientRect();
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const path = project.layers.find(layer => layer.type === 'path');
    return {
      pathToolActive: document.querySelector('#addPathButton')?.classList.contains('active'),
      pathOverlayVisible: !document.querySelector('#pathPointOverlay')?.hasAttribute('hidden'),
      pathPointHandles: document.querySelectorAll('#pathPointOverlay circle').length,
      pathPointsBefore: path?.points?.length || 0,
      click: { x: Math.round(rect.left + rect.width * .5), y: Math.round(rect.top + rect.height * .65) }
    };
  })()`);
  const pathClickCss = pathSetup.click as { x: number; y: number };
  const pathClick = { x: Math.round(pathClickCss.x * inputScale), y: Math.round(pathClickCss.y * inputScale) };
  window.webContents.sendInputEvent({ type: 'mouseDown', x: pathClick.x, y: pathClick.y, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: pathClick.x, y: pathClick.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const pathDragSetup = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const path = project.layers.find(layer => layer.type === 'path');
    const handle = document.querySelector('#pathPointOverlay circle');
    const rect = handle?.getBoundingClientRect();
    const start = { x: Math.round((rect?.left || 0) + (rect?.width || 0) / 2), y: Math.round((rect?.top || 0) + (rect?.height || 0) / 2) };
    return {
      pathPointHandlesAfterAdd: document.querySelectorAll('#pathPointOverlay circle').length,
      firstPointBeforeDrag: path?.points?.[0] || null,
      dragStart: start,
      dragEnd: { x: start.x + 34, y: start.y + 20 }
    };
  })()`);
  const dragStartCss = pathDragSetup.dragStart as { x: number; y: number };
  const dragEndCss = pathDragSetup.dragEnd as { x: number; y: number };
  const dragStart = { x: Math.round(dragStartCss.x * inputScale), y: Math.round(dragStartCss.y * inputScale) };
  const dragEnd = { x: Math.round(dragEndCss.x * inputScale), y: Math.round(dragEndCss.y * inputScale) };
  window.webContents.sendInputEvent({ type: 'mouseMove', x: dragStart.x, y: dragStart.y });
  window.webContents.sendInputEvent({ type: 'mouseDown', x: dragStart.x, y: dragStart.y, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: dragEnd.x, y: dragEnd.y, movementX: dragEnd.x - dragStart.x, movementY: dragEnd.y - dragStart.y });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: dragEnd.x, y: dragEnd.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const pathState = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const path = project.layers.find(layer => layer.type === 'path');
    const targetOptions = [...document.querySelectorAll('#animationTargetInput option')].map(option => option.textContent || '');
    return {
      pathPointsAfter: path?.points?.length || 0,
      firstPointAfterDrag: path?.points?.[0] || null,
      pathColor: path?.color || '',
      pathFlowSpeed: path?.flowSpeed,
      pathTargetAvailable: targetOptions.some(label => label.includes('Path · Flow Speed')),
      pathPasses: window.__dataHorizonDiagnostics?.passes,
      pathDraws: window.__dataHorizonDiagnostics?.drawCalls,
      pathRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, pathSetup, pathDragSetup, pathState);
  const hudTextState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#addHudTextButton')?.click();
    const styleLabel = [...document.querySelectorAll('#sourceControls label')].find(label => label.textContent?.startsWith('Apply HUD style'));
    const style = styleLabel?.querySelector('select');
    if (style) {
      style.value = 'broadcast-alert';
      style.dispatchEvent(new Event('change'));
    }
    const copy = document.querySelector('#sourceControls textarea');
    if (copy) {
      copy.value = 'SIGNAL LOCKED\\nAUDIO ROUTE ACTIVE';
      copy.dispatchEvent(new Event('change'));
    }
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const hud = project.layers.find(layer => layer.name === 'HUD Signal Title');
    const labels = [...document.querySelectorAll('#sourceControls label')].map(label => label.childNodes[0]?.textContent || '');
    document.querySelector('.inspector-panel')?.scrollTo({ top: 0 });
    return {
      hudTextAdded: Boolean(hud),
      hudTextCopy: hud?.text || '',
      hudTextMultiline: Boolean(hud?.text?.includes('\\n')),
      hudTextPlateOpacity: hud?.backgroundOpacity,
      hudTextBorderWidth: hud?.borderWidth,
      hudTextOutlineWidth: hud?.outlineWidth,
      hudTextGlowBlur: hud?.shadowBlur,
      hudTextWidth: hud?.transform?.width,
      hudTextHeight: hud?.transform?.height,
      hudTextControls: ['Apply HUD style', 'Vertical align', 'Letter spacing', 'Plate opacity', 'Border width', 'Outline width', 'Glow blur'].every(expected => labels.includes(expected)),
      hudTextRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, hudTextState);
  const nodeViewState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-layer-tab="nodes"]')?.click();
    const initialNodeCount = document.querySelectorAll('#nodeGraph .graph-node').length;
    const add = document.querySelector('#nodeAddInput');
    if (add) { add.value = 'bloom'; document.querySelector('#nodeAddButton')?.click(); }
    if (add) { add.value = 'outline'; document.querySelector('#nodeAddButton')?.click(); }
    document.querySelector('.effect-node footer button:nth-child(2)')?.click();
    const firstToggle = document.querySelector('.effect-node header input');
    if (firstToggle) { firstToggle.checked = false; firstToggle.dispatchEvent(new Event('change')); }
    document.querySelector('.effect-node .graph-node-main')?.click();
    document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    const nodePanel = document.querySelector('[data-workspace-panel="layers"]');
    if (nodePanel) Object.assign(nodePanel.style, { left: '250px', top: '84px', width: '780px', height: '440px' });
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const hud = project.layers.find(layer => layer.name === 'HUD Signal Title');
    return {
      nodeViewActive: document.querySelector('[data-layer-tab="nodes"]')?.classList.contains('active'),
      nodeInitialCount: initialNodeCount,
      nodeCountAfterAdd: document.querySelectorAll('#nodeGraph .graph-node').length,
      nodeEffectCount: document.querySelectorAll('#nodeGraph .effect-node').length,
      nodeWireCount: document.querySelectorAll('#nodeGraph .node-wire').length,
      nodeKinds: [...document.querySelectorAll('#nodeGraph .graph-node > header span')].map(item => item.textContent || ''),
      nodeEffectOrder: hud?.effects?.map(effect => effect.type) || [],
      nodeEffectEnabled: hud?.effects?.map(effect => effect.enabled) || [],
      nodeSelected: document.querySelectorAll('#nodeGraph .effect-node.selected').length,
      nodeInspectorSelected: document.querySelectorAll('#effectList .effect-card.selected').length,
      nodeDragEnabled: [...document.querySelectorAll('#nodeGraph .effect-node')].every(node => node.draggable),
      nodePanelFloating: document.querySelector('[data-workspace-panel="layers"]')?.classList.contains('workspace-floating'),
      nodeRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, nodeViewState);
  window.setOpacity(0);
  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const nodeViewImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase13-node-view.png'), nodeViewImage.toPNG());
  window.hide();
  window.setOpacity(1);
  await window.webContents.executeJavaScript(`(() => {
    if (document.querySelector('[data-workspace-panel="layers"]')?.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    document.querySelector('[data-layer-tab="layers"]')?.click();
  })()`);
  const outlineLayerState = await window.webContents.executeJavaScript(`(() => {
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const source = before.layers.find(layer => layer.name === 'HUD Signal Title');
    const outlineCard = [...document.querySelectorAll('.effect-card')].find(card => card.textContent?.includes('Outline'));
    const extract = outlineCard?.querySelector('[data-extract-effect-layer]');
    extract?.click();
    const extractedProject = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const extracted = extractedProject.layers.find(layer => layer.name === 'HUD Signal Title · Outline');
    const isolated = extracted?.effects?.find(effect => effect.type === 'outline');
    document.querySelector('[data-quick-audio-effect]')?.click();
    const audioProject = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const audioTargets = audioProject.bindings.filter(binding => binding.target.includes(isolated?.id || '__missing__'));
    const strengthDriver = audioTargets.find(binding => binding.target.endsWith('.strength'));
    return {
      outlineLayerExtractButton: Boolean(extract),
      outlineLayerCreated: Boolean(extracted),
      outlineLayerSourcePreserved: Boolean(audioProject.layers.find(layer => layer.id === source?.id)),
      outlineLayerSourceEffectRemoved: !audioProject.layers.find(layer => layer.id === source?.id)?.effects?.some(effect => effect.type === 'outline'),
      outlineLayerIsolated: isolated?.outputMode === 'isolated',
      outlineLayerBlend: extracted?.blendMode || '',
      outlineLayerColor: isolated?.color || '',
      outlineLayerParameters: Object.keys(isolated?.parameters || {}),
      outlineLayerMusicDriver: audioTargets.some(binding => binding.source === 'mids' && binding.target.endsWith('.strength')),
      outlineLayerDriverAmount: strengthDriver?.amount,
      outlineLayerDriverOutputMinimum: strengthDriver?.outputMinimum,
      outlineLayerDriverOutputMaximum: strengthDriver?.outputMaximum,
      outlineLayerAudioControls: document.querySelectorAll('#bindingList .binding-card').length,
      outlineLayerRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, outlineLayerState);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const audioDriverState = await window.webContents.executeJavaScript(`(() => {
    const inspector = document.querySelector('.inspector-panel')?.getBoundingClientRect();
    const audio = document.querySelector('#audioSection')?.getBoundingClientRect();
    const card = document.querySelector('#bindingList .binding-card');
    return {
      audioTabActive: document.querySelector('[data-scroll-target="audioSection"]')?.classList.contains('active') || false,
      audioSectionAtTop: Boolean(inspector && audio && audio.top <= inspector.top + 70),
      audioDriverStatus: document.querySelector('#audioDriverStatusTitle')?.textContent || '',
      audioDriverDetail: document.querySelector('#audioDriverStatusDetail')?.textContent || '',
      audioDriverSourceLive: card?.querySelector('[data-binding-source-value]')?.textContent || '',
      audioDriverOffsetLive: card?.querySelector('[data-binding-offset-value]')?.textContent || '',
      audioDriverResultLive: card?.querySelector('[data-binding-result-value]')?.textContent || '',
      audioDriverReactionPresets: card?.querySelectorAll('[data-driver-preset]').length || 0,
      audioDriverOutputFields: [...(card?.querySelectorAll('.binding-grid label') || [])].filter(label => label.textContent?.startsWith('Output')).length
    };
  })()`);
  Object.assign(interactions, audioDriverState);
  window.setOpacity(0);
  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const audioDriverImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase24-audio-driver-lab.png'), audioDriverImage.toPNG());
  const audioDriverMotionState = await window.webContents.executeJavaScript(`(() => ({
    audioDriverOffsetLater: document.querySelector('#bindingList .binding-card [data-binding-offset-value]')?.textContent || '',
    audioDriverResultLater: document.querySelector('#bindingList .binding-card [data-binding-result-value]')?.textContent || ''
  }))()`);
  audioDriverMotionState.audioDriverOffsetChanged = audioDriverMotionState.audioDriverOffsetLater !== audioDriverState.audioDriverOffsetLive;
  Object.assign(interactions, audioDriverMotionState);
  const audioBakeStart = await window.webContents.executeJavaScript(`(() => {
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    document.querySelector('#bakeAudioAutomationButton')?.click();
    return { beforeTracks: before.timeline?.tracks?.length || 0, recordingActive: document.querySelector('#bakeAudioAutomationButton')?.classList.contains('active') || false };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 720));
  const audioBakeState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#bakeAudioAutomationButton')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const baked = after.timeline?.tracks?.filter(track => track.keyframes?.some(keyframe => keyframe.easing === 'linear')) || [];
    const reducible = [...baked].filter(track => track.keyframes.length > 2 && track.keyframes.every(keyframe => keyframe.easing === 'linear')).sort((left, right) => right.keyframes.length - left.keyframes.length)[0];
    if (reducible) {
      const target = document.querySelector('#animationTargetInput');
      if (target) { target.value = reducible.target; target.dispatchEvent(new Event('change')); }
      document.querySelector('#reduceKeyframesButton')?.click();
    }
    const reduced = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const reducedTrack = reducible ? reduced.timeline?.tracks?.find(track => track.id === reducible.id) : null;
    return {
      audioBakeRecordingStarted: ${Boolean(audioBakeStart.recordingActive)},
      audioBakeTrackDelta: (after.timeline?.tracks?.length || 0) - ${Number(audioBakeStart.beforeTracks)},
      audioBakeLinearTracks: baked.length,
      audioBakeKeyframes: baked.reduce((total, track) => total + track.keyframes.length, 0),
      audioBakeReducedFrom: reducible?.keyframes?.length || 0,
      audioBakeReducedTo: reducedTrack?.keyframes?.length || 0,
      audioBakeStopped: !document.querySelector('#bakeAudioAutomationButton')?.classList.contains('active')
    };
  })()`);
  Object.assign(interactions, audioBakeStart, audioBakeState);
  await window.webContents.executeJavaScript(`document.querySelector('[data-scroll-target="effectSection"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 260));
  const outlineLayerImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase20-effect-layers.png'), outlineLayerImage.toPNG());
  window.hide();
  window.setOpacity(1);
  window.setOpacity(0);
  window.showInactive();
  const retouchSetup = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-scroll-target="effectSection"]')?.click();
    const selectionBefore = document.querySelector('#canvasSelection')?.getBoundingClientRect();
    const canvasBefore = document.querySelector('#horizonCanvas')?.getBoundingClientRect();
    const selectionRatio = selectionBefore?.width && canvasBefore?.width ? {
      x: (selectionBefore.left - canvasBefore.left) / canvasBefore.width,
      y: (selectionBefore.top - canvasBefore.top) / canvasBefore.height,
      width: selectionBefore.width / canvasBefore.width,
      height: selectionBefore.height / canvasBefore.height
    } : null;
    document.querySelector('[data-retouch-effect-layer]')?.click();
    const canvasAfter = document.querySelector('#horizonCanvas')?.getBoundingClientRect();
    const selection = selectionRatio && canvasAfter ? {
      left: canvasAfter.left + selectionRatio.x * canvasAfter.width,
      top: canvasAfter.top + selectionRatio.y * canvasAfter.height,
      width: selectionRatio.width * canvasAfter.width,
      height: selectionRatio.height * canvasAfter.height
    } : canvasAfter;
    const foreground = document.querySelector('#foregroundColorInput');
    if (foreground) { foreground.value = '#ff38ce'; foreground.dispatchEvent(new Event('change')); }
    const size = document.querySelector('#maskBrushSizeInput');
    if (size) { size.value = '96'; size.dispatchEvent(new Event('input')); }
    const softness = document.querySelector('#maskBrushSoftnessInput');
    if (softness) { softness.value = '0.3'; softness.dispatchEvent(new Event('input')); }
    const opacity = document.querySelector('#maskBrushOpacityInput');
    if (opacity) { opacity.value = '0.85'; opacity.dispatchEvent(new Event('input')); }
    return {
      retouchButtonFound: Boolean(document.querySelector('[data-retouch-effect-layer]')),
      paintModeOptions: [...document.querySelectorAll('#maskBrushModeInput option')].map(option => option.value),
      paintWorkspaceVisible: !document.querySelector('#brushContextBar')?.hidden,
      paintWorkspacePresetCount: document.querySelectorAll('[data-brush-preset]').length,
      paintWorkspacePrimaryLabel: document.querySelector('#brushPrimaryModeButton')?.textContent?.trim() || '',
      paintWorkspaceTransparentAvailable: !document.querySelector('#transparentColorButton')?.hidden,
      paintStart: { x: Math.round((selection?.left || 0) + (selection?.width || 0) * .24), y: Math.round((selection?.top || 0) + (selection?.height || 0) * .52) },
      paintEnd: { x: Math.round((selection?.left || 0) + (selection?.width || 0) * .76), y: Math.round((selection?.top || 0) + (selection?.height || 0) * .52) }
    };
  })()`);
  const retouchPaintStartCss = retouchSetup.paintStart as { x: number; y: number };
  const retouchPaintEndCss = retouchSetup.paintEnd as { x: number; y: number };
  const retouchPaintStart = { x: Math.round(retouchPaintStartCss.x * inputScale), y: Math.round(retouchPaintStartCss.y * inputScale) };
  const retouchPaintEnd = { x: Math.round(retouchPaintEndCss.x * inputScale), y: Math.round(retouchPaintEndCss.y * inputScale) };
  window.webContents.sendInputEvent({ type: 'mouseMove', x: retouchPaintStart.x, y: retouchPaintStart.y });
  window.webContents.sendInputEvent({ type: 'mouseDown', x: retouchPaintStart.x, y: retouchPaintStart.y, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: retouchPaintEnd.x, y: retouchPaintEnd.y, movementX: retouchPaintEnd.x - retouchPaintStart.x, movementY: retouchPaintEnd.y - retouchPaintStart.y });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: retouchPaintEnd.x, y: retouchPaintEnd.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const eraseSetup = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#transparentColorButton')?.click();
    const mode = document.querySelector('#maskBrushModeInput');
    return {
      eraseModeSelected: mode?.value === 'erase',
      transparentColorActive: document.querySelector('#transparentColorButton')?.classList.contains('active') || false,
      secondarySubtoolActive: document.querySelector('#brushSecondaryModeButton')?.classList.contains('active') || false
    };
  })()`);
  const retouchEraseStartCss = { x: Math.round((retouchPaintStartCss.x + retouchPaintEndCss.x) / 2 - 28), y: retouchPaintStartCss.y - 12 };
  const retouchEraseEndCss = { x: Math.round((retouchPaintStartCss.x + retouchPaintEndCss.x) / 2 + 28), y: retouchPaintStartCss.y + 12 };
  const retouchEraseStart = { x: Math.round(retouchEraseStartCss.x * inputScale), y: Math.round(retouchEraseStartCss.y * inputScale) };
  const retouchEraseEnd = { x: Math.round(retouchEraseEndCss.x * inputScale), y: Math.round(retouchEraseEndCss.y * inputScale) };
  window.webContents.sendInputEvent({ type: 'mouseMove', x: retouchEraseStart.x, y: retouchEraseStart.y });
  window.webContents.sendInputEvent({ type: 'mouseDown', x: retouchEraseStart.x, y: retouchEraseStart.y, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: retouchEraseEnd.x, y: retouchEraseEnd.y, movementX: retouchEraseEnd.x - retouchEraseStart.x, movementY: retouchEraseEnd.y - retouchEraseStart.y });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: retouchEraseEnd.x, y: retouchEraseEnd.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 220));
  const retouchState = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const layer = project.layers.find(layer => layer.name === 'HUD Signal Title · Outline');
    const paint = layer?.effects?.find(effect => effect.type === 'paintLayer');
    document.querySelector('[data-scroll-target="effectSection"]')?.click();
    document.querySelector('[data-effect-id="' + paint?.id + '"]')?.scrollIntoView({ block: 'center' });
    return {
      paintLayerCreated: Boolean(paint),
      paintLayerStrokeCount: paint?.paintLayer?.strokes?.length || 0,
      paintLayerStrokeModes: paint?.paintLayer?.strokes?.map(stroke => stroke.mode) || [],
      paintLayerColor: paint?.paintLayer?.strokes?.[0]?.color || '',
      paintLayerOpacity: paint?.paintLayer?.strokes?.[0]?.opacity,
      paintLayerUndoAvailable: !document.querySelector('[data-effect-id="' + paint?.id + '"] .paint-layer-controls button:nth-child(2)')?.disabled,
      paintLayerRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, retouchSetup, eraseSetup, retouchState);
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 260));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const retouchImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase23-paint-workspace.png'), retouchImage.toPNG());
  const automaticRetouchState = await window.webContents.executeJavaScript(`(() => {
    const sourceRow = [...document.querySelectorAll('.layer-row')].find(row => row.querySelector('.layer-copy strong')?.textContent === 'Cel-Shaded Signal Copy');
    sourceRow?.click();
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const sourceBefore = before.layers.find(layer => layer.name === 'Cel-Shaded Signal Copy');
    const outlineCard = [...document.querySelectorAll('.effect-card')].find(card => card.textContent?.includes('Outline'));
    outlineCard?.querySelector('[data-retouch-effect-layer]')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const sourceAfter = after.layers.find(layer => layer.id === sourceBefore?.id);
    const extracted = after.layers.find(layer => layer.name === 'Cel-Shaded Signal Copy · Outline');
    return {
      automaticRetouchButtonFound: Boolean(outlineCard?.querySelector('[data-retouch-effect-layer]')),
      automaticRetouchSourcePreserved: Boolean(sourceAfter),
      automaticRetouchSourceOutlineRemoved: !sourceAfter?.effects?.some(effect => effect.type === 'outline'),
      automaticRetouchExtracted: extracted?.effects?.some(effect => effect.type === 'outline' && effect.outputMode === 'isolated') || false,
      automaticRetouchPaintReady: extracted?.effects?.some(effect => effect.type === 'paintLayer') || false,
      automaticRetouchRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, automaticRetouchState);
  window.hide();
  window.setOpacity(1);
  await new Promise((resolve) => setTimeout(resolve, 120));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const phase2Image = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase2-studio.png'), phase2Image.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase8-painted-mask.png'), phase2Image.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase9-animated-paths.png'), phase2Image.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase10-interface-scaling.png'), phase2Image.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase12-advanced-hud-text.png'), phase2Image.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase6-functional-ui.png'), phase2Image.toPNG());
  const presetSaveState = await window.webContents.executeJavaScript(`(() => {
    const sourceRow = [...document.querySelectorAll('.layer-row')].find(row => row.querySelector('.layer-copy strong')?.textContent === 'Cel-Shaded Signal Copy');
    sourceRow?.click();
    document.querySelector('[data-layer-tab="presets"]')?.click();
    document.querySelector('#saveSelectionPresetButton')?.click();
    const dialogOpened = Boolean(document.querySelector('#presetDialog')?.open);
    const name = document.querySelector('#presetNameInput');
    const description = document.querySelector('#presetDescriptionInput');
    if (name) name.value = 'Smoke Reactive Image';
    if (description) description.value = 'Portable cel-shaded image with audio routes.';
    document.querySelector('#presetForm')?.requestSubmit();
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const preset = project.presets?.[0];
    document.querySelector('.preset-card-actions button:nth-child(2)')?.click();
    return {
      presetDialogOpened: dialogOpened,
      presetSavedCount: project.presets?.length || 0,
      presetSavedName: preset?.name || '',
      presetSavedType: preset?.layer?.type || '',
      presetSavedAssets: preset?.assets?.length || 0,
      presetSavedBindings: preset?.bindings?.length || 0,
      presetSavedTracks: preset?.tracks?.length || 0,
      presetSavedVersion: preset?.createdWith || '',
      presetCardCountAfterSave: document.querySelectorAll('.preset-card').length
    };
  })()`);
  Object.assign(interactions, presetSaveState);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const presetImportState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('.preset-card-actions button:last-child')?.click();
    const countAfterRemove = document.querySelectorAll('.preset-card').length;
    document.querySelector('#importPresetButton')?.click();
    return { presetCountAfterRemove: countAfterRemove };
  })()`);
  Object.assign(interactions, presetImportState);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const presetInsertState = await window.webContents.executeJavaScript(`(() => {
    const before = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const source = before.layers.find(layer => layer.name === 'Cel-Shaded Signal Copy');
    const originalEffectIds = new Set((source?.effects || []).map(effect => effect.id));
    document.querySelector('.preset-card-actions button:first-child')?.click();
    const after = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const inserted = after.layers[0];
    document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    const panel = document.querySelector('[data-workspace-panel="layers"]');
    if (panel) Object.assign(panel.style, { left: '690px', top: '82px', width: '470px', height: '500px' });
    const ids = [];
    const collect = layers => layers.forEach(layer => { ids.push(layer.id); if (layer.type === 'group') collect(layer.children || []); });
    collect(after.layers || []);
    return {
      presetImportedCount: after.presets?.length || 0,
      presetImportedCardCount: document.querySelectorAll('.preset-card').length,
      presetInsertedName: inserted?.name || '',
      presetInsertedFreshLayerId: Boolean(inserted?.id && source?.id && inserted.id !== source.id),
      presetInsertedFreshEffectIds: (inserted?.effects || []).every(effect => !originalEffectIds.has(effect.id)),
      presetInsertedAudioBindings: (after.bindings || []).filter(binding => binding.target.startsWith('layer.' + inserted?.id + '.')).length,
      presetAssetCountBefore: before.assets?.length || 0,
      presetAssetCountAfter: after.assets?.length || 0,
      presetAllLayerIdsUnique: ids.length === new Set(ids).size,
      presetProjectVersion: after.engineVersion || '',
      presetLibraryActive: document.querySelector('[data-layer-tab="presets"]')?.classList.contains('active'),
      presetPanelFloating: document.querySelector('[data-workspace-panel="layers"]')?.classList.contains('workspace-floating'),
      presetRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, presetInsertState);
  window.setOpacity(0);
  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const presetLibraryImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase14-preset-library.png'), presetLibraryImage.toPNG());
  window.hide();
  window.setOpacity(1);
  await window.webContents.executeJavaScript(`(() => {
    if (document.querySelector('[data-workspace-panel="layers"]')?.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    document.querySelector('[data-layer-tab="layers"]')?.click();
  })()`);
  const projectStarterGalleryState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#newProjectButton')?.click();
    return {
      projectStarterGalleryOpen: Boolean(document.querySelector('#newProjectDialog')?.open),
      projectStarterChoices: document.querySelectorAll('[data-project-template]').length,
      projectStarterCards: [...document.querySelectorAll('[data-project-card]')].map(card => card.getAttribute('data-project-card')),
      projectStarterNameField: Boolean(document.querySelector('#newProjectNameInput'))
    };
  })()`);
  Object.assign(interactions, projectStarterGalleryState);
  window.setOpacity(0);
  window.showInactive();
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const projectStarterImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase15-project-starters.png'), projectStarterImage.toPNG());
  window.hide();
  window.setOpacity(1);
  await window.webContents.executeJavaScript(`(() => {
    window.confirm = () => true;
    const name = document.querySelector('#newProjectNameInput');
    if (name) name.value = 'Smoke HUD Overlay';
    document.querySelector('[data-project-template="tempest-hud-overlay"]')?.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const projectStarterCreateState = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const ids = [];
    const flatten = layers => layers.flatMap(layer => {
      ids.push(layer.id);
      return layer.type === 'group' ? [layer, ...flatten(layer.children || [])] : [layer];
    });
    const layers = flatten(project.layers || []);
    return {
      projectStarterCreatedName: project.name,
      projectStarterEngineVersion: project.engineVersion,
      projectStarterTransparent: project.canvas?.background?.[3] === 0,
      projectStarterRootLayers: project.layers?.length || 0,
      projectStarterTotalLayers: layers.length,
      projectStarterAudioBindings: project.bindings?.length || 0,
      projectStarterAnimationTracks: project.timeline?.tracks?.length || 0,
      projectStarterHasLowerThird: layers.some(layer => layer.name === 'Lower Third'),
      projectStarterHasSpectrum: layers.some(layer => layer.type === 'spectrum'),
      projectStarterIdsUnique: ids.length === new Set(ids).size,
      projectStarterDialogClosed: !document.querySelector('#newProjectDialog')?.open,
      projectStarterRenderError: window.__dataHorizonDiagnostics?.lastError || ''
    };
  })()`);
  Object.assign(interactions, projectStarterCreateState);
  await window.webContents.executeJavaScript(`document.querySelector('#menuPopover').hidden = true`);
  const functionalMenuState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-menu="help"]')?.click();
    [...document.querySelectorAll('#menuPopover button')].find(button => button.textContent.includes('About'))?.click();
    const aboutOpen = Boolean(document.querySelector('#infoDialog')?.open);
    document.querySelector('#infoDialog')?.close();
    document.querySelector('[data-menu="window"]')?.click();
    document.querySelector('#menuPopover button')?.click();
    const toolboxHidden = document.querySelector('.studio-shell')?.classList.contains('toolbox-hidden');
    document.querySelector('[data-menu="window"]')?.click();
    document.querySelector('#menuPopover button')?.click();
    return { aboutOpen, toolboxHidden, toolboxRestored: !document.querySelector('.studio-shell')?.classList.contains('toolbox-hidden') };
  })()`);
  Object.assign(interactions, functionalMenuState);
  const workspaceState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-menu="workspace"]')?.click();
    [...document.querySelectorAll('#menuPopover button')].find(button => button.textContent.includes('Customize'))?.click();
    const workspaceOpen = Boolean(document.querySelector('#workspaceDialog')?.open);
    const toolboxWidth = document.querySelector('#workspaceToolboxWidth');
    if (toolboxWidth) { toolboxWidth.value = '132'; toolboxWidth.dispatchEvent(new Event('change')); }
    const resizedToolbox = getComputedStyle(document.querySelector('.studio-shell')).getPropertyValue('--toolbox-width').trim();
    const floatInspector = document.querySelector('[data-workspace-floating="inspector"]');
    if (floatInspector && !floatInspector.checked) { floatInspector.checked = true; floatInspector.dispatchEvent(new Event('change')); }
    const inspectorFloating = document.querySelector('[data-workspace-panel="inspector"]')?.classList.contains('workspace-floating');
    const floatLayers = document.querySelector('[data-workspace-floating="layers"]');
    if (floatLayers && !floatLayers.checked) { floatLayers.checked = true; floatLayers.dispatchEvent(new Event('change')); }
    const layersFloating = document.querySelector('[data-workspace-panel="layers"]')?.classList.contains('workspace-floating');
    const floatingDocksVisible = ['inspector', 'layers'].every(id => getComputedStyle(document.querySelector('[data-workspace-panel="' + id + '"]')).display !== 'none');
    const name = document.querySelector('#workspaceNameInput');
    if (name) name.value = 'Smoke Workspace';
    document.querySelector('#saveWorkspaceButton')?.click();
    const workspaceSaved = [...document.querySelectorAll('#workspaceSavedSelect option')].some(option => option.value === 'Smoke Workspace');
    document.querySelector('#workspaceDialog')?.close();
    document.querySelector('#menuPopover').hidden = true;
    return { workspaceOpen, resizedToolbox, inspectorFloating, layersFloating, floatingDocksVisible, workspaceSaved };
  })()`);
  Object.assign(interactions, workspaceState);
  await window.webContents.executeJavaScript(`document.querySelector('#menuPopover').style.display = 'none'`);
  await window.webContents.executeJavaScript(`document.querySelector('#workspaceDialog')?.showModal()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const workspaceImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase7-custom-workspace.png'), workspaceImage.toPNG());
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#workspaceDialog')?.close();
    document.querySelector('#menuPopover').style.removeProperty('display');
    document.querySelector('[data-menu="workspace"]')?.click();
    [...document.querySelectorAll('#menuPopover button')].find(button => button.textContent.includes('Editing Layout'))?.click();
  })()`);
  const templateState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#openTemplatesButton')?.click();
    return {
      templateOpen: Boolean(document.querySelector('#templateDialog')?.open),
      templateChoices: document.querySelectorAll('[data-insert-template]').length
    };
  })()`);
  Object.assign(interactions, templateState);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const templateImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase4-templates.png'), templateImage.toPNG());
  const templateInsertState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-insert-template="lower-third"]')?.click();
    const afterTemplateInsert = document.querySelectorAll('.layer-row').length;
    document.querySelector('#undoButton')?.click();
    return { afterTemplateInsert, afterTemplateUndo: document.querySelectorAll('.layer-row').length };
  })()`);
  Object.assign(interactions, templateInsertState);
  await window.webContents.executeJavaScript(`document.querySelector('#templateDialog')?.close()`);
  await new Promise((resolve) => setTimeout(resolve, 160));
  await window.webContents.capturePage();
  const publishState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#publishProjectButton')?.click();
    const before = document.querySelectorAll('.publish-palette-row').length;
    document.querySelector('#addPublishPaletteButton')?.click();
    return {
      publishOpen: Boolean(document.querySelector('#publishDialog')?.open),
      publishTargets: document.querySelectorAll('#publishTargetInput option').length,
      tempestKinds: document.querySelectorAll('#publishKindInput option').length,
      packagePaletteRowsBefore: before,
      packagePaletteRowsAfter: document.querySelectorAll('.publish-palette-row').length,
      packagePaletteColorInputs: document.querySelectorAll('.publish-palette-row:last-child [data-publish-palette-color]').length,
      packagePaletteSectionVisible: !document.querySelector('#publishPaletteSection')?.hidden
    };
  })()`);
  Object.assign(interactions, publishState);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase1-studio.png'), image.toPNG());
  const vaultPublishUiState = await window.webContents.executeJavaScript(`(() => {
    const target = document.querySelector('#publishTargetInput');
    if (target) { target.value = 'tempest-broadcast'; target.dispatchEvent(new Event('change')); }
    const kind = document.querySelector('#publishKindInput');
    if (kind) kind.value = 'hud';
    const transparent = document.querySelector('#publishTransparentInput');
    if (transparent) transparent.checked = true;
    const name = document.querySelector('#publishNameInput');
    if (name) name.value = 'Smoke Vault Element';
    return {
      vaultPublishSectionVisible: !document.querySelector('#publishVaultSection')?.hidden,
      vaultPublishButtonEnabled: !document.querySelector('#publishVaultButton')?.disabled,
      vaultPublishKind: kind?.value || '',
      vaultPublishTransparent: Boolean(transparent?.checked)
    };
  })()`);
  Object.assign(interactions, vaultPublishUiState);
  await new Promise((resolve) => setTimeout(resolve, 180));
  const vaultPublishImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase16-asset-vault.png'), vaultPublishImage.toPNG());
  await window.webContents.executeJavaScript(`document.querySelector('#publishVaultButton')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  const smokeVaultBundle = path.join(assetVaultRoot(), 'data-horizon', 'smoke-vault-element');
  const smokeVaultEntry = path.join(smokeVaultBundle, 'smoke-vault-element.html');
  const [vaultEntryHtml, vaultManifestText, vaultProjectScript] = await Promise.all([
    fs.readFile(smokeVaultEntry, 'utf8'),
    fs.readFile(path.join(smokeVaultBundle, 'manifest.json'), 'utf8'),
    fs.readFile(path.join(smokeVaultBundle, 'project.js'), 'utf8')
  ]);
  const vaultManifest = JSON.parse(vaultManifestText) as Record<string, any>;
  Object.assign(interactions, {
    vaultPackageExists: true,
    vaultStableEntry: path.basename(smokeVaultEntry),
    vaultEntryHasSize: vaultEntryHtml.includes('<meta name="tempest-size" content="1920x1080">'),
    vaultEntryHasStableId: vaultEntryHtml.includes('com.tempestmainframe.data-horizon.smoke-vault-element'),
    vaultManifestEntrypoint: vaultManifest.entrypoint,
    vaultManifestBank: vaultManifest.assetVault?.bank,
    vaultManifestSourceName: vaultManifest.elementPack?.sourceName,
    vaultTelemetryBridgeConfigured: vaultProjectScript.includes("../../../telemetry.json"),
    vaultPublishDialogClosed: !(await window.webContents.executeJavaScript(`Boolean(document.querySelector('#publishDialog')?.open)`)),
    vaultPublishToast: await window.webContents.executeJavaScript(`document.querySelector('#toast')?.textContent || ''`)
  });
  await window.webContents.executeJavaScript(`document.querySelector('[data-layer-tab="vault"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('[data-workspace-panel="layers"]');
    if (panel && !panel.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    if (panel) Object.assign(panel.style, { left: '640px', top: '90px', width: '520px', height: '520px' });
    document.querySelector('#toast')?.classList.remove('visible');
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const vaultLibraryImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase17-vault-library.png'), vaultLibraryImage.toPNG());
  await fs.writeFile(path.join(outputDirectory, 'phase18-composition-reuse.png'), vaultLibraryImage.toPNG());
  const vaultLibraryState = await window.webContents.executeJavaScript(`(async () => {
    const listed = await window.horizonDesktop.listVault();
    const opened = listed[0] ? await window.horizonDesktop.readVaultProject(listed[0].slug) : null;
    const beforeRemove = listed.length;
    const cardName = document.querySelector('.vault-card-copy strong')?.textContent || '';
    const cardActions = document.querySelectorAll('.vault-card-actions button').length;
    const cardPreview = Boolean(document.querySelector('.vault-card-preview img'));
    const activeBeforeInsert = document.querySelector('[data-layer-tab="vault"]')?.classList.contains('active');
    const beforeProject = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    document.querySelector('.vault-card-actions button:first-child')?.click();
    await new Promise(resolve => setTimeout(resolve, 240));
    const afterVaultInsert = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const linkedGroupId = afterVaultInsert.layers?.[0]?.id || '';
    const firstLinkedChildId = afterVaultInsert.layers?.[0]?.children?.[0]?.id || '';
    const linkedControlsBefore = document.querySelectorAll('.linked-composition-actions button').length;
    document.querySelector('.linked-composition-actions button:first-child')?.click();
    await new Promise(resolve => setTimeout(resolve, 240));
    const afterLinkedRefresh = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    document.querySelector('.linked-composition-actions button:last-child')?.click();
    await new Promise(resolve => setTimeout(resolve, 180));
    const afterLinkedDetach = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    document.querySelector('#importCompositionButton')?.click();
    await new Promise(resolve => setTimeout(resolve, 240));
    const afterFileImport = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    await window.horizonDesktop.publishVault({
      project: afterFileImport,
      options: { target: 'tempest-broadcast', name: 'Smoke Linked Export', tempestKind: 'overlay', transparent: true },
      previewPng: document.querySelector('#horizonCanvas')?.toDataURL('image/png') || ''
    });
    const afterLinkedPublish = await window.horizonDesktop.listVault();
    const linkedExportSummary = afterLinkedPublish.find(item => item.slug === 'smoke-linked-export');
    const linkedExport = linkedExportSummary ? await window.horizonDesktop.readVaultProject(linkedExportSummary.slug) : null;
    const linkedExportText = JSON.stringify(linkedExport?.project || null);
    for (const item of afterLinkedPublish) await window.horizonDesktop.uninstallVault(item.slug);
    const remaining = await window.horizonDesktop.listVault();
    return {
      vaultLibraryActive: activeBeforeInsert,
      vaultLibraryCount: beforeRemove,
      vaultLibraryCardName: cardName,
      vaultLibraryCardActions: cardActions,
      vaultLibraryHasPreview: cardPreview,
      vaultLibraryOpenValid: Boolean(opened?.project?.schemaVersion === 1 && opened?.project?.canvas?.width === 1920),
      vaultCompositionInserted: afterVaultInsert.layers?.[0]?.type === 'group' && afterVaultInsert.layers?.[0]?.name === 'Smoke Vault Element',
      vaultCompositionLayerDelta: afterVaultInsert.layers.length - beforeProject.layers.length,
      vaultCompositionBindingDelta: afterVaultInsert.bindings.length - beforeProject.bindings.length,
      linkedCompositionKind: afterVaultInsert.layers?.[0]?.linkedComposition?.sourceKind || '',
      linkedCompositionLocator: afterVaultInsert.layers?.[0]?.linkedComposition?.locator || '',
      linkedCompositionControls: linkedControlsBefore,
      linkedCompositionGroupPreserved: afterLinkedRefresh.layers?.[0]?.id === linkedGroupId,
      linkedCompositionChildrenRefreshed: afterLinkedRefresh.layers?.[0]?.children?.[0]?.id !== firstLinkedChildId,
      linkedCompositionDetached: !afterLinkedDetach.layers?.[0]?.linkedComposition && afterLinkedDetach.layers?.[0]?.children?.length > 0,
      fileCompositionInserted: afterFileImport.layers.length === afterVaultInsert.layers.length + 1,
      fileCompositionLinked: afterFileImport.layers?.[0]?.linkedComposition?.sourceKind === 'file' && afterFileImport.layers?.[0]?.linkedComposition?.locator?.endsWith('project.horizon.json'),
      linkedCompositionPublishStripped: Boolean(linkedExport?.project?.layers?.length) && !linkedExportText.includes('linkedComposition') && !linkedExportText.includes('smoke-asset-vault'),
      compositionImportButtonVisible: Boolean(document.querySelector('#importCompositionButton')),
      vaultLibraryUninstalled: remaining.length === 0
    };
  })()`);
  Object.assign(interactions, vaultLibraryState);
  await window.webContents.executeJavaScript(`(() => {
    const layersPanel = document.querySelector('[data-workspace-panel="layers"]');
    if (layersPanel?.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="layers"]')?.click();
    const inspector = document.querySelector('[data-workspace-panel="inspector"]');
    if (inspector && !inspector.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="inspector"]')?.click();
    if (inspector) Object.assign(inspector.style, { left: '640px', top: '90px', width: '520px', height: '520px' });
    document.querySelector('[data-scroll-target="propertiesSection"]')?.click();
    document.querySelector('.linked-composition-card')?.scrollIntoView({ block: 'center' });
    document.querySelector('#toast')?.classList.remove('visible');
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 140));
  const linkedCompositionImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase19-linked-compositions.png'), linkedCompositionImage.toPNG());
  await window.webContents.executeJavaScript(`(() => {
    const inspector = document.querySelector('[data-workspace-panel="inspector"]');
    if (inspector?.classList.contains('workspace-floating')) document.querySelector('[data-workspace-float-toggle="inspector"]')?.click();
    document.querySelector('[data-layer-tab="layers"]')?.click();
  })()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  await window.webContents.executeJavaScript(`(() => {
    const publish = document.querySelector('#publishDialog');
    if (publish?.open) publish.close();
    document.querySelector('.layer-row')?.click();
    document.querySelector('[data-scroll-target="audioSection"]')?.click();
    document.querySelector('#loadReferenceAudioButton')?.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  const referenceAudioState = await window.webContents.executeJavaScript(`(() => ({
    referenceAudioName: document.querySelector('#referenceAudioName')?.textContent || '',
    referenceAudioStatus: document.querySelector('#referenceAudioStatus')?.textContent || '',
    referenceAudioPlayEnabled: !document.querySelector('#referenceAudioPlayButton')?.disabled,
    referenceAudioProgress: Number(document.querySelector('#referenceAudioProgress')?.value || 0),
    referenceAudioTime: document.querySelector('#referenceAudioTime')?.textContent || '',
    referenceAudioMockDisabled: !document.querySelector('#mockAudioToggle')?.checked,
    referenceAudioMeterLevels: [...document.querySelectorAll('.audio-meter')].map(meter => Number(meter.style.getPropertyValue('--level') || 0)),
    referenceAudioRenderError: window.__dataHorizonDiagnostics?.lastError || ''
  }))()`);
  Object.assign(interactions, referenceAudioState);
  const referenceCaptureState = await window.webContents.executeJavaScript(`(() => {
    const openBeforeReferenceCapture = [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id);
    document.querySelectorAll('dialog').forEach(dialog => { if (dialog.open) dialog.close(); dialog.style.display = 'none'; });
    document.querySelector('.layer-row')?.click();
    document.querySelector('[data-scroll-target="audioSection"]')?.click();
    const inspector = document.querySelector('.inspector-panel');
    if (inspector) inspector.scrollTop = inspector.scrollHeight;
    return { openBeforeReferenceCapture, openAfterReferenceCapture: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id) };
  })()`);
  Object.assign(interactions, referenceCaptureState);
  await new Promise((resolve) => setTimeout(resolve, 180));
  await window.webContents.capturePage();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const referenceAudioImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase11-reference-audio.png'), referenceAudioImage.toPNG());
  const layerClipboardState = await window.webContents.executeJavaScript(`(() => {
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const flatten = layers => layers.flatMap(layer => [layer, ...(layer.type === 'group' ? flatten(layer.children || []) : [])]);
    const source = readProject();
    const sourceRoots = source.layers.slice(0, 2);
    if (sourceRoots.length !== 2) throw new Error('Phase 34 smoke test requires two root layers.');
    sourceRoots.forEach((layer, index) => document.querySelector('.layer-row[data-layer-id="' + layer.id + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: index > 0 })));
    document.querySelector('#copyLayersButton')?.click();
    const clipboard = JSON.parse(localStorage.getItem('dataHorizonLayerClipboardV1'));
    const expectedAssets = new Set(clipboard.items.flatMap(item => item.assets.map(asset => asset.uri))).size;
    const expectedBindings = clipboard.items.reduce((total, item) => total + item.bindings.length, 0);
    const expectedTracks = clipboard.items.reduce((total, item) => total + item.tracks.length, 0);
    const sourceIds = new Set(clipboard.items.flatMap(item => flatten([item.layer]).map(layer => layer.id)));
    const sourceTransforms = clipboard.items.map(item => item.layer.transform || null);
    window.confirm = () => true;
    document.querySelector('[data-project-template="blank"]')?.click();
    const blank = readProject();
    document.querySelector('#pasteLayersInPlaceButton')?.click();
    const inPlace = readProject();
    const inPlaceRoots = inPlace.layers.slice(0, clipboard.items.length);
    const inPlaceIds = new Set(flatten(inPlaceRoots).map(layer => layer.id));
    const allTargetsRemapped = [...inPlace.bindings, ...inPlace.timeline.tracks].every(item => {
      const id = item.target.split('.')[1];
      return inPlaceIds.has(id) && !sourceIds.has(id);
    });
    document.querySelector('#pasteLayersButton')?.click();
    const offset = readProject();
    const offsetRoots = offset.layers.slice(0, clipboard.items.length);
    const offsetTransforms = offsetRoots.map(layer => layer.transform || null);
    const offsetBy24 = offsetTransforms.every((transform, index) => transform && sourceTransforms[index] && transform.x === sourceTransforms[index].x + 24 && transform.y === sourceTransforms[index].y + 24);
    document.querySelector('#cutLayersButton')?.click();
    const afterCut = readProject();
    const cutClipboard = JSON.parse(localStorage.getItem('dataHorizonLayerClipboardV1'));
    document.querySelector('#pasteLayersInPlaceButton')?.click();
    const restored = readProject();
    document.querySelector('[data-layer-tab="layers"]')?.click();
    document.querySelector('.studio-shell')?.style.setProperty('--inspector-height', '34%');
    document.querySelector('#toast')?.classList.remove('visible');
    return {
      layerClipboardFormat: clipboard.format,
      layerClipboardItems: clipboard.items.length,
      layerClipboardSourceProject: clipboard.sourceProject,
      layerClipboardBlankLayers: blank.layers.length,
      layerClipboardInPlaceRoots: inPlace.layers.length,
      layerClipboardFreshIds: [...inPlaceIds].every(id => !sourceIds.has(id)),
      layerClipboardTransformsExact: inPlaceRoots.every((layer, index) => JSON.stringify(layer.transform || null) === JSON.stringify(sourceTransforms[index])),
      layerClipboardAssetsRestored: inPlace.assets.length === expectedAssets,
      layerClipboardBindingsRestored: inPlace.bindings.length === expectedBindings,
      layerClipboardTracksRestored: inPlace.timeline.tracks.length === expectedTracks,
      layerClipboardTargetsRemapped: allTargetsRemapped,
      layerClipboardOffsetRoots: offset.layers.length,
      layerClipboardOffsetBy24: offsetBy24,
      layerClipboardCutRemoved: offset.layers.length - afterCut.layers.length,
      layerClipboardCutItems: cutClipboard.items.length,
      layerClipboardRestoreRoots: restored.layers.length,
      layerClipboardStatus: document.querySelector('#layerClipboardStatus')?.textContent || '',
      layerClipboardVersion: restored.engineVersion
    };
  })()`);
  Object.assign(interactions, layerClipboardState);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const layerClipboardImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase34-layer-clipboard.png'), layerClipboardImage.toPNG());
  const layerDragState = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('.studio-shell')?.style.setProperty('--inspector-height', '20%');
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const renameSelected = name => {
      const input = document.querySelector('#layerNameInput');
      if (input) { input.value = name; input.dispatchEvent(new Event('change', { bubbles: true })); }
      return document.querySelector('.layer-row.primary')?.dataset.layerId;
    };
    const addShape = name => { document.querySelector('#addShapeButton')?.click(); return renameSelected(name); };
    const childId = addShape('Drop Child');
    document.querySelector('#groupLayerButton')?.click();
    const groupId = renameSelected('Drop Group');
    const bId = addShape('Drag B');
    const aId = addShape('Drag A');
    document.querySelector('.layer-row[data-layer-id="' + aId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.layer-row[data-layer-id="' + bId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    const drag = (source, target, ratio, drop = true) => {
      const transfer = new DataTransfer();
      const targetRect = target.getBoundingClientRect();
      const y = targetRect.top + targetRect.height * ratio;
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
      const feedback = target.className;
      if (drop) target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
      return { feedback, y };
    };
    const insideSource = document.querySelector('.layer-row[data-layer-id="' + aId + '"]');
    const insideTarget = document.querySelector('.layer-row[data-layer-id="' + groupId + '"]');
    const insideDrag = drag(insideSource, insideTarget, .5);
    const afterInside = readProject();
    const group = afterInside.layers.find(layer => layer.id === groupId);
    const targetRoot = group;
    const beforeSource = document.querySelector('.layer-row[data-layer-id="' + aId + '"]');
    const beforeTarget = document.querySelector('.layer-row[data-layer-id="' + targetRoot.id + '"]');
    const beforeDrag = drag(beforeSource, beforeTarget, .08, false);
    const tree = document.querySelector('#layerTree');
    tree.dataset.layerDragTargetId = targetRoot.id;
    tree.scrollTop = Math.max(0, beforeTarget.offsetTop - 54);
    document.querySelector('#toast')?.classList.remove('visible');
    return {
      layerDragFixtureIds: [aId, bId, groupId, childId].every(Boolean),
      layerDragInsideFeedback: insideDrag.feedback.includes('drop-inside'),
      layerDragInsideOrder: group?.children?.slice(0, 3).map(layer => layer.name) || [],
      layerDragBeforeFeedback: beforeDrag.feedback.includes('drop-before'),
      layerDragSelectedRows: document.querySelectorAll('.layer-row.selected').length,
      layerDragHelp: document.querySelector('.layer-drag-help')?.textContent || '',
      layerDragVersion: afterInside.engineVersion
    };
  })()`);
  Object.assign(interactions, layerDragState);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const layerDragImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase35-layer-drag-drop.png'), layerDragImage.toPNG());
  const layerDragCompletion = await window.webContents.executeJavaScript(`(() => {
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const tree = document.querySelector('#layerTree');
    const targetId = tree.dataset.layerDragTargetId;
    const target = document.querySelector('.layer-row[data-layer-id="' + targetId + '"]');
    const transfer = new DataTransfer();
    const targetRect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: targetRect.top + targetRect.height * .08 }));
    const reordered = readProject();
    const aId = reordered.layers.find(layer => layer.name === 'Drag A')?.id;
    const bId = reordered.layers.find(layer => layer.name === 'Drag B')?.id;
    const targetIndex = reordered.layers.findIndex(layer => layer.id === targetId);
    const aIndex = reordered.layers.findIndex(layer => layer.id === aId);
    const bIndex = reordered.layers.findIndex(layer => layer.id === bId);
    document.querySelector('.layer-row[data-layer-id="' + bId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const bRow = document.querySelector('.layer-row[data-layer-id="' + bId + '"]');
    const rootTransfer = new DataTransfer();
    bRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: rootTransfer }));
    tree.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: rootTransfer, clientY: tree.getBoundingClientRect().bottom - 2 }));
    const rootFeedback = tree.classList.contains('drag-root-end');
    tree.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: rootTransfer, clientY: tree.getBoundingClientRect().bottom - 2 }));
    const rootEnded = readProject();
    document.querySelector('#undoButton')?.click();
    return {
      layerDragBeforeOrder: aIndex + 1 === bIndex && bIndex + 1 === targetIndex,
      layerDragGroupRetainedChild: reordered.layers.find(layer => layer.name === 'Drop Group')?.children?.map(layer => layer.name) || [],
      layerDragRootEndFeedback: rootFeedback,
      layerDragRootEndMoved: rootEnded.layers.at(-1)?.name === 'Drag B',
      layerDragUndoRestored: readProject().layers.findIndex(layer => layer.name === 'Drag B') === bIndex
    };
  })()`);
  Object.assign(interactions, layerDragCompletion);
  const layerNavigatorState = await window.webContents.executeJavaScript(`(() => {
    const project = JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const flatten = layers => layers.flatMap(layer => [layer, ...(layer.type === 'group' ? flatten(layer.children || []) : [])]);
    const all = flatten(project.layers);
    const groups = all.filter(layer => layer.type === 'group');
    const childId = all.find(layer => layer.name === 'Drop Child')?.id;
    const names = () => [...document.querySelectorAll('.layer-row .layer-copy strong')].map(label => label.textContent || '');
    document.querySelector('#collapseLayerGroupsButton')?.click();
    const collapsedRows = document.querySelectorAll('.layer-row').length;
    const collapsedDisclosures = document.querySelectorAll('.layer-disclosure[aria-expanded="false"]').length;
    const collapseStore = JSON.parse(localStorage.getItem('dataHorizonLayerGroupCollapseV1') || '{}');
    const search = document.querySelector('#layerSearchInput');
    search.value = 'Drop Child';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const searchNames = names();
    const searchStatus = document.querySelector('#layerFilterStatus')?.textContent || '';
    const searchAutoExpanded = document.querySelectorAll('.layer-disclosure:disabled').length > 0;
    document.querySelector('.layer-row[data-layer-id="' + childId + '"]')?.click();
    document.querySelector('#clearLayerSearchButton')?.click();
    document.querySelector('#collapseLayerGroupsButton')?.click();
    const hiddenBeforeReveal = !document.querySelector('.layer-row[data-layer-id="' + childId + '"]');
    document.querySelector('#revealSelectedLayerButton')?.click();
    const revealedAfterButton = Boolean(document.querySelector('.layer-row[data-layer-id="' + childId + '"]'));
    search.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    const shortcutFocused = document.activeElement === search;
    const filter = document.querySelector('#layerFilterInput');
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    filter.value = 'groups';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    const groupFilterRows = document.querySelectorAll('.layer-row').length;
    const groupFilterTypes = [...document.querySelectorAll('.layer-row')].map(row => row.dataset.layerType);
    filter.value = 'audio';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    const drivenIds = new Set(project.bindings.map(binding => binding.target.split('.')[1]));
    const audioFilterStatus = document.querySelector('#layerFilterStatus')?.textContent || '';
    const audioFilterRows = document.querySelectorAll('.layer-row').length;
    filter.value = 'all';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    search.value = '__no_such_layer__';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const emptyMessage = document.querySelector('.layer-tree-empty')?.textContent || '';
    search.value = 'Drop';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#layerTree').scrollTop = 0;
    document.querySelector('#toast')?.classList.remove('visible');
    return {
      layerNavigatorAllLayers: all.length,
      layerNavigatorGroupCount: groups.length,
      layerNavigatorCollapsedRows: collapsedRows,
      layerNavigatorCollapsedDisclosures: collapsedDisclosures,
      layerNavigatorCollapsePersisted: (collapseStore[project.id] || []).length === groups.length,
      layerNavigatorSearchNames: searchNames,
      layerNavigatorSearchStatus: searchStatus,
      layerNavigatorSearchAutoExpanded: searchAutoExpanded,
      layerNavigatorHiddenBeforeReveal: hiddenBeforeReveal,
      layerNavigatorRevealed: revealedAfterButton,
      layerNavigatorShortcutFocused: shortcutFocused,
      layerNavigatorGroupFilterRows: groupFilterRows,
      layerNavigatorGroupFilterValid: groupFilterTypes.every(type => type === 'group'),
      layerNavigatorAudioDirectMatches: drivenIds.size,
      layerNavigatorAudioFilterStatus: audioFilterStatus,
      layerNavigatorAudioFilterRows: audioFilterRows,
      layerNavigatorEmptyMessage: emptyMessage,
      layerNavigatorVersion: project.engineVersion
    };
  })()`);
  Object.assign(interactions, layerNavigatorState);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const layerNavigatorImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase36-layer-navigator.png'), layerNavigatorImage.toPNG());
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#clearLayerSearchButton')?.click();
    document.querySelector('#expandLayerGroupsButton')?.click();
    document.querySelector('#toast')?.classList.remove('visible');
  })()`);
  const layerSelectionSetState = await window.webContents.executeJavaScript(`(() => {
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const flatten = layers => layers.flatMap(layer => [layer, ...(layer.type === 'group' ? flatten(layer.children || []) : [])]);
    const before = readProject();
    const all = flatten(before.layers);
    const aId = all.find(layer => layer.name === 'Drag A')?.id;
    const childId = all.find(layer => layer.name === 'Drop Child')?.id;
    document.querySelector('.layer-row[data-layer-id="' + aId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.layer-row[data-layer-id="' + childId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    window.prompt = () => 'Hero Focus';
    document.querySelector('#saveLayerSelectionSetButton')?.click();
    const saved = readProject();
    const set = saved.layerSelectionSets[0];
    const bId = flatten(saved.layers).find(layer => layer.name === 'Drag B')?.id;
    document.querySelector('.layer-row[data-layer-id="' + bId + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const select = document.querySelector('#layerSelectionSetInput');
    select.value = set.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#recallLayerSelectionSetButton')?.click();
    const recalledNames = [...document.querySelectorAll('.layer-row.selected .layer-copy strong')].map(label => label.textContent || '');
    const beforeSolo = readProject();
    const visibility = Object.fromEntries(flatten(beforeSolo.layers).map(layer => [layer.id, layer.visible]));
    document.querySelector('#layerTree').dataset.phase37Visibility = JSON.stringify(visibility);
    document.querySelector('#soloLayersButton')?.click();
    const solo = readProject();
    const visibleNames = flatten(solo.layers).filter(layer => layer.visible).map(layer => layer.name);
    document.querySelector('#toast')?.classList.remove('visible');
    return {
      layerSetSavedCount: saved.layerSelectionSets.length,
      layerSetSavedName: set.name,
      layerSetSavedIds: set.layerIds,
      layerSetOrdered: set.layerIds[0] === aId && set.layerIds[1] === childId,
      layerSetOptions: document.querySelectorAll('#layerSelectionSetInput option').length,
      layerSetRecalledNames: recalledNames,
      layerSoloVisibleNames: visibleNames,
      layerSoloOnlyPath: visibleNames.length === 3 && ['Drag A', 'Drop Group', 'Drop Child'].every(name => visibleNames.includes(name)),
      layerSoloButtonActive: document.querySelector('#soloLayersButton')?.classList.contains('active') || false,
      layerSoloButtonText: document.querySelector('#soloLayersButton')?.textContent || '',
      layerSetVersion: solo.engineVersion
    };
  })()`);
  Object.assign(interactions, layerSelectionSetState);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const layerSelectionSetImage = await window.webContents.capturePage();
  await fs.writeFile(path.join(outputDirectory, 'phase37-layer-selection-sets.png'), layerSelectionSetImage.toPNG());
  const layerSelectionSetCompletion = await window.webContents.executeJavaScript(`(() => {
    const readProject = () => JSON.parse(localStorage.getItem('dataHorizonPhase1AutosaveV1'));
    const flatten = layers => layers.flatMap(layer => [layer, ...(layer.type === 'group' ? flatten(layer.children || []) : [])]);
    const expected = JSON.parse(document.querySelector('#layerTree').dataset.phase37Visibility || '{}');
    document.querySelector('#soloLayersButton')?.click();
    const restored = readProject();
    const visibilityRestored = flatten(restored.layers).every(layer => layer.visible === expected[layer.id]);
    document.querySelector('#deleteLayerSelectionSetButton')?.click();
    const deleted = readProject();
    document.querySelector('#undoButton')?.click();
    const undo = readProject();
    document.querySelector('#redoButton')?.click();
    return {
      layerSoloVisibilityRestored: visibilityRestored,
      layerSoloButtonRestored: document.querySelector('#soloLayersButton')?.textContent === 'Solo',
      layerSetDeleted: deleted.layerSelectionSets.length === 0,
      layerSetUndoRestored: undo.layerSelectionSets.length === 1,
      layerSetRedoDeleted: readProject().layerSelectionSets.length === 0
    };
  })()`);
  Object.assign(interactions, layerSelectionSetCompletion);
  await window.webContents.executeJavaScript(`(() => {
    const select = document.querySelector('#uiScaleInput');
    select.value = '1.6';
    select.dispatchEvent(new Event('change'));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 180));
  interactions.manualUiScale = window.webContents.getZoomFactor();
  interactions.manualUiScaleButtonText = await window.webContents.executeJavaScript(`document.querySelector('#uiScaleButton')?.textContent || ''`);
  await window.webContents.executeJavaScript(`document.querySelector('#uiScaleAutoButton')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 180));
  interactions.restoredAutoUiScale = window.webContents.getZoomFactor();
  await fs.writeFile(path.join(outputDirectory, 'phase1-smoke.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: '#05070d',
    title: 'Data Horizon Studio',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  window.webContents.setZoomFactor(1.4);
  window.loadFile(
    path.join(__dirname, 'renderer', 'index.html'),
    smokeTest ? { query: { smoke: '1' } } : undefined
  );
  window.once('ready-to-show', () => {
    if (!smokeTest) {
      window.show();
      return;
    }
    captureSmoke(window)
      .then(() => app.quit())
      .catch((error) => {
        console.error(error);
        app.exit(1);
      });
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  return window;
}

function normalizeProjectPath(requested: string): string {
  return requested.toLowerCase().endsWith('.horizon.json') ? requested : `${requested}.horizon.json`;
}

function normalizePresetPath(requested: string): string {
  return requested.toLowerCase().endsWith('.horizonpreset')
    ? requested
    : `${requested.replace(/(?:\.horizon-preset)?\.json$/i, '')}.horizonpreset`;
}

function assetVaultRoot(): string {
  if (smokeTest) return path.resolve(__dirname, '..', '..', '..', 'test-output', 'smoke-asset-vault');
  const override = process.env.DATA_HORIZON_ASSET_VAULT?.trim();
  return override
    ? path.resolve(override)
    : path.join(app.getPath('appData'), 'tempest-broadcast-system', 'control-deck', 'vault-elements');
}

function dataHorizonVaultRoot(): string {
  return path.resolve(assetVaultRoot(), 'data-horizon');
}

function resolveVaultBundle(slug: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) throw new Error('The Asset Vault element ID is invalid.');
  const rootPath = dataHorizonVaultRoot();
  const bundlePath = path.resolve(rootPath, slug);
  if (!bundlePath.startsWith(`${rootPath}${path.sep}`)) throw new Error('The Asset Vault element resolved outside the Data Horizon Vault root.');
  return bundlePath;
}

async function readVaultManifest(slug: string): Promise<{ bundlePath: string; manifest: Record<string, any> }> {
  const bundlePath = resolveVaultBundle(slug);
  const stats = await fs.lstat(bundlePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('The Asset Vault element is not a regular package directory.');
  const manifest = JSON.parse(await fs.readFile(path.join(bundlePath, 'manifest.json'), 'utf8')) as Record<string, any>;
  const expectedId = `com.tempestmainframe.data-horizon.${slug}`;
  if (manifest.format !== 'data-horizon.tempest-element-pack' || manifest.target !== 'tempest-broadcast' || manifest.id !== expectedId || manifest.assetVault?.updateKey !== expectedId) {
    throw new Error('The selected folder is not a managed Data Horizon Asset Vault element.');
  }
  return { bundlePath, manifest };
}

async function readManagedVaultProject(slug: string): Promise<{ project: HorizonProject; vaultPath: string }> {
  const { bundlePath } = await readVaultManifest(slug);
  const project = JSON.parse(await fs.readFile(path.join(bundlePath, 'project.horizon.json'), 'utf8')) as unknown;
  const validation = validateProject(project);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  return { project: project as HorizonProject, vaultPath: bundlePath };
}

async function listVaultElements(): Promise<VaultElementSummary[]> {
  const rootPath = dataHorizonVaultRoot();
  await fs.mkdir(rootPath, { recursive: true });
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const elements = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map(async (entry): Promise<VaultElementSummary | null> => {
      try {
        const { bundlePath, manifest } = await readVaultManifest(entry.name);
        const projectPath = path.join(bundlePath, 'project.horizon.json');
        const project = JSON.parse(await fs.readFile(projectPath, 'utf8')) as unknown;
        if (!validateProject(project).ok) return null;
        const typedProject = project as HorizonProject;
        const previewPath = path.join(bundlePath, 'preview.png');
        let previewPng = '';
        try {
          const previewStats = await fs.stat(previewPath);
          if (previewStats.size <= 8 * 1024 * 1024) previewPng = `data:image/png;base64,${(await fs.readFile(previewPath)).toString('base64')}`;
        } catch {
          // A missing optional preview does not hide an otherwise valid package.
        }
        const manifestStats = await fs.stat(path.join(bundlePath, 'manifest.json'));
        return {
          slug: entry.name,
          id: String(manifest.id),
          name: String(manifest.name || typedProject.name || entry.name),
          kind: String(manifest.elementPack?.kind || 'overlay'),
          width: Math.round(Number(manifest.canvas?.width) || typedProject.canvas.width),
          height: Math.round(Number(manifest.canvas?.height) || typedProject.canvas.height),
          transparent: Boolean(manifest.canvas?.transparent),
          version: String(manifest.version || typedProject.engineVersion),
          sourceName: `Tempest Vault // ${entry.name}`,
          previewPng,
          updatedAt: manifestStats.mtimeMs
        };
      } catch {
        return null;
      }
    }));
  return elements.filter((element): element is VaultElementSummary => Boolean(element)).sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name));
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function createVaultRuntimeHtml(template: string, project: HorizonProject, name: string): string {
  return template
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="tempest-size" content="${project.canvas.width}x${project.canvas.height}">\n  <meta name="data-horizon-id" content="com.tempestmainframe.data-horizon.${slugify(name)}">`)
    .replace('<title>Data Horizon Runtime</title>', `<title>${escapeHtmlText(name)} · Data Horizon</title>`);
}

async function publishToAssetVault(request: PublishBundleRequest): Promise<{ bundlePath: string; entryPath: string; sourceName: string; updated: boolean; warnings: string[] }> {
  const options: PublishOptions = { ...request.options, target: 'tempest-broadcast', delivery: 'asset-vault' };
  const validation = validatePublish(request.project, options);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const publishedProject = stripCompositionLinks(request.project);
  if (options.transparent) publishedProject.canvas.background[3] = 0;
  const slug = slugify(options.name);
  const rootPath = path.resolve(assetVaultRoot());
  const bundlePath = path.resolve(rootPath, 'data-horizon', slug);
  if (!bundlePath.startsWith(`${rootPath}${path.sep}`)) throw new Error('The Asset Vault package path resolved outside the Vault root.');
  let updated = true;
  try { await fs.access(bundlePath); } catch { updated = false; }
  await fs.mkdir(bundlePath, { recursive: true });
  const entryName = `${slug}.html`;
  const entryPath = path.join(bundlePath, entryName);
  const runtimeTemplate = await fs.readFile(path.join(__dirname, 'renderer', 'runtime.html'), 'utf8');
  const manifest = createBundleManifest(publishedProject, options);
  const telemetryBootstrap = `window.__DATA_HORIZON_TELEMETRY_URL__ = '../../../telemetry.json';\n`;
  await Promise.all([
    fs.writeFile(entryPath, createVaultRuntimeHtml(runtimeTemplate, publishedProject, options.name), 'utf8'),
    fs.writeFile(path.join(bundlePath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(bundlePath, 'project.horizon.json'), `${JSON.stringify(publishedProject, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(bundlePath, 'project.js'), `${telemetryBootstrap}${serializeRuntimeProject(publishedProject)}`, 'utf8'),
    fs.copyFile(path.join(__dirname, 'renderer', 'app.js'), path.join(bundlePath, 'app.js')),
    fs.copyFile(path.join(__dirname, 'renderer', 'styles.css'), path.join(bundlePath, 'styles.css')),
    fs.writeFile(path.join(bundlePath, 'README.txt'), [
      'DATA HORIZON // TEMPEST ASSET VAULT ELEMENT',
      '',
      `Name: ${options.name.trim()}`,
      `Entry point: ${entryName}`,
      `Canvas: ${publishedProject.canvas.width}x${publishedProject.canvas.height}`,
      `Transparent: ${Boolean(options.transparent)}`,
      'Bank: OVERLAY',
      'This stable folder is updated in place when republished from Data Horizon Studio.'
    ].join('\n'), 'utf8')
  ]);
  const previewMatch = /^data:image\/png;base64,(.+)$/s.exec(request.previewPng || '');
  if (previewMatch) await fs.writeFile(path.join(bundlePath, 'preview.png'), Buffer.from(previewMatch[1], 'base64'));
  return { bundlePath, entryPath, sourceName: `Tempest Vault // ${slug}`, updated, warnings: validation.warnings };
}

function mimeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/png';
}

function audioMimeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.ogg' || extension === '.opus') return 'audio/ogg';
  if (extension === '.m4a' || extension === '.aac') return 'audio/mp4';
  if (extension === '.flac') return 'audio/flac';
  return 'audio/mpeg';
}

function createSmokeReferenceWav(): ArrayBuffer {
  const sampleRate = 44100;
  const durationSeconds = 3;
  const samples = sampleRate * durationSeconds;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const pulse = Math.pow(Math.max(0, Math.sin(time * Math.PI * 4)), 8);
    const sample = Math.sin(time * Math.PI * 2 * 92) * (.34 + pulse * .42) + Math.sin(time * Math.PI * 2 * 1800) * .16;
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  }
  return Uint8Array.from(bytes).buffer;
}

async function availableBundlePath(parent: string, requestedName: string): Promise<string> {
  const base = slugify(requestedName);
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = path.join(parent, suffix === 1 ? base : `${base}-${suffix}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error('Could not choose an unused export directory.');
}

function registerIpc(): void {
  ipcMain.handle('ui:set-scale', (event, requestedScale: number) => {
    const scale = Math.max(0.9, Math.min(2, Number(requestedScale) || 1.4));
    event.sender.setZoomFactor(scale);
    return scale;
  });
  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Data Horizon project',
      properties: ['openFile'],
      filters: [{ name: 'Data Horizon project', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const text = await fs.readFile(filePath, 'utf8');
    activeProjectPath = filePath;
    return { filePath, project: JSON.parse(text) as unknown };
  });

  ipcMain.handle('project:open-composition', async () => {
    let filePath = '';
    if (smokeTest) {
      const first = (await listVaultElements())[0];
      if (!first) return null;
      return { filePath: path.join(resolveVaultBundle(first.slug), 'project.horizon.json'), project: (await readManagedVaultProject(first.slug)).project };
    }
    const result = await dialog.showOpenDialog({
      title: 'Import Data Horizon project as editable layers',
      properties: ['openFile'],
      filters: [{ name: 'Data Horizon project', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    filePath = result.filePaths[0];
    const stats = await fs.stat(filePath);
    if (stats.size > 160 * 1024 * 1024) throw new Error('Composition imports are limited to 160 MB.');
    const project = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    const validation = validateProject(project);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    return { filePath, project };
  });

  ipcMain.handle('composition:read-file', async (_event, requestedPath: string) => {
    const filePath = path.resolve(String(requestedPath || ''));
    if (!filePath.toLowerCase().endsWith('.json')) throw new Error('Linked composition sources must be Data Horizon JSON projects.');
    const stats = await fs.lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('The linked composition source is not a regular project file.');
    if (stats.size > 160 * 1024 * 1024) throw new Error('Linked compositions are limited to 160 MB.');
    const project = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    const validation = validateProject(project);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    return { filePath, project, modifiedAt: stats.mtimeMs };
  });

  ipcMain.handle('composition:reveal-file', async (_event, requestedPath: string) => {
    const filePath = path.resolve(String(requestedPath || ''));
    const stats = await fs.lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('The linked composition source is not a regular project file.');
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('project:save', async (_event, project: unknown, saveAs = false) => {
    let filePath = saveAs ? '' : activeProjectPath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Data Horizon project',
        defaultPath: 'Untitled Horizon.horizon.json',
        filters: [{ name: 'Data Horizon project', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return null;
      filePath = normalizeProjectPath(result.filePath);
    }
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
    activeProjectPath = filePath;
    return { filePath };
  });

  ipcMain.handle('asset:open-image', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stats = await fs.stat(filePath);
    if (stats.size > 80 * 1024 * 1024) throw new Error('Phase 1 image imports are limited to 80 MB.');
    const bytes = await fs.readFile(filePath);
    const mimeType = mimeFor(filePath);
    return {
      name: path.basename(filePath),
      mimeType,
      uri: `data:${mimeType};base64,${bytes.toString('base64')}`,
      sourcePath: filePath
    };
  });

  ipcMain.handle('audio:open-preview', async () => {
    if (smokeTest) return { name: 'Smoke Reference Tone.wav', mimeType: 'audio/wav', bytes: createSmokeReferenceWav() };
    const result = await dialog.showOpenDialog({
      title: 'Load Reference Song',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'flac'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stats = await fs.stat(filePath);
    if (stats.size > 250 * 1024 * 1024) throw new Error('Reference songs are limited to 250 MB.');
    const bytes = await fs.readFile(filePath);
    return {
      name: path.basename(filePath),
      mimeType: audioMimeFor(filePath),
      bytes: Uint8Array.from(bytes).buffer
    };
  });

  ipcMain.handle('preset:open', async () => {
    if (smokeTest) return smokePreset ? structuredClone(smokePreset) : null;
    const result = await dialog.showOpenDialog({
      title: 'Import Data Horizon Layer Preset',
      properties: ['openFile'],
      filters: [{ name: 'Data Horizon layer preset', extensions: ['horizonpreset'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stats = await fs.stat(filePath);
    if (stats.size > 120 * 1024 * 1024) throw new Error('Layer preset files are limited to 120 MB.');
    const preset = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    const validation = validateLayerPreset(preset);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    return preset;
  });

  ipcMain.handle('preset:save', async (_event, preset: HorizonLayerPreset) => {
    const validation = validateLayerPreset(preset);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    if (smokeTest) {
      smokePreset = structuredClone(preset);
      return { filePath: `Smoke-${slugify(preset.name)}.horizonpreset` };
    }
    const result = await dialog.showSaveDialog({
      title: 'Export Data Horizon Layer Preset',
      defaultPath: `${slugify(preset.name)}.horizonpreset`,
      filters: [{ name: 'Data Horizon layer preset', extensions: ['horizonpreset'] }]
    });
    if (result.canceled || !result.filePath) return null;
    const filePath = normalizePresetPath(result.filePath);
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(preset, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
    return { filePath };
  });

  ipcMain.handle('publish:vault', async (_event, request: PublishBundleRequest) => publishToAssetVault(request));

  ipcMain.handle('vault:list', async () => listVaultElements());

  ipcMain.handle('vault:open-project', async (_event, slug: string) => {
    const result = await readManagedVaultProject(slug);
    activeProjectPath = '';
    return result;
  });

  ipcMain.handle('vault:read-project', async (_event, slug: string) => readManagedVaultProject(slug));

  ipcMain.handle('vault:reveal', async (_event, slug: string) => {
    const { bundlePath, manifest } = await readVaultManifest(slug);
    const entryPath = path.resolve(bundlePath, String(manifest.entrypoint || `${slug}.html`));
    if (!entryPath.startsWith(`${bundlePath}${path.sep}`)) throw new Error('The Asset Vault entrypoint resolved outside its managed package.');
    shell.showItemInFolder(entryPath);
    return true;
  });

  ipcMain.handle('vault:uninstall', async (_event, slug: string) => {
    const { bundlePath } = await readVaultManifest(slug);
    if (smokeTest) await fs.rm(bundlePath, { recursive: true, force: false });
    else await shell.trashItem(bundlePath);
    return { removed: true, recoverable: !smokeTest };
  });

  ipcMain.handle('publish:bundle', async (_event, request: PublishBundleRequest) => {
    const validation = validatePublish(request.project, request.options);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    const publishedProject = stripCompositionLinks(request.project);
    if (request.options.transparent) publishedProject.canvas.background[3] = 0;
    const destination = await dialog.showOpenDialog({
      title: `Export for ${request.options.target === 'quartic-pulse' ? 'Quartic Pulse' : 'Tempest Broadcast'}`,
      properties: ['openDirectory', 'createDirectory']
    });
    if (destination.canceled || !destination.filePaths[0]) return null;
    const bundlePath = await availableBundlePath(destination.filePaths[0], request.options.name);
    const runtimePath = path.join(bundlePath, 'runtime');
    await fs.mkdir(runtimePath, { recursive: true });
    const manifest = createBundleManifest(publishedProject, request.options);
    await Promise.all([
      fs.writeFile(path.join(bundlePath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
      fs.writeFile(path.join(bundlePath, 'project.horizon.json'), `${JSON.stringify(publishedProject, null, 2)}\n`, 'utf8'),
      fs.writeFile(path.join(runtimePath, 'project.js'), serializeRuntimeProject(publishedProject), 'utf8'),
      fs.copyFile(path.join(__dirname, 'renderer', 'runtime.html'), path.join(runtimePath, 'index.html')),
      fs.copyFile(path.join(__dirname, 'renderer', 'app.js'), path.join(runtimePath, 'app.js')),
      fs.copyFile(path.join(__dirname, 'renderer', 'styles.css'), path.join(runtimePath, 'styles.css')),
      fs.writeFile(path.join(bundlePath, 'README.txt'), [
        'DATA HORIZON PORTABLE BUNDLE',
        '',
        `Target: ${request.options.target}`,
        'Entry point: runtime/index.html',
        'Manifest: manifest.json',
        'The runtime and editor use the same WebGL2 renderer.',
        'Imported media is embedded in project.horizon.json for this initial portable format.'
      ].join('\n'), 'utf8')
    ]);
    const previewMatch = /^data:image\/png;base64,(.+)$/s.exec(request.previewPng || '');
    if (previewMatch) await fs.writeFile(path.join(bundlePath, 'preview.png'), Buffer.from(previewMatch[1], 'base64'));
    return { bundlePath, manifest, warnings: validation.warnings };
  });

  ipcMain.handle('window:open-runtime', async () => {
    const runtime = new BrowserWindow({
      width: 1280,
      height: 720,
      minWidth: 640,
      minHeight: 360,
      frame: false,
      backgroundColor: '#05070d',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    await runtime.loadFile(path.join(__dirname, 'renderer', 'runtime.html'));
    return true;
  });
}

app.whenReady().then(() => {
  registerIpc();
  mainWindow = createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
