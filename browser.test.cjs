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
    await page.locator('[data-adopt="baby"]').click();
    await page.locator('#adopt-confirm').click();
    assert.match(await page.locator('#companion-chip').innerText(), /小满/);
    await page.locator('#checkin-button').click();
    assert.match(await page.locator('#wallet-points').innerText(), /71/);
    await page.locator('[data-care="food"]').click();
    await page.locator('#care-toggle').click();
    await page.waitForTimeout(1300);
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
    await page.locator('[data-buy="baby-milk"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('slow-growing-v2')));
    assert.equal(saved.inventory['baby-milk'], 9);
    assert.equal(saved.points, 61);
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
    assert.match(await page.locator('#secondary-page').innerText(), /成长手册/);
    await page.locator('nav [data-page="diary"]').click();
    assert.match(await page.locator('#secondary-page').innerText(), /喂养完成/);
    await page.locator('nav [data-page="home"]').click();
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
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.screenshot({ path: '/tmp/opencode/slow-growing-v2.png', fullPage: true });
    assert.deepEqual(errors, []);
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await mobile.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    await mobile.locator('[data-adopt="cat"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.locator('#adopt-confirm').click();
    await mobile.locator('nav [data-page="supplies"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.close();
    console.log('通过：单对象选择、签到、自动照护、暂停、刷新恢复、后台暂停、库存、商城、情绪互动、背景音乐设置和三种视口。');
  } finally {
    await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 3000))]);
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
