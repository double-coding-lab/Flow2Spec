const fs = require("fs");
const path = require("path");

function readSkillSummary(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  const out = [];
  for (const name of fs.readdirSync(skillsDir)) {
    // Try SKILL.md first, then SKILL.mdc
    let skillFile = path.join(skillsDir, name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      skillFile = path.join(skillsDir, name, "SKILL.mdc");
    }
    if (!fs.existsSync(skillFile)) continue;
    const raw = fs.readFileSync(skillFile, "utf8");
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const body = frontmatter ? frontmatter[1] : "";
    const skillName = (body.match(/^\s*name:\s*(.+)\s*$/m) || [])[1] || name;
    const desc = (body.match(/^\s*description:\s*(.+)\s*$/m) || [])[1] || "暂无描述";
    out.push(`- \`${skillName.trim()}\`：${desc.trim()}`);
  }
  return out.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function renderProjectConfigBlock() {
  return [
    "| 配置项 | init 默认 | 说明 |",
    "| --- | --- | --- |",
    "| `subAgent` | `true` | 技能正文写明某步可用子 agent 时，`true` 才允许拆子；`false` 一律主会话完成。用户「动态判断谁用子 agent」仅当本项为 `true` 时有效。 |",
    "| `switchAgentVerification` | `true` | 切换 agent 校验。仅当本项为 `true` 且当前技能正文明确绑定该字段时启用交叉校验；否则仍是谁落盘谁自验。旧键 `subAgentVerification` 仍可被解析。 |",
    "| `intentRecognition` | `true` | `true` 时可按 `f2s-intent-routing` 对高置信操作意图自动进入对应 `f2s-*` 技能；`false` 或缺失时不自动分流。 |",
    "| `changeTracking.feat` | `true` | `true` 时 `f2s-kb-feat` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |",
    "| `changeTracking.fix` | `false` | `true` 时 `f2s-kb-fix` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |",
    "| `changeTracking.implement` | `true` | `true` 时 `f2s-implement-tech-design` 写入任务清单并在满足归档门禁后归档；`false` 时跳过变更追踪部分。 |",
    "| `collaboration.enabled` | `true` | `true` 时按 developerId 隔离任务根 `.task/<id>/`；`false` 时始终 legacy 单根 `.task/`。 |",
    "| `collaboration.developerId` | `\"\"` | 非空则作为任务进度目录名；空则尝试 git user.email/name 规范化；仍无则 legacy `.task/`。解析顺序：config → git → legacy。 |",
  ].join("\n");
}

function renderCodexAgents(templateBody, skillsSummaryLines) {
  const summary =
    skillsSummaryLines.length > 0
      ? skillsSummaryLines.join("\n")
      : "- 当前未发现可用技能。";
  let body = templateBody.replace(
    "{{FLOW2SPEC_PROJECT_CONFIG}}",
    renderProjectConfigBlock(),
  );
  body = body.replace("{{FLOW2SPEC_CODEX_SKILLS_SUMMARY}}", summary);
  return body;
}

function buildCodexAgentsMd(templatesDir, projectConfig) {
  const templatePath = path.join(templatesDir, "AGENTS.md");
  const skillsDir = path.join(templatesDir, "skills");
  const templateBody = fs.readFileSync(templatePath, "utf8");
  const skillLines = readSkillSummary(skillsDir);
  return renderCodexAgents(templateBody, skillLines);
}

function buildCodexAgentsStubMd(templatesDir) {
  const stubPath = path.join(templatesDir, "AGENTS.codex-stub.md");
  if (!fs.existsSync(stubPath)) {
    throw new Error(`缺少 Codex 指针模板：${stubPath}`);
  }
  return fs.readFileSync(stubPath, "utf8");
}

module.exports = {
  buildCodexAgentsMd,
  buildCodexAgentsStubMd,
  renderProjectConfigBlock,
};
