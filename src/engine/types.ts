import type { ProjectSize, Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../loader/schemas.js";
import type { CognitiveTier, ReasoningLevel } from "../loader/schemas.js";

export type TargetPlatform = "opencode" | "claude";

export type TeamScope = "lean" | "full";

export type Provider = "anthropic" | "openai";

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
  governanceModel: "lightweight" | "controlled" | "corporate";
}

export interface ResolvedProject {
  config: ProjectConfig;
  selection: SelectionResult;
  roles: Role[];
  skills: Skill[];
  tools: Tool[];
  stack: Stack;
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
}
