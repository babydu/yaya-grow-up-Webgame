(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.GameEngine = engine;
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  // Deterministic state transitions: no clock, storage, timers or random source.
  const DAY = 86400000;
  const HOUR = 3600000;
  const LIMIT = 1e12;
  const ids = ['food', 'clean', 'mood', 'energy'];
  const legacyDurations = [300, 30, 60, 120];
  const ages = [0, 30, 180, 360];
  const experience = [0, 100, 300, 600];
  const names = ['初生期', '探索期', '成长期', '成年期'];
  const stageLabels = {
    baby: ['襁褓', '坐立', '学步', '小小侠客'],
    cat: ['篮中小猫', '毛球', '铃铛少年', '成年猫'],
    dog: ['篮中幼犬', '毛球小狗', '少年期', '成年犬'],
    plant: ['破土', '幼苗', '含苞', '盛放']
  };
  function stageName(type, index) {
    return (stageLabels[type] || stageLabels.cat)[index];
  }
  const profiles = {
    cat: { name: '橘汐', kind: '小猫', description: '陪伴小猫咪橘汐慢慢长大。' },
    dog: { name: '麦芽', kind: '小狗', description: '陪伴小狗麦芽探索世界。' },
    baby: { name: '阿团', kind: '宝宝', description: '回应宝宝阿团的每一次需要。' },
    plant: { name: '团子', kind: '小植物', description: '陪小植物团子从破土走到盛放。' }
  };
  const careMeta = {
    cat: { actions: ['喂养', '清洁小窝', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    dog: { actions: ['喂养', '清洁小窝', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    baby: { actions: ['喂养', '换尿裤', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    plant: { actions: ['浇水', '擦叶除虫', '晒太阳', '安静生长'], needs: ['水分', '洁净度', '阳光', '养分'] }
  };
  const catalog = [];
  function product(id, name, icon, category, types, minStage, price, pack, gain, description) {
    catalog.push({ id, name, icon, category, types, minStage, price, pack, description, gain });
  }
  for (const type of ['cat', 'dog']) {
    const kind = profiles[type].kind;
    product(type + '-milk', kind + '专用奶粉', 'bottle', 'food', [type], 0, 10, 5,
      [45, 0, 0, 5], '初生期专用奶粉。');
    for (let i = 1; i < 4; i++) {
      product(type + '-food-' + i, kind + names[i] + '主食', 'bag', 'food', [type], i,
        12 + i * 2, 5, [45, 0, 0, 5], '与当前成长阶段匹配的日常主食。');
    }
  }
  product('baby-milk', '宝宝配方奶粉', 'bottle', 'food', ['baby'], 0, 10, 5,
    [45, 0, 0, 5], '初生、探索与辅食阶段均可使用的配方奶粉。');
  product('baby-food-2', '宝宝辅食', 'bag', 'food', ['baby'], 2, 16, 5,
    [45, 0, 0, 5], '成长期辅食，游戏中的简化养育设定。');
  product('baby-food-3', '宝宝均衡餐', 'bag', 'food', ['baby'], 3, 18, 5,
    [50, 0, 0, 5], '幼儿期的多样均衡餐。');
  for (const [type, name] of [['cat', '猫砂'], ['dog', '尿垫'], ['baby', '尿裤']]) {
    product(type + '-clean', name, 'clean', 'clean', [type], 0, 10, 5,
      [0, 45, 0, 0], '日常清洁消耗品。');
    product(type + '-nutrition', profiles[type].kind + '营养均衡主食组合', 'leaf', 'nutrition',
      [type], 2, 16, 3, [50, 0, 0, 15],
      '每份含当前适龄完整主食与普通营养食品，可作为一餐；增加游戏饱腹与精力属性，无医疗用途。');
    product(type + '-toy', profiles[type].kind + '玩具', 'heart', 'comfort',
      [type], 0, 12, 3, [0, 0, 45, 0], '一次陪玩消耗一份玩具使用次数。');
  }
  product('plant-milk', '植物营养液', 'bottle', 'food', ['plant'], 0, 10, 5,
    [45, 0, 0, 5], '萌芽期专用营养液，稀释后浇灌。');
  for (let i = 1; i < 4; i++) {
    product('plant-food-' + i, profiles.plant.kind + stageLabels.plant[i] + '期花肥', 'bag', 'food',
      ['plant'], i, 12 + i * 2, 5, [45, 0, 0, 5], '与当前成长阶段匹配的日常花肥。');
  }
  product('plant-clean', '叶面清洁喷雾', 'clean', 'clean', ['plant'], 0, 10, 5,
    [0, 45, 0, 0], '轻轻擦去叶面灰尘，保持洁净。');
  product('plant-nutrition', '植物营养均衡组合', 'leaf', 'nutrition', ['plant'], 2, 16, 3,
    [50, 0, 0, 15], '每份含适龄花肥与营养液，可作为一次完整养护。');
  product('plant-toy', '植物陪伴小风铃', 'heart', 'comfort', ['plant'], 0, 12, 3,
    [0, 0, 45, 0], '晒太阳时挂在盆边，叮咚作响陪它度过一段时光。');
  product('medicine-kit', '安心药箱', 'heart', 'medical', ['baby', 'cat', 'dog', 'plant'], 0, 25, 1,
    [0, 0, 0, 0], '健康度低于 70 时使用，立即恢复 40 点健康度。');
  product('revive-elixir', '回春灵药', 'spark', 'medical', ['baby', 'cat', 'dog', 'plant'], 0, 60, 1,
    [0, 0, 0, 0], '病危宽限期内使用，恢复至 40 点健康度，错过时机则无效。');
  const accessoryFlavor = {
    baby: [['针织小帽', '薄荷绿 · 顶绒球'], ['刺绣围兜', '桃粉 · 叶形绣样'], ['软底学步鞋', '奶白 · 单颗纽扣'], ['木质牙胶环', '原木 · 彩虹串珠']],
    cat: [['针织围巾', '鼠尾草绿 · 流苏'], ['铃铛项圈', '雾蓝 · 黄铜铃'], ['毛线球', '奶白 · 手缠绕线'], ['木质鱼吊坠', '原木 · 挂绳']],
    dog: [['三角头巾', '陶土橙 · 骨形图案'], ['皮项圈', '棕皮 · 黄铜铭牌'], ['编织拉绳球', '奶白与鼠尾草绿'], ['木质球玩具', '原木 · 手作纹路']],
    plant: [['叶纹陶盆', '赤陶 · 白叶纹'], ['黄铜洒水壶', '磨砂黄铜 · 莲蓬头'], ['手绘标签牌', '纸与木签 · 花样'], ['园艺小铲', '木柄 · 尖头铁铲']]
  };
  for (const type of ['baby', 'cat', 'dog', 'plant']) {
    accessoryFlavor[type].forEach(([name, detail], i) => {
      product('acc-' + type + '-' + (i + 1), profiles[type].kind + '·' + name, 'spark', 'accessory',
        [type], [0, 1, 2, 3][i], [30, 45, 60, 80][i], 1, [0, 0, 0, 0], name + '：' + detail + '。可在房间为' + profiles[type].name + '穿上。');
    });
  }
  function freeze(value) {
    Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
    return Object.freeze(value);
  }
  freeze(profiles);
  freeze(catalog);
  const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
  const record = o => o !== null && typeof o === 'object' && !Array.isArray(o)
    && [Object.prototype, null].includes(Object.getPrototypeOf(o));
  function assert(ok, message = '存档数据损坏') {
    if (!ok) throw new TypeError(message);
  }
  const number = (n, max = LIMIT) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const integer = (n, max = LIMIT) => number(n, max) && Number.isSafeInteger(n);
  const timestamp = n => integer(n, 8640000000000000);
  function date(now) {
    const d = new Date(now);
    return [String(d.getFullYear()).padStart(4, '0'), String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')].join('-');
  }
  function validDate(s, empty = false) {
    if (empty && s === '') return true;
    if (typeof s !== 'string' || !/^\d{4,6}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const value = new Date(0);
    value.setFullYear(y, m - 1, d);
    value.setHours(12, 0, 0, 0);
    return date(value.getTime()) === s;
  }
  function validate(s) {
    assert(record(s) && s.version === 2);
    assert((s.selected === null || own(profiles, s.selected)) && typeof s.adopted === 'boolean');
    assert(!s.adopted || s.selected !== null);
    assert(timestamp(s.born) && timestamp(s.updated) && s.born <= s.updated);
    assert(Array.isArray(s.needs) && s.needs.length === 4 && s.needs.every(n => number(n, 100)));
    for (const key of ['xp', 'count', 'points']) assert(integer(s[key]));
    assert(number(s.seconds) && number(s.bond, 100) && integer(s.stageIndex, 3));
    if (own(s, 'emotionalMilestones')) {
      assert(Array.isArray(s.emotionalMilestones) && s.emotionalMilestones.length <= 2
        && s.emotionalMilestones.every(n => [30, 65].includes(n) && n <= s.bond)
        && new Set(s.emotionalMilestones).size === s.emotionalMilestones.length);
    }
    assert(s.stageIndex <= eligibleStage(s));
    assert(record(s.inventory));
    for (const [id, quantity] of Object.entries(s.inventory)) {
      assert(catalog.some(p => p.id === id && p.types.includes(s.selected)) && integer(quantity));
    }
    if (own(s, 'worn') && s.worn !== null) {
      assert(typeof s.worn === 'string');
      const acc = catalog.find(p => p.id === s.worn);
      assert(acc && acc.category === 'accessory' && acc.types.includes(s.selected)
        && (s.inventory[s.worn] || 0) > 0);
    }
    if (own(s, 'health')) assert(number(s.health, 100));
    if (own(s, 'status')) {
      assert(s.status === 'alive' || s.status === 'left');
      if (s.status === 'left') {
        assert(timestamp(s.criticalAt) && timestamp(s.leftAt)
          && s.criticalAt <= s.updated && s.leftAt <= s.updated && s.leftAt >= s.criticalAt);
      } else {
        assert(s.leftAt === null
          && (s.criticalAt === null || (timestamp(s.criticalAt) && s.criticalAt <= s.updated)));
      }
    }
    assert(Array.isArray(s.logs) && s.logs.length <= 1000);
    for (const log of s.logs) assert(record(log) && timestamp(log.at) && log.at <= s.updated
      && typeof log.text === 'string' && log.text.length <= 4000);
    assert(record(s.lastCare));
    for (const [id, at] of Object.entries(s.lastCare)) assert(ids.includes(id) && timestamp(at) && at <= s.updated);
    assert(record(s.daily) && validDate(s.daily.date) && s.daily.date === date(s.updated));
    assert(number(s.daily.seconds) && s.daily.seconds <= s.seconds
      && integer(s.daily.count) && s.daily.count <= s.count && integer(s.daily.earned, 40));
    assert(record(s.checkin) && validDate(s.checkin.date, true) && integer(s.checkin.streak));
    assert((s.checkin.date === '') === (s.checkin.streak === 0));
    assert(s.checkin.date === '' || s.checkin.date <= date(s.updated));
    assert(validDate(s.reliefDate, true) && (s.reliefDate === '' || s.reliefDate <= date(s.updated)));
    assert(s.lastTouch === null || (timestamp(s.lastTouch) && s.lastTouch <= s.updated));
    if (own(s, 'progress')) assert(Array.isArray(s.progress) && s.progress.length === 4
      && s.progress.every((n, i) => number(n, legacyDurations[i])));
    if (own(s, 'items')) assert(Array.isArray(s.items) && s.items.length <= 3
      && s.items.every(n => integer(n, 2)) && new Set(s.items).size === s.items.length);
    if (s.task !== null) {
      const t = s.task;
      assert(s.adopted && record(t) && ids.includes(t.actionId));
      assert(typeof t.name === 'string' && t.name.length > 0 && t.name.length <= 200);
      assert(integer(t.seconds, 3600) && t.seconds > 0 && number(t.elapsed, t.seconds));
      assert(t.productId === null || typeof t.productId === 'string');
      if (own(t, 'quantity')) assert(integer(t.quantity) && t.quantity >= 1 && t.quantity <= 12);
      const units = t.quantity || 1;
      assert(t.productId === null ? units === 1 : true);
      const categories = { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: [] };
      // A paid task keeps its original product and duration after a stage change.
      assert(t.productId === null ? ['mood', 'energy'].includes(t.actionId)
        : catalog.some(p => p.id === t.productId && p.types.includes(s.selected)
          && p.minStage <= stage(s).index && categories[t.actionId].includes(p.category)));
      assert(t.actionId === 'food'
        ? [300, 240, 180, 120].some(base => base * units === t.seconds)
        : legacyDurations[ids.indexOf(t.actionId)] * units === t.seconds);
    }
    if (s.selected === null) assert(!s.adopted && s.task === null && s.stageIndex === 0);
    return s;
  }
  function clock(s, now) {
    validate(s);
    assert(timestamp(now) && now >= s.updated, '时间无效或发生回退');
  }
  function create(now) {
    assert(timestamp(now), '时间无效');
    return { version: 2, selected: null, adopted: false, born: now, updated: now,
      needs: [40, 75, 65, 70], xp: 0, count: 0, seconds: 0, bond: 0, points: 60,
      inventory: {}, logs: [], task: null, lastCare: {}, emotionalMilestones: [], worn: null,
      health: 100, status: 'alive', criticalAt: null, leftAt: null,
      daily: { date: date(now), seconds: 0, count: 0, earned: 0 },
      checkin: { date: '', streak: 0 }, reliefDate: '', stageIndex: 0, lastTouch: null };
  }
  function eligibleStage(s) {
    const age = Math.max(0, (s.updated - s.born) / DAY * 30);
    let index = 0;
    while (index < 3 && age >= ages[index + 1] && s.xp >= experience[index + 1]) index++;
    return index;
  }
  function stage(s) {
    const index = s.selected ? eligibleStage(s) : 0;
    const age = Math.max(0, Math.floor((s.updated - s.born) / DAY * 30));
    const next = index === 3 ? null : { index: index + 1, name: stageName(s.selected, index + 1),
      age: ages[index + 1], xp: experience[index + 1] };
    const progress = next ? Math.min(1, Math.max(0, (age - ages[index]) / (next.age - ages[index])),
      Math.max(0, (s.xp - experience[index]) / (next.xp - experience[index]))) * 100 : 100;
    return { index, name: stageName(s.selected, index), age, label: `游戏年龄 ${age} 天`, progress, next,
      feedSeconds: [300, 240, 180, 120][index], feedHours: [3, 4, 5, 6][index],
      cleanHours: s.selected === 'baby' ? 3 : 6,
      description: '真实 1 天 = 游戏 30 天；晋级同时需要年龄与有效照护经验。此为游戏设定。' };
  }
  function log(s, now, text) {
    s.logs.push({ at: now, text });
    s.logs = s.logs.slice(-1000);
  }
  function rewardStages(s, now) {
    if (!s.adopted) return;
    const index = eligibleStage(s);
    while (s.stageIndex < index) {
      s.stageIndex++;
      s.points = Math.min(LIMIT, s.points + 20);
      log(s, now, `进入${stageName(s.selected, s.stageIndex)}，获得 20 积分。`);
    }
  }
  function rewardEmotions(s, now) {
    if (!own(s, 'emotionalMilestones')) s.emotionalMilestones = [];
    if (!s.adopted) return;
    for (const threshold of [30, 65]) {
      if (s.bond < threshold || s.emotionalMilestones.includes(threshold)) continue;
      s.emotionalMilestones.push(threshold);
      s.points = Math.min(LIMIT, s.points + 10);
      log(s, now, `与${profiles[s.selected].name}的亲密度首次达到 ${threshold}，${threshold === 30 ? '建立信任' : '亲密依恋'}，获得 10 积分。`);
    }
  }
  function refresh(s, now) {
    clock(s, now);
    const hours = (now - s.updated) / HOUR;
    s.updated = now;
    // Apply the destination stage's rates to the entire elapsed interval.
    if (s.selected) {
      const options = careOptions(s);
      s.needs = s.needs.map((v, i) => Math.max(0, v - hours * options[i].gain / options[i].intervalHours));
    }
    if (s.adopted && s.status === 'alive') {
      const starving = s.needs.filter(v => v < 10).length;
      if (starving > 0) s.health = Math.max(0, s.health - Math.min(3, starving * 0.75) * hours);
      else if (s.needs.every(v => v >= 30)) s.health = Math.min(100, s.health + hours);
      if (s.health <= 0 && s.criticalAt === null) {
        s.health = 0;
        s.criticalAt = now;
        log(s, now, `${profiles[s.selected].name}的健康度耗尽了，进入病危状态。24 小时内用回春灵药还能挽回。`);
      }
      if (s.criticalAt !== null && s.health >= 20) {
        s.criticalAt = null;
        log(s, now, `${profiles[s.selected].name}的状况稳定下来了，好好休养吧。`);
      }
      if (s.criticalAt !== null && now - s.criticalAt >= 24 * HOUR) leave(s, now);
    }
    if (s.daily.date !== date(now)) s.daily = { date: date(now), seconds: 0, count: 0, earned: 0 };
    rewardStages(s, now);
    rewardEmotions(s, now);
    return s;
  }
  const departures = {
    baby: '被家人接到远方照顾，临走前朝你挥了挥手。',
    cat: '趁着夜色跳出院墙，出门远行了。',
    dog: '趁着夜色跑向田野，出门远行了。',
    plant: '花朵枯萎，化作春泥，把这一季的陪伴留在了土里。'
  };
  function leave(s, now) {
    s.status = 'left';
    s.leftAt = now;
    s.task = null;
    log(s, now, `${profiles[s.selected].name}${departures[s.selected]}`);
  }
  function healthTier(s) {
    if (!s.adopted) return null;
    if (s.status === 'left') return 'left';
    if (s.criticalAt !== null || s.health < 20) return 'critical';
    if (s.health < 40) return 'sick';
    if (s.health < 70) return 'low';
    return 'healthy';
  }
  function adopt(s, type, now) {
    clock(s, now);
    assert(own(profiles, type), '养育类型无效');
    assert(!s.adopted, '已经确认养育对象');
    if (s.selected !== type) Object.assign(s, create(now), { progress: [0, 0, 0, 0], items: [] });
    refresh(s, now);
    s.selected = type;
    s.adopted = true;
    s.inventory[type + '-milk'] = (s.inventory[type + '-milk'] || 0) + 5;
    s.inventory[type + '-clean'] = (s.inventory[type + '-clean'] || 0) + 5;
    log(s, now, `确认陪伴${profiles[type].name}成长。`);
    rewardStages(s, now);
    rewardEmotions(s, now);
    return s;
  }
  function available(s, p) {
    const index = stage(s).index;
    // Staple food is stage-specific; clean supplies and toys remain usable.
    return p.types.includes(s.selected) && index >= p.minStage && (p.category !== 'food'
      || (s.selected === 'baby' && p.id === 'baby-milk' ? index <= 2 : index === p.minStage));
  }
  function products(s, actionId) {
    const categories = { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: [] };
    if (!own(categories, actionId)) return [];
    return catalog.filter(p => available(s, p) && categories[actionId].includes(p.category));
  }
  function careOptions(s) {
    const st = stage(s);
    return ids.map((id, i) => {
      const intervalHours = [st.feedHours, st.cleanHours, 1, 4][i];
      const last = s.lastCare[id];
      const dueAt = last === undefined ? s.updated : s.needs[i] < 35
        ? last + 60000 : last + intervalHours * HOUR;
      return { id, name: careMeta[s.selected].actions[i],
        need: careMeta[s.selected].needs[i],
        icon: ['bottle', 'clean', 'heart', 'moon'][i], seconds: [st.feedSeconds, 30, 60, 120][i],
        intervalHours, gain: [45, 45, 35, 40][i], dueAt,
        description: ['适量喂养，饱腹达到 80 时暂停喂养。', '保持干净舒适。', '专注陪伴。', '安心休息。'][i] };
    });
  }
  function begin(s, actionId, productId, now, quantity) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (!ids.includes(actionId)) return '照护动作无效';
    const pid = productId === undefined ? null : productId;
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    if (s.task) return s.task.actionId === actionId && s.task.productId === pid ? null : '请先完成当前任务';
    if (s.health < 20 && actionId === 'mood') return '太虚弱了，先照顾好身体';
    const units = quantity === undefined ? 1 : quantity;
    if (!Number.isInteger(units) || units < 1 || units > 99) return '物资数量无效';
    if (pid === null && units !== 1) return '这种照护无需选择数量';
    const option = careOptions(s).find(a => a.id === actionId);
    const index = ids.indexOf(actionId);
    if (s.needs[index] >= (actionId === 'food' ? 80 : 95)) return '当前需求已满足';
    if (now < option.dueAt) return '照护仍在冷却中';
    const p = products(s, actionId).find(item => item.id === pid);
    if (pid !== null && !p) return '商品不适用于当前对象、动作或阶段';
    if (pid === null && ['food', 'clean'].includes(actionId)) return '请选择消耗品';
    if (p && !(s.inventory[p.id] >= units)) return '库存不足';
    if (p) s.inventory[p.id] -= units;
    const seconds = option.seconds * units;
    s.task = { actionId, productId: pid, name: option.name, seconds, quantity: units,
      elapsed: Math.min(seconds, s.progress ? s.progress[index] : 0) };
    if (s.progress) s.progress[index] = 0;
    return null;
  }
  function advance(s, seconds, now) {
    assert(number(seconds), '前台增量无效');
    refresh(s, now);
    if (!s.task) return null;
    const t = s.task;
    const used = Math.min(seconds, t.seconds - t.elapsed);
    t.elapsed += used;
    s.seconds = Math.min(LIMIT, s.seconds + used);
    s.daily.seconds = Math.min(s.seconds, s.daily.seconds + used);
    if (t.elapsed < t.seconds) return null;
    const i = ids.indexOf(t.actionId);
    const p = catalog.find(item => item.id === t.productId);
    const units = t.quantity || 1;
    const gain = p ? p.gain.map(v => v * units) : ids.map((_, j) => i === j ? [45, 45, 35, 40][i] : 0);
    const effective = s.needs.some((v, j) => gain[j] > 0 && v < 100);
    s.needs = s.needs.map((v, j) => Math.min(100, v + gain[j]));
    s.count = Math.min(LIMIT, s.count + 1);
    s.daily.count = Math.min(s.count, s.daily.count + 1);
    s.lastCare[t.actionId] = now;
    s.task = null;
    const points = effective ? Math.min(5, 40 - s.daily.earned, LIMIT - s.points) : 0;
    const growth = effective ? (s.health < 40 ? 5 : 10) : 0;
    if (effective) {
      s.xp = Math.min(LIMIT, s.xp + growth);
      s.bond = Math.min(100, s.bond + 2);
      s.health = Math.min(100, s.health + 2);
    }
    s.points += points;
    s.daily.earned += points;
    const label = units > 1 ? `${t.name} × ${units}` : t.name;
    const message = `${label}完成，成长 +${growth}，积分 +${points}。`;
    log(s, now, message);
    rewardStages(s, now);
    rewardEmotions(s, now);
    return { title: '照护完成', message, points };
  }
  function checkin(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    const today = date(now);
    if (s.checkin.date === today) return null;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    s.checkin.streak = s.checkin.date === date(yesterday.getTime()) ? Math.min(LIMIT, s.checkin.streak + 1) : 1;
    s.checkin.date = today;
    const points = 10 + Math.min(7, s.checkin.streak);
    s.points = Math.min(LIMIT, s.points + points);
    log(s, now, `连续签到 ${s.checkin.streak} 天，获得 ${points} 积分。`);
    return null;
  }
  function buy(s, id, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    const p = catalog.find(item => item.id === id);
    if (!p || !available(s, p)) return '商品无效或不适龄';
    if (id === 'medicine-kit' && s.health >= 70) return `${profiles[s.selected].name}很健康，暂不需要药箱`;
    if (s.points < p.price) return '积分不足';
    if ((s.inventory[id] || 0) > LIMIT - p.pack) return '库存已达上限';
    s.points -= p.price;
    s.inventory[id] = (s.inventory[id] || 0) + p.pack;
    log(s, now, `购买${p.name} ${p.pack} 份。`);
    return null;
  }
  function wear(s, id, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    if (id === null) {
      if (s.worn) {
        const acc = catalog.find(p => p.id === s.worn);
        log(s, now, `脱下了${acc ? acc.name : '饰物'}。`);
      }
      s.worn = null;
      return null;
    }
    const acc = catalog.find(item => item.id === id);
    if (!acc || acc.category !== 'accessory' || !acc.types.includes(s.selected)) return '饰物不适用于当前对象';
    if (stage(s).index < acc.minStage) return '成长后才能佩戴这件饰物';
    if (!(s.inventory[id] > 0)) return '请先在生活小铺兑换这件饰物';
    if (s.worn === id) {
      s.worn = null;
      log(s, now, `脱下了${acc.name}。`);
    } else {
      s.worn = id;
      log(s, now, `为${profiles[s.selected].name}穿上了${acc.name}。`);
    }
    return null;
  }
  function relief(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    if (s.reliefDate === date(now)) return '今日已领取基础补给';
    let supplied = false;
    for (const action of ['food', 'clean']) {
      const options = products(s, action);
      if (options.some(p => (s.inventory[p.id] || 0) > 0)
        || (s.task && s.task.actionId === action)) continue;
      s.inventory[options[0].id] = 2;
      supplied = true;
    }
    if (!supplied) return '基础物资充足';
    s.reliefDate = date(now);
    log(s, now, '领取基础补给，缺少的主食或清洁用品各补充 2 份。');
    return null;
  }
  function remedy(s, id, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return `${profiles[s.selected].name}已经离开，开始新的陪伴吧`;
    const p = catalog.find(item => item.id === id && item.category === 'medical');
    if (!p) return '商品无效';
    if (!(s.inventory[id] > 0)) return '库存不足，请先在生活小铺兑换';
    if (id === 'medicine-kit') {
      if (s.health >= 70) return `${profiles[s.selected].name}很健康，暂不需要药箱`;
      s.inventory[id]--;
      s.health = Math.min(100, s.health + 40);
      log(s, now, `使用了${p.name}，${profiles[s.selected].name}的健康度恢复到 ${Math.round(s.health)}。`);
      return null;
    }
    if (id === 'revive-elixir') {
      if (s.criticalAt === null) return `${profiles[s.selected].name}还没有病危，灵药先收好`;
      s.inventory[id]--;
      s.health = 40;
      s.criticalAt = null;
      log(s, now, `使用了${p.name}，${profiles[s.selected].name}慢慢缓了过来，接下来要好好照顾。`);
      return null;
    }
    return '商品无效';
  }
  function restart(s, now) {
    clock(s, now);
    assert(s.status === 'left', '角色还没有离开');
    Object.assign(s, create(now));
    return s;
  }
  function touch(s, now) {
    refresh(s, now);
    if (!s.adopted) return { message: '请先确认养育对象', rewarded: false };
    if (s.status === 'left') return { message: `${profiles[s.selected].name}已经离开了，开始新的陪伴吧`, rewarded: false };
    if (s.health < 20) return { message: `${profiles[s.selected].name}太虚弱了，先照顾好身体`, rewarded: false };
    const rewarded = s.lastTouch === null || now - s.lastTouch >= 60000;
    if (rewarded) {
      s.needs[2] = Math.min(100, s.needs[2] + 2);
      s.bond = Math.min(100, s.bond + 1);
      s.lastTouch = now;
    }
    rewardEmotions(s, now);
    const responses = {
      cat: ['小猫轻轻闻了闻你的手。', '小猫蹭蹭你的手，发出呼噜声。', '小猫贴着你蹭蹭，安心地踩奶。'],
      dog: ['小狗好奇地望着你。', '小狗摇着尾巴迎接你。', '小狗开心地迎接你，然后依偎着靠在你腿边。'],
      plant: ['嫩芽朝你的方向轻轻晃了晃。', '叶片舒展开来，向你轻轻点头。', '花苞微微颤动，像在说欢迎回来。'],
      baby: stage(s).index === 3
        ? [`${profiles.baby.name}伸出手，试着给你一个拥抱。`, `${profiles.baby.name}认出了你，张开双臂要拥抱。`, `${profiles.baby.name}主动拥抱你，紧紧依偎在你怀里。`]
        : ['宝宝看着你，握住你的手指。', '宝宝认出了你，安心地笑了。', '宝宝紧握你的手，在你怀里安心依偎。']
    };
    return { message: responses[s.selected][s.bond >= 65 ? 2 : s.bond >= 30 ? 1 : 0], rewarded };
  }
  function milestones(s) {
    return names.map((_, i) => ({ id: 'stage-' + i, title: stageName(s.selected, i),
      description: `游戏年龄 ${ages[i]} 天且有效照护经验 ${experience[i]}。`,
      unlocked: s.adopted && stage(s).index >= i }));
  }
  function parse(raw) {
    try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      assert(record(value));
      return value;
    } catch (_) { throw new TypeError('存档数据损坏'); }
  }
  function load(rawV2, rawV1, now) {
    assert(timestamp(now), '时间无效');
    if (rawV2 !== null && rawV2 !== undefined) {
      const raw = parse(rawV2);
      validate(raw);
      const s = JSON.parse(JSON.stringify(raw));
      if (s.worn === undefined) s.worn = null;
      if (s.health === undefined) s.health = 100;
      if (s.status === undefined) { s.status = 'alive'; s.criticalAt = null; s.leftAt = null; }
      return refresh(s, now);
    }
    if (rawV1 === null || rawV1 === undefined) return create(now);
    const old = parse(rawV1);
    assert(own(profiles, old.selected) && record(old.pets) && own(old.pets, old.selected));
    const p = old.pets[old.selected];
    assert(record(p) && timestamp(p.born) && timestamp(p.updated));
    assert(integer(p.leaves) && Array.isArray(p.progress) && Array.isArray(p.items));
    const s = Object.assign(create(p.updated), { selected: old.selected, born: p.born,
      needs: p.needs, xp: p.xp, count: p.count, seconds: p.seconds, points: p.leaves,
      logs: p.logs, progress: p.progress, items: p.items });
    if (p.daily !== undefined) {
      assert(record(p.daily) && typeof p.daily.date === 'string'
        && number(p.daily.seconds) && integer(p.daily.count));
      // v1 used locale dates. Compare against the saved update's local date.
      const d = new Date(p.updated);
      const legacyDates = [date(p.updated), d.toLocaleDateString(),
        `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
        `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`];
      assert(legacyDates.includes(p.daily.date), '旧档每日日期无效');
      s.daily = { date: date(p.updated), seconds: p.daily.seconds, count: p.daily.count, earned: 0 };
    }
    if (p.lastTouch !== undefined) s.lastTouch = p.lastTouch;
    validate(s);
    return refresh(JSON.parse(JSON.stringify(s)), now);
  }
  return Object.freeze({ profiles, catalog, create, adopt, load, stage, refresh, careOptions,
    products, begin, advance, checkin, buy, wear, relief, touch, milestones,
    remedy, restart, healthTier });
});
