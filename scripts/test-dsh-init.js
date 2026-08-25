const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runInit = require("../packages/core/lib/init");

(async () => {
  for (const locale of ["zh-CN", "en-US"]) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `flow2spec-dsh-${locale}-`));
    try {
      const result = await runInit(tmpRoot, ["dsh"], {
        configValues: { locale },
      });

      assert.deepStrictEqual(result.ids, ["dsh"]);
      assert(fs.existsSync(path.join(tmpRoot, ".dsh", "skills", "f2s-kb-feat", "SKILL.md")));
      assert(fs.existsSync(path.join(tmpRoot, ".dsh", "topics", "f2s-task.md")));
      assert(fs.existsSync(path.join(tmpRoot, ".dsh", "AGENTS.md")));
      assert(fs.existsSync(path.join(tmpRoot, "AGENTS.md")));
      assert(fs.existsSync(path.join(tmpRoot, ".Knowledge", "topics", "flow2spec-dsh-adapter.md")));
      assert(fs.existsSync(path.join(tmpRoot, ".Knowledge", "matchers", "m-flow2spec-dsh-adapter.json")));

      const entry = fs.readFileSync(path.join(tmpRoot, "AGENTS.md"), "utf8");
      assert(entry.includes(locale === "zh-CN" ? "DeepSeek Harness" : "DeepSeek Harness"));
      assert(entry.includes(locale === "zh-CN" ? ".dsh/skills" : ".dsh/skills"));

      await runInit(tmpRoot, ["dsh"], { configValues: { locale } });
      assert(fs.existsSync(path.join(tmpRoot, ".dsh", "skills", "f2s-kb-feat", "SKILL.md")));

      const preservedRoot = path.join(tmpRoot, "AGENTS.md");
      fs.writeFileSync(preservedRoot, "# user-owned entry\n", "utf8");
      await runInit(tmpRoot, ["dsh"], { configValues: { locale } });
      assert.strictEqual(fs.readFileSync(preservedRoot, "utf8"), "# user-owned entry\n");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }

  console.log("dsh init tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
