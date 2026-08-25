"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-cli-update-"));
const cliPath = path.resolve(__dirname, "..", "cli.js");

if (process.platform === "win32") {
  fs.writeFileSync(path.join(tempDir, "npm.cmd"), [
    "@echo off",
    "if \"%2\"==\"@double-coding/flow2spec-core\" (",
    "  echo {\"version\":\"3.6.0\",\"templateVersion\":\"3.5.0\"}",
    ") else (",
    "  echo 3.5.1",
    ")",
    "",
  ].join("\r\n"), "utf8");
} else {
  const npmPath = path.join(tempDir, "npm");
  fs.writeFileSync(npmPath, [
    "#!/usr/bin/env sh",
    "if [ \"$2\" = \"@double-coding/flow2spec-core\" ]; then",
    "  echo '{\"version\":\"3.6.0\",\"templateVersion\":\"3.5.0\"}'",
    "else",
    "  echo '3.5.1'",
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
assert.match(check.stdout, /CLI:\s+3\.5\.0 -> 3\.5\.1/);
assert.match(check.stdout, /Core:\s+3\.5\.0 -> 3\.6\.0/);
assert.match(check.stdout, /Template:\s+3\.5\.0 -> 3\.5\.0/);
assert.match(check.stdout, /\^3\.5\.0 \(compatible\)/);

const invalid = spawnSync(process.execPath, [cliPath, "update", "--unknown"], {
  cwd: path.resolve(__dirname, ".."),
  env,
  encoding: "utf8",
});
assert.strictEqual(invalid.status, 1);
assert.match(invalid.stderr, /update --check\|--cli\|--core/);

console.log("test-cli-update: ok");
