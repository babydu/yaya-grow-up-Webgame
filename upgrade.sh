#!/usr/bin/env bash
# 升级：拉新代码并重建容器，运行数据（统计/全局配置）不丢失。
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "未找到 .env，请先运行 ./deploy.sh 完成首次部署。"
  exit 1
fi

echo "1/4 备份运行数据..."
rm -rf /tmp/yaya-data-backup
cp -r data /tmp/yaya-data-backup

echo "2/4 拉取最新代码..."
# 运行中的统计会写脏 data/，先还原成种子再拉，最后恢复
git checkout -- data/ 2>/dev/null || true
git pull --ff-only

echo "3/4 恢复运行数据..."
rm -rf data
mv /tmp/yaya-data-backup data

echo "4/4 重建容器..."
$DC up -d --build

echo
echo "升级完成。可选清理旧镜像:  $DC image prune -f"
