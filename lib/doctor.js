const fs = require("fs");
const path = require("path");

const { AGENTS } = require("./agents");
const {
  loadFlow2specConfig,
  CONFIG_FILENAME,
} = require("./flow2specConfig");
const { resolveDeveloperContext } = require("./developerId");
const knowledgeEngine = require("./knowledgeEngine");

const STATUS = {
  pass: "pass",
  warning: "warning",
  error: "error",
};

function numericVersion(version) {
  return String(version || "")
    .replace(/^v/, "")
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const a = numericVersion(left);
  const b = numericVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function satisfiesNodeEngine(version, engine) {
  const minimum = String(engine || "").match(/>=\s*v?(\d+(?:\.\d+){0,2})/);
  if (!minimum) return true;
  return compareVersions(version, minimum[1]) >= 0;
}

function makeCheck(id, label, status, message, repair = null, details) {
  const check = { id, label, status, message, repair };
  if (details !== undefined) check.details = details;
  return check;
}

function checkKnowledge(cwd) {
  try {
    const graph = knowledgeEngine.loadKnowledgeGraph(cwd);
    const validation = knowledgeEngine.validateKnowledgeGraph(graph, {
      strictRevision: true,
    });
    const normalized = knowledgeEngine.normalizeRoutingWithGraph(graph);
    const routingDrift =
      normalized.changed ||
      knowledgeEngine.stableStringify(normalized.routing) !==
        knowledgeEngine.stableStringify(graph.routing);
    const details = {
      topicCount: validation.topicCount,
      issues: validation.issues,
      warnings: validation.warnings,
      routingDrift,
    };

    if (!validation.ok || routingDrift) {
      const reasons = [...validation.issues];
      if (routingDrift) reasons.push("routing metadata differs from topic frontmatter");
      return makeCheck(
        "knowledge",
        "知识库",
        STATUS.error,
        `知识图存在 ${reasons.length} 个问题。`,
        "运行 flow2spec kb build --fix-topics，再运行 flow2spec kb check --strict。",
        details,
      );
    }
    if (validation.warnings.length > 0) {
      return makeCheck(
        "knowledge",
        "知识库",
        STATUS.warning,
        `知识图可用，但有 ${validation.warnings.length} 条警告。`,
        "运行 flow2spec kb check --strict 查看详情。",
        details,
      );
    }
    return makeCheck(
      "knowledge",
      "知识库",
      STATUS.pass,
      `${validation.topicCount} 个 topic 校验通过，routing 无漂移。`,
      null,
      details,
    );
  } catch (error) {
    return makeCheck(
      "knowledge",
      "知识库",
      STATUS.error,
      error.message || String(error),
      "确认 .Knowledge/manifest-routing.json 与其引用的 topic、matcher 均存在且为有效格式。",
    );
  }
}

function isIgnoredByRootGitignore(cwd, entry) {
  const gitignore = path.join(cwd, ".gitignore");
  if (!fs.existsSync(gitignore)) return false;
  const lines = fs
    .readFileSync(gitignore, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return lines.includes(entry) || lines.includes(entry.replace(/\/$/, ""));
}

function runDoctor(cwd = process.cwd(), options = {}) {
  const pkg = options.package || require("../package.json");
  const nodeVersion = options.nodeVersion || process.version;
  const knowledgeCheck = options.knowledgeCheck || checkKnowledge;
  const checks = [];

  const engine = pkg.engines?.node || "";
  const runtimeOk = satisfiesNodeEngine(nodeVersion, engine);
  checks.push(
    makeCheck(
      "runtime",
      "Node.js",
      runtimeOk ? STATUS.pass : STATUS.error,
      runtimeOk
        ? `${nodeVersion} 满足 ${engine || "包要求"}。`
        : `${nodeVersion} 不满足 ${engine}。`,
      runtimeOk ? null : `升级 Node.js 到满足 ${engine} 的版本。`,
      { version: nodeVersion, required: engine },
    ),
  );

  const configPath = path.join(cwd, CONFIG_FILENAME);
  let config = null;
  if (!fs.existsSync(configPath)) {
    checks.push(
      makeCheck(
        "config",
        "项目配置",
        STATUS.error,
        `缺少 ${CONFIG_FILENAME}。`,
        "在项目根运行 flow2spec init。",
      ),
    );
  } else {
    try {
      config = loadFlow2specConfig(cwd);
      checks.push(
        makeCheck(
          "config",
          "项目配置",
          STATUS.pass,
          `${CONFIG_FILENAME} 存在且可解析。`,
          null,
          { locale: config.locale },
        ),
      );
    } catch (error) {
      checks.push(
        makeCheck(
          "config",
          "项目配置",
          STATUS.error,
          error.message || String(error),
          `修正 ${CONFIG_FILENAME} 的 JSON 格式。`,
        ),
      );
    }
  }

  const agentsPath = path.join(cwd, "AGENTS.md");
  checks.push(
    fs.existsSync(agentsPath)
      ? makeCheck("agents-entry", "项目入口", STATUS.pass, "根 AGENTS.md 已就绪。")
      : makeCheck(
          "agents-entry",
          "项目入口",
          STATUS.error,
          "缺少根 AGENTS.md。",
          "运行 flow2spec init codex，或重新初始化所需 Agent。",
        ),
  );

  const manifestPath = path.join(cwd, ".Knowledge", "manifest-routing.json");
  checks.push(
    fs.existsSync(manifestPath)
      ? makeCheck(
          "knowledge-entry",
          "知识库入口",
          STATUS.pass,
          ".Knowledge/manifest-routing.json 已就绪。",
        )
      : makeCheck(
          "knowledge-entry",
          "知识库入口",
          STATUS.error,
          "缺少 .Knowledge/manifest-routing.json。",
          "在项目根运行 flow2spec init。",
        ),
  );

  const requiredAgentFiles = {
    codex: ["AGENTS.md", "hooks.json"],
    claude: ["settings.json"],
    cursor: ["hooks.json"],
  };
  const initializedAgents = Object.entries(AGENTS).filter(([, agent]) =>
    fs.existsSync(path.join(cwd, agent.root)),
  );
  if (initializedAgents.length === 0) {
    checks.push(
      makeCheck(
        "agent-roots",
        "Agent 配置",
        STATUS.warning,
        "未检测到 .codex、.claude 或 .cursor 配置根。",
        "运行 flow2spec init <agent> 初始化实际使用的 Agent。",
      ),
    );
  } else {
    for (const [id, agent] of initializedAgents) {
      const missing = (requiredAgentFiles[id] || []).filter(
        (file) => !fs.existsSync(path.join(cwd, agent.root, file)),
      );
      checks.push(
        missing.length === 0
          ? makeCheck(
              `agent-${id}`,
              `${agent.label} 配置`,
              STATUS.pass,
              `${agent.root} 初始化文件完整。`,
            )
          : makeCheck(
              `agent-${id}`,
              `${agent.label} 配置`,
              STATUS.error,
              `${agent.root} 缺少 ${missing.join("、")}。`,
              `运行 flow2spec init ${id} 补齐配置。`,
              { missing },
            ),
      );
    }
  }

  if (config) {
    try {
      const context = resolveDeveloperContext(config, {
        cwd,
        gitIdentity: options.gitIdentity,
        skipGit: Boolean(options.gitIdentity),
      });
      const warnings = [...context.warnings];
      if (context.legacy && context.enabled) {
        warnings.push("未找到 developerId，将使用 legacy .task/ 根。");
      }
      checks.push(
        makeCheck(
          "collaboration",
          "协作上下文",
          warnings.length > 0 ? STATUS.warning : STATUS.pass,
          context.legacy
            ? `使用 ${context.taskRoot}（${context.enabled ? "legacy" : "协作隔离已关闭"}）。`
            : `developerId=${context.developerId}，TASK_ROOT=${context.taskRoot}。`,
          warnings.length > 0
            ? "在 flow2spec.config.json 配置 collaboration.developerId。"
            : null,
          { ...context, warnings },
        ),
      );
    } catch (error) {
      checks.push(
        makeCheck(
          "collaboration",
          "协作上下文",
          STATUS.error,
          error.message || String(error),
          "修正 flow2spec.config.json 的 collaboration 配置。",
        ),
      );
    }
  }

  const taskIgnored = isIgnoredByRootGitignore(cwd, ".task/");
  checks.push(
    taskIgnored
      ? makeCheck("task-ignore", "任务目录", STATUS.pass, ".task/ 已在根 .gitignore 中忽略。")
      : makeCheck(
          "task-ignore",
          "任务目录",
          STATUS.warning,
          ".task/ 未在根 .gitignore 中忽略。",
          "在根 .gitignore 中加入 .task/，或重新运行 flow2spec init。",
        ),
  );

  checks.push(knowledgeCheck(cwd));

  const summary = checks.reduce(
    (result, check) => {
      if (check.status === STATUS.pass) result.passed += 1;
      if (check.status === STATUS.warning) result.warnings += 1;
      if (check.status === STATUS.error) result.errors += 1;
      return result;
    },
    { passed: 0, warnings: 0, errors: 0 },
  );

  return {
    ok: summary.errors === 0,
    package: { name: pkg.name, version: pkg.version },
    cwd: path.resolve(cwd),
    summary,
    checks,
  };
}

function formatDoctorReport(report) {
  const marker = { pass: "[PASS]", warning: "[WARN]", error: "[FAIL]" };
  const lines = [
    `Flow2Spec Doctor v${report.package.version}`,
    `项目: ${report.cwd}`,
    "",
  ];
  for (const check of report.checks) {
    lines.push(`${marker[check.status]} ${check.label}: ${check.message}`);
    if (check.repair) lines.push(`       建议: ${check.repair}`);
  }
  lines.push(
    "",
    `结果: ${report.summary.passed} 通过，${report.summary.warnings} 警告，${report.summary.errors} 错误。`,
  );
  return lines.join("\n");
}

module.exports = {
  STATUS,
  runDoctor,
  formatDoctorReport,
  satisfiesNodeEngine,
  checkKnowledge,
};
