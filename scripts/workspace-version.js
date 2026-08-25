#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CORE_PACKAGE = "@double-coding/flow2spec-core";
const SEMVER_SOURCE = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?";
const SEMVER_PATTERN = new RegExp(`^${SEMVER_SOURCE}$`);
const CORE_RANGE_PATTERN = new RegExp(`^\\^(${SEMVER_SOURCE})$`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function workspacePaths(rootDir) {
  return {
    root: path.join(rootDir, "package.json"),
    core: path.join(rootDir, "packages", "core", "package.json"),
    cli: path.join(rootDir, "packages", "cli", "package.json"),
    lock: path.join(rootDir, "package-lock.json"),
    capabilities: path.join(rootDir, "packages", "core", "capabilities.json"),
    templateManifests: [
      path.join(rootDir, "packages", "core", "templates", "zh-CN", "knowledge", "manifest-routing.json"),
      path.join(rootDir, "packages", "core", "templates", "en-US", "knowledge", "manifest-routing.json"),
    ],
  };
}

function loadWorkspace(rootDir) {
  const paths = workspacePaths(rootDir);
  return {
    paths,
    root: readJson(paths.root),
    core: readJson(paths.core),
    cli: readJson(paths.cli),
    lock: readJson(paths.lock),
    capabilities: readJson(paths.capabilities),
    templateManifests: paths.templateManifests.map(readJson),
  };
}

function normalizeVersion(input) {
  const raw = String(input || "").trim();
  const version = raw.startsWith("v") || raw.startsWith("V") ? raw.slice(1) : raw;
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`invalid semantic version: ${raw || "<empty>"}`);
  }
  return version;
}

function parseVersion(input) {
  const version = normalizeVersion(input);
  const [versionAndPrerelease] = version.split("+", 1);
  const separator = versionAndPrerelease.indexOf("-");
  const core = separator === -1 ? versionAndPrerelease : versionAndPrerelease.slice(0, separator);
  return {
    version,
    numbers: core.split(".").map(Number),
    prerelease: separator === -1 ? "" : versionAndPrerelease.slice(separator + 1),
  };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = a.numbers[index] - b.numbers[index];
    if (difference !== 0) return difference;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, "en", { numeric: true });
}

function normalizeCoreRange(input) {
  const raw = String(input || "").trim();
  const match = CORE_RANGE_PATTERN.exec(raw);
  if (!match) throw new Error(`Core dependency must use a caret semantic range, received: ${raw || "<empty>"}`);
  return `^${normalizeVersion(match[1])}`;
}

function satisfiesCaret(versionInput, rangeInput) {
  const version = parseVersion(versionInput);
  const minimum = parseVersion(normalizeCoreRange(rangeInput).slice(1));
  if (compareVersions(version.version, minimum.version) < 0) return false;
  const [major, minor, patch] = minimum.numbers;
  let upper;
  if (major > 0) upper = `${major + 1}.0.0`;
  else if (minor > 0) upper = `0.${minor + 1}.0`;
  else upper = `0.0.${patch + 1}`;
  return compareVersions(version.version, upper) < 0;
}

function collectVersionErrors(workspace, tag) {
  const { root, core, cli, lock, capabilities, templateManifests } = workspace;
  const cliVersion = String(cli.version || "").trim();
  const coreVersion = String(core.version || "").trim();
  const templateVersion = String(core.templateVersion || "").trim();
  const coreRange = String(cli.dependencies?.[CORE_PACKAGE] || "").trim();
  const protocolVersion = capabilities.protocolVersion;
  const errors = [];
  const expect = (actual, wanted, label) => {
    if (actual !== wanted) errors.push(`${label}: expected ${wanted}, received ${actual || "<empty>"}`);
  };

  for (const [label, value] of [
    ["CLI version", cliVersion],
    ["Core version", coreVersion],
    ["Template version", templateVersion],
    ["workspace version", String(root.version || "").trim()],
  ]) {
    try {
      normalizeVersion(value);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  try {
    normalizeCoreRange(coreRange);
    if (!satisfiesCaret(coreVersion, coreRange)) {
      errors.push(`Core ${coreVersion} is outside the CLI dependency range ${coreRange}`);
    }
  } catch (error) {
    errors.push(`packages/cli/package.json dependency ${CORE_PACKAGE}: ${error.message}`);
  }

  if (!Number.isInteger(protocolVersion) || protocolVersion < 1) {
    errors.push(`capabilities.json protocolVersion must be a positive integer, received ${protocolVersion}`);
  }

  expect(String(lock.version || "").trim(), String(root.version || "").trim(), "package-lock.json version");
  expect(String(lock.packages?.[""]?.version || "").trim(), String(root.version || "").trim(), "package-lock.json root version");
  expect(String(lock.packages?.["packages/core"]?.version || "").trim(), coreVersion, "package-lock.json Core version");
  expect(String(lock.packages?.["packages/cli"]?.version || "").trim(), cliVersion, "package-lock.json CLI version");
  expect(String(lock.packages?.["packages/cli"]?.dependencies?.[CORE_PACKAGE] || "").trim(), coreRange, `package-lock.json CLI dependency ${CORE_PACKAGE}`);
  if (lock.packages?.[""]?.dependencies?.[CORE_PACKAGE]) errors.push(`package-lock.json root must not depend on ${CORE_PACKAGE}`);
  if (root.dependencies?.[CORE_PACKAGE]) errors.push(`package.json root must not depend on ${CORE_PACKAGE}`);

  templateManifests.forEach((manifest, index) => {
    expect(String(manifest.version || "").trim(), templateVersion, `${workspace.paths.templateManifests[index]} version`);
  });

  if (tag) {
    const match = /^(cli|core)-v(.+)$/.exec(String(tag).trim());
    if (!match) {
      errors.push(`release tag must match cli-v<version> or core-v<version>, received ${tag}`);
    } else {
      let tagVersion = "";
      try {
        tagVersion = normalizeVersion(match[2]);
      } catch (error) {
        errors.push(`release tag: ${error.message}`);
      }
      if (tagVersion) expect(tagVersion, match[1] === "cli" ? cliVersion : coreVersion, `${match[1]} release tag version`);
    }
  }

  return { errors, cliVersion, coreVersion, templateVersion, coreRange, protocolVersion };
}

function checkWorkspaceVersion(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, ".."));
  const result = collectVersionErrors(loadWorkspace(rootDir), options.tag);
  if (result.errors.length > 0) {
    throw new Error(`workspace version check failed:\n- ${result.errors.join("\n- ")}`);
  }
  const { errors, ...versions } = result;
  return versions;
}

function setCliVersion(input, options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, ".."));
  const version = normalizeVersion(input);
  const workspace = loadWorkspace(rootDir);
  const coreRange = options.coreRange
    ? normalizeCoreRange(options.coreRange)
    : normalizeCoreRange(workspace.cli.dependencies?.[CORE_PACKAGE]);
  if (!satisfiesCaret(workspace.core.version, coreRange)) {
    throw new Error(`Core ${workspace.core.version} is outside the requested CLI dependency range ${coreRange}`);
  }
  workspace.cli.version = version;
  workspace.cli.dependencies[CORE_PACKAGE] = coreRange;
  workspace.lock.packages["packages/cli"].version = version;
  workspace.lock.packages["packages/cli"].dependencies[CORE_PACKAGE] = coreRange;
  writeJson(workspace.paths.cli, workspace.cli);
  writeJson(workspace.paths.lock, workspace.lock);
  checkWorkspaceVersion({ rootDir });
  return { cliVersion: version, coreRange };
}

function setCoreVersion(input, options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, ".."));
  const version = normalizeVersion(input);
  const workspace = loadWorkspace(rootDir);
  const coreRange = normalizeCoreRange(workspace.cli.dependencies?.[CORE_PACKAGE]);
  if (!satisfiesCaret(version, coreRange)) {
    throw new Error(`Core ${version} is outside the CLI dependency range ${coreRange}; update the CLI range first`);
  }
  workspace.core.version = version;
  workspace.lock.packages["packages/core"].version = version;
  writeJson(workspace.paths.core, workspace.core);
  writeJson(workspace.paths.lock, workspace.lock);
  checkWorkspaceVersion({ rootDir });
  return { coreVersion: version };
}

function setTemplateVersion(input, options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, ".."));
  const version = normalizeVersion(input);
  const workspace = loadWorkspace(rootDir);
  workspace.core.templateVersion = version;
  workspace.templateManifests.forEach((manifest) => {
    manifest.version = version;
  });
  writeJson(workspace.paths.core, workspace.core);
  workspace.paths.templateManifests.forEach((manifestPath, index) => {
    writeJson(manifestPath, workspace.templateManifests[index]);
  });
  checkWorkspaceVersion({ rootDir });
  return { templateVersion: version };
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1]) throw new Error(`${name} requires a value`);
  return args[index + 1];
}

function versionArgument(args, usage) {
  const value = args.find((arg, index) => arg !== "--" && (index === 0 || args[index - 1] !== "--core-range"));
  if (!value) throw new Error(usage);
  return value;
}

function main(args = process.argv.slice(2)) {
  const command = args[0];
  const rest = args.slice(1);
  if (command === "check") {
    const result = checkWorkspaceVersion({ tag: readOption(rest, "--tag") });
    console.log(`workspace versions are consistent: CLI ${result.cliVersion}, Core ${result.coreVersion}, Template ${result.templateVersion}, Protocol ${result.protocolVersion}`);
    return;
  }
  if (command === "set-cli") {
    const result = setCliVersion(versionArgument(rest, "usage: npm run version:set:cli -- <version> [--core-range ^x.y.z]"), {
      coreRange: readOption(rest, "--core-range"),
    });
    console.log(`CLI version updated: ${result.cliVersion} (Core ${result.coreRange})`);
    return;
  }
  if (command === "set-core") {
    const result = setCoreVersion(versionArgument(rest, "usage: npm run version:set:core -- <version>"));
    console.log(`Core version updated: ${result.coreVersion}`);
    return;
  }
  if (command === "set-template") {
    const result = setTemplateVersion(versionArgument(rest, "usage: npm run version:set:template -- <version>"));
    console.log(`Template version updated: ${result.templateVersion}`);
    return;
  }
  throw new Error("usage: workspace-version.js <check|set-cli|set-core|set-template> [version]");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkWorkspaceVersion,
  collectVersionErrors,
  compareVersions,
  normalizeCoreRange,
  normalizeVersion,
  satisfiesCaret,
  setCliVersion,
  setCoreVersion,
  setTemplateVersion,
};
