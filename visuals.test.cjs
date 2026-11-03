const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const profiles = {
  cat: { name: '橘汐' }, dog: { name: '麦芽' },
  baby: { name: '阿团' }, plant: { name: '团子' }
};
const sandbox = { window: { GameEngine: { profiles } }, GameEngine: { profiles } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'visuals.js'), 'utf8'), sandbox);
const { scene, portrait, DIMS, HEIGHTS, WEAR_POS, BASE_Y, CENTER_X } = sandbox.window.GameVisuals;

for (const type of ['cat', 'dog', 'baby', 'plant']) {
  const svg = scene(type);
  assert.match(svg, new RegExp(`data-character="${type}"`));
  assert.match(svg, /role="img"/);
  assert.match(svg, new RegExp(`href="assets/bg-${type}\\.jpg"`));
  assert.match(svg, new RegExp(`href="assets/stages/${type}-1\\.png"`));
  assert.match(svg, /data-stage="0"/);
  assert.match(portrait(type), new RegExp(`src="assets/stages/${type}-1\\.png"`));
}

const cat = scene('cat');
const dog = scene('dog');
const baby = scene('baby');
assert.match(cat, /pet-breathe/);
assert.match(cat, /room-bg/);
assert.match(dog, /pet-breathe/);
assert.match(baby, /pet-breathe/);
assert.notEqual(cat, dog);
assert.notEqual(dog, baby);

// Stage progression switches the cutout file and the data-stage anchor.
const catStages = [0, 1, 2, 3].map(i => scene('cat', i));
for (let i = 0; i < 4; i++) {
  assert.match(catStages[i], new RegExp(`stages/cat-${i + 1}\\.png`));
  assert.match(catStages[i], new RegExp(`data-stage="${i}"`));
}
assert.equal(new Set(catStages).size, 4);

// Accessory overlay renders with the worn id and matches the baked dims table.
for (const id of Object.keys(DIMS.acc)) {
  const [type] = id.slice(4).split('-');
  const svg = scene(type, 3, id);
  assert.match(svg, new RegExp(`data-worn="${id}"`));
  assert.match(svg, new RegExp(`href="assets/acc/${id.slice(4)}\\.png"`));
}
const plain = scene('cat', 3);
assert.ok(!plain.includes('data-worn'));
assert.equal(BASE_Y, 316);
assert.equal(CENTER_X, 312);
for (const type of ['baby', 'cat', 'dog', 'plant']) {
  assert.equal(HEIGHTS[type].length, 4);
  assert.equal(Object.keys(DIMS[type]).length, 4);
}
// Unworn fallback position exists for every accessory id, worn layer stacks above character.
const worn = scene('cat', 3, 'acc-cat-1');
const charIdx = worn.indexOf('data-character');
const accIdx = worn.indexOf('data-worn');
assert.ok(accIdx > charIdx);
console.log('通过：四角色场景含手绘背景与阶段立绘，饰物叠加、阶段锚点与领养肖像均指向图片资源且可区分。');
