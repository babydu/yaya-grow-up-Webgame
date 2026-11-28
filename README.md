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

### Docker / 1Panel 部署（推荐，最省事）

项目自带 `Dockerfile` + `docker-compose.yml`，零 npm 依赖，镜像秒级构建。
统计数据与全局配置通过 `./data` 挂载持久化，升级不丢。

**资源占用（实测）**：镜像拉取约 50 MB、运行时磁盘约 190 MB；空闲内存
22 MB、空闲 CPU 0%，1 核 1G 的入门服务器即可。容器有 256 MB 内存上限
保险，可在 1Panel 资源面板直观查看。默认对外端口 **8765**（避开常见
的 8080），想换在 `.env` 里改 `PORT` 后重跑 `./deploy.sh`。

```bash
# 国内服务器一键安装（自动探测代理/GitHub 镜像加速 clone）
bash <(curl -fsSL https://ghfast.top/https://raw.githubusercontent.com/babydu/yaya-grow-up-Webgame/main/install.sh)

# 或者手动克隆再部署
git clone https://github.com/babydu/yaya-grow-up-Webgame.git
cd yaya-grow-up-Webgame
./deploy.sh

# 之后每次升级
./upgrade.sh
```

`upgrade.sh` 与 `deploy.sh` 内置国内网络优化：按优先级自动尝试环境变量
代理 → 本地常见代理端口（Clash/V2Ray 等）→ GitHub 镜像 → 直连；基础
镜像 `node:22-alpine` 也依次尝试 Docker 加速源后打回原名。全部失败回退
直连，不影响流程。想固定通道可在 `.env` 加 `PROXY=http://127.0.0.1:7890`
或 `GITHUB_MIRROR=ghfast.top`；`NO_MIRROR=1` 强制直连。

1Panel 侧的收尾（约 3 分钟）：

1. 面板「网站」→ 创建网站 → 反向代理，目标 `http://127.0.0.1:8765`
2. 站点设置 → HTTPS → 申请 Let's Encrypt 证书（一键签发）
3. 打开 `https://你的域名/#ops=<adminToken>`（token 在 `config.js`）
4. 后台顶部「运维写入密钥」填入 `.env` 里的 `OPS_TOKEN`，发布一次，黄色告警变绿即完成

> PWA（离线可玩、安装到桌面）要求 HTTPS，第 2 步签发证书后自动生效。

### 直接运行 Node（无 Docker 的替代）

```bash
# 1) 生成随机写入密钥
node server.js --print-token

# 2) 用它启动（端口自定义）
OPS_TOKEN=<上一步的串> PORT=8765 node server.js
```

### 纯静态（零依赖，不可后台发布/无统计）

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8000
# 或
npx serve
```

后台改配置用「导出 data/site-config.json」替换部署文件；PWA 的
service worker 同样需要 HTTPS 才生效。

.env 与两个脚本说明：

| 文件 | 作用 |
|---|---|
| `.env` | `deploy.sh` 自动生成的 `OPS_TOKEN`，升级沿用，不要删 |
| `deploy.sh` | 首次部署；修改 compose 后再跑一次即重应用 |
| `upgrade.sh` | 备份 `data/` → `git pull` → 重建容器，数据零丢失 |

> 首次部署的完整引导（入口 token 与写入密钥的区别、验证步骤）见
> [`.monkeycode/docs/DEPLOY.md`](.monkeycode/docs/DEPLOY.md) 第二节。

`server.js` 同时提供静态站点与五个 API：

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/site-config` | GET | 公开读取全局配置（所有访客） |
| `/api/site-config` | POST | 需 `x-admin-token`，写入全局配置 |
| `/api/stat` | POST | 匿名统计上报（白名单 + 钳制 + 限流） |
| `/api/stats` | GET | 需 token，读取累计统计 |
| `/api/presence` | GET | 需 token，读取当前在线 / 活跃人数 |
| `/api/ops-status` | GET | 需 token，写入密钥是否已受 OPS_TOKEN 保护 |

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

`adminToken` 定义在 `config.js`。**注意它对所有访客可见，只负责隐藏面板**；真正保护「发布」的是服务器环境变量 `OPS_TOKEN`。首次部署时：

1. `node server.js --print-token` 生成随机密钥
2. `OPS_TOKEN=<密钥> PORT=8765 node server.js` 启动
3. 后台「运维写入密钥」填入同一串并发布验证

后台打开时会自动检测并在顶部显示「部署安全」状态：未设置 `OPS_TOKEN` 显示黄色引导，设置后显示绿色已保护。后台功能：

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
