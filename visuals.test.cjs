const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const profiles = { cat: { name: '奶油' }, dog: { name: '土豆' }, baby: { name: '小满' } };
const sandbox = { window: { GameEngine: { profiles } }, GameEngine: { profiles } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'visuals.js'), 'utf8'), sandbox);
const { scene, portrait } = sandbox.window.GameVisuals;

for (const type of ['cat', 'dog', 'baby']) {
  const svg = scene(type);
  assert.match(svg, new RegExp(`data-character="${type}"`));
  assert.match(svg, /role="img"/);
  assert.match(svg, new RegExp(`href="assets/${type}-room.png"`));
  assert.match(portrait(type), new RegExp(`src="assets/${type}-card.png"`));
}

const cat = scene('cat');
const dog = scene('dog');
const baby = scene('baby');
assert.match(cat, /pet-breathe/);
assert.match(cat, /sg-glow/);
assert.match(dog, /pet-breathe/);
assert.match(baby, /pet-breathe/);
assert.notEqual(cat, dog);
assert.notEqual(dog, baby);
console.log('通过：猫、狗、宝宝小屋插画与领养肖像均指向图片资源且可区分。');
