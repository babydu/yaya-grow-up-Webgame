'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const G = require('./engine.js');
const DAY = 86400000;
const HOUR = 3600000;
const NOW = new Date(2026, 0, 31, 12).getTime();
function pet(type = 'cat', now = NOW) {
  return G.adopt(G.create(now), type, now);
}
function complete(s, action = 'mood', product = null, now = s.updated) {
  assert.equal(G.begin(s, action, product, now), null);
  return G.advance(s, s.task.seconds, now);
}
function legacy() {
  return { selected: 'dog', pets: { dog: { born: NOW - DAY, updated: NOW,
    needs: [20, 30, 40, 50], xp: 120, count: 12, seconds: 600,
    progress: [100, 10, 20, 30], leaves: 27, items: [0, 2],
    logs: [{ at: NOW - DAY, text: '旧日记' }],
    daily: { date: new Date(NOW).toLocaleDateString(), seconds: 50, count: 1 } } } };
}

test('CommonJS and native window exports, immutable definitions, isolated states', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./engine.js'), 'utf8'), context);
  assert.equal(typeof context.window.GameEngine.create, 'function');
  const a = G.create(NOW);
  const b = G.create(NOW);
  a.needs[0] = 0;
  assert.equal(b.needs[0], 40);
  assert.equal(b.selected, null);
  assert.equal(b.adopted, false);
  assert.equal(b.points, 60);
  assert.equal(G.stage(b).index, 0);
  assert.equal(Object.keys(G.profiles).length, 4);
  assert.ok(Object.isFrozen(G.catalog[0].gain));
  for (const p of G.catalog) {
    for (const k of ['id', 'name', 'icon', 'category', 'types', 'minStage', 'price', 'pack', 'description', 'gain']) {
      assert.ok(Object.hasOwn(p, k));
    }
    assert.ok(['food', 'clean', 'comfort', 'nutrition', 'accessory', 'medical'].includes(p.category));
  }
});

test('adoption initializes supplies, rejects switching and invalid types', () => {
  for (const type of Object.keys(G.profiles)) {
    const s = pet(type);
    assert.equal(s.inventory[type + '-milk'], 5);
    assert.equal(s.inventory[type + '-clean'], 5);
    assert.throws(() => G.adopt(s, type, NOW));
    assert.throws(() => G.adopt(s, 'dog', NOW));
  }
  for (const type of ['fox', '__proto__', 'constructor', null]) {
    assert.throws(() => G.adopt(G.create(NOW), type, NOW));
  }
  const s = G.create(NOW);
  assert.equal(typeof G.begin(s, 'mood', null, NOW), 'string');
  assert.equal(typeof G.buy(s, 'cat-milk', NOW), 'string');
});

test('growth requires time AND care experience, all four stages and one-time rewards', () => {
  const s = pet();
  s.xp = 600;
  assert.equal(G.stage(s).index, 0);
  G.refresh(s, NOW + DAY);
  assert.equal(G.stage(s).index, 1);
  assert.equal(s.points, 80);
  G.refresh(s, NOW + 6 * DAY);
  assert.equal(G.stage(s).index, 2);
  G.refresh(s, NOW + 12 * DAY);
  assert.equal(G.stage(s).index, 3);
  assert.equal(G.stage(s).age, 360);
  assert.equal(G.stage(s).progress, 100);
  assert.equal(G.stage(s).next, null);
  assert.equal(s.points, 120);
  G.refresh(s, s.updated);
  assert.equal(G.load(JSON.stringify(s), null, s.updated).points, 120);
  assert.ok(G.milestones(s).every(m => m.unlocked));
  const young = pet();
  G.refresh(young, NOW + 20 * DAY);
  assert.equal(G.stage(young).index, 0);
  assert.equal(G.stage(young).progress, 0);
});

test('completion can unlock growth and reports care reward', () => {
  const s = pet();
  G.refresh(s, NOW + DAY);
  s.health = 100;
  s.xp = 90;
  const result = complete(s);
  assert.equal(s.xp, 100);
  assert.equal(s.stageIndex, 1);
  assert.equal(result.points, 5);
  assert.equal(s.points, 85);
});

test('begin deducts exactly once; pause, refresh, reload and resume preserve locked task', () => {
  const s = pet();
  assert.equal(G.begin(s, 'food', 'cat-milk', NOW), null);
  assert.equal(s.inventory['cat-milk'], 4);
  assert.equal(G.advance(s, 25, NOW), null);
  const locked = structuredClone(s.task);
  G.refresh(s, NOW + DAY);
  assert.deepEqual(s.task, locked);
  assert.equal(s.seconds, 25);
  const restored = G.load(JSON.stringify(s), null, s.updated);
  assert.equal(G.begin(restored, 'food', 'cat-milk', restored.updated), null);
  assert.equal(restored.inventory['cat-milk'], 4);
  assert.equal(typeof G.begin(restored, 'clean', 'cat-clean', restored.updated), 'string');
  assert.deepEqual(restored.task, locked);
  const result = G.advance(restored, 9999, restored.updated);
  assert.equal(result.points, 5);
  assert.equal(restored.seconds, 300);
  assert.equal(restored.count, 1);
  assert.equal(restored.daily.seconds, 275);
  const done = structuredClone(restored);
  assert.equal(G.advance(restored, 9999, restored.updated), null);
  assert.deepEqual(restored, done);
});

test('cooldowns, early need override and overfeeding prevention', () => {
  const s = pet();
  complete(s, 'food', 'cat-milk');
  assert.equal(s.needs[0], 85);
  assert.equal(typeof G.begin(s, 'food', 'cat-milk', NOW + HOUR), 'string');
  s.needs[0] = 34;
  assert.equal(G.begin(s, 'food', 'cat-milk', s.updated), null);
  completeTask(s);
  s.needs[0] = 0;
  assert.equal(typeof G.begin(s, 'food', 'cat-milk', s.updated), 'string');
  assert.equal(G.begin(s, 'food', 'cat-milk', s.updated + 60000), null);
  function completeTask(state) { G.advance(state, state.task.seconds, state.updated); }
});

test('active feeding survives stage change, serialization and resume with original duration', () => {
  const s = pet();
  s.xp = 100;
  G.begin(s, 'food', 'cat-milk', NOW);
  G.advance(s, 15, NOW);
  G.refresh(s, NOW + DAY);
  assert.equal(G.stage(s).index, 1);
  assert.equal(G.careOptions(s)[0].seconds, 240);
  assert.equal(s.task.seconds, 300);
  assert.equal(G.products(s, 'food').some(p => p.id === 'cat-milk'), false);
  const loaded = G.load(s, null, s.updated);
  assert.equal(G.begin(loaded, 'food', 'cat-milk', loaded.updated), null);
  assert.equal(loaded.inventory['cat-milk'], 4);
  assert.equal(G.advance(loaded, 285, loaded.updated).points, 5);
  assert.equal(loaded.seconds, 300);
  assert.equal(loaded.task, null);
});

test('daily care rewards cap at 40; reset and effective experience only', () => {
  const s = pet();
  for (let i = 0; i < 12; i++) {
    s.needs[2] = 0;
    const result = complete(s, 'mood', null, NOW + i * 60000);
    assert.equal(result.points, i < 8 ? 5 : 0);
  }
  assert.equal(s.daily.earned, 40);
  assert.equal(s.points, 100);
  assert.equal(s.xp, 120);
  G.refresh(s, NOW + DAY);
  assert.equal(s.daily.earned, 0);
  assert.equal(s.daily.count, 0);
  s.needs[2] = 50;
  assert.equal(G.begin(s, 'mood', null, s.updated), null);
  s.needs[2] = 100;
  const xp = s.xp;
  assert.equal(G.advance(s, 60, s.updated).points, 0);
  assert.equal(s.xp, xp);
});

test('checkin uses local calendar across months, leap days, year and gaps; same day idempotent', () => {
  for (const [y, m, d] of [[2026, 0, 31], [2024, 1, 28], [2026, 11, 31]]) {
    const now = new Date(y, m, d, 23, 55).getTime();
    const s = pet('baby', now);
    assert.equal(G.checkin(s, now), null);
    const saved = structuredClone(s);
    assert.equal(G.checkin(s, now), null);
    assert.deepEqual(s, saved);
    const tomorrow = new Date(y, m, d + 1, 0, 5).getTime();
    G.checkin(s, tomorrow);
    assert.equal(s.checkin.streak, 2);
    assert.equal(s.points, 83);
    G.checkin(s, new Date(y, m, d + 3, 12).getTime());
    assert.equal(s.checkin.streak, 1);
  }
});

test('purchase validates points, species, stage, id and quantity; catalog covers stages', () => {
  const s = pet();
  assert.equal(G.buy(s, 'cat-milk', NOW), null);
  assert.equal(s.points, 50);
  assert.equal(s.inventory['cat-milk'], 10);
  for (const id of ['dog-milk', 'cat-food-2', 'bad', '__proto__']) {
    assert.equal(typeof G.buy(s, id, NOW), 'string');
  }
  s.points = 0;
  assert.equal(typeof G.buy(s, 'cat-milk', NOW), 'string');
  assert.equal(s.inventory['cat-milk'], 10);
  for (const type of Object.keys(G.profiles)) {
    const a = pet(type);
    for (let index = 0; index < 4; index++) {
      a.xp = [0, 100, 300, 600][index];
      G.refresh(a, NOW + [0, 1, 6, 12][index] * DAY);
      assert.ok(G.products(a, 'food').some(p => p.category === 'food'));
      assert.ok(G.products(a, 'clean').length);
      assert.equal(G.careOptions(a).length, 4);
    }
  }
});

test('invalid product/action/stock and optional toy; free rest and play', () => {
  const s = pet();
  for (const [action, product] of [['bad', null], ['food', null], ['food', 'cat-toy'],
    ['food', 'dog-milk'], ['clean', 'cat-milk'], ['energy', 'cat-toy'], ['mood', 'cat-toy']]) {
    assert.equal(typeof G.begin(s, action, product, NOW), 'string');
    assert.equal(s.task, null);
  }
  assert.equal(G.buy(s, 'cat-toy', NOW), null);
  complete(s, 'mood', 'cat-toy');
  assert.equal(s.inventory['cat-toy'], 2);
  complete(s, 'energy');
  const a = pet();
  complete(a);
  assert.equal(a.needs[2], 100);
});

test('offline decay is elapsed-based, bounded, idempotent and never advances tasks', () => {
  const s = pet();
  G.begin(s, 'clean', 'cat-clean', NOW);
  G.refresh(s, NOW + 2 * HOUR);
  assert.deepEqual(s.needs, [10, 60, 0, 50]);
  assert.equal(s.task.elapsed, 0);
  const saved = structuredClone(s);
  G.refresh(s, s.updated);
  assert.deepEqual(s, saved);
  G.refresh(s, NOW + 100 * DAY);
  assert.deepEqual(s.needs, [0, 0, 0, 0]);
  assert.equal(s.xp, 0);
  assert.equal(s.count, 0);
});

test('relief handles both or either missing class, daily limit and stage transition soft locks', () => {
  for (const missing of [['food'], ['clean'], ['food', 'clean']]) {
    const s = pet();
    if (missing.includes('food')) s.inventory['cat-milk'] = 0;
    if (missing.includes('clean')) s.inventory['cat-clean'] = 0;
    assert.equal(G.relief(s, NOW), null);
    assert.equal(s.inventory['cat-milk'], missing.includes('food') ? 2 : 5);
    assert.equal(s.inventory['cat-clean'], missing.includes('clean') ? 2 : 5);
    assert.equal(typeof G.relief(s, NOW), 'string');
    s.inventory['cat-milk'] = 0;
    assert.equal(G.relief(s, NOW + DAY), null);
  }
  const s = pet();
  assert.equal(typeof G.relief(s, NOW), 'string');
  assert.equal(s.reliefDate, '');
  s.xp = 100;
  G.refresh(s, NOW + DAY);
  s.points = 0;
  assert.equal(G.relief(s, s.updated), null);
  assert.equal(s.inventory['cat-food-1'], 2);
  assert.equal(s.inventory['cat-clean'], 5);
});

test('touch cooldown, species responses, bond cap and epoch-zero first touch', () => {
  const messages = [];
  for (const type of Object.keys(G.profiles)) {
    const s = pet(type, 0);
    const first = G.touch(s, 0);
    assert.equal(first.rewarded, true);
    messages.push(first.message);
    assert.equal(G.touch(s, 59999).rewarded, false);
    assert.equal(G.touch(s, 60000).rewarded, true);
    s.bond = 100;
    assert.notEqual(G.touch(s, 120000).message, first.message);
    assert.equal(s.bond, 100);
  }
  assert.equal(new Set(messages).size, 4);
});

test('legacy migration preserves selected values, progress, diary and confirmation', () => {
  const raw = legacy();
  const copy = structuredClone(raw);
  const s = G.load(null, JSON.stringify(raw), NOW);
  assert.equal(s.selected, 'dog');
  assert.equal(s.adopted, false);
  for (const key of ['born', 'needs', 'xp', 'count', 'seconds', 'logs', 'progress', 'items']) {
    assert.deepEqual(s[key], raw.pets.dog[key]);
  }
  assert.equal(s.points, 27);
  assert.equal(s.daily.seconds, 50);
  const restored = G.load(JSON.stringify(s), null, NOW);
  G.adopt(restored, 'dog', NOW);
  assert.equal(restored.xp, 120);
  assert.equal(restored.born, raw.pets.dog.born);
  assert.deepEqual(restored.progress, [100, 10, 20, 30]);
  assert.equal(G.begin(restored, 'clean', 'dog-clean', NOW), null);
  assert.equal(restored.task.elapsed, 10);
  assert.equal(restored.inventory['dog-clean'], 4);
  assert.equal(G.begin(restored, 'clean', 'dog-clean', NOW), null);
  assert.equal(restored.inventory['dog-clean'], 4);
  assert.equal(G.advance(restored, 20, NOW).points, 5);
  assert.deepEqual(raw, copy);
  G.adopt(s, 'cat', NOW);
  assert.equal(s.xp, 0);
  assert.equal(s.points, 60);
  assert.deepEqual(s.progress, [0, 0, 0, 0]);
});

test('load clones input, prioritizes v2, rejects corrupt v2 without silent fallback', () => {
  const s = pet();
  const copy = structuredClone(s);
  const result = G.load(s, legacy(), NOW + HOUR);
  assert.equal(result.selected, 'cat');
  assert.deepEqual(s, copy);
  assert.throws(() => G.load('{', legacy(), NOW));
  assert.throws(() => G.load('', null, NOW));
  assert.deepEqual(G.load(null, null, NOW), G.create(NOW));
});

test('strict corrupt-save and numeric boundary rejection', () => {
  const changes = [s => { s.version = 1; }, s => { s.selected = '__proto__'; },
    s => { s.needs = [1, 2, 3]; }, s => { s.needs[0] = NaN; },
    s => { s.needs[0] = 101; }, s => { s.xp = -1; }, s => { s.count = 0.5; },
    s => { s.points = Infinity; }, s => { s.inventory['bad'] = 1; },
    s => { s.inventory['cat-milk'] = -1; }, s => { s.inventory['cat-milk'] = 1.5; },
    s => { s.daily.date = '2026-02-30'; }, s => { s.daily.earned = 41; },
    s => { s.checkin.date = '2099-01-01'; s.checkin.streak = 1; },
    s => { s.lastCare.bad = NOW; }, s => { s.lastTouch = NOW + 1; },
    s => { s.logs = [{ at: NOW, text: 1 }]; }, s => { s.born = NOW + 1; },
    s => { s.stageIndex = 3; }, s => { s.progress = [301, 0, 0, 0]; },
    s => { s.items = [9]; }, s => { s.task = {}; },
    s => { s.task = { actionId: 'food', productId: null, name: 'bad', seconds: 30, elapsed: 0 }; }];
  for (const change of changes) {
    const s = pet();
    change(s);
    assert.throws(() => G.load(s, null, NOW));
  }
  for (const now of [-1, NaN, Infinity, '123', 0.5, 8640000000000001]) assert.throws(() => G.create(now));
  const s = pet();
  const before = structuredClone(s);
  for (const delta of [-1, Infinity, NaN, '1']) assert.throws(() => G.advance(s, delta, NOW));
  assert.throws(() => G.refresh(s, NOW - 1));
  assert.deepEqual(s, before);
  const old = legacy();
  old.pets.dog.progress[0] = 301;
  assert.throws(() => G.load(null, old, NOW));
});

test('baby complementary feeding retains formula through stage 2 only', () => {
  const s = pet('baby');
  s.xp = 300;
  G.refresh(s, NOW + 6 * DAY);
  const foods = G.products(s, 'food').map(p => p.id);
  assert.ok(foods.includes('baby-milk'));
  assert.ok(foods.includes('baby-food-2'));
  assert.equal(G.buy(s, 'baby-milk', s.updated), null);
  complete(s, 'food', 'baby-milk');
  s.xp = 600;
  G.refresh(s, NOW + 12 * DAY);
  assert.equal(G.products(s, 'food').some(p => p.id === 'baby-milk'), false);
});

test('nutrition is a complete meal: one stock deduction, capped gains and relief recognition', () => {
  for (const type of Object.keys(G.profiles)) {
    const s = pet(type);
    s.xp = 300;
    G.refresh(s, NOW + 6 * DAY);
    s.inventory = { [type + '-clean']: 1 };
    const id = type + '-nutrition';
    const meal = G.products(s, 'food').find(p => p.id === id);
    assert.match(meal.description, /完整/);
    assert.equal(G.buy(s, id, s.updated), null);
    assert.equal(typeof G.relief(s, s.updated), 'string');
    assert.equal(s.reliefDate, '');
    s.needs = [70, 50, 50, 95];
    assert.equal(G.begin(s, 'food', id, s.updated), null);
    assert.equal(G.begin(s, 'food', id, s.updated), null);
    assert.equal(s.inventory[id], meal.pack - 1);
    assert.equal(Object.hasOwn(s.task, 'stapleId'), false);
    const restored = G.load(s, null, s.updated);
    G.advance(restored, restored.task.seconds, restored.updated);
    assert.deepEqual(restored.needs, [100, 50, 50, 100]);
  }
});

test('decay derives from care intervals and uses destination stage for elapsed time', () => {
  for (const type of ['cat', 'baby']) {
    for (let index = 0; index < 4; index++) {
      const s = pet(type);
      s.xp = [0, 100, 300, 600][index];
      G.refresh(s, NOW + [0, 1, 6, 12][index] * DAY);
      s.needs = [100, 100, 100, 100];
      const options = G.careOptions(s);
      G.refresh(s, s.updated + HOUR);
      assert.deepEqual(s.needs, options.map(o => 100 - o.gain / o.intervalHours));
    }
  }
  const s = pet();
  s.xp = 100;
  G.refresh(s, NOW + DAY - HOUR);
  s.needs = [100, 100, 100, 100];
  G.refresh(s, NOW + DAY);
  assert.equal(G.stage(s).index, 1);
  assert.equal(s.needs[0], 100 - 45 / 4);
});

test('species-specific final stage names propagate to next, diary, products and milestones', () => {
  const finalNames = { baby: '小小侠客', cat: '成年猫', dog: '成年犬', plant: '盛放' };
  for (const type of Object.keys(G.profiles)) {
    const s = pet(type);
    s.xp = 300;
    G.refresh(s, NOW + 6 * DAY);
    const name = finalNames[type];
    assert.equal(G.stage(s).next.name, name);
    s.xp = 600;
    G.refresh(s, NOW + 12 * DAY);
    assert.equal(G.stage(s).name, name);
    assert.equal(G.milestones(s)[3].title, name);
    assert.ok(s.logs.some(l => l.text.includes(`进入${name}`)));
    const staple = G.products(s, 'food').find(p => p.category === 'food');
    const stapleWord = { baby: '幼儿期', cat: '成年期', dog: '成年期', plant: '盛放期' }[type];
    assert.ok((staple.name + staple.description).includes(stapleWord));
  }
});

test('three emotional tiers and mature baby hugs', () => {
  for (const type of Object.keys(G.profiles)) {
    const messages = [0, 30, 65].map(bond => {
      const s = pet(type);
      s.bond = bond;
      return G.touch(s, NOW).message;
    });
    assert.equal(new Set(messages).size, 3);
    if (type === 'cat') assert.match(messages[2], /蹭蹭.*踩奶/);
    if (type === 'dog') assert.match(messages[2], /迎接.*腿边/);
  }
  for (const bond of [0, 30, 65]) {
    const s = pet('baby');
    s.bond = bond;
    s.xp = 600;
    G.refresh(s, NOW + 12 * DAY);
    s.health = 100;
    assert.match(G.touch(s, s.updated).message, /拥抱/);
  }
});

test('emotional milestones award exactly once at 30 and 65, including care crossings', () => {
  const s = pet();
  s.bond = 29;
  G.touch(s, NOW);
  assert.equal(s.bond, 30);
  assert.equal(s.points, 70);
  assert.deepEqual(s.emotionalMilestones, [30]);
  const saved = structuredClone(s);
  G.touch(s, NOW);
  assert.deepEqual(s, saved);
  s.bond = 63;
  complete(s);
  assert.equal(s.bond, 65);
  assert.equal(s.points, 85);
  assert.equal(s.daily.earned, 5);
  assert.deepEqual(s.emotionalMilestones, [30, 65]);
  assert.equal(s.logs.filter(l => l.text.includes('亲密度首次')).length, 2);
  const restored = G.load(JSON.stringify(s), null, NOW);
  G.refresh(restored, NOW);
  G.touch(restored, NOW + 60000);
  assert.equal(restored.points, 85);
  assert.equal(restored.logs.filter(l => l.text.includes('亲密度首次')).length, 2);
});

test('emotional field compatibility, catch-up rewards and corruption validation', () => {
  const old = pet();
  delete old.emotionalMilestones;
  assert.deepEqual(G.load(old, null, NOW).emotionalMilestones, []);
  assert.equal(Object.hasOwn(old, 'emotionalMilestones'), false);
  old.bond = 70;
  const loaded = G.load(old, null, NOW);
  assert.deepEqual(loaded.emotionalMilestones, [30, 65]);
  assert.equal(loaded.points, 80);
  assert.equal(G.load(loaded, null, NOW).points, 80);
  for (const value of [null, {}, [30, 30], [65, 65], [0], ['30'], [30, 65, 65], [Infinity]]) {
    const s = pet();
    s.bond = 100;
    s.emotionalMilestones = value;
    assert.throws(() => G.load(s, null, NOW));
  }
  const invalid = pet();
  invalid.emotionalMilestones = [30];
  assert.throws(() => G.load(invalid, null, NOW));
});

test('design pack: four profiles with bible names, kinds and per-type stage labels', () => {
  const expected = {
    baby: { name: '阿团', kind: '宝宝', stages: ['襁褓', '坐立', '学步', '小小侠客'] },
    cat: { name: '橘汐', kind: '小猫', stages: ['篮中小猫', '毛球', '铃铛少年', '成年猫'] },
    dog: { name: '麦芽', kind: '小狗', stages: ['篮中幼犬', '毛球小狗', '少年期', '成年犬'] },
    plant: { name: '团子', kind: '小植物', stages: ['破土', '幼苗', '含苞', '盛放'] }
  };
  for (const [type, e] of Object.entries(expected)) {
    assert.equal(G.profiles[type].name, e.name);
    assert.equal(G.profiles[type].kind, e.kind);
    for (let i = 0; i < 4; i++) {
      const s = pet(type);
      s.xp = 600;
      G.refresh(s, NOW + 12 * DAY);
      assert.equal(G.stage(s).name, e.stages[3]);
      assert.equal(G.milestones(s)[i].title, e.stages[i]);
      assert.equal(G.careOptions(s).map(a => a.name)[0], { baby: '喂养', cat: '喂养', dog: '喂养', plant: '浇水' }[type]);
    }
  }
});

test('plant care semantics: water, leaf care, sunshine and growth labels', () => {
  const s = pet('plant');
  const options = G.careOptions(s);
  assert.deepEqual(options.map(a => a.name), ['浇水', '擦叶除虫', '晒太阳', '安静生长']);
  assert.deepEqual(options.map(a => a.need), ['水分', '洁净度', '阳光', '养分']);
  assert.ok(G.products(s, 'food').some(p => p.id === 'plant-milk'));
  assert.ok(G.products(s, 'clean').some(p => p.id === 'plant-clean'));
  assert.equal(G.buy(s, 'plant-milk', s.updated), null);
  const result = complete(s, 'food', 'plant-milk');
  assert.equal(result.title, '照护完成');
});

test('accessory catalog: 16 items, per-type, prices and stage gating', () => {
  const accessories = G.catalog.filter(p => p.category === 'accessory');
  assert.equal(accessories.length, 16);
  for (const type of ['baby', 'cat', 'dog', 'plant']) {
    const own = accessories.filter(p => p.types.includes(type));
    assert.equal(own.length, 4);
    assert.deepEqual(own.map(p => p.minStage), [0, 1, 2, 3]);
    assert.deepEqual(own.map(p => p.price), [30, 45, 60, 80]);
    assert.equal(own.every(p => p.pack === 1), true);
  }
});

test('accessory wear: purchase then wear, swap, take off and validation', () => {
  const s = pet('cat');
  s.xp = 600;
  G.refresh(s, NOW + 12 * DAY);
  s.points = 200;
  assert.equal(G.buy(s, 'acc-cat-1', s.updated), null);
  assert.equal(s.inventory['acc-cat-1'], 1);
  assert.equal(G.wear(s, 'acc-cat-2', s.updated), '请先在生活小铺兑换这件饰物');
  assert.equal(G.wear(s, 'acc-dog-1', s.updated), '饰物不适用于当前对象');
  const young = pet('cat');
  assert.equal(G.wear(young, 'acc-cat-2', young.updated), '成长后才能佩戴这件饰物');
  assert.equal(G.wear(s, 'acc-cat-1', s.updated), null);
  assert.equal(s.worn, 'acc-cat-1');
  assert.ok(s.logs.some(l => l.text.includes('针织围巾')));
  assert.equal(G.buy(s, 'acc-cat-2', s.updated), null);
  assert.equal(G.wear(s, 'acc-cat-2', s.updated), null);
  assert.equal(s.worn, 'acc-cat-2');
  assert.equal(G.wear(s, 'acc-cat-2', s.updated), null);
  assert.equal(s.worn, null);
  const loaded = G.load(s, null, s.updated + HOUR);
  assert.equal(loaded.worn, null);
  s.worn = 'acc-cat-1';
  const wornLoad = G.load(s, null, s.updated + HOUR);
  assert.equal(wornLoad.worn, 'acc-cat-1');
  s.worn = 'acc-cat-3';
  assert.throws(() => G.load(s, null, s.updated + HOUR));
  s.worn = 'plant-food-1';
  assert.throws(() => G.load(s, null, s.updated + HOUR));
});

test('worn accessory defaults to null for legacy v2 saves and resets on adopt', () => {
  const s = pet('dog');
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.worn;
  const loaded = G.load(raw, null, NOW + HOUR);
  assert.equal(loaded.worn, null);
  const fresh = G.create(NOW);
  assert.equal(fresh.worn, null);
  const adopted = G.adopt(G.create(NOW), 'plant', NOW);
  assert.equal(adopted.worn, null);
  assert.ok(adopted.inventory['plant-milk'] === 5 && adopted.inventory['plant-clean'] === 5);
});

test('health drains per starving need with cap and recovers when needs stay satisfied', () => {
  const s = pet();
  s.needs = [0, 100, 100, 100];
  G.refresh(s, s.updated + 2 * HOUR);
  assert.equal(s.health, 98.5);
  const full = pet();
  full.needs = [0, 0, 0, 0];
  G.refresh(full, full.updated + 10 * HOUR);
  assert.equal(full.health, 70);
  const rising = pet();
  rising.needs = [80, 80, 80, 80];
  rising.health = 50;
  G.refresh(rising, rising.updated + HOUR / 2);
  assert.equal(rising.health, 50.5);
  const cared = pet();
  cared.health = 50;
  complete(cared, 'mood');
  assert.equal(cared.health, 52);
  const again = G.refresh(structuredClone(full), full.updated);
  assert.equal(again.health, full.health);
  assert.equal(again.criticalAt, full.criticalAt);
});

test('sickness tiers reduce growth and lock play while care keeps working', () => {
  const s = pet();
  s.health = 30;
  const sick = complete(s, 'mood');
  assert.match(sick.message, /成长 \+5/);
  assert.equal(s.xp, 5);
  assert.equal(s.health, 32);
  const weak = pet();
  weak.health = 15;
  assert.equal(G.touch(weak, weak.updated).message, '橘汐太虚弱了，先照顾好身体');
  assert.equal(typeof G.begin(weak, 'mood', null, weak.updated), 'string');
  assert.equal(G.begin(weak, 'food', 'cat-milk', weak.updated), null);
  assert.equal(G.checkin(weak, weak.updated), null);
  assert.equal(G.buy(weak, 'cat-clean', weak.updated), null);
  assert.equal(G.healthTier(pet()), 'healthy');
  const low = pet(); low.health = 55; assert.equal(G.healthTier(low), 'low');
  const ill = pet(); ill.health = 30; assert.equal(G.healthTier(ill), 'sick');
  const bad = pet(); bad.health = 10; assert.equal(G.healthTier(bad), 'critical');
  assert.equal(G.healthTier(G.create(NOW)), null);
});

test('medicine kit heals with purchase gate and stock handling', () => {
  const s = pet();
  assert.equal(G.buy(s, 'medicine-kit', s.updated), '橘汐很健康，暂不需要药箱');
  s.health = 50;
  assert.equal(G.buy(s, 'medicine-kit', s.updated), null);
  assert.equal(s.points, 35);
  s.health = 100;
  assert.equal(G.remedy(s, 'medicine-kit', s.updated), '橘汐很健康，暂不需要药箱');
  s.health = 50;
  assert.equal(G.remedy(s, 'medicine-kit', s.updated), null);
  assert.equal(s.health, 90);
  assert.equal(s.inventory['medicine-kit'], 0);
  s.health = 50;
  assert.equal(G.remedy(s, 'medicine-kit', s.updated), '库存不足，请先在生活小铺兑换');
  s.health = 30;
  s.points += 60;
  assert.equal(G.buy(s, 'revive-elixir', s.updated), null);
  assert.equal(G.remedy(s, 'revive-elixir', s.updated), '橘汐还没有病危，灵药先收好');
});

test('critical window, elixir revival and re-entry', () => {
  const s = pet();
  s.needs = [0, 0, 0, 0];
  G.refresh(s, s.updated + 40 * HOUR);
  assert.equal(s.health, 0);
  assert.equal(s.criticalAt, s.updated);
  assert.match(s.logs.at(-1).text, /病危/);
  assert.equal(G.healthTier(s), 'critical');
  s.points += 60;
  assert.equal(G.buy(s, 'revive-elixir', s.updated), null);
  assert.equal(G.remedy(s, 'revive-elixir', s.updated), null);
  assert.equal(s.health, 40);
  assert.equal(s.criticalAt, null);
  assert.equal(s.status, 'alive');
  assert.match(s.logs.at(-1).text, /慢慢缓了过来/);
  s.needs = [0, 0, 0, 0];
  G.refresh(s, s.updated + 40 * HOUR);
  assert.equal(s.health, 0);
  assert.equal(s.criticalAt, s.updated);
});

test('natural recovery above 20 clears the critical window', () => {
  const s = pet();
  s.health = 19.5;
  s.criticalAt = s.updated;
  s.needs = [80, 80, 80, 80];
  G.refresh(s, s.updated + HOUR);
  assert.equal(s.health, 20.5);
  assert.equal(s.criticalAt, null);
  assert.match(s.logs.at(-1).text, /稳定/);
});

test('departure after the window, per-type narrative and full reset via restart', () => {
  const flavor = { baby: /家人.*远方/, cat: /夜色.*远行/, dog: /田野.*远行/, plant: /枯萎.*春泥/ };
  for (const [type, pattern] of Object.entries(flavor)) {
    const s = pet(type);
    s.needs = [0, 0, 0, 0];
    G.refresh(s, s.updated + 40 * HOUR);
    G.refresh(s, s.updated + 25 * HOUR);
    assert.equal(s.status, 'left');
    assert.equal(s.leftAt, s.updated);
    assert.equal(s.task, null);
    assert.match(s.logs.at(-1).text, pattern);
    assert.equal(G.healthTier(s), 'left');
    assert.equal(typeof G.begin(s, 'food', type + '-milk', s.updated), 'string');
    assert.equal(G.touch(s, s.updated).rewarded, false);
    assert.equal(typeof G.checkin(s, s.updated), 'string');
    assert.equal(typeof G.buy(s, 'cat-clean', s.updated), 'string');
    assert.equal(typeof G.wear(s, null, s.updated), 'string');
    assert.equal(typeof G.relief(s, s.updated), 'string');
    assert.equal(typeof G.remedy(s, 'revive-elixir', s.updated), 'string');
    const memorial = G.load(JSON.stringify(s), null, s.updated + HOUR);
    assert.equal(memorial.status, 'left');
    assert.throws(() => G.restart(pet(), NOW), /离开/);
    G.restart(s, s.updated);
    assert.equal(s.selected, null);
    assert.equal(s.adopted, false);
    assert.equal(s.health, 100);
    assert.equal(s.status, 'alive');
    assert.equal(s.criticalAt, null);
    assert.equal(s.leftAt, null);
    const fresh = G.adopt(structuredClone(s), type, s.updated);
    assert.equal(fresh.stageIndex, 0);
  }
});

test('legacy v2 saves default to healthy and reject corrupt health or status', () => {
  const raw = JSON.parse(JSON.stringify(pet('dog')));
  delete raw.health; delete raw.status; delete raw.criticalAt; delete raw.leftAt;
  const loaded = G.load(raw, null, NOW + HOUR);
  assert.equal(loaded.health, 100);
  assert.equal(loaded.status, 'alive');
  const brokenHealth = JSON.parse(JSON.stringify(pet('dog')));
  brokenHealth.health = 'full';
  assert.throws(() => G.load(brokenHealth, null, NOW + HOUR));
  const brokenStatus = JSON.parse(JSON.stringify(pet('dog')));
  brokenStatus.status = 'dead';
  assert.throws(() => G.load(brokenStatus, null, NOW + HOUR));
  const brokenWindow = JSON.parse(JSON.stringify(pet('dog')));
  brokenWindow.status = 'left';
  assert.throws(() => G.load(brokenWindow, null, NOW + HOUR));
});

test('care quantities scale stock cost, duration and gains', () => {
  const s = pet();
  assert.equal(typeof G.begin(s, 'mood', null, NOW, 2), 'string');
  assert.equal(s.task, null);
  s.needs[0] = 20;
  assert.equal(G.begin(s, 'food', 'cat-milk', NOW, 2), null);
  assert.equal(s.inventory['cat-milk'], 3);
  assert.equal(s.task.quantity, 2);
  assert.equal(s.task.seconds, 600);
  assert.equal(G.begin(s, 'food', 'cat-milk', NOW), null);
  assert.equal(s.inventory['cat-milk'], 3);
  const result = G.advance(s, s.task.seconds, s.updated);
  assert.match(result.message, /× 2/);
  assert.equal(s.needs[0], 100);
  assert.equal(s.needs[3], 80);
  const single = pet();
  assert.equal(G.begin(single, 'food', 'cat-milk', NOW), null);
  assert.equal(single.task.quantity, 1);
  assert.equal(single.task.seconds, 300);
  const short = pet();
  assert.equal(typeof G.begin(short, 'food', 'cat-milk', NOW, 6), 'string');
  assert.equal(short.task, null);
  assert.equal(short.inventory['cat-milk'], 5);
});

test('validation scales task seconds by quantity and rejects mismatches', () => {
  const s = pet();
  s.needs[0] = 20;
  G.begin(s, 'food', 'cat-milk', NOW, 3);
  assert.equal(s.task.seconds, 900);
  const loaded = G.load(JSON.stringify(s), null, s.updated);
  assert.equal(loaded.task.seconds, 900);
  const overLimit = JSON.parse(JSON.stringify(s));
  overLimit.task.quantity = 13;
  assert.throws(() => G.load(overLimit, null, s.updated));
  const zeroQty = JSON.parse(JSON.stringify(s));
  zeroQty.task.quantity = 0;
  assert.throws(() => G.load(zeroQty, null, s.updated));
  const badSeconds = JSON.parse(JSON.stringify(s));
  badSeconds.task.seconds = 800;
  assert.throws(() => G.load(badSeconds, null, s.updated));
  const freeUnits = JSON.parse(JSON.stringify(s));
  freeUnits.task.productId = null;
  freeUnits.task.seconds = 300;
  assert.throws(() => G.load(freeUnits, null, s.updated));
});
