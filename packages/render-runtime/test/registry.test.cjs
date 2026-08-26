'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { effectRegistry } = require('../dist');

test('registers the compositor effect set', () => {
  assert.deepEqual(Object.keys(effectRegistry), ['celShading', 'outline', 'colorGrade', 'luminanceMask', 'regionMask', 'paintMask', 'paintLayer', 'posterize', 'bloom', 'scanlines', 'displacement']);
  assert.deepEqual(effectRegistry.outline.parameters, ['strength', 'threshold', 'thickness', 'softness']);
  assert.ok(effectRegistry.bloom.parameters.includes('radius'));
  assert.deepEqual(effectRegistry.regionMask.parameters, ['top', 'bottom', 'feather', 'invert']);
  assert.deepEqual(effectRegistry.paintMask.parameters, ['opacity', 'invert']);
  assert.deepEqual(effectRegistry.paintLayer.parameters, ['opacity']);
});
