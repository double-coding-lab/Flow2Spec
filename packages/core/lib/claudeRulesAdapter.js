/**
 * Cursor 规则为 .mdc + frontmatter globs、alwaysApply。
 * Claude Code 仅识别 .claude/rules 下扩展名为 .md 的规则文件，路径范围用 paths（见 Claude Code 文档：Organize rules with .claude/rules）。
 */

/**
 * @param {string} mdcSource  完整 .mdc 文件正文
 * @returns {string}         写入 `.claude/rules/*.md` 的正文
 */
function adaptRuleMdcToClaudeMd(mdcSource) {
  let out = mdcSource;
  // YAML：globs → paths（与 Cursor 语义等价）
  out = out.replace(/^globs:/m, "paths:");
  // Claude Code 不按 Cursor 的 alwaysApply 解析；无 paths 的规则与会话同载
  out = out.replace(/^\s*alwaysApply:\s*(true|false)\s*\r?\n/m, "");
  // 正文与示例中的 .mdc 引用改为 .md，与落盘扩展名一致
  out = out.replace(/\.mdc\b/g, ".md");
  return out;
}

/**
 * @param {string} agentRoot  AGENTS[id].root，如 `.claude`
 */
function shouldWriteClaudeStyleRules(agentRoot) {
  return agentRoot === ".claude";
}

module.exports = { adaptRuleMdcToClaudeMd, shouldWriteClaudeStyleRules };
