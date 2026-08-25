const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const engine = require("../packages/core/lib/knowledgeEngine");

const repoRoot = path.resolve(__dirname, "..");
const locales = ["zh-CN", "en-US"];

for (const locale of locales) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `flow2spec-template-${locale}-`));
  try {
    const source = path.join(repoRoot, "packages", "core", "templates", locale, "knowledge");
    const target = path.join(tmpRoot, ".Knowledge");
    fs.cpSync(source, target, { recursive: true });

    const graph = engine.loadKnowledgeGraph(tmpRoot);
    const validation = engine.validateKnowledgeGraph(graph, {
      strictRevision: true,
    });
    assert.deepStrictEqual(validation.issues, []);
    assert.deepStrictEqual(validation.warnings, []);

    for (const topic of graph.topics) {
      assert.strictEqual(topic.exists, true, `${locale}: ${topic.topicId} should exist`);
      assert.strictEqual(
        topic.frontmatter.id,
        topic.topicId,
        `${locale}: ${topic.topicId} should declare matching id`,
      );
      assert.strictEqual(
        Number.isInteger(Number(topic.frontmatter.revision)),
        true,
        `${locale}: ${topic.topicId} should declare numeric revision`,
      );
    }

    const normalized = engine.normalizeRoutingWithGraph(graph);
    assert.deepStrictEqual(
      normalized.routing.topicMetadata,
      graph.routing.topicMetadata,
      `${locale}: topicMetadata should be derivable from topic frontmatter`,
    );
    assert.deepStrictEqual(
      normalized.routing.topicDependencies || {},
      graph.routing.topicDependencies || {},
      `${locale}: topicDependencies should be derivable from topic frontmatter`,
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

console.log("template knowledge tests passed");
