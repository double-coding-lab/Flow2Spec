"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  checkWorkspaceVersion,
  normalizeCoreRange,
  satisfiesCoreRange,
  compareVersions,
  normalizeVersion,
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
for (const invalid of ["3.5.0", ">3.5.0", "~3.5.0", "*", "^3.5", "^3.05.0"]) {
  assert.throws(() => normalizeCoreRange(invalid), /caret compatibility range/);
}
for (const [version, range, expected] of [
  ["3.5.0", "^3.5.0", true],
  ["3.9.9", "^3.5.0", true],
  ["4.0.0", "^3.5.0", false],
  ["3.4.9", "^3.5.0", false],
  ["3.6.0-beta.1", "^3.5.0", false],
  ["4.0.0-beta.1", "^3.5.0", false],
  ["3.5.0-beta.2", "^3.5.0-beta.1", true],
  ["3.5.0", "^3.5.0-beta.1", true],
  ["3.5.1-beta.1", "^3.5.0-beta.1", false],
  ["3.5.0-beta.1", "^3.5.0-beta.2", false],
  ["3.5.0+build.4", "^3.5.0+build.1", true],
  ["0.2.9", "^0.2.3", true],
  ["0.3.0", "^0.2.3", false],
  ["0.2.2", "^0.2.3", false],
  ["0.0.3", "^0.0.3", true],
  ["0.0.4", "^0.0.3", false],
  ["0.0.3-beta.2", "^0.0.3-beta.1", true],
  ["0.0.4-beta.1", "^0.0.3-beta.1", false],
]) assert.strictEqual(satisfiesCoreRange(version, range), expected, `${version} satisfies ${range}`);
assert(compareVersions("1.0.0-beta.10", "1.0.0-beta.2") > 0);
assert(compareVersions("1.0.0-1", "1.0.0-alpha") < 0);
assert(compareVersions("1.0.0-alpha", "1.0.0-alpha.1") < 0);
assert(compareVersions("1.0.0-B", "1.0.0-a") < 0);

// Normalize the copied fixture explicitly; tests do not depend on the live dependency floor.
setCliVersion("3.5.0", { rootDir: tempRoot, coreRange: "^3.0.0" });
setCoreVersion("3.5.0", { rootDir: tempRoot });
setCliVersion("3.5.0", { rootDir: tempRoot, coreRange: "^3.5.0" });

setCoreVersion("3.6.0", { rootDir: tempRoot });
setCliVersion("3.5.1", { rootDir: tempRoot });
setTemplateVersion("3.5.2", { rootDir: tempRoot });
assert.deepStrictEqual(checkWorkspaceVersion({ rootDir: tempRoot, tag: "core-v3.6.0" }), {
  cliVersion: "3.5.1",
  coreVersion: "3.6.0",
  templateVersion: "3.5.2",
  coreRange: "^3.5.0",
  protocolVersion: 2,
});
assert.deepStrictEqual(checkWorkspaceVersion({ rootDir: tempRoot, tag: "cli-v3.5.1" }), {
  cliVersion: "3.5.1",
  coreVersion: "3.6.0",
  templateVersion: "3.5.2",
  coreRange: "^3.5.0",
  protocolVersion: 2,
});
assert.throws(() => checkWorkspaceVersion({ rootDir: tempRoot, tag: "v3.6.0" }), /release tag must match/);
const mutablePaths = ["packages/core/package.json", "packages/cli/package.json", "package-lock.json"];
const snapshot = () => mutablePaths.map((file) => fs.readFileSync(path.join(tempRoot, file), "utf8"));
const beforeRejectedUpdates = snapshot();
for (const incompatible of ["4.0.0", "3.4.9", "3.7.0-beta.1"]) {
  assert.throws(() => setCoreVersion(incompatible, { rootDir: tempRoot }), /does not satisfy CLI dependency/);
  assert.deepStrictEqual(snapshot(), beforeRejectedUpdates, "incompatible Core must fail before writes");
}
assert.throws(() => setCliVersion("3.5.2", { rootDir: tempRoot, coreRange: "^4.0.0" }), /does not satisfy CLI dependency/);
assert.deepStrictEqual(snapshot(), beforeRejectedUpdates, "incompatible range must fail before writes");
assert.deepStrictEqual(setCoreVersion("3.6.1", { rootDir: tempRoot }), { coreVersion: "3.6.1", coreRange: "^3.5.0" });
assert.strictEqual(fs.readFileSync(path.join(tempRoot, "packages/cli/package.json"), "utf8"), beforeRejectedUpdates[1]);
setCoreVersion("3.6.0", { rootDir: tempRoot });

const corePackage = require(path.join(tempRoot, "packages/core/package.json"));
const cliPackage = require(path.join(tempRoot, "packages/cli/package.json"));
const lockfile = require(path.join(tempRoot, "package-lock.json"));
assert.strictEqual(corePackage.version, "3.6.0");
assert.strictEqual(corePackage.templateVersion, "3.5.2");
assert.strictEqual(cliPackage.version, "3.5.1");
assert.strictEqual(cliPackage.dependencies["@double-coding/flow2spec-core"], "^3.5.0");
assert.strictEqual(lockfile.packages["packages/core"].version, "3.6.0");
assert.strictEqual(lockfile.packages["packages/cli"].version, "3.5.1");
assert.strictEqual(lockfile.packages["packages/cli"].dependencies["@double-coding/flow2spec-core"], "^3.5.0");

assert.throws(() => checkWorkspaceVersion({ rootDir: tempRoot, tag: "core-v3.6.1" }), /release tag version/);
lockfile.packages["packages/cli"].dependencies["@double-coding/flow2spec-core"] = "^3.4.0";
fs.writeFileSync(path.join(tempRoot, "package-lock.json"), JSON.stringify(lockfile));
assert.throws(() => checkWorkspaceVersion({ rootDir: tempRoot }), /package-lock.json CLI dependency/);
lockfile.packages["packages/cli"].dependencies["@double-coding/flow2spec-core"] = "^3.5.0";
fs.writeFileSync(path.join(tempRoot, "package-lock.json"), JSON.stringify(lockfile));
for (const locale of ["zh-CN", "en-US"]) {
  const manifestPath = path.join(tempRoot, "packages/core/templates", locale, "knowledge/manifest-routing.json");
  const original = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(original);
  manifest.version = "0.0.1";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => checkWorkspaceVersion({ rootDir: tempRoot }), /manifest-routing.json version/);
  fs.writeFileSync(manifestPath, original);
}
checkWorkspaceVersion({ rootDir: tempRoot });
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("test-workspace-version: ok");
