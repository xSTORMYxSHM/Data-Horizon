'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('editor ships the authoring workspace surfaces', () => {
  const html = fs.readFileSync(path.join(root, 'dist/renderer/index.html'), 'utf8');
  for (const id of ['menuPopover', 'moveToolButton', 'maskBrushToolButton', 'maskBrushModeInput', 'maskBrushSizeInput', 'maskBrushSoftnessInput', 'maskBrushOpacityInput', 'brushContextBar', 'brushPrimaryModeButton', 'brushSecondaryModeButton', 'contextBrushSizeInput', 'contextBrushSoftnessInput', 'contextBrushOpacityInput', 'contextBrushColorInput', 'transparentColorButton', 'brushUndoStrokeButton', 'brushClearStrokesButton', 'finishBrushButton', 'maskBrushCursor', 'addPathButton', 'pathToolOptions', 'deletePathPointButton', 'finishPathButton', 'pathPointOverlay', 'pathPointLine', 'motionPathOverlay', 'motionPathLine', 'autoSelectInput', 'showTransformInput', 'showRulersInput', 'marqueeModeInput', 'guideCountLabel', 'guideOrientationInput', 'guidePositionInput', 'addGuideButton', 'lockGuidesButton', 'clearGuidesButton', 'foregroundColorInput', 'backgroundColorInput', 'swapColorsButton', 'layerTree', 'lockLayersButton', 'layoutSelectionCount', 'alignmentReferenceInput', 'layerClipboardStatus', 'cutLayersButton', 'copyLayersButton', 'pasteLayersButton', 'pasteLayersInPlaceButton', 'importCompositionButton', 'assetsDockView', 'assetBrowser', 'masksDockView', 'maskBrowser', 'addPaintMaskDockButton', 'nodeDockView', 'nodeAddInput', 'nodeAddButton', 'nodeGraphViewport', 'nodeGraph', 'presetsDockView', 'presetBrowser', 'saveSelectionPresetButton', 'importPresetButton', 'vaultDockView', 'vaultBrowser', 'refreshVaultButton', 'publishToVaultButton', 'presetDialog', 'presetForm', 'presetNameInput', 'presetDescriptionInput', 'newProjectDialog', 'newProjectGrid', 'newProjectNameInput', 'closeNewProjectButton', 'cancelNewProjectButton', 'horizonCanvas', 'canvasSelection', 'canvasTransformReadout', 'canvasGuides', 'customGuideOverlay', 'canvasRulers', 'horizontalRuler', 'verticalRuler', 'smartGuideOverlay', 'canvasMarquee', 'canvasMarqueeLabel', 'zoomPresetInput', 'snapToggleButton', 'guidesToggleButton', 'smartGuidesToggleButton', 'motionPathToggleButton', 'addMotionKeyButton', 'timelinePlayButton', 'timelineScrubber', 'timelineDurationInput', 'timelineCollapseButton', 'animationTargetInput', 'animationPresetInput', 'applyAnimationPresetButton', 'addKeyframeButton', 'autoKeyButton', 'timelineTrackFilterInput', 'timelineViewToggleButton', 'timelineWorkAreaButton', 'timelineKeyEditor', 'timelineKeyTimeInput', 'timelineKeyValueInput', 'timelineKeyEasingInput', 'duplicateKeyframesButton', 'deleteKeyframesButton', 'timelineLoopStartInput', 'timelineLoopEndInput', 'timelineCurveEditor', 'timelineCurveSvg', 'timelineCurveTrackLabel', 'timelineCurveRangeLabel', 'timelineReduceToleranceInput', 'copyKeyframesButton', 'pasteKeyframesButton', 'timelineSnapFramesButton', 'reduceKeyframesButton', 'timelineTracks', 'layerInspector', 'layerLockedInput', 'layerXInput', 'sourceControls', 'effectPresetInput', 'effectPresetMotionInput', 'effectPresetCycleInput', 'previewEffectPresetButton', 'applyEffectPresetButton', 'effectAutoKeyButton', 'effectPresetDescription', 'effectList', 'bindingList', 'audioDriverStatus', 'audioDriverSignal', 'audioDriverStatusTitle', 'audioDriverStatusDetail', 'audioPreviewToggleButton', 'bakeAudioAutomationButton', 'loadReferenceAudioButton', 'referenceAudioPlayButton', 'referenceAudioStopButton', 'referenceAudioProgress', 'referenceAudioVolume', 'referenceAudioLoop', 'referenceAudioTimelineSync', 'mockAudioToggle', 'importImageButton', 'addTextButton', 'addHudTextButton', 'addShapeButton', 'addFrameButton', 'addSpectrumButton', 'addWaveformButton', 'addParticlesButton', 'openTemplatesButton', 'templateDialog', 'publishProjectButton', 'publishDialog', 'publishPaletteSection', 'publishPaletteList', 'publishPaletteTemplate', 'addPublishPaletteButton', 'publishVaultSection', 'publishVaultButton', 'infoDialog', 'workspaceDialog', 'workspaceSavedSelect', 'workspaceNameInput', 'saveWorkspaceButton', 'uiScaleButton', 'uiScaleInput', 'uiScaleValue', 'uiScaleAutoButton', 'toolboxResizer', 'rightDockResizer', 'timelineResizer', 'inspectorResizer']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const preset of ['sky', 'horizon', 'terrain', 'foreground']) assert.match(html, new RegExp(`data-add-region-mask="${preset}"`));
  for (const id of ['layerSearchInput', 'clearLayerSearchButton', 'layerFilterInput', 'collapseLayerGroupsButton', 'expandLayerGroupsButton', 'revealSelectedLayerButton', 'layerFilterStatus', 'layerSelectionSetInput', 'saveLayerSelectionSetButton', 'recallLayerSelectionSetButton', 'deleteLayerSelectionSetButton', 'soloLayersButton']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-add-effect="paintMask"/);
  assert.match(html, /data-add-effect="paintLayer"/);
  assert.match(html, /Drag rows above, below, or into groups/);
  for (const preset of ['detail', 'ink', 'soft']) assert.match(html, new RegExp(`data-brush-preset="${preset}"`));
  for (const preset of ['comic-ink', 'neon-edge', 'dream-glow', 'crt-signal', 'heat-distortion', 'audio-pulse-outline']) assert.match(html, new RegExp(`value="${preset}"`));
  for (const template of ['lower-third', 'alert', 'transition']) assert.match(html, new RegExp(`data-insert-template="${template}"`));
  for (const template of ['blank', 'quartic-visualizer', 'tempest-window-border', 'tempest-hud-overlay', 'tempest-transition']) assert.match(html, new RegExp(`data-project-template="${template}"`));
  for (const preset of ['fade-in', 'slide-in', 'pulse', 'fade-out']) assert.match(html, new RegExp(`value="${preset}"`));
  for (const menu of ['file', 'edit', 'select', 'layer', 'effects', 'audio', 'view', 'window', 'workspace', 'help']) assert.match(html, new RegExp(`data-menu="${menu}"`));
  for (const panel of ['toolbox', 'inspector', 'layers', 'timeline']) {
    assert.match(html, new RegExp(`data-workspace-panel="${panel}"`));
    assert.match(html, new RegExp(`data-workspace-floating="${panel}"`));
  }
  for (const tab of ['layers', 'assets', 'masks', 'nodes', 'presets', 'vault']) assert.match(html, new RegExp(`data-layer-tab="${tab}"`));
  assert.match(html, /DATA HORIZON 0\.20\.0/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /'unsafe-inline'/);
  const app = fs.readFileSync(path.join(root, 'dist/renderer/app.js'), 'utf8');
  assert.match(app, /Extract to Layer/);
  assert.match(app, /Make It Dance/);
  assert.match(app, /extractEffectToLayer/);
  assert.match(app, /Paint \/ Erase active/);
  assert.match(app, /retouchEffectLayer/);
  assert.match(app, /Outline extracted automatically/);
  assert.match(app, /blendFuncSeparate/);
  assert.match(app, /Brush editing finished/);
  assert.match(app, /Output min offset/);
  assert.match(app, /Beat Pulse/);
  assert.match(app, /Generated test signal started/);
  assert.match(app, /Audio Pulse Outline/);
  assert.match(app, /editable effect/);
  assert.match(app, /Auto Key is recording/);
  assert.match(app, /looping animation track/);
  assert.match(app, /keyframe.*moved/);
  assert.match(app, /Baked.*driver samples/);
  assert.match(app, /Effect preset preview stopped/);
  assert.match(app, /curve point.*moved/);
  assert.match(app, /Reduced.*keys to/);
  assert.match(app, /Copied.*keyframe/);
  assert.match(app, /Paired X\/Y motion point added/);
  assert.match(app, /Motion point updated/);
  assert.match(app, /Aligned.*layer/);
  assert.match(app, /Distributed.*layers/);
  assert.match(app, /Locked.*layer/);
  assert.match(app, /Smart guides.*enabled/);
  assert.match(app, /guide added at/);
  assert.match(app, /Canvas guides.*locked/);
  assert.match(app, /Enclosed.*layer/);
  assert.match(app, /Marquee selects layers/);
  assert.match(app, /Copied.*layer root/);
  assert.match(app, /Pasted.*layer root/);
  assert.match(app, /Moved.*layer root/);
  assert.match(app, /relocateLayers/);
  assert.match(app, /All layer groups collapsed/);
  assert.match(app, /revealSelectedLayerInTree/);
  assert.match(app, /toggleSoloLayers/);
  assert.match(app, /Layer visibility restored/);
  const css = fs.readFileSync(path.join(root, 'dist/renderer/styles.css'), 'utf8');
  assert.match(css, /overflow-anchor:\s*none/);
});

test('editor and runtime load the same renderer bundle', () => {
  const editor = fs.readFileSync(path.join(root, 'dist/renderer/index.html'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'dist/renderer/runtime.html'), 'utf8');
  assert.match(editor, /src="app\.js"/);
  assert.match(runtime, /src="app\.js"/);
  assert.match(runtime, /src="project\.js"/);
});

test('desktop host keeps renderer isolation enabled', () => {
  const main = fs.readFileSync(path.join(root, 'dist/main.js'), 'utf8');
  assert.match(main, /contextIsolation:\s*!0|contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*!1|nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*!0|sandbox:\s*true/);
  assert.match(main, /audio:open-preview/);
  assert.match(main, /preset:open/);
  assert.match(main, /preset:save/);
  assert.match(main, /publish:vault/);
  assert.match(main, /vault:list/);
  assert.match(main, /vault:open-project/);
  assert.match(main, /vault:read-project/);
  assert.match(main, /vault:reveal/);
  assert.match(main, /vault:uninstall/);
  assert.match(main, /project:open-composition/);
  assert.match(main, /composition:read-file/);
  assert.match(main, /composition:reveal-file/);
  assert.match(main, /stripCompositionLinks/);
});

test('Windows packaging materializes Electron before copying its runtime', () => {
  const packager = fs.readFileSync(path.join(root, 'tools/package-windows.mjs'), 'utf8');
  assert.match(packager, /require\('electron'\)/);
  assert.match(packager, /path\.dirname\(electronExecutable\)/);
  assert.doesNotMatch(packager, /require\.resolve\('electron\/package\.json'\)/);
});
