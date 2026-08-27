const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runInit = require("../packages/core/lib/init");
const { runDoctor } = require("../packages/core/lib/doctor");

const CONFIG_ROOTS = [".cursor", ".claude", ".codex", ".dsh"];

(async () => {
  for (const locale of ["zh-CN", "en-US"]) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `flow2spec-plugin-${locale}-`));
    try {
      const result = await runInit(tmpRoot, ["plugin"], {
        configValues: { locale },
      });

      assert.deepStrictEqual(result.ids, ["plugin"]);
      // 知识库与项目配置照常落盘
      assert(fs.existsSync(path.join(tmpRoot, ".Knowledge", "manifest-routing.json")));
      assert(fs.existsSync(path.join(tmpRoot, ".Knowledge", "template", "index.template.md")));
      assert(fs.existsSync(path.join(tmpRoot, "flow2spec.config.json")));
      // 插件模式不写任何客户端配置根，也不生成根 AGENTS.md
      for (const root of CONFIG_ROOTS) {
        assert(!fs.existsSync(path.join(tmpRoot, root)), `${root} 不应被创建`);
      }
      assert(!fs.existsSync(path.join(tmpRoot, "AGENTS.md")));

      // 幂等：二次 init 不报错、仍不写配置根
      await runInit(tmpRoot, ["plugin"], { configValues: { locale } });
      for (const root of CONFIG_ROOTS) {
        assert(!fs.existsSync(path.join(tmpRoot, root)), `${root} 不应被二次 init 创建`);
      }

      // doctor：插件模式项目不因缺配置根/AGENTS.md 报 error
      const doctorResult = await runDoctor(tmpRoot, {});
      const checks = doctorResult.checks || [];
      const agentsEntry = checks.find((c) => c.id === "agents-entry");
      assert(agentsEntry, "doctor 应包含 agents-entry 检查");
      assert.notStrictEqual(agentsEntry.status, "error", "插件模式缺 AGENTS.md 不应为 error");
      const agentRoots = checks.find((c) => c.id === "agent-roots");
      if (agentRoots) {
        assert.notStrictEqual(agentRoots.status, "error", "插件模式无配置根不应为 error");
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }

  // 混合：plugin 与实体 agent 同时传入时，实体侧照常写入
  const mixedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-plugin-mixed-"));
  try {
    const result = await runInit(mixedRoot, ["plugin", "cursor"], {
      configValues: { locale: "zh-CN" },
    });
    assert.deepStrictEqual(result.ids, ["plugin", "cursor"]);
    assert(fs.existsSync(path.join(mixedRoot, ".cursor", "skills")));
    assert(!fs.existsSync(path.join(mixedRoot, ".codex")));
  } finally {
    fs.rmSync(mixedRoot, { recursive: true, force: true });
  }

  console.log("plugin init tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
