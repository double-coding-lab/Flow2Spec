/**
 * flow2spec init 支持的 AI 工具配置目录。
 * 知识库统一写入项目根 `.Knowledge/`（含 template），rules/skills 保留在各配置根。
 */
const AGENTS = {
  cursor: { root: ".cursor", label: "Cursor" },
  claude: { root: ".claude", label: "Claude" },
  codex: { root: ".codex", label: "Codex" },
};

const KNOWLEDGE_ROOT = ".Knowledge";
const KNOWLEDGE_SUBDIRS = ["stock-docs", "req-docs", "matchers"];
const AGENT_SUBDIRS = {
  cursor: ["rules", "skills"],
  claude: ["rules", "skills"],
  // Codex：f2s-rules = Flow2Spec 规则镜像（避开官方 .codex/rules 的 exec-policy）；skills = f2s-* 技能
  codex: ["f2s-rules", "skills"],
}

/**
 * @param {string[]} argv  init 后的参数，如 []、['cursor']、['cursor','claude']
 * @returns {string[]}  去重后的 agent id 列表
 */
function normalizeAgentIds(argv) {
  const list = argv.length ? argv : ["cursor"];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const id = String(raw).toLowerCase().replace(/^--/, "");
    if (!AGENTS[id]) {
      const keys = Object.keys(AGENTS).join(", ");
      throw new Error(`未知 agent：${raw}。可选：${keys}`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

module.exports = {
  AGENTS,
  KNOWLEDGE_ROOT,
  KNOWLEDGE_SUBDIRS,
  AGENT_SUBDIRS,
  normalizeAgentIds,
};
