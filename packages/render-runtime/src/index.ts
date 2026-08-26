import type {
  BlendMode,
  HorizonAsset,
  HorizonEffect,
  HorizonLayer,
  HorizonProject,
  ImageLayer,
  ParticleLayer,
  PathLayer,
  ShapeLayer,
  SpectrumLayer,
  TextLayer,
  WaveformLayer
} from '@data-horizon/project-model';

export interface RenderFrame {
  timeSeconds: number;
  deltaSeconds: number;
  modulation?: ReadonlyMap<string, number>;
  animation?: ReadonlyMap<string, number>;
  audio?: { bass: number; mids: number; highs: number; beat: number; rms: number };
}

export interface RendererDiagnostics {
  webgl2: boolean;
  width: number;
  height: number;
  loadedAssets: number;
  drawCalls: number;
  passes: number;
  lastError: string;
}

export const effectRegistry = Object.freeze({
  celShading: Object.freeze({ label: 'Cel Shading', parameters: ['levels', 'intensity'] }),
  outline: Object.freeze({ label: 'Outline', parameters: ['strength', 'threshold', 'thickness', 'softness'] }),
  colorGrade: Object.freeze({ label: 'Color Grade', parameters: ['contrast', 'saturation', 'warmth'] }),
  luminanceMask: Object.freeze({ label: 'Luminance Mask', parameters: ['threshold', 'feather', 'invert'] }),
  regionMask: Object.freeze({ label: 'Vertical Region Mask', parameters: ['top', 'bottom', 'feather', 'invert'] }),
  paintMask: Object.freeze({ label: 'Painted Mask', parameters: ['opacity', 'invert'] }),
  paintLayer: Object.freeze({ label: 'Paint / Erase', parameters: ['opacity'] }),
  posterize: Object.freeze({ label: 'Posterize', parameters: ['levels', 'intensity'] }),
  bloom: Object.freeze({ label: 'Bloom', parameters: ['threshold', 'intensity', 'radius'] }),
  scanlines: Object.freeze({ label: 'Scanlines', parameters: ['density', 'intensity', 'speed'] }),
  displacement: Object.freeze({ label: 'Displacement', parameters: ['amount', 'speed'] })
});

const vertexSource = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uOffset;
uniform vec2 uScale;
uniform float uRotation;
out vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  float angle = radians(uRotation);
  mat2 rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  gl_Position = vec4(rotation * (aPosition * uScale) + uOffset, 0.0, 1.0);
}`;

const sourceFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
uniform int uClipOutside;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 uv = (vUv - .5) * uUvScale + .5;
  if (uClipOutside == 1 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
    outColor = vec4(0.0);
    return;
  }
  outColor = texture(uTexture, uv);
}`;

const copyFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uOpacity;
uniform int uPremultiplyColor;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 color = texture(uTexture, vUv);
  float alpha = color.a * uOpacity;
  vec3 rgb = uPremultiplyColor == 1 ? color.rgb * alpha : color.rgb;
  outColor = vec4(rgb, alpha);
}`;

const celFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uLevels;
uniform float uIntensity;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  float levels = max(2.0, floor(uLevels));
  vec3 cel = floor(source.rgb * levels + .5) / levels;
  outColor = vec4(mix(source.rgb, cel, clamp(uIntensity, 0.0, 1.0)), source.a);
}`;

const outlineFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uThreshold;
uniform float uThickness;
uniform float uSoftness;
uniform float uIsolated;
uniform vec3 uColor;
in vec2 vUv;
out vec4 outColor;
float lum(vec3 color) { return dot(color, vec3(.2126, .7152, .0722)); }
void main() {
  vec4 source = texture(uTexture, vUv);
  vec2 texel = uTexel * max(.25, uThickness);
  float tl = lum(texture(uTexture, vUv + texel * vec2(-1.0, 1.0)).rgb);
  float tc = lum(texture(uTexture, vUv + texel * vec2(0.0, 1.0)).rgb);
  float tr = lum(texture(uTexture, vUv + texel * vec2(1.0, 1.0)).rgb);
  float ml = lum(texture(uTexture, vUv + texel * vec2(-1.0, 0.0)).rgb);
  float mr = lum(texture(uTexture, vUv + texel * vec2(1.0, 0.0)).rgb);
  float bl = lum(texture(uTexture, vUv + texel * vec2(-1.0, -1.0)).rgb);
  float bc = lum(texture(uTexture, vUv + texel * vec2(0.0, -1.0)).rgb);
  float br = lum(texture(uTexture, vUv + texel * vec2(1.0, -1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -bl - 2.0 * bc - br + tl + 2.0 * tc + tr;
  float edge = smoothstep(uThreshold, uThreshold + max(.001, uSoftness), length(vec2(gx, gy)));
  float intensity = edge * clamp(uStrength, 0.0, 2.0);
  vec3 neon = uColor * (1.0 + edge * .7);
  vec4 composite = vec4(mix(source.rgb, neon, clamp(intensity, 0.0, 1.0)), source.a);
  float isolatedAlpha = clamp(intensity, 0.0, 1.0) * source.a;
  vec4 isolated = vec4(neon * step(.0001, isolatedAlpha), isolatedAlpha);
  outColor = mix(composite, isolated, step(.5, uIsolated));
}`;

const gradeFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uContrast;
uniform float uSaturation;
uniform float uWarmth;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  vec3 color = (source.rgb - .5) * uContrast + .5;
  float luminance = dot(color, vec3(.2126, .7152, .0722));
  color = mix(vec3(luminance), color, uSaturation);
  color += vec3(uWarmth * .08, 0.0, -uWarmth * .07);
  outColor = vec4(max(vec3(0.0), color), source.a);
}`;

const maskFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uFeather;
uniform float uInvert;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  float luminance = dot(source.rgb, vec3(.2126, .7152, .0722));
  float feather = max(.001, uFeather);
  float mask = smoothstep(uThreshold - feather, uThreshold + feather, luminance);
  mask = mix(mask, 1.0 - mask, step(.5, uInvert));
  outColor = vec4(source.rgb, source.a * mask);
}`;

const regionMaskFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uTop;
uniform float uBottom;
uniform float uFeather;
uniform float uInvert;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  float y = 1.0 - vUv.y;
  float feather = max(.001, uFeather);
  float topEdge = smoothstep(uTop - feather, uTop + feather, y);
  float bottomEdge = 1.0 - smoothstep(uBottom - feather, uBottom + feather, y);
  float mask = clamp(topEdge * bottomEdge, 0.0, 1.0);
  mask = mix(mask, 1.0 - mask, step(.5, uInvert));
  outColor = vec4(source.rgb, source.a * mask);
}`;

const paintMaskFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uMask;
uniform float uOpacity;
uniform float uInvert;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  float mask = texture(uMask, vUv).r;
  mask = mix(mask, 1.0 - mask, step(.5, uInvert));
  mask = mix(1.0, mask, clamp(uOpacity, 0.0, 1.0));
  outColor = vec4(source.rgb, source.a * mask);
}`;

const paintLayerFragment = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uPaint;
uniform sampler2D uErase;
uniform float uOpacity;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uTexture, vUv);
  vec4 paint = texture(uPaint, vUv);
  float amount = clamp(uOpacity, 0.0, 1.0);
  float erase = texture(uErase, vUv).r * amount;
  vec4 base = vec4(source.rgb, source.a * (1.0 - erase));
  float paintAlpha = paint.a * amount;
  float alpha = paintAlpha + base.a * (1.0 - paintAlpha);
  vec3 color = (paint.rgb * paintAlpha + base.rgb * base.a * (1.0 - paintAlpha)) / max(.0001, alpha);
  outColor = vec4(color, alpha);
}`;

const shapeFragment = `#version 300 es
precision highp float;
uniform vec4 uFill;
uniform vec4 uStroke;
uniform float uStrokeWidth;
uniform float uRadius;
uniform int uShape;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 point = abs(vUv - .5) * 2.0;
  float distanceField;
  if (uShape == 1) distanceField = length(point) - 1.0;
  else {
    vec2 radius = vec2(clamp(uRadius, 0.0, .48));
    vec2 q = point - (vec2(1.0) - radius);
    distanceField = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius.x;
  }
  float edge = fwidth(distanceField) * 1.5;
  float inside = 1.0 - smoothstep(-edge, edge, distanceField);
  float stroke = 1.0 - smoothstep(-uStrokeWidth - edge, -uStrokeWidth + edge, distanceField);
  stroke = clamp(inside - stroke, 0.0, 1.0);
  vec4 color = mix(uFill, uStroke, stroke);
  if (uShape == 2) color = uStroke * stroke;
  outColor = vec4(color.rgb, color.a * inside);
}`;

const spectrumFragment = `#version 300 es
precision highp float;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uBars;
uniform float uBass;
uniform float uMids;
uniform float uHighs;
uniform float uBeat;
uniform float uRms;
uniform float uGain;
uniform float uGlow;
uniform float uTime;
uniform int uMirror;
in vec2 vUv;
out vec4 outColor;
float hash(float n) { return fract(sin(n * 91.731) * 43758.5453); }
void main() {
  float bars = max(4.0, floor(uBars));
  float index = floor(vUv.x * bars);
  float local = fract(vUv.x * bars);
  float band = index / max(1.0, bars - 1.0);
  float drive = mix(uBass, uMids, smoothstep(.12, .62, band));
  drive = mix(drive, uHighs, smoothstep(.56, .95, band));
  float motion = .12 * sin(uTime * (1.2 + band * 2.1) + hash(index) * 6.28);
  float height = clamp((.08 + drive * .78 + uRms * .18 + uBeat * .12 + motion) * uGain, .02, 1.0);
  float y = uMirror == 1 ? abs(vUv.y - .5) * 2.0 : vUv.y;
  float body = step(y, height) * smoothstep(.02, .13, local) * (1.0 - smoothstep(.87, .98, local));
  float cap = exp(-abs(y - height) * (80.0 - uGlow * 35.0));
  vec3 color = mix(uColorLow, uColorHigh, band);
  float alpha = clamp(body + cap * uGlow * .55, 0.0, 1.0);
  outColor = vec4(color * (body + cap * uGlow), alpha);
}`;

const waveformFragment = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uThickness;
uniform float uGlow;
uniform float uBass;
uniform float uMids;
uniform float uHighs;
uniform float uBeat;
uniform float uRms;
uniform float uTime;
uniform int uMirror;
in vec2 vUv;
out vec4 outColor;
float trace(float y, float target, float width) { return exp(-abs(y - target) / max(.001, width)); }
void main() {
  float phase = vUv.x * 6.28318 * max(.5, uFrequency);
  float low = sin(phase + uTime * (1.1 + uBass * 2.0)) * (.16 + uBass * .42);
  float mid = sin(phase * 2.13 - uTime * 1.7) * (.08 + uMids * .25);
  float high = sin(phase * 5.07 + uTime * 2.6) * (.025 + uHighs * .12);
  float signal = (low + mid + high) * uAmplitude * (1.0 + uRms * .35 + uBeat * .16);
  float target = .5 + signal;
  float core = trace(vUv.y, target, uThickness);
  if (uMirror == 1) core = max(core, trace(vUv.y, .5 - signal, uThickness));
  float halo = pow(core, .28) * clamp(uGlow, 0.0, 2.0);
  float alpha = clamp(core * 1.3 + halo * .25, 0.0, 1.0) * uColor.a;
  outColor = vec4(uColor.rgb * (core + halo * .65), alpha);
}`;

const pathFragment = `#version 300 es
precision highp float;
uniform vec2 uPoints[32];
uniform int uPointCount;
uniform int uClosed;
uniform float uAspect;
uniform vec4 uColor;
uniform float uStrokeWidth;
uniform float uGlow;
uniform float uDashLength;
uniform float uGapLength;
uniform float uFlowSpeed;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 point = vec2(vUv.x * uAspect, 1.0 - vUv.y);
  float closest = 1000.0;
  float bestAlong = 0.0;
  float cumulative = 0.0;
  int segmentCount = uClosed == 1 ? uPointCount : uPointCount - 1;
  for (int index = 0; index < 32; index++) {
    if (index >= segmentCount) break;
    int nextIndex = index + 1;
    if (nextIndex >= uPointCount) nextIndex = 0;
    vec2 start = vec2(uPoints[index].x * uAspect, uPoints[index].y);
    vec2 end = vec2(uPoints[nextIndex].x * uAspect, uPoints[nextIndex].y);
    vec2 segment = end - start;
    float lengthSquared = max(dot(segment, segment), .0000001);
    float amount = clamp(dot(point - start, segment) / lengthSquared, 0.0, 1.0);
    float distanceToSegment = length(point - (start + segment * amount));
    float segmentLength = sqrt(lengthSquared);
    if (distanceToSegment < closest) {
      closest = distanceToSegment;
      bestAlong = cumulative + segmentLength * amount;
    }
    cumulative += segmentLength;
  }
  float width = max(.0002, uStrokeWidth);
  float antialias = max(fwidth(closest), .0005);
  float core = 1.0 - smoothstep(width, width + antialias, closest);
  float glowRadius = width * (1.0 + max(0.0, uGlow) * 5.0);
  float halo = 1.0 - smoothstep(width, glowRadius + antialias, closest);
  float cycle = max(.0001, uDashLength + uGapLength);
  float dash = uDashLength <= .0001 ? 1.0 : 1.0 - step(uDashLength, mod(bestAlong - uTime * uFlowSpeed, cycle));
  float intensity = clamp(core * dash + halo * dash * .32 * uGlow, 0.0, 1.0);
  float alpha = intensity * uColor.a;
  outColor = vec4(uColor.rgb * intensity * (1.0 + halo * uGlow * .28), alpha);
}`;

const particleFragment = `#version 300 es
precision highp float;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uCount;
uniform float uSize;
uniform float uSpeed;
uniform float uSpread;
uniform float uAudioGain;
uniform float uBass;
uniform float uHighs;
uniform float uBeat;
uniform float uRms;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
float hash(float value) { return fract(sin(value * 127.17) * 43758.5453); }
void main() {
  vec2 grid = vec2(12.0, 8.0);
  vec2 cell = floor(vUv * grid);
  float id = cell.x + cell.y * grid.x;
  float particleEnabled = 1.0 - step(clamp(uCount, 1.0, 96.0), id);
  vec2 point = fract(vUv * grid);
  float drift = uTime * uSpeed * (.18 + hash(id + 9.0) * .32) * (1.0 + uBass * uAudioGain);
  vec2 center = vec2(.12 + hash(id + 2.0) * .76, fract(hash(id + 5.0) + drift));
  vec2 delta = point - center;
  delta.x *= 1.5;
  float drive = clamp(uRms * uAudioGain + uBeat * .35, 0.0, 2.0);
  float radius = .025 + uSize * (.12 + hash(id + 12.0) * .11) * (1.0 + drive * .45);
  float spark = smoothstep(radius, 0.0, length(delta));
  float halo = exp(-length(delta) / max(.01, radius * 2.6)) * .35;
  float spreadMask = 1.0 - smoothstep(clamp(uSpread, .02, 1.0), clamp(uSpread, .02, 1.0) + .15, abs(vUv.y - .5) * 2.0);
  vec3 color = mix(uColorLow, uColorHigh, hash(id + 21.0) * .65 + uHighs * .35);
  float alpha = clamp((spark + halo) * particleEnabled * spreadMask, 0.0, 1.0);
  outColor = vec4(color * (spark * (1.2 + drive) + halo), alpha);
}`;

const posterizeFragment = `#version 300 es
precision highp float; uniform sampler2D uTexture; uniform float uLevels; uniform float uIntensity; in vec2 vUv; out vec4 outColor;
void main(){vec4 s=texture(uTexture,vUv);float levels=max(2.0,floor(uLevels));vec3 p=floor(pow(max(s.rgb,vec3(0.0)),vec3(.82))*levels)/levels;p=pow(p,vec3(1.0/.82));outColor=vec4(mix(s.rgb,p,clamp(uIntensity,0.0,1.0)),s.a);}`;

const bloomFragment = `#version 300 es
precision highp float; uniform sampler2D uTexture; uniform vec2 uTexel; uniform float uThreshold; uniform float uIntensity; uniform float uRadius; in vec2 vUv; out vec4 outColor;
void main(){vec4 s=texture(uTexture,vUv);vec3 glow=vec3(0.0);float r=1.0+uRadius*5.0;vec2 x=vec2(uTexel.x*r,0.0),y=vec2(0.0,uTexel.y*r);glow+=texture(uTexture,vUv+x).rgb+texture(uTexture,vUv-x).rgb+texture(uTexture,vUv+y).rgb+texture(uTexture,vUv-y).rgb;glow*=.25;float gate=smoothstep(uThreshold,1.0,max(glow.r,max(glow.g,glow.b)));outColor=vec4(s.rgb+glow*gate*uIntensity,s.a);}`;

const scanlinesFragment = `#version 300 es
precision highp float; uniform sampler2D uTexture; uniform float uDensity; uniform float uIntensity; uniform float uSpeed; uniform float uTime; in vec2 vUv; out vec4 outColor;
void main(){vec4 s=texture(uTexture,vUv);float line=.5+.5*sin((vUv.y*uDensity+uTime*uSpeed*80.0)*6.28318);float shade=1.0-line*clamp(uIntensity,0.0,.9);outColor=vec4(s.rgb*shade,s.a);}`;

const displacementFragment = `#version 300 es
precision highp float; uniform sampler2D uTexture; uniform float uAmount; uniform float uSpeed; uniform float uTime; in vec2 vUv; out vec4 outColor;
void main(){float wave=sin(vUv.y*42.0+uTime*uSpeed*7.0)*sin(vUv.y*9.0-uTime*uSpeed*3.0);vec2 uv=vUv+vec2(wave*uAmount*.035,0.0);outColor=texture(uTexture,uv);}`;

interface ProgramRecord {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
  inUse: boolean;
}

interface AssetTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  uri: string;
}

interface GeneratedTexture extends AssetTexture {
  signature: string;
}

class RenderTargetPool {
  private targets: RenderTarget[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {}

  acquire(width: number, height: number): RenderTarget {
    const reusable = this.targets.find((target) => !target.inUse && target.width === width && target.height === height);
    if (reusable) {
      reusable.inUse = true;
      return reusable;
    }
    const texture = this.gl.createTexture();
    const framebuffer = this.gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error('Could not allocate a render target.');
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.gl.deleteFramebuffer(framebuffer);
      this.gl.deleteTexture(texture);
      throw new Error('The GPU returned an incomplete render target.');
    }
    const target = { texture, framebuffer, width, height, inUse: true };
    this.targets.push(target);
    return target;
  }

  release(target: RenderTarget): void {
    target.inUse = false;
  }

  dispose(): void {
    for (const target of this.targets) {
      this.gl.deleteFramebuffer(target.framebuffer);
      this.gl.deleteTexture(target.texture);
    }
    this.targets = [];
  }
}

export class HorizonRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly programs = new Map<string, ProgramRecord>();
  private readonly assets = new Map<string, AssetTexture>();
  private readonly generated = new Map<string, GeneratedTexture>();
  private readonly pool: RenderTargetPool;
  private readonly quad: WebGLBuffer;
  private project: HorizonProject | null = null;
  private drawCalls = 0;
  private passes = 0;
  private lastError = '';

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) throw new Error('Data Horizon requires WebGL2.');
    this.gl = gl;
    this.pool = new RenderTargetPool(gl);
    const quad = gl.createBuffer();
    if (!quad) throw new Error('Could not allocate the renderer geometry.');
    this.quad = quad;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.programs.set('source', this.createProgram(sourceFragment));
    this.programs.set('copy', this.createProgram(copyFragment));
    this.programs.set('celShading', this.createProgram(celFragment));
    this.programs.set('outline', this.createProgram(outlineFragment));
    this.programs.set('colorGrade', this.createProgram(gradeFragment));
    this.programs.set('luminanceMask', this.createProgram(maskFragment));
    this.programs.set('regionMask', this.createProgram(regionMaskFragment));
    this.programs.set('paintMask', this.createProgram(paintMaskFragment));
    this.programs.set('paintLayer', this.createProgram(paintLayerFragment));
    this.programs.set('shape', this.createProgram(shapeFragment));
    this.programs.set('spectrum', this.createProgram(spectrumFragment));
    this.programs.set('waveform', this.createProgram(waveformFragment));
    this.programs.set('path', this.createProgram(pathFragment));
    this.programs.set('particles', this.createProgram(particleFragment));
    this.programs.set('posterize', this.createProgram(posterizeFragment));
    this.programs.set('bloom', this.createProgram(bloomFragment));
    this.programs.set('scanlines', this.createProgram(scanlinesFragment));
    this.programs.set('displacement', this.createProgram(displacementFragment));
  }

  async setProject(project: HorizonProject): Promise<void> {
    this.project = project;
    const activeAssetIds = new Set(project.assets.map((asset) => asset.id));
    for (const [assetId, record] of this.assets) {
      if (activeAssetIds.has(assetId)) continue;
      this.gl.deleteTexture(record.texture);
      this.assets.delete(assetId);
    }
    const activeGenerated = new Set<string>();
    const inspectGenerated = (layers: readonly HorizonLayer[]): void => {
      for (const layer of layers) {
        if (layer.type === 'text') activeGenerated.add(layer.id);
        for (const effect of layer.effects) if (effect.type === 'paintMask') activeGenerated.add(`paint-mask:${effect.id}`);
        if (layer.type === 'group') inspectGenerated(layer.children);
      }
    };
    inspectGenerated(project.layers);
    for (const [key, record] of this.generated) {
      if (activeGenerated.has(key)) continue;
      this.gl.deleteTexture(record.texture);
      this.generated.delete(key);
    }
    await Promise.all(project.assets.map((asset) => this.loadAsset(asset)));
  }

  render(frame: RenderFrame): RendererDiagnostics {
    if (!this.project) return this.diagnostics();
    try {
      this.resizeToDisplaySize();
      this.drawCalls = 0;
      this.passes = 0;
      const background = this.project.canvas.background;
      this.bindDestination(null);
      this.gl.disable(this.gl.BLEND);
      this.gl.clearColor(background[0], background[1], background[2], background[3]);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.renderNodes(this.project.layers, null, frame);
      this.lastError = '';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
    return this.diagnostics();
  }

  diagnostics(): RendererDiagnostics {
    return {
      webgl2: true,
      width: this.canvas.width,
      height: this.canvas.height,
      loadedAssets: this.assets.size,
      drawCalls: this.drawCalls,
      passes: this.passes,
      lastError: this.lastError
    };
  }

  dispose(): void {
    for (const record of this.programs.values()) this.gl.deleteProgram(record.program);
    for (const record of this.assets.values()) this.gl.deleteTexture(record.texture);
    for (const record of this.generated.values()) this.gl.deleteTexture(record.texture);
    this.pool.dispose();
    this.gl.deleteBuffer(this.quad);
  }

  private createProgram(fragment: string): ProgramRecord {
    const gl = this.gl;
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not allocate a shader.');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation failure.';
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error('Could not allocate a shader program.');
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const pixel = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown shader link failure.';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return { program, uniforms: new Map() };
  }

  private uniform(record: ProgramRecord, name: string): WebGLUniformLocation | null {
    if (!record.uniforms.has(name)) record.uniforms.set(name, this.gl.getUniformLocation(record.program, name));
    return record.uniforms.get(name) ?? null;
  }

  private useProgram(name: string): ProgramRecord {
    const record = this.programs.get(name);
    if (!record) throw new Error(`Unknown render pass: ${name}.`);
    const gl = this.gl;
    gl.useProgram(record.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const position = gl.getAttribLocation(record.program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const offset = this.uniform(record, 'uOffset');
    if (offset) gl.uniform2f(offset, 0, 0);
    const scale = this.uniform(record, 'uScale');
    if (scale) gl.uniform2f(scale, 1, 1);
    const rotation = this.uniform(record, 'uRotation');
    if (rotation) gl.uniform1f(rotation, 0);
    return record;
  }

  private bindDestination(target: RenderTarget | null): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target?.framebuffer ?? null);
    this.gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height);
  }

  private clearTarget(target: RenderTarget): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private renderNodes(layers: readonly HorizonLayer[], destination: RenderTarget | null, frame: RenderFrame): void {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index];
      if (!layer.visible || layer.opacity <= 0) continue;
      this.renderLayer(layer, destination, frame);
    }
  }

  private renderLayer(layer: HorizonLayer, destination: RenderTarget | null, frame: RenderFrame): void {
    let current: RenderTarget;
    if (layer.type === 'group') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.renderNodes(layer.children, current, frame);
    } else if (layer.type === 'image') {
      const asset = this.assets.get(layer.assetId);
      if (!asset) return;
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawTextureSource(layer.fit, asset, current);
    } else if (layer.type === 'text') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawTextureSource('contain', this.textTexture(layer), current);
    } else if (layer.type === 'shape') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawShapeSource(layer, current, frame);
    } else if (layer.type === 'spectrum') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawSpectrumSource(layer, current, frame);
    } else if (layer.type === 'waveform') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawWaveformSource(layer, current, frame);
    } else if (layer.type === 'path') {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawPathSource(layer, current, frame);
    } else {
      current = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(current);
      this.drawParticleSource(layer, current, frame);
    }

    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      const output = this.pool.acquire(this.canvas.width, this.canvas.height);
      this.clearTarget(output);
      this.drawEffect(layer, effect, current.texture, output, frame);
      this.pool.release(current);
      current = output;
    }

    this.composite(layer, current.texture, destination, frame);
    this.pool.release(current);
  }

  private drawTextureSource(fit: ImageLayer['fit'], asset: AssetTexture, target: RenderTarget): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('source');
    this.bindTexture(record, asset.texture);
    const canvasAspect = this.canvas.width / Math.max(1, this.canvas.height);
    const imageAspect = asset.width / Math.max(1, asset.height);
    let scaleX = 1;
    let scaleY = 1;
    let clipOutside = 0;
    if (fit === 'cover') {
      if (canvasAspect > imageAspect) scaleY = imageAspect / canvasAspect;
      else scaleX = canvasAspect / imageAspect;
    } else if (fit === 'contain') {
      clipOutside = 1;
      if (canvasAspect > imageAspect) scaleX = canvasAspect / imageAspect;
      else scaleY = imageAspect / canvasAspect;
    }
    this.gl.uniform2f(this.uniform(record, 'uUvScale'), scaleX, scaleY);
    this.gl.uniform1i(this.uniform(record, 'uClipOutside'), clipOutside);
    this.draw();
  }

  private textTexture(layer: TextLayer): AssetTexture {
    const transform = layer.transform ?? { width: 800, height: 240 };
    const signature = JSON.stringify([
      layer.text, layer.fontFamily, layer.fontSize, layer.fontWeight, layer.alignment, layer.verticalAlignment, layer.color,
      layer.italic, layer.letterSpacing, layer.lineHeight, layer.padding, layer.backgroundColor, layer.backgroundOpacity,
      layer.borderColor, layer.borderWidth, layer.cornerRadius, layer.outlineColor, layer.outlineWidth,
      layer.shadowColor, layer.shadowBlur, transform.width, transform.height
    ]);
    const cached = this.generated.get(layer.id);
    if (cached?.signature === signature) return cached;
    if (cached) this.gl.deleteTexture(cached.texture);
    const source = document.createElement('canvas');
    source.width = 2048;
    source.height = Math.max(128, Math.min(1024, Math.round(2048 * Math.max(1, transform.height) / Math.max(1, transform.width))));
    const context = source.getContext('2d');
    if (!context) throw new Error('Text canvas is unavailable.');
    context.clearRect(0, 0, source.width, source.height);
    const scale = source.width / Math.max(1, transform.width);
    const withOpacity = (color: string, opacity: number): string => {
      const base = /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000';
      return `${base}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
    };
    const radius = Math.max(0, layer.cornerRadius * scale);
    const borderWidth = Math.max(0, layer.borderWidth * scale);
    if (layer.backgroundOpacity > 0 || borderWidth > 0) {
      const inset = borderWidth / 2 + 1;
      context.beginPath();
      context.roundRect(inset, inset, source.width - inset * 2, source.height - inset * 2, Math.min(radius, source.height / 2));
      if (layer.backgroundOpacity > 0) {
        context.fillStyle = withOpacity(layer.backgroundColor, layer.backgroundOpacity);
        context.fill();
      }
      if (borderWidth > 0) {
        context.strokeStyle = layer.borderColor;
        context.lineWidth = borderWidth;
        context.stroke();
      }
    }
    const fontSize = Math.max(8, layer.fontSize * scale);
    const letterSpacing = layer.letterSpacing * scale;
    const lineHeight = fontSize * Math.max(.5, layer.lineHeight);
    const padding = Math.max(0, layer.padding * scale);
    const contentWidth = Math.max(1, source.width - padding * 2);
    const contentHeight = Math.max(1, source.height - padding * 2);
    const fontFamily = layer.fontFamily.includes(' ') ? `"${layer.fontFamily.replaceAll('"', '')}"` : layer.fontFamily;
    context.font = `${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${fontSize}px ${fontFamily}`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    const measure = (text: string): number => context.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
    const wrapParagraph = (paragraph: string): string[] => {
      if (!paragraph) return [''];
      const lines: string[] = [];
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || measure(candidate) <= contentWidth) {
          line = candidate;
          continue;
        }
        lines.push(line);
        if (measure(word) <= contentWidth) line = word;
        else {
          let fragment = '';
          for (const character of word) {
            if (fragment && measure(fragment + character) > contentWidth) { lines.push(fragment); fragment = character; }
            else fragment += character;
          }
          line = fragment;
        }
      }
      if (line) lines.push(line);
      return lines;
    };
    const lines = layer.text.split(/\r?\n/).flatMap(wrapParagraph);
    const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines && visibleLines.length) {
      let finalLine = visibleLines[visibleLines.length - 1];
      while (finalLine && measure(`${finalLine}…`) > contentWidth) finalLine = finalLine.slice(0, -1);
      visibleLines[visibleLines.length - 1] = `${finalLine}…`;
    }
    const blockHeight = visibleLines.length * lineHeight;
    const startY = layer.verticalAlignment === 'top'
      ? padding + lineHeight / 2
      : layer.verticalAlignment === 'bottom'
        ? source.height - padding - blockHeight + lineHeight / 2
        : (source.height - blockHeight) / 2 + lineHeight / 2;
    const drawLine = (text: string, y: number): void => {
      const width = measure(text);
      let x = layer.alignment === 'left' ? padding : layer.alignment === 'right' ? source.width - padding - width : (source.width - width) / 2;
      for (const character of text) {
        if (layer.outlineWidth > 0) {
          context.strokeStyle = layer.outlineColor;
          context.lineWidth = layer.outlineWidth * scale * 2;
          context.lineJoin = 'round';
          context.strokeText(character, x, y);
        }
        context.fillStyle = layer.color;
        context.fillText(character, x, y);
        x += context.measureText(character).width + letterSpacing;
      }
    };
    context.shadowColor = layer.shadowColor;
    context.shadowBlur = Math.max(0, layer.shadowBlur * scale);
    for (let index = 0; index < visibleLines.length; index += 1) drawLine(visibleLines[index], startY + index * lineHeight);
    context.shadowBlur = 0;
    const texture = this.gl.createTexture();
    if (!texture) throw new Error('Could not allocate text texture.');
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
    const record = { texture, width: source.width, height: source.height, uri: `generated:text:${layer.id}`, signature };
    this.generated.set(layer.id, record);
    return record;
  }

  private paintMaskTexture(layer: HorizonLayer, effect: HorizonEffect): AssetTexture {
    const transform = layer.transform ?? { width: this.project?.canvas.width ?? 1920, height: this.project?.canvas.height ?? 1080 };
    const width = transform.width >= transform.height ? 512 : Math.max(128, Math.round(512 * transform.width / Math.max(1, transform.height)));
    const height = transform.height >= transform.width ? 512 : Math.max(128, Math.round(512 * transform.height / Math.max(1, transform.width)));
    const mask = effect.paintMask ?? { base: 1 as const, strokes: [] };
    const signature = JSON.stringify([width, height, mask]);
    const key = `paint-mask:${effect.id}`;
    const cached = this.generated.get(key);
    if (cached?.signature === signature) return cached;
    if (cached) this.gl.deleteTexture(cached.texture);
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const context = source.getContext('2d');
    if (!context) throw new Error('Painted mask canvas is unavailable.');
    const base = mask.base === 0 ? 0 : 255;
    context.fillStyle = `rgb(${base},${base},${base})`;
    context.fillRect(0, 0, width, height);
    const stamp = (x: number, y: number, radius: number, value: number, softness: number, opacity: number): void => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const color = value > .5 ? '255,255,255' : '0,0,0';
      const hardEdge = Math.max(0, Math.min(.98, 1 - softness));
      gradient.addColorStop(0, `rgba(${color},${opacity})`);
      gradient.addColorStop(hardEdge, `rgba(${color},${opacity})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    };
    for (const stroke of mask.strokes) {
      if (!stroke.points.length) continue;
      const radius = Math.max(1, stroke.size * Math.min(width, height) / 2);
      const spacing = Math.max(1, radius * .22);
      const value = stroke.mode === 'reveal' ? 1 : 0;
      const softness = Math.max(0, Math.min(1, stroke.softness));
      const opacity = Math.max(0, Math.min(1, stroke.opacity));
      let previous = stroke.points[0];
      stamp(previous.x * width, previous.y * height, radius, value, softness, opacity);
      for (const point of stroke.points.slice(1)) {
        const fromX = previous.x * width;
        const fromY = previous.y * height;
        const toX = point.x * width;
        const toY = point.y * height;
        const distance = Math.hypot(toX - fromX, toY - fromY);
        const steps = Math.max(1, Math.ceil(distance / spacing));
        for (let step = 1; step <= steps; step += 1) {
          const amount = step / steps;
          stamp(fromX + (toX - fromX) * amount, fromY + (toY - fromY) * amount, radius, value, softness, opacity);
        }
        previous = point;
      }
    }
    const texture = this.gl.createTexture();
    if (!texture) throw new Error('Could not allocate a painted mask texture.');
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
    const record = { texture, width, height, uri: key, signature };
    this.generated.set(key, record);
    return record;
  }

  private paintLayerTextures(layer: HorizonLayer, effect: HorizonEffect): { paint: AssetTexture; erase: AssetTexture } {
    const transform = layer.transform ?? { width: this.project?.canvas.width ?? 1920, height: this.project?.canvas.height ?? 1080 };
    const width = transform.width >= transform.height ? 1024 : Math.max(256, Math.round(1024 * transform.width / Math.max(1, transform.height)));
    const height = transform.height >= transform.width ? 1024 : Math.max(256, Math.round(1024 * transform.height / Math.max(1, transform.width)));
    const data = effect.paintLayer ?? { strokes: [] };
    const signature = JSON.stringify([width, height, data]);
    const paintKey = `paint-layer-color:${effect.id}`;
    const eraseKey = `paint-layer-erase:${effect.id}`;
    const cachedPaint = this.generated.get(paintKey);
    const cachedErase = this.generated.get(eraseKey);
    if (cachedPaint?.signature === signature && cachedErase?.signature === signature) return { paint: cachedPaint, erase: cachedErase };
    if (cachedPaint) this.gl.deleteTexture(cachedPaint.texture);
    if (cachedErase) this.gl.deleteTexture(cachedErase.texture);

    const paintCanvas = document.createElement('canvas');
    const eraseCanvas = document.createElement('canvas');
    paintCanvas.width = eraseCanvas.width = width;
    paintCanvas.height = eraseCanvas.height = height;
    const paintContext = paintCanvas.getContext('2d');
    const eraseContext = eraseCanvas.getContext('2d');
    if (!paintContext || !eraseContext) throw new Error('Paint layer canvases are unavailable.');
    const stamp = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, softness: number, opacity: number): void => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const hardEdge = Math.max(0, Math.min(.98, 1 - softness));
      const rgb = /^#[0-9a-f]{6}$/i.test(color) ? `${Number.parseInt(color.slice(1, 3), 16)},${Number.parseInt(color.slice(3, 5), 16)},${Number.parseInt(color.slice(5, 7), 16)}` : '25,219,255';
      gradient.addColorStop(0, `rgba(${rgb},${opacity})`);
      gradient.addColorStop(hardEdge, `rgba(${rgb},${opacity})`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    };
    const drawStroke = (context: CanvasRenderingContext2D, stroke: NonNullable<HorizonEffect['paintLayer']>['strokes'][number], color: string): void => {
      if (!stroke.points.length) return;
      const radius = Math.max(1, stroke.size * Math.min(width, height) / 2);
      const spacing = Math.max(1, radius * .22);
      let previous = stroke.points[0];
      stamp(context, previous.x * width, previous.y * height, radius, color, stroke.softness, stroke.opacity);
      for (const point of stroke.points.slice(1)) {
        const fromX = previous.x * width;
        const fromY = previous.y * height;
        const toX = point.x * width;
        const toY = point.y * height;
        const distance = Math.hypot(toX - fromX, toY - fromY);
        const steps = Math.max(1, Math.ceil(distance / spacing));
        for (let step = 1; step <= steps; step += 1) {
          const amount = step / steps;
          stamp(context, fromX + (toX - fromX) * amount, fromY + (toY - fromY) * amount, radius, color, stroke.softness, stroke.opacity);
        }
        previous = point;
      }
    };
    for (const stroke of data.strokes) {
      if (stroke.mode === 'paint') {
        eraseContext.globalCompositeOperation = 'destination-out';
        drawStroke(eraseContext, stroke, '#FFFFFF');
        eraseContext.globalCompositeOperation = 'source-over';
        drawStroke(paintContext, stroke, stroke.color);
      } else {
        paintContext.globalCompositeOperation = 'destination-out';
        drawStroke(paintContext, stroke, '#FFFFFF');
        paintContext.globalCompositeOperation = 'source-over';
        drawStroke(eraseContext, stroke, '#FFFFFF');
      }
    }
    const upload = (source: HTMLCanvasElement, key: string): GeneratedTexture => {
      const texture = this.gl.createTexture();
      if (!texture) throw new Error('Could not allocate a paint layer texture.');
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
      const record = { texture, width, height, uri: key, signature };
      this.generated.set(key, record);
      return record;
    };
    return { paint: upload(paintCanvas, paintKey), erase: upload(eraseCanvas, eraseKey) };
  }

  private color(value: string, fallback: [number, number, number, number]): [number, number, number, number] {
    const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
    if (!match) return fallback;
    const rgb = Number.parseInt(match[1], 16);
    const alpha = match[2] ? Number.parseInt(match[2], 16) / 255 : 1;
    return [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, alpha];
  }

  private sourceValue(layer: HorizonLayer, key: string, fallback: number, frame: RenderFrame): number {
    const path = `layer.${layer.id}.source.${key}`;
    return (frame.animation?.get(path) ?? fallback) + (frame.modulation?.get(path) ?? 0);
  }

  private drawShapeSource(layer: ShapeLayer, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('shape');
    const fill = this.color(layer.fill, [0.03, 0.09, 0.14, 0.8]);
    const stroke = this.color(layer.stroke, [0.29, 0.89, 0.88, 1]);
    this.gl.uniform4fv(this.uniform(record, 'uFill'), fill);
    this.gl.uniform4fv(this.uniform(record, 'uStroke'), stroke);
    const width = Math.max(1, layer.transform?.width ?? 800);
    this.gl.uniform1f(this.uniform(record, 'uStrokeWidth'), Math.max(0, this.sourceValue(layer, 'strokeWidth', layer.strokeWidth, frame)) / width * 2);
    this.gl.uniform1f(this.uniform(record, 'uRadius'), Math.max(0, this.sourceValue(layer, 'cornerRadius', layer.cornerRadius, frame)) / width * 2);
    this.gl.uniform1i(this.uniform(record, 'uShape'), layer.shape === 'ellipse' ? 1 : layer.shape === 'frame' ? 2 : 0);
    this.draw();
  }

  private drawSpectrumSource(layer: SpectrumLayer, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('spectrum');
    const low = this.color(layer.colorLow, [.58, .52, 1, 1]);
    const high = this.color(layer.colorHigh, [.29, .89, .88, 1]);
    const audio = frame.audio ?? { bass: 0, mids: 0, highs: 0, beat: 0, rms: 0 };
    this.gl.uniform3fv(this.uniform(record, 'uColorLow'), low.slice(0, 3));
    this.gl.uniform3fv(this.uniform(record, 'uColorHigh'), high.slice(0, 3));
    this.gl.uniform1f(this.uniform(record, 'uBars'), layer.bars);
    this.gl.uniform1f(this.uniform(record, 'uBass'), audio.bass);
    this.gl.uniform1f(this.uniform(record, 'uMids'), audio.mids);
    this.gl.uniform1f(this.uniform(record, 'uHighs'), audio.highs);
    this.gl.uniform1f(this.uniform(record, 'uBeat'), audio.beat);
    this.gl.uniform1f(this.uniform(record, 'uRms'), audio.rms);
    this.gl.uniform1f(this.uniform(record, 'uGain'), Math.max(0, this.sourceValue(layer, 'gain', layer.gain, frame)));
    this.gl.uniform1f(this.uniform(record, 'uGlow'), Math.max(0, this.sourceValue(layer, 'glow', layer.glow, frame)));
    this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    this.gl.uniform1i(this.uniform(record, 'uMirror'), layer.mirror ? 1 : 0);
    this.draw();
  }

  private drawWaveformSource(layer: WaveformLayer, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('waveform');
    const color = this.color(layer.color, [.29, .89, .88, 1]);
    const audio = frame.audio ?? { bass: 0, mids: 0, highs: 0, beat: 0, rms: 0 };
    this.gl.uniform4fv(this.uniform(record, 'uColor'), color);
    this.gl.uniform1f(this.uniform(record, 'uAmplitude'), Math.max(0, this.sourceValue(layer, 'amplitude', layer.amplitude, frame)));
    this.gl.uniform1f(this.uniform(record, 'uFrequency'), Math.max(.5, this.sourceValue(layer, 'frequency', layer.frequency, frame)));
    this.gl.uniform1f(this.uniform(record, 'uThickness'), Math.max(.001, this.sourceValue(layer, 'thickness', layer.thickness, frame)));
    this.gl.uniform1f(this.uniform(record, 'uGlow'), Math.max(0, this.sourceValue(layer, 'glow', layer.glow, frame)));
    this.gl.uniform1f(this.uniform(record, 'uBass'), audio.bass);
    this.gl.uniform1f(this.uniform(record, 'uMids'), audio.mids);
    this.gl.uniform1f(this.uniform(record, 'uHighs'), audio.highs);
    this.gl.uniform1f(this.uniform(record, 'uBeat'), audio.beat);
    this.gl.uniform1f(this.uniform(record, 'uRms'), audio.rms);
    this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    this.gl.uniform1i(this.uniform(record, 'uMirror'), layer.mirror ? 1 : 0);
    this.draw();
  }

  private drawPathSource(layer: PathLayer, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('path');
    const transform = layer.transform ?? { width: 1480, height: 700 };
    const height = Math.max(1, transform.height);
    const points = layer.points.slice(0, 32);
    const packed = new Float32Array(64);
    for (let index = 0; index < points.length; index += 1) {
      packed[index * 2] = points[index].x;
      packed[index * 2 + 1] = points[index].y;
    }
    this.gl.uniform2fv(this.uniform(record, 'uPoints[0]'), packed);
    this.gl.uniform1i(this.uniform(record, 'uPointCount'), points.length);
    this.gl.uniform1i(this.uniform(record, 'uClosed'), layer.closed ? 1 : 0);
    this.gl.uniform1f(this.uniform(record, 'uAspect'), Math.max(.001, transform.width / height));
    this.gl.uniform4fv(this.uniform(record, 'uColor'), this.color(layer.color, [.29, .89, .88, 1]));
    this.gl.uniform1f(this.uniform(record, 'uStrokeWidth'), Math.max(.25, this.sourceValue(layer, 'strokeWidth', layer.strokeWidth, frame)) / height * .5);
    this.gl.uniform1f(this.uniform(record, 'uGlow'), Math.max(0, this.sourceValue(layer, 'glow', layer.glow, frame)));
    this.gl.uniform1f(this.uniform(record, 'uDashLength'), Math.max(0, this.sourceValue(layer, 'dashLength', layer.dashLength, frame)) / height);
    this.gl.uniform1f(this.uniform(record, 'uGapLength'), Math.max(0, this.sourceValue(layer, 'gapLength', layer.gapLength, frame)) / height);
    this.gl.uniform1f(this.uniform(record, 'uFlowSpeed'), this.sourceValue(layer, 'flowSpeed', layer.flowSpeed, frame) / height);
    this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    this.draw();
  }

  private drawParticleSource(layer: ParticleLayer, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram('particles');
    const low = this.color(layer.colorLow, [.58, .52, 1, 1]);
    const high = this.color(layer.colorHigh, [.29, .89, .88, 1]);
    const audio = frame.audio ?? { bass: 0, mids: 0, highs: 0, beat: 0, rms: 0 };
    this.gl.uniform3fv(this.uniform(record, 'uColorLow'), low.slice(0, 3));
    this.gl.uniform3fv(this.uniform(record, 'uColorHigh'), high.slice(0, 3));
    this.gl.uniform1f(this.uniform(record, 'uCount'), Math.max(1, Math.min(96, layer.count)));
    this.gl.uniform1f(this.uniform(record, 'uSize'), Math.max(.01, this.sourceValue(layer, 'size', layer.size, frame)));
    this.gl.uniform1f(this.uniform(record, 'uSpeed'), this.sourceValue(layer, 'speed', layer.speed, frame));
    this.gl.uniform1f(this.uniform(record, 'uSpread'), Math.max(.02, this.sourceValue(layer, 'spread', layer.spread, frame)));
    this.gl.uniform1f(this.uniform(record, 'uAudioGain'), Math.max(0, this.sourceValue(layer, 'audioGain', layer.audioGain, frame)));
    this.gl.uniform1f(this.uniform(record, 'uBass'), audio.bass);
    this.gl.uniform1f(this.uniform(record, 'uHighs'), audio.highs);
    this.gl.uniform1f(this.uniform(record, 'uBeat'), audio.beat);
    this.gl.uniform1f(this.uniform(record, 'uRms'), audio.rms);
    this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    this.draw();
  }

  private drawEffect(layer: HorizonLayer, effect: HorizonEffect, input: WebGLTexture, target: RenderTarget, frame: RenderFrame): void {
    this.bindDestination(target);
    this.gl.disable(this.gl.BLEND);
    const record = this.useProgram(effect.type);
    this.bindTexture(record, input);
    const value = (key: string, fallback: number, minimum = -10, maximum = 20): number => {
      const path = `layer.${layer.id}.effect.${effect.id}.${key}`;
      return Math.max(minimum, Math.min(maximum, (frame.animation?.get(path) ?? fallback) + (frame.modulation?.get(path) ?? 0)));
    };
    if (effect.type === 'celShading') {
      this.gl.uniform1f(this.uniform(record, 'uLevels'), value('levels', effect.parameters.levels, 2, 16));
      this.gl.uniform1f(this.uniform(record, 'uIntensity'), value('intensity', effect.parameters.intensity, 0, 1));
    } else if (effect.type === 'outline') {
      this.gl.uniform2f(this.uniform(record, 'uTexel'), 1 / this.canvas.width, 1 / this.canvas.height);
      this.gl.uniform1f(this.uniform(record, 'uStrength'), value('strength', effect.parameters.strength, 0, 2));
      this.gl.uniform1f(this.uniform(record, 'uThreshold'), value('threshold', effect.parameters.threshold, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uThickness'), value('thickness', effect.parameters.thickness ?? 1, .25, 8));
      this.gl.uniform1f(this.uniform(record, 'uSoftness'), value('softness', effect.parameters.softness ?? .18, .001, 1));
      this.gl.uniform1f(this.uniform(record, 'uIsolated'), effect.outputMode === 'isolated' ? 1 : 0);
      this.gl.uniform3fv(this.uniform(record, 'uColor'), this.color(effect.color ?? '#19DBFF', [.1, .86, 1, 1]).slice(0, 3));
    } else if (effect.type === 'colorGrade') {
      this.gl.uniform1f(this.uniform(record, 'uContrast'), value('contrast', effect.parameters.contrast, 0, 3));
      this.gl.uniform1f(this.uniform(record, 'uSaturation'), value('saturation', effect.parameters.saturation, 0, 3));
      this.gl.uniform1f(this.uniform(record, 'uWarmth'), value('warmth', effect.parameters.warmth, -1, 1));
    } else if (effect.type === 'luminanceMask') {
      this.gl.uniform1f(this.uniform(record, 'uThreshold'), value('threshold', effect.parameters.threshold, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uFeather'), value('feather', effect.parameters.feather, 0.001, 1));
      this.gl.uniform1f(this.uniform(record, 'uInvert'), value('invert', effect.parameters.invert, 0, 1));
    } else if (effect.type === 'regionMask') {
      this.gl.uniform1f(this.uniform(record, 'uTop'), value('top', effect.parameters.top, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uBottom'), value('bottom', effect.parameters.bottom, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uFeather'), value('feather', effect.parameters.feather, 0.001, .5));
      this.gl.uniform1f(this.uniform(record, 'uInvert'), value('invert', effect.parameters.invert, 0, 1));
    } else if (effect.type === 'paintMask') {
      const mask = this.paintMaskTexture(layer, effect);
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, mask.texture);
      this.gl.uniform1i(this.uniform(record, 'uMask'), 1);
      this.gl.uniform1f(this.uniform(record, 'uOpacity'), value('opacity', effect.parameters.opacity, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uInvert'), value('invert', effect.parameters.invert, 0, 1));
      this.gl.activeTexture(this.gl.TEXTURE0);
    } else if (effect.type === 'paintLayer') {
      const textures = this.paintLayerTextures(layer, effect);
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, textures.paint.texture);
      this.gl.uniform1i(this.uniform(record, 'uPaint'), 1);
      this.gl.activeTexture(this.gl.TEXTURE2);
      this.gl.bindTexture(this.gl.TEXTURE_2D, textures.erase.texture);
      this.gl.uniform1i(this.uniform(record, 'uErase'), 2);
      this.gl.uniform1f(this.uniform(record, 'uOpacity'), value('opacity', effect.parameters.opacity, 0, 1));
      this.gl.activeTexture(this.gl.TEXTURE0);
    } else if (effect.type === 'posterize') {
      this.gl.uniform1f(this.uniform(record, 'uLevels'), value('levels', effect.parameters.levels, 2, 24));
      this.gl.uniform1f(this.uniform(record, 'uIntensity'), value('intensity', effect.parameters.intensity, 0, 1));
    } else if (effect.type === 'bloom') {
      this.gl.uniform2f(this.uniform(record, 'uTexel'), 1 / this.canvas.width, 1 / this.canvas.height);
      this.gl.uniform1f(this.uniform(record, 'uThreshold'), value('threshold', effect.parameters.threshold, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uIntensity'), value('intensity', effect.parameters.intensity, 0, 3));
      this.gl.uniform1f(this.uniform(record, 'uRadius'), value('radius', effect.parameters.radius, 0, 1));
    } else if (effect.type === 'scanlines') {
      this.gl.uniform1f(this.uniform(record, 'uDensity'), value('density', effect.parameters.density, 20, 1200));
      this.gl.uniform1f(this.uniform(record, 'uIntensity'), value('intensity', effect.parameters.intensity, 0, .9));
      this.gl.uniform1f(this.uniform(record, 'uSpeed'), value('speed', effect.parameters.speed, -3, 3));
      this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    } else if (effect.type === 'displacement') {
      this.gl.uniform1f(this.uniform(record, 'uAmount'), value('amount', effect.parameters.amount, 0, 1));
      this.gl.uniform1f(this.uniform(record, 'uSpeed'), value('speed', effect.parameters.speed, -3, 3));
      this.gl.uniform1f(this.uniform(record, 'uTime'), frame.timeSeconds);
    }
    this.draw();
    this.passes += 1;
  }

  private composite(layer: HorizonLayer, texture: WebGLTexture, destination: RenderTarget | null, frame: RenderFrame): void {
    this.bindDestination(destination);
    this.configureBlend(layer.blendMode);
    const record = this.useProgram('copy');
    this.bindTexture(record, texture);
    const opacityPath = `layer.${layer.id}.opacity`;
    const opacity = Math.max(0, Math.min(1, (frame.animation?.get(opacityPath) ?? layer.opacity) + (frame.modulation?.get(opacityPath) ?? 0)));
    this.gl.uniform1f(this.uniform(record, 'uOpacity'), opacity);
    this.gl.uniform1i(this.uniform(record, 'uPremultiplyColor'), layer.blendMode === 'screen' ? 1 : 0);
    const parallaxPath = `layer.${layer.id}.parallax`;
    const depthPath = `layer.${layer.id}.depth`;
    const parallax = (frame.animation?.get(parallaxPath) ?? layer.parallax) + (frame.modulation?.get(parallaxPath) ?? 0);
    const depth = (frame.animation?.get(depthPath) ?? layer.depth) + (frame.modulation?.get(depthPath) ?? 0);
    const offsetAmount = parallax * (0.008 + Math.abs(depth) * 0.015);
    const projectWidth = Math.max(1, this.project?.canvas.width ?? 1920);
    const projectHeight = Math.max(1, this.project?.canvas.height ?? 1080);
    const transform = layer.transform ?? { x: projectWidth / 2, y: projectHeight / 2, width: projectWidth, height: projectHeight, rotation: 0 };
    const modulated = (key: string, fallback: number): number => {
      const path = `layer.${layer.id}.transform.${key}`;
      return (frame.animation?.get(path) ?? fallback) + (frame.modulation?.get(path) ?? 0);
    };
    const x = modulated('x', transform.x);
    const y = modulated('y', transform.y);
    const width = Math.max(1, modulated('width', transform.width));
    const height = Math.max(1, modulated('height', transform.height));
    this.gl.uniform2f(this.uniform(record, 'uScale'), width / projectWidth, height / projectHeight);
    this.gl.uniform1f(this.uniform(record, 'uRotation'), modulated('rotation', transform.rotation));
    this.gl.uniform2f(
      this.uniform(record, 'uOffset'),
      (x / projectWidth) * 2 - 1 + Math.sin(frame.timeSeconds * 0.19) * offsetAmount,
      1 - (y / projectHeight) * 2 + Math.cos(frame.timeSeconds * 0.15) * offsetAmount
    );
    this.draw();
    this.passes += 1;
  }

  private bindTexture(record: ProgramRecord, texture: WebGLTexture): void {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.uniform(record, 'uTexture'), 0);
  }

  private configureBlend(mode: BlendMode): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else if (mode === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'screen') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private draw(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.drawCalls += 1;
  }

  private resizeToDisplaySize(): void {
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.pool.dispose();
    }
  }

  private async loadAsset(asset: HorizonAsset): Promise<void> {
    const existing = this.assets.get(asset.id);
    if (existing?.uri === asset.uri) return;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error(`Could not load ${asset.name}.`));
      candidate.src = asset.uri;
    });
    const texture = this.gl.createTexture();
    if (!texture) throw new Error(`Could not allocate a texture for ${asset.name}.`);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    if (existing) this.gl.deleteTexture(existing.texture);
    this.assets.set(asset.id, { texture, width: image.naturalWidth, height: image.naturalHeight, uri: asset.uri });
  }
}
