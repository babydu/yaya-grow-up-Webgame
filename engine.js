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
  function stageName(type, index) {
    return type === 'baby' && index === 3 ? '幼儿期' : names[index];
  }
  const profiles = {
    cat: { name: '奶油', kind: '小猫', description: '陪伴小猫慢慢长大。' },
    dog: { name: '土豆', kind: '小狗', description: '陪伴小狗探索世界。' },
    baby: { name: '小满', kind: '宝宝', description: '回应宝宝的每一次需要。' }
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
      const categories = { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: [] };
      // A paid task keeps its original product and duration after a stage change.
      assert(t.productId === null ? ['mood', 'energy'].includes(t.actionId)
        : catalog.some(p => p.id === t.productId && p.types.includes(s.selected)
          && p.minStage <= stage(s).index && categories[t.actionId].includes(p.category)));
      assert(t.actionId === 'food' ? [300, 240, 180, 120].includes(t.seconds)
        : t.seconds === legacyDurations[ids.indexOf(t.actionId)]);
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
      inventory: {}, logs: [], task: null, lastCare: {}, emotionalMilestones: [],
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
    if (s.daily.date !== date(now)) s.daily = { date: date(now), seconds: 0, count: 0, earned: 0 };
    rewardStages(s, now);
    rewardEmotions(s, now);
    return s;
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
      return { id, name: ['喂养', s.selected === 'baby' ? '换尿裤' : '清洁小窝', '陪伴玩耍', '安抚休息'][i],
        icon: ['bottle', 'clean', 'heart', 'moon'][i], seconds: [st.feedSeconds, 30, 60, 120][i],
        intervalHours, gain: [45, 45, 35, 40][i], dueAt,
        description: ['适量喂养，饱腹达到 80 时暂停喂养。', '保持干净舒适。', '专注陪伴。', '安心休息。'][i] };
    });
  }
  function begin(s, actionId, productId, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (!ids.includes(actionId)) return '照护动作无效';
    const pid = productId === undefined ? null : productId;
    if (s.task) return s.task.actionId === actionId && s.task.productId === pid ? null : '请先完成当前任务';
    const option = careOptions(s).find(a => a.id === actionId);
    const index = ids.indexOf(actionId);
    if (s.needs[index] >= (actionId === 'food' ? 80 : 95)) return '当前需求已满足';
    if (now < option.dueAt) return '照护仍在冷却中';
    const p = products(s, actionId).find(item => item.id === pid);
    if (pid !== null && !p) return '商品不适用于当前对象、动作或阶段';
    if (pid === null && ['food', 'clean'].includes(actionId)) return '请选择消耗品';
    if (p && !(s.inventory[p.id] > 0)) return '库存不足';
    if (p) s.inventory[p.id]--;
    s.task = { actionId, productId: pid, name: option.name, seconds: option.seconds,
      elapsed: Math.min(option.seconds, s.progress ? s.progress[index] : 0) };
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
    const gain = p ? p.gain : ids.map((_, j) => i === j ? [45, 45, 35, 40][i] : 0);
    const effective = s.needs.some((v, j) => gain[j] > 0 && v < 100);
    s.needs = s.needs.map((v, j) => Math.min(100, v + gain[j]));
    s.count = Math.min(LIMIT, s.count + 1);
    s.daily.count = Math.min(s.count, s.daily.count + 1);
    s.lastCare[t.actionId] = now;
    s.task = null;
    const points = effective ? Math.min(5, 40 - s.daily.earned, LIMIT - s.points) : 0;
    if (effective) {
      s.xp = Math.min(LIMIT, s.xp + 10);
      s.bond = Math.min(100, s.bond + 2);
    }
    s.points += points;
    s.daily.earned += points;
    const message = `${t.name}完成，成长 +${effective ? 10 : 0}，积分 +${points}。`;
    log(s, now, message);
    rewardStages(s, now);
    rewardEmotions(s, now);
    return { title: '照护完成', message, points };
  }
  function checkin(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
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
    const p = catalog.find(item => item.id === id);
    if (!p || !available(s, p)) return '商品无效或不适龄';
    if (s.points < p.price) return '积分不足';
    if ((s.inventory[id] || 0) > LIMIT - p.pack) return '库存已达上限';
    s.points -= p.price;
    s.inventory[id] = (s.inventory[id] || 0) + p.pack;
    log(s, now, `购买${p.name} ${p.pack} 份。`);
    return null;
  }
  function relief(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
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
  function touch(s, now) {
    refresh(s, now);
    if (!s.adopted) return { message: '请先确认养育对象', rewarded: false };
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
      baby: stage(s).index === 3
        ? ['小满伸出手，试着给你一个拥抱。', '小满认出了你，张开双臂要拥抱。', '小满主动拥抱你，紧紧依偎在你怀里。']
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
    products, begin, advance, checkin, buy, relief, touch, milestones });
});
