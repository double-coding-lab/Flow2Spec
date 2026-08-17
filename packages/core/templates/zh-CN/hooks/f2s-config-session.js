#!/usr/bin/env node
'use strict';
/**
 * flow2spec SessionStart hook — 会话开始时一次性注入 flow2spec.config.json 摘要。
 * 该摘要不替代 f2s-* Skill 正文前的 Read("flow2spec.config.json")。
 * 由 flow2spec init 写入对应 agent 的 hooks/f2s-config-session.js。
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_CFG = {
  subAgent: false,
  switchAgentVerification: false,
  changeTracking: { feat: true, fix: false, implement: true },
};

function normalizeBool(value, fallback) {
  if (value === true || value === 'true' || value === 1 || value === '1')
    return true;
  if (value === false || value === 'false' || value === 0 || value === '0')
    return false;
  return fallback;
}

function normalizeCfg(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CFG, changeTracking: { ...DEFAULT_CFG.changeTracking } };
  }
  const ct = raw.changeTracking;
  let changeTracking = { ...DEFAULT_CFG.changeTracking };
  if (typeof ct === 'boolean') {
    changeTracking = {
      feat: normalizeBool(ct, DEFAULT_CFG.changeTracking.feat),
      fix: normalizeBool(ct, DEFAULT_CFG.changeTracking.fix),
      implement: normalizeBool(ct, DEFAULT_CFG.changeTracking.implement),
    };
  } else if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    changeTracking = {
      feat: normalizeBool(ct.feat, DEFAULT_CFG.changeTracking.feat),
      fix: normalizeBool(ct.fix, DEFAULT_CFG.changeTracking.fix),
      implement: normalizeBool(ct.implement, DEFAULT_CFG.changeTracking.implement),
    };
  }
  const switchRaw = Object.prototype.hasOwnProperty.call(raw, 'switchAgentVerification')
    ? raw.switchAgentVerification
    : raw.subAgentVerification;
  return {
    subAgent: normalizeBool(raw.subAgent, DEFAULT_CFG.subAgent),
    switchAgentVerification: normalizeBool(
      switchRaw,
      DEFAULT_CFG.switchAgentVerification,
    ),
    changeTracking,
  };
}

function emit(lines) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lines.join('\n'),
      },
    }) + '\n',
  );
}

function main() {
  const configPath = path.resolve(process.cwd(), 'flow2spec.config.json');
  if (!fs.existsSync(configPath)) {
    const cfg = { ...DEFAULT_CFG, changeTracking: { ...DEFAULT_CFG.changeTracking } };
    emit([
      '[flow2spec] 本会话未找到 flow2spec.config.json；f2s-* Skill 前仍必须尝试 Read("flow2spec.config.json")，缺失字段按默认值处理。',
      `配置摘要：subAgent=${cfg.subAgent}, switchAgentVerification=${cfg.switchAgentVerification}, changeTracking=${JSON.stringify(cfg.changeTracking)}`,
    ]);
    return;
  }

  try {
    const cfg = normalizeCfg(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    emit([
      '[flow2spec] SessionStart 配置摘要（仅作提醒，执行 f2s-* Skill 前仍必须 Read 磁盘文件）：',
      `subAgent=${cfg.subAgent}`,
      `switchAgentVerification=${cfg.switchAgentVerification}`,
      `changeTracking=${JSON.stringify(cfg.changeTracking)}`,
    ]);
  } catch (err) {
    emit([
      `[flow2spec] flow2spec.config.json 解析失败：${err.message || String(err)}`,
      '执行 f2s-* Skill 前必须先修复或 Read 该文件；无法读取时按缺失字段默认值处理。',
    ]);
  }
}

main();
