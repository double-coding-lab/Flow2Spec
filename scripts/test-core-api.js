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
  assert.strictEqual(core.getCapabilities().protocolVersion, 2);
  assert.deepStrictEqual(
    core
      .getCapabilities()
      .capabilities.filter((capability) => capability.since === "3.4.0")
      .map((capability) => capability.id),
    ["resources.skill-catalog", "resources.unified-entry", "update.check"],
  );

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
  const catalog = api.resources.skillCatalog({ host: "dsh", locale: "zh-CN" });
  assert.strictEqual(catalog.length, api.resources.listSkills().length);
  assert.ok(catalog.every((skill) => skill.name.startsWith("f2s-")));
  assert.ok(catalog.some((skill) => skill.name === "f2s-kb-add-rules"));
  assert.ok(catalog.every((skill) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)));
  assert.ok(catalog.every((skill) => skill.description && skill.content));
  assert.ok(catalog.every((skill) => skill.relativePath === `skills/${skill.name}/SKILL.md`));
  assert.ok(catalog.every((skill) => skill.resources.length >= 2));
  const dshResources = [
    ...catalog.map((skill) => skill.content),
    ...catalog.flatMap((skill) => skill.resources.map((resource) => resource.content)),
  ].join("\n");
  for (const foreignRoot of [".codex/", ".cursor/", ".claude/", ".dsh/"]) {
    assert.ok(!dshResources.includes(foreignRoot), `native DSH resource leaked ${foreignRoot}`);
  }

  const entry = api.resources.unifiedEntry({
    host: "dsh",
    locale: "zh-CN",
    projectConfig: { subAgent: false, locale: "zh-CN" },
  });
  assert.ok(entry.includes("\"subAgent\": false"));
  assert.ok(entry.includes("update.check()"));
  assert.ok(!entry.includes(".codex/"));
  assert.throws(
    () => api.resources.skillCatalog({ host: "unknown", locale: "zh-CN" }),
    (error) => error instanceof core.Flow2SpecError && error.code === "F2S_INVALID_ARGUMENT",
  );

  const manifestPath = path.join(tempDir, ".Knowledge", "manifest-routing.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = "1.0.0";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const cachePath = path.join(tempDir, ".Knowledge", "update-check.json");
  fs.writeFileSync(
    cachePath,
    `${JSON.stringify({
      latestNpm: "9.0.0",
      manifestVersion: "1.0.0",
      needsUpgrade: true,
      checkedAt: Date.now(),
    })}\n`,
    "utf8",
  );
  const originalCI = process.env.CI;
  const originalContinuousIntegration = process.env.CONTINUOUS_INTEGRATION;
  process.env.CI = "true";
  const ciUpdate = await api.update.check();
  assert.strictEqual(ciUpdate.status, "skipped");
  assert.strictEqual(ciUpdate.reason, "continuous-integration");

  delete process.env.CI;
  delete process.env.CONTINUOUS_INTEGRATION;
  try {
    const update = await api.update.check();
    assert.strictEqual(update.status, "upgrade-available");
    assert.strictEqual(update.fromCache, true);
    assert.strictEqual(update.latestVersion, "9.0.0");
    assert.ok(update.notice.includes("f2s-kb-upgrade"));
  } finally {
    if (originalCI === undefined) delete process.env.CI;
    else process.env.CI = originalCI;
    if (originalContinuousIntegration === undefined) delete process.env.CONTINUOUS_INTEGRATION;
    else process.env.CONTINUOUS_INTEGRATION = originalContinuousIntegration;
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.update.check({ signal: controller.signal }),
    (error) => error instanceof core.Flow2SpecError && error.code === "F2S_ABORTED",
  );
  assert.ok(Array.isArray(events));

  console.log("test-core-api: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
