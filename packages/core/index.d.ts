export type Flow2SpecLocale = "zh-CN" | "en-US";
export type Flow2SpecHost = "dsh" | "cursor" | "claude" | "codex";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Flow2SpecProjectConfig {
  subAgent?: boolean;
  switchAgentVerification?: boolean;
  intentRecognition?: boolean;
  locale?: Flow2SpecLocale;
  changeTracking?: {
    feat?: boolean;
    fix?: boolean;
    implement?: boolean;
    [key: string]: boolean | undefined;
  };
  updateCheck?: {
    enabled?: boolean;
    [key: string]: JsonValue | undefined;
  };
  collaboration?: {
    enabled?: boolean;
    developerId?: string;
    [key: string]: JsonValue | undefined;
  };
  [key: string]: unknown;
}

export interface CreateFlow2SpecOptions {
  cwd?: string;
  signal?: AbortSignal;
  onProgress?: (event: unknown) => void;
}

export interface ProjectInitOptions {
  mode?: "native-host" | "project-adapter" | string;
  integrations?: Flow2SpecHost[] | string[];
  locale?: Flow2SpecLocale;
  overwriteKnowledge?: boolean;
  configValues?: Partial<Flow2SpecProjectConfig>;
  [key: string]: unknown;
}

export interface ProjectInitResult {
  ids: string[];
  mode: string;
  overwriteKnowledge: boolean;
  locale: Flow2SpecLocale;
  projectConfig: Flow2SpecProjectConfig;
  [key: string]: unknown;
}

export interface ProjectInspection {
  cwd: string;
  config: Flow2SpecProjectConfig;
}

export interface RoutingRule {
  task?: string;
  matcherId?: string;
  matcherPath?: string;
  topics?: string[];
  [key: string]: JsonValue | undefined;
}

export interface RoutingCandidate {
  rule: RoutingRule | null;
  score: number;
  order?: number;
  confidence: "high" | "medium" | "low";
  matchedPhrases: string[];
  topics: string[];
  fallback?: boolean;
}

export interface RoutingMatchInput {
  request?: string;
  query?: string;
  task?: string;
}

export interface RoutingMatchResult {
  request: string;
  task: string | null;
  primary: RoutingCandidate;
  alternatives: RoutingCandidate[];
  candidates: RoutingCandidate[];
  manifestVersion: string;
  topics?: string[];
}

export interface RoutingMissingContext {
  kind: "topic" | "context";
  id?: string;
  path: string | null;
}

export interface RoutingVerification {
  ok: boolean;
  missing: RoutingMissingContext[];
  confidence: "high" | "medium" | "low";
  fallback: boolean;
}

export interface RoutingContextFile {
  topic: string;
  path: string;
  content: string;
  truncated: boolean;
}

export interface RoutingContext {
  files: RoutingContextFile[];
  lineCount: number;
  truncated: boolean;
}

export interface KnowledgeValidation {
  ok: boolean;
  issues: string[];
  warnings: string[];
  topicCount: number;
}

export type KnowledgeDeltaChangeType =
  | "createTopic"
  | "appendBody"
  | "replaceBody"
  | "updateFrontmatter";

export interface KnowledgeDeltaChange {
  type: KnowledgeDeltaChangeType | string;
  targetTopic: string;
  content?: string;
  frontmatter?: Record<string, JsonValue>;
  [key: string]: unknown;
}

export interface KnowledgeDelta {
  taskId: string;
  developerId: string;
  baseRevisions: Record<string, number>;
  changes: KnowledgeDeltaChange[];
  notes?: string;
}

export interface KnowledgePlanResult {
  delta: KnowledgeDelta;
  plan: unknown[];
  conflicts: unknown[];
  mergeable: boolean;
  [key: string]: unknown;
}

export interface KnowledgeApplyResult {
  dryRun: boolean;
  changedFiles: string[];
  plan: unknown[];
  [key: string]: unknown;
}

export interface DeveloperContext {
  developerId: string | null;
  source: "config" | "git-email" | "git-email-hash" | "git-name" | "git-name-hash" | "legacy";
  legacy: boolean;
  taskRoot: string;
  enabled: boolean;
  warnings: string[];
}

export type DoctorCheckStatus = "pass" | "warning" | "error";

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorCheckStatus;
  message: string;
  repair: string | null;
  details?: unknown;
}

export interface DoctorReport {
  ok: boolean;
  package: { name: string; version: string };
  cwd: string;
  summary: { passed: number; warnings: number; errors: number };
  checks: DoctorCheck[];
}

export interface CapabilityDefinition {
  id: string;
  api: string;
  since: string;
}

export interface CapabilityManifest {
  schema: "flow2spec.capabilities.v1" | string;
  protocolVersion: number;
  package: string;
  capabilities: CapabilityDefinition[];
}

export interface HostResourceOptions {
  host: Flow2SpecHost;
  locale?: Flow2SpecLocale;
  projectConfig?: Flow2SpecProjectConfig;
}

export interface Flow2SpecTextResource {
  relativePath: string;
  content: string;
  mediaType: "text/markdown";
}

export interface Flow2SpecSkillResource {
  name: string;
  description: string;
  content: string;
  relativePath: string;
  resources: readonly Flow2SpecTextResource[];
}

export type UpdateCheckStatus =
  | "disabled"
  | "skipped"
  | "current"
  | "upgrade-available"
  | "unavailable";

export interface UpdateCheckOptions {
  packageName?: string;
  force?: boolean;
  signal?: AbortSignal;
  timeout?: number;
}

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  checked: boolean;
  fromCache: boolean;
  packageName: string;
  manifestVersion: string | null;
  latestVersion: string | null;
  needsUpgrade: boolean;
  notice: string;
  checkedAt: number | null;
  reason: string | null;
}

export interface Flow2SpecApi {
  context: {
    cwd: string;
    signal?: AbortSignal;
    onProgress: (event: unknown) => void;
  };
  project: {
    init(options?: ProjectInitOptions): Promise<ProjectInitResult>;
    inspect(): ProjectInspection;
  };
  config: {
    load(): Flow2SpecProjectConfig;
    missingFields(): unknown[];
  };
  routing: {
    graph(): unknown;
    state(): { graph: unknown; validation: KnowledgeValidation };
    match(input?: RoutingMatchInput): RoutingMatchResult;
    expand(result: RoutingMatchResult): RoutingMatchResult & { topics: string[] };
    verify(
      result: RoutingMatchResult,
      options?: { requiredContext?: string[] },
    ): RoutingVerification;
    loadContext(
      result: RoutingMatchResult,
      options?: { maxFiles?: number; maxLines?: number },
    ): RoutingContext;
  };
  knowledge: {
    status(options?: Record<string, unknown>): unknown;
    check(options?: { strict?: boolean; strictRevision?: boolean }): KnowledgeValidation;
    plan(options?: { delta?: KnowledgeDelta; deltaFile?: string }): KnowledgePlanResult;
    apply(options?: {
      delta?: KnowledgeDelta;
      deltaFile?: string;
      dryRun?: boolean;
      planHash?: string;
      [key: string]: unknown;
    }): KnowledgeApplyResult;
    build(options?: Record<string, unknown>): unknown;
  };
  collaboration: {
    resolveDeveloper(options?: Record<string, unknown>): DeveloperContext;
  };
  doctor: {
    run(options?: Record<string, unknown>): DoctorReport;
  };
  resources: {
    root: string;
    capabilities(): CapabilityManifest;
    listSkills(locale?: Flow2SpecLocale): string[];
    listRules(locale?: Flow2SpecLocale): string[];
    listHooks(locale?: Flow2SpecLocale): string[];
    read(relativePath: string, locale?: Flow2SpecLocale): string;
    skillCatalog(options: HostResourceOptions): Flow2SpecSkillResource[];
    unifiedEntry(options: HostResourceOptions): string;
  };
  update: {
    check(options?: UpdateCheckOptions): Promise<UpdateCheckResult>;
  };
}

export class Flow2SpecError extends Error {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    options?: { recoverable?: boolean },
  );
  code: string;
  details: Record<string, unknown>;
  recoverable: boolean;
}

export function createFlow2Spec(options?: CreateFlow2SpecOptions): Flow2SpecApi;
export function getCapabilities(): CapabilityManifest;
export const resourcesRoot: string;
export const legacy: Record<string, unknown>;
