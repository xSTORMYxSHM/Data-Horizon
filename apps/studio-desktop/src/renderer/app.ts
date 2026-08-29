import {
  HistoryStore,
  addLayer,
  applyAnimationPreset,
  createBroadcastTemplate,
  createEffect,
  createGroupLayer,
  createHudTextLayer,
  createId,
  createImageLayer,
  createLayerPreset,
  createParticleLayer,
  createPaintLayer,
  createPaintMask,
  createPathLayer,
  createProject,
  createProjectTemplate,
  createRegionMask,
  createShapeLayer,
  createSpectrumLayer,
  createTextLayer,
  createWaveformLayer,
  duplicateLayer,
  editAnimationKeyframes,
  extractEffectToLayer,
  detachLinkedComposition,
  evaluateTimeline,
  findLayer,
  flattenLayers,
  insertLayerPreset,
  insertProjectAsGroup,
  moveLayer,
  mutateProject,
  normalizeLayerPreset,
  normalizeProject,
  parameterTargets,
  readParameterValue,
  refreshLinkedComposition,
  reduceAnimationTrackKeyframes,
  relocateLayers,
  removeLayer,
  removeLayerSelectionSet,
  removeLayerPreset,
  removeAnimationTrack,
  removeAnimationKeyframes,
  setAnimationTrackEnabled,
  updateLayer,
  upsertLayerSelectionSet,
  upsertKeyframe,
  upsertLayerPreset,
  validateLayerPreset,
  validateProject,
  wrapLayerInGroup,
  type AudioSource,
  type AnimationPreset,
  type AnimationKeyframe,
  type AnimationTrack,
  type BlendMode,
  type CompositionLinkSource,
  type EffectType,
  type HorizonEffect,
  type HorizonLayer,
  type HorizonLayerPreset,
  type HorizonPalette,
  type HorizonProject,
  type HudTextPreset,
  type LayerTransform,
  type LayerDropPlacement,
  type KeyframeEasing,
  type PaintMaskStroke,
  type PaintLayerStroke,
  type PathLayer,
  type ParameterBinding,
  type ProjectTemplateKind
} from '@data-horizon/project-model';
import { AudioModulationEngine, analyzeSpectrumFrame, createMockAudioFrame, type AudioFeatureFrame } from '@data-horizon/audio-modulation';
import { HorizonRenderer } from '@data-horizon/render-runtime';

interface ImportedImage {
  name: string;
  mimeType: string;
  uri: string;
  sourcePath: string;
}

interface ImportedAudio {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
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

interface HorizonDesktopApi {
  openProject(): Promise<{ filePath: string; project: unknown } | null>;
  openComposition(): Promise<{ filePath: string; project: unknown } | null>;
  readCompositionFile(filePath: string): Promise<{ filePath: string; project: unknown; modifiedAt: number }>;
  revealCompositionFile(filePath: string): Promise<boolean>;
  saveProject(project: HorizonProject, saveAs?: boolean): Promise<{ filePath: string } | null>;
  openImage(): Promise<ImportedImage | null>;
  openAudio(): Promise<ImportedAudio | null>;
  openPreset(): Promise<HorizonLayerPreset | null>;
  savePreset(preset: HorizonLayerPreset): Promise<{ filePath: string } | null>;
  publishBundle(request: {
    project: HorizonProject;
    options: { target: 'quartic-pulse' | 'tempest-broadcast'; name: string; tempestKind?: string; transparent: boolean };
    previewPng: string;
  }): Promise<{ bundlePath: string; warnings: string[] } | null>;
  publishVault(request: {
    project: HorizonProject;
    options: { target: 'tempest-broadcast'; name: string; tempestKind?: string; transparent: boolean };
    previewPng: string;
  }): Promise<{ bundlePath: string; entryPath: string; sourceName: string; updated: boolean; warnings: string[] }>;
  listVault(): Promise<VaultElementSummary[]>;
  openVaultProject(slug: string): Promise<{ project: unknown; vaultPath: string }>;
  readVaultProject(slug: string): Promise<{ project: unknown; vaultPath: string }>;
  revealVault(slug: string): Promise<boolean>;
  uninstallVault(slug: string): Promise<{ removed: boolean; recoverable: boolean }>;
  openRuntime(): Promise<boolean>;
  setUiScale(scale: number): Promise<number>;
}

declare global {
  interface Window {
    horizonDesktop: HorizonDesktopApi;
    __dataHorizonReady?: boolean;
    __dataHorizonDiagnostics?: unknown;
    __DATA_HORIZON_PROJECT__?: HorizonProject | null;
    __DATA_HORIZON_TELEMETRY_URL__?: string;
    dataHorizonRuntime?: { setAudioFrame(frame: Partial<AudioFeatureFrame>): void };
  }
}

const autosaveKey = 'dataHorizonPhase1AutosaveV1';
const editorMode = document.body.dataset.mode !== 'runtime';
const canvasElement = document.querySelector<HTMLCanvasElement>('#horizonCanvas');
if (!canvasElement) throw new Error('Data Horizon canvas is missing.');
const canvas: HTMLCanvasElement = canvasElement;

const renderer = new HorizonRenderer(canvas);
const modulationEngine = new AudioModulationEngine();
let selectedLayerId = '';
let selectedLayerIds = new Set<string>();
let draggedLayerIds: string[] = [];
let dirty = false;
let savedPath = '';
let toastTimer = 0;
let frameSequence = 0;
let lastFrame = performance.now();
let lastEditorRefresh = 0;
let mockAudio = editorMode;
let currentAudio: AudioFeatureFrame = createMockAudioFrame(0);
let externalAudio: AudioFeatureFrame | null = null;
let canvasZoom: number | null = null;
let snappingEnabled = true;
let guidesVisible = true;
let smartGuidesEnabled = true;
let spacePressed = false;
let timelinePlaying = false;
let timelineTime = 0;
const autoKeyStorageKey = 'dataHorizonAutoKeyV1';
let autoKeyEnabled = (() => {
  try { return localStorage.getItem(autoKeyStorageKey) === 'true'; } catch { return false; }
})();
let selectedKeyframeIds = new Set<string>();
let selectedAnimationTrackId = '';
let soloAnimationTrackId = '';
let timelineTrackFilter: 'selected' | 'all' = 'selected';
let timelineCurveView = false;
let timelineSnapToFrames = true;
let animationKeyClipboard: Array<{ time: number; value: number; easing: KeyframeEasing }> = [];
interface LayerClipboardPayload {
  format: 'data-horizon.layer-clipboard';
  version: 1;
  createdWith: string;
  sourceProject: string;
  sourceCanvas: { width: number; height: number };
  items: HorizonLayerPreset[];
}
const layerClipboardStorageKey = 'dataHorizonLayerClipboardV1';
function restoreLayerClipboard(): LayerClipboardPayload | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(layerClipboardStorageKey) || 'null') as Partial<LayerClipboardPayload> | null;
    if (!parsed || parsed.format !== 'data-horizon.layer-clipboard' || parsed.version !== 1 || !Array.isArray(parsed.items) || !parsed.items.length) return undefined;
    if (parsed.items.some((preset) => !validateLayerPreset(preset).ok)) return undefined;
    return {
      format: 'data-horizon.layer-clipboard', version: 1,
      createdWith: String(parsed.createdWith || ''), sourceProject: String(parsed.sourceProject || 'Unknown Project'),
      sourceCanvas: { width: Number(parsed.sourceCanvas?.width) || 1920, height: Number(parsed.sourceCanvas?.height) || 1080 },
      items: parsed.items.map(normalizeLayerPreset)
    };
  } catch { return undefined; }
}
let layerClipboard = restoreLayerClipboard();
let layerPasteSerial = 0;
let motionPathsVisible = true;
let timelineWorkAreaEnabled = false;
let timelineLoopStart = 0;
let timelineLoopEnd = 8;
let effectPresetPreviewProject: HorizonProject | null = null;
let audioAutomationRecording = false;
let audioAutomationLastSample = -1;
let audioAutomationTargets = new Set<string>();
let audioAutomationSamples = new Map<string, Map<number, number>>();
let autoSelectEnabled = true;
let showTransformControls = true;
let marqueeSelectionMode: 'intersect' | 'contain' = 'contain';
type DockTab = 'layers' | 'assets' | 'masks' | 'nodes' | 'presets' | 'vault';
type LayerTreeFilter = 'all' | 'visible' | 'hidden' | 'locked' | 'effects' | 'audio' | 'animated' | 'groups';
let activeDockTab: DockTab = 'layers';
let layerSearchQuery = '';
let layerTreeFilter: LayerTreeFilter = 'all';
let selectedLayerSelectionSetId = '';
let soloLayerVisibilitySnapshot: Map<string, boolean> | null = null;
const layerGroupCollapseStorageKey = 'dataHorizonLayerGroupCollapseV1';
let collapsedLayerGroupsByProject = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(layerGroupCollapseStorageKey) || '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => Array.isArray(value)).map(([id, value]) => [id, (value as unknown[]).filter((item): item is string => typeof item === 'string')]));
  } catch { return {} as Record<string, string[]>; }
})();
let lastRenderedSelectionId = '';
let vaultElements: VaultElementSummary[] = [];
let vaultLoaded = false;
let vaultLoading = false;
let activeEffectId = '';
type EditorTool = 'move' | 'mask' | 'path';
let activeTool: EditorTool = 'move';
let activePaintMaskId = '';
type BrushMode = PaintMaskStroke['mode'] | PaintLayerStroke['mode'];
let maskBrushMode: BrushMode = 'hide';
let maskBrushSize = 120;
let maskBrushSoftness = .45;
let maskBrushOpacity = 1;
let paintBrushColor = '#19DBFF';
type BrushPresetId = 'detail' | 'ink' | 'soft';
const brushPresets: Record<BrushPresetId, { size: number; softness: number; opacity: number }> = {
  detail: { size: 28, softness: .12, opacity: 1 },
  ink: { size: 120, softness: .45, opacity: 1 },
  soft: { size: 240, softness: .88, opacity: .35 }
};
let activeBrushPreset: BrushPresetId | 'custom' = 'ink';
const referenceAudio = new Audio();
referenceAudio.preload = 'metadata';
let referenceAudioName = '';
let referenceAudioUrl = '';
let referenceAudioContext: AudioContext | null = null;
let referenceAudioAnalyser: AnalyserNode | null = null;
let referenceFrequencyData = new Uint8Array(0);
let referenceWaveformData = new Float32Array(0);
let referenceBassBaseline = .08;
let referenceBeat = 0;
let referenceLastBeat = -1;

type UiScaleMode = 'auto' | number;
const uiScaleKey = 'dataHorizonUiScaleV1';
const uiScaleSteps = [1, 1.1, 1.25, 1.4, 1.5, 1.6, 1.75, 2];
let uiScaleMode: UiScaleMode = restoreUiScaleMode();
let appliedUiScale = 0;

function recommendedUiScale(): number {
  if (new URLSearchParams(window.location.search).has('smoke')) return 1.4;
  const displayWidth = Math.max(window.screen.width, window.screen.height);
  if (displayWidth >= 3800) return 1.75;
  if (displayWidth >= 3000) return 1.6;
  if (displayWidth >= 2400) return 1.5;
  if (displayWidth >= 1750) return 1.4;
  return 1.2;
}

function restoreUiScaleMode(): UiScaleMode {
  try {
    const stored = localStorage.getItem(uiScaleKey);
    if (!stored || stored === 'auto') return 'auto';
    const scale = Number(stored);
    return Number.isFinite(scale) ? Math.max(.9, Math.min(2, scale)) : 'auto';
  } catch {
    return 'auto';
  }
}

function resolvedUiScale(): number {
  return uiScaleMode === 'auto' ? recommendedUiScale() : uiScaleMode;
}

function updateUiScaleControls(): void {
  if (!editorMode) return;
  const scale = resolvedUiScale();
  const percent = `${Math.round(scale * 100)}%`;
  const button = document.querySelector<HTMLButtonElement>('#uiScaleButton');
  const select = document.querySelector<HTMLSelectElement>('#uiScaleInput');
  const output = document.querySelector<HTMLOutputElement>('#uiScaleValue');
  if (button) {
    button.textContent = `UI ${percent}`;
    button.title = `Application interface scale: ${percent}${uiScaleMode === 'auto' ? ' (Auto)' : ''}`;
  }
  if (select) select.value = uiScaleMode === 'auto' ? 'auto' : String(uiScaleMode);
  if (output) output.textContent = `${percent}${uiScaleMode === 'auto' ? ' AUTO' : ''}`;
}

async function applyUiScale(notice = ''): Promise<void> {
  if (!editorMode) return;
  const scale = resolvedUiScale();
  updateUiScaleControls();
  if (Math.abs(scale - appliedUiScale) > .001) {
    appliedUiScale = await window.horizonDesktop.setUiScale(scale);
    requestAnimationFrame(() => {
      applyWorkspaceLayout();
      applyCanvasViewport();
      updateCanvasOverlays();
    });
  }
  if (notice) showToast(notice);
}

function setUiScaleMode(mode: UiScaleMode, notice = true): void {
  uiScaleMode = mode === 'auto' ? 'auto' : Math.max(.9, Math.min(2, mode));
  try { localStorage.setItem(uiScaleKey, String(uiScaleMode)); } catch { /* Optional preference persistence. */ }
  void applyUiScale(notice ? `Interface scaled to ${Math.round(resolvedUiScale() * 100)}%.` : '');
}

function stepUiScale(direction: -1 | 1): void {
  const current = resolvedUiScale();
  const next = direction > 0
    ? uiScaleSteps.find((scale) => scale > current + .001) ?? uiScaleSteps[uiScaleSteps.length - 1]
    : [...uiScaleSteps].reverse().find((scale) => scale < current - .001) ?? uiScaleSteps[0];
  setUiScaleMode(next);
}

type WorkspacePanelId = 'toolbox' | 'inspector' | 'layers' | 'timeline';

interface WorkspacePanelState {
  visible: boolean;
  floating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkspaceLayout {
  name: string;
  toolboxWidth: number;
  dockWidth: number;
  timelineHeight: number;
  timelineCollapsed: boolean;
  inspectorHeight: number;
  panels: Record<WorkspacePanelId, WorkspacePanelState>;
}

const workspaceCurrentKey = 'dataHorizonWorkspaceCurrentV1';
const workspaceSavedKey = 'dataHorizonWorkspaceLayoutsV1';
const workspacePanelIds: WorkspacePanelId[] = ['toolbox', 'inspector', 'layers', 'timeline'];

function defaultWorkspaceLayout(): WorkspaceLayout {
  return {
    name: 'Editing',
    toolboxWidth: 82,
    dockWidth: 410,
    timelineHeight: 132,
    timelineCollapsed: false,
    inspectorHeight: 490,
    panels: {
      toolbox: { visible: true, floating: false, x: 24, y: 110, width: 210, height: 680 },
      inspector: { visible: true, floating: false, x: Math.max(24, window.innerWidth - 452), y: 104, width: 420, height: 650 },
      layers: { visible: true, floating: false, x: Math.max(24, window.innerWidth - 412), y: Math.max(110, window.innerHeight - 510), width: 380, height: 470 },
      timeline: { visible: true, floating: false, x: 130, y: Math.max(110, window.innerHeight - 300), width: Math.max(620, window.innerWidth - 260), height: 250 }
    }
  };
}

function previewWorkspaceLayout(): WorkspaceLayout {
  const layout = defaultWorkspaceLayout();
  layout.name = 'Preview';
  for (const panel of workspacePanelIds) layout.panels[panel].visible = false;
  return layout;
}

function normalizeWorkspaceLayout(value: unknown): WorkspaceLayout {
  const fallback = defaultWorkspaceLayout();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<WorkspaceLayout>;
  const numeric = (candidate: unknown, defaultValue: number, minimum: number, maximum: number): number => {
    const parsed = Number(candidate);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : defaultValue));
  };
  const layout: WorkspaceLayout = {
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 40) : fallback.name,
    toolboxWidth: numeric(source.toolboxWidth, fallback.toolboxWidth, 64, 320),
    dockWidth: numeric(source.dockWidth, fallback.dockWidth, 280, 760),
    timelineHeight: numeric(source.timelineHeight, fallback.timelineHeight, 90, 420),
    timelineCollapsed: typeof source.timelineCollapsed === 'boolean' ? source.timelineCollapsed : fallback.timelineCollapsed,
    inspectorHeight: numeric(source.inspectorHeight, fallback.inspectorHeight, 180, 700),
    panels: { ...fallback.panels }
  };
  for (const id of workspacePanelIds) {
    const panelSource = source.panels?.[id] as Partial<WorkspacePanelState> | undefined;
    const panelFallback = fallback.panels[id];
    layout.panels[id] = {
      visible: typeof panelSource?.visible === 'boolean' ? panelSource.visible : panelFallback.visible,
      floating: typeof panelSource?.floating === 'boolean' ? panelSource.floating : panelFallback.floating,
      x: numeric(panelSource?.x, panelFallback.x, 0, Math.max(0, window.innerWidth - 80)),
      y: numeric(panelSource?.y, panelFallback.y, 28, Math.max(28, window.innerHeight - 50)),
      width: numeric(panelSource?.width, panelFallback.width, id === 'timeline' ? 480 : 180, Math.max(480, window.innerWidth)),
      height: numeric(panelSource?.height, panelFallback.height, 120, Math.max(160, window.innerHeight - 28))
    };
  }
  return layout;
}

function restoreWorkspaceLayout(): WorkspaceLayout {
  if (new URLSearchParams(window.location.search).has('smoke')) return defaultWorkspaceLayout();
  try {
    return normalizeWorkspaceLayout(JSON.parse(localStorage.getItem(workspaceCurrentKey) || 'null'));
  } catch {
    return defaultWorkspaceLayout();
  }
}

function savedWorkspaceLayouts(): Record<string, WorkspaceLayout> {
  try {
    const source = JSON.parse(localStorage.getItem(workspaceSavedKey) || '{}') as unknown;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    return Object.fromEntries(Object.entries(source).map(([name, layout]) => [name, normalizeWorkspaceLayout(layout)]));
  } catch {
    return {};
  }
}

let workspaceLayout = restoreWorkspaceLayout();
let workspaceResizeTimer = 0;

function persistWorkspaceLayout(): void {
  try {
    localStorage.setItem(workspaceCurrentKey, JSON.stringify(workspaceLayout));
  } catch {
    // Workspace persistence is optional and must never block the compositor.
  }
}

function setWorkspaceLayout(next: WorkspaceLayout, notice = ''): void {
  workspaceLayout = normalizeWorkspaceLayout(next);
  applyWorkspaceLayout();
  persistWorkspaceLayout();
  renderWorkspaceDialog();
  if (notice) showToast(notice);
}

function applyWorkspaceLayout(persist = false): void {
  if (!editorMode) return;
  const shell = element<HTMLElement>('.studio-shell');
  const stage = element<HTMLElement>('.stage-panel');
  const rightDock = element<HTMLElement>('.right-dock');
  const toolboxDocked = workspaceLayout.panels.toolbox.visible && !workspaceLayout.panels.toolbox.floating;
  const inspectorDocked = workspaceLayout.panels.inspector.visible && !workspaceLayout.panels.inspector.floating;
  const layersDocked = workspaceLayout.panels.layers.visible && !workspaceLayout.panels.layers.floating;
  const timelineDocked = workspaceLayout.panels.timeline.visible && !workspaceLayout.panels.timeline.floating;
  const rightDockVisible = inspectorDocked || layersDocked;
  shell.style.setProperty('--toolbox-width', `${toolboxDocked ? workspaceLayout.toolboxWidth : 0}px`);
  shell.style.setProperty('--dock-width', `${rightDockVisible ? workspaceLayout.dockWidth : 0}px`);
  shell.style.setProperty('--timeline-height', `${timelineDocked ? (workspaceLayout.timelineCollapsed ? 38 : workspaceLayout.timelineHeight) : 0}px`);
  shell.style.setProperty('--inspector-height', `${workspaceLayout.inspectorHeight}px`);
  shell.classList.toggle('toolbox-hidden', !toolboxDocked);
  shell.classList.toggle('docks-hidden', !rightDockVisible);
  stage.classList.toggle('timeline-hidden', !timelineDocked);
  stage.classList.toggle('timeline-detached', !timelineDocked);
  const timelinePanel = element<HTMLElement>('[data-workspace-panel="timeline"]');
  timelinePanel.classList.toggle('timeline-collapsed', workspaceLayout.timelineCollapsed);
  const collapseButton = element<HTMLButtonElement>('#timelineCollapseButton');
  collapseButton.textContent = workspaceLayout.timelineCollapsed ? '▴' : '▾';
  collapseButton.title = workspaceLayout.timelineCollapsed ? 'Expand Timeline' : 'Collapse Timeline';
  collapseButton.setAttribute('aria-label', collapseButton.title);
  collapseButton.setAttribute('aria-expanded', String(!workspaceLayout.timelineCollapsed));
  rightDock.classList.toggle('inspector-detached', !inspectorDocked);
  rightDock.classList.toggle('layers-detached', !layersDocked);
  rightDock.classList.toggle('workspace-empty', !rightDockVisible);

  for (const id of workspacePanelIds) {
    const panel = element<HTMLElement>(`[data-workspace-panel="${id}"]`);
    const state = workspaceLayout.panels[id];
    panel.classList.toggle('workspace-hidden', !state.visible);
    panel.classList.toggle('workspace-floating', state.visible && state.floating);
    const toggle = panel.querySelector<HTMLButtonElement>(`[data-workspace-float-toggle="${id}"]`);
    if (toggle) {
      toggle.textContent = state.floating ? '◆' : '◇';
      toggle.title = state.floating ? `Dock ${id}` : `Float ${id}`;
    }
    if (state.visible && state.floating) {
      const minimumWidth = id === 'timeline' ? 480 : 180;
      state.width = Math.max(minimumWidth, Math.min(state.width, window.innerWidth));
      state.height = Math.max(120, Math.min(state.height, window.innerHeight - 28));
      state.x = Math.max(0, Math.min(state.x, window.innerWidth - Math.min(80, state.width)));
      state.y = Math.max(28, Math.min(state.y, window.innerHeight - 45));
      panel.style.left = `${state.x}px`;
      panel.style.top = `${state.y}px`;
      panel.style.width = `${state.width}px`;
      panel.style.height = `${state.height}px`;
    } else {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('width');
      panel.style.removeProperty('height');
    }
  }

  element<HTMLElement>('#toolboxResizer').hidden = !toolboxDocked;
  element<HTMLElement>('#rightDockResizer').hidden = !rightDockVisible;
  element<HTMLElement>('#timelineResizer').hidden = !timelineDocked || workspaceLayout.timelineCollapsed;
  element<HTMLElement>('#inspectorResizer').hidden = !(inspectorDocked && layersDocked);
  if (persist) persistWorkspaceLayout();
  requestAnimationFrame(updateCanvasOverlays);
}

function renderWorkspaceDialog(): void {
  if (!editorMode || !document.querySelector('#workspaceDialog')) return;
  for (const id of workspacePanelIds) {
    element<HTMLInputElement>(`[data-workspace-visible="${id}"]`).checked = workspaceLayout.panels[id].visible;
    element<HTMLInputElement>(`[data-workspace-floating="${id}"]`).checked = workspaceLayout.panels[id].floating;
  }
  element<HTMLInputElement>('#workspaceToolboxWidth').value = String(Math.round(workspaceLayout.toolboxWidth));
  element<HTMLInputElement>('#workspaceDockWidth').value = String(Math.round(workspaceLayout.dockWidth));
  element<HTMLInputElement>('#workspaceTimelineHeight').value = String(Math.round(workspaceLayout.timelineHeight));
  element<HTMLInputElement>('#workspaceInspectorHeight').value = String(Math.round(workspaceLayout.inspectorHeight));
  const select = element<HTMLSelectElement>('#workspaceSavedSelect');
  const previous = select.value;
  select.replaceChildren();
  for (const name of Object.keys(savedWorkspaceLayouts()).sort((a, b) => a.localeCompare(b))) {
    const option = document.createElement('option');
    option.value = name; option.textContent = name; select.append(option);
  }
  if (!select.options.length) {
    const option = document.createElement('option');
    option.value = ''; option.textContent = 'No saved workspaces'; select.append(option);
  }
  select.value = Array.from(select.options).some((option) => option.value === previous) ? previous : select.options[0].value;
  element<HTMLButtonElement>('#loadWorkspaceButton').disabled = !select.value;
  element<HTMLButtonElement>('#deleteWorkspaceButton').disabled = !select.value;
  updateUiScaleControls();
}

function saveNamedWorkspace(): void {
  const input = element<HTMLInputElement>('#workspaceNameInput');
  const name = input.value.trim().slice(0, 40);
  if (!name) {
    input.focus();
    showToast('Enter a workspace name first.', true);
    return;
  }
  const layouts = savedWorkspaceLayouts();
  workspaceLayout.name = name;
  layouts[name] = normalizeWorkspaceLayout(workspaceLayout);
  localStorage.setItem(workspaceSavedKey, JSON.stringify(layouts));
  persistWorkspaceLayout();
  renderWorkspaceDialog();
  element<HTMLSelectElement>('#workspaceSavedSelect').value = name;
  showToast(`Workspace “${name}” saved.`);
}

function demoImageUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#040813"/><stop offset=".52" stop-color="#10234a"/><stop offset="1" stop-color="#03050a"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="#45e5ff" stop-opacity=".9"/><stop offset=".22" stop-color="#5e7cff" stop-opacity=".32"/><stop offset="1" stop-color="#050714" stop-opacity="0"/></radialGradient>
    <linearGradient id="terrain" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#102a4a"/><stop offset=".48" stop-color="#091326"/><stop offset="1" stop-color="#160d35"/></linearGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#5be8ff" stroke-opacity=".18" stroke-width="2"/></pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <circle cx="960" cy="470" r="520" fill="url(#halo)"/>
  <g fill="#92eaff" opacity=".66">${Array.from({ length: 52 }, (_, index) => {
    const x = (index * 397) % 1880 + 20;
    const y = (index * 191) % 480 + 30;
    const radius = 1 + (index % 4) * .55;
    return `<circle cx="${x}" cy="${y}" r="${radius}"/>`;
  }).join('')}</g>
  <path d="M0 756L170 628 310 704 468 514 604 670 760 438 914 642 1055 348 1208 612 1370 494 1514 638 1692 472 1920 684V1080H0Z" fill="url(#terrain)" stroke="#43dfff" stroke-opacity=".5" stroke-width="5"/>
  <path d="M0 820L220 684 406 794 612 626 786 776 1000 580 1188 748 1410 606 1604 754 1920 632V1080H0Z" fill="#050a16" stroke="#8a72ff" stroke-opacity=".52" stroke-width="4"/>
  <path d="M0 790C330 700 590 910 940 730S1510 800 1920 620V1080H0Z" fill="url(#grid)" opacity=".7"/>
  <g fill="none" stroke="#4ce7ff" stroke-width="4" opacity=".55"><path d="M60 1020C420 870 570 970 920 760S1500 860 1880 620"/><path d="M210 1080C530 910 760 1040 1120 760S1590 800 1800 710"/><path d="M640 1080C850 910 1030 940 1260 750S1670 710 1900 650"/></g>
  <g font-family="monospace" fill="#80f5ff" opacity=".5"><text x="80" y="110" font-size="22">DATA HORIZON // FOUNDATION</text><text x="80" y="144" font-size="13">NON-DESTRUCTIVE SIGNAL TERRAIN</text><text x="1500" y="128" font-size="14">RENDER GRAPH ONLINE</text></g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createBinding(source: AudioSource, target: string, amount: number): ParameterBinding {
  return {
    id: createId('binding'),
    source,
    target,
    amount,
    direction: 1,
    inputMinimum: 0,
    inputMaximum: 1,
    outputMinimum: 0,
    outputMaximum: 1,
    smoothingMs: 70,
    attackMs: 45,
    releaseMs: 220,
    curve: 'smoothstep',
    combine: 'add',
    enabled: true
  };
}

type DriverReactionPreset = 'subtle' | 'punchy' | 'beat';

function configureDriverReaction(binding: ParameterBinding, layer: HorizonLayer, preset: DriverReactionPreset): void {
  const descriptor = parameterTargets(layer).find((item) => item.path === binding.target);
  if (!descriptor) return;
  const base = readParameterValue(currentProject(), binding.target) ?? (descriptor.minimum + descriptor.maximum) / 2;
  const span = Math.max(.001, descriptor.maximum - descriptor.minimum);
  const factor = preset === 'subtle' ? .12 : preset === 'beat' ? .55 : .38;
  let excursion = span * factor;
  if (binding.target.includes('.transform.x') || binding.target.includes('.transform.y')) excursion = preset === 'subtle' ? 18 : preset === 'beat' ? 90 : 54;
  else if (binding.target.includes('.transform.width') || binding.target.includes('.transform.height')) excursion = Math.max(8, Math.abs(base) * (preset === 'subtle' ? .025 : preset === 'beat' ? .12 : .07));
  else if (binding.target.includes('.transform.rotation')) excursion = preset === 'subtle' ? 2 : preset === 'beat' ? 14 : 7;
  else if (binding.target.endsWith('.thickness')) excursion = preset === 'subtle' ? .35 : preset === 'beat' ? 2.5 : 1.4;
  else if (binding.target.endsWith('.strength')) excursion = preset === 'subtle' ? .28 : preset === 'beat' ? 1.15 : .9;
  let low = Math.max(descriptor.minimum, base - excursion * .55);
  let high = Math.min(descriptor.maximum, base + excursion);
  if (high - low < excursion * .72) {
    if (high >= descriptor.maximum - .0001) low = Math.max(descriptor.minimum, high - excursion);
    else if (low <= descriptor.minimum + .0001) high = Math.min(descriptor.maximum, low + excursion);
  }
  binding.amount = 1;
  binding.direction = 1;
  binding.inputMinimum = preset === 'beat' ? .06 : .12;
  binding.inputMaximum = preset === 'beat' ? .72 : .8;
  binding.outputMinimum = low - base;
  binding.outputMaximum = high - base;
  binding.smoothingMs = preset === 'subtle' ? 90 : preset === 'beat' ? 8 : 32;
  binding.attackMs = preset === 'subtle' ? 70 : preset === 'beat' ? 4 : 22;
  binding.releaseMs = preset === 'subtle' ? 280 : preset === 'beat' ? 180 : 150;
  binding.curve = 'smoothstep';
  binding.combine = 'add';
  binding.enabled = true;
  if (preset === 'beat') binding.source = 'beat';
}

function ensureDriverPreview(): void {
  if (referenceAudioName || mockAudio) return;
  mockAudio = true;
  const toggle = document.querySelector<HTMLInputElement>('#mockAudioToggle');
  if (toggle) toggle.checked = true;
  modulationEngine.reset();
}

type BuiltInEffectPresetId = 'comic-ink' | 'neon-edge' | 'dream-glow' | 'crt-signal' | 'heat-distortion' | 'audio-pulse-outline';
type EffectPresetMotion = 'none' | 'gentle' | 'strong';

interface BuiltInEffectPreset {
  label: string;
  description: string;
  audioReactive?: boolean;
  build(): HorizonEffect[];
}

function configuredEffect(type: EffectType, parameters: Record<string, number>, options: { color?: string; outputMode?: 'composite' | 'isolated' } = {}): HorizonEffect {
  const effect = createEffect(type);
  Object.assign(effect.parameters, parameters);
  if (options.color) effect.color = options.color;
  if (options.outputMode) effect.outputMode = options.outputMode;
  return effect;
}

const builtInEffectPresets: Record<BuiltInEffectPresetId, BuiltInEffectPreset> = {
  'comic-ink': {
    label: 'Comic Ink',
    description: 'Cel shading plus a crisp illustrated outline.',
    build: () => [
      configuredEffect('celShading', { levels: 5, intensity: .82 }),
      configuredEffect('outline', { strength: .72, threshold: .32, thickness: 1.25, softness: .12 }, { color: '#21DFF5', outputMode: 'composite' })
    ]
  },
  'neon-edge': {
    label: 'Isolated Neon Edge',
    description: 'Cuts the layer down to bright cyan edges and adds bloom.',
    build: () => [
      configuredEffect('outline', { strength: 1.15, threshold: .24, thickness: 1.8, softness: .16 }, { color: '#20F4FF', outputMode: 'isolated' }),
      configuredEffect('bloom', { threshold: .28, intensity: 1.35, radius: .42 })
    ]
  },
  'dream-glow': {
    label: 'Dream Glow',
    description: 'Saturated color grade with a broad soft bloom.',
    build: () => [
      configuredEffect('colorGrade', { contrast: 1.08, saturation: 1.32, warmth: .12 }),
      configuredEffect('bloom', { threshold: .48, intensity: .92, radius: .68 })
    ]
  },
  'crt-signal': {
    label: 'CRT Signal',
    description: 'Reduced color steps, moving scanlines, and restrained bloom.',
    build: () => [
      configuredEffect('posterize', { levels: 8, intensity: .34 }),
      configuredEffect('scanlines', { density: 480, intensity: .24, speed: .42 }),
      configuredEffect('bloom', { threshold: .62, intensity: .38, radius: .25 })
    ]
  },
  'heat-distortion': {
    label: 'Heat Distortion',
    description: 'Warm grade, animated displacement, and light atmospheric bloom.',
    build: () => [
      configuredEffect('colorGrade', { contrast: 1.04, saturation: 1.18, warmth: .38 }),
      configuredEffect('displacement', { amount: .065, speed: .72 }),
      configuredEffect('bloom', { threshold: .66, intensity: .42, radius: .34 })
    ]
  },
  'audio-pulse-outline': {
    label: 'Audio Pulse Outline',
    description: 'Illustrated outline with Mids-driven strength and Beat-driven thickness.',
    audioReactive: true,
    build: () => [configuredEffect('outline', { strength: .58, threshold: .3, thickness: .85, softness: .14 }, { color: '#20ECFF', outputMode: 'composite' })]
  }
};

function effectPresetMotionTargets(layerId: string, effects: HorizonEffect[], motion: Exclude<EffectPresetMotion, 'none'>): Array<{ target: string; low: number; high: number }> {
  const preferred = [
    { type: 'outline', key: 'strength' },
    { type: 'bloom', key: 'intensity' },
    { type: 'displacement', key: 'amount' },
    { type: 'scanlines', key: 'intensity' },
    { type: 'celShading', key: 'intensity' },
    { type: 'posterize', key: 'intensity' },
    { type: 'colorGrade', key: 'saturation' }
  ] as const;
  const result: Array<{ target: string; low: number; high: number }> = [];
  for (const candidate of preferred) {
    const effect = effects.find((item) => item.type === candidate.type && typeof item.parameters[candidate.key] === 'number');
    if (!effect) continue;
    const base = effect.parameters[candidate.key];
    const range = effectRange(candidate.key, effect.type);
    const amplitude = (range.maximum - range.minimum) * (motion === 'strong' ? .22 : .1);
    result.push({
      target: `layer.${layerId}.effect.${effect.id}.${candidate.key}`,
      low: Math.max(range.minimum, base - amplitude * .55),
      high: Math.min(range.maximum, base + amplitude)
    });
    if (result.length >= 2) break;
  }
  return result;
}

function buildBuiltInEffectPresetProject(id: BuiltInEffectPresetId, motion: EffectPresetMotion, cycleSeconds: number, includeAudio: boolean): { project: HorizonProject; effects: HorizonEffect[]; motionTargets: Array<{ target: string; low: number; high: number }> } | undefined {
  const layer = selectedLayer();
  const preset = builtInEffectPresets[id];
  if (!layer || !preset) return undefined;
  const effects = preset.build();
  let next = updateLayer(currentProject(), layer.id, (draft) => { draft.effects.push(...effects); });
  if (preset.audioReactive && includeAudio) {
    const outline = effects.find((effect) => effect.type === 'outline');
    if (outline) {
      const strength = createBinding('mids', `layer.${layer.id}.effect.${outline.id}.strength`, 1);
      Object.assign(strength, { inputMinimum: .12, inputMaximum: .8, outputMinimum: -.38, outputMaximum: .92, smoothingMs: 32, attackMs: 22, releaseMs: 150 });
      const thickness = createBinding('beat', `layer.${layer.id}.effect.${outline.id}.thickness`, 1);
      Object.assign(thickness, { inputMinimum: .05, inputMaximum: .72, outputMinimum: 0, outputMaximum: 2.1, smoothingMs: 8, attackMs: 4, releaseMs: 180 });
      next = mutateProject(next, (draft) => { draft.bindings.push(strength, thickness); });
    }
  }
  const motionTargets = motion === 'none' ? [] : effectPresetMotionTargets(layer.id, effects, motion);
  const cycle = Math.max(.2, Math.min(next.timeline.duration, Number(cycleSeconds) || 2));
  for (const animated of motionTargets) {
    const halfCycle = cycle / 2;
    let index = 0;
    for (let time = 0; time <= next.timeline.duration + .0001; time += halfCycle) {
      next = upsertKeyframe(next, animated.target, Math.min(next.timeline.duration, time), index % 2 ? animated.high : animated.low);
      index += 1;
    }
    const track = next.timeline.tracks.find((item) => item.target === animated.target);
    if (track && !track.keyframes.some((keyframe) => Math.abs(keyframe.time - next.timeline.duration) < .001)) {
      const phase = next.timeline.duration % cycle / cycle;
      const value = animated.low + (animated.high - animated.low) * (.5 - .5 * Math.cos(phase * Math.PI * 2));
      next = upsertKeyframe(next, animated.target, next.timeline.duration, value);
    }
  }
  return { project: next, effects, motionTargets };
}

function stopEffectPresetPreview(message = false): void {
  if (!effectPresetPreviewProject) return;
  effectPresetPreviewProject = null;
  element<HTMLButtonElement>('#previewEffectPresetButton').textContent = 'Preview';
  renderer.setProject(currentProject()).catch((error) => showToast(error instanceof Error ? error.message : String(error), true));
  timelinePlaying = false;
  if (message) showToast('Effect preset preview stopped. The project was not changed.');
}

function previewBuiltInEffectPreset(id: BuiltInEffectPresetId, motion: EffectPresetMotion, cycleSeconds: number): void {
  if (effectPresetPreviewProject) return stopEffectPresetPreview(true);
  const preview = buildBuiltInEffectPresetProject(id, motion, cycleSeconds, false);
  const preset = builtInEffectPresets[id];
  if (!preview || !preset) return showToast('Select a layer before previewing an effect preset.', true);
  effectPresetPreviewProject = preview.project;
  element<HTMLButtonElement>('#previewEffectPresetButton').textContent = 'Stop Preview';
  timelineTime = 0;
  timelinePlaying = motion !== 'none';
  renderer.setProject(preview.project).catch((error) => showToast(error instanceof Error ? error.message : String(error), true));
  showToast(`Previewing ${preset.label}${preview.motionTargets.length ? ` with a ${Number(cycleSeconds.toFixed(1))} second motion cycle` : ''}. No project changes yet.`);
}

function applyBuiltInEffectPreset(id: BuiltInEffectPresetId, motion: EffectPresetMotion, cycleSeconds: number): void {
  const layer = selectedLayer();
  const preset = builtInEffectPresets[id];
  if (!layer || !preset) return showToast('Select a layer before applying an effect preset.', true);
  if (effectPresetPreviewProject) stopEffectPresetPreview();
  const built = buildBuiltInEffectPresetProject(id, motion, cycleSeconds, true);
  if (!built) return;
  const { project: next, effects, motionTargets } = built;
  if (preset.audioReactive) ensureDriverPreview();
  activeEffectId = effects[0]?.id ?? '';
  const selectedMotionTarget = motionTargets[0]?.target;
  if (selectedMotionTarget) {
    const targetInput = document.querySelector<HTMLSelectElement>('#animationTargetInput');
    if (targetInput) targetInput.dataset.pendingTarget = selectedMotionTarget;
    timelineTime = 0;
    timelinePlaying = true;
  }
  commit(next, layer.id);
  showToast(`${preset.label} applied: ${effects.length} editable effect${effects.length === 1 ? '' : 's'}${motionTargets.length ? ` · ${motionTargets.length} looping animation track${motionTargets.length === 1 ? '' : 's'} at ${Number(cycleSeconds.toFixed(1))}s playing now` : ''}${preset.audioReactive ? ' · two music drivers' : ''}.`);
}

function createStarterProject(): HorizonProject {
  const project = createProject('Data Horizon Foundation');
  const assetId = createId('asset');
  project.assets.push({ id: assetId, name: 'Signal Terrain', kind: 'image', uri: demoImageUri(), mimeType: 'image/svg+xml' });
  const original = createImageLayer(assetId, 'Original Image');
  original.depth = -0.25;
  original.parallax = 0.18;
  const styled = createImageLayer(assetId, 'Cel-Shaded Signal Copy');
  styled.opacity = 0.72;
  styled.blendMode = 'screen';
  styled.depth = 0.2;
  styled.parallax = 0.42;
  const cel = createEffect('celShading');
  const outline = createEffect('outline');
  const grade = createEffect('colorGrade');
  styled.effects.push(cel, outline, grade, createRegionMask('sky'));
  const frame = createShapeLayer('frame', 'Broadcast Window Border');
  frame.strokeWidth = 7;
  frame.effects.push(createEffect('bloom'));
  const title = createTextLayer('DATA HORIZON // SIGNAL ONLINE', 'HUD Title');
  title.transform = { x: 960, y: 108, width: 1180, height: 115, rotation: 0 };
  title.effects.push(createEffect('scanlines'));
  const spectrum = createSpectrumLayer('Horizon Spectrum');
  spectrum.blendMode = 'screen';
  spectrum.effects.push(createEffect('displacement'));
  const waveform = createWaveformLayer('Horizon Waveform');
  waveform.transform = { x: 960, y: 710, width: 1480, height: 190, rotation: 0 };
  waveform.blendMode = 'screen';
  const dataPath = createPathLayer('Scrolling Data Path');
  dataPath.transform = { x: 960, y: 650, width: 1480, height: 500, rotation: 0 };
  const particles = createParticleLayer('Signal Atmosphere');
  particles.opacity = .62;
  project.layers = [title, frame, dataPath, waveform, spectrum, styled, particles, original];
  project.bindings = [
    createBinding('bass', `layer.${styled.id}.effect.${cel.id}.intensity`, 0.2),
    createBinding('mids', `layer.${styled.id}.effect.${outline.id}.strength`, 0.25),
    createBinding('highs', `layer.${styled.id}.effect.${grade.id}.warmth`, 0.18),
    createBinding('beat', `layer.${frame.id}.source.strokeWidth`, 5),
    createBinding('highs', `layer.${dataPath.id}.source.flowSpeed`, 180),
    createBinding('rms', `layer.${spectrum.id}.source.glow`, 0.45)
  ];
  let animated = applyAnimationPreset(project, title.id, 'slide-in');
  animated = applyAnimationPreset(animated, waveform.id, 'pulse');
  return animated;
}

function restoreProject(): HorizonProject {
  if (window.__DATA_HORIZON_PROJECT__ && validateProject(window.__DATA_HORIZON_PROJECT__).ok) {
    return normalizeProject(window.__DATA_HORIZON_PROJECT__);
  }
  if (new URLSearchParams(window.location.search).has('smoke')) return createStarterProject();
  try {
    const stored = JSON.parse(localStorage.getItem(autosaveKey) || 'null') as unknown;
    if (validateProject(stored).ok) return normalizeProject(stored as HorizonProject);
  } catch {
    // A malformed optional autosave never blocks startup.
  }
  return createProject('Untitled Horizon');
}

const history = new HistoryStore<HorizonProject>(restoreProject());
selectedLayerId = flattenLayers(history.value.layers)[0]?.id ?? '';
selectedLayerIds = new Set(selectedLayerId ? [selectedLayerId] : []);

function currentProject(): HorizonProject {
  return history.value;
}

function selectedLayer(): HorizonLayer | undefined {
  return selectedLayerId ? findLayer(currentProject(), selectedLayerId) : undefined;
}

function selectedLayers(): HorizonLayer[] {
  const available = flattenLayers(currentProject().layers);
  const availableIds = new Set(available.map((layer) => layer.id));
  selectedLayerIds = new Set(Array.from(selectedLayerIds).filter((id) => availableIds.has(id)));
  if (selectedLayerId && availableIds.has(selectedLayerId)) selectedLayerIds.add(selectedLayerId);
  return available.filter((layer) => selectedLayerIds.has(layer.id));
}

function selectLayer(layerId: string, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
  const layers = flattenLayers(currentProject().layers);
  if (!layerId || !layers.some((layer) => layer.id === layerId)) {
    selectedLayerId = '';
    selectedLayerIds.clear();
    return;
  }
  if (mode === 'range' && selectedLayerId) {
    const start = layers.findIndex((layer) => layer.id === selectedLayerId);
    const end = layers.findIndex((layer) => layer.id === layerId);
    if (start >= 0 && end >= 0) {
      selectedLayerIds = new Set(layers.slice(Math.min(start, end), Math.max(start, end) + 1).map((layer) => layer.id));
      selectedLayerId = layerId;
      return;
    }
  }
  if (mode === 'toggle') {
    if (selectedLayerIds.has(layerId)) {
      selectedLayerIds.delete(layerId);
      if (selectedLayerId === layerId) selectedLayerId = Array.from(selectedLayerIds).at(-1) ?? '';
    } else {
      selectedLayerIds.add(layerId);
      selectedLayerId = layerId;
    }
    return;
  }
  selectedLayerId = layerId;
  selectedLayerIds = new Set([layerId]);
}

function activePaintMask(): HorizonEffect | undefined {
  const layer = selectedLayer();
  if (!layer) return undefined;
  return layer.effects.find((effect) => (effect.type === 'paintMask' || effect.type === 'paintLayer') && (!activePaintMaskId || effect.id === activePaintMaskId));
}

function syncBrushModeOptions(): void {
  if (!editorMode) return;
  const select = document.querySelector<HTMLSelectElement>('#maskBrushModeInput');
  if (!select) return;
  const retouch = activePaintMask()?.type === 'paintLayer';
  const options = retouch
    ? [{ value: 'paint', label: 'Paint with foreground color' }, { value: 'erase', label: 'Erase layer result' }]
    : [{ value: 'hide', label: 'Hide' }, { value: 'reveal', label: 'Reveal' }];
  select.replaceChildren(...options.map((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    return option;
  }));
  if (!options.some((item) => item.value === maskBrushMode)) maskBrushMode = retouch ? 'paint' : 'hide';
  select.value = maskBrushMode;
}

function brushModePair(): { primary: BrushMode; secondary: BrushMode; primaryLabel: string; secondaryLabel: string } {
  return activePaintMask()?.type === 'paintLayer'
    ? { primary: 'paint', secondary: 'erase', primaryLabel: '● Paint', secondaryLabel: '◌ Erase' }
    : { primary: 'hide', secondary: 'reveal', primaryLabel: '● Hide', secondaryLabel: '◌ Reveal' };
}

function syncBrushControls(): void {
  if (!editorMode) return;
  const bar = document.querySelector<HTMLElement>('#brushContextBar');
  if (!bar) return;
  const effect = activePaintMask();
  const retouch = effect?.type === 'paintLayer';
  const pair = brushModePair();
  bar.hidden = activeTool !== 'mask' || !effect;
  bar.dataset.brushTarget = retouch ? 'retouch' : 'mask';
  const primary = element<HTMLButtonElement>('#brushPrimaryModeButton');
  const secondary = element<HTMLButtonElement>('#brushSecondaryModeButton');
  primary.textContent = pair.primaryLabel;
  secondary.textContent = pair.secondaryLabel;
  primary.classList.toggle('active', maskBrushMode === pair.primary);
  secondary.classList.toggle('active', maskBrushMode === pair.secondary);
  primary.title = `${retouch ? 'Paint with foreground color' : 'Hide the selected layer'} (B)`;
  secondary.title = `${retouch ? 'Erase the generated layer result' : 'Reveal the selected layer'} (E)`;
  const transparent = element<HTMLButtonElement>('#transparentColorButton');
  transparent.hidden = !retouch;
  transparent.classList.toggle('active', maskBrushMode === 'erase');
  transparent.setAttribute('aria-pressed', String(maskBrushMode === 'erase'));
  element<HTMLElement>('#contextBrushColorControl').hidden = !retouch;
  element<HTMLInputElement>('#contextBrushColorInput').value = paintBrushColor;
  const controls: Array<[string, number]> = [
    ['#maskBrushSizeInput', maskBrushSize], ['#contextBrushSizeInput', maskBrushSize],
    ['#maskBrushSoftnessInput', maskBrushSoftness], ['#contextBrushSoftnessInput', maskBrushSoftness],
    ['#maskBrushOpacityInput', maskBrushOpacity], ['#contextBrushOpacityInput', maskBrushOpacity]
  ];
  for (const [selector, value] of controls) element<HTMLInputElement>(selector).value = String(value);
  element<HTMLOutputElement>('#maskBrushSizeValue').textContent = String(Math.round(maskBrushSize));
  element<HTMLOutputElement>('#contextBrushSizeValue').textContent = `${Math.round(maskBrushSize)} px`;
  element<HTMLOutputElement>('#maskBrushSoftnessValue').textContent = `${Math.round(maskBrushSoftness * 100)}%`;
  element<HTMLOutputElement>('#contextBrushSoftnessValue').textContent = `${Math.round(maskBrushSoftness * 100)}%`;
  element<HTMLOutputElement>('#maskBrushOpacityValue').textContent = `${Math.round(maskBrushOpacity * 100)}%`;
  element<HTMLOutputElement>('#contextBrushOpacityValue').textContent = `${Math.round(maskBrushOpacity * 100)}%`;
  document.querySelectorAll<HTMLButtonElement>('[data-brush-preset]').forEach((button) => button.classList.toggle('active', button.dataset.brushPreset === activeBrushPreset));
  const strokeCount = effect?.type === 'paintLayer' ? effect.paintLayer?.strokes.length ?? 0 : effect?.paintMask?.strokes.length ?? 0;
  element<HTMLButtonElement>('#brushUndoStrokeButton').disabled = strokeCount === 0;
  element<HTMLButtonElement>('#brushClearStrokesButton').disabled = strokeCount === 0;
}

function setBrushMode(mode: BrushMode): void {
  const pair = brushModePair();
  maskBrushMode = mode === pair.secondary ? pair.secondary : pair.primary;
  const select = element<HTMLSelectElement>('#maskBrushModeInput');
  select.value = maskBrushMode;
  syncBrushControls();
}

function applyBrushPreset(id: BrushPresetId): void {
  const preset = brushPresets[id];
  activeBrushPreset = id;
  maskBrushSize = preset.size;
  maskBrushSoftness = preset.softness;
  maskBrushOpacity = preset.opacity;
  syncBrushControls();
  showToast(`${id[0].toUpperCase()}${id.slice(1)} brush selected.`);
}

function changeBrushSize(amount: number): void {
  activeBrushPreset = 'custom';
  maskBrushSize = Math.max(8, Math.min(600, Math.round(maskBrushSize + amount)));
  syncBrushControls();
}

function changeActiveBrushStrokes(clear: boolean): void {
  const layer = selectedLayer();
  const effect = activePaintMask();
  if (!layer || !effect) return;
  commit(updateLayer(currentProject(), layer.id, (draft) => {
    const target = draft.effects.find((item) => item.id === effect.id);
    const strokes = target?.type === 'paintLayer' ? target.paintLayer?.strokes : target?.paintMask?.strokes;
    if (!strokes) return;
    if (clear) strokes.length = 0;
    else strokes.pop();
  }));
  showToast(clear ? 'Brush edits cleared. Project Undo can restore them.' : 'Last brush stroke removed.');
}

function setActiveTool(tool: EditorTool, effectId = activePaintMaskId): void {
  activeTool = tool;
  if (tool === 'mask') activePaintMaskId = effectId;
  if (tool === 'mask') syncBrushModeOptions();
  if (tool === 'mask' && activePaintMask()?.type === 'paintLayer') {
    const foreground = document.querySelector<HTMLInputElement>('#foregroundColorInput');
    if (foreground) foreground.value = paintBrushColor;
  }
  const moveButton = document.querySelector<HTMLButtonElement>('#moveToolButton');
  const maskButton = document.querySelector<HTMLButtonElement>('#maskBrushToolButton');
  const pathButton = document.querySelector<HTMLButtonElement>('#addPathButton');
  moveButton?.classList.toggle('active', tool === 'move');
  maskButton?.classList.toggle('active', tool === 'mask');
  pathButton?.classList.toggle('active', tool === 'path');
  const title = document.querySelector<HTMLElement>('#toolOptionsTitle');
  if (title) title.textContent = tool === 'mask' ? (activePaintMask()?.type === 'paintLayer' ? 'Paint / Erase Brush' : 'Mask Brush') : tool === 'path' ? 'Path Tool' : 'Move Tool';
  const moveOptions = document.querySelector<HTMLElement>('#moveToolOptions');
  const maskOptions = document.querySelector<HTMLElement>('#maskToolOptions');
  const pathOptions = document.querySelector<HTMLElement>('#pathToolOptions');
  if (moveOptions) moveOptions.hidden = tool !== 'move';
  if (maskOptions) maskOptions.hidden = tool !== 'mask';
  if (pathOptions) pathOptions.hidden = tool !== 'path';
  syncBrushControls();
  document.querySelector<HTMLElement>('.canvas-wrap')?.classList.toggle('mask-painting', tool === 'mask');
  document.querySelector<HTMLElement>('.canvas-wrap')?.classList.toggle('path-editing', tool === 'path');
  if (tool !== 'mask') {
    const cursor = document.querySelector<HTMLElement>('#maskBrushCursor');
    if (cursor) cursor.hidden = true;
  }
  positionCanvasSelection();
  positionPathOverlay();
  positionMotionPathOverlay();
}

function authoredTransform(layer: HorizonLayer): LayerTransform {
  const canvasSize = currentProject().canvas;
  return layer.transform ?? {
    x: canvasSize.width / 2,
    y: canvasSize.height / 2,
    width: canvasSize.width,
    height: canvasSize.height,
    rotation: 0
  };
}

interface TransformBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function evaluatedLayerTransform(layer: HorizonLayer, animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime)): LayerTransform {
  const authored = authoredTransform(layer);
  const prefix = `layer.${layer.id}.transform`;
  return {
    x: animation.get(`${prefix}.x`) ?? authored.x,
    y: animation.get(`${prefix}.y`) ?? authored.y,
    width: animation.get(`${prefix}.width`) ?? authored.width,
    height: animation.get(`${prefix}.height`) ?? authored.height,
    rotation: animation.get(`${prefix}.rotation`) ?? authored.rotation
  };
}

function transformBounds(transform: LayerTransform): TransformBounds {
  const angle = transform.rotation * Math.PI / 180;
  const halfWidth = Math.abs(Math.cos(angle)) * transform.width / 2 + Math.abs(Math.sin(angle)) * transform.height / 2;
  const halfHeight = Math.abs(Math.sin(angle)) * transform.width / 2 + Math.abs(Math.cos(angle)) * transform.height / 2;
  const left = transform.x - halfWidth;
  const right = transform.x + halfWidth;
  const top = transform.y - halfHeight;
  const bottom = transform.y + halfHeight;
  return { left, right, top, bottom, x: transform.x, y: transform.y, width: right - left, height: bottom - top };
}

function combinedTransformBounds(transforms: readonly LayerTransform[]): TransformBounds | undefined {
  if (!transforms.length) return undefined;
  const bounds = transforms.map(transformBounds);
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  return { left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
}

function independentSelectedLayers(): HorizonLayer[] {
  const chosen = new Set(selectedLayers().map((layer) => layer.id));
  const result: HorizonLayer[] = [];
  const visit = (layers: readonly HorizonLayer[], selectedAncestor: boolean): void => {
    for (const layer of layers) {
      const selected = chosen.has(layer.id);
      if (selected && !selectedAncestor) result.push(layer);
      if (layer.type === 'group') visit(layer.children, selectedAncestor || selected);
    }
  };
  visit(currentProject().layers, false);
  return result;
}

function syncLayerClipboardControls(): void {
  if (!editorMode || !document.querySelector('#layerClipboardStatus')) return;
  const roots = independentSelectedLayers();
  element<HTMLButtonElement>('#copyLayersButton').disabled = roots.length === 0;
  element<HTMLButtonElement>('#cutLayersButton').disabled = !roots.some((layer) => !layer.locked);
  const available = Boolean(layerClipboard?.items.length);
  element<HTMLButtonElement>('#pasteLayersButton').disabled = !available;
  element<HTMLButtonElement>('#pasteLayersInPlaceButton').disabled = !available;
  const status = element<HTMLElement>('#layerClipboardStatus');
  status.textContent = layerClipboard ? `${layerClipboard.items.length} ITEM${layerClipboard.items.length === 1 ? '' : 'S'} · ${layerClipboard.sourceProject}` : 'EMPTY';
  status.title = layerClipboard ? `${layerClipboard.items.length} copied root layer${layerClipboard.items.length === 1 ? '' : 's'} from ${layerClipboard.sourceProject}` : 'The layer clipboard is empty.';
}

function copyLayerSelection(cut = false): void {
  const roots = independentSelectedLayers().filter((layer) => !cut || !layer.locked);
  if (!roots.length) return showToast(cut ? 'Unlock at least one selected layer before cutting.' : 'Select a layer before copying.', true);
  const project = currentProject();
  const items = roots.map((layer) => createLayerPreset(project, layer.id, layer.name, `Copied from ${project.name}.`)).filter((preset): preset is HorizonLayerPreset => Boolean(preset));
  if (!items.length) return showToast('The selected layers could not be copied.', true);
  layerClipboard = {
    format: 'data-horizon.layer-clipboard', version: 1, createdWith: project.engineVersion,
    sourceProject: project.name, sourceCanvas: { width: project.canvas.width, height: project.canvas.height }, items
  };
  layerPasteSerial = 0;
  try { localStorage.setItem(layerClipboardStorageKey, JSON.stringify(layerClipboard)); }
  catch { showToast('Layers copied for this session, but persistent clipboard storage is unavailable.', true); }
  if (cut) {
    let next = project;
    for (const layer of roots) next = removeLayer(next, layer.id);
    const remaining = flattenLayers(next.layers);
    const primary = remaining[0]?.id ?? '';
    commit(next, primary, primary ? [primary] : []);
    showToast(`Cut ${items.length} layer root${items.length === 1 ? '' : 's'} with dependencies.`);
  } else {
    syncLayerClipboardControls();
    showToast(`Copied ${items.length} layer root${items.length === 1 ? '' : 's'} with assets, audio, effects, and keys.`);
  }
}

function pasteLayerClipboard(inPlace = false): void {
  if (!layerClipboard?.items.length) return showToast('Copy or cut layers before pasting.', true);
  if (layerClipboard.items.some((preset) => !validateLayerPreset(preset).ok)) {
    layerClipboard = undefined;
    try { localStorage.removeItem(layerClipboardStorageKey); } catch { /* Optional persistent clipboard. */ }
    syncLayerClipboardControls();
    return showToast('The saved layer clipboard is no longer valid.', true);
  }
  const offset = inPlace ? 0 : 24 * (++layerPasteSerial);
  let next = currentProject();
  const insertedIds: string[] = [];
  for (const preset of [...layerClipboard.items].reverse()) {
    const inserted = insertLayerPreset(next, preset);
    next = inserted.project;
    if (!inserted.selectedId) continue;
    insertedIds.push(inserted.selectedId);
    if (offset) next = updateLayer(next, inserted.selectedId, (layer) => {
      const transform = { ...authoredTransform(layer) };
      transform.x += offset;
      transform.y += offset;
      layer.transform = transform;
    });
  }
  if (!insertedIds.length) return showToast('No clipboard layers could be inserted.', true);
  commit(next, insertedIds.at(-1), insertedIds);
  showToast(`Pasted ${insertedIds.length} layer root${insertedIds.length === 1 ? '' : 's'}${inPlace ? ' in place' : ` with a ${offset} px offset`}.`);
}

function ensureSelection(): void {
  if (!selectedLayer()) selectLayer(flattenLayers(currentProject().layers)[0]?.id ?? '');
}

function persistAutosave(): void {
  try {
    localStorage.setItem(autosaveKey, JSON.stringify(currentProject()));
  } catch (error) {
    showToast(`Autosave unavailable: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function setRuntimeProject(): void {
  effectPresetPreviewProject = null;
  const previewButton = document.querySelector<HTMLButtonElement>('#previewEffectPresetButton');
  if (previewButton) previewButton.textContent = 'Preview';
  if (!editorMode) document.body.classList.toggle('transparent-output', currentProject().canvas.background[3] <= 0.001);
  renderer.setProject(currentProject()).catch((error) => showToast(error instanceof Error ? error.message : String(error), true));
}

function acceptAudioFrame(frame: Partial<AudioFeatureFrame>): void {
  frameSequence = Math.max(frameSequence + 1, Number(frame.sequence) || 0);
  externalAudio = {
    sequence: frameSequence,
    timestampSeconds: Number(frame.timestampSeconds) || performance.now() / 1000,
    bass: Math.max(0, Math.min(1, Number(frame.bass) || 0)),
    mids: Math.max(0, Math.min(1, Number(frame.mids) || 0)),
    highs: Math.max(0, Math.min(1, Number(frame.highs) || 0)),
    beat: Math.max(0, Math.min(1, Number(frame.beat) || 0)),
    rms: Math.max(0, Math.min(1, Number(frame.rms) || 0))
  };
}

window.dataHorizonRuntime = { setAudioFrame: acceptAudioFrame };
window.addEventListener('message', (event) => {
  if (event.data?.type === 'tempest.audio-features.v1' && event.data.frame) acceptAudioFrame(event.data.frame as Partial<AudioFeatureFrame>);
});

function startTempestTelemetryBridge(): void {
  const telemetryUrl = window.__DATA_HORIZON_TELEMETRY_URL__;
  if (editorMode || !telemetryUrl) return;
  const clamp = (value: unknown): number => Math.max(0, Math.min(1, Number(value) || 0));
  const poll = async (): Promise<void> => {
    try {
      const separator = telemetryUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${telemetryUrl}${separator}t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Telemetry HTTP ${response.status}`);
      const telemetry = await response.json() as Record<string, unknown>;
      const master = clamp(telemetry.master ?? telemetry.level);
      const desktop = clamp(telemetry.desktop ?? master);
      const microphone = clamp(telemetry.microphone);
      const beat = Math.max(clamp(telemetry.beat), clamp(telemetry.pulse));
      acceptAudioFrame({
        timestampSeconds: Math.max(0, Number(telemetry.timestamp) || Date.now()) / 1000,
        bass: desktop,
        mids: Math.max(desktop * .72, microphone * .62),
        highs: Math.max(microphone, beat * .35),
        beat,
        rms: master
      });
    } catch {
      const previous = externalAudio;
      acceptAudioFrame({
        bass: (previous?.bass ?? 0) * .8,
        mids: (previous?.mids ?? 0) * .8,
        highs: (previous?.highs ?? 0) * .8,
        beat: (previous?.beat ?? 0) * .7,
        rms: (previous?.rms ?? 0) * .8
      });
    } finally {
      window.setTimeout(() => void poll(), 60);
    }
  };
  void poll();
}

startTempestTelemetryBridge();

function formatAudioTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function renderReferenceAudioTransport(): void {
  if (!editorMode || !document.querySelector('#referenceAudioName')) return;
  const loaded = Boolean(referenceAudioName);
  document.querySelector<HTMLElement>('.reference-audio')?.classList.toggle('unloaded', !loaded);
  const playing = loaded && !referenceAudio.paused && !referenceAudio.ended;
  const duration = Number.isFinite(referenceAudio.duration) ? referenceAudio.duration : 0;
  element<HTMLElement>('#referenceAudioName').textContent = referenceAudioName || 'No reference song loaded';
  element<HTMLElement>('#referenceAudioStatus').textContent = loaded
    ? playing ? 'Analyzing real-time frequency bands…' : referenceAudio.ended ? 'Playback finished.' : 'Ready for audio-reactive preview.'
    : 'Load a song to drive assignments while you work.';
  const play = element<HTMLButtonElement>('#referenceAudioPlayButton');
  play.disabled = !loaded;
  play.textContent = playing ? '❚❚' : '▶';
  play.title = playing ? 'Pause reference song' : 'Play reference song';
  element<HTMLButtonElement>('#referenceAudioStopButton').disabled = !loaded;
  const progress = element<HTMLInputElement>('#referenceAudioProgress');
  progress.disabled = !loaded || duration <= 0;
  progress.max = String(Math.max(.01, duration));
  if (document.activeElement !== progress) progress.value = String(Math.min(duration, referenceAudio.currentTime || 0));
  element<HTMLOutputElement>('#referenceAudioTime').textContent = `${formatAudioTime(referenceAudio.currentTime)} / ${formatAudioTime(duration)}`;
}

async function ensureReferenceAudioGraph(): Promise<void> {
  if (!referenceAudioContext) {
    referenceAudioContext = new AudioContext();
    const source = referenceAudioContext.createMediaElementSource(referenceAudio);
    referenceAudioAnalyser = referenceAudioContext.createAnalyser();
    referenceAudioAnalyser.fftSize = 2048;
    referenceAudioAnalyser.smoothingTimeConstant = .68;
    referenceAudioAnalyser.minDecibels = -92;
    referenceAudioAnalyser.maxDecibels = -18;
    referenceFrequencyData = new Uint8Array(referenceAudioAnalyser.frequencyBinCount);
    referenceWaveformData = new Float32Array(referenceAudioAnalyser.fftSize);
    source.connect(referenceAudioAnalyser);
    referenceAudioAnalyser.connect(referenceAudioContext.destination);
  }
  if (referenceAudioContext.state === 'suspended') await referenceAudioContext.resume();
}

async function setReferenceAudioFile(file: ImportedAudio): Promise<void> {
  await ensureReferenceAudioGraph();
  referenceAudio.pause();
  if (referenceAudioUrl) URL.revokeObjectURL(referenceAudioUrl);
  referenceAudioUrl = URL.createObjectURL(new Blob([file.bytes], { type: file.mimeType }));
  referenceAudio.src = referenceAudioUrl;
  referenceAudio.currentTime = 0;
  referenceBassBaseline = .08;
  referenceBeat = 0;
  referenceLastBeat = -1;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => failed(), 10000);
    const ready = (): void => { cleanup(); resolve(); };
    const failed = (): void => { cleanup(); reject(new Error('Chromium could not decode this audio file. Try MP3, WAV, OGG, or M4A.')); };
    const cleanup = (): void => {
      window.clearTimeout(timeout);
      referenceAudio.removeEventListener('loadedmetadata', ready);
      referenceAudio.removeEventListener('error', failed);
    };
    referenceAudio.addEventListener('loadedmetadata', ready);
    referenceAudio.addEventListener('error', failed);
    referenceAudio.load();
  });
  referenceAudioName = file.name;
  mockAudio = false;
  element<HTMLInputElement>('#mockAudioToggle').checked = false;
  renderReferenceAudioTransport();
  try {
    await referenceAudio.play();
    showToast(`Playing reference song: ${file.name}`);
  } catch {
    showToast(`${file.name} loaded. Press Play to begin analysis.`);
  }
}

async function loadReferenceAudio(): Promise<void> {
  try {
    await ensureReferenceAudioGraph();
    const file = await window.horizonDesktop.openAudio();
    if (file) await setReferenceAudioFile(file);
  } catch (error) {
    showToast(`Audio load failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function analyzeReferenceAudio(sequence: number): AudioFeatureFrame | null {
  if (!referenceAudioName) return null;
  if (!referenceAudioAnalyser || referenceAudio.paused || referenceAudio.ended) {
    referenceBeat *= .78;
    return { sequence, timestampSeconds: referenceAudio.currentTime || 0, bass: 0, mids: 0, highs: 0, beat: referenceBeat, rms: 0 };
  }
  referenceAudioAnalyser.getByteFrequencyData(referenceFrequencyData);
  referenceAudioAnalyser.getFloatTimeDomainData(referenceWaveformData);
  const features = analyzeSpectrumFrame(referenceFrequencyData, referenceWaveformData, referenceAudioContext?.sampleRate ?? 48000, referenceAudioAnalyser.fftSize);
  referenceBassBaseline = referenceBassBaseline * .965 + features.bass * .035;
  const onset = Math.max(0, features.bass - referenceBassBaseline);
  const now = referenceAudio.currentTime;
  if (onset > .075 && now - referenceLastBeat > .14) {
    referenceBeat = Math.max(referenceBeat, Math.min(1, onset * 7.5));
    referenceLastBeat = now;
  } else referenceBeat *= .84;
  return { sequence, timestampSeconds: now, ...features, beat: referenceBeat };
}

function commit(next: HorizonProject, selection = selectedLayerId, multipleSelection?: readonly string[]): void {
  const primaryChanged = selection !== selectedLayerId;
  history.commit(next);
  selectedLayerId = selection;
  if (multipleSelection) selectedLayerIds = new Set(multipleSelection);
  else if (primaryChanged) selectedLayerIds = new Set(selection ? [selection] : []);
  else selectedLayers();
  dirty = true;
  persistAutosave();
  setRuntimeProject();
  renderEditor();
}

interface ParameterEdit {
  target: string;
  value: number;
}

function recordAutoKeyEdits(edits: ParameterEdit[]): boolean {
  if (!autoKeyEnabled || !edits.length) return false;
  let next = currentProject();
  for (const edit of edits) {
    const existingTrack = next.timeline.tracks.find((track) => track.target === edit.target);
    const base = readParameterValue(next, edit.target);
    if (!existingTrack && timelineTime > .001 && base !== undefined) next = upsertKeyframe(next, edit.target, 0, base);
    next = upsertKeyframe(next, edit.target, timelineTime, edit.value);
  }
  const targetInput = document.querySelector<HTMLSelectElement>('#animationTargetInput');
  if (targetInput) targetInput.dataset.pendingTarget = edits[0].target;
  commit(next);
  showToast(`Auto Key recorded ${edits.length === 1 ? 'a keyframe' : `${edits.length} keyframes`} at ${formatTimelineTime(timelineTime)}.`);
  return true;
}

function evaluatedParameterValue(target: string): number | undefined {
  return evaluateVisibleTimeline(currentProject().timeline, timelineTime).get(target) ?? readParameterValue(currentProject(), target);
}

function evaluateVisibleTimeline(timeline: HorizonProject['timeline'], time: number): Map<string, number> {
  if (!editorMode || !soloAnimationTrackId) return evaluateTimeline(timeline, time);
  const solo = timeline.tracks.find((track) => track.id === soloAnimationTrackId);
  return evaluateTimeline({ ...timeline, tracks: solo ? [solo] : timeline.tracks }, time);
}

function replaceProject(next: HorizonProject, filePath = ''): void {
  const normalized = normalizeProject(next);
  history.replace(normalized);
  selectedLayerId = flattenLayers(normalized.layers)[0]?.id ?? '';
  selectedLayerIds = new Set(selectedLayerId ? [selectedLayerId] : []);
  timelineTime = 0;
  timelinePlaying = false;
  selectedKeyframeIds.clear();
  selectedAnimationTrackId = '';
  soloAnimationTrackId = '';
  selectedLayerSelectionSetId = '';
  soloLayerVisibilitySnapshot = null;
  layerSearchQuery = '';
  layerTreeFilter = 'all';
  const search = document.querySelector<HTMLInputElement>('#layerSearchInput');
  if (search) search.value = '';
  const filter = document.querySelector<HTMLSelectElement>('#layerFilterInput');
  if (filter) filter.value = 'all';
  timelineLoopStart = 0;
  timelineLoopEnd = normalized.timeline.duration;
  dirty = false;
  savedPath = filePath;
  modulationEngine.reset();
  persistAutosave();
  setRuntimeProject();
  renderEditor();
}

function showToast(message: string, error = false): void {
  const toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function element<T extends Element>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Required editor element is missing: ${selector}`);
  return result;
}

function collapsedLayerGroupIds(): Set<string> {
  const groups = new Set(flattenLayers(currentProject().layers).filter((layer) => layer.type === 'group').map((layer) => layer.id));
  return new Set((collapsedLayerGroupsByProject[currentProject().id] ?? []).filter((id) => groups.has(id)));
}

function storeCollapsedLayerGroups(ids: ReadonlySet<string>): void {
  collapsedLayerGroupsByProject = { ...collapsedLayerGroupsByProject, [currentProject().id]: Array.from(ids) };
  try { localStorage.setItem(layerGroupCollapseStorageKey, JSON.stringify(collapsedLayerGroupsByProject)); }
  catch { /* Group disclosure persistence is optional. */ }
}

function layerMatchesNavigator(layer: HorizonLayer): boolean {
  const query = layerSearchQuery.trim().toLocaleLowerCase();
  const searchable = `${layer.name} ${layer.type} ${layer.effects.map((effect) => `${effect.name} ${effect.type}`).join(' ')}`.toLocaleLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (layerTreeFilter === 'visible' && !layer.visible) return false;
  if (layerTreeFilter === 'hidden' && layer.visible) return false;
  if (layerTreeFilter === 'locked' && !layer.locked) return false;
  if (layerTreeFilter === 'effects' && !layer.effects.length) return false;
  if (layerTreeFilter === 'audio' && !currentProject().bindings.some((binding) => binding.target.startsWith(`layer.${layer.id}.`))) return false;
  if (layerTreeFilter === 'animated' && !currentProject().timeline.tracks.some((track) => track.target.startsWith(`layer.${layer.id}.`))) return false;
  if (layerTreeFilter === 'groups' && layer.type !== 'group') return false;
  return true;
}

function ancestorGroupIds(layerIds: ReadonlySet<string>): Set<string> {
  const ancestors = new Set<string>();
  const visit = (layers: readonly HorizonLayer[], path: readonly string[]): void => {
    for (const layer of layers) {
      if (layerIds.has(layer.id)) path.forEach((id) => ancestors.add(id));
      if (layer.type === 'group') visit(layer.children, [...path, layer.id]);
    }
  };
  visit(currentProject().layers, []);
  return ancestors;
}

function revealLayerIdsInTree(layerIds: ReadonlySet<string>, scrollId = ''): void {
  const collapsed = collapsedLayerGroupIds();
  ancestorGroupIds(layerIds).forEach((id) => collapsed.delete(id));
  storeCollapsedLayerGroups(collapsed);
  layerSearchQuery = '';
  layerTreeFilter = 'all';
  element<HTMLInputElement>('#layerSearchInput').value = '';
  element<HTMLSelectElement>('#layerFilterInput').value = 'all';
  renderEditor();
  if (scrollId) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.layer-row[data-layer-id="${scrollId}"]`)?.scrollIntoView({ block: 'center' }));
}

function revealSelectedLayerInTree(): void {
  if (!selectedLayerId) return showToast('Select a layer to reveal first.', true);
  revealLayerIdsInTree(new Set([selectedLayerId]), selectedLayerId);
}

function renderLayerSelectionSetControls(): void {
  const project = currentProject();
  const select = element<HTMLSelectElement>('#layerSelectionSetInput');
  if (selectedLayerSelectionSetId && !project.layerSelectionSets.some((set) => set.id === selectedLayerSelectionSetId)) selectedLayerSelectionSetId = '';
  select.replaceChildren(new Option(project.layerSelectionSets.length ? 'Choose saved selection…' : 'No saved selection', ''));
  for (const set of project.layerSelectionSets) select.append(new Option(`${set.name} · ${set.layerIds.length}`, set.id));
  select.value = selectedLayerSelectionSetId;
  const hasSet = Boolean(selectedLayerSelectionSetId);
  element<HTMLButtonElement>('#saveLayerSelectionSetButton').disabled = selectedLayers().length === 0 || project.layerSelectionSets.length >= 32;
  element<HTMLButtonElement>('#recallLayerSelectionSetButton').disabled = !hasSet;
  element<HTMLButtonElement>('#deleteLayerSelectionSetButton').disabled = !hasSet;
  const solo = element<HTMLButtonElement>('#soloLayersButton');
  solo.disabled = !soloLayerVisibilitySnapshot && selectedLayers().length === 0;
  solo.classList.toggle('active', Boolean(soloLayerVisibilitySnapshot));
  solo.textContent = soloLayerVisibilitySnapshot ? 'Restore' : 'Solo';
  solo.title = soloLayerVisibilitySnapshot ? 'Restore visibility from before Solo' : 'Show only selected layers and their group path';
}

function saveCurrentLayerSelectionSet(): void {
  const ids = selectedLayers().map((layer) => layer.id);
  if (!ids.length) return showToast('Select layers before saving a named selection.', true);
  const requested = window.prompt('Name this layer selection:', `Selection ${currentProject().layerSelectionSets.length + 1}`)?.trim();
  if (!requested) return;
  const result = upsertLayerSelectionSet(currentProject(), requested, ids);
  if (!result.setId) return showToast('The layer selection could not be saved.', true);
  selectedLayerSelectionSetId = result.setId;
  commit(result.project, selectedLayerId, Array.from(selectedLayerIds));
  showToast(`Saved ${ids.length} layer${ids.length === 1 ? '' : 's'} as “${requested.slice(0, 80)}”.`);
}

function recallLayerSelectionSet(): void {
  const set = currentProject().layerSelectionSets.find((item) => item.id === selectedLayerSelectionSetId);
  if (!set) return showToast('Choose a saved layer selection first.', true);
  const available = new Set(flattenLayers(currentProject().layers).map((layer) => layer.id));
  const ids = set.layerIds.filter((id) => available.has(id));
  if (!ids.length) return showToast('That saved selection no longer contains available layers.', true);
  selectedLayerIds = new Set(ids);
  selectedLayerId = ids.at(-1) ?? '';
  revealLayerIdsInTree(selectedLayerIds, selectedLayerId);
  showToast(`Recalled “${set.name}” · ${ids.length} layer${ids.length === 1 ? '' : 's'}.`);
}

function toggleSoloLayers(): void {
  const selectedIds = Array.from(selectedLayerIds).filter((id) => Boolean(findLayer(currentProject(), id)));
  if (soloLayerVisibilitySnapshot) {
    const snapshot = soloLayerVisibilitySnapshot;
    soloLayerVisibilitySnapshot = null;
    const next = mutateProject(currentProject(), (draft) => {
      for (const layer of flattenLayers(draft.layers)) if (snapshot.has(layer.id)) layer.visible = snapshot.get(layer.id) ?? layer.visible;
    });
    commit(next, selectedLayerId, selectedIds);
    return showToast('Layer visibility restored.');
  }
  if (!selectedIds.length) return showToast('Select one or more layers to solo.', true);
  const showIds = ancestorGroupIds(new Set(selectedIds));
  for (const id of selectedIds) {
    const layer = findLayer(currentProject(), id);
    if (layer) flattenLayers([layer]).forEach((item) => showIds.add(item.id));
  }
  soloLayerVisibilitySnapshot = new Map(flattenLayers(currentProject().layers).map((layer) => [layer.id, layer.visible]));
  const next = mutateProject(currentProject(), (draft) => {
    for (const layer of flattenLayers(draft.layers)) layer.visible = showIds.has(layer.id);
  });
  commit(next, selectedLayerId, selectedIds);
  showToast(`Soloing ${selectedIds.length} selected layer${selectedIds.length === 1 ? '' : 's'} · Restore returns the previous visibility state.`);
}

function canDropLayers(layerIds: readonly string[], target: HorizonLayer | undefined, placement: LayerDropPlacement): boolean {
  const roots = layerIds.map((id) => findLayer(currentProject(), id)).filter((layer): layer is HorizonLayer => Boolean(layer));
  if (!roots.length || roots.some((layer) => layer.locked)) return false;
  if (placement === 'root-end') return true;
  if (!target || target.locked) return false;
  const ownedIds = new Set(flattenLayers(roots).map((layer) => layer.id));
  if (ownedIds.has(target.id)) return false;
  return placement !== 'inside' || target.type === 'group' && !target.linkedComposition;
}

function layerDropPlacement(row: HTMLElement, layer: HorizonLayer, clientY: number): LayerDropPlacement {
  const bounds = row.getBoundingClientRect();
  const position = Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)));
  if (layer.type === 'group' && position >= .28 && position <= .72) return 'inside';
  return position < .5 ? 'before' : 'after';
}

function renderLayerTree(): void {
  const tree = element<HTMLDivElement>('#layerTree');
  tree.replaceChildren();
  const project = currentProject();
  const allLayers = flattenLayers(project.layers);
  const navigatorActive = Boolean(layerSearchQuery.trim()) || layerTreeFilter !== 'all';
  const directMatches = navigatorActive ? allLayers.filter(layerMatchesNavigator) : allLayers;
  const visibleIds = new Set(navigatorActive ? directMatches.map((layer) => layer.id) : allLayers.map((layer) => layer.id));
  if (navigatorActive) {
    const parentById = new Map<string, string>();
    const mapParents = (layers: readonly HorizonLayer[], parentId = ''): void => {
      for (const layer of layers) {
        if (parentId) parentById.set(layer.id, parentId);
        if (layer.type === 'group') mapParents(layer.children, layer.id);
      }
    };
    mapParents(project.layers);
    for (const match of directMatches) {
      let parentId = parentById.get(match.id);
      while (parentId) { visibleIds.add(parentId); parentId = parentById.get(parentId); }
      if (match.type === 'group' && layerSearchQuery.trim()) flattenLayers(match.children).forEach((layer) => visibleIds.add(layer.id));
    }
  }
  const collapsed = collapsedLayerGroupIds();
  element<HTMLElement>('#layerFilterStatus').textContent = navigatorActive
    ? `${directMatches.length} MATCH${directMatches.length === 1 ? '' : 'ES'} · ${allLayers.length} TOTAL`
    : `${allLayers.length} LAYER${allLayers.length === 1 ? '' : 'S'} · ${collapsed.size} GROUP${collapsed.size === 1 ? '' : 'S'} COLLAPSED`;
  const selected = selectedLayers();
  const selectedIds = new Set(selected.map((layer) => layer.id));
  renderLayerSelectionSetControls();
  const clearDropFeedback = (): void => {
    tree.classList.remove('drag-root-end');
    tree.querySelectorAll('.layer-row').forEach((item) => item.classList.remove('drop-before', 'drop-after', 'drop-inside'));
  };
  const completeDrop = (ids: readonly string[], target: HorizonLayer | undefined, placement: LayerDropPlacement): void => {
    if (!canDropLayers(ids, target, placement)) return showToast('That layer position is not available. Unlock or detach the target first.', true);
    const next = relocateLayers(currentProject(), ids, target?.id ?? '', placement);
    const retained = ids.filter((id) => Boolean(findLayer(next, id)));
    commit(next, retained.at(-1), retained);
    const position = placement === 'inside' ? `inside ${target?.name}` : placement === 'root-end' ? 'at the bottom of the stack' : `${placement} ${target?.name}`;
    showToast(`Moved ${retained.length} layer root${retained.length === 1 ? '' : 's'} ${position}.`);
  };
  const appendLayers = (layers: readonly HorizonLayer[], depth: number): void => {
    for (const layer of layers) {
      if (!visibleIds.has(layer.id)) continue;
      const row = document.createElement('div');
      row.className = `layer-row${selectedIds.has(layer.id) ? ' selected' : ''}${layer.id === selectedLayerId ? ' primary' : ''}${layer.visible ? '' : ' muted'}${layer.locked ? ' locked' : ''}`;
      row.style.setProperty('--depth', String(depth));
      row.dataset.layerId = layer.id;
      row.dataset.layerType = layer.type;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-level', String(depth + 1));
      row.draggable = !layer.locked;
      const disclosure = layer.type === 'group' ? document.createElement('button') : document.createElement('span');
      disclosure.className = layer.type === 'group' ? 'layer-disclosure' : 'layer-disclosure-placeholder';
      if (layer.type === 'group') {
        const effectiveCollapsed = collapsed.has(layer.id) && !navigatorActive;
        disclosure.textContent = effectiveCollapsed ? '▸' : '▾';
        disclosure.title = navigatorActive ? 'Groups expand automatically while filtering' : effectiveCollapsed ? 'Expand group' : 'Collapse group';
        disclosure.setAttribute('aria-label', disclosure.title);
        disclosure.setAttribute('aria-expanded', String(!effectiveCollapsed));
        (disclosure as HTMLButtonElement).disabled = navigatorActive;
        disclosure.addEventListener('click', (event) => {
          event.stopPropagation();
          if (collapsed.has(layer.id)) collapsed.delete(layer.id); else collapsed.add(layer.id);
          storeCollapsedLayerGroups(collapsed);
          renderEditor();
        });
      }
      const visibility = document.createElement('button');
      visibility.className = 'visibility-button';
      visibility.textContent = layer.visible ? '◉' : '○';
      visibility.title = layer.visible ? 'Hide layer' : 'Show layer';
      visibility.addEventListener('click', (event) => {
        event.stopPropagation();
        commit(updateLayer(currentProject(), layer.id, (draft) => { draft.visible = !draft.visible; }));
      });
      const lock = document.createElement('button');
      lock.className = 'layer-lock-button';
      lock.classList.toggle('active', layer.locked);
      lock.textContent = layer.locked ? '◆' : '◇';
      lock.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      lock.addEventListener('click', (event) => {
        event.stopPropagation();
        commit(updateLayer(currentProject(), layer.id, (draft) => { draft.locked = !draft.locked; }));
      });
      const icon = document.createElement('span');
      icon.className = 'layer-icon';
      icon.textContent = ({ group: 'GR', image: 'IM', text: 'TX', shape: 'SH', spectrum: 'SP', waveform: 'WV', particles: 'PT', path: 'PH' } as const)[layer.type];
      const copy = document.createElement('div');
      copy.className = 'layer-copy';
      const name = document.createElement('strong');
      name.textContent = layer.name;
      const detail = document.createElement('small');
      detail.textContent = layer.type === 'group' ? `${layer.linkedComposition ? 'LINKED · ' : ''}${layer.children.length} children${collapsed.has(layer.id) && !navigatorActive ? ' · collapsed' : ''}` : `${layer.effects.length} effects · ${layer.blendMode}`;
      copy.append(name, detail);
      const opacity = document.createElement('span');
      opacity.className = 'layer-opacity';
      opacity.textContent = `${Math.round(layer.opacity * 100)}%`;
      row.append(disclosure, visibility, lock, icon, copy, opacity);
      row.addEventListener('click', (event) => {
        selectLayer(layer.id, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace');
        renderEditor();
      });
      row.addEventListener('dragstart', (event) => {
        const roots = (selectedIds.has(layer.id) ? independentSelectedLayers() : [layer]).filter((item) => !item.locked);
        if (!roots.length) {
          event.preventDefault();
          return showToast('Unlock a layer before moving it.', true);
        }
        draggedLayerIds = roots.map((item) => item.id);
        event.dataTransfer?.setData('application/x-data-horizon-layers', JSON.stringify(draggedLayerIds));
        event.dataTransfer?.setData('text/plain', draggedLayerIds.join(','));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragover', (event) => {
        const placement = layerDropPlacement(row, layer, event.clientY);
        if (!canDropLayers(draggedLayerIds, layer, placement)) return;
        event.preventDefault();
        event.stopPropagation();
        clearDropFeedback();
        row.classList.add(`drop-${placement}`);
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('dragleave', (event) => {
        if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
        row.classList.remove('drop-before', 'drop-after', 'drop-inside');
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const placement = layerDropPlacement(row, layer, event.clientY);
        const ids = [...draggedLayerIds];
        clearDropFeedback();
        completeDrop(ids, layer, placement);
        draggedLayerIds = [];
      });
      row.addEventListener('dragend', () => {
        clearDropFeedback();
        tree.querySelectorAll('.layer-row.dragging').forEach((item) => item.classList.remove('dragging'));
        draggedLayerIds = [];
      });
      tree.append(row);
      if (layer.type === 'group' && (!collapsed.has(layer.id) || navigatorActive)) appendLayers(layer.children, depth + 1);
    }
  };
  appendLayers(project.layers, 0);
  if (!tree.children.length) {
    const empty = document.createElement('div');
    empty.className = 'layer-tree-empty';
    empty.textContent = 'No layers match this navigator filter. Clear the search or choose All layers.';
    tree.append(empty);
  }
  tree.ondragover = (event) => {
    if ((event.target as HTMLElement).closest('.layer-row') || !canDropLayers(draggedLayerIds, undefined, 'root-end')) return;
    event.preventDefault();
    clearDropFeedback();
    tree.classList.add('drag-root-end');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };
  tree.ondragleave = (event) => {
    if (event.relatedTarget instanceof Node && tree.contains(event.relatedTarget)) return;
    tree.classList.remove('drag-root-end');
  };
  tree.ondrop = (event) => {
    if ((event.target as HTMLElement).closest('.layer-row')) return;
    event.preventDefault();
    clearDropFeedback();
    completeDrop([...draggedLayerIds], undefined, 'root-end');
    draggedLayerIds = [];
  };
  element<HTMLElement>('#layoutSelectionCount').textContent = `${selected.length} SELECTED`;
  const unlockedCount = selected.filter((layer) => !layer.locked).length;
  document.querySelectorAll<HTMLButtonElement>('[data-align-layers]').forEach((button) => { button.disabled = unlockedCount === 0; });
  document.querySelectorAll<HTMLButtonElement>('[data-distribute-layers]').forEach((button) => { button.disabled = unlockedCount < 3; });
  const lockSelection = element<HTMLButtonElement>('#lockLayersButton');
  lockSelection.disabled = selected.length === 0;
  lockSelection.textContent = selected.length > 0 && selected.every((layer) => layer.locked) ? 'Unlock' : 'Lock';
}

function effectRange(key: string, effectType?: EffectType): { minimum: number; maximum: number; step: number } {
  if (key === 'levels') return { minimum: 2, maximum: 16, step: 1 };
  if (key === 'density') return { minimum: 20, maximum: 1200, step: 10 };
  if (key === 'speed') return { minimum: -3, maximum: 3, step: 0.01 };
  if (key === 'radius') return { minimum: 0, maximum: 1, step: 0.01 };
  if (key === 'thickness') return { minimum: .25, maximum: 8, step: .05 };
  if (key === 'contrast' || key === 'saturation') return { minimum: 0, maximum: 3, step: 0.01 };
  if (key === 'warmth') return { minimum: -1, maximum: 1, step: 0.01 };
  if (effectType === 'outline' && key === 'strength') return { minimum: 0, maximum: 2, step: 0.01 };
  if (effectType === 'bloom' && key === 'intensity') return { minimum: 0, maximum: 3, step: 0.01 };
  return { minimum: 0, maximum: 1, step: 0.01 };
}

function renderSourceControls(layer: HorizonLayer): void {
  const host = element<HTMLDivElement>('#sourceControls');
  host.replaceChildren();
  const change = (update: (draft: HorizonLayer) => void): void => commit(updateLayer(currentProject(), layer.id, update));
  const field = (labelText: string, input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, onChange: () => void, wide = false): void => {
    const label = document.createElement('label');
    if (wide) label.className = 'wide';
    label.append(labelText, input);
    input.addEventListener('change', onChange);
    host.append(label);
  };
  const number = (value: number, minimum: number, maximum: number, step = 1): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'number'; input.value = String(value); input.min = String(minimum); input.max = String(maximum); input.step = String(step);
    return input;
  };
  const color = (value: string): HTMLInputElement => { const input = document.createElement('input'); input.type = 'color'; input.value = value.slice(0, 7); return input; };
  if (layer.type === 'image') {
    const note = document.createElement('small');
    note.className = 'source-note';
    note.textContent = 'Embedded image source · the original file remains untouched.';
    host.append(note);
  } else if (layer.type === 'text') {
    const preset = createSelect([
      { value: '', label: 'Choose HUD style…' },
      { value: 'signal-title', label: 'Signal Title' },
      { value: 'data-label', label: 'Data Label' },
      { value: 'broadcast-alert', label: 'Broadcast Alert' }
    ], '');
    field('Apply HUD style', preset, () => {
      if (!preset.value) return;
      const styled = createHudTextLayer(preset.value as HudTextPreset);
      change((draft) => {
        if (draft.type !== 'text') return;
        const currentGeometry = authoredTransform(draft);
        const presetGeometry = authoredTransform(styled);
        const presetTransform = {
          ...currentGeometry,
          x: currentGeometry.x - currentGeometry.width / 2 + presetGeometry.width / 2,
          y: currentGeometry.y - currentGeometry.height / 2 + presetGeometry.height / 2,
          width: presetGeometry.width,
          height: presetGeometry.height
        };
        Object.assign(draft, {
          fontFamily: styled.fontFamily, fontSize: styled.fontSize, fontWeight: styled.fontWeight,
          alignment: styled.alignment, verticalAlignment: styled.verticalAlignment, color: styled.color,
          italic: styled.italic, letterSpacing: styled.letterSpacing, lineHeight: styled.lineHeight,
          padding: styled.padding, backgroundColor: styled.backgroundColor, backgroundOpacity: styled.backgroundOpacity,
          borderColor: styled.borderColor, borderWidth: styled.borderWidth, cornerRadius: styled.cornerRadius,
          outlineColor: styled.outlineColor, outlineWidth: styled.outlineWidth,
          shadowColor: styled.shadowColor, shadowBlur: styled.shadowBlur, transform: presetTransform
        });
      });
    }, true);
    const copy = document.createElement('textarea'); copy.rows = 4; copy.value = layer.text;
    field('Text', copy, () => change((draft) => { if (draft.type === 'text') draft.text = copy.value.slice(0, 500); }), true);
    const font = document.createElement('input'); font.type = 'text'; font.value = layer.fontFamily;
    field('Font', font, () => change((draft) => { if (draft.type === 'text') draft.fontFamily = font.value.trim() || 'Segoe UI'; }));
    const size = number(layer.fontSize, 6, 600);
    field('Size', size, () => change((draft) => { if (draft.type === 'text') draft.fontSize = Number(size.value); }));
    const weight = createSelect([400, 500, 600, 700, 800, 900].map((value) => ({ value: String(value), label: String(value) })), String(layer.fontWeight));
    field('Weight', weight, () => change((draft) => { if (draft.type === 'text') draft.fontWeight = Number(weight.value); }));
    const align = createSelect(['left', 'center', 'right'].map((value) => ({ value, label: value })), layer.alignment);
    field('Alignment', align, () => change((draft) => { if (draft.type === 'text') draft.alignment = align.value as 'left' | 'center' | 'right'; }));
    const vertical = createSelect(['top', 'middle', 'bottom'].map((value) => ({ value, label: value })), layer.verticalAlignment);
    field('Vertical align', vertical, () => change((draft) => { if (draft.type === 'text') draft.verticalAlignment = vertical.value as 'top' | 'middle' | 'bottom'; }));
    const italic = document.createElement('input'); italic.type = 'checkbox'; italic.checked = layer.italic;
    field('Italic', italic, () => change((draft) => { if (draft.type === 'text') draft.italic = italic.checked; }));
    const spacing = number(layer.letterSpacing, -20, 100, .5);
    field('Letter spacing', spacing, () => change((draft) => { if (draft.type === 'text') draft.letterSpacing = Number(spacing.value); }));
    const lineHeight = number(layer.lineHeight, .5, 3, .05);
    field('Line height', lineHeight, () => change((draft) => { if (draft.type === 'text') draft.lineHeight = Number(lineHeight.value); }));
    const padding = number(layer.padding, 0, 400, 1);
    field('Padding', padding, () => change((draft) => { if (draft.type === 'text') draft.padding = Number(padding.value); }));
    const textColor = color(layer.color);
    field('Color', textColor, () => change((draft) => { if (draft.type === 'text') draft.color = textColor.value.toUpperCase(); }));
    const background = color(layer.backgroundColor);
    field('Plate color', background, () => change((draft) => { if (draft.type === 'text') draft.backgroundColor = background.value.toUpperCase(); }));
    const backgroundOpacity = number(layer.backgroundOpacity, 0, 1, .05);
    field('Plate opacity', backgroundOpacity, () => change((draft) => { if (draft.type === 'text') draft.backgroundOpacity = Number(backgroundOpacity.value); }));
    const borderColor = color(layer.borderColor);
    field('Border color', borderColor, () => change((draft) => { if (draft.type === 'text') draft.borderColor = borderColor.value.toUpperCase(); }));
    const borderWidth = number(layer.borderWidth, 0, 100, .5);
    field('Border width', borderWidth, () => change((draft) => { if (draft.type === 'text') draft.borderWidth = Number(borderWidth.value); }));
    const cornerRadius = number(layer.cornerRadius, 0, 500, 1);
    field('Corner radius', cornerRadius, () => change((draft) => { if (draft.type === 'text') draft.cornerRadius = Number(cornerRadius.value); }));
    const outlineColor = color(layer.outlineColor);
    field('Outline color', outlineColor, () => change((draft) => { if (draft.type === 'text') draft.outlineColor = outlineColor.value.toUpperCase(); }));
    const outlineWidth = number(layer.outlineWidth, 0, 40, .5);
    field('Outline width', outlineWidth, () => change((draft) => { if (draft.type === 'text') draft.outlineWidth = Number(outlineWidth.value); }));
    const shadowColor = color(layer.shadowColor);
    field('Glow color', shadowColor, () => change((draft) => { if (draft.type === 'text') draft.shadowColor = shadowColor.value.toUpperCase(); }));
    const shadowBlur = number(layer.shadowBlur, 0, 200, 1);
    field('Glow blur', shadowBlur, () => change((draft) => { if (draft.type === 'text') draft.shadowBlur = Number(shadowBlur.value); }));
  } else if (layer.type === 'shape') {
    const kind = createSelect(['rectangle', 'ellipse', 'frame'].map((value) => ({ value, label: value })), layer.shape);
    field('Shape', kind, () => change((draft) => { if (draft.type === 'shape') draft.shape = kind.value as 'rectangle' | 'ellipse' | 'frame'; }));
    const fill = color(layer.fill); field('Fill', fill, () => change((draft) => { if (draft.type === 'shape') draft.fill = fill.value.toUpperCase() + (draft.fill.length === 9 ? draft.fill.slice(7) : 'CC'); }));
    const stroke = color(layer.stroke); field('Stroke', stroke, () => change((draft) => { if (draft.type === 'shape') draft.stroke = stroke.value.toUpperCase(); }));
    const strokeWidth = number(layer.strokeWidth, 0, 200, .5); field('Stroke width', strokeWidth, () => change((draft) => { if (draft.type === 'shape') draft.strokeWidth = Number(strokeWidth.value); }));
    const radius = number(layer.cornerRadius, 0, 500, 1); field('Corner radius', radius, () => change((draft) => { if (draft.type === 'shape') draft.cornerRadius = Number(radius.value); }));
  } else if (layer.type === 'spectrum') {
    const bars = number(layer.bars, 4, 256, 1); field('Bars', bars, () => change((draft) => { if (draft.type === 'spectrum') draft.bars = Math.round(Number(bars.value)); }));
    const low = color(layer.colorLow); field('Low color', low, () => change((draft) => { if (draft.type === 'spectrum') draft.colorLow = low.value.toUpperCase(); }));
    const high = color(layer.colorHigh); field('High color', high, () => change((draft) => { if (draft.type === 'spectrum') draft.colorHigh = high.value.toUpperCase(); }));
    const gain = number(layer.gain, 0, 3, .05); field('Gain', gain, () => change((draft) => { if (draft.type === 'spectrum') draft.gain = Number(gain.value); }));
    const glow = number(layer.glow, 0, 2, .05); field('Glow', glow, () => change((draft) => { if (draft.type === 'spectrum') draft.glow = Number(glow.value); }));
    const mirror = document.createElement('input'); mirror.type = 'checkbox'; mirror.checked = layer.mirror;
    field('Mirror', mirror, () => change((draft) => { if (draft.type === 'spectrum') draft.mirror = mirror.checked; }));
  } else if (layer.type === 'waveform') {
    const waveColor = color(layer.color); field('Color', waveColor, () => change((draft) => { if (draft.type === 'waveform') draft.color = waveColor.value.toUpperCase(); }));
    const amplitude = number(layer.amplitude, 0, 1, .01); field('Amplitude', amplitude, () => change((draft) => { if (draft.type === 'waveform') draft.amplitude = Number(amplitude.value); }));
    const frequency = number(layer.frequency, .5, 16, .1); field('Frequency', frequency, () => change((draft) => { if (draft.type === 'waveform') draft.frequency = Number(frequency.value); }));
    const thickness = number(layer.thickness, .002, .15, .002); field('Thickness', thickness, () => change((draft) => { if (draft.type === 'waveform') draft.thickness = Number(thickness.value); }));
    const glow = number(layer.glow, 0, 2, .05); field('Glow', glow, () => change((draft) => { if (draft.type === 'waveform') draft.glow = Number(glow.value); }));
    const mirror = document.createElement('input'); mirror.type = 'checkbox'; mirror.checked = layer.mirror;
    field('Mirror', mirror, () => change((draft) => { if (draft.type === 'waveform') draft.mirror = mirror.checked; }));
  } else if (layer.type === 'particles') {
    const count = number(layer.count, 1, 96, 1); field('Count', count, () => change((draft) => { if (draft.type === 'particles') draft.count = Math.round(Number(count.value)); }));
    const low = color(layer.colorLow); field('Low color', low, () => change((draft) => { if (draft.type === 'particles') draft.colorLow = low.value.toUpperCase(); }));
    const high = color(layer.colorHigh); field('High color', high, () => change((draft) => { if (draft.type === 'particles') draft.colorHigh = high.value.toUpperCase(); }));
    const size = number(layer.size, .02, .8, .01); field('Size', size, () => change((draft) => { if (draft.type === 'particles') draft.size = Number(size.value); }));
    const speed = number(layer.speed, -2, 2, .01); field('Speed', speed, () => change((draft) => { if (draft.type === 'particles') draft.speed = Number(speed.value); }));
    const spread = number(layer.spread, .02, 1, .01); field('Spread', spread, () => change((draft) => { if (draft.type === 'particles') draft.spread = Number(spread.value); }));
    const gain = number(layer.audioGain, 0, 3, .05); field('Audio gain', gain, () => change((draft) => { if (draft.type === 'particles') draft.audioGain = Number(gain.value); }));
  } else if (layer.type === 'path') {
    const pathColor = color(layer.color); field('Color', pathColor, () => change((draft) => { if (draft.type === 'path') draft.color = pathColor.value.toUpperCase(); }));
    const stroke = number(layer.strokeWidth, .5, 100, .5); field('Stroke width', stroke, () => change((draft) => { if (draft.type === 'path') draft.strokeWidth = Number(stroke.value); }));
    const glow = number(layer.glow, 0, 3, .05); field('Glow', glow, () => change((draft) => { if (draft.type === 'path') draft.glow = Number(glow.value); }));
    const dash = number(layer.dashLength, 0, 400, 1); field('Dash length', dash, () => change((draft) => { if (draft.type === 'path') draft.dashLength = Number(dash.value); }));
    const gap = number(layer.gapLength, 0, 400, 1); field('Gap length', gap, () => change((draft) => { if (draft.type === 'path') draft.gapLength = Number(gap.value); }));
    const speed = number(layer.flowSpeed, -1000, 1000, 5); field('Flow speed', speed, () => change((draft) => { if (draft.type === 'path') draft.flowSpeed = Number(speed.value); }));
    const closed = document.createElement('input'); closed.type = 'checkbox'; closed.checked = layer.closed;
    field('Closed path', closed, () => change((draft) => { if (draft.type === 'path') draft.closed = closed.checked; }));
    const edit = document.createElement('button'); edit.textContent = activeTool === 'path' ? '● Editing Points' : 'Edit Points on Canvas'; edit.className = 'wide-button';
    edit.addEventListener('click', () => setActiveTool('path'));
    host.append(edit);
  } else {
    if (layer.linkedComposition) {
      const link = layer.linkedComposition;
      const card = document.createElement('article'); card.className = 'linked-composition-card'; card.dataset.linkedComposition = layer.id;
      const header = document.createElement('header');
      const identity = document.createElement('div');
      const eyebrow = document.createElement('span'); eyebrow.textContent = `${link.sourceKind.toUpperCase()} LINKED COMPOSITION`;
      const title = document.createElement('strong'); title.textContent = link.displayName;
      identity.append(eyebrow, title);
      const badge = document.createElement('i'); badge.textContent = 'LINKED';
      header.append(identity, badge);
      const locator = document.createElement('code'); locator.textContent = link.locator; locator.title = link.locator;
      const status = document.createElement('small'); status.textContent = `Source v${link.sourceVersion} · revision ${link.sourceRevision} · refreshed ${new Date(link.refreshedAt).toLocaleString()}`;
      const actions = document.createElement('div'); actions.className = 'linked-composition-actions';
      const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = '↻ Refresh Source'; refresh.addEventListener('click', () => void refreshLinkedGroup(layer.id));
      const reveal = document.createElement('button'); reveal.type = 'button'; reveal.textContent = 'Reveal Source'; reveal.addEventListener('click', () => void revealLinkedGroup(layer.id));
      const detach = document.createElement('button'); detach.type = 'button'; detach.textContent = 'Detach'; detach.addEventListener('click', () => detachLinkedGroup(layer.id));
      actions.append(refresh, reveal, detach);
      card.append(header, locator, status, actions);
      host.append(card);
    } else {
      const note = document.createElement('small'); note.className = 'source-note'; note.textContent = 'Group source · edit child layers in the layer stack.'; host.append(note);
    }
  }
}

function renderEffects(layer: HorizonLayer): void {
  const list = element<HTMLDivElement>('#effectList');
  list.replaceChildren();
  if (activeEffectId && !layer.effects.some((effect) => effect.id === activeEffectId)) activeEffectId = '';
  for (const [effectIndex, effect] of layer.effects.entries()) {
    const effectTargetPrefix = `layer.${layer.id}.effect.${effect.id}.`;
    const effectTrackCount = currentProject().timeline.tracks.filter((track) => track.target.startsWith(effectTargetPrefix)).length;
    const effectDriverCount = currentProject().bindings.filter((binding) => binding.enabled && binding.target.startsWith(effectTargetPrefix)).length;
    const inherentlyTimed = (effect.type === 'scanlines' || effect.type === 'displacement') && Math.abs(effect.parameters.speed ?? 0) > .001;
    const card = document.createElement('article');
    card.className = `effect-card${effect.id === activeEffectId ? ' selected' : ''}`;
    card.dataset.effectId = effect.id;
    card.addEventListener('pointerdown', () => {
      activeEffectId = effect.id;
      list.querySelectorAll('.effect-card').forEach((item) => item.classList.toggle('selected', item === card));
      document.querySelectorAll<HTMLElement>('[data-node-effect-id]').forEach((node) => node.classList.toggle('selected', node.dataset.nodeEffectId === effect.id));
    });
    const header = document.createElement('header');
    const toggleLabel = document.createElement('label');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = effect.enabled;
    toggle.addEventListener('change', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
      const target = draft.effects.find((item) => item.id === effect.id);
      if (target) target.enabled = toggle.checked;
    })));
    toggleLabel.append(toggle, ` ${effect.name}`);
    if (effectTrackCount || effectDriverCount || inherentlyTimed) {
      const badges = document.createElement('span');
      badges.className = 'effect-status-badges';
      if (effectTrackCount) {
        const badge = document.createElement('i');
        badge.textContent = `◆ ${effectTrackCount}`;
        badge.title = `${effectTrackCount} timeline animation track${effectTrackCount === 1 ? '' : 's'} · click to reveal`;
        badge.tabIndex = 0;
        badge.setAttribute('role', 'button');
        const reveal = (event: Event): void => {
          event.preventDefault(); event.stopPropagation();
          const target = currentProject().timeline.tracks.find((track) => track.target.startsWith(effectTargetPrefix))?.target;
          if (target) revealAnimationTarget(target);
        };
        badge.addEventListener('click', reveal);
        badge.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') reveal(event); });
        badges.append(badge);
      }
      if (effectDriverCount) { const badge = document.createElement('i'); badge.className = 'audio'; badge.textContent = `♫ ${effectDriverCount}`; badge.title = `${effectDriverCount} active music driver${effectDriverCount === 1 ? '' : 's'}`; badges.append(badge); }
      if (inherentlyTimed) { const badge = document.createElement('i'); badge.className = 'time'; badge.textContent = 'TIME'; badge.title = 'This effect moves continuously using its speed parameter.'; badges.append(badge); }
      toggleLabel.append(badges);
    }
    const actions = document.createElement('div');
    actions.className = 'mini-actions';
    for (const [label, direction] of [['↑', -1], ['↓', 1]] as const) {
      const button = document.createElement('button');
      button.textContent = label;
      button.disabled = effectIndex + direction < 0 || effectIndex + direction >= layer.effects.length;
      button.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const index = draft.effects.findIndex((item) => item.id === effect.id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= draft.effects.length) return;
        const [item] = draft.effects.splice(index, 1);
        draft.effects.splice(target, 0, item);
      })));
      actions.append(button);
    }
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.title = 'Remove effect';
    remove.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
      draft.effects = draft.effects.filter((item) => item.id !== effect.id);
      if (activeEffectId === effect.id) activeEffectId = '';
    })));
    actions.append(remove);
    header.append(toggleLabel, actions);
    const parameters = document.createElement('div');
    parameters.className = 'effect-parameters';
    for (const [key, value] of Object.entries(effect.parameters)) {
      const range = effectRange(key, effect.type);
      const targetPath = `${effectTargetPrefix}${key}`;
      const animationTrack = currentProject().timeline.tracks.find((track) => track.target === targetPath);
      const driverCount = currentProject().bindings.filter((binding) => binding.enabled && binding.target === targetPath).length;
      const displayedValue = evaluatedParameterValue(targetPath) ?? value;
      const row = document.createElement('div');
      row.className = `effect-parameter${animationTrack ? ' animated' : ''}${driverCount ? ' audio-reactive' : ''}`;
      row.dataset.parameterTarget = targetPath;
      row.dataset.parameterMinimum = String(range.minimum);
      row.dataset.parameterMaximum = String(range.maximum);
      row.dataset.parameterStep = String(range.step);
      const label = document.createElement('label');
      label.textContent = `${animationTrack ? '◆ ' : ''}${driverCount ? '♫ ' : ''}${key}`;
      label.title = animationTrack || driverCount ? `${animationTrack ? 'Timeline animated' : ''}${animationTrack && driverCount ? ' + ' : ''}${driverCount ? `${driverCount} music driver${driverCount === 1 ? '' : 's'}` : ''}` : key;
      if (animationTrack) {
        label.tabIndex = 0;
        label.title += ' · click to reveal animation';
        label.addEventListener('click', () => revealAnimationTarget(targetPath));
        label.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') revealAnimationTarget(targetPath); });
      }
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(range.minimum);
      input.max = String(range.maximum);
      input.step = String(range.step);
      input.value = String(displayedValue);
      const output = document.createElement('output');
      output.textContent = Number(displayedValue).toFixed(range.step === 1 ? 0 : 2);
      input.addEventListener('input', () => { output.textContent = Number(input.value).toFixed(range.step === 1 ? 0 : 2); });
      input.addEventListener('change', () => {
        const nextValue = Number(input.value);
        if (recordAutoKeyEdits([{ target: targetPath, value: nextValue }])) return;
        commit(updateLayer(currentProject(), layer.id, (draft) => {
          const target = draft.effects.find((item) => item.id === effect.id);
          if (target) target.parameters[key] = nextValue;
        }));
      });
      row.append(label, input, output);
      parameters.append(row);
    }
    card.append(header, parameters);
    if (effect.type === 'outline') {
      const controls = document.createElement('div');
      controls.className = 'outline-layer-controls';
      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Outline color';
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = effect.color ?? '#19DBFF';
      colorInput.addEventListener('change', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const target = draft.effects.find((item) => item.id === effect.id);
        if (target) target.color = colorInput.value.toUpperCase();
      })));
      colorLabel.append(colorInput);
      const modeLabel = document.createElement('label');
      modeLabel.textContent = 'Output';
      const mode = createSelect([
        { value: 'composite', label: 'Over image' },
        { value: 'isolated', label: 'Outline only' }
      ], effect.outputMode ?? 'composite');
      mode.addEventListener('change', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const target = draft.effects.find((item) => item.id === effect.id);
        if (target) target.outputMode = mode.value as 'composite' | 'isolated';
      })));
      modeLabel.append(mode);
      controls.append(colorLabel, modeLabel);

      const actions = document.createElement('div');
      actions.className = 'outline-layer-actions';
      if (effect.outputMode !== 'isolated') {
        const extract = document.createElement('button');
        extract.type = 'button';
        extract.dataset.extractEffectLayer = effect.id;
        extract.textContent = '◇ Extract to Layer';
        extract.title = 'Move this outline into a separate editable layer above the source.';
        extract.addEventListener('click', () => {
          const result = extractEffectToLayer(currentProject(), layer.id, effect.id);
          if (!result.selectedId || !result.effectId) return showToast('This effect could not be extracted.', true);
          activeEffectId = result.effectId;
          commit(result.project, result.selectedId);
          showToast('Outline extracted to an independent, audio-ready layer.');
        });
        actions.append(extract);
      }
      const audio = document.createElement('button');
      audio.type = 'button';
      audio.dataset.quickAudioEffect = effect.id;
      audio.textContent = '♫ Make It Dance';
      audio.title = 'Create or tune a clearly visible Mids reaction on outline strength, then show its live driver controls.';
      audio.addEventListener('click', () => {
        const target = `layer.${layer.id}.effect.${effect.id}.strength`;
        const configured = createBinding('mids', target, 1);
        configureDriverReaction(configured, layer, 'punchy');
        commit(mutateProject(currentProject(), (draft) => {
          const existing = draft.bindings.find((binding) => binding.target === target);
          if (existing) Object.assign(existing, configured, { id: existing.id });
          else draft.bindings.push(configured);
        }));
        ensureDriverPreview();
        element<HTMLButtonElement>('[data-scroll-target="audioSection"]').click();
        showToast('Outline dance is live. Mids now move strength across a visible range; try Punchy or Beat Pulse below.');
      });
      actions.append(audio);
      const retouch = document.createElement('button');
      retouch.type = 'button';
      retouch.dataset.retouchEffectLayer = effect.id;
      retouch.textContent = '✎ Paint / Erase';
      retouch.title = 'Brush new colored detail into this layer or erase parts of its generated result.';
      retouch.addEventListener('click', () => {
        paintBrushColor = (effect.color ?? paintBrushColor).toUpperCase();
        if (effect.outputMode !== 'isolated') {
          const extracted = extractEffectToLayer(currentProject(), layer.id, effect.id);
          if (!extracted.selectedId || !extracted.effectId) return showToast('This effect could not be prepared for retouching.', true);
          const paint = createPaintLayer();
          activeEffectId = paint.id;
          activeTool = 'mask';
          activePaintMaskId = paint.id;
          commit(updateLayer(extracted.project, extracted.selectedId, (draft) => { draft.effects.push(paint); }), extracted.selectedId);
          setActiveTool('mask', paint.id);
          showToast('Outline extracted automatically. Paint / Erase now edits only the outline layer.');
          return;
        }
        const existing = layer.effects.find((item) => item.type === 'paintLayer');
        if (existing) {
          activeEffectId = existing.id;
          setActiveTool('mask', existing.id);
          renderInspector();
        } else {
          const paint = createPaintLayer();
          activeEffectId = paint.id;
          activeTool = 'mask';
          activePaintMaskId = paint.id;
          commit(updateLayer(currentProject(), layer.id, (draft) => { draft.effects.push(paint); }));
          setActiveTool('mask', paint.id);
        }
        showToast('Paint / Erase active. Paint uses the foreground color; Erase removes the generated layer result.');
      });
      actions.append(retouch);
      card.append(controls, actions);
    }
    if (effect.type === 'paintMask') {
      const controls = document.createElement('div');
      controls.className = 'paint-mask-controls';
      const edit = document.createElement('button');
      edit.className = 'edit-mask-button';
      edit.textContent = activeTool === 'mask' && activePaintMaskId === effect.id ? '● Painting This Mask' : 'Edit Mask on Canvas';
      edit.addEventListener('click', () => {
        activePaintMaskId = effect.id;
        setActiveTool('mask', effect.id);
        showToast('Mask Brush active. Paint over the canvas; Space still pans.');
      });
      const undoStroke = document.createElement('button');
      undoStroke.textContent = 'Undo Stroke';
      undoStroke.disabled = !(effect.paintMask?.strokes.length);
      undoStroke.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        draft.effects.find((item) => item.id === effect.id)?.paintMask?.strokes.pop();
      })));
      const clearReveal = document.createElement('button');
      clearReveal.textContent = 'Reveal All';
      clearReveal.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const mask = draft.effects.find((item) => item.id === effect.id)?.paintMask;
        if (mask) { mask.base = 1; mask.strokes = []; }
      })));
      const clearHide = document.createElement('button');
      clearHide.textContent = 'Hide All';
      clearHide.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const mask = draft.effects.find((item) => item.id === effect.id)?.paintMask;
        if (mask) { mask.base = 0; mask.strokes = []; }
      })));
      controls.append(edit, undoStroke, clearReveal, clearHide);
      card.append(controls);
    } else if (effect.type === 'paintLayer') {
      const controls = document.createElement('div');
      controls.className = 'paint-mask-controls paint-layer-controls';
      const edit = document.createElement('button');
      edit.className = 'edit-mask-button';
      edit.textContent = activeTool === 'mask' && activePaintMaskId === effect.id ? '● Retouching This Layer' : 'Paint / Erase on Canvas';
      edit.addEventListener('click', () => {
        activePaintMaskId = effect.id;
        setActiveTool('mask', effect.id);
        showToast('Paint uses the foreground color. Switch the Brush menu to Erase to remove parts.');
      });
      const undoStroke = document.createElement('button');
      undoStroke.textContent = 'Undo Stroke';
      undoStroke.disabled = !(effect.paintLayer?.strokes.length);
      undoStroke.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        draft.effects.find((item) => item.id === effect.id)?.paintLayer?.strokes.pop();
      })));
      const clear = document.createElement('button');
      clear.textContent = 'Clear Retouching';
      clear.addEventListener('click', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
        const paint = draft.effects.find((item) => item.id === effect.id)?.paintLayer;
        if (paint) paint.strokes = [];
      })));
      const colorNote = document.createElement('small');
      colorNote.textContent = `Paint color: ${paintBrushColor}`;
      controls.append(edit, undoStroke, clear, colorNote);
      card.append(controls);
    }
    list.append(card);
  }
  if (!layer.effects.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-inspector';
    empty.textContent = 'No effects. Add a non-destructive pass below.';
    list.append(empty);
  }
}

function createSelect(options: Array<{ value: string; label: string }>, value: string): HTMLSelectElement {
  const select = document.createElement('select');
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  }
  select.value = value;
  return select;
}

function targetLabel(layer: HorizonLayer, target: string): string {
  return parameterTargets(layer).find((item) => item.path === target)?.label ?? 'the selected parameter';
}

function renderBindings(layer: HorizonLayer): void {
  const list = element<HTMLDivElement>('#bindingList');
  list.replaceChildren();
  const targets = parameterTargets(layer);
  const bindings = currentProject().bindings.filter((binding) => binding.target.startsWith(`layer.${layer.id}.`));
  const updateBinding = (id: string, update: (binding: ParameterBinding) => void): void => {
    commit(mutateProject(currentProject(), (draft) => {
      const binding = draft.bindings.find((item) => item.id === id);
      if (binding) update(binding);
    }));
  };
  for (const binding of bindings) {
    const card = document.createElement('article');
    card.className = 'binding-card';
    card.dataset.bindingId = binding.id;
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = `${binding.source.toUpperCase()} → PARAMETER`;
    const enabledLabel = document.createElement('label');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = binding.enabled;
    enabled.addEventListener('change', () => updateBinding(binding.id, (draft) => { draft.enabled = enabled.checked; }));
    enabledLabel.append(enabled, ' Enabled');
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.addEventListener('click', () => commit(mutateProject(currentProject(), (draft) => {
      draft.bindings = draft.bindings.filter((item) => item.id !== binding.id);
    })));
    header.append(title, enabledLabel, remove);
    const live = document.createElement('div');
    live.className = 'binding-live';
    live.innerHTML = '<span>SOURCE<b data-binding-source-value>0.00</b></span><span>OFFSET<b data-binding-offset-value>+0.00</b></span><span>RESULT<b data-binding-result-value>—</b></span>';
    const reaction = document.createElement('div');
    reaction.className = 'binding-reaction-row';
    const reactionLabel = document.createElement('span');
    reactionLabel.textContent = 'REACTION';
    reaction.append(reactionLabel);
    for (const preset of ['subtle', 'punchy', 'beat'] as DriverReactionPreset[]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.driverPreset = preset;
      button.textContent = preset === 'beat' ? 'Beat Pulse' : `${preset[0].toUpperCase()}${preset.slice(1)}`;
      button.addEventListener('click', () => {
        updateBinding(binding.id, (draft) => configureDriverReaction(draft, layer, preset));
        ensureDriverPreview();
        showToast(`${button.textContent} reaction applied to ${targetLabel(layer, binding.target)}.`);
      });
      reaction.append(button);
    }
    const grid = document.createElement('div');
    grid.className = 'binding-grid';
    const addSelectField = (labelText: string, select: HTMLSelectElement, change: () => void, wide = false): void => {
      const label = document.createElement('label');
      if (wide) label.className = 'wide';
      label.append(labelText, select);
      select.addEventListener('change', change);
      grid.append(label);
    };
    const source = createSelect(['bass', 'mids', 'highs', 'beat', 'rms'].map((value) => ({ value, label: value.toUpperCase() })), binding.source);
    addSelectField('Source', source, () => updateBinding(binding.id, (draft) => { draft.source = source.value as AudioSource; }));
    const direction = createSelect([{ value: '1', label: 'Positive' }, { value: '-1', label: 'Negative' }], String(binding.direction));
    addSelectField('Direction', direction, () => updateBinding(binding.id, (draft) => { draft.direction = Number(direction.value) as 1 | -1; }));
    const target = createSelect(targets.map((item) => ({ value: item.path, label: item.label })), binding.target);
    addSelectField('Target parameter', target, () => updateBinding(binding.id, (draft) => {
      draft.target = target.value;
      configureDriverReaction(draft, layer, 'punchy');
    }), true);
    const numericFields: Array<[string, keyof ParameterBinding, number]> = [
      ['Amount', 'amount', .01], ['Input min', 'inputMinimum', .01], ['Input max', 'inputMaximum', .01],
      ['Output min offset', 'outputMinimum', .01], ['Output max offset', 'outputMaximum', .01],
      ['Smoothing ms', 'smoothingMs', 1], ['Attack ms', 'attackMs', 1], ['Release ms', 'releaseMs', 1]
    ];
    for (const [labelText, key, step] of numericFields) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = String(step);
      input.value = String(binding[key]);
      input.addEventListener('change', () => updateBinding(binding.id, (draft) => {
        (draft[key] as number) = Number(input.value);
      }));
      label.append(input);
      grid.append(label);
    }
    const curve = createSelect([{ value: 'linear', label: 'Linear' }, { value: 'smoothstep', label: 'Smooth' }, { value: 'exponential', label: 'Exponential' }], binding.curve);
    addSelectField('Response curve', curve, () => updateBinding(binding.id, (draft) => { draft.curve = curve.value as ParameterBinding['curve']; }));
    const combine = createSelect([{ value: 'add', label: 'Add offsets' }, { value: 'multiply', label: 'Multiply drivers' }, { value: 'max', label: 'Strongest driver' }], binding.combine);
    addSelectField('Multiple drivers', combine, () => updateBinding(binding.id, (draft) => { draft.combine = combine.value as ParameterBinding['combine']; }));
    card.append(header, live, reaction, grid);
    list.append(card);
  }
}

function reorderEffect(layerId: string, effectId: string, targetIndex: number): void {
  commit(updateLayer(currentProject(), layerId, (draft) => {
    const sourceIndex = draft.effects.findIndex((effect) => effect.id === effectId);
    if (sourceIndex < 0) return;
    const destination = Math.max(0, Math.min(draft.effects.length - 1, targetIndex));
    if (sourceIndex === destination) return;
    const [effect] = draft.effects.splice(sourceIndex, 1);
    draft.effects.splice(destination, 0, effect);
  }));
}

function revealEffectFromNode(layer: HorizonLayer, effectId: string): void {
  activeEffectId = effectId;
  workspaceLayout.panels.inspector.visible = true;
  applyWorkspaceLayout(true);
  renderEffects(layer);
  renderNodeGraph();
  element<HTMLButtonElement>('[data-scroll-target="effectSection"]').click();
  requestAnimationFrame(() => element<HTMLElement>(`[data-effect-id="${effectId}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

function renderNodeGraph(): void {
  const graph = element<HTMLDivElement>('#nodeGraph');
  graph.replaceChildren();
  const layer = selectedLayer();
  element<HTMLButtonElement>('#nodeAddButton').disabled = !layer;
  element<HTMLSelectElement>('#nodeAddInput').disabled = !layer;
  if (!layer) {
    const empty = document.createElement('div');
    empty.className = 'node-empty';
    empty.textContent = 'Select a layer to inspect its source, ordered processing nodes, and final composite output.';
    graph.append(empty);
    return;
  }
  if (activeEffectId && !layer.effects.some((effect) => effect.id === activeEffectId)) activeEffectId = '';
  const project = currentProject();
  const connector = (): HTMLDivElement => {
    const wire = document.createElement('div');
    wire.className = 'node-wire';
    wire.setAttribute('aria-hidden', 'true');
    return wire;
  };
  const telemetry = (items: string[]): HTMLDivElement => {
    const host = document.createElement('div');
    host.className = 'graph-node-telemetry';
    for (const item of items) { const chip = document.createElement('span'); chip.textContent = item; host.append(chip); }
    return host;
  };
  const source = document.createElement('article');
  source.className = 'graph-node source-node';
  source.setAttribute('role', 'listitem');
  const sourceHeader = document.createElement('header');
  const sourceKind = document.createElement('span'); sourceKind.textContent = 'SOURCE';
  sourceHeader.append(sourceKind);
  const sourceMain = document.createElement('button'); sourceMain.className = 'graph-node-main'; sourceMain.type = 'button';
  const sourceName = document.createElement('strong'); sourceName.textContent = layer.name;
  const sourceDetail = document.createElement('small');
  sourceDetail.textContent = layer.type === 'image'
    ? project.assets.find((asset) => asset.id === layer.assetId)?.name ?? 'Embedded image'
    : layer.type === 'group' ? `${layer.children.length} child layers` : `${layer.type} generator`;
  sourceMain.append(sourceName, sourceDetail);
  sourceMain.addEventListener('click', () => element<HTMLButtonElement>('[data-scroll-target="propertiesSection"]').click());
  const layerPrefix = `layer.${layer.id}.`;
  source.append(sourceHeader, sourceMain, telemetry([
    `${project.bindings.filter((binding) => binding.target.startsWith(layerPrefix) && !binding.target.includes('.effect.')).length} AUDIO`,
    `${project.timeline.tracks.filter((track) => track.target.startsWith(layerPrefix) && !track.target.includes('.effect.')).length} TRACKS`
  ]));
  graph.append(source);

  for (const [effectIndex, effect] of layer.effects.entries()) {
    graph.append(connector());
    const node = document.createElement('article');
    const isMask = effect.type === 'regionMask' || effect.type === 'luminanceMask' || effect.type === 'paintMask';
    node.className = `graph-node effect-node${effect.enabled ? '' : ' disabled'}${effect.id === activeEffectId ? ' selected' : ''}`;
    node.dataset.nodeEffectId = effect.id;
    node.draggable = true;
    node.setAttribute('role', 'listitem');
    const header = document.createElement('header');
    const kind = document.createElement('span'); kind.textContent = isMask ? 'MASK' : `FX ${effectIndex + 1}`;
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = effect.enabled; enabled.title = 'Enable node';
    enabled.addEventListener('click', (event) => event.stopPropagation());
    enabled.addEventListener('change', () => commit(updateLayer(currentProject(), layer.id, (draft) => {
      const target = draft.effects.find((item) => item.id === effect.id);
      if (target) target.enabled = enabled.checked;
    })));
    header.append(kind, enabled);
    const main = document.createElement('button'); main.className = 'graph-node-main'; main.type = 'button';
    const name = document.createElement('strong'); name.textContent = effect.name;
    const detail = document.createElement('small');
    const values = Object.entries(effect.parameters).slice(0, 2).map(([key, value]) => `${key} ${Number(value).toFixed(2)}`);
    detail.textContent = values.length ? values.join(' · ')
      : effect.type === 'paintMask' ? `${effect.paintMask?.strokes.length ?? 0} mask strokes`
        : effect.type === 'paintLayer' ? `${effect.paintLayer?.strokes.length ?? 0} retouch strokes`
          : effect.type;
    main.append(name, detail);
    main.addEventListener('click', () => revealEffectFromNode(layer, effect.id));
    const effectPrefix = `${layerPrefix}effect.${effect.id}.`;
    const stats = telemetry([
      `${Object.keys(effect.parameters).length} PARAM`,
      `${project.bindings.filter((binding) => binding.target.startsWith(effectPrefix)).length} AUDIO`,
      `${project.timeline.tracks.filter((track) => track.target.startsWith(effectPrefix)).length} KEYS`
    ]);
    const footer = document.createElement('footer');
    for (const [label, direction] of [['↑', -1], ['↓', 1]] as const) {
      const move = document.createElement('button'); move.type = 'button'; move.textContent = label; move.title = direction < 0 ? 'Move node earlier' : 'Move node later';
      move.disabled = effectIndex + direction < 0 || effectIndex + direction >= layer.effects.length;
      move.addEventListener('click', (event) => { event.stopPropagation(); reorderEffect(layer.id, effect.id, effectIndex + direction); });
      footer.append(move);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove node';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activeEffectId === effect.id) activeEffectId = '';
      commit(updateLayer(currentProject(), layer.id, (draft) => { draft.effects = draft.effects.filter((item) => item.id !== effect.id); }));
    });
    footer.append(remove);
    node.append(header, main, stats, footer);
    node.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', effect.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    node.addEventListener('dragover', (event) => { event.preventDefault(); node.classList.add('drag-target'); });
    node.addEventListener('dragleave', () => node.classList.remove('drag-target'));
    node.addEventListener('drop', (event) => {
      event.preventDefault();
      node.classList.remove('drag-target');
      const draggedId = event.dataTransfer?.getData('text/plain') ?? '';
      if (draggedId && draggedId !== effect.id) reorderEffect(layer.id, draggedId, effectIndex);
    });
    graph.append(node);
  }

  graph.append(connector());
  const output = document.createElement('article'); output.className = 'graph-node output-node'; output.setAttribute('role', 'listitem');
  const outputHeader = document.createElement('header'); const outputKind = document.createElement('span'); outputKind.textContent = 'OUTPUT'; outputHeader.append(outputKind);
  const outputMain = document.createElement('button'); outputMain.className = 'graph-node-main'; outputMain.type = 'button';
  const outputName = document.createElement('strong'); outputName.textContent = 'Layer Composite';
  const outputDetail = document.createElement('small'); outputDetail.textContent = `${layer.blendMode} blend · ${Math.round(layer.opacity * 100)}% opacity`;
  outputMain.append(outputName, outputDetail);
  outputMain.addEventListener('click', () => element<HTMLButtonElement>('[data-scroll-target="propertiesSection"]').click());
  output.append(outputHeader, outputMain, telemetry([`DEPTH ${layer.depth.toFixed(2)}`, `PARALLAX ${layer.parallax.toFixed(2)}`]));
  graph.append(output);
}

function renderInspector(): void {
  const layer = selectedLayer();
  const selection = selectedLayers();
  const empty = element<HTMLDivElement>('#emptyInspector');
  const inspector = element<HTMLDivElement>('#layerInspector');
  const type = element<HTMLElement>('#selectionType');
  empty.hidden = Boolean(layer);
  inspector.hidden = !layer;
  type.textContent = selection.length > 1 ? `${selection.length} LAYERS` : layer?.type.toUpperCase() ?? 'NONE';
  if (!layer) return;
  inspector.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button').forEach((control) => { control.disabled = false; });

  const name = element<HTMLInputElement>('#layerNameInput');
  const visible = element<HTMLInputElement>('#layerVisibleInput');
  const locked = element<HTMLInputElement>('#layerLockedInput');
  const opacity = element<HTMLInputElement>('#layerOpacityInput');
  const opacityValue = element<HTMLOutputElement>('#layerOpacityValue');
  const blend = element<HTMLSelectElement>('#layerBlendInput');
  const depth = element<HTMLInputElement>('#layerDepthInput');
  const depthValue = element<HTMLOutputElement>('#layerDepthValue');
  const parallax = element<HTMLInputElement>('#layerParallaxInput');
  const parallaxValue = element<HTMLOutputElement>('#layerParallaxValue');
  const animatedValues = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
  const layerPath = `layer.${layer.id}`;
  const displayedOpacity = animatedValues.get(`${layerPath}.opacity`) ?? layer.opacity;
  const displayedDepth = animatedValues.get(`${layerPath}.depth`) ?? layer.depth;
  const displayedParallax = animatedValues.get(`${layerPath}.parallax`) ?? layer.parallax;
  name.value = layer.name;
  visible.checked = layer.visible;
  locked.checked = layer.locked;
  opacity.value = String(displayedOpacity);
  opacityValue.textContent = `${Math.round(displayedOpacity * 100)}%`;
  blend.value = layer.blendMode;
  depth.value = String(displayedDepth);
  depthValue.textContent = displayedDepth.toFixed(2);
  parallax.value = String(displayedParallax);
  parallaxValue.textContent = displayedParallax.toFixed(2);
  const authored = authoredTransform(layer);
  const transform = {
    x: animatedValues.get(`${layerPath}.transform.x`) ?? authored.x,
    y: animatedValues.get(`${layerPath}.transform.y`) ?? authored.y,
    width: animatedValues.get(`${layerPath}.transform.width`) ?? authored.width,
    height: animatedValues.get(`${layerPath}.transform.height`) ?? authored.height,
    rotation: animatedValues.get(`${layerPath}.transform.rotation`) ?? authored.rotation
  };
  element<HTMLInputElement>('#layerXInput').value = String(Math.round(transform.x));
  element<HTMLInputElement>('#layerYInput').value = String(Math.round(transform.y));
  element<HTMLInputElement>('#layerWidthInput').value = String(Math.round(transform.width));
  element<HTMLInputElement>('#layerHeightInput').value = String(Math.round(transform.height));
  element<HTMLInputElement>('#layerRotationInput').value = String(Number(transform.rotation.toFixed(2)));
  const fit = element<HTMLSelectElement>('#layerFitInput');
  fit.disabled = layer.type !== 'image';
  fit.value = layer.type === 'image' ? layer.fit : 'stretch';
  renderSourceControls(layer);
  renderEffects(layer);
  renderBindings(layer);
  if (layer.locked) {
    inspector.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button').forEach((control) => {
      if (control.id !== 'layerLockedInput') control.disabled = true;
    });
  }
}

function positionCanvasSelection(transformOverride?: LayerTransform): void {
  if (!editorMode) return;
  const selection = element<HTMLDivElement>('#canvasSelection');
  const layer = selectedLayer();
  const selected = independentSelectedLayers().filter((item) => item.visible);
  const editable = selected.filter((item) => !item.locked);
  const displayedLayers = editable.length ? editable : selected;
  if (activeTool !== 'move' || !showTransformControls || !layer || !displayedLayers.length) {
    selection.hidden = true;
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width < 1 || canvasRect.height < 1) return;
  const animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
  const groupBounds = displayedLayers.length > 1 ? combinedTransformBounds(displayedLayers.map((item) => evaluatedLayerTransform(item, animation))) : undefined;
  const transform = transformOverride ?? (groupBounds ? { x: groupBounds.x, y: groupBounds.y, width: groupBounds.width, height: groupBounds.height, rotation: 0 } : evaluatedLayerTransform(displayedLayers[0], animation));
  const projectCanvas = currentProject().canvas;
  const width = Math.max(8, transform.width / projectCanvas.width * canvasRect.width);
  const height = Math.max(8, transform.height / projectCanvas.height * canvasRect.height);
  const centerX = canvas.offsetLeft + transform.x / projectCanvas.width * canvasRect.width;
  const centerY = canvas.offsetTop + transform.y / projectCanvas.height * canvasRect.height;
  selection.hidden = false;
  selection.classList.toggle('locked', editable.length === 0);
  selection.classList.toggle('multi', displayedLayers.length > 1);
  selection.style.left = `${centerX - width / 2}px`;
  selection.style.top = `${centerY - height / 2}px`;
  selection.style.width = `${width}px`;
  selection.style.height = `${height}px`;
  selection.style.transform = `rotate(${transform.rotation}deg)`;
  const count = selectedLayers().length;
  element<HTMLElement>('#canvasSelectionLabel').textContent = count > 1 ? `${count} LAYERS · ${Math.round(transform.width)} × ${Math.round(transform.height)}` : layer.locked ? `${layer.name} · LOCKED` : layer.name;
}

function positionPathOverlay(): void {
  if (!editorMode || !document.querySelector('#pathPointOverlay')) return;
  const overlay = element<SVGSVGElement>('#pathPointOverlay');
  const layer = selectedLayer();
  if (activeTool !== 'path' || layer?.type !== 'path' || !layer.visible) {
    overlay.setAttribute('hidden', '');
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width < 1 || canvasRect.height < 1) return;
  const authored = authoredTransform(layer);
  const animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
  const transform = {
    x: animation.get(`layer.${layer.id}.transform.x`) ?? authored.x,
    y: animation.get(`layer.${layer.id}.transform.y`) ?? authored.y,
    width: Math.max(1, animation.get(`layer.${layer.id}.transform.width`) ?? authored.width),
    height: Math.max(1, animation.get(`layer.${layer.id}.transform.height`) ?? authored.height),
    rotation: animation.get(`layer.${layer.id}.transform.rotation`) ?? authored.rotation
  };
  overlay.removeAttribute('hidden');
  overlay.style.left = `${canvas.offsetLeft}px`;
  overlay.style.top = `${canvas.offsetTop}px`;
  overlay.style.width = `${canvasRect.width}px`;
  overlay.style.height = `${canvasRect.height}px`;
  overlay.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
  const polyline = element<SVGPolylineElement>('#pathPointLine');
  overlay.querySelectorAll('circle').forEach((circle) => circle.remove());
  const projectCanvas = currentProject().canvas;
  const toCanvasPoint = (point: { x: number; y: number }): { x: number; y: number } => {
    const localX = (point.x - .5) * transform.width;
    const localY = (point.y - .5) * transform.height;
    const angle = transform.rotation * Math.PI / 180;
    const projectX = transform.x + localX * Math.cos(angle) - localY * Math.sin(angle);
    const projectY = transform.y + localX * Math.sin(angle) + localY * Math.cos(angle);
    return { x: projectX / projectCanvas.width * canvasRect.width, y: projectY / projectCanvas.height * canvasRect.height };
  };
  const fromPointer = (pointer: PointerEvent): { x: number; y: number } => {
    const projectX = (pointer.clientX - canvasRect.left) / canvasRect.width * projectCanvas.width;
    const projectY = (pointer.clientY - canvasRect.top) / canvasRect.height * projectCanvas.height;
    const angle = -transform.rotation * Math.PI / 180;
    const dx = projectX - transform.x;
    const dy = projectY - transform.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    return { x: Math.max(0, Math.min(1, localX / transform.width + .5)), y: Math.max(0, Math.min(1, localY / transform.height + .5)) };
  };
  const circles: SVGCircleElement[] = [];
  const updateGeometry = (points: Array<{ x: number; y: number }>): void => {
    const pixels = points.map(toCanvasPoint);
    const linePoints = layer.closed && pixels.length ? [...pixels, pixels[0]] : pixels;
    polyline.setAttribute('points', linePoints.map((point) => `${point.x},${point.y}`).join(' '));
    for (let index = 0; index < circles.length; index += 1) {
      circles[index].setAttribute('cx', String(pixels[index].x));
      circles[index].setAttribute('cy', String(pixels[index].y));
    }
  };
  for (let index = 0; index < layer.points.length; index += 1) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '6');
    circle.dataset.pathPoint = String(index);
    circle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      try { circle.setPointerCapture(event.pointerId); } catch { /* Synthetic smoke events do not own a native pointer. */ }
      const preview = layer.points.map((point) => ({ ...point }));
      const move = (moveEvent: PointerEvent): void => {
        preview[index] = fromPointer(moveEvent);
        updateGeometry(preview);
      };
      const end = (): void => {
        circle.removeEventListener('pointermove', move);
        circle.removeEventListener('pointerup', end);
        circle.removeEventListener('pointercancel', end);
        commit(updateLayer(currentProject(), layer.id, (draft) => { if (draft.type === 'path') draft.points[index] = preview[index]; }));
      };
      circle.addEventListener('pointermove', move);
      circle.addEventListener('pointerup', end);
      circle.addEventListener('pointercancel', end);
    });
    circles.push(circle);
    overlay.append(circle);
  }
  updateGeometry(layer.points);
}

function motionTrackFor(layerId: string, axis: 'x' | 'y', project = currentProject()): AnimationTrack | undefined {
  return project.timeline.tracks.find((track) => track.target === `layer.${layerId}.transform.${axis}`);
}

function motionValueAt(layer: HorizonLayer, axis: 'x' | 'y', time: number, project = currentProject()): number {
  const track = motionTrackFor(layer.id, axis, project);
  const fallback = authoredTransform(layer)[axis];
  if (!track) return fallback;
  return evaluateTimeline({ ...project.timeline, loop: false, tracks: [{ ...track, enabled: true }] }, time).get(track.target) ?? fallback;
}

function commitMotionPoint(layer: HorizonLayer, requestedTime: number, x: number, y: number): void {
  const time = snapAnimationTime(requestedTime);
  const xTarget = `layer.${layer.id}.transform.x`;
  const yTarget = `layer.${layer.id}.transform.y`;
  const authored = authoredTransform(layer);
  let next = currentProject();
  if (!motionTrackFor(layer.id, 'x', next) && time > .001) next = upsertKeyframe(next, xTarget, 0, authored.x, 'easeInOut');
  if (!motionTrackFor(layer.id, 'y', next) && time > .001) next = upsertKeyframe(next, yTarget, 0, authored.y, 'easeInOut');
  const existingX = motionTrackFor(layer.id, 'x', next)?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
  const existingY = motionTrackFor(layer.id, 'y', next)?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
  next = upsertKeyframe(next, xTarget, time, x, existingX?.easing ?? 'easeInOut');
  next = upsertKeyframe(next, yTarget, time, y, existingY?.easing ?? 'easeInOut');
  const xTrack = motionTrackFor(layer.id, 'x', next);
  const yTrack = motionTrackFor(layer.id, 'y', next);
  const xKey = xTrack?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
  const yKey = yTrack?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
  selectedKeyframeIds = new Set([xKey?.id, yKey?.id].filter((id): id is string => Boolean(id)));
  selectedAnimationTrackId = xTrack?.id ?? yTrack?.id ?? '';
  const targetInput = document.querySelector<HTMLSelectElement>('#animationTargetInput');
  if (targetInput) targetInput.dataset.pendingTarget = xTarget;
  timelineTime = time;
  timelinePlaying = false;
  commit(next);
}

function positionMotionPathCurrent(): void {
  if (!editorMode) return;
  const marker = document.querySelector<SVGCircleElement>('#motionPathOverlay .motion-path-current');
  const layer = selectedLayer();
  if (!marker || !layer) return;
  const canvasRect = canvas.getBoundingClientRect();
  const projectCanvas = currentProject().canvas;
  marker.setAttribute('cx', String(motionValueAt(layer, 'x', timelineTime) / projectCanvas.width * canvasRect.width));
  marker.setAttribute('cy', String(motionValueAt(layer, 'y', timelineTime) / projectCanvas.height * canvasRect.height));
}

function positionMotionPathOverlay(): void {
  if (!editorMode || !document.querySelector('#motionPathOverlay')) return;
  const overlay = element<SVGSVGElement>('#motionPathOverlay');
  const line = element<SVGPolylineElement>('#motionPathLine');
  const layer = selectedLayer();
  const xTrack = layer ? motionTrackFor(layer.id, 'x') : undefined;
  const yTrack = layer ? motionTrackFor(layer.id, 'y') : undefined;
  const toggle = element<HTMLButtonElement>('#motionPathToggleButton');
  const add = element<HTMLButtonElement>('#addMotionKeyButton');
  toggle.classList.toggle('active', motionPathsVisible);
  toggle.setAttribute('aria-pressed', String(motionPathsVisible));
  add.disabled = !layer || activeTool !== 'move';
  if (!motionPathsVisible || activeTool !== 'move' || !layer || !layer.visible || (!xTrack && !yTrack)) {
    overlay.setAttribute('hidden', '');
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width < 1 || canvasRect.height < 1) return;
  const projectCanvas = currentProject().canvas;
  overlay.removeAttribute('hidden');
  overlay.style.left = `${canvas.offsetLeft}px`;
  overlay.style.top = `${canvas.offsetTop}px`;
  overlay.style.width = `${canvasRect.width}px`;
  overlay.style.height = `${canvasRect.height}px`;
  overlay.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
  overlay.querySelectorAll('circle, text').forEach((node) => node.remove());
  const keyTimes = Array.from(new Set([...(xTrack?.keyframes.map((keyframe) => keyframe.time) ?? []), ...(yTrack?.keyframes.map((keyframe) => keyframe.time) ?? [])])).sort((left, right) => left - right);
  const startTime = keyTimes[0] ?? 0;
  const endTime = keyTimes[keyTimes.length - 1] ?? currentProject().timeline.duration;
  const toPixel = (x: number, y: number): { x: number; y: number } => ({ x: x / projectCanvas.width * canvasRect.width, y: y / projectCanvas.height * canvasRect.height });
  const samples: string[] = [];
  for (let index = 0; index <= 96; index += 1) {
    const time = startTime + (endTime - startTime) * index / 96;
    const point = toPixel(motionValueAt(layer, 'x', time), motionValueAt(layer, 'y', time));
    samples.push(`${point.x},${point.y}`);
  }
  line.setAttribute('points', samples.join(' '));
  for (const time of keyTimes) {
    const point = toPixel(motionValueAt(layer, 'x', time), motionValueAt(layer, 'y', time));
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '6');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.dataset.motionTime = String(time);
    const xKey = xTrack?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
    const yKey = yTrack?.keyframes.find((keyframe) => Math.abs(keyframe.time - time) < .001);
    circle.classList.add('motion-path-key');
    circle.classList.toggle('selected', Boolean((xKey && selectedKeyframeIds.has(xKey.id)) || (yKey && selectedKeyframeIds.has(yKey.id))));
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(point.x + 8));
    label.setAttribute('y', String(point.y - 8));
    label.textContent = `${Number(time.toFixed(2))}s`;
    circle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      selectedKeyframeIds = new Set([xKey?.id, yKey?.id].filter((id): id is string => Boolean(id)));
      selectedAnimationTrackId = xTrack?.id ?? yTrack?.id ?? '';
      timelineTime = time;
      timelinePlaying = false;
      syncSelectedKeyframeDom();
      syncTimelineControls();
      try { circle.setPointerCapture(event.pointerId); } catch { /* Synthetic smoke events do not own a native pointer. */ }
      let requested = { x: motionValueAt(layer, 'x', time), y: motionValueAt(layer, 'y', time) };
      const thresholdX = 10 / canvasRect.width * projectCanvas.width;
      const thresholdY = 10 / canvasRect.height * projectCanvas.height;
      const move = (moveEvent: PointerEvent): void => {
        const rawX = (moveEvent.clientX - canvasRect.left) / canvasRect.width * projectCanvas.width;
        const rawY = (moveEvent.clientY - canvasRect.top) / canvasRect.height * projectCanvas.height;
        requested = {
          x: Math.max(0, Math.min(projectCanvas.width, snapValue(rawX, [0, projectCanvas.width / 2, projectCanvas.width], thresholdX))),
          y: Math.max(0, Math.min(projectCanvas.height, snapValue(rawY, [0, projectCanvas.height / 2, projectCanvas.height], thresholdY)))
        };
        const preview = toPixel(requested.x, requested.y);
        circle.setAttribute('cx', String(preview.x));
        circle.setAttribute('cy', String(preview.y));
        label.setAttribute('x', String(preview.x + 8));
        label.setAttribute('y', String(preview.y - 8));
      };
      const end = (): void => {
        circle.removeEventListener('pointermove', move);
        circle.removeEventListener('pointerup', end);
        circle.removeEventListener('pointercancel', end);
        commitMotionPoint(layer, time, requested.x, requested.y);
        showToast(`Motion point updated at ${formatTimelineTime(time)}.`);
      };
      circle.addEventListener('pointermove', move);
      circle.addEventListener('pointerup', end);
      circle.addEventListener('pointercancel', end);
    });
    overlay.append(circle, label);
  }
  const current = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  current.setAttribute('r', '4');
  current.classList.add('motion-path-current', 'current');
  overlay.append(current);
  positionMotionPathCurrent();
}

function positionCanvasGuides(): void {
  if (!editorMode) return;
  const guides = element<HTMLDivElement>('#canvasGuides');
  const custom = element<HTMLDivElement>('#customGuideOverlay');
  const smart = element<HTMLDivElement>('#smartGuideOverlay');
  const rulers = element<HTMLDivElement>('#canvasRulers');
  const rect = canvas.getBoundingClientRect();
  guides.classList.toggle('hidden', !guidesVisible);
  custom.classList.toggle('hidden', !guidesVisible);
  rulers.classList.toggle('hidden', !guidesVisible);
  for (const overlay of [guides, custom, smart, rulers]) {
    overlay.style.left = `${canvas.offsetLeft}px`;
    overlay.style.top = `${canvas.offsetTop}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }
  renderCanvasRulers(rect);
  renderCustomGuides();
  syncGuideControls();
}

function renderCanvasRulers(rect = canvas.getBoundingClientRect()): void {
  const projectCanvas = currentProject().canvas;
  const renderTicks = (target: HTMLElement, span: number, pixels: number, horizontal: boolean): void => {
    target.replaceChildren();
    const steps = [10, 20, 50, 100, 200, 500, 1000];
    const step = steps.find((candidate) => candidate / span * pixels >= 42) ?? 1000;
    for (let position = 0; position <= span + .001; position += step) {
      const tick = document.createElement('i');
      tick.className = 'ruler-tick';
      tick.textContent = String(Math.round(position));
      if (horizontal) tick.style.left = `${position / span * 100}%`;
      else tick.style.top = `${position / span * 100}%`;
      target.append(tick);
    }
  };
  renderTicks(element<HTMLElement>('#horizontalRuler'), projectCanvas.width, rect.width, true);
  renderTicks(element<HTMLElement>('#verticalRuler'), projectCanvas.height, rect.height, false);
}

function guidePositionFromPointer(orientation: 'horizontal' | 'vertical', event: PointerEvent): { position: number; inside: boolean } {
  const rect = canvas.getBoundingClientRect();
  const projectCanvas = currentProject().canvas;
  const ratio = orientation === 'vertical' ? (event.clientX - rect.left) / Math.max(1, rect.width) : (event.clientY - rect.top) / Math.max(1, rect.height);
  const limit = orientation === 'vertical' ? projectCanvas.width : projectCanvas.height;
  return { position: Math.max(0, Math.min(limit, ratio * limit)), inside: ratio >= 0 && ratio <= 1 };
}

function beginGuideDrag(orientation: 'horizontal' | 'vertical', event: PointerEvent, guideId = ''): void {
  if (currentProject().guidesLocked) return showToast('Unlock guides before moving them.', true);
  event.preventDefault();
  event.stopPropagation();
  const overlay = element<HTMLDivElement>('#customGuideOverlay');
  const line = guideId ? overlay.querySelector<HTMLButtonElement>(`[data-guide-id="${guideId}"]`) : document.createElement('button');
  if (!line) return;
  if (!guideId) {
    line.type = 'button';
    line.className = `custom-guide ${orientation} dragging`;
    line.dataset.guideId = '';
    overlay.append(line);
  }
  line.classList.add('dragging');
  let latest = guidePositionFromPointer(orientation, event);
  const preview = (): void => {
    const projectCanvas = currentProject().canvas;
    const limit = orientation === 'vertical' ? projectCanvas.width : projectCanvas.height;
    const percent = latest.position / limit * 100;
    if (orientation === 'vertical') line.style.left = `${percent}%`;
    else line.style.top = `${percent}%`;
    line.dataset.positionLabel = `${Math.round(latest.position)} px`;
  };
  preview();
  const move = (moveEvent: PointerEvent): void => { latest = guidePositionFromPointer(orientation, moveEvent); preview(); };
  const end = (): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    line.classList.remove('dragging');
    if (!latest.inside) {
      if (!guideId) line.remove();
      else {
        const next = mutateProject(currentProject(), (draft) => { draft.guides = draft.guides.filter((guide) => guide.id !== guideId); });
        commit(next);
        showToast('Guide removed outside the canvas.');
      }
      return;
    }
    const next = mutateProject(currentProject(), (draft) => {
      const existing = draft.guides.find((guide) => guide.id === guideId);
      if (existing) existing.position = Math.round(latest.position);
      else draft.guides.push({ id: createId('guide'), orientation, position: Math.round(latest.position) });
    });
    commit(next);
    showToast(`${orientation === 'vertical' ? 'Vertical' : 'Horizontal'} guide ${guideId ? 'moved to' : 'added at'} ${Math.round(latest.position)} px.`);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function renderCustomGuides(): void {
  const overlay = element<HTMLDivElement>('#customGuideOverlay');
  overlay.replaceChildren();
  const project = currentProject();
  for (const guide of project.guides) {
    const line = document.createElement('button');
    line.type = 'button';
    line.className = `custom-guide ${guide.orientation}`;
    line.classList.toggle('locked', project.guidesLocked);
    line.dataset.guideId = guide.id;
    line.dataset.positionLabel = `${Math.round(guide.position)} px`;
    line.title = `${guide.orientation === 'vertical' ? 'Vertical' : 'Horizontal'} guide at ${Math.round(guide.position)} px${project.guidesLocked ? ' · Locked' : ' · Drag to move'}`;
    const limit = guide.orientation === 'vertical' ? project.canvas.width : project.canvas.height;
    if (guide.orientation === 'vertical') line.style.left = `${guide.position / limit * 100}%`;
    else line.style.top = `${guide.position / limit * 100}%`;
    line.addEventListener('pointerdown', (event) => beginGuideDrag(guide.orientation, event, guide.id));
    overlay.append(line);
  }
}

function syncGuideControls(): void {
  const project = currentProject();
  element<HTMLInputElement>('#showRulersInput').checked = guidesVisible;
  element<HTMLElement>('#guideCountLabel').textContent = `${project.guides.length} custom guide${project.guides.length === 1 ? '' : 's'}`;
  const lock = element<HTMLButtonElement>('#lockGuidesButton');
  lock.textContent = project.guidesLocked ? 'Unlock' : 'Lock';
  lock.classList.toggle('active', project.guidesLocked);
  element<HTMLButtonElement>('#clearGuidesButton').disabled = project.guidesLocked || project.guides.length === 0;
}

function clearSmartGuides(): void {
  if (!editorMode) return;
  const overlay = element<HTMLDivElement>('#smartGuideOverlay');
  overlay.hidden = true;
  overlay.classList.remove('show-x', 'show-y');
}

function showSmartGuides(x?: number, y?: number): void {
  const overlay = element<HTMLDivElement>('#smartGuideOverlay');
  if (!smartGuidesEnabled || (x === undefined && y === undefined)) return clearSmartGuides();
  const projectCanvas = currentProject().canvas;
  overlay.hidden = false;
  overlay.classList.toggle('show-x', x !== undefined);
  overlay.classList.toggle('show-y', y !== undefined);
  if (x !== undefined) element<HTMLElement>('.smart-guide-vertical').style.left = `${x / projectCanvas.width * 100}%`;
  if (y !== undefined) element<HTMLElement>('.smart-guide-horizontal').style.top = `${y / projectCanvas.height * 100}%`;
}

function smartGuideCandidates(excludedIds: ReadonlySet<string>): { x: number[]; y: number[] } {
  const projectCanvas = currentProject().canvas;
  const x = [0, projectCanvas.width / 2, projectCanvas.width];
  const y = [0, projectCanvas.height / 2, projectCanvas.height];
  if (guidesVisible) for (const guide of currentProject().guides) (guide.orientation === 'vertical' ? x : y).push(guide.position);
  if (!smartGuidesEnabled) return { x, y };
  const animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
  for (const layer of flattenLayers(currentProject().layers)) {
    if (!layer.visible || excludedIds.has(layer.id)) continue;
    const bounds = transformBounds(evaluatedLayerTransform(layer, animation));
    x.push(bounds.left, bounds.x, bounds.right);
    y.push(bounds.top, bounds.y, bounds.bottom);
  }
  return { x, y };
}

function snapSelectionAxis(center: number, size: number, candidates: readonly number[], threshold: number): { value: number; guide?: number } {
  if (!snappingEnabled) return { value: center };
  const anchors = [center - size / 2, center, center + size / 2];
  let nearest = center;
  let guide: number | undefined;
  let distance = threshold;
  for (const anchor of anchors) {
    for (const candidate of candidates) {
      const nextDistance = Math.abs(anchor - candidate);
      if (nextDistance <= distance) {
        nearest = center + candidate - anchor;
        guide = candidate;
        distance = nextDistance;
      }
    }
  }
  return { value: nearest, guide };
}

function updateCanvasOverlays(): void {
  positionCanvasGuides();
  positionCanvasSelection();
  positionPathOverlay();
  positionMotionPathOverlay();
}

function insertPresetIntoProject(preset: HorizonLayerPreset): void {
  const inserted = insertLayerPreset(currentProject(), preset);
  if (!inserted.selectedId) return showToast('Preset could not be inserted.', true);
  commit(inserted.project, inserted.selectedId);
  showToast(`${preset.name} inserted with fresh internal IDs.`);
}

async function exportLayerPreset(preset: HorizonLayerPreset): Promise<void> {
  try {
    const result = await window.horizonDesktop.savePreset(preset);
    if (result) showToast(`Preset exported: ${result.filePath}`);
  } catch (error) {
    showToast(`Preset export failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function importLayerPreset(): Promise<void> {
  try {
    const imported = await window.horizonDesktop.openPreset();
    if (!imported) return;
    const validation = validateLayerPreset(imported);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    const normalized = normalizeLayerPreset(imported);
    const replaced = currentProject().presets.some((preset) => preset.id === normalized.id);
    commit(upsertLayerPreset(currentProject(), normalized));
    showToast(`${normalized.name} ${replaced ? 'updated in' : 'imported to'} the project library.`);
  } catch (error) {
    showToast(`Preset import failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function refreshVaultLibrary(force = false): Promise<void> {
  if (vaultLoading || (vaultLoaded && !force)) return;
  vaultLoading = true;
  if (activeDockTab === 'vault') renderVaultBrowser();
  try {
    vaultElements = await window.horizonDesktop.listVault();
    vaultLoaded = true;
  } catch (error) {
    vaultLoaded = false;
    showToast(`Asset Vault refresh failed: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    vaultLoading = false;
    if (activeDockTab === 'vault') renderVaultBrowser();
  }
}

async function openVaultElement(elementSummary: VaultElementSummary): Promise<void> {
  if (dirty && !window.confirm(`Open ${elementSummary.name} from the Asset Vault? Unsaved changes in the current project will be discarded.`)) return;
  try {
    const result = await window.horizonDesktop.openVaultProject(elementSummary.slug);
    const validation = validateProject(result.project);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    activeDockTab = 'layers';
    replaceProject(result.project as HorizonProject);
    dirty = true;
    showToast(`${elementSummary.name} opened as an editable copy. Save it as a project or update the Vault when ready.`);
  } catch (error) {
    showToast(`Asset Vault project could not be opened: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function insertCompositionProject(source: unknown, requestedName = '', linkSource?: CompositionLinkSource): void {
  const validation = validateProject(source);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const sourceProject = source as HorizonProject;
  const sourceLayerCount = flattenLayers(sourceProject.layers).length;
  const inserted = insertProjectAsGroup(currentProject(), sourceProject, requestedName, linkSource);
  if (!inserted.selectedId) throw new Error('The imported project has no editable visual layers.');
  activeDockTab = 'layers';
  commit(inserted.project, inserted.selectedId);
  showToast(`${requestedName || sourceProject.name} inserted as an editable group with ${sourceLayerCount} layer${sourceLayerCount === 1 ? '' : 's'}.`);
}

async function importCompositionProject(): Promise<void> {
  try {
    const imported = await window.horizonDesktop.openComposition();
    if (imported) insertCompositionProject(imported.project, '', { sourceKind: 'file', locator: imported.filePath });
  } catch (error) {
    showToast(`Composition import failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function insertVaultElement(elementSummary: VaultElementSummary): Promise<void> {
  try {
    const imported = await window.horizonDesktop.readVaultProject(elementSummary.slug);
    insertCompositionProject(imported.project, elementSummary.name, { sourceKind: 'vault', locator: elementSummary.slug, displayName: elementSummary.name });
  } catch (error) {
    showToast(`Asset Vault insert failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function refreshLinkedGroup(layerId: string): Promise<void> {
  const layer = findLayer(currentProject(), layerId);
  if (layer?.type !== 'group' || !layer.linkedComposition) return;
  try {
    const source = layer.linkedComposition.sourceKind === 'vault'
      ? await window.horizonDesktop.readVaultProject(layer.linkedComposition.locator)
      : await window.horizonDesktop.readCompositionFile(layer.linkedComposition.locator);
    const refreshed = refreshLinkedComposition(currentProject(), layerId, source.project as HorizonProject);
    if (!refreshed.selectedId) throw new Error('The linked source did not contain an importable composition.');
    commit(refreshed.project, layerId);
    showToast(`${layer.name} refreshed from its ${layer.linkedComposition.sourceKind === 'vault' ? 'Asset Vault' : 'project file'} source.`);
  } catch (error) {
    showToast(`Linked composition refresh failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function revealLinkedGroup(layerId: string): Promise<void> {
  const layer = findLayer(currentProject(), layerId);
  if (layer?.type !== 'group' || !layer.linkedComposition) return;
  try {
    if (layer.linkedComposition.sourceKind === 'vault') await window.horizonDesktop.revealVault(layer.linkedComposition.locator);
    else await window.horizonDesktop.revealCompositionFile(layer.linkedComposition.locator);
  } catch (error) {
    showToast(`Linked source could not be revealed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function detachLinkedGroup(layerId: string): void {
  const layer = findLayer(currentProject(), layerId);
  if (layer?.type !== 'group' || !layer.linkedComposition) return;
  commit(detachLinkedComposition(currentProject(), layerId), layerId);
  showToast(`${layer.name} detached. Its resolved layers remain fully editable.`);
}

async function updateVaultElement(elementSummary: VaultElementSummary): Promise<void> {
  if (!window.confirm(`Replace ${elementSummary.name} in the Tempest Asset Vault with the current project?`)) return;
  try {
    const result = await window.horizonDesktop.publishVault({
      project: currentProject(),
      options: {
        target: 'tempest-broadcast',
        name: elementSummary.name,
        tempestKind: elementSummary.kind,
        transparent: elementSummary.transparent
      },
      previewPng: canvas.toDataURL('image/png')
    });
    await refreshVaultLibrary(true);
    showToast(`Updated ${result.sourceName}; Tempest Broadcast will rescan it automatically.`);
  } catch (error) {
    showToast(`Asset Vault update failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

async function uninstallVaultElement(elementSummary: VaultElementSummary): Promise<void> {
  if (!window.confirm(`Uninstall ${elementSummary.name} from the Tempest Asset Vault?`)) return;
  try {
    const result = await window.horizonDesktop.uninstallVault(elementSummary.slug);
    await refreshVaultLibrary(true);
    showToast(`${elementSummary.name} uninstalled${result.recoverable ? ' and moved to the Recycle Bin' : ''}.`);
  } catch (error) {
    showToast(`Asset Vault uninstall failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

function renderVaultBrowser(): void {
  const browser = element<HTMLDivElement>('#vaultBrowser');
  const count = element<HTMLElement>('#layerCount');
  browser.replaceChildren();
  count.textContent = vaultLoading ? '…' : String(vaultElements.length);
  element<HTMLButtonElement>('#refreshVaultButton').disabled = vaultLoading;
  if (vaultLoading) {
    const loading = document.createElement('div'); loading.className = 'dock-empty'; loading.textContent = 'Reading managed elements from the Tempest Asset Vault…'; browser.append(loading);
    return;
  }
  for (const item of vaultElements) {
    const card = document.createElement('article'); card.className = 'vault-card'; card.dataset.vaultSlug = item.slug;
    const preview = document.createElement('div'); preview.className = 'vault-card-preview';
    if (item.previewPng) {
      const image = document.createElement('img'); image.src = item.previewPng; image.alt = `${item.name} preview`; preview.append(image);
    } else {
      const placeholder = document.createElement('i'); placeholder.textContent = 'NO PREVIEW'; preview.append(placeholder);
    }
    const copy = document.createElement('div'); copy.className = 'vault-card-copy';
    const name = document.createElement('strong'); name.textContent = item.name;
    const detail = document.createElement('small'); detail.textContent = `${item.kind.replace(/-/g, ' ')} · ${item.width} × ${item.height} · ${item.transparent ? 'alpha' : 'opaque'}`;
    const status = document.createElement('span'); status.textContent = `${item.sourceName} · v${item.version} · ${new Date(item.updatedAt).toLocaleString()}`;
    copy.append(name, detail, status);
    const actions = document.createElement('div'); actions.className = 'vault-card-actions';
    const insert = document.createElement('button'); insert.type = 'button'; insert.textContent = '＋ Insert as Editable Layers'; insert.addEventListener('click', () => void insertVaultElement(item));
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit Source'; edit.addEventListener('click', () => void openVaultElement(item));
    const update = document.createElement('button'); update.type = 'button'; update.textContent = 'Update Current'; update.addEventListener('click', () => void updateVaultElement(item));
    const reveal = document.createElement('button'); reveal.type = 'button'; reveal.textContent = 'Reveal'; reveal.addEventListener('click', () => void window.horizonDesktop.revealVault(item.slug));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Uninstall'; remove.addEventListener('click', () => void uninstallVaultElement(item));
    actions.append(insert, edit, update, reveal, remove);
    card.append(preview, copy, actions);
    browser.append(card);
  }
  if (!vaultElements.length) {
    const empty = document.createElement('div'); empty.className = 'dock-empty'; empty.textContent = 'No managed Data Horizon elements are installed yet. Publish the current composition to make it available in Tempest Broadcast.'; browser.append(empty);
  }
}

function renderDockBrowser(): void {
  if (!editorMode) return;
  const project = currentProject();
  const views = {
    layers: element<HTMLDivElement>('#layersDockView'),
    assets: element<HTMLDivElement>('#assetsDockView'),
    masks: element<HTMLDivElement>('#masksDockView'),
    nodes: element<HTMLDivElement>('#nodeDockView'),
    presets: element<HTMLDivElement>('#presetsDockView'),
    vault: element<HTMLDivElement>('#vaultDockView')
  };
  for (const [name, view] of Object.entries(views)) view.hidden = name !== activeDockTab;
  document.querySelectorAll<HTMLButtonElement>('[data-layer-tab]').forEach((button) => button.classList.toggle('active', button.dataset.layerTab === activeDockTab));
  const heading = element<HTMLElement>('#dockHeadingTitle');
  const eyebrow = element<HTMLElement>('#dockHeadingEyebrow');
  const count = element<HTMLElement>('#layerCount');
  if (activeDockTab === 'layers') {
    heading.textContent = 'Layers';
    eyebrow.textContent = 'COMPOSITE STACK';
    count.textContent = String(flattenLayers(project.layers).length);
    return;
  }
  if (activeDockTab === 'assets') {
    heading.textContent = 'Assets';
    eyebrow.textContent = 'SOURCE REGISTRY';
    count.textContent = String(project.assets.length);
    const browser = element<HTMLDivElement>('#assetBrowser');
    browser.replaceChildren();
    const imageLayers = flattenLayers(project.layers).filter((layer) => layer.type === 'image');
    for (const asset of project.assets) {
      const card = document.createElement('article');
      card.className = 'asset-card';
      const preview = document.createElement('img');
      preview.src = asset.uri;
      preview.alt = '';
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = asset.name;
      const uses = imageLayers.filter((layer) => layer.type === 'image' && layer.assetId === asset.id).length;
      const detail = document.createElement('small'); detail.textContent = `${asset.mimeType} · ${uses} use${uses === 1 ? '' : 's'}`;
      copy.append(title, detail);
      const place = document.createElement('button'); place.textContent = 'Place';
      place.addEventListener('click', () => {
        const layer = createImageLayer(asset.id, asset.name.replace(/\.[^.]+$/, ''));
        layer.fit = 'contain';
        layer.transform = { x: project.canvas.width / 2, y: project.canvas.height / 2, width: project.canvas.width * .6, height: project.canvas.height * .6, rotation: 0 };
        commit(addLayer(currentProject(), layer), layer.id);
      });
      card.append(preview, copy, place);
      browser.append(card);
    }
    if (!project.assets.length) {
      const empty = document.createElement('div'); empty.className = 'dock-empty'; empty.textContent = 'No assets yet. Import an image to register and place it.'; browser.append(empty);
    }
    return;
  }
  if (activeDockTab === 'nodes') {
    const layer = selectedLayer();
    heading.textContent = layer?.name ?? 'Node View';
    eyebrow.textContent = 'LAYER RENDER GRAPH';
    count.textContent = layer ? String(layer.effects.length + 2) : '0';
    renderNodeGraph();
    return;
  }
  if (activeDockTab === 'presets') {
    heading.textContent = 'Presets';
    eyebrow.textContent = 'REUSABLE ELEMENT LIBRARY';
    count.textContent = String(project.presets.length);
    const browser = element<HTMLDivElement>('#presetBrowser');
    browser.replaceChildren();
    element<HTMLButtonElement>('#saveSelectionPresetButton').disabled = !selectedLayer();
    for (const preset of project.presets) {
      const card = document.createElement('article'); card.className = 'preset-card'; card.dataset.presetId = preset.id;
      const icon = document.createElement('i'); icon.className = 'preset-card-icon'; icon.textContent = preset.layer.type === 'group' ? 'GR' : preset.layer.type.slice(0, 2).toUpperCase();
      const copy = document.createElement('div'); copy.className = 'preset-card-copy';
      const name = document.createElement('strong'); name.textContent = preset.name;
      const detail = document.createElement('small');
      const layerCount = flattenLayers([preset.layer]).length;
      detail.textContent = `${layerCount} layer${layerCount === 1 ? '' : 's'} · ${preset.assets.length} assets · ${preset.bindings.length} audio · ${preset.tracks.length} tracks`;
      const description = document.createElement('p'); description.textContent = preset.description || `Created with Data Horizon ${preset.createdWith}`;
      copy.append(name, detail, description);
      const actions = document.createElement('div'); actions.className = 'preset-card-actions';
      const insert = document.createElement('button'); insert.type = 'button'; insert.textContent = 'Insert'; insert.addEventListener('click', () => insertPresetIntoProject(preset));
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Export…'; save.addEventListener('click', () => void exportLayerPreset(preset));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = 'Remove preset from project';
      remove.addEventListener('click', () => { commit(removeLayerPreset(currentProject(), preset.id)); showToast(`${preset.name} removed from this project.`); });
      actions.append(insert, save, remove);
      card.append(icon, copy, actions);
      browser.append(card);
    }
    if (!project.presets.length) {
      const empty = document.createElement('div'); empty.className = 'dock-empty'; empty.textContent = 'No reusable elements in this project yet. Select a layer or group and save it as a preset, or import a preset file.'; browser.append(empty);
    }
    return;
  }
  if (activeDockTab === 'vault') {
    heading.textContent = 'Asset Vault';
    eyebrow.textContent = 'TEMPEST BROADCAST LIBRARY';
    renderVaultBrowser();
    if (!vaultLoaded && !vaultLoading) void refreshVaultLibrary();
    return;
  }
  heading.textContent = 'Masks';
  eyebrow.textContent = 'NON-DESTRUCTIVE MASKS';
  const masks = flattenLayers(project.layers).flatMap((layer) => layer.effects
    .filter((effect) => effect.type === 'regionMask' || effect.type === 'luminanceMask' || effect.type === 'paintMask' || effect.type === 'paintLayer')
    .map((effect) => ({ layer, effect })));
  count.textContent = String(masks.length);
  const browser = element<HTMLDivElement>('#maskBrowser');
  browser.replaceChildren();
  for (const { layer, effect } of masks) {
    const card = document.createElement('article'); card.className = 'mask-card';
    const icon = document.createElement('i'); icon.textContent = effect.type === 'regionMask' ? 'RG' : effect.type === 'paintMask' ? 'MK' : effect.type === 'paintLayer' ? 'PT' : 'LU';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = effect.name;
    const detail = document.createElement('small'); detail.textContent = `${layer.name} · ${effect.enabled ? 'enabled' : 'disabled'}`;
    copy.append(title, detail);
    const edit = document.createElement('button'); edit.textContent = effect.type === 'paintMask' || effect.type === 'paintLayer' ? 'Paint' : 'Edit';
    edit.addEventListener('click', () => {
      selectLayer(layer.id);
      activeDockTab = 'layers';
      renderEditor();
      element<HTMLButtonElement>('[data-scroll-target="effectSection"]').click();
      if (effect.type === 'paintMask' || effect.type === 'paintLayer') setActiveTool('mask', effect.id);
    });
    card.append(icon, copy, edit);
    browser.append(card);
  }
  if (!masks.length) {
    const empty = document.createElement('div'); empty.className = 'dock-empty'; empty.textContent = 'No masks yet. Select a layer and add a painted mask or semantic region preset above.'; browser.append(empty);
  }
}

function selectedForegroundColor(): string | undefined {
  const layer = selectedLayer();
  if (!layer) return undefined;
  if (layer.type === 'text' || layer.type === 'waveform' || layer.type === 'path') return layer.color.slice(0, 7);
  if (layer.type === 'shape') return layer.stroke.slice(0, 7);
  if (layer.type === 'spectrum' || layer.type === 'particles') return layer.colorHigh.slice(0, 7);
  return undefined;
}

function canvasBackgroundHex(): string {
  const [red, green, blue] = currentProject().canvas.background;
  return `#${[red, green, blue].map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function applyCanvasViewport(): void {
  if (!editorMode) return;
  const wrap = element<HTMLDivElement>('.canvas-wrap');
  wrap.classList.toggle('manual-zoom', canvasZoom !== null);
  if (canvasZoom === null) {
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.maxHeight = '';
    element<HTMLElement>('#zoomLabel').textContent = 'FIT';
    element<HTMLSelectElement>('#zoomPresetInput').value = 'fit';
  } else {
    const projectCanvas = currentProject().canvas;
    canvas.style.width = `${Math.round(projectCanvas.width * canvasZoom)}px`;
    canvas.style.height = `${Math.round(projectCanvas.height * canvasZoom)}px`;
    canvas.style.maxHeight = 'none';
    element<HTMLElement>('#zoomLabel').textContent = `${Math.round(canvasZoom * 100)}%`;
    const select = element<HTMLSelectElement>('#zoomPresetInput');
    const exactOption = Array.from(select.options).find((option) => Number(option.value) === canvasZoom);
    select.value = exactOption?.value ?? 'fit';
  }
  requestAnimationFrame(updateCanvasOverlays);
}

function setCanvasZoom(requested: number | null): void {
  canvasZoom = requested === null ? null : Math.max(.1, Math.min(3, requested));
  applyCanvasViewport();
}

function snapValue(value: number, candidates: readonly number[], threshold: number): number {
  if (!snappingEnabled) return value;
  let nearest = value;
  let distance = threshold;
  for (const candidate of candidates) {
    const nextDistance = Math.abs(value - candidate);
    if (nextDistance <= distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}

function updateButtonStates(): void {
  const layer = selectedLayer();
  element<HTMLButtonElement>('#duplicateLayerButton').disabled = !layer;
  element<HTMLButtonElement>('#deleteLayerButton').disabled = !selectedLayers().some((item) => !item.locked);
  for (const selector of ['#groupLayerButton', '#moveLayerUpButton', '#moveLayerDownButton']) element<HTMLButtonElement>(selector).disabled = !layer || layer.locked;
  element<HTMLButtonElement>('#undoButton').disabled = !history.canUndo;
  element<HTMLButtonElement>('#redoButton').disabled = !history.canRedo;
  syncLayerClipboardControls();
}

function formatTimelineTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}

function snapAnimationTime(time: number): number {
  const timeline = currentProject().timeline;
  const clamped = Math.max(0, Math.min(timeline.duration, time));
  return timelineSnapToFrames ? Math.round(clamped * Math.max(1, timeline.fps)) / Math.max(1, timeline.fps) : clamped;
}

function toggleAutoKeyRecording(): void {
  autoKeyEnabled = !autoKeyEnabled;
  try { localStorage.setItem(autoKeyStorageKey, String(autoKeyEnabled)); } catch { /* Optional preference persistence. */ }
  syncTimelineControls();
  showToast(autoKeyEnabled ? 'Auto Key is recording. Parameter edits now create keyframes at the playhead.' : 'Auto Key stopped. Parameter edits now change the static base value.');
}

function syncTimelineControls(): void {
  if (!editorMode) return;
  const timeline = currentProject().timeline;
  const scrubber = element<HTMLInputElement>('#timelineScrubber');
  scrubber.max = String(timeline.duration);
  if (document.activeElement !== scrubber) scrubber.value = String(Math.max(0, Math.min(timeline.duration, timelineTime)));
  element<HTMLOutputElement>('#timelineTimeValue').textContent = formatTimelineTime(timelineTime);
  const play = element<HTMLButtonElement>('#timelinePlayButton');
  play.textContent = timelinePlaying ? '❚❚' : '▶';
  play.classList.toggle('active', timelinePlaying);
  const autoKey = element<HTMLButtonElement>('#autoKeyButton');
  autoKey.classList.toggle('active', autoKeyEnabled);
  autoKey.setAttribute('aria-pressed', String(autoKeyEnabled));
  autoKey.textContent = autoKeyEnabled ? '● AUTO KEY' : '● AUTO KEY OFF';
  const effectAutoKey = document.querySelector<HTMLButtonElement>('#effectAutoKeyButton');
  if (effectAutoKey) {
    effectAutoKey.classList.toggle('active', autoKeyEnabled);
    effectAutoKey.setAttribute('aria-pressed', String(autoKeyEnabled));
    effectAutoKey.textContent = autoKeyEnabled ? '● AUTO KEY' : '● AUTO KEY OFF';
  }
  for (const playhead of Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-playhead]'))) {
    playhead.style.left = `${Math.max(0, Math.min(100, timelineTime / Math.max(.001, timeline.duration) * 100))}%`;
  }
  for (const playhead of Array.from(document.querySelectorAll<SVGLineElement>('[data-curve-playhead]'))) {
    const x = 40 + Math.max(0, Math.min(1, timelineTime / Math.max(.001, timeline.duration))) * 948;
    playhead.setAttribute('x1', String(x));
    playhead.setAttribute('x2', String(x));
  }
  positionCanvasSelection();
  positionMotionPathCurrent();
}

function selectedAnimationKeys(): Array<{ track: AnimationTrack; keyframe: AnimationKeyframe }> {
  const result: Array<{ track: AnimationTrack; keyframe: AnimationKeyframe }> = [];
  for (const track of currentProject().timeline.tracks) {
    for (const keyframe of track.keyframes) if (selectedKeyframeIds.has(keyframe.id)) result.push({ track, keyframe });
  }
  return result.sort((left, right) => left.keyframe.time - right.keyframe.time);
}

function syncKeyframeEditor(): void {
  const timeline = currentProject().timeline;
  const selected = selectedAnimationKeys();
  const editor = element<HTMLElement>('#timelineKeyEditor');
  editor.hidden = selected.length === 0 && !timelineWorkAreaEnabled;
  const label = element<HTMLElement>('#timelineKeySelectionLabel');
  label.textContent = selected.length ? `${selected.length} KEY${selected.length === 1 ? '' : 'S'} SELECTED` : 'WORK AREA';
  const time = element<HTMLInputElement>('#timelineKeyTimeInput');
  const value = element<HTMLInputElement>('#timelineKeyValueInput');
  const easing = element<HTMLSelectElement>('#timelineKeyEasingInput');
  time.disabled = selected.length === 0;
  value.disabled = selected.length !== 1;
  easing.disabled = selected.length === 0;
  element<HTMLButtonElement>('#duplicateKeyframesButton').disabled = selected.length === 0;
  element<HTMLButtonElement>('#deleteKeyframesButton').disabled = selected.length === 0;
  if (selected.length) {
    time.value = String(Number(selected[0].keyframe.time.toFixed(3)));
    value.value = selected.length === 1 ? String(Number(selected[0].keyframe.value.toFixed(4))) : '';
    const easingValues = new Set(selected.map((item) => item.keyframe.easing));
    easing.value = easingValues.size === 1 ? selected[0].keyframe.easing : '';
  } else {
    time.value = '';
    value.value = '';
    easing.value = '';
  }
  const start = element<HTMLInputElement>('#timelineLoopStartInput');
  const end = element<HTMLInputElement>('#timelineLoopEndInput');
  start.max = String(timeline.duration);
  end.max = String(timeline.duration);
  start.value = String(Number(timelineLoopStart.toFixed(3)));
  end.value = String(Number(timelineLoopEnd.toFixed(3)));
  start.disabled = !timelineWorkAreaEnabled;
  end.disabled = !timelineWorkAreaEnabled;
  const workArea = element<HTMLButtonElement>('#timelineWorkAreaButton');
  workArea.classList.toggle('active', timelineWorkAreaEnabled);
  workArea.setAttribute('aria-pressed', String(timelineWorkAreaEnabled));
  workArea.textContent = timelineWorkAreaEnabled ? 'WORK AREA ON' : 'WORK AREA OFF';
}

function syncSelectedKeyframeDom(): void {
  document.querySelectorAll<HTMLElement>('.timeline-key[data-keyframe-id]').forEach((key) => key.classList.toggle('selected', selectedKeyframeIds.has(key.dataset.keyframeId || '')));
  document.querySelectorAll<SVGCircleElement>('.curve-key[data-keyframe-id]').forEach((key) => key.classList.toggle('selected', selectedKeyframeIds.has(key.dataset.keyframeId || '')));
  syncKeyframeEditor();
}

function revealAnimationTarget(target: string): void {
  const track = currentProject().timeline.tracks.find((item) => item.target === target);
  if (!track) return;
  selectedAnimationTrackId = track.id;
  timelineTrackFilter = 'selected';
  const targetInput = element<HTMLSelectElement>('#animationTargetInput');
  targetInput.dataset.pendingTarget = target;
  workspaceLayout.panels.timeline.visible = true;
  workspaceLayout.timelineCollapsed = false;
  applyWorkspaceLayout(true);
  renderTimeline();
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`.timeline-track[data-track-id="${track.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

const curveSvgNamespace = 'http://www.w3.org/2000/svg';

function activeAnimationTrack(project = currentProject()): AnimationTrack | undefined {
  const selectedTarget = document.querySelector<HTMLSelectElement>('#animationTargetInput')?.value ?? '';
  return project.timeline.tracks.find((track) => track.id === selectedAnimationTrackId)
    ?? project.timeline.tracks.find((track) => track.target === selectedTarget);
}

function curveElement<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(curveSvgNamespace, name);
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, String(value));
  return node;
}

function renderTimelineCurve(): void {
  const project = currentProject();
  const timeline = project.timeline;
  const panel = element<HTMLElement>('.timeline-panel');
  const host = element<HTMLElement>('#timelineCurveEditor');
  const toggle = element<HTMLButtonElement>('#timelineViewToggleButton');
  panel.classList.toggle('curve-view', timelineCurveView);
  host.hidden = !timelineCurveView;
  toggle.classList.toggle('active', timelineCurveView);
  toggle.setAttribute('aria-pressed', String(timelineCurveView));
  toggle.textContent = timelineCurveView ? 'KEY TRACKS' : 'CURVES';
  if (!timelineCurveView) return;

  let track = activeAnimationTrack(project)
    ?? timeline.tracks.find((item) => timelineTrackFilter === 'all' || item.target.split('.')[1] === selectedLayerId);
  const svg = element<SVGSVGElement>('#timelineCurveSvg');
  svg.replaceChildren();
  const paste = element<HTMLButtonElement>('#pasteKeyframesButton');
  paste.disabled = !track || animationKeyClipboard.length === 0;
  const reduce = element<HTMLButtonElement>('#reduceKeyframesButton');
  reduce.disabled = !track || track.keyframes.length <= 2 || track.keyframes.some((keyframe) => keyframe.easing !== 'linear');
  if (!track || !track.keyframes.length) {
    element<HTMLElement>('#timelineCurveTrackLabel').textContent = 'SELECT AN ANIMATION TRACK';
    element<HTMLElement>('#timelineCurveRangeLabel').textContent = 'VALUE CURVE';
    const empty = curveElement('text', { x: 500, y: 94, class: 'curve-empty' });
    empty.textContent = 'SELECT A TRACK OR ADD KEYFRAMES TO EDIT ITS CURVE';
    svg.append(empty);
    svg.onpointerdown = null;
    return;
  }
  selectedAnimationTrackId = track.id;
  const owner = findLayer(project, track.target.split('.')[1]);
  const descriptor = owner ? parameterTargets(owner).find((item) => item.path === track!.target) : undefined;
  element<HTMLElement>('#timelineCurveTrackLabel').textContent = `${owner?.name ?? 'Missing Layer'} · ${track.name}`;
  const rawMinimum = Math.min(...track.keyframes.map((keyframe) => keyframe.value));
  const rawMaximum = Math.max(...track.keyframes.map((keyframe) => keyframe.value));
  const rawRange = rawMaximum - rawMinimum;
  const padding = Math.max(rawRange * .12, Math.abs(rawMaximum || rawMinimum) * .08, .001);
  const valueMinimum = rawMinimum - padding;
  const valueMaximum = rawMaximum + padding;
  const valueRange = Math.max(.001, valueMaximum - valueMinimum);
  element<HTMLElement>('#timelineCurveRangeLabel').textContent = `${formatDriverValue(rawMinimum)} — ${formatDriverValue(rawMaximum)} · ${track.keyframes.length} KEYS${track.enabled === false ? ' · MUTED' : ''}`;
  const left = 40;
  const right = 988;
  const top = 12;
  const bottom = 160;
  const graphWidth = right - left;
  const graphHeight = bottom - top;
  const xForTime = (time: number): number => left + Math.max(0, Math.min(1, time / Math.max(.001, timeline.duration))) * graphWidth;
  const yForValue = (value: number): number => bottom - (value - valueMinimum) / valueRange * graphHeight;

  if (timelineWorkAreaEnabled) {
    svg.append(curveElement('rect', { x: xForTime(timelineLoopStart), y: top, width: Math.max(1, xForTime(timelineLoopEnd) - xForTime(timelineLoopStart)), height: graphHeight, class: 'curve-work-area' }));
  }
  for (let index = 0; index <= 4; index += 1) {
    const y = top + graphHeight * index / 4;
    svg.append(curveElement('line', { x1: left, y1: y, x2: right, y2: y, class: 'curve-grid' }));
    const label = curveElement('text', { x: 3, y: y + 3, class: 'curve-axis-label' });
    label.textContent = formatDriverValue(valueMaximum - valueRange * index / 4);
    svg.append(label);
  }
  for (let index = 0; index <= 8; index += 1) {
    const x = left + graphWidth * index / 8;
    svg.append(curveElement('line', { x1: x, y1: top, x2: x, y2: bottom, class: 'curve-grid' }));
    if (index % 2 === 0) {
      const label = curveElement('text', { x: x - (index === 8 ? 23 : 6), y: 175, class: 'curve-axis-label' });
      label.textContent = `${Number((timeline.duration * index / 8).toFixed(2))}s`;
      svg.append(label);
    }
  }
  const curveTimeline = { ...timeline, loop: false, tracks: [{ ...track, enabled: true }] };
  const points: string[] = [];
  for (let index = 0; index <= 190; index += 1) {
    const time = timeline.duration * index / 190;
    const value = evaluateTimeline(curveTimeline, time).get(track.target) ?? track.keyframes[0].value;
    points.push(`${xForTime(time)},${yForValue(value)}`);
  }
  svg.append(curveElement('polyline', { points: points.join(' '), class: 'curve-line' }));
  const playhead = curveElement('line', { x1: xForTime(timelineTime), y1: top, x2: xForTime(timelineTime), y2: bottom, class: 'curve-playhead' });
  playhead.dataset.curvePlayhead = '';
  svg.append(playhead);

  for (const keyframe of track.keyframes) {
    const point = curveElement('circle', { cx: xForTime(keyframe.time), cy: yForValue(keyframe.value), r: 5, class: 'curve-key' });
    point.classList.toggle('selected', selectedKeyframeIds.has(keyframe.id));
    point.dataset.keyframeId = keyframe.id;
    point.setAttribute('tabindex', '0');
    point.setAttribute('aria-label', `${formatTimelineTime(keyframe.time)}, value ${formatDriverValue(keyframe.value)}, ${keyframe.easing}`);
    point.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const trackKeyIds = new Set(track!.keyframes.map((item) => item.id));
      if (event.ctrlKey || event.metaKey) {
        selectedKeyframeIds = new Set(Array.from(selectedKeyframeIds).filter((id) => trackKeyIds.has(id)));
        if (selectedKeyframeIds.has(keyframe.id)) selectedKeyframeIds.delete(keyframe.id);
        else selectedKeyframeIds.add(keyframe.id);
        syncSelectedKeyframeDom();
        renderTimelineCurve();
        return;
      }
      if (!selectedKeyframeIds.has(keyframe.id) || Array.from(selectedKeyframeIds).some((id) => !trackKeyIds.has(id))) selectedKeyframeIds = new Set([keyframe.id]);
      syncSelectedKeyframeDom();
      const selected = track!.keyframes.filter((item) => selectedKeyframeIds.has(item.id));
      const starting = new Map(selected.map((item) => [item.id, { time: item.time, value: item.value }]));
      const startX = event.clientX;
      const startY = event.clientY;
      const bounds = svg.getBoundingClientRect();
      let deltaTime = 0;
      let deltaValue = 0;
      let moved = false;
      const move = (moveEvent: PointerEvent): void => {
        const requestedTime = (moveEvent.clientX - startX) / Math.max(1, bounds.width) * timeline.duration;
        const anchor = starting.get(keyframe.id)!;
        deltaTime = snapAnimationTime(anchor.time + requestedTime) - anchor.time;
        const times = Array.from(starting.values()).map((item) => item.time);
        deltaTime = Math.max(-Math.min(...times), Math.min(timeline.duration - Math.max(...times), deltaTime));
        deltaValue = -(moveEvent.clientY - startY) / Math.max(1, bounds.height) * valueRange;
        moved ||= Math.abs(moveEvent.clientX - startX) > 2 || Math.abs(moveEvent.clientY - startY) > 2;
        for (const [id, start] of starting) {
          const marker = svg.querySelector<SVGCircleElement>(`.curve-key[data-keyframe-id="${id}"]`);
          if (!marker) continue;
          const value = Math.max(descriptor?.minimum ?? -Infinity, Math.min(descriptor?.maximum ?? Infinity, start.value + deltaValue));
          marker.setAttribute('cx', String(xForTime(start.time + deltaTime)));
          marker.setAttribute('cy', String(yForValue(value)));
        }
      };
      const end = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        if (!moved) {
          timelineTime = keyframe.time;
          timelinePlaying = false;
          syncTimelineControls();
          renderTimelineCurve();
          return;
        }
        const edits = Array.from(starting, ([id, start]) => ({
          id,
          time: start.time + deltaTime,
          value: Math.max(descriptor?.minimum ?? -Infinity, Math.min(descriptor?.maximum ?? Infinity, start.value + deltaValue))
        }));
        timelineTime = Math.max(0, Math.min(timeline.duration, keyframe.time + deltaTime));
        commit(editAnimationKeyframes(currentProject(), edits));
        showToast(`${edits.length} curve point${edits.length === 1 ? '' : 's'} moved in time and value.`);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
    });
    svg.append(point);
  }
  svg.onpointerdown = (event) => {
    if ((event.target as SVGElement).closest('.curve-key')) return;
    const bounds = svg.getBoundingClientRect();
    const viewX = (event.clientX - bounds.left) / Math.max(1, bounds.width) * 1000;
    timelineTime = snapAnimationTime((viewX - left) / graphWidth * timeline.duration);
    timelinePlaying = false;
    selectedKeyframeIds.clear();
    syncSelectedKeyframeDom();
    syncTimelineControls();
    renderTimelineCurve();
  };
}

function renderTimeline(): void {
  if (!editorMode) return;
  const project = currentProject();
  const timeline = project.timeline;
  element<HTMLInputElement>('#timelineDurationInput').value = String(timeline.duration);
  element<HTMLInputElement>('#timelineLoopInput').checked = timeline.loop;
  timelineLoopStart = Math.max(0, Math.min(timeline.duration - .01, timelineLoopStart));
  timelineLoopEnd = Math.max(timelineLoopStart + .01, Math.min(timeline.duration, timelineLoopEnd || timeline.duration));
  const allKeyframeIds = new Set(timeline.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.id)));
  selectedKeyframeIds = new Set(Array.from(selectedKeyframeIds).filter((id) => allKeyframeIds.has(id)));
  const targetSelect = element<HTMLSelectElement>('#animationTargetInput');
  const previousTarget = targetSelect.dataset.pendingTarget || targetSelect.value;
  delete targetSelect.dataset.pendingTarget;
  targetSelect.replaceChildren();
  const layer = selectedLayer();
  if (layer) {
    for (const target of parameterTargets(layer)) {
      const option = document.createElement('option');
      option.value = target.path;
      option.textContent = `${layer.name} · ${target.label}`;
      targetSelect.append(option);
    }
    if (Array.from(targetSelect.options).some((option) => option.value === previousTarget)) targetSelect.value = previousTarget;
  } else {
    const option = document.createElement('option');
    option.textContent = 'Select a layer to animate';
    option.value = '';
    targetSelect.append(option);
  }
  element<HTMLButtonElement>('#addKeyframeButton').disabled = !layer;
  const filterInput = element<HTMLSelectElement>('#timelineTrackFilterInput');
  filterInput.value = timelineTrackFilter;
  const tracksHost = element<HTMLDivElement>('#timelineTracks');
  tracksHost.replaceChildren();
  const visibleTracks = timeline.tracks.filter((track) => timelineTrackFilter === 'all' || track.target.split('.')[1] === selectedLayerId);
  for (const track of visibleTracks) {
    const row = document.createElement('article');
    row.className = 'timeline-track';
    row.dataset.trackId = track.id;
    row.classList.toggle('selected', track.id === selectedAnimationTrackId || track.target === targetSelect.value);
    row.classList.toggle('muted', track.enabled === false);
    const identity = document.createElement('div');
    identity.className = 'timeline-track-identity';
    const mute = document.createElement('button');
    mute.type = 'button'; mute.textContent = 'M'; mute.title = track.enabled === false ? 'Unmute track' : 'Mute track'; mute.classList.toggle('active', track.enabled === false);
    mute.addEventListener('click', () => commit(setAnimationTrackEnabled(currentProject(), track.id, track.enabled === false)));
    const solo = document.createElement('button');
    solo.type = 'button'; solo.textContent = 'S'; solo.title = 'Solo this animation track'; solo.classList.toggle('active', soloAnimationTrackId === track.id);
    solo.addEventListener('click', () => {
      soloAnimationTrackId = soloAnimationTrackId === track.id ? '' : track.id;
      renderTimeline();
      showToast(soloAnimationTrackId ? `Soloing ${track.name}.` : 'Animation solo cleared.');
    });
    const label = document.createElement('span');
    const owner = findLayer(project, track.target.split('.')[1]);
    label.textContent = `${owner?.name ?? 'Missing Layer'} · ${track.name}`;
    label.title = track.target;
    label.addEventListener('click', () => {
      selectedAnimationTrackId = track.id;
      if (Array.from(targetSelect.options).some((option) => option.value === track.target)) targetSelect.value = track.target;
      renderTimeline();
    });
    identity.append(mute, solo, label);
    const rail = document.createElement('div');
    rail.className = 'timeline-rail';
    const workArea = document.createElement('i');
    workArea.className = 'timeline-work-area';
    workArea.style.left = `${timelineLoopStart / Math.max(.001, timeline.duration) * 100}%`;
    workArea.style.width = `${(timelineLoopEnd - timelineLoopStart) / Math.max(.001, timeline.duration) * 100}%`;
    workArea.hidden = !timelineWorkAreaEnabled;
    const playhead = document.createElement('i');
    playhead.className = 'timeline-playhead';
    playhead.dataset.timelinePlayhead = '';
    playhead.style.left = `${timelineTime / Math.max(.001, timeline.duration) * 100}%`;
    rail.append(workArea, playhead);
    for (const keyframe of track.keyframes) {
      const key = document.createElement('button');
      key.className = 'timeline-key';
      key.classList.toggle('selected', selectedKeyframeIds.has(keyframe.id));
      key.dataset.keyframeId = keyframe.id;
      key.dataset.trackId = track.id;
      key.style.left = `${keyframe.time / Math.max(.001, timeline.duration) * 100}%`;
      key.title = `${formatTimelineTime(keyframe.time)} · ${Number(keyframe.value.toFixed(3))} · ${keyframe.easing}`;
      key.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) {
          if (selectedKeyframeIds.has(keyframe.id)) selectedKeyframeIds.delete(keyframe.id);
          else selectedKeyframeIds.add(keyframe.id);
          selectedAnimationTrackId = track.id;
          syncSelectedKeyframeDom();
          return;
        }
        if (!selectedKeyframeIds.has(keyframe.id)) selectedKeyframeIds = new Set([keyframe.id]);
        selectedAnimationTrackId = track.id;
        syncSelectedKeyframeDom();
        const selected = selectedAnimationKeys();
        const startingTimes = new Map(selected.map((item) => [item.keyframe.id, item.keyframe.time]));
        const startX = event.clientX;
        let deltaTime = 0;
        let moved = false;
        const move = (moveEvent: PointerEvent): void => {
          const requested = (moveEvent.clientX - startX) / Math.max(1, rail.getBoundingClientRect().width) * timeline.duration;
          const times = Array.from(startingTimes.values());
          const minimum = Math.min(...times);
          const maximum = Math.max(...times);
          const snapped = snapAnimationTime(keyframe.time + requested) - keyframe.time;
          deltaTime = Math.max(-minimum, Math.min(timeline.duration - maximum, snapped));
          moved ||= Math.abs(moveEvent.clientX - startX) > 2;
          for (const [id, startingTime] of startingTimes) {
            const marker = document.querySelector<HTMLElement>(`.timeline-key[data-keyframe-id="${id}"]`);
            if (marker) marker.style.left = `${(startingTime + deltaTime) / Math.max(.001, timeline.duration) * 100}%`;
          }
        };
        const end = (): void => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          if (moved) {
            const edits = Array.from(startingTimes, ([id, time]) => ({ id, time: time + deltaTime }));
            timelineTime = Math.max(0, Math.min(timeline.duration, keyframe.time + deltaTime));
            commit(editAnimationKeyframes(currentProject(), edits));
            showToast(`${edits.length} keyframe${edits.length === 1 ? '' : 's'} moved.`);
          } else {
            timelineTime = keyframe.time;
            timelinePlaying = false;
            syncTimelineControls();
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end, { once: true });
      });
      rail.append(key);
    }
    rail.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.timeline-key')) return;
      event.preventDefault();
      const bounds = rail.getBoundingClientRect();
      const startX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
      const marquee = document.createElement('i');
      marquee.className = 'timeline-marquee';
      rail.append(marquee);
      let endX = startX;
      const move = (moveEvent: PointerEvent): void => {
        endX = Math.max(0, Math.min(bounds.width, moveEvent.clientX - bounds.left));
        marquee.style.left = `${Math.min(startX, endX)}px`;
        marquee.style.width = `${Math.abs(endX - startX)}px`;
      };
      const end = (endEvent: PointerEvent): void => {
        window.removeEventListener('pointermove', move);
        marquee.remove();
        const low = Math.min(startX, endX) / Math.max(1, bounds.width) * timeline.duration;
        const high = Math.max(startX, endX) / Math.max(1, bounds.width) * timeline.duration;
        if (!endEvent.ctrlKey && !endEvent.metaKey) selectedKeyframeIds.clear();
        if (Math.abs(endX - startX) <= 3) {
          timelineTime = low;
          timelinePlaying = false;
        } else {
          for (const frame of track.keyframes) if (frame.time >= low && frame.time <= high) selectedKeyframeIds.add(frame.id);
        }
        selectedAnimationTrackId = track.id;
        syncSelectedKeyframeDom();
        syncTimelineControls();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
    });
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.title = 'Remove animation track';
    remove.addEventListener('click', () => commit(removeAnimationTrack(currentProject(), track.id)));
    row.append(identity, rail, remove);
    tracksHost.append(row);
  }
  if (!visibleTracks.length) {
    const empty = document.createElement('span');
    empty.className = 'timeline-empty';
    empty.textContent = timeline.tracks.length ? 'NO ANIMATION TRACKS MATCH THIS FILTER' : 'NO KEYFRAMES · CHOOSE A PARAMETER OR APPLY AN ENTRANCE / EXIT PRESET';
    tracksHost.append(empty);
  }
  renderTimelineCurve();
  syncKeyframeEditor();
  syncTimelineControls();
}

interface EditorScrollPosition { selector: string; top: number; left: number }

const preservedEditorScrollSelectors = ['.inspector-panel', '#layerTree', '#assetBrowser', '#maskBrowser', '#nodeGraphViewport', '#presetBrowser', '#vaultBrowser', '#timelineTracks'];

function captureEditorScrollPositions(): EditorScrollPosition[] {
  return preservedEditorScrollSelectors.flatMap((selector) => {
    const target = document.querySelector<HTMLElement>(selector);
    return target ? [{ selector, top: target.scrollTop, left: target.scrollLeft }] : [];
  });
}

function restoreEditorScrollPositions(positions: EditorScrollPosition[], preserveInspector: boolean): void {
  for (const position of positions) {
    if (!preserveInspector && position.selector === '.inspector-panel') continue;
    const target = document.querySelector<HTMLElement>(position.selector);
    if (!target) continue;
    target.scrollTop = position.top;
    target.scrollLeft = position.left;
  }
}

function renderEditor(): void {
  if (!editorMode) return;
  const scrollPositions = captureEditorScrollPositions();
  const preserveInspector = lastRenderedSelectionId === selectedLayerId;
  if (activeTool === 'mask' && !activePaintMask()) setActiveTool('move');
  else if (activeTool === 'path' && selectedLayer()?.type !== 'path') setActiveTool('move');
  else setActiveTool(activeTool);
  const project = currentProject();
  const projectName = element<HTMLElement>('#projectName');
  if (document.activeElement !== projectName) projectName.textContent = project.name;
  const dirtyState = element<HTMLElement>('#dirtyState');
  dirtyState.textContent = dirty ? 'UNSAVED CHANGES' : (savedPath ? 'SAVED PROJECT' : 'AUTOSAVED DRAFT');
  dirtyState.classList.toggle('dirty', dirty);
  element<HTMLElement>('#assetCount').textContent = `${project.assets.length} linked asset${project.assets.length === 1 ? '' : 's'}`;
  element<HTMLDivElement>('#emptyCanvas').classList.toggle('visible', flattenLayers(project.layers).every((layer) => layer.type === 'group'));
  renderLayerTree();
  renderDockBrowser();
  renderInspector();
  renderTimeline();
  updateCanvasOverlays();
  updateButtonStates();
  const foreground = activeTool === 'mask' && activePaintMask()?.type === 'paintLayer' ? paintBrushColor : selectedForegroundColor();
  if (foreground) element<HTMLInputElement>('#foregroundColorInput').value = foreground;
  element<HTMLInputElement>('#backgroundColorInput').value = canvasBackgroundHex();
  restoreEditorScrollPositions(scrollPositions, preserveInspector);
  lastRenderedSelectionId = selectedLayerId;
}

function bindWorkspaceEvents(): void {
  const dialog = element<HTMLDialogElement>('#workspaceDialog');
  element<HTMLButtonElement>('#timelineCollapseButton').addEventListener('click', (event) => {
    event.stopPropagation();
    workspaceLayout.timelineCollapsed = !workspaceLayout.timelineCollapsed;
    applyWorkspaceLayout(true);
    showToast(workspaceLayout.timelineCollapsed ? 'Timeline collapsed.' : 'Timeline expanded.');
  });
  const toggleFloating = (id: WorkspacePanelId): void => {
    const state = workspaceLayout.panels[id];
    state.visible = true;
    state.floating = !state.floating;
    setWorkspaceLayout(workspaceLayout, `${id[0].toUpperCase()}${id.slice(1)} ${state.floating ? 'floated' : 'docked'}.`);
  };

  document.querySelectorAll<HTMLButtonElement>('[data-workspace-float-toggle]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFloating(button.dataset.workspaceFloatToggle as WorkspacePanelId);
  }));
  document.querySelectorAll<HTMLElement>('[data-workspace-handle]').forEach((handle) => {
    const id = handle.dataset.workspaceHandle as WorkspacePanelId;
    handle.addEventListener('dblclick', (event) => {
      if ((event.target as HTMLElement).closest('button,input,select,label')) return;
      toggleFloating(id);
    });
    handle.addEventListener('pointerdown', (event) => {
      const state = workspaceLayout.panels[id];
      if (!state.floating || event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,label')) return;
      event.preventDefault();
      const panel = element<HTMLElement>(`[data-workspace-panel="${id}"]`);
      document.querySelectorAll<HTMLElement>('.workspace-panel.workspace-floating').forEach((candidate) => { candidate.style.zIndex = candidate === panel ? '60' : '50'; });
      handle.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = state.x;
      const originY = state.y;
      const move = (moveEvent: PointerEvent): void => {
        state.x = Math.max(0, Math.min(originX + moveEvent.clientX - startX, window.innerWidth - 80));
        state.y = Math.max(28, Math.min(originY + moveEvent.clientY - startY, window.innerHeight - 45));
        panel.style.left = `${state.x}px`;
        panel.style.top = `${state.y}px`;
      };
      const end = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        persistWorkspaceLayout();
        renderWorkspaceDialog();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-workspace-resizer]').forEach((resizer) => resizer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizer.setPointerCapture(event.pointerId);
    resizer.classList.add('dragging');
    const kind = resizer.dataset.workspaceResizer;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...workspaceLayout };
    const move = (moveEvent: PointerEvent): void => {
      if (kind === 'toolbox') workspaceLayout.toolboxWidth = Math.max(64, Math.min(320, start.toolboxWidth + moveEvent.clientX - startX));
      else if (kind === 'dock') workspaceLayout.dockWidth = Math.max(280, Math.min(760, start.dockWidth - moveEvent.clientX + startX));
      else if (kind === 'timeline') workspaceLayout.timelineHeight = Math.max(90, Math.min(420, start.timelineHeight - moveEvent.clientY + startY));
      else if (kind === 'inspector') workspaceLayout.inspectorHeight = Math.max(180, Math.min(700, start.inspectorHeight + moveEvent.clientY - startY));
      applyWorkspaceLayout();
    };
    const end = (): void => {
      resizer.classList.remove('dragging');
      resizer.removeEventListener('pointermove', move);
      resizer.removeEventListener('pointerup', end);
      resizer.removeEventListener('pointercancel', end);
      persistWorkspaceLayout();
      renderWorkspaceDialog();
    };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', end);
    resizer.addEventListener('pointercancel', end);
  }));

  for (const id of workspacePanelIds) {
    element<HTMLInputElement>(`[data-workspace-visible="${id}"]`).addEventListener('change', (event) => {
      workspaceLayout.panels[id].visible = (event.currentTarget as HTMLInputElement).checked;
      applyWorkspaceLayout(true);
      renderWorkspaceDialog();
    });
    element<HTMLInputElement>(`[data-workspace-floating="${id}"]`).addEventListener('change', (event) => {
      const floating = (event.currentTarget as HTMLInputElement).checked;
      workspaceLayout.panels[id].floating = floating;
      if (floating) workspaceLayout.panels[id].visible = true;
      applyWorkspaceLayout(true);
      renderWorkspaceDialog();
    });
  }

  const sizeFields: Array<[string, keyof Pick<WorkspaceLayout, 'toolboxWidth' | 'dockWidth' | 'timelineHeight' | 'inspectorHeight'>, number, number]> = [
    ['#workspaceToolboxWidth', 'toolboxWidth', 64, 320],
    ['#workspaceDockWidth', 'dockWidth', 280, 760],
    ['#workspaceTimelineHeight', 'timelineHeight', 90, 420],
    ['#workspaceInspectorHeight', 'inspectorHeight', 180, 700]
  ];
  for (const [selector, key, minimum, maximum] of sizeFields) element<HTMLInputElement>(selector).addEventListener('change', (event) => {
    workspaceLayout[key] = Math.max(minimum, Math.min(maximum, Number((event.currentTarget as HTMLInputElement).value)));
    applyWorkspaceLayout(true);
    renderWorkspaceDialog();
  });

  element<HTMLButtonElement>('#closeWorkspaceButton').addEventListener('click', () => dialog.close());
  element<HTMLButtonElement>('#saveWorkspaceButton').addEventListener('click', saveNamedWorkspace);
  element<HTMLButtonElement>('#loadWorkspaceButton').addEventListener('click', () => {
    const name = element<HTMLSelectElement>('#workspaceSavedSelect').value;
    const layout = savedWorkspaceLayouts()[name];
    if (layout) setWorkspaceLayout(layout, `Workspace “${name}” loaded.`);
  });
  element<HTMLButtonElement>('#deleteWorkspaceButton').addEventListener('click', () => {
    const select = element<HTMLSelectElement>('#workspaceSavedSelect');
    const name = select.value;
    if (!name) return;
    const layouts = savedWorkspaceLayouts();
    delete layouts[name];
    localStorage.setItem(workspaceSavedKey, JSON.stringify(layouts));
    renderWorkspaceDialog();
    showToast(`Workspace “${name}” deleted.`);
  });
  element<HTMLButtonElement>('#resetWorkspaceButton').addEventListener('click', () => setWorkspaceLayout(defaultWorkspaceLayout(), 'Default Editing workspace restored.'));
  element<HTMLSelectElement>('#uiScaleInput').addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    setUiScaleMode(value === 'auto' ? 'auto' : Number(value));
  });
  element<HTMLButtonElement>('#uiScaleAutoButton').addEventListener('click', () => setUiScaleMode('auto'));
  element<HTMLButtonElement>('#uiScaleButton').addEventListener('click', () => {
    renderWorkspaceDialog();
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => element<HTMLSelectElement>('#uiScaleInput').focus());
  });

  const observer = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const panel = entry.target as HTMLElement;
      const id = panel.dataset.workspacePanel as WorkspacePanelId;
      if (!id || !workspaceLayout.panels[id].floating) continue;
      const rect = panel.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const state = workspaceLayout.panels[id];
      if (Math.abs(state.width - width) > 1 || Math.abs(state.height - height) > 1) {
        state.width = width;
        state.height = height;
        changed = true;
      }
    }
    if (changed) {
      window.clearTimeout(workspaceResizeTimer);
      workspaceResizeTimer = window.setTimeout(() => { persistWorkspaceLayout(); renderWorkspaceDialog(); }, 180);
    }
  });
  document.querySelectorAll<HTMLElement>('[data-workspace-panel]').forEach((panel) => observer.observe(panel));
  window.addEventListener('resize', () => {
    applyWorkspaceLayout(true);
    if (uiScaleMode === 'auto') void applyUiScale();
  });
  applyWorkspaceLayout();
  renderWorkspaceDialog();
}

type LayerAlignment = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

function alignLayerSelection(action: LayerAlignment): void {
  const layers = selectedLayers().filter((layer) => !layer.locked);
  if (!layers.length) return showToast('Unlock at least one selected layer before aligning.', true);
  const items = layers.map((layer) => ({ layer, transform: authoredTransform(layer) }));
  const reference = element<HTMLSelectElement>('#alignmentReferenceInput').value;
  const canvasSize = currentProject().canvas;
  const bounds = reference === 'selection' && items.length > 1 ? {
    left: Math.min(...items.map((item) => item.transform.x - item.transform.width / 2)),
    right: Math.max(...items.map((item) => item.transform.x + item.transform.width / 2)),
    top: Math.min(...items.map((item) => item.transform.y - item.transform.height / 2)),
    bottom: Math.max(...items.map((item) => item.transform.y + item.transform.height / 2))
  } : { left: 0, right: canvasSize.width, top: 0, bottom: canvasSize.height };
  const next = mutateProject(currentProject(), (draft) => {
    for (const item of items) {
      const target = findLayer(draft, item.layer.id);
      if (!target) continue;
      const transform = { ...item.transform };
      if (action === 'left') transform.x = bounds.left + transform.width / 2;
      else if (action === 'hcenter') transform.x = (bounds.left + bounds.right) / 2;
      else if (action === 'right') transform.x = bounds.right - transform.width / 2;
      else if (action === 'top') transform.y = bounds.top + transform.height / 2;
      else if (action === 'vcenter') transform.y = (bounds.top + bounds.bottom) / 2;
      else transform.y = bounds.bottom - transform.height / 2;
      target.transform = transform;
    }
  });
  commit(next, selectedLayerId, Array.from(selectedLayerIds));
  showToast(`Aligned ${items.length} layer${items.length === 1 ? '' : 's'} ${action} to ${reference === 'selection' && items.length > 1 ? 'the selection' : 'the canvas'}.`);
}

function distributeLayerSelection(axis: 'horizontal' | 'vertical'): void {
  const layers = selectedLayers().filter((layer) => !layer.locked);
  if (layers.length < 3) return showToast('Select at least three unlocked layers to distribute.', true);
  const items = layers.map((layer) => ({ layer, transform: authoredTransform(layer) })).sort((left, right) => axis === 'horizontal' ? left.transform.x - right.transform.x : left.transform.y - right.transform.y);
  const first = axis === 'horizontal' ? items[0].transform.x : items[0].transform.y;
  const last = axis === 'horizontal' ? items.at(-1)!.transform.x : items.at(-1)!.transform.y;
  const spacing = (last - first) / (items.length - 1);
  const next = mutateProject(currentProject(), (draft) => {
    for (let index = 0; index < items.length; index += 1) {
      const target = findLayer(draft, items[index].layer.id);
      if (!target) continue;
      const transform = { ...items[index].transform };
      if (axis === 'horizontal') transform.x = first + spacing * index;
      else transform.y = first + spacing * index;
      target.transform = transform;
    }
  });
  commit(next, selectedLayerId, Array.from(selectedLayerIds));
  showToast(`Distributed ${items.length} layers by ${axis} centers.`);
}

function bindEditorEvents(): void {
  const canvasWrap = element<HTMLDivElement>('.canvas-wrap');
  const zoomSteps = [.25, .5, .75, 1, 1.5, 2];
  const activatePaintMask = (): void => {
    const layer = selectedLayer();
    if (!layer) return showToast('Select a layer before painting a mask.', true);
    let mask = layer.effects.find((effect) => effect.type === 'paintMask');
    if (!mask) {
      mask = createPaintMask();
      activeTool = 'mask';
      activePaintMaskId = mask.id;
      commit(updateLayer(currentProject(), layer.id, (draft) => { draft.effects.push(mask as HorizonEffect); }));
    } else {
      setActiveTool('mask', mask.id);
    }
    showToast('Mask Brush active. Hide removes; Reveal restores.');
  };
  element<HTMLButtonElement>('#timelinePlayButton').addEventListener('click', () => {
    timelinePlaying = !timelinePlaying;
    const start = timelineWorkAreaEnabled ? timelineLoopStart : 0;
    const end = timelineWorkAreaEnabled ? timelineLoopEnd : currentProject().timeline.duration;
    if (timelineTime < start || timelineTime >= end) timelineTime = start;
    syncTimelineControls();
  });
  element<HTMLButtonElement>('#timelineStartButton').addEventListener('click', () => {
    timelineTime = timelineWorkAreaEnabled ? timelineLoopStart : 0;
    timelinePlaying = false;
    syncTimelineControls();
  });
  element<HTMLInputElement>('#timelineScrubber').addEventListener('input', (event) => {
    timelineTime = Number((event.currentTarget as HTMLInputElement).value);
    timelinePlaying = false;
    syncTimelineControls();
  });
  element<HTMLInputElement>('#timelineDurationInput').addEventListener('change', (event) => {
    const duration = Math.max(.1, Math.min(3600, Number((event.currentTarget as HTMLInputElement).value) || 8));
    timelineTime = Math.min(timelineTime, duration);
    timelineLoopStart = Math.min(timelineLoopStart, Math.max(0, duration - .01));
    timelineLoopEnd = Math.max(timelineLoopStart + .01, Math.min(timelineLoopEnd, duration));
    commit(mutateProject(currentProject(), (draft) => {
      draft.timeline.duration = duration;
      for (const track of draft.timeline.tracks) for (const keyframe of track.keyframes) keyframe.time = Math.min(keyframe.time, duration);
    }));
  });
  element<HTMLInputElement>('#timelineLoopInput').addEventListener('change', (event) => commit(mutateProject(currentProject(), (draft) => {
    draft.timeline.loop = (event.currentTarget as HTMLInputElement).checked;
  })));
  element<HTMLButtonElement>('#autoKeyButton').addEventListener('click', () => {
    toggleAutoKeyRecording();
  });
  element<HTMLSelectElement>('#timelineTrackFilterInput').addEventListener('change', (event) => {
    timelineTrackFilter = (event.currentTarget as HTMLSelectElement).value === 'all' ? 'all' : 'selected';
    renderTimeline();
  });
  element<HTMLButtonElement>('#timelineViewToggleButton').addEventListener('click', () => {
    timelineCurveView = !timelineCurveView;
    renderTimeline();
    showToast(timelineCurveView ? 'Curve view active. Drag points horizontally for time and vertically for value.' : 'Key track view active.');
  });
  element<HTMLSelectElement>('#animationTargetInput').addEventListener('change', (event) => {
    const target = (event.currentTarget as HTMLSelectElement).value;
    selectedAnimationTrackId = currentProject().timeline.tracks.find((track) => track.target === target)?.id ?? '';
    renderTimeline();
  });
  element<HTMLButtonElement>('#timelineWorkAreaButton').addEventListener('click', () => {
    timelineWorkAreaEnabled = !timelineWorkAreaEnabled;
    if (timelineWorkAreaEnabled) {
      timelineLoopStart = Math.max(0, Math.min(timelineTime, currentProject().timeline.duration - .1));
      timelineLoopEnd = Math.max(timelineLoopStart + .1, Math.min(currentProject().timeline.duration, timelineLoopStart + Math.min(4, currentProject().timeline.duration)));
    }
    renderTimeline();
    showToast(timelineWorkAreaEnabled ? `Work area looping from ${formatTimelineTime(timelineLoopStart)} to ${formatTimelineTime(timelineLoopEnd)}.` : 'Work area loop disabled.');
  });
  const changeWorkArea = (): void => {
    const duration = currentProject().timeline.duration;
    const requestedStart = Number(element<HTMLInputElement>('#timelineLoopStartInput').value);
    const requestedEnd = Number(element<HTMLInputElement>('#timelineLoopEndInput').value);
    timelineLoopStart = Math.max(0, Math.min(duration - .01, requestedStart));
    timelineLoopEnd = Math.max(timelineLoopStart + .01, Math.min(duration, requestedEnd));
    timelineTime = Math.max(timelineLoopStart, Math.min(timelineLoopEnd, timelineTime));
    renderTimeline();
  };
  element<HTMLInputElement>('#timelineLoopStartInput').addEventListener('change', changeWorkArea);
  element<HTMLInputElement>('#timelineLoopEndInput').addEventListener('change', changeWorkArea);
  element<HTMLInputElement>('#timelineKeyTimeInput').addEventListener('change', (event) => {
    const selected = selectedAnimationKeys();
    if (!selected.length) return;
    const requested = snapAnimationTime(Number((event.currentTarget as HTMLInputElement).value));
    const delta = requested - selected[0].keyframe.time;
    const minimum = Math.min(...selected.map((item) => item.keyframe.time));
    const maximum = Math.max(...selected.map((item) => item.keyframe.time));
    const clampedDelta = Math.max(-minimum, Math.min(currentProject().timeline.duration - maximum, delta));
    timelineTime = selected[0].keyframe.time + clampedDelta;
    commit(editAnimationKeyframes(currentProject(), selected.map((item) => ({ id: item.keyframe.id, time: item.keyframe.time + clampedDelta }))));
  });
  element<HTMLInputElement>('#timelineKeyValueInput').addEventListener('change', (event) => {
    const selected = selectedAnimationKeys();
    if (selected.length !== 1) return;
    commit(editAnimationKeyframes(currentProject(), [{ id: selected[0].keyframe.id, value: Number((event.currentTarget as HTMLInputElement).value) }]));
  });
  element<HTMLSelectElement>('#timelineKeyEasingInput').addEventListener('change', (event) => {
    const easing = (event.currentTarget as HTMLSelectElement).value as KeyframeEasing;
    const selected = selectedAnimationKeys();
    if (!selected.length) return;
    commit(editAnimationKeyframes(currentProject(), selected.map((item) => ({ id: item.keyframe.id, easing }))));
  });
  element<HTMLButtonElement>('#duplicateKeyframesButton').addEventListener('click', () => {
    const selected = selectedAnimationKeys();
    if (!selected.length) return;
    const frameOffset = 1 / Math.max(1, currentProject().timeline.fps);
    const maximum = Math.max(...selected.map((item) => item.keyframe.time));
    const offset = maximum + frameOffset <= currentProject().timeline.duration ? frameOffset : -frameOffset;
    const nextIds: string[] = [];
    const next = mutateProject(currentProject(), (draft) => {
      for (const item of selected) {
        const track = draft.timeline.tracks.find((candidate) => candidate.id === item.track.id);
        const source = track?.keyframes.find((candidate) => candidate.id === item.keyframe.id);
        if (!track || !source) continue;
        const copy = { ...structuredClone(source), id: createId('keyframe'), time: Math.max(0, Math.min(draft.timeline.duration, source.time + offset)) };
        nextIds.push(copy.id);
        track.keyframes.push(copy);
        track.keyframes.sort((left, right) => left.time - right.time);
      }
    });
    selectedKeyframeIds = new Set(nextIds);
    commit(next);
    showToast(`${nextIds.length} keyframe${nextIds.length === 1 ? '' : 's'} duplicated one frame ${offset > 0 ? 'later' : 'earlier'}.`);
  });
  element<HTMLButtonElement>('#deleteKeyframesButton').addEventListener('click', () => {
    if (!selectedKeyframeIds.size) return;
    const count = selectedKeyframeIds.size;
    const next = removeAnimationKeyframes(currentProject(), Array.from(selectedKeyframeIds));
    selectedKeyframeIds.clear();
    commit(next);
    showToast(`${count} keyframe${count === 1 ? '' : 's'} deleted.`);
  });
  element<HTMLButtonElement>('#timelineSnapFramesButton').addEventListener('click', (event) => {
    timelineSnapToFrames = !timelineSnapToFrames;
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.toggle('active', timelineSnapToFrames);
    button.setAttribute('aria-pressed', String(timelineSnapToFrames));
    button.textContent = timelineSnapToFrames ? 'Snap Frames' : 'Free Time';
    showToast(timelineSnapToFrames ? `Animation edits snap to ${currentProject().timeline.fps} fps.` : 'Free-time animation editing enabled.');
  });
  element<HTMLButtonElement>('#copyKeyframesButton').addEventListener('click', () => {
    const track = activeAnimationTrack();
    const selected = track?.keyframes.filter((keyframe) => selectedKeyframeIds.has(keyframe.id)).sort((left, right) => left.time - right.time) ?? [];
    if (!selected.length) return showToast('Select one or more keys on the active track to copy.', true);
    const origin = selected[0].time;
    animationKeyClipboard = selected.map((keyframe) => ({ time: keyframe.time - origin, value: keyframe.value, easing: keyframe.easing }));
    renderTimelineCurve();
    showToast(`Copied ${animationKeyClipboard.length} keyframe${animationKeyClipboard.length === 1 ? '' : 's'}.`);
  });
  element<HTMLButtonElement>('#pasteKeyframesButton').addEventListener('click', () => {
    const track = activeAnimationTrack();
    if (!track || !animationKeyClipboard.length) return showToast('Copy keys and select a destination animation track first.', true);
    const span = Math.max(...animationKeyClipboard.map((keyframe) => keyframe.time));
    const origin = Math.max(0, Math.min(currentProject().timeline.duration - span, snapAnimationTime(timelineTime)));
    const newIds: string[] = [];
    const next = mutateProject(currentProject(), (draft) => {
      const destination = draft.timeline.tracks.find((item) => item.id === track.id);
      if (!destination) return;
      for (const keyframe of animationKeyClipboard) {
        const time = snapAnimationTime(origin + keyframe.time);
        destination.keyframes = destination.keyframes.filter((existing) => Math.abs(existing.time - time) > .0005);
        const id = createId('keyframe');
        newIds.push(id);
        destination.keyframes.push({ id, time, value: keyframe.value, easing: keyframe.easing });
      }
      destination.keyframes.sort((left, right) => left.time - right.time);
    });
    selectedKeyframeIds = new Set(newIds);
    commit(next);
    showToast(`Pasted ${newIds.length} keyframe${newIds.length === 1 ? '' : 's'} at ${formatTimelineTime(origin)}.`);
  });
  element<HTMLButtonElement>('#reduceKeyframesButton').addEventListener('click', () => {
    const track = activeAnimationTrack();
    if (!track) return showToast('Select a linear animation track to reduce.', true);
    if (track.keyframes.some((keyframe) => keyframe.easing !== 'linear')) return showToast('Reduce Keys preserves authored easing; use it on a fully linear recorded track.', true);
    const before = track.keyframes.length;
    const tolerance = Number(element<HTMLSelectElement>('#timelineReduceToleranceInput').value) || .02;
    const next = reduceAnimationTrackKeyframes(currentProject(), track.id, tolerance);
    const after = next.timeline.tracks.find((item) => item.id === track.id)?.keyframes.length ?? 0;
    if (after === before) return showToast('No redundant keys were found at this tolerance.');
    const remaining = new Set(next.timeline.tracks.flatMap((item) => item.keyframes.map((keyframe) => keyframe.id)));
    selectedKeyframeIds = new Set(Array.from(selectedKeyframeIds).filter((id) => remaining.has(id)));
    commit(next);
    showToast(`Reduced ${before} keys to ${after} while keeping the curve within ${Math.round(tolerance * 100)}% error.`);
  });
  element<HTMLButtonElement>('#addKeyframeButton').addEventListener('click', () => {
    const target = element<HTMLSelectElement>('#animationTargetInput').value;
    if (!target) return;
    const animated = evaluateVisibleTimeline(currentProject().timeline, timelineTime).get(target);
    const value = animated ?? readParameterValue(currentProject(), target);
    if (value === undefined) return showToast('That parameter cannot be keyframed.', true);
    const next = upsertKeyframe(currentProject(), target, timelineTime, value);
    const track = next.timeline.tracks.find((item) => item.target === target);
    const frame = track?.keyframes.find((item) => Math.abs(item.time - timelineTime) < .001);
    if (track) selectedAnimationTrackId = track.id;
    selectedKeyframeIds = new Set(frame ? [frame.id] : []);
    commit(next);
    showToast(`Keyframe added at ${formatTimelineTime(timelineTime)}.`);
  });
  element<HTMLButtonElement>('#applyAnimationPresetButton').addEventListener('click', () => {
    if (!selectedLayerId) return;
    const presetInput = element<HTMLSelectElement>('#animationPresetInput');
    const preset = presetInput.value as AnimationPreset;
    commit(applyAnimationPreset(currentProject(), selectedLayerId, preset));
    timelineTime = preset === 'fade-out' ? Math.max(0, currentProject().timeline.duration - .65) : 0;
    showToast(`${presetInput.selectedOptions[0]?.textContent ?? 'Timeline'} animation applied.`);
  });
  const stepZoom = (direction: -1 | 1): void => {
    const fitted = canvas.getBoundingClientRect().width / Math.max(1, currentProject().canvas.width);
    const current = canvasZoom ?? fitted;
    const next = direction > 0
      ? zoomSteps.find((step) => step > current + .001) ?? 2
      : [...zoomSteps].reverse().find((step) => step < current - .001) ?? .25;
    setCanvasZoom(next);
  };
  element<HTMLButtonElement>('#zoomOutButton').addEventListener('click', () => stepZoom(-1));
  element<HTMLButtonElement>('#zoomInButton').addEventListener('click', () => stepZoom(1));
  element<HTMLSelectElement>('#zoomPresetInput').addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    setCanvasZoom(value === 'fit' ? null : Number(value));
  });
  element<HTMLButtonElement>('#snapToggleButton').addEventListener('click', (event) => {
    snappingEnabled = !snappingEnabled;
    (event.currentTarget as HTMLButtonElement).classList.toggle('active', snappingEnabled);
    showToast(`Transform snapping ${snappingEnabled ? 'enabled' : 'disabled'}.`);
  });
  element<HTMLButtonElement>('#guidesToggleButton').addEventListener('click', (event) => {
    guidesVisible = !guidesVisible;
    (event.currentTarget as HTMLButtonElement).classList.toggle('active', guidesVisible);
    positionCanvasGuides();
  });
  element<HTMLInputElement>('#showRulersInput').addEventListener('change', (event) => {
    guidesVisible = (event.currentTarget as HTMLInputElement).checked;
    element<HTMLButtonElement>('#guidesToggleButton').classList.toggle('active', guidesVisible);
    positionCanvasGuides();
    showToast(`Rulers and guides ${guidesVisible ? 'shown' : 'hidden'}.`);
  });
  element<HTMLElement>('#horizontalRuler').addEventListener('pointerdown', (event) => beginGuideDrag('horizontal', event));
  element<HTMLElement>('#verticalRuler').addEventListener('pointerdown', (event) => beginGuideDrag('vertical', event));
  const syncGuidePositionLimit = (): void => {
    const orientation = element<HTMLSelectElement>('#guideOrientationInput').value as 'horizontal' | 'vertical';
    const input = element<HTMLInputElement>('#guidePositionInput');
    const limit = orientation === 'vertical' ? currentProject().canvas.width : currentProject().canvas.height;
    input.max = String(limit);
    input.value = String(Math.round(limit / 2));
  };
  element<HTMLSelectElement>('#guideOrientationInput').addEventListener('change', syncGuidePositionLimit);
  element<HTMLButtonElement>('#addGuideButton').addEventListener('click', () => {
    const project = currentProject();
    if (project.guidesLocked) return showToast('Unlock guides before adding another.', true);
    if (project.guides.length >= 64) return showToast('A project may contain at most 64 guides.', true);
    const orientation = element<HTMLSelectElement>('#guideOrientationInput').value as 'horizontal' | 'vertical';
    const limit = orientation === 'vertical' ? project.canvas.width : project.canvas.height;
    const requested = Number(element<HTMLInputElement>('#guidePositionInput').value);
    const position = Math.round(Math.max(0, Math.min(limit, Number.isFinite(requested) ? requested : limit / 2)));
    const next = mutateProject(project, (draft) => { draft.guides.push({ id: createId('guide'), orientation, position }); });
    commit(next);
    showToast(`${orientation === 'vertical' ? 'Vertical' : 'Horizontal'} guide added at ${position} px.`);
  });
  element<HTMLButtonElement>('#lockGuidesButton').addEventListener('click', () => {
    const next = mutateProject(currentProject(), (draft) => { draft.guidesLocked = !draft.guidesLocked; });
    const locked = next.guidesLocked;
    commit(next);
    showToast(`Canvas guides ${locked ? 'locked' : 'unlocked'}.`);
  });
  element<HTMLButtonElement>('#clearGuidesButton').addEventListener('click', () => {
    if (currentProject().guidesLocked) return showToast('Unlock guides before clearing them.', true);
    const count = currentProject().guides.length;
    if (!count) return;
    const next = mutateProject(currentProject(), (draft) => { draft.guides = []; });
    commit(next);
    showToast(`Cleared ${count} custom guide${count === 1 ? '' : 's'}.`);
  });
  syncGuidePositionLimit();
  element<HTMLButtonElement>('#smartGuidesToggleButton').addEventListener('click', (event) => {
    smartGuidesEnabled = !smartGuidesEnabled;
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.toggle('active', smartGuidesEnabled);
    button.setAttribute('aria-pressed', String(smartGuidesEnabled));
    if (!smartGuidesEnabled) clearSmartGuides();
    showToast(`Smart guides ${smartGuidesEnabled ? 'enabled' : 'disabled'}.`);
  });
  element<HTMLButtonElement>('#motionPathToggleButton').addEventListener('click', () => {
    motionPathsVisible = !motionPathsVisible;
    positionMotionPathOverlay();
    showToast(`Canvas motion paths ${motionPathsVisible ? 'shown' : 'hidden'}.`);
  });
  element<HTMLButtonElement>('#addMotionKeyButton').addEventListener('click', () => {
    const layer = selectedLayer();
    if (!layer) return showToast('Select a canvas layer before adding a motion point.', true);
    const x = motionValueAt(layer, 'x', timelineTime);
    const y = motionValueAt(layer, 'y', timelineTime);
    commitMotionPoint(layer, timelineTime, x, y);
    showToast(`Paired X/Y motion point added at ${formatTimelineTime(timelineTime)}.`);
  });
  canvasWrap.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    stepZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  canvasWrap.addEventListener('pointerdown', (event) => {
    if (event.button !== 1 && !(event.button === 0 && spacePressed)) return;
    event.preventDefault();
    canvasWrap.setPointerCapture(event.pointerId);
    canvasWrap.classList.add('panning');
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = canvasWrap.scrollLeft;
    const startTop = canvasWrap.scrollTop;
    const onMove = (moveEvent: PointerEvent): void => {
      canvasWrap.scrollLeft = startLeft - (moveEvent.clientX - startX);
      canvasWrap.scrollTop = startTop - (moveEvent.clientY - startY);
    };
    const onEnd = (): void => {
      canvasWrap.classList.remove('panning');
      canvasWrap.removeEventListener('pointermove', onMove);
      canvasWrap.removeEventListener('pointerup', onEnd);
      canvasWrap.removeEventListener('pointercancel', onEnd);
    };
    canvasWrap.addEventListener('pointermove', onMove);
    canvasWrap.addEventListener('pointerup', onEnd);
    canvasWrap.addEventListener('pointercancel', onEnd);
  });
  const maskCursor = element<HTMLDivElement>('#maskBrushCursor');
  const positionMaskCursor = (event: PointerEvent): void => {
    if (activeTool !== 'mask') { maskCursor.hidden = true; return; }
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = canvasWrap.getBoundingClientRect();
    const project = currentProject();
    const diameter = maskBrushSize * Math.min(canvasRect.width / Math.max(1, project.canvas.width), canvasRect.height / Math.max(1, project.canvas.height));
    maskCursor.style.left = `${event.clientX - wrapRect.left + canvasWrap.scrollLeft}px`;
    maskCursor.style.top = `${event.clientY - wrapRect.top + canvasWrap.scrollTop}px`;
    maskCursor.style.width = `${Math.max(4, diameter)}px`;
    maskCursor.style.height = `${Math.max(4, diameter)}px`;
    maskCursor.style.setProperty('--brush-softness', `${Math.min(46, Math.max(3, maskBrushSoftness * 46))}%`);
    maskCursor.classList.toggle('reveal', maskBrushMode === 'reveal' || maskBrushMode === 'paint');
    maskCursor.classList.toggle('erase', maskBrushMode === 'erase' || maskBrushMode === 'hide');
    maskCursor.hidden = false;
  };
  canvas.addEventListener('pointermove', positionMaskCursor);
  canvas.addEventListener('pointerleave', () => { maskCursor.hidden = true; });
  canvas.addEventListener('pointerdown', (event) => {
    if (activeTool !== 'mask' || event.button !== 0 || spacePressed) return;
    const layer = selectedLayer();
    const mask = activePaintMask();
    if (!layer || !mask || (mask.type === 'paintMask' ? !mask.paintMask : !mask.paintLayer)) return showToast('Choose a painted mask or retouch pass before using the brush.', true);
    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    const canvasRect = canvas.getBoundingClientRect();
    const authored = authoredTransform(layer);
    const animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
    const transform = {
      x: animation.get(`layer.${layer.id}.transform.x`) ?? authored.x,
      y: animation.get(`layer.${layer.id}.transform.y`) ?? authored.y,
      width: Math.max(1, animation.get(`layer.${layer.id}.transform.width`) ?? authored.width),
      height: Math.max(1, animation.get(`layer.${layer.id}.transform.height`) ?? authored.height),
      rotation: animation.get(`layer.${layer.id}.transform.rotation`) ?? authored.rotation
    };
    const points: Array<{ x: number; y: number }> = [];
    const pointFromEvent = (pointer: PointerEvent): { x: number; y: number } | undefined => {
      const projectX = (pointer.clientX - canvasRect.left) / Math.max(1, canvasRect.width) * currentProject().canvas.width;
      const projectY = (pointer.clientY - canvasRect.top) / Math.max(1, canvasRect.height) * currentProject().canvas.height;
      const angle = -transform.rotation * Math.PI / 180;
      const dx = projectX - transform.x;
      const dy = projectY - transform.y;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      const x = localX / transform.width + .5;
      const y = localY / transform.height + .5;
      if (x < 0 || x > 1 || y < 0 || y > 1) return undefined;
      return { x, y };
    };
    const appendPoint = (pointer: PointerEvent): void => {
      positionMaskCursor(pointer);
      const point = pointFromEvent(pointer);
      if (!point) return;
      const previous = points[points.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > .002) points.push(point);
    };
    appendPoint(event);
    const move = (moveEvent: PointerEvent): void => appendPoint(moveEvent);
    const end = (): void => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      if (!points.length) return;
      const size = Math.max(.001, maskBrushSize / Math.max(1, Math.min(transform.width, transform.height)));
      if (mask.type === 'paintLayer') {
        const stroke: PaintLayerStroke = {
          id: createId('stroke'),
          mode: maskBrushMode === 'erase' ? 'erase' : 'paint',
          size,
          softness: maskBrushSoftness,
          opacity: maskBrushOpacity,
          color: paintBrushColor,
          points
        };
        commit(updateLayer(currentProject(), layer.id, (draft) => {
          draft.effects.find((effect) => effect.id === mask.id)?.paintLayer?.strokes.push(stroke);
        }));
      } else {
        const stroke: PaintMaskStroke = {
          id: createId('stroke'),
          mode: maskBrushMode === 'reveal' ? 'reveal' : 'hide',
          size,
          softness: maskBrushSoftness,
          opacity: maskBrushOpacity,
          points
        };
        commit(updateLayer(currentProject(), layer.id, (draft) => {
          draft.effects.find((effect) => effect.id === mask.id)?.paintMask?.strokes.push(stroke);
        }));
      }
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (activeTool !== 'path' || event.button !== 0 || spacePressed) return;
    const layer = selectedLayer();
    if (layer?.type !== 'path') return showToast('Select a path layer before adding points.', true);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (layer.points.length >= 32) return showToast('Paths support up to 32 points.', true);
    const canvasRect = canvas.getBoundingClientRect();
    const authored = authoredTransform(layer);
    const animation = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
    const transform = {
      x: animation.get(`layer.${layer.id}.transform.x`) ?? authored.x,
      y: animation.get(`layer.${layer.id}.transform.y`) ?? authored.y,
      width: Math.max(1, animation.get(`layer.${layer.id}.transform.width`) ?? authored.width),
      height: Math.max(1, animation.get(`layer.${layer.id}.transform.height`) ?? authored.height),
      rotation: animation.get(`layer.${layer.id}.transform.rotation`) ?? authored.rotation
    };
    const projectX = (event.clientX - canvasRect.left) / Math.max(1, canvasRect.width) * currentProject().canvas.width;
    const projectY = (event.clientY - canvasRect.top) / Math.max(1, canvasRect.height) * currentProject().canvas.height;
    const angle = -transform.rotation * Math.PI / 180;
    const dx = projectX - transform.x;
    const dy = projectY - transform.y;
    const x = (dx * Math.cos(angle) - dy * Math.sin(angle)) / transform.width + .5;
    const y = (dx * Math.sin(angle) + dy * Math.cos(angle)) / transform.height + .5;
    if (x < 0 || x > 1 || y < 0 || y > 1) return showToast('Click inside the path layer bounds to add a point.', true);
    commit(updateLayer(currentProject(), layer.id, (draft) => {
      if (draft.type === 'path') draft.points.push({ x, y });
    }));
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (activeTool !== 'move' || !autoSelectEnabled || event.button !== 0 || spacePressed) return;
    const rect = canvas.getBoundingClientRect();
    const project = currentProject();
    const animation = evaluateVisibleTimeline(project.timeline, timelineTime);
    const selectable = flattenLayers(project.layers).filter((layer) => layer.type !== 'group' && layer.visible && layer.opacity > 0);
    const hitAt = (point: { x: number; y: number }): HorizonLayer | undefined => selectable.find((layer) => {
      if (layer.type === 'group' || !layer.visible || layer.opacity <= 0) return false;
      const transform = evaluatedLayerTransform(layer, animation);
      const angle = -transform.rotation * Math.PI / 180;
      const dx = point.x - transform.x;
      const dy = point.y - transform.y;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      const inside = Math.abs(localX) <= transform.width / 2 && Math.abs(localY) <= transform.height / 2;
      if (!inside) return false;
      if (layer.type === 'shape' && layer.shape === 'frame') {
        const edge = Math.min(transform.width / 2 - Math.abs(localX), transform.height / 2 - Math.abs(localY));
        return edge <= Math.max(16, layer.strokeWidth * 2);
      }
      return true;
    });
    const behavior: 'replace' | 'add' | 'subtract' | 'toggle' = event.altKey ? 'subtract' : event.shiftKey ? 'add' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
    const applySelection = (layers: readonly HorizonLayer[]): void => {
      const next = behavior === 'replace' ? new Set<string>() : new Set(selectedLayerIds);
      for (const layer of layers) {
        if (behavior === 'subtract') next.delete(layer.id);
        else if (behavior === 'toggle') {
          if (next.has(layer.id)) next.delete(layer.id); else next.add(layer.id);
        } else next.add(layer.id);
      }
      selectedLayerIds = next;
      const preferred = behavior !== 'subtract' ? layers[0]?.id : undefined;
      selectedLayerId = preferred && next.has(preferred) ? preferred : next.has(selectedLayerId) ? selectedLayerId : Array.from(next).at(-1) ?? '';
    };
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic smoke events do not own a native pointer. */ }
    const start = {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    };
    let endPoint = { ...start };
    let moved = false;
    let liveHits: HorizonLayer[] = [];
    const marquee = element<HTMLDivElement>('#canvasMarquee');
    marquee.classList.remove('add', 'subtract', 'toggle');
    if (behavior !== 'replace') marquee.classList.add(behavior);
    const move = (moveEvent: PointerEvent): void => {
      endPoint = {
        x: Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, moveEvent.clientY - rect.top))
      };
      moved ||= Math.hypot(endPoint.x - start.x, endPoint.y - start.y) >= 4;
      if (!moved) return;
      const left = Math.min(start.x, endPoint.x);
      const right = Math.max(start.x, endPoint.x);
      const top = Math.min(start.y, endPoint.y);
      const bottom = Math.max(start.y, endPoint.y);
      marquee.hidden = false;
      marquee.style.left = `${canvas.offsetLeft + left}px`;
      marquee.style.top = `${canvas.offsetTop + top}px`;
      marquee.style.width = `${right - left}px`;
      marquee.style.height = `${bottom - top}px`;
      const selectionBounds = {
        left: left / Math.max(1, rect.width) * project.canvas.width,
        right: right / Math.max(1, rect.width) * project.canvas.width,
        top: top / Math.max(1, rect.height) * project.canvas.height,
        bottom: bottom / Math.max(1, rect.height) * project.canvas.height
      };
      liveHits = selectable.filter((layer) => {
        const bounds = transformBounds(evaluatedLayerTransform(layer, animation));
        return marqueeSelectionMode === 'contain'
          ? bounds.left >= selectionBounds.left && bounds.right <= selectionBounds.right && bounds.top >= selectionBounds.top && bounds.bottom <= selectionBounds.bottom
          : bounds.right >= selectionBounds.left && bounds.left <= selectionBounds.right && bounds.bottom >= selectionBounds.top && bounds.top <= selectionBounds.bottom;
      });
      element<HTMLElement>('#canvasMarqueeLabel').textContent = `${behavior.toUpperCase()} · ${liveHits.length} LAYER${liveHits.length === 1 ? '' : 'S'}`;
    };
    const end = (): void => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      marquee.hidden = true;
      if (moved) {
        applySelection(liveHits);
        renderEditor();
        showToast(`${marqueeSelectionMode === 'contain' ? 'Enclosed' : 'Touched'} ${liveHits.length} layer${liveHits.length === 1 ? '' : 's'} · ${behavior}.`);
        return;
      }
      const point = {
        x: start.x / Math.max(1, rect.width) * project.canvas.width,
        y: start.y / Math.max(1, rect.height) * project.canvas.height
      };
      const hit = hitAt(point);
      applySelection(hit ? [hit] : []);
      renderEditor();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-scroll-target]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('[data-scroll-target]').forEach((item) => item.classList.toggle('active', item === button));
    const target = document.getElementById(button.dataset.scrollTarget || '');
    const inspector = button.closest<HTMLElement>('.inspector-panel');
    if (target && inspector) {
      const tabsHeight = button.parentElement?.getBoundingClientRect().height ?? 0;
      const top = target.getBoundingClientRect().top - inspector.getBoundingClientRect().top + inspector.scrollTop - tabsHeight;
      inspector.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }));
  element<HTMLElement>('#projectName').addEventListener('blur', (event) => {
    const requested = (event.currentTarget as HTMLElement).textContent?.trim().slice(0, 80);
    if (!requested || requested === currentProject().name) return renderEditor();
    commit(mutateProject(currentProject(), (draft) => { draft.name = requested; }));
  });
  const newProjectDialog = element<HTMLDialogElement>('#newProjectDialog');
  element<HTMLButtonElement>('#newProjectButton').addEventListener('click', () => {
    element<HTMLInputElement>('#newProjectNameInput').value = '';
    newProjectDialog.showModal();
  });
  element<HTMLButtonElement>('#closeNewProjectButton').addEventListener('click', () => newProjectDialog.close());
  element<HTMLButtonElement>('#cancelNewProjectButton').addEventListener('click', () => newProjectDialog.close());
  document.querySelectorAll<HTMLButtonElement>('[data-project-template]').forEach((button) => button.addEventListener('click', () => {
    if (dirty && !window.confirm('Discard the current unsaved changes and create a new project?')) return;
    const kind = button.dataset.projectTemplate as ProjectTemplateKind;
    const project = createProjectTemplate(kind, element<HTMLInputElement>('#newProjectNameInput').value);
    activeDockTab = 'layers';
    replaceProject(project);
    if (kind === 'open-broadcast-kit') {
      timelinePlaying = true;
      renderTimeline();
    }
    newProjectDialog.close();
    showToast(kind === 'blank' ? 'Blank canvas created. Import a picture to begin.' : `${project.name} starter created. Every element is editable.`);
  }));
  element<HTMLButtonElement>('#openProjectButton').addEventListener('click', async () => {
    if (dirty && !window.confirm('Discard the current unsaved changes and open another project?')) return;
    try {
      const result = await window.horizonDesktop.openProject();
      if (!result) return;
      const validation = validateProject(result.project);
      if (!validation.ok) throw new Error(validation.errors.join(' '));
      replaceProject(result.project as HorizonProject, result.filePath);
      showToast('Project opened.');
    } catch (error) {
      showToast(`Open failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  });
  const save = async (saveAs: boolean): Promise<void> => {
    try {
      const result = await window.horizonDesktop.saveProject(currentProject(), saveAs);
      if (!result) return;
      savedPath = result.filePath;
      dirty = false;
      renderEditor();
      showToast(`Saved ${result.filePath.split(/[\\/]/).pop()}.`);
    } catch (error) {
      showToast(`Save failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };
  element<HTMLButtonElement>('#saveProjectButton').addEventListener('click', () => void save(false));
  element<HTMLButtonElement>('#saveAsProjectButton').addEventListener('click', () => void save(true));
  const publishDialog = element<HTMLDialogElement>('#publishDialog');
  const publishTarget = element<HTMLSelectElement>('#publishTargetInput');
  const publishKind = element<HTMLSelectElement>('#publishKindInput');
  const publishTransparent = element<HTMLInputElement>('#publishTransparentInput');
  const publishPaletteSection = element<HTMLElement>('#publishPaletteSection');
  const publishVaultSection = element<HTMLElement>('#publishVaultSection');
  const publishVaultButton = element<HTMLButtonElement>('#publishVaultButton');
  const publishPaletteList = element<HTMLDivElement>('#publishPaletteList');
  const publishPaletteTemplate = element<HTMLTemplateElement>('#publishPaletteTemplate');
  const paletteDefaults: HorizonPalette['colors'] = ['#091125', '#20466E', '#63558E', '#6BA8B5'];
  const appendPublishPalette = (palette?: HorizonPalette): void => {
    if (publishPaletteList.querySelectorAll('.publish-palette-row').length >= 32) throw new Error('A Quartic Pulse package may contain at most 32 palettes.');
    publishPaletteList.querySelector('.publish-palette-empty')?.remove();
    const fragment = publishPaletteTemplate.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>('.publish-palette-row');
    if (!row) throw new Error('The palette editor template is unavailable.');
    const number = publishPaletteList.querySelectorAll('.publish-palette-row').length + 1;
    const name = row.querySelector<HTMLInputElement>('[data-publish-palette-name]');
    const id = row.querySelector<HTMLInputElement>('[data-publish-palette-id]');
    const favorite = row.querySelector<HTMLInputElement>('[data-publish-palette-favorite]');
    if (!name || !id || !favorite) throw new Error('The palette editor controls are incomplete.');
    name.value = palette?.name ?? `Palette ${number}`;
    id.value = palette?.id ?? `palette-${number}`;
    favorite.checked = Boolean(palette?.favorite);
    row.querySelectorAll<HTMLInputElement>('[data-publish-palette-color]').forEach((input, index) => { input.value = palette?.colors[index] ?? paletteDefaults[index]; });
    row.querySelector<HTMLButtonElement>('[data-remove-publish-palette]')?.addEventListener('click', () => {
      row.remove();
      if (!publishPaletteList.querySelector('.publish-palette-row')) renderPublishPalettes([]);
    });
    publishPaletteList.appendChild(fragment);
  };
  const renderPublishPalettes = (palettes: HorizonPalette[] = currentProject().palettes ?? []): void => {
    publishPaletteList.replaceChildren();
    if (!palettes.length) {
      const empty = document.createElement('div');
      empty.className = 'publish-palette-empty';
      empty.textContent = 'No palettes bundled. Add one to share a color system with this visualizer.';
      publishPaletteList.appendChild(empty);
      return;
    }
    palettes.forEach((palette) => appendPublishPalette(palette));
  };
  const collectPublishPalettes = (): HorizonPalette[] => {
    const palettes = Array.from(publishPaletteList.querySelectorAll<HTMLElement>('.publish-palette-row')).map((row, index) => {
      const id = row.querySelector<HTMLInputElement>('[data-publish-palette-id]')?.value.trim().toLowerCase() ?? '';
      const name = row.querySelector<HTMLInputElement>('[data-publish-palette-name]')?.value.trim() ?? '';
      const colors = Array.from(row.querySelectorAll<HTMLInputElement>('[data-publish-palette-color]')).map((input) => input.value.toUpperCase());
      if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(id)) throw new Error(`Palette ${index + 1} needs a stable ID using 2–80 lowercase letters, numbers, dots, underscores, or hyphens.`);
      if (!name || name.length > 80) throw new Error(`Palette ${index + 1} needs a name of 80 characters or fewer.`);
      if (colors.length !== 4 || colors.some((color) => !/^#[0-9A-F]{6}$/.test(color))) throw new Error(`Palette ${name} needs four valid colors.`);
      return { id, name, colors: colors as HorizonPalette['colors'], favorite: Boolean(row.querySelector<HTMLInputElement>('[data-publish-palette-favorite]')?.checked) };
    });
    const ids = new Set<string>();
    for (const palette of palettes) {
      if (ids.has(palette.id)) throw new Error(`Palette IDs must be unique. “${palette.id}” is used more than once.`);
      ids.add(palette.id);
    }
    return palettes;
  };
  const updatePublishFields = (): void => {
    const tempest = publishTarget.value === 'tempest-broadcast';
    publishKind.disabled = !tempest;
    publishTransparent.disabled = !tempest;
    publishPaletteSection.hidden = tempest;
    publishVaultSection.hidden = !tempest;
    if (!tempest) publishTransparent.checked = false;
  };
  element<HTMLButtonElement>('#publishProjectButton').addEventListener('click', () => {
    element<HTMLInputElement>('#publishNameInput').value = currentProject().name;
    renderPublishPalettes();
    updatePublishFields();
    publishDialog.showModal();
  });
  element<HTMLButtonElement>('#cancelPublishButton').addEventListener('click', () => publishDialog.close());
  element<HTMLButtonElement>('#cancelPublishFooterButton').addEventListener('click', () => publishDialog.close());
  element<HTMLButtonElement>('#addPublishPaletteButton').addEventListener('click', () => {
    try { appendPublishPalette(); }
    catch (error) { showToast(error instanceof Error ? error.message : String(error), true); }
  });
  publishTarget.addEventListener('change', updatePublishFields);
  element<HTMLButtonElement>('#refreshVaultButton').addEventListener('click', () => void refreshVaultLibrary(true));
  element<HTMLButtonElement>('#publishToVaultButton').addEventListener('click', () => {
    element<HTMLInputElement>('#publishNameInput').value = currentProject().name;
    publishTarget.value = 'tempest-broadcast';
    renderPublishPalettes();
    updatePublishFields();
    publishDialog.showModal();
  });
  publishVaultButton.addEventListener('click', async () => {
    publishVaultButton.disabled = true;
    publishVaultButton.textContent = 'Installing…';
    try {
      const result = await window.horizonDesktop.publishVault({
        project: currentProject(),
        options: {
          target: 'tempest-broadcast',
          name: element<HTMLInputElement>('#publishNameInput').value.trim(),
          tempestKind: publishKind.value,
          transparent: publishTransparent.checked
        },
        previewPng: canvas.toDataURL('image/png')
      });
      await refreshVaultLibrary(true);
      publishDialog.close();
      showToast(`${result.updated ? 'Updated' : 'Installed'} ${result.sourceName} in the Tempest Asset Vault.`);
    } catch (error) {
      showToast(`Asset Vault install failed: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      publishVaultButton.disabled = false;
      publishVaultButton.textContent = 'Install in Asset Vault';
    }
  });
  element<HTMLFormElement>('#publishForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const target = publishTarget.value as 'quartic-pulse' | 'tempest-broadcast';
      if (target === 'quartic-pulse') {
        const palettes = collectPublishPalettes();
        if (JSON.stringify(palettes) !== JSON.stringify(currentProject().palettes ?? [])) {
          commit(mutateProject(currentProject(), (draft) => { draft.palettes = palettes; }));
        }
      }
      const result = await window.horizonDesktop.publishBundle({
        project: currentProject(),
        options: {
          target,
          name: element<HTMLInputElement>('#publishNameInput').value.trim(),
          tempestKind: target === 'tempest-broadcast' ? publishKind.value : undefined,
          transparent: publishTransparent.checked
        },
        previewPng: canvas.toDataURL('image/png')
      });
      if (!result) return;
      publishDialog.close();
      const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
      showToast(`Bundle exported to ${result.bundlePath}.${warning}`);
    } catch (error) {
      showToast(`Export failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  });
  element<HTMLButtonElement>('#runtimeButton').addEventListener('click', () => void window.horizonDesktop.openRuntime());
  element<HTMLButtonElement>('#importCompositionButton').addEventListener('click', () => void importCompositionProject());
  element<HTMLButtonElement>('#undoButton').addEventListener('click', () => {
    history.undo();
    ensureSelection();
    dirty = true;
    persistAutosave();
    setRuntimeProject();
    renderEditor();
  });
  element<HTMLButtonElement>('#redoButton').addEventListener('click', () => {
    history.redo();
    ensureSelection();
    dirty = true;
    persistAutosave();
    setRuntimeProject();
    renderEditor();
  });
  const importImage = async (): Promise<void> => {
    try {
      const imported = await window.horizonDesktop.openImage();
      if (!imported) return;
      const assetId = createId('asset');
      const layer = createImageLayer(assetId, imported.name.replace(/\.[^.]+$/, ''));
      const hasImage = flattenLayers(currentProject().layers).some((item) => item.type === 'image');
      layer.fit = hasImage ? 'contain' : 'cover';
      layer.transform = hasImage
        ? { x: currentProject().canvas.width / 2, y: currentProject().canvas.height / 2, width: currentProject().canvas.width * .5, height: currentProject().canvas.height * .5, rotation: 0 }
        : { x: currentProject().canvas.width / 2, y: currentProject().canvas.height / 2, width: currentProject().canvas.width, height: currentProject().canvas.height, rotation: 0 };
      const next = mutateProject(currentProject(), (draft) => {
        draft.assets.push({ id: assetId, name: imported.name, kind: 'image', uri: imported.uri, mimeType: imported.mimeType });
        draft.layers.unshift(layer);
      });
      commit(next, layer.id);
      showToast(`Imported ${imported.name} without modifying the original.`);
    } catch (error) {
      showToast(`Import failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };
  element<HTMLButtonElement>('#importImageButton').addEventListener('click', () => void importImage());
  element<HTMLButtonElement>('#assetsImportButton').addEventListener('click', () => void importImage());
  const addAuthoredLayer = (layer: HorizonLayer, message: string): void => {
    commit(addLayer(currentProject(), layer), layer.id);
    showToast(message);
  };
  element<HTMLButtonElement>('#addTextButton').addEventListener('click', () => addAuthoredLayer(createTextLayer(), 'Editable text layer added.'));
  element<HTMLButtonElement>('#addHudTextButton').addEventListener('click', () => addAuthoredLayer(createHudTextLayer('signal-title'), 'Styled HUD title added.'));
  element<HTMLButtonElement>('#addShapeButton').addEventListener('click', () => addAuthoredLayer(createShapeLayer('rectangle'), 'Shape layer added.'));
  element<HTMLButtonElement>('#addFrameButton').addEventListener('click', () => addAuthoredLayer(createShapeLayer('frame', 'Window Border'), 'Full-canvas stream frame added.'));
  element<HTMLButtonElement>('#addSpectrumButton').addEventListener('click', () => addAuthoredLayer(createSpectrumLayer(), 'Audio-reactive spectrum added.'));
  element<HTMLButtonElement>('#addWaveformButton').addEventListener('click', () => addAuthoredLayer(createWaveformLayer(), 'Audio-reactive waveform added.'));
  element<HTMLButtonElement>('#addParticlesButton').addEventListener('click', () => addAuthoredLayer(createParticleLayer(), 'Audio-reactive particle atmosphere added.'));
  element<HTMLButtonElement>('#addPathButton').addEventListener('click', () => {
    const path = createPathLayer();
    activeTool = 'path';
    addAuthoredLayer(path, 'Animated data path added. Drag points or click the canvas to extend it.');
  });
  element<HTMLButtonElement>('#deletePathPointButton').addEventListener('click', () => {
    const layer = selectedLayer();
    if (layer?.type !== 'path' || layer.points.length <= 2) return showToast('A path needs at least two points.', true);
    commit(updateLayer(currentProject(), layer.id, (draft) => { if (draft.type === 'path') draft.points.pop(); }));
  });
  element<HTMLButtonElement>('#finishPathButton').addEventListener('click', () => setActiveTool('move'));
  const templateDialog = element<HTMLDialogElement>('#templateDialog');
  element<HTMLButtonElement>('#openTemplatesButton').addEventListener('click', () => templateDialog.showModal());
  element<HTMLButtonElement>('#closeTemplatesButton').addEventListener('click', () => templateDialog.close());
  document.querySelectorAll<HTMLButtonElement>('[data-insert-template]').forEach((button) => button.addEventListener('click', () => {
    const kind = button.dataset.insertTemplate as 'lower-third' | 'alert' | 'transition';
    const template = createBroadcastTemplate(kind);
    addAuthoredLayer(template, `${template.name} template inserted.`);
    templateDialog.close();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-layer-tab]').forEach((button) => button.addEventListener('click', () => {
    activeDockTab = button.dataset.layerTab as DockTab;
    renderDockBrowser();
  }));
  const presetDialog = element<HTMLDialogElement>('#presetDialog');
  const openPresetDialog = (): void => {
    const layer = selectedLayer();
    if (!layer) return showToast('Select a layer or group to save as a preset.', true);
    element<HTMLInputElement>('#presetNameInput').value = layer.name;
    element<HTMLTextAreaElement>('#presetDescriptionInput').value = '';
    const ownedLayers = flattenLayers([layer]);
    const audioCount = currentProject().bindings.filter((binding) => ownedLayers.some((item) => binding.target.startsWith(`layer.${item.id}.`))).length;
    const trackCount = currentProject().timeline.tracks.filter((track) => ownedLayers.some((item) => track.target.startsWith(`layer.${item.id}.`))).length;
    element<HTMLElement>('#presetSelectionSummary').textContent = `${layer.name} · ${ownedLayers.length} layer${ownedLayers.length === 1 ? '' : 's'} · ${audioCount} audio assignment${audioCount === 1 ? '' : 's'} · ${trackCount} animation track${trackCount === 1 ? '' : 's'}`;
    presetDialog.showModal();
    requestAnimationFrame(() => element<HTMLInputElement>('#presetNameInput').select());
  };
  element<HTMLButtonElement>('#saveSelectionPresetButton').addEventListener('click', openPresetDialog);
  element<HTMLButtonElement>('#importPresetButton').addEventListener('click', () => void importLayerPreset());
  element<HTMLButtonElement>('#cancelPresetButton').addEventListener('click', () => presetDialog.close());
  element<HTMLButtonElement>('#cancelPresetFooterButton').addEventListener('click', () => presetDialog.close());
  element<HTMLFormElement>('#presetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const layer = selectedLayer();
    if (!layer) return showToast('The selected layer is no longer available.', true);
    const preset = createLayerPreset(currentProject(), layer.id, element<HTMLInputElement>('#presetNameInput').value, element<HTMLTextAreaElement>('#presetDescriptionInput').value);
    if (!preset) return showToast('Preset could not be created.', true);
    activeDockTab = 'presets';
    commit(upsertLayerPreset(currentProject(), preset));
    presetDialog.close();
    showToast(`${preset.name} saved to this project's preset library.`);
  });
  element<HTMLButtonElement>('#nodeAddButton').addEventListener('click', () => {
    const layer = selectedLayer();
    if (!layer) return showToast('Select a layer before adding a processing node.', true);
    const requested = element<HTMLSelectElement>('#nodeAddInput').value;
    const effect = requested.startsWith('region:')
      ? createRegionMask(requested.slice(7) as 'sky' | 'horizon' | 'terrain' | 'foreground')
      : requested === 'paintMask' ? createPaintMask() : requested === 'paintLayer' ? createPaintLayer() : createEffect(requested as EffectType);
    activeEffectId = effect.id;
    if (effect.type === 'paintMask' || effect.type === 'paintLayer') activePaintMaskId = effect.id;
    commit(updateLayer(currentProject(), layer.id, (draft) => { draft.effects.push(effect); }));
    showToast(`${effect.name} node added.`);
  });
  element<HTMLButtonElement>('#removeUnusedAssetsButton').addEventListener('click', () => {
    const used = new Set(flattenLayers(currentProject().layers).filter((layer) => layer.type === 'image').map((layer) => layer.type === 'image' ? layer.assetId : ''));
    const removable = currentProject().assets.filter((asset) => !used.has(asset.id));
    if (!removable.length) return showToast('Every registered asset is currently used.');
    commit(mutateProject(currentProject(), (draft) => { draft.assets = draft.assets.filter((asset) => used.has(asset.id)); }));
    showToast(`Removed ${removable.length} unused asset${removable.length === 1 ? '' : 's'}.`);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-mask-dock-preset]').forEach((button) => button.addEventListener('click', () => {
    const preset = button.dataset.maskDockPreset as 'sky' | 'horizon' | 'terrain' | 'foreground';
    if (!selectedLayerId) return showToast('Select a layer before adding a mask.', true);
    commit(updateLayer(currentProject(), selectedLayerId, (layer) => { layer.effects.push(createRegionMask(preset)); }));
    showToast(`${button.textContent?.replace('+', '').trim()} mask added.`);
  }));
  element<HTMLButtonElement>('#addPaintMaskDockButton').addEventListener('click', activatePaintMask);
  element<HTMLInputElement>('#autoSelectInput').addEventListener('change', (event) => {
    autoSelectEnabled = (event.currentTarget as HTMLInputElement).checked;
    showToast(`Canvas auto-select ${autoSelectEnabled ? 'enabled' : 'disabled'}.`);
  });
  element<HTMLSelectElement>('#marqueeModeInput').addEventListener('change', (event) => {
    marqueeSelectionMode = (event.currentTarget as HTMLSelectElement).value as 'intersect' | 'contain';
    showToast(`Marquee selects layers ${marqueeSelectionMode === 'contain' ? 'fully enclosed by' : 'touching'} the region.`);
  });
  element<HTMLInputElement>('#showTransformInput').addEventListener('change', (event) => {
    showTransformControls = (event.currentTarget as HTMLInputElement).checked;
    positionCanvasSelection();
  });
  element<HTMLButtonElement>('#moveToolButton').addEventListener('click', () => {
    setActiveTool('move');
    showTransformControls = true;
    element<HTMLInputElement>('#showTransformInput').checked = true;
    positionCanvasSelection();
  });
  element<HTMLButtonElement>('#maskBrushToolButton').addEventListener('click', activatePaintMask);
  element<HTMLSelectElement>('#maskBrushModeInput').addEventListener('change', (event) => {
    setBrushMode((event.currentTarget as HTMLSelectElement).value as BrushMode);
  });
  element<HTMLButtonElement>('#brushPrimaryModeButton').addEventListener('click', () => setBrushMode(brushModePair().primary));
  element<HTMLButtonElement>('#brushSecondaryModeButton').addEventListener('click', () => setBrushMode(brushModePair().secondary));
  element<HTMLButtonElement>('#transparentColorButton').addEventListener('click', () => {
    const pair = brushModePair();
    setBrushMode(maskBrushMode === pair.secondary ? pair.primary : pair.secondary);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-brush-preset]').forEach((button) => button.addEventListener('click', () => applyBrushPreset(button.dataset.brushPreset as BrushPresetId)));
  const bindBrushProperty = (selectors: string[], property: 'size' | 'softness' | 'opacity'): void => {
    for (const selector of selectors) element<HTMLInputElement>(selector).addEventListener('input', (event) => {
      const value = Number((event.currentTarget as HTMLInputElement).value);
      activeBrushPreset = 'custom';
      if (property === 'size') maskBrushSize = value;
      else if (property === 'softness') maskBrushSoftness = value;
      else maskBrushOpacity = value;
      syncBrushControls();
    });
  };
  bindBrushProperty(['#maskBrushSizeInput', '#contextBrushSizeInput'], 'size');
  bindBrushProperty(['#maskBrushSoftnessInput', '#contextBrushSoftnessInput'], 'softness');
  bindBrushProperty(['#maskBrushOpacityInput', '#contextBrushOpacityInput'], 'opacity');
  element<HTMLInputElement>('#contextBrushColorInput').addEventListener('input', (event) => {
    paintBrushColor = (event.currentTarget as HTMLInputElement).value.toUpperCase();
    element<HTMLInputElement>('#foregroundColorInput').value = paintBrushColor;
    renderInspector();
  });
  element<HTMLButtonElement>('#brushUndoStrokeButton').addEventListener('click', () => changeActiveBrushStrokes(false));
  element<HTMLButtonElement>('#brushClearStrokesButton').addEventListener('click', () => changeActiveBrushStrokes(true));
  element<HTMLButtonElement>('#finishBrushButton').addEventListener('click', () => {
    setActiveTool('move');
    showToast('Brush editing finished. The retouch pass remains editable.');
  });
  const applyForegroundColor = (value: string): void => {
    if (activeTool === 'mask' && activePaintMask()?.type === 'paintLayer') {
      paintBrushColor = value.toUpperCase();
      syncBrushControls();
      renderInspector();
      return;
    }
    if (!selectedLayerId) return showToast('Select a color-capable layer first.', true);
    let supported = true;
    const next = updateLayer(currentProject(), selectedLayerId, (layer) => {
      const color = value.toUpperCase();
      if (layer.type === 'text' || layer.type === 'waveform' || layer.type === 'path') layer.color = color;
      else if (layer.type === 'shape') layer.stroke = color;
      else if (layer.type === 'spectrum' || layer.type === 'particles') layer.colorHigh = color;
      else supported = false;
    });
    if (!supported) return showToast('That layer has no foreground color property.', true);
    commit(next);
  };
  element<HTMLInputElement>('#foregroundColorInput').addEventListener('change', (event) => applyForegroundColor((event.currentTarget as HTMLInputElement).value));
  element<HTMLInputElement>('#backgroundColorInput').addEventListener('change', (event) => {
    const hex = (event.currentTarget as HTMLInputElement).value.slice(1);
    const value = Number.parseInt(hex, 16);
    commit(mutateProject(currentProject(), (draft) => {
      draft.canvas.background = [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, draft.canvas.background[3]];
    }));
  });
  element<HTMLButtonElement>('#swapColorsButton').addEventListener('click', () => {
    const foreground = element<HTMLInputElement>('#foregroundColorInput');
    const background = element<HTMLInputElement>('#backgroundColorInput');
    const nextForeground = background.value;
    const nextBackground = foreground.value;
    foreground.value = nextForeground;
    background.value = nextBackground;
    applyForegroundColor(nextForeground);
    const hex = nextBackground.slice(1);
    const value = Number.parseInt(hex, 16);
    commit(mutateProject(currentProject(), (draft) => { draft.canvas.background = [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, draft.canvas.background[3]]; }));
  });
  element<HTMLButtonElement>('#cutLayersButton').addEventListener('click', () => copyLayerSelection(true));
  element<HTMLButtonElement>('#copyLayersButton').addEventListener('click', () => copyLayerSelection());
  element<HTMLButtonElement>('#pasteLayersButton').addEventListener('click', () => pasteLayerClipboard());
  element<HTMLButtonElement>('#pasteLayersInPlaceButton').addEventListener('click', () => pasteLayerClipboard(true));
  element<HTMLInputElement>('#layerSearchInput').addEventListener('input', (event) => {
    layerSearchQuery = (event.currentTarget as HTMLInputElement).value;
    renderEditor();
    element<HTMLDivElement>('#layerTree').scrollTop = 0;
  });
  element<HTMLButtonElement>('#clearLayerSearchButton').addEventListener('click', () => {
    layerSearchQuery = '';
    element<HTMLInputElement>('#layerSearchInput').value = '';
    renderEditor();
    element<HTMLInputElement>('#layerSearchInput').focus();
  });
  element<HTMLSelectElement>('#layerFilterInput').addEventListener('change', (event) => {
    layerTreeFilter = (event.currentTarget as HTMLSelectElement).value as LayerTreeFilter;
    renderEditor();
    element<HTMLDivElement>('#layerTree').scrollTop = 0;
  });
  element<HTMLButtonElement>('#collapseLayerGroupsButton').addEventListener('click', () => {
    storeCollapsedLayerGroups(new Set(flattenLayers(currentProject().layers).filter((layer) => layer.type === 'group').map((layer) => layer.id)));
    renderEditor();
    showToast('All layer groups collapsed.');
  });
  element<HTMLButtonElement>('#expandLayerGroupsButton').addEventListener('click', () => {
    storeCollapsedLayerGroups(new Set());
    renderEditor();
    showToast('All layer groups expanded.');
  });
  element<HTMLButtonElement>('#revealSelectedLayerButton').addEventListener('click', revealSelectedLayerInTree);
  element<HTMLSelectElement>('#layerSelectionSetInput').addEventListener('change', (event) => {
    selectedLayerSelectionSetId = (event.currentTarget as HTMLSelectElement).value;
    renderLayerSelectionSetControls();
  });
  element<HTMLButtonElement>('#saveLayerSelectionSetButton').addEventListener('click', saveCurrentLayerSelectionSet);
  element<HTMLButtonElement>('#recallLayerSelectionSetButton').addEventListener('click', recallLayerSelectionSet);
  element<HTMLButtonElement>('#deleteLayerSelectionSetButton').addEventListener('click', () => {
    const set = currentProject().layerSelectionSets.find((item) => item.id === selectedLayerSelectionSetId);
    if (!set) return showToast('Choose a saved layer selection first.', true);
    selectedLayerSelectionSetId = '';
    commit(removeLayerSelectionSet(currentProject(), set.id));
    showToast(`Deleted layer selection “${set.name}”.`);
  });
  element<HTMLButtonElement>('#soloLayersButton').addEventListener('click', toggleSoloLayers);
  element<HTMLButtonElement>('#duplicateLayerButton').addEventListener('click', () => {
    const requested = selectedLayers();
    if (!requested.length) return;
    let next = currentProject();
    const duplicatedIds: string[] = [];
    for (const layer of requested) {
      const result = duplicateLayer(next, layer.id);
      next = result.project;
      if (result.selectedId) duplicatedIds.push(result.selectedId);
    }
    if (duplicatedIds.length) commit(next, duplicatedIds.at(-1), duplicatedIds);
  });
  element<HTMLButtonElement>('#groupLayerButton').addEventListener('click', () => {
    if (!selectedLayerId) return;
    const result = wrapLayerInGroup(currentProject(), selectedLayerId);
    if (result.selectedId) commit(result.project, result.selectedId);
  });
  element<HTMLButtonElement>('#deleteLayerButton').addEventListener('click', () => {
    const removable = selectedLayers().filter((layer) => !layer.locked);
    if (!removable.length) return showToast('Unlock the selected layer before deleting it.', true);
    let next = currentProject();
    for (const layer of removable) next = removeLayer(next, layer.id);
    const remainingSelected = Array.from(selectedLayerIds).filter((id) => !removable.some((layer) => layer.id === id) && Boolean(findLayer(next, id)));
    const nextPrimary = remainingSelected.at(-1) ?? flattenLayers(next.layers)[0]?.id ?? '';
    commit(next, nextPrimary, remainingSelected.length ? remainingSelected : nextPrimary ? [nextPrimary] : []);
    showToast(`Deleted ${removable.length} unlocked layer${removable.length === 1 ? '' : 's'}.`);
  });
  element<HTMLButtonElement>('#moveLayerUpButton').addEventListener('click', () => selectedLayerId && commit(moveLayer(currentProject(), selectedLayerId, -1)));
  element<HTMLButtonElement>('#moveLayerDownButton').addEventListener('click', () => selectedLayerId && commit(moveLayer(currentProject(), selectedLayerId, 1)));
  element<HTMLButtonElement>('#lockLayersButton').addEventListener('click', () => {
    const layers = selectedLayers();
    if (!layers.length) return;
    const locked = !layers.every((layer) => layer.locked);
    const next = mutateProject(currentProject(), (draft) => {
      for (const layer of layers) {
        const target = findLayer(draft, layer.id);
        if (target) target.locked = locked;
      }
    });
    commit(next, selectedLayerId, Array.from(selectedLayerIds));
    showToast(`${locked ? 'Locked' : 'Unlocked'} ${layers.length} layer${layers.length === 1 ? '' : 's'}.`);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-align-layers]').forEach((button) => button.addEventListener('click', () => alignLayerSelection(button.dataset.alignLayers as LayerAlignment)));
  document.querySelectorAll<HTMLButtonElement>('[data-distribute-layers]').forEach((button) => button.addEventListener('click', () => distributeLayerSelection(button.dataset.distributeLayers === 'vertical' ? 'vertical' : 'horizontal')));

  const changeLayer = (update: (layer: HorizonLayer) => void): void => {
    if (selectedLayerId) commit(updateLayer(currentProject(), selectedLayerId, update));
  };
  element<HTMLInputElement>('#layerNameInput').addEventListener('change', (event) => changeLayer((layer) => { layer.name = (event.currentTarget as HTMLInputElement).value.trim() || layer.name; }));
  element<HTMLInputElement>('#layerVisibleInput').addEventListener('change', (event) => changeLayer((layer) => { layer.visible = (event.currentTarget as HTMLInputElement).checked; }));
  element<HTMLInputElement>('#layerLockedInput').addEventListener('change', (event) => changeLayer((layer) => { layer.locked = (event.currentTarget as HTMLInputElement).checked; }));
  element<HTMLInputElement>('#layerOpacityInput').addEventListener('input', (event) => { element<HTMLOutputElement>('#layerOpacityValue').textContent = `${Math.round(Number((event.currentTarget as HTMLInputElement).value) * 100)}%`; });
  element<HTMLInputElement>('#layerOpacityInput').addEventListener('change', (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (selectedLayerId && recordAutoKeyEdits([{ target: `layer.${selectedLayerId}.opacity`, value }])) return;
    changeLayer((layer) => { layer.opacity = value; });
  });
  element<HTMLSelectElement>('#layerBlendInput').addEventListener('change', (event) => changeLayer((layer) => { layer.blendMode = (event.currentTarget as HTMLSelectElement).value as BlendMode; }));
  element<HTMLInputElement>('#layerDepthInput').addEventListener('input', (event) => { element<HTMLOutputElement>('#layerDepthValue').textContent = Number((event.currentTarget as HTMLInputElement).value).toFixed(2); });
  element<HTMLInputElement>('#layerDepthInput').addEventListener('change', (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (selectedLayerId && recordAutoKeyEdits([{ target: `layer.${selectedLayerId}.depth`, value }])) return;
    changeLayer((layer) => { layer.depth = value; });
  });
  element<HTMLInputElement>('#layerParallaxInput').addEventListener('input', (event) => { element<HTMLOutputElement>('#layerParallaxValue').textContent = Number((event.currentTarget as HTMLInputElement).value).toFixed(2); });
  element<HTMLInputElement>('#layerParallaxInput').addEventListener('change', (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (selectedLayerId && recordAutoKeyEdits([{ target: `layer.${selectedLayerId}.parallax`, value }])) return;
    changeLayer((layer) => { layer.parallax = value; });
  });
  const transformFields: Array<[string, keyof LayerTransform]> = [
    ['#layerXInput', 'x'], ['#layerYInput', 'y'], ['#layerWidthInput', 'width'],
    ['#layerHeightInput', 'height'], ['#layerRotationInput', 'rotation']
  ];
  for (const [selector, key] of transformFields) {
    element<HTMLInputElement>(selector).addEventListener('change', (event) => {
      const requested = Number((event.currentTarget as HTMLInputElement).value);
      const value = key === 'width' || key === 'height' ? Math.max(1, requested) : requested;
      if (selectedLayerId && recordAutoKeyEdits([{ target: `layer.${selectedLayerId}.transform.${key}`, value }])) return;
      changeLayer((layer) => {
        const next = { ...authoredTransform(layer) };
        next[key] = value;
        layer.transform = next;
      });
    });
  }
  element<HTMLSelectElement>('#layerFitInput').addEventListener('change', (event) => changeLayer((layer) => {
    if (layer.type === 'image') layer.fit = (event.currentTarget as HTMLSelectElement).value as 'cover' | 'contain' | 'stretch';
  }));

  const selection = element<HTMLDivElement>('#canvasSelection');
  selection.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || spacePressed) return;
    const layer = selectedLayer();
    if (!layer) return;
    const movableLayers = independentSelectedLayers().filter((item) => item.visible && !item.locked);
    if (!movableLayers.length) return showToast('Unlock at least one selected layer before transforming.', true);
    event.preventDefault();
    try { selection.setPointerCapture(event.pointerId); } catch { /* Synthetic smoke events do not own a native pointer. */ }
    const animationStart = evaluateVisibleTimeline(currentProject().timeline, timelineTime);
    const starts = new Map(movableLayers.map((item) => [item.id, evaluatedLayerTransform(item, animationStart)]));
    const activeLayer = movableLayers.find((item) => item.id === layer.id) ?? movableLayers[0];
    const activeStart = starts.get(activeLayer.id)!;
    const groupMode = movableLayers.length > 1;
    const startBounds = combinedTransformBounds(Array.from(starts.values()))!;
    const startOverlay: LayerTransform = groupMode
      ? { x: startBounds.x, y: startBounds.y, width: startBounds.width, height: startBounds.height, rotation: 0 }
      : { ...activeStart };
    let previews = new Map(Array.from(starts, ([id, transform]) => [id, { ...transform }]));
    let previewOverlay = { ...startOverlay };
    const startX = event.clientX;
    const startY = event.clientY;
    const handle = (event.target as HTMLElement).dataset.handle;
    const canvasRect = canvas.getBoundingClientRect();
    const unitsX = currentProject().canvas.width / Math.max(1, canvasRect.width);
    const unitsY = currentProject().canvas.height / Math.max(1, canvasRect.height);
    const snapThresholdX = 8 * unitsX;
    const snapThresholdY = 8 * unitsY;
    const selectionRect = selection.getBoundingClientRect();
    const rotationCenter = { x: selectionRect.left + selectionRect.width / 2, y: selectionRect.top + selectionRect.height / 2 };
    const startAngle = Math.atan2(startY - rotationCenter.y, startX - rotationCenter.x);
    const excludedIds = new Set(selectedLayers().flatMap((item) => flattenLayers([item]).map((nested) => nested.id)));
    const candidates = smartGuideCandidates(excludedIds);
    const readout = element<HTMLOutputElement>('#canvasTransformReadout');
    selection.classList.add('transforming');
    const setReadout = (value: string): void => { readout.hidden = false; readout.textContent = value; };
    const onMove = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startX) * unitsX;
      const dy = (moveEvent.clientY - startY) * unitsY;
      clearSmartGuides();
      if (handle === 'rotate') {
        const angle = Math.atan2(moveEvent.clientY - rotationCenter.y, moveEvent.clientX - rotationCenter.x);
        let delta = (angle - startAngle) * 180 / Math.PI;
        if (snappingEnabled) delta = Math.round(delta / 15) * 15;
        const radians = delta * Math.PI / 180;
        previews = new Map(Array.from(starts, ([id, transform]) => {
          const relativeX = transform.x - startBounds.x;
          const relativeY = transform.y - startBounds.y;
          return [id, {
            ...transform,
            x: startBounds.x + relativeX * Math.cos(radians) - relativeY * Math.sin(radians),
            y: startBounds.y + relativeX * Math.sin(radians) + relativeY * Math.cos(radians),
            rotation: transform.rotation + delta
          }];
        }));
        previewOverlay = groupMode ? { ...startOverlay, rotation: delta } : { ...previews.get(activeLayer.id)! };
        setReadout(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}° · ${movableLayers.length} layer${movableLayers.length === 1 ? '' : 's'}`);
      } else if (!handle) {
        const snappedX = snapSelectionAxis(startBounds.x + dx, startBounds.width, candidates.x, snapThresholdX);
        const snappedY = snapSelectionAxis(startBounds.y + dy, startBounds.height, candidates.y, snapThresholdY);
        const deltaX = snappedX.value - startBounds.x;
        const deltaY = snappedY.value - startBounds.y;
        previews = new Map(Array.from(starts, ([id, transform]) => [id, { ...transform, x: transform.x + deltaX, y: transform.y + deltaY }]));
        previewOverlay = groupMode
          ? { ...startOverlay, x: startOverlay.x + deltaX, y: startOverlay.y + deltaY }
          : { ...previews.get(activeLayer.id)! };
        showSmartGuides(snappedX.guide, snappedY.guide);
        setReadout(`Δ ${Math.round(deltaX)}, ${Math.round(deltaY)} · ${movableLayers.length} layer${movableLayers.length === 1 ? '' : 's'}`);
      } else {
        const west = handle.includes('w');
        const north = handle.includes('n');
        const resizeStart = groupMode ? startBounds : {
          ...startBounds,
          left: activeStart.x - activeStart.width / 2,
          right: activeStart.x + activeStart.width / 2,
          top: activeStart.y - activeStart.height / 2,
          bottom: activeStart.y + activeStart.height / 2
        };
        let left = resizeStart.left + (west ? dx : 0);
        let right = resizeStart.right + (west ? 0 : dx);
        let top = resizeStart.top + (north ? dy : 0);
        let bottom = resizeStart.bottom + (north ? 0 : dy);
        const snappedX = snapSelectionAxis(west ? left : right, 0, candidates.x, snapThresholdX);
        const snappedY = snapSelectionAxis(north ? top : bottom, 0, candidates.y, snapThresholdY);
        if (west) left = snappedX.value; else right = snappedX.value;
        if (north) top = snappedY.value; else bottom = snappedY.value;
        if (right - left < 8) { if (west) left = right - 8; else right = left + 8; }
        if (bottom - top < 8) { if (north) top = bottom - 8; else bottom = top + 8; }
        const width = right - left;
        const height = bottom - top;
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        if (groupMode) {
          const scaleX = width / Math.max(1, startBounds.width);
          const scaleY = height / Math.max(1, startBounds.height);
          previews = new Map(Array.from(starts, ([id, transform]) => [id, {
            ...transform,
            x: centerX + (transform.x - startBounds.x) * scaleX,
            y: centerY + (transform.y - startBounds.y) * scaleY,
            width: Math.max(1, transform.width * scaleX),
            height: Math.max(1, transform.height * scaleY)
          }]));
          previewOverlay = { x: centerX, y: centerY, width, height, rotation: 0 };
        } else {
          const resized = {
            ...activeStart,
            x: centerX,
            y: centerY,
            width,
            height
          };
          previews = new Map([[activeLayer.id, resized]]);
          previewOverlay = resized;
        }
        showSmartGuides(snappedX.guide, snappedY.guide);
        setReadout(`${Math.round(previewOverlay.width)} × ${Math.round(previewOverlay.height)} · ${movableLayers.length} layer${movableLayers.length === 1 ? '' : 's'}`);
      }
      positionCanvasSelection(previewOverlay);
    };
    const onEnd = (): void => {
      selection.removeEventListener('pointermove', onMove);
      selection.removeEventListener('pointerup', onEnd);
      selection.removeEventListener('pointercancel', onEnd);
      selection.classList.remove('transforming');
      readout.hidden = true;
      clearSmartGuides();
      const changed = Array.from(previews).filter(([id, transform]) => JSON.stringify(transform) !== JSON.stringify(starts.get(id)));
      if (!changed.length) return positionCanvasSelection();
      const edits = changed.flatMap(([id, transform]) => (Object.keys(transform) as Array<keyof LayerTransform>)
        .filter((key) => transform[key] !== starts.get(id)![key])
        .map((key) => ({ target: `layer.${id}.transform.${key}`, value: transform[key] })));
      if (recordAutoKeyEdits(edits)) return;
      const next = mutateProject(currentProject(), (draft) => {
        for (const [id, transform] of changed) {
          const target = findLayer(draft, id);
          if (target) target.transform = transform;
        }
      });
      commit(next, selectedLayerId, Array.from(selectedLayerIds));
    };
    selection.addEventListener('pointermove', onMove);
    selection.addEventListener('pointerup', onEnd);
    selection.addEventListener('pointercancel', onEnd);
  });
  window.addEventListener('resize', updateCanvasOverlays);
  const effectPresetInput = element<HTMLSelectElement>('#effectPresetInput');
  const effectPresetMotionInput = element<HTMLSelectElement>('#effectPresetMotionInput');
  const effectPresetCycleInput = element<HTMLInputElement>('#effectPresetCycleInput');
  const syncEffectPresetDescription = (): void => {
    const preset = builtInEffectPresets[effectPresetInput.value as BuiltInEffectPresetId];
    const motion = effectPresetMotionInput.value as EffectPresetMotion;
    const cycle = Math.max(.2, Number(effectPresetCycleInput.value) || 2);
    const motionDescription = motion === 'none' ? 'Static stack only.' : `${motion === 'strong' ? 'Strong' : 'Gentle'} Loop repeats every ${Number(cycle.toFixed(1))} seconds and starts timeline playback.`;
    element<HTMLElement>('#effectPresetDescription').textContent = `${preset?.description ?? ''} ${motionDescription}`;
  };
  effectPresetInput.addEventListener('change', syncEffectPresetDescription);
  effectPresetMotionInput.addEventListener('change', syncEffectPresetDescription);
  effectPresetCycleInput.addEventListener('change', syncEffectPresetDescription);
  element<HTMLButtonElement>('#previewEffectPresetButton').addEventListener('click', () => previewBuiltInEffectPreset(effectPresetInput.value as BuiltInEffectPresetId, effectPresetMotionInput.value as EffectPresetMotion, Math.max(.2, Number(effectPresetCycleInput.value) || 2)));
  element<HTMLButtonElement>('#applyEffectPresetButton').addEventListener('click', () => applyBuiltInEffectPreset(effectPresetInput.value as BuiltInEffectPresetId, effectPresetMotionInput.value as EffectPresetMotion, Math.max(.2, Number(effectPresetCycleInput.value) || 2)));
  element<HTMLButtonElement>('#effectAutoKeyButton').addEventListener('click', toggleAutoKeyRecording);
  syncEffectPresetDescription();
  document.querySelectorAll<HTMLButtonElement>('[data-add-effect]').forEach((button) => button.addEventListener('click', () => {
    const type = button.dataset.addEffect as EffectType;
    const effect = type === 'paintMask' ? createPaintMask() : type === 'paintLayer' ? createPaintLayer() : createEffect(type);
    if (type === 'paintMask' || type === 'paintLayer') { activeTool = 'mask'; activePaintMaskId = effect.id; }
    changeLayer((layer) => { layer.effects.push(effect); });
    if (type === 'paintMask') showToast('Painted mask added. Brush directly over the canvas.');
    if (type === 'paintLayer') showToast('Paint / Erase added. Paint uses the foreground color.');
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-add-region-mask]').forEach((button) => button.addEventListener('click', () => {
    const preset = button.dataset.addRegionMask as 'sky' | 'horizon' | 'terrain' | 'foreground';
    changeLayer((layer) => { layer.effects.push(createRegionMask(preset)); });
    showToast(`${preset[0].toUpperCase()}${preset.slice(1)} region mask added.`);
  }));
  element<HTMLButtonElement>('#addBindingButton').addEventListener('click', () => {
    const layer = selectedLayer();
    if (!layer) return;
    const target = parameterTargets(layer)[0];
    if (!target) return;
    const binding = createBinding('bass', target.path, 1);
    configureDriverReaction(binding, layer, 'punchy');
    commit(mutateProject(currentProject(), (draft) => { draft.bindings.push(binding); }));
    ensureDriverPreview();
    showToast('Punchy Bass reaction added. The live SOURCE, OFFSET, and RESULT values show exactly what it is doing.');
  });
  element<HTMLButtonElement>('#bakeAudioAutomationButton').addEventListener('click', toggleAudioAutomationRecording);
  element<HTMLButtonElement>('#loadReferenceAudioButton').addEventListener('click', () => void loadReferenceAudio());
  element<HTMLButtonElement>('#audioPreviewToggleButton').addEventListener('click', () => {
    if (referenceAudioName) {
      element<HTMLButtonElement>('#referenceAudioPlayButton').click();
      return;
    }
    mockAudio = !mockAudio;
    element<HTMLInputElement>('#mockAudioToggle').checked = mockAudio;
    modulationEngine.reset();
    showToast(mockAudio ? 'Generated test signal started.' : 'Generated test signal paused.');
  });
  element<HTMLButtonElement>('#referenceAudioPlayButton').addEventListener('click', async () => {
    if (!referenceAudioName) return;
    try {
      await ensureReferenceAudioGraph();
      if (referenceAudio.paused) await referenceAudio.play();
      else referenceAudio.pause();
    } catch (error) {
      showToast(`Playback failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }
    renderReferenceAudioTransport();
  });
  element<HTMLButtonElement>('#referenceAudioStopButton').addEventListener('click', () => {
    referenceAudio.pause();
    referenceAudio.currentTime = 0;
    referenceBeat = 0;
    modulationEngine.reset();
    renderReferenceAudioTransport();
  });
  element<HTMLInputElement>('#referenceAudioProgress').addEventListener('input', (event) => {
    if (referenceAudioName) referenceAudio.currentTime = Number((event.currentTarget as HTMLInputElement).value) || 0;
    renderReferenceAudioTransport();
  });
  element<HTMLInputElement>('#referenceAudioVolume').addEventListener('input', (event) => {
    referenceAudio.volume = Math.max(0, Math.min(1, Number((event.currentTarget as HTMLInputElement).value)));
  });
  element<HTMLInputElement>('#referenceAudioLoop').addEventListener('change', (event) => {
    referenceAudio.loop = (event.currentTarget as HTMLInputElement).checked;
  });
  for (const type of ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange']) referenceAudio.addEventListener(type, renderReferenceAudioTransport);
  referenceAudio.volume = Number(element<HTMLInputElement>('#referenceAudioVolume').value);
  renderReferenceAudioTransport();
  element<HTMLInputElement>('#mockAudioToggle').addEventListener('change', (event) => {
    mockAudio = (event.currentTarget as HTMLInputElement).checked;
    if (!mockAudio) modulationEngine.reset();
  });
  const infoDialog = element<HTMLDialogElement>('#infoDialog');
  const showInfo = (eyebrow: string, title: string, body: string): void => {
    element<HTMLElement>('#infoDialogEyebrow').textContent = eyebrow;
    element<HTMLElement>('#infoDialogTitle').textContent = title;
    element<HTMLDivElement>('#infoDialogBody').innerHTML = body;
    infoDialog.showModal();
  };
  element<HTMLButtonElement>('#closeInfoDialogButton').addEventListener('click', () => infoDialog.close());
  const selectRelative = (direction: -1 | 1): void => {
    const layers = flattenLayers(currentProject().layers);
    if (!layers.length) return;
    const current = Math.max(0, layers.findIndex((layer) => layer.id === selectedLayerId));
    selectLayer(layers[(current + direction + layers.length) % layers.length].id);
    renderEditor();
  };
  const revealInspectorSection = (selector: string): void => {
    element<HTMLButtonElement>(`[data-scroll-target="${selector}"]`).click();
  };
  const runMenuCommand = (command: string): void => {
    if (command === 'new') element<HTMLButtonElement>('#newProjectButton').click();
    else if (command === 'open') element<HTMLButtonElement>('#openProjectButton').click();
    else if (command === 'import-preset') void importLayerPreset();
    else if (command === 'import-composition') void importCompositionProject();
    else if (command === 'save') void save(false);
    else if (command === 'save-as') void save(true);
    else if (command === 'publish') element<HTMLButtonElement>('#publishProjectButton').click();
    else if (command === 'live') element<HTMLButtonElement>('#runtimeButton').click();
    else if (command === 'undo') element<HTMLButtonElement>('#undoButton').click();
    else if (command === 'redo') element<HTMLButtonElement>('#redoButton').click();
    else if (command === 'cut-layers') copyLayerSelection(true);
    else if (command === 'copy-layers') copyLayerSelection();
    else if (command === 'paste-layers') pasteLayerClipboard();
    else if (command === 'paste-layers-in-place') pasteLayerClipboard(true);
    else if (command === 'duplicate') element<HTMLButtonElement>('#duplicateLayerButton').click();
    else if (command === 'delete') element<HTMLButtonElement>('#deleteLayerButton').click();
    else if (command === 'group') element<HTMLButtonElement>('#groupLayerButton').click();
    else if (command === 'move-up') element<HTMLButtonElement>('#moveLayerUpButton').click();
    else if (command === 'move-down') element<HTMLButtonElement>('#moveLayerDownButton').click();
    else if (command === 'save-preset') openPresetDialog();
    else if (command === 'select-next') selectRelative(1);
    else if (command === 'select-previous') selectRelative(-1);
    else if (command === 'select-none') { selectLayer(''); renderEditor(); }
    else if (command === 'show-properties') revealInspectorSection('propertiesSection');
    else if (command === 'show-effects') revealInspectorSection('effectSection');
    else if (command === 'show-audio') revealInspectorSection('audioSection');
    else if (command === 'show-nodes') {
      activeDockTab = 'nodes';
      workspaceLayout.panels.layers.visible = true;
      applyWorkspaceLayout(true);
      renderDockBrowser();
    }
    else if (command === 'show-presets') {
      activeDockTab = 'presets';
      workspaceLayout.panels.layers.visible = true;
      applyWorkspaceLayout(true);
      renderDockBrowser();
    }
    else if (command === 'show-vault') {
      activeDockTab = 'vault';
      workspaceLayout.panels.layers.visible = true;
      applyWorkspaceLayout(true);
      renderDockBrowser();
    }
    else if (command.startsWith('effect:')) {
      const type = command.slice(7) as EffectType;
      const effect = type === 'paintMask' ? createPaintMask() : type === 'paintLayer' ? createPaintLayer() : createEffect(type);
      if (type === 'paintMask' || type === 'paintLayer') { activeTool = 'mask'; activePaintMaskId = effect.id; }
      changeLayer((layer) => { layer.effects.push(effect); });
    }
    else if (command.startsWith('mask:')) changeLayer((layer) => { layer.effects.push(createRegionMask(command.slice(5) as 'sky' | 'horizon' | 'terrain' | 'foreground')); });
    else if (command === 'add-binding') element<HTMLButtonElement>('#addBindingButton').click();
    else if (command === 'load-reference-audio') void loadReferenceAudio();
    else if (command === 'toggle-reference-audio') element<HTMLButtonElement>('#referenceAudioPlayButton').click();
    else if (command === 'stop-reference-audio') element<HTMLButtonElement>('#referenceAudioStopButton').click();
    else if (command === 'mock-audio') element<HTMLInputElement>('#mockAudioToggle').click();
    else if (command === 'fit') setCanvasZoom(null);
    else if (command === 'zoom-100') setCanvasZoom(1);
    else if (command === 'zoom-in') stepZoom(1);
    else if (command === 'zoom-out') stepZoom(-1);
    else if (command === 'ui-scale-in') stepUiScale(1);
    else if (command === 'ui-scale-out') stepUiScale(-1);
    else if (command === 'ui-scale-auto') setUiScaleMode('auto');
    else if (command === 'ui-scale-100') setUiScaleMode(1);
    else if (command === 'guides') element<HTMLButtonElement>('#guidesToggleButton').click();
    else if (command === 'snap') element<HTMLButtonElement>('#snapToggleButton').click();
    else if (command === 'toggle-toolbox') { workspaceLayout.panels.toolbox.visible = !workspaceLayout.panels.toolbox.visible; applyWorkspaceLayout(true); }
    else if (command === 'toggle-inspector') { workspaceLayout.panels.inspector.visible = !workspaceLayout.panels.inspector.visible; applyWorkspaceLayout(true); }
    else if (command === 'toggle-layers') { workspaceLayout.panels.layers.visible = !workspaceLayout.panels.layers.visible; applyWorkspaceLayout(true); }
    else if (command === 'toggle-docks') {
      const show = !(workspaceLayout.panels.inspector.visible || workspaceLayout.panels.layers.visible);
      workspaceLayout.panels.inspector.visible = show;
      workspaceLayout.panels.layers.visible = show;
      applyWorkspaceLayout(true);
    }
    else if (command === 'toggle-timeline') { workspaceLayout.panels.timeline.visible = !workspaceLayout.panels.timeline.visible; applyWorkspaceLayout(true); }
    else if (command === 'workspace-customize') { renderWorkspaceDialog(); element<HTMLDialogElement>('#workspaceDialog').showModal(); }
    else if (command === 'workspace-save') {
      renderWorkspaceDialog();
      const workspaceDialog = element<HTMLDialogElement>('#workspaceDialog');
      workspaceDialog.showModal();
      requestAnimationFrame(() => element<HTMLInputElement>('#workspaceNameInput').focus());
    }
    else if (command === 'workspace-editing') setWorkspaceLayout(defaultWorkspaceLayout(), 'Editing workspace loaded.');
    else if (command === 'workspace-preview') setWorkspaceLayout(previewWorkspaceLayout(), 'Preview workspace loaded.');
    else if (command === 'shortcuts') showInfo('REFERENCE', 'Keyboard Shortcuts', '<div class="shortcut-grid"><span>Save / Save As</span><kbd>Ctrl+S / Ctrl+Shift+S</kbd><span>Undo / Redo</span><kbd>Ctrl+Z / Ctrl+Y</kbd><span>Cut / copy layers</span><kbd>Ctrl+X / Ctrl+C</kbd><span>Paste / paste in place</span><kbd>Ctrl+V / Ctrl+Shift+V</kbd><span>Find layers</span><kbd>/</kbd><span>Duplicate layer</span><kbd>Ctrl+D</kbd><span>Delete layer</span><kbd>Delete</kbd><span>Previous / next layer</span><kbd>[ / ]</kbd><span>Open Node View</span><kbd>Shift+N</kbd><span>Play timeline</span><kbd>K</kbd><span>Return to start</span><kbd>Home</kbd><span>Fit canvas</span><kbd>F</kbd><span>Canvas zoom</span><kbd>Ctrl + / −</kbd><span>Interface scale</span><kbd>Ctrl+Shift + / −</kbd><span>Auto interface scale</span><kbd>Ctrl+0</kbd><span>Toggle guides</span><kbd>G</kbd><span>Pan canvas</span><kbd>Space + drag</kbd></div>');
    else if (command === 'about') showInfo('DATA HORIZON STUDIO', 'Version 0.20.5', '<h3>Non-destructive visual compositor</h3><p>Author layered, audio-reactive visualizers and broadcast elements for Quartic Pulse and Tempest Broadcast.</p><p>Open Broadcast Kit · verified Git release pipeline · named layer selection sets · hierarchy-aware Solo/Restore.</p><p>Interface patterns are inspired by professional graphics editors; no third-party source code or assets are included.</p>');
  };
  type MenuItem = { label: string; command: string; shortcut?: string; selection?: boolean } | 'separator';
  const menuDefinitions: Record<string, MenuItem[]> = {
    file: [{ label: 'New Project', command: 'new', shortcut: 'Ctrl+N' }, { label: 'Open Project…', command: 'open', shortcut: 'Ctrl+O' }, { label: 'Import Project as Layers…', command: 'import-composition' }, { label: 'Import Layer Preset…', command: 'import-preset' }, 'separator', { label: 'Save', command: 'save', shortcut: 'Ctrl+S' }, { label: 'Save As…', command: 'save-as', shortcut: 'Ctrl+Shift+S' }, 'separator', { label: 'Publish Bundle…', command: 'publish' }, { label: 'Open Asset Vault Library', command: 'show-vault' }, { label: 'Open Live View', command: 'live' }],
    edit: [{ label: 'Undo', command: 'undo', shortcut: 'Ctrl+Z' }, { label: 'Redo', command: 'redo', shortcut: 'Ctrl+Y' }, 'separator', { label: 'Cut Layers', command: 'cut-layers', shortcut: 'Ctrl+X', selection: true }, { label: 'Copy Layers', command: 'copy-layers', shortcut: 'Ctrl+C', selection: true }, { label: 'Paste Layers', command: 'paste-layers', shortcut: 'Ctrl+V' }, { label: 'Paste Layers in Place', command: 'paste-layers-in-place', shortcut: 'Ctrl+Shift+V' }, 'separator', { label: 'Duplicate Layer', command: 'duplicate', shortcut: 'Ctrl+D', selection: true }, { label: 'Delete Layer', command: 'delete', shortcut: 'Delete', selection: true }],
    select: [{ label: 'Previous Layer', command: 'select-previous', shortcut: '[' }, { label: 'Next Layer', command: 'select-next', shortcut: ']' }, { label: 'Clear Selection', command: 'select-none', shortcut: 'Esc', selection: true }, 'separator', { label: 'Show Properties', command: 'show-properties', selection: true }],
    layer: [{ label: 'Cut', command: 'cut-layers', shortcut: 'Ctrl+X', selection: true }, { label: 'Copy', command: 'copy-layers', shortcut: 'Ctrl+C', selection: true }, { label: 'Paste', command: 'paste-layers', shortcut: 'Ctrl+V' }, { label: 'Paste in Place', command: 'paste-layers-in-place', shortcut: 'Ctrl+Shift+V' }, 'separator', { label: 'Duplicate', command: 'duplicate', selection: true }, { label: 'Group', command: 'group', selection: true }, { label: 'Delete', command: 'delete', selection: true }, 'separator', { label: 'Move Up', command: 'move-up', selection: true }, { label: 'Move Down', command: 'move-down', selection: true }, 'separator', { label: 'Save Selection as Preset…', command: 'save-preset', selection: true }, { label: 'Open Preset Library', command: 'show-presets' }],
    effects: [{ label: 'Open Node View', command: 'show-nodes', shortcut: 'Shift+N', selection: true }, { label: 'Show Effect Stack', command: 'show-effects', selection: true }, 'separator', { label: 'Add Cel Shading', command: 'effect:celShading', selection: true }, { label: 'Add Outline', command: 'effect:outline', selection: true }, { label: 'Add Bloom', command: 'effect:bloom', selection: true }, { label: 'Add Painted Mask', command: 'effect:paintMask', selection: true }, { label: 'Add Sky Mask', command: 'mask:sky', selection: true }, { label: 'Add Terrain Mask', command: 'mask:terrain', selection: true }],
    audio: [{ label: 'Load Reference Song…', command: 'load-reference-audio' }, { label: 'Play / Pause Reference Song', command: 'toggle-reference-audio' }, { label: 'Stop Reference Song', command: 'stop-reference-audio' }, 'separator', { label: 'Show Audio Assignments', command: 'show-audio', selection: true }, { label: 'Assign Bass to Parameter', command: 'add-binding', selection: true }, 'separator', { label: 'Toggle Generated Audio', command: 'mock-audio' }],
    view: [{ label: 'Fit Canvas', command: 'fit', shortcut: 'F' }, { label: 'Canvas at 100%', command: 'zoom-100' }, { label: 'Canvas Zoom In', command: 'zoom-in', shortcut: 'Ctrl++' }, { label: 'Canvas Zoom Out', command: 'zoom-out', shortcut: 'Ctrl+-' }, 'separator', { label: 'Increase Interface Scale', command: 'ui-scale-in', shortcut: 'Ctrl+Shift++' }, { label: 'Decrease Interface Scale', command: 'ui-scale-out', shortcut: 'Ctrl+Shift+-' }, { label: 'Auto Interface Scale', command: 'ui-scale-auto', shortcut: 'Ctrl+0' }, { label: 'Interface at 100%', command: 'ui-scale-100' }, 'separator', { label: 'Toggle Guides', command: 'guides', shortcut: 'G' }, { label: 'Toggle Snapping', command: 'snap' }],
    window: [{ label: 'Toggle Toolbox', command: 'toggle-toolbox' }, { label: 'Toggle Inspector', command: 'toggle-inspector' }, { label: 'Toggle Layers / Assets / Masks / Nodes / Presets / Vault', command: 'toggle-layers' }, { label: 'Toggle All Right Docks', command: 'toggle-docks' }, { label: 'Toggle Timeline', command: 'toggle-timeline' }],
    workspace: [{ label: 'Customize Workspace…', command: 'workspace-customize' }, { label: 'Save Current Workspace…', command: 'workspace-save' }, 'separator', { label: 'Editing Layout', command: 'workspace-editing' }, { label: 'Preview Layout', command: 'workspace-preview' }],
    help: [{ label: 'Keyboard Shortcuts', command: 'shortcuts' }, { label: 'About Data Horizon', command: 'about' }]
  };
  const menuPopover = element<HTMLDivElement>('#menuPopover');
  document.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((menuButton) => menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const menuName = menuButton.dataset.menu || '';
    const wasOpen = !menuPopover.hidden && menuPopover.dataset.menu === menuName;
    menuPopover.hidden = true;
    if (wasOpen) return;
    menuPopover.replaceChildren();
    menuPopover.dataset.menu = menuName;
    for (const item of menuDefinitions[menuName] ?? []) {
      if (item === 'separator') { menuPopover.append(document.createElement('hr')); continue; }
      const button = document.createElement('button');
      const label = document.createElement('span'); label.textContent = item.label;
      const shortcut = document.createElement('span'); shortcut.textContent = item.shortcut ?? '';
      button.append(label, shortcut);
      button.disabled = Boolean(item.selection && !selectedLayer());
      button.addEventListener('click', () => { menuPopover.hidden = true; runMenuCommand(item.command); });
      menuPopover.append(button);
    }
    const rect = menuButton.getBoundingClientRect();
    menuPopover.style.left = `${rect.left}px`;
    menuPopover.hidden = false;
  }));
  document.addEventListener('pointerdown', (event) => { if (!(event.target as HTMLElement).closest('.menubar')) menuPopover.hidden = true; });
  window.addEventListener('keydown', (event) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) || (event.target as HTMLElement).isContentEditable;
    const layerSearch = element<HTMLInputElement>('#layerSearchInput');
    if (event.key === 'Escape' && event.target === layerSearch && (layerSearchQuery || layerTreeFilter !== 'all')) {
      event.preventDefault();
      layerSearchQuery = '';
      layerTreeFilter = 'all';
      layerSearch.value = '';
      element<HTMLSelectElement>('#layerFilterInput').value = 'all';
      renderEditor();
      return;
    }
    if (event.key === 'Escape') {
      menuPopover.hidden = true;
      if (element<HTMLDialogElement>('#workspaceDialog').open) element<HTMLDialogElement>('#workspaceDialog').close();
      else if (infoDialog.open) infoDialog.close();
      else if (!typing && selectedKeyframeIds.size) { selectedKeyframeIds.clear(); syncSelectedKeyframeDom(); }
      else if (!typing && selectedLayerId) runMenuCommand('select-none');
    }
    if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === '/') {
      event.preventDefault();
      layerSearch.focus();
      layerSearch.select();
      return;
    }
    if (!typing && event.code === 'Space') {
      spacePressed = true;
      event.preventDefault();
    }
    if (!typing && activeTool === 'mask' && !event.ctrlKey && !event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 'b') { event.preventDefault(); setBrushMode(brushModePair().primary); return; }
      if (key === 'e') { event.preventDefault(); setBrushMode(brushModePair().secondary); return; }
      if (key === 'c') {
        event.preventDefault();
        const pair = brushModePair();
        setBrushMode(maskBrushMode === pair.secondary ? pair.primary : pair.secondary);
        return;
      }
      if (event.key === '[') { event.preventDefault(); changeBrushSize(-Math.max(2, Math.round(maskBrushSize * .12))); return; }
      if (event.key === ']') { event.preventDefault(); changeBrushSize(Math.max(2, Math.round(maskBrushSize * .12))); return; }
    }
    if (!typing && event.key === 'Delete') { event.preventDefault(); selectedKeyframeIds.size ? element<HTMLButtonElement>('#deleteKeyframesButton').click() : runMenuCommand('delete'); }
    else if (!typing && event.key === '[') { event.preventDefault(); runMenuCommand('select-previous'); }
    else if (!typing && event.key === ']') { event.preventDefault(); runMenuCommand('select-next'); }
    else if (!typing && event.key.toLowerCase() === 'k') { event.preventDefault(); element<HTMLButtonElement>('#timelinePlayButton').click(); }
    else if (!typing && event.key === 'Home') { event.preventDefault(); element<HTMLButtonElement>('#timelineStartButton').click(); }
    else if (!typing && event.shiftKey && event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); runMenuCommand('show-nodes'); }
    else if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'f') { event.preventDefault(); runMenuCommand('fit'); }
    else if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'g') { event.preventDefault(); runMenuCommand('guides'); }
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.key === '0') { event.preventDefault(); runMenuCommand('ui-scale-auto'); }
    else if (event.shiftKey && (event.key === '+' || event.key === '=')) { event.preventDefault(); runMenuCommand('ui-scale-in'); }
    else if (event.shiftKey && event.key === '-') { event.preventDefault(); runMenuCommand('ui-scale-out'); }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); runMenuCommand('new'); }
    else if (event.key.toLowerCase() === 'o') { event.preventDefault(); runMenuCommand('open'); }
    else if (event.key.toLowerCase() === 'x' && !typing) { event.preventDefault(); runMenuCommand('cut-layers'); }
    else if (event.key.toLowerCase() === 'c' && !typing) { event.preventDefault(); selectedKeyframeIds.size ? element<HTMLButtonElement>('#copyKeyframesButton').click() : runMenuCommand('copy-layers'); }
    else if (event.key.toLowerCase() === 'v' && !typing) {
      event.preventDefault();
      if (event.shiftKey) runMenuCommand('paste-layers-in-place');
      else if (selectedKeyframeIds.size && animationKeyClipboard.length) element<HTMLButtonElement>('#pasteKeyframesButton').click();
      else runMenuCommand('paste-layers');
    }
    else if (event.key.toLowerCase() === 'd' && !typing) { event.preventDefault(); selectedKeyframeIds.size ? element<HTMLButtonElement>('#duplicateKeyframesButton').click() : runMenuCommand('duplicate'); }
    else if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      element<HTMLButtonElement>(event.shiftKey ? '#redoButton' : '#undoButton').click();
    } else if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      element<HTMLButtonElement>('#redoButton').click();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save(event.shiftKey);
    } else if (event.key === '+' || event.key === '=') { event.preventDefault(); runMenuCommand('zoom-in'); }
    else if (event.key === '-') { event.preventDefault(); runMenuCommand('zoom-out'); }
  });
  window.addEventListener('keyup', (event) => { if (event.code === 'Space') spacePressed = false; });
  window.addEventListener('blur', () => { spacePressed = false; });
  applyCanvasViewport();
}

function renderAudioMeters(frame: AudioFeatureFrame): void {
  if (!editorMode) return;
  const host = element<HTMLDivElement>('#audioMeters');
  if (!host.children.length) {
    for (const source of ['bass', 'mids', 'highs', 'beat', 'rms'] as AudioSource[]) {
      const meter = document.createElement('span');
      meter.className = 'audio-meter';
      meter.dataset.source = source;
      const bar = document.createElement('i');
      meter.append(bar, source.toUpperCase());
      host.append(meter);
    }
  }
  host.querySelectorAll<HTMLElement>('.audio-meter').forEach((meter) => {
    const source = meter.dataset.source as AudioSource;
    meter.style.setProperty('--level', String(Math.max(0, Math.min(1, frame[source]))));
  });
}

function formatDriverValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100) return String(Math.round(value));
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
}

function renderAudioDriverState(frame: AudioFeatureFrame, modulation: ReadonlyMap<string, number>, animation: ReadonlyMap<string, number>): void {
  if (!editorMode || !document.querySelector('#audioDriverStatus')) return;
  const activeBindings = currentProject().bindings.filter((binding) => binding.enabled);
  const peak = Math.max(frame.bass, frame.mids, frame.highs, frame.beat, frame.rms);
  const status = element<HTMLElement>('#audioDriverStatus');
  status.style.setProperty('--signal-level', String(Math.max(0, Math.min(1, peak))));
  const playingReference = Boolean(referenceAudioName && !referenceAudio.paused && !referenceAudio.ended);
  const title = externalAudio ? 'Live host audio active'
    : playingReference ? `Playing ${referenceAudioName}`
      : referenceAudioName ? 'Reference song paused'
        : mockAudio ? 'Generated test signal active'
          : 'No audio signal';
  element<HTMLElement>('#audioDriverStatusTitle').textContent = title;
  element<HTMLElement>('#audioDriverStatusDetail').textContent = `${activeBindings.length} active driver${activeBindings.length === 1 ? '' : 's'} · B ${frame.bass.toFixed(2)} · M ${frame.mids.toFixed(2)} · H ${frame.highs.toFixed(2)} · BEAT ${frame.beat.toFixed(2)}`;
  element<HTMLButtonElement>('#audioPreviewToggleButton').textContent = referenceAudioName
    ? playingReference ? 'Pause Song' : 'Play Song'
    : mockAudio ? 'Pause Test Signal' : 'Start Test Signal';
  syncAudioAutomationRecordButton();
  for (const binding of currentProject().bindings) {
    const card = document.querySelector<HTMLElement>(`.binding-card[data-binding-id="${binding.id}"]`);
    if (!card) continue;
    const source = Math.max(0, Math.min(1, Number(frame[binding.source]) || 0));
    const offset = modulation.get(binding.target) ?? 0;
    const base = animation.get(binding.target) ?? readParameterValue(currentProject(), binding.target);
    const layer = findLayer(currentProject(), binding.target.split('.')[1]);
    const descriptor = layer ? parameterTargets(layer).find((item) => item.path === binding.target) : undefined;
    const result = base === undefined ? undefined : Math.max(descriptor?.minimum ?? -Infinity, Math.min(descriptor?.maximum ?? Infinity, base + offset));
    card.style.setProperty('--source-level', String(source));
    const sourceValue = card.querySelector<HTMLElement>('[data-binding-source-value]');
    const offsetValue = card.querySelector<HTMLElement>('[data-binding-offset-value]');
    const resultValue = card.querySelector<HTMLElement>('[data-binding-result-value]');
    if (sourceValue) sourceValue.textContent = `${binding.source.toUpperCase()} ${source.toFixed(2)}`;
    if (offsetValue) offsetValue.textContent = `${offset >= 0 ? '+' : ''}${formatDriverValue(offset)}`;
    if (resultValue) resultValue.textContent = formatDriverValue(result ?? Number.NaN);
  }
}

function renderLiveParameterState(animation: ReadonlyMap<string, number>, modulation: ReadonlyMap<string, number>): void {
  for (const row of Array.from(document.querySelectorAll<HTMLElement>('.effect-parameter[data-parameter-target]'))) {
    const target = row.dataset.parameterTarget || '';
    const base = animation.get(target) ?? readParameterValue(currentProject(), target);
    if (base === undefined) continue;
    const offset = modulation.get(target) ?? 0;
    const minimum = Number(row.dataset.parameterMinimum ?? -Infinity);
    const maximum = Number(row.dataset.parameterMaximum ?? Infinity);
    const step = Number(row.dataset.parameterStep ?? .01);
    const result = Math.max(minimum, Math.min(maximum, base + offset));
    const input = row.querySelector('input[type="range"]') as HTMLInputElement | null;
    const output = row.querySelector('output') as HTMLOutputElement | null;
    if (input && document.activeElement !== input) input.value = String(result);
    if (output && document.activeElement !== input) output.textContent = result.toFixed(step === 1 ? 0 : 2);
    row.classList.toggle('live', animation.has(target) || Math.abs(offset) > .0001);
  }
}

function syncAudioAutomationRecordButton(): void {
  const record = document.querySelector<HTMLButtonElement>('#bakeAudioAutomationButton');
  if (!record) return;
  record.classList.toggle('active', audioAutomationRecording);
  record.textContent = audioAutomationRecording ? '■ Stop Recording' : '● Record Drivers to Keys';
}

function stopAudioAutomationRecording(): void {
  if (!audioAutomationRecording) return;
  audioAutomationRecording = false;
  syncAudioAutomationRecordButton();
  timelinePlaying = false;
  const samples = audioAutomationSamples;
  const targetCount = samples.size;
  const keyCount = Array.from(samples.values()).reduce((total, values) => total + values.size, 0);
  if (!keyCount) {
    showToast('Driver recording stopped before any samples were captured.', true);
    return;
  }
  const newKeyIds: string[] = [];
  const next = mutateProject(currentProject(), (draft) => {
    for (const [target, values] of samples) {
      const ordered = Array.from(values, ([time, value]) => ({ time, value })).sort((left, right) => left.time - right.time);
      if (!ordered.length) continue;
      let track = draft.timeline.tracks.find((item) => item.target === target);
      if (!track) {
        const owner = findLayer(draft, target.split('.')[1]);
        const descriptor = owner ? parameterTargets(owner).find((item) => item.path === target) : undefined;
        track = { id: createId('track'), target, name: descriptor?.label ?? 'Baked Audio Automation', enabled: true, keyframes: [] };
        draft.timeline.tracks.push(track);
      }
      track.enabled = true;
      const start = ordered[0].time;
      const end = ordered[ordered.length - 1].time;
      track.keyframes = track.keyframes.filter((keyframe) => keyframe.time < start - .0001 || keyframe.time > end + .0001);
      for (const sample of ordered) {
        const id = createId('keyframe');
        newKeyIds.push(id);
        track.keyframes.push({ id, time: sample.time, value: sample.value, easing: 'linear' });
      }
      track.keyframes.sort((left, right) => left.time - right.time);
    }
  });
  selectedKeyframeIds = new Set(newKeyIds.slice(-Math.min(32, newKeyIds.length)));
  timelineTrackFilter = 'selected';
  commit(next);
  showToast(`Baked ${keyCount} live driver samples across ${targetCount} parameter${targetCount === 1 ? '' : 's'} into editable keys.`);
}

function toggleAudioAutomationRecording(): void {
  if (audioAutomationRecording) return stopAudioAutomationRecording();
  const layer = selectedLayer();
  if (!layer) return showToast('Select a layer with music drivers first.', true);
  const targets = currentProject().bindings.filter((binding) => binding.enabled && binding.target.startsWith(`layer.${layer.id}.`)).map((binding) => binding.target);
  if (!targets.length) return showToast('The selected layer has no enabled music drivers to record.', true);
  stopEffectPresetPreview();
  audioAutomationTargets = new Set(targets);
  audioAutomationSamples = new Map(Array.from(audioAutomationTargets, (target) => [target, new Map<number, number>()]));
  audioAutomationLastSample = -1;
  audioAutomationRecording = true;
  syncAudioAutomationRecordButton();
  timelineTime = timelineWorkAreaEnabled ? timelineLoopStart : 0;
  timelinePlaying = true;
  if (referenceAudioName && referenceAudio.paused) element<HTMLButtonElement>('#referenceAudioPlayButton').click();
  else ensureDriverPreview();
  showToast(`Recording ${audioAutomationTargets.size} live driver target${audioAutomationTargets.size === 1 ? '' : 's'}. Press Stop Recording when the motion is ready.`);
}

function captureAudioAutomationSamples(now: number, animation: ReadonlyMap<string, number>, modulation: ReadonlyMap<string, number>): void {
  if (!audioAutomationRecording || now - audioAutomationLastSample < 1000 / 15) return;
  audioAutomationLastSample = now;
  const sampleTime = Math.max(0, Math.min(currentProject().timeline.duration, Math.round(timelineTime * 15) / 15));
  for (const target of audioAutomationTargets) {
    const base = animation.get(target) ?? readParameterValue(currentProject(), target);
    if (base === undefined) continue;
    const owner = findLayer(currentProject(), target.split('.')[1]);
    const descriptor = owner ? parameterTargets(owner).find((item) => item.path === target) : undefined;
    const value = Math.max(descriptor?.minimum ?? -Infinity, Math.min(descriptor?.maximum ?? Infinity, base + (modulation.get(target) ?? 0)));
    audioAutomationSamples.get(target)?.set(sampleTime, value);
  }
}

function animate(now: number): void {
  const delta = Math.min(.1, Math.max(1 / 1000, (now - lastFrame) / 1000));
  lastFrame = now;
  frameSequence += 1;
  const referenceFrame = editorMode ? analyzeReferenceAudio(frameSequence) : null;
  currentAudio = externalAudio ?? referenceFrame ?? (mockAudio ? createMockAudioFrame(now / 1000, frameSequence) : {
    sequence: frameSequence,
    timestampSeconds: now / 1000,
    bass: 0,
    mids: 0,
    highs: 0,
    beat: 0,
    rms: 0
  });
  const renderProject = effectPresetPreviewProject ?? currentProject();
  const timeline = renderProject.timeline;
  if (editorMode) {
    const playbackStart = timelineWorkAreaEnabled ? timelineLoopStart : 0;
    const playbackEnd = timelineWorkAreaEnabled ? timelineLoopEnd : timeline.duration;
    const playbackSpan = Math.max(.001, playbackEnd - playbackStart);
    const syncToReference = Boolean(referenceAudioName && !referenceAudio.paused && element<HTMLInputElement>('#referenceAudioTimelineSync').checked);
    if (syncToReference) {
      timelinePlaying = false;
      timelineTime = timelineWorkAreaEnabled || timeline.loop
        ? playbackStart + referenceAudio.currentTime % playbackSpan
        : Math.min(timeline.duration, referenceAudio.currentTime);
    } else if (timelinePlaying) {
      timelineTime += delta;
      if ((timelineWorkAreaEnabled || timeline.loop) && timelineTime >= playbackEnd) timelineTime = playbackStart + (timelineTime - playbackStart) % playbackSpan;
      else if (timelineTime >= playbackEnd) {
        timelineTime = playbackEnd;
        timelinePlaying = false;
      }
    }
  } else {
    timelineTime = now / 1000;
  }
  const animation = evaluateVisibleTimeline(timeline, timelineTime);
  const modulation = modulationEngine.evaluate(renderProject.bindings, currentAudio, delta);
  captureAudioAutomationSamples(now, animation, modulation);
  const diagnostics = renderer.render({ timeSeconds: now / 1000, deltaSeconds: delta, modulation, animation, audio: currentAudio });
  window.__dataHorizonDiagnostics = diagnostics;
  if (editorMode && now - lastEditorRefresh > 120) {
    renderAudioMeters(currentAudio);
    renderAudioDriverState(currentAudio, modulation, animation);
    renderLiveParameterState(animation, modulation);
    renderReferenceAudioTransport();
    element<HTMLElement>('#renderStatus').textContent = diagnostics.lastError
      ? `RENDER ERROR · ${diagnostics.lastError}`
      : `${diagnostics.loadedAssets} ASSETS · ${diagnostics.width} × ${diagnostics.height}`;
    element<HTMLElement>('#frameStats').textContent = `${diagnostics.passes} PASSES · ${diagnostics.drawCalls} DRAWS`;
    syncTimelineControls();
    lastEditorRefresh = now;
  }
  window.__dataHorizonReady = true;
  requestAnimationFrame(animate);
}

if (editorMode) {
  void applyUiScale();
  bindWorkspaceEvents();
  bindEditorEvents();
  renderEditor();
}
setRuntimeProject();
requestAnimationFrame(animate);
