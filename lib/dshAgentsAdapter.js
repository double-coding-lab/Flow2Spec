const fs = require("fs");
const path = require("path");
const { buildCodexAgentsMd } = require("./codexAgentsAdapter");

function replaceSection(body, startHeading, endHeading, replacement) {
  const start = body.indexOf(startHeading);
  const end = body.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) return body;
  return `${body.slice(0, start)}${replacement.trim()}\n\n${body.slice(end)}`;
}

function buildDshAgentsMd(templatesDir, projectConfig) {
  let body = buildCodexAgentsMd(templatesDir, projectConfig)
    .replace(/Codex/g, "DeepSeek Harness")
    .replace(/codex/g, "dsh");

  const isEnglish = path.basename(path.dirname(templatesDir)) === "templates" &&
    path.basename(templatesDir) === "en-US";
  if (isEnglish) {
    body = body
      .replace(" **`./.dsh/AGENTS.md`** is only a pointer.", "")
      .replace("\n**`.dsh/AGENTS.md`** is only a pointer and cannot replace root `AGENTS.md`.\n", "\n");
    body = replaceSection(
      body,
      "## DeepSeek Harness Hooks",
      "## Flow2Spec Skills",
      `## DeepSeek Harness Integration

DeepSeek Harness loads the repository-root \`AGENTS.md\` and discovers project skills from \`./.dsh/skills/\`. Flow2Spec mirrors its long-form rules to \`./.dsh/topics/\` for on-demand reading. Native Cordis plugin integration is outside this initialization adapter.`,
    );
    return body;
  }

  body = body
    .replace("**`./.dsh/AGENTS.md`** 仅为指针。", "")
    .replace("- **`.dsh/AGENTS.md`** 仅为目录指针，不能替代根 `AGENTS.md`。\n", "");
  return replaceSection(
    body,
    "## DeepSeek Harness Hooks",
    "## Flow2Spec 技能",
    `## DeepSeek Harness 适配

DeepSeek Harness 会加载仓库根 \`AGENTS.md\`，并从 \`./.dsh/skills/\` 发现项目技能。Flow2Spec 将规则长文镜像到 \`./.dsh/topics/\` 供按需读取。原生 Cordis 插件集成不属于本初始化适配范围。`,
  );
}

function buildDshAgentsStubMd(templatesDir) {
  const isEnglish = path.basename(templatesDir) === "en-US";
  if (isEnglish) {
    return `# Flow2Spec (\`.dsh/\` Directory Notes)

DeepSeek Harness loads the complete project instructions from repository-root [\`AGENTS.md\`](../AGENTS.md).

- \`skills/\`: Flow2Spec \`f2s-*\` skills discovered by DeepSeek Harness
- \`topics/\`: long-form rule mirrors loaded on demand
`;
  }
  return `# Flow2Spec（\`.dsh/\` 目录说明）

DeepSeek Harness 从仓库根 [\`AGENTS.md\`](../AGENTS.md) 加载完整项目说明。

- \`skills/\`：DeepSeek Harness 可发现的 Flow2Spec \`f2s-*\` 技能
- \`topics/\`：按需读取的规则长文镜像
`;
}

function writeDshAgentsStub(cwd, templatesDir) {
  const dshRoot = path.join(cwd, ".dsh");
  fs.mkdirSync(dshRoot, { recursive: true });
  fs.writeFileSync(
    path.join(dshRoot, "AGENTS.md"),
    buildDshAgentsStubMd(templatesDir),
    "utf8",
  );
}

module.exports = {
  buildDshAgentsMd,
  buildDshAgentsStubMd,
  writeDshAgentsStub,
};
