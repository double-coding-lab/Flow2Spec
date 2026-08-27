const path = require("path");
const fs = require("fs");
const {
  AGENTS,
  KNOWLEDGE_ROOT,
  KNOWLEDGE_SUBDIRS,
  AGENT_SUBDIRS,
  normalizeAgentIds,
} = require("./agents");
const {
  adaptRuleMdcToClaudeMd,
  shouldWriteClaudeStyleRules,
} = require("./claudeRulesAdapter");
const {
  buildCodexAgentsMd,
  buildCodexAgentsStubMd,
} = require("./codexAgentsAdapter");
const {
  buildDshAgentsMd,
  writeDshAgentsStub,
} = require("./dshAgentsAdapter");
const {
  loadFlow2specConfig,
  ensureFlow2specProjectConfig,
  DEFAULT_LOCALE,
  normalizeLocale,
} = require("./flow2specConfig");
const { writeClaudeAgentHooks } = require("./claudeSettingsAdapter");

const KNOWLEDGE_TOPIC_TYPES = ["feature", "module", "config", "policy"];
const KNOWLEDGE_TOPIC_CONFIDENCE = ["manual", "inferred"];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureKnowledgeDirs(cwd) {
  ensureDir(path.join(cwd, KNOWLEDGE_ROOT));
  for (const sub of KNOWLEDGE_SUBDIRS) {
    ensureDir(path.join(cwd, KNOWLEDGE_ROOT, sub));
  }
}

function removeKnowledgeUpdateCheckCache(cwd) {
  const cachePath = path.join(cwd, KNOWLEDGE_ROOT, "update-check.json");
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { force: true });
  }
}

function ensureFlow2specGitignore(cwd) {
  const gitignorePath = path.join(cwd, ".gitignore");
  const required = [".task/", ".Knowledge/update-check.json"];
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  const missing = required.filter((item) => !lines.includes(item));
  if (missing.length === 0) {
    return { path: gitignorePath, changed: false, added: [] };
  }
  const additions = [];
  if (!lines.includes("# Flow2Spec local state")) {
    additions.push("# Flow2Spec local state");
  }
  additions.push(...missing);
  const prefix = existing && !existing.endsWith("\n") ? `${existing}\n` : existing;
  const separator = prefix && !prefix.endsWith("\n\n") ? "\n" : "";
  fs.writeFileSync(gitignorePath, `${prefix}${separator}${additions.join("\n")}\n`, "utf8");
  return { path: gitignorePath, changed: true, added: missing };
}

function ensureAgentDirs(cwd, agentId) {
  const root = AGENTS[agentId].root;
  ensureDir(path.join(cwd, root));
  for (const sub of AGENT_SUBDIRS[agentId] || []) {
    ensureDir(path.join(cwd, root, sub));
  }
}

/** 递归复制目录或文件到目标，已存在则覆盖 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

/** 递归复制目录或文件，支持扩展名转换（.md <-> .mdc） */
function copyRecursiveWithExtConversion(src, dest, shouldConvertToMdc) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      let destName = name;
      // 处理文件扩展名转换
      if (shouldConvertToMdc && name.endsWith(".md")) {
        destName = name.replace(/\.md$/i, ".mdc");
      }
      copyRecursiveWithExtConversion(
        path.join(src, name),
        path.join(dest, destName),
        shouldConvertToMdc
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyKnowledgeTemplates(cwd, templatesDir, options = {}) {
  const { overwrite = false } = options;
  const srcRoot = path.join(templatesDir, "knowledge");
  const destRoot = path.join(cwd, KNOWLEDGE_ROOT);
  if (!fs.existsSync(srcRoot)) return;
  const result = { written: 0, skipped: 0 };
  for (const name of fs.readdirSync(srcRoot)) {
    if (name === "manifest-matchers.json") {
      continue;
    }
    copyRecursivePreserve(
      path.join(srcRoot, name),
      path.join(destRoot, name),
      overwrite,
      result,
    );
  }
  return result;
}

function copyRecursivePreserve(src, dest, overwrite, result) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursivePreserve(
        path.join(src, name),
        path.join(dest, name),
        overwrite,
        result,
      );
    }
    return;
  }
  if (!overwrite && fs.existsSync(dest)) {
    result.skipped += 1;
    return;
  }
  fs.copyFileSync(src, dest);
  result.written += 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findPackageJsonDir(startDir) {
  let cur = startDir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, "package.json"))) return cur;
    cur = path.dirname(cur);
  }
  return null;
}

function readPackageMetadata(templatesDir) {
  try {
    const packageDir = findPackageJsonDir(templatesDir);
    return readJson(path.join(packageDir || path.join(templatesDir, ".."), "package.json"));
  } catch (_) {
    return {};
  }
}

function resolveTemplatesDir(templatesRoot, locale) {
  const normalized = normalizeLocale(locale, DEFAULT_LOCALE);
  const preferred = path.join(templatesRoot, normalized);
  if (fs.existsSync(preferred)) {
    return { templatesDir: preferred, locale: normalized };
  }
  const fallback = path.join(templatesRoot, DEFAULT_LOCALE);
  if (fs.existsSync(fallback)) {
    return { templatesDir: fallback, locale: DEFAULT_LOCALE };
  }
  return { templatesDir: templatesRoot, locale: DEFAULT_LOCALE };
}

function writeHookScriptWithPackageName(destDir, templatesDir, scriptName) {
  const src = path.join(templatesDir, "hooks", scriptName);
  if (!fs.existsSync(src)) return { written: false, reason: "missing-template" };
  ensureDir(destDir);
  let body = fs.readFileSync(src, "utf8");
  const packageMetadata = readPackageMetadata(templatesDir);
  body = body
    .replace(/__FLOW2SPEC_PACKAGE_NAME__/g, packageMetadata.name || "@double-coding/flow2spec-core")
    .replace(/__FLOW2SPEC_CORE_VERSION__/g, packageMetadata.version || "0.0.0")
    .replace(/__FLOW2SPEC_TEMPLATE_VERSION__/g, packageMetadata.templateVersion || "0.0.0");
  fs.writeFileSync(path.join(destDir, scriptName), body, "utf8");
  return { written: true };
}

function hasHookCommand(groups, fragment) {
  if (!Array.isArray(groups)) return false;
  return groups.some((group) =>
    Array.isArray(group?.hooks) &&
    group.hooks.some(
      (hook) =>
        hook &&
        hook.type === "command" &&
        String(hook.command || "").includes(fragment),
    ),
  );
}

function mergeCodexUpdateCheckHook(existing) {
  const next =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? JSON.parse(JSON.stringify(existing))
      : {};
  if (!next.hooks || typeof next.hooks !== "object" || Array.isArray(next.hooks)) {
    next.hooks = {};
  }
  if (!Array.isArray(next.hooks.SessionStart)) {
    next.hooks.SessionStart = [];
  }
  if (hasHookCommand(next.hooks.SessionStart, "f2s-update-check")) {
    return { config: next, changed: false };
  }
  next.hooks.SessionStart.push({
    matcher: "startup|resume",
    hooks: [
      {
        type: "command",
        command: "node .codex/hooks/f2s-update-check.js",
        statusMessage: "Checking Flow2Spec knowledge version",
      },
    ],
  });
  return { config: next, changed: true };
}

function mergeCodexConfigSessionHook(existing) {
  const next =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? JSON.parse(JSON.stringify(existing))
      : {};
  if (!next.hooks || typeof next.hooks !== "object" || Array.isArray(next.hooks)) {
    next.hooks = {};
  }
  if (!Array.isArray(next.hooks.SessionStart)) {
    next.hooks.SessionStart = [];
  }
  if (hasHookCommand(next.hooks.SessionStart, "f2s-config-session")) {
    return { config: next, changed: false };
  }
  next.hooks.SessionStart.unshift({
    matcher: "startup|resume",
    hooks: [
      {
        type: "command",
        command: "node .codex/hooks/f2s-config-session.js",
      },
    ],
  });
  return { config: next, changed: true };
}

function writeCodexUpdateCheckHook(cwd, templatesDir) {
  const codexRoot = path.join(cwd, ".codex");
  const hooksDir = path.join(codexRoot, "hooks");
  const configSessionResult = writeHookScriptWithPackageName(
    hooksDir,
    templatesDir,
    "f2s-config-session.js",
  );
  const scriptResult = writeHookScriptWithPackageName(
    hooksDir,
    templatesDir,
    "f2s-update-check.js",
  );

  const hooksJsonPath = path.join(codexRoot, "hooks.json");
  let existing = {};
  if (fs.existsSync(hooksJsonPath)) {
    try {
      existing = readJson(hooksJsonPath);
    } catch (_) {
      existing = {};
    }
  }
  const mergedConfigSession = mergeCodexConfigSessionHook(existing);
  const mergedUpdateCheck = mergeCodexUpdateCheckHook(mergedConfigSession.config);
  const config = mergedUpdateCheck.config;
  const changed = mergedConfigSession.changed || mergedUpdateCheck.changed;
  if (changed || !fs.existsSync(hooksJsonPath)) {
    writeJson(hooksJsonPath, config);
  }
  return { configSessionResult, scriptResult, hooksJsonChanged: changed };
}

function mergeCursorUpdateCheckHook(existing) {
  const next =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? JSON.parse(JSON.stringify(existing))
      : {};
  next.version = Number.isFinite(Number(next.version)) ? Number(next.version) : 1;
  if (!next.hooks || typeof next.hooks !== "object" || Array.isArray(next.hooks)) {
    next.hooks = {};
  }
  if (!Array.isArray(next.hooks.sessionStart)) {
    next.hooks.sessionStart = [];
  }
  const exists = next.hooks.sessionStart.some((hook) =>
    hook && String(hook.command || "").includes("f2s-update-check"),
  );
  if (exists) return { config: next, changed: false };
  next.hooks.sessionStart.push({
    command: "node .cursor/hooks/f2s-update-check.js",
    timeout: 10,
  });
  return { config: next, changed: true };
}

function writeCursorUpdateCheckHook(cwd, templatesDir) {
  const cursorRoot = path.join(cwd, ".cursor");
  const hooksDir = path.join(cursorRoot, "hooks");
  const scriptResult = writeHookScriptWithPackageName(
    hooksDir,
    templatesDir,
    "f2s-update-check.js",
  );

  const hooksJsonPath = path.join(cursorRoot, "hooks.json");
  let existing = {};
  if (fs.existsSync(hooksJsonPath)) {
    try {
      existing = readJson(hooksJsonPath);
    } catch (_) {
      existing = {};
    }
  }
  const { config, changed } = mergeCursorUpdateCheckHook(existing);
  if (changed || !fs.existsSync(hooksJsonPath)) {
    writeJson(hooksJsonPath, config);
  }
  return { scriptResult, hooksJsonChanged: changed };
}

function buildDefaultMatcherPath(matcherId) {
  return `${KNOWLEDGE_ROOT}/matchers/${matcherId}.json`;
}

function normalizeMatcherShardData(raw, matcherId) {
  const safeRaw =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    ...safeRaw,
    id: matcherId,
    includeAny: dedupeStringArray(safeRaw.includeAny || []),
  };
}

function dedupeStringArray(values) {
  const out = [];
  const seen = new Set();
  for (const item of values || []) {
    if (typeof item !== "string") continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function unionByKey(templateList, existingList, key, mergeItem) {
  const existingMap = new Map();
  for (const item of existingList || []) {
    if (!item || typeof item !== "object") continue;
    if (!item[key] || typeof item[key] !== "string") continue;
    existingMap.set(item[key], item);
  }

  const out = [];
  const orderedKeys = [];

  for (const item of templateList || []) {
    if (!item || typeof item !== "object") continue;
    const id = item[key];
    if (!id || typeof id !== "string") continue;
    orderedKeys.push(id);
    const existing = existingMap.get(id);
    out.push(mergeItem(item, existing));
  }

  for (const item of existingList || []) {
    if (!item || typeof item !== "object") continue;
    const id = item[key];
    if (!id || typeof id !== "string") continue;
    if (orderedKeys.includes(id)) continue;
    out.push(item);
  }

  return out;
}

function mergeTopicDependencies(templateDeps, existingDeps) {
  const out = {};
  const keys = new Set([
    ...Object.keys(templateDeps || {}),
    ...Object.keys(existingDeps || {}),
  ]);
  for (const key of keys) {
    out[key] = dedupeStringArray([
      ...(templateDeps?.[key] || []),
      ...(existingDeps?.[key] || []),
    ]);
  }
  return out;
}

function normalizeTopicMetadataEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (!KNOWLEDGE_TOPIC_TYPES.includes(entry.primary)) return null;
  const confidence =
    typeof entry.confidence === "string" &&
    KNOWLEDGE_TOPIC_CONFIDENCE.includes(entry.confidence)
      ? entry.confidence
      : null;
  if (!confidence) return null;
  const result = { primary: entry.primary, confidence };
  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    const validTags = dedupeStringArray(entry.tags).filter(
      (t) =>
        KNOWLEDGE_TOPIC_TYPES.includes(t) &&
        t !== entry.primary,
    );
    if (validTags.length > 0) result.tags = validTags;
  }
  return result;
}

function mergeTopicMetadata(templateMetadata, existingMetadata, topicPaths) {
  const out = {};
  const topicIds = new Set(Object.keys(topicPaths || {}));
  // existingMetadata 先写，templateMetadata 后写覆盖——模板优先
  for (const metadata of [existingMetadata, templateMetadata]) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      continue;
    }
    for (const [topicId, entry] of Object.entries(metadata)) {
      if (!topicIds.has(topicId)) continue;
      const normalized = normalizeTopicMetadataEntry(entry);
      if (!normalized) continue;
      out[topicId] = normalized;
    }
  }
  return out;
}

function buildMergedRouting(templateRouting, existingRouting, templateVersion, isFirstInit = false) {
  const mergedTaskRules = unionByKey(
    templateRouting.taskToTopicRules,
    existingRouting.taskToTopicRules,
    "task",
    (templateRule, existingRule) => {
      if (!existingRule) return templateRule;
      const mergedMatcherId = existingRule.matcherId || templateRule.matcherId;
      return {
        ...templateRule,
        ...existingRule,
        matcherId: mergedMatcherId,
        matcherPath:
          existingRule.matcherPath ||
          templateRule.matcherPath ||
          (mergedMatcherId ? buildDefaultMatcherPath(mergedMatcherId) : null),
        topics: dedupeStringArray([
          ...(templateRule.topics || []),
          ...(existingRule.topics || []),
        ]),
      };
    },
  );

  const knownMerged = {
    version: templateVersion || templateRouting.version || existingRouting.version,
    knowledgeRoot:
      existingRouting.knowledgeRoot || templateRouting.knowledgeRoot,
    generatedFrom:
      existingRouting.generatedFrom || templateRouting.generatedFrom,
    matcherKey:
      existingRouting.matcherKey || templateRouting.matcherKey || "matcherId",
    sourceOfTruth:
      existingRouting.sourceOfTruth ||
      templateRouting.sourceOfTruth ||
      `${KNOWLEDGE_ROOT}/manifest-routing.json`,
    fallbackTopic:
      existingRouting.fallbackTopic || templateRouting.fallbackTopic,
    topicDependencies: mergeTopicDependencies(
      templateRouting.topicDependencies,
      existingRouting.topicDependencies,
    ),
    topicPaths: {
      ...(templateRouting.topicPaths || {}),
      ...(existingRouting.topicPaths || {}),
    },
    taskToTopicRules: mergedTaskRules,
  };
  // projectRev：本项目已基线对齐到的包模板修订号（由 f2s-kb-upgrade 完整流程跑完 3a/3b 后写入）。
  // init 行为：
  //   - 首次初始化（项目侧 manifest-routing.json 此前不存在）：按模板写入，等同首次落地即视为已对齐。
  //   - 已存在 manifest-routing.json：不写、不覆盖项目侧值；由 f2s-kb-upgrade 在完整流程末尾改写。
  if (isFirstInit) {
    if (Object.prototype.hasOwnProperty.call(templateRouting, "projectRev")) {
      knownMerged.projectRev = templateRouting.projectRev;
    }
  } else if (
    Object.prototype.hasOwnProperty.call(existingRouting, "projectRev")
  ) {
    knownMerged.projectRev = existingRouting.projectRev;
  }
  // pkgRev：本次 init 用的包模板修订号（= 包侧 projectRev 快照），供 f2s-kb-upgrade 步骤 2c 取用。
  // 每次 init 都按当前包模板覆盖（不沿用项目原值）。包模板未声明该字段 → 删除项目侧旧值，让 SKILL 走 null 兜底。
  if (
    Object.prototype.hasOwnProperty.call(templateRouting, "projectRev") &&
    typeof templateRouting.projectRev === "number" &&
    Number.isFinite(templateRouting.projectRev)
  ) {
    knownMerged.pkgRev = templateRouting.projectRev;
  }
  const mergedTopicMetadata = mergeTopicMetadata(
    templateRouting.topicMetadata,
    existingRouting.topicMetadata,
    knownMerged.topicPaths,
  );
  if (Object.keys(mergedTopicMetadata).length > 0) {
    knownMerged.topicMetadata = mergedTopicMetadata;
  }

  const knownKeys = new Set(Object.keys(knownMerged));
  const extras = {};
  for (const [key, value] of Object.entries(existingRouting || {})) {
    if (knownKeys.has(key)) continue;
    extras[key] = value;
  }

  const merged = {
    ...knownMerged,
    ...extras,
  };
  delete merged.matchersFile;
  return merged;
}

function buildMergedMatchers(templateMatchers, existingMatchers) {
  const templateMap = templateMatchers.matchers || {};
  const existingMap = existingMatchers.matchers || {};
  const allMatcherIds = new Set([
    ...Object.keys(templateMap),
    ...Object.keys(existingMap),
  ]);
  const mergedMatchers = {};
  for (const matcherId of allMatcherIds) {
    const templateItem = templateMap[matcherId] || {};
    const existingItem = existingMap[matcherId] || {};
    mergedMatchers[matcherId] = {
      ...templateItem,
      ...existingItem,
      includeAny: dedupeStringArray([
        ...(templateItem.includeAny || []),
        ...(existingItem.includeAny || []),
      ]),
    };
  }

  const knownMerged = {
    version: templateMatchers.version || existingMatchers.version,
    generatedFrom:
      existingMatchers.generatedFrom || templateMatchers.generatedFrom,
    matcherKey:
      existingMatchers.matcherKey || templateMatchers.matcherKey || "matcherId",
    sourceOfTruth:
      existingMatchers.sourceOfTruth ||
      templateMatchers.sourceOfTruth ||
      `${KNOWLEDGE_ROOT}/manifest-routing.json`,
    matchers: mergedMatchers,
  };

  const knownKeys = new Set(Object.keys(knownMerged));
  const extras = {};
  for (const [key, value] of Object.entries(existingMatchers || {})) {
    if (knownKeys.has(key)) continue;
    extras[key] = value;
  }

  return {
    ...knownMerged,
    ...extras,
  };
}

function ensureRoutingMatcherPaths(routing) {
  const rules = Array.isArray(routing.taskToTopicRules)
    ? routing.taskToTopicRules
    : [];
  let changed = false;
  const nextRules = rules.map((rule) => {
    if (!rule || typeof rule !== "object") return rule;
    if (!rule.matcherId || typeof rule.matcherId !== "string") return rule;
    if (rule.matcherPath && typeof rule.matcherPath === "string") return rule;
    changed = true;
    return {
      ...rule,
      matcherPath: buildDefaultMatcherPath(rule.matcherId),
    };
  });
  if (!changed) return { routing, changed };
  return {
    routing: {
      ...routing,
      taskToTopicRules: nextRules,
    },
    changed,
  };
}

function buildMatcherIdToPathMap(routing) {
  const out = new Map();
  const rules = Array.isArray(routing.taskToTopicRules)
    ? routing.taskToTopicRules
    : [];
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    if (!rule.matcherId || typeof rule.matcherId !== "string") continue;
    const matcherPath =
      rule.matcherPath && typeof rule.matcherPath === "string"
        ? rule.matcherPath
        : buildDefaultMatcherPath(rule.matcherId);
    if (!out.has(rule.matcherId)) {
      out.set(rule.matcherId, matcherPath);
    }
  }
  return out;
}

function ensureMatcherShards(cwd, routing, mergedMatchers) {
  const matcherIdToPath = buildMatcherIdToPathMap(routing);
  const matcherMap =
    mergedMatchers?.matchers && typeof mergedMatchers.matchers === "object"
      ? mergedMatchers.matchers
      : {};

  for (const matcherId of Object.keys(matcherMap)) {
    if (!matcherIdToPath.has(matcherId)) {
      matcherIdToPath.set(matcherId, buildDefaultMatcherPath(matcherId));
    }
  }

  let changed = false;
  let writtenCount = 0;
  for (const [matcherId, matcherPath] of matcherIdToPath.entries()) {
    const matcherAbs = resolveFromCwd(cwd, matcherPath);
    ensureDir(path.dirname(matcherAbs));

    const compatMatcher = matcherMap[matcherId];
    const existingShard = fs.existsSync(matcherAbs) ? readJson(matcherAbs) : {};
    const nextShard = normalizeMatcherShardData(
      {
        ...(compatMatcher && typeof compatMatcher === "object"
          ? compatMatcher
          : {}),
        ...(existingShard && typeof existingShard === "object"
          ? existingShard
          : {}),
      },
      matcherId,
    );

    const prevRaw = fs.existsSync(matcherAbs)
      ? JSON.stringify(existingShard)
      : null;
    const nextRaw = JSON.stringify(nextShard);
    if (prevRaw === nextRaw) continue;

    writeJson(matcherAbs, nextShard);
    writtenCount += 1;
    changed = true;
  }

  return { changed, writtenCount };
}

/**
 * 把「本次 init 用的包模板 projectRev」写入项目侧 `.Knowledge/manifest-routing.json` 的 `pkgRev` 顶层字段，
 * 供 `f2s-kb-upgrade` 步骤 2c 取用。在 reset 与 incremental 两条路径之后无条件调用一次。
 *
 * @param {string} cwd 项目根
 * @param {string} templatesDir 当前 locale 模板根
 */
function finalizePkgRev(cwd, templatesDir) {
  const routingPath = path.join(cwd, KNOWLEDGE_ROOT, "manifest-routing.json");
  const templateRoutingPath = path.join(
    templatesDir,
    "knowledge",
    "manifest-routing.json",
  );
  if (!fs.existsSync(routingPath) || !fs.existsSync(templateRoutingPath)) {
    return { written: false, pkgRev: null };
  }
  let templateRev = null;
  try {
    const tpl = readJson(templateRoutingPath);
    if (
      Object.prototype.hasOwnProperty.call(tpl, "projectRev") &&
      typeof tpl.projectRev === "number" &&
      Number.isFinite(tpl.projectRev)
    ) {
      templateRev = tpl.projectRev;
    }
  } catch {
    // 模板读不到则不写；保留项目侧旧值（如已有）
    return { written: false, pkgRev: null };
  }
  let routing;
  try {
    routing = readJson(routingPath);
  } catch {
    return { written: false, pkgRev: null };
  }
  // reset 路径直接复制模板时，用 Core 包内独立模板版本覆盖 manifest.version。
  let changed = false;
  try {
    const pkgJsonPath = path.join(__dirname, "..", "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      const templateVersion = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")).templateVersion;
      if (typeof templateVersion === "string" && routing.version !== templateVersion) {
        routing.version = templateVersion;
        changed = true;
      }
    }
  } catch {
    // 读不到 package.json 不影响主流程
  }
  if (templateRev !== null) {
    if (routing.pkgRev !== templateRev) {
      routing.pkgRev = templateRev;
      changed = true;
    }
  } else if (
    Object.prototype.hasOwnProperty.call(routing, "pkgRev")
  ) {
    // 包模板未声明 projectRev 时，清掉项目侧的陈旧 pkgRev，让 SKILL 走 null 兜底
    delete routing.pkgRev;
    changed = true;
  }
  if (!changed) {
    return { written: false, pkgRev: templateRev };
  }
  writeJson(routingPath, routing);
  return { written: true, pkgRev: templateRev };
}

function upgradeKnowledgeRoutingAndMatchers(cwd, templatesDir, options = {}) {
  const { overwrite = false } = options;
  if (overwrite) {
    return {
      upgraded: false,
      reason: "overwrite",
    };
  }

  const templateRoutingPath = path.join(
    templatesDir,
    "knowledge",
    "manifest-routing.json",
  );
  const templateMatchersPath = path.join(
    templatesDir,
    "knowledge",
    "manifest-matchers.json",
  );
  if (
    !fs.existsSync(templateRoutingPath) ||
    !fs.existsSync(templateMatchersPath)
  ) {
    return {
      upgraded: false,
      reason: "missing-routing-templates",
    };
  }

  const routingPath = path.join(cwd, KNOWLEDGE_ROOT, "manifest-routing.json");
  const matchersPath = path.join(cwd, KNOWLEDGE_ROOT, "manifest-matchers.json");

  const templateRouting = readJson(templateRoutingPath);
  const templateMatchers = readJson(templateMatchersPath);
  const hadRouting = fs.existsSync(routingPath);
  const hadMatchers = fs.existsSync(matchersPath);
  const existingRouting = hadRouting ? readJson(routingPath) : {};
  const existingMatchers = hadMatchers ? readJson(matchersPath) : {};

  // 读取 Core 包内独立模板版本，用于写入 manifest-routing.json.version。
  let templateVersion;
  try {
    const packageDir = findPackageJsonDir(templatesDir);
    templateVersion = readJson(path.join(packageDir || path.join(templatesDir, ".."), "package.json")).templateVersion;
  } catch (_) {}

  const mergedRouting = buildMergedRouting(templateRouting, existingRouting, templateVersion, !hadRouting);
  const mergedMatchers = buildMergedMatchers(
    templateMatchers,
    existingMatchers,
  );
  const {
    routing: mergedRoutingWithMatcherPath,
    changed: matcherPathBackfilled,
  } = ensureRoutingMatcherPaths(mergedRouting);
  const matcherShardUpgrade = ensureMatcherShards(
    cwd,
    mergedRoutingWithMatcherPath,
    mergedMatchers,
  );

  const oldRoutingRaw = JSON.stringify(existingRouting);
  const newRoutingRaw = JSON.stringify(mergedRoutingWithMatcherPath);
  const oldMatchersRaw = JSON.stringify(existingMatchers);
  const newMatchersRaw = JSON.stringify(mergedMatchers);

  if (!hadRouting || oldRoutingRaw !== newRoutingRaw) {
    writeJson(routingPath, mergedRoutingWithMatcherPath);
  }

  const routingChanged = !hadRouting || oldRoutingRaw !== newRoutingRaw;
  const legacyAggregateDiffers =
    hadMatchers && oldMatchersRaw !== newMatchersRaw;
  let legacyMatchersFileRemoved = false;
  if (fs.existsSync(matchersPath)) {
    try {
      fs.unlinkSync(matchersPath);
      legacyMatchersFileRemoved = true;
    } catch (e) {
      /* 保留文件时由下次 init 重试 */
    }
  }
  const upgraded =
    routingChanged ||
    legacyAggregateDiffers ||
    matcherShardUpgrade.changed ||
    legacyMatchersFileRemoved;

  return {
    upgraded,
    reason: upgraded ? "merged" : "up-to-date",
    routingChanged,
    legacyAggregateDiffers,
    legacyMatchersFileRemoved,
    matcherPathBackfilled,
    matcherShardChanged: matcherShardUpgrade.changed,
    matcherShardWritten: matcherShardUpgrade.writtenCount,
  };
}

function resolveFromCwd(cwd, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.join(cwd, maybeRelativePath);
}

function validateKnowledgeRouting(cwd) {
  const routingPath = path.join(cwd, KNOWLEDGE_ROOT, "manifest-routing.json");
  const matchersPath = path.join(cwd, KNOWLEDGE_ROOT, "manifest-matchers.json");
  if (!fs.existsSync(routingPath)) {
    throw new Error(
      `缺少知识库路由清单：${path.join(KNOWLEDGE_ROOT, "manifest-routing.json")}`,
    );
  }
  let routing;
  let matcherData = null;
  try {
    routing = JSON.parse(fs.readFileSync(routingPath, "utf8"));
  } catch (e) {
    throw new Error(`路由清单 JSON 解析失败：${routingPath}`);
  }
  if (fs.existsSync(matchersPath)) {
    try {
      matcherData = JSON.parse(fs.readFileSync(matchersPath, "utf8"));
    } catch (e) {
      throw new Error(`匹配清单 JSON 解析失败：${matchersPath}`);
    }
  }

  if (!routing.topicPaths || typeof routing.topicPaths !== "object") {
    throw new Error("路由清单缺少 topicPaths，无法执行主题路由。");
  }

  const topicIds = new Set(Object.keys(routing.topicPaths));
  if (topicIds.size === 0) {
    throw new Error("路由清单 topicPaths 为空，无法执行主题路由。");
  }

  for (const [topicId, topicPath] of Object.entries(routing.topicPaths)) {
    if (!topicId || typeof topicId !== "string") {
      throw new Error("topicPaths 中存在非法 topicId。");
    }
    if (!topicPath || typeof topicPath !== "string") {
      throw new Error(`topicPaths.${topicId} 必须是字符串路径。`);
    }
    const topicAbs = resolveFromCwd(cwd, topicPath);
    if (!fs.existsSync(topicAbs)) {
      throw new Error(`路由清单引用的 topic 不存在：${topicPath}`);
    }
  }

  if (routing.fallbackTopic && !topicIds.has(routing.fallbackTopic)) {
    throw new Error(
      `fallbackTopic 不存在于 topicPaths：${routing.fallbackTopic}`,
    );
  }

  if (
    routing.topicDependencies &&
    typeof routing.topicDependencies === "object"
  ) {
    for (const [topicId, deps] of Object.entries(routing.topicDependencies)) {
      if (!topicIds.has(topicId)) {
        throw new Error(`topicDependencies 引用了不存在的 topic：${topicId}`);
      }
      if (!Array.isArray(deps)) {
        throw new Error(`topicDependencies.${topicId} 必须是数组。`);
      }
      for (const depId of deps) {
        if (!topicIds.has(depId)) {
          throw new Error(
            `topicDependencies.${topicId} 引用了不存在的依赖：${depId}`,
          );
        }
      }
    }
  }

  if (routing.topicMetadata !== undefined) {
    if (
      !routing.topicMetadata ||
      typeof routing.topicMetadata !== "object" ||
      Array.isArray(routing.topicMetadata)
    ) {
      throw new Error("topicMetadata 必须是对象。");
    }
    for (const [topicId, metadata] of Object.entries(routing.topicMetadata)) {
      if (!topicIds.has(topicId)) {
        throw new Error(`topicMetadata 引用了不存在的 topic：${topicId}`);
      }
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new Error(`topicMetadata.${topicId} 必须是对象。`);
      }
      for (const key of Object.keys(metadata)) {
        if (!["primary", "tags", "confidence"].includes(key)) {
          throw new Error(`topicMetadata.${topicId} 包含未知字段：${key}`);
        }
      }
      if (!KNOWLEDGE_TOPIC_TYPES.includes(metadata.primary)) {
        throw new Error(
          `topicMetadata.${topicId}.primary 非法：${metadata.primary}`,
        );
      }
      if (!KNOWLEDGE_TOPIC_CONFIDENCE.includes(metadata.confidence)) {
        throw new Error(
          `topicMetadata.${topicId}.confidence 非法：${metadata.confidence}`,
        );
      }
      if (metadata.tags !== undefined) {
        if (!Array.isArray(metadata.tags)) {
          throw new Error(`topicMetadata.${topicId}.tags 必须是数组。`);
        }
        const seenTags = new Set();
        for (const tag of metadata.tags) {
          if (!KNOWLEDGE_TOPIC_TYPES.includes(tag)) {
            throw new Error(`topicMetadata.${topicId}.tags 包含非法值：${tag}`);
          }
          if (tag === metadata.primary) {
            throw new Error(
              `topicMetadata.${topicId}.tags 不应与 primary 重复：${tag}`,
            );
          }
          if (seenTags.has(tag)) {
            throw new Error(`topicMetadata.${topicId}.tags 包含重复值：${tag}`);
          }
          seenTags.add(tag);
        }
      }
    }
  }

  const matcherMap =
    matcherData?.matchers && typeof matcherData.matchers === "object"
      ? matcherData.matchers
      : null;
  if (matcherData && !matcherMap) {
    throw new Error("匹配清单缺少 matchers 对象。");
  }

  if (Array.isArray(routing.taskToTopicRules)) {
    for (const rule of routing.taskToTopicRules) {
      if (!rule || typeof rule !== "object") {
        throw new Error("taskToTopicRules 存在非法项（非对象）。");
      }
      if (!rule.task || typeof rule.task !== "string") {
        throw new Error("taskToTopicRules 每项必须包含字符串类型的 task。");
      }
      if (!Array.isArray(rule.topics) || rule.topics.length === 0) {
        throw new Error(`taskToTopicRules(${rule.task}) 必须包含非空 topics。`);
      }
      if (!rule.matcherId || typeof rule.matcherId !== "string") {
        throw new Error(`taskToTopicRules(${rule.task}) 必须包含 matcherId。`);
      }
      if (!rule.matcherPath || typeof rule.matcherPath !== "string") {
        throw new Error(`taskToTopicRules(${rule.task}) 必须包含 matcherPath。`);
      }
      const matcherAbs = resolveFromCwd(cwd, rule.matcherPath);
      if (!fs.existsSync(matcherAbs)) {
        throw new Error(
          `taskToTopicRules(${rule.task}) 引用了不存在的 matcherPath：${rule.matcherPath}`,
        );
      }
      let matcherShard;
      try {
        matcherShard = JSON.parse(fs.readFileSync(matcherAbs, "utf8"));
      } catch (e) {
        throw new Error(`matcherPath JSON 解析失败：${rule.matcherPath}`);
      }
      if (!matcherShard || typeof matcherShard !== "object") {
        throw new Error(`matcherPath 内容非法（非对象）：${rule.matcherPath}`);
      }
      if (matcherShard.id !== rule.matcherId) {
        throw new Error(
          `matcherPath(${rule.matcherPath}) 的 id 与 matcherId 不一致：${matcherShard.id} vs ${rule.matcherId}`,
        );
      }
      if (!Array.isArray(matcherShard.includeAny)) {
        throw new Error(
          `matcherPath(${rule.matcherPath}) 的 includeAny 必须为数组。`,
        );
      }
      for (const topicId of rule.topics) {
        if (!topicIds.has(topicId)) {
          throw new Error(
            `taskToTopicRules(${rule.task}) 引用了不存在的 topic：${topicId}`,
          );
        }
      }
    }
  }
}

/**
 * 将当前 locale 包模板 knowledge/index.md 原样复制到目标 cwd 下 .Knowledge/template/index.template.md，
 * 供 f2s-kb-upgrade 技能步骤 3b 与宿主仓 .Knowledge/index.md 对照；init 不修改 index.md 正文。
 * 注意：模板正文声明「.Knowledge」指宿主仓；与 flow2spec 开发仓根 .Knowledge（产品自用知识库）职责不同。
 */
function copyKnowledgeIndexTemplateSnapshot(cwd, templatesDir) {
  const src = path.join(templatesDir, "knowledge", "index.md");
  const destDir = path.join(cwd, KNOWLEDGE_ROOT, "template");
  const dest = path.join(destDir, "index.template.md");
  if (!fs.existsSync(src)) {
    return { written: false, reason: "missing-template-index" };
  }
  ensureDir(destDir);
  fs.copyFileSync(src, dest);
  return { written: true };
}

function copyRulesTemplates(cwd, agentRoot, templatesDir) {
  const rulesSrc = path.join(templatesDir, "rules");
  const rulesDest = path.join(cwd, agentRoot, "rules");
  if (!fs.existsSync(rulesSrc)) return;
  ensureDir(rulesDest);

  // 判断是否应该转换为 .md：Claude 和 Codex 使用 .md，Cursor 使用 .mdc
  const isCursorAgent = agentRoot === ".cursor";
  const shouldConvertToMd = !isCursorAgent;

  const claudeStyle = shouldWriteClaudeStyleRules(agentRoot);
  if (claudeStyle) {
    for (const name of fs.readdirSync(rulesDest)) {
      if (name.endsWith(".mdc")) {
        fs.unlinkSync(path.join(rulesDest, name));
      }
    }
  }

  for (const name of fs.readdirSync(rulesSrc)) {
    const srcPath = path.join(rulesSrc, name);
    const st = fs.statSync(srcPath);
    if (st.isDirectory()) {
      copyRecursive(srcPath, path.join(rulesDest, name));
      continue;
    }
    // 对于 .md 文件（模板源）
    if (name.endsWith(".md")) {
      const raw = fs.readFileSync(srcPath, "utf8");
      if (isCursorAgent) {
        // Cursor 需要转换为 .mdc
        const destName = name.replace(/\.md$/i, ".mdc");
        fs.writeFileSync(path.join(rulesDest, destName), raw, "utf8");
      } else {
        // Claude 和 Codex 保持 .md
        const body = claudeStyle ? adaptRuleMdcToClaudeMd(raw) : raw;
        fs.writeFileSync(path.join(rulesDest, name), body, "utf8");
      }
      continue;
    }
    if (!name.endsWith(".mdc")) {
      fs.copyFileSync(srcPath, path.join(rulesDest, name));
      continue;
    }
    const raw = fs.readFileSync(srcPath, "utf8");
    const body = claudeStyle ? adaptRuleMdcToClaudeMd(raw) : raw;
    const destName = claudeStyle ? name.replace(/\.mdc$/i, ".md") : name;
    fs.writeFileSync(path.join(rulesDest, destName), body, "utf8");
  }
}

function copySkills(cwd, agentRoot, templatesDir) {
  const destRoot = path.join(cwd, agentRoot);
  const skillsSrc = path.join(templatesDir, "skills");

  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(destRoot, "skills");
    ensureDir(skillsDest);
    const templateNames = new Set(fs.readdirSync(skillsSrc));
    // skills 目录：所有平台都保持 .md 格式，不转换
    for (const name of templateNames) {
      copyRecursive(path.join(skillsSrc, name), path.join(skillsDest, name));
    }
    // 删除配置根中以 f2s- 开头、但已不存在于当前 locale templates/skills/ 的旧 skill 目录
    // 只清理 Flow2Spec 管理的 skill，不触碰用户自定义 skill
    // LEGACY_SKILLS：非 f2s- 开头的历史旧名，也需一并清理
    const LEGACY_SKILLS = new Set(["stock-docs-vs-req-docs"]);
    if (fs.existsSync(skillsDest)) {
      for (const name of fs.readdirSync(skillsDest)) {
        if ((name.startsWith("f2s-") || LEGACY_SKILLS.has(name)) && !templateNames.has(name)) {
          fs.rmSync(path.join(skillsDest, name), { recursive: true, force: true });
        }
      }
    }
  }
}

function removeLegacyAgentTemplateDir(cwd, agentRoot) {
  const templateDir = path.join(cwd, agentRoot, "template");
  if (fs.existsSync(templateDir)) {
    fs.rmSync(templateDir, { recursive: true, force: true });
  }
}

function stripMdcFrontmatter(src) {
  return src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function writeTopicMirrors(cwd, templatesDir, agentRoot) {
  const rulesDir = path.join(templatesDir, "rules");
  const outDir = path.join(cwd, agentRoot, "topics");
  ensureDir(outDir);
  if (!fs.existsSync(rulesDir)) return;
  // Mirror rule templates for clients that load long-form guidance on demand.
  const names = fs
    .readdirSync(rulesDir)
    .filter((n) => {
      const lower = n.toLowerCase();
      return lower.endsWith(".md") || lower.endsWith(".mdc");
    })
    .sort();
  for (const name of names) {
    const srcPath = path.join(rulesDir, name);
    if (!fs.statSync(srcPath).isFile()) continue;
    const raw = fs.readFileSync(srcPath, "utf8");
    const body = stripMdcFrontmatter(raw).trimStart();
    const outName = name.replace(/\.(md|mdc)$/i, ".md");
    fs.writeFileSync(path.join(outDir, outName), body, "utf8");
  }
}

function writeCodexTopicMirrors(cwd, templatesDir) {
  writeTopicMirrors(cwd, templatesDir, ".codex");
}

/**
 * 完整条令写仓库根；.codex/AGENTS.md 仅为指针，避免双份全文重复与 cwd 在 .codex 时双倍拼接。
 */
function writeCodexEntry(cwd, templatesDir, projectConfig) {
  const full = buildCodexAgentsMd(templatesDir, projectConfig);
  const stub = buildCodexAgentsStubMd(templatesDir);
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), full, "utf8");
  fs.writeFileSync(path.join(cwd, ".codex", "AGENTS.md"), stub, "utf8");
  writeCodexTopicMirrors(cwd, templatesDir);
}

/** Write the root instructions needed by DeepSeek Harness without overwriting an existing entry. */
function writeDshEntry(cwd, templatesDir, projectConfig) {
  const agentsPath = path.join(cwd, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(
      agentsPath,
      buildDshAgentsMd(templatesDir, projectConfig),
      "utf8",
    );
  }
  writeDshAgentsStub(cwd, templatesDir);
  writeTopicMirrors(cwd, templatesDir, ".dsh");
}

function writeAgentArtifacts(cwd, agentId, templatesDir, projectConfig) {
  const root = AGENTS[agentId].root;
  copySkills(cwd, root, templatesDir);
  removeLegacyAgentTemplateDir(cwd, root);
  if (agentId === "dsh") {
    writeDshEntry(cwd, templatesDir, projectConfig);
  } else if (agentId !== "codex") {
    copyRulesTemplates(cwd, root, templatesDir);
  } else {
    writeCodexEntry(cwd, templatesDir, projectConfig);
  }
}

/**
 * @param {string} cwd
 * @param {string[]} [agentIds]  不传则仅 cursor
 * @param {object}  [options]
 * @param {boolean} [options.overwriteKnowledge]
 * @param {object}  [options.configValues]  init 交互收集的配置字段值
 * @param {string}  [options.locale]  显式模板语言
 */
async function run(cwd, agentIds, options = {}) {
  const { overwriteKnowledge = false, configValues } = options;
  const ids = options.mode === "native-host"
    ? []
    : normalizeAgentIds(agentIds || []);
  const templatesRoot = path.join(__dirname, "..", "templates");
  const existingConfig = loadFlow2specConfig(cwd);
  const requestedLocale = normalizeLocale(
    options.locale || configValues?.locale || existingConfig.locale,
    DEFAULT_LOCALE,
  );
  const { templatesDir, locale } = resolveTemplatesDir(templatesRoot, requestedLocale);
  const effectiveConfigValues = { ...(configValues || {}) };
  if (options.locale) {
    effectiveConfigValues.locale = locale;
  }

  ensureKnowledgeDirs(cwd);
  removeKnowledgeUpdateCheckCache(cwd);
  const gitignoreResult = ensureFlow2specGitignore(cwd);
  ensureFlow2specProjectConfig(cwd, templatesDir, {
    overwrite: false,
    values: Object.keys(effectiveConfigValues).length ? effectiveConfigValues : undefined,
  });
  const knowledgeResult = copyKnowledgeTemplates(cwd, templatesDir, {
    overwrite: overwriteKnowledge,
  });
  const routingUpgrade = upgradeKnowledgeRoutingAndMatchers(cwd, templatesDir, {
    overwrite: overwriteKnowledge,
  });
  finalizePkgRev(cwd, templatesDir);
  validateKnowledgeRouting(cwd);

  const indexSnapshot = copyKnowledgeIndexTemplateSnapshot(cwd, templatesDir);

  const projectConfig = loadFlow2specConfig(cwd);

  const claudeHooksResult = {};
  for (const id of ids) {
    // 虚拟目标（root: null，如 plugin 插件模式）：能力由客户端插件提供，不写配置根。
    if (!AGENTS[id].root) continue;
    ensureAgentDirs(cwd, id);
    writeAgentArtifacts(cwd, id, templatesDir, projectConfig);
    if (id === "claude") {
      const result = writeClaudeAgentHooks(cwd, templatesDir);
      claudeHooksResult.hookScriptWritten = result.hookScriptResult?.written ?? false;
      claudeHooksResult.settingsChanged = result.settingsChanged;
    }
    // Cursor：写入官方 hooks.json，使 sessionStart 自动运行更新检测。
    if (id === "cursor") {
      writeCursorUpdateCheckHook(cwd, templatesDir);
    }
    // Codex：写入官方 hooks.json，使 SessionStart 自动运行更新检测。
    if (id === "codex") {
      writeCodexUpdateCheckHook(cwd, templatesDir);
    }
  }
  return {
    ids,
    mode: options.mode || "project-adapter",
    knowledgeResult,
    overwriteKnowledge,
    routingUpgrade,
    indexSnapshot,
    gitignoreResult,
    projectConfig,
    locale,
    claudeHooksResult,
  };
}

module.exports = run;
