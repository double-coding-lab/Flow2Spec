"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  checkWorkspaceVersion,
  normalizeCoreRange,
  normalizeVersion,
  satisfiesCaret,
  setCliVersion,
  setCoreVersion,
  setTemplateVersion,
} = require("./workspace-version");

const repoRoot = path.resolve(__dirname, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-version-"));

for (const relativePath of [
  "package.json",
  "package-lock.json",
  "packages/core/package.json",
  "packages/core/capabilities.json",
  "packages/core/templates/zh-CN/knowledge/manifest-routing.json",
  "packages/core/templates/en-US/knowledge/manifest-routing.json",
  "packages/cli/package.json",
]) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

assert.strictEqual(normalizeVersion("v4.1.0-beta.2"), "4.1.0-beta.2");
assert.throws(() => normalizeVersion("4.01.0"), /invalid semantic version/);
assert.strictEqual(normalizeCoreRange("^3.5.0"), "^3.5.0");
assert.throws(() => normalizeCoreRange(">3.5.0"), /caret semantic range/);
assert.strictEqual(satisfiesCaret("3.6.0", "^3.5.0"), true);
assert.strictEqual(satisfiesCaret("4.0.0", "^3.5.0"), false);

setCoreVersion("3.6.0", { rootDir: tempRoot });
setCliVersion("3.5.1", { rootDir: tempRoot, coreRange: "^3.6.0" });
setTemplateVersion("3.5.2", { rootDir: tempRoot });
assert.deepStrictEqual(checkWorkspaceVersion({ rootDir: tempRoot, tag: "core-v3.6.0" }), {
  cliVersion: "3.5.1",
  coreVersion: "3.6.0",
  templateVersion: "3.5.2",
  coreRange: "^3.6.0",
  protocolVersion: 2,
});
assert.deepStrictEqual(checkWorkspaceVersion({ rootDir: tempRoot, tag: "cli-v3.5.1" }), {
  cliVersion: "3.5.1",
  coreVersion: "3.6.0",
  templateVersion: "3.5.2",
  coreRange: "^3.6.0",
  protocolVersion: 2,
});
assert.throws(() => checkWorkspaceVersion({ rootDir: tempRoot, tag: "v3.6.0" }), /release tag must match/);
assert.throws(() => setCoreVersion("4.0.0", { rootDir: tempRoot }), /outside the CLI dependency range/);

const corePackage = require(path.join(tempRoot, "packages/core/package.json"));
const cliPackage = require(path.join(tempRoot, "packages/cli/package.json"));
const lockfile = require(path.join(tempRoot, "package-lock.json"));
assert.strictEqual(corePackage.version, "3.6.0");
assert.strictEqual(corePackage.templateVersion, "3.5.2");
assert.strictEqual(cliPackage.version, "3.5.1");
assert.strictEqual(cliPackage.dependencies["@double-coding/flow2spec-core"], "^3.6.0");
assert.strictEqual(lockfile.packages["packages/core"].version, "3.6.0");
assert.strictEqual(lockfile.packages["packages/cli"].version, "3.5.1");

console.log("test-workspace-version: ok");
