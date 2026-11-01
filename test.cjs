const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
const store = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    innerHTML: '', textContent: '', style: {}, hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, showModal() {}, close() {},
  });
  return elements.get(id);
};
const context = vm.createContext({
  document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, hidden: false },
  window: { addEventListener() {} },
  localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
  Date, Math, JSON, Object, Number, String, performance: { now: () => 1000 },
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
});
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
run('globalThis.testPet = newPet("cat"); testPet.updated = 1000; decay(testPet, 3601000)');
assert.equal(run('testPet.needs[0]'), 31);
run('decay(testPet, 360100000)');
assert.equal(run('Math.min(...testPet.needs)'), 0);
run('state.selected="cat"; current().progress[0]=12; save()');
assert.equal(JSON.parse(store.get('slow-growing-v1')).pets.cat.progress[0], 12);
run('state.selected="dog"');
assert.equal(run('current().progress[0]'), 0);
run('state.selected="cat"; activeAction=1; holding=false; current().progress[1]=5; tick()');
assert.equal(run('current().progress[1]'), 5);
run('activeAction=1; holding=true; lastTick=900; current().progress[1]=29.95; tick()');
assert.equal(run('current().count'), 1);
assert.equal(run('current().xp'), 10);
assert.equal(run('current().leaves'), 17);
assert.equal(run('current().progress[1]'), 0);
assert.equal(run('holding'), false);
assert.equal(run('current().logs.length'), 2);
assert.equal(run('current().needs[1]'), 100);
assert.equal(run('escapeHtml("<script>")'), '&lt;script&gt;');
run('current().daily.date="old"; current().daily.count=8; decay(current())');
assert.equal(run('current().daily.count'), 0);
console.log('通过：真实时间衰减、数值下限、存档、角色隔离、暂停、完成奖励、日记、每日重置和文本转义。');
