'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./audio.js');

test('音景清单包含五种风格且 id 唯一', () => {
  assert.equal(A.styles.length, 5);
  const ids = A.styles.map(s => s.id);
  assert.deepEqual([...new Set(ids)].sort(), ['forest', 'music', 'rain', 'wave', 'white']);
  A.styles.forEach(s => {
    assert.equal(typeof s.name, 'string');
    assert.ok(s.name.length > 0);
  });
});

test('validatePref 对空值与非法输入返回默认偏好', () => {
  for (const raw of [null, undefined, 'x', 42, [], {}]) {
    assert.deepEqual(A.validatePref(raw), { enabled: false, style: 'rain', volume: 0.6 });
  }
});

test('validatePref 保留合法字段并替换非法字段', () => {
  assert.deepEqual(A.validatePref({ enabled: true, style: 'wave', volume: 0.3 }),
    { enabled: true, style: 'wave', volume: 0.3 });
  assert.deepEqual(A.validatePref({ enabled: true, style: ' disco ', volume: 0.3 }),
    { enabled: true, style: 'rain', volume: 0.3 });
  assert.deepEqual(A.validatePref({ enabled: 'yes', style: 'white' }),
    { enabled: false, style: 'white', volume: 0.6 });
});

test('validatePref 将音量钳制到 0 与 1 之间', () => {
  assert.equal(A.validatePref({ volume: 5 }).volume, 1);
  assert.equal(A.validatePref({ volume: -2 }).volume, 0);
  assert.equal(A.validatePref({ volume: '0.5' }).volume, 0.5);
  assert.equal(A.validatePref({ volume: 'abc' }).volume, 0.6);
  assert.equal(A.validatePref({ volume: NaN }).volume, 0.6);
});

test('validatePref 幂等：二次归一化结果不变', () => {
  for (const raw of [null, {}, { enabled: true, style: 'music', volume: 7 },
    { enabled: false, style: 'forest', volume: -1 }, { enabled: 1, style: 2, volume: 'x' }]) {
    const once = A.validatePref(raw);
    assert.deepEqual(A.validatePref(once), once);
  }
});

test('shouldPlay 仅在开启且照护运行时为真', () => {
  assert.equal(A.shouldPlay({ enabled: true, style: 'rain', volume: 0.5 }, true), true);
  assert.equal(A.shouldPlay({ enabled: true, style: 'rain', volume: 0.5 }, false), false);
  assert.equal(A.shouldPlay({ enabled: false, style: 'rain', volume: 0.5 }, true), false);
  assert.equal(A.shouldPlay(null, true), false);
});

test('Node 环境下读写与播放均安全降级', () => {
  assert.deepEqual(A.loadPref(), { enabled: false, style: 'rain', volume: 0.6 });
  assert.doesNotThrow(() => A.stop());
  assert.equal(A.play(), false);
  assert.equal(A.ok, true);
  assert.equal(A.setEnabled(true), false);
  assert.equal(A.pref.enabled, true);
  assert.equal(A.play(), false);
  assert.equal(A.ok, false);
  assert.equal(A.setStyle('wave'), false);
  assert.equal(A.pref.style, 'wave');
  assert.equal(A.setStyle('bad-id'), false);
  assert.equal(A.pref.style, 'wave');
  A.setVolume(2);
  assert.equal(A.pref.volume, 1);
  assert.equal(A.active, false);
});

test('stylesHtml 渲染下拉选项并标记选中项', () => {
  const html = A.stylesHtml('music');
  assert.match(html, /<option value="white">白噪音<\/option>/);
  assert.match(html, /<option value="music" selected>八音盒<\/option>/);
  assert.equal(html.split('<option').length - 1, 5);
});
