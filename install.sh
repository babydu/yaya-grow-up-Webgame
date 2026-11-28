#!/usr/bin/env bash
# 首次安装：自动加速 clone 仓库并一键部署。
# 国内服务器直接用:
#   curl -fsSL https://ghfast.top/https://raw.githubusercontent.com/babydu/yaya-grow-up-Webgame/main/install.sh -o install.sh
#   bash install.sh
# （担心镜像前缀失效就把上面 ghfast.top 依次换成 gh-proxy.com / ghproxy.cn）
set -euo pipefail

REPO="https://github.com/babydu/yaya-grow-up-Webgame.git"
DIR="yaya-grow-up-Webgame"

if command -v docker >/dev/null 2>&1; then :; else
  echo "未检测到 docker。1Panel 用户请在面板「容器」中确认 Docker 已安装。"
  exit 1
fi

# 安装阶段仓库还没在本地，网络加速逻辑内联一份轻量探测
probe_proxy() {
  local v port
  for v in https_proxy HTTPS_PROXY http_proxy HTTP_PROXY; do
    [ -n "${!v:-}" ] && { echo "${!v}"; return 0; }
  done
  for port in 7890 10809 7897 8080 8118 20171; do
    if curl -s -m 2 -x "http://127.0.0.1:$port" -o /dev/null https://github.com; then
      echo "http://127.0.0.1:$port"; return 0
    fi
  done
  return 1
}
probe_mirror() {
  local m
  for m in ghfast.top gh-proxy.com ghproxy.cn mirror.ghproxy.com; do
    if curl -s -m 4 -o /dev/null "https://$m/https://github.com/babydu/yaya-grow-up-Webgame"; then
      echo "$m"; return 0
    fi
  done
  return 1
}

if [ -d "$DIR/.git" ]; then
  echo "目录 $DIR 已存在，直接进入升级流程。"
  cd "$DIR"
  if [ ! -f .env ]; then echo "未找到 .env，请删除 $DIR 后重装或手动补 .env。"; exit 1; fi
  exec ./upgrade.sh
fi

echo "1/2 克隆仓库..."
proxy=$(probe_proxy || true)
if [ -n "$proxy" ]; then
  echo "  使用代理 clone: $proxy"
  git -c http.proxy="$proxy" -c https.proxy="$proxy" clone "$REPO" "$DIR"
elif mirror=$(probe_mirror || true); then
  echo "  使用 GitHub 镜像 clone: $mirror"
  git clone "https://$mirror/$REPO" "$DIR"
else
  echo "  直连 clone（慢属正常，超时请挂代理后重试）"
  git clone "$REPO" "$DIR"
fi

echo "2/2 首次部署..."
cd "$DIR"
./deploy.sh
