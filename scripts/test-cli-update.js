"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
if (process.platform === "win32") {
  const cli = path.resolve(__dirname, "../packages/cli/cli.js");
  const options = { env: { ...process.env, FLOW2SPEC_SKIP_UPDATE_CHECK: "1" }, encoding: "utf8" };
  const help = spawnSync(process.execPath, [cli, "--help"], options);
  assert.strictEqual(help.status, 0, help.stderr);
  assert.match(help.stdout, /--core\s+保持当前 CLI 版本/);
  const invalid = spawnSync(process.execPath, [cli, "update", "--unknown"], options);
  assert.strictEqual(invalid.status, 1);
  assert.match(invalid.stderr, /update --check\|--cli\|--core/);
  console.log("test-cli-update: help/invalid-argument smoke ok; skipped POSIX package-manager installation fixture");
  process.exit(0);
}
// Exercise the shipped CLI, mocking only npm/npx and their installation directories.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-cli-update-"));
const cliName = "@double-coding/flow2spec";
const coreName = "@double-coding/flow2spec-core";
const globalRoot = path.join(temp, "global");
const globalCli = path.join(globalRoot, cliName);
const localCli = path.join(temp, "local");
const log = path.join(temp, "calls");
function json(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}
function fixture(dir, range = "^3.8.2") {
  json(path.join(dir, "package.json"), { name: cliName, version: "3.6.5", dependencies: { [coreName]: range } });
  fs.copyFileSync(path.resolve(__dirname, "../packages/cli/cli.js"), path.join(dir, "cli.js"));
  const core = path.join(dir, "node_modules", coreName);
  json(path.join(core, "package.json"), { version: "3.8.2", main: "index.js" });
  fs.writeFileSync(path.join(core, "index.js"), `exports.createFlow2Spec=()=>({project:{agents:()=>({})},config:{supportedLocales:()=>[]}});exports.getVersions=()=>({coreVersion:require('./package.json').version,templateVersion:'3.8.1'});exports.getCapabilities=()=>({protocolVersion:1});`);
}
const mock = `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2),e=process.env;
const cli='${cliName}',core='${coreName}';
fs.appendFileSync(e.MOCK_LOG,JSON.stringify({cmd:path.basename(process.argv[1]),args:a})+'\\n');
if(path.basename(process.argv[1])==='npx') {
 console.log('Flow2Spec CLI: '+a.find(x=>x.startsWith(cli+'@')).slice(cli.length+1)+'\\nFlow2Spec Core: '+(e.MOCK_STALE?'3.8.2':'3.9.0'));process.exit(0);
}
if(a[0]==='root') console.log(e.MOCK_GLOBAL);
else if(a[0]==='view') {
 if(a[1]===cli) console.log('3.6.6');
 else if(a[1].startsWith(cli+'@')) console.log(JSON.stringify({[core]:'^4.0.0'}));
 else if(a[1]===core+'@^3.8.2') console.log(JSON.stringify([{version:'3.8.2',templateVersion:'3.8.1'},{version:'3.9.0',templateVersion:'3.9.0'},{version:'3.10.0-beta.1'}]));
 else if(a[1]===core+'@^4.0.0') console.log(JSON.stringify({version:'4.1.0',templateVersion:'4.0.0'}));
 else if(a[1]===core+'@^0.2.3') console.log(JSON.stringify([{version:'0.2.4'},{version:'0.2.5-beta.1'}]));
 else throw Error('Unexpected query '+a.join(' '));
} else if(a[0]==='uninstall') { if(e.MOCK_FAIL) process.exit(1); }
else if(a[0]==='install') {
 if(e.MOCK_INSTALL_FAIL) process.exit(1);
 const dir=path.join(e.MOCK_GLOBAL,cli),file=path.join(dir,'package.json'),pkg=JSON.parse(fs.readFileSync(file));
 pkg.version=a[2].slice(cli.length+1);fs.writeFileSync(file,JSON.stringify(pkg));
 const cf=path.join(dir,'node_modules',core,'package.json'),cp=JSON.parse(fs.readFileSync(cf));
 cp.version=e.MOCK_STALE?'3.8.2':pkg.version==='3.6.6'?'4.1.0':'3.9.0';fs.writeFileSync(cf,JSON.stringify(cp));
} else throw Error('Unexpected operation');
`;
for (const name of ["npm", "npx"]) fs.writeFileSync(path.join(temp, name), mock, { mode: 0o755 });
const env = { ...process.env, PATH: `${temp}${path.delimiter}${process.env.PATH}`, FLOW2SPEC_SKIP_UPDATE_CHECK: "1", MOCK_GLOBAL: globalRoot, MOCK_LOG: log };
function run(mode, extra = {}, dir = globalCli) {
  fixture(globalCli, extra.MOCK_RANGE);
  if (dir !== globalCli) fixture(dir);
  fs.writeFileSync(log, "");
  const result = spawnSync(process.execPath, [path.join(dir, "cli.js"), "update", mode], { env: { ...env, ...extra }, encoding: "utf8" });
  result.calls = fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  return result;
}
try {
  const check = run("--check");
  assert.strictEqual(check.status, 0, check.stderr);
  assert.match(check.stdout, /Core:\s+3.8.2 -> 3.9.0/);
  assert.match(check.stdout, /兼容范围 \^3.8.2/);
  assert.doesNotMatch(check.stdout, /4.1.0|3.10.0-beta/);
  assert.match(check.stdout, /update --cli 一键更新/);
  const zero = run("--check", { MOCK_RANGE: "^0.2.3" });
  assert.strictEqual(zero.status, 0, zero.stderr);
  assert.match(zero.stdout, /Core:\s+3.8.2 -> 0.2.4/);
  assert(zero.calls.some(c => c.args[1] === `${coreName}@^0.2.3`));
  const core = run("--core");
  assert.strictEqual(core.status, 0, core.stderr);
  assert.deepStrictEqual(core.calls.filter(c => c.args[0] === "install").map(c => c.args), [["install", "-g", `${cliName}@3.6.5`]]);
  assert(core.calls.some(c => c.args[0] === "uninstall"));
  assert.match(core.stdout, /Core 实际生效版本 v3.9.0，验证通过/);
  const cli = run("--cli");
  assert.strictEqual(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /CLI v3.6.6；Core 实际生效版本 v4.1.0/);
  const stale = run("--core", { MOCK_STALE: "1" });
  assert.strictEqual(stale.status, 1);
  assert.match(stale.stderr, /期望 v3.9.0/);
  assert.doesNotMatch(stale.stdout, /✓/);
  const failed = run("--core", { MOCK_FAIL: "1" });
  assert.strictEqual(failed.status, 1);
  assert(!failed.calls.some(c => c.args[0] === "install"));
  const installFailed = run("--core", { MOCK_INSTALL_FAIL: "1" });
  assert.strictEqual(installFailed.status, 1);
  assert.doesNotMatch(installFailed.stdout, /✓/);
  const npx = run("--core", {}, localCli);
  assert.strictEqual(npx.status, 0, npx.stderr);
  assert(npx.calls.some(c => c.cmd === "npx" && c.args.includes(`${cliName}@3.6.5`) && c.args.includes("--cache")));
  assert(!npx.calls.some(c => ["install", "uninstall"].includes(c.args[0])));
  assert.strictEqual(run("--core", { MOCK_STALE: "1" }, localCli).status, 1);
  assert.strictEqual(run("--unknown").status, 1);
  const help = spawnSync(process.execPath, [path.join(globalCli, "cli.js"), "--help"], { env, encoding: "utf8" });
  assert.strictEqual(help.status, 0, help.stderr);
  assert.match(help.stdout, /--core\s+保持当前 CLI 版本/);
  console.log("test-cli-update: ok");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
