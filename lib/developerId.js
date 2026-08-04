/**
 * 多人协作：developerId 解析与任务根路径。
 *
 * 优先级（已定口径，勿再加 env/local 层）：
 * 1. flow2spec.config.json → collaboration.developerId
 *    - 非空但 sanitize 后为空（如纯中文、纯符号）：抛错，让用户显式修正配置。
 *    - 显式配置视为「用户明确表达了隔离意图」，不做静默降级。
 * 2. git user.email（@ 前）或 user.name，规范化
 *    - 若规范化失败（如纯中文邮箱前缀 / 用户名），走 hash 兜底：
 *      基于原始字符串 sha256 前 8 位生成 `dev-xxxxxxxx`，同时在 warnings 中提示。
 *      这样避免中文用户被静默塞回 legacy 单根。
 * 3. 都没有 → null（调用方使用 legacy `.task/` 根）
 *
 * collaboration.enabled === false 时强制 legacy（返回 null）。
 *
 * 需要「是否隔离 / 是否 legacy」语义的调用方**请用 resolveDeveloperContext**；
 * taskRootFor 只做拼路径，不看 enabled 开关，仅供内部/外部工具在已确定 id 的
 * 情形下拼路径。
 */

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");

const TASK_DIR = ".task";
const HASH_FALLBACK_PREFIX = "dev-";

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
  return s;
}

/**
 * 基于原始字符串生成稳定的 hash 兜底 id，例如 `dev-a1b2c3d4`。
 * 用于 git identity 存在但 sanitize 失败（如纯中文）的情况，
 * 保证隔离仍然按人生效、跨机器一致。
 * @param {string} raw
 * @returns {string|null}
 */
function hashDeveloperId(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digest = crypto.createHash("sha256").update(trimmed).digest("hex");
  return `${HASH_FALLBACK_PREFIX}${digest.slice(0, 8)}`;
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
 * @param {boolean} [options.skipGit]
 * @returns {{
 *   developerId: string|null,
 *   source: 'config'|'git-email'|'git-name'|'git-email-hash'|'git-name-hash'|'legacy',
 *   legacy: boolean,
 *   taskRoot: string,
 *   enabled: boolean,
 *   warnings: string[],
 * }}
 * @throws {Error} 当 collaboration.developerId 非空但 sanitize 后为空时。
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
      warnings: [],
    };
  }

  const warnings = [];

  // 1) 显式 config：非空但非法 → 抛错，防止静默降级
  const rawConfigId =
    typeof collab.developerId === "string" ? collab.developerId.trim() : "";
  if (rawConfigId) {
    const fromConfig = sanitizeDeveloperId(rawConfigId);
    if (!fromConfig) {
      throw new Error(
        `flow2spec.config.json → collaboration.developerId "${rawConfigId}" 无法规范化为 [a-z0-9-]。` +
          `请改用英文/数字标识（如 "alice"），或留空让 Flow2Spec 从 git 身份推断。`,
      );
    }
    return {
      developerId: fromConfig,
      source: "config",
      legacy: false,
      taskRoot: path.posix.join(TASK_DIR, fromConfig),
      enabled: true,
      warnings,
    };
  }

  // 2) git identity：先直接 sanitize，失败则 hash 兜底并 warn
  const git =
    options.gitIdentity ||
    (options.skipGit ? { email: null, name: null } : readGitIdentity(cwd));

  if (git.email) {
    const fromEmail = sanitizeDeveloperId(git.email);
    if (fromEmail) {
      return {
        developerId: fromEmail,
        source: "git-email",
        legacy: false,
        taskRoot: path.posix.join(TASK_DIR, fromEmail),
        enabled: true,
        warnings,
      };
    }
    const hashed = hashDeveloperId(git.email);
    if (hashed) {
      warnings.push(
        `git user.email "${git.email}" 无法直接规范化，已回退到 hash id "${hashed}"。` +
          `建议在 flow2spec.config.json 显式配置 collaboration.developerId 以获得可读的目录名。`,
      );
      return {
        developerId: hashed,
        source: "git-email-hash",
        legacy: false,
        taskRoot: path.posix.join(TASK_DIR, hashed),
        enabled: true,
        warnings,
      };
    }
  }

  if (git.name) {
    const fromName = sanitizeDeveloperId(git.name);
    if (fromName) {
      return {
        developerId: fromName,
        source: "git-name",
        legacy: false,
        taskRoot: path.posix.join(TASK_DIR, fromName),
        enabled: true,
        warnings,
      };
    }
    const hashed = hashDeveloperId(git.name);
    if (hashed) {
      warnings.push(
        `git user.name "${git.name}" 无法直接规范化，已回退到 hash id "${hashed}"。` +
          `建议在 flow2spec.config.json 显式配置 collaboration.developerId 以获得可读的目录名。`,
      );
      return {
        developerId: hashed,
        source: "git-name-hash",
        legacy: false,
        taskRoot: path.posix.join(TASK_DIR, hashed),
        enabled: true,
        warnings,
      };
    }
  }

  return {
    developerId: null,
    source: "legacy",
    legacy: true,
    taskRoot: TASK_DIR,
    enabled: true,
    warnings,
  };
}

/**
 * 仅用于「已确定 id」时的路径拼接。**不检查 collaboration.enabled**；
 * 需要开关语义的调用方请用 resolveDeveloperContext。
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
  HASH_FALLBACK_PREFIX,
  sanitizeDeveloperId,
  hashDeveloperId,
  readGitIdentity,
  resolveDeveloperContext,
  taskRootFor,
  todoJsonPath,
  activeTaskDir,
  completedTaskDir,
};
