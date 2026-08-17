#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "README.md");
const targetPath = path.join(rootDir, "packages", "cli", "README.md");
const source = fs.readFileSync(sourcePath, "utf8");
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  const target = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  if (target !== source) {
    console.error("packages/cli/README.md is not synchronized with the root README.md");
    console.error("Run: npm run sync:package-readme");
    process.exit(1);
  }
  console.log("check-package-readme: ok");
  process.exit(0);
}

fs.writeFileSync(targetPath, source, "utf8");
console.log("synced README.md to packages/cli/README.md");
