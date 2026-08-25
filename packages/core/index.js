"use strict";

const fs = require("fs");
const path = require("path");
const agents = require("./lib/agents");
const claudeRulesAdapter = require("./lib/claudeRulesAdapter");
const claudeSettingsAdapter = require("./lib/claudeSettingsAdapter");
const codexAgentsAdapter = require("./lib/codexAgentsAdapter");
const config = require("./lib/flow2specConfig");
const developerId = require("./lib/developerId");
const doctor = require("./lib/doctor");
const dshAgentsAdapter = require("./lib/dshAgentsAdapter");
const knowledgeEngine = require("./lib/knowledgeEngine");
const init = require("./lib/init");
const routing = require("./lib/routing");
const hostResources = require("./lib/resources");
const updateCheck = require("./lib/updateCheck");
const capabilities = require("./capabilities.json");
const packageMetadata = require("./package.json");

class Flow2SpecError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message);
    this.name = "Flow2SpecError";
    this.code = code;
    this.details = details;
    this.recoverable = options.recoverable !== false;
  }
}

function assertCwd(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) {
    throw new Flow2SpecError(
      "F2S_INVALID_ARGUMENT",
      "cwd must be a non-empty project path",
      { field: "cwd" },
      { recoverable: false },
    );
  }
  return cwd;
}

function resourceRoot(locale = "zh-CN") {
  const selected = locale === "en-US" ? "en-US" : "zh-CN";
  return path.join(__dirname, "templates", selected);
}

function listResourceFiles(locale, relativeRoot) {
  const root = path.join(__dirname, "templates", locale === "en-US" ? "en-US" : "zh-CN", relativeRoot);
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) visit(path.join(current, entry.name), relative);
      else files.push(relative);
    }
  };
  visit(root, "");
  return files.sort();
}

function readResource(relativePath, locale = "zh-CN") {
  const root = resourceRoot(locale);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Flow2SpecError("F2S_INVALID_ARGUMENT", "resource path escapes package root", {
      relativePath,
    });
  }
  if (!fs.existsSync(resolved)) {
    throw new Flow2SpecError("F2S_RESOURCE_MISSING", `resource not found: ${relativePath}`, {
      relativePath,
      locale,
    });
  }
  return fs.readFileSync(resolved, "utf8");
}

function toFlow2SpecError(error) {
  if (error instanceof Flow2SpecError) return error;
  if (error && typeof error.code === "string" && error.code.startsWith("F2S_")) {
    return new Flow2SpecError(error.code, error.message || String(error), error.details || {});
  }
  return error;
}

function callCore(operation) {
  try {
    return operation();
  } catch (error) {
    throw toFlow2SpecError(error);
  }
}

async function callCoreAsync(operation) {
  try {
    return await operation();
  } catch (error) {
    throw toFlow2SpecError(error);
  }
}

function createFlow2Spec(options = {}) {
  const cwd = assertCwd(options.cwd || process.cwd());
  const context = {
    cwd,
    signal: options.signal,
    onProgress: typeof options.onProgress === "function" ? options.onProgress : () => {},
  };

  return {
    context,
    project: {
      init: (initOptions = {}) => init(cwd, initOptions.integrations || [], initOptions),
      inspect: () => ({ cwd, config: config.loadFlow2specConfig(cwd) }),
      agents: () => Object.fromEntries(
        Object.entries(agents.AGENTS).map(([id, metadata]) => [id, { ...metadata }]),
      ),
    },
    config: {
      load: () => config.loadFlow2specConfig(cwd),
      missingFields: () => config.getMissingConfigFields(cwd),
      supportedLocales: () => [...config.SUPPORTED_LOCALES],
    },
    routing: {
      graph: () => knowledgeEngine.loadKnowledgeGraph(cwd),
      state: () => knowledgeEngine.loadKnowledgeState(cwd),
      match: (input = {}) => routing.match(cwd, input),
      expand: (result) => routing.expand(cwd, result),
      verify: (result, verifyOptions = {}) => routing.verify(cwd, result, verifyOptions),
      loadContext: (result, contextOptions = {}) =>
        routing.loadContext(cwd, result, contextOptions),
    },
    knowledge: {
      status: (statusOptions = {}) => knowledgeEngine.summarizeKnowledgeState(cwd, statusOptions),
      check: (checkOptions = {}) => {
        const graph = knowledgeEngine.loadKnowledgeGraph(cwd);
        return knowledgeEngine.validateKnowledgeGraph(graph, checkOptions);
      },
      plan: ({ delta, deltaFile } = {}) => {
        const graph = knowledgeEngine.loadKnowledgeGraph(cwd);
        const parsed = delta || knowledgeEngine.parseKnowledgeDelta(deltaFile);
        return knowledgeEngine.planKnowledgeDelta(graph, parsed);
      },
      apply: ({ delta, deltaFile, ...applyOptions } = {}) =>
        knowledgeEngine.applyKnowledgeDelta(cwd, delta || deltaFile, applyOptions),
      build: (buildOptions = {}) => knowledgeEngine.buildKnowledgeGraph(cwd, buildOptions),
    },
    collaboration: {
      resolveDeveloper: (resolveOptions = {}) =>
        developerId.resolveDeveloperContext(config.loadFlow2specConfig(cwd), {
          cwd,
          ...resolveOptions,
        }),
    },
    doctor: {
      run: (doctorOptions = {}) => doctor.runDoctor(cwd, doctorOptions),
    },
    resources: {
      root: __dirname,
      capabilities: () => capabilities,
      listSkills: (locale = "zh-CN") => listResourceFiles(locale, "skills"),
      listRules: (locale = "zh-CN") => listResourceFiles(locale, "rules"),
      listHooks: (locale = "zh-CN") => listResourceFiles(locale, "hooks"),
      read: (relativePath, locale = "zh-CN") => readResource(relativePath, locale),
      skillCatalog: (resourceOptions = {}) =>
        callCore(() => hostResources.skillCatalog(path.join(__dirname, "templates"), resourceOptions)),
      unifiedEntry: (resourceOptions = {}) =>
        callCore(() => hostResources.unifiedEntry(path.join(__dirname, "templates"), resourceOptions)),
    },
    update: {
      check: (checkOptions = {}) =>
        callCoreAsync(() =>
          updateCheck.checkUpdate(cwd, config.loadFlow2specConfig(cwd), checkOptions),
        ),
    },
  };
}

module.exports = {
  Flow2SpecError,
  createFlow2Spec,
  getCapabilities: () => capabilities,
  getVersions: () => ({
    coreVersion: packageMetadata.version,
    templateVersion: packageMetadata.templateVersion,
    protocolVersion: capabilities.protocolVersion,
  }),
  resourcesRoot: __dirname,
  legacy: {
    AGENTS: agents.AGENTS,
    agents,
    claudeRulesAdapter,
    claudeSettingsAdapter,
    codexAgentsAdapter,
    config,
    developerId,
    doctor,
    dshAgentsAdapter,
    init,
    knowledgeEngine,
  },
};
