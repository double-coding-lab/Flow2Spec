"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeLocale, DEFAULT_LOCALE } = require("./flow2specConfig");

const SUPPORTED_HOSTS = new Set(["dsh", "cursor", "claude", "codex"]);
const HOST_PATHS = {
  dsh: { rules: "rules", skills: "skills", ruleExtension: ".md" },
  cursor: { rules: ".cursor/rules", skills: ".cursor/skills", ruleExtension: ".mdc" },
  claude: { rules: ".claude/rules", skills: ".claude/skills", ruleExtension: ".md" },
  codex: { rules: ".codex/topics", skills: ".codex/skills", ruleExtension: ".md" },
};

function resourceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeOptions(options = {}) {
  const host = String(options.host || "").trim().toLowerCase();
  if (!SUPPORTED_HOSTS.has(host)) {
    throw resourceError(
      "F2S_INVALID_ARGUMENT",
      `unsupported resource host: ${options.host || "<empty>"}`,
      { field: "host", supported: Array.from(SUPPORTED_HOSTS) },
    );
  }
  return {
    host,
    locale: normalizeLocale(options.locale, DEFAULT_LOCALE),
    projectConfig: options.projectConfig,
  };
}

function templatesDir(templatesRoot, locale) {
  return path.join(templatesRoot, locale);
}

function parseSkillDocument(raw, relativePath) {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw resourceError("F2S_RESOURCE_INVALID", `skill frontmatter missing: ${relativePath}`, {
      relativePath,
    });
  }
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }
  if (!frontmatter.name || !frontmatter.description) {
    throw resourceError(
      "F2S_RESOURCE_INVALID",
      `skill name or description missing: ${relativePath}`,
      { relativePath },
    );
  }
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    body: raw.slice(match[0].length),
  };
}

function ruleReferenceIds(content) {
  const ids = new Set(["f2s-flow2spec-unified-entry", "f2s-config-check"]);
  const pattern = /(?:(?:\.codex|\.dsh)\/topics\/|(?:\.cursor|\.claude)\/rules\/|rules\/)(f2s-[a-zA-Z0-9-]+)/g;
  let match;
  while ((match = pattern.exec(content))) ids.add(match[1]);
  return Array.from(ids).sort();
}

function hostRulePath(profile, ruleId) {
  return `${profile.rules}/${ruleId}${profile.ruleExtension}`;
}

function hostSkillPath(profile, skillName) {
  return `${profile.skills}/${skillName}/SKILL.md`;
}

function nativeSkillName(name, host) {
  if (host !== "dsh") return name;
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function adaptNativeSkillNames(content, host) {
  if (host !== "dsh") return String(content);
  return String(content).replace(/\bf2s-[a-zA-Z0-9-]*[A-Z][a-zA-Z0-9-]*\b/g, (name) =>
    nativeSkillName(name, host),
  );
}

function adaptHostPaths(content, host) {
  const profile = HOST_PATHS[host];
  const adapted = String(content)
    .replace(
      /(?:(?:\.codex|\.dsh)\/topics\/|(?:\.cursor|\.claude)\/rules\/|rules\/)(f2s-[a-zA-Z0-9-]+)(?:\.(?:mdc?|\*))?/g,
      (_, ruleId) => hostRulePath(profile, ruleId),
    )
    .replace(
      /(?:(?:\.codex|\.dsh|\.cursor|\.claude)\/skills\/|skills\/)(f2s-[a-zA-Z0-9-]+)\/SKILL\.md/g,
      (_, skillName) => hostSkillPath(profile, skillName),
    );
  if (host !== "dsh") return adapted;
  // Native DSH resources are supplied by the provider, not copied into another
  // client's project directory. Keep any remaining ancillary paths provider-relative.
  return adaptNativeSkillNames(
    adapted.replace(/\.(?:codex|cursor|claude|dsh)\//g, ""),
    host,
  );
}

function replaceSection(content, startHeading, endHeading, replacement) {
  const start = content.indexOf(startHeading);
  if (start < 0) return content;
  const end = content.indexOf(endHeading, start + startHeading.length);
  if (end < 0) return content;
  return `${content.slice(0, start)}${replacement.trim()}\n\n${content.slice(end)}`;
}

function adaptNativeDshEntry(content, locale) {
  if (locale === "en-US") {
    return replaceSection(
      content,
      "## Knowledge Base Version Check",
      "## Topic Authoring Pointer",
      `## Knowledge Base Version Check

The native host calls Core \`update.check()\` on session start. The API respects the project \`updateCheck.enabled\` switch and the daily \`.Knowledge/update-check.json\` cache. A notice is displayed when the published Core is newer than the project knowledge version. This check only detects and reports updates; it does not replace the configuration-read or knowledge-routing gates.`,
    );
  }
  return replaceSection(
    content,
    "## 知识库版本自检",
    "## 主题创作",
    `## 知识库版本自检

原生宿主在会话启动时调用 Core \`update.check()\`。该 API 服从项目的 \`updateCheck.enabled\` 开关并复用每日 \`.Knowledge/update-check.json\` 缓存；Core 发布版本高于项目知识版本时，由宿主展示升级提示。版本检查只负责检测与提醒，不替代配置前置读取和知识路由门禁。`,
  );
}

function configSummary(projectConfig, locale) {
  if (!projectConfig || typeof projectConfig !== "object") return "";
  const known = {
    subAgent: projectConfig.subAgent,
    switchAgentVerification: projectConfig.switchAgentVerification,
    intentRecognition: projectConfig.intentRecognition,
    locale: projectConfig.locale,
    changeTracking: projectConfig.changeTracking,
    updateCheck: projectConfig.updateCheck,
    collaboration: projectConfig.collaboration,
  };
  for (const key of Object.keys(known)) {
    if (known[key] === undefined) delete known[key];
  }
  if (Object.keys(known).length === 0) return "";
  const heading = locale === "en-US" ? "## Current Project Configuration" : "## 当前项目配置";
  const note =
    locale === "en-US"
      ? "This snapshot is contextual only. Read `flow2spec.config.json` again before running any `f2s-*` skill."
      : "此摘要只提供当前上下文。执行任何 `f2s-*` 技能前仍须重新读取 `flow2spec.config.json`。";
  return `${heading}\n\n${note}\n\n\`\`\`json\n${JSON.stringify(known, null, 2)}\n\`\`\`\n\n`;
}

function readRule(templatesRoot, locale, ruleId) {
  const relativePath = path.posix.join("rules", `${ruleId}.md`);
  const absolutePath = path.join(templatesDir(templatesRoot, locale), ...relativePath.split("/"));
  if (!fs.existsSync(absolutePath)) return null;
  return { relativePath, content: fs.readFileSync(absolutePath, "utf8") };
}

function skillCatalog(templatesRoot, options = {}) {
  const { host, locale } = normalizeOptions(options);
  const profile = HOST_PATHS[host];
  const skillsRoot = path.join(templatesDir(templatesRoot, locale), "skills");
  if (!fs.existsSync(skillsRoot)) return [];
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const sourceRelativePath = path.posix.join("skills", entry.name, "SKILL.md");
      const sourcePath = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!fs.existsSync(sourcePath)) {
        throw resourceError("F2S_RESOURCE_MISSING", `skill resource missing: ${sourceRelativePath}`, {
          relativePath: sourceRelativePath,
          locale,
        });
      }
      const raw = fs.readFileSync(sourcePath, "utf8");
      const parsed = parseSkillDocument(raw, sourceRelativePath);
      const skillName = nativeSkillName(parsed.name, host);
      const resources = ruleReferenceIds(raw)
        .map((ruleId) => readRule(templatesRoot, locale, ruleId))
        .filter(Boolean)
        .map((resource) => ({
          relativePath: hostRulePath(profile, path.basename(resource.relativePath, ".md")),
          content: adaptHostPaths(resource.content, host),
          mediaType: "text/markdown",
        }));
      return {
        name: skillName,
        description: adaptNativeSkillNames(parsed.description, host),
        content: adaptHostPaths(parsed.body, host),
        relativePath: hostSkillPath(profile, skillName),
        resources,
      };
    });
}

function unifiedEntry(templatesRoot, options = {}) {
  const { host, locale, projectConfig } = normalizeOptions(options);
  const entry = readRule(templatesRoot, locale, "f2s-flow2spec-unified-entry");
  if (!entry) {
    throw resourceError("F2S_RESOURCE_MISSING", "unified entry resource is missing", { locale });
  }
  let content = adaptHostPaths(entry.content, host);
  if (host === "dsh") content = adaptNativeDshEntry(content, locale);
  return `${configSummary(projectConfig, locale)}${content}`;
}

module.exports = {
  SUPPORTED_HOSTS,
  adaptHostPaths,
  skillCatalog,
  unifiedEntry,
};
