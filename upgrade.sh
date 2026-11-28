#!/usr/bin/env bash
# 升级：拉新代码并重建容器，运行数据（统计/全局配置）不丢失。
set -euo pipefail

cd "$(dirname "$0")"

# 并发锁：与 deploy.sh 互斥，防止同时跑写坏 data/
exec 9>/tmp/yaya-grow-up-deploy.lock
if ! flock -n 9; then
  echo "另一个部署/升级正在运行，请等它完成后再试。"
  exit 1
fi

# shellcheck source=lib-network.sh
if [ -f ./lib-network.sh ]; then . ./lib-network.sh; else
  git_pull() { git pull --ff-only; }
fi

if [ ! -f .env ]; then
  echo "未找到 .env，请先运行 ./deploy.sh 完成首次部署。"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else echo "未检测到 docker compose，请安装或升级 Docker。"; exit 1; fi

echo "1/4 备份运行数据..."
rm -rf /tmp/yaya-data-backup
cp -r data /tmp/yaya-data-backup

echo "2/4 拉取最新代码..."
# 运行中的统计会写脏 data/，先还原成种子再拉，最后恢复
git checkout -- data/ 2>/dev/null || true
git_pull

echo "3/4 恢复运行数据..."
rm -rf data
mv /tmp/yaya-data-backup data

echo "4/4 重建容器..."
prepull_base node:22-alpine
$DC up -d --build

echo
echo "升级完成。可选清理旧镜像:  $DC image prune -f"
