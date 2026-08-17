"use strict";

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_ROOT = ".Knowledge";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_\-./]+/g, " ")
    .trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function manifestPath(cwd) {
  return path.join(cwd, KNOWLEDGE_ROOT, "manifest-routing.json");
}

function loadManifest(cwd) {
  const file = manifestPath(cwd);
  if (!fs.existsSync(file)) {
    const error = new Error(`Knowledge manifest not found: ${file}`);
    error.code = "F2S_NOT_INITIALIZED";
    throw error;
  }
  return { file, value: readJson(file) };
}

function matcherPathFor(cwd, rule) {
  const relative = rule.matcherPath || "";
  return path.join(cwd, KNOWLEDGE_ROOT, relative.replace(/^\.Knowledge[\\/]/, ""));
}

function phraseScore(text, phrase) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase || !text.includes(normalizedPhrase)) return 0;
  return normalizedPhrase.split(" ").length * 10 + normalizedPhrase.length;
}

function match(cwd, input = {}) {
  const { value: manifest } = loadManifest(cwd);
  const request = normalizeText(input.request || input.query);
  const task = normalizeText(input.task);
  const rules = Array.isArray(manifest.taskToTopicRules) ? manifest.taskToTopicRules : [];
  const candidates = [];

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const exactTask = task && normalizeText(rule.task) === task;
    let phrases = [];
    const matcherFile = matcherPathFor(cwd, rule);
    if (fs.existsSync(matcherFile)) {
      try {
        const matcher = readJson(matcherFile);
        phrases = Array.isArray(matcher.includeAny) ? matcher.includeAny : [];
      } catch {
        phrases = [];
      }
    }
    const phraseHits = phrases
      .map((phrase) => ({ phrase, score: phraseScore(request, phrase) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!exactTask && phraseHits.length === 0) continue;
    const score = exactTask ? 10000 : phraseHits[0].score;
    candidates.push({
      rule,
      score,
      order: index,
      confidence: exactTask ? "high" : score >= 30 ? "medium" : "low",
      matchedPhrases: phraseHits.map((hit) => hit.phrase),
      topics: Array.isArray(rule.topics) ? rule.topics : [],
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  const fallback = manifest.fallbackTopic;
  const primary = candidates[0] || {
    rule: null,
    score: 0,
    confidence: "low",
    matchedPhrases: [],
    topics: fallback ? [fallback] : [],
    fallback: true,
  };
  return {
    request: input.request || input.query || "",
    task: input.task || null,
    primary,
    alternatives: candidates.slice(1),
    candidates,
    manifestVersion: manifest.version,
  };
}

function expand(cwd, result) {
  const { value: manifest } = loadManifest(cwd);
  const dependencies = manifest.topicDependencies || {};
  const topics = [];
  const seen = new Set();
  const visit = (topic) => {
    if (!topic || seen.has(topic)) return;
    seen.add(topic);
    for (const dependency of dependencies[topic] || []) visit(dependency);
    topics.push(topic);
  };
  for (const topic of result?.primary?.topics || []) visit(topic);
  for (const candidate of result?.alternatives || []) {
    for (const topic of candidate.topics || []) visit(topic);
  }
  return { ...result, topics };
}

function verify(cwd, result, options = {}) {
  const { value: manifest } = loadManifest(cwd);
  const missing = [];
  for (const topic of result?.topics || result?.primary?.topics || []) {
    const topicPath = manifest.topicPaths?.[topic];
    if (!topicPath || !fs.existsSync(path.join(cwd, topicPath))) {
      missing.push({ kind: "topic", id: topic, path: topicPath || null });
    }
  }
  for (const required of options.requiredContext || []) {
    const file = path.isAbsolute(required) ? required : path.join(cwd, required);
    if (!fs.existsSync(file)) missing.push({ kind: "context", path: required });
  }
  return {
    ok: missing.length === 0,
    missing,
    confidence: result?.primary?.confidence || "low",
    fallback: Boolean(result?.primary?.fallback),
  };
}

function loadContext(cwd, result, options = {}) {
  const { value: manifest } = loadManifest(cwd);
  const maxFiles = Number.isFinite(options.maxFiles) ? options.maxFiles : 20;
  const maxLines = Number.isFinite(options.maxLines) ? options.maxLines : 400;
  const files = [];
  let lineCount = 0;
  for (const topic of result?.topics || result?.primary?.topics || []) {
    const relative = manifest.topicPaths?.[topic];
    if (!relative || files.length >= maxFiles || lineCount >= maxLines) continue;
    const file = path.join(cwd, relative);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const remaining = Math.max(0, maxLines - lineCount);
    const content = lines.slice(0, remaining).join("\n");
    lineCount += content ? content.split(/\r?\n/).length : 0;
    files.push({ topic, path: relative, content, truncated: lines.length > remaining });
  }
  return { files, lineCount, truncated: files.length < (result?.topics || []).length };
}

module.exports = {
  loadManifest,
  match,
  expand,
  verify,
  loadContext,
};
