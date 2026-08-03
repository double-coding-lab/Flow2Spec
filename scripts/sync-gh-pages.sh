#!/usr/bin/env bash
# sync-gh-pages.sh — 把 presentations/ 下的中英文 PPT 同步到 gh-pages 分支
#
# 用法（在仓库根执行）:
#   ./scripts/sync-gh-pages.sh
#
# 做了什么:
#   1. 校验工作区（允许从 main / dev_v3 执行）
#   2. 校验 html-ppt skill assets 存在
#   3. 切 gh-pages，用源 PPT + skill assets 重新铺一遍
#   4. 中文版放根目录，英文版放 /en/
#   5. 改 index.html 资源路径为同级 assets/
#   6. 提交并 push
#   7. 自动切回原分支

set -euo pipefail

TARGET_BRANCH="gh-pages"
PUB_DIR="presentations/flow2spec-intro-public"
PUB_DIR_EN="presentations/flow2spec-intro-public-en"
SKILL_ASSETS=".claude/skills/html-ppt/assets"

err() { printf '\033[31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
ok()  { printf '\033[32m[ok]\033[0m %s\n' "$*"; }
info(){ printf '\033[36m[i]\033[0m %s\n' "$*"; }

# 1. 前置检查
[[ -d .git ]] || err "请在仓库根执行"

SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
info "源分支: $SOURCE_BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  err "工作区不干净，请先提交或 stash"
fi

[[ -d "$PUB_DIR" ]]       || err "找不到 $PUB_DIR"
[[ -d "$SKILL_ASSETS" ]]  || err "找不到 $SKILL_ASSETS（需先 npx skills add html-ppt）"

# 2. 快照到临时目录
SNAP=$(mktemp -d)
trap 'rm -rf "$SNAP"' EXIT

# 中文版 → 根
cp "$PUB_DIR"/index.html "$PUB_DIR"/style.css "$SNAP/"
[[ -f "$PUB_DIR"/market-compare.md ]] && cp "$PUB_DIR"/market-compare.md "$SNAP/"
[[ -f presentations/scroll-hint.js ]] && cp presentations/scroll-hint.js "$SNAP/"
cp -rL "$SKILL_ASSETS" "$SNAP/assets"

# 英文版 → /en/
if [[ -d "$PUB_DIR_EN" ]]; then
  mkdir -p "$SNAP/en"
  cp "$PUB_DIR_EN"/index.html "$PUB_DIR_EN"/style.css "$SNAP/en/"
  # en 版共享同一份 assets（用相对路径 ../assets/）
  sed -i '' 's|\.\./\.\./\.claude/skills/html-ppt/assets/|../assets/|g' "$SNAP/en/index.html"
  ok "英文版已加入 /en/"
else
  info "未找到英文版 ($PUB_DIR_EN)，跳过"
fi

# 改中文版 index.html 资源路径: ../../.claude/skills/html-ppt/assets/ → assets/
sed -i '' 's|\.\./\.\./\.claude/skills/html-ppt/assets/|assets/|g' "$SNAP/index.html"
sed -i '' 's|src="../scroll-hint.js"|src="scroll-hint.js"|g' "$SNAP/index.html"

ok "快照已准备: $SNAP"

# 3. 切 gh-pages 并更新
git checkout "$TARGET_BRANCH"

# 清空除 .git 外的内容
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name .agents -exec rm -rf {} +

cp -r "$SNAP"/. .

# 写/保留 README
cat > README.md <<'MD'
# Flow2Spec · Presentation

13-slide HTML PPT demonstrating how Flow2Spec keeps AI "always in context" across sessions.

**Live (Chinese)**: https://double-coding-lab.github.io/Flow2Spec

**Live (English)**: https://double-coding-lab.github.io/Flow2Spec

**Keyboard**: ← → navigate · `T` toggle theme · `S` speaker mode · `F` fullscreen · `O` overview

Main repo: https://github.com/double-coding-lab/Flow2Spec
MD

git add -A

if git diff --cached --quiet; then
  info "gh-pages 内容无变化，无需提交"
else
  MSG="🔄 sync: deploy zh+en from $SOURCE_BRANCH @ $(git rev-parse --short "$SOURCE_BRANCH")"
  git commit -m "$MSG"
  git push origin "$TARGET_BRANCH"
  ok "已推送: $MSG"
fi

git checkout "$SOURCE_BRANCH"
ok "已切回 $SOURCE_BRANCH"
echo ""
echo "📍 中文版: https://double-coding-lab.github.io/Flow2Spec"
echo "📍 英文版: https://double-coding-lab.github.io/Flow2Spec"
