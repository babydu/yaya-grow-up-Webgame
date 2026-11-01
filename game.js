'use strict';
const G = window.GameEngine;
const { icon, scene, portrait } = window.GameVisuals;
const A = window.GameAudio;
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const saveKey = 'slow-growing-v2';
const pageNames = {home:'我的小屋',growth:'成长足迹',diary:'养育日记',supplies:'生活小铺',settings:'偏好设置'};
let state;
let storageFailed = false;
let loadFailed = false;
let page = 'home';
let selectedType = 'cat';
let careId = null;
let running = false;
let lastTick = 0;
let lastSaved = 0;
let shopFilter = 'all';
let toastTimer;
let lastReminder = 0;
let reminderEnabled = true;
let responseUntil = 0;
try {
  state = G.load(localStorage.getItem(saveKey), localStorage.getItem('slow-growing-v1'), Date.now());
  reminderEnabled = localStorage.getItem('slow-growing-reminders') !== 'off';
} catch {
  state = G.create(Date.now());
  loadFailed = true;
}
A.loadPref();
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
function emotion() {
  const level = state.bond >= 65 ? 2 : state.bond >= 30 ? 1 : 0;
  const text = {
    cat:['它轻轻闻着你的手，开始记住你的气味。','熟悉的呼噜声响起，它把小脑袋靠在你手心。','你一回来，它就蹭着你的腿，在你身边安心踩奶。'],
    dog:['它歪着头看你，尾巴试探着摇了摇。','它把下巴放在你膝盖上，想再陪你一会儿。','听见你的脚步声，它跑来迎接，把身体紧紧靠着你。'],
    baby:['小小的手指握住了你，世界忽然安静下来。','认出你的声音，宝宝露出了一个安心的笑容。',G.stage(state).index >= 3 ? '小满张开双臂扑向你，给了你一个大大的拥抱。' : '宝宝望着你笑，把小脸贴在你的肩膀上。']
  };
  return text[state.selected || 'cat'][level];
}
function renderAdoption() {
  $('adopt-options').innerHTML = Object.entries(G.profiles).map(([type,p]) => `<button class="adopt-option ${selectedType === type ? 'selected' : ''}" data-adopt="${type}" aria-pressed="${selectedType === type}"><span class="adopt-portrait">${portrait(type)}</span><strong>${p.kind} · ${p.name}</strong><small>${{cat:'安静依偎，慢热又柔软',dog:'热情迎接，陪你探索',baby:'从握住手指到主动拥抱'}[type]}</small><span class="selection-mark">${icon(selectedType === type ? 'check' : 'heart')}</span></button>`).join('');
  $('adopt-summary').textContent = state.selected === selectedType ? `继续与${profile().name}的故事，保留已有成长与照护进度。` : `${G.profiles[selectedType].description} 每天回来，感受一点点变化。`;
}
function render() {
  if (!state.adopted) return;
  G.refresh(state, now());
  const p = profile(), st = G.stage(state), actions = G.careOptions(state);
  $('welcome-back').hidden = !state.task;
  if (state.task) $('welcome-back').innerHTML = `${icon('clock')} 上一次的${escapeHtml(state.task.name)}还在等你，进度已经保存。<button data-care="${state.task.actionId}">继续陪伴</button>`;
  $('companion-chip').innerHTML = portrait(state.selected) + `<strong>${p.kind} · ${p.name}</strong><span>${st.name}</span>`;
  $('wallet-points').innerHTML = icon('leaf') + `<b>${state.points}</b> 积分`;
  const checked = state.checkin.date === state.daily.date;
  $('checkin-button').disabled = checked;
  $('checkin-button').textContent = checked ? `已签到 · ${state.checkin.streak} 天` : '签到领积分';
  $('room-name').textContent = p.name + '的小窝';
  $('pet-name').textContent = p.name;
  $('pet-age').textContent = `${st.label} · 相伴第 ${Math.floor((now()-state.born)/86400000)+1} 天`;
  $('stage-badge').textContent = st.name;
  $('stage-text').textContent = st.next ? `下一站：${st.next.name}` : '成长的每一步，都有你';
  $('growth-percent').textContent = `${state.xp} 成长经验`;
  $('growth-bar').style.width = `${st.progress}%`;
  $('status-tip').textContent = `每 ${st.feedHours} 小时关注进食 · 每次 ${duration(st.feedSeconds)}`;
  if (!$('room-art').innerHTML) $('room-art').innerHTML = scene(state.selected);
  const labels = ['饱腹感','洁净度','好心情','精力值'];
  $('needs').innerHTML = state.needs.map((value,i) => `<div class="need ${actions[i].id}"><div class="need-top">${icon(actions[i].icon)}<span>${labels[i]}</span><span class="need-value">${Math.round(value)} / 100</span></div><div class="progress" role="progressbar" aria-label="${labels[i]}" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%"></span></div></div>`).join('');
  const low = state.needs.indexOf(Math.min(...state.needs));
  if (Date.now() > responseUntil) $('speech').textContent = state.needs[low] < 40 ? ['肚子有点饿，你来啦？','想要干干净净的……','今天可以多陪陪我吗？','困了，陪我休息一会儿吧。'][low] : '看见你，今天又变好了。';
  $('pet-mood').textContent = state.task ? `等你继续${state.task.name}` : state.needs[low] < 40 ? ['到了进食的时间','需要清洁一下','想要你的陪伴','需要安静休息'][low] : '安心地享受你的陪伴';
  $('pet-touch').innerHTML = icon('hand') + (state.selected === 'baby' ? '抱抱宝宝' : '摸摸它');
  $('bond-card').innerHTML = `<span class="bond-icon">${icon('heart')}</span><div><strong>${['开始熟悉你','已经很依赖你','你是最安心的存在'][state.bond>=65?2:state.bond>=30?1:0]}</strong><p>${emotion()}</p></div><div class="bond-score"><b>${Math.round(state.bond)}</b> / 100<small>亲密度</small></div>`;
  $('care-cards').innerHTML = actions.map((a,i) => {
    const task = state.task?.actionId === a.id;
    const due = now() >= a.dueAt;
    const satisfied = state.needs[i] >= (i === 0 ? 80 : 95);
    const unavailable = !task && (!!state.task || !due || satisfied);
    const stock = G.products(state,a.id).reduce((sum,p) => sum+(state.inventory[p.id] || 0),0);
    const status = task ? '进度已保留' : satisfied ? '状态很好，稍后再来' : timeUntil(a.dueAt);
    return `<article class="care-card ${!unavailable && state.needs[i]<50?'urgent':''}"><div class="care-card-top"><span class="care-icon">${icon(a.icon)}</span><span class="duration">${icon('clock')}${duration(a.seconds)}</span></div><h3>${a.name}</h3><p class="care-frequency">每 ${a.intervalHours} 小时关注一次</p><div class="care-stock">${i<2?`适龄物资 ${stock} 份`:'用陪伴回应需要'}</div><small class="care-due">${status}</small><button class="care-action" data-care="${a.id}" ${unavailable?'disabled':''}>${task?'继续照护':satisfied?'安心休息':!due?'稍后再来':a.name}${icon('arrow')}</button></article>`;
  }).join('');
  $('total-minutes').innerHTML = `${Math.floor(state.daily.seconds/60)} <small>分钟</small>`;
  $('total-care').innerHTML = `${state.daily.count} <small>次</small>`;
  $('total-days').innerHTML = `${Math.floor((now()-state.born)/86400000)+1} <small>天</small>`;
  if (page !== 'home') renderSecondary();
}
function renderSecondary() {
  const p=profile(),st=G.stage(state),el=$('secondary-page');
  if(page==='growth') {
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">LITTLE STEPS, BIG LOVE</div><h2>${p.name}的成长手册</h2><p>${st.description}<br>目前 ${st.label}，${state.xp} 点成长经验。${st.next?`下一阶段需要游戏年龄 ${st.next.age} 天与 ${st.next.xp} 经验。`:'成长还在继续，爱会留在每一天。'}</p><div class="milestones">${G.milestones(state).map(m=>`<article class="milestone ${m.unlocked?'current':''}">${icon(m.unlocked?'sprout':'clock')}<h3>${m.title}</h3><p>${m.description}</p><small>${m.unlocked?'已留下足迹':'慢慢到达 · 晋级 +20 积分'}</small></article>`).join('')}</div><h3>这个阶段，怎样好好照顾？</h3><div class="stage-guide"><p><b>吃什么</b><br>${G.products(state,'food').map(p=>p.name).join('、')}</p><p><b>多久一次</b><br>进食每 ${st.feedHours} 小时关注一次；清洁每 ${st.cleanHours} 小时关注一次。</p><p><b>陪伴的时间</b><br>进食 ${duration(st.feedSeconds)}；玩耍 1 分钟；安抚休息 2 分钟。</p></div><h3>双向奔赴的小瞬间</h3><div class="memory-cards">${[30,65].map((n,i)=>`<article class="milestone ${state.bond>=n?'current':''}">${icon('heart')}<h3>${i?'你是它的全世界':'开始认出你'}</h3><p>亲密度 ${n} 解锁，首次获得 10 积分。</p><small>${state.bond>=n?'已珍藏在你们的故事里':'每一次照料，都会靠近一点'}</small></article>`).join('')}</div></div>`;
  } else if(page==='diary') {
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">OUR ORDINARY, PRECIOUS DAYS</div><h2>${p.name}的养育日记</h2><p>成长、拥抱和认真照料的时刻，都值得记住。</p>${[...state.logs].reverse().map(l=>`<article class="diary-entry"><time>${new Date(l.at).toLocaleString('zh-CN')}</time><p>${escapeHtml(l.text)}</p></article>`).join('')}</div>`;
  } else if(page==='supplies') {
    const available = new Set(['food','clean','mood'].flatMap(id=>G.products(state,id).map(p=>p.id)));
    const categories={all:'全部物资',food:'日常饮食',clean:'清洁护理',nutrition:'营养搭配',comfort:'陪伴玩具'};
    el.innerHTML=`<div class="page-panel shop-panel"><div class="eyebrow">A WELL-STOCKED LITTLE HOME</div><div class="section-heading"><h2>生活小铺</h2><span class="points-pill">${icon('leaf')} ${state.points} 积分</span></div><p>适合${p.name}的小小补给。签到得 11–17 积分，有效照护每次 +5（每日上限 40），成长还有额外奖励。</p><div class="shop-filters">${Object.entries(categories).map(([id,name])=>`<button data-filter="${id}" class="${shopFilter===id?'active':''}" aria-pressed="${shopFilter===id}">${name}</button>`).join('')}</div><div class="shop-grid">${G.catalog.filter(item=>item.types.includes(state.selected)&&(shopFilter==='all'||item.category===shopFilter)).map(item=>{const usable=available.has(item.id);return `<article class="shop-item"><span class="product-icon">${icon(item.icon)}</span><span class="stock-tag">库存 ${state.inventory[item.id]||0}</span><h3>${item.name}</h3><p>${item.description}</p><small>${item.pack} 份 / 组 · ${usable?'适合当前阶段':item.minStage>st.index?'成长后解锁':'已度过适用阶段'}</small><button data-buy="${item.id}" ${!usable||state.points<item.price?'disabled':''}>${!usable?'阶段限定':state.points<item.price?'积分不足':`${item.price} 积分 · 兑换`}</button></article>`;}).join('')}</div><div class="relief-box"><div><strong>总有一份温柔的支持</strong><p>适龄主食或清洁用品耗尽时，每日可领取一次基础补给，各补 2 份。</p></div><button class="secondary" id="relief-button">领取基础补给</button></div></div>`;
  } else {
    el.innerHTML=`<div class="page-panel"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>偏好与存档</h2><label class="setting-row"><span>应用内照护提醒<small>页面打开时提醒低需求；系统后台推送尚未接入。</small></span><input type="checkbox" id="reminders" ${reminderEnabled?'checked':''}></label><label class="setting-row"><span>背景音乐<small>照护进行时播放实时合成的音景，全部由浏览器本地生成，无外部音频文件。</small></span><input type="checkbox" id="bgm-enabled" ${A.pref.enabled?'checked':''}></label><label class="setting-row"><span>音景风格<small>白噪音、雨声、海浪、八音盒轻音乐、森林晨间，照护中切换即刻生效。</small></span><select id="bgm-style">${A.stylesHtml(A.pref.style)}</select></label><label class="setting-row"><span>音乐音量<small>当前 ${Math.round(A.pref.volume*100)}%，只影响背景音景。</small></span><input type="range" id="bgm-volume" min="0" max="100" value="${Math.round(A.pref.volume*100)}"></label><div class="setting-row"><span>专心陪伴模式<small>点击开始后保持照护页面可见；切后台、锁屏或关闭弹窗自动暂停。</small></span><span class="stage-badge">已开启</span></div><div class="setting-row"><span>成长时间<small>现实 1 天 = 游戏 30 天，升级同时需要有效照护经验。</small></span></div><div class="setting-row"><span>导出存档<small>进度保存在此浏览器，可导出文件备份。</small></span><button class="primary" id="export-save">导出</button></div><label class="setting-row"><span>恢复存档<small>恢复前自动下载当前进度备份；支持本版本的 JSON 存档。</small></span><input id="import-save" type="file" accept=".json,application/json"></label><p>养育节奏、饮食与情绪数值采用游戏化简化。真实宝宝的喂养方式、辅食时机与营养补充，请与儿科专业人员讨论；宠物饮食请咨询兽医。小铺商品均为虚拟物资，使用游戏积分兑换。</p></div>`;
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
function showCare(id) {
  if(state.task && state.task.actionId!==id){toast('先完成已经开始的照护，再做下一件小事。');return;}
  careId=id;
  const option=G.careOptions(state).find(a=>a.id===id);
  $('care-title').textContent=`${option.name} · ${profile().name}`;
  $('care-description').textContent={food:'准备一份适龄食物，坐下来，陪着慢慢吃。',clean:'整理、清洁、更换，每一步都让生活舒服一点。',mood:'一段专心的时间，是今天最好的小礼物。',energy:'把周围的声音放轻，陪着慢慢安静下来。'}[id];
  $('dialog-icon').innerHTML=icon(option.icon);
  const products=G.products(state,id);
  if(state.task) {
    const item=G.catalog.find(p=>p.id===state.task.productId);
    $('care-products').innerHTML=`<div class="reserved-item">${icon('check')}${item?item.name+' · 已取用 1 份':'专心陪伴 · 无需物资'}<small>继续照护会沿用本次物资</small></div>`;
  } else {
    $('care-products').innerHTML=products.length?`<label class="product-label" for="care-product">本次使用</label><select id="care-product">${id==='mood'?'<option value="">徒手互动 · 无需物资</option>':''}${products.map(p=>`<option value="${p.id}" ${(state.inventory[p.id]||0)===0?'disabled':''}>${p.name} · 库存 ${state.inventory[p.id]||0} 份</option>`).join('')}</select><small class="care-hint">开始时消耗 1 份；暂停和继续沿用已取用物资。</small>`:'<div class="reserved-item">安心在身边，已经足够。</div>';
    if((id==='food'||id==='clean')&&!products.some(p=>state.inventory[p.id]>0))$('care-products').innerHTML='<div class="empty-stock">适龄物资用完了，先给小屋补充一点吧。<button class="secondary" id="care-shop">去生活小铺</button></div>';
  }
  updateTimer();
  $('care-dialog').showModal();
}
function updateTimer() {
  if(!careId)return;
  const task=state.task;
  const seconds=task?.seconds||G.careOptions(state).find(a=>a.id===careId).seconds;
  const remaining=Math.ceil(seconds-(task?.elapsed||0));
  $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const progress=(task?.elapsed||0)/seconds*100;
  $('care-progress').style.width=progress+'%';
  $('care-meter').setAttribute('aria-valuenow',String(Math.round(progress)));
  $('care-toggle').textContent=running?'暂停，休息一下':task?'继续陪伴':'准备好了，开始';
  $('care-toggle').disabled=!task&&['food','clean'].includes(careId)&&!G.products(state,careId).some(p=>state.inventory[p.id]>0);
  $('timer-note').textContent=running?['正在慢慢享用，留在这里陪着就好。','小窝正在一点点变干净。','它很喜欢这段只属于你们的时间。','呼吸渐渐平稳，安心正在发生。'][['food','clean','mood','energy'].indexOf(careId)]:task?'进度已保存，准备好就继续。':'给彼此一段安静的陪伴时间。';
  $('dialog-icon').classList.toggle('care-running',running);
}
function pause() {
  running=false;
  A.stop();
  updateTimer();
  save();
}
function toggleCare() {
  if(running){pause();return;}
  if(document.hidden)return;
  if(!state.task) {
    const error=G.begin(state,careId,$('care-product')?.value||null,now());
    if(error){toast(error);return;}
    const item=G.catalog.find(p=>p.id===state.task.productId);
    $('care-products').innerHTML=`<div class="reserved-item">${icon('check')}${item?item.name+' · 已取用 1 份':'专心陪伴 · 无需物资'}</div>`;
    save();
  }
  running=true;
  lastTick=performance.now();
  A.play();
  updateTimer();
}
function tick() {
  if(!running||!state.task)return;
  if(document.hidden||!$('care-dialog').open){pause();return;}
  const time=performance.now();
  // Discard suspension gaps; a resumed tab must not gain unattended time.
  const elapsed=Math.max(0,Math.min((time-lastTick)/1000,1));
  lastTick=time;
  const result=G.advance(state,elapsed,now());
  if(result) {
    running=false;
    careId=null;
    A.stop();
    save();
    $('care-dialog').close();
    render();
    $('info-content').innerHTML=`<div class="dialog-icon">${icon('heart')}</div><div class="eyebrow">LOVE FINDS ITS WAY BACK</div><h2>你的用心，被感受到了</h2><p class="reward-emotion">${emotion()}</p><div class="reward-badges"><span>成长 +10</span><span>积分 +${result.points}</span><span>亲密度 +2</span></div><p>下一次需要你时，小屋会记得提醒。现在也给自己一点休息。</p><button class="primary close-button-inline">收下这份小幸福</button>`;
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
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.adopt){selectedType=b.dataset.adopt;renderAdoption();return;}
  if(b.id==='adopt-confirm') {
    if(loadFailed&&!confirm('原存档读取失败。开始新故事将写入新的存档，是否继续？'))return;
    G.adopt(state,selectedType,now());loadFailed=false;save();$('adopt-dialog').close();render();
    toast('欢迎回家。初见的小心翼翼，会慢慢变成亲密。');return;
  }
  if(b.dataset.page)navigate(b.dataset.page);
  if(b.dataset.care)showCare(b.dataset.care);
  if(b.dataset.filter){shopFilter=b.dataset.filter;renderSecondary();}
  if(b.dataset.buy)execute(()=>G.buy(state,b.dataset.buy,now()),'物资已放进小屋，照护时可以使用。');
  if(b.id==='relief-button')execute(()=>G.relief(state,now()),'基础补给已送达，继续温柔地陪伴吧。');
  if(b.id==='checkin-button') {
    const before=state.points;
    if(execute(()=>G.checkin(state,now())))toast(`连续签到 ${state.checkin.streak} 天，积分 +${state.points-before}。`);
  }
  if(b.id==='care-toggle')toggleCare();
  if(b.id==='care-shop'){$('care-dialog').close();navigate('supplies');}
  if(b.classList.contains('close-button')||b.classList.contains('close-button-inline'))b.closest('dialog').close();
  if(b.id==='pet-touch') {
    const result=G.touch(state,now());save();render();responseUntil=Date.now()+12000;
    $('speech').textContent=result.message;
    $('room-art').classList.remove('affection');void $('room-art').offsetWidth;$('room-art').classList.add('affection');
    toast(result.message+(result.rewarded?' 亲密度 +1。':''));
  }
  if(b.id==='export-save')exportSave();
  if(b.id==='notification'&&state.adopted) {
    G.refresh(state,now());
    $('info-content').innerHTML=`<div class="dialog-icon">${icon('bell')}</div><h2>接下来的小日常</h2>${G.careOptions(state).map(a=>`<div class="schedule-row"><span>${a.name}</span><b>${timeUntil(a.dueAt)}</b></div>`).join('')}<p>频率是游戏中的关注节奏，请结合当前需求安排照护。后台提醒尚未接入。</p>`;
    $('info-dialog').showModal();
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
  if(e.target.id==='import-save') {
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>2000000)throw Error('size');
      const loaded=G.load(await file.text(),null,Date.now());
      if(!loaded.adopted)throw Error('selection');
      if(!confirm('恢复这份存档？当前进度会先自动导出备份。'))return;
      exportSave();pause();state=loaded;loadFailed=false;save();$('room-art').innerHTML='';navigate('home');toast('存档已恢复，欢迎回到小屋。');
    }catch{toast('文件格式或数据无效，请选择本游戏导出的有效存档。');}
  }
});
$('care-dialog').addEventListener('close',()=>{pause();careId=null;render();});
$('adopt-dialog').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else{render();updateTimer();}});
window.addEventListener('pagehide',pause);
// Another tab owns the newest save; pause this tab before adopting its state.
window.addEventListener('storage',e=>{
  if(e.key!==saveKey||!e.newValue)return;
  try{running=false;state=G.load(e.newValue,null,Date.now());$('care-dialog').close();careId=null;$('room-art').innerHTML='';if(state.adopted)$('adopt-dialog').close();render();toast('已同步另一页面的进度，请在一个页面中照护。');}catch{toast('另一页面的存档暂时无法同步。');}
});
setInterval(tick,250);
setInterval(()=>{
  if(!state.adopted||document.hidden||running)return;
  render();save();
  if(reminderEnabled&&Math.min(...state.needs)<25&&Date.now()-lastReminder>300000){lastReminder=Date.now();toast(`${profile().name}需要一点照顾了，看看小屋的状态吧。`);}
},15000);
$('date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
if(state.adopted) {
  render();
  if(state.task){$('welcome-back').hidden=false;$('welcome-back').innerHTML=`${icon('clock')} 上一次的${escapeHtml(state.task.name)}还在等你，进度已经保存。<button data-care="${state.task.actionId}">继续陪伴</button>`;}
} else {
  selectedType=state.selected||'cat';renderAdoption();$('adopt-dialog').showModal();
  if(loadFailed)toast('原存档读取失败。原始数据仍保留，可先备份再开始新故事。');
}
