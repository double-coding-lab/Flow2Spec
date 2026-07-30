/**
 * 多人协作：developerId 解析与任务根路径。
 *
 * 优先级（已定口径，勿再加 env/local 层）：
 * 1. flow2spec.config.json → collaboration.developerId
 * 2. git user.email（@ 前）或 user.name，规范化
 * 3. 都没有 → null（调用方使用 legacy `.task/` 根）
 *
 * collaboration.enabled === false 时强制 legacy（返回 null）。
 */

const { execFileSync } = require("child_process");
const path = require("path");

const TASK_DIR = ".task";

/**
 * @param {string} raw
 * @returns {string|null} sanitize 后的 id；非法则 null
 */
function sanitizeDeveloperId(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // email → local part
  if (s.includes("@")) {
    s = s.split("@")[0] || "";
  }
  s = s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (s.length < 1 || s.length > 64) return null;
  // 禁止纯数字或易混通用名作为「看起来像配置」的默认（仍允许 git 推出的合法 id）
  return s;
}

/**
 * @param {string} [cwd]
 * @returns {{ email: string|null, name: string|null }}
 */
function readGitIdentity(cwd) {
  const opts = {
    encoding: "utf8",
    timeout: 3000,
    stdio: ["ignore", "pipe", "ignore"],
    cwd: cwd || process.cwd(),
  };
  let email = null;
  let name = null;
  try {
    email = execFileSync("git", ["config", "user.email"], opts).trim() || null;
  } catch {
    email = null;
  }
  try {
    name = execFileSync("git", ["config", "user.name"], opts).trim() || null;
  } catch {
    name = null;
  }
  return { email, name };
}

/**
 * @param {object} config loadFlow2specConfig 的返回值
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {{ email?: string|null, name?: string|null }} [options.gitIdentity] 测试注入
 * @returns {{
 *   developerId: string|null,
 *   source: 'config'|'git-email'|'git-name'|'legacy',
 *   legacy: boolean,
 *   taskRoot: string,
 *   enabled: boolean,
 * }}
 */
function resolveDeveloperContext(config, options = {}) {
  const cwd = options.cwd || process.cwd();
  const collab =
    config && config.collaboration && typeof config.collaboration === "object"
      ? config.collaboration
      : {};
  const enabled = collab.enabled !== false; // 缺省 true：有 id 就隔离；无 id 仍 legacy

  if (!enabled) {
    return {
      developerId: null,
      source: "legacy",
      legacy: true,
      taskRoot: TASK_DIR,
      enabled: false,
    };
  }

  const fromConfig = sanitizeDeveloperId(collab.developerId);
  if (fromConfig) {
    return {
      developerId: fromConfig,
      source: "config",
      legacy: false,
      taskRoot: path.posix.join(TASK_DIR, fromConfig),
      enabled: true,
    };
  }

  const git =
    options.gitIdentity ||
    (options.skipGit ? { email: null, name: null } : readGitIdentity(cwd));
  const fromEmail = sanitizeDeveloperId(git.email);
  if (fromEmail) {
    return {
      developerId: fromEmail,
      source: "git-email",
      legacy: false,
      taskRoot: path.posix.join(TASK_DIR, fromEmail),
      enabled: true,
    };
  }
  const fromName = sanitizeDeveloperId(git.name);
  if (fromName) {
    return {
      developerId: fromName,
      source: "git-name",
      legacy: false,
      taskRoot: path.posix.join(TASK_DIR, fromName),
      enabled: true,
    };
  }

  return {
    developerId: null,
    source: "legacy",
    legacy: true,
    taskRoot: TASK_DIR,
    enabled: true,
  };
}

/**
 * @param {string|null|undefined} developerId
 * @returns {string} posix 风格相对路径，如 `.task` 或 `.task/alice`
 */
function taskRootFor(developerId) {
  const id = sanitizeDeveloperId(developerId);
  if (!id) return TASK_DIR;
  return path.posix.join(TASK_DIR, id);
}

function todoJsonPath(taskRoot) {
  return path.posix.join(taskRoot || TASK_DIR, "todo.json");
}

function activeTaskDir(taskRoot, taskName) {
  return path.posix.join(taskRoot || TASK_DIR, "active", taskName);
}

function completedTaskDir(taskRoot, taskName, yyyymmdd) {
  const date = yyyymmdd || "YYYYMMDD";
  return path.posix.join(
    taskRoot || TASK_DIR,
    "completed",
    `${date}-${taskName}`,
  );
}

module.exports = {
  TASK_DIR,
  sanitizeDeveloperId,
  readGitIdentity,
  resolveDeveloperContext,
  taskRootFor,
  todoJsonPath,
  activeTaskDir,
  completedTaskDir,
};
