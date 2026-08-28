const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const engine = require("../packages/core/lib/knowledgeEngine");

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-kb-"));

try {
  writeJson(path.join(tmpRoot, "flow2spec.config.json"), {
    locale: "zh-CN",
    collaboration: {
      enabled: true,
      developerId: "alice",
    },
  });

  writeJson(path.join(tmpRoot, ".Knowledge", "manifest-routing.json"), {
    version: "test",
    knowledgeRoot: ".Knowledge",
    matcherKey: "matcherId",
    sourceOfTruth: ".Knowledge/manifest-routing.json",
    fallbackTopic: "topic-a",
    topicDependencies: {},
    topicPaths: {
      "topic-a": ".Knowledge/topics/topic-a.md",
      "topic-b": ".Knowledge/topics/topic-b.md",
    },
    taskToTopicRules: [
      {
        task: "test-task",
        matcherId: "m-test-task",
        matcherPath: ".Knowledge/matchers/m-test-task.json",
        topics: ["topic-a"],
      },
    ],
    topicMetadata: {
      "topic-a": {
        primary: "policy",
        confidence: "manual",
      },
      "topic-b": {
        primary: "feature",
        confidence: "manual",
      },
    },
  });

  writeJson(path.join(tmpRoot, ".Knowledge", "matchers", "m-test-task.json"), {
    id: "m-test-task",
    includeAny: ["test"],
  });
  writeJson(path.join(tmpRoot, ".Knowledge", "manifest-matchers.json"), {
    version: "1.0.0",
    generatedFrom: ".Knowledge/manifest-routing.json",
    matcherKey: "matcherId",
    sourceOfTruth: ".Knowledge/manifest-routing.json",
    matchers: {
      "m-test-task": {
        includeAny: ["test"],
      },
    },
  });

  writeText(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-a.md"),
    [
      "---",
      "id: topic-a",
      "revision: 0",
      "summary: test capability rules and boundaries",
      "primary: policy",
      "confidence: manual",
      "---",
      "# Topic A",
      "",
      "Base body.",
      "",
    ].join("\n"),
  );
  writeText(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-b.md"),
    [
      "---",
      "id: topic-b",
      "revision: 0",
      "summary: helper topic for dependency checks",
      "primary: feature",
      "confidence: manual",
      "---",
      "# Topic B",
      "",
    ].join("\n"),
  );

  const deltaPath = path.join(
    tmpRoot,
    ".task",
    "alice",
    "active",
    "task-1",
    "kb-delta.json",
  );
  writeJson(deltaPath, {
    taskId: "task-1",
    developerId: "alice",
    baseRevisions: {
      "topic-a": 0,
    },
    changes: [
      {
        type: "appendBody",
        targetTopic: "topic-a",
        summary: "append knowledge",
        content: "## Added\n\nNew reusable fact.",
      },
      {
        type: "updateFrontmatter",
        targetTopic: "topic-a",
        summary: "add dependency",
        frontmatter: {
          dependsOn: ["topic-b"],
        },
      },
    ],
  });

  const initialState = engine.summarizeKnowledgeState(tmpRoot);
  assert.strictEqual(initialState.taskRoot, ".task/alice");
  assert.strictEqual(initialState.validation.ok, true);
  assert.strictEqual(initialState.validation.warnings.length, 0);
  assert.strictEqual(initialState.tasks.length, 1);
  assert.strictEqual(initialState.tasks[0].mergeable, true);

  const dryRun = engine.applyKnowledgeDelta(tmpRoot, deltaPath, { dryRun: true });
  assert.strictEqual(dryRun.dryRun, true);
  assert.deepStrictEqual(dryRun.conflicts, []);

  const applied = engine.applyKnowledgeDelta(tmpRoot, deltaPath);
  assert.strictEqual(applied.dryRun, false);
  assert.deepStrictEqual(applied.conflicts, []);
  assert(applied.changedFiles.includes(".Knowledge/topics/topic-a.md"));
  assert(applied.changedFiles.includes(".Knowledge/manifest-routing.json"));

  const topicA = fs.readFileSync(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-a.md"),
    "utf8",
  );
  assert(topicA.includes("revision: 2"));
  assert(topicA.includes("New reusable fact."));
  assert(topicA.includes("dependsOn: [topic-b]"));

  const routing = JSON.parse(
    fs.readFileSync(path.join(tmpRoot, ".Knowledge", "manifest-routing.json"), "utf8"),
  );
  assert.deepStrictEqual(routing.topicDependencies["topic-a"], ["topic-b"]);
  assert.strictEqual(
    routing.taskToTopicRules[0].summary,
    "test capability rules and boundaries",
  );

  const staleDelta = {
    taskId: "task-2",
    developerId: "alice",
    baseRevisions: {
      "topic-a": 0,
    },
    changes: [
      {
        type: "appendBody",
        targetTopic: "topic-a",
        content: "stale change",
      },
    ],
  };
  const stalePlan = engine.planKnowledgeDelta(
    engine.loadKnowledgeGraph(tmpRoot),
    staleDelta,
  );
  assert.strictEqual(stalePlan.mergeable, false);
  assert.strictEqual(stalePlan.conflicts[0].reason, "revision mismatch 0 -> 2");

  const createDelta = {
    taskId: "task-3",
    developerId: "alice",
    changes: [
      {
        type: "createTopic",
        targetTopic: "topic-c",
        summary: "create new topic",
        content: "# Topic C\n\nInitial fact.",
        frontmatter: {
          summary: "Topic C summary",
          primary: "feature",
          confidence: "inferred",
          dependsOn: ["topic-a"],
        },
        taskRule: {
          task: "topic-c-task",
          matcherId: "m-topic-c-task",
          topics: ["topic-c"],
        },
        matcher: {
          includeAny: ["topic c", "new capability"],
        },
      },
      {
        type: "appendBody",
        targetTopic: "topic-c",
        content: "## Extra\n\nAdditional detail.",
      },
    ],
  };
  const createPlan = engine.planKnowledgeDelta(
    engine.loadKnowledgeGraph(tmpRoot),
    createDelta,
  );
  assert.strictEqual(createPlan.mergeable, true);
  assert.strictEqual(createPlan.plan[0].type, "createTopic");
  assert.strictEqual(createPlan.plan[1].afterRevision, 1);

  const created = engine.applyKnowledgeDelta(tmpRoot, createDelta);
  assert(created.changedFiles.includes(".Knowledge/topics/topic-c.md"));
  assert(created.changedFiles.includes(".Knowledge/matchers/m-topic-c-task.json"));
  assert(created.changedFiles.includes(".Knowledge/manifest-matchers.json"));
  assert(created.changedFiles.includes(".Knowledge/manifest-routing.json"));

  const topicC = fs.readFileSync(
    path.join(tmpRoot, ".Knowledge", "topics", "topic-c.md"),
    "utf8",
  );
  assert(topicC.includes("id: topic-c"));
  assert(topicC.includes("revision: 1"));
  assert(topicC.includes("Additional detail."));

  const routingAfterCreate = JSON.parse(
    fs.readFileSync(path.join(tmpRoot, ".Knowledge", "manifest-routing.json"), "utf8"),
  );
  assert.strictEqual(
    routingAfterCreate.topicPaths["topic-c"],
    ".Knowledge/topics/topic-c.md",
  );
  assert.deepStrictEqual(routingAfterCreate.topicDependencies["topic-c"], ["topic-a"]);
  assert(
    routingAfterCreate.taskToTopicRules.some(
      (rule) =>
        rule.task === "topic-c-task" &&
        rule.matcherPath === ".Knowledge/matchers/m-topic-c-task.json",
    ),
  );

  const matcherC = JSON.parse(
    fs.readFileSync(
      path.join(tmpRoot, ".Knowledge", "matchers", "m-topic-c-task.json"),
      "utf8",
    ),
  );
  assert.strictEqual(matcherC.id, "m-topic-c-task");
  assert.deepStrictEqual(matcherC.includeAny, ["topic c", "new capability"]);

  assert.throws(
    () =>
      engine.parseKnowledgeDelta({
        taskId: "task-4",
        developerId: "alice",
        changes: [
          {
            type: "createTopic",
            targetTopic: "topic-d",
            content: "# Topic D",
            taskRule: {
              task: "topic-d-task",
            },
          },
        ],
      }),
    /带 taskRule 时必须同时提供 matcher/,
  );

  const built = engine.buildKnowledgeGraph(tmpRoot);
  assert.strictEqual(built.validation.ok, true);

  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-kb-legacy-"));
  try {
    writeJson(path.join(legacyRoot, ".Knowledge", "manifest-routing.json"), {
      version: "test",
      knowledgeRoot: ".Knowledge",
      matcherKey: "matcherId",
      sourceOfTruth: ".Knowledge/manifest-routing.json",
      fallbackTopic: "legacy-topic",
      topicDependencies: {},
      topicPaths: {
        "legacy-topic": ".Knowledge/topics/legacy-topic.md",
      },
      taskToTopicRules: [],
      topicMetadata: {
        "legacy-topic": {
          primary: "policy",
          confidence: "manual",
        },
      },
    });
    writeText(
      path.join(legacyRoot, ".Knowledge", "topics", "legacy-topic.md"),
      "# Legacy Topic\n\nNo frontmatter yet.\n",
    );
    const legacyBefore = engine.validateKnowledgeGraph(
      engine.loadKnowledgeGraph(legacyRoot),
      { strictRevision: true },
    );
    assert(
      legacyBefore.issues.includes("topic revision missing: legacy-topic"),
      "legacy topic should fail strict revision before fix",
    );
    const legacyBuilt = engine.buildKnowledgeGraph(legacyRoot, {
      writeTopicFrontmatter: true,
    });
    assert.deepStrictEqual(legacyBuilt.topicFrontmatterChanged, [
      ".Knowledge/topics/legacy-topic.md",
    ]);
    const legacyAfter = engine.validateKnowledgeGraph(
      engine.loadKnowledgeGraph(legacyRoot),
      { strictRevision: true },
    );
    assert.deepStrictEqual(legacyAfter.issues, []);
    assert.deepStrictEqual(legacyAfter.warnings, []);
  } finally {
    fs.rmSync(legacyRoot, { recursive: true, force: true });
  }

  // ---------- H2: parse-time validation for empty content ----------
  assert.throws(
    () =>
      engine.parseKnowledgeDelta({
        taskId: "task-empty-append",
        developerId: "alice",
        changes: [
          {
            type: "appendBody",
            targetTopic: "topic-a",
            content: "",
          },
        ],
      }),
    /appendBody 缺少 content/,
    "appendBody 空 content 必须在 parse 阶段就报错",
  );

  assert.throws(
    () =>
      engine.parseKnowledgeDelta({
        taskId: "task-empty-replace",
        developerId: "alice",
        changes: [
          {
            type: "replaceBody",
            targetTopic: "topic-a",
            content: "   \n\n   ",
          },
        ],
      }),
    /replaceBody 缺少 content/,
    "replaceBody 纯空白 content 也必须在 parse 阶段报错",
  );

  // 验证 kb status 面对损坏 delta 时不会崩溃，而是把错误折叠到 task.error
  const brokenDeltaPath = path.join(
    tmpRoot,
    ".task",
    "alice",
    "active",
    "task-broken",
    "kb-delta.json",
  );
  writeJson(brokenDeltaPath, {
    taskId: "task-broken",
    developerId: "alice",
    changes: [
      {
        type: "appendBody",
        targetTopic: "topic-a",
        content: "",
      },
    ],
  });
  const brokenState = engine.summarizeKnowledgeState(tmpRoot);
  const brokenTask = brokenState.tasks.find((t) => t.taskName === "task-broken");
  assert(brokenTask, "kb status 应该看到 task-broken");
  assert.match(
    brokenTask.error || "",
    /appendBody 缺少 content/,
    "kb status 应该以结构化 error 呈现，而不是抛异常",
  );
  // 清理，避免影响后续断言
  fs.rmSync(path.dirname(brokenDeltaPath), { recursive: true, force: true });

  // ---------- L3: routing drift detection ----------
  const driftRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flow2spec-kb-drift-"));
  try {
    writeJson(path.join(driftRoot, ".Knowledge", "manifest-routing.json"), {
      version: "test",
      knowledgeRoot: ".Knowledge",
      matcherKey: "matcherId",
      sourceOfTruth: ".Knowledge/manifest-routing.json",
      fallbackTopic: "topic-x",
      topicDependencies: {}, // 与下面 topic-x frontmatter 的 dependsOn 不一致
      topicPaths: {
        "topic-x": ".Knowledge/topics/topic-x.md",
        "topic-y": ".Knowledge/topics/topic-y.md",
      },
      taskToTopicRules: [],
      topicMetadata: {
        "topic-x": { primary: "policy", confidence: "manual" },
        "topic-y": { primary: "feature", confidence: "manual" },
      },
    });
    writeJson(path.join(driftRoot, ".Knowledge", "manifest-matchers.json"), {
      version: "1.0.0",
      generatedFrom: ".Knowledge/manifest-routing.json",
      matcherKey: "matcherId",
      sourceOfTruth: ".Knowledge/manifest-routing.json",
      matchers: {},
    });
    writeText(
      path.join(driftRoot, ".Knowledge", "topics", "topic-x.md"),
      [
        "---",
        "id: topic-x",
        "revision: 0",
        "primary: policy",
        "confidence: manual",
        "dependsOn: [topic-y]",
        "---",
        "# Topic X",
        "",
      ].join("\n"),
    );
    writeText(
      path.join(driftRoot, ".Knowledge", "topics", "topic-y.md"),
      [
        "---",
        "id: topic-y",
        "revision: 0",
        "primary: feature",
        "confidence: manual",
        "---",
        "# Topic Y",
        "",
      ].join("\n"),
    );

    const driftState = engine.summarizeKnowledgeState(driftRoot);
    assert.strictEqual(
      driftState.routingDrift,
      true,
      "topic frontmatter 与 routing.topicDependencies 不一致时必须报 drift",
    );

    // dry-run 不写盘：文件内容维持 drift
    engine.buildKnowledgeGraph(driftRoot, { dryRun: true });
    const beforeWrite = JSON.parse(
      fs.readFileSync(
        path.join(driftRoot, ".Knowledge", "manifest-routing.json"),
        "utf8",
      ),
    );
    assert.deepStrictEqual(
      beforeWrite.topicDependencies,
      {},
      "dry-run 不能写回 routing",
    );

    // 真正 build：应写回 dependsOn
    const built = engine.buildKnowledgeGraph(driftRoot);
    assert.strictEqual(built.changed, true, "buildKnowledgeGraph 应报告 changed");
    const afterWrite = JSON.parse(
      fs.readFileSync(
        path.join(driftRoot, ".Knowledge", "manifest-routing.json"),
        "utf8",
      ),
    );
    assert.deepStrictEqual(
      afterWrite.topicDependencies["topic-x"],
      ["topic-y"],
      "build 后 routing.topicDependencies 应对齐 topic frontmatter",
    );

    // 再次检查：drift 应消失
    const driftStateAfter = engine.summarizeKnowledgeState(driftRoot);
    assert.strictEqual(driftStateAfter.routingDrift, false);
  } finally {
    fs.rmSync(driftRoot, { recursive: true, force: true });
  }

  console.log("knowledge engine tests passed");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
