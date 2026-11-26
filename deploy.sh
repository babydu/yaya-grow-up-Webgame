#!/usr/bin/env bash
# 首次部署：一键拉起容器。可重复运行，也用于修改 compose 后重应用。
set -euo pipefail

cd "$(dirname "$0")"

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
EOF
  echo "已生成 OPS_TOKEN 并写入 .env（请妥善保管，不要删除）"
fi

# 2) 构建并启动
$DC up -d --build

echo
echo "================ 已启动 ================"
echo "本机访问:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):8080"
echo
echo "下一步（在 1Panel 里做）:"
echo "  1. 「网站」→ 创建网站 → 反向代理，目标 http://127.0.0.1:8080"
echo "  2. 站点设置 → HTTPS → 申请 Let's Encrypt 证书（一键）"
echo "  3. 打开 https://你的域名/#ops=<adminToken> 进后台"
echo "     adminToken 在 config.js 的 window.SITE_CONFIG.adminToken"
echo "  4. 后台顶部「运维写入密钥」填入 .env 里的 OPS_TOKEN，发布一次"
echo "     黄色告警变绿即完成加固"
echo "========================================="
