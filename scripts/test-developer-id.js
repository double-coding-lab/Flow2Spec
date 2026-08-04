const assert = require("assert");

const {
  sanitizeDeveloperId,
  hashDeveloperId,
  resolveDeveloperContext,
  taskRootFor,
  HASH_FALLBACK_PREFIX,
} = require("../lib/developerId");

// ---------- sanitizeDeveloperId ----------
assert.strictEqual(sanitizeDeveloperId("Alice"), "alice");
assert.strictEqual(sanitizeDeveloperId("alice@example.com"), "alice");
assert.strictEqual(sanitizeDeveloperId("Alice Doe"), "alice-doe");
assert.strictEqual(sanitizeDeveloperId("  --Alice--  "), "alice");
assert.strictEqual(sanitizeDeveloperId(""), null);
assert.strictEqual(sanitizeDeveloperId("中文用户"), null);
assert.strictEqual(sanitizeDeveloperId("中文@example.com"), null);
assert.strictEqual(sanitizeDeveloperId("a".repeat(65)), null);

// ---------- hashDeveloperId ----------
const h1 = hashDeveloperId("中文用户");
const h2 = hashDeveloperId("中文用户");
const h3 = hashDeveloperId("中文用户2");
assert.ok(h1 && h1.startsWith(HASH_FALLBACK_PREFIX), "hash id 需要带前缀");
assert.strictEqual(h1.length, HASH_FALLBACK_PREFIX.length + 8, "hash id 长度固定");
assert.strictEqual(h1, h2, "相同输入应产生稳定 hash");
assert.notStrictEqual(h1, h3, "不同输入应产生不同 hash");
assert.strictEqual(hashDeveloperId(""), null);
assert.strictEqual(hashDeveloperId(null), null);

// ---------- resolveDeveloperContext: collaboration.enabled=false 强制 legacy ----------
const disabled = resolveDeveloperContext(
  {
    collaboration: {
      enabled: false,
      developerId: "alice", // 应被 enabled=false 覆盖
    },
  },
  { gitIdentity: { email: "bob@example.com", name: "Bob" }, skipGit: true },
);
assert.strictEqual(disabled.legacy, true, "enabled=false 必须走 legacy");
assert.strictEqual(disabled.developerId, null);
assert.strictEqual(disabled.taskRoot, ".task");
assert.strictEqual(disabled.enabled, false);
assert.deepStrictEqual(disabled.warnings, []);

// ---------- resolveDeveloperContext: 显式 config id 非法 → 抛错 ----------
assert.throws(
  () =>
    resolveDeveloperContext(
      { collaboration: { enabled: true, developerId: "中文用户" } },
      { skipGit: true },
    ),
  /无法规范化/,
  "显式配置的非法 id 必须报错，不能静默降级",
);

// ---------- resolveDeveloperContext: git email 中文 → hash 兜底 + warning ----------
const zhEmail = resolveDeveloperContext(
  { collaboration: { enabled: true, developerId: "" } },
  { gitIdentity: { email: "中文@example.com", name: "中文用户" }, skipGit: true },
);
assert.strictEqual(zhEmail.source, "git-email-hash");
assert.strictEqual(zhEmail.legacy, false);
assert.ok(zhEmail.developerId.startsWith(HASH_FALLBACK_PREFIX));
assert.ok(zhEmail.taskRoot.startsWith(".task/" + HASH_FALLBACK_PREFIX));
assert.strictEqual(zhEmail.warnings.length, 1);
assert.match(zhEmail.warnings[0], /无法直接规范化/);

// ---------- resolveDeveloperContext: git name 中文（email 缺失） → hash 兜底 ----------
const zhName = resolveDeveloperContext(
  { collaboration: { enabled: true } },
  { gitIdentity: { email: null, name: "中文用户" }, skipGit: true },
);
assert.strictEqual(zhName.source, "git-name-hash");
assert.strictEqual(zhName.legacy, false);
assert.ok(zhName.developerId.startsWith(HASH_FALLBACK_PREFIX));

// ---------- resolveDeveloperContext: 正常 git email 走 config < git-email ----------
const emailOk = resolveDeveloperContext(
  { collaboration: { enabled: true, developerId: "" } },
  { gitIdentity: { email: "alice@example.com", name: null }, skipGit: true },
);
assert.strictEqual(emailOk.source, "git-email");
assert.strictEqual(emailOk.developerId, "alice");
assert.strictEqual(emailOk.taskRoot, ".task/alice");
assert.deepStrictEqual(emailOk.warnings, []);

// ---------- resolveDeveloperContext: 显式 config id > git ----------
const configWins = resolveDeveloperContext(
  { collaboration: { enabled: true, developerId: "override" } },
  { gitIdentity: { email: "alice@example.com", name: "Alice" }, skipGit: true },
);
assert.strictEqual(configWins.source, "config");
assert.strictEqual(configWins.developerId, "override");
assert.strictEqual(configWins.taskRoot, ".task/override");

// ---------- resolveDeveloperContext: 完全无 identity → legacy ----------
const legacy = resolveDeveloperContext(
  { collaboration: { enabled: true } },
  { gitIdentity: { email: null, name: null }, skipGit: true },
);
assert.strictEqual(legacy.legacy, true);
assert.strictEqual(legacy.source, "legacy");
assert.strictEqual(legacy.taskRoot, ".task");
assert.strictEqual(legacy.enabled, true);

// ---------- taskRootFor: 仅拼路径，不检查 enabled ----------
assert.strictEqual(taskRootFor("alice"), ".task/alice");
assert.strictEqual(taskRootFor(null), ".task");
assert.strictEqual(taskRootFor("中文用户"), ".task", "非法 id 回退到 legacy 目录");
// 注意：这里不测试 enabled 行为，因为 taskRootFor 文档已声明「不看 enabled」，
// 需要开关语义的调用方必须走 resolveDeveloperContext。

console.log("developer id tests passed");
