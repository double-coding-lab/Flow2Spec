#!/usr/bin/env node
"use strict";
/**
 * 从 @double-coding/flow2spec-core 生成 Qoder 原生插件（全量能力）。
 * Core 是唯一事实源：skills/rules 走 resources 公共 API（dsh host 适配 =
 * 纯 rules/ skills/ 相对路径 + 技能名 kebab-case，恰好匹配 Qoder 插件布局），
 * hooks 按 init 同款规则渲染 __FLOW2SPEC_*__ 占位符。
 *
 * 用法：node scripts/build-qoder-plugin.js [--locale zh-CN|en-US] [--out <dir>]
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const core = require("@double-coding/flow2spec-core");

const PLUGIN_NAME = "flow2spec";
const HOST = "dsh";

function parseArgs(argv) {
  const args = { locale: "zh-CN", out: path.join("output", "qoder-plugin") };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--locale" && argv[i + 1]) args.locale = argv[(i += 1)];
    else if (argv[i] === "--out" && argv[i + 1]) args.out = argv[(i += 1)];
  }
  return args;
}

function kebabSkillNames(content) {
  // 与 core resources 的 dsh host 技能名规则保持一致（addRules -> add-rules）
  return String(content).replace(/\bf2s-[a-zA-Z0-9-]*[A-Z][a-zA-Z0-9-]*\b/g, (name) =>
    name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function renderHook(raw, metadata) {
  return String(raw)
    .replace(/__FLOW2SPEC_PACKAGE_NAME__/g, metadata.name)
    .replace(/__FLOW2SPEC_CORE_VERSION__/g, metadata.coreVersion)
    .replace(/__FLOW2SPEC_TEMPLATE_VERSION__/g, metadata.templateVersion);
}

// ---- 零依赖 ZIP 打包（deflate，zip 根目录即插件根，含 .qoder-plugin/plugin.json）----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function listFilesRecursive(root, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFilesRecursive(path.join(root, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function zipDirectory(rootDir, zipPath) {
  const { time, date } = dosDateTime(new Date());
  const chunks = [];
  const centralEntries = [];
  let offset = 0;

  for (const relative of listFilesRecursive(rootDir)) {
    const data = fs.readFileSync(path.join(rootDir, ...relative.split("/")));
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const nameBuffer = Buffer.from(relative, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    chunks.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralEntries.push(Buffer.concat([central, nameBuffer]));

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralEntries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centralEntries.length, 8);
  eocd.writeUInt16LE(centralEntries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  fs.writeFileSync(zipPath, Buffer.concat([...chunks, centralDirectory, eocd]));
}

const HOOKS_JSON = {
  hooks: {
    SessionStart: [
      {
        hooks: [
          {
            type: "command",
            command: 'node "${QODER_PLUGIN_ROOT}/hooks/f2s-config-session.js"',
            timeout: 10,
            statusMessage: "Flow2Spec 配置摘要注入",
          },
          {
            type: "command",
            command: 'node "${QODER_PLUGIN_ROOT}/hooks/f2s-update-check.js"',
            timeout: 15,
            statusMessage: "Flow2Spec 知识库版本检查",
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Skill",
        hooks: [
          {
            type: "command",
            command: 'node "${QODER_PLUGIN_ROOT}/hooks/f2s-config-inject.js"',
            timeout: 10,
          },
        ],
      },
    ],
  },
};

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)"/>
  <path d="M28 78 C 46 78, 46 50, 64 50 C 82 50, 82 78, 100 78"
        fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round"/>
  <circle cx="28" cy="78" r="7" fill="#ffffff" fill-opacity="0.9"/>
  <circle cx="64" cy="50" r="7" fill="#ffffff" fill-opacity="0.9"/>
  <circle cx="100" cy="78" r="7" fill="#ffffff" fill-opacity="0.9"/>
  <text x="64" y="108" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="26" font-weight="700" fill="#ffffff">F2S</text>
</svg>
`;

function pluginManifest(versions) {
  return {
    name: PLUGIN_NAME,
    displayName: "Flow2Spec",
    version: versions.coreVersion,
    description:
      "Spec-driven dev workflow suite: requirement clarification, tech design, task planning, knowledge-base lifecycle (build/sync/feat/fix/merge), docs tooling, and safe git commits, backed by a routed project knowledge base (.Knowledge).",
    descriptionZh:
      "Spec-driven 研发工作流全量套件：需求澄清、技术方案、任务规划、知识库全生命周期（build/sync/feat/fix/merge 等）、文档工具与安全 Git 提交，基于可路由的项目知识库（.Knowledge）。",
    author: { name: "double-coding-lab" },
    homepage: "https://github.com/double-coding-lab/Flow2Spec#readme",
    repository: "https://github.com/double-coding-lab/Flow2Spec",
    logo: "./assets/avatar.svg",
    keywords: ["qoder-plugin", "skill", "workflow", "spec-driven", "knowledge-base"],
    category: "developer-tools",
    tags: ["skill", "rules", "hooks", "workflow"],
    skills: "./skills/",
    rules: "./rules/",
    hooks: "./hooks/hooks.json",
  };
}

function readmeContent({ locale, versions, skills, ruleIds, hookNames }) {
  const skillRows = skills
    .map((skill) => {
      const description = skill.description.replace(/\|/g, "\\|");
      const brief = description.length > 90 ? `${description.slice(0, 90)}…` : description;
      return `| \`${skill.name}\` | ${brief} |`;
    })
    .join("\n");
  const ruleList = ruleIds.map((id) => `- \`${id}\``).join("\n");
  const hookList = hookNames.map((name) => `- \`${name}\``).join("\n");
  return `# Flow2Spec — Qoder 插件（全量）

Spec-driven 研发工作流全量套件，基于可路由的项目知识库（\`.Knowledge/\`）。
由 \`scripts/build-qoder-plugin.js\` 从 \`@double-coding/flow2spec-core\` v${versions.coreVersion}（Template v${versions.templateVersion}，locale ${locale}）自动生成，请勿手工编辑本目录。

## Skills（${skills.length} 个）

| 技能 | 说明 |
| --- | --- |
${skillRows}

## Rules（${ruleIds.length} 条）

${ruleList}

## Hooks

${hookList}

接线见 \`hooks/hooks.json\`：SessionStart 注入配置摘要与知识库版本检查，PreToolUse(matcher: Skill) 兜底注入配置提示；脚本经 \`\${QODER_PLUGIN_ROOT}\` 定位，占位符已按 Core 版本渲染。

## 使用前提（重要）

1. **目标项目须先初始化 Flow2Spec**：项目根执行 \`npx @double-coding/flow2spec init\`，生成 \`.Knowledge/\`（知识路由）与 \`flow2spec.config.json\`（编排开关）；未初始化时技能会提示先执行 init。
2. **Hooks 依赖 Node.js**（>=16）在 PATH 中可用；hooks 仅做提醒/检测，不替代技能正文的 \`Read("flow2spec.config.json")\` 门禁。

## 来源与说明

- 唯一事实源：\`@double-coding/flow2spec-core\` 的 \`resources\` 公共 API（dsh host 适配：纯 \`rules/\` \`skills/\` 相对路径、技能名 kebab-case）。
- 技能内部引用（如 \`f2s-kb-addRules\`）已统一为 kebab-case 名称。
- \`.Knowledge/\` 知识模板属项目级资产，由 \`flow2spec init\` 写入，不随插件分发。
- Logo（\`assets/avatar.svg\`）为本插件自制。
- 构建同时产出同级 \`flow2spec-<version>.zip\`（zip 根即插件根，可直接导入或上传市场）。
`;
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, "..");
  const pluginRoot = path.resolve(repoRoot, args.out, PLUGIN_NAME);
  const versions = core.getVersions();
  const api = core.createFlow2Spec({ cwd: repoRoot });
  const corePackage = JSON.parse(
    fs.readFileSync(path.join(core.resourcesRoot, "package.json"), "utf8"),
  );

  fs.rmSync(pluginRoot, { recursive: true, force: true });

  // Skills（全量，dsh host 适配）+ 各技能引用的 rules（已适配路径）
  const catalog = api.resources.skillCatalog({ host: HOST, locale: args.locale });
  const rules = new Map();
  for (const skill of catalog) {
    const frontmatter = `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n`;
    writeFile(path.join(pluginRoot, "skills", skill.name, "SKILL.md"), frontmatter + skill.content);
    for (const resource of skill.resources) {
      if (!rules.has(resource.relativePath)) rules.set(resource.relativePath, resource.content);
    }
  }

  // 未被任何技能引用的独立 rules 也全量带上（仅做技能名 kebab-case 对齐）
  for (const relative of api.resources.listRules(args.locale)) {
    const target = path.posix.join("rules", relative);
    if (!rules.has(target)) {
      rules.set(target, kebabSkillNames(api.resources.read(path.posix.join("rules", relative), args.locale)));
    }
  }
  for (const [relativePath, content] of rules) {
    writeFile(path.join(pluginRoot, ...relativePath.split("/")), content);
  }

  // Hooks：占位符按 init 同款规则渲染
  const hookMetadata = {
    name: corePackage.name,
    coreVersion: versions.coreVersion,
    templateVersion: versions.templateVersion,
  };
  const hookNames = api.resources.listHooks(args.locale);
  for (const hookName of hookNames) {
    const raw = api.resources.read(path.posix.join("hooks", hookName), args.locale);
    writeFile(path.join(pluginRoot, "hooks", hookName), renderHook(raw, hookMetadata));
  }
  writeFile(path.join(pluginRoot, "hooks", "hooks.json"), `${JSON.stringify(HOOKS_JSON, null, 2)}\n`);

  writeFile(
    path.join(pluginRoot, ".qoder-plugin", "plugin.json"),
    `${JSON.stringify(pluginManifest(versions), null, 2)}\n`,
  );
  writeFile(path.join(pluginRoot, "assets", "avatar.svg"), AVATAR_SVG);
  writeFile(
    path.join(pluginRoot, "README.md"),
    readmeContent({
      locale: args.locale,
      versions,
      skills: catalog,
      ruleIds: Array.from(rules.keys()).map((p) => path.posix.basename(p, ".md")).sort(),
      hookNames,
    }),
  );

  console.log(`[build-qoder-plugin] plugin: ${pluginRoot}`);
  console.log(`[build-qoder-plugin] skills: ${catalog.length}, rules: ${rules.size}, hooks: ${hookNames.length}`);
  console.log(`[build-qoder-plugin] core v${versions.coreVersion}, template v${versions.templateVersion}, locale ${args.locale}`);

  // Zip 分发包：清理旧版本 zip 后重新生成
  const outDir = path.dirname(pluginRoot);
  for (const entry of fs.readdirSync(outDir)) {
    if (entry.startsWith(`${PLUGIN_NAME}-`) && entry.endsWith(".zip")) {
      fs.rmSync(path.join(outDir, entry), { force: true });
    }
  }
  const zipPath = path.join(outDir, `${PLUGIN_NAME}-${versions.coreVersion}.zip`);
  zipDirectory(pluginRoot, zipPath);
  console.log(`[build-qoder-plugin] zip: ${zipPath}`);
}

main();
