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
const { scene, portrait, DIMS, HEIGHTS, WEAR_POS, BASE_Y, CENTER_X, STAGE_ART, STAGE_COUNT, STAGE_TYPES } = sandbox.window.GameVisuals;

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

// Leaf-pattern pot: crop the baked pot via nested viewBox and draw behind foliage.
for (let i = 0; i < 4; i++) {
  const svg = scene('plant', i, 'acc-plant-1');
  assert.equal(svg.includes('clip-path') || svg.includes('clipPath'), false);
  assert.match(svg, /overflow="hidden"/);
  const accI = svg.indexOf('data-worn="acc-plant-1"');
  const petI = svg.indexOf('data-character="plant"');
  assert.ok(accI >= 0 && petI > accI);
  const d = HEIGHTS.plant[i];
  const dim = DIMS.plant[i];
  const cropH = +(d * [0.203, 0.351, 0.523, 0.565][i]).toFixed(1);
  const vbH = +(dim[1] * [0.203, 0.351, 0.523, 0.565][i]).toFixed(1);
  assert.match(svg, new RegExp(`height="${String(cropH).replace('.', '\\.')}"`));
  assert.match(svg, new RegExp(`viewBox="0 0 ${dim[0]} ${String(vbH).replace('.', '\\.')}"`));
  assert.ok(cropH < d);
}
const side = scene('plant', 3, 'acc-plant-4');
assert.ok(side.indexOf('data-worn') > side.indexOf('data-character'));
const bare = scene('plant', 2);
assert.equal(bare.includes('data-worn'), false);
assert.match(bare, /preserveAspectRatio="xMidYMid meet"/);

const both = scene('baby', 3, { wear: 'acc-baby-1', place: 'acc-baby-4' });
assert.match(both, /data-worn="acc-baby-1"/);
assert.match(both, /data-worn="acc-baby-4"/);
const objPot = scene('plant', 2, { wear: null, place: 'acc-plant-1' });
assert.equal(objPot.includes('clip-path') || objPot.includes('clipPath'), false);
assert.ok(objPot.indexOf('data-worn="acc-plant-1"') < objPot.indexOf('data-character="plant"'));
const strHat = scene('cat', 3, 'acc-cat-1');
assert.match(strHat, /data-worn="acc-cat-1"/);
assert.ok(!strHat.includes('data-worn="acc-cat-3"'));

// Dye variants apply a hue-rotate filter to the worn accessory overlay.
const tinted = scene('cat', 3, { wear: 'acc-cat-1', place: null }, 'healthy', { 'acc-cat-1': 2 });
assert.match(tinted, /hue-rotate\(200deg\)/);
const warmed = scene('cat', 3, { wear: 'acc-cat-1', place: null }, 'healthy', { 'acc-cat-1': 1 });
assert.match(warmed, /hue-rotate\(30deg\)/);
const plainTint = scene('cat', 3, { wear: 'acc-cat-1', place: null }, 'healthy', {});
assert.ok(!plainTint.includes('hue-rotate'));
const noTintArg = scene('cat', 3, { wear: 'acc-cat-1', place: null }, 'healthy');
assert.ok(!noTintArg.includes('hue-rotate'));

// Health tier drives the portrait filter attribute: lower tiers are marked,
// healthy leaves the art untouched, and sick/critical also raise the sick flag.
assert.ok(!scene('cat', 3, null, 'healthy').includes('data-tier'));
for (const tier of ['low', 'sick', 'critical']) {
  assert.match(scene('cat', 3, null, tier), new RegExp(`data-tier="${tier}"`));
}
assert.match(scene('cat', 3, null, 'sick'), /data-sick="true"/);
assert.match(scene('cat', 3, null, 'critical'), /data-sick="true"/);
assert.ok(!scene('cat', 3, null, 'low').includes('data-sick'));

// Stage-art manifest is the single source of truth: every listed file exists on
// disk, derived tables match it, and portrait can render any bracket.
assert.equal(STAGE_COUNT, 4);
for (const type of STAGE_TYPES) {
  assert.equal(STAGE_ART[type].length, STAGE_COUNT, `${type} stage count`);
  assert.equal(HEIGHTS[type].length, STAGE_COUNT);
  assert.equal(Object.keys(DIMS[type]).length, STAGE_COUNT);
  STAGE_ART[type].forEach((art, i) => {
    assert.ok(fs.existsSync(path.join(__dirname, art.file)), `missing ${art.file}`);
    assert.equal(DIMS[type][i][0], art.w);
    assert.equal(DIMS[type][i][1], art.h);
    assert.equal(HEIGHTS[type][i], art.height);
    assert.match(portrait(type, i), new RegExp(art.file.replace(/\./g, '\\.')));
    assert.match(scene(type, i), new RegExp(art.file.replace(/\./g, '\\.')));
  });
}
assert.equal([...STAGE_TYPES].sort().join(','), 'baby,cat,dog,plant');

// Sick state variants: any stage marked with a sick variant must swap in the
// variant file when the tier is sick/critical and fall back to the base art
// when healthy, while every variant file exists on disk.
for (const type of STAGE_TYPES) {
  STAGE_ART[type].forEach((art, i) => {
    const sick = art.variants && art.variants.sick;
    if (!sick) return;
    assert.ok(fs.existsSync(path.join(__dirname, sick.file)), `missing ${sick.file}`);
    const esc = sick.file.replace(/\./g, '\\.');
    assert.match(scene(type, i, null, 'sick'), new RegExp(esc));
    assert.match(scene(type, i, null, 'critical'), new RegExp(esc));
    assert.ok(!scene(type, i, null, 'healthy').includes(sick.file));
    assert.ok(!scene(type, i, null, 'low').includes(sick.file));
  });
}

// A sick plant that wears the leaf-pattern pot must still render the full
// variant art instead of being cropped to the pot-rim ratio. The variant ships
// its own pot, so it renders as a full <image> (not a cropped <svg>) and no
// separate pot layer is stacked on top.
for (let i = 0; i < STAGE_COUNT; i++) {
  const svg = scene('plant', i, 'acc-plant-1', 'sick');
  assert.match(svg, new RegExp(`stages/plant-${i + 1}-sick\\.png`));
  assert.ok(svg.includes('<image class="pet-breathe"'), 'sick plant should render as a full image');
  assert.ok(!svg.includes('<svg class="pet-breathe"'), 'sick plant should not be cropped');
  assert.ok(!svg.includes('data-worn="acc-plant-1"'), 'no separate pot layer on a sick plant');
}

console.log('通过：四角色场景含手绘背景与阶段立绘，饰物叠加、阶段锚点与领养肖像均指向图片资源且可区分。');