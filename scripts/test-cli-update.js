"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-cli-update-"));
const cliPath = path.resolve(__dirname, "..", "cli.js");

// 动态读取本地版本，stub 返回「补丁号 +1」的新版本，避免发版后钉死 fixture
const cliPkg = require(path.resolve(__dirname, "..", "packages", "cli", "package.json"));
const corePkg = require(path.resolve(__dirname, "..", "packages", "core", "package.json"));
const cliVersion = cliPkg.version;
const coreVersion = corePkg.version;
const templateVersion = corePkg.templateVersion;
const coreRange = cliPkg.dependencies["@double-coding/flow2spec-core"];
const bumpPatch = (v) => {
  const [major, minor, patch] = v.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
};
const latestCli = bumpPatch(cliVersion);
const latestCore = bumpPatch(coreVersion);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (process.platform === "win32") {
  fs.writeFileSync(path.join(tempDir, "npm.cmd"), [
    "@echo off",
    "if \"%2\"==\"@double-coding/flow2spec-core\" (",
    `  echo {"version":"${latestCore}","templateVersion":"${templateVersion}"}`,
    ") else (",
    `  echo ${latestCli}`,
    ")",
    "",
  ].join("\r\n"), "utf8");
} else {
  const npmPath = path.join(tempDir, "npm");
  fs.writeFileSync(npmPath, [
    "#!/usr/bin/env sh",
    "if [ \"$2\" = \"@double-coding/flow2spec-core\" ]; then",
    `  echo '{"version":"${latestCore}","templateVersion":"${templateVersion}"}'`,
    "else",
    `  echo '${latestCli}'`,
    "fi",
    "",
  ].join("\n"), { encoding: "utf8", mode: 0o755 });
}

const env = {
  ...process.env,
  PATH: `${tempDir}${path.delimiter}${process.env.PATH || ""}`,
  FLOW2SPEC_SKIP_UPDATE_CHECK: "1",
};
const check = spawnSync(process.execPath, [cliPath, "update", "--check"], {
  cwd: path.resolve(__dirname, ".."),
  env,
  encoding: "utf8",
});
assert.strictEqual(check.status, 0, check.stderr);
assert.match(check.stdout, new RegExp(`CLI:\\s+${escapeRe(cliVersion)} -> ${escapeRe(latestCli)}`));
assert.match(check.stdout, new RegExp(`Core:\\s+${escapeRe(coreVersion)} -> ${escapeRe(latestCore)}`));
assert.match(check.stdout, new RegExp(`Template:\\s+${escapeRe(templateVersion)} -> ${escapeRe(templateVersion)}`));
assert.match(check.stdout, new RegExp(`pin Core ${escapeRe(coreRange)}`));
assert.match(check.stdout, /update --cli 一键更新/);

const invalid = spawnSync(process.execPath, [cliPath, "update", "--unknown"], {
  cwd: path.resolve(__dirname, ".."),
  env,
  encoding: "utf8",
});
assert.strictEqual(invalid.status, 1);
assert.match(invalid.stderr, /update --check\|--cli\|--core/);

console.log("test-cli-update: ok");
