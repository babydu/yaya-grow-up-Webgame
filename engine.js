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
  const NIGHT_RATE = 0.5;
  let night = { enabled: false, start: 22, end: 6 };
  function nightSpanMs(from, to) {
    if (!night.enabled || night.start === night.end || to <= from) return 0;
    // Corrupt saves may carry a near-zero timestamp; clamp to keep the day loop bounded.
    from = Math.max(from, to - 438000 * DAY);
    let total = 0;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() < to) {
      const dayStart = cursor.getTime();
      const winStart = dayStart + night.start * HOUR;
      const winEnd = dayStart + (night.end <= night.start ? night.end + 24 : night.end) * HOUR;
      const overlapStart = Math.max(from, winStart);
      const overlapEnd = Math.min(to, winEnd);
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }
  function configureNight(config) {
    assert(record(config) && typeof config.enabled === 'boolean');
    assert(integer(config.start, 23) && integer(config.end, 23), '夜间时段无效');
    night = { enabled: config.enabled, start: config.start, end: config.end };
  }
  const PACE = { tight: 0.75, normal: 1, relaxed: 1.5 };
  let pace = 'normal';
  function configurePace(id) {
    assert(own(PACE, id), '养育节奏无效');
    pace = id;
  }
  // Rest-day mode: on weekends and player-marked days the pet's needs drain at
  // a crawl (slow) or not at all (pause), so the player can keep their own
  // weekends. Health recovery and the critical window keep using real time.
  const REST_RATES = { slow: 0.1, pause: 0 };
  let restDays = { enabled: false, strength: 'slow', dates: [] };
  function validIso(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const dt = new Date(d + 'T12:00:00');
    return !isNaN(dt.getTime()) && dt.getMonth() === +d.slice(5, 7) - 1 && dt.getDate() === +d.slice(8, 10);
  }
  function isoDay(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isRestDayMs(t) {
    const dow = new Date(t).getDay();
    if (dow === 0 || dow === 6) return true;
    return restDays.dates.includes(isoDay(t));
  }
  function configureRestDays(config) {
    assert(record(config) && typeof config.enabled === 'boolean');
    assert(config.strength === 'slow' || config.strength === 'pause', '休息日强度无效');
    assert(Array.isArray(config.dates) && config.dates.every(validIso), '休息日日期无效');
    restDays = { enabled: config.enabled, strength: config.strength, dates: [...new Set(config.dates)] };
  }
  function isNightHour(t) {
    if (!night.enabled || night.start === night.end) return false;
    const h = new Date(t).getHours();
    const a = night.start;
    const b = night.end <= night.start ? night.end + 24 : night.end;
    const h2 = h < a ? h + 24 : h;
    return h2 >= a && h2 < b;
  }
  // Split an interval into hour bins and apply every active slowdown at once:
  // night windows halve need drain (energy drains faster), rest days multiply
  // every drain by the rest rate. Slowest rates simply stack.
  function tuneHours(from, to) {
    if (to <= from) return { awake: 0, energy: 0, any: 0 };
    // Clamp to 30 days: living saves can never span longer (the critical
    // window forces departure within ~40h), while a corrupted `updated=0`
    // save would otherwise loop half a million hour bins.
    from = Math.max(from, to - 30 * DAY);
    const restOn = restDays.enabled;
    const r = restOn ? (restDays.strength === 'pause' ? 0 : REST_RATES.slow) : 1;
    let awake = 0, energy = 0, any = 0;
    for (let t = Math.floor(from / HOUR) * HOUR; t < to; t += HOUR) {
      const segEnd = Math.min(t + HOUR, to);
      const frac = (segEnd - Math.max(t, from)) / HOUR;
      const nightHere = isNightHour(t + (segEnd - t) / 2);
      const restHere = restOn && isRestDayMs(t + (segEnd - t) / 2);
      const restMul = restHere ? r : 1;
      awake += frac * (nightHere ? NIGHT_RATE : 1) * restMul;
      energy += frac * (nightHere ? NIGHT_DROWSY : 1) * restMul;
      any += frac * restMul;
    }
    return { awake, energy, any };
  }
  function paceHours(hours) {
    return hours * PACE[pace];
  }
  // ---- sleep model ----
  // "安抚休息" puts cat/dog/baby to sleep (plant energy is fertilising, not
  // sleep). While asleep every other care is blocked (you don't feed or play
  // with a sleeping child), energy regenerates instead of draining, and
  // overnight hunger/comfort keep falling at full speed so the first thing a
  // player does in the morning is feed and change. Health damage is halved so
  // letting a pet sleep can never push it into the critical window.
  const SLEEP_GAIN_DAY = 6;    // energy/hour regained while asleep by day
  const SLEEP_GAIN_NIGHT = 10; // deeper sleep during the night window
  const NIGHT_DROWSY = 1.5;    // awake energy drains faster at night
  const SLEEP_HEALTH_SHIELD = 0.5;
  function isAsleep(s) {
    return !!s.adopted && s.status === 'alive' && s.selected !== 'plant' && s.sleepAt !== null && s.sleepAt !== undefined;
  }
  function isNightMs(t) {
    return nightSpanMs(t, t + 60000) > 0;
  }
  function sleepStatus(s, now) {
    const asleep = isAsleep(s);
    const night = isNightMs(now || s.updated);
    return {
      asleep,
      since: asleep ? s.sleepAt : null,
      energyRate: asleep ? (night ? SLEEP_GAIN_NIGHT : SLEEP_GAIN_DAY) : 0,
      night,
      label: asleep ? (night ? '正在熟睡 · 夜深好眠' : '正在午睡 · 轻一点') : null,
      desc: asleep ? (night ? '夜深了，它睡得正熟。' : '它刚被安抚着，正睡得沉沉的。') : null
    };
  }
  function wake(s, now) {
    refresh(s, now);
    if (!isAsleep(s)) return s.selected === 'plant' ? '植物安静生长，不需要叫醒' : '它正醒着';
    log(s, now, `${petName(s)}醒了，伸了个懒腰。`);
    s.sleepAt = null;
    s.lastWakeAt = now;
    return null;
  }
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
  // Read-only stage metadata so UI can render stage counts from data instead of
  // hardcoding "4" once new age brackets are introduced.
  const STAGES = Object.freeze({
    count: names.length, names: Object.freeze([...names]),
    ages: Object.freeze([...ages]), experience: Object.freeze([...experience]),
    labels: stageLabels
  });
  const profiles = {
    cat: { name: '橘汐', kind: '小猫', description: '陪伴小猫咪橘汐慢慢长大。',
      rhythm: '慢热柔软；偶尔打嗝、想玩球或做噩梦，10 秒内可回应。' },
    dog: { name: '麦芽', kind: '小狗', description: '陪伴小狗麦芽探索世界。',
      rhythm: '热情迎接；偶尔打嗝、想玩球或做噩梦，10 秒内可回应。' },
    baby: { name: '阿团', kind: '宝宝', description: '回应宝宝阿团的每一次需要。',
      rhythm: '会握住手指；偶尔打嗝、想玩球或做噩梦，10 秒内可回应。' },
    plant: { name: '团子', kind: '小植物', description: '陪小植物团子从破土走到盛放。',
      rhythm: '安静养成，不会弹出短时小事件。' }
  };
  const NANNY_RATE = 10; // points charged per real hour of nanny babysitting
  const MOMENT_MIN = 10 * 60 * 1000;
  const MOMENT_SPAN = 15 * 60 * 1000;
  const MOMENT_WINDOW = 10000;
  const momentCatalog = {
    cat: [
      { id: 'cat-hiccup', prompt: '{name}打了个小小的嗝，想让你拍拍背。', action: '轻轻拍拍背', habit: 'knead' },
      { id: 'cat-ball', prompt: '{name}盯着毛线球，想玩一会儿。', action: '陪它玩球', habit: 'pounce' },
      { id: 'cat-dream', prompt: '{name}睡着时忽然抖了一下，像做了噩梦。', action: '安抚一下', habit: 'twitch' },
      { id: 'cat-belly', prompt: '{name}走着走着「啪」地翻倒，露出毛茸茸的肚皮。', action: '摸摸小肚皮', habit: 'roll' },
      { id: 'cat-groom', prompt: '{name}舔着舔着毛停了下来，脖子够不着。', action: '帮它顺顺毛', habit: 'groom' },
      { id: 'cat-gift', prompt: '{name}叼来一片落叶，小心翼翼放在你脚边。', action: '收下这份心意', habit: 'gift' },
      { id: 'cat-nip', prompt: '{name}闻到猫薄荷的味道，在原地快乐打滚。', action: '陪着它傻乐', habit: 'roll' },
      { id: 'cat-bird', prompt: '{name}盯着窗外的麻雀，尾巴尖兴奋地抖来抖去。', action: '一起看小鸟', habit: 'watch' },
      { id: 'cat-freeze', prompt: '{name}舔毛舔到一半忽然定格，小舌头还露在外面。', action: '戳戳小鼻子', habit: 'freeze' },
      { id: 'cat-purr', prompt: '{name}趴在你手边，喉咙里发出了小小的呼噜声。', action: '轻轻挠挠下巴', habit: 'purr' },
      { id: 'cat-box', prompt: '{name}发现了一个空纸箱，正犹豫要不要钻进去。', action: '帮它打开盖子', habit: 'hide' },
      { id: 'cat-paw', prompt: '{name}伸出一只毛茸茸的小爪子，轻轻按在你的手背上。', action: '握住小爪子', habit: 'paw' }
    ],
    dog: [
      { id: 'dog-hiccup', prompt: '{name}打了个响嗝，有点不好意思。', action: '摸摸肚子', habit: 'wag' },
      { id: 'dog-ball', prompt: '{name}把球推到你脚边，眼睛亮亮的。', action: '扔一次球', habit: 'spin' },
      { id: 'dog-dream', prompt: '{name}睡着后腿在空中蹬了蹬，像在跑一场噩梦。', action: '轻声安慰', habit: 'run' },
      { id: 'dog-wag', prompt: '{name}看到你，尾巴摇得整间屋子都在震动。', action: '揉揉狗头', habit: 'wag' },
      { id: 'dog-belly', prompt: '{name}「咚」地躺倒，四脚朝天露出肚子。', action: '挠挠肚皮', habit: 'roll' },
      { id: 'dog-slipper', prompt: '{name}鬼鬼祟祟地把你的拖鞋叼到了窝里。', action: '假装没看见', habit: 'hide' },
      { id: 'dog-bury', prompt: '{name}在角落认真地刨着垫子，想把小骨头藏好。', action: '帮它挡挡视线', habit: 'dig' },
      { id: 'dog-door', prompt: '{name}竖起耳朵，冲门口小声哼哼。', action: '陪它去看一眼', habit: 'watch' },
      { id: 'dog-tail', prompt: '{name}追着自己的尾巴转了三圈，把自己转晕了。', action: '拦住小憨憨', habit: 'spin' },
      { id: 'dog-chin', prompt: '{name}慢慢走过来，把下巴搁在了你的脚背上。', action: '一动不动地陪着', habit: 'chin' },
      { id: 'dog-shake', prompt: '{name}哼唧着想出门，尾巴摇得有点心虚。', action: '带它出去走走', habit: 'wag' },
      { id: 'dog-yawn', prompt: '{name}打了一个好大好大的哈欠，露出一排小牙。', action: '摸摸小脑袋', habit: 'yawn' }
    ],
    baby: [
      { id: 'baby-hiccup', prompt: '{name}打嗝了，小肩膀一抖一抖。', action: '轻轻拍背', habit: 'clap' },
      { id: 'baby-ball', prompt: '{name}伸出手，想够那个小球。', action: '递过去', habit: 'reach' },
      { id: 'baby-dream', prompt: '{name}睡着后皱了皱眉，像做了噩梦。', action: '轻轻哄哄', habit: 'suck' },
      { id: 'baby-bubble', prompt: '{name}吐出了一个小小的口水泡泡，自己看得入迷。', action: '轻轻擦掉', habit: 'blow' },
      { id: 'baby-grip', prompt: '{name}伸出小手，一把抓住了你的手指，抓得紧紧的。', action: '由着它握一会儿', habit: 'grip' },
      { id: 'baby-peek', prompt: '{name}用小手挡住脸，又悄悄移开，眼睛亮晶晶的。', action: '配合着「喵」一声', habit: 'peek' },
      { id: 'baby-laugh', prompt: '{name}被一个鬼脸逗得咯咯直笑，笑得停不下来。', action: '再做一个鬼脸', habit: 'laugh' },
      { id: 'baby-flip', prompt: '{name}哼哧哼哧地努力，想把自己翻过去。', action: '在旁边护着', habit: 'flip' },
      { id: 'baby-babble', prompt: '{name}咿咿呀呀说了一大串，语气特别认真。', action: '认真地回答它', habit: 'babble' },
      { id: 'baby-pacifier', prompt: '{name}的安抚奶嘴掉了，小嘴瘪了瘪。', action: '捡起来擦擦', habit: 'suck' },
      { id: 'baby-mirror', prompt: '{name}盯着镜子里的自己，伸出小手想摸摸。', action: '抱着靠近一点', habit: 'watch' },
      { id: 'baby-kick', prompt: '{name}精神十足地踢蹬着小被子，把被子踢到床尾。', action: '重新盖好被子', habit: 'kick' }
    ],
    plant: []
  };
  function moments(type) {
    return (momentCatalog[type] || []).map(item => Object.freeze({
      id: item.id, prompt: item.prompt, action: item.action, habit: item.habit || null
    }));
  }
  function unitRoll(roll) {
    assert(typeof roll === 'number' && Number.isFinite(roll) && roll >= 0 && roll < 1, '随机值无效');
    return roll;
  }
  const careMeta = {
    cat: { actions: ['喂养', '清洁小窝', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    dog: { actions: ['喂养', '清洁小窝', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    baby: { actions: ['喂养', '换尿裤', '陪伴玩耍', '安抚休息'], needs: ['饱腹感', '洁净度', '好心情', '精力值'] },
    plant: { actions: ['浇水', '擦叶除虫', '晒太阳', '施肥'], needs: ['水分', '洁净度', '阳光', '养分'] }
  };
  const catalog = [];
  function product(id, name, icon, category, types, minStage, price, pack, gain, description) {
    catalog.push({ id, name, icon, category, types, minStage, price, pack, description, gain });
  }
  for (const type of ['cat', 'dog']) {
    const kind = profiles[type].kind;
    product(type + '-milk', kind + '专用奶粉', 'bottle', 'food', [type], 0, 20, 5,
      [45, 0, 0, 5], '初生期专用奶粉。');
    for (let i = 1; i < 4; i++) {
      product(type + '-food-' + i, kind + names[i] + '主食', 'bag', 'food', [type], i,
        20 + i * 2, 5, [45, 0, 0, 5], '与当前成长阶段匹配的日常主食。');
    }
  }
  product('baby-milk', '宝宝配方奶粉', 'bottle', 'food', ['baby'], 0, 20, 5,
    [45, 0, 0, 5], '初生、探索与辅食阶段均可使用的配方奶粉。');
  product('baby-food-2', '宝宝辅食', 'bag', 'food', ['baby'], 2, 24, 5,
    [45, 0, 0, 5], '成长期辅食，游戏中的简化养育设定。');
  product('baby-food-3', '宝宝均衡餐', 'bag', 'food', ['baby'], 3, 26, 5,
    [50, 0, 0, 5], '幼儿期的多样均衡餐。');
  const cleanNames = { cat: '猫砂', dog: '尿垫', baby: '尿裤' };
  const cleanHint = '档位差为游戏模拟，现实照护请咨询专业人士。';
  for (const type of ['cat', 'dog', 'baby']) {
    const name = cleanNames[type];
    product(type + '-clean-basic', '基础' + name, 'clean', 'clean', [type], 0, 15, 5,
      [0, 35, 0, 0], '基础' + name + '，一次照料洁净度 +35。' + cleanHint);
    product(type + '-clean', '舒适' + name, 'clean', 'clean', [type], 0, 18, 5,
      [0, 45, 0, 0], '舒适' + name + '，一次照料洁净度 +45。旧存档中的同名物资即本档。' + cleanHint);
    product(type + '-clean-plus', '优质' + name, 'clean', 'clean', [type], 0, 24, 5,
      [0, 55, 0, 0], '优质' + name + '，一次照料洁净度 +55。' + cleanHint);
    product(type + '-nutrition', profiles[type].kind + '营养均衡主食组合', 'leaf', 'nutrition',
      [type], 2, 18, 3, [50, 0, 0, 15],
      '每份含当前适龄完整主食与普通营养食品，可作为一餐；增加游戏饱腹与精力属性，无医疗用途。');
    product(type + '-toy', profiles[type].kind + '玩具', 'heart', 'comfort',
      [type], 0, 12, 3, [0, 0, 45, 0], '一次陪玩消耗一份玩具使用次数。');
  }
  product('plant-milk', '植物营养液', 'bottle', 'food', ['plant'], 0, 20, 5,
    [0, 0, 0, 45], '萌芽期专用营养液，稀释后施入盆土。');
  for (let i = 1; i < 4; i++) {
    product('plant-food-' + i, profiles.plant.kind + stageLabels.plant[i] + '期花肥', 'bag', 'food',
      ['plant'], i, 20 + i * 2, 5, [0, 0, 0, 45], '与当前成长阶段匹配的日常花肥，一次施肥养分 +45。');
    product('plant-food-' + i + '-plus', profiles.plant.kind + stageLabels.plant[i] + '期优质花肥', 'bag', 'food',
      ['plant'], i, 26 + i * 2, 5, [0, 0, 0, 55],
      '优质花肥，一次施肥养分 +55。档位差为游戏模拟，现实养护请咨询园艺专业人士。');
  }
  product('plant-clean-basic', '基础叶面喷雾', 'clean', 'clean', ['plant'], 0, 15, 5,
    [0, 35, 0, 0], '基础叶喷，一次擦叶洁净度 +35。' + cleanHint);
  product('plant-clean', '舒适叶面喷雾', 'clean', 'clean', ['plant'], 0, 18, 5,
    [0, 45, 0, 0], '舒适叶喷，一次擦叶洁净度 +45。旧存档中的同名物资即本档。' + cleanHint);
  product('plant-clean-plus', '优质叶面喷雾', 'clean', 'clean', ['plant'], 0, 24, 5,
    [0, 55, 0, 0], '优质叶喷，一次擦叶洁净度 +55。' + cleanHint);
  product('plant-nutrition', '植物营养均衡组合', 'leaf', 'nutrition', ['plant'], 2, 18, 3,
    [15, 0, 0, 50], '每份含适龄花肥与营养液，可作为一次完整施肥。');
  product('plant-toy', '植物陪伴小风铃', 'heart', 'comfort', ['plant'], 0, 12, 3,
    [0, 0, 45, 0], '晒太阳时挂在盆边，叮咚作响陪它度过一段时光。');
  product('medicine-kit', '安心药箱', 'heart', 'medical', ['baby', 'cat', 'dog', 'plant'], 0, 25, 1,
    [0, 0, 0, 0], '健康度偏低或病危时使用，立即恢复 40 点健康度。');
  product('revive-elixir', '回春灵药', 'spark', 'medical', ['baby', 'cat', 'dog', 'plant'], 0, 60, 1,
    [0, 0, 0, 0], '虚弱或病危时使用，立即恢复 60 点健康度，效果比药箱更强。');
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
  // Prices live in a mutable table so operators can override them globally
  // (data/site-config.json -> prices). Catalog items expose price via getter,
  // so the rest of the engine and UI keep reading `item.price` unchanged.
  const BASE_PRICES = {};
  const PRICE_STATE = {};
  for (const item of catalog) {
    BASE_PRICES[item.id] = item.price;
    PRICE_STATE[item.id] = item.price;
    Object.defineProperty(item, 'price', {
      get() { return PRICE_STATE[item.id]; }, enumerable: true, configurable: true
    });
  }
  function applyPriceOverrides(map) {
    for (const item of catalog) {
      const base = BASE_PRICES[item.id];
      const raw = (map && own(map, item.id)) ? map[item.id] : base;
      PRICE_STATE[item.id] = (Number.isSafeInteger(raw) && raw >= 1 && raw <= 1000000) ? raw : base;
    }
  }
  function basePrices() { return { ...BASE_PRICES }; }

  function freeze(value) {
    Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
    return Object.freeze(value);
  }
  freeze(profiles);
  freeze(catalog);
  const ACC_SLOT = {
    'acc-baby-1': 'wear', 'acc-baby-2': 'wear', 'acc-baby-3': 'wear', 'acc-baby-4': 'place',
    'acc-cat-1': 'wear', 'acc-cat-2': 'wear', 'acc-cat-3': 'place', 'acc-cat-4': 'place',
    'acc-dog-1': 'wear', 'acc-dog-2': 'wear', 'acc-dog-3': 'place', 'acc-dog-4': 'place',
    'acc-plant-1': 'place', 'acc-plant-2': 'place', 'acc-plant-3': 'place', 'acc-plant-4': 'place'
  };
  freeze(ACC_SLOT);
  const DYE = { hues: [0, 30, 200], names: ['本色', '暖调', '冷调'] };
  freeze(DYE);
  function emptyWorn() { return { wear: null, place: null }; }
  function accessorySlot(id) { return ACC_SLOT[id] || null; }
  function normalizeWorn(s) {
    if (s.worn === undefined || s.worn === null) { s.worn = emptyWorn(); return s.worn; }
    if (typeof s.worn === 'string') {
      const slot = ACC_SLOT[s.worn];
      s.worn = { wear: slot === 'wear' ? s.worn : null, place: slot === 'place' ? s.worn : null };
      return s.worn;
    }
    s.worn = { wear: s.worn.wear || null, place: s.worn.place || null };
    return s.worn;
  }
  function isEquipped(s, id) {
    const w = s.worn;
    if (!w) return false;
    if (typeof w === 'string') return w === id;
    return w.wear === id || w.place === id;
  }
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
        && s.emotionalMilestones.every(n => [30, 65].includes(n))
        && new Set(s.emotionalMilestones).size === s.emotionalMilestones.length);
    }
    assert(s.stageIndex <= eligibleStage(s));
    assert(record(s.inventory));
    for (const [id, quantity] of Object.entries(s.inventory)) {
      assert(catalog.some(p => p.id === id && p.types.includes(s.selected)) && integer(quantity));
    }
    if (own(s, 'worn') && s.worn !== null) {
      const assertAcc = id => {
        if (id === null) return;
        assert(typeof id === 'string');
        const acc = catalog.find(p => p.id === id);
        assert(acc && acc.category === 'accessory' && acc.types.includes(s.selected)
          && (s.inventory[id] || 0) > 0);
      };
      if (typeof s.worn === 'string') {
        assertAcc(s.worn);
      } else {
        assert(record(s.worn));
        const wear = s.worn.wear === undefined || s.worn.wear === null ? null : s.worn.wear;
        const place = s.worn.place === undefined || s.worn.place === null ? null : s.worn.place;
        if (wear) assert(ACC_SLOT[wear] === 'wear');
        if (place) assert(ACC_SLOT[place] === 'place');
        assertAcc(wear);
        assertAcc(place);
      }
    }
    if (own(s, 'tints')) {
      assert(record(s.tints));
      for (const [id, v] of Object.entries(s.tints)) {
        assert(catalog.some(p => p.id === id && p.category === 'accessory') && integer(v) && v >= 0 && v <= 2);
      }
    }
    if (own(s, 'health')) assert(number(s.health, 100));
    if (own(s, 'name') && s.name !== null) {
      assert(typeof s.name === 'string' && s.name.length >= 1 && s.name.length <= 12);
    }
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
    if (own(s, 'momentDueAt')) assert(s.momentDueAt === null || timestamp(s.momentDueAt));
    if (own(s, 'momentLastId')) assert(s.momentLastId === null
      || (typeof s.momentLastId === 'string' && s.momentLastId.length >= 1 && s.momentLastId.length <= 40));
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
      const categories = s.selected === 'plant'
        ? { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: ['food', 'nutrition'] }
        : { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: [] };
      const freeActions = s.selected === 'plant' ? ['food', 'mood', 'energy'] : ['mood', 'energy'];
      // A paid task keeps its original product and duration after a stage change.
      assert(t.productId === null ? freeActions.includes(t.actionId)
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
  // Daily micro-tasks: small, capped point rewards that encourage gentle daily
  // play without rivaling sign-in or care. Each is claimable once per day.
  const DAILY_TASKS = [
    { key: 'care', label: '完成一次照护', reward: 4 },
    { key: 'moment', label: '回应一次小心思', reward: 4 },
    { key: 'knowledge', label: '读一篇养育课堂', reward: 4 }
  ];
  let vigilSeconds = 150;
  const VIGIL_SECONDS = () => vigilSeconds;
  function freshDaily(now) {
    return { date: date(now), seconds: 0, count: 0, earned: 0, vigil: false,
      tasks: { care: false, moment: false, knowledge: false } };
  }
  function ensureDaily(s) {
    const d = s.daily;
    if (!record(d)) return;
    if (typeof d.vigil !== 'boolean') d.vigil = false;
    if (!record(d.tasks)) d.tasks = { care: false, moment: false, knowledge: false };
    else for (const t of DAILY_TASKS) if (typeof d.tasks[t.key] !== 'boolean') d.tasks[t.key] = false;
  }
  function rewardDailyTask(s, key, now) {
    if (!s.adopted || s.status === 'left') return 0;
    ensureDaily(s);
    if (s.daily.tasks[key]) return 0;
    const task = DAILY_TASKS.find(t => t.key === key);
    if (!task) return 0;
    s.daily.tasks[key] = true;
    s.points = Math.min(LIMIT, s.points + task.reward);
    // Keep the clock monotonic: log entries must never carry a later stamp than
    // the save's updated time (callers may pass a fresh timestamp after refresh).
    if (now > s.updated) s.updated = now;
    log(s, now, `完成今日小任务「${task.label}」，获得 ${task.reward} 积分。`);
    return task.reward;
  }
  function dailyTasks(s) {
    ensureDaily(s);
    return DAILY_TASKS.map(t => ({ id: t.key, label: t.label, reward: t.reward, done: !!s.daily.tasks[t.key] }));
  }
  function markKnowledgeTask(s, now) {
    assert(timestamp(now), '时间无效');
    return rewardDailyTask(s, 'knowledge', now);
  }
  const elixirPrice = () => (catalog.find(p => p.id === 'revive-elixir') || {}).price || 60;
  // A last-resort safety line: when the pet is in the critical window, owns no
  // elixir and cannot afford one, the player may spend a short vigil to top up
  // to exactly the elixir price. Once per day, so it never replaces sign-in.
  function configureVigil(seconds) {
    assert(integer(seconds, 600) && seconds >= 60, '守夜时长须为 60 至 600 秒之间的整数');
    vigilSeconds = seconds;
  }
  function vigilStatus(s) {
    const target = elixirPrice();
    const base = { seconds: vigilSeconds, target };
    if (!s.adopted) return { available: false, reason: '请先确认养育对象', ...base };
    if (s.status === 'left') return { available: false, reason: '它已经离开了', ...base };
    if (s.criticalAt === null) return { available: false, reason: '还没到最紧急的时候', ...base };
    if ((s.inventory['revive-elixir'] || 0) > 0) return { available: false, reason: '回春灵药就在小屋里', ...base };
    if (s.points >= target) return { available: false, reason: '积分已经够了，去小铺兑换灵药吧', ...base };
    ensureDaily(s);
    if (s.daily.vigil) return { available: false, reason: '今天已经守过夜了，明天再来陪它', ...base };
    return { available: true, reason: null, ...base };
  }
  function claimVigil(s, now) {
    refresh(s, now);
    const st = vigilStatus(s);
    if (!st.available) return st.reason || '现在不需要守夜';
    ensureDaily(s);
    s.daily.vigil = true;
    const gain = st.target - s.points;
    s.points = st.target;
    log(s, now, `守夜到天亮，凑齐了救命的积分（+${gain}）。`);
    return null;
  }
  function create(now) {
    assert(timestamp(now), '时间无效');
    return { version: 2, selected: null, adopted: false, born: now, updated: now,
      needs: [40, 75, 65, 70], xp: 0, count: 0, seconds: 0, bond: 0, points: 60,
      inventory: {}, logs: [], task: null, lastCare: {}, emotionalMilestones: [], worn: emptyWorn(), tints: {},
      health: 100, status: 'alive', criticalAt: null, leftAt: null, name: null,
      sleepAt: null, lastWakeAt: null,
      daily: freshDaily(now),
      checkin: { date: '', streak: 0 }, reliefDate: '', stageIndex: 0, lastTouch: null,
      momentDueAt: null, momentLastId: null, nannyAt: null, nannyDebt: 0 };
  }
  function eligibleStage(s) {
    if (s.status === 'left') return s.stageIndex;
    const age = Math.max(0, (s.updated - s.born) / DAY * 30);
    let index = 0;
    while (index < 3 && age >= ages[index + 1] && s.xp >= experience[index + 1]) index++;
    return index;
  }
  function stage(s) {
    const index = s.selected ? eligibleStage(s) : 0;
    const end = s.status === 'left' && s.leftAt ? s.leftAt : s.updated;
    const age = Math.max(0, Math.floor((end - s.born) / DAY * 30));
    const next = index === 3 ? null : { index: index + 1, name: stageName(s.selected, index + 1),
      age: ages[index + 1], xp: experience[index + 1] };
    const progress = next ? Math.min(1, Math.max(0, (age - ages[index]) / (next.age - ages[index])),
      Math.max(0, (s.xp - experience[index]) / (next.xp - experience[index]))) * 100 : 100;
    return { index, name: stageName(s.selected, index), age, label: `游戏年龄 ${age} 天`, progress, next,
      feedSeconds: [300, 240, 180, 120][index], feedHours: paceHours([3, 4, 5, 6][index]),
      cleanHours: paceHours(s.selected === 'baby' ? 4.5 : 5),
      description: '真实 1 天 = 游戏 30 天；晋级同时需要年龄与有效照护经验。此为游戏设定。' };
  }
  function log(s, now, text) {
    s.logs.push({ at: now, text });
    s.logs = s.logs.slice(-1000);
  }
  function rewardStages(s, now, skipPoints) {
    if (!s.adopted || s.status === 'left') return;
    const index = eligibleStage(s);
    while (s.stageIndex < index) {
      s.stageIndex++;
      if (!skipPoints) s.points = Math.min(LIMIT, s.points + 20);
      log(s, now, `进入${stageName(s.selected, s.stageIndex)}${skipPoints ? '。' : '，获得 20 积分。'}`);
    }
  }
  function rewardEmotions(s, now, skipPoints) {
    if (!own(s, 'emotionalMilestones')) s.emotionalMilestones = [];
    if (!s.adopted || s.status === 'left') return;
    for (const threshold of [30, 65]) {
      if (s.bond < threshold || s.emotionalMilestones.includes(threshold)) continue;
      s.emotionalMilestones.push(threshold);
      if (!skipPoints) s.points = Math.min(LIMIT, s.points + 10);
      log(s, now, `与${petName(s)}的亲密度首次达到 ${threshold}，${threshold === 30 ? '建立信任' : '亲密依恋'}${skipPoints ? '。' : '，获得 10 积分。'}`);
    }
  }
  function refresh(s, now) {
    clock(s, now);
    const span = now - s.updated;
    const restMs = nightSpanMs(s.updated, now);
    // Night hours advance growth pressure at half speed; recovery follows real time.
    const dayH = (span - restMs) / HOUR;
    const nightH = restMs / HOUR;
    // Rest days slow the drain further (hour bins, slowest rate wins).
    const tuned = tuneHours(s.updated, now);
    const activeHours = tuned.awake;
    const energyHours = tuned.energy;
    const hours = tuned.any;
    const rawHours = span / HOUR;
    s.updated = now;
    const asleep = isAsleep(s);
    // Apply the destination stage's rates to the entire elapsed interval.
    if (s.selected) {
      const options = careOptions(s);
      s.needs = s.needs.map((v, i) => {
        const rate = options[i].gain / options[i].intervalHours;
        if (i === 3) {
          // Energy: drains while awake (faster at night), recovers while asleep
          // (deeper recovery during the night window).
          if (asleep) return Math.min(100, v + dayH * SLEEP_GAIN_DAY + nightH * SLEEP_GAIN_NIGHT);
          return Math.max(0, v - energyHours * rate);
        }
        // Hunger/comfort keep falling at full speed while asleep (unless a
        // rest-day pause zeroes activeHours); a sleeping child still gets
        // hungry, so mornings start with real needs.
        return Math.max(0, v - (asleep ? hours : activeHours) * rate);
      });
      if (asleep && s.needs[3] >= 100) {
        log(s, now, `${petName(s)}睡饱了，自己醒了过来。`);
        s.sleepAt = null;
        s.lastWakeAt = now;
      }
    }
    if (s.adopted && s.status === 'alive') {
      const starving = s.needs.filter(v => v < 10).length;
      // Sleep shields health: needs still deplete but the body copes better.
      const healthHours = asleep ? hours * SLEEP_HEALTH_SHIELD : activeHours;
      if (starving > 0) s.health = Math.max(0, s.health - Math.min(3, starving * 0.75) * healthHours);
      else if (s.needs.every(v => v >= 30)) s.health = Math.min(100, s.health + rawHours);
      let bondDrain = 0.1;
      if (starving > 0) bondDrain += Math.min(0.8, starving * 0.25);
      if (s.criticalAt !== null) bondDrain += 0.6;
      s.bond = Math.max(0, s.bond - bondDrain * activeHours);
      if (s.health <= 0 && s.criticalAt === null) {
        s.health = 0;
        s.criticalAt = now;
        const hurt = s.bond > 0;
        if (hurt) s.bond = Math.max(0, s.bond - 8);
        log(s, now, `${petName(s)}的健康度耗尽了，进入病危状态。24 小时内用安心药箱或回春灵药${CRITICAL_HINT}。${hurt ? '亲密度也受到了伤害。' : ''}`);
      }
      if (s.criticalAt !== null && s.health >= 20) {
        s.criticalAt = null;
        log(s, now, `${petName(s)}的状况稳定下来了，好好休养吧。`);
      }
      if (s.criticalAt !== null) {
        const sinceCritical = nightSpanMs(s.criticalAt, now);
        const criticalHours = (now - s.criticalAt - sinceCritical) / HOUR + (sinceCritical / HOUR) * NIGHT_RATE;
        if (criticalHours >= 24) leave(s, now);
      }    }
    if (s.daily.date !== date(now)) s.daily = freshDaily(now);
    rewardStages(s, now);
    rewardEmotions(s, now);
    return s;
  }
  const departures = {
    baby: '被家人接去远方生活了。临走前它朝你挥了挥手，把这段日子里小小的温暖都装进了行囊。',
    cat: '趁着夜色跳出院墙，独自出门远行了。它回头望了一眼小屋，把你们相伴的时光都记在了心里。',
    dog: '趁着夜色跑向了远方的田野。它摇着尾巴告别，把被爱着的每一天都跑成了风。',
    plant: '的花朵安静地枯萎，化作春泥，把这一季的陪伴都留在了土里，等来年春风再起。'
  };
  // Wording shared by the live critical log and the departed-state cleanup so a
  // rescue promise never survives into the memorial panel.
  const CRITICAL_HINT = '还能挽回';
  function criticalRemaining(s, now) {
    if (!s.adopted || s.status !== 'alive' || s.criticalAt === null) return null;
    const sinceCritical = nightSpanMs(s.criticalAt, now);
    const used = (now - s.criticalAt - sinceCritical) / HOUR + (sinceCritical / HOUR) * NIGHT_RATE;
    return Math.max(0, 24 - used);
  }
  function leave(s, now) {
    rewardStages(s, now);
    // The critical-window log promises a rescue that is now impossible; rewrite
    // it as a past-tense memory before writing the departure entry.
    for (const entry of s.logs) {
      if (entry.text.includes(CRITICAL_HINT)) {
        entry.text = `${petName(s)}的健康度耗尽了，最终没能等到挽回。`;
      }
    }
    s.status = 'left';
    s.leftAt = now;
    s.task = null;
    log(s, now, `${petName(s)}${departures[s.selected]}`);
  }
  function healthTier(s) {
    if (!s.adopted) return null;
    if (s.status === 'left') return 'left';
    if (s.criticalAt !== null || s.health < 20) return 'critical';
    if (s.health < 40) return 'sick';
    if (s.health < 70) return 'low';
    return 'healthy';
  }
  function petName(s) {
    return s.name || profiles[s.selected].name;
  }
  function departedCopy(s) {
    const name = petName(s);
    return s.selected === 'plant'
      ? `${name}的这一季已经结束，开始新的陪伴吧`
      : `${name}已经离开，开始新的陪伴吧`;
  }
  function adopt(s, type, now, name) {
    clock(s, now);
    assert(own(profiles, type), '养育类型无效');
    assert(!s.adopted, '已经确认养育对象');
    if (s.selected !== type) Object.assign(s, create(now), { progress: [0, 0, 0, 0], items: [] });
    if (name !== undefined && name !== null) {
      assert(typeof name === 'string', '名字无效');
      const trimmed = name.trim();
      assert(trimmed.length <= 12, '名字需要是 12 个字符以内');
      if (trimmed) s.name = trimmed;
    }
    refresh(s, now);
    s.selected = type;
    s.adopted = true;
    s.inventory[type + '-milk'] = (s.inventory[type + '-milk'] || 0) + 5;
    s.inventory[type + '-clean'] = (s.inventory[type + '-clean'] || 0) + 5;
    log(s, now, `确认陪伴${petName(s)}成长。`);
    if (type !== 'plant') s.momentDueAt = now + MOMENT_MIN;
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
    const categories = s.selected === 'plant'
      ? { food: [], clean: ['clean'], mood: ['comfort'], energy: ['food', 'nutrition'] }
      : { food: ['food', 'nutrition'], clean: ['clean'], mood: ['comfort'], energy: [] };
    if (!own(categories, actionId)) return [];
    return catalog.filter(p => available(s, p) && categories[actionId].includes(p.category));
  }
  function careQuantityCap(actionId, productId) {
    if (actionId === 'clean' || actionId === 'mood') return 1;
    const p = catalog.find(item => item.id === productId);
    if (p && p.category === 'nutrition') return 1;
    if (actionId === 'food') return 2;
    if (actionId === 'energy' && p && p.category === 'food') return 2;
    return 1;
  }
  function careOptions(s) {
    const st = stage(s);
    return ids.map((id, i) => {
      const intervalHours = [st.feedHours, st.cleanHours, paceHours(3.5), paceHours(4)][i];
      const last = s.lastCare[id];
      const dueAt = last === undefined ? s.updated : s.needs[i] < 35
        ? last + 60000 : last + intervalHours * HOUR;
      return { id, name: careMeta[s.selected].actions[i],
        need: careMeta[s.selected].needs[i],
        icon: (s.selected === 'plant' ? ['bottle', 'clean', 'heart', 'leaf'] : ['bottle', 'clean', 'heart', 'moon'])[i],
        seconds: [st.feedSeconds, 30, 60, 120][i],
        intervalHours, gain: [45, 45, 35, 40][i], dueAt,
        description: (s.selected === 'plant'
          ? ['适量浇水，水分达到 80 时暂停。', '擦叶除虫，保持叶面干净。', '搬到光线合适的地方晒一会儿。', '薄肥勤施，给土壤补养分。']
          : ['适量喂养，饱腹达到 80 时暂停喂养。', '保持干净舒适。', '专注陪伴。', '安心休息。'])[i] };
    });
  }
  function careBlock(s, actionId) {
    if (s.status === 'left') return departedCopy(s);
    // Critical care comes first: a dying pet must be rescued even mid-nap,
    // otherwise sleep wording would mask the only life-saving prompt.
    if (s.criticalAt !== null) return `${petName(s)}病危了，先用安心药箱或回春灵药挽回`;
    if (isAsleep(s)) return `${petName(s)}正睡得香，喂养、清洁和玩耍都先等它醒来`;
    if (s.health < 20 && actionId === 'mood') return `${petName(s)}太虚弱了，先照顾好身体`;
    return null;
  }
  function begin(s, actionId, productId, now, quantity) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (!ids.includes(actionId)) return '照护动作无效';
    const pid = productId === undefined ? null : productId;
    const block = careBlock(s, actionId);
    if (block) return block;
    if (s.task) return s.task.actionId === actionId && s.task.productId === pid ? null : '请先完成当前任务';
    const units = quantity === undefined ? 1 : quantity;
    if (!Number.isInteger(units) || units < 1) return '物资数量无效';
    if (pid === null && units !== 1) return '这种照护无需选择数量';
    const cap = careQuantityCap(actionId, pid);
    if (units > cap) {
      if (cap === 2) return actionId === 'energy' ? '一次施肥最多两份，薄肥勤施就好' : '一餐最多两份，一次喂完就好';
      return '这次照料一次只用一份';
    }
    const option = careOptions(s).find(a => a.id === actionId);
    const index = ids.indexOf(actionId);
    if (s.needs[index] >= (actionId === 'food' ? 80 : 95)) return '当前需求已满足';
    if (now < option.dueAt) return '照护仍在冷却中';
    const p = products(s, actionId).find(item => item.id === pid);
    if (pid !== null && !p) return '商品不适用于当前对象、动作或阶段';
    const paid = s.selected === 'plant' ? ['energy', 'clean'] : ['food', 'clean'];
    if (pid === null && paid.includes(actionId)) return '请选择消耗品';
    if (p && !(s.inventory[p.id] >= units)) return '库存不足';
    if (p) s.inventory[p.id] -= units;
    const seconds = option.seconds * units;
    s.task = { actionId, productId: pid, name: option.name, seconds, quantity: units,
      elapsed: Math.min(seconds, s.progress ? s.progress[index] : 0) };
    if (s.progress) s.progress[index] = 0;
    return null;
  }
  function advance(s, seconds, now, opts) {
    assert(number(seconds), '前台增量无效');
    const noPoints = !!(opts && opts.noPoints);
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
    const base = p ? p.gain.map(v => v * units) : ids.map((_, j) => i === j ? [45, 45, 35, 40][i] : 0);
    const yieldK = 0.55 + 0.45 * s.health / 100;
    const gain = base.map(v => v * yieldK);
    const effective = s.needs.some((v, j) => gain[j] > 0 && v < 100);
    s.needs = s.needs.map((v, j) => Math.min(100, v + gain[j]));
    s.count = Math.min(LIMIT, s.count + 1);
    s.daily.count = Math.min(s.count, s.daily.count + 1);
    s.lastCare[t.actionId] = now;
    s.task = null;
    const points = (effective && !noPoints) ? Math.min(5, 40 - s.daily.earned, LIMIT - s.points) : 0;
    const growth = effective ? (s.health < 40 ? 5 : 10) : 0;
    if (effective) {
      s.xp = Math.min(LIMIT, s.xp + growth);
      s.bond = Math.min(100, s.bond + 2);
      s.health = Math.min(100, s.health + 2);
    }
    s.points += points;
    s.daily.earned += points;
    const label = units > 1 ? `${t.name} × ${units}` : t.name;
    const message = noPoints ? `${label}完成，成长 +${growth}。` : `${label}完成，成长 +${growth}，积分 +${points}。`;
    log(s, now, message);
    // A finished rest puts cat/dog/baby to sleep: needs then freeze for care
    // while energy recovers on its own. A pet whose energy is already full
    // (the rest itself tops it up) has no drowsiness left to sleep on.
    // Plants skip the sleep model.
    if (t.actionId === 'energy' && s.selected !== 'plant' && s.needs[3] < 100) {
      s.sleepAt = now;
      s.lastWakeAt = null;
      log(s, now, `${petName(s)}安静地睡着了，呼吸变得轻而均匀。`);
    }
    rewardStages(s, now, noPoints);
    rewardEmotions(s, now, noPoints);
    return { title: '照护完成', message, points };
  }
  function checkin(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return departedCopy(s);
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
    if (s.status === 'left') return departedCopy(s);
    const p = catalog.find(item => item.id === id);
    if (!p || !available(s, p)) return '商品无效或不适龄';
    if (id === 'medicine-kit') {
      if (s.health >= 70 && s.criticalAt === null) return `${profiles[s.selected].name}很健康，暂不需要药箱`;
    }
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
    if (s.status === 'left') return departedCopy(s);
    const slots = normalizeWorn(s);
    if (id === null) {
      if (slots.wear || slots.place) log(s, now, `收起了饰物。`);
      s.worn = emptyWorn();
      return null;
    }
    const acc = catalog.find(item => item.id === id);
    if (!acc || acc.category !== 'accessory' || !acc.types.includes(s.selected)) return '饰物不适用于当前对象';
    if (stage(s).index < acc.minStage) return '成长后才能佩戴这件饰物';
    if (!(s.inventory[id] > 0)) return '请先在生活小铺兑换这件饰物';
    const slot = ACC_SLOT[id];
    if (!slot) return '饰物不适用于当前对象';
    if (slots[slot] === id) {
      slots[slot] = null;
      log(s, now, slot === 'place' ? `收起了${acc.name}。` : `脱下了${acc.name}。`);
    } else {
      slots[slot] = id;
      log(s, now, slot === 'place' ? `把${acc.name}放在小屋里。` : `为${petName(s)}穿上了${acc.name}。`);
    }
    return null;
  }
  function dye(s, id, variant, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return departedCopy(s);
    const p = catalog.find(item => item.id === id);
    if (!p || p.category !== 'accessory') return '染色方案不适用于这件商品';
    if (!(s.inventory[id] > 0)) return '请先在生活小铺兑换这件饰物';
    if (!integer(variant) || variant < 0 || variant > 2) return '染色方案无效';
    if (variant === 0) delete s.tints[id]; else s.tints[id] = variant;
    return null;
  }
  function relief(s, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return departedCopy(s);
    if (s.reliefDate === date(now)) return '今日已领取基础补给';
    let supplied = false;
    const supplyActions = s.selected === 'plant' ? ['energy', 'clean'] : ['food', 'clean'];
    for (const action of supplyActions) {
      const options = products(s, action);
      if (options.some(p => (s.inventory[p.id] || 0) > 0)
        || (s.task && s.task.actionId === action)) continue;
      const id = action === 'clean' ? s.selected + '-clean' : options[0].id;
      s.inventory[id] = 2;
      supplied = true;
    }
    if (!supplied) return '基础物资充足';
    s.reliefDate = date(now);
    log(s, now, '领取基础补给，缺少的消耗品各补充 2 份。');
    return null;
  }
  function remedy(s, id, now) {
    refresh(s, now);
    if (!s.adopted) return '请先确认养育对象';
    if (s.status === 'left') return departedCopy(s);
    const p = catalog.find(item => item.id === id && item.category === 'medical');
    if (!p) return '商品无效';
    // A kit only tops up 40; once health has actually reached zero, only the
    // stronger elixir can bring the pet back. Decay can leave a tiny positive
    // residue right after the window opens, so treat anything under one point
    // as "empty". Check this before stock so the message names the real blocker.
    if (id === 'medicine-kit' && s.health < 1) {
      return `${profiles[s.selected].name}的健康度已经见底，药箱回天乏力，快用回春灵药`;
    }
    if (!(s.inventory[id] > 0)) return '库存不足，请先在生活小铺兑换';
    if (id === 'medicine-kit') {
      if (s.criticalAt === null && s.health >= 70) return `${profiles[s.selected].name}很健康，暂不需要药箱`;
      const fromCritical = s.criticalAt !== null;
      s.inventory[id]--;
      s.health = Math.min(100, s.health + 40);
      s.criticalAt = null;
      log(s, now, `使用了${p.name}，${petName(s)}的健康度恢复到 ${Math.round(s.health)}。${fromCritical ? '身体在恢复，心里的距离还要慢慢陪回来。' : ''}`);
      return null;
    }
    if (id === 'revive-elixir') {
      if (s.criticalAt === null && s.health >= 70) return `${profiles[s.selected].name}状态还好，灵药先收好`;
      const fromCritical = s.criticalAt !== null;
      s.inventory[id]--;
      s.health = Math.min(100, s.health + 60);
      s.criticalAt = null;
      log(s, now, `使用了${p.name}，${petName(s)}的健康度恢复到 ${Math.round(s.health)}。${fromCritical ? '身体在恢复，心里的距离还要慢慢陪回来。' : ''}`);
      return null;
    }
    return '商品无效';
  }
  // Time-based babysitting fee: while the nanny is on, points trickle out by
  // real hours (NANNY_RATE/hour). It uses a float debt counter so whole points
  // are deducted only when a full point accrues, keeping points integral.
  function nannyStart(s, now) {
    if (!s.adopted || s.status === 'left') return;
    if (s.nannyAt === null || s.nannyAt === undefined) s.nannyAt = now;
  }
  function nannyStop(s) { s.nannyAt = null; }
  function nannyPause(s, now) { if (s.nannyAt !== null && s.nannyAt !== undefined) s.nannyAt = now; }
  function nannyCharge(s, now) {
    const rate = NANNY_RATE;
    if (!s.adopted || s.status === 'left' || s.criticalAt !== null) {
      s.nannyAt = null;
      return { charged: 0, insufficient: false, rate };
    }
    if (s.nannyAt === null || s.nannyAt === undefined) { s.nannyAt = now; return { charged: 0, insufficient: false, rate }; }
    let elapsed = now - s.nannyAt;
    if (elapsed < 0) elapsed = 0;
    s.nannyAt = now;
    s.nannyDebt = (Number.isFinite(s.nannyDebt) ? s.nannyDebt : 0) + (elapsed / HOUR) * rate;
    const whole = Math.floor(s.nannyDebt);
    if (whole <= 0) return { charged: 0, insufficient: false, rate };
    const pay = Math.min(whole, s.points);
    s.points -= pay;
    s.nannyDebt -= whole;
    if (pay < whole) {
      s.nannyDebt = 0;
      s.nannyAt = null;
      log(s, now, '积分不足以维持贴心管家，托管已停止。');
      return { charged: pay, insufficient: true, rate };
    }
    return { charged: pay, insufficient: false, rate };
  }
  function nanny(s, now) {
    const cared = [];
    let blocked = null;
    refresh(s, now);
    if (!s.adopted || s.status !== 'alive' || s.criticalAt !== null || s.task) return { cared, blocked };
    // Sleeping pet needs no feeding or play: pause billing so the sitter does
    // not charge for idling beside the crib.
    if (isAsleep(s)) { nannyPause(s, now); return { cared, blocked }; }
    const paidActions = s.selected === 'plant' ? ['energy', 'clean'] : ['food', 'clean'];
    for (let pass = 0; pass < 4; pass++) {
      const options = careOptions(s);
      const option = options.find((a, i) => s.needs[i] < (a.id === 'food' ? 80 : 95)
        && now >= a.dueAt);
      if (!option) break;
      const pidCandidates = products(s, option.id);
      let pid = null;
      if (paidActions.includes(option.id)) {
        if (!pidCandidates.length) { blocked = '缺少适用的物资，管家先歇一歇'; break; }
        const pick = pidCandidates.find(p => (s.inventory[p.id] || 0) >= 2)
          || pidCandidates.find(p => (s.inventory[p.id] || 0) >= 1)
          || pidCandidates[0];
        if ((s.inventory[pick.id] || 0) < 2) {
          const cost = pick.price * 2;
          if (s.points < cost) { blocked = '积分不足，管家暂时无法补货'; break; }
          if ((s.inventory[pick.id] || 0) > LIMIT - pick.pack) { blocked = '物资库存已达上限，管家先歇一歇'; break; }
          s.points -= cost;
          s.inventory[pick.id] = (s.inventory[pick.id] || 0) + pick.pack;
          log(s, now, `贴心管家按双倍价格代购了${pick.name}。`);
          pid = pick.id;
        } else pid = pick.id;
      }
      const err = begin(s, option.id, pid, now);
      if (err) { blocked = err; break; }
      if (pid !== null) s.inventory[pid] -= 1;
      const result = advance(s, s.task.seconds, now, { noPoints: true });
      cared.push({ name: option.name, message: result ? result.message : '' });
    }
    return { cared, blocked };
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
    if (s.status === 'left') return { message: departedCopy(s), rewarded: false };
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
        ? [`${petName(s)}伸出手，试着给你一个拥抱。`, `${petName(s)}认出了你，张开双臂要拥抱。`, `${petName(s)}主动拥抱你，紧紧依偎在你怀里。`]
        : ['宝宝看着你，握住你的手指。', '宝宝认出了你，安心地笑了。', '宝宝紧握你的手，在你怀里安心依偎。']
    };
    return { message: responses[s.selected][s.bond >= 65 ? 2 : s.bond >= 30 ? 1 : 0], rewarded };
  }
  function scheduleMoment(s, now, roll) {
    clock(s, now);
    unitRoll(roll);
    if (!s.adopted || s.status !== 'alive' || s.selected === 'plant' || moments(s.selected).length === 0) {
      s.momentDueAt = null;
      return null;
    }
    s.momentDueAt = now + MOMENT_MIN + Math.floor(roll * MOMENT_SPAN);
    return s.momentDueAt;
  }
  function startMoment(s, now, roll) {
    clock(s, now);
    unitRoll(roll);
    const pool = moments(s.selected);
    if (!s.adopted || s.status !== 'alive' || s.health < 20 || pool.length === 0) return null;
    if (s.momentDueAt !== null && now < s.momentDueAt) return null;
    const choices = pool.filter(item => item.id !== s.momentLastId);
    const pick = (choices.length ? choices : pool)[Math.floor(roll * (choices.length ? choices.length : pool.length))];
    s.momentLastId = pick.id;
    s.momentDueAt = now + MOMENT_MIN;
    return { id: pick.id, prompt: pick.prompt.replace(/\{name\}/g, petName(s)), action: pick.action, habit: pick.habit || null, until: now + MOMENT_WINDOW };
  }
  function resolveMoment(s, now, outcome, roll) {
    refresh(s, now);
    assert(outcome === 'hit' || outcome === 'miss' || outcome === 'defer', '短时事件结果无效');
    const name = petName(s);
    if (outcome === 'hit') {
      s.bond = Math.min(100, s.bond + 2);
      log(s, now, `回应了${name}的一个小心思。亲密度 +2。`);
      rewardEmotions(s, now);
    } else if (outcome === 'miss') {
      s.bond = Math.max(0, s.bond - 1);
      log(s, now, `${name}的小心思过去了。亲密度 -1。`);
    }
    scheduleMoment(s, now, roll);
    return s;
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
      // A device clock moved backwards must not invalidate an intact save.
      if (now < raw.updated) now = raw.updated;
      const s = JSON.parse(JSON.stringify(raw));
      normalizeWorn(s);
      if (s.name === undefined) s.name = null;
      if (s.momentDueAt === undefined) s.momentDueAt = null;
      if (s.momentLastId === undefined) s.momentLastId = null;
      if (s.health === undefined) s.health = 100;
      if (s.tints === undefined) s.tints = {};
      if (s.nannyAt === undefined) s.nannyAt = null;
      if (!Number.isFinite(s.nannyDebt)) s.nannyDebt = 0;
      if (s.sleepAt === undefined) s.sleepAt = null;
      if (s.lastWakeAt === undefined) s.lastWakeAt = null;
      ensureDaily(s);
      if (s.status === undefined) { s.status = 'alive'; s.criticalAt = null; s.leftAt = null; }
      // Older saves kept the critical-window rescue promise after departure.
      if (s.status === 'left') {
        for (const entry of s.logs) {
          if (entry.text.includes(CRITICAL_HINT)) {
            entry.text = `${petName(s)}的健康度耗尽了，最终没能等到挽回。`;
          }
        }
      }
      if (s.adopted && s.status === 'alive' && s.selected !== 'plant' && s.momentDueAt === null)
        s.momentDueAt = now + MOMENT_MIN;
      return refresh(s, now);
    }
    if (rawV1 === null || rawV1 === undefined) return create(now);
    const old = parse(rawV1);
    assert(own(profiles, old.selected) && record(old.pets) && own(old.pets, old.selected));
    const p = old.pets[old.selected];
    assert(record(p) && timestamp(p.born) && timestamp(p.updated));
    // Clock rollback on a legacy save must not turn into a corrupt-save prompt.
    if (now < p.updated) now = p.updated;
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
    products, begin, advance, checkin, buy, wear, relief, touch, milestones, careBlock,
    vigilStatus, claimVigil, dailyTasks, markKnowledgeTask,
    VIGIL_SECONDS, configureVigil,
    completeDailyTask: rewardDailyTask,
    nannyStart, nannyStop, nannyPause, nannyCharge, NANNY_RATE,
    applyPriceOverrides, basePrices,
    remedy, restart, healthTier, configureNight, configurePace, configureRestDays, isRestDayMs, criticalRemaining, petName, nanny,
    isAsleep, sleepStatus, wake, isNightMs, SLEEP_GAIN_DAY: SLEEP_GAIN_DAY, SLEEP_GAIN_NIGHT: SLEEP_GAIN_NIGHT,
    accessorySlot, isEquipped, careQuantityCap, dye, DYE, STAGES,
    moments, scheduleMoment, startMoment, resolveMoment });
});
