#!/usr/bin/env node
/**
 * sync-core-templates.js
 * -----------------------------------------------------------------------------
 * 把 workspace 根 templates/ 镜像到 packages/core/templates/。
 *
 * 背景:
 *   - workspace 根 templates/ 是唯一手写事实源(日常改的入口)。
 *   - packages/core/templates/ 是 @double-coding/flow2spec-core 的 npm 发布物副本:
 *     * packages/core/index.js 在 `path.join(__dirname, "templates", ...)` 处读取,
 *     * packages/core/package.json.files 里必须列出 "templates",
 *     * 用户 `npm install` 后必须能拿到这份副本,否则 `flow2spec init` 会 ENOENT 崩溃。
 *   - 为了避免"手工维护两份"漂移,packages/core/templates/ 从 git 忽略,
 *     由本脚本在 dev / test / prepack 前自动生成。
 *
 * 用法:
 *   node scripts/sync-core-templates.js           # 常规同步
 *   node scripts/sync-core-templates.js --check   # 只检查是否已同步,不写盘(CI / pack:check)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const src = path.join(repoRoot, "templates");
const dest = path.join(repoRoot, "packages", "core", "templates");

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const QUIET = args.includes("--quiet");

function log(msg) {
  if (!QUIET) console.log(msg);
}

function die(msg, code = 1) {
  console.error(`[sync-core-templates] ${msg}`);
  process.exit(code);
}

if (!fs.existsSync(src)) {
  die(`source not found: ${path.relative(repoRoot, src)}`);
}

if (!fs.statSync(src).isDirectory()) {
  die(`source is not a directory: ${path.relative(repoRoot, src)}`);
}

/**
 * 递归列出目录下的所有相对路径(POSIX),用于精确 diff。
 */
function listRelativeFiles(root) {
  const result = [];
  function walk(current, rel) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const absChild = path.join(current, entry.name);
      const relChild = rel ? path.posix.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(absChild, relChild);
      } else if (entry.isFile()) {
        result.push(relChild);
      }
    }
  }
  if (fs.existsSync(root)) walk(root, "");
  return result.sort();
}

function bytesEqual(a, b) {
  const bufA = fs.readFileSync(a);
  const bufB = fs.readFileSync(b);
  if (bufA.length !== bufB.length) return false;
  return bufA.equals(bufB);
}

function computeDrift() {
  const srcFiles = new Set(listRelativeFiles(src));
  const destFiles = new Set(listRelativeFiles(dest));
  const only_in_src = [];
  const only_in_dest = [];
  const different = [];
  for (const f of srcFiles) {
    if (!destFiles.has(f)) {
      only_in_src.push(f);
    } else {
      const a = path.join(src, f);
      const b = path.join(dest, f);
      if (!bytesEqual(a, b)) different.push(f);
    }
  }
  for (const f of destFiles) {
    if (!srcFiles.has(f)) only_in_dest.push(f);
  }
  return { only_in_src, only_in_dest, different };
}

if (CHECK_ONLY) {
  const drift = computeDrift();
  const total = drift.only_in_src.length + drift.only_in_dest.length + drift.different.length;
  if (total === 0) {
    log("sync-core-templates: in sync");
    process.exit(0);
  }
  console.error("[sync-core-templates] drift detected between templates/ and packages/core/templates/:");
  if (drift.only_in_src.length) {
    console.error(`  only in root templates/  (${drift.only_in_src.length}):`);
    drift.only_in_src.slice(0, 20).forEach((f) => console.error(`    + ${f}`));
    if (drift.only_in_src.length > 20) console.error(`    ...(${drift.only_in_src.length - 20} more)`);
  }
  if (drift.only_in_dest.length) {
    console.error(`  only in core templates/  (${drift.only_in_dest.length}):`);
    drift.only_in_dest.slice(0, 20).forEach((f) => console.error(`    - ${f}`));
    if (drift.only_in_dest.length > 20) console.error(`    ...(${drift.only_in_dest.length - 20} more)`);
  }
  if (drift.different.length) {
    console.error(`  content differs        (${drift.different.length}):`);
    drift.different.slice(0, 20).forEach((f) => console.error(`    ~ ${f}`));
    if (drift.different.length > 20) console.error(`    ...(${drift.different.length - 20} more)`);
  }
  console.error("run: node scripts/sync-core-templates.js");
  process.exit(1);
}

// 常规同步:先清空 dest,再全量拷贝(避免留下 src 已删除的文件)。
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });

const srcFiles = listRelativeFiles(src);
let count = 0;
for (const rel of srcFiles) {
  const from = path.join(src, rel);
  const to = path.join(dest, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  count += 1;
}

log(`sync-core-templates: ${count} files copied from templates/ → packages/core/templates/`);
