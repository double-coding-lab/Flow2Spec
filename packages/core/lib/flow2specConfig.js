const path = require("path");
const fs = require("fs");

const CONFIG_FILENAME = "flow2spec.config.json";
const DEFAULT_LOCALE = "zh-CN";
const SUPPORTED_LOCALES = ["zh-CN", "en-US"];

const DEFAULTS = {
  locale: DEFAULT_LOCALE,
  subAgent: true,
  // switchAgentVerification：false=落盘侧同会话内验；true+技能绑定=交叉验（子落盘主验/主落盘子验）
  switchAgentVerification: true,
  intentRecognition: true,
  changeTracking: {
    feat: true,
    fix: false,
    implement: true,
  },
  updateCheck: {
    enabled: true,
  },
  // 多人协作：进度按 developerId 隔离到 .task/<id>/；缺省 enabled
  // developerId 解析：config → git → legacy 单根 .task/（见 lib/developerId.js）
  collaboration: {
    enabled: true,
    developerId: "",
  },
};

/**
 * 所有已知配置字段描述，供 init 交互提示使用。
 * 新增字段在此追加，cli.js 会自动对缺失字段发起提问。
 * 支持点号分隔的嵌套键，如 "changeTracking.feat"（对应 { changeTracking: { feat: ... } }）。
 */
const CONFIG_FIELDS = [
  {
    key: "locale",
    type: "locale",
    default: DEFAULT_LOCALE,
    question: "选择 Flow2Spec 模板语言",
  },
  {
    key: "subAgent",
    type: "boolean",
    default: true,
    question: "启用子 Agent 并行执行？（默认 Y，开启后小型任务仍可由主 agent 一气完成）",
  },
  {
    key: "switchAgentVerification",
    type: "boolean",
    default: true,
    question: "启用交叉验证（子 agent 落盘 → 主 agent 验；需配合技能使用，默认 Y）",
  },
  {
    key: "intentRecognition",
    type: "boolean",
    default: true,
    question: "启用意图识别自动分流（高置信操作意图自动进入对应 f2s-* 技能，默认 Y）？",
  },
  {
    key: "changeTracking.feat",
    type: "boolean",
    default: true,
    question: "启用变更追踪 - f2s-kb-feat（新增能力时创建可续作的任务清单）？",
  },
  {
    key: "changeTracking.fix",
    type: "boolean",
    default: false,
    question: "启用变更追踪 - f2s-kb-fix（修正能力时创建可续作的任务清单）？",
  },
  {
    key: "changeTracking.implement",
    type: "boolean",
    default: true,
    question: "启用变更追踪 - f2s-implement-tech-design（实现技术方案时创建可续作的任务清单）？",
  },
  {
    key: "updateCheck.enabled",
    type: "boolean",
    default: true,
    question: "启用每日版本更新提示（每天第一次 Agent 对话时检查是否有新版 flow2spec）？",
  },
  {
    key: "collaboration.enabled",
    type: "boolean",
    default: true,
    question:
      "启用多人协作进度隔离（.task/<developerId>/；关闭则始终用单人 .task/ 根路径）？",
  },
];

function normalizeBool(value, fallback) {
  if (value === true || value === "true" || value === 1 || value === "1")
    return true;
  if (value === false || value === "false" || value === 0 || value === "0")
    return false;
  return fallback;
}

function normalizeLocale(value, fallback = DEFAULT_LOCALE) {
  const raw = String(value || "").trim();
  return SUPPORTED_LOCALES.includes(raw) ? raw : fallback;
}

/**
 * 读取点号分隔键对应的嵌套值，如 "changeTracking.feat" → raw.changeTracking?.feat
 */
function getNestedValue(obj, dottedKey) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * 读取项目根 flow2spec.config.json，与 DEFAULTS 合并。
 * 文件不存在时返回默认副本（不自动创建文件）。
 * changeTracking 兼容旧版布尔值（true/false → 全部子项同值）。
 */
function loadFlow2specConfig(cwd) {
  const abs = path.join(cwd, CONFIG_FILENAME);
  const out = {
    ...DEFAULTS,
    changeTracking: { ...DEFAULTS.changeTracking },
    updateCheck: { ...DEFAULTS.updateCheck },
    collaboration: { ...DEFAULTS.collaboration },
  };
  if (!fs.existsSync(abs)) {
    return out;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    throw new Error(
      `${CONFIG_FILENAME} JSON 解析失败：${e.message || String(e)}`,
    );
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return out;
  }
  if (Object.prototype.hasOwnProperty.call(raw, "locale")) {
    out.locale = normalizeLocale(raw.locale, DEFAULTS.locale);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "subAgent")) {
    out.subAgent = normalizeBool(raw.subAgent, DEFAULTS.subAgent);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "switchAgentVerification")) {
    out.switchAgentVerification = normalizeBool(
      raw.switchAgentVerification,
      DEFAULTS.switchAgentVerification,
    );
  } else if (Object.prototype.hasOwnProperty.call(raw, "subAgentVerification")) {
    // 旧键名，仍读取；新落盘请用 switchAgentVerification
    out.switchAgentVerification = normalizeBool(
      raw.subAgentVerification,
      DEFAULTS.switchAgentVerification,
    );
  }
  if (Object.prototype.hasOwnProperty.call(raw, "intentRecognition")) {
    out.intentRecognition = normalizeBool(
      raw.intentRecognition,
      DEFAULTS.intentRecognition,
    );
  }
  if (Object.prototype.hasOwnProperty.call(raw, "changeTracking")) {
    const ct = raw.changeTracking;
    if (typeof ct === "boolean") {
      // 旧版布尔值：统一应用到全部子项
      out.changeTracking = { feat: ct, fix: ct, implement: ct };
    } else if (ct && typeof ct === "object" && !Array.isArray(ct)) {
      out.changeTracking = {
        feat: normalizeBool(ct.feat, DEFAULTS.changeTracking.feat),
        fix: normalizeBool(ct.fix, DEFAULTS.changeTracking.fix),
        implement: normalizeBool(ct.implement, DEFAULTS.changeTracking.implement),
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(raw, "updateCheck")) {
    const uc = raw.updateCheck;
    if (uc && typeof uc === "object" && !Array.isArray(uc)) {
      out.updateCheck = {
        enabled: normalizeBool(uc.enabled, DEFAULTS.updateCheck.enabled),
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(raw, "collaboration")) {
    const collab = raw.collaboration;
    if (collab && typeof collab === "object" && !Array.isArray(collab)) {
      const idRaw =
        collab.developerId == null ? "" : String(collab.developerId).trim();
      out.collaboration = {
        enabled: normalizeBool(collab.enabled, DEFAULTS.collaboration.enabled),
        developerId: idRaw,
      };
    }
  }
  return out;
}

/**
 * 返回配置文件中尚未存在的字段列表（用于 init 时只提示新增字段）。
 * 文件不存在时返回全部字段。支持点号嵌套键。
 */
function getMissingConfigFields(cwd) {
  const abs = path.join(cwd, CONFIG_FILENAME);
  if (!fs.existsSync(abs)) return CONFIG_FIELDS;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return [];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return CONFIG_FIELDS;
  return CONFIG_FIELDS.filter((f) => {
    const parts = f.key.split(".");
    if (parts.length === 2) {
      const parent = raw[parts[0]];
      // 旧版布尔值视为已配置，不再重复询问
      if (typeof parent === "boolean") return false;
      return !parent || !Object.prototype.hasOwnProperty.call(parent, parts[1]);
    }
    return !Object.prototype.hasOwnProperty.call(raw, f.key);
  });
}

/**
 * 将点号嵌套键的 values 对象合并入 target，支持一层嵌套。
 * 例如 { "changeTracking.feat": true } → target.changeTracking.feat = true
 */
function mergeValues(target, values) {
  const result = { ...target };
  for (const [key, val] of Object.entries(values)) {
    const parts = key.split(".");
    if (parts.length === 2) {
      result[parts[0]] = {
        ...(result[parts[0]] && typeof result[parts[0]] === "object"
          ? result[parts[0]]
          : {}),
        [parts[1]]: val,
      };
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * 若项目根不存在配置文件，则写入配置（优先用 values，其次包模板，再次 DEFAULTS）。
 * 已存在时：若 values 中有缺失字段，则补写这些字段；否则不覆盖。
 * @param {object} [options.values]  用户交互收集到的字段值，优先级高于模板文件
 */
function ensureFlow2specProjectConfig(cwd, templatesDir, options = {}) {
  const { overwrite = false, values } = options;
  const dest = path.join(cwd, CONFIG_FILENAME);
  const src = path.join(templatesDir, CONFIG_FILENAME);

  if (fs.existsSync(dest) && !overwrite) {
    if (values && typeof values === "object" && Object.keys(values).length > 0) {
      let existing;
      try {
        existing = JSON.parse(fs.readFileSync(dest, "utf8"));
      } catch {
        existing = {};
      }
      const merged = mergeValues(existing, values);
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        fs.writeFileSync(dest, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
        return { created: false, updated: true, path: dest };
      }
    }
    return { created: false, path: dest };
  }

  let base;
  if (fs.existsSync(src)) {
    try {
      base = JSON.parse(fs.readFileSync(src, "utf8"));
    } catch {
      base = {
        ...DEFAULTS,
        locale: DEFAULTS.locale,
        changeTracking: { ...DEFAULTS.changeTracking },
        updateCheck: { ...DEFAULTS.updateCheck },
        collaboration: { ...DEFAULTS.collaboration },
      };
    }
  } else {
    base = {
      ...DEFAULTS,
      locale: DEFAULTS.locale,
      changeTracking: { ...DEFAULTS.changeTracking },
      updateCheck: { ...DEFAULTS.updateCheck },
      collaboration: { ...DEFAULTS.collaboration },
    };
  }
  const merged = values && typeof values === "object" ? mergeValues(base, values) : base;
  fs.writeFileSync(dest, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { created: true, path: dest };
}

module.exports = {
  CONFIG_FILENAME,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  DEFAULTS,
  CONFIG_FIELDS,
  normalizeLocale,
  loadFlow2specConfig,
  getMissingConfigFields,
  ensureFlow2specProjectConfig,
};
