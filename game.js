'use strict';
const G = window.GameEngine;
const { icon, scene, portrait } = window.GameVisuals;
const A = window.GameAudio;
const K = window.GameKnowledge;
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function needLabels(){return state.selected==='plant'?['水分','洁净度','阳光','养分']:['饱腹感','洁净度','好心情','精力值'];}
function paidCare(id){return state.selected==='plant'?id==='energy'||id==='clean':id==='food'||id==='clean';}
function gainHint(item){
  const parts=(item.gain||[]).map((g,i)=>g>0?`${needLabels()[i]} +${g}`:'').filter(Boolean);
  return parts.length?`一次 ${parts.join(' · ')}`:'';
}
const saveKey = 'slow-growing-v2';
const pageNames = {home:'我的小屋',growth:'成长足迹',diary:'养育日记',knowledge:'养育课堂',supplies:'生活小铺',pack:'我的背包',settings:'偏好设置'};
let state;
let storageFailed = false;
let loadFailed = false;
let lastStageIndex = null;
let lastCritical = false;
let page = 'home';
let selectedType = 'cat';
let careId = null;
let careProduct = null;
let careQuantity = 1;
let careMaxQ = 10;
let running = false;
let lastTick = 0;
let lastSaved = 0;
let shopFilter = 'all';
let toastTimer;
let lastReminder = 0;
let reminderEnabled = true;
let responseUntil = 0;
let liveMoment = null;
let momentQuietUntil = 0;
let knowledgeOpen = new Set();
let knowledgeRead = [];
let tipCursor = {};
let careSessionTip = null;
try{const rawRead=JSON.parse(localStorage.getItem('slow-growing-knowledge')||'[]');if(Array.isArray(rawRead))knowledgeRead=rawRead.filter(n=>typeof n==='string');}catch{}
try {
  state = G.load(localStorage.getItem(saveKey), localStorage.getItem('slow-growing-v1'), Date.now());
  reminderEnabled = localStorage.getItem('slow-growing-reminders') !== 'off';
} catch {
  state = G.create(Date.now());
  loadFailed = true;
}
lastStageIndex = state.adopted ? G.stage(state).index : null;
A.loadPref();
let backgroundCare={food:false,clean:false,mood:false,energy:false};
try{const rawBg=JSON.parse(localStorage.getItem('slow-growing-background')||'{}');['food','clean','mood','energy'].forEach(id=>{if(typeof rawBg[id]==='boolean')backgroundCare[id]=rawBg[id];});}catch{}
let nannyOn=false;
try{nannyOn=localStorage.getItem('slow-growing-nanny')==='1';}catch{}
let night={enabled:true,start:22,end:6};
try{
  const rawNight=JSON.parse(localStorage.getItem('slow-growing-night')||'null');
  if(rawNight&&typeof rawNight.enabled==='boolean'&&Number.isInteger(rawNight.start)&&Number.isInteger(rawNight.end)&&rawNight.start>=0&&rawNight.start<=23&&rawNight.end>=0&&rawNight.end<=23)night=rawNight;
}catch{}
G.configureNight(night);
const PACE_IDS=['tight','normal','relaxed'];
let carePace='normal';
try{
  const rawPace=localStorage.getItem('slow-growing-pace');
  if(PACE_IDS.includes(rawPace))carePace=rawPace;
}catch{}
G.configurePace(carePace);
// Preserve a future-dated save when the device clock moves backwards.
const now = () => Math.max(Date.now(), state.updated);
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4500);
}
function save() {
  if (loadFailed) return;
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
    lastSaved = performance.now();
  } catch {
    if (!storageFailed) toast('存储空间暂时不可用，请在设置中导出存档保存进度。');
    storageFailed = true;
  }
}
function execute(fn, success) {
  try {
    const result = fn();
    if (typeof result === 'string') { toast(result); return false; }
    save();
    render();
    if (success) toast(success);
    return true;
  } catch {
    pause();
    toast('这次操作暂时无法完成，请导出存档并刷新页面。');
    return false;
  }
}
function duration(seconds) {
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分钟${seconds % 60 ? ` ${seconds % 60} 秒` : ''}`;
}
function timeUntil(at) {
  const minutes = Math.max(0, Math.ceil((at - now()) / 60000));
  return minutes === 0 ? '现在可以照护' : minutes < 60 ? `${minutes} 分钟后` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后`;
}
function profile() { return G.profiles[state.selected || 'cat']; }
function petName() { return state.name || profile().name; }
function dayPart(at) {
  const h = (at instanceof Date ? at : new Date()).getHours();
  if (h >= 6 && h <= 10) return 'dawn';
  if (h >= 11 && h <= 13) return 'noon';
  if (h >= 14 && h <= 17) return 'afternoon';
  if (h >= 18 && h <= 21) return 'dusk';
  return 'night';
}
const DAY_TEXTURE = {
  dawn: { greet: '新的一天，先看看它', weather: '清晨的微光 · 18°C', icon: 'sun', speech: '清晨见你，心里就安稳了。' },
  noon: { greet: '午后的小屋，也要好好陪伴', weather: '阳光正好 · 24°C', icon: 'sun', speech: '午后的阳光里，有你真好。' },
  afternoon: { greet: '阳光正好，慢慢待一会儿', weather: '温暖的午后 · 24°C', icon: 'sun', speech: '看见你，今天又变好了。' },
  dusk: { greet: '傍晚回来了，它在等你', weather: '暮色渐沉 · 20°C', icon: 'moon', speech: '你回来了，这一天就完整了。' },
  night: { greet: '夜深了，轻轻陪一会儿', weather: '夜里的小屋 · 16°C', icon: 'moon', speech: '夜里有你在，就能安心睡。' }
};
function emotion() {
  const level = state.bond >= 65 ? 2 : state.bond >= 30 ? 1 : 0;
  const text = {
    cat:['它轻轻闻着你的手，开始记住你的气味。','熟悉的呼噜声响起，它把小脑袋靠在你手心。','你一回来，它就蹭着你的腿，在你身边安心踩奶。'],
    dog:['它歪着头看你，尾巴试探着摇了摇。','它把下巴放在你膝盖上，想再陪你一会儿。','听见你的脚步声，它跑来迎接，把身体紧紧靠着你。'],
    plant:['嫩芽朝着你的方向轻轻晃动。','叶片舒展开来，露珠在叶尖闪着光。','花苞轻轻点了点头，把今天的开心都记下来了。'],
    baby:['小小的手指握住了你，世界忽然安静下来。','认出你的声音，宝宝露出了一个安心的笑容。',G.stage(state).index >= 3 ? `${escapeHtml(petName())}张开双臂扑向你，给了你一个大大的拥抱。` : '宝宝望着你笑，把小脸贴在你的肩膀上。']
  };
  return text[state.selected || 'cat'][level];
}
function renderAdoption() {
  $('adopt-name').placeholder = `给它起个名字，留空就沿用「${G.profiles[selectedType].name}」`;
  $('adopt-options').innerHTML = Object.entries(G.profiles).map(([type,p]) => `<button class="adopt-option ${selectedType === type ? 'selected' : ''}" data-adopt="${type}" aria-pressed="${selectedType === type}"><span class="adopt-portrait">${portrait(type)}</span><strong>${p.kind} · ${p.name}</strong><small>${p.rhythm}</small><span class="selection-mark">${icon(selectedType === type ? 'check' : 'heart')}</span></button>`).join('');
  const extra = selectedType === 'plant' ? '小植物是安静养成，不会弹出短时小事件。' : '陪伴中偶尔会出现 10 秒内可完成的短时小事件。';
  $('adopt-summary').textContent = state.selected === selectedType ? `继续与${profile().name}的故事，保留已有成长与照护进度。` : `${G.profiles[selectedType].description} ${extra}`;
}
function memorial() {
  const name = escapeHtml(petName());
  const days = Math.max(1, Math.floor((state.leftAt - state.born) / 86400000) + 1);
  const finalStage = G.milestones(state)[state.stageIndex].title;
  const leftAt = new Date(state.leftAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const farewell = [...state.logs].reverse().find(l => l.at === state.leftAt) || state.logs.at(-1);
  const recent = [...state.logs].filter(l => l !== farewell && !/^确认陪伴/.test(l.text)).slice(-3).reverse();
  const titles = {
    baby: `${name}被接到了远方`,
    cat: `${name}出门远行了`,
    dog: `${name}跑向了远方`,
    plant: `这一季，${name}开过了`
  };
  const blessings = {
    baby: '愿远方的日子里，一直记得被你抱在怀里的温度。',
    cat: '愿旅途总有阳光和屋檐，累了的时候，还记得小屋的方向。',
    dog: '愿原野永远开阔。跑累了回头看，爱它的心一直都在。',
    plant: '最美的一季已经开过。来年春风里，会有温柔的重逢。'
  };
  const customTitle = titles[state.selected] || `再见了，${name}`;
  const logs = recent.map(l => `<p>${escapeHtml(l.text)}</p>`).join('');
  return `<div class="memorial"><span class="eyebrow">UNTIL WE MEET AGAIN</span><h2>${customTitle}</h2><ul class="memorial-facts"><li>相伴 ${days} 天</li><li>${escapeHtml(finalStage)}</li><li>亲密度 ${Math.round(state.bond)}</li><li>${leftAt}</li></ul><p class="memorial-bless">${blessings[state.selected] || ''}</p>${farewell ? `<p class="memorial-farewell">${escapeHtml(farewell.text)}</p>` : ''}${logs ? `<div class="memorial-logs">${logs}</div>` : ''}<button class="primary" id="restart-button">开始新的陪伴</button><small>谢谢你陪它走过这一程。新的朋友也正在等待一个温柔的家。</small></div>`;
}
function showStageUp(st) {
  if(window.Stats){window.Stats.event('stageUps');window.Stats.bump('stage_'+st.index,1);}
  const name = petName();
  const lines = {
    cat: `${name}长大了一点，尾巴翘得更高，也更爱黏着你了。`,
    dog: `${name}又长大了一些，跑起来更稳，眼里都是信任。`,
    baby: `${name}又长大了一点，会的事更多了，也更依赖你了。`,
    plant: `${name}抽出新的枝叶，这一季正长得很好。`
  };
  const el = $('stage-up');
  el.innerHTML = `<div class="stage-up-card"><span class="stage-up-eyebrow">A LITTLE BIGGER TODAY</span><h2>${escapeHtml(name)}进入新的阶段</h2><span class="stage-up-badge">${icon('sprout')}${escapeHtml(st.name)}</span><p class="stage-up-bless">${escapeHtml(lines[state.selected] || '')}</p><button class="primary" type="button" id="stage-up-close">继续陪着它</button></div>`;
  el.hidden = false;
}
function render() {
  if (!state.adopted) return;
  G.refresh(state, now());
  const p = profile(), st = G.stage(state), actions = G.careOptions(state), tier = G.healthTier(state);
  const gone = tier === 'left';
  const nowCritical = state.criticalAt !== null;
  if(nowCritical && !lastCritical && window.Stats)window.Stats.event('criticals');
  lastCritical = nowCritical;
  $('welcome-back').hidden = !state.task || gone;
  if (state.task && !gone) $('welcome-back').innerHTML = `${icon('clock')} 上一次的${escapeHtml(state.task.name)}还在等你，进度已经保存。<button data-care="${state.task.actionId}">继续陪伴</button>`;
  $('companion-chip').innerHTML = portrait(state.selected) + `<strong>${p.kind} · ${escapeHtml(petName())}</strong><span>${gone ? (state.selected === 'plant' ? '这一季已结束' : '已经离开') : st.name}</span>`;
  $('wallet-points').innerHTML = icon('leaf') + `<b>${state.points}</b> 积分`;
  const nannyChip=$('nanny-chip');
  if(nannyChip){
    nannyChip.hidden=!(nannyOn&&state.adopted&&state.status==='alive');
    if(!nannyChip.hidden) nannyChip.textContent=`管家托管中 · ${G.NANNY_RATE} 积分/小时 · 点击停止`;
  }
  const checked = state.checkin.date === state.daily.date;
  $('checkin-button').disabled = checked || gone;
  $('checkin-button').textContent = gone ? '这段故事已经结束' : checked ? `已签到 · ${state.checkin.streak} 天` : '签到领积分';
  $('checkin-button').hidden = gone;
  $('room-name').textContent = gone ? (state.selected === 'plant' ? petName() + '的这一季' : petName() + '的留念') : petName() + '的小窝';
  $('pet-name').textContent = petName();
  $('pet-age').textContent = gone
    ? `曾相伴 ${Math.max(1, Math.floor((state.leftAt - state.born) / 86400000) + 1)} 天`
    : `${st.label} · 相伴第 ${Math.floor((now()-state.born)/86400000)+1} 天`;
  $('stage-badge').textContent = gone ? (state.selected === 'plant' ? '这一季' : '已告别') : st.name;
  $('stage-text').textContent = gone ? '故事已经写下' : st.next ? `下一站：${st.next.name}` : '成长的每一步，都有你';
  $('growth-percent').textContent = `${state.xp} 成长经验`;
  $('growth-bar').style.width = `${st.progress}%`;
  $('status-tip').textContent = gone
    ? (state.selected === 'plant' ? '这一季已经结束。小屋里留下了你们的日子。' : '它已经离开小屋。这段日子被好好地记下了。')
    : state.selected === 'plant'
    ? `每 ${st.feedHours} 小时关注浇水 · 每次 ${duration(st.feedSeconds)}`
    : `每 ${st.feedHours} 小时关注进食 · 每次 ${duration(st.feedSeconds)}`;
  $('health-value').textContent = `${Math.round(state.health)} / 100`;
  const fill = $('health-fill');
  fill.style.width = `${state.health}%`;
  fill.dataset.tier = tier === 'left' ? 'critical' : tier;
  if (tier === 'critical') {
    const windowed = state.criticalAt !== null;
    const hours = windowed ? Math.max(1, Math.ceil(G.criticalRemaining(state, now()))) : 0;
    const elixirOwned = (state.inventory['revive-elixir'] || 0) > 0;
    // Health already at zero: a +40 kit cannot revive, so only the elixir counts.
    const kitUsable = !windowed && (state.inventory['medicine-kit'] || 0) > 0;
    const hint = elixirOwned ? '回春灵药就在小屋里，现在就用。'
      : kitUsable ? '安心药箱就在小屋里，现在就用。'
      : '健康度见底时只有回春灵药（+60）能挽回，快去小铺兑换。';
    const reason = windowed ? `健康度已经耗尽，约 ${hours} 小时后会悄悄离开。${hint}` : `健康度已经很低，再不照顾就有离开的风险。${hint}`;
    const reviveLabel = elixirOwned ? '使用回春灵药（+60）' : kitUsable ? '使用安心药箱（+40）' : '购买并使用回春灵药（60 积分）';
    const vig = G.vigilStatus(state);
    const vigilBtn = vig.available ? `<button class="secondary" type="button" id="vigil-button">守夜求援（约 ${Math.round(vig.seconds/60)} 分钟）</button>` : '';
    $('critical-banner').hidden = false;
    $('critical-banner').innerHTML = `<div class="critical-copy"><strong>${escapeHtml(petName())}病危了</strong><p>${reason}</p></div><div class="critical-actions"><button class="primary" id="revive-button">${reviveLabel}</button>${vigilBtn}</div>`;
  } else $('critical-banner').hidden = true;
  const part = dayPart();
  const texture = DAY_TEXTURE[part];
  const greetCopy = $('greeting-copy');
  if (gone) {
    $('greeting-title').innerHTML = (state.selected === 'plant' ? '这一季已经开过了' : '这段陪伴，轻轻放下') + `<span class="tiny-leaf">${icon('leaf')}</span>`;
    if (greetCopy) greetCopy.textContent = '留下一段被认真对待过的日子，再把温柔带给下一位朋友。';
  } else {
    $('greeting-title').innerHTML = texture.greet + `<span class="tiny-leaf">${icon('leaf')}</span>`;
    if (greetCopy) greetCopy.textContent = '它的世界很小，小到只有你。今天也请多一点耐心。';
  }
  $('room-weather').innerHTML = icon(texture.icon) + texture.weather;
  const roomCard = $('room-card');
  if (roomCard) roomCard.classList.toggle('gone', gone);
  const statusCard = document.querySelector('.status-card');
  if (statusCard) {
    statusCard.classList.toggle('gone', gone);
    statusCard.hidden = gone;
  }
  const homeGrid = document.querySelector('.home-grid');
  if (homeGrid) homeGrid.classList.toggle('gone', gone);
  const careSection = $('care-section');
  if (careSection) careSection.hidden = gone;
  const bottomGrid = $('bottom-grid');
  if (bottomGrid) bottomGrid.hidden = gone;
  $('bond-card').hidden = gone;
  $('needs').hidden = gone;
  const worn = state.worn && typeof state.worn === 'object' ? state.worn : { wear: null, place: null };
  const tints = state.tints || {};
  const sceneKey = tier === 'left' ? 'left:' + state.leftAt
    : state.selected + ':' + st.index + ':' + (worn.wear || '') + ':' + (tints[worn.wear] || 0) + ':' + (worn.place || '') + ':' + (tints[worn.place] || 0) + ':' + tier;
  if ($('room-art').dataset.sceneKey !== sceneKey) {
    $('room-art').dataset.sceneKey = sceneKey;
    $('room-art').innerHTML = gone ? memorial() : scene(state.selected, st.index, state.worn, tier, tints);
  }
  $('room-art').dataset.day = part;
  if (!$('stage-up').hidden && (gone || !state.adopted)) $('stage-up').hidden = true;
  if (state.adopted && !gone) {
    if (lastStageIndex === null) lastStageIndex = st.index;
    else if (st.index > lastStageIndex) { lastStageIndex = st.index; showStageUp(st); }
  }
  const labels = actions.map(a => a.need);
  $('needs').innerHTML = state.needs.map((value,i) => `<div class="need ${actions[i].id}"><div class="need-top">${icon(actions[i].icon)}<span>${labels[i]}</span><span class="need-value">${Math.round(value)} / 100</span></div><div class="progress" role="progressbar" aria-label="${labels[i]}" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%"></span></div></div>`).join('');
  const low = state.needs.indexOf(Math.min(...state.needs));
  const uneasy = tier === 'sick' || tier === 'critical';
  $('speech').hidden = gone;
  const lowTalk = state.selected === 'plant'
    ? ['叶子有点渴了……','叶面该擦一擦了……','想晒晒太阳……','土里的养分不够了……']
    : ['肚子有点饿，你来啦？','想要干干净净的……','今天可以多陪陪我吗？','困了，陪我休息一会儿吧。'];
  const lowMood = state.selected === 'plant'
    ? ['到了浇水的时间','叶子该擦一擦','想晒晒太阳','该施肥了']
    : ['到了进食的时间','需要清洁一下','想要你的陪伴','需要安静休息'];
  if (Date.now() > responseUntil) $('speech').textContent = gone ? '' : uneasy ? ['身体软软的，没有力气玩……','有点不舒服，想要你多陪陪我……','会乖乖的，很快就会好起来。'][Math.floor(state.health) % 3] : state.needs[low] < 40 ? lowTalk[low] : texture.speech;
  $('speech').hidden = gone || !$('speech').textContent;
  $('pet-mood').textContent = gone ? (state.selected === 'plant' ? '这一季已经结束' : '已经离开小屋') : state.task ? `等你继续${state.task.name}` : uneasy ? '需要你的照顾' : state.needs[low] < 40 ? lowMood[low] : '安心地享受你的陪伴';
  $('pet-touch').innerHTML = icon('hand') + (state.selected === 'baby' ? '抱抱宝宝' : state.selected === 'plant' ? '碰碰叶子' : '摸摸它');
  $('pet-touch').style.pointerEvents = (liveMoment && !liveMoment.done) || Date.now() < momentQuietUntil ? 'none' : '';
  $('pet-touch').hidden = gone;
  const roomBottom = document.querySelector('.room-bottom');
  if (roomBottom) roomBottom.hidden = gone;
  $('bond-card').innerHTML = `<span class="bond-icon">${icon('heart')}</span><div><strong>${['开始熟悉你','已经很依赖你','你是最安心的存在'][state.bond>=65?2:state.bond>=30?1:0]}</strong><p>${emotion()}</p></div><div class="bond-score"><b>${Math.round(state.bond)}</b> / 100<small>亲密度</small></div>`;
  renderToolbox();
  const asleep = !gone && G.isAsleep(state);
  const sleepBanner = $('sleep-banner');
  if (sleepBanner) {
    sleepBanner.hidden = !asleep;
    if (asleep) {
      const stt = G.sleepStatus(state, now());
      const gain = G.isNightMs(now()) ? G.SLEEP_GAIN_NIGHT : G.SLEEP_GAIN_DAY;
      sleepBanner.innerHTML = `<span class="sleep-icon">${icon('moon')}</span><div><strong>${escapeHtml(stt.label)}</strong><p>${escapeHtml(stt.desc)}精力正在慢慢回复（每小时 +${gain}），饿了或尿了会自己醒来。</p></div><button class="sleep-wake" data-wake="1">轻轻叫醒</button>`;
    }
  }
  $('care-cards').innerHTML = actions.map((a,i) => {
    const task = state.task?.actionId === a.id;
    const due = now() >= a.dueAt;
    const satisfied = state.needs[i] >= (i === 0 ? 80 : 95);
    const blockReason = gone ? null : G.careBlock(state, a.id);
    const blocked = !task && !!blockReason;
    const unavailable = !task && (!!blockReason || !!state.task || !due || satisfied || state.status === 'left');
    const supplies = G.products(state,a.id);
    const stock = supplies.reduce((sum,p) => sum+(state.inventory[p.id] || 0),0);
    const status = gone ? (state.selected === 'plant' ? '这一季已经结束' : '已经离开小屋') : task ? '进度已保留' : blocked ? blockReason : satisfied ? '状态很好，稍后再来' : timeUntil(a.dueAt);
    const stockLine = supplies.length ? `适龄物资 ${stock} 份` : '用陪伴回应需要';
    const asleepNow = !gone && G.isAsleep(state);
    const label = task ? '继续照护' : state.criticalAt !== null ? '病危中，先用药' : asleepNow ? '它在睡觉' : blocked ? '先照顾身体' : satisfied ? '安心休息' : !due ? '稍后再来' : a.name;
    return `<article class="care-card ${blocked?'blocked ':''}${!unavailable && state.needs[i]<50?'urgent':''}"><div class="care-card-top"><span class="care-icon">${icon(a.icon)}</span><span class="duration">${icon('clock')}${duration(a.seconds)}</span></div><h3>${a.name}</h3><p class="care-frequency">每 ${a.intervalHours} 小时关注一次</p><div class="care-stock">${stockLine}</div><small class="care-due">${status}</small><button class="care-action" data-care="${a.id}" ${unavailable?'disabled':''}>${label}${icon('arrow')}</button></article>`;
  }).join('');
  $('total-minutes').innerHTML = `${Math.floor(state.daily.seconds/60)} <small>分钟</small>`;
  $('total-care').innerHTML = `${state.daily.count} <small>次</small>`;
  $('total-days').innerHTML = `${Math.floor((now()-state.born)/86400000)+1} <small>天</small>`;
  renderTasks();
  if (page !== 'home') renderSecondary();
  updateTabCue();
}
function renderTasks() {
  const el = $('task-card');
  if (!el) return;
  if (!state.adopted || state.status === 'left') { el.hidden = true; return; }
  const tasks = G.dailyTasks(state);
  const done = tasks.filter(t => t.done).length;
  el.hidden = false;
  el.innerHTML = `<div class="section-heading"><h2>今日小任务 <span>陪它做点小事，攒点积分</span></h2><span class="task-progress">${done} / ${tasks.length}</span></div><div class="task-list">${tasks.map(t => `<div class="task-row ${t.done ? 'done' : ''}">${icon(t.done ? 'check' : 'clock')}<span class="task-label">${escapeHtml(t.label)}</span><b class="task-reward">+${t.reward}</b></div>`).join('')}</div>`;
}
// Feed the live urgency to the dynamic favicon: colour by need level, a count
// badge for pending care, and a title hint shown while the tab is unwatched.
function tabCueInfo() {
  if (!state.adopted || state.status === 'left') return { level: 'ok', count: 0, hint: '它在等你' };
  const name = petName();
  const options = G.careOptions(state);
  let due = 0;
  for (let i = 0; i < options.length; i += 1) {
    const a = options[i];
    if (state.needs[i] >= (i === 0 ? 80 : 95)) continue;
    if (now() < a.dueAt) continue;
    if (G.careBlock(state, a.id)) continue;
    due += 1;
  }
  const momentWaiting = !!(liveMoment && !liveMoment.done);
  let level = 'ok', hint = '它在等你';
  if (state.criticalAt !== null) { level = 'critical'; hint = `${name}病危了`; }
  else if (G.healthTier(state) === 'critical') { level = 'critical'; hint = `${name}很虚弱`; }
  else if (momentWaiting) { level = 'need'; hint = `${name}在等你回应`; }
  else if (due > 0) { level = 'need'; hint = `该照顾${name}了`; }
  return { level, count: due + (momentWaiting ? 1 : 0), hint };
}
function updateTabCue() {
  if (window.TabCue) window.TabCue.set(tabCueInfo());
}
function renderToolbox() {
  const el = $('toolbox-card');
  if (state.status === 'left') { el.hidden = true; return; }
  const meds = G.catalog.filter(item => item.category === 'medical');
  const owned = meds.some(item => (state.inventory[item.id] || 0) > 0);
  const weak = state.health < 70 || state.criticalAt !== null;
  if (!owned && !weak) { el.hidden = true; return; }
  el.hidden = false;
  const rows = meds.map(item => {
    const count = state.inventory[item.id] || 0;
    const kitSpent = item.id === 'medicine-kit' && state.health < 1;
    const ok = !kitSpent && (state.health < 70 || state.criticalAt !== null);
    const iconBox = `<span class="product-icon">${icon(item.icon)}</span>`;
    const note = item.id === 'medicine-kit'
      ? (kitSpent ? '健康度已见底，药箱回天乏力' : '恢复 40 健康度 · 病危时也可使用')
      : '恢复 60 健康度 · 病危时的更强选择';
    const info = `<div class="toolbox-info"><strong>${item.name}</strong><p>${item.description}</p><small>${note}</small></div>`;
    const label = kitSpent ? '改用回春灵药' : ok ? (count > 1 ? `使用 · 共 ${count} 份` : '使用') : '暂不需要';
    const action = count > 0
      ? `<button data-toolbox="${item.id}" ${ok ? '' : 'disabled'}>${label}</button>`
      : `<button data-page="supplies" data-shop-filter="medical">${item.price} 积分 · 去小铺兑换</button>`;
    return `<div class="toolbox-item">${iconBox}${info}${action}</div>`;
  }).join('');
  el.innerHTML = `<div class="section-heading"><h2>健康工具箱 <span>小铺买到的医疗用品，在这里直接使用</span></h2></div><div class="toolbox-grid">${rows}</div>`;
}
function renderSecondary() {
  const p=profile(),st=G.stage(state),el=$('secondary-page');
  if(page==='growth') {
    const feedId=state.selected==='plant'?'energy':'food';
    const feedNames=G.products(state,feedId).map(p=>p.name).join('、')||'清水浇灌，无需消耗品';
    const feedTitle=state.selected==='plant'?'施什么肥':'吃什么';
    const rhythm=state.selected==='plant'
      ?`浇水每 ${st.feedHours} 小时关注一次；清洁每 ${st.cleanHours} 小时关注一次。`
      :`进食每 ${st.feedHours} 小时关注一次；清洁每 ${st.cleanHours} 小时关注一次。`;
    const times=state.selected==='plant'
      ?`浇水 ${duration(st.feedSeconds)}；晒太阳 1 分钟；施肥 2 分钟。`
      :`进食 ${duration(st.feedSeconds)}；玩耍 1 分钟；安抚休息 2 分钟。`;
    const fmt=d=>d?new Date(d).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'}):null;
    const keepsake=G.milestones(state).map(m=>{
      const i=Number(m.id.slice(6));
      const hit=i===0?null:state.logs.find(l=>l.text.includes('进入'+m.title));
      const when=i===0?state.born:(hit?hit.at:null);
      return `<article class="milestone keepsake ${m.unlocked?'current':'locked'}"><img class="stage-thumb" src="assets/stages/${state.selected}-${i+1}.png" alt="${m.title}立绘">${icon(m.unlocked?'sprout':'clock')}<h3>${m.title}</h3>${m.unlocked?`<small>${i===0?'相遇于':'到达于'} ${when?fmt(when):'很久以前'}</small>`:`<small>尚未到达</small>`}</article>`;
    }).join('');
    const emo=[30,65].map((n,i)=>{const kept=(state.emotionalMilestones||[]).includes(n);const hit=kept?state.logs.find(l=>l.text.includes('亲密度首次达到 '+n)):null;return `<article class="milestone ${kept?'current':''}">${icon('heart')}<h3>${i?'你是它的全世界':'开始认出你'}</h3><p>亲密度 ${n} 解锁，首次获得 10 积分。</p><small>${kept?(hit?'珍藏于 '+fmt(hit.at):'已珍藏在你们的故事里'):'每一次照料，都会靠近一点'}</small></article>`;}).join('');
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">LITTLE STEPS, BIG LOVE</div><h2>${escapeHtml(petName())}的成长足迹</h2><p>${st.description}<br>目前 ${st.label}，${state.xp} 点成长经验。${st.next?`下一阶段需要游戏年龄 ${st.next.age} 天与 ${st.next.xp} 经验。`:'成长还在继续，爱会留在每一天。'}${['sick','critical'].includes(G.healthTier(state))?'<br><b>生病的日子成长会慢一些，先照顾好身体。</b>':''}</p><h3>纪念相册</h3><div class="milestones keepsake-grid">${keepsake}</div><h3>双向奔赴的小瞬间</h3><div class="memory-cards">${emo}</div><h3>这个阶段，怎样好好照顾？</h3><div class="stage-guide"><p><b>${feedTitle}</b><br>${feedNames}</p><p><b>多久一次</b><br>${rhythm}</p><p><b>陪伴的时间</b><br>${times}</p></div></div>`;
  } else if(page==='diary') {
    const dayNo=Math.floor((now()-state.born)/86400000)+1;
    const mins=Math.floor(state.daily.seconds/60);
    const visits=state.daily.count;
    const dtier=G.healthTier(state);
    const feel=state.status==='left'?'这段日子已经收进了留念里。':dtier==='critical'?'它现在需要你多一点照顾。':dtier==='sick'?'它有点不舒服，记得多陪陪它。':state.needs.some(v=>v<40)?'有些小需求在等你回应。':'今天也安心地被陪伴着。';
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">OUR ORDINARY, PRECIOUS DAYS</div><h2>${escapeHtml(petName())}的养育日记</h2><p>成长、拥抱和认真照料的时刻，都值得记住。</p><section class="daily-recap"><span class="recap-eyebrow">TODAY'S LITTLE SUMMARY</span><h3>今天的小结</h3><div class="recap-stats"><span><b>${dayNo}</b> 相伴第几天</span><span><b>${mins}</b> 分钟陪伴</span><span><b>${visits}</b> 次照料</span><span><b>${escapeHtml(st.name)}</b> 当前阶段</span></div><p>${escapeHtml(feel)}</p></section>${[...state.logs].reverse().map(l=>`<article class="diary-entry"><time>${new Date(l.at).toLocaleString('zh-CN')}</time><p>${escapeHtml(l.text)}</p></article>`).join('')}</div>`;
  } else if(page==='pack') {
    const feedAct=state.selected==='plant'?'energy':'food';
    const careAct={food:feedAct,nutrition:feedAct,clean:'clean',comfort:'mood'};
    const total=G.catalog.filter(item=>(state.inventory[item.id]||0)>0&&item.types.includes(state.selected)).length;
    const groups=total?[['医疗照护',['medical']],['随身饰物',['accessory']],['照护物资',['food','clean','nutrition','comfort']]].map(([name,cats])=>{
      const items=G.catalog.filter(item=>item.types.includes(state.selected)&&cats.includes(item.category)&&(state.inventory[item.id]||0)>0);
      if(!items.length)return '';
      const rows=items.map(item=>{
        const count=state.inventory[item.id]||0;
        const media=item.category==='accessory'?`<img class="acc-thumb" src="assets/acc/${item.id.slice(4)}.png" alt="${item.name}">`:`<span class="product-icon">${icon(item.icon)}</span>`;
        const equipped=item.category==='accessory'&&G.isEquipped(state,item.id);
        const place=item.category==='accessory'&&G.accessorySlot(item.id)==='place';
        const tag=equipped?(place?'摆放中':'穿戴中'):'';
        const dots=item.category==='accessory'?`<span class="dye-dots" role="group" aria-label="饰物染色">${[0,1,2].map(v=>`<button class="dye-dot${(state.tints[item.id]||0)===v?' active':''}" data-dye="${item.id}" data-variant="${v}" title="染成${['本色','暖调','冷调'][v]}" style="filter:hue-rotate(${[0,30,200][v]}deg)"></button>`).join('')}</span>`:'';
        const medNote=item.id==='medicine-kit'?(state.health<1?'健康度已见底，药箱回天乏力，改用回春灵药':'恢复 40 健康度 · 病危时也可使用'):'恢复 60 健康度 · 病危时的更强选择';
        const info=`<div class="pack-info"><strong>${item.name}${tag?' <span class="worn-tag">'+tag+'</span>':''}</strong><p>${item.description}</p><small>${item.category==='accessory'?(equipped?(place?'摆放中 · 收起后回到背包':'佩戴中 · 脱下后回到背包'):(place?'收在背包 · 可随时放下':'收在背包 · 可随时穿上')):item.category==='medical'?`剩余 ${count} 份 · ${medNote}`:`剩余 ${count} 份 · ${gainHint(item)||'照护时消耗'}`}</small></div>`;
        let action='';
        if(item.category==='medical'){
          const kitSpent=item.id==='medicine-kit'&&state.health<1;
          const ok=!kitSpent&&(state.health<70||!!state.criticalAt);
          const label=kitSpent?'改用回春灵药':ok?(count>1?`使用 · 共 ${count} 份`:'使用'):'暂不需要';
          action=`<button data-toolbox="${item.id}" ${ok?'':'disabled'}>${label}</button>`;
        } else if(item.category==='accessory'){
          const stageOk=st.index>=item.minStage;
          action=equipped?`<button data-wear="${item.id}" class="secondary">${place?'收起 · 收回背包':'脱下 · 收回背包'}</button>`:`<button data-wear="${item.id}" ${stageOk?'':'disabled'}>${stageOk?(place?'放下':'穿上'):'成长后解锁'}</button>`;
        } else {
          action=`<button data-care="${careAct[item.category]}">去照护</button>`;
        }
        return `<div class="pack-item">${media}${info}${action}${dots}</div>`;
      }).join('');
      return `<div class="section-heading"><h2>${name} <span class="heading-count">${items.length} 种</span></h2></div><div class="pack-grid">${rows}</div>`;
    }).join(''):'';
    el.innerHTML=total?`<div class="page-panel"><div class="eyebrow">EVERYTHING IN ITS PLACE</div><div class="section-heading"><h2>我的背包</h2><span class="points-pill">${icon('leaf')} ${state.points} 积分</span></div><p>买回来的东西都收在这里。消耗品在照护与治疗时用掉；饰物可以反复穿戴或摆放，收起后回到背包。</p>${groups}</div>`:`<div class="page-panel"><div class="eyebrow">EVERYTHING IN ITS PLACE</div><div class="section-heading"><h2>我的背包</h2></div><p>背包还空着。去生活小铺看看，给${escapeHtml(petName())}带点什么回来吧。</p><button class="primary" data-page="supplies">去生活小铺</button></div>`;
  } else if(page==='supplies') {
    const available = new Set(['food','clean','mood','energy'].flatMap(id=>G.products(state,id).map(p=>p.id)));
    const categories={all:'全部物资',food:state.selected==='plant'?'花肥养分':'日常饮食',clean:'清洁护理',nutrition:'营养搭配',comfort:'陪伴玩具',accessory:'随身饰物',medical:'医疗照护'};
    el.innerHTML=`<div class="page-panel shop-panel"><div class="eyebrow">A WELL-STOCKED LITTLE HOME</div><div class="section-heading"><h2>生活小铺</h2><span class="points-pill">${icon('leaf')} ${state.points} 积分</span></div><p>适合${escapeHtml(petName())}的小小补给。签到得 11–17 积分，有效照护每次 +5（每日上限 40），成长还有额外奖励。</p><div class="shop-filters">${Object.entries(categories).map(([id,name])=>`<button data-filter="${id}" class="${shopFilter===id?'active':''}" aria-pressed="${shopFilter===id}">${name}</button>`).join('')}</div><div class="shop-grid">${G.catalog.filter(item=>item.types.includes(state.selected)&&(shopFilter==='all'||item.category===shopFilter)).map(item=>{const isAcc=item.category==='accessory';const isMed=item.category==='medical';const owned=(state.inventory[item.id]||0)>0;const stageOk=st.index>=item.minStage;const usable=isMed||available.has(item.id);const media=isAcc?`<img class="acc-thumb" src="assets/acc/${item.id.slice(4)}.png" alt="${item.name}">`:`<span class="product-icon">${icon(item.icon)}</span>`;const hint=gainHint(item);const note=isAcc?`${stageOk?'适合当前阶段':'成长后解锁'}${G.isEquipped(state,item.id)?(G.accessorySlot(item.id)==='place'?' · 摆放中':' · 穿戴中'):''}`:isMed?'随时可兑换，按说明使用':`${item.pack} 份 / 组${hint?' · '+hint:''} · ${usable?'适合当前阶段':item.minStage>st.index?'成长后解锁':'已度过适用阶段'}`;const action=isMed?(owned?`<button data-page="pack" class="secondary">已拥有 ${state.inventory[item.id]} 份 · 去背包使用</button>`:`<button data-buy="${item.id}" ${state.points<item.price?'disabled':''}>${state.points<item.price?'积分不足':`${item.price} 积分 · 兑换`}</button>`):isAcc?(owned?`<button data-page="pack" class="secondary">${G.isEquipped(state,item.id)?'使用中 · 去背包管理':'已拥有 · 去背包'}</button>`:`<button data-buy="${item.id}" ${!stageOk||state.points<item.price?'disabled':''}>${!stageOk?'阶段限定':state.points<item.price?'积分不足':`${item.price} 积分 · 兑换`}</button>`):`<button data-buy="${item.id}" ${!usable||state.points<item.price?'disabled':''}>${!usable?'阶段限定':state.points<item.price?'积分不足':`${item.price} 积分 · 兑换`}</button>`;return `<article class="shop-item ${isAcc?'acc-item':''}">${media}<span class="stock-tag">库存 ${state.inventory[item.id]||0}</span><h3>${item.name}</h3><p>${item.description}</p><small>${note}</small>${action}</article>`;}).join('')}</div><div class="relief-box"><div><strong>总有一份温柔的支持</strong><p>适龄主食或清洁用品耗尽时，每日可领取一次基础补给，各补 2 份。</p></div><button class="secondary" id="relief-button">领取基础补给</button></div></div>`;
  } else if(page==='knowledge') {
    const role=state.selected;
    const list=K.topics[role]||[];
    const readCount=list.filter(t=>knowledgeRead.includes(t.id)).length;
    const catNames=state.selected==='plant'?{food:'浇水养护',clean:'清洁护理',mood:'光照陪伴',energy:'施肥与观察'}:K.categories;
    const groups=Object.entries(catNames).map(([cat,name])=>{
      const items=list.filter(t=>t.cat===cat);
      if(!items.length)return '';
      return `<h3 class="knowledge-group">${name}</h3>${items.map(t=>{
        const read=knowledgeRead.includes(t.id);
        const open=knowledgeOpen.has(t.id);
        return `<article class="knowledge-card ${open?'open':''} ${read?'read':''}" data-ktoggle="${t.id}"><header><span class="knowledge-cat">${name}</span><h3>${t.title}</h3><span class="read-mark">${read?icon('check'):'展开阅读'}</span></header>${open?`<p class="knowledge-body">${t.body}</p>`:''}</article>`;
      }).join('')}`;
    }).join('');
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">LEARN WHILE YOU CARE</div><div class="section-heading"><h2>养育课堂</h2><span class="points-pill">${icon('bulb')} 已了解 ${readCount} / ${list.length} 篇</span></div><p>游戏里的每一次照料，都有真实世界的对应。这里收集了${escapeHtml(petName())}（${profile().kind}）相关的通用养护知识，点击卡片展开阅读。</p>${groups}<p class="knowledge-disclaimer">以上内容为游戏化科普摘要，具体的养育决策请咨询儿科医生、兽医或园艺专业人士。</p></div>`;
  } else {
    const bgCount=['food','clean','mood','energy'].filter(id=>backgroundCare[id]).length;
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>偏好与存档</h2><label class="setting-row"><span>应用内照护提醒<small>页面打开时提醒低需求；系统后台推送尚未接入。</small></span><input type="checkbox" id="reminders" ${reminderEnabled?'checked':''}></label><label class="setting-row"><span>背景音乐<small>照护进行时播放实时合成的音景，全部由浏览器本地生成，无外部音频文件。若手机处于静音模式（iOS 侧边拨片），请先取消静音。</small></span><input type="checkbox" id="bgm-enabled" ${A.pref.enabled?'checked':''}></label><label class="setting-row"><span>音景风格<small>白噪音、雨声、海浪、八音盒轻音乐、森林晨间，照护中切换即刻生效。</small></span><select id="bgm-style">${A.stylesHtml(A.pref.style)}</select></label><label class="setting-row"><span>音乐音量<small>当前 ${Math.round(A.pref.volume*100)}%，只影响背景音景。</small></span><input type="range" id="bgm-volume" min="0" max="100" value="${Math.round(A.pref.volume*100)}" style="--fill:${Math.round(A.pref.volume*100)}%"></label><label class="setting-row"><span>贴心管家<small>到点或需求过低时自动照料，按小时扣除积分（约 10 分/小时），且托管照护不产生照护积分；库存不足时按双倍积分自动补货，病危时仍需你亲手用药。</small></span><input type="checkbox" id="nanny-enabled" ${nannyOn?'checked':''}></label><div class="setting-row"><span>后台照护<small>勾选后，对应照护在切到其他标签页、应用或锁屏时按真实时间继续；关闭照护弹窗或整个页面仍会暂停并保留进度。</small></span><div class="bg-grid">${(state.selected==='plant'?[['food','浇水'],['clean','擦叶'],['mood','晒太阳'],['energy','施肥']]:[['food','喂养'],['clean','清洁'],['mood','陪伴'],['energy','休息']]).map(([id,name])=>`<label class="bg-check"><input type="checkbox" data-bg="${id}" ${backgroundCare[id]?'checked':''}>${name}</label>`).join('')}</div></div><label class="setting-row"><span>养育节奏<small>调整两次照护之间的关注间隔，需求下降速度一并缩放。单次照护时长不变。默认正常。</small></span><select id="care-pace">${[['tight','紧致 · 稍密'],['normal','正常'],['relaxed','宽松 · 稍疏']].map(([id,name])=>`<option value="${id}" ${id===carePace?'selected':''}>${name}</option>`).join('')}</select></label><div class="setting-row"><span>夜间节奏<small>就寝时段内需求与健康度的下降速度减半，照护与成长计时照常。默认 22 点到次日 6 点。</small></span><div class="night-window"><input type="checkbox" id="night-enabled" ${night.enabled?'checked':''}><select id="night-start" ${night.enabled?'':'disabled'}>${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===night.start?'selected':''}>${h} 点</option>`).join('')}</select><b>至</b><select id="night-end" ${night.enabled?'':'disabled'}>${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===night.end?'selected':''}>${h} 点</option>`).join('')}</select></div></div><div class="setting-row"><span>专心陪伴模式<small>前台照护保持页面可见计时；已允许后台的操作在切后台后继续累计。</small></span><span class="stage-badge">${bgCount?`后台 ${bgCount} 项`:'仅前台'}</span></div><div class="setting-row"><span>成长时间<small>现实 1 天 = 游戏 30 天，升级同时需要有效照护经验。</small></span></div><div class="setting-row"><span>导出存档<small>进度保存在此浏览器，可导出文件备份。</small></span><button class="primary" id="export-save">导出</button></div><label class="setting-row"><span>恢复存档<small>恢复前自动下载当前进度备份；支持本版本的 JSON 存档。</small></span><input id="import-save" type="file" accept=".json,application/json"></label><p>养育节奏、饮食与情绪数值采用游戏化简化。真实宝宝的喂养方式、辅食时机与营养补充，请与儿科专业人员讨论；宠物饮食请咨询兽医。小铺商品均为虚拟物资，使用游戏积分兑换。</p></div>`;
  }
}
function navigate(next) {
  if(!state.adopted || !pageNames[next])return;
  pause();
  page=next;
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('page-label').textContent=pageNames[page];
  $('home-page').hidden=page!=='home';
  $('secondary-page').hidden=page==='home';
  render();
}
function clearMomentCard() {
  liveMoment=null;
  const card=$('moment-card');
  card.hidden=true;
  card.innerHTML='';
  delete card.dataset.momentId;
  delete $('room-art').dataset.habit;
  updateTabCue();
}
function hideMoment() {
  clearMomentCard();
}
function deferMoment() {
  if(!liveMoment||liveMoment.done)return;
  try {
    G.resolveMoment(state,now(),'defer',Math.random());
    clearMomentCard();
    save();
  } catch {
    clearMomentCard();
  }
}
function renderMoment() {
  if(!liveMoment||liveMoment.done)return;
  const remain=Math.max(0,Math.ceil((liveMoment.until-now())/1000));
  const card=$('moment-card');
  if(liveMoment.habit) $('room-art').dataset.habit = liveMoment.habit;
  if(card.hidden||card.dataset.momentId!==liveMoment.id){
    card.hidden=false;
    card.dataset.momentId=liveMoment.id;
    card.innerHTML=`<p>${escapeHtml(liveMoment.prompt)}</p><button type="button" id="moment-hit">${escapeHtml(liveMoment.action)}</button><small id="moment-remain">还剩 ${remain} 秒</small>`;
  } else {
    const el=$('moment-remain');
    if(el)el.textContent=`还剩 ${remain} 秒`;
  }
  updateTabCue();
}
function finishMoment(outcome, notice) {
  if(!liveMoment||liveMoment.done)return;
  liveMoment.done=true;
  momentQuietUntil=Date.now()+2000;
  try {
    G.resolveMoment(state,now(),outcome,Math.random());
    if(outcome==='hit')G.completeDailyTask(state,'moment',now());
    clearMomentCard();
    save();
    render();
    toast(notice);
  } catch {
    clearMomentCard();
    toast('这次小心思暂时无法记录。');
  }
}
function pulseMoment() {
  if(Date.now()<momentQuietUntil)return;
  if(!state.adopted||state.status!=='alive'||state.selected==='plant'){if(liveMoment&&!liveMoment.done)clearMomentCard();return;}
  if(document.hidden||$('care-dialog').open){deferMoment();return;}
  if(liveMoment){
    if(liveMoment.done)return;
    if(now()>=liveMoment.until)finishMoment('miss','小心思过去了。亲密度 -1。');
    else renderMoment();
    return;
  }
  if(state.health<20)return;
  if(state.momentDueAt!==null&&now()<state.momentDueAt)return;
  const started=G.startMoment(state,now(),Math.random());
  if(!started)return;
  liveMoment=started;
  save();
  renderMoment();
}
function showCare(id) {
  if(state.status==='left'){toast(G.petName(state)+(state.selected==='plant'?'的这一季已经结束，开始新的陪伴吧':'已经离开，开始新的陪伴吧'));return;}
  if(state.task && state.task.actionId!==id){toast('先完成已经开始的照护，再做下一件小事。');return;}
  // 病危 / 过于虚弱时，照护本身无法开始，直接提示，不再弹出照护界面。
  if(!state.task){const block=G.careBlock(state,id);if(block){toast(block);return;}}
  deferMoment();
  careId=id;
  const option=G.careOptions(state).find(a=>a.id===id);
  $('care-title').textContent=`${option.name} · ${profile().name}`;
  $('care-description').textContent=(state.selected==='plant'
    ?{food:'准备好室温清水，浇透盆土就够了，花肥留给施肥。',clean:'轻轻擦叶、检查虫害，让叶面重新透气。',mood:'搬到光线合适的地方，陪它晒一会儿太阳。',energy:'选一份适龄花肥，薄肥勤施，养分会慢慢回来。'}
    :{food:'准备一份适龄食物，坐下来，陪着慢慢吃。',clean:'整理、清洁、更换，每一步都让生活舒服一点。',mood:'一段专心的时间，是今天最好的小礼物。',energy:'把周围的声音放轻，陪着慢慢安静下来。'})[id];
  $('dialog-icon').innerHTML=icon(option.icon);
  $('care-mode-hint').textContent=backgroundCare[id]?`已开启${option.name}的后台照护：切到其他标签页、应用或锁屏也会按真实时间继续；关闭弹窗或页面会暂停并保留进度。`:'点击开始后留在此界面即可。切换标签页或锁屏自动暂停，返回后可继续；已使用的物资与进度会保留。';
  showCareTip(id);
  const products=G.products(state,id);
  if(state.task) {
    const item=G.catalog.find(p=>p.id===state.task.productId);
    $('care-products').innerHTML=`<div class="reserved-item">${icon('check')}${item?item.name+` · 已取用 ${state.task.quantity||1} 份`:'专心陪伴 · 无需物资'}<small>继续照护会沿用本次物资</small></div>`;
  } else {
    if(paidCare(id)&&!products.some(p=>state.inventory[p.id]>0)){
      $('care-products').innerHTML='<div class="empty-stock">适龄物资用完了，先给小屋补充一点吧。<button class="secondary" id="care-shop">去生活小铺</button></div>';
    } else {
      careProduct=products.length?products.find(p=>state.inventory[p.id]>0)?.id||null:'';
      careQuantity=1;
      renderSupplyPicker();
    }
  }
  updateTimer();
  $('care-dialog').showModal();
}
const needIndex={food:0,clean:1,mood:2,energy:3};
function renderSupplyPicker() {
  const holder=$('care-products');
  const products=G.products(state,careId);
  if(!products.length){holder.innerHTML=careId==='food'&&state.selected==='plant'?'<div class="reserved-item">清水浇灌即可，花肥留给施肥。</div>':'<div class="reserved-item">安心在身边，已经足够。</div>';return;}
  const entries=[];
  if(careId==='mood')entries.push({id:'',name:'徒手互动',icon:'hand',free:true});
  products.forEach(p=>entries.push({id:p.id,name:p.name,icon:p.icon,stock:state.inventory[p.id]||0}));
  const cards=entries.map(e=>{
    const selected=(careProduct||'')===e.id;
    const out=!e.free&&e.stock===0;
    return `<button type="button" class="supply-item ${selected?'selected':''}" ${out?'disabled':''} data-supply="${e.id}"><span class="product-icon">${icon(e.icon)}</span><span class="supply-info"><strong>${e.name}</strong><small>${e.free?'无需消耗物资':out?'已用完':`库存 ${e.stock} 份`}</small></span>${selected?`<span class="supply-mark">${icon('check')}</span>`:''}</button>`;
  }).join('');
  const capHint=careId==='clean'?'换一次就是一次，效果看所选档位。':careId==='food'?'一餐最多两份；营养组合一次一份。':careId==='energy'?'一次施肥最多两份；营养组合一次一份。':'开始时按选定份数消耗对应物资；暂停和继续沿用已取用物资。';
  holder.innerHTML=`<span class="product-label">库存物资</span><div class="supply-grid">${cards}</div>${quantityBlock()}<small class="care-hint">${capHint}</small>`;
}
function quantityBlock() {
  const p=G.catalog.find(item=>item.id===careProduct);
  if(!p)return '';
  const stock=state.inventory[p.id]||0;
  const idx=needIndex[careId];
  const perUnit=p.gain[idx]>0?p.gain[idx]:[45,45,35,40][idx];
  const cap=G.careQuantityCap(careId,careProduct);
  careMaxQ=Math.max(1,Math.min(stock,Math.ceil((100-state.needs[idx])/perUnit),cap));
  if(careQuantity>careMaxQ)careQuantity=careMaxQ;
  if(careMaxQ<2)return '';
  const preview=G.careOptions(state).find(a=>a.id===careId).seconds*careQuantity;
  return `<span class="product-label">使用份数</span><div class="quantity-stepper"><button type="button" id="quantity-minus" aria-label="减少份数" ${careQuantity<=1?'disabled':''}>−</button><strong id="quantity-value">${careQuantity} 份</strong><button type="button" id="quantity-plus" aria-label="增加份数" ${careQuantity>=careMaxQ?'disabled':''}>＋</button><small>预计 ${Math.floor(preview/60)} 分 ${preview%60} 秒 · 最多 ${careMaxQ} 份</small></div>`;
}
let bgmShown=null;
function renderBgmNow() {
  const playing=A.active;
  if(bgmShown===playing&&(!playing||$('bgm-now-style').value===A.pref.style))return;
  bgmShown=playing;
  $('bgm-now').hidden=!playing;
  if(playing) {
    $('bgm-now-name').textContent=(A.styles.find(s=>s.id===A.pref.style)||{name:''}).name;
    $('bgm-now-style').innerHTML=A.stylesHtml(A.pref.style);
  }
}
function updateTimer() {
  renderBgmNow();
  if(!careId)return;
  const task=state.task;
  const quantity=task?task.quantity||1:careQuantity;
  const seconds=task?.seconds||G.careOptions(state).find(a=>a.id===careId).seconds*quantity;
  const remaining=Math.ceil(seconds-(task?.elapsed||0));
  $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const progress=(task?.elapsed||0)/seconds*100;
  $('care-progress').style.width=progress+'%';
  $('care-meter').setAttribute('aria-valuenow',String(Math.round(progress)));
  $('care-toggle').textContent=running?'暂停，休息一下':task?'继续陪伴':'准备好了，开始';
  $('care-toggle').disabled=!task&&paidCare(careId)&&!G.products(state,careId).some(p=>state.inventory[p.id]>0);
  const runningNotes=state.selected==='plant'
    ?['清水慢慢渗进盆土，留在这里陪着就好。','叶面一点点变干净。','阳光正好，这段时间属于你们。','薄肥溶进土里，养分正在发生。']
    :['正在慢慢享用，留在这里陪着就好。','小窝正在一点点变干净。','它很喜欢这段只属于你们的时间。','呼吸渐渐平稳，安心正在发生。'];
  $('timer-note').textContent=running?runningNotes[['food','clean','mood','energy'].indexOf(careId)]:task?'进度已保存，准备好就继续。':'给彼此一段安静的陪伴时间。';
  $('dialog-icon').classList.toggle('care-running',running);
  setGainNote();
}
function yieldK(){return 0.55+0.45*state.health/100;}
function setGainNote() {
  const el=$('care-gain');
  const idx=needIndex[careId];
  const task=state.task;
  const units=task?task.quantity||1:careQuantity;
  const pid=task?task.productId:careProduct;
  if(!pid&&paidCare(careId)){el.hidden=true;el.textContent='';return;}
  const p=pid?G.catalog.find(item=>item.id===pid):null;
  const nominal=p&&pid?p.gain:[0,0,0,0].map((_,j)=>j===idx?[45,45,35,40][idx]:0);
  const k=yieldK();
  const labels=G.careOptions(state).map(a=>a.need);
  const parts=nominal.map((g,j)=>{
    if(g<=0)return '';
    if(task)return `${labels[j]} +${Math.round(g*units*k*100)/100}`;
    const eff=Math.round((Math.max(0,Math.min(100,state.needs[j]+g*units*k)-state.needs[j]))*100)/100;
    if(eff<=0)return '';
    return `${labels[j]} +${Math.round(eff)}${eff<g*units*k-1e-9?'（受当前需求限制）':''}`;
  }).filter(Boolean);
  el.hidden=!parts.length;
  el.textContent=parts.length?`本次预计恢复：${parts.join(' · ')}`:'';
}
function nextTip(actionId) {
  const pool=(K.topics[state.selected]||[]).filter(t=>t.cat===actionId);
  if(!pool.length)return null;
  tipCursor[actionId]=((tipCursor[actionId]??-1)+1)%pool.length;
  return pool[tipCursor[actionId]];
}
function rememberTip(tip) {
  if(!tip||knowledgeRead.includes(tip.id))return;
  knowledgeRead.push(tip.id);
  try{localStorage.setItem('slow-growing-knowledge',JSON.stringify(knowledgeRead));}catch{}
}
function tipHtml(tip, withLink) {
  if(!tip)return '';
  return `<span class="tip-label">${icon('bulb')}养护小知识</span><strong>${tip.title}</strong><p>${tip.body}</p>${withLink?`<button class="quiet-label" id="knowledge-link">去养育课堂看更多${icon('arrow')}</button>`:''}<small class="tip-disclaimer">游戏化科普，具体决策请咨询专业人士。</small>`;
}
function showCareTip(actionId) {
  const el=$('care-tip');
  if(!state.task||!careSessionTip||careSessionTip.cat!==actionId)careSessionTip=nextTip(actionId);
  if(!careSessionTip){el.hidden=true;el.innerHTML='';return;}
  rememberTip(careSessionTip);
  el.innerHTML=tipHtml(careSessionTip,false);
  el.hidden=false;
}
function pause() {
  running=false;
  A.stop();
  updateTimer();
  save();
}
function runNanny() {
  if(!state.adopted || state.status!=='alive') return;
  const eligible = nannyOn && state.criticalAt===null && !state.task;
  if(!eligible){
    // Not babysitting right now (off / critical / manual task running): do not
    // accrue fees for this gap.
    if(nannyOn) G.nannyPause(state, now());
    return;
  }
  const fee=G.nannyCharge(state, now());
  if(window.Stats)window.Stats.bump('nannySeconds',5);
  if(fee.charged>0){ if(window.Stats)window.Stats.bump('pointsSpent',fee.charged); save(); }
  if(fee.insufficient){
    nannyOn=false;
    try{localStorage.setItem('slow-growing-nanny','0');}catch{}
    toast('积分不足以维持贴心管家，托管已停止。签到或亲自照护可以攒积分。');
    render();
    return;
  }
  const r=G.nanny(state,now());
  if(r.cared.length){
    save();
    toast(`贴心管家完成了${r.cared.map(c=>c.name).join('、')}。`);
    render();
  }
}
let vigilRunning=false, vigilEnd=0, vigilDur=150000, vigilId=null;
function fmtClock(ms){const t=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
function openVigil(){
  const st=G.vigilStatus(state);
  if(!st.available){toast(st.reason||'现在不需要守夜');return;}
  vigilDur=st.seconds*1000; vigilRunning=false; vigilEnd=0;
  if(vigilId){clearInterval(vigilId);vigilId=null;}
  $('vigil-icon').innerHTML=icon('moon');
  $('vigil-desc').textContent=`${G.petName(state)}病危了，还差一点积分买回春灵药。安静地陪它守一夜，天亮就能凑齐。`;
  $('vigil-timer').textContent=fmtClock(vigilDur);
  $('vigil-progress').style.width='0%';
  $('vigil-toggle').textContent='开始守夜';
  $('vigil-toggle').disabled=false;
  if(!$('vigil-dialog').open)$('vigil-dialog').showModal();
}
function vigilTick(){
  if(!vigilRunning)return;
  const remain=vigilEnd-Date.now();
  $('vigil-timer').textContent=fmtClock(remain);
  $('vigil-progress').style.width=`${Math.min(100,100*(1-Math.max(0,remain)/vigilDur))}%`;
  if(remain<=0){
    vigilRunning=false; if(vigilId){clearInterval(vigilId);vigilId=null;}
    try{
      const err=G.claimVigil(state,now());
      if(err){toast(err);}
      else{save(); if($('vigil-dialog').open)$('vigil-dialog').close(); render(); toast('守到了天亮，积分凑齐了，快去用回春灵药挽回它。');}
    }catch{toast('守夜暂时无法记录。');}
  }
}
function startVigil(){
  if(vigilRunning)return;
  const st=G.vigilStatus(state);
  if(!st.available){toast(st.reason||'现在不需要守夜');return;}
  vigilDur=st.seconds*1000;
  vigilRunning=true; vigilEnd=Date.now()+vigilDur;
  $('vigil-toggle').textContent='守夜中……'; $('vigil-toggle').disabled=true;
  if(vigilId)clearInterval(vigilId);
  vigilId=setInterval(vigilTick,250);
  vigilTick();
}
function cancelVigil(){vigilRunning=false; if(vigilId){clearInterval(vigilId);vigilId=null;}}
function toggleCare() {
  if(running){pause();return;}
  if(document.hidden)return;
  if(!state.task) {
    const pid=careProduct||null;
    const quantity=pid?careQuantity:undefined;
    const error=G.begin(state,careId,pid,now(),quantity);
    if(error){toast(error);return;}
    const item=G.catalog.find(p=>p.id===state.task.productId);
    const units=state.task.quantity||1;
    $('care-products').innerHTML=`<div class="reserved-item">${icon('check')}${item?item.name+` · 已取用 ${units} 份`:'专心陪伴 · 无需物资'}</div>`;
    save();
  }
  running=true;
  lastTick=performance.now();
  A.play();
  setTimeout(()=>{if(running&&A.pref.enabled&&A.blocked)toast('浏览器暂未放行声音，轻点一下屏幕即可听到背景音乐。');},1500);
  updateTimer();
}
function tick() {
  pulseMoment();
  if(!running||!state.task)return;
  const finishedAction=state.task.actionId;
  const bgAllowed=backgroundCare[state.task.actionId];
  if(document.hidden&&!bgAllowed){pause();return;}
  if(!$('care-dialog').open){pause();return;}
  const time=performance.now();
  // Discard suspension gaps unless background care is opted in for this action.
  const elapsed=Math.max(0,Math.min((time-lastTick)/1000,bgAllowed?3600:1));
  lastTick=time;
  const result=G.advance(state,elapsed,now());
  if(result) {
    running=false;
    careId=null;
    A.stop();
    const taskGain=G.completeDailyTask(state,'care',now());
    if(window.Stats){window.Stats.event('careActions');window.Stats.bump('care_'+finishedAction,1);window.Stats.bump('pointsEarned',(result.points||0)+(taskGain||0));}
    save();
    $('care-dialog').close();
    render();
    const tip=careSessionTip&&careSessionTip.cat===finishedAction?careSessionTip:nextTip(finishedAction);
    careSessionTip=null;
    $('info-content').innerHTML=`<div class="dialog-icon">${icon('heart')}</div><div class="eyebrow">LOVE FINDS ITS WAY BACK</div><h2>你的用心，被感受到了</h2><p class="reward-emotion">${emotion()}</p><div class="reward-badges"><span>成长 +10</span><span>积分 +${result.points}</span><span>亲密度 +2</span>${taskGain?`<span>小任务 +${taskGain}</span>`:''}</div>${tip?`<div class="tip-box">${tipHtml(tip,true)}</div>`:''}<p>下一次需要你时，小屋会记得提醒。现在也给自己一点休息。</p><button class="primary close-button-inline">收下这份小幸福</button>`;
    $('info-dialog').showModal();
  } else {
    updateTimer();
    if(time-lastSaved>=2000)save();
  }
}
function exportSave() {
  const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='slow-growing-save.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
function applyNight() {
  try{G.configureNight(night);}catch{toast('夜间时段无效，已保持原设置。');return;}
  try{localStorage.setItem('slow-growing-night',JSON.stringify(night));}catch{}
}
function applyPace() {
  try{G.configurePace(carePace);}catch{toast('养育节奏无效，已保持原设置。');return;}
  try{localStorage.setItem('slow-growing-pace',carePace);}catch{}
}
document.addEventListener('click',e=>{
  const card=e.target.closest('[data-ktoggle]');
  if(card){
    const id=card.dataset.ktoggle;
    if(knowledgeOpen.has(id)){knowledgeOpen.delete(id);}
    else{knowledgeOpen.add(id);if(!knowledgeRead.includes(id)){knowledgeRead.push(id);try{localStorage.setItem('slow-growing-knowledge',JSON.stringify(knowledgeRead));}catch{}const kg=G.markKnowledgeTask(state,now());if(kg){save();toast(`今日小任务完成 · 积分 +${kg}`);}}}
    renderSecondary();
    return;
  }
  const b=e.target.closest('button');
  if(!b)return;
  if(b.id==='stage-up-close'){$('stage-up').hidden=true;return;}
  if(b.id==='vigil-button'){openVigil();return;}
  if(b.id==='vigil-toggle'){startVigil();return;}
  if(b.dataset.adopt){selectedType=b.dataset.adopt;renderAdoption();return;}
  if(b.id==='adopt-confirm') {
    if(loadFailed&&!confirm('原存档读取失败。开始新故事将写入新的存档，是否继续？'))return;
    try {
      G.adopt(state,selectedType,now(),$('adopt-name').value);loadFailed=false;save();$('adopt-dialog').close();render();
      if(window.Stats){window.Stats.event('adopts');window.Stats.bump('adopt_'+selectedType,1);}
      toast('欢迎回家。初见的小心翼翼，会慢慢变成亲密。');
    } catch {
      toast('这次操作暂时无法完成，请导出存档并刷新页面。');
    }
    return;
  }
  if(b.dataset.shopFilter){shopFilter=b.dataset.shopFilter;}
  if(b.dataset.supply!==undefined){careProduct=b.dataset.supply;careQuantity=1;renderSupplyPicker();updateTimer();return;}
  if(b.id==='quantity-minus'||b.id==='quantity-plus'){careQuantity=Math.max(1,Math.min(careQuantity+(b.id==='quantity-plus'?1:-1),careMaxQ));renderSupplyPicker();updateTimer();return;}
  if(b.dataset.page)navigate(b.dataset.page);
  if(b.dataset.wake){execute(()=>G.wake(state,now()),`${G.petName(state)}揉了揉眼睛，慢慢醒来了。`);return;}
  if(b.dataset.care)showCare(b.dataset.care);
  if(b.dataset.filter){shopFilter=b.dataset.filter;renderSecondary();}
  const departed=state.status==='left';
  if(departed&&(b.dataset.buy||b.dataset.wear||b.dataset.dye!==undefined||b.dataset.remedy||b.dataset.toolbox||b.id==='relief-button')){toast(G.petName(state)+(state.selected==='plant'?'的这一季已经结束，开始新的陪伴吧':'已经离开，开始新的陪伴吧'));return;}
  if(b.dataset.buy){
    const item=G.catalog.find(p=>p.id===b.dataset.buy);
    if(execute(()=>G.buy(state,b.dataset.buy,now()),'物资已放进小屋，照护时可以使用。')){ if(window.Stats&&item)window.Stats.bump('pointsSpent',item.price); }
  }
  if(b.dataset.wear) {
    const id=b.dataset.wear;
    const wasWorn=G.isEquipped(state,id);
    const placing=G.accessorySlot(id)==='place';
    execute(()=>G.wear(state,id,now()),wasWorn?'饰物已经收好。':placing?'饰物已经放下，去看看小屋吧。':'饰物已经穿好，去看看小屋吧。');
  }
  if(b.dataset.dye!==undefined)execute(()=>G.dye(state,b.dataset.dye,Number(b.dataset.variant),now()),'染好了，房间里的搭配已经更新。');
  if(b.dataset.remedy)execute(()=>G.remedy(state,b.dataset.remedy,now()),'用上了，健康度正在回来，好好休息。');
  if(b.dataset.toolbox)execute(()=>G.remedy(state,b.dataset.toolbox,now()),'用上了，健康度正在回来，好好休息。');
    if(b.id==='revive-button')execute(()=>{if((state.inventory['revive-elixir']||0)>0)return G.remedy(state,'revive-elixir',now());if((state.inventory['medicine-kit']||0)>0)return G.remedy(state,'medicine-kit',now());const err=G.buy(state,'revive-elixir',now());if(err)return err;return G.remedy(state,'revive-elixir',now());},`${profile().name}慢慢缓了过来。身体在恢复，心里的距离还要慢慢陪回来。`);
  if(b.id==='nanny-chip'){nannyOn=false;try{localStorage.setItem('slow-growing-nanny','0');}catch{}G.nannyStop(state);save();toast('贴心管家休息了，需要时再叫它。');render();}
  if(b.id==='restart-button') {
    try{G.restart(state,now());save();}catch{toast('还不能开始新的陪伴。');return;}
    delete $('room-art').dataset.sceneKey;$('room-art').innerHTML='';$('critical-banner').hidden=true;
    selectedType='cat';$('adopt-name').value='';renderAdoption();$('adopt-dialog').showModal();
  }
  if(b.id==='relief-button')execute(()=>G.relief(state,now()),'基础补给已送达，继续温柔地陪伴吧。');
  if(b.id==='checkin-button') {
    const before=state.points;
    if(execute(()=>G.checkin(state,now()))){
      if(window.Stats){window.Stats.event('checkins');window.Stats.bump('pointsEarned',state.points-before);}
      toast(`连续签到 ${state.checkin.streak} 天，积分 +${state.points-before}。`);
    }
  }
  if(b.id==='care-toggle')toggleCare();
  if(b.id==='care-shop'){$('care-dialog').close();navigate('supplies');}
  if(b.classList.contains('close-button')||b.classList.contains('close-button-inline'))b.closest('dialog').close();
  if(b.id==='moment-hit') {
    e.preventDefault();
    finishMoment('hit','收到了。亲密度 +2。');
    return;
  }
  if(b.id==='pet-touch') {
    if(Date.now()<momentQuietUntil||(liveMoment&&!liveMoment.done))return;
    const result=G.touch(state,now());save();render();responseUntil=Date.now()+12000;
    $('speech').textContent=result.message;
    $('room-art').classList.remove('affection');void $('room-art').offsetWidth;$('room-art').classList.add('affection');
    toast(result.message+(result.rewarded?' 亲密度 +1。':''));
  }
  if(b.id==='knowledge-link'){$('info-dialog').close();navigate('knowledge');return;}
  if(b.id==='export-save')exportSave();
  if(b.id==='notification'&&state.adopted) {
    G.refresh(state,now());
    $('info-content').innerHTML=`<div class="dialog-icon">${icon('bell')}</div><h2>接下来的小日常</h2>${G.careOptions(state).map(a=>`<div class="schedule-row"><span>${a.name}</span><b>${timeUntil(a.dueAt)}</b></div>`).join('')}<p>频率是游戏中的关注节奏，请结合当前需求安排照护。后台提醒尚未接入。</p>`;
    $('info-dialog').showModal();
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='bgm-volume') {
    A.setVolume(e.target.value/100);
    e.target.style.setProperty('--fill',e.target.value+'%');
    const hint=e.target.closest('.setting-row').querySelector('small');
    if(hint)hint.textContent=`当前 ${e.target.value}%，只影响背景音景。`;
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id==='reminders') {
    reminderEnabled=e.target.checked;
    try{localStorage.setItem('slow-growing-reminders',reminderEnabled?'on':'off');}catch{toast('偏好已在本次会话生效。');}
  }
  if(e.target.id==='bgm-enabled') {
    if(!A.setEnabled(e.target.checked))toast('背景音乐开关已在本次会话生效。');
    if(e.target.checked&&running)A.play();
    if(!e.target.checked)A.stop();
  }
  if(e.target.id==='bgm-style') {
    if(!A.setStyle(e.target.value))toast('音景风格已在本次会话生效。');
    if(running)A.play();
  }
  if(e.target.id==='bgm-volume') {
    if(!A.setVolume(e.target.value/100))toast('音量已在本次会话生效。');
  }
  if(e.target.id==='bgm-now-style') {
    if(!A.setStyle(e.target.value))toast('音景风格已在本次会话生效。');
    bgmShown=null;
    renderBgmNow();
  }
  if(e.target.dataset&&e.target.dataset.bg) {
    backgroundCare[e.target.dataset.bg]=e.target.checked;
    try{localStorage.setItem('slow-growing-background',JSON.stringify(backgroundCare));}catch{toast('偏好已在本次会话生效。');}
    renderSecondary();
  }
  if(e.target.id==='nanny-enabled') {
    nannyOn=e.target.checked;
    try{localStorage.setItem('slow-growing-nanny',nannyOn?'1':'0');}catch{}
    if(nannyOn){ G.nannyStart(state,now()); runNanny(); } else { G.nannyStop(state); }
    save();
    render();
    toast(nannyOn?`贴心管家已上岗：约 ${G.NANNY_RATE} 积分/小时，托管照护不产积分；自己照护能攒积分。`:'贴心管家休息了，需要时再叫它。');
  }
  if(e.target.id==='night-enabled') {
    night.enabled=e.target.checked;
    $('night-start').disabled=$('night-end').disabled=!night.enabled;
    applyNight();
    renderSecondary();
  }
  if(e.target.id==='night-start'||e.target.id==='night-end') {
    night.start=+$('night-start').value;
    night.end=+$('night-end').value;
    applyNight();
    if(night.start===night.end)toast('开始与结束相同，相当于没有夜间时段。');
  }
  if(e.target.id==='care-pace') {
    carePace=e.target.value;
    applyPace();
    render();
  }
  if(e.target.id==='import-save') {
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>2000000)throw Error('size');
      const loaded=G.load(await file.text(),null,Date.now());
      if(!loaded.adopted)throw Error('selection');
      if(!confirm('恢复这份存档？当前进度会先自动导出备份。'))return;
      exportSave();pause();state=loaded;loadFailed=false;save();delete $('room-art').dataset.sceneKey;$('room-art').innerHTML='';navigate('home');toast('存档已恢复，欢迎回到小屋。');
    }catch{toast('文件格式或数据无效，请选择本游戏导出的有效存档。');}
  }
});
$('care-dialog').addEventListener('close',()=>{pause();careId=null;render();});
$('vigil-dialog').addEventListener('close',cancelVigil);
$('adopt-dialog').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!running||!state.task||!backgroundCare[state.task.actionId])pause();}else{render();updateTimer();pulseMoment();}});
window.addEventListener('pagehide',pause);
// Another tab owns the newest save; pause this tab before adopting its state.
window.addEventListener('storage',e=>{
  if(e.key!==saveKey||!e.newValue)return;
  try{running=false;state=G.load(e.newValue,null,Date.now());$('care-dialog').close();careId=null;delete $('room-art').dataset.sceneKey;$('room-art').innerHTML='';if(state.adopted)$('adopt-dialog').close();render();toast('已同步另一页面的进度，请在一个页面中照护。');}catch{toast('另一页面的存档暂时无法同步。');}
});
// Global price overrides were applied by site.js; refresh any open views.
window.addEventListener('site-config-applied',()=>{ if(state && state.adopted) render(); });
setInterval(tick,250);
setInterval(runNanny,5000);
setInterval(()=>{
  if(!state.adopted||document.hidden||running)return;
  render();save();
  if(reminderEnabled&&state.status!=='left'&&Math.min(...state.needs)<25&&Date.now()-lastReminder>300000){lastReminder=Date.now();toast(`${profile().name}需要一点照顾了，看看小屋的状态吧。`);}
},15000);
$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
if(state.adopted) {
  if(nannyOn) G.nannyStart(state, now()); // resume hourly fee clock from now (no offline charge)
  render();
  if(state.task){$('welcome-back').hidden=false;$('welcome-back').innerHTML=`${icon('clock')} 上一次的${escapeHtml(state.task.name)}还在等你，进度已经保存。<button data-care="${state.task.actionId}">继续陪伴</button>`;}
} else {
  selectedType=state.selected||'cat';renderAdoption();$('adopt-dialog').showModal();
  if(loadFailed)toast('原存档读取失败。原始数据仍保留，可先备份再开始新故事。');
}

// Keep the game playable offline and installable: register the service worker
// and let the player know when a newer shell has taken over.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    toast('小屋已经更新到最新版本。');
  });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
