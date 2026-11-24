const { chromium } = require('/usr/local/lib/node_modules/@playwright/test');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await page.locator('#adopt-dialog').waitFor({ state: 'visible' });
    // SEO metadata is present for crawlers and social cards.
    const seo = await page.evaluate(() => ({
      desc: document.querySelector('meta[name="description"]')?.content || '',
      robots: document.querySelector('meta[name="robots"]')?.content || '',
      og: !!document.querySelector('meta[property="og:title"]'),
      jsonld: !!document.querySelector('script[type="application/ld+json"]')
    }));
    assert.ok(seo.desc.length > 10);
    assert.match(seo.robots, /index/);
    assert.equal(seo.og, true);
    assert.equal(seo.jsonld, true);
    const structured = await page.evaluate(() => {
      const types = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => { try { return JSON.parse(s.textContent)['@type']; } catch { return 'ERR'; } });
      const about = document.querySelector('.about');
      return { types, about: !!about, steps: about ? about.querySelectorAll('ol li').length : 0 };
    });
    assert.ok(structured.types.includes('VideoGame'));
    assert.ok(structured.types.includes('HowTo'));
    assert.ok(structured.types.includes('FAQPage'));
    assert.equal(structured.about, true);
    assert.ok(structured.steps >= 3);
    // Dynamic favicon + title switch between watching and away tabs.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(120);
    const favIdle = await page.evaluate(() => ({
      title: document.title, href: document.getElementById('favicon').getAttribute('href')
    }));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(120);
    const favAway = await page.evaluate(() => ({
      title: document.title, href: document.getElementById('favicon').getAttribute('href')
    }));
    assert.ok(favAway.title !== favIdle.title, 'away tab title gains a hint prefix');
    assert.ok(/^（.+）/.test(favAway.title), 'away title is wrapped in a hint');
    assert.ok(decodeURIComponent(favAway.href) !== decodeURIComponent(favIdle.href),
      'away favicon gains the attention dot');
    // Urgency drives colour: the critical palette turns red via the TabCue API.
    const favCritical = await page.evaluate(() => {
      window.TabCue.set({ level: 'critical', count: 2, hint: '测试' });
      return document.getElementById('favicon').getAttribute('href');
    });
    assert.ok(/c96a5e|b9554a/.test(decodeURIComponent(favCritical)), 'critical level uses the red palette');
    await page.evaluate(() => {
      window.TabCue.set({ level: 'ok', count: 0, hint: '它在等你' });
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(120);
    const favBack = await page.evaluate(() => ({ title: document.title }));
    assert.equal(favBack.title, favIdle.title);
    assert.equal(await page.locator('[data-adopt="plant"]').isVisible(), true);
    await page.locator('[data-adopt="plant"]').click();
    assert.match(await page.locator('[data-adopt="plant"]').innerText(), /安静养成/);
    assert.match(await page.locator('#adopt-summary').innerText(), /安静养成/);
    await page.locator('[data-adopt="cat"]').click();
    assert.match(await page.locator('#adopt-summary').innerText(), /短时小事件/);
    await page.locator('[data-adopt="baby"]').click();
    assert.match(await page.locator('#adopt-summary').innerText(), /短时小事件/);
    await page.locator('#adopt-confirm').click();
    assert.match(await page.locator('#companion-chip').innerText(), /阿团/);
    assert.match(await page.locator('#greeting-title').innerText(), /新的一天，先看看它|午后的小屋，也要好好陪伴|阳光正好，慢慢待一会儿|傍晚回来了，它在等你|夜深了，轻轻陪一会儿/);
    assert.match(await page.locator('#room-weather').innerText(), /°C/);
    assert.ok(['dawn', 'noon', 'afternoon', 'dusk', 'night'].includes(await page.locator('#room-art').getAttribute('data-day')));
    await page.locator('#checkin-button').click();
    assert.match(await page.locator('#wallet-points').innerText(), /71/);
    await page.locator('[data-care="food"]').click();
    assert.match(await page.locator('#care-mode-hint').innerText(), /自动暂停/);
    assert.equal(await page.locator('#care-tip').isVisible(), true);
    assert.match(await page.locator('#care-tip').innerText(), /养护小知识/);
    assert.equal(await page.locator('.supply-item.selected').count(), 1);
    assert.match(await page.locator('.supply-item.selected small').innerText(), /库存/);
    assert.match(await page.locator('#care-gain').innerText(), /饱腹感 \+45/);
    assert.match(await page.locator('#care-gain').innerText(), /精力值 \+5/);
    await page.locator('#quantity-plus').click();
    assert.equal(await page.locator('#timer').innerText(), '10:00');
    await page.locator('#quantity-minus').click();
    assert.equal(await page.locator('#timer').innerText(), '05:00');
    await page.locator('#care-toggle').click();
    await page.waitForFunction(() => document.querySelector('#timer').innerText !== '05:00', null, { timeout: 8000 });
    assert.notEqual(await page.locator('#timer').innerText(), '05:00');
    await page.locator('#care-toggle').click();
    const paused = await page.locator('#timer').innerText();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#timer').innerText(), paused);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#adopt-dialog').isVisible(), false);
    await page.locator('#care-cards [data-care="food"]').click();
    assert.equal(await page.locator('#timer').innerText(), paused);
    await page.locator('#care-toggle').click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenTimer = await page.locator('#timer').innerText();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#timer').innerText(), hiddenTimer);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.locator('#care-dialog .close-button').click();
    await page.locator('nav [data-page="supplies"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /舒适尿裤/);
    assert.match(await page.locator('#secondary-page').innerText(), /一次 洁净度 \+45/);
    const beforeMilk = await page.evaluate(() => state.points);
    await page.locator('[data-buy="baby-milk"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(saved.inventory['baby-milk'], 9);
    const milkPrice = await page.evaluate(() => window.GameEngine.catalog.find(p => p.id === 'baby-milk').price);
    assert.equal(saved.points, beforeMilk - milkPrice);
    await page.locator('nav [data-page="home"]').click();
    await page.locator('#pet-touch').click();
    assert.match(await page.locator('#speech').innerText(), /手指/);
    await page.evaluate(() => {
      state.task.elapsed = state.task.seconds - 0.5;
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#care-cards [data-care="food"]').click();
    await page.locator('#care-toggle').click();
    await page.locator('#info-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#info-content').innerText(), /积分 \+5/);
    await page.locator('.close-button-inline').click();
    assert.equal(await page.locator('#welcome-back').isVisible(), false);
    await page.locator('nav [data-page="growth"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /成长足迹/);
    assert.match(await page.locator('#secondary-page').innerText(), /纪念相册/);
    await page.locator('nav [data-page="diary"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /喂养完成/);
    assert.match(await page.locator('#secondary-page').innerText(), /今天的小结/);
    await page.locator('nav [data-page="home"]').click();
    await page.locator('#care-cards [data-care="clean"]').click();
    assert.equal(await page.locator('#quantity-plus').count(), 0);
    assert.match(await page.locator('#care-gain').innerText(), /洁净度 \+/);
    assert.match(await page.locator('#care-products').innerText(), /舒适尿裤/);
    await page.locator('#care-dialog .close-button').click();
    await page.locator('aside [data-page="settings"]').click();
    await page.locator('#bgm-enabled').check();
    await page.locator('#bgm-style').selectOption('wave');
    await page.locator('#bgm-volume').evaluate(el => { el.value = '45'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    const bgm = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-bgm')));
    assert.deepEqual(bgm, { enabled: true, style: 'wave', volume: 0.45 });
    await page.evaluate(() => window.GameAudio.play());
    assert.equal(await page.evaluate(() => window.GameAudio.active), true);
    await page.evaluate(() => window.GameAudio.setStyle('forest'));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.GameAudio.active), true);
    await page.evaluate(() => window.GameAudio.stop());
    assert.equal(await page.evaluate(() => window.GameAudio.active), false);
    await page.locator('#bgm-style').selectOption('wave');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('aside [data-page="settings"]').click();
    assert.equal(await page.locator('#bgm-enabled').isChecked(), true);
    assert.equal(await page.locator('#bgm-style').inputValue(), 'wave');
    assert.equal(await page.locator('#bgm-volume').inputValue(), '45');
    await page.locator('input[data-bg="energy"]').check();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-background'))),
      { food: false, clean: false, mood: false, energy: true });
    assert.match(await page.locator('#secondary-page').innerText(), /后台 1 项/);
    await page.locator('nav [data-page="home"]').click();
    await page.locator('#care-cards [data-care="energy"]').click();
    assert.match(await page.locator('#care-mode-hint').innerText(), /后台照护/);
    assert.match(await page.locator('#care-mode-hint').innerText(), /继续/);
    await page.locator('#care-toggle').click();
    assert.equal(await page.locator('#bgm-now').isVisible(), true);
    assert.match(await page.locator('#bgm-now-name').innerText(), /海浪/);
    await page.locator('#bgm-now-style').selectOption('forest');
    assert.match(await page.locator('#bgm-now-name').innerText(), /森林晨间/);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-bgm')))).style, 'forest');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.getElementById('timer').innerText !== '02:00', null, { timeout: 8000 });
    assert.notEqual(await page.locator('#timer').innerText(), '02:00');
    assert.equal(await page.evaluate(() => window.GameAudio.active), true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      state.task.elapsed = state.task.seconds - 0.5;
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await page.locator('#info-dialog').waitFor({ state: 'visible' });
    await page.locator('.close-button-inline').click();
    assert.equal(await page.locator('#bgm-now').isVisible(), false);
    await page.locator('nav [data-page="supplies"]').click();
    await page.locator('[data-filter="accessory"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /随身饰物/);
    const beforeAcc = await page.evaluate(() => state.points);
    await page.locator('[data-buy="acc-baby-1"]').click();
    const afterAcc = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(afterAcc.inventory['acc-baby-1'], 1);
    const accPrice = await page.evaluate(() => window.GameEngine.catalog.find(p => p.id === 'acc-baby-1').price);
    assert.equal(afterAcc.points, beforeAcc - accPrice);
    assert.equal(await page.locator('[data-wear="acc-baby-1"]').count(), 0);
    await page.locator('[data-page="pack"].secondary, [data-page="pack"]').last().click();
    assert.match(await page.locator('#secondary-page').innerText(), /我的背包/);
    assert.match(await page.locator('#secondary-page').innerText(), /随身饰物/);
    await page.locator('[data-wear="acc-baby-1"]').click();
    const worn = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')).worn);
    assert.equal(worn.wear, 'acc-baby-1');
    assert.equal(worn.place, null);
    assert.match(await page.locator('#secondary-page').innerText(), /穿戴中/);
    await page.locator('nav [data-page="home"]').click();
    assert.equal(await page.locator('#room-art [data-worn="acc-baby-1"]').count(), 1);
    assert.match(await page.locator('#room-art').getAttribute('data-scene-key'), /acc-baby-1/);
    await page.locator('nav [data-page="pack"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /穿戴中/);
    await page.locator('#secondary-page [data-wear="acc-baby-1"]').click();
    const unworn = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(unworn.worn.wear, null);
    assert.equal(unworn.worn.place, null);
    assert.equal(unworn.inventory['acc-baby-1'], 1);
    assert.match(await page.locator('#secondary-page').innerText(), /收在背包/);
    await page.locator('nav [data-page="home"]').click();
    assert.equal(await page.locator('#room-art [data-worn="acc-baby-1"]').count(), 0);
    await page.evaluate(() => {
      state.xp = 600;
      state.stageIndex = 3;
      state.born = Date.now() - 13 * 86400000;
      state.inventory['acc-baby-1'] = 1;
      state.inventory['acc-baby-4'] = 1;
      state.worn = { wear: 'acc-baby-1', place: 'acc-baby-4' };
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#room-art [data-worn="acc-baby-1"]').count(), 1);
    assert.equal(await page.locator('#room-art [data-worn="acc-baby-4"]').count(), 1);
    await page.locator('nav [data-page="growth"]').click();
    assert.equal(await page.locator('#secondary-page .stage-thumb').count(), 4);
    assert.match(await page.locator('#secondary-page').innerText(), /襁褓/);
    assert.match(await page.locator('#secondary-page').innerText(), /小小侠客/);
    await page.evaluate(() => { state.health = 29; localStorage.setItem('slow-growing-v2', JSON.stringify(state)); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('#health-value').innerText(), /29 \/ 100/);
    assert.equal(await page.locator('#health-fill').getAttribute('data-tier'), 'sick');
    assert.equal(await page.locator('#room-art .sick-flag').count(), 1);
    assert.match(await page.locator('#room-art').getAttribute('data-scene-key'), /:sick$/);
    await page.locator('nav [data-page="supplies"]').click();
    await page.locator('[data-filter="medical"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /安心药箱/);
    await page.locator('[data-buy="medicine-kit"]').click();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')))).inventory['medicine-kit'], 1);
    await page.locator('[data-page="pack"]').last().click();
    assert.match(await page.locator('#secondary-page').innerText(), /医疗照护/);
    await page.locator('#secondary-page [data-toolbox="medicine-kit"]').click();
    const healed = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.ok(Math.abs(healed.health - 69) < 0.01);
    assert.equal(healed.inventory['medicine-kit'], 0);
    assert.equal(await page.locator('#health-fill').getAttribute('data-tier'), 'low');
    assert.equal(await page.locator('#room-art .sick-flag').count(), 0);
    await page.evaluate(() => { state.health = 15; state.criticalAt = null; state.needs = [80, 80, 80, 80]; state.points = 100; localStorage.setItem('slow-growing-v2', JSON.stringify(state)); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#critical-banner').isVisible(), true);
    assert.match(await page.locator('#critical-banner').innerText(), /虚弱|风险/);
    assert.equal(await page.locator('#health-fill').getAttribute('data-tier'), 'critical');
    assert.equal(await page.locator('#room-art .sick-flag').count(), 1);
    assert.equal(await page.locator('#toolbox-card').isVisible(), true);
    assert.match(await page.locator('#toolbox-card').innerText(), /健康工具箱/);
    assert.match(await page.locator('#toolbox-card').innerText(), /回春灵药/);
    await page.locator('#toolbox-card .toolbox-item', { hasText: '回春灵药' }).locator('[data-page="supplies"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /回春灵药/);
    await page.locator('[data-buy="revive-elixir"]').click();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')))).inventory['revive-elixir'], 1);
    await page.locator('nav [data-page="home"]').click();
    await page.locator('[data-toolbox="revive-elixir"]').click();
    const elixirUsed = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.ok(elixirUsed.health >= 74 && elixirUsed.health <= 77);
    assert.equal(elixirUsed.inventory['revive-elixir'], 0);
    assert.equal(await page.locator('#toolbox-card').isVisible(), false);
    await page.evaluate(() => {
      state.health = 0;
      state.criticalAt = Date.now() - 3600000;
      state.points = 120;
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#critical-banner').isVisible(), true);
    assert.match(await page.locator('#critical-banner').innerText(), /病危/);
    assert.match(await page.locator('#critical-banner').innerText(), /小时/);
    assert.equal(await page.locator('#critical-banner .critical-copy').count(), 1);
    // In critical care the feeding cards are greyed out, their buttons are
    // disabled, and clicking neither opens the care dialog nor starts anything.
    const blockedCare = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.care-card')].find(c => c.querySelector('[data-care="food"]'));
      const btn = card.querySelector('.care-action');
      btn.click();
      const afterBtn = document.getElementById('care-dialog').open;
      showCare('food');
      const afterGuard = document.getElementById('care-dialog').open;
      return {
        blocked: card.classList.contains('blocked'),
        disabled: btn.disabled,
        label: btn.textContent,
        status: card.querySelector('.care-due').textContent,
        afterBtn, afterGuard
      };
    });
    assert.equal(blockedCare.blocked, true);
    assert.equal(blockedCare.disabled, true);
    assert.match(blockedCare.label, /病危中/);
    assert.match(blockedCare.status, /病危了/);
    assert.equal(blockedCare.afterBtn, false);
    assert.equal(blockedCare.afterGuard, false);
    await page.setViewportSize({ width: 375, height: 812 });
    const bannerLayout = await page.locator('#critical-banner').evaluate(el => {
      const s = getComputedStyle(el);
      return { pos: s.position, dir: s.flexDirection };
    });
    assert.equal(bannerLayout.pos, 'relative');
    assert.equal(bannerLayout.dir, 'column');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#revive-button').click();
    await page.waitForTimeout(400);
    const revived = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.ok(Math.abs(revived.health - 60) < 0.01);
    assert.equal(revived.criticalAt, null);
    assert.equal(await page.locator('#critical-banner').isVisible(), false);
    await page.evaluate(() => {
      state.health = 0;
      state.criticalAt = Date.now() - 25 * 3600000;
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#room-art .memorial').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => state.status), 'left');
    const memorialText = await page.locator('#room-art .memorial').innerText();
    assert.match(memorialText, /阿团被接到了远方|已经离开|这一季/);
    assert.match(memorialText, /相伴 \d+ 天/);
    assert.match(memorialText, /亲密度/);
    assert.equal(await page.locator('#restart-button').isVisible(), true);
    assert.equal(await page.locator('#care-section').isHidden(), true);
    assert.equal(await page.locator('#bond-card').isHidden(), true);
    assert.equal(await page.locator('#bottom-grid').isHidden(), true);
    assert.equal(await page.locator('#pet-touch').isHidden(), true);
    assert.equal(await page.locator('.status-card').isHidden(), true);
    assert.match(await page.locator('#room-weather').innerText(), /°C/);
    assert.equal(await page.locator('#room-weather').evaluate(el => getComputedStyle(el).display !== 'none'), true);
    await page.setViewportSize({ width: 375, height: 812 });
    const memorialLayout = await page.locator('#room-art .memorial').evaluate(el => {
      const card = el.closest('.room-card');
      const art = el.parentElement;
      const btn = el.querySelector('#restart-button');
      const cs = getComputedStyle(card);
      const artCs = getComputedStyle(art);
      const btnBox = btn.getBoundingClientRect();
      return {
        overflow: cs.overflow,
        artPos: artCs.position,
        btnHeight: btnBox.height,
        artGrows: art.clientHeight + 1 >= el.scrollHeight,
        clipped: el.scrollHeight > art.clientHeight + 2
      };
    });
    assert.equal(memorialLayout.overflow, 'visible');
    assert.equal(memorialLayout.artPos, 'relative');
    assert.ok(memorialLayout.btnHeight >= 40);
    assert.equal(memorialLayout.artGrows, true);
    assert.equal(memorialLayout.clipped, false);
    assert.equal(await page.locator('#room-weather').evaluate(el => getComputedStyle(el).display !== 'none'), true);
    assert.match(await page.locator('#room-weather').innerText(), /°C/);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#restart-button').click();
    await page.locator('#adopt-dialog').waitFor({ state: 'visible' });
    await page.locator('[data-adopt="dog"]').click();
    await page.locator('#adopt-confirm').click();
    assert.match(await page.locator('#companion-chip').innerText(), /麦芽/);
    const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(fresh.selected, 'dog');
    assert.equal(fresh.health, 100);
    assert.equal(fresh.status, 'alive');
    await page.evaluate(() => { state.momentDueAt = Date.now() - 1000; });
    await page.locator('#moment-card').waitFor({ state: 'visible', timeout: 2000 });
    assert.match(await page.locator('#moment-card').innerText(), /嗝|球|噩梦/);
    const habit = await page.locator('#room-art').getAttribute('data-habit');
    assert.ok(['wag', 'spin', 'run'].includes(habit), `dog habit was ${habit}`);
    const momentHit = await page.evaluate(() => {
      const before = state.bond;
      document.getElementById('moment-hit').click();
      // A daily-task reward may follow the bond log, so scan recent entries.
      const recent = state.logs.slice(-3).map(l => l.text).join('\n');
      return { before, bond: state.bond, log: recent };
    });
    assert.ok(Math.abs(momentHit.bond - (momentHit.before + 2)) < 0.01);
    assert.match(momentHit.log, /亲密度 \+2/);
    await page.evaluate(() => { state.momentDueAt = Date.now() - 1000; momentQuietUntil = 0; document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('#moment-card').waitFor({ state: 'visible', timeout: 2000 });
    assert.match(await page.locator('#moment-card').innerText(), /嗝|球|噩梦/);
    await page.locator('#moment-hit').click();
    assert.equal(await page.locator('#moment-card').isVisible(), false);
    // A growth-stage promotion shows a one-time memorial card over the room.
    await page.evaluate(() => {
      window.__stageUpRestore = { xp: state.xp, born: state.born, stageIndex: state.stageIndex };
      lastStageIndex = 0;
      state.xp = 600;
      state.born = Date.now() - 13 * 86400000;
      render();
    });
    await page.locator('#stage-up').waitFor({ state: 'visible', timeout: 2000 });
    assert.match(await page.locator('#stage-up').innerText(), /进入新的阶段/);
    await page.locator('#stage-up-close').click();
    assert.equal(await page.locator('#stage-up').isVisible(), false);
    await page.evaluate(() => {
      const r = window.__stageUpRestore;
      state.xp = r.xp;
      state.born = r.born;
      state.stageIndex = r.stageIndex;
      lastStageIndex = r.stageIndex;
      delete window.__stageUpRestore;
      render();
    });
    await page.locator('aside [data-page="settings"]').click();
    await page.locator('#nanny-enabled').check();
    assert.equal(await page.evaluate(() => localStorage.getItem('slow-growing-nanny')), '1');
    await page.locator('nav [data-page="home"]').click();
    assert.match(await page.locator('#nanny-chip').innerText(), /管家托管中/);
    const nannyRun = await page.evaluate(() => {
      state.needs = [40, 100, 100, 100];
      state.lastCare = {};
      const id = Object.keys(state.inventory).find(key => key.includes('milk'));
      const before = state.inventory[id];
      runNanny();
      return { delta: before - state.inventory[id], need: state.needs[0], task: state.task };
    });
    assert.equal(nannyRun.delta, 2);
    assert.ok(nannyRun.need > 40);
    assert.equal(nannyRun.task, null);
    await page.locator('#nanny-chip').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('slow-growing-nanny')), '0');
    assert.equal(await page.locator('#nanny-chip').isVisible(), false);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    for (let attempt = 0, shot = false; !shot; attempt++) {
      try { await page.screenshot({ path: '/tmp/opencode/slow-growing-v2.png', fullPage: true }); shot = true; }
      catch (error) { if (attempt >= 2) throw error; }
    }
    assert.deepEqual(errors, []);
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    await mobile.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await mobile.locator('[data-adopt="cat"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.locator('#adopt-confirm').click();
    await mobile.locator('#header-settings').click();
    await mobile.locator('#bgm-enabled').check();
    await mobile.locator('#bgm-style').selectOption('music');
    await mobile.locator('nav [data-page="home"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.locator('#care-cards [data-care="food"]').click();
    await mobile.locator('#care-toggle').tap();
    await mobile.waitForTimeout(800);
    assert.equal(await mobile.evaluate(() => window.GameAudio.active), true);
    assert.equal(await mobile.evaluate(() => window.GameAudio.blocked), false);
    await mobile.locator('#care-dialog .close-button').click();
    await mobile.locator('nav [data-page="supplies"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.close();
    const plantPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await plantPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await plantPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
    await plantPage.locator('[data-adopt="plant"]').click();
    await plantPage.locator('#adopt-confirm').click();
    assert.match(await plantPage.locator('#companion-chip').innerText(), /团子/);
    assert.match(await plantPage.locator('#care-cards').innerText(), /浇水/);
    assert.match(await plantPage.locator('#care-cards').innerText(), /施肥/);
    assert.match(await plantPage.locator('#needs').innerText(), /水分/);
    assert.match(await plantPage.locator('#needs').innerText(), /养分/);
    assert.match(await plantPage.locator('#needs').innerText(), /阳光/);
    assert.equal(await plantPage.locator('#room-art [data-bg="plant"]').count(), 1);
    assert.equal(await plantPage.locator('#room-art [data-character="plant"]').count(), 1);
    assert.match(await plantPage.locator('#room-art').getAttribute('data-scene-key'), /plant:0/);
    assert.match(await plantPage.locator('#pet-touch').innerText(), /碰碰叶子/);
    await plantPage.evaluate(() => { state.momentDueAt = Date.now() - 1000; });
    await plantPage.waitForTimeout(500);
    assert.equal(await plantPage.locator('#moment-card').isVisible(), false);
    const plantSave = await plantPage.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(plantSave.selected, 'plant');
    assert.equal(plantSave.worn.wear, null);
    assert.equal(plantSave.worn.place, null);
    await plantPage.evaluate(() => {
      state.inventory['acc-plant-1'] = 1;
      state.worn = 'acc-plant-1';
      localStorage.setItem('slow-growing-v2', JSON.stringify(state));
    });
    await plantPage.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await plantPage.locator('#room-art [data-worn="acc-plant-1"]').count(), 1);
    const potHtml = await plantPage.locator('#room-art').innerHTML();
    assert.ok(potHtml.indexOf('data-worn="acc-plant-1"') < potHtml.indexOf('data-character="plant"'));
    assert.match(potHtml, /overflow="hidden"/);
    assert.equal(potHtml.includes('clip-path'), false);
    await plantPage.close();

    // Night window settings: defaults, persistence across reload, engine integration.
    const nightPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await nightPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await nightPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      await nightPage.locator('[data-adopt="cat"]').click();
      await nightPage.locator('#adopt-confirm').click();
      await nightPage.locator('aside [data-page="settings"]').click();
      await nightPage.waitForTimeout(200);
      assert.equal(await nightPage.locator('#night-enabled').isChecked(), true);
      assert.equal(await nightPage.locator('#night-start').inputValue(), '22');
      assert.equal(await nightPage.locator('#night-end').inputValue(), '6');
      await nightPage.selectOption('#night-start', '23');
      await nightPage.selectOption('#night-end', '7');
      await nightPage.waitForTimeout(150);
      assert.deepEqual(await nightPage.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-night'))),
        { enabled: true, start: 23, end: 7 });
      await nightPage.reload({ waitUntil: 'domcontentloaded' });
      await nightPage.locator('aside [data-page="settings"]').click();
      await nightPage.waitForTimeout(200);
      assert.equal(await nightPage.locator('#night-enabled').isChecked(), true);
      assert.equal(await nightPage.locator('#night-start').inputValue(), '23');
      assert.equal(await nightPage.locator('#night-end').inputValue(), '7');
      assert.equal(await nightPage.locator('#care-pace').inputValue(), 'normal');
      await nightPage.selectOption('#care-pace', 'relaxed');
      await nightPage.waitForTimeout(150);
      assert.equal(await nightPage.evaluate(() => localStorage.getItem('slow-growing-pace')), 'relaxed');
      await nightPage.reload({ waitUntil: 'domcontentloaded' });
      await nightPage.locator('aside [data-page="settings"]').click();
      await nightPage.waitForTimeout(200);
      assert.equal(await nightPage.locator('#care-pace').inputValue(), 'relaxed');
      await nightPage.locator('nav [data-page="home"]').click();
      assert.match(await nightPage.locator('#care-cards').innerText(), /每 4.5 小时关注一次/);
      const windowed = await nightPage.evaluate(() => {
        const H = 3600000;
        const d = new Date(); d.setHours(13, 0, 0, 0);
        state.born = d.getTime() - 86400000;
        state.updated = d.getTime();
        state.needs = [0, 0, 0, 0];
        state.health = 3;
        state.logs = [];
        state.lastCare = {};
        localStorage.setItem('slow-growing-v2', JSON.stringify(state));
        const G = window.GameEngine;
        G.refresh(state, d.getTime() + H);
        const remaining24 = G.criticalRemaining(state, d.getTime() + H + 24 * H);
        localStorage.setItem('slow-growing-v2', JSON.stringify(state));
        return { tier: G.healthTier(state), remaining24 };
      });
      assert.equal(windowed.tier, 'critical');
      assert.ok(Math.abs(windowed.remaining24 - 4) < 1e-6);
      await nightPage.locator('aside [data-page="home"]').click();
      await nightPage.waitForTimeout(300);
      assert.match(await nightPage.locator('#critical-banner').innerText(), /约 \d+ 小时后会悄悄离开/);
      await nightPage.close();
      console.log('通过：单对象选择、签到、自动照护、暂停、刷新恢复、后台暂停、库存、商城、情绪互动、健康生病、病危复活、离场留念、背景音乐设置、夜间节奏设置、自定义名字、养育课堂和三种视口。');

    // Custom pet name: input at adoption, persisted save, engine logs follow.
    const namedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await namedPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await namedPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      await namedPage.locator('[data-adopt="dog"]').click();
      assert.match(await namedPage.locator('#adopt-name').getAttribute('placeholder'), /麦芽/);
      await namedPage.locator('#adopt-name').fill('豆包');
      await namedPage.locator('#adopt-confirm').click();
      await namedPage.waitForTimeout(300);
      assert.match(await namedPage.locator('#companion-chip').innerText(), /豆包/);
      assert.equal(await namedPage.locator('#pet-name').innerText(), '豆包');
      assert.equal(await namedPage.locator('#room-name').innerText(), '豆包的小窝');
      const namedSave = await namedPage.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
      assert.equal(namedSave.name, '豆包');
      await namedPage.locator('aside [data-page="diary"]').click();
      await namedPage.waitForTimeout(200);
      assert.match(await namedPage.locator('#secondary-page').innerText(), /确认陪伴豆包成长/);
      await namedPage.reload({ waitUntil: 'domcontentloaded' });
      await namedPage.waitForTimeout(400);
      assert.equal(await namedPage.locator('#pet-name').innerText(), '豆包');
    } finally {
      await namedPage.close().catch(() => {});
    }

    // Knowledge classroom: nav entry, tabs, read tracking, care-completion tip.
    const knPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await knPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await knPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      await knPage.locator('[data-adopt="cat"]').click();
      await knPage.locator('#adopt-confirm').click();
      await knPage.waitForTimeout(300);
      await knPage.locator('aside [data-page="knowledge"]').click();
      await knPage.waitForTimeout(200);
      assert.match(await knPage.locator('#secondary-page').innerText(), /养育课堂/);
      assert.match(await knPage.locator('.points-pill').innerText(), /已了解 0 \/ 24 篇/);
      assert.equal(await knPage.locator('.knowledge-tabs').count(), 0);
      const firstCard = knPage.locator('.knowledge-card').first();
      await firstCard.click();
      await knPage.waitForTimeout(200);
      assert.equal(await knPage.locator('.knowledge-card.open').count(), 1);
      assert.match(await knPage.locator('.points-pill').innerText(), /已了解 1 \/ 24 篇/);
      await knPage.reload({ waitUntil: 'domcontentloaded' });
      await knPage.locator('aside [data-page="knowledge"]').click();
      await knPage.waitForTimeout(200);
      assert.match(await knPage.locator('.points-pill').innerText(), /已了解 1 \/ 24 篇/);
      // Complete a feed care through the real tick loop to see the tip box.
      await knPage.locator('aside [data-page="home"]').click();
      await knPage.waitForTimeout(300);
      await knPage.evaluate(() => {
        state.needs = [30, 75, 65, 70];
        delete state.lastCare.food;
        state.task = null;
        localStorage.setItem('slow-growing-v2', JSON.stringify(state));
      });
      await knPage.locator('#care-cards [data-care="food"]').click();
      assert.match(await knPage.locator('#care-tip').innerText(), /养护小知识/);
      await knPage.locator('#care-toggle').click();
      await knPage.waitForTimeout(300);
      await knPage.evaluate(() => {
        state.task.elapsed = state.task.seconds - 0.5;
        localStorage.setItem('slow-growing-v2', JSON.stringify(state));
      });
      await knPage.reload({ waitUntil: 'domcontentloaded' });
      await knPage.locator('#care-cards [data-care="food"]').click();
      assert.match(await knPage.locator('#care-tip').innerText(), /养护小知识/);
      const liveTitle = await knPage.locator('#care-tip strong').innerText();
      await knPage.locator('#care-toggle').click();
      await knPage.locator('#info-dialog').waitFor({ state: 'visible' });
      assert.match(await knPage.locator('#info-dialog .tip-box').innerText(), /养护小知识/);
      assert.equal(await knPage.locator('#info-dialog .tip-box strong').innerText(), liveTitle);
      assert.match(await knPage.locator('#knowledge-link').innerText(), /养育课堂/);
      await knPage.locator('#knowledge-link').click();
      await knPage.waitForTimeout(200);
      assert.match(await knPage.locator('#secondary-page').innerText(), /养育课堂/);
      await knPage.close();
    } finally {
      await knPage.close().catch(() => {});
    }

    // Backpack: starter supplies handoff to care dialog, empty-state handoff to shop.
    const packPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await packPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await packPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      await packPage.locator('[data-adopt="cat"]').click();
      await packPage.locator('#adopt-confirm').click();
      await packPage.locator('aside [data-page="pack"]').click();
      await packPage.waitForTimeout(200);
      assert.match(await packPage.locator('#secondary-page').innerText(), /照护物资/);
      assert.match(await packPage.locator('#secondary-page').innerText(), /剩余 5 份/);
      await packPage.locator('#secondary-page [data-care="food"]').click();
      await packPage.locator('#care-dialog').waitFor({ state: 'visible' });
      await packPage.locator('#care-dialog .close-button').click();
      // Dye variant: buy a cat accessory, tint it cool, verify scene update and persistence.
      await packPage.locator('aside [data-page="supplies"]').click();
      await packPage.waitForTimeout(200);
      await packPage.locator('[data-buy="acc-cat-1"]').click();
      await packPage.waitForTimeout(200);
      await packPage.locator('aside [data-page="pack"]').click();
      await packPage.waitForTimeout(200);
      await packPage.locator('[data-wear="acc-cat-1"]').click();
      await packPage.waitForTimeout(200);
      await packPage.locator('[data-dye="acc-cat-1"][data-variant="2"]').click();
      await packPage.waitForTimeout(200);
      assert.match(await packPage.locator('[data-dye="acc-cat-1"][data-variant="2"]').getAttribute('class'), /active/);
      assert.match(await packPage.locator('#room-art').innerHTML(), /hue-rotate\(200deg\)/);
      await packPage.reload({ waitUntil: 'domcontentloaded' });
      await packPage.waitForTimeout(300);
      await packPage.locator('aside [data-page="pack"]').click();
      await packPage.waitForTimeout(200);
      assert.match(await packPage.locator('[data-dye="acc-cat-1"][data-variant="2"]').getAttribute('class'), /active/);
      await packPage.evaluate(() => { state.inventory = {}; state.worn = { wear: null, place: null }; state.tints = {}; localStorage.setItem('slow-growing-v2', JSON.stringify(state)); });
      await packPage.reload({ waitUntil: 'domcontentloaded' });
      await packPage.locator('aside [data-page="pack"]').click();
      await packPage.waitForTimeout(200);
      assert.match(await packPage.locator('#secondary-page').innerText(), /背包还空着/);
      await packPage.locator('#secondary-page [data-page="supplies"]').click();
      await packPage.waitForTimeout(200);
      assert.match(await packPage.locator('#secondary-page').innerText(), /生活小铺/);
    } finally {
      await packPage.close().catch(() => {});
    }
    // Phase 0 economy: daily task card + the vigil safety net.
    const ecoPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await ecoPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await ecoPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      await ecoPage.locator('[data-adopt="cat"]').click();
      await ecoPage.locator('#adopt-confirm').click();
      await ecoPage.waitForTimeout(300);
      assert.equal(await ecoPage.locator('#task-card').isVisible(), true);
      assert.equal(await ecoPage.locator('#task-card .task-row').count(), 3);
      assert.match(await ecoPage.locator('#task-card').innerText(), /今日小任务/);
      await ecoPage.evaluate(() => { state.needs = [30, 75, 65, 70]; delete state.lastCare.food; state.task = null; localStorage.setItem('slow-growing-v2', JSON.stringify(state)); });
      await ecoPage.locator('#care-cards [data-care="food"]').click();
      await ecoPage.locator('#care-toggle').click();
      await ecoPage.evaluate(() => { state.task.elapsed = state.task.seconds - 0.4; });
      await ecoPage.waitForFunction(() => !!document.querySelector('#task-card .task-row.done'), null, { timeout: 8000 });
      await ecoPage.locator('.close-button-inline').click().catch(() => {});
      const vig = await ecoPage.evaluate(() => {
        state.points = 10; state.inventory = {}; state.health = 0; state.criticalAt = state.updated; state.task = null;
        render();
        const btn = document.getElementById('vigil-button');
        return { hasBtn: !!btn, text: btn ? btn.textContent : '' };
      });
      assert.equal(vig.hasBtn, true);
      assert.match(vig.text, /守夜求援/);
      await ecoPage.locator('#vigil-button').click();
      await ecoPage.locator('#vigil-dialog').waitFor({ state: 'visible' });
      assert.match(await ecoPage.locator('#vigil-timer').innerText(), /^\d{2}:\d{2}$/);
      const claimed = await ecoPage.evaluate(() => { const err = window.GameEngine.claimVigil(state, Date.now()); render(); return { err, points: state.points, hasBtn: !!document.getElementById('vigil-button') }; });
      assert.equal(claimed.err, null);
      assert.equal(claimed.points, 60);
      assert.equal(claimed.hasBtn, false);
      await ecoPage.close();
    } finally {
      await ecoPage.close().catch(() => {});
    }
    // Hidden ops panel + inline ad slots.
    const opsPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    try {
      await opsPage.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await opsPage.locator('#adopt-dialog').waitFor({ state: 'visible' });
      assert.equal(await opsPage.locator('#ad-top').isHidden(), true);
      assert.equal(await opsPage.locator('#ad-bottom').isHidden(), true);
      // Opens only through the secret hash token; there is no visible button.
      await opsPage.evaluate(() => { location.hash = 'ops=mkx7d2'; });
      await opsPage.waitForTimeout(300);
      assert.equal(await opsPage.locator('#ops-root').isVisible(), true);
      await opsPage.locator('#ops-add').click();
      await opsPage.locator('.ops-ad').last().locator('[data-f="text"]').fill('后台新增的公告');
      await opsPage.locator('#ops-save').click();
      await opsPage.locator('#ops-close').click();
      assert.equal(await opsPage.locator('#ops-root').isHidden(), true);
      await opsPage.waitForTimeout(150);
      assert.equal(await opsPage.locator('#ad-bottom').isVisible(), true);
      assert.match(await opsPage.locator('#ad-bottom').innerText(), /后台新增的公告/);
      const adPos = await opsPage.locator('#ad-bottom').evaluate(el => getComputedStyle(el).position);
      assert.equal(adPos, 'static');
      await opsPage.locator('#ad-bottom [data-ad-close]').first().click();
      assert.equal(await opsPage.locator('#ad-bottom').isHidden(), true);
      await opsPage.evaluate(() => { window.Site.reset(); window.Site.clearDismissed(); });
      await opsPage.close();
    } finally {
      await opsPage.close().catch(() => {});
    }
  } finally {
      await nightPage.close().catch(() => {});
    }
  } finally {
    await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 3000))]);
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
