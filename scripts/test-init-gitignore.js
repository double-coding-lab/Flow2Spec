const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const runInit = require("../packages/core/lib/init");
const corePkg = require("../packages/core/package.json");

(async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-init-"));
  try {
    const gitignorePath = path.join(tmpRoot, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n", "utf8");

    const first = await runInit(tmpRoot, ["cursor", "claude", "codex"], {
      configValues: {
        locale: "zh-CN",
      },
    });
    assert.strictEqual(first.gitignoreResult.changed, true);
    assert.strictEqual(first.gitignoreResult.mode, "sync");
    assert.deepStrictEqual(first.gitignoreResult.added, [
      ".task/completed/",
      ".task/*/completed/",
      ".Knowledge/update-check.json",
    ]);

    const afterFirst = fs.readFileSync(gitignorePath, "utf8");
    assert(afterFirst.includes("node_modules/"));
    assert(afterFirst.includes("# Flow2Spec local state"));
    assert(afterFirst.includes(".task/completed/"));
    assert(afterFirst.includes(".task/*/completed/"));
    assert(afterFirst.includes(".Knowledge/update-check.json"));
    for (const agentRoot of [".cursor", ".claude", ".codex"]) {
      const hook = fs.readFileSync(
        path.join(tmpRoot, agentRoot, "hooks", "f2s-update-check.js"),
        "utf8",
      );
      assert(hook.includes(`const GENERATED_CORE_VERSION = '${corePkg.version}';`));
      assert(hook.includes(`const GENERATED_TEMPLATE_VERSION = '${corePkg.templateVersion}';`));
      assert(!hook.includes("__FLOW2SPEC_PACKAGE_NAME__"));
      assert(!hook.includes("__FLOW2SPEC_CORE_VERSION__"));
      assert(!hook.includes("__FLOW2SPEC_TEMPLATE_VERSION__"));
    }

    const second = await runInit(tmpRoot, ["cursor"], {
      configValues: {
        locale: "zh-CN",
      },
    });
    assert.strictEqual(second.gitignoreResult.changed, false);
    const afterSecond = fs.readFileSync(gitignorePath, "utf8");
    assert.strictEqual(
      afterSecond.split(".task/completed/").length - 1,
      1,
      "completed ignore should not be duplicated",
    );
    assert.strictEqual(
      afterSecond.split(".Knowledge/update-check.json").length - 1,
      1,
      ".Knowledge/update-check.json should not be duplicated",
    );

    spawnSync("git", ["init", "--quiet", tmpRoot]);
    const taskPaths = [
      [".task/todo.json", false],
      [".task/active/example/task.md", false],
      [".task/alice/todo.json", false],
      [".task/alice/active/example/task.md", false],
      [".task/completed/example/task.md", true],
      [".task/alice/completed/example/task.md", true],
      [".Knowledge/update-check.json", true],
    ];
    const checkIgnores = (paths = taskPaths) => {
      for (const [file, ignored] of paths) {
        const result = spawnSync("git", ["check-ignore", "--no-index", "-q", file], { cwd: tmpRoot });
        assert.strictEqual(result.status, ignored ? 0 : 1, file);
      }
    };
    checkIgnores();

    // Migrate old blanket rules, including when all narrow rules already exist.
    for (const blanket of [".task/", "/.task/", ".task", "/.task"]) {
      for (const base of ["node_modules/\n", afterSecond]) {
        fs.writeFileSync(gitignorePath, `${base}${blanket}\n`);
        const migrated = await runInit(tmpRoot, ["cursor"], { configValues: { locale: "zh-CN" } });
        assert.strictEqual(migrated.gitignoreResult.changed, true);
        assert(fs.readFileSync(gitignorePath, "utf8").includes("node_modules/"));
        checkIgnores();
        const stable = await runInit(tmpRoot, ["cursor"], { configValues: { locale: "zh-CN" } });
        assert.strictEqual(stable.gitignoreResult.changed, false);
      }
    }

    // Switch to local-only mode: the whole .task/ stays ignored.
    fs.writeFileSync(gitignorePath, afterFirst, "utf8");
    const local = await runInit(tmpRoot, ["cursor"], {
      configValues: { locale: "zh-CN", "collaboration.syncActiveTasks": false },
    });
    assert.strictEqual(local.gitignoreResult.changed, true);
    assert.strictEqual(local.gitignoreResult.mode, "local");
    assert(local.gitignoreResult.added.includes(".task/"));
    assert(local.gitignoreResult.removed.includes(".task/completed/"));
    assert(local.gitignoreResult.removed.includes(".task/*/completed/"));
    const afterLocal = fs.readFileSync(gitignorePath, "utf8");
    assert(afterLocal.includes(".task/"));
    assert(!afterLocal.includes(".task/completed/"));
    const localPaths = taskPaths.map(([file]) => [file, true]);
    checkIgnores(localPaths);
    const stableLocal = await runInit(tmpRoot, ["cursor"], {
      configValues: { locale: "zh-CN", "collaboration.syncActiveTasks": false },
    });
    assert.strictEqual(stableLocal.gitignoreResult.changed, false);

    // Switch back to sync mode: narrow rules return, blanket rule is removed.
    const backToSync = await runInit(tmpRoot, ["cursor"], {
      configValues: { locale: "zh-CN", "collaboration.syncActiveTasks": true },
    });
    assert.strictEqual(backToSync.gitignoreResult.mode, "sync");
    assert(backToSync.gitignoreResult.removed.includes(".task/"));
    checkIgnores();

    console.log("init gitignore tests passed");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
