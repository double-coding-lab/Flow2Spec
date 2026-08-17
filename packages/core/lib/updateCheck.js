"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const DEFAULT_PACKAGE_NAME = "@double-coding/flow2spec-core";
const KNOWLEDGE_ROOT = ".Knowledge";
const CACHE_FILENAME = "update-check.json";

function parseVersion(version) {
  return String(version || "")
    .replace(/^v/, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => {
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
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function sameLocalDay(timestamp, now) {
  const checkedAt = Number(timestamp || 0);
  return checkedAt > 0 && new Date(checkedAt).toDateString() === new Date(now).toDateString();
}

function projectName(cwd) {
  const pkg = readJson(path.join(cwd, "package.json"));
  return pkg?.name ? String(pkg.name) : path.basename(cwd);
}

function buildNotice({ cwd, locale, manifestVersion, latestVersion }) {
  if (locale === "en-US") {
    return `[flow2spec] The project "${projectName(cwd)}" knowledge version is v${manifestVersion}; Core v${latestVersion} is available. Run the f2s-kb-upgrade skill to align templates and routing.`;
  }
  return `[flow2spec] 当前项目「${projectName(cwd)}」知识版本为 v${manifestVersion}，Core 最新版本为 v${latestVersion}。可执行 f2s-kb-upgrade skill 对齐模板与路由。`;
}

function queryLatestVersion(packageName, options = {}) {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    execFile(
      npmExecutable,
      ["view", packageName, "version", "--registry=https://registry.npmjs.org"],
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
        resolve(String(stdout || "").trim());
      },
    );
  });
}

function result(status, values = {}) {
  return {
    status,
    checked: false,
    fromCache: false,
    packageName: values.packageName || DEFAULT_PACKAGE_NAME,
    manifestVersion: values.manifestVersion || null,
    latestVersion: values.latestVersion || null,
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

  const knowledgeDir = path.join(cwd, KNOWLEDGE_ROOT);
  const manifestPath = path.join(knowledgeDir, "manifest-routing.json");
  const cachePath = path.join(knowledgeDir, CACHE_FILENAME);
  const manifestVersion = readJson(manifestPath)?.version || null;
  if (!manifestVersion) {
    return result("skipped", { packageName, reason: "manifest-missing" });
  }

  const now = Date.now();
  const cache = readJson(cachePath);
  const cachePackageMatches = cache?.packageName
    ? cache.packageName === packageName
    : packageName === DEFAULT_PACKAGE_NAME;
  if (!options.force && cache && cachePackageMatches && sameLocalDay(cache.checkedAt, now)) {
    const latestVersion = cache.latestVersion || cache.latestNpm || null;
    if (latestVersion && compareVersions(manifestVersion, latestVersion) >= 0) {
      try {
        fs.rmSync(cachePath, { force: true });
      } catch (_) {}
      return result("current", {
        checked: true,
        fromCache: true,
        packageName,
        manifestVersion,
        latestVersion,
        checkedAt: Number(cache.checkedAt),
      });
    }
    const needsUpgrade =
      Boolean(latestVersion) &&
      (cache.needsUpgrade === true || compareVersions(manifestVersion, latestVersion) < 0);
    return result(needsUpgrade ? "upgrade-available" : "current", {
      checked: true,
      fromCache: true,
      packageName,
      manifestVersion,
      latestVersion,
      needsUpgrade,
      notice: needsUpgrade
        ? buildNotice({ cwd, locale, manifestVersion, latestVersion })
        : "",
      checkedAt: Number(cache.checkedAt),
    });
  }

  let latestVersion;
  try {
    latestVersion = await queryLatestVersion(packageName, {
      signal: options.signal,
      timeout: options.timeout,
    });
  } catch (error) {
    if (error?.code === "F2S_ABORTED") throw error;
    return result("unavailable", {
      packageName,
      manifestVersion,
      reason: "registry-unavailable",
    });
  }
  assertNotAborted(options.signal);
  if (!latestVersion) {
    return result("unavailable", {
      packageName,
      manifestVersion,
      reason: "empty-registry-version",
    });
  }

  const needsUpgrade = compareVersions(manifestVersion, latestVersion) < 0;
  const notice = needsUpgrade
    ? buildNotice({ cwd, locale, manifestVersion, latestVersion })
    : "";
  const checkedAt = Date.now();
  try {
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.writeFileSync(
      cachePath,
      `${JSON.stringify(
        {
          packageName,
          latestVersion,
          latestNpm: latestVersion,
          manifestVersion,
          needsUpgrade,
          notice,
          checkedAt,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (_) {}
  return result(needsUpgrade ? "upgrade-available" : "current", {
    checked: true,
    packageName,
    manifestVersion,
    latestVersion,
    needsUpgrade,
    notice,
    checkedAt,
  });
}

module.exports = {
  DEFAULT_PACKAGE_NAME,
  compareVersions,
  checkUpdate,
};
