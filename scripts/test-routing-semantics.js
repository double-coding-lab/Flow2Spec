"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const core = require("@double-coding/flow2spec-core");

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-routing-"));

try {
  writeJson(path.join(tmpRoot, ".Knowledge", "manifest-routing.json"), {
    version: "test",
    knowledgeRoot: ".Knowledge",
    matcherKey: "matcherId",
    sourceOfTruth: ".Knowledge/manifest-routing.json",
    fallbackTopic: "topic-b",
    topicDependencies: {},
    topicPaths: {
      "topic-a": ".Knowledge/topics/topic-a.md",
      "topic-b": ".Knowledge/topics/topic-b.md",
    },
    taskToTopicRules: [
      {
        task: "deploy",
        matcherId: "m-deploy",
        matcherPath: ".Knowledge/matchers/m-deploy.json",
        topics: ["topic-a"],
      },
      {
        task: "rollback",
        matcherId: "m-rollback",
        matcherPath: ".Knowledge/matchers/m-rollback.json",
        topics: ["topic-b"],
      },
      {
        task: "data-migration",
        matcherId: "m-data-migration",
        matcherPath: ".Knowledge/matchers/m-data-migration.json",
        topics: ["topic-a"],
      },
      {
        task: "cache-purge",
        matcherId: "m-cache-purge",
        matcherPath: ".Knowledge/matchers/m-cache-purge.json",
        topics: ["topic-b"],
      },
      {
        task: "legacy-api",
        matcherId: "m-legacy-api",
        matcherPath: ".Knowledge/matchers/m-legacy-api.json",
        topics: ["topic-b"],
      },
    ],
    topicMetadata: {
      "topic-a": { primary: "policy", confidence: "manual" },
      "topic-b": { primary: "feature", confidence: "manual" },
    },
  });

  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-deploy.json"), {
    id: "m-deploy",
    includeAny: ["部署服务"],
    excludeAny: ["预演", "preview"],
  });
  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-rollback.json"), {
    id: "m-rollback",
    includeAny: ["回滚"],
  });
  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-data-migration.json"), {
    id: "m-data-migration",
    includeAll: ["数据", "迁移"],
  });
  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-cache-purge.json"), {
    id: "m-cache-purge",
    includeAny: ["清理缓存"],
    includeAll: ["缓存", "失效"],
  });
  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-legacy-api.json"), {
    id: "m-legacy-api",
    includeAny: ["老接口"],
    excludeAll: ["归档", "下线"],
  });

  writeText(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-a.md"),
    ["---", "id: topic-a", "revision: 0", "summary: topic a", "primary: policy", "confidence: manual", "---", "# Topic A", ""].join("\n"),
  );
  writeText(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-b.md"),
    ["---", "id: topic-b", "revision: 0", "summary: topic b", "primary: feature", "confidence: manual", "---", "# Topic B", ""].join("\n"),
  );

  const api = core.createFlow2Spec({ cwd: tmpRoot });

  // 1. 黄金样本：存量 includeAny 行为与打分完全不变
  const golden = api.routing.match({ request: "如何部署服务到生产" });
  assert.strictEqual(golden.primary.rule.task, "deploy");
  assert.deepStrictEqual(golden.primary.matchedPhrases, ["部署服务"]);
  assert.strictEqual(golden.primary.score, 14);
  assert.strictEqual(golden.primary.confidence, "low");
  assert.strictEqual(golden.primary.fallback, undefined);
  for (const key of ["request", "task", "primary", "alternatives", "candidates", "manifestVersion"]) {
    assert.ok(key in golden, `match result should keep field: ${key}`);
  }

  // 2. excludeAny 否决：含排除词的请求不再命中该任务域
  const vetoed = api.routing.match({ request: "预演环境如何部署服务" });
  assert.strictEqual(vetoed.candidates.length, 0);
  assert.strictEqual(vetoed.primary.fallback, true);
  assert.deepStrictEqual(vetoed.primary.topics, ["topic-b"]);

  // 3. 否决恒胜：task 精确命中同样被排除词否决
  const vetoedExact = api.routing.match({ task: "deploy", request: "预演环境部署服务" });
  assert.strictEqual(vetoedExact.primary.fallback, true);
  assert.strictEqual(vetoedExact.candidates.length, 0);

  // 4. excludeAll 为 AND 否决：全部出现才否决，部分出现不否决
  const vetoedAll = api.routing.match({ request: "老接口 归档 下线 流程" });
  assert.strictEqual(vetoedAll.candidates.length, 0);
  assert.strictEqual(vetoedAll.primary.fallback, true);
  const notVetoedPartial = api.routing.match({ request: "老接口 归档 流程" });
  assert.strictEqual(notVetoedPartial.primary.rule.task, "legacy-api");

  // 5. includeAll 纯 AND 资格：全部命中才成为候选（无 includeAny 也可表达）
  const andQualified = api.routing.match({ request: "数据 迁移 步骤" });
  assert.strictEqual(andQualified.primary.rule.task, "data-migration");
  assert.deepStrictEqual(andQualified.primary.matchedPhrases, ["数据", "迁移"]);
  const andNotQualified = api.routing.match({ request: "数据 备份 步骤" });
  assert.strictEqual(andNotQualified.primary.fallback, true);

  // 6. includeAny 与 includeAll 并存：includeAny 命中即具备资格（OR 路线）
  const anyRoute = api.routing.match({ request: "清理缓存 的脚本" });
  assert.strictEqual(anyRoute.primary.rule.task, "cache-purge");

  // 7. includeAll 短语并入打分池：命中短语与得分覆盖 includeAny 与 includeAll
  const pooled = api.routing.match({ request: "清理缓存 之后 缓存 失效 处理" });
  assert.strictEqual(pooled.primary.rule.task, "cache-purge");
  assert.deepStrictEqual(pooled.primary.matchedPhrases, ["清理缓存", "缓存", "失效"]);
  assert.strictEqual(pooled.primary.score, 14);

  // 8. 被否决的规则不出现在 candidates/alternatives，次优候选正常晋升
  const promote = api.routing.match({ request: "预演 部署服务 回滚 记录" });
  assert.strictEqual(promote.primary.rule.task, "rollback");
  assert.ok(promote.candidates.every((candidate) => candidate.rule.task !== "deploy"));

  // 9. 否决词判定沿用归一化口径（大小写不敏感）
  const normalizedVeto = api.routing.match({ request: "PREVIEW 环境部署服务" });
  assert.strictEqual(normalizedVeto.primary.fallback, true);

  // 10. task 精确命中保持 10000 分与 high 置信（未被否决时）
  const exact = api.routing.match({ task: "rollback", request: "发布出错怎么办" });
  assert.strictEqual(exact.primary.rule.task, "rollback");
  assert.strictEqual(exact.primary.score, 10000);
  assert.strictEqual(exact.primary.confidence, "high");

  console.log("routing semantics tests passed");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
