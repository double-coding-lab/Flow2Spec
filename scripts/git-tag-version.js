#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const { checkWorkspaceVersion } = require('./workspace-version');

const target = process.argv[2];
if (!['cli', 'core'].includes(target)) {
  console.error('usage: git-tag-version.js <cli|core>');
  process.exit(1);
}
const versions = checkWorkspaceVersion({ rootDir: process.cwd() });
const version = target === 'cli' ? versions.cliVersion : versions.coreVersion;
const tag = `${target}-v${version}`;

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
