#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MANIFEST_PATH = path.join(process.cwd(), '.Knowledge', 'manifest-routing.json');
const CACHE_FILE = path.join(process.cwd(), '.Knowledge', 'update-check.json');
const PACKAGE_NAME_PLACEHOLDER = '__FLOW2SPEC_' + 'PACKAGE_NAME__';
const PACKAGE_NAME = '__FLOW2SPEC_PACKAGE_NAME__';
const GENERATED_CORE_VERSION = '__FLOW2SPEC_CORE_VERSION__';
const GENERATED_TEMPLATE_VERSION = '__FLOW2SPEC_TEMPLATE_VERSION__';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function parseVer(value) {
  return String(value || '').replace(/^v/, '').split(/[.-]/).slice(0, 3).map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
}

function cmpVer(left, right) {
  const a = parseVer(left), b = parseVer(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function getProjectName() {
  return readJson(path.join(process.cwd(), 'package.json'))?.name || path.basename(process.cwd());
}

function getManifestVersion() {
  return readJson(MANIFEST_PATH)?.version || null;
}

function getPackageName() {
  return PACKAGE_NAME && PACKAGE_NAME !== PACKAGE_NAME_PLACEHOLDER
    ? PACKAGE_NAME
    : '@double-coding/flow2spec-core';
}

function isEnabled() {
  const config = readJson(path.join(process.cwd(), 'flow2spec.config.json'));
  return config?.updateCheck?.enabled !== false;
}

function readCache() {
  const cache = readJson(CACHE_FILE);
  if (!cache?.checkedAt) return null;
  return new Date(cache.checkedAt).toDateString() === new Date().toDateString() ? cache : null;
}

function queryLatestMetadata(packageName) {
  const output = execFileSync(
    'npm',
    ['view', packageName, 'version', 'templateVersion', '--json', '--registry=https://registry.npmjs.org'],
    { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const metadata = JSON.parse(output);
  const latestCoreVersion = typeof metadata === 'string' ? metadata : metadata.version;
  const latestTemplateVersion = typeof metadata === 'string'
    ? metadata
    : metadata.templateVersion || metadata.version;
  return { latestCoreVersion, latestTemplateVersion };
}

function updateState(metadata, manifestVersion) {
  const coreUpdateAvailable = cmpVer(GENERATED_CORE_VERSION, metadata.latestCoreVersion) < 0;
  const templateUpdateAvailable = cmpVer(manifestVersion, metadata.latestTemplateVersion) < 0;
  return {
    packageName: getPackageName(),
    generatedByCoreVersion: GENERATED_CORE_VERSION,
    generatedTemplateVersion: GENERATED_TEMPLATE_VERSION,
    manifestVersion,
    ...metadata,
    coreUpdateAvailable,
    templateUpdateAvailable,
    needsUpgrade: coreUpdateAvailable || templateUpdateAvailable,
  };
}

function buildNotice(state) {
  const project = getProjectName();
  const versionSummary = `Core v${state.generatedByCoreVersion} -> v${state.latestCoreVersion}，Template v${state.manifestVersion} -> v${state.latestTemplateVersion}`;
  if (state.templateUpdateAvailable) {
    return [
      '[flow2spec/agent-instruction] 你必须在本轮回复开头转告用户以下更新提示：',
      '',
      `📦 [flow2spec] 当前项目「${project}」有模板更新（${versionSummary}）。Template 变更会影响知识库主题结构，须征询用户后再动。`,
      '',
      '[flow2spec/agent-instruction] 建议流程（不得跳过用户询问）：',
      '1. 询问用户是否代跑 `flow2spec update --cli` + `flow2spec init <已初始化的 agents>`（若全局 CLI 缺失，fallback `npx @double-coding/flow2spec update --cli`）；',
      '2. 用户同意 → 代跑；init 后读 `.Knowledge/manifest-routing.json`：projectRev 与 pkgRev 相等则删除 `.Knowledge/update-check.json` 结束；不等则调用 f2s-kb-upgrade skill（可从其步骤 2c 起继续）；',
      '3. 用户拒绝 → 保留缓存不动，继续本轮任务。',
    ].join('\n');
  }
  return [
    '[flow2spec/agent-instruction] 你必须在本轮回复开头执行以下动作，**无需征询用户**（Core-only 更新不影响知识库主题）：',
    '',
    `1. 用一行告知用户："正在自动更新 CLI/Core（${versionSummary}），不涉及知识库主题变更"；`,
    '2. 调用 Bash 执行 `flow2spec update --cli`；若因全局 CLI 缺失失败，fallback 到 `npx @double-coding/flow2spec update --cli`；仍失败则一行报告命令原文与错误摘要后继续本轮任务，不阻塞；',
    '3. 成功后调用 `flow2spec init <已初始化的 agents>`（幂等）刷新配置根 Hook；',
    '4. 完成后删除 `.Knowledge/update-check.json`；',
    `5. 一行报告完成："CLI/Core 更新完成，Template Version 未变（v${state.manifestVersion}），继续本轮任务。"`,
    '',
    `📦 [flow2spec] 当前项目「${project}」仅有 Core 程序更新（${versionSummary}），模板版本未变化。Template Version 未变，**不**进入 f2s-kb-upgrade。`,
  ].join('\n');
}

function emitNotice(notice) {
  process.stdout.write(JSON.stringify({
    additional_context: notice,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notice },
  }) + '\n');
}

function writeCache(state) {
  try {
    fs.writeFileSync(CACHE_FILE, `${JSON.stringify({
      ...state,
      latestNpm: state.latestTemplateVersion,
      notice: state.needsUpgrade ? buildNotice(state) : '',
      checkedAt: Date.now(),
    }, null, 2)}\n`, 'utf8');
  } catch (_) {}
}

function deleteCache() {
  try { fs.rmSync(CACHE_FILE, { force: true }); } catch (_) {}
}

function main() {
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION || !isEnabled()) return;
  const manifestVersion = getManifestVersion();
  if (!manifestVersion) return;

  const cached = readCache();
  if (cached) {
    const state = updateState({
      latestCoreVersion: cached.latestCoreVersion,
      latestTemplateVersion: cached.latestTemplateVersion || cached.latestNpm,
    }, manifestVersion);
    if (!state.needsUpgrade) deleteCache();
    else emitNotice(buildNotice(state));
    return;
  }

  let metadata;
  try { metadata = queryLatestMetadata(getPackageName()); } catch (_) { return; }
  if (!metadata.latestCoreVersion || !metadata.latestTemplateVersion) return;
  const state = updateState(metadata, manifestVersion);
  writeCache(state);
  if (state.needsUpgrade) emitNotice(buildNotice(state));
}

main();
