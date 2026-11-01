# 慢慢长大

温柔视觉与真实时间成本相结合的浏览器养成小游戏。首次从小猫、小狗、宝宝中选择一个对象，持续照护与成长。

## 启动
```bash
python3 -m http.server 8000 --directory /workspace
```

入口为 index.html；规则引擎为 engine.js；界面逻辑为 game.js；插画为 visuals.js；背景音乐为 audio.js（Web Audio 本地合成音景，零外部音频文件）；样式为 style.css 与 enhancements.css。运行应用无需安装依赖。

存档保存在当前浏览器 localStorage，支持第一版迁移、导出和导入。提醒仅在应用内生效。照护保持页面可见即可计时，切后台暂停；成长使用现实 1 天对应游戏 30 天的压缩日历。

## 验证
```bash
node --test engine.test.cjs visuals.test.cjs audio.test.cjs
node browser.test.cjs
```

浏览器测试依赖全局安装的 @playwright/test、Chromium 及对应 Linux 系统库。当前测试使用 channel chromium，可使用完整 Chromium 包，无需 headless-shell。浏览器测试覆盖 375、768、1440 像素宽度。

## 版本
app.js 与 test.cjs 为保留的第一版实现，当前页面使用 v2 模块。新增方案位于 .monkeycode/specs/lifelike-care-v2/ 与 .monkeycode/specs/ambient-bgm/。
