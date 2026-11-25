# 慢慢长大 · 把日子过成陪伴

一款温柔治愈的**浏览器养成小游戏**。从橘汐、麦芽、阿团、团子中选一个，陪它在真实时间里慢慢长大——喂养、清洁、陪伴、休息，把日子过成陪伴。

零框架、零构建依赖：纯原生 HTML/CSS/JavaScript，打开 `index.html` 即可游玩；可选搭配一个无第三方依赖的 Node 小后端，获得全局运营配置与匿名统计能力。

---

## 特色

- **真实时间养成**：成长使用「现实 1 天 ≈ 游戏 30 天」的压缩日历，照护保持页面可见即计时，切到后台自动暂停。
- **四个可养育对象**：小猫橘汐、小狗麦芽、宝宝阿团、小植物团子，各有独立的照护节奏、饰物与养护知识；领养时可自定义名字（最多 12 字）。
- **健康与病危系统**：需求长期过低会生病，健康归零进入 24 小时病危窗口；病危期照护封锁，须用回春灵药挽回，超时则按叙事永久离开（可重新领养）。
- **温柔的经济设计**：积分来自签到、照护与每日小任务；「守夜求援」保底让生存永不依赖付费；「贴心管家」托管按时扣费，引导亲自照护。
- **留存与记忆**：晋级纪念卡、纪念相册、每日小结；短时小事件（10 秒互动）与五段日夜问候让小屋有呼吸感。
- **养育课堂**：按当前角色推送 24 篇养护科普，本地静态内容，已读进度持久化。
- **隐藏运营后台**：通过带 token 的 URL 打开，可全站发布公告 / 管理广告 / 调整物品价格 / 查看统计，所有访客实时生效。
- **隐私克制的统计**：匿名、无 Cookie、无设备标识；可选接入 GA4（尊重 DNT / 需同意）。

## 在线试玩

- `index.html` 可直接由任意静态服务器托管，也可挂到 GitHub Pages / Netlify / Vercel。
- 想要运营后台与统计能力时，运行随附的 Node 服务（见下）。

## 快速开始

### 纯静态（零依赖）

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8000
# 或
npx serve
```

浏览器打开 `http://localhost:8000`。

### 带后端（推荐生产）

```bash
PORT=8080 OPS_TOKEN=你的密钥 node server.js
```

`server.js` 同时提供静态站点与三个 API：

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/site-config` | GET | 公开读取全局配置（所有访客） |
| `/api/site-config` | POST | 需 `x-admin-token`，写入全局配置 |
| `/api/stat` | POST | 匿名统计上报（白名单 + 钳制 + 限流） |
| `/api/stats` | GET | 需 token，读取累计统计 |
| `/api/presence` | GET | 需 token，读取当前在线 / 活跃人数 |

## 目录结构

```
index.html              入口页面（SEO / OG / JSON-LD 齐备）
engine.js               规则引擎：需求衰减、照护、健康、经济、存档校验
game.js                 界面编排与交互
visuals.js              立绘、场景与饰物定位
audio.js                Web Audio 本地合成音景（零音频文件）
knowledge.js            养育课堂科普内容
favicon.js              动态 favicon 与标签提示
site.js                 全局配置 / 广告 / 公告
stats.js                匿名统计上报
admin.js                隐藏运营后台
sanitize-html.js        白名单 HTML 净化（服务端 + 前端共用）
server.js               可选的 Node 静态 + API 服务
config.js               代码级默认配置（含后台入口 token）
data/                   全局配置与统计（运行时生成）
assets/                 美术资产（背景 / 阶段立绘 / 饰物）
tools/prepare_assets.py 美术资产重生成管线（rembg 抠图）
```

## 运营后台

后台**没有可见入口**，使用 URL hash 携带 token 打开：

```
https://你的域名/#ops=<adminToken>
```

`adminToken` 定义在 `config.js`。**生产环境请务必在服务器设置环境变量 `OPS_TOKEN`**（建议与入口 token 不同且足够随机），后台「运维写入密钥」填入同一串即可发布。后台功能：

- **公告**：顶部滚动条 / 进入弹窗，支持简单 HTML（白名单净化），新公告自动更新版本号
- **广告位**：顶部条幅 / 底部卡片，都在正常文档流中、可关闭、可排序
- **物品价格**：逐项修改（显示默认价），一键恢复默认
- **统计与分析**：累计指标、近 14 天活跃折线、24 小时分布、当前在线人数

> 安全说明：`config.js` 与 `data/site-config.json` 对访客可见，**不要**把真实口令或第三方密钥放进去。

## 统计与隐私

- 默认只采集**匿名聚合计数**（页面浏览、活跃时长、照护 / 领养 / 签到 / 晋级 / 积分收支等），无 Cookie、无设备标识、无 PII。
- 实时在线人数由本页内存临时 id 的心跳维护，**不落盘**，服务重启即清空。
- 第三方统计（GA4）默认不启用，加载时尊重 DNT 与可选的同意条。
- 合规与指标取舍详见 [.monkeycode/docs/STATS.md](.monkeycode/docs/STATS.md)。

## 开发与测试

```bash
# 单元测试（引擎 / 视觉 / 音频 / 服务端）
node --test engine.test.cjs visuals.test.cjs audio.test.cjs server.test.cjs

# 浏览器端到端测试（依赖全局 @playwright/test + Chromium）
node browser.test.cjs
```

浏览器测试覆盖 375 / 768 / 1440 三种视口宽度。

## 文档

- [.monkeycode/docs/INDEX.md](.monkeycode/docs/INDEX.md) — 玩法与机制总览
- [.monkeycode/docs/DEPLOY.md](.monkeycode/docs/DEPLOY.md) — 部署形态与运维指引
- [.monkeycode/docs/STATS.md](.monkeycode/docs/STATS.md) — 统计研判与合规说明

## 许可证

[MIT](LICENSE)
