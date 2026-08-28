#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const os = require("os");
const readline = require("readline");
const {
  createFlow2Spec,
  getCapabilities,
  getVersions,
} = require("@double-coding/flow2spec-core");

const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const sub = args[0];

const CONFIG_FILENAME = "flow2spec.config.json";
const CORE_PACKAGE = "@double-coding/flow2spec-core";
const flow2specForMetadata = createFlow2Spec({ cwd: process.cwd() });
const AGENTS = flow2specForMetadata.project.agents();
const SUPPORTED_LOCALES = flow2specForMetadata.config.supportedLocales();

function createApi(cwd = process.cwd()) {
  return createFlow2Spec({ cwd });
}

const agentList = Object.entries(AGENTS)
  .map(([id, { label }]) => `${id}(${label})`)
  .join(", ");

const pkg = require("./package.json");
const coreVersions = getVersions();
const coreRange = pkg.dependencies?.[CORE_PACKAGE] || "<missing>";

const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

function parseVersion(version) {
  return String(version || "")
    .replace(/^v/, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function runCommandSync(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    windowsHide: true,
    shell: process.platform === "win32",
    ...options,
  });
}

function queryLatestCoreMetadata() {
  const output = runCommandSync(
    "npm",
    ["view", CORE_PACKAGE, "version", "templateVersion", "--json", "--registry=https://registry.npmjs.org"],
    { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
  );
  const metadata = JSON.parse(output);
  return {
    version: typeof metadata === "string" ? metadata : metadata.version,
    templateVersion: typeof metadata === "string"
      ? metadata
      : metadata.templateVersion || metadata.version,
  };
}

function updateCheckCacheFile() {
  const safeName = String(pkg.name || "flow2spec").replace(/[^a-z0-9_.-]+/gi, "_");
  return path.join(os.homedir(), ".flow2spec", `${safeName}-update-check.json`);
}

function readUpdateCheckCache() {
  const file = updateCheckCacheFile();
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data !== "object") return null;
    if (Date.now() - Number(data.checkedAt || 0) > UPDATE_CHECK_TTL_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeUpdateCheckCache(latest) {
  try {
    const file = updateCheckCacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `${JSON.stringify({ latest, checkedAt: Date.now() }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // 更新检查不能影响主命令。
  }
}

function queryLatestPackageVersion() {
  const cached = readUpdateCheckCache();
  if (cached?.latest) return cached.latest;
  const latest = runCommandSync("npm", ["view", pkg.name, "version"], {
    encoding: "utf8",
    timeout: 2000,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (latest) writeUpdateCheckCache(latest);
  return latest;
}

function shouldCheckForUpdates() {
  if (process.env.FLOW2SPEC_SKIP_UPDATE_CHECK === "1") return false;
  if (process.env.CI) return false;
  if (!process.stdout.isTTY) return false;
  return Boolean(pkg.name && pkg.version);
}

/**
 * 读取全局安装的同名包版本（如果有）。
 *
 * 用 `npm root -g` 拿全局 node_modules 根目录，再读 `<root>/<pkg.name>/package.json` 的 version。
 * 这是跨 Node / npm 版本最稳定的判断"用户是否全局装过"的方式（避免 `npm ls -g` 输出格式差异）。
 *
 * @returns {string|null} 全局已装版本号；未装、读取失败一律返回 null
 */
function getGlobalInstalledVersion() {
  if (!pkg.name) return null;
  let globalRoot;
  try {
    globalRoot = runCommandSync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
  if (!globalRoot) return null;
  const pkgJsonPath = path.join(globalRoot, pkg.name, "package.json");
  try {
    if (!fs.existsSync(pkgJsonPath)) return null;
    const data = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * 读取全局 CLI 实际加载到的 Core 版本（按 Node 模块解析优先级：嵌套副本优先）。
 *
 * npm 全局安装时 CLI 的 core 依赖位于 CLI 包自己的 node_modules（嵌套）；
 * 单独 `npm i -g core@x` 只会装出顶级孤儿副本，不影响 CLI 加载。
 * 因此验证时先查嵌套路径，再回退顶级路径。
 *
 * @returns {string|null} 全局 CLI 实际解析到的 core 版本；无法确定时返回 null
 */
function getGlobalEffectiveCoreVersion() {
  if (!pkg.name) return null;
  let globalRoot;
  try {
    globalRoot = runCommandSync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
  if (!globalRoot) return null;
  const candidates = [
    path.join(globalRoot, pkg.name, "node_modules", CORE_PACKAGE, "package.json"),
    path.join(globalRoot, CORE_PACKAGE, "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const data = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (typeof data.version === "string") return data.version;
    } catch {
      // 继续尝试下一个候选路径。
    }
  }
  return null;
}

/**
 * init 收尾时自动把全局 flow2spec 升到 latest。
 *
 * 触发条件（同时满足）：
 *   1. 用户已经全局 `npm i -g` 装过本包（用 getGlobalInstalledVersion 检测）；
 *   2. npm registry 上 latest 严格高于全局已装版本。
 *
 * 用户没全局装过 → 静默跳过；当前 cli 是 npx 临时缓存跑的，不要侵入用户全局环境。
 * `npm i -g` 失败（权限 / 私服 404 / 网络） → 打印错误 + 手动升级提示，但 init 整体仍 exit 0。
 *
 * 该函数本身永不抛错，永远不影响 init 主流程。
 */
function maybeAutoUpdateGlobalInstall() {
  let installed;
  try {
    installed = getGlobalInstalledVersion();
  } catch {
    return;
  }
  if (!installed) return; // 没全局装过 → 不打扰
  let latest;
  try {
    latest = queryLatestPackageVersion();
  } catch {
    return; // 查 latest 失败静默跳过
  }
  if (!latest) return;
  if (compareVersions(latest, installed) <= 0) return; // 全局已是最新
  console.log(`
↻ 检测到全局 ${pkg.name}@${installed}，正在升级到 v${latest}...`);
  try {
    runCommandSync("npm", ["install", "-g", `${pkg.name}@latest`], {
      stdio: "inherit",
    });
    console.log(`✓ 全局 ${pkg.name} 已升级到 v${latest}`);
  } catch (e) {
    console.error(`
⚠ 全局升级失败：${e.message || e}
  可手动执行：  flow2spec update --cli`);
  }
}

function printCliUpdateHint(latest) {
  console.log(`
⚠ Flow2Spec CLI 有新版本 v${latest}（当前 v${pkg.version}）
执行：flow2spec update --cli
`);
}

function maybePrintUpdateNotice() {
  if (!shouldCheckForUpdates()) return;
  try {
    const latest = queryLatestPackageVersion();
    if (latest && compareVersions(latest, pkg.version) > 0) {
      printCliUpdateHint(latest);
    }
  } catch {
    // 静默跳过，不能因为网络或 npm registry 影响主命令。
  }
}

function printJson(data) {
  console.log(`${JSON.stringify(data, null, 2)}\n`);
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

function printKnowledgeHelp() {
  console.log(`
Flow2Spec KB - knowledge collaboration engine

用法:
  flow2spec kb status [--json]
  flow2spec kb check [--strict] [--json]
  flow2spec kb plan <delta-file> [--json]
  flow2spec kb apply <delta-file> [--dry-run] [--json]
  flow2spec kb build [--fix-topics] [--json]

说明:
  status  - 汇总当前知识图、active task delta 与潜在漂移
  check   - 校验 manifest/topic/frontmatter/revision
  plan    - 预演一个 kb-delta 是否可自动合并
  apply   - 应用 kb-delta 并同步 topic frontmatter / routing
  build   - 基于 topic frontmatter 归一化 routing 元数据；--fix-topics 可为旧 topic 补 frontmatter/revision

delta changes:
  appendBody / replaceBody / updateFrontmatter / createTopic
`);
}

const help = `
Flow2Spec - 统一知识库工作流（AI 配置入口）  v${pkg.version}

用法:
  flow2spec init [agent ...] [--reset-knowledge] [--yes] [--locale zh-CN|en-US]    在当前项目初始化：写入 .Knowledge 与所选 agent 入口
  flow2spec config              打印项目根 ${CONFIG_FILENAME} 的解析结果（缺省值合并后）
  flow2spec doctor [--json]     只读检查运行环境、项目初始化、协作上下文与知识库健康
  flow2spec kb                  知识库协作引擎：status / check / plan / apply / build
  flow2spec version             显示 CLI / Core / Template / Protocol 版本
  flow2spec update --check      检查 CLI 与 Core 更新
  flow2spec update --cli        整体更新（CLI 与配套 Core 联动）
  flow2spec update --core       同 --cli：Core 随 CLI 联动发布，执行整体更新
  flow2spec --help              显示本说明

agent（可多个，空格分隔；省略时交互选择）：
  ${agentList}

示例:
  flow2spec init                  # 交互选择工具和配置
  flow2spec init <agent>          # 直接写入指定客户端配置根，跳过工具选择
  flow2spec init <agent> <agent>  # 同时初始化多个客户端
  flow2spec init <agent> --locale en-US  # 使用英文模板初始化指定客户端
  flow2spec init dsh                  # 初始化 DeepSeek Harness 项目技能
  flow2spec init plugin               # 插件模式客户端（如 Qoder 插件）：仅初始化知识库与配置
  flow2spec init --yes            # 跳过所有问答，使用默认值（适合 CI）
  flow2spec init --reset-knowledge  # 强制用模板覆盖 .Knowledge（谨慎）

init 会:
  1. 交互询问要初始化的 AI 工具（见上方 agent 列表，可多选）；已通过参数指定则跳过。
     传 --yes 或非 TTY 环境时跳过问答，使用默认值。
  2. 对 ${CONFIG_FILENAME} 中缺失的配置字段逐项提问（已有字段不覆盖）。模板语言由 --locale、已有 locale 或默认 zh-CN 决定。
     传 --yes 时所有缺失字段使用各自默认值。
  3. 默认仅补齐 .Knowledge 缺失模板，并对路由清单做包级/结构增量对齐（manifest-routing + matcherPath 分片；关键词仅写在 matchers/*.json）；不替代 f2s-* 对业务文档与路由内容的写入。
     传 --reset-knowledge 时才会强制用模板覆盖 .Knowledge 中模板承载部分。
  4. 在各 agent 配置根写入对应的 rules、skills、入口和 hooks（若该客户端支持）；具体落盘方式以客户端适配器为准。
  5. 每次 init 将当前 locale 包模板 knowledge/index.md 复制到 .Knowledge/template/index.template.md，供 f2s-kb-upgrade 技能与 .Knowledge/index.md 对照；不自动改写 index.md。（「知识库升级」指 f2s-kb-upgrade 技能，init 本身不是升级命令。）
  6. 非破坏式补充 .gitignore：忽略 .task/ 与 .Knowledge/update-check.json 这类本地运行态。
  7. 规则与技能在各 agent 配置根加载；其他模版类文件在 .Knowledge/template/ 等目录。

更多说明见 README.md 或 docs/使用说明.md
`;

if (sub === "--help" || sub === "-h" || !sub) {
  console.log(help.trim());
  process.exit(0);
}

if (sub === "version" || sub === "--version" || sub === "-v") {
  console.log([
    `Flow2Spec CLI:       ${pkg.version}`,
    `Flow2Spec Core:      ${coreVersions.coreVersion}`,
    `Core Pinned:         ${coreRange}`,
    `Template Version:    ${coreVersions.templateVersion}`,
    `Protocol Version:    ${getCapabilities().protocolVersion}`,
  ].join("\n"));
  maybePrintUpdateNotice();
  process.exit(0);
}

if (sub === "update") {
  const updateFlags = args.slice(1);
  const allowedUpdateFlags = new Set(["--check", "--cli", "--core"]);
  if (updateFlags.length > 1 || updateFlags.some((flag) => !allowedUpdateFlags.has(flag))) {
    console.error("用法: flow2spec update --check|--cli|--core");
    process.exit(1);
  }
  const mode = updateFlags[0] || "--check";
  try {
    const latestCli = runCommandSync("npm", ["view", pkg.name, "version"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const latestCore = queryLatestCoreMetadata();

    if (mode === "--check") {
      console.log([
        `CLI:      ${pkg.version} -> ${latestCli}`,
        `Core:     ${coreVersions.coreVersion} -> ${latestCore.version}`,
        `Template: ${coreVersions.templateVersion} -> ${latestCore.templateVersion}`,
        `Policy:   Core 随 CLI 联动发布（当前 CLI pin Core ${coreRange}）`,
      ].join("\n"));
      if (compareVersions(latestCli, pkg.version) > 0) {
        console.log("\n可运行 flow2spec update --cli 一键更新（CLI 与配套 Core 一起到位）。");
      }
      process.exit(0);
    }

    // --cli 与 --core 统一为整体更新：CLI pin 精确 Core 版本，更新 CLI 即同时拿到配套 Core。
    if (mode === "--core") {
      console.log("Core 随 CLI 联动发布；执行整体更新（等价 update --cli）。");
    }
    if (!getGlobalInstalledVersion()) {
      runCommandSync("npx", ["--yes", `${pkg.name}@latest`, "version"], { stdio: "inherit" });
      console.log("\n✓ 当前为 npx 场景；已用 latest CLI 启动并验证（自带配套 Core），无需写入全局安装。");
      process.exit(0);
    }

    const cliUpToDate = compareVersions(latestCli, pkg.version) <= 0;
    const effectiveBefore = getGlobalEffectiveCoreVersion();
    const coreHealthy = Boolean(effectiveBefore) && compareVersions(effectiveBefore, latestCore.version) >= 0;
    if (cliUpToDate && coreHealthy) {
      console.log(`CLI v${pkg.version} 与 Core v${effectiveBefore} 均已是最新。`);
      process.exit(0);
    }
    if (cliUpToDate && !coreHealthy) {
      // CLI 已是 latest 但实际生效的 Core 落后（历史孤儿副本 / 嵌套遮蔽）：先卸再装强制重建依赖树。
      console.log(`检测到 Core 实际生效版本 v${effectiveBefore || "未知"} 落后于 v${latestCore.version}，重装 CLI 修复依赖树…`);
      try {
        runCommandSync("npm", ["uninstall", "-g", pkg.name], { stdio: "inherit" });
      } catch {
        // 卸载失败不阻断，继续安装。
      }
    }
    runCommandSync("npm", ["install", "-g", `${pkg.name}@latest`], { stdio: "inherit" });

    // 生效验证：以实际解析到的 Core 为准，不再仅凭 npm 退出码报成功。
    const installedCli = getGlobalInstalledVersion();
    const effectiveAfter = getGlobalEffectiveCoreVersion();
    console.log(`\n✓ CLI 已更新到 v${installedCli || latestCli}；Core 实际生效版本 v${effectiveAfter || "未知"}`);
    if (!effectiveAfter || compareVersions(effectiveAfter, latestCore.version) < 0) {
      console.error([
        `⚠ Core 生效版本仍为 v${effectiveAfter || "未知"}（期望 v${latestCore.version}）。`,
        `若刚发布新版，可能处于 CLI/Core 联动发布窗口，稍后重试；否则请手动执行：`,
        `  npm uninstall -g ${pkg.name} && npm install -g ${pkg.name}@latest`,
      ].join("\n"));
      process.exit(1);
    }
    console.log(latestCore.templateVersion === coreVersions.templateVersion
      ? "Template Version 未变化，无需执行 f2s-kb-upgrade。"
      : "Template Version 已变化；请运行 init，并仅在 projectRev 与 pkgRev 不等时进入 f2s-kb-upgrade。"
    );
  } catch (e) {
    console.error("更新失败:", e.message || e);
    process.exit(1);
  }
  process.exit(0);
}

if (sub === "config") {
  const cwd = process.cwd();
  const abs = path.join(cwd, CONFIG_FILENAME);
  try {
    const cfg = createApi(cwd).config.load();
    console.log(JSON.stringify({ configPath: abs, ...cfg }, null, 2));
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  process.exit(0);
}

if (sub === "doctor") {
  const doctorArgs = args.slice(1);
  if (doctorArgs.includes("--help") || doctorArgs.includes("-h")) {
    console.log(`
用法:
  flow2spec doctor [--json]

只读检查 Node.js、项目配置、Agent 初始化、协作上下文、.task 忽略规则与知识库健康。
警告不阻塞（exit 0），错误会返回 exit 1；本命令不会修改文件或访问网络。
`.trim());
    process.exit(0);
  }
  const unknown = doctorArgs.filter((arg) => arg !== "--json");
  if (unknown.length > 0) {
    console.error(`doctor 不支持参数：${unknown.join(" ")}`);
    process.exit(1);
  }
  const report = createApi(process.cwd()).doctor.run();
  if (doctorArgs.includes("--json")) {
    printJson(report);
  } else {
    console.log(formatDoctorReport(report));
  }
  process.exit(report.ok ? 0 : 1);
}

if (sub === "kb") {
  const kbSub = args[1];
  const kbFlags = new Set(args.slice(2).filter((arg) => String(arg || "").startsWith("--")));
  const kbPositionals = args.slice(2).filter((arg) => !String(arg || "").startsWith("--"));
  const cwd = process.cwd();
  const jsonOut = kbFlags.has("--json");
  const flow2spec = createApi(cwd);

  try {
    if (!kbSub || kbSub === "--help" || kbSub === "-h") {
      printKnowledgeHelp();
      process.exit(0);
    }

    if (kbSub === "status") {
      const report = flow2spec.knowledge.status();
      if (jsonOut) {
        printJson(report);
      } else {
        console.log(`knowledge topics: ${report.topicCount}`);
        console.log(`routing drift: ${report.routingDrift ? "yes" : "no"}`);
        console.log(`validation: ${report.validation.ok ? "ok" : "has issues"}`);
        if (report.validation.warnings.length) {
          console.log(`warnings: ${report.validation.warnings.length}`);
        }
        if (report.tasks.length) {
          console.log("active kb deltas:");
          for (const task of report.tasks) {
            if (task.error) {
              console.log(`- ${task.taskName}: ${task.error}`);
              continue;
            }
            console.log(
              `- ${task.taskName}: ${task.mergeable ? "mergeable" : "conflict"} (${task.plan.length} changes, ${task.conflicts.length} conflicts)`,
            );
          }
        }
      }
      process.exit(report.validation.ok ? 0 : 1);
    }

    if (kbSub === "check") {
      const strict = kbFlags.has("--strict");
      const validation = flow2spec.knowledge.check({
        strictRevision: strict,
      });
      const report = flow2spec.knowledge.status();
      const routingDrift = report.routingDrift;
      const ok =
        validation.issues.length === 0 &&
        !routingDrift &&
        (!strict || validation.warnings.length === 0);
      const result = {
        ok,
        strict,
        topicCount: report.topicCount,
        issues: validation.issues,
        warnings: validation.warnings,
        routingDrift,
        activeDeltas: report.tasks,
      };
      if (jsonOut) {
        printJson(result);
      } else {
        console.log(`knowledge check: ${result.ok ? "ok" : "failed"}`);
        console.log(`topics: ${result.topicCount}`);
        console.log(`routing drift: ${routingDrift ? "yes" : "no"}`);
        if (result.issues.length) {
          console.log(`issues: ${result.issues.length}`);
          for (const issue of result.issues.slice(0, 10)) {
            console.log(`- ${issue}`);
          }
        }
        if (result.warnings.length) {
          console.log(`warnings: ${result.warnings.length}`);
          for (const warning of result.warnings.slice(0, 10)) {
            console.log(`- ${warning}`);
          }
        }
      }
      process.exit(result.ok ? 0 : 1);
    }

    if (kbSub === "plan" || kbSub === "apply") {
      const deltaArg = kbPositionals[0];
      if (!deltaArg) {
        console.error(`kb ${kbSub} 需要 delta 文件路径`);
        process.exit(1);
      }
      const deltaPath = path.resolve(cwd, deltaArg);
      const dryRun = kbFlags.has("--dry-run") || kbSub === "plan";
      if (kbSub === "plan") {
        const plan = flow2spec.knowledge.plan({ deltaFile: deltaPath });
        const result = {
          ok: plan.mergeable,
          deltaPath,
          plan: plan.plan,
          conflicts: plan.conflicts,
        };
        if (jsonOut) {
          printJson(result);
        } else {
          console.log(`kb plan: ${result.ok ? "mergeable" : "conflict"}`);
          for (const item of result.plan) {
            console.log(
              `- ${item.topicId}: ${item.type} ${item.beforeRevision} -> ${item.afterRevision}`,
            );
          }
          for (const conflict of result.conflicts) {
            console.log(`! ${conflict.topicId}: ${conflict.reason}`);
          }
        }
        process.exit(result.ok ? 0 : 1);
      }
      const result = flow2spec.knowledge.apply({
        deltaFile: deltaPath,
        dryRun,
      });
      if (jsonOut) {
        printJson(result);
      } else {
        console.log(`kb apply: ${dryRun ? "dry-run" : "applied"}`);
        for (const file of result.changedFiles) {
          console.log(`- ${file}`);
        }
      }
      process.exit(0);
    }

    if (kbSub === "build") {
      const result = flow2spec.knowledge.build({
        writeTopicFrontmatter: kbFlags.has("--fix-topics"),
      });
      if (jsonOut) {
        printJson(result);
      } else {
        console.log(`kb build: ${result.changed ? "updated" : "up-to-date"}`);
        console.log(`routing: ${path.relative(cwd, result.routingPath)}`);
        if (result.topicFrontmatterChanged?.length) {
          console.log(`topic frontmatter: ${result.topicFrontmatterChanged.length} updated`);
          for (const file of result.topicFrontmatterChanged.slice(0, 10)) {
            console.log(`- ${file}`);
          }
        }
        console.log(
          `validation: ${result.validation.ok ? "ok" : "has issues"}`,
        );
      }
      process.exit(result.validation.ok ? 0 : 1);
    }

    console.error(`unknown kb subcommand: ${kbSub}`);
    printKnowledgeHelp();
    process.exit(1);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

if (sub === "init") {
  const rawArgs = args.slice(1);
  const overwriteKnowledge = rawArgs.includes("--reset-knowledge");
  const skipPrompts = rawArgs.includes("--yes") || rawArgs.includes("-y");
  let cliLocale;
  const agentArgs = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--reset-knowledge" || arg === "--yes" || arg === "-y") continue;
    if (arg === "--locale") {
      if (!rawArgs[i + 1] || rawArgs[i + 1].startsWith("--")) {
        console.error(`--locale 需要取值。可选：${SUPPORTED_LOCALES.join(", ")}`);
        process.exit(1);
      }
      cliLocale = String(rawArgs[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg.startsWith("--locale=")) {
      cliLocale = String(arg.slice("--locale=".length) || "").trim();
      continue;
    }
    agentArgs.push(arg);
  }
  if (cliLocale && !SUPPORTED_LOCALES.includes(cliLocale)) {
    console.error(`不支持的 locale：${cliLocale}。可选：${SUPPORTED_LOCALES.join(", ")}`);
    process.exit(1);
  }

  const cwd = process.cwd();

  // ── 清除已输出的 n 行（用于多选 UI 重绘）
  function clearLines(n) {
    if (n <= 0) return;
    process.stdout.write(`\x1b[${n}A\x1b[0J`);
  }

  /**
   * 多选 UI（raw mode）：箭头键移动，空格选/取消，回车确认。
   * 非 TTY 环境直接返回默认选中项。
   */
  async function promptMultiSelect(title, items, defaultSelected = []) {
    if (!process.stdin.isTTY || skipPrompts) {
      return defaultSelected.length ? defaultSelected : [items[0].value];
    }

    const selected = new Set(defaultSelected.length ? defaultSelected : [items[0].value]);
    let cursor = 0;
    let rendered = 0;

    function render() {
      if (rendered > 0) clearLines(rendered);
      const lines = [];
      lines.push(`  ${title}`);
      for (let i = 0; i < items.length; i++) {
        const sel = selected.has(items[i].value);
        const check = sel ? "\x1b[32m◉\x1b[0m" : "○";
        const arr = i === cursor ? "\x1b[36m›\x1b[0m" : " ";
        const label = items[i].label.padEnd(10);
        const desc = items[i].desc ? `  \x1b[2m${items[i].desc}\x1b[0m` : "";
        lines.push(`  ${arr} ${check}  ${label}${desc}`);
      }
      lines.push("");
      lines.push("  \x1b[2m↑↓ 移动  空格 选/取消  回车 确认\x1b[0m");
      rendered = lines.length;
      process.stdout.write(lines.join("\n") + "\n");
    }

    render();

    return new Promise((resolve) => {
      function onKey(str, key) {
        if (!key) return;
        if (key.ctrl && key.name === "c") process.exit(0);

        if (key.name === "up") {
          cursor = (cursor - 1 + items.length) % items.length;
          render();
        } else if (key.name === "down") {
          cursor = (cursor + 1) % items.length;
          render();
        } else if (key.name === "space") {
          const val = items[cursor].value;
          if (selected.has(val)) selected.delete(val);
          else selected.add(val);
          render();
        } else if (key.name === "return") {
          process.stdin.removeListener("keypress", onKey);
          const result = selected.size ? [...selected] : [items[0].value];
          if (rendered > 0) clearLines(rendered);
          const labels = result
            .map((v) => items.find((i) => i.value === v)?.value)
            .join(", ");
          process.stdout.write(`  ${title}  \x1b[32m${labels}\x1b[0m\n`);
          resolve(result);
        }
      }
      process.stdin.on("keypress", onKey);
    });
  }

  /**
   * 单选 UI（raw mode）：箭头键移动，回车确认。
   * 非 TTY 或 skipPrompts 时直接返回默认值。
   */
  async function promptSingleSelect(title, items, defaultValue) {
    const fallback = defaultValue || items[0].value;
    if (!process.stdin.isTTY || skipPrompts) return fallback;

    let cursor = Math.max(0, items.findIndex((item) => item.value === fallback));
    let rendered = 0;

    function render() {
      if (rendered > 0) clearLines(rendered);
      const lines = [];
      lines.push(`  ${title}`);
      for (let i = 0; i < items.length; i++) {
        const selected = i === cursor;
        const check = selected ? "\x1b[32m◉\x1b[0m" : "○";
        const arr = selected ? "\x1b[36m›\x1b[0m" : " ";
        const label = items[i].label.padEnd(10);
        const desc = items[i].desc ? `  \x1b[2m${items[i].desc}\x1b[0m` : "";
        lines.push(`  ${arr} ${check}  ${label}${desc}`);
      }
      lines.push("");
      lines.push("  \x1b[2m↑↓ 移动  回车 确认\x1b[0m");
      rendered = lines.length;
      process.stdout.write(lines.join("\n") + "\n");
    }

    render();

    return new Promise((resolve) => {
      function onKey(str, key) {
        if (!key) return;
        if (key.ctrl && key.name === "c") process.exit(0);

        if (key.name === "up") {
          cursor = (cursor - 1 + items.length) % items.length;
          render();
        } else if (key.name === "down") {
          cursor = (cursor + 1) % items.length;
          render();
        } else if (key.name === "return") {
          process.stdin.removeListener("keypress", onKey);
          const result = items[cursor]?.value || fallback;
          if (rendered > 0) clearLines(rendered);
          process.stdout.write(`  ${title}  \x1b[32m${result}\x1b[0m\n`);
          resolve(result);
        }
      }
      process.stdin.on("keypress", onKey);
    });
  }

  /**
   * 单键 y/n 问答（raw mode）。
   * 非 TTY 或 skipPrompts 时直接返回默认值。
   */
  async function promptBooleanKey(question, defaultValue = false) {
    if (!process.stdin.isTTY || skipPrompts) return defaultValue;

    const hint = defaultValue
      ? "\x1b[2m[Y/n]\x1b[0m"
      : "\x1b[2m[y/N]\x1b[0m";
    process.stdout.write(`  ${question} ${hint} `);

    return new Promise((resolve) => {
      process.stdin.once("keypress", function (str, key) {
        if (key && key.ctrl && key.name === "c") process.exit(0);
        let result;
        if (!str || str.trim() === "" || key?.name === "return") {
          result = defaultValue;
        } else {
          result = str.trim().toLowerCase() === "y";
        }
        process.stdout.write((result ? "\x1b[32my\x1b[0m" : "n") + "\n");
        resolve(result);
      });
    });
  }

  async function promptLocale(question, defaultValue = "zh-CN") {
    if (!process.stdin.isTTY || skipPrompts) return defaultValue;
    const items = SUPPORTED_LOCALES.map((locale) => ({
      value: locale,
      label: locale,
      desc: locale === "zh-CN" ? "中文模板" : "English templates",
    }));
    return promptSingleSelect(question, items, defaultValue);
  }

  async function collectInitOptions() {
    const needAgentPrompt = agentArgs.length === 0 && !skipPrompts;
    const missingFields = createApi(cwd).config.missingFields();
    const needConfigPrompt = missingFields.length > 0;

    // 没有任何需要处理的事情
    if (!needAgentPrompt && !needConfigPrompt) {
      return { configValues: cliLocale ? { locale: cliLocale } : undefined, chosenAgents: agentArgs };
    }

    // --yes 模式：缺失字段直接用默认值，不弹交互
    if (skipPrompts) {
      const configValues = needConfigPrompt
        ? Object.fromEntries(missingFields.map((f) => [f.key, f.default]))
        : undefined;
      return { configValues, chosenAgents: agentArgs };
    }

    const isInteractive = process.stdin.isTTY;
    if (isInteractive) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }

    let chosenAgents = agentArgs;
    let configValues;

    try {
      process.stdout.write("\n");

      if (needAgentPrompt) {
        const agentItems = Object.entries(AGENTS).map(([id, { label }]) => ({
          value: id,
          label: id,
          desc: label,
        }));
        chosenAgents = await promptMultiSelect(
          "选择要初始化的 AI 工具（可多选）",
          agentItems,
          ["cursor"],
        );
      }

      if (needConfigPrompt) {
        if (needAgentPrompt) process.stdout.write("\n");
        const isFirstTime = !fs.existsSync(path.join(cwd, CONFIG_FILENAME));
        process.stdout.write(
          `  配置 ${CONFIG_FILENAME}${isFirstTime ? "（首次创建）" : "（补充新增字段）"}：\n\n`,
        );
        const values = {};
        for (const field of missingFields) {
          if (field.type === "locale") {
            values[field.key] = cliLocale || await promptLocale(field.question, field.default);
          } else {
            values[field.key] = await promptBooleanKey(
              field.question,
              field.default,
            );
          }
        }
        if (cliLocale) values.locale = cliLocale;
        configValues = values;
      } else if (cliLocale) {
        configValues = { locale: cliLocale };
      }
    } finally {
      if (isInteractive) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    }

    process.stdout.write("\n");
    return { configValues, chosenAgents };
  }

  collectInitOptions()
    .then(({ configValues, chosenAgents }) =>
      createApi(cwd).project.init({
        integrations: chosenAgents,
        overwriteKnowledge,
        configValues,
        locale: cliLocale,
      }),
    )
    .then(({ ids, knowledgeResult, routingUpgrade, indexSnapshot, gitignoreResult, projectConfig, locale, claudeHooksResult }) => {
      const lines = ids.map((id) => {
        const { root, label } = AGENTS[id];
        if (!root)
          return `  - ${label}：仅 .Knowledge/ 与 ${CONFIG_FILENAME}（skills/rules/hooks 由客户端插件提供）`;
        if (id === "codex")
          return `  - ${root}/：（${label}）skills/、topics/、hooks/、hooks.json、AGENTS.md（指针）；仓库根 AGENTS.md（完整）`;
        if (id === "dsh")
          return `  - ${root}/：（${label}）skills/、topics/、AGENTS.md（指针）；根 AGENTS.md（缺少时生成）`;
        if (id === "claude") {
          const hookLine = claudeHooksResult?.settingsChanged
            ? "rules/、skills/、hooks/f2s-config-session.js、hooks/f2s-config-inject.js、settings.json（已写入 f2s SessionStart/PreToolUse hooks）"
            : "rules/、skills/（settings.json 中 f2s hook 已存在，跳过）";
          return `  - ${root}/：（${label}）${hookLine}`;
        }
        return `  - ${root}/：（${label}）rules/、skills/`;
      });
      const knowledgeLine = overwriteKnowledge
        ? "  - .Knowledge/：已按 --reset-knowledge 强制覆盖模板"
        : `  - .Knowledge/：保留已有内容，补齐缺失模板（新增 ${knowledgeResult?.written || 0}，跳过 ${knowledgeResult?.skipped || 0}）`;
      const routingLine = overwriteKnowledge
        ? "  - .Knowledge/manifest-routing.json + .Knowledge/matchers/*：已随 reset 覆盖到模板版本（不再写入 manifest-matchers.json）"
        : routingUpgrade?.upgraded
          ? "  - 路由清单已与模板增量对齐"
          : "  - 路由清单已是最新能力路由，无需变更";
      const indexLine =
        indexSnapshot?.written === false
          ? `  - .Knowledge/template/index.template.md：未复制（${indexSnapshot?.reason || "skip"}）`
          : `  - .Knowledge/template/index.template.md：已从包内 templates/${locale}/knowledge/index.md 复制（与 .Knowledge/index.md 对照见 f2s-kb-upgrade 技能）`;
      const pc = projectConfig || {};
      const configLine = `  - ${CONFIG_FILENAME}：locale=${pc.locale || locale}, subAgent=${Boolean(pc.subAgent)}, switchAgentVerification=${Boolean(pc.switchAgentVerification)}`;
      const gitignoreLine = gitignoreResult?.changed
        ? `  - .gitignore：已补充 ${gitignoreResult.added.join(", ")}`
        : "  - .gitignore：Flow2Spec 本地态忽略项已存在";
      console.log(`
✓ Flow2Spec init 完成
${knowledgeLine}
${routingLine}
${indexLine}
${gitignoreLine}
${configLine}
${lines.join("\n")}

建议阅读 README 或 docs/使用说明.md，按「规则在配置根、文档在 .Knowledge」的方式使用。
`);
      maybeAutoUpdateGlobalInstall();
      maybePrintUpdateNotice();
    })
    .catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
} else {
  console.log(help.trim());
  process.exit(1);
}
