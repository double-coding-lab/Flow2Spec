#!/usr/bin/env node
'use strict';
/**
 * flow2spec PreToolUse guard — only reminds before invoking an f2s-* Skill that flow2spec.config.json must be Read first.
 * Does not repeatedly inject the full configuration during PreToolUse; the configuration summary is provided once by the SessionStart hook.
 * Written by flow2spec init --claude to .claude/hooks/f2s-config-inject.js.
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
    `[flow2spec] About to invoke ${skillName}. Before entering that Skill body, the first action must be Read("flow2spec.config.json").`,
    'The configuration summary from SessionStart is only a reminder; if it differs from disk, use the result of this Read.',
    'After reading, continue according to the actual subAgent / switchAgentVerification / changeTracking values.',
  ]);
  process.exit(0);
});
