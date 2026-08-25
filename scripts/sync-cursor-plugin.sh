#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# sync-cursor-plugin.sh
# 将当前分支（main / dev_v3 等）的 packages/core/templates/ 内容同步到
# feat/cursor-directory-plugin 分支的插件根结构。
#
# 用法:
#   ./scripts/sync-cursor-plugin.sh          # 同步并自动提交
#   ./scripts/sync-cursor-plugin.sh --dry    # 仅预览差异，不提交
# ─────────────────────────────────────────────────────────────────────────────

PLUGIN_BRANCH="feat/cursor-directory-plugin"
WORKTREE_DIR="/tmp/flow2spec-cursor-plugin-sync"
SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
DRY_RUN=false

if [[ "${1:-}" == "--dry" ]]; then
  DRY_RUN=true
fi

echo "📦 源分支: $SOURCE_BRANCH"
echo "🎯 目标分支: $PLUGIN_BRANCH"
echo ""

# 确保工作区干净
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  当前工作区有未提交的变更（同步基于磁盘文件，未提交的也会带入）。"
  if [[ "$DRY_RUN" == false ]]; then
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo "   [dry-run] 继续预览..."
  fi
fi

# 清理可能残留的 worktree
if git worktree list | grep -q "$WORKTREE_DIR"; then
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
fi
rm -rf "$WORKTREE_DIR"

# 创建 worktree
echo "🔧 创建 worktree → $WORKTREE_DIR"
git worktree add "$WORKTREE_DIR" "$PLUGIN_BRANCH" --quiet

# ─── 同步映射 ──────────────────────────────────────────────────────────────
# 源 (packages/core/templates/)           → 目标 (插件根)
# packages/core/templates/rules/          → rules/
# packages/core/templates/skills/         → skills/
# packages/core/templates/hooks/          → scripts/
# packages/core/templates/knowledge/      → knowledge/
# packages/core/templates/flow2spec.config.json → flow2spec.config.json

REPO_ROOT=$(git rev-parse --show-toplevel)
SRC="$REPO_ROOT/packages/core/templates"

sync_dir() {
  local src="$1" dest="$2"
  if [[ -d "$src" ]]; then
    rm -rf "$dest"
    cp -a "$src" "$dest"
    # 清理 .DS_Store
    find "$dest" -name ".DS_Store" -delete 2>/dev/null || true
  fi
}

echo "📋 同步文件..."

# rules
sync_dir "$SRC/rules" "$WORKTREE_DIR/rules"

# skills
sync_dir "$SRC/skills" "$WORKTREE_DIR/skills"

# hooks → scripts
if [[ -d "$SRC/hooks" ]]; then
  rm -rf "$WORKTREE_DIR/scripts"
  mkdir -p "$WORKTREE_DIR/scripts"
  cp -a "$SRC/hooks/"* "$WORKTREE_DIR/scripts/" 2>/dev/null || true
  find "$WORKTREE_DIR/scripts" -name ".DS_Store" -delete 2>/dev/null || true
fi

# knowledge
sync_dir "$SRC/knowledge" "$WORKTREE_DIR/knowledge"

# flow2spec.config.json
if [[ -f "$SRC/flow2spec.config.json" ]]; then
  cp "$SRC/flow2spec.config.json" "$WORKTREE_DIR/flow2spec.config.json"
fi

# 修复 skill frontmatter：确保所有 SKILL.md 有闭合的 ---
for skill_file in "$WORKTREE_DIR"/skills/*/SKILL.md; do
  [[ -f "$skill_file" ]] || continue
  # 检查第一行是否是 ---
  if head -1 "$skill_file" | grep -q "^---$"; then
    # 检查是否有第二个 ---（闭合 frontmatter）
    close_line=$(awk 'NR>1 && /^---$/{print NR; exit}' "$skill_file")
    if [[ -z "$close_line" ]]; then
      # 找到 description 行后插入 ---
      desc_line=$(grep -n "^description:" "$skill_file" | head -1 | cut -d: -f1)
      if [[ -n "$desc_line" ]]; then
        sed -i '' "$((desc_line))a\\
---" "$skill_file"
      fi
    fi
  fi
done

echo ""

# ─── 检查差异 ──────────────────────────────────────────────────────────────
cd "$WORKTREE_DIR"
git add -A

if git diff --cached --quiet; then
  echo "✅ 无变更，插件分支已是最新。"
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  exit 0
fi

echo "📝 变更摘要:"
git diff --cached --stat
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "🔍 [dry-run] 以上为预览，未提交。"
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  exit 0
fi

# 提交
COMMIT_MSG="🔄 sync: 从 $SOURCE_BRANCH 同步插件内容 ($(date +%Y-%m-%d))"
git commit -m "$COMMIT_MSG" --quiet

echo "✅ 已提交到 $PLUGIN_BRANCH"
echo "   commit: $(git rev-parse --short HEAD)"
echo "   message: $COMMIT_MSG"

# 清理 worktree
cd "$REPO_ROOT"
git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true

echo ""
echo "💡 下一步: git push origin $PLUGIN_BRANCH"
