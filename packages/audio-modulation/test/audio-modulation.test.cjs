'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audio = require('../dist');
const { AudioModulationEngine } = audio;

const binding = (id, source, amount) => ({
  id,
  source,
  target: 'layer.one.opacity',
  amount,
  direction: 1,
  inputMinimum: 0,
  inputMaximum: 1,
  outputMinimum: 0,
  outputMaximum: 1,
  smoothingMs: 0,
  attackMs: 0,
  releaseMs: 0,
  curve: 'linear',
  combine: 'add',
  enabled: true
});

test('combines multiple sources on one parameter', () => {
  const engine = new AudioModulationEngine();
  const values = engine.evaluate(
    [binding('a', 'bass', 0.5), binding('b', 'mids', 0.25)],
    { sequence: 1, timestampSeconds: 0, bass: 0.8, mids: 0.4, highs: 0, beat: 0, rms: 0 },
    1 / 60
  );
  assert.equal(values.get('layer.one.opacity'), 0.5);
});

test('maps a bounded dance range across negative and positive offsets', () => {
  const engine = new AudioModulationEngine();
  const route = { ...binding('dance', 'mids', 1), inputMinimum: 0.1, inputMaximum: 0.9, outputMinimum: -0.4, outputMaximum: 0.8 };
  const quiet = engine.evaluate([route], { sequence: 1, timestampSeconds: 0, bass: 0, mids: 0.1, highs: 0, beat: 0, rms: 0 }, 1 / 60);
  const loud = engine.evaluate([route], { sequence: 2, timestampSeconds: 1, bass: 0, mids: 0.9, highs: 0, beat: 0, rms: 0 }, 1 / 60);
  assert.equal(quiet.get(route.target), -0.4);
  assert.ok(Math.abs(loud.get(route.target) - 0.8) < 1e-9);
});

test('reset produces deterministic envelope state', () => {
  const engine = new AudioModulationEngine();
  const route = { ...binding('route', 'beat', 1), attackMs: 100, releaseMs: 200 };
  const frame = { sequence: 1, timestampSeconds: 0, bass: 0, mids: 0, highs: 0, beat: 1, rms: 0, reset: true };
  const first = engine.evaluate([route], frame, 1 / 60).get(route.target);
  engine.evaluate([route], { ...frame, reset: false, sequence: 2 }, 1 / 60);
  const reset = engine.evaluate([route], { ...frame, sequence: 3 }, 1 / 60).get(route.target);
  assert.equal(reset, first);
});

test('extracts bass and RMS from preview-song analyzer data', () => {
  const frequencies = new Uint8Array(1024);
  frequencies.fill(12);
  for (let index = 2; index <= 7; index += 1) frequencies[index] = 255;
  const waveform = new Float32Array([.5, -.5, .5, -.5]);
  const features = audio.analyzeSpectrumFrame(frequencies, waveform, 48000, 2048);
  assert.ok(features.bass > .65);
  assert.ok(features.bass > features.mids * 3);
  assert.ok(features.rms > .85 && features.rms <= 1);
});
