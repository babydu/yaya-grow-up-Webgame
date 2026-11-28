#!/usr/bin/env bash
# 网络加速公共模块（被 deploy.sh / upgrade.sh / install.sh source）。
# 国内服务器拉 GitHub 与 Docker Hub 常常超时，这里自动按优先级找一个
# 可用通道，全部失败再回退直连。
#
# 隔离原则（本模块的硬约束）：
#   - 只对"本次 git/docker 命令"生效（git -c / 临时 URL），不写全局
#     git config、不改 /etc、不改 docker daemon.json、不用 sudo
#   - 不修改环境变量、不动防火墙、不开端口、不后台驻留进程
#   - 磁盘剩余不足 600MB 时直接跳过镜像拉取，不把盘写满
#   - 所有探测都是只读连通性测试，失败回退直连，流程永不因网络中断
#
# 手动覆盖（可选，写在 .env 或直接导出）：
#   PROXY=                指定代理，跳过自动探测
#   GITHUB_MIRROR=        指定 GitHub 加速镜像前缀，跳过探测
#   DOCKER_MIRROR=        指定 Docker 镜像加速器（如 docker.m.daocloud.io）
#   NO_MIRROR=1           全部走直连，不探测任何代理/镜像
#
# 用法：
#   source ./lib-network.sh
#   proxy=$(probe_proxy)             # 输出代理 URL 或空
#   git_pull                         # 加速 git pull --ff-only
#   git_clone <repo> <dir>           # 加速 clone
#   prepull_base node:22-alpine      # 加速拉取基础镜像并打回原名

# --- 探测可用代理 ---
probe_proxy() {
  if [ "${NO_MIRROR:-0}" = "1" ]; then return 1; fi

  # 1) 已设置的环境变量
  local v
  for v in https_proxy HTTPS_PROXY http_proxy HTTP_PROXY all_proxy ALL_PROXY; do
    if [ -n "${!v:-}" ]; then echo "${!v}"; return 0; fi
  done

  # 2) 用户在 .env 里指定的 PROXY
  if [ -n "${PROXY:-}" ]; then echo "$PROXY"; return 0; fi

  # 3) 本地常见代理端口（Clash/V2Ray 等的 mixed 或 http 端口）
  local port
  for port in 7890 10809 7897 8080 8118 20171 1080; do
    if curl -s -m 2 -x "http://127.0.0.1:$port" -o /dev/null https://github.com; then
      echo "http://127.0.0.1:$port"; return 0
    fi
  done
  return 1
}

# --- 探测可用的 GitHub 镜像前缀（不含仓库路径） ---
GITHUB_MIRRORS="ghfast.top gh-proxy.com ghproxy.cn mirror.ghproxy.com"
probe_github_mirror() {
  if [ "${NO_MIRROR:-0}" = "1" ]; then return 1; fi
  if [ -n "${GITHUB_MIRROR:-}" ]; then echo "$GITHUB_MIRROR"; return 0; fi
  local m
  for m in $GITHUB_MIRRORS; do
    if curl -s -m 4 -o /dev/null "https://$m/https://github.com/babydu/yaya-grow-up-Webgame"; then
      echo "$m"; return 0
    fi
  done
  return 1
}

# --- 加速 git clone ---
git_clone() {
  local repo=$1 dir=${2:-.}
  local proxy mirror
  proxy=$(probe_proxy || true)
  if [ -n "$proxy" ]; then
    echo "  使用代理 clone: $proxy"
    git -c http.proxy="$proxy" -c https.proxy="$proxy" clone "$repo" "$dir"
    return
  fi
  mirror=$(probe_github_mirror || true)
  if [ -n "$mirror" ]; then
    echo "  使用 GitHub 镜像 clone: $mirror"
    git clone "https://$mirror/$repo" "$dir"
    return
  fi
  echo "  直连 clone（慢属正常，超时请挂代理后重试）"
  git clone "$repo" "$dir"
}

# --- 加速 git pull --ff-only ---
git_pull() {
  local proxy mirror
  proxy=$(probe_proxy || true)
  if [ -n "$proxy" ]; then
    echo "  使用代理拉取: $proxy"
    git -c http.proxy="$proxy" -c https.proxy="$proxy" pull --ff-only
    return
  fi
  mirror=$(probe_github_mirror || true)
  if [ -n "$mirror" ]; then
    echo "  使用 GitHub 镜像拉取: $mirror"
    # 只对本次命令生效，不写入仓库配置；镜像失效时下次自动换一个
    git -c "url.https://$mirror/https://github.com/.insteadOf=https://github.com/" pull --ff-only
    return
  fi
  echo "  直连拉取（慢属正常，超时请挂代理后重试）"
  git pull --ff-only
}

# --- 加速拉取基础镜像：走国内 registry，成功后打回 compose 需要的原名 ---
DOCKER_MIRRORS="docker.m.daocloud.io docker.1panel.live dockerproxy.com docker.211678.top"
prepull_base() {
  local image=$1
  if [ "${NO_MIRROR:-0}" = "1" ]; then return 0; fi

  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "  基础镜像 $image 已存在，跳过拉取"
    return 0
  fi

  # 守住服务器整体可用性：镜像展开约 200MB，剩余空间不足直接放弃加速，
  # 绝不把磁盘写满拖垮其他服务。
  local free_mb
  free_mb=$(df -Pm . 2>/dev/null | awk 'NR==2 {print $4}')
  if [ -n "${free_mb:-}" ] && [ "$free_mb" -lt 600 ] 2>/dev/null; then
    echo "  磁盘剩余 ${free_mb}MB 不足 600MB，跳过镜像拉取，构建时直连"
    return 0
  fi

  local m full
  for m in ${DOCKER_MIRROR:-} $DOCKER_MIRRORS; do
    full="$m/library/$image"
    echo "  尝试镜像源: $m"
    # timeout 兜底：单个源卡死时不拖垮整个升级流程
    if timeout 300 docker pull "$full"; then
      docker tag "$full" "$image"
      echo "  已通过 $m 拉取并标记为 $image"
      return 0
    fi
  done

  echo "  镜像源均不可用，直连拉取（慢属正常）"
  timeout 600 docker pull "$image" || echo "  直连拉取失败，构建会再次尝试"
}
