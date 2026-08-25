"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const packageMetadata = require("../package.json");

const DEFAULT_PACKAGE_NAME = "@double-coding/flow2spec-core";
const CACHE_FILENAME = "update-check.json";

function parseVersion(version) {
  return String(version || "").replace(/^v/, "").split(/[.-]/).slice(0, 3).map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function abortError() {
  const error = new Error("update check aborted");
  error.code = "F2S_ABORTED";
  error.details = { operation: "update.check" };
  return error;
}

function assertNotAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch (_) { return null; }
}

function sameLocalDay(timestamp, now) {
  const checkedAt = Number(timestamp || 0);
  return checkedAt > 0 && new Date(checkedAt).toDateString() === new Date(now).toDateString();
}

function projectName(cwd) {
  return readJson(path.join(cwd, "package.json"))?.name || path.basename(cwd);
}

function buildNotice({ cwd, locale, state }) {
  const summary = `Core v${state.currentCoreVersion} -> v${state.latestCoreVersion}, Template v${state.manifestVersion} -> v${state.latestTemplateVersion}`;
  if (state.templateUpdateAvailable) {
    return locale === "en-US"
      ? `[flow2spec] Project "${projectName(cwd)}" has a template update (${summary}). Update Core, run flow2spec init, then use f2s-kb-upgrade only if projectRev differs from pkgRev.`
      : `[flow2spec] 当前项目「${projectName(cwd)}」有模板更新（${summary}）。请更新 Core 后执行 flow2spec init；仅当 projectRev 与 pkgRev 不等时再执行 f2s-kb-upgrade。`;
  }
  return locale === "en-US"
    ? `[flow2spec] Project "${projectName(cwd)}" has a Core-only update (${summary}). Update Core and run one idempotent flow2spec init; do not run f2s-kb-upgrade.`
    : `[flow2spec] 当前项目「${projectName(cwd)}」仅有 Core 程序更新（${summary}）。请更新 Core 并执行一次幂等 flow2spec init；无需执行 f2s-kb-upgrade。`;
}

function queryLatestMetadata(packageName, options = {}) {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    execFile(
      npmExecutable,
      ["view", packageName, "version", "templateVersion", "--json", "--registry=https://registry.npmjs.org"],
      {
        encoding: "utf8",
        timeout: options.timeout || 5000,
        maxBuffer: 1024 * 1024,
        signal: options.signal,
        windowsHide: true,
      },
      (error, stdout) => {
        if (options.signal?.aborted || error?.name === "AbortError" || error?.code === "ABORT_ERR") {
          reject(abortError());
          return;
        }
        if (error) {
          reject(error);
          return;
        }
        try {
          const metadata = JSON.parse(String(stdout || "").trim());
          const latestCoreVersion = typeof metadata === "string" ? metadata : metadata.version;
          const latestTemplateVersion = typeof metadata === "string"
            ? metadata
            : metadata.templateVersion || metadata.version;
          resolve({ latestCoreVersion, latestTemplateVersion });
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function buildState(manifestVersion, metadata) {
  const currentCoreVersion = packageMetadata.version;
  const currentTemplateVersion = packageMetadata.templateVersion;
  const coreUpdateAvailable = compareVersions(currentCoreVersion, metadata.latestCoreVersion) < 0;
  const templateUpdateAvailable = compareVersions(manifestVersion, metadata.latestTemplateVersion) < 0;
  return {
    currentCoreVersion,
    currentTemplateVersion,
    manifestVersion,
    latestCoreVersion: metadata.latestCoreVersion,
    latestTemplateVersion: metadata.latestTemplateVersion,
    coreUpdateAvailable,
    templateUpdateAvailable,
    needsUpgrade: coreUpdateAvailable || templateUpdateAvailable,
  };
}

function result(status, values = {}) {
  return {
    status,
    checked: false,
    fromCache: false,
    packageName: values.packageName || DEFAULT_PACKAGE_NAME,
    currentCoreVersion: values.currentCoreVersion || packageMetadata.version,
    currentTemplateVersion: values.currentTemplateVersion || packageMetadata.templateVersion,
    manifestVersion: values.manifestVersion || null,
    latestCoreVersion: values.latestCoreVersion || null,
    latestTemplateVersion: values.latestTemplateVersion || null,
    latestVersion: values.latestCoreVersion || values.latestVersion || null,
    coreUpdateAvailable: false,
    templateUpdateAvailable: false,
    needsUpgrade: status === "upgrade-available",
    notice: values.notice || "",
    checkedAt: values.checkedAt || null,
    reason: values.reason || null,
    ...values,
  };
}

async function checkUpdate(cwd, config, options = {}) {
  assertNotAborted(options.signal);
  const packageName = options.packageName || DEFAULT_PACKAGE_NAME;
  const locale = config?.locale === "en-US" ? "en-US" : "zh-CN";
  if (config?.updateCheck?.enabled === false) {
    return result("disabled", { packageName, reason: "config-disabled" });
  }
  if (!options.force && (process.env.CI || process.env.CONTINUOUS_INTEGRATION)) {
    return result("skipped", { packageName, reason: "continuous-integration" });
  }

  const knowledgeDir = path.join(cwd, ".Knowledge");
  const cachePath = path.join(knowledgeDir, CACHE_FILENAME);
  const manifestVersion = readJson(path.join(knowledgeDir, "manifest-routing.json"))?.version || null;
  if (!manifestVersion) return result("skipped", { packageName, reason: "manifest-missing" });

  const cache = readJson(cachePath);
  let metadata;
  let fromCache = false;
  if (!options.force && cache && sameLocalDay(cache.checkedAt, Date.now())) {
    metadata = {
      latestCoreVersion: cache.latestCoreVersion || cache.latestVersion || cache.latestNpm,
      latestTemplateVersion: cache.latestTemplateVersion || cache.latestNpm || cache.latestVersion,
    };
    fromCache = true;
  } else {
    try {
      metadata = await queryLatestMetadata(packageName, options);
    } catch (error) {
      if (error?.code === "F2S_ABORTED") throw error;
      return result("unavailable", { packageName, manifestVersion, reason: "registry-unavailable" });
    }
  }
  assertNotAborted(options.signal);
  if (!metadata.latestCoreVersion || !metadata.latestTemplateVersion) {
    return result("unavailable", { packageName, manifestVersion, reason: "empty-registry-version" });
  }

  const state = buildState(manifestVersion, metadata);
  const notice = state.needsUpgrade ? buildNotice({ cwd, locale, state }) : "";
  const checkedAt = fromCache ? Number(cache.checkedAt) : Date.now();
  if (!fromCache) {
    try {
      fs.mkdirSync(knowledgeDir, { recursive: true });
      fs.writeFileSync(cachePath, `${JSON.stringify({
        packageName,
        ...state,
        latestNpm: state.latestTemplateVersion,
        notice,
        checkedAt,
      }, null, 2)}\n`, "utf8");
    } catch (_) {}
  }
  if (!state.needsUpgrade) {
    try { fs.rmSync(cachePath, { force: true }); } catch (_) {}
  }
  return result(state.needsUpgrade ? "upgrade-available" : "current", {
    checked: true,
    fromCache,
    packageName,
    ...state,
    latestVersion: state.latestCoreVersion,
    notice,
    checkedAt,
  });
}

module.exports = {
  DEFAULT_PACKAGE_NAME,
  compareVersions,
  checkUpdate,
  queryLatestMetadata,
};
