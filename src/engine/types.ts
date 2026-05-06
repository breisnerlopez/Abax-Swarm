import type { ProjectSize, Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../loader/schemas.js";
import type { CognitiveTier, ReasoningLevel } from "../loader/schemas.js";
import type {
  TaskContracts,
  SecretPatterns,
  SecretPattern,
  RunawayLimits,
  ModelOverride,
  IterationScopes,
} from "../loader/schemas.js";

export type TargetPlatform = "opencode" | "claude";

export type TeamScope = "lean" | "full";

export type Provider = "anthropic" | "openai";

/**
 * How models are assigned to agents.
 * - "custom": pick a model per role from PROVIDER_MODELS based on tier+reasoning.
 * - "inherit": omit `model` from agent frontmatter and opencode.json so the user's
 *   own OpenCode/Claude configuration provides the default. Use this when the
 *   end user does not have access to the provider's premium models (e.g. Opus, GPT-5).
 */
export type ModelStrategy = "custom" | "inherit";

/**
 * High-level intent for the run.
 * - "new":      green-field. Full cascade flow.
 * - "document": document an existing system (technical, functional, business, operative).
 *               Curated team and a 5-phase doc flow; emits MkDocs scaffold.
 * - "continue": resume a previous project. Detects stack/docs/git from the targetDir
 *               so the user doesn't re-enter what's already there.
 */
export type ProjectMode = "new" | "document" | "continue";

/**
 * How OpenCode should treat permissions.
 * - "strict":      preserve current behaviour (per-agent permission only).
 * - "recommended": root permission with allowlist for common dev commands and
 *                  denylist for clearly destructive ones. Container-aware: when
 *                  IsolationMode is "devcontainer", apt/dpkg drop to "allow"
 *                  because they only affect the container.
 * - "full":        `"permission": "allow"` root. Banner warns the user.
 */
export type PermissionMode = "strict" | "recommended" | "full";

/**
 * Whether the dev environment runs isolated.
 * - "devcontainer": generate .devcontainer/devcontainer.json with stack-aware features.
 * - "host":         the user takes responsibility for the host environment.
 */
export type IsolationMode = "devcontainer" | "host";

/**
 * Result of inspecting the target directory before running selection.
 * All flags are pure observations: the wizard / pipeline decide what to do with them.
 */
export interface ProjectContextDetection {
  /** Detected stack id (matches data/stacks/*.yaml ids). null when no heuristic matched. */
  stackId: string | null;
  /** Human-readable evidence lines like "package.json contains next" — surfaced in the wizard. */
  evidence: string[];
  /** True when targetDir/docs/ exists and contains at least one .md file. */
  existingDocs: boolean;
  /** True when targetDir/.git exists and looks like a git repo. */
  hasGit: boolean;
  /** True when targetDir/.devcontainer/devcontainer.json exists. */
  hasDevcontainer: boolean;
}

export interface ModelSpec {
  /** Provider-prefixed model id (e.g. "anthropic/claude-opus-4-7"). */
  model: string;
  /** Anthropic extended thinking: { type: "enabled", budgetTokens } */
  thinking?: { type: "enabled"; budgetTokens: number };
  /** OpenAI reasoning effort. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
}

export interface ModelMix {
  [roleId: string]: ModelSpec;
}

export type RoleModelOverride = {
  cognitive_tier?: CognitiveTier;
  reasoning?: ReasoningLevel;
};

export interface ProjectConfig {
  name: string;
  description: string;
  targetDir: string;
  size: ProjectSize;
  criteria: string[]; // IDs of criteria that apply
  stackId: string;
  target: TargetPlatform;
  teamScope: TeamScope; // lean = indispensable only, full = indispensable + recommended
  provider?: Provider;
  /** Optional per-role overrides for tier/reasoning (e.g. user customised the suggested mix). */
  modelOverrides?: Record<string, RoleModelOverride>;
  /** Defaults to "custom". When "inherit", no model is written and the host CLI's default applies. */
  modelStrategy?: ModelStrategy;
  /** Defaults to "new". Affects role selection, phases and emitted files. */
  mode?: ProjectMode;
  /** Pre-computed context detection (stack/docs/git). Pipeline uses this to specialise output. */
  detection?: ProjectContextDetection;
  /** Defaults to "recommended". Drives the `permission` block in opencode.json. */
  permissionMode?: PermissionMode;
  /** Defaults to "devcontainer". Drives whether we emit .devcontainer/devcontainer.json. */
  isolationMode?: IsolationMode;
  /**
   * Explicit model assignment per role — escape hatch that bypasses the
   * cognitive_tier+reasoning lookup in model-mapping.ts. Wins over
   * `modelOverrides` when both are set for the same role.
   */
  modelOverridesExplicit?: Record<string, ModelOverride>;
  /**
   * Project-level overlay for the Task atomicity contract. Merged by `id`
   * over the baseline in data/rules/task-contracts.yaml.
   */
  taskContractsOverride?: Partial<TaskContracts>;
  /**
   * Additional secret patterns specific to this project (e.g. internal
   * tokens). Concatenated to data/rules/secret-patterns.yaml; if an
   * `id` collides, the project-level entry wins.
   */
  secretPatternsExtra?: SecretPattern[];
  /**
   * Project-level overlay for runaway detection limits. Merged
   * field-by-field over `default` and `by_category`/`by_role`.
   */
  runawayLimitsOverride?: Partial<RunawayLimits>;
  /**
   * Project-level overlay for iteration-scope rules. Adds new scopes
   * or replaces existing ones (merge by `id`). Use to declare
   * project-specific scope types beyond the baseline major/minor/
   * patch/hotfix.
   */
  iterationScopesOverride?: Partial<IterationScopes>;
  /**
   * Optional ID of the scope ACTIVE in the current session. When set,
   * the plugin enforces that task delegations only target phases
   * declared in the scope's full_phases / minimal_phases. When unset,
   * no enforcement (greenfield default). Set at session time via the
   * `set-iteration-scope` tool, which writes
   * .opencode/iteration-state.json — but can also be hard-pinned in
   * project-manifest.yaml for fully scripted iterations.
   */
  activeIterationScope?: string;
}

export interface RoleSelection {
  roleId: string;
  reason: "indispensable" | "recommended" | "criteria" | "dependency" | "manual";
  criteriaSource?: string; // which criterion added it
  removable: boolean; // false for indispensable and hard-dependency
}

export interface DependencyWarning {
  roleId: string;
  missingDependency: string;
  type: "hard" | "soft";
  message: string;
}

export interface SelectionResult {
  roles: RoleSelection[];
  warnings: DependencyWarning[];
  governanceModel: "lightweight" | "controlled" | "corporate" | "documentation";
}

export interface ResolvedProject {
  config: ProjectConfig;
  selection: SelectionResult;
  roles: Role[];
  skills: Skill[];
  tools: Tool[];
  stack: Stack;
}

export interface DocumentMode {
  /** Role ids that conform the curated documentation team. */
  roles: string[];
  /** Role ids that are added only when the user opts in (e.g. security). */
  optional_roles: Record<string, { question: string }>;
  /** Skills auto-included regardless of which roles request them. */
  extra_skills: string[];
  /** The 5-phase documentation flow, in order. */
  phases: Array<{ id: string; name: string; description: string }>;
}

export interface DataContext {
  roles: Map<string, Role>;
  skills: Map<string, Skill>;
  tools: Map<string, Tool>;
  stacks: Map<string, Stack>;
  sizeMatrix: SizeMatrix;
  criteria: CriteriaRules;
  dependencies: DependencyGraph;
  raci: RaciMatrix;
  phaseDeliverables: PhaseDeliverables;
  documentMode?: DocumentMode;
  /** Baseline atomicity contract loaded from data/rules/task-contracts.yaml. */
  taskContracts: TaskContracts;
  /** Baseline secret-detection patterns loaded from data/rules/secret-patterns.yaml. */
  secretPatterns: SecretPatterns;
  /** Baseline runaway-detection limits loaded from data/rules/runaway-limits.yaml. */
  runawayLimits: RunawayLimits;
  /** Baseline iteration-scope rules loaded from data/rules/iteration-scopes.yaml. */
  iterationScopes: IterationScopes;
}
