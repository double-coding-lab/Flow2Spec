const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runInit = require("../lib/init");

(async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-init-"));
  try {
    const gitignorePath = path.join(tmpRoot, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n", "utf8");

    const first = await runInit(tmpRoot, ["cursor"], {
      configValues: {
        locale: "zh-CN",
      },
    });
    assert.strictEqual(first.gitignoreResult.changed, true);
    assert.deepStrictEqual(first.gitignoreResult.added, [
      ".task/",
      ".Knowledge/update-check.json",
    ]);

    const afterFirst = fs.readFileSync(gitignorePath, "utf8");
    assert(afterFirst.includes("node_modules/"));
    assert(afterFirst.includes("# Flow2Spec local state"));
    assert(afterFirst.includes(".task/"));
    assert(afterFirst.includes(".Knowledge/update-check.json"));

    const second = await runInit(tmpRoot, ["cursor"], {
      configValues: {
        locale: "zh-CN",
      },
    });
    assert.strictEqual(second.gitignoreResult.changed, false);
    const afterSecond = fs.readFileSync(gitignorePath, "utf8");
    assert.strictEqual(
      afterSecond.split(".task/").length - 1,
      1,
      ".task/ should not be duplicated",
    );
    assert.strictEqual(
      afterSecond.split(".Knowledge/update-check.json").length - 1,
      1,
      ".Knowledge/update-check.json should not be duplicated",
    );

    console.log("init gitignore tests passed");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
