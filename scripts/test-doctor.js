const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  runDoctor,
  formatDoctorReport,
  satisfiesNodeEngine,
} = require("../packages/core/lib/doctor");

function write(file, content = "") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function createHealthyProject(root) {
  write(
    path.join(root, "flow2spec.config.json"),
    `${JSON.stringify({ collaboration: { enabled: true, developerId: "alice" } })}\n`,
  );
  write(path.join(root, "AGENTS.md"), "# Project\n");
  write(path.join(root, ".Knowledge", "manifest-routing.json"), "{}\n");
  write(path.join(root, ".codex", "AGENTS.md"), "See ../AGENTS.md\n");
  write(path.join(root, ".codex", "hooks.json"), "{}\n");
  write(path.join(root, ".gitignore"), "node_modules/\n.task/\n");
}

const passKnowledge = () => ({
  id: "knowledge",
  label: "知识库",
  status: "pass",
  message: "fixture healthy",
  repair: null,
});

assert.strictEqual(satisfiesNodeEngine("v16.0.0", ">=16"), true);
assert.strictEqual(satisfiesNodeEngine("v15.9.0", ">=16"), false);
assert.strictEqual(satisfiesNodeEngine("v20.11.1", ">=16"), true);

const healthyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-doctor-ok-"));
const warningRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-doctor-warn-"));
const errorRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-doctor-error-"));

try {
  createHealthyProject(healthyRoot);
  const healthy = runDoctor(healthyRoot, {
    nodeVersion: "v20.11.1",
    gitIdentity: { email: null, name: null },
    knowledgeCheck: passKnowledge,
  });
  assert.strictEqual(healthy.ok, true);
  assert.strictEqual(healthy.summary.errors, 0);
  assert.strictEqual(healthy.summary.warnings, 0);
  assert.match(formatDoctorReport(healthy), /\[PASS\] Node\.js/);
  assert.match(formatDoctorReport(healthy), /developerId=alice/);

  write(
    path.join(warningRoot, "flow2spec.config.json"),
    `${JSON.stringify({ collaboration: { enabled: true, developerId: "" } })}\n`,
  );
  write(path.join(warningRoot, "AGENTS.md"), "# Project\n");
  write(path.join(warningRoot, ".Knowledge", "manifest-routing.json"), "{}\n");
  const warning = runDoctor(warningRoot, {
    nodeVersion: "v20.11.1",
    gitIdentity: { email: null, name: null },
    knowledgeCheck: passKnowledge,
  });
  assert.strictEqual(warning.ok, true, "warnings must not block doctor");
  assert.ok(warning.summary.warnings >= 2, "missing agent roots and legacy context warn");

  write(path.join(errorRoot, "flow2spec.config.json"), "{ invalid json\n");
  const failed = runDoctor(errorRoot, {
    nodeVersion: "v14.0.0",
    knowledgeCheck: () => ({
      id: "knowledge",
      label: "知识库",
      status: "error",
      message: "fixture broken",
      repair: "repair fixture",
    }),
  });
  assert.strictEqual(failed.ok, false);
  assert.ok(failed.summary.errors >= 4);
  assert.ok(failed.checks.some((check) => check.id === "runtime" && check.status === "error"));

  const cliPath = path.resolve(__dirname, "..", "cli.js");
  const unknownFlag = spawnSync(process.execPath, [cliPath, "doctor", "--fix"], {
    cwd: healthyRoot,
    encoding: "utf8",
  });
  assert.strictEqual(unknownFlag.status, 1);
  assert.match(unknownFlag.stderr, /doctor 不支持参数/);

  const help = spawnSync(process.execPath, [cliPath, "doctor", "--help"], {
    cwd: healthyRoot,
    encoding: "utf8",
  });
  assert.strictEqual(help.status, 0);
  assert.match(help.stdout, /不会修改文件或访问网络/);

  console.log("doctor tests passed");
} finally {
  fs.rmSync(healthyRoot, { recursive: true, force: true });
  fs.rmSync(warningRoot, { recursive: true, force: true });
  fs.rmSync(errorRoot, { recursive: true, force: true });
}
