#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const os = require("os");
const readline = require("readline");
const runInit = require("./lib/init");
const { AGENTS } = require("./lib/agents");
const {
  loadFlow2specConfig,
  CONFIG_FILENAME,
  CONFIG_FIELDS,
  getMissingConfigFields,
  SUPPORTED_LOCALES,
  normalizeLocale,
} = require("./lib/flow2specConfig");
const knowledgeEngine = require("./lib/knowledgeEngine");

const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const sub = args[0];

const agentList = Object.entries(AGENTS)
  .map(([id, { label }]) => `${id}(${label})`)
  .join(", ");

const pkg = require("./package.json");

if (pkg.name === "@double-codeing/flow2spec" && !process.env.FLOW2SPEC_SUPPRESS_MIGRATION_NOTICE) {
  const RED = "\x1b[31m";
  const YELLOW = "\x1b[33m";
  const BOLD = "\x1b[1m";
  const RESET = "\x1b[0m";
  console.warn(`${RED}${BOLD}
╔══════════════════════════════════════════════════════════════════════╗
║  ⚠️  @double-codeing/flow2spec 已弃用（组织名拼写错误 codeing→coding）  ║
║  ⚠️  @double-codeing/flow2spec is DEPRECATED (typo in org name)      ║
║                                                                      ║
║  请迁移到 / Please migrate to @double-coding/flow2spec：             ║
║                                                                      ║
║    ${YELLOW}npm uninstall -g @double-codeing/flow2spec${RED}                       ║
║    ${YELLOW}npm install -g @double-coding/flow2spec${RED}                          ║
║                                                                      ║
║  后续所有版本将发布在新组织下。                                        ║
║  All future updates will be published under the new organization.    ║
╚══════════════════════════════════════════════════════════════════════╝${RESET}
`);
}

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
  const latest = execFileSync("npm", ["view", pkg.name, "version"], {
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
    globalRoot = execFileSync("npm", ["root", "-g"], {
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
    execFileSync("npm", ["install", "-g", `${pkg.name}@latest`], {
      stdio: "inherit",
    });
    console.log(`✓ 全局 ${pkg.name} 已升级到 v${latest}`);
  } catch (e) {
    console.error(`
⚠ 全局升级失败：${e.message || e}
  可手动执行：  flow2spec update`);
  }
}

function printKnowledgeUpgradeHint(latest) {
  console.log(`
⚠ Flow2Spec 有新版本 v${latest}（当前 v${pkg.version}）
建议先更新包：
  flow2spec update

更新后请在 Agent 对话中执行：
  f2s-kb-upgrade

用于对齐项目知识库模板、manifest/matchers 与配置根产物；不要把单独 flow2spec init 当作知识库升级。
`);
}

function maybePrintUpdateNotice() {
  if (!shouldCheckForUpdates()) return;
  try {
    const latest = queryLatestPackageVersion();
    if (latest && compareVersions(latest, pkg.version) > 0) {
      printKnowledgeUpgradeHint(latest);
    }
  } catch {
    // 静默跳过，不能因为网络或 npm registry 影响主命令。
  }
}

function printJson(data) {
  console.log(`${JSON.stringify(data, null, 2)}\n`);
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
  flow2spec kb                  知识库协作引擎：status / check / plan / apply / build
  flow2spec version             显示当前 flow2spec 版本
  flow2spec update              更新 flow2spec 到最新版本；更新后提示执行 f2s-kb-upgrade
  flow2spec --help              显示本说明

agent（可多个，空格分隔；省略时交互选择）：
  ${agentList}

示例:
  flow2spec init                  # 交互选择工具和配置
  flow2spec init claude           # 直接写入 .claude/，跳过工具选择
  flow2spec init cursor claude    # 同时写入 .cursor/ 与 .claude/
  flow2spec init codex --locale en-US  # 使用英文模板初始化 Codex
  flow2spec init --yes            # 跳过所有问答，使用默认值（适合 CI）
  flow2spec init --reset-knowledge  # 强制用模板覆盖 .Knowledge（谨慎）

init 会:
  1. 交互询问要初始化的 AI 工具（cursor / claude / codex，可多选）；已通过参数指定则跳过。
     传 --yes 或非 TTY 环境时跳过问答，使用默认值。
  2. 对 ${CONFIG_FILENAME} 中缺失的配置字段逐项提问（已有字段不覆盖）。模板语言由 --locale、已有 locale 或默认 zh-CN 决定。
     传 --yes 时所有缺失字段使用各自默认值。
  3. 默认仅补齐 .Knowledge 缺失模板，并对路由清单做包级/结构增量对齐（manifest-routing + matcherPath 分片；关键词仅写在 matchers/*.json）；不替代 f2s-* 对业务文档与路由内容的写入。
     传 --reset-knowledge 时才会强制用模板覆盖 .Knowledge 中模板承载部分。
  4. 在各 agent 配置根写入 rules、skills（Claude 规则自动转 .md；Codex 在仓库根写入完整 AGENTS.md，.codex/ 写入指针）。
     Claude 额外写入 .claude/hooks/f2s-config-session.js、f2s-config-inject.js 与 .claude/settings.json：
     SessionStart 注入一次配置摘要；PreToolUse 仅在调用 f2s-* Skill 时提示首步必须 Read 配置。
     Cursor 额外写入 f2s-config-check.mdc（alwaysApply），强制在技能首步读取配置文件；
     并写入 .cursor/hooks.json，在 sessionStart 自动检测知识库版本。
     Codex：仓库根 AGENTS.md（完整条令）；.codex/AGENTS.md 为指针；
     并写入 .codex/hooks.json，在 SessionStart 注入配置摘要并检测知识库版本。
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
  console.log(`flow2spec v${pkg.version}`);
  maybePrintUpdateNotice();
  process.exit(0);
}

if (sub === "update") {
  console.log(`当前版本: v${pkg.version}`);
  console.log("正在检查最新版本...");
  try {
    const latest = execFileSync("npm", ["view", pkg.name, "version"], {
      encoding: "utf8",
    }).trim();
    if (compareVersions(latest, pkg.version) <= 0) {
      console.log(`当前版本不低于 npm 最新版本 v${latest}`);
      process.exit(0);
    }
    console.log(`发现新版本: v${latest}`);
    console.log("正在更新...");
    execFileSync("npm", ["install", "-g", `${pkg.name}@latest`], {
      stdio: "inherit",
    });
    console.log(`\n✓ 已更新到 v${latest}`);
    console.log(`
下一步：请在需要升级的项目 Agent 对话中执行：
  f2s-kb-upgrade

用于对齐项目知识库模板、manifest/matchers 与配置根产物；不要把单独 flow2spec init 当作知识库升级。
`);
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
    const cfg = loadFlow2specConfig(cwd);
    console.log(JSON.stringify({ configPath: abs, ...cfg }, null, 2));
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  process.exit(0);
}

if (sub === "kb") {
  const kbSub = args[1];
  const kbFlags = new Set(args.slice(2).filter((arg) => String(arg || "").startsWith("--")));
  const kbPositionals = args.slice(2).filter((arg) => !String(arg || "").startsWith("--"));
  const cwd = process.cwd();
  const jsonOut = kbFlags.has("--json");

  try {
    if (!kbSub || kbSub === "--help" || kbSub === "-h") {
      printKnowledgeHelp();
      process.exit(0);
    }

    if (kbSub === "status") {
      const report = knowledgeEngine.summarizeKnowledgeState(cwd);
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
      const graph = knowledgeEngine.loadKnowledgeGraph(cwd);
      const validation = knowledgeEngine.validateKnowledgeGraph(graph, {
        strictRevision: strict,
      });
      const normalized = knowledgeEngine.normalizeRoutingWithGraph(
        graph,
      );
      const routingDrift =
        knowledgeEngine.stableStringify(normalized.routing) !==
        knowledgeEngine.stableStringify(graph.routing);
      const report = knowledgeEngine.summarizeKnowledgeState(cwd);
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
      const graph = knowledgeEngine.loadKnowledgeGraph(cwd);
      const delta = knowledgeEngine.parseKnowledgeDelta(deltaPath);
      const plan = knowledgeEngine.planKnowledgeDelta(graph, delta);
      if (kbSub === "plan") {
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
      const result = knowledgeEngine.applyKnowledgeDelta(cwd, deltaPath, {
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
      const result = knowledgeEngine.buildKnowledgeGraph(cwd, {
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
  if (cliLocale) cliLocale = normalizeLocale(cliLocale);

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
    const missingFields = getMissingConfigFields(cwd);
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
        const isFirstTime = missingFields.length === CONFIG_FIELDS.length;
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
      runInit(cwd, chosenAgents, { overwriteKnowledge, configValues, locale: cliLocale }),
    )
    .then(({ ids, knowledgeResult, routingUpgrade, indexSnapshot, gitignoreResult, projectConfig, locale, claudeHooksResult }) => {
      const lines = ids.map((id) => {
        const { root, label } = AGENTS[id];
        if (id === "codex")
          return `  - ${root}/：（${label}）skills/、topics/、hooks/、hooks.json、AGENTS.md（指针）；仓库根 AGENTS.md（完整）`;
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
