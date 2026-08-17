#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const rootPkg = require(path.join(process.cwd(), 'package.json'));
const corePkg = require(path.join(process.cwd(), 'packages', 'core', 'package.json'));
const cliPkg = require(path.join(process.cwd(), 'packages', 'cli', 'package.json'));
const version = String(corePkg.version || '').trim();

if (!version) {
  console.error('packages/core/package.json version is empty');
  process.exit(1);
}

if (String(rootPkg.version || '').trim() !== version || String(cliPkg.version || '').trim() !== version) {
  console.error('workspace package versions must match before tagging');
  process.exit(1);
}

if (cliPkg.dependencies?.['@double-coding/flow2spec-core'] !== version) {
  console.error('CLI Core dependency must match the release version before tagging');
  process.exit(1);
}

const tag = version.startsWith('v') ? version : `v${version}`;

try {
  execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    stdio: 'ignore',
  });
  console.error(`tag already exists: ${tag}`);
  process.exit(1);
} catch (_) {
  // Missing tag is expected.
}

execFileSync('git', ['tag', '-a', tag, '-m', tag], { stdio: 'inherit' });
console.log(`created tag ${tag}`);
