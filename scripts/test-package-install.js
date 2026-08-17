"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function run(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  return execFileSync(executable, args, {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
    ...options,
  });
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-pack-"));
run("npm", ["pack", "--workspace", "@double-coding/flow2spec-core", "--pack-destination", tempDir]);
run("npm", ["pack", "--workspace", "@double-coding/flow2spec", "--pack-destination", tempDir]);

const tarballs = fs.readdirSync(tempDir).filter((file) => file.endsWith(".tgz"));
assert.strictEqual(tarballs.length, 2, "expected Core and CLI tarballs");
run("npm", [
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  ...tarballs.map((file) => path.join(tempDir, file)),
], { cwd: tempDir });

const coreProbe = path.join(tempDir, "core-probe.js");
fs.writeFileSync(
  coreProbe,
  "const core = require('@double-coding/flow2spec-core');\n" +
    "if (core.getCapabilities().protocolVersion !== 1) process.exit(1);\n",
  "utf8",
);
const coreCheck = run(process.execPath, [coreProbe], { cwd: tempDir });
assert.strictEqual(coreCheck, "");
const cliPath = path.join(tempDir, "node_modules", "@double-coding", "flow2spec", "cli.js");
assert.ok(fs.existsSync(cliPath));
run(process.execPath, [cliPath, "--help"], { cwd: tempDir });
console.log("test-package-install: ok");
