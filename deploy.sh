#!/usr/bin/env bash
# 首次部署：一键拉起容器。可重复运行，也用于修改 compose 后重应用。
set -euo pipefail

cd "$(dirname "$0")"

# 并发锁：与 upgrade.sh 互斥，防止同时跑写坏 data/（锁定文件在 /tmp，
# 退出自动释放，服务器的其他服务完全无感）
exec 9>/tmp/yaya-grow-up-deploy.lock
if ! flock -n 9; then
  echo "另一个部署/升级正在运行，请等它完成后再试。"
  exit 1
fi

# shellcheck source=lib-network.sh
if [ -f ./lib-network.sh ]; then . ./lib-network.sh; else
  prepull_base() { :; }
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 docker。1Panel 用户请在面板「容器」中确认 Docker 已安装。"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else echo "未检测到 docker compose，请安装或升级 Docker。"; exit 1; fi

# 1) 生成写入密钥（只生成一次，之后升级会沿用）
if [ ! -f .env ]; then
  TOKEN=$(openssl rand -hex 24 2>/dev/null || node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  cat > .env <<EOF
# 后台「运维写入密钥」请填这一串（首次部署后到后台粘贴一次即可）
OPS_TOKEN=$TOKEN

# 对外端口（默认 8765，与常见 8080/Nginx 冲突避开）
# 改动后重新运行 ./deploy.sh，并同步 1Panel 反向代理目标端口
PORT=8765
EOF
  echo "已生成 OPS_TOKEN 并写入 .env（请妥善保管，不要删除）"
fi

# 2) 构建并启动
echo "加速准备: 拉取基础镜像（国内网络自动选代理/镜像源）"
prepull_base node:22-alpine
$DC up -d --build

PORT_VALUE=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2)
PORT_VALUE=${PORT_VALUE:-8765}

echo
echo "================ 已启动 ================"
echo "本机访问:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT_VALUE"
echo
echo "下一步（在 1Panel 里做）:"
echo "  1. 「网站」→ 创建网站 → 反向代理，目标 http://127.0.0.1:$PORT_VALUE"
echo "  2. 站点设置 → HTTPS → 申请 Let's Encrypt 证书（一键）"
echo "  3. 打开 https://你的域名/#ops=<adminToken> 进后台"
echo "     adminToken 在 config.js 的 window.SITE_CONFIG.adminToken"
echo "  4. 后台顶部「运维写入密钥」填入 .env 里的 OPS_TOKEN，发布一次"
echo "     黄色告警变绿即完成加固"
echo "========================================="
echo "提示: 想换端口就改 .env 里的 PORT，再跑一次 ./deploy.sh"
