const fs = require("fs");
const path = require("path");
const { KNOWLEDGE_ROOT } = require("./agents");
const { loadFlow2specConfig } = require("./flow2specConfig");
const { resolveDeveloperContext, activeTaskDir } = require("./developerId");

const KNOWLEDGE_FILENAME = "manifest-routing.json";
const MATCHERS_FILENAME = "manifest-matchers.json";
const INDEX_FILENAME = "index.md";
const TOPIC_DIR = "topics";
const DELTA_FILENAME = "kb-delta.json";
const KB_COMMANDS = new Set([
  "appendBody",
  "replaceBody",
  "updateFrontmatter",
  "createTopic",
]);
const ALLOWED_TOPIC_PRIMARY = new Set(["policy", "config", "feature", "module"]);
const ALLOWED_TOPIC_CONFIDENCE = new Set(["manual", "inferred"]);
const TOPIC_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MATCHER_ID_RE = /^m-[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function resolveFromCwd(cwd, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.join(cwd, maybeRelativePath);
}

function isPlainObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeStringArray(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue;
    const item = value.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function parseInlineArray(raw) {
  const source = String(raw || "").trim();
  if (!source) return [];
  const out = [];
  let token = "";
  let quote = null;
  let escaped = false;
  const pushToken = () => {
    const value = token.trim();
    if (value) out.push(parseFrontmatterScalar(value));
    token = "";
  };
  for (const ch of source) {
    if (escaped) {
      token += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      token += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      token += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      token += ch;
      quote = ch;
      continue;
    }
    if (ch === ",") {
      pushToken();
      continue;
    }
    token += ch;
  }
  pushToken();
  return out;
}

// NOTE(frontmatter-subset): parse* / stringify* 只支持有限 YAML 子集
// （null/bool/int/float/裸字符串/单层数组）。当前所有 change 类型
// 都会经 normalizeTopicFrontmatter / normalizeStringArray 归一化，
// 类型是可控的。若未来允许 delta 直接写入任意 frontmatter，需要：
//   1) 显式声明每个字段的期望类型（否则会踩到 "3"↔3 类型漂移）；
//   2) 或者引入一个真正的 YAML 库（如 yaml/js-yaml）替换本节。
// 详情见 review 结论 L2。
function parseFrontmatterScalar(raw) {
  const value = String(raw || "").trim();
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return parseInlineArray(value.slice(1, -1));
  }
  return value;
}

function stringifyFrontmatterScalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const str = String(value);
  if (!str) return '""';
  if (/^[A-Za-z0-9_./:@-]+$/.test(str)) return str;
  return JSON.stringify(str);
}

function stringifyFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyFrontmatterScalar(item)).join(", ")}]`;
  }
  return stringifyFrontmatterScalar(value);
}

function parseFrontmatterBlock(block) {
  const out = {};
  const lines = String(block || "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim();
    if (!value) {
      out[key] = "";
      continue;
    }
    out[key] = parseFrontmatterScalar(value);
  }
  return out;
}

function parseTopicDocument(raw) {
  const source = String(raw || "");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      hasFrontmatter: false,
      frontmatter: {},
      body: source,
    };
  }
  return {
    hasFrontmatter: true,
    frontmatter: parseFrontmatterBlock(match[1]),
    body: source.slice(match[0].length),
  };
}

function stringifyTopicDocument(frontmatter, body) {
  const fm = stringifyFrontmatter(frontmatter);
  const normalizedBody = String(body || "").replace(/^\n+/, "");
  if (!fm) {
    return normalizedBody.endsWith("\n") ? normalizedBody : `${normalizedBody}\n`;
  }
  const bodyText = normalizedBody.endsWith("\n")
    ? normalizedBody
    : `${normalizedBody}\n`;
  return `---\n${fm}---\n${bodyText}`;
}

function stringifyFrontmatter(frontmatter) {
  const source = isPlainObject(frontmatter) ? frontmatter : {};
  const preferredOrder = [
    "id",
    "revision",
    "summary",
    "dependsOn",
    "primary",
    "confidence",
  ];
  const keys = [];
  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(source, key)) keys.push(key);
  }
  for (const key of Object.keys(source).sort()) {
    if (!keys.includes(key)) keys.push(key);
  }
  const lines = [];
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) continue;
    lines.push(`${key}: ${stringifyFrontmatterValue(value)}`);
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function topicPathFor(topicId) {
  return path.posix.join(KNOWLEDGE_ROOT, TOPIC_DIR, `${topicId}.md`);
}

function topicAbsPath(cwd, topicPath) {
  return resolveFromCwd(cwd, topicPath);
}

function matcherPathFor(matcherId) {
  return path.posix.join(KNOWLEDGE_ROOT, "matchers", `${matcherId}.json`);
}

function graphCwd(graph) {
  if (graph.cwd) return graph.cwd;
  if (graph.routingPath) {
    return path.dirname(path.dirname(graph.routingPath));
  }
  return process.cwd();
}

function loadKnowledgeGraph(cwd) {
  const routingPath = path.join(cwd, KNOWLEDGE_ROOT, KNOWLEDGE_FILENAME);
  const matchersPath = path.join(cwd, KNOWLEDGE_ROOT, MATCHERS_FILENAME);
  if (!fs.existsSync(routingPath)) {
    throw new Error(
      `缺少知识库路由清单：${path.join(KNOWLEDGE_ROOT, KNOWLEDGE_FILENAME)}`,
    );
  }
  const routing = readJson(routingPath);
  const matchers = fs.existsSync(matchersPath) ? readJson(matchersPath) : null;
  const topicEntries = [];
  const topicPaths = routing.topicPaths || {};
  for (const [topicId, topicPath] of Object.entries(topicPaths)) {
    const absPath = topicAbsPath(cwd, topicPath);
    if (!fs.existsSync(absPath)) {
      topicEntries.push({
        topicId,
        path: topicPath,
        absPath,
        exists: false,
      });
      continue;
    }
    const raw = fs.readFileSync(absPath, "utf8");
    const parsed = parseTopicDocument(raw);
    const meta = routing.topicMetadata?.[topicId] || {};
    const frontmatter = isPlainObject(parsed.frontmatter)
      ? { ...parsed.frontmatter }
      : {};
    if (!Object.prototype.hasOwnProperty.call(frontmatter, "id")) {
      frontmatter.id = topicId;
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, "dependsOn")) {
      frontmatter.dependsOn = normalizeStringArray(frontmatter.dependsOn);
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, "primary")) {
      frontmatter.primary = String(frontmatter.primary).trim();
    } else if (meta.primary) {
      frontmatter.primary = meta.primary;
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, "confidence")) {
      frontmatter.confidence = String(frontmatter.confidence).trim();
    } else if (meta.confidence) {
      frontmatter.confidence = meta.confidence;
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, "tags")) {
      frontmatter.tags = normalizeStringArray(frontmatter.tags);
    } else if (Array.isArray(meta.tags)) {
      frontmatter.tags = normalizeStringArray(meta.tags);
    }
    if (
      Object.prototype.hasOwnProperty.call(frontmatter, "summary") &&
      typeof frontmatter.summary !== "string"
    ) {
      frontmatter.summary = String(frontmatter.summary);
    }
    topicEntries.push({
      topicId,
      path: topicPath,
      absPath,
      exists: true,
      raw,
      body: parsed.body,
      hasFrontmatter: parsed.hasFrontmatter,
      frontmatter,
      routingMeta: meta,
    });
  }
  return {
    routingPath,
    matchersPath,
    routing,
    matchers,
    topics: topicEntries,
  };
}

function deriveRoutingOverlayFromGraph(graph) {
  const topicMetadata = {};
  const topicDependencies = {};
  for (const topic of graph.topics) {
    if (!topic.exists) continue;
    const fm = topic.frontmatter || {};
    const entry = {};
    if (Object.prototype.hasOwnProperty.call(fm, "primary")) {
      const primary = String(fm.primary || "").trim();
      if (ALLOWED_TOPIC_PRIMARY.has(primary)) {
        entry.primary = primary;
      }
    }
    if (Object.prototype.hasOwnProperty.call(fm, "confidence")) {
      const confidence = String(fm.confidence || "").trim();
      if (ALLOWED_TOPIC_CONFIDENCE.has(confidence)) {
        entry.confidence = confidence;
      }
    }
    if (Array.isArray(fm.tags)) {
      const tags = normalizeStringArray(fm.tags).filter(
        (tag) => ALLOWED_TOPIC_PRIMARY.has(tag) && tag !== entry.primary,
      );
      if (tags.length > 0) {
        entry.tags = tags;
      }
    }
    if (Object.keys(entry).length > 0) {
      topicMetadata[topic.topicId] = entry;
    }
    if (Array.isArray(fm.dependsOn) && fm.dependsOn.length > 0) {
      topicDependencies[topic.topicId] = normalizeStringArray(fm.dependsOn);
    }
  }
  return { topicMetadata, topicDependencies };
}

function normalizeRoutingWithGraph(graph) {
  const overlay = deriveRoutingOverlayFromGraph(graph);
  const next = JSON.parse(JSON.stringify(graph.routing || {}));
  let changed = false;
  if (!isPlainObject(next.topicMetadata)) {
    next.topicMetadata = {};
    changed = true;
  }
  if (!isPlainObject(next.topicDependencies)) {
    next.topicDependencies = {};
    changed = true;
  }
  for (const [topicId, entry] of Object.entries(overlay.topicMetadata)) {
    const raw = JSON.stringify(next.topicMetadata[topicId] || {});
    const nextRaw = JSON.stringify(entry);
    if (raw !== nextRaw) {
      next.topicMetadata[topicId] = entry;
      changed = true;
    }
  }
  for (const topicId of Object.keys(next.topicMetadata)) {
    if (!Object.prototype.hasOwnProperty.call(overlay.topicMetadata, topicId)) {
      if (graph.routing.topicMetadata?.[topicId]) continue;
      delete next.topicMetadata[topicId];
      changed = true;
    }
  }
  for (const [topicId, deps] of Object.entries(overlay.topicDependencies)) {
    const raw = JSON.stringify(next.topicDependencies[topicId] || []);
    const nextRaw = JSON.stringify(deps);
    if (raw !== nextRaw) {
      next.topicDependencies[topicId] = deps;
      changed = true;
    }
  }
  for (const topicId of Object.keys(next.topicDependencies)) {
    if (!Object.prototype.hasOwnProperty.call(overlay.topicDependencies, topicId)) {
      if (graph.routing.topicDependencies?.[topicId]) continue;
      delete next.topicDependencies[topicId];
      changed = true;
    }
  }
  return { routing: next, changed };
}

function validateKnowledgeGraph(graph, options = {}) {
  const issues = [];
  const warnings = [];
  const strictRevision = Boolean(options.strictRevision);
  const topicIds = new Set();

  if (!graph || typeof graph !== "object") {
    return {
      ok: false,
      issues: ["knowledge graph is empty"],
      warnings,
      topicCount: 0,
    };
  }

  const routing = graph.routing || {};
  const topics = Array.isArray(graph.topics) ? graph.topics : [];
  for (const topic of topics) {
    topicIds.add(topic.topicId);
    if (!topic.exists) {
      issues.push(`topic missing: ${topic.topicId} -> ${topic.path}`);
      continue;
    }
    const fm = topic.frontmatter || {};
    if (Object.prototype.hasOwnProperty.call(fm, "id") && fm.id !== topic.topicId) {
      issues.push(
        `topic frontmatter id mismatch: ${topic.topicId} vs ${String(fm.id)}`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(fm, "revision")) {
      const revision = Number(fm.revision);
      if (!Number.isInteger(revision) || revision < 0) {
        issues.push(`topic revision must be a non-negative integer: ${topic.topicId}`);
      }
    } else if (strictRevision) {
      issues.push(`topic revision missing: ${topic.topicId}`);
    } else {
      warnings.push(`topic revision missing: ${topic.topicId}`);
    }
    if (Object.prototype.hasOwnProperty.call(fm, "primary")) {
      const primary = String(fm.primary || "").trim();
      if (!ALLOWED_TOPIC_PRIMARY.has(primary)) {
        issues.push(`topic primary invalid: ${topic.topicId} -> ${primary}`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(fm, "confidence")) {
      const confidence = String(fm.confidence || "").trim();
      if (!ALLOWED_TOPIC_CONFIDENCE.has(confidence)) {
        issues.push(`topic confidence invalid: ${topic.topicId} -> ${confidence}`);
      }
    }
    if (Array.isArray(fm.dependsOn)) {
      for (const depId of fm.dependsOn) {
        if (!topic.topicId || typeof depId !== "string" || !depId.trim()) {
          issues.push(`topic dependsOn contains empty value: ${topic.topicId}`);
          continue;
        }
        if (!routing.topicPaths?.[depId]) {
          issues.push(`topic dependsOn references missing topic: ${topic.topicId} -> ${depId}`);
        }
      }
    }
  }

  if (!routing.topicPaths || typeof routing.topicPaths !== "object") {
    issues.push("routing.topicPaths missing or invalid");
  }

  if (routing.fallbackTopic && !routing.topicPaths?.[routing.fallbackTopic]) {
    issues.push(`fallbackTopic missing from topicPaths: ${routing.fallbackTopic}`);
  }

  if (routing.topicDependencies && typeof routing.topicDependencies === "object") {
    for (const [topicId, deps] of Object.entries(routing.topicDependencies)) {
      if (!routing.topicPaths?.[topicId]) {
        issues.push(`topicDependencies references unknown topic: ${topicId}`);
      }
      if (!Array.isArray(deps)) {
        issues.push(`topicDependencies.${topicId} must be an array`);
        continue;
      }
      for (const depId of deps) {
        if (!routing.topicPaths?.[depId]) {
          issues.push(
            `topicDependencies.${topicId} references unknown dependency: ${depId}`,
          );
        }
      }
    }
  }

  if (routing.topicMetadata && typeof routing.topicMetadata === "object") {
    for (const [topicId, meta] of Object.entries(routing.topicMetadata)) {
      if (!routing.topicPaths?.[topicId]) {
        issues.push(`topicMetadata references unknown topic: ${topicId}`);
      }
      if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
        issues.push(`topicMetadata.${topicId} must be an object`);
        continue;
      }
      if (
        Object.prototype.hasOwnProperty.call(meta, "primary") &&
        !ALLOWED_TOPIC_PRIMARY.has(String(meta.primary || "").trim())
      ) {
        issues.push(`topicMetadata.${topicId}.primary invalid`);
      }
      if (
        Object.prototype.hasOwnProperty.call(meta, "confidence") &&
        !ALLOWED_TOPIC_CONFIDENCE.has(String(meta.confidence || "").trim())
      ) {
        issues.push(`topicMetadata.${topicId}.confidence invalid`);
      }
      if (Array.isArray(meta.tags)) {
        const seen = new Set();
        for (const tag of meta.tags) {
          const normalized = String(tag || "").trim();
          if (!ALLOWED_TOPIC_PRIMARY.has(normalized)) {
            issues.push(`topicMetadata.${topicId}.tags invalid value: ${normalized}`);
            continue;
          }
          if (seen.has(normalized)) {
            issues.push(`topicMetadata.${topicId}.tags contains duplicate: ${normalized}`);
          }
          seen.add(normalized);
        }
      }
    }
  }

  const matcherMap =
    graph.matchers && graph.matchers.matchers && typeof graph.matchers.matchers === "object"
      ? graph.matchers.matchers
      : null;
  if (graph.matchers && !matcherMap) {
    issues.push("manifest-matchers structure invalid");
  }

  if (Array.isArray(routing.taskToTopicRules)) {
    for (const rule of routing.taskToTopicRules) {
      if (!rule || typeof rule !== "object") {
        issues.push("taskToTopicRules contains a non-object rule");
        continue;
      }
      if (!rule.task || typeof rule.task !== "string") {
        issues.push("taskToTopicRules entry missing task");
      }
      if (!Array.isArray(rule.topics) || rule.topics.length === 0) {
        issues.push(`taskToTopicRules(${rule.task || "unknown"}) must contain topics`);
      } else {
        for (const topicId of rule.topics) {
          if (!routing.topicPaths?.[topicId]) {
            issues.push(
              `taskToTopicRules(${rule.task || "unknown"}) references unknown topic: ${topicId}`,
            );
          }
        }
      }
      if (!rule.matcherId || typeof rule.matcherId !== "string") {
        issues.push(`taskToTopicRules(${rule.task || "unknown"}) missing matcherId`);
      }
      if (!rule.matcherPath || typeof rule.matcherPath !== "string") {
        issues.push(`taskToTopicRules(${rule.task || "unknown"}) missing matcherPath`);
      } else {
        const matcherAbs = resolveFromCwd(graph.cwd || process.cwd(), rule.matcherPath);
        if (!fs.existsSync(matcherAbs)) {
          issues.push(
            `taskToTopicRules(${rule.task || "unknown"}) matcherPath missing: ${rule.matcherPath}`,
          );
        } else {
          try {
            const matcherShard = readJson(matcherAbs);
            if (matcherShard.id !== rule.matcherId) {
              issues.push(
                `matcher id mismatch: ${rule.matcherPath} -> ${matcherShard.id} vs ${rule.matcherId}`,
              );
            }
            if (!Array.isArray(matcherShard.includeAny)) {
              issues.push(`matcher includeAny invalid: ${rule.matcherPath}`);
            }
          } catch (error) {
            issues.push(`matcher JSON invalid: ${rule.matcherPath}`);
          }
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    topicCount: topicIds.size,
  };
}

function loadKnowledgeState(cwd) {
  const graph = loadKnowledgeGraph(cwd);
  graph.cwd = cwd;
  const validation = validateKnowledgeGraph(graph);
  return { graph, validation };
}

function parseKnowledgeDelta(input) {
  const delta = typeof input === "string" ? readJson(input) : input;
  if (!isPlainObject(delta)) {
    throw new Error("kb delta 必须是对象");
  }
  if (!delta.taskId || typeof delta.taskId !== "string") {
    throw new Error("kb delta 缺少 taskId");
  }
  if (!delta.developerId || typeof delta.developerId !== "string") {
    throw new Error("kb delta 缺少 developerId");
  }
  const baseRevisions = isPlainObject(delta.baseRevisions)
    ? delta.baseRevisions
    : {};
  const normalizedBaseRevisions = {};
  for (const [topicId, revision] of Object.entries(baseRevisions)) {
    const nextRevision = Number(revision);
    if (!topicId || !Number.isInteger(nextRevision) || nextRevision < 0) {
      throw new Error(`kb delta baseRevisions 非法: ${topicId}`);
    }
    normalizedBaseRevisions[topicId] = nextRevision;
  }
  if (!Array.isArray(delta.changes) || delta.changes.length === 0) {
    throw new Error("kb delta 需要至少一个 change");
  }
  const changes = delta.changes.map((change, index) =>
    normalizeKnowledgeDeltaChange(change, index),
  );
  return {
    taskId: delta.taskId.trim(),
    developerId: delta.developerId.trim(),
    baseRevisions: normalizedBaseRevisions,
    changes,
    notes: typeof delta.notes === "string" ? delta.notes : "",
  };
}

function normalizeKnowledgeDeltaChange(change, index) {
  if (!isPlainObject(change)) {
    throw new Error(`kb delta change[${index}] 必须是对象`);
  }
  const type = String(change.type || "").trim();
  if (!KB_COMMANDS.has(type)) {
    throw new Error(`kb delta change[${index}] type 非法: ${type}`);
  }
  const targetTopic = String(change.targetTopic || "").trim();
  if (!targetTopic) {
    throw new Error(`kb delta change[${index}] 缺少 targetTopic`);
  }
  const normalized = {
    type,
    targetTopic,
  };
  if (Object.prototype.hasOwnProperty.call(change, "summary")) {
    normalized.summary = String(change.summary || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(change, "content")) {
    normalized.content = String(change.content || "");
  }
  if (Object.prototype.hasOwnProperty.call(change, "frontmatter")) {
    if (!isPlainObject(change.frontmatter)) {
      throw new Error(`kb delta change[${index}].frontmatter 必须是对象`);
    }
    normalized.frontmatter = JSON.parse(JSON.stringify(change.frontmatter));
  }
  if (Object.prototype.hasOwnProperty.call(change, "taskRule")) {
    if (!isPlainObject(change.taskRule)) {
      throw new Error(`kb delta change[${index}].taskRule 必须是对象`);
    }
    normalized.taskRule = normalizeDeltaTaskRule(
      change.taskRule,
      normalized.targetTopic,
      index,
    );
  }
  if (Object.prototype.hasOwnProperty.call(change, "matcher")) {
    if (!isPlainObject(change.matcher)) {
      throw new Error(`kb delta change[${index}].matcher 必须是对象`);
    }
    const matcherId =
      normalized.taskRule?.matcherId ||
      String(change.matcher.id || `m-${normalized.targetTopic}`).trim();
    normalized.matcher = normalizeDeltaMatcher(
      change.matcher,
      matcherId,
      index,
    );
    if (normalized.taskRule && !normalized.taskRule.matcherId) {
      normalized.taskRule.matcherId = normalized.matcher.id;
      normalized.taskRule.matcherPath = matcherPathFor(normalized.matcher.id);
    }
  }
  if (normalized.taskRule && !normalized.matcher) {
    throw new Error(
      `kb delta change[${index}] 带 taskRule 时必须同时提供 matcher`,
    );
  }
  if (
    normalized.taskRule &&
    normalized.matcher &&
    normalized.taskRule.matcherId !== normalized.matcher.id
  ) {
    throw new Error(
      `kb delta change[${index}] matcher id 不一致: ${normalized.matcher.id} vs ${normalized.taskRule.matcherId}`,
    );
  }
  if (
    (normalized.type === "appendBody" || normalized.type === "replaceBody") &&
    !String(normalized.content || "").trim()
  ) {
    // 提前到 parse 阶段：kb status/plan 命中此错误时会被
    // scanTaskKnowledgeDeltas 的 try/catch 转成结构化 error 字段，
    // 而不是让 applyTopicChangeDraft 在 plan 时抛出裸异常炸掉 CLI。
    throw new Error(
      `kb delta change[${index}] ${normalized.type} 缺少 content（不能为空字符串）`,
    );
  }
  if (normalized.type === "createTopic") {
    if (!TOPIC_ID_RE.test(normalized.targetTopic)) {
      throw new Error(
        `kb delta change[${index}] targetTopic 非法: ${normalized.targetTopic}`,
      );
    }
    if (!String(normalized.content || "").trim()) {
      throw new Error(`createTopic change for ${normalized.targetTopic} 缺少 content`);
    }
    normalized.frontmatter = normalizeTopicFrontmatter(
      normalized.targetTopic,
      normalized.frontmatter || {},
      { defaultPrimary: "feature", defaultConfidence: "inferred" },
    );
  }
  return normalized;
}

function normalizeDeltaTaskRule(rule, targetTopic, index) {
  const task = String(rule.task || "").trim();
  if (!task) {
    throw new Error(`kb delta change[${index}].taskRule 缺少 task`);
  }
  const matcherIdRaw = String(rule.matcherId || `m-${task}`).trim();
  if (!MATCHER_ID_RE.test(matcherIdRaw)) {
    throw new Error(
      `kb delta change[${index}].taskRule.matcherId 非法: ${matcherIdRaw}`,
    );
  }
  const topics = normalizeStringArray(rule.topics || [targetTopic]);
  if (!topics.includes(targetTopic)) topics.push(targetTopic);
  return {
    task,
    matcherId: matcherIdRaw,
    matcherPath:
      typeof rule.matcherPath === "string" && rule.matcherPath.trim()
        ? rule.matcherPath.trim().replace(/\\/g, "/")
        : matcherPathFor(matcherIdRaw),
    topics,
  };
}

function normalizeDeltaMatcher(matcher, matcherId, index) {
  const id = String(matcher.id || matcherId || "").trim();
  if (!MATCHER_ID_RE.test(id)) {
    throw new Error(`kb delta change[${index}].matcher.id 非法: ${id}`);
  }
  const out = {
    id,
    version:
      typeof matcher.version === "string" && matcher.version.trim()
        ? matcher.version.trim()
        : "1.0.0",
    schema:
      typeof matcher.schema === "string" && matcher.schema.trim()
        ? matcher.schema.trim()
        : "flow2spec.matcher.v1",
    includeAny: normalizeStringArray(matcher.includeAny),
  };
  for (const key of ["includeAll", "excludeAny", "excludeAll"]) {
    const values = normalizeStringArray(matcher[key]);
    if (values.length > 0) out[key] = values;
  }
  if (out.includeAny.length === 0 && !out.includeAll?.length) {
    throw new Error(`kb delta change[${index}].matcher 缺少 includeAny/includeAll`);
  }
  return out;
}

function normalizeTopicFrontmatter(topicId, frontmatter, options = {}) {
  const source = isPlainObject(frontmatter) ? frontmatter : {};
  const out = JSON.parse(JSON.stringify(source));
  out.id = topicId;
  const revision = Number(out.revision || 0);
  out.revision = Number.isInteger(revision) && revision >= 0 ? revision : 0;
  if (!out.primary) out.primary = options.defaultPrimary || "feature";
  if (!out.confidence) out.confidence = options.defaultConfidence || "inferred";
  if (Object.prototype.hasOwnProperty.call(out, "dependsOn")) {
    out.dependsOn = normalizeStringArray(out.dependsOn);
  }
  if (Object.prototype.hasOwnProperty.call(out, "tags")) {
    out.tags = normalizeStringArray(out.tags);
  }
  return out;
}

function inferSummaryFromBody(body) {
  const heading = String(body || "")
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("#"));
  return heading ? heading.replace(/^#+\s*/, "").trim() : "";
}

function frontmatterForRouting(topic, routing) {
  const meta = routing.topicMetadata?.[topic.topicId] || {};
  const deps = routing.topicDependencies?.[topic.topicId] || [];
  const current = isPlainObject(topic.frontmatter) ? topic.frontmatter : {};
  const out = JSON.parse(JSON.stringify(current));
  let changed = false;
  const setIfMissingOrInvalid = (key, value, isValid = (item) => item !== undefined) => {
    if (!isValid(value)) return;
    if (!Object.prototype.hasOwnProperty.call(out, key) || out[key] === "") {
      out[key] = value;
      changed = true;
    }
  };

  if (out.id !== topic.topicId) {
    out.id = topic.topicId;
    changed = true;
  }
  const revision = Number(out.revision);
  if (!Number.isInteger(revision) || revision < 0) {
    out.revision = 0;
    changed = true;
  }
  setIfMissingOrInvalid("summary", inferSummaryFromBody(topic.body), (item) => Boolean(item));
  if (Array.isArray(deps) && deps.length > 0) {
    const normalizedDeps = normalizeStringArray(deps);
    if (JSON.stringify(out.dependsOn || []) !== JSON.stringify(normalizedDeps)) {
      out.dependsOn = normalizedDeps;
      changed = true;
    }
  }
  if (meta.primary && ALLOWED_TOPIC_PRIMARY.has(meta.primary)) {
    setIfMissingOrInvalid("primary", meta.primary);
  }
  if (meta.confidence && ALLOWED_TOPIC_CONFIDENCE.has(meta.confidence)) {
    setIfMissingOrInvalid("confidence", meta.confidence);
  }
  if (Array.isArray(meta.tags) && meta.tags.length > 0) {
    const tags = normalizeStringArray(meta.tags).filter((tag) =>
      ALLOWED_TOPIC_PRIMARY.has(tag),
    );
    if (tags.length > 0 && JSON.stringify(out.tags || []) !== JSON.stringify(tags)) {
      out.tags = tags;
      changed = true;
    }
  }
  return { frontmatter: out, changed };
}

function ensureTopicFrontmatterFromRouting(graph, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const changedFiles = [];
  for (const topic of graph.topics) {
    if (!topic.exists) continue;
    const next = frontmatterForRouting(topic, graph.routing);
    if (!next.changed && topic.hasFrontmatter) continue;
    const content = stringifyTopicDocument(next.frontmatter, topic.body);
    topic.frontmatter = next.frontmatter;
    topic.hasFrontmatter = true;
    topic.raw = content;
    if (!dryRun) {
      fs.writeFileSync(topic.absPath, content, "utf8");
    }
    changedFiles.push(topic.path);
  }
  return { changedFiles };
}

function planKnowledgeDelta(graph, delta) {
  const parsedDelta = typeof delta === "string" ? parseKnowledgeDelta(delta) : parseKnowledgeDelta(delta);
  const working = new Map();
  const originalRevisions = new Map();
  const pendingTaskRules = new Set();
  const pendingMatcherIds = new Set();
  const pendingMatcherPaths = new Set();
  for (const topic of graph.topics) {
    if (!topic.exists) continue;
    working.set(topic.topicId, JSON.parse(JSON.stringify(topic)));
    originalRevisions.set(topic.topicId, Number(topic.frontmatter?.revision || 0));
  }
  const plan = [];
  const conflicts = [];

  for (const change of parsedDelta.changes) {
    if (change.type === "createTopic") {
      const createPlan = planCreateTopicChange(graph, working, change, {
        pendingTaskRules,
        pendingMatcherIds,
        pendingMatcherPaths,
      });
      if (createPlan.conflict) {
        conflicts.push(createPlan.conflict);
        continue;
      }
      working.set(change.targetTopic, createPlan.topic);
      originalRevisions.set(change.targetTopic, 0);
      if (change.taskRule) {
        pendingTaskRules.add(change.taskRule.task);
      }
      if (change.matcher) {
        pendingMatcherIds.add(change.matcher.id);
        pendingMatcherPaths.add(change.taskRule?.matcherPath || matcherPathFor(change.matcher.id));
      }
      plan.push(createPlan.plan);
      continue;
    }
    const current = working.get(change.targetTopic);
    if (!current) {
      conflicts.push({
        topicId: change.targetTopic,
        reason: "topic missing",
        change,
      });
      continue;
    }
    const currentRevision = Number(current.frontmatter?.revision || 0);
    const originalRevision = originalRevisions.get(change.targetTopic) || 0;
    const expected = parsedDelta.baseRevisions[change.targetTopic];
    if (
      Number.isInteger(expected) &&
      expected >= 0 &&
      expected !== originalRevision
    ) {
      conflicts.push({
        topicId: change.targetTopic,
        reason: `revision mismatch ${expected} -> ${originalRevision}`,
        change,
      });
      continue;
    }
    const next = applyTopicChangeDraft(current, change);
    working.set(change.targetTopic, next);
    plan.push({
      topicId: change.targetTopic,
      type: change.type,
      beforeRevision: currentRevision,
      afterRevision: next.frontmatter.revision,
      summary: change.summary || "",
    });
  }

  return {
    delta: parsedDelta,
    plan,
    conflicts,
    mergeable: conflicts.length === 0,
  };
}

function planCreateTopicChange(graph, working, change, pending = {}) {
  const topicId = change.targetTopic;
  const cwd = graphCwd(graph);
  const topic = createTopicDraft(cwd, change);
  const topicPath = topic.path;
  const absPath = topic.absPath;
  if (working.has(topicId) || graph.routing.topicPaths?.[topicId] || fs.existsSync(absPath)) {
    return {
      conflict: {
        topicId,
        reason: "topic already exists",
        change,
      },
    };
  }
  const deps = normalizeStringArray(change.frontmatter?.dependsOn);
  for (const depId of deps) {
    if (!working.has(depId) && !graph.routing.topicPaths?.[depId]) {
      return {
        conflict: {
          topicId,
          reason: `dependency missing: ${depId}`,
          change,
        },
      };
    }
  }
  if (change.taskRule) {
    const rules = Array.isArray(graph.routing.taskToTopicRules)
      ? graph.routing.taskToTopicRules
      : [];
    const duplicateRule = rules.find(
      (rule) =>
        rule.task === change.taskRule.task ||
        rule.matcherId === change.taskRule.matcherId ||
        rule.matcherPath === change.taskRule.matcherPath,
    );
    if (duplicateRule) {
      return {
        conflict: {
          topicId,
          reason: `task rule already exists: ${duplicateRule.task}`,
          change,
        },
      };
    }
    if (pending.pendingTaskRules?.has(change.taskRule.task)) {
      return {
        conflict: {
          topicId,
          reason: `task rule duplicated in delta: ${change.taskRule.task}`,
          change,
        },
      };
    }
  }
  if (change.matcher) {
    const matcherId = change.matcher.id;
    const matcherPath = change.taskRule?.matcherPath || matcherPathFor(matcherId);
    const matcherAbs = resolveFromCwd(cwd, matcherPath);
    const matcherMap = graph.matchers?.matchers || {};
    if (matcherMap[matcherId] || fs.existsSync(matcherAbs)) {
      return {
        conflict: {
          topicId,
          reason: `matcher already exists: ${matcherId}`,
          change,
        },
      };
    }
    if (
      pending.pendingMatcherIds?.has(matcherId) ||
      pending.pendingMatcherPaths?.has(matcherPath)
    ) {
      return {
        conflict: {
          topicId,
          reason: `matcher duplicated in delta: ${matcherId}`,
          change,
        },
      };
    }
    if (change.taskRule && matcherId !== change.taskRule.matcherId) {
      return {
        conflict: {
          topicId,
          reason: `matcher id mismatch: ${matcherId} vs ${change.taskRule.matcherId}`,
          change,
        },
      };
    }
  }
  return {
    topic,
    plan: {
      topicId,
      type: change.type,
      beforeRevision: null,
      afterRevision: topic.frontmatter.revision,
      summary: change.summary || "",
      creates: {
        topicPath,
        matcherPath: change.matcher
          ? change.taskRule?.matcherPath || matcherPathFor(change.matcher.id)
          : null,
        taskRule: change.taskRule?.task || null,
      },
    },
  };
}

function createTopicDraft(cwd, change) {
  const topicId = change.targetTopic;
  const topicPath = topicPathFor(topicId);
  const absPath = topicAbsPath(cwd, topicPath);
  const body = String(change.content || "");
  const bodyText = body.endsWith("\n") ? body : `${body}\n`;
  const frontmatter = normalizeTopicFrontmatter(topicId, change.frontmatter || {});
  return {
    topicId,
    path: topicPath,
    absPath,
    exists: true,
    raw: stringifyTopicDocument(frontmatter, bodyText),
    body: bodyText,
    hasFrontmatter: true,
    frontmatter,
    routingMeta: {},
  };
}

function applyTopicChangeDraft(topic, change) {
  const next = JSON.parse(JSON.stringify(topic));
  const frontmatter = isPlainObject(next.frontmatter) ? next.frontmatter : {};
  const currentRevision = Number(frontmatter.revision || 0);
  let body = String(next.body || "");

  frontmatter.id = topic.topicId;
  if (change.type === "appendBody") {
    const fragment = String(change.content || "").trim();
    if (!fragment) {
      throw new Error(`appendBody change for ${topic.topicId} 缺少 content`);
    }
    body = body.trimEnd();
    body = body ? `${body}\n\n${fragment}\n` : `${fragment}\n`;
  } else if (change.type === "replaceBody") {
    body = String(change.content || "");
    if (!body.trim()) {
      throw new Error(`replaceBody change for ${topic.topicId} 缺少 content`);
    }
    if (!body.endsWith("\n")) body += "\n";
  } else if (change.type === "updateFrontmatter") {
    const incoming = isPlainObject(change.frontmatter) ? change.frontmatter : {};
    for (const [key, value] of Object.entries(incoming)) {
      if (value === undefined) continue;
      if (key === "dependsOn") {
        frontmatter.dependsOn = normalizeStringArray(value);
      } else if (key === "revision") {
        const revision = Number(value);
        if (!Number.isInteger(revision) || revision < 0) {
          throw new Error(`topic ${topic.topicId} revision 非法`);
        }
        frontmatter.revision = revision;
      } else if (key === "tags") {
        frontmatter.tags = normalizeStringArray(value);
      } else {
        frontmatter[key] = value;
      }
    }
  }

  frontmatter.revision = currentRevision + 1;
  next.frontmatter = frontmatter;
  next.body = body;
  next.hasFrontmatter = true;
  return next;
}

function applyKnowledgeDelta(cwd, deltaInput, options = {}) {
  const graph = loadKnowledgeGraph(cwd);
  graph.cwd = cwd;
  const parsedDelta = parseKnowledgeDelta(deltaInput);
  const dryRun = Boolean(options.dryRun);
  const planResult = planKnowledgeDelta(graph, parsedDelta);
  if (!planResult.mergeable) {
    const error = new Error("kb delta 存在冲突，无法自动合并");
    error.planResult = planResult;
    throw error;
  }

  const changedFiles = [];
  const changedTopicIds = [];
  const createdTopicIds = [];
  const matcherWrites = [];
  const taskRuleWrites = [];
  const drafts = new Map();
  for (const topic of graph.topics) {
    if (!topic.exists) continue;
    drafts.set(topic.topicId, JSON.parse(JSON.stringify(topic)));
  }
  for (const change of parsedDelta.changes) {
    if (change.type === "createTopic") {
      const nextTopic = createTopicDraft(cwd, change);
      drafts.set(change.targetTopic, nextTopic);
      if (!changedTopicIds.includes(change.targetTopic)) {
        changedTopicIds.push(change.targetTopic);
      }
      if (!createdTopicIds.includes(change.targetTopic)) {
        createdTopicIds.push(change.targetTopic);
      }
      if (change.matcher) {
        matcherWrites.push({
          matcher: change.matcher,
          matcherPath: change.taskRule?.matcherPath || matcherPathFor(change.matcher.id),
        });
      }
      if (change.taskRule) {
        taskRuleWrites.push(change.taskRule);
      }
      continue;
    }
    if (!drafts.has(change.targetTopic)) {
      throw new Error(`未知 topic: ${change.targetTopic}`);
    }
    const topic = drafts.get(change.targetTopic);
    const nextTopic = applyTopicChangeDraft(topic, change);
    drafts.set(change.targetTopic, nextTopic);
    if (!changedTopicIds.includes(change.targetTopic)) {
      changedTopicIds.push(change.targetTopic);
    }
  }

  for (const topicId of changedTopicIds) {
    const topicIndex = graph.topics.findIndex((item) => item.topicId === topicId);
    const nextTopic = drafts.get(topicId);
    const nextContent = stringifyTopicDocument(nextTopic.frontmatter, nextTopic.body);
    if (!dryRun) {
      ensureDir(path.dirname(nextTopic.absPath));
      fs.writeFileSync(nextTopic.absPath, nextContent, "utf8");
    }
    if (!changedFiles.includes(nextTopic.path)) {
      changedFiles.push(nextTopic.path);
    }
    if (topicIndex >= 0) {
      const topic = graph.topics[topicIndex];
      graph.topics[topicIndex] = {
        ...topic,
        ...nextTopic,
        raw: nextContent,
      };
    } else {
      graph.topics.push({
        ...nextTopic,
        raw: nextContent,
      });
    }
  }

  if (!isPlainObject(graph.routing.topicPaths)) {
    graph.routing.topicPaths = {};
  }
  for (const topicId of createdTopicIds) {
    const topic = drafts.get(topicId);
    graph.routing.topicPaths[topicId] = topic.path;
  }

  if (!Array.isArray(graph.routing.taskToTopicRules)) {
    graph.routing.taskToTopicRules = [];
  }
  for (const rule of taskRuleWrites) {
    graph.routing.taskToTopicRules.push(rule);
  }

  for (const item of matcherWrites) {
    const matcherAbs = resolveFromCwd(cwd, item.matcherPath);
    if (!dryRun) {
      ensureDir(path.dirname(matcherAbs));
      writeJson(matcherAbs, item.matcher);
    }
    if (!changedFiles.includes(item.matcherPath)) {
      changedFiles.push(item.matcherPath);
    }
  }

  if (graph.matchersPath && fs.existsSync(graph.matchersPath) && matcherWrites.length > 0) {
    const manifestMatchers = graph.matchers || {
      version: "1.0.0",
      generatedFrom: ".Knowledge/manifest-routing.json",
      matcherKey: "matcherId",
      sourceOfTruth: ".Knowledge/manifest-routing.json",
      matchers: {},
    };
    if (!isPlainObject(manifestMatchers.matchers)) {
      manifestMatchers.matchers = {};
    }
    for (const item of matcherWrites) {
      const { id, ...matcherBody } = item.matcher;
      manifestMatchers.matchers[id] = matcherBody;
    }
    graph.matchers = manifestMatchers;
    if (!dryRun) {
      writeJson(graph.matchersPath, manifestMatchers);
    }
    const manifestMatchersPath = path.posix.join(KNOWLEDGE_ROOT, MATCHERS_FILENAME);
    if (!changedFiles.includes(manifestMatchersPath)) {
      changedFiles.push(manifestMatchersPath);
    }
  }

  const normalizedRouting = normalizeRoutingWithGraph(graph);
  if (normalizedRouting.changed && !dryRun) {
    writeJson(graph.routingPath, normalizedRouting.routing);
    changedFiles.push(path.posix.join(KNOWLEDGE_ROOT, KNOWLEDGE_FILENAME));
  }

  return {
    dryRun,
    changedFiles,
    plan: planResult.plan,
    conflicts: planResult.conflicts,
    delta: parsedDelta,
  };
}

function scanTaskKnowledgeDeltas(cwd, taskRoot) {
  const resolvedRoot = taskRoot || resolveDeveloperContext(loadFlow2specConfig(cwd), { cwd }).taskRoot;
  const activeRoot = path.join(cwd, resolvedRoot, "active");
  if (!fs.existsSync(activeRoot)) {
    return [];
  }
  const tasks = [];
  for (const name of fs.readdirSync(activeRoot)) {
    const taskDir = path.join(activeRoot, name);
    if (!fs.statSync(taskDir).isDirectory()) continue;
    const deltaPath = path.join(taskDir, DELTA_FILENAME);
    if (!fs.existsSync(deltaPath)) continue;
    try {
      const delta = parseKnowledgeDelta(deltaPath);
      tasks.push({
        taskName: name,
        taskDir,
        deltaPath,
        delta,
      });
    } catch (error) {
      tasks.push({
        taskName: name,
        taskDir,
        deltaPath,
        error: error.message || String(error),
      });
    }
  }
  return tasks;
}

function summarizeKnowledgeState(cwd, options = {}) {
  const { graph, validation } = loadKnowledgeState(cwd);
  const taskRoot = options.taskRoot ||
    resolveDeveloperContext(loadFlow2specConfig(cwd), { cwd }).taskRoot;
  const deltaFiles = scanTaskKnowledgeDeltas(cwd, taskRoot);
  const normalizedRouting = normalizeRoutingWithGraph(graph);
  const drift =
    stableStringify(normalizedRouting.routing) !== stableStringify(graph.routing);
  const tasks = deltaFiles.map((item) => {
    if (item.error) {
      return {
        taskName: item.taskName,
        deltaPath: item.deltaPath,
        error: item.error,
      };
    }
    const plan = planKnowledgeDelta(graph, item.delta);
    return {
      taskName: item.taskName,
      deltaPath: item.deltaPath,
      mergeable: plan.mergeable,
      plan: plan.plan,
      conflicts: plan.conflicts,
    };
  });
  return {
    cwd,
    taskRoot,
    topicCount: graph.topics.length,
    validation,
    routingDrift: drift,
    tasks,
  };
}

function buildKnowledgeGraph(cwd, options = {}) {
  const graph = loadKnowledgeGraph(cwd);
  graph.cwd = cwd;
  const topicFrontmatter = options.writeTopicFrontmatter
    ? ensureTopicFrontmatterFromRouting(graph, {
        dryRun: options.dryRun,
      })
    : { changedFiles: [] };
  const normalizedRouting = normalizeRoutingWithGraph(graph);
  const changed =
    stableStringify(normalizedRouting.routing) !== stableStringify(graph.routing);
  if (changed && !options.dryRun) {
    writeJson(graph.routingPath, normalizedRouting.routing);
  }
  return {
    changed: changed || topicFrontmatter.changedFiles.length > 0,
    routingPath: graph.routingPath,
    topicFrontmatterChanged: topicFrontmatter.changedFiles,
    normalizedRouting: normalizedRouting.routing,
    validation: validateKnowledgeGraph({
      ...graph,
      routing: normalizedRouting.routing,
    }),
  };
}

module.exports = {
  KNOWLEDGE_ROOT,
  KNOWLEDGE_FILENAME,
  MATCHERS_FILENAME,
  INDEX_FILENAME,
  TOPIC_DIR,
  DELTA_FILENAME,
  loadKnowledgeGraph,
  loadKnowledgeState,
  validateKnowledgeGraph,
  parseTopicDocument,
  stringifyTopicDocument,
  parseKnowledgeDelta,
  planKnowledgeDelta,
  applyKnowledgeDelta,
  scanTaskKnowledgeDeltas,
  summarizeKnowledgeState,
  buildKnowledgeGraph,
  ensureTopicFrontmatterFromRouting,
  normalizeRoutingWithGraph,
  stableStringify,
  topicPathFor,
};
