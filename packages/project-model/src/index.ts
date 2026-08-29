export const HORIZON_SCHEMA_VERSION = 1 as const;
export const DATA_HORIZON_VERSION = '0.20.5' as const;

export type BlendMode = 'normal' | 'add' | 'multiply' | 'screen';
export type AudioSource = 'bass' | 'mids' | 'highs' | 'beat' | 'rms';
export type BindingCurve = 'linear' | 'smoothstep' | 'exponential';
export type BindingCombine = 'add' | 'multiply' | 'max';
export type EffectType = 'celShading' | 'outline' | 'colorGrade' | 'luminanceMask' | 'regionMask' | 'paintMask' | 'paintLayer' | 'posterize' | 'bloom' | 'scanlines' | 'displacement';
export type RegionMaskPreset = 'sky' | 'horizon' | 'terrain' | 'foreground';
export type BroadcastTemplateKind = 'lower-third' | 'alert' | 'transition';
export type ProjectTemplateKind = 'blank' | 'open-broadcast-kit' | 'quartic-visualizer' | 'tempest-window-border' | 'tempest-hud-overlay' | 'tempest-transition';
export type KeyframeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'hold';
export type AnimationPreset = 'fade-in' | 'slide-in' | 'pulse' | 'fade-out';
export type LayerDropPlacement = 'before' | 'after' | 'inside' | 'root-end';

export interface HorizonAsset {
  id: string;
  name: string;
  kind: 'image';
  uri: string;
  mimeType: string;
}

export interface HorizonEffect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  parameters: Record<string, number>;
  color?: string;
  outputMode?: 'composite' | 'isolated';
  paintMask?: PaintMaskData;
  paintLayer?: PaintLayerData;
}

export interface PaintMaskPoint {
  x: number;
  y: number;
}

export interface PaintMaskStroke {
  id: string;
  mode: 'hide' | 'reveal';
  size: number;
  softness: number;
  opacity: number;
  points: PaintMaskPoint[];
}

export interface PaintMaskData {
  base: 0 | 1;
  strokes: PaintMaskStroke[];
}

export interface PaintLayerStroke {
  id: string;
  mode: 'paint' | 'erase';
  size: number;
  softness: number;
  opacity: number;
  color: string;
  points: PaintMaskPoint[];
}

export interface PaintLayerData {
  strokes: PaintLayerStroke[];
}

export interface LayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  depth: number;
  parallax: number;
  transform?: LayerTransform;
  effects: HorizonEffect[];
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  assetId: string;
  fit: 'cover' | 'contain' | 'stretch';
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  color: string;
  italic: boolean;
  letterSpacing: number;
  lineHeight: number;
  padding: number;
  backgroundColor: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowBlur: number;
}

export type HudTextPreset = 'signal-title' | 'data-label' | 'broadcast-alert';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: 'rectangle' | 'ellipse' | 'frame';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface SpectrumLayer extends BaseLayer {
  type: 'spectrum';
  bars: number;
  colorLow: string;
  colorHigh: string;
  gain: number;
  glow: number;
  mirror: boolean;
}

export interface WaveformLayer extends BaseLayer {
  type: 'waveform';
  color: string;
  amplitude: number;
  frequency: number;
  thickness: number;
  glow: number;
  mirror: boolean;
}

export interface ParticleLayer extends BaseLayer {
  type: 'particles';
  count: number;
  colorLow: string;
  colorHigh: string;
  size: number;
  speed: number;
  spread: number;
  audioGain: number;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathLayer extends BaseLayer {
  type: 'path';
  points: PathPoint[];
  color: string;
  strokeWidth: number;
  glow: number;
  dashLength: number;
  gapLength: number;
  flowSpeed: number;
  closed: boolean;
}

export interface GroupLayer extends BaseLayer {
  type: 'group';
  children: HorizonLayer[];
  linkedComposition?: LinkedComposition;
}

export interface LinkedComposition {
  sourceKind: 'file' | 'vault';
  locator: string;
  displayName: string;
  sourceProjectId: string;
  sourceRevision: number;
  sourceVersion: string;
  refreshedAt: string;
}

export interface CompositionLinkSource {
  sourceKind: LinkedComposition['sourceKind'];
  locator: string;
  displayName?: string;
}

export type HorizonLayer = ImageLayer | TextLayer | ShapeLayer | SpectrumLayer | WaveformLayer | ParticleLayer | PathLayer | GroupLayer;

export interface ParameterBinding {
  id: string;
  source: AudioSource;
  target: string;
  amount: number;
  direction: 1 | -1;
  inputMinimum: number;
  inputMaximum: number;
  outputMinimum: number;
  outputMaximum: number;
  smoothingMs: number;
  attackMs: number;
  releaseMs: number;
  curve: BindingCurve;
  combine: BindingCombine;
  enabled: boolean;
}

export interface AnimationKeyframe {
  id: string;
  time: number;
  value: number;
  easing: KeyframeEasing;
}

export interface AnimationTrack {
  id: string;
  target: string;
  name: string;
  enabled: boolean;
  keyframes: AnimationKeyframe[];
}

export interface HorizonTimeline {
  duration: number;
  fps: number;
  loop: boolean;
  tracks: AnimationTrack[];
}

export interface HorizonPalette {
  id: string;
  name: string;
  colors: [string, string, string, string];
  favorite?: boolean;
}

export interface HorizonLayerPreset {
  format: 'data-horizon.layer-preset';
  version: 1;
  id: string;
  name: string;
  description: string;
  createdWith: string;
  layer: HorizonLayer;
  assets: HorizonAsset[];
  bindings: ParameterBinding[];
  tracks: AnimationTrack[];
}

export interface ProjectGuide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
}

export interface HorizonLayerSelectionSet {
  id: string;
  name: string;
  layerIds: string[];
}

export interface HorizonProject {
  schemaVersion: typeof HORIZON_SCHEMA_VERSION;
  engineVersion: string;
  id: string;
  name: string;
  revision: number;
  canvas: {
    width: number;
    height: number;
    background: [number, number, number, number];
  };
  guides: ProjectGuide[];
  guidesLocked: boolean;
  assets: HorizonAsset[];
  layers: HorizonLayer[];
  bindings: ParameterBinding[];
  palettes: HorizonPalette[];
  timeline: HorizonTimeline;
  presets: HorizonLayerPreset[];
  layerSelectionSets: HorizonLayerSelectionSet[];
  outputs: {
    fps: number;
    colorSpace: 'srgb';
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const blendModes: BlendMode[] = ['normal', 'add', 'multiply', 'screen'];
const effectTypes: EffectType[] = ['celShading', 'outline', 'colorGrade', 'luminanceMask', 'regionMask', 'paintMask', 'paintLayer', 'posterize', 'bloom', 'scanlines', 'displacement'];
const keyframeEasings: KeyframeEasing[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'hold'];

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createProject(name = 'Untitled Horizon'): HorizonProject {
  return {
    schemaVersion: HORIZON_SCHEMA_VERSION,
    engineVersion: DATA_HORIZON_VERSION,
    id: createId('project'),
    name,
    revision: 0,
    canvas: { width: 1920, height: 1080, background: [0.006, 0.012, 0.025, 1] },
    guides: [],
    guidesLocked: false,
    assets: [],
    layers: [],
    bindings: [],
    palettes: [],
    timeline: { duration: 8, fps: 60, loop: true, tracks: [] },
    presets: [],
    layerSelectionSets: [],
    outputs: { fps: 60, colorSpace: 'srgb' }
  };
}

export function normalizeProject(project: HorizonProject): HorizonProject {
  const normalized = structuredClone(project);
  normalized.engineVersion = DATA_HORIZON_VERSION;
  normalized.guides = Array.isArray(normalized.guides) ? normalized.guides
    .filter((guide): guide is ProjectGuide => Boolean(guide && (guide.orientation === 'horizontal' || guide.orientation === 'vertical') && Number.isFinite(guide.position)))
    .map((guide) => ({
      id: typeof guide.id === 'string' && guide.id ? guide.id : createId('guide'),
      orientation: guide.orientation,
      position: Math.max(0, Math.min(guide.orientation === 'vertical' ? normalized.canvas.width : normalized.canvas.height, Number(guide.position)))
    })) : [];
  normalized.guidesLocked = normalized.guidesLocked === true;
  normalized.palettes = Array.isArray(normalized.palettes) ? normalized.palettes.map((palette) => ({
    ...palette,
    colors: palette.colors.map((color) => String(color).toUpperCase()) as [string, string, string, string]
  })) : [];
  normalized.presets = Array.isArray(normalized.presets)
    ? normalized.presets.filter((preset): preset is HorizonLayerPreset => Boolean(preset && preset.format === 'data-horizon.layer-preset' && preset.version === 1))
    : [];
  normalized.timeline ??= { duration: 8, fps: normalized.outputs?.fps ?? 60, loop: true, tracks: [] };
  normalized.timeline.duration = Math.max(.1, Number(normalized.timeline.duration) || 8);
  normalized.timeline.fps = Math.max(1, Math.round(Number(normalized.timeline.fps) || normalized.outputs?.fps || 60));
  normalized.timeline.loop = normalized.timeline.loop !== false;
  normalized.timeline.tracks = Array.isArray(normalized.timeline.tracks) ? normalized.timeline.tracks : [];
  for (const track of normalized.timeline.tracks) {
    track.enabled = track.enabled !== false;
    track.keyframes = Array.isArray(track.keyframes) ? track.keyframes : [];
    for (const keyframe of track.keyframes) {
      if (!['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'hold'].includes(keyframe.easing)) keyframe.easing = 'easeInOut';
      keyframe.time = Math.max(0, Number(keyframe.time) || 0);
      keyframe.value = Number(keyframe.value) || 0;
    }
    track.keyframes.sort((left, right) => left.time - right.time);
  }
  const normalizeLayers = (layers: HorizonLayer[]): void => {
    for (const layer of layers) {
      layer.locked = layer.locked === true;
      if (layer.type === 'text') {
        layer.verticalAlignment ??= 'middle';
        layer.italic ??= false;
        layer.letterSpacing = Number.isFinite(layer.letterSpacing) ? layer.letterSpacing : 0;
        layer.lineHeight = Number.isFinite(layer.lineHeight) ? Math.max(.5, layer.lineHeight) : 1.15;
        layer.padding = Number.isFinite(layer.padding) ? Math.max(0, layer.padding) : 24;
        layer.backgroundColor ??= '#07131F';
        layer.backgroundOpacity = Number.isFinite(layer.backgroundOpacity) ? Math.max(0, Math.min(1, layer.backgroundOpacity)) : 0;
        layer.borderColor ??= '#49E4E1';
        layer.borderWidth = Number.isFinite(layer.borderWidth) ? Math.max(0, layer.borderWidth) : 0;
        layer.cornerRadius = Number.isFinite(layer.cornerRadius) ? Math.max(0, layer.cornerRadius) : 18;
        layer.outlineColor ??= '#031018';
        layer.outlineWidth = Number.isFinite(layer.outlineWidth) ? Math.max(0, layer.outlineWidth) : 0;
        layer.shadowColor ??= '#49E4E1';
        layer.shadowBlur = Number.isFinite(layer.shadowBlur) ? Math.max(0, layer.shadowBlur) : 0;
      }
      for (const effect of layer.effects ?? []) {
        if (effect.type === 'outline') {
          effect.parameters.strength = Number.isFinite(effect.parameters.strength) ? effect.parameters.strength : .8;
          effect.parameters.threshold = Number.isFinite(effect.parameters.threshold) ? effect.parameters.threshold : .18;
          effect.parameters.thickness = Number.isFinite(effect.parameters.thickness) ? Math.max(.25, effect.parameters.thickness) : 1;
          effect.parameters.softness = Number.isFinite(effect.parameters.softness) ? Math.max(.001, effect.parameters.softness) : .18;
          effect.color = /^#[0-9a-f]{6}$/i.test(effect.color ?? '') ? effect.color?.toUpperCase() : '#19DBFF';
          effect.outputMode = effect.outputMode === 'isolated' ? 'isolated' : 'composite';
        }
        if (effect.type === 'paintLayer') {
          effect.parameters.opacity = Number.isFinite(effect.parameters.opacity) ? Math.max(0, Math.min(1, effect.parameters.opacity)) : 1;
          effect.paintLayer ??= { strokes: [] };
          effect.paintLayer.strokes = Array.isArray(effect.paintLayer.strokes) ? effect.paintLayer.strokes : [];
          for (const stroke of effect.paintLayer.strokes) {
            stroke.color = /^#[0-9a-f]{6}$/i.test(stroke.color ?? '') ? stroke.color.toUpperCase() : '#19DBFF';
          }
        }
        if (effect.type !== 'paintMask') continue;
        effect.paintMask ??= { base: 1, strokes: [] };
        effect.paintMask.base = effect.paintMask.base === 0 ? 0 : 1;
        effect.paintMask.strokes = Array.isArray(effect.paintMask.strokes) ? effect.paintMask.strokes : [];
      }
      if (layer.type === 'group') normalizeLayers(layer.children);
    }
  };
  normalizeLayers(normalized.layers);
  const availableLayerIds = new Set(flattenLayers(normalized.layers).map((layer) => layer.id));
  normalized.layerSelectionSets = (Array.isArray(normalized.layerSelectionSets) ? normalized.layerSelectionSets : [])
    .filter((set): set is HorizonLayerSelectionSet => Boolean(set && typeof set === 'object'))
    .map((set, index) => ({
      id: typeof set.id === 'string' && set.id ? set.id : createId('selection-set'),
      name: String(set.name || `Selection Set ${index + 1}`).trim().slice(0, 80) || `Selection Set ${index + 1}`,
      layerIds: Array.from(new Set(Array.isArray(set.layerIds) ? set.layerIds.filter((id): id is string => typeof id === 'string' && availableLayerIds.has(id)) : []))
    }))
    .filter((set) => set.layerIds.length > 0)
    .slice(0, 32);
  for (const preset of normalized.presets) {
    preset.name = String(preset.name || preset.layer?.name || 'Layer Preset').slice(0, 80);
    preset.description = String(preset.description || '').slice(0, 240);
    preset.createdWith = String(preset.createdWith || normalized.engineVersion);
    preset.assets = Array.isArray(preset.assets) ? preset.assets : [];
    preset.bindings = Array.isArray(preset.bindings) ? preset.bindings : [];
    preset.tracks = Array.isArray(preset.tracks) ? preset.tracks : [];
    if (preset.layer) normalizeLayers([preset.layer]);
  }
  return normalized;
}

export function createImageLayer(assetId: string, name = 'Image'): ImageLayer {
  return {
    id: createId('layer'),
    name,
    type: 'image',
    assetId,
    fit: 'cover',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    depth: 0,
    parallax: 0,
    transform: { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 },
    effects: []
  };
}

export function createGroupLayer(name = 'Group', children: HorizonLayer[] = []): GroupLayer {
  return {
    id: createId('group'),
    name,
    type: 'group',
    children,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    depth: 0,
    parallax: 0,
    transform: { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 },
    effects: []
  };
}

function elementDefaults(name: string): Omit<BaseLayer, 'id' | 'name'> & { name: string } {
  return {
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    depth: 0,
    parallax: 0,
    transform: { x: 960, y: 540, width: 800, height: 240, rotation: 0 },
    effects: []
  };
}

export function createTextLayer(text = 'SIGNAL ONLINE', name = 'Text'): TextLayer {
  return {
    id: createId('text'),
    type: 'text',
    ...elementDefaults(name),
    text,
    fontFamily: 'Segoe UI',
    fontSize: 112,
    fontWeight: 700,
    alignment: 'center',
    verticalAlignment: 'middle',
    color: '#D8FBFF',
    italic: false,
    letterSpacing: 0,
    lineHeight: 1.15,
    padding: 24,
    backgroundColor: '#07131F',
    backgroundOpacity: 0,
    borderColor: '#49E4E1',
    borderWidth: 0,
    cornerRadius: 18,
    outlineColor: '#031018',
    outlineWidth: 0,
    shadowColor: '#49E4E1',
    shadowBlur: 0
  };
}

export function createHudTextLayer(preset: HudTextPreset = 'signal-title'): TextLayer {
  const layer = createTextLayer();
  if (preset === 'data-label') {
    layer.name = 'HUD Data Label';
    layer.text = 'SIGNAL 01 // NOMINAL';
    layer.fontFamily = 'Cascadia Mono';
    layer.fontSize = 32;
    layer.fontWeight = 700;
    layer.alignment = 'left';
    layer.letterSpacing = 3;
    layer.padding = 22;
    layer.backgroundOpacity = .72;
    layer.borderWidth = 2;
    layer.cornerRadius = 6;
    layer.shadowBlur = 12;
    layer.transform = { x: 430, y: 166, width: 680, height: 88, rotation: 0 };
    return layer;
  }
  if (preset === 'broadcast-alert') {
    layer.name = 'HUD Broadcast Alert';
    layer.text = 'SIGNAL ACQUIRED\nNEW EVENT DETECTED';
    layer.fontSize = 58;
    layer.fontWeight = 800;
    layer.letterSpacing = 4;
    layer.lineHeight = 1.3;
    layer.padding = 42;
    layer.backgroundColor = '#080D19';
    layer.backgroundOpacity = .9;
    layer.borderWidth = 5;
    layer.cornerRadius = 22;
    layer.outlineWidth = 2;
    layer.shadowBlur = 18;
    layer.transform = { x: 960, y: 540, width: 880, height: 300, rotation: 0 };
    return layer;
  }
  layer.name = 'HUD Signal Title';
  layer.text = 'DATA HORIZON // SIGNAL ONLINE';
  layer.fontSize = 72;
  layer.fontWeight = 800;
  layer.letterSpacing = 7;
  layer.padding = 32;
  layer.backgroundOpacity = .58;
  layer.borderWidth = 2;
  layer.cornerRadius = 10;
  layer.shadowBlur = 18;
  layer.transform = { x: 960, y: 122, width: 1420, height: 132, rotation: 0 };
  return layer;
}

export function createShapeLayer(shape: ShapeLayer['shape'] = 'rectangle', name = 'Shape'): ShapeLayer {
  const layer: ShapeLayer = {
    id: createId('shape'),
    type: 'shape',
    ...elementDefaults(name),
    shape,
    fill: shape === 'frame' ? '#00000000' : '#071621CC',
    stroke: '#49E4E1',
    strokeWidth: shape === 'frame' ? 12 : 4,
    cornerRadius: 24
  };
  if (shape === 'frame') layer.transform = { x: 960, y: 540, width: 1840, height: 1000, rotation: 0 };
  return layer;
}

export function createSpectrumLayer(name = 'Audio Spectrum'): SpectrumLayer {
  const layer: SpectrumLayer = {
    id: createId('spectrum'),
    type: 'spectrum',
    ...elementDefaults(name),
    bars: 48,
    colorLow: '#9585FF',
    colorHigh: '#49E4E1',
    gain: 1,
    glow: 0.55,
    mirror: false
  };
  layer.transform = { x: 960, y: 820, width: 1200, height: 320, rotation: 0 };
  return layer;
}

export function createWaveformLayer(name = 'Audio Waveform'): WaveformLayer {
  const layer: WaveformLayer = {
    id: createId('waveform'),
    type: 'waveform',
    ...elementDefaults(name),
    color: '#49E4E1',
    amplitude: 0.3,
    frequency: 3.5,
    thickness: 0.018,
    glow: 0.65,
    mirror: false
  };
  layer.transform = { x: 960, y: 835, width: 1460, height: 250, rotation: 0 };
  return layer;
}

export function createParticleLayer(name = 'Signal Particles'): ParticleLayer {
  const layer: ParticleLayer = {
    id: createId('particles'),
    type: 'particles',
    ...elementDefaults(name),
    count: 72,
    colorLow: '#9585FF',
    colorHigh: '#49E4E1',
    size: 0.17,
    speed: 0.22,
    spread: 0.85,
    audioGain: 0.75
  };
  layer.transform = { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 };
  layer.blendMode = 'screen';
  return layer;
}

export function createPathLayer(name = 'Data Flow Path'): PathLayer {
  const layer: PathLayer = {
    id: createId('path'),
    type: 'path',
    ...elementDefaults(name),
    points: [{ x: .08, y: .72 }, { x: .3, y: .3 }, { x: .58, y: .62 }, { x: .92, y: .18 }],
    color: '#49E4E1',
    strokeWidth: 8,
    glow: .7,
    dashLength: 84,
    gapLength: 34,
    flowSpeed: 140,
    closed: false
  };
  layer.transform = { x: 960, y: 540, width: 1480, height: 700, rotation: 0 };
  layer.blendMode = 'screen';
  return layer;
}

export function createBroadcastTemplate(kind: BroadcastTemplateKind): GroupLayer {
  if (kind === 'lower-third') {
    const plate = createShapeLayer('rectangle', 'Lower Third Plate');
    plate.transform = { x: 420, y: 892, width: 690, height: 142, rotation: 0 };
    plate.fill = '#07131FEC';
    plate.strokeWidth = 3;
    const accent = createShapeLayer('rectangle', 'Lower Third Accent');
    accent.transform = { x: 94, y: 892, width: 24, height: 142, rotation: 0 };
    accent.fill = '#49E4E1FF';
    accent.strokeWidth = 0;
    const title = createTextLayer('CREATOR NAME', 'Lower Third Title');
    title.transform = { x: 410, y: 864, width: 590, height: 62, rotation: 0 };
    title.alignment = 'left';
    title.fontSize = 62;
    const subtitle = createTextLayer('QUARTIC PULSE // LIVE', 'Lower Third Subtitle');
    subtitle.transform = { x: 410, y: 922, width: 590, height: 42, rotation: 0 };
    subtitle.alignment = 'left';
    subtitle.fontSize = 34;
    subtitle.color = '#9585FF';
    return createGroupLayer('Lower Third', [title, subtitle, accent, plate]);
  }
  if (kind === 'alert') {
    const plate = createShapeLayer('rectangle', 'Alert Plate');
    plate.transform = { x: 960, y: 540, width: 760, height: 290, rotation: 0 };
    plate.fill = '#080D19F0';
    plate.strokeWidth = 6;
    plate.effects.push(createEffect('bloom'));
    const title = createTextLayer('SIGNAL ACQUIRED', 'Alert Title');
    title.transform = { x: 960, y: 500, width: 650, height: 90, rotation: 0 };
    title.fontSize = 76;
    const detail = createTextLayer('NEW EVENT DETECTED', 'Alert Detail');
    detail.transform = { x: 960, y: 580, width: 600, height: 48, rotation: 0 };
    detail.fontSize = 34;
    detail.color = '#9585FF';
    const pulse = createWaveformLayer('Alert Pulse');
    pulse.transform = { x: 960, y: 645, width: 600, height: 70, rotation: 0 };
    pulse.amplitude = 0.18;
    return createGroupLayer('Broadcast Alert', [title, detail, pulse, plate]);
  }
  const particles = createParticleLayer('Transition Particles');
  particles.count = 96;
  particles.speed = 0.7;
  particles.size = 0.28;
  const field = createShapeLayer('rectangle', 'Transition Field');
  field.transform = { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 };
  field.fill = '#060A17F2';
  field.strokeWidth = 0;
  field.effects.push(createEffect('scanlines'), createEffect('displacement'));
  const title = createTextLayer('DATA HORIZON', 'Transition Title');
  title.transform = { x: 960, y: 540, width: 1200, height: 180, rotation: 0 };
  title.fontSize = 132;
  title.effects.push(createEffect('bloom'));
  return createGroupLayer('Signal Transition', [title, particles, field]);
}

export function createProjectTemplate(kind: ProjectTemplateKind, requestedName = ''): HorizonProject {
  const names: Record<ProjectTemplateKind, string> = {
    blank: 'Untitled Horizon',
    'open-broadcast-kit': 'Open Broadcast Kit',
    'quartic-visualizer': 'Quartic Pulse Visualizer',
    'tempest-window-border': 'Tempest Window Border',
    'tempest-hud-overlay': 'Tempest HUD Overlay',
    'tempest-transition': 'Tempest Signal Transition'
  };
  let project = createProject(requestedName.trim().slice(0, 80) || names[kind]);
  if (kind === 'blank') return project;

  const bind = (source: AudioSource, target: string, amount: number): void => {
    project.bindings.push({
      id: createId('binding'), source, target, amount, direction: 1,
      inputMinimum: 0, inputMaximum: 1, outputMinimum: 0, outputMaximum: 1,
      smoothingMs: 70, attackMs: 45, releaseMs: 220,
      curve: 'smoothstep', combine: 'add', enabled: true
    });
  };

  if (kind === 'open-broadcast-kit') {
    const ink = '#11141BEE';
    const panel = '#191E29E8';
    const line = '#4C8DFF';
    const accent = '#FFB45A';
    const detail = '#F4F7FC';
    project.canvas.background = [0, 0, 0, 0];
    project.palettes = [{ id: 'open-broadcast-neutral', name: 'Open Broadcast Neutral', colors: ['#11141B', '#242C3B', line, accent], favorite: true }];

    const frame = createShapeLayer('frame', 'Reactive Canvas Frame');
    frame.stroke = line;
    frame.strokeWidth = 7;
    frame.cornerRadius = 28;
    const frameBloom = createEffect('bloom');
    frameBloom.parameters.intensity = .42;
    frame.effects.push(frameBloom);

    const alertPlate = createShapeLayer('rectangle', 'Alert Surface');
    alertPlate.transform = { x: 850, y: 180, width: 760, height: 190, rotation: 0 };
    alertPlate.fill = panel;
    alertPlate.stroke = accent;
    alertPlate.strokeWidth = 4;
    alertPlate.cornerRadius = 22;
    const alertBloom = createEffect('bloom');
    alertBloom.parameters.intensity = .5;
    alertPlate.effects.push(alertBloom);
    const alertKicker = createTextLayer('COMMUNITY EVENT', 'Alert Category');
    alertKicker.transform = { x: 850, y: 132, width: 660, height: 38, rotation: 0 };
    alertKicker.fontFamily = 'Cascadia Mono';
    alertKicker.fontSize = 25;
    alertKicker.fontWeight = 700;
    alertKicker.letterSpacing = 4;
    alertKicker.color = accent;
    const alertTitle = createTextLayer('NEW SUPPORTER', 'Alert Message');
    alertTitle.transform = { x: 850, y: 190, width: 660, height: 72, rotation: 0 };
    alertTitle.fontSize = 58;
    alertTitle.color = detail;
    const alertWave = createWaveformLayer('Alert Activity');
    alertWave.transform = { x: 850, y: 244, width: 650, height: 42, rotation: 0 };
    alertWave.color = accent;
    alertWave.amplitude = .16;
    const alert = createGroupLayer('Open Event Alert', [alertKicker, alertTitle, alertWave, alertPlate]);

    const chatBody = createShapeLayer('rectangle', 'Chat Surface');
    chatBody.transform = { x: 1592, y: 564, width: 520, height: 700, rotation: 0 };
    chatBody.fill = ink;
    chatBody.stroke = line;
    chatBody.strokeWidth = 4;
    chatBody.cornerRadius = 24;
    const chatHeader = createShapeLayer('rectangle', 'Chat Header Surface');
    chatHeader.transform = { x: 1592, y: 252, width: 520, height: 76, rotation: 0 };
    chatHeader.fill = '#242C3BFA';
    chatHeader.stroke = line;
    chatHeader.strokeWidth = 3;
    chatHeader.cornerRadius = 20;
    const chatTitle = createTextLayer('LIVE CHAT', 'Chat Heading');
    chatTitle.transform = { x: 1592, y: 252, width: 440, height: 54, rotation: 0 };
    chatTitle.fontFamily = 'Cascadia Mono';
    chatTitle.fontSize = 32;
    chatTitle.letterSpacing = 5;
    chatTitle.color = detail;
    const chatHint = createTextLayer('Messages render behind this editable shell', 'Chat Integration Note');
    chatHint.transform = { x: 1592, y: 530, width: 420, height: 150, rotation: 0 };
    chatHint.fontSize = 28;
    chatHint.fontWeight = 500;
    chatHint.lineHeight = 1.35;
    chatHint.color = '#AAB7CB';
    const chatActivity = createWaveformLayer('Chat Voice Activity');
    chatActivity.transform = { x: 1592, y: 856, width: 420, height: 72, rotation: 0 };
    chatActivity.color = line;
    chatActivity.amplitude = .2;
    const chat = createGroupLayer('Open Chat Panel', [chatTitle, chatHint, chatActivity, chatHeader, chatBody]);

    const lowerPlate = createShapeLayer('rectangle', 'Lower Third Surface');
    lowerPlate.transform = { x: 410, y: 862, width: 700, height: 154, rotation: 0 };
    lowerPlate.fill = panel;
    lowerPlate.stroke = line;
    lowerPlate.strokeWidth = 3;
    lowerPlate.cornerRadius = 20;
    const lowerAccent = createShapeLayer('rectangle', 'Lower Third Accent');
    lowerAccent.transform = { x: 82, y: 862, width: 22, height: 154, rotation: 0 };
    lowerAccent.fill = accent;
    lowerAccent.strokeWidth = 0;
    lowerAccent.cornerRadius = 10;
    const lowerName = createTextLayer('CREATOR NAME', 'Lower Third Name');
    lowerName.transform = { x: 405, y: 836, width: 590, height: 64, rotation: 0 };
    lowerName.alignment = 'left';
    lowerName.fontSize = 50;
    lowerName.color = detail;
    const lowerRole = createTextLayer('CHANNEL // LIVE', 'Lower Third Detail');
    lowerRole.transform = { x: 405, y: 894, width: 590, height: 40, rotation: 0 };
    lowerRole.alignment = 'left';
    lowerRole.fontFamily = 'Cascadia Mono';
    lowerRole.fontSize = 26;
    lowerRole.letterSpacing = 3;
    lowerRole.color = accent;
    const lowerThird = createGroupLayer('Open Lower Third', [lowerName, lowerRole, lowerAccent, lowerPlate]);

    const meterPlate = createShapeLayer('rectangle', 'Meter Surface');
    meterPlate.transform = { x: 790, y: 1010, width: 1120, height: 74, rotation: 0 };
    meterPlate.fill = ink;
    meterPlate.stroke = '#59657A';
    meterPlate.strokeWidth = 2;
    meterPlate.cornerRadius = 18;
    const spectrum = createSpectrumLayer('Program Audio Spectrum');
    spectrum.transform = { x: 790, y: 1008, width: 980, height: 50, rotation: 0 };
    spectrum.bars = 64;
    spectrum.colorLow = line;
    spectrum.colorHigh = accent;
    spectrum.gain = .72;
    spectrum.glow = .4;
    const meter = createGroupLayer('Open Audio Meter', [spectrum, meterPlate]);

    project.layers = [alert, chat, lowerThird, meter, frame];
    bind('beat', `layer.${frame.id}.source.strokeWidth`, 3);
    bind('highs', `layer.${frame.id}.effect.${frameBloom.id}.intensity`, .38);
    bind('beat', `layer.${alertPlate.id}.effect.${alertBloom.id}.intensity`, .7);
    bind('rms', `layer.${alertWave.id}.source.amplitude`, .42);
    bind('mids', `layer.${chatActivity.id}.source.amplitude`, .34);
    bind('bass', `layer.${lowerAccent.id}.transform.width`, 18);
    bind('bass', `layer.${spectrum.id}.source.gain`, .8);
    bind('highs', `layer.${spectrum.id}.source.glow`, .45);
    project = applyAnimationPreset(project, alert.id, 'fade-in');
    project = applyAnimationPreset(project, lowerThird.id, 'slide-in');

    const presetDescriptions = new Map<string, string>([
      [frame.id, 'Full-canvas border with editable beat thickness and high-frequency glow routes.'],
      [alert.id, 'Neutral supporter alert with editable typography, waveform, surfaces, animation, and audio response.'],
      [chat.id, 'Portrait-friendly chat shell designed to sit above or around a separate browser-chat source.'],
      [lowerThird.id, 'Two-line identity plate with an audio-reactive accent rail and entrance animation.'],
      [meter.id, 'Compact program-audio spectrum with independent bass gain and high-frequency glow routes.']
    ]);
    project.presets = project.layers
      .map((layer) => createLayerPreset(project, layer.id, layer.name, presetDescriptions.get(layer.id)))
      .filter((preset): preset is HorizonLayerPreset => Boolean(preset));
    return project;
  }

  if (kind === 'quartic-visualizer') {
    const title = createHudTextLayer('signal-title');
    const frame = createShapeLayer('frame', 'Visualizer Frame');
    const frameBloom = createEffect('bloom');
    frame.effects.push(frameBloom);
    const path = createPathLayer('High Frequency Data Route');
    const waveform = createWaveformLayer('Signal Waveform');
    waveform.transform = { x: 960, y: 700, width: 1480, height: 190, rotation: 0 };
    const spectrum = createSpectrumLayer('Bass Architecture');
    const particles = createParticleLayer('Signal Atmosphere');
    particles.opacity = .64;
    project.layers = [title, frame, path, waveform, spectrum, particles];
    project.palettes = [{ id: 'data-horizon-signal', name: 'Data Horizon Signal', colors: ['#040813', '#10234A', '#9585FF', '#49E4E1'], favorite: true }];
    bind('beat', `layer.${title.id}.opacity`, .18);
    bind('beat', `layer.${frame.id}.effect.${frameBloom.id}.intensity`, .42);
    bind('highs', `layer.${path.id}.source.flowSpeed`, 180);
    bind('rms', `layer.${waveform.id}.source.amplitude`, .35);
    bind('bass', `layer.${spectrum.id}.source.gain`, .7);
    bind('mids', `layer.${particles.id}.source.speed`, .3);
    project = applyAnimationPreset(project, title.id, 'slide-in');
    project = applyAnimationPreset(project, waveform.id, 'pulse');
    return project;
  }

  project.canvas.background = [0, 0, 0, kind === 'tempest-transition' ? 1 : 0];
  if (kind === 'tempest-window-border') {
    const frame = createShapeLayer('frame', 'Broadcast Window Border');
    frame.strokeWidth = 10;
    const bloom = createEffect('bloom');
    frame.effects.push(bloom);
    const status = createHudTextLayer('data-label');
    status.name = 'Top Signal Status';
    status.transform = { x: 380, y: 82, width: 620, height: 82, rotation: 0 };
    const channel = createHudTextLayer('data-label');
    channel.name = 'Bottom Channel Label';
    channel.text = 'TEMPEST BROADCAST // LIVE';
    channel.alignment = 'right';
    channel.transform = { x: 1535, y: 998, width: 650, height: 82, rotation: 0 };
    const route = createPathLayer('Border Data Route');
    route.transform = { x: 960, y: 540, width: 1780, height: 930, rotation: 0 };
    route.points = [{ x: .02, y: .14 }, { x: .22, y: .03 }, { x: .78, y: .03 }, { x: .98, y: .14 }];
    project.layers = [status, channel, route, frame];
    bind('beat', `layer.${frame.id}.source.strokeWidth`, 5);
    bind('highs', `layer.${frame.id}.effect.${bloom.id}.intensity`, .45);
    bind('highs', `layer.${route.id}.source.flowSpeed`, 160);
    project = applyAnimationPreset(project, status.id, 'slide-in');
    return project;
  }

  if (kind === 'tempest-hud-overlay') {
    const title = createHudTextLayer('signal-title');
    title.transform = { x: 960, y: 105, width: 1360, height: 120, rotation: 0 };
    const lowerThird = createBroadcastTemplate('lower-third');
    const spectrum = createSpectrumLayer('HUD Spectrum');
    spectrum.transform = { x: 1350, y: 860, width: 860, height: 240, rotation: 0 };
    const route = createPathLayer('Overlay Data Route');
    route.transform = { x: 960, y: 540, width: 1500, height: 620, rotation: 0 };
    project.layers = [title, lowerThird, route, spectrum];
    bind('beat', `layer.${title.id}.opacity`, .2);
    bind('highs', `layer.${route.id}.source.flowSpeed`, 190);
    bind('bass', `layer.${spectrum.id}.source.gain`, .75);
    project = applyAnimationPreset(project, title.id, 'slide-in');
    project = applyAnimationPreset(project, lowerThird.id, 'fade-in');
    return project;
  }

  const transition = createBroadcastTemplate('transition');
  const transitionParticles = flattenLayers([transition]).find((layer) => layer.type === 'particles');
  project.layers = [transition];
  bind('beat', `layer.${transition.id}.opacity`, .25);
  if (transitionParticles) bind('highs', `layer.${transitionParticles.id}.source.speed`, .45);
  project = applyAnimationPreset(project, transition.id, 'fade-in');
  return project;
}

export function createEffect(type: EffectType): HorizonEffect {
  const definitions: Record<EffectType, { name: string; parameters: Record<string, number> }> = {
    celShading: { name: 'Cel Shading', parameters: { levels: 5, intensity: 1 } },
    outline: { name: 'Outline', parameters: { strength: 0.8, threshold: 0.18, thickness: 1, softness: 0.18 } },
    colorGrade: { name: 'Color Grade', parameters: { contrast: 1.08, saturation: 1.12, warmth: 0 } },
    luminanceMask: { name: 'Luminance Mask', parameters: { threshold: 0.35, feather: 0.18, invert: 0 } },
    regionMask: { name: 'Vertical Region Mask', parameters: { top: 0.36, bottom: 0.68, feather: 0.05, invert: 0 } },
    paintMask: { name: 'Painted Mask', parameters: { opacity: 1, invert: 0 } },
    paintLayer: { name: 'Paint / Erase', parameters: { opacity: 1 } },
    posterize: { name: 'Posterize', parameters: { levels: 6, intensity: 1 } },
    bloom: { name: 'Bloom', parameters: { threshold: 0.55, intensity: 0.65, radius: 0.45 } },
    scanlines: { name: 'Scanlines', parameters: { density: 420, intensity: 0.2, speed: 0.15 } },
    displacement: { name: 'Displacement', parameters: { amount: 0.08, speed: 0.35 } }
  };
  const definition = definitions[type];
  const effect: HorizonEffect = {
    id: createId('effect'),
    type,
    name: definition.name,
    enabled: true,
    parameters: { ...definition.parameters }
  };
  if (type === 'paintMask') effect.paintMask = { base: 1, strokes: [] };
  if (type === 'paintLayer') effect.paintLayer = { strokes: [] };
  if (type === 'outline') {
    effect.color = '#19DBFF';
    effect.outputMode = 'composite';
  }
  return effect;
}

export function createPaintMask(base: 0 | 1 = 1): HorizonEffect {
  const effect = createEffect('paintMask');
  effect.paintMask = { base, strokes: [] };
  effect.name = base === 1 ? 'Painted Mask · Reveal All' : 'Painted Mask · Hide All';
  return effect;
}

export function createPaintLayer(): HorizonEffect {
  const effect = createEffect('paintLayer');
  effect.paintLayer = { strokes: [] };
  return effect;
}

export function createRegionMask(preset: RegionMaskPreset): HorizonEffect {
  const ranges: Record<RegionMaskPreset, [number, number, number]> = {
    sky: [0, 0.52, 0.06],
    horizon: [0.36, 0.66, 0.06],
    terrain: [0.48, 0.86, 0.07],
    foreground: [0.7, 1, 0.08]
  };
  const effect = createEffect('regionMask');
  const [top, bottom, feather] = ranges[preset];
  effect.name = `${preset[0].toUpperCase()}${preset.slice(1)} Region`;
  effect.parameters = { top, bottom, feather, invert: 0 };
  return effect;
}

export function cloneProject(project: HorizonProject): HorizonProject {
  return structuredClone(project);
}

function findInLayers(layers: HorizonLayer[], id: string): HorizonLayer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.type === 'group') {
      const nested = findInLayers(layer.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function findLayer(project: HorizonProject, id: string): HorizonLayer | undefined {
  return findInLayers(project.layers, id);
}

interface LayerLocation {
  container: HorizonLayer[];
  index: number;
}

function locateLayer(layers: HorizonLayer[], id: string): LayerLocation | undefined {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index >= 0) return { container: layers, index };
  for (const layer of layers) {
    if (layer.type !== 'group') continue;
    const nested = locateLayer(layer.children, id);
    if (nested) return nested;
  }
  return undefined;
}

export function mutateProject(project: HorizonProject, mutation: (draft: HorizonProject) => void): HorizonProject {
  const draft = cloneProject(project);
  mutation(draft);
  draft.revision = project.revision + 1;
  return draft;
}

export function addLayer(project: HorizonProject, layer: HorizonLayer, parentId?: string): HorizonProject {
  return mutateProject(project, (draft) => {
    if (parentId) {
      const parent = findLayer(draft, parentId);
      if (parent?.type === 'group') {
        parent.children.unshift(layer);
        return;
      }
    }
    draft.layers.unshift(layer);
  });
}

function refreshIds(layer: HorizonLayer): HorizonLayer {
  const copy = structuredClone(layer);
  copy.id = createId(copy.type === 'group' ? 'group' : 'layer');
  copy.name = `${copy.name} Copy`;
  copy.effects = copy.effects.map((effect) => ({
    ...effect,
    id: createId('effect'),
    paintMask: effect.paintMask ? { ...effect.paintMask, strokes: effect.paintMask.strokes.map((stroke) => ({ ...stroke, id: createId('stroke') })) } : undefined,
    paintLayer: effect.paintLayer ? { ...effect.paintLayer, strokes: effect.paintLayer.strokes.map((stroke) => ({ ...stroke, id: createId('stroke') })) } : undefined
  }));
  if (copy.type === 'group') copy.children = copy.children.map(refreshIds);
  return copy;
}

function duplicateAnimationTracks(project: HorizonProject, source: HorizonLayer, copy: HorizonLayer): void {
  const pairs: Array<[HorizonLayer, HorizonLayer]> = [[source, copy]];
  if (source.type === 'group' && copy.type === 'group') {
    for (let index = 0; index < source.children.length; index += 1) {
      const sourceChild = source.children[index];
      const copyChild = copy.children[index];
      if (sourceChild && copyChild) duplicateAnimationTracks(project, sourceChild, copyChild);
    }
  }
  for (const [original, duplicate] of pairs) {
    const prefix = `layer.${original.id}.`;
    const tracks = project.timeline.tracks.filter((track) => track.target.startsWith(prefix));
    for (const track of tracks) {
      let target = `layer.${duplicate.id}.${track.target.slice(prefix.length)}`;
      for (let index = 0; index < original.effects.length; index += 1) {
        const originalEffect = original.effects[index];
        const duplicateEffect = duplicate.effects[index];
        if (originalEffect && duplicateEffect) target = target.replace(`.effect.${originalEffect.id}.`, `.effect.${duplicateEffect.id}.`);
      }
      project.timeline.tracks.push({
        ...structuredClone(track),
        enabled: track.enabled !== false,
        id: createId('track'),
        target,
        keyframes: track.keyframes.map((keyframe) => ({ ...structuredClone(keyframe), id: createId('keyframe') }))
      });
    }
  }
}

export function duplicateLayer(project: HorizonProject, layerId: string): { project: HorizonProject; selectedId?: string } {
  let selectedId: string | undefined;
  const next = mutateProject(project, (draft) => {
    const location = locateLayer(draft.layers, layerId);
    if (!location) return;
    const copy = refreshIds(location.container[location.index]);
    duplicateAnimationTracks(draft, location.container[location.index], copy);
    selectedId = copy.id;
    location.container.splice(location.index, 0, copy);
  });
  return { project: next, selectedId };
}

export function extractEffectToLayer(project: HorizonProject, layerId: string, effectId: string): { project: HorizonProject; selectedId?: string; effectId?: string } {
  let selectedId: string | undefined;
  let extractedEffectId: string | undefined;
  const next = mutateProject(project, (draft) => {
    const location = locateLayer(draft.layers, layerId);
    if (!location) return;
    const source = location.container[location.index];
    const sourceEffectIndex = source.effects.findIndex((effect) => effect.id === effectId);
    if (sourceEffectIndex < 0) return;
    const copy = refreshIds(source);
    detachLayerCompositionLinks(copy);
    const copiedEffect = copy.effects[sourceEffectIndex];
    if (!copiedEffect) return;

    const layerIds = new Map<string, string>();
    const effectIds = new Map<string, string>();
    const mapTrees = (original: HorizonLayer, duplicate: HorizonLayer): void => {
      layerIds.set(original.id, duplicate.id);
      for (let index = 0; index < original.effects.length; index += 1) {
        const originalEffect = original.effects[index];
        const duplicateEffect = duplicate.effects[index];
        if (originalEffect && duplicateEffect) effectIds.set(originalEffect.id, duplicateEffect.id);
      }
      if (original.type === 'group' && duplicate.type === 'group') {
        for (let index = 0; index < original.children.length; index += 1) {
          const originalChild = original.children[index];
          const duplicateChild = duplicate.children[index];
          if (originalChild && duplicateChild) mapTrees(originalChild, duplicateChild);
        }
      }
    };
    mapTrees(source, copy);

    source.effects.splice(sourceEffectIndex, 1);
    copy.name = `${source.name} · ${copiedEffect.name}`;
    copy.blendMode = copiedEffect.type === 'outline' ? 'screen' : source.blendMode;
    copy.effects = [copiedEffect];
    if (copiedEffect.type === 'outline') copiedEffect.outputMode = 'isolated';
    selectedId = copy.id;
    extractedEffectId = copiedEffect.id;
    location.container.splice(location.index, 0, copy);

    const remap = (target: string): string => remapPresetTarget(target, layerIds, effectIds);
    const sourceLayerIds = new Set(layerIds.keys());
    const sourceEffectPrefix = `layer.${source.id}.effect.${effectId}.`;
    for (const binding of [...draft.bindings]) {
      if (binding.target.startsWith(sourceEffectPrefix)) {
        binding.target = remap(binding.target);
        continue;
      }
      const targetLayerId = binding.target.split('.')[1];
      const isRetainedChild = targetLayerId !== source.id && sourceLayerIds.has(targetLayerId);
      const isLayerParameter = targetLayerId === source.id && binding.target.split('.')[2] !== 'effect';
      if (isRetainedChild || isLayerParameter) draft.bindings.push({ ...structuredClone(binding), id: createId('binding'), target: remap(binding.target) });
    }
    for (const track of [...draft.timeline.tracks]) {
      if (track.target.startsWith(sourceEffectPrefix)) {
        track.target = remap(track.target);
        continue;
      }
      const targetLayerId = track.target.split('.')[1];
      const isRetainedChild = targetLayerId !== source.id && sourceLayerIds.has(targetLayerId);
      const isLayerParameter = targetLayerId === source.id && track.target.split('.')[2] !== 'effect';
      if (isRetainedChild || isLayerParameter) {
        draft.timeline.tracks.push({
          ...structuredClone(track),
          id: createId('track'),
          target: remap(track.target),
          keyframes: track.keyframes.map((keyframe) => ({ ...structuredClone(keyframe), id: createId('keyframe') }))
        });
      }
    }
  });
  return { project: next, selectedId, effectId: extractedEffectId };
}

export function removeLayer(project: HorizonProject, layerId: string): HorizonProject {
  return mutateProject(project, (draft) => {
    const location = locateLayer(draft.layers, layerId);
    if (!location) return;
    const removed = location.container[location.index];
    const removedIds = new Set(flattenLayers([removed]).map((layer) => layer.id));
    location.container.splice(location.index, 1);
    draft.bindings = draft.bindings.filter((binding) => !removedIds.has(binding.target.split('.')[1]));
    draft.timeline.tracks = draft.timeline.tracks.filter((track) => !removedIds.has(track.target.split('.')[1]));
    draft.layerSelectionSets = draft.layerSelectionSets
      .map((set) => ({ ...set, layerIds: set.layerIds.filter((id) => !removedIds.has(id)) }))
      .filter((set) => set.layerIds.length > 0);
  });
}

export function moveLayer(project: HorizonProject, layerId: string, direction: -1 | 1): HorizonProject {
  return mutateProject(project, (draft) => {
    const location = locateLayer(draft.layers, layerId);
    if (!location) return;
    const target = location.index + direction;
    if (target < 0 || target >= location.container.length) return;
    const [layer] = location.container.splice(location.index, 1);
    location.container.splice(target, 0, layer);
  });
}

export function relocateLayers(project: HorizonProject, layerIds: readonly string[], targetId: string, placement: LayerDropPlacement): HorizonProject {
  return mutateProject(project, (draft) => {
    const requested = new Set(layerIds);
    const roots: HorizonLayer[] = [];
    const collect = (layers: HorizonLayer[], selectedAncestor: boolean): void => {
      for (const layer of layers) {
        const selected = requested.has(layer.id);
        if (selected && !selectedAncestor && !layer.locked) roots.push(layer);
        if (layer.type === 'group') collect(layer.children, selectedAncestor || selected);
      }
    };
    collect(draft.layers, false);
    if (!roots.length) return;

    const ownedIds = new Set(flattenLayers(roots).map((layer) => layer.id));
    if (targetId && ownedIds.has(targetId)) return;
    const target = targetId ? findLayer(draft, targetId) : undefined;
    if (placement !== 'root-end' && !target) return;
    if (target?.locked) return;
    if (placement === 'inside' && (target?.type !== 'group' || target.linkedComposition)) return;

    const moved: HorizonLayer[] = [];
    for (const root of roots) {
      const location = locateLayer(draft.layers, root.id);
      if (!location) continue;
      moved.push(...location.container.splice(location.index, 1));
    }
    if (!moved.length) return;

    if (placement === 'root-end') {
      draft.layers.push(...moved);
      return;
    }
    if (placement === 'inside' && target?.type === 'group') {
      target.children.unshift(...moved);
      return;
    }
    const destination = locateLayer(draft.layers, targetId);
    if (!destination) return;
    destination.container.splice(destination.index + (placement === 'after' ? 1 : 0), 0, ...moved);
  });
}

export function wrapLayerInGroup(project: HorizonProject, layerId: string): { project: HorizonProject; selectedId?: string } {
  let selectedId: string | undefined;
  const next = mutateProject(project, (draft) => {
    const location = locateLayer(draft.layers, layerId);
    if (!location) return;
    const [layer] = location.container.splice(location.index, 1);
    const group = createGroupLayer('Layer Group', [layer]);
    selectedId = group.id;
    location.container.splice(location.index, 0, group);
  });
  return { project: next, selectedId };
}

export function updateLayer(project: HorizonProject, layerId: string, update: (layer: HorizonLayer) => void): HorizonProject {
  return mutateProject(project, (draft) => {
    const layer = findLayer(draft, layerId);
    if (layer) update(layer);
  });
}

export function flattenLayers(layers: HorizonLayer[]): HorizonLayer[] {
  const result: HorizonLayer[] = [];
  for (const layer of layers) {
    result.push(layer);
    if (layer.type === 'group') result.push(...flattenLayers(layer.children));
  }
  return result;
}

export function createLayerPreset(project: HorizonProject, layerId: string, name?: string, description = ''): HorizonLayerPreset | undefined {
  const layer = findLayer(project, layerId);
  if (!layer) return undefined;
  const ownedLayers = flattenLayers([layer]);
  const layerIds = new Set(ownedLayers.map((item) => item.id));
  const assetIds = new Set(ownedLayers.filter((item): item is ImageLayer => item.type === 'image').map((item) => item.assetId));
  return {
    format: 'data-horizon.layer-preset',
    version: 1,
    id: createId('preset'),
    name: (name?.trim() || layer.name).slice(0, 80),
    description: description.trim().slice(0, 240),
    createdWith: DATA_HORIZON_VERSION,
    layer: detachLayerCompositionLinks(layer),
    assets: project.assets.filter((asset) => assetIds.has(asset.id)).map((asset) => structuredClone(asset)),
    bindings: project.bindings.filter((binding) => layerIds.has(binding.target.split('.')[1])).map((binding) => structuredClone(binding)),
    tracks: project.timeline.tracks.filter((track) => layerIds.has(track.target.split('.')[1])).map((track) => structuredClone(track))
  };
}

function detachLayerCompositionLinks(layer: HorizonLayer): HorizonLayer {
  const copy = structuredClone(layer);
  if (copy.type === 'group') {
    delete copy.linkedComposition;
    copy.children = copy.children.map(detachLayerCompositionLinks);
  }
  return copy;
}

export function stripCompositionLinks(project: HorizonProject): HorizonProject {
  const detached = structuredClone(project);
  detached.layers = detached.layers.map(detachLayerCompositionLinks);
  detached.presets = detached.presets.map((preset) => ({ ...preset, layer: detachLayerCompositionLinks(preset.layer) }));
  return detached;
}

export function validateLayerPreset(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['Preset must be an object.'] };
  const preset = input as Partial<HorizonLayerPreset>;
  if (preset.format !== 'data-horizon.layer-preset') errors.push('Preset format must be data-horizon.layer-preset.');
  if (preset.version !== 1) errors.push('Preset version must be 1.');
  if (typeof preset.id !== 'string' || !preset.id) errors.push('Preset id must be a non-empty string.');
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80) errors.push('Preset name must contain 1 to 80 characters.');
  if (typeof preset.description !== 'string' || preset.description.length > 240) errors.push('Preset description must contain at most 240 characters.');
  if (typeof preset.createdWith !== 'string' || !preset.createdWith) errors.push('Preset createdWith must be a non-empty version string.');
  if (!preset.layer || typeof preset.layer !== 'object') errors.push('Preset must contain a layer or group.');
  if (!Array.isArray(preset.assets)) errors.push('Preset assets must be an array.');
  if (!Array.isArray(preset.bindings)) errors.push('Preset bindings must be an array.');
  if (!Array.isArray(preset.tracks)) errors.push('Preset tracks must be an array.');
  if (errors.length) return { ok: false, errors };
  const temporary = createProject('Preset Validation');
  temporary.assets = structuredClone(preset.assets as HorizonAsset[]);
  temporary.layers = [structuredClone(preset.layer as HorizonLayer)];
  temporary.bindings = structuredClone(preset.bindings as ParameterBinding[]);
  temporary.timeline.tracks = structuredClone(preset.tracks as AnimationTrack[]);
  const projectValidation = validateProject(temporary);
  if (!projectValidation.ok) errors.push(...projectValidation.errors.map((error) => `Preset content: ${error}`));
  const layers = flattenLayers(temporary.layers);
  const layerIds = new Set(layers.map((layer) => layer.id));
  const assetIds = new Set(temporary.assets.map((asset) => asset.id));
  for (const layer of layers) {
    if (layer.type === 'image' && !assetIds.has(layer.assetId)) errors.push(`Preset image layer ${layer.name} references a missing asset.`);
  }
  for (const binding of temporary.bindings) if (!layerIds.has(binding.target.split('.')[1])) errors.push(`Preset binding ${binding.id} targets a layer outside the preset.`);
  for (const track of temporary.timeline.tracks) if (!layerIds.has(track.target.split('.')[1])) errors.push(`Preset track ${track.id} targets a layer outside the preset.`);
  return { ok: errors.length === 0, errors };
}

export function normalizeLayerPreset(input: HorizonLayerPreset): HorizonLayerPreset {
  const preset = structuredClone(input);
  const temporary = createProject('Preset Normalization');
  temporary.assets = Array.isArray(preset.assets) ? preset.assets : [];
  temporary.layers = preset.layer ? [preset.layer] : [];
  temporary.bindings = Array.isArray(preset.bindings) ? preset.bindings : [];
  temporary.timeline.tracks = Array.isArray(preset.tracks) ? preset.tracks : [];
  const normalized = normalizeProject(temporary);
  return {
    ...preset,
    format: 'data-horizon.layer-preset',
    version: 1,
    name: String(preset.name || preset.layer?.name || 'Layer Preset').slice(0, 80),
    description: String(preset.description || '').slice(0, 240),
    createdWith: String(preset.createdWith || DATA_HORIZON_VERSION),
    layer: normalized.layers[0],
    assets: normalized.assets,
    bindings: normalized.bindings,
    tracks: normalized.timeline.tracks
  };
}

function remapPresetTarget(target: string, layerIds: ReadonlyMap<string, string>, effectIds: ReadonlyMap<string, string>): string {
  const parts = target.split('.');
  if (parts[0] === 'layer' && layerIds.has(parts[1])) parts[1] = layerIds.get(parts[1]) as string;
  if (parts[2] === 'effect' && effectIds.has(parts[3])) parts[3] = effectIds.get(parts[3]) as string;
  return parts.join('.');
}

export function insertLayerPreset(project: HorizonProject, input: HorizonLayerPreset): { project: HorizonProject; selectedId?: string } {
  const validation = validateLayerPreset(input);
  if (!validation.ok) return { project };
  let selectedId: string | undefined;
  const next = mutateProject(project, (draft) => {
    const preset = normalizeLayerPreset(input);
    const assetIds = new Map<string, string>();
    for (const asset of preset.assets) {
      const reusable = draft.assets.find((candidate) => candidate.kind === asset.kind && candidate.mimeType === asset.mimeType && candidate.uri === asset.uri);
      if (reusable) {
        assetIds.set(asset.id, reusable.id);
        continue;
      }
      const copy = { ...asset, id: createId('asset') };
      assetIds.set(asset.id, copy.id);
      draft.assets.push(copy);
    }
    const layerIds = new Map<string, string>();
    const effectIds = new Map<string, string>();
    const cloneLayer = (source: HorizonLayer): HorizonLayer => {
      const copy = structuredClone(source);
      const nextLayerId = createId(source.type === 'group' ? 'group' : 'layer');
      layerIds.set(source.id, nextLayerId);
      copy.id = nextLayerId;
      copy.effects = source.effects.map((effect) => {
        const nextEffectId = createId('effect');
        effectIds.set(effect.id, nextEffectId);
        return {
          ...structuredClone(effect),
          id: nextEffectId,
          paintMask: effect.paintMask ? {
            ...structuredClone(effect.paintMask),
            strokes: effect.paintMask.strokes.map((stroke) => ({ ...structuredClone(stroke), id: createId('stroke') }))
          } : undefined,
          paintLayer: effect.paintLayer ? {
            ...structuredClone(effect.paintLayer),
            strokes: effect.paintLayer.strokes.map((stroke) => ({ ...structuredClone(stroke), id: createId('stroke') }))
          } : undefined
        };
      });
      if (copy.type === 'image') copy.assetId = assetIds.get(source.type === 'image' ? source.assetId : '') ?? copy.assetId;
      if (copy.type === 'group' && source.type === 'group') copy.children = source.children.map(cloneLayer);
      return copy;
    };
    const root = cloneLayer(preset.layer);
    root.name = preset.name;
    selectedId = root.id;
    draft.layers.unshift(root);
    for (const binding of preset.bindings) {
      draft.bindings.push({ ...structuredClone(binding), id: createId('binding'), target: remapPresetTarget(binding.target, layerIds, effectIds) });
    }
    for (const track of preset.tracks) {
      draft.timeline.tracks.push({
        ...structuredClone(track),
        id: createId('track'),
        target: remapPresetTarget(track.target, layerIds, effectIds),
        keyframes: track.keyframes.map((keyframe) => ({
          ...structuredClone(keyframe),
          id: createId('keyframe'),
          time: Math.max(0, Math.min(draft.timeline.duration, keyframe.time))
        }))
      });
    }
  });
  return { project: next, selectedId };
}

function scaleCompositionTarget(target: string, value: number, scale: number, offsetX: number, offsetY: number, absolute: boolean): number {
  if (target.endsWith('.transform.x')) return value * scale + (absolute ? offsetX : 0);
  if (target.endsWith('.transform.y')) return value * scale + (absolute ? offsetY : 0);
  if (target.endsWith('.transform.width') || target.endsWith('.transform.height')) return value * scale;
  return value;
}

export function createCompositionPreset(sourceProject: HorizonProject, targetCanvas: HorizonProject['canvas'], requestedName = ''): HorizonLayerPreset | undefined {
  if (!validateProject(sourceProject).ok) return undefined;
  const source = normalizeProject(sourceProject);
  const backgroundAlpha = Math.max(0, Math.min(1, Number(source.canvas.background[3]) || 0));
  if (backgroundAlpha > 0) {
    const toHex = (value: number): string => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
    const background = createShapeLayer('rectangle', `${source.name} Canvas Background`);
    background.fill = `#${toHex(source.canvas.background[0])}${toHex(source.canvas.background[1])}${toHex(source.canvas.background[2])}`.toUpperCase();
    background.strokeWidth = 0;
    background.opacity = backgroundAlpha;
    background.transform = { x: source.canvas.width / 2, y: source.canvas.height / 2, width: source.canvas.width, height: source.canvas.height, rotation: 0 };
    source.layers.push(background);
  }
  if (!source.layers.length) return undefined;
  const targetWidth = Math.max(1, Number(targetCanvas.width) || source.canvas.width);
  const targetHeight = Math.max(1, Number(targetCanvas.height) || source.canvas.height);
  const scale = Math.min(targetWidth / Math.max(1, source.canvas.width), targetHeight / Math.max(1, source.canvas.height));
  const offsetX = (targetWidth - source.canvas.width * scale) / 2;
  const offsetY = (targetHeight - source.canvas.height * scale) / 2;
  const scaleLayer = (layer: HorizonLayer): void => {
    if (layer.transform) {
      layer.transform.x = layer.transform.x * scale + offsetX;
      layer.transform.y = layer.transform.y * scale + offsetY;
      layer.transform.width *= scale;
      layer.transform.height *= scale;
    }
    if (layer.type === 'text') {
      layer.fontSize *= scale;
      layer.letterSpacing *= scale;
      layer.padding *= scale;
      layer.borderWidth *= scale;
      layer.cornerRadius *= scale;
      layer.outlineWidth *= scale;
      layer.shadowBlur *= scale;
    } else if (layer.type === 'shape') {
      layer.strokeWidth *= scale;
      layer.cornerRadius *= scale;
    } else if (layer.type === 'path') {
      layer.strokeWidth *= scale;
      layer.dashLength *= scale;
      layer.gapLength *= scale;
    }
    if (layer.type === 'group') layer.children.forEach(scaleLayer);
  };
  source.layers.forEach(scaleLayer);
  for (const binding of source.bindings) {
    binding.outputMinimum = scaleCompositionTarget(binding.target, binding.outputMinimum, scale, offsetX, offsetY, false);
    binding.outputMaximum = scaleCompositionTarget(binding.target, binding.outputMaximum, scale, offsetX, offsetY, false);
  }
  for (const track of source.timeline.tracks) {
    for (const keyframe of track.keyframes) keyframe.value = scaleCompositionTarget(track.target, keyframe.value, scale, offsetX, offsetY, true);
  }
  const name = (requestedName.trim() || source.name || 'Imported Composition').slice(0, 80);
  const root = createGroupLayer(name, source.layers);
  root.transform = { x: targetWidth / 2, y: targetHeight / 2, width: targetWidth, height: targetHeight, rotation: 0 };
  source.layers = [root];
  source.canvas = { ...source.canvas, width: targetWidth, height: targetHeight };
  return createLayerPreset(source, root.id, name, `Imported from ${sourceProject.name} as a fitted editable composition.`);
}

export function insertProjectAsGroup(project: HorizonProject, sourceProject: HorizonProject, requestedName = '', linkSource?: CompositionLinkSource): { project: HorizonProject; selectedId?: string } {
  const preset = createCompositionPreset(sourceProject, project.canvas, requestedName);
  if (!preset) return { project };
  const prepared = mutateProject(project, (draft) => {
    draft.timeline.duration = Math.max(draft.timeline.duration, Number(sourceProject.timeline?.duration) || 0);
  });
  const inserted = insertLayerPreset(prepared, preset);
  if (!inserted.selectedId || !linkSource) return inserted;
  return {
    ...inserted,
    project: updateLayer(inserted.project, inserted.selectedId, (layer) => {
      if (layer.type !== 'group') return;
      layer.linkedComposition = {
        sourceKind: linkSource.sourceKind,
        locator: linkSource.locator,
        displayName: (linkSource.displayName || sourceProject.name).slice(0, 160),
        sourceProjectId: sourceProject.id,
        sourceRevision: sourceProject.revision,
        sourceVersion: sourceProject.engineVersion,
        refreshedAt: new Date().toISOString()
      };
    })
  };
}

export function refreshLinkedComposition(project: HorizonProject, groupId: string, sourceProject: HorizonProject): { project: HorizonProject; selectedId?: string } {
  const current = findLayer(project, groupId);
  if (current?.type !== 'group' || !current.linkedComposition || !validateProject(sourceProject).ok) return { project };
  const preset = createCompositionPreset(sourceProject, project.canvas, current.name);
  if (!preset) return { project };
  const scratch = createProject('Linked Composition Refresh');
  scratch.canvas = structuredClone(project.canvas);
  scratch.timeline.duration = Math.max(project.timeline.duration, sourceProject.timeline.duration);
  const inserted = insertLayerPreset(scratch, preset);
  const replacement = inserted.selectedId ? findLayer(inserted.project, inserted.selectedId) : undefined;
  if (replacement?.type !== 'group') return { project };
  const next = mutateProject(project, (draft) => {
    const target = findLayer(draft, groupId);
    if (target?.type !== 'group' || !target.linkedComposition) return;
    const removedLayers = flattenLayers(target.children);
    const removedLayerIds = new Set(removedLayers.map((layer) => layer.id));
    const removedAssetIds = new Set(removedLayers.filter((layer): layer is ImageLayer => layer.type === 'image').map((layer) => layer.assetId));
    draft.bindings = draft.bindings.filter((binding) => !removedLayerIds.has(binding.target.split('.')[1]));
    draft.timeline.tracks = draft.timeline.tracks.filter((track) => !removedLayerIds.has(track.target.split('.')[1]));
    const assetIds = new Map<string, string>();
    for (const asset of inserted.project.assets) {
      const reusable = draft.assets.find((candidate) => candidate.kind === asset.kind && candidate.mimeType === asset.mimeType && candidate.uri === asset.uri);
      if (reusable) assetIds.set(asset.id, reusable.id);
      else {
        const copy = { ...structuredClone(asset), id: createId('asset') };
        assetIds.set(asset.id, copy.id);
        draft.assets.push(copy);
      }
    }
    const replacementChildren = structuredClone(replacement.children);
    for (const layer of flattenLayers(replacementChildren)) if (layer.type === 'image') layer.assetId = assetIds.get(layer.assetId) ?? layer.assetId;
    target.children = replacementChildren;
    target.linkedComposition = {
      ...target.linkedComposition,
      displayName: sourceProject.name.slice(0, 160),
      sourceProjectId: sourceProject.id,
      sourceRevision: sourceProject.revision,
      sourceVersion: sourceProject.engineVersion,
      refreshedAt: new Date().toISOString()
    };
    draft.bindings.push(...inserted.project.bindings.map((binding) => ({ ...structuredClone(binding), id: createId('binding') })));
    draft.timeline.tracks.push(...inserted.project.timeline.tracks.map((track) => ({
      ...structuredClone(track),
      id: createId('track'),
      keyframes: track.keyframes.map((keyframe) => ({ ...structuredClone(keyframe), id: createId('keyframe') }))
    })));
    draft.timeline.duration = Math.max(draft.timeline.duration, sourceProject.timeline.duration);
    const usedAssetIds = new Set(flattenLayers(draft.layers).filter((layer): layer is ImageLayer => layer.type === 'image').map((layer) => layer.assetId));
    draft.assets = draft.assets.filter((asset) => !removedAssetIds.has(asset.id) || usedAssetIds.has(asset.id));
  });
  return { project: next, selectedId: groupId };
}

export function detachLinkedComposition(project: HorizonProject, groupId: string): HorizonProject {
  return updateLayer(project, groupId, (layer) => { if (layer.type === 'group') delete layer.linkedComposition; });
}

export function upsertLayerPreset(project: HorizonProject, input: HorizonLayerPreset): HorizonProject {
  const validation = validateLayerPreset(input);
  if (!validation.ok) return project;
  return mutateProject(project, (draft) => {
    const preset = normalizeLayerPreset(input);
    const index = draft.presets.findIndex((item) => item.id === preset.id);
    if (index >= 0) draft.presets[index] = preset;
    else draft.presets.unshift(preset);
  });
}

export function removeLayerPreset(project: HorizonProject, presetId: string): HorizonProject {
  return mutateProject(project, (draft) => { draft.presets = draft.presets.filter((preset) => preset.id !== presetId); });
}

export function upsertLayerSelectionSet(project: HorizonProject, name: string, layerIds: readonly string[], setId = ''): { project: HorizonProject; setId?: string } {
  const requested = new Set(layerIds);
  const orderedIds = flattenLayers(project.layers).filter((layer) => requested.has(layer.id)).map((layer) => layer.id);
  if (!orderedIds.length) return { project };
  const cleanName = name.trim().slice(0, 80) || 'Layer Selection';
  let savedId: string | undefined;
  const next = mutateProject(project, (draft) => {
    const existing = setId ? draft.layerSelectionSets.find((set) => set.id === setId) : undefined;
    if (existing) {
      existing.name = cleanName;
      existing.layerIds = orderedIds;
      savedId = existing.id;
      return;
    }
    if (draft.layerSelectionSets.length >= 32) return;
    savedId = createId('selection-set');
    draft.layerSelectionSets.push({ id: savedId, name: cleanName, layerIds: orderedIds });
  });
  return { project: next, setId: savedId };
}

export function removeLayerSelectionSet(project: HorizonProject, setId: string): HorizonProject {
  return mutateProject(project, (draft) => { draft.layerSelectionSets = draft.layerSelectionSets.filter((set) => set.id !== setId); });
}

export function parameterTargets(layer: HorizonLayer): Array<{ path: string; label: string; minimum: number; maximum: number }> {
  const targets = [
    { path: `layer.${layer.id}.opacity`, label: 'Layer Opacity', minimum: 0, maximum: 1 },
    { path: `layer.${layer.id}.transform.x`, label: 'Position X', minimum: -1920, maximum: 3840 },
    { path: `layer.${layer.id}.transform.y`, label: 'Position Y', minimum: -1080, maximum: 2160 },
    { path: `layer.${layer.id}.transform.width`, label: 'Width', minimum: 1, maximum: 3840 },
    { path: `layer.${layer.id}.transform.height`, label: 'Height', minimum: 1, maximum: 2160 },
    { path: `layer.${layer.id}.transform.rotation`, label: 'Rotation', minimum: -180, maximum: 180 },
    { path: `layer.${layer.id}.depth`, label: 'Depth', minimum: -1, maximum: 1 },
    { path: `layer.${layer.id}.parallax`, label: 'Parallax', minimum: -1, maximum: 1 }
  ];
  if (layer.type === 'shape') {
    targets.push(
      { path: `layer.${layer.id}.source.strokeWidth`, label: 'Shape · Stroke Width', minimum: 0, maximum: 100 },
      { path: `layer.${layer.id}.source.cornerRadius`, label: 'Shape · Corner Radius', minimum: 0, maximum: 300 }
    );
  } else if (layer.type === 'spectrum') {
    targets.push(
      { path: `layer.${layer.id}.source.gain`, label: 'Spectrum · Gain', minimum: 0, maximum: 3 },
      { path: `layer.${layer.id}.source.glow`, label: 'Spectrum · Glow', minimum: 0, maximum: 2 }
    );
  } else if (layer.type === 'waveform') {
    targets.push(
      { path: `layer.${layer.id}.source.amplitude`, label: 'Waveform · Amplitude', minimum: 0, maximum: 1 },
      { path: `layer.${layer.id}.source.frequency`, label: 'Waveform · Frequency', minimum: 0.5, maximum: 16 },
      { path: `layer.${layer.id}.source.thickness`, label: 'Waveform · Thickness', minimum: 0.002, maximum: 0.15 },
      { path: `layer.${layer.id}.source.glow`, label: 'Waveform · Glow', minimum: 0, maximum: 2 }
    );
  } else if (layer.type === 'particles') {
    targets.push(
      { path: `layer.${layer.id}.source.size`, label: 'Particles · Size', minimum: 0.02, maximum: 0.8 },
      { path: `layer.${layer.id}.source.speed`, label: 'Particles · Speed', minimum: -2, maximum: 2 },
      { path: `layer.${layer.id}.source.spread`, label: 'Particles · Spread', minimum: 0, maximum: 1 },
      { path: `layer.${layer.id}.source.audioGain`, label: 'Particles · Audio Gain', minimum: 0, maximum: 3 }
    );
  } else if (layer.type === 'path') {
    targets.push(
      { path: `layer.${layer.id}.source.strokeWidth`, label: 'Path · Stroke Width', minimum: 1, maximum: 100 },
      { path: `layer.${layer.id}.source.glow`, label: 'Path · Glow', minimum: 0, maximum: 3 },
      { path: `layer.${layer.id}.source.dashLength`, label: 'Path · Dash Length', minimum: 0, maximum: 400 },
      { path: `layer.${layer.id}.source.gapLength`, label: 'Path · Gap Length', minimum: 0, maximum: 400 },
      { path: `layer.${layer.id}.source.flowSpeed`, label: 'Path · Flow Speed', minimum: -1000, maximum: 1000 }
    );
  }
  for (const effect of layer.effects) {
    for (const key of Object.keys(effect.parameters)) {
      const minimum = effect.type === 'outline' && key === 'thickness' ? .25 : 0;
      const maximum = key === 'levels' ? 16
        : key === 'contrast' || key === 'saturation' ? 3
          : effect.type === 'outline' && key === 'strength' ? 2
            : effect.type === 'outline' && key === 'thickness' ? 8
              : effect.type === 'bloom' && key === 'intensity' ? 3
              : 1;
      targets.push({
        path: `layer.${layer.id}.effect.${effect.id}.${key}`,
        label: `${effect.name} · ${key}`,
        minimum,
        maximum
      });
    }
  }
  return targets;
}

export function readParameterValue(project: HorizonProject, target: string): number | undefined {
  const parts = target.split('.');
  if (parts[0] !== 'layer' || parts.length < 3) return undefined;
  const layer = findLayer(project, parts[1]);
  if (!layer) return undefined;
  const section = parts[2];
  if (section === 'transform') {
    const value = layer.transform?.[parts[3] as keyof LayerTransform];
    return typeof value === 'number' ? value : undefined;
  }
  if (section === 'source') {
    const value = (layer as unknown as Record<string, unknown>)[parts[3]];
    return typeof value === 'number' ? value : undefined;
  }
  if (section === 'effect') {
    const effect = layer.effects.find((item) => item.id === parts[3]);
    const value = effect?.parameters[parts[4]];
    return typeof value === 'number' ? value : undefined;
  }
  const value = (layer as unknown as Record<string, unknown>)[section];
  return typeof value === 'number' ? value : undefined;
}

function trackName(target: string): string {
  return target.split('.').slice(2).join(' · ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setTrack(project: HorizonProject, target: string, keyframes: Array<Omit<AnimationKeyframe, 'id'>>): void {
  let track = project.timeline.tracks.find((item) => item.target === target);
  if (!track) {
    track = { id: createId('track'), target, name: trackName(target), enabled: true, keyframes: [] };
    project.timeline.tracks.push(track);
  }
  track.keyframes = keyframes
    .map((keyframe) => ({ ...keyframe, id: createId('keyframe'), time: Math.max(0, Math.min(project.timeline.duration, keyframe.time)) }))
    .sort((left, right) => left.time - right.time);
}

export function upsertKeyframe(project: HorizonProject, target: string, time: number, value: number, easing: KeyframeEasing = 'easeInOut'): HorizonProject {
  return mutateProject(project, (draft) => {
    let track = draft.timeline.tracks.find((item) => item.target === target);
    if (!track) {
      track = { id: createId('track'), target, name: trackName(target), enabled: true, keyframes: [] };
      draft.timeline.tracks.push(track);
    }
    const clampedTime = Math.max(0, Math.min(draft.timeline.duration, time));
    const existing = track.keyframes.find((keyframe) => Math.abs(keyframe.time - clampedTime) < .001);
    if (existing) {
      existing.value = value;
      existing.easing = easing;
    } else {
      track.keyframes.push({ id: createId('keyframe'), time: clampedTime, value, easing });
      track.keyframes.sort((left, right) => left.time - right.time);
    }
  });
}

export function removeAnimationTrack(project: HorizonProject, trackId: string): HorizonProject {
  return mutateProject(project, (draft) => {
    draft.timeline.tracks = draft.timeline.tracks.filter((track) => track.id !== trackId);
  });
}

export interface AnimationKeyframeEdit {
  id: string;
  time?: number;
  value?: number;
  easing?: KeyframeEasing;
}

export function editAnimationKeyframes(project: HorizonProject, edits: readonly AnimationKeyframeEdit[]): HorizonProject {
  const requested = new Map(edits.map((edit) => [edit.id, edit]));
  return mutateProject(project, (draft) => {
    for (const track of draft.timeline.tracks) {
      for (const keyframe of track.keyframes) {
        const edit = requested.get(keyframe.id);
        if (!edit) continue;
        if (edit.time !== undefined) keyframe.time = Math.max(0, Math.min(draft.timeline.duration, Number(edit.time) || 0));
        if (edit.value !== undefined && Number.isFinite(edit.value)) keyframe.value = edit.value;
        if (edit.easing !== undefined) keyframe.easing = edit.easing;
      }
      track.keyframes.sort((left, right) => left.time - right.time);
    }
  });
}

export function removeAnimationKeyframes(project: HorizonProject, keyframeIds: readonly string[]): HorizonProject {
  const requested = new Set(keyframeIds);
  return mutateProject(project, (draft) => {
    for (const track of draft.timeline.tracks) track.keyframes = track.keyframes.filter((keyframe) => !requested.has(keyframe.id));
    draft.timeline.tracks = draft.timeline.tracks.filter((track) => track.keyframes.length > 0);
  });
}

export function setAnimationTrackEnabled(project: HorizonProject, trackId: string, enabled: boolean): HorizonProject {
  return mutateProject(project, (draft) => {
    const track = draft.timeline.tracks.find((item) => item.id === trackId);
    if (track) track.enabled = enabled;
  });
}

export function reduceAnimationTrackKeyframes(project: HorizonProject, trackId: string, tolerance = .02): HorizonProject {
  return mutateProject(project, (draft) => {
    const track = draft.timeline.tracks.find((item) => item.id === trackId);
    if (!track || track.keyframes.length <= 2 || track.keyframes.some((keyframe) => keyframe.easing !== 'linear')) return;
    const frames = [...track.keyframes].sort((left, right) => left.time - right.time);
    const values = frames.map((keyframe) => keyframe.value);
    const valueRange = Math.max(1e-9, Math.max(...values) - Math.min(...values));
    const allowedError = Math.max(0, Math.min(1, Number(tolerance) || 0)) * valueRange;
    const keep = new Set<number>([0, frames.length - 1]);
    const reduceRange = (startIndex: number, endIndex: number): void => {
      if (endIndex - startIndex <= 1) return;
      const start = frames[startIndex];
      const end = frames[endIndex];
      const span = Math.max(1e-9, end.time - start.time);
      let furthestIndex = -1;
      let furthestError = -1;
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const progress = Math.max(0, Math.min(1, (frames[index].time - start.time) / span));
        const expected = start.value + (end.value - start.value) * progress;
        const error = Math.abs(frames[index].value - expected);
        if (error > furthestError) { furthestError = error; furthestIndex = index; }
      }
      if (furthestIndex < 0 || furthestError <= allowedError) return;
      keep.add(furthestIndex);
      reduceRange(startIndex, furthestIndex);
      reduceRange(furthestIndex, endIndex);
    };
    reduceRange(0, frames.length - 1);
    track.keyframes = frames.filter((_, index) => keep.has(index));
  });
}

export function evaluateTimeline(timeline: HorizonTimeline | undefined, requestedTime: number): Map<string, number> {
  const values = new Map<string, number>();
  if (!timeline || !timeline.tracks.length) return values;
  const duration = Math.max(.001, timeline.duration);
  const time = timeline.loop
    ? ((requestedTime % duration) + duration) % duration
    : Math.max(0, Math.min(duration, requestedTime));
  for (const track of timeline.tracks) {
    if (track.enabled === false) continue;
    const frames = [...track.keyframes].sort((left, right) => left.time - right.time);
    if (!frames.length) continue;
    if (time <= frames[0].time) {
      values.set(track.target, frames[0].value);
      continue;
    }
    const last = frames[frames.length - 1];
    if (time >= last.time) {
      values.set(track.target, last.value);
      continue;
    }
    for (let index = 0; index < frames.length - 1; index += 1) {
      const from = frames[index];
      const to = frames[index + 1];
      if (time < from.time || time > to.time) continue;
      const span = Math.max(.001, to.time - from.time);
      let progress = (time - from.time) / span;
      if (from.easing === 'hold') progress = 0;
      else if (from.easing === 'easeIn') progress = progress * progress * progress;
      else if (from.easing === 'easeOut') progress = 1 - Math.pow(1 - progress, 3);
      else if (from.easing === 'easeInOut') progress = progress * progress * (3 - 2 * progress);
      else if (from.easing === 'bounce') {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (progress < 1 / d1) progress = n1 * progress * progress;
        else if (progress < 2 / d1) { progress -= 1.5 / d1; progress = n1 * progress * progress + .75; }
        else if (progress < 2.5 / d1) { progress -= 2.25 / d1; progress = n1 * progress * progress + .9375; }
        else { progress -= 2.625 / d1; progress = n1 * progress * progress + .984375; }
      }
      values.set(track.target, from.value + (to.value - from.value) * progress);
      break;
    }
  }
  return values;
}

export function applyAnimationPreset(project: HorizonProject, layerId: string, preset: AnimationPreset): HorizonProject {
  return mutateProject(project, (draft) => {
    const layer = findLayer(draft, layerId);
    if (!layer) return;
    const transform = layer.transform ?? { x: draft.canvas.width / 2, y: draft.canvas.height / 2, width: draft.canvas.width, height: draft.canvas.height, rotation: 0 };
    const duration = draft.timeline.duration;
    const opacityPath = `layer.${layer.id}.opacity`;
    if (preset === 'fade-in') {
      setTrack(draft, opacityPath, [{ time: 0, value: 0, easing: 'easeInOut' }, { time: .65, value: layer.opacity, easing: 'easeInOut' }]);
    } else if (preset === 'slide-in') {
      setTrack(draft, `layer.${layer.id}.transform.x`, [{ time: 0, value: transform.x - 320, easing: 'easeInOut' }, { time: .72, value: transform.x, easing: 'easeInOut' }]);
      setTrack(draft, opacityPath, [{ time: 0, value: 0, easing: 'easeInOut' }, { time: .42, value: layer.opacity, easing: 'easeInOut' }]);
    } else if (preset === 'pulse') {
      setTrack(draft, opacityPath, [{ time: 0, value: layer.opacity * .55, easing: 'easeInOut' }, { time: .28, value: layer.opacity, easing: 'easeInOut' }, { time: .62, value: layer.opacity * .72, easing: 'easeInOut' }, { time: 1, value: layer.opacity, easing: 'easeInOut' }]);
    } else {
      setTrack(draft, opacityPath, [{ time: Math.max(0, duration - .65), value: layer.opacity, easing: 'easeInOut' }, { time: duration, value: 0, easing: 'easeInOut' }]);
    }
  });
}

export function validateProject(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['Project must be an object.'] };
  const project = input as Partial<HorizonProject>;
  if (project.schemaVersion !== HORIZON_SCHEMA_VERSION) errors.push(`schemaVersion must be ${HORIZON_SCHEMA_VERSION}.`);
  if (typeof project.id !== 'string' || !project.id) errors.push('id must be a non-empty string.');
  if (typeof project.name !== 'string' || !project.name) errors.push('name must be a non-empty string.');
  if (!Array.isArray(project.assets)) errors.push('assets must be an array.');
  if (!Array.isArray(project.layers)) errors.push('layers must be an array.');
  if (!Array.isArray(project.bindings)) errors.push('bindings must be an array.');
  if (project.guides !== undefined) {
    if (!Array.isArray(project.guides)) errors.push('guides must be an array.');
    else if (project.guides.length > 64) errors.push('A project may contain at most 64 guides.');
    else {
      const guideIds = new Set<string>();
      for (const guide of project.guides) {
        if (!guide || typeof guide !== 'object') { errors.push('Every guide must be an object.'); continue; }
        if (typeof guide.id !== 'string' || !guide.id) errors.push('Every guide must have an id.');
        else if (guideIds.has(guide.id)) errors.push(`Duplicate guide id: ${guide.id}.`);
        else guideIds.add(guide.id);
        if (guide.orientation !== 'horizontal' && guide.orientation !== 'vertical') errors.push(`Invalid guide orientation on ${guide.id}.`);
        if (!Number.isFinite(guide.position) || guide.position < 0) errors.push(`Invalid guide position on ${guide.id}.`);
      }
    }
  }
  if (project.guidesLocked !== undefined && typeof project.guidesLocked !== 'boolean') errors.push('guidesLocked must be a boolean.');
  if (project.palettes !== undefined) {
    if (!Array.isArray(project.palettes)) errors.push('palettes must be an array.');
    else if (project.palettes.length > 32) errors.push('A project may contain at most 32 palettes.');
    else {
      const paletteIds = new Set<string>();
      for (const [index, palette] of project.palettes.entries()) {
        if (!palette || typeof palette !== 'object') {
          errors.push(`Palette ${index + 1} must be an object.`);
          continue;
        }
        if (typeof palette.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,79}$/.test(palette.id)) errors.push(`Palette ${index + 1} has an invalid id.`);
        else if (paletteIds.has(palette.id)) errors.push(`Duplicate palette id: ${palette.id}.`);
        else paletteIds.add(palette.id);
        if (typeof palette.name !== 'string' || !palette.name.trim() || palette.name.trim().length > 80) errors.push(`Palette ${index + 1} has an invalid name.`);
        if (!Array.isArray(palette.colors) || palette.colors.length !== 4 || palette.colors.some((color) => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) {
          errors.push(`Palette ${index + 1} must contain exactly four six-digit HEX colors.`);
        }
        if (palette.favorite !== undefined && typeof palette.favorite !== 'boolean') errors.push(`Palette ${index + 1} favorite must be a boolean.`);
      }
    }
  }
  if (project.timeline !== undefined) {
    if (!project.timeline || typeof project.timeline !== 'object') errors.push('timeline must be an object.');
    else {
      if (!(Number(project.timeline.duration) > 0)) errors.push('timeline duration must be positive.');
      if (!Array.isArray(project.timeline.tracks)) errors.push('timeline tracks must be an array.');
      else {
        const trackIds = new Set<string>();
        const keyframeIds = new Set<string>();
        for (const track of project.timeline.tracks) {
          if (!track || typeof track !== 'object') { errors.push('Every animation track must be an object.'); continue; }
          if (typeof track.id !== 'string' || !track.id) errors.push('Every animation track must have an id.');
          else if (trackIds.has(track.id)) errors.push(`Duplicate animation track id: ${track.id}.`);
          else trackIds.add(track.id);
          if (typeof track.target !== 'string' || !track.target.startsWith('layer.')) errors.push(`Invalid animation target on ${track.id}.`);
          if (track.enabled !== undefined && typeof track.enabled !== 'boolean') errors.push(`Animation track ${track.id} enabled must be a boolean.`);
          if (!Array.isArray(track.keyframes)) { errors.push(`Animation track ${track.id} keyframes must be an array.`); continue; }
          for (const keyframe of track.keyframes) {
            if (!keyframe || typeof keyframe !== 'object') { errors.push(`Animation track ${track.id} contains an invalid keyframe.`); continue; }
            if (typeof keyframe.id !== 'string' || !keyframe.id) errors.push(`Every keyframe on ${track.id} must have an id.`);
            else if (keyframeIds.has(keyframe.id)) errors.push(`Duplicate keyframe id: ${keyframe.id}.`);
            else keyframeIds.add(keyframe.id);
            if (!Number.isFinite(keyframe.time) || keyframe.time < 0) errors.push(`Invalid keyframe time on ${track.id}.`);
            if (!Number.isFinite(keyframe.value)) errors.push(`Invalid keyframe value on ${track.id}.`);
            if (!keyframeEasings.includes(keyframe.easing)) errors.push(`Invalid keyframe easing on ${track.id}.`);
          }
        }
      }
    }
  }
  if (project.presets !== undefined) {
    if (!Array.isArray(project.presets)) errors.push('presets must be an array.');
    else if (project.presets.length > 64) errors.push('A project may contain at most 64 layer presets.');
    else {
      const presetIds = new Set<string>();
      for (const preset of project.presets) {
        if (!preset || typeof preset !== 'object' || !('format' in preset)) continue;
        const result = validateLayerPreset(preset);
        if (!result.ok) errors.push(...result.errors.map((error) => `Preset: ${error}`));
        const presetId = (preset as HorizonLayerPreset).id;
        if (presetIds.has(presetId)) errors.push(`Duplicate preset id: ${presetId}.`);
        else presetIds.add(presetId);
      }
    }
  }
  const ids = new Set<string>();
  const inspect = (layers: HorizonLayer[]) => {
    for (const layer of layers) {
      if (!layer || typeof layer.id !== 'string' || !layer.id) errors.push('Every layer must have an id.');
      else if (ids.has(layer.id)) errors.push(`Duplicate layer id: ${layer.id}.`);
      else ids.add(layer.id);
      if (!blendModes.includes(layer.blendMode)) errors.push(`Invalid blend mode on ${layer.id}.`);
      if (!Array.isArray(layer.effects)) errors.push(`effects must be an array on ${layer.id}.`);
      else for (const effect of layer.effects) {
        if (!effectTypes.includes(effect.type)) errors.push(`Invalid effect type on ${layer.id}.`);
        if (effect.type === 'outline') {
          if (effect.color !== undefined && !/^#[0-9a-f]{6}$/i.test(effect.color)) errors.push(`Invalid outline color on ${layer.id}.`);
          if (effect.outputMode !== undefined && !['composite', 'isolated'].includes(effect.outputMode)) errors.push(`Invalid outline output mode on ${layer.id}.`);
        }
        if (effect.type === 'paintMask') {
          if (!effect.paintMask || !Array.isArray(effect.paintMask.strokes)) errors.push(`Painted mask data is missing on ${layer.id}.`);
          else for (const stroke of effect.paintMask.strokes) {
            if (!['hide', 'reveal'].includes(stroke.mode) || !Array.isArray(stroke.points)) errors.push(`Invalid painted mask stroke on ${layer.id}.`);
            else if (stroke.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push(`Invalid painted mask point on ${layer.id}.`);
          }
        }
        if (effect.type === 'paintLayer') {
          if (!effect.paintLayer || !Array.isArray(effect.paintLayer.strokes)) errors.push(`Paint layer data is missing on ${layer.id}.`);
          else for (const stroke of effect.paintLayer.strokes) {
            if (!['paint', 'erase'].includes(stroke.mode) || !Array.isArray(stroke.points)) errors.push(`Invalid paint layer stroke on ${layer.id}.`);
            else if (!/^#[0-9a-f]{6}$/i.test(stroke.color) || stroke.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push(`Invalid paint layer stroke data on ${layer.id}.`);
          }
        }
      }
      const layerType: unknown = (layer as { type?: unknown }).type;
      if (layerType === 'group') {
        const group = layer as GroupLayer;
        if (group.linkedComposition) {
          const link = group.linkedComposition;
          if (!['file', 'vault'].includes(link.sourceKind)) errors.push(`Invalid linked composition source on ${layer.id}.`);
          if (typeof link.locator !== 'string' || !link.locator || link.locator.length > 2048) errors.push(`Invalid linked composition locator on ${layer.id}.`);
          if (link.sourceKind === 'vault' && !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(link.locator)) errors.push(`Invalid linked Vault element on ${layer.id}.`);
          if (typeof link.sourceProjectId !== 'string' || !link.sourceProjectId) errors.push(`Invalid linked project id on ${layer.id}.`);
          if (!Number.isFinite(link.sourceRevision)) errors.push(`Invalid linked project revision on ${layer.id}.`);
        }
        inspect(group.children);
      }
      else if (layerType === 'path') {
        const path = layer as PathLayer;
        if (!Array.isArray(path.points) || path.points.length < 2 || path.points.length > 32) errors.push(`Path ${layer.id} must contain 2 to 32 points.`);
        else if (path.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push(`Invalid path point on ${layer.id}.`);
      } else if (!['image', 'text', 'shape', 'spectrum', 'waveform', 'particles'].includes(String(layerType))) errors.push(`Invalid layer type on ${layer.id}.`);
    }
  };
  if (Array.isArray(project.layers)) inspect(project.layers as HorizonLayer[]);
  if (project.layerSelectionSets !== undefined) {
    if (!Array.isArray(project.layerSelectionSets)) errors.push('layerSelectionSets must be an array.');
    else if (project.layerSelectionSets.length > 32) errors.push('A project may contain at most 32 layer selection sets.');
    else {
      const setIds = new Set<string>();
      for (const [index, set] of project.layerSelectionSets.entries()) {
        if (!set || typeof set !== 'object') { errors.push(`Layer selection set ${index + 1} must be an object.`); continue; }
        if (typeof set.id !== 'string' || !set.id) errors.push(`Layer selection set ${index + 1} must have an id.`);
        else if (setIds.has(set.id)) errors.push(`Duplicate layer selection set id: ${set.id}.`);
        else setIds.add(set.id);
        if (typeof set.name !== 'string' || !set.name.trim() || set.name.trim().length > 80) errors.push(`Layer selection set ${index + 1} has an invalid name.`);
        if (!Array.isArray(set.layerIds) || !set.layerIds.length) errors.push(`Layer selection set ${index + 1} must contain at least one layer id.`);
        else {
          const unique = new Set(set.layerIds);
          if (unique.size !== set.layerIds.length) errors.push(`Layer selection set ${index + 1} contains duplicate layer ids.`);
          for (const layerId of set.layerIds) if (typeof layerId !== 'string' || !ids.has(layerId)) errors.push(`Layer selection set ${index + 1} references an unknown layer.`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export class HistoryStore<T> {
  private past: T[] = [];
  private future: T[] = [];
  private readonly cloneValue: (value: T) => T;

  constructor(private current: T, clone: (value: T) => T = (value) => structuredClone(value)) {
    this.cloneValue = clone;
  }

  get value(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  commit(next: T): T {
    this.past.push(this.cloneValue(this.current));
    this.current = this.cloneValue(next);
    this.future = [];
    return this.current;
  }

  replace(next: T): T {
    this.current = this.cloneValue(next);
    this.past = [];
    this.future = [];
    return this.current;
  }

  undo(): T {
    const previous = this.past.pop();
    if (!previous) return this.current;
    this.future.push(this.cloneValue(this.current));
    this.current = previous;
    return this.current;
  }

  redo(): T {
    const next = this.future.pop();
    if (!next) return this.current;
    this.past.push(this.cloneValue(this.current));
    this.current = next;
    return this.current;
  }
}
