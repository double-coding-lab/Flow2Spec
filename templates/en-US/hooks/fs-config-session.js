#!/usr/bin/env node
'use strict';
/**
 * flow-spec SessionStart hook — injects a flow-spec.config.json summary once at session start.
 * This summary does not replace Read("flow-spec.config.json") before an fs-* Skill body.
 * Written by flow-spec init to the corresponding agent's hooks/fs-config-session.js.
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
  const configPath = path.resolve(process.cwd(), 'flow-spec.config.json');
  if (!fs.existsSync(configPath)) {
    const cfg = { ...DEFAULT_CFG, changeTracking: { ...DEFAULT_CFG.changeTracking } };
    emit([
      '[flow-spec] flow-spec.config.json was not found for this session; before any fs-* Skill, still attempt Read("flow-spec.config.json"). Missing fields use defaults.',
      `Configuration summary: subAgent=${cfg.subAgent}, switchAgentVerification=${cfg.switchAgentVerification}, changeTracking=${JSON.stringify(cfg.changeTracking)}`,
    ]);
    return;
  }

  try {
    const cfg = normalizeCfg(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    emit([
      '[flow-spec] SessionStart configuration summary (reminder only; before executing any fs-* Skill, you must still Read the disk file):',
      `subAgent=${cfg.subAgent}`,
      `switchAgentVerification=${cfg.switchAgentVerification}`,
      `changeTracking=${JSON.stringify(cfg.changeTracking)}`,
    ]);
  } catch (err) {
    emit([
      `[flow-spec] Failed to parse flow-spec.config.json: ${err.message || String(err)}`,
      'Before executing any fs-* Skill, you must first fix or Read this file; if it cannot be read, missing fields use defaults.',
    ]);
  }
}

main();
