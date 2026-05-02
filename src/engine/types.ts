import type { ProjectSize, Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../loader/schemas.js";
import type { CognitiveTier, ReasoningLevel } from "../loader/schemas.js";

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
}
