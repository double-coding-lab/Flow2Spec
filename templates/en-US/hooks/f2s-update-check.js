#!/usr/bin/env node
'use strict';
/**
 * flow2spec SessionStart hook — checks for version updates on the first conversation each day.
 * Compares the local knowledge-base manifest-routing.json version with the latest npm version:
 *   - Same or local is newer -> exit silently
 *   - Behind -> inject a notice into Agent context (the agent may run flow2spec init directly; use f2s-kb-upgrade only for topic-layer changes)
 * If already checked and no upgrade is needed, stay silent; if already checked and an upgrade is still needed, keep injecting the reminder in each new session.
 * Written by flow2spec init to the corresponding agent's hooks/f2s-update-check.js.
 */
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MANIFEST_PATH = path.join(process.cwd(), '.Knowledge', 'manifest-routing.json');
const CACHE_DIR    = path.join(process.cwd(), '.Knowledge');
const CACHE_FILE   = path.join(CACHE_DIR, 'update-check.json');
const PACKAGE_NAME_PLACEHOLDER = '__FLOW2SPEC_' + 'PACKAGE_NAME__';
const PACKAGE_NAME = '__FLOW2SPEC_PACKAGE_NAME__';

// ── Cache ───────────────────────────────────────────────────────────────────

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!d || typeof d !== 'object') return null;
    const checkedAt = Number(d.checkedAt || 0);
    if (!checkedAt) return null;
    if (new Date(checkedAt).toDateString() !== new Date().toDateString()) return null;
    return d;
  } catch (_) { return null; }
}

function getProjectName() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    if (pkg && pkg.name) return String(pkg.name);
  } catch (_) {}
  return path.basename(process.cwd());
}

function buildNotice(latestNpm, manifestVersion) {
  const userMsg = `📦 [flow2spec] The current project "${getProjectName()}" knowledge-base version is v${manifestVersion}, which is lower than the latest package version v${latestNpm}. I can run flow2spec init on your behalf to complete the update; if this update includes topic-layer changes, run the full f2s-kb-upgrade flow afterwards.`;
  return [
    `[flow2spec/agent-instruction] At the start of this response, you must relay the following upgrade notice to the user verbatim. Do not omit it or skip it after only internal judgment:`,
    ``,
    userMsg,
    ``,
    `[flow2spec/agent-instruction] After relaying, you may directly run \`flow2spec init <initialized agents, e.g. claude cursor codex>\` on the user's behalf to complete the update; the user does not need to run f2s-kb-upgrade manually. After init succeeds, read .Knowledge/manifest-routing.json: if projectRev equals pkgRev (a non-topic version update), the update is complete — delete .Knowledge/update-check.json; if they differ (the update includes topic-layer changes), continue with the full f2s-kb-upgrade skill flow (you may start from its step 2c without re-running init).`,
  ].join('\n');
}

function emitNotice(notice) {
  process.stdout.write(
    JSON.stringify({
      additional_context: notice,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: notice,
      },
    }) + '\n'
  );
}

function writeCache(latestNpm, manifestVersion) {
  try {
    const needsUpgrade = cmpVer(manifestVersion, latestNpm) < 0;
    fs.writeFileSync(
      CACHE_FILE,
      `${JSON.stringify({
        latestNpm,
        manifestVersion,
        needsUpgrade,
        notice: needsUpgrade ? buildNotice(latestNpm, manifestVersion) : '',
        checkedAt: Date.now(),
      }, null, 2)}\n`,
      'utf8'
    );
  } catch (_) {}
}

function deleteCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch (_) {}
}

// ── Version comparison ───────────────────────────────────────────────────────

function parseVer(v) {
  return String(v || '').replace(/^v/, '').split(/[.-]/).slice(0, 3).map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** a < b -> negative; a === b -> 0; a > b -> positive */
function cmpVer(a, b) {
  const av = parseVer(a), bv = parseVer(b);
  for (let i = 0; i < 3; i++) {
    const d = (av[i] || 0) - (bv[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ── Reads ────────────────────────────────────────────────────────────────────

function getManifestVersion() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).version || null;
  } catch (_) { return null; }
}

function getPackageName() {
  if (PACKAGE_NAME && PACKAGE_NAME !== PACKAGE_NAME_PLACEHOLDER) {
    return PACKAGE_NAME;
  }
  return '@double-coding/flow2spec';
}

function queryNpmLatest(pkgName) {
  return execFileSync('npm', ['view', pkgName, 'version'], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

// ── Configuration switch ─────────────────────────────────────────────────────

function isEnabled() {
  try {
    const cfg = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'flow2spec.config.json'), 'utf8'
    ));
    const uc = cfg && cfg.updateCheck;
    if (uc && typeof uc.enabled === 'boolean') return uc.enabled;
    return true;
  } catch (_) { return true; }
}

// ── Main flow ────────────────────────────────────────────────────────────────

function main() {
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) return;
  if (!isEnabled()) return;
  const cache = readCache();
  if (cache) {
    // If already checked today, do not query npm again; if the cache still says an upgrade is needed, keep reminding in each new session.
    const needsUpgrade = cache.needsUpgrade === true ||
      cmpVer(cache.manifestVersion, cache.latestNpm) < 0;
    if (needsUpgrade) {
      const currentManifestVersion = getManifestVersion();
      if (currentManifestVersion && cache.latestNpm &&
          cmpVer(currentManifestVersion, cache.latestNpm) >= 0) {
        deleteCache();
        return;
      }
      // SessionStart enters a new session: cache hit and upgrade still needed, so emit directly.
      const notice = buildNotice(cache.latestNpm, cache.manifestVersion);
      emitNotice(notice);
    }
    return;
  }

  const manifestVersion = getManifestVersion();
  if (!manifestVersion) return;  // No knowledge base, skip

  let latestNpm;
  try {
    const pkgName = getPackageName();
    latestNpm = queryNpmLatest(pkgName);
  } catch (_) {
    return;  // Network unavailable, exit silently without writing cache (retry next time)
  }

  // Write cache (whether or not upgrade is needed, do not repeat the check today)
  writeCache(latestNpm, manifestVersion);

  if (cmpVer(manifestVersion, latestNpm) >= 0) return;  // Already up to date

  const notice = buildNotice(latestNpm, manifestVersion);
  emitNotice(notice);
}

main();
