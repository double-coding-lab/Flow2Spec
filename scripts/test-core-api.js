"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("@double-coding/flow2spec-core");

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-core-"));
  const events = [];
  const api = core.createFlow2Spec({
    cwd: tempDir,
    onProgress: (event) => events.push(event),
  });

  assert.strictEqual(typeof api.project.init, "function");
  assert.strictEqual(typeof api.knowledge.check, "function");
  assert.strictEqual(core.getCapabilities().schema, "flow2spec.capabilities.v1");

  await api.project.init({ mode: "native-host", integrations: ["dsh"], locale: "zh-CN" });
  assert.ok(fs.existsSync(path.join(tempDir, ".Knowledge")));
  assert.ok(fs.existsSync(path.join(tempDir, "flow2spec.config.json")));
  assert.ok(!fs.existsSync(path.join(tempDir, ".dsh")));

  const report = api.knowledge.check({ strict: true });
  assert.strictEqual(report.ok, true);
  const route = api.routing.match({ task: "flow2spec-dsh-adapter", request: "DeepSeek Harness" });
  const expanded = api.routing.expand(route);
  assert.ok(expanded.topics.includes("flow2spec-dsh-adapter"));
  assert.strictEqual(api.routing.verify(expanded).ok, true);
  assert.ok(api.resources.listSkills().some((file) => file.endsWith("f2s-kb-sync/SKILL.md")));
  assert.ok(Array.isArray(events));

  console.log("test-core-api: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
