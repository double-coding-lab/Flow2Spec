#!/usr/bin/env node
'use strict';
/**
 * flow2spec PreToolUse guard — 仅在调用 f2s-* Skill 前提示必须先 Read flow2spec.config.json。
 * 不在 PreToolUse 中反复注入完整配置；配置摘要由 SessionStart hook 一次性提供。
 * 由 flow2spec init --claude 写入 .claude/hooks/f2s-config-inject.js。
 */

function emitAdditionalContext(lines) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: lines.join('\n'),
      },
    }) + '\n',
  );
}

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  let skillName = '';
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    skillName = String(input?.tool_input?.skill || input?.tool_input?.name || '');
  } catch (_err) {
    process.exit(0);
    return;
  }

  if (!/^f2s-/.test(skillName)) {
    process.exit(0);
    return;
  }

  emitAdditionalContext([
    `[flow2spec] 即将调用 ${skillName}。进入该 Skill 正文前，首个动作必须 Read("flow2spec.config.json")。`,
    'SessionStart 中的配置摘要仅作提醒；若摘要与磁盘不一致，以本次 Read 结果为准。',
    '读取后再按 subAgent / switchAgentVerification / changeTracking 的实际值执行后续步骤。',
  ]);
  process.exit(0);
});
