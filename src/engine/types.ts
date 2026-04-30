import type { ProjectSize, Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../loader/schemas.js";

export type TargetPlatform = "opencode" | "claude";

export type TeamScope = "lean" | "full";

export interface ProjectConfig {
  name: string;
  description: string;
  targetDir: string;
  size: ProjectSize;
  criteria: string[]; // IDs of criteria that apply
  stackId: string;
  target: TargetPlatform;
  teamScope: TeamScope; // lean = indispensable only, full = indispensable + recommended
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
