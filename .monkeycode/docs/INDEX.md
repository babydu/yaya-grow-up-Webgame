# 慢慢长大

温柔视觉与真实时间成本相结合的浏览器养成小游戏。首次从小猫橘汐、小狗麦芽、宝宝阿团、小植物团子四个对象中选择一个，持续照护与成长。

## 启动
```bash
python3 -m http.server 8000 --directory /workspace
```

入口为 index.html；规则引擎为 engine.js；界面逻辑为 game.js；插画为 visuals.js；背景音乐为 audio.js（Web Audio 本地合成音景，零外部音频文件）；样式为 style.css 与 enhancements.css。运行应用无需安装依赖。

美术资产位于 assets/：bg-{type}.jpg 为四间手绘房间背景，stages/{type}-{1..4}.png 为阶段抠图立绘，acc/{type}-{n}.png 为饰物抠图；来源为设计工具导出的角色设定集，重生成管线见 tools/prepare_assets.py（rembg 抠图 + 缩放，需在解压设计包后运行）。

存档保存在当前浏览器 localStorage（v2 含 worn 穿戴饰物与 health/status/criticalAt/leftAt 健康字段），支持第一版迁移、导出和导入。提醒仅在应用内生效。照护保持页面可见即可计时，切后台暂停；成长使用现实 1 天对应游戏 30 天的压缩日历。生活小铺含 16 件随身饰物（积分兑换、按阶段解锁、可穿戴）与医疗照护类商品（安心药箱、回春灵药）。

健康系统：需求长期低于 10 时健康度按每项 -0.75/真实小时流失（上限 3/h），全部需求 ≥30 时 +1/h 回复，每次有效照护 +2；分级为萎靡（<70）、生病（<40，成长经验减半、房间生病角标）、病重（<20，禁触摸与玩耍）。健康度归零进入 24 真实小时病危宽限期，可用回春灵药复活或经持续照护自然回升至 20 解除；超时角色按类型叙事永久离开（baby 被家人接走 / cat·dog 出门远行 / plant 化作春泥），留念面板展示陪伴履历后可重新领养。旧 v2 存档自动补健康默认值。

## 验证
```bash
node --test engine.test.cjs visuals.test.cjs audio.test.cjs
node browser.test.cjs
```

浏览器测试依赖全局安装的 @playwright/test、Chromium 及对应 Linux 系统库。当前测试使用 channel chromium，可使用完整 Chromium 包，无需 headless-shell。浏览器测试覆盖 375、768、1440 像素宽度。

## 版本
app.js 与 test.cjs 为保留的第一版实现，当前页面使用 v2 模块。新增方案位于 .monkeycode/specs/lifelike-care-v2/、ambient-bgm/、background-care/、bgm-now-playing/、design-pack-integration/、health-sickness-system/。
