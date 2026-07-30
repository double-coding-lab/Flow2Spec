'use strict';
/**
 * 负责合并 flow-spec hook 配置到 .claude/settings.json。
 * 仅在 init --claude 时调用。
 */
const fs = require('fs');
const path = require('path');

const HOOK_COMMAND_CONFIG_INJECT = 'node .claude/hooks/fs-config-inject.js';
const HOOK_COMMAND_CONFIG_SESSION = 'node .claude/hooks/fs-config-session.js';
const HOOK_COMMAND_UPDATE_CHECK  = 'node .claude/hooks/fs-update-check.js';

// 向下兼容
const HOOK_COMMAND = HOOK_COMMAND_CONFIG_INJECT;

function findPackageJsonDir(startDir) {
  let cur = startDir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

function hasHookCommand(arr, fragment) {
  if (!Array.isArray(arr)) return false;
  for (const group of arr) {
    if (!group || !Array.isArray(group.hooks)) continue;
    for (const h of group.hooks) {
      if (h && h.type === 'command' && String(h.command || '').includes(fragment)) {
        return true;
      }
    }
  }
  return false;
}

function removeHookCommand(arr, fragment) {
  if (!Array.isArray(arr)) return [];
  const next = [];
  for (const group of arr) {
    if (!group || !Array.isArray(group.hooks)) {
      next.push(group);
      continue;
    }
    const hooks = group.hooks.filter((h) => {
      return !(h && h.type === 'command' && String(h.command || '').includes(fragment));
    });
    if (hooks.length) next.push(Object.assign({}, group, { hooks }));
  }
  return next;
}

// 旧函数名保持兼容
function hasFsHook(preToolUseArr) {
  return hasHookCommand(preToolUseArr, 'fs-config-inject');
}

/**
 * 将 fs PreToolUse 守门 hook 合并进现有 settings，返回新对象（不修改原对象）。
 * @param {object} existing  现有 settings（可为 {}）
 * @returns {object}
 */
function mergeFsHook(existing) {
  const next = JSON.parse(JSON.stringify(existing || {}));
  if (!next.hooks) next.hooks = {};
  if (!next.hooks.PreToolUse) next.hooks.PreToolUse = [];

  if (hasFsHook(next.hooks.PreToolUse)) {
    return { settings: next, changed: false };
  }

  next.hooks.PreToolUse.push({
    matcher: 'Skill',
    hooks: [{ type: 'command', command: HOOK_COMMAND }],
  });

  return { settings: next, changed: true };
}

/**
 * 将 fs SessionStart 配置摘要 hook 合并进 settings。
 * @param {object} existing
 * @returns {{ settings, changed }}
 */
function mergeConfigSessionHook(existing) {
  const next = JSON.parse(JSON.stringify(existing || {}));
  if (!next.hooks) next.hooks = {};
  if (!next.hooks.SessionStart) next.hooks.SessionStart = [];

  if (hasHookCommand(next.hooks.SessionStart, 'fs-config-session')) {
    return { settings: next, changed: false };
  }

  next.hooks.SessionStart.push({
    hooks: [{ type: 'command', command: HOOK_COMMAND_CONFIG_SESSION }],
  });

  return { settings: next, changed: true };
}

/**
 * 将 fs 更新检查 hook 合并进 settings：
 * - SessionStart：执行完整检测，写入 .flow-spec/update-check.json，并直接 emit 提示
 * - 同时清理旧版 UserPromptSubmit 中的 fs-update-check / fs-update-notice
 * @param {object} existing
 * @returns {{ settings, changed }}
 */
function mergeUpdateCheckHook(existing) {
  const next = JSON.parse(JSON.stringify(existing || {}));
  if (!next.hooks) next.hooks = {};
  if (!next.hooks.SessionStart) next.hooks.SessionStart = [];

  let changed = false;

  if (Array.isArray(next.hooks.UserPromptSubmit)) {
    const before = JSON.stringify(next.hooks.UserPromptSubmit);
    next.hooks.UserPromptSubmit = removeHookCommand(next.hooks.UserPromptSubmit, 'fs-update-check');
    next.hooks.UserPromptSubmit = removeHookCommand(next.hooks.UserPromptSubmit, 'fs-update-notice');
    if (JSON.stringify(next.hooks.UserPromptSubmit) !== before) changed = true;
    if (next.hooks.UserPromptSubmit.length === 0) {
      delete next.hooks.UserPromptSubmit;
    }
  }

  if (!hasHookCommand(next.hooks.SessionStart, 'fs-update-check')) {
    next.hooks.SessionStart.push({
      hooks: [{ type: 'command', command: HOOK_COMMAND_UPDATE_CHECK }],
    });
    changed = true;
  }

  return { settings: next, changed };
}

/**
 * 读取 .claude/settings.json（不存在则返回 {}）。
 * @param {string} claudeRoot  .claude 目录绝对路径
 * @returns {object}
 */
function readSettings(claudeRoot) {
  const settingsPath = path.join(claudeRoot, 'settings.json');
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (_err) {
    return {};
  }
}

/**
 * 写入 .claude/settings.json。
 * @param {string} claudeRoot
 * @param {object} settings
 */
function writeSettings(claudeRoot, settings) {
  const settingsPath = path.join(claudeRoot, 'settings.json');
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/**
 * 复制 hook 脚本到 .claude/hooks/。
 */
function copyHookScript(claudeRoot, templatesDir, scriptName) {
  const src = path.join(templatesDir, 'hooks', scriptName);
  if (!fs.existsSync(src)) return { written: false, reason: 'missing-template' };

  const hooksDir = path.join(claudeRoot, 'hooks');
  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

  let body = fs.readFileSync(src, 'utf8');
  if (body.includes('__FLOW_SPEC_PACKAGE_NAME__')) {
    let packageName = '@double-codeing/flow-spec';
    try {
      const packageDir = findPackageJsonDir(templatesDir);
      packageName = JSON.parse(
        fs.readFileSync(path.join(packageDir || path.join(templatesDir, '..'), 'package.json'), 'utf8'),
      ).name || packageName;
    } catch (_) {}
    body = body.replace(/__FLOW_SPEC_PACKAGE_NAME__/g, packageName);
  }
  fs.writeFileSync(path.join(hooksDir, scriptName), body, 'utf8');
  return { written: true };
}

/**
 * 主入口：为 claude agent 配置 fs hooks（SessionStart 配置摘要 + PreToolUse 守门 + 更新检测/提示）。
 * @param {string} cwd
 * @param {string} templatesDir
 * @returns {{ hookScriptResult, updateCheckResult, settingsChanged }}
 */
function writeClaudeAgentHooks(cwd, templatesDir) {
  const claudeRoot = path.join(cwd, '.claude');
  if (!fs.existsSync(claudeRoot)) fs.mkdirSync(claudeRoot, { recursive: true });

  const hookScriptResult = copyHookScript(claudeRoot, templatesDir, 'fs-config-inject.js');
  const configSessionResult = copyHookScript(claudeRoot, templatesDir, 'fs-config-session.js');
  const updateCheckResult = copyHookScript(claudeRoot, templatesDir, 'fs-update-check.js');

  // 清理旧版残留的 fs-update-notice.js
  const noticeStale = path.join(claudeRoot, 'hooks', 'fs-update-notice.js');
  if (fs.existsSync(noticeStale)) {
    try { fs.unlinkSync(noticeStale); } catch (_) {}
  }

  let settings = readSettings(claudeRoot);
  let changed = false;

  const r1 = mergeFsHook(settings);
  if (r1.changed) { settings = r1.settings; changed = true; }

  const r2 = mergeConfigSessionHook(settings);
  if (r2.changed) { settings = r2.settings; changed = true; }

  const r3 = mergeUpdateCheckHook(settings);
  if (r3.changed) { settings = r3.settings; changed = true; }

  if (changed) writeSettings(claudeRoot, settings);

  return { hookScriptResult, configSessionResult, updateCheckResult, settingsChanged: changed };
}

module.exports = {
  writeClaudeAgentHooks,
  mergeFsHook,
  mergeConfigSessionHook,
  mergeUpdateCheckHook,
};
