import type { AudioSource, ParameterBinding } from '@data-horizon/project-model';

export interface AudioFeatureFrame {
  sequence: number;
  timestampSeconds: number;
  bass: number;
  mids: number;
  highs: number;
  beat: number;
  rms: number;
  spectrum?: readonly number[];
  reset?: boolean;
}

export type EvaluatedParameters = ReadonlyMap<string, number>;

export interface SpectrumFeatures {
  bass: number;
  mids: number;
  highs: number;
  rms: number;
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

export function analyzeSpectrumFrame(
  frequencies: ArrayLike<number>,
  waveform: ArrayLike<number>,
  sampleRate: number,
  fftSize: number
): SpectrumFeatures {
  const binWidth = Math.max(1, sampleRate) / Math.max(2, fftSize);
  const band = (minimumHz: number, maximumHz: number): number => {
    const start = Math.max(0, Math.floor(minimumHz / binWidth));
    const end = Math.min(frequencies.length, Math.max(start + 1, Math.ceil(maximumHz / binWidth)));
    let energy = 0;
    for (let index = start; index < end; index += 1) energy += Math.pow((Number(frequencies[index]) || 0) / 255, 1.35);
    return clamp(energy / Math.max(1, end - start), 0, 1);
  };
  let squareSum = 0;
  for (let index = 0; index < waveform.length; index += 1) {
    const sample = Number(waveform[index]) || 0;
    squareSum += sample * sample;
  }
  return {
    bass: band(30, 180),
    mids: band(180, 2400),
    highs: band(2400, Math.min(16000, sampleRate / 2)),
    rms: clamp(Math.sqrt(squareSum / Math.max(1, waveform.length)) * 1.8, 0, 1)
  };
}

function curveValue(value: number, curve: ParameterBinding['curve']): number {
  if (curve === 'smoothstep') return value * value * (3 - 2 * value);
  if (curve === 'exponential') return value * value;
  return value;
}

export class AudioModulationEngine {
  private envelopes = new Map<string, number>();
  private smoothed = new Map<string, number>();

  reset(): void {
    this.envelopes.clear();
    this.smoothed.clear();
  }

  evaluate(bindings: readonly ParameterBinding[], frame: AudioFeatureFrame, deltaSeconds: number): EvaluatedParameters {
    if (frame.reset) this.reset();
    const contributions = new Map<string, number[]>();
    const combines = new Map<string, ParameterBinding['combine']>();
    const delta = clamp(Number(deltaSeconds) || 0, 1 / 1000, 0.25);

    for (const binding of [...bindings].sort((left, right) => left.id.localeCompare(right.id))) {
      if (!binding.enabled) continue;
      const source = clamp(Number(frame[binding.source as AudioSource]) || 0, 0, 1.5);
      const inputSpan = Math.max(0.000001, binding.inputMaximum - binding.inputMinimum);
      let normalized = clamp((source - binding.inputMinimum) / inputSpan, 0, 1);
      normalized = curveValue(normalized, binding.curve);

      const previousEnvelope = this.envelopes.get(binding.id) ?? 0;
      const envelopeMs = normalized > previousEnvelope ? binding.attackMs : binding.releaseMs;
      const envelopeResponse = envelopeMs <= 0 ? 1 : 1 - Math.exp(-delta / (envelopeMs / 1000));
      const envelope = previousEnvelope + (normalized - previousEnvelope) * envelopeResponse;
      this.envelopes.set(binding.id, envelope);

      const previousSmooth = this.smoothed.get(binding.id) ?? envelope;
      const smoothingResponse = binding.smoothingMs <= 0 ? 1 : 1 - Math.exp(-delta / (binding.smoothingMs / 1000));
      const smooth = previousSmooth + (envelope - previousSmooth) * smoothingResponse;
      this.smoothed.set(binding.id, smooth);

      const mapped = binding.outputMinimum + (binding.outputMaximum - binding.outputMinimum) * smooth;
      const value = mapped * binding.amount * binding.direction;
      const targetValues = contributions.get(binding.target) ?? [];
      targetValues.push(value);
      contributions.set(binding.target, targetValues);
      combines.set(binding.target, binding.combine);
    }

    const output = new Map<string, number>();
    for (const [target, values] of contributions) {
      const combine = combines.get(target) ?? 'add';
      if (combine === 'multiply') output.set(target, values.reduce((value, item) => value * item, 1));
      else if (combine === 'max') output.set(target, Math.max(...values));
      else output.set(target, values.reduce((value, item) => value + item, 0));
    }
    return output;
  }
}

export function createMockAudioFrame(timeSeconds: number, sequence = 0): AudioFeatureFrame {
  const pulse = Math.pow(Math.max(0, Math.sin(timeSeconds * Math.PI * 2)), 10);
  return {
    sequence,
    timestampSeconds: timeSeconds,
    bass: clamp(0.24 + Math.sin(timeSeconds * 1.35) * 0.2 + pulse * 0.48, 0, 1),
    mids: clamp(0.32 + Math.sin(timeSeconds * 2.12 + 1.2) * 0.25, 0, 1),
    highs: clamp(0.28 + Math.sin(timeSeconds * 4.4 + 2.5) * 0.22, 0, 1),
    beat: pulse,
    rms: clamp(0.34 + Math.sin(timeSeconds * 0.72) * 0.12 + pulse * 0.18, 0, 1)
  };
}
