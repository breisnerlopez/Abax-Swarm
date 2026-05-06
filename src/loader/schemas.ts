import { z } from "zod";

// ============================================================
// Enums and shared types
// ============================================================

export const RoleTier = z.enum(["1", "2", "3"]);
export type RoleTier = z.infer<typeof RoleTier>;

export const AgentMode = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof AgentMode>;

export const PermissionLevel = z.enum(["allow", "deny", "ask"]);
export type PermissionLevel = z.infer<typeof PermissionLevel>;

export const SizeClassification = z.enum(["indispensable", "recommended", "optional", "conditional"]);
export type SizeClassification = z.infer<typeof SizeClassification>;

export const ProjectSize = z.enum(["small", "medium", "large"]);
export type ProjectSize = z.infer<typeof ProjectSize>;

export const RaciValue = z.enum(["R", "A", "C", "I", "A/R"]);
export type RaciValue = z.infer<typeof RaciValue>;

export const RoleCategory = z.enum([
  "governance",
  "business",
  "management",
  "analysis",
  "architecture",
  "security",
  "technology",
  "construction",
  "data",
  "quality",
  "validation",
  "deployment",
  "operations",
  "change",
  "documentation",
  "platform",
  "control",
  "experience",
]);
export type RoleCategory = z.infer<typeof RoleCategory>;

// ============================================================
// Role Schema
// ============================================================

const StackOverrideSchema = z.object({
  prompt_append: z.string().optional(),
  instructions_append: z.string().optional(),
  tools_add: z.array(z.string()).optional(),
  tools_remove: z.array(z.string()).optional(),
});

export const CognitiveTier = z.enum(["strategic", "implementation", "mechanical"]);
export type CognitiveTier = z.infer<typeof CognitiveTier>;

export const ReasoningLevel = z.enum(["none", "low", "medium", "high"]);
export type ReasoningLevel = z.infer<typeof ReasoningLevel>;

const AgentConfigSchema = z.object({
  mode: AgentMode.default("subagent"),
  temperature: z.number().min(0).max(1).default(0.3),
  description: z.string().min(10).max(1024),
  system_prompt: z.string().min(50),
  permissions: z
    .record(z.string(), PermissionLevel)
    .default({ read: "allow", edit: "allow", bash: "deny" }),
  tools_enabled: z.record(z.string(), z.boolean()).default({}),
  cognitive_tier: CognitiveTier.default("implementation"),
  reasoning: ReasoningLevel.default("none"),
  // Optional override for the OpenCode TUI color. Hex (e.g. "#ff6b6b") or theme key
  // (primary | secondary | accent | success | warning | error | info). If omitted,
  // src/engine/color-resolver.ts assigns one deterministically from a curated palette.
  color: z.string().optional(),
});

const DependencyBlockSchema = z.object({
  receives_from: z.array(z.string()).default([]),
  delivers_to: z.array(z.string()).default([]),
});

export const RoleSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Role ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  category: RoleCategory,
  tier: RoleTier,
  size_classification: z.object({
    small: SizeClassification,
    medium: SizeClassification,
    large: SizeClassification,
  }),
  agent: AgentConfigSchema,
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  stack_overrides: z.record(z.string(), StackOverrideSchema).default({}),
  dependencies: DependencyBlockSchema.default({ receives_from: [], delivers_to: [] }),
  phases: z.array(z.string()).default([]),
  raci: z.record(z.string(), RaciValue).default({}),
});
export type Role = z.infer<typeof RoleSchema>;

// ============================================================
// Skill Schema
// ============================================================

const SkillGuideSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(10),
});

export const SkillSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Skill ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(1024),
  used_by: z.array(z.string()).min(1),
  content: z.object({
    when_to_use: z.string().min(10),
    instructions: z.string().min(20),
    guides: z.array(SkillGuideSchema).default([]),
  }),
  stack_overrides: z.record(z.string(), z.object({ instructions_append: z.string() })).default({}),
});
export type Skill = z.infer<typeof SkillSchema>;

// ============================================================
// Tool Schema
// ============================================================

const ToolArgSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().min(5),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().default(true),
});

export const ToolSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Tool ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(1024),
  used_by: z.array(z.string()).min(1),
  implementation: z.object({
    language: z.enum(["typescript", "javascript", "python", "bash"]).default("typescript"),
    args: z.record(z.string(), ToolArgSchema).default({}),
    returns: z.string().default("string"),
    body: z.string().min(5),
  }),
});
export type Tool = z.infer<typeof ToolSchema>;

// ============================================================
// Stack Schema
// ============================================================

const StackLayerSchema = z.object({
  framework: z.string(),
  language: z.string(),
  version: z.string().optional(),
  package_manager: z.string().optional(),
  test_framework: z.string().optional(),
  build_tool: z.string().optional(),
  orm: z.string().optional(),
  /** Executable test command for this layer (e.g. "mvn -q test", "pytest -v",
   * "go test ./..."). Resolved by the verify-deliverable tool when a
   * deliverable's `verification[].cmd` contains the placeholder
   * "{stack.<layer>.test_command}". Optional — legacy/unknown stacks omit it. */
  test_command: z.string().optional(),
  /** Executable build command for this layer (e.g. "mvn package", "npm run
   * build", "cargo build --release"). Resolved analogously via
   * "{stack.<layer>.build_command}". */
  build_command: z.string().optional(),
});

export const StackSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Stack ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(512),
  frontend: StackLayerSchema.optional(),
  backend: StackLayerSchema.optional(),
  database: z
    .object({
      default: z.string(),
      alternatives: z.array(z.string()).default([]),
    })
    .optional(),
  devops: z
    .object({
      containerization: z.string().optional(),
      orchestration: z.string().optional(),
      ci_cd: z.string().optional(),
      cloud: z.string().optional(),
    })
    .optional(),
  role_context: z.record(z.string(), z.string()).default({}),
});
export type Stack = z.infer<typeof StackSchema>;

// ============================================================
// Rules Schemas
// ============================================================

export const SizeMatrixSchema = z.object({
  roles_by_size: z.object({
    small: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
    medium: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
    large: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
  }),
});
export type SizeMatrix = z.infer<typeof SizeMatrixSchema>;

const CriterionSchema = z.object({
  id: z.string(),
  question: z.string().min(10),
  adds_roles: z.array(z.string()).min(1),
});

export const CriteriaRulesSchema = z.object({
  criteria: z.array(CriterionSchema).min(1),
});
export type CriteriaRules = z.infer<typeof CriteriaRulesSchema>;

const DependencyEntrySchema = z.object({
  hard: z.array(z.string()).default([]),
  soft: z.array(z.string()).default([]),
});

export const DependencyGraphSchema = z.object({
  dependencies: z.record(z.string(), DependencyEntrySchema),
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

export const RaciMatrixSchema = z.object({
  activities: z.record(z.string(), z.record(z.string(), RaciValue)),
});
export type RaciMatrix = z.infer<typeof RaciMatrixSchema>;

// ============================================================
// Iron Laws Schema
// ============================================================

const IronLawSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  applies_to: z.array(z.string()).min(1),
  law: z.string().min(10),
  rationale: z.string().min(10),
  violations: z.array(z.string()).default([]),
});

export const IronLawsSchema = z.object({
  iron_laws: z.array(IronLawSchema).min(1),
});
export type IronLaws = z.infer<typeof IronLawsSchema>;

// ============================================================
// Anti-Rationalization Schema
// ============================================================

const RedFlagGroupSchema = z.object({
  category: z.string().min(3),
  applies_to: z.array(z.string()).min(1),
  red_flags: z.array(
    z.object({
      thought: z.string().min(5),
      reality: z.string().min(5),
      correct_action: z.string().min(5),
    })
  ).min(1),
});

export const AntiRationalizationSchema = z.object({
  red_flag_groups: z.array(RedFlagGroupSchema).min(1),
});
export type AntiRationalization = z.infer<typeof AntiRationalizationSchema>;

// ============================================================
// Gates and Verification Schemas
// ============================================================
// Used by phase deliverables (verifiable conditions per phase) and by
// the verify-deliverable / phase-state tools. Gates are a discriminated
// union by `type` so each variant only carries the fields it needs.

const GateFailureMode = z.enum(["block", "warn"]);

const FileExistsGateSchema = z.object({
  type: z.literal("file-exists"),
  id: z.string(),
  /** path or glob; placeholders {phase}, {project}, {version} resolved at runtime */
  target: z.string().min(1),
  on_failure: GateFailureMode.default("block"),
});

const GitCheckGateSchema = z.object({
  type: z.literal("git-check"),
  id: z.string(),
  check: z.enum(["branch", "tag", "no-uncommitted", "sha-on-remote"]),
  /** for `branch`: list of forbidden branches (e.g. main/master) */
  not_in: z.array(z.string()).optional(),
  /** for `tag`/`branch`: required value */
  must_be: z.string().optional(),
  on_failure: GateFailureMode.default("block"),
});

const UrlReachableGateSchema = z.object({
  type: z.literal("url-reachable"),
  id: z.string(),
  /** Either a literal http(s) URL or a {placeholder} resolved at gate
   * evaluation time (e.g. "{project_url}"). Full URL validation happens
   * after placeholder substitution, not at schema-load time. */
  url: z.string().min(5).refine(
    (s) => s.startsWith("{") || /^https?:\/\//.test(s),
    { message: "Must be an http(s) URL or a {placeholder}" }
  ),
  expect_status: z.number().int().min(100).max(599).default(200),
  timeout_ms: z.number().int().positive().default(5000),
  on_failure: GateFailureMode.default("block"),
});

const AttestationGateSchema = z.object({
  type: z.literal("attestation"),
  id: z.string(),
  /** role expected to have signed the attestation */
  attestor_role: z.string(),
  /** deliverable id whose attestation file must exist */
  deliverable: z.string(),
  on_failure: GateFailureMode.default("block"),
});

const RuntimeCheckGateSchema = z.object({
  type: z.literal("runtime-check"),
  id: z.string(),
  /** TCP port that must be open on localhost */
  port: z.number().int().min(1).max(65535).optional(),
  /** process name regex that must appear in `ps` output */
  process: z.string().optional(),
  on_failure: GateFailureMode.default("block"),
});

const CommandGateSchema = z.object({
  type: z.literal("command"),
  id: z.string(),
  cmd: z.string().min(2),
  expect_regex: z.string().optional(),
  expect_exit_code: z.number().int().default(0),
  timeout_sec: z.number().int().positive().default(60),
  on_failure: GateFailureMode.default("block"),
});

export const GateSchema = z.discriminatedUnion("type", [
  FileExistsGateSchema,
  GitCheckGateSchema,
  UrlReachableGateSchema,
  AttestationGateSchema,
  RuntimeCheckGateSchema,
  CommandGateSchema,
]);
export type Gate = z.infer<typeof GateSchema>;

export const VerificationSchema = z.object({
  id: z.string(),
  cmd: z.string().min(2),
  expect_regex: z.string().optional(),
  expect_exit_code: z.number().int().default(0),
  timeout_sec: z.number().int().positive().default(60),
  on_failure: GateFailureMode.default("block"),
});
export type Verification = z.infer<typeof VerificationSchema>;

// ============================================================
// Phase Deliverables Schema
// ============================================================

const DeliverableSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  responsible: z.string(),
  approver: z.string(),
  mandatory: z.boolean().default(true),
  artifact_type: z.enum(["document", "presentation", "diagram", "code", "report", "checklist"]),
  /** Optional verification commands run at deliverable close time. */
  verification: z.array(VerificationSchema).default([]),
  /** When true, closing this deliverable requires a JSON attestation file
   * under docs/.attestations/<phase>/<deliverable>.json signed by the
   * `responsible` role. */
  attestation_required: z.boolean().default(false),
  /** Ordered fallback chain for `responsible` when the primary role is
   * not in the team. The resolver walks this list and picks the first
   * member present. When all candidates are absent, the deliverable is
   * silently dropped (mirrors the orchestrator filter). Use to declare
   * role conflation for small/lean teams (e.g. when no devops,
   * tech-lead picks up env-verification). */
  responsible_fallback: z.array(z.string()).default([]),
  /** Same fallback semantics as `responsible_fallback` but for the
   * approver field. When primary approver is absent and no fallback
   * matches, the orchestrator template emits "el usuario (sponsor)". */
  approver_fallback: z.array(z.string()).default([]),
});

const PhaseGateSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  gate_approver: z.string(),
  deliverables: z.array(DeliverableSchema).min(1),
  /** Verifiable conditions evaluated by the phase-state tool before the
   * gate approver can sign. Empty by default for backward compatibility. */
  gates: z.array(GateSchema).default([]),
  /** When true, this phase exists for plugin/scope enforcement BUT is NOT
   * rendered as a structured ### Fase N: section in the orchestrator
   * template. Used when the orchestrator template carries rich narrative
   * for that phase (currently only Fase 0 Discovery) and the structured
   * representation would duplicate it. The plugin still sees the phase. */
  narrative_only: z.boolean().default(false),
});

export const PhaseDeliverablesSchema = z.object({
  phases: z.array(PhaseGateSchema).min(1),
});
export type PhaseDeliverables = z.infer<typeof PhaseDeliverablesSchema>;

// ============================================================
// Document Mode Schema
// ============================================================
// Curated team and 5-phase flow used when ProjectMode === "document".

const DocumentModePhaseSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string().min(10),
});

export const DocumentModeSchema = z.object({
  id: z.literal("document-mode"),
  name: z.string().min(3),
  roles: z.array(z.string()).min(1),
  optional_roles: z.record(z.string(), z.object({ question: z.string().min(10) })).default({}),
  extra_skills: z.array(z.string()).default([]),
  phases: z.array(DocumentModePhaseSchema).min(1),
});
export type DocumentModeData = z.infer<typeof DocumentModeSchema>;

// ============================================================
// Task Contracts Schema
// ============================================================
// Drives the Task atomicity hook. Defaults live in
// data/rules/task-contracts.yaml. Per-project overrides go in
// project-manifest.yaml under `task_contracts_override:` and merge
// by `id` against the baseline.

const AtomicActionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Mixed locale (Spanish + English). Match is case-insensitive. */
  keywords: z.array(z.string().min(2)).min(1),
});

const ForbiddenComboSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** atomic_action ids that, when all detected together, form a violation */
  actions: z.array(z.string()).min(2),
  reason: z.string().min(20),
});

const ContractExemptionSchema = z.object({
  role: z.string(),
  /** ids of forbidden_combinations that this role is allowed to perform together */
  allow_combinations: z.array(z.string()).default([]),
});

export const TaskContractsSchema = z.object({
  atomic_actions: z.array(AtomicActionSchema).min(1),
  forbidden_combinations: z.array(ForbiddenComboSchema).default([]),
  exemptions: z.array(ContractExemptionSchema).default([]),
});
export type TaskContracts = z.infer<typeof TaskContractsSchema>;

// ============================================================
// Secret Patterns Schema
// ============================================================
// Drives the secret-redaction hook. Defaults live in
// data/rules/secret-patterns.yaml. Per-project additions go in
// project-manifest.yaml under `secret_patterns_extra:` and are
// concatenated to the baseline (merge-by-id semantics).

export const SecretSeveritySchema = z.enum(["block", "warn"]);
export type SecretSeverity = z.infer<typeof SecretSeveritySchema>;

export const SecretPatternSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  regex: z
    .string()
    .min(5)
    .refine(
      (s) => {
        try {
          new RegExp(s);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Must be a valid JavaScript regex" }
    ),
  severity: SecretSeveritySchema,
  description: z.string().min(5),
});
export type SecretPattern = z.infer<typeof SecretPatternSchema>;

export const SecretPatternsSchema = z.object({
  patterns: z.array(SecretPatternSchema).min(1),
});
export type SecretPatterns = z.infer<typeof SecretPatternsSchema>;

// ============================================================
// Runaway Limits Schema
// ============================================================
// Drives the runaway-detection hook. Defaults live in
// data/rules/runaway-limits.yaml. Resolution order (most specific
// wins): by_role -> by_category -> default.
// The hook EMITS A NOTICE on excess, it does not block.

const LimitsSchema = z.object({
  parts_max: z.number().int().positive().optional(),
  duration_min_max: z.number().int().positive().optional(),
  tokens_max: z.number().int().positive().optional(),
});
export type Limits = z.infer<typeof LimitsSchema>;

export const RunawayLimitsSchema = z.object({
  default: LimitsSchema,
  /** Keys SHOULD be valid RoleCategory values; not enforced via z.record(enum)
   * because that would require every category to be present. Unknown keys
   * are silently ignored at lookup time by the consumer. */
  by_category: z.record(z.string(), LimitsSchema).default({}),
  by_role: z.record(z.string(), LimitsSchema).default({}),
});
export type RunawayLimits = z.infer<typeof RunawayLimitsSchema>;

// ============================================================
// Model Override Schema
// ============================================================
// Per-role escape hatch for explicit model assignment. Bypasses the
// cognitive_tier + reasoning lookup table in model-mapping.ts. Only
// used when a project really needs a specific model for one role
// (e.g. Claude Opus only for the orchestrator).

export const ModelOverrideSchema = z.union([
  // Short form: bare model id, provider inferred.
  z.string().min(3),
  // Long form: explicit provider + model + reasoning effort.
  // NOTE: provider is restricted to the values supported by
  // src/engine/model-mapping.ts:PROVIDER_MODELS. To add a new provider,
  // (1) extend the global Provider type in src/engine/types.ts, then
  // (2) add its tier→model mapping to PROVIDER_MODELS, then (3) widen
  // this enum.
  z.object({
    provider: z.enum(["anthropic", "openai"]).optional(),
    model: z.string().min(3),
    reasoning_effort: ReasoningLevel.optional(),
  }),
]);
export type ModelOverride = z.infer<typeof ModelOverrideSchema>;

// ============================================================
// Iteration Scopes Schema (v0.1.41+)
// ============================================================
// Companion to iteration-strategy. Iteration-strategy decides
// document layout (A/B/C/D); iteration-scope decides which PHASES
// of the cascade actually run for the current iteration type.
//
// Resolution at runtime:
//   1. Orchestrator detects iteration via `iteration-strategy` skill
//   2. Asks user for type (or LLM matches keywords)
//   3. Calls `set-iteration-scope` tool to write
//      .opencode/iteration-state.json
//   4. Plugin reads that file and enforces phase membership
//
// All fields under each scope follow the v0.1.40 merge-by-id
// semantics when overlaid via project-manifest.yaml's
// `iteration_scopes_override`.

const IterationScopeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(3),
  description: z.string().min(10),
  /** Keywords searched (case-insensitive substring) in the user's
   * iteration request. Used by the orchestrator to suggest the type;
   * the user always has final say. */
  keywords: z.array(z.string().min(2)).default([]),
  /** Phase ids whose entire deliverable set is skipped for this scope.
   * Phase ids reference data/rules/phase-deliverables.yaml. */
  skip_phases: z.array(z.string()).default([]),
  /** Phases that DO run but only with the listed deliverable ids.
   * `{ phase_id: [deliverable_id, ...] }`. Empty value means full phase. */
  minimal_phases: z.record(z.string(), z.array(z.string())).default({}),
  /** Phases that run in full (every mandatory deliverable). Phases not
   * mentioned in any of skip_phases / minimal_phases / full_phases are
   * treated as full_phases by default. */
  full_phases: z.array(z.string()).default([]),
  /** Pre-suggested layout strategy from iteration-strategies.md (A/B/C/D).
   * The orchestrator may still negotiate with the user — this is a
   * default for that conversation. */
  default_layout_strategy: z.enum(["A", "B", "C", "D"]).default("A"),
});
export type IterationScope = z.infer<typeof IterationScopeSchema>;

export const IterationScopesSchema = z.object({
  scopes: z.array(IterationScopeSchema).min(1),
  /** Phase ids that REQUIRE an active scope to be set before any task
   * delegation can target them — IF the project has iteration signals
   * (bitácora, CHANGELOG releases, closure phase). Defaults to empty
   * (= no enforcement). The recommended baseline list is
   * [discovery, inception]. */
  require_scope_for_phases: z.array(z.string()).default([]),
});
export type IterationScopes = z.infer<typeof IterationScopesSchema>;
