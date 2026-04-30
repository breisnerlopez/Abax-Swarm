import type { ProjectConfig, DataContext, RoleSelection, SelectionResult, ResolvedProject } from "../engine/types.js";
import type { GeneratedFile } from "../generator/opencode/agent-generator.js";
import { selectRoles } from "../engine/role-selector.js";
import { resolveDependencies } from "../engine/dependency-resolver.js";
import { resolveSkills, filterSkills } from "../engine/skill-resolver.js";
import { resolveTools, filterTools } from "../engine/tool-resolver.js";
import { adaptAllRolesToStack } from "../engine/stack-adapter.js";
import { resolveGovernance } from "../engine/governance-resolver.js";
import { writeGeneratedFiles } from "../generator/opencode/agent-generator.js";
import { validateOrchestrator } from "../validator/orchestrator-validator.js";

import type { Role, Skill, Tool } from "../loader/schemas.js";
import type { GovernanceDetails } from "../engine/governance-resolver.js";

// OpenCode generators
import * as oc from "../generator/opencode/index.js";
// Claude generators
import * as cc from "../generator/claude/index.js";

export interface PipelineResult {
  project: ResolvedProject;
  files: GeneratedFile[];
  orchestratorWarnings: string[];
}

/**
 * Runs the full selection pipeline: size → criteria → dependencies → skills/tools → stack adapt.
 */
export function runSelection(config: ProjectConfig, ctx: DataContext): SelectionResult {
  const initial = selectRoles(config.size, config.criteria, ctx.sizeMatrix, ctx.criteria, config.teamScope);
  const { selections, warnings } = resolveDependencies(initial, ctx.dependencies);
  const governance = resolveGovernance(config.size);

  return {
    roles: selections,
    warnings,
    governanceModel: governance.model,
  };
}

/**
 * Allows toggling removable roles on/off.
 */
export function toggleRole(selections: RoleSelection[], roleId: string): RoleSelection[] {
  return selections.filter((s) => s.roleId !== roleId);
}

function generateFiles(
  target: string,
  config: ProjectConfig,
  selection: SelectionResult,
  adaptedRoles: Role[],
  skills: Skill[],
  tools: Tool[],
  governance: GovernanceDetails,
  ctx: DataContext,
): { files: GeneratedFile[]; orchestratorFile: GeneratedFile } {
  const stack = ctx.stacks.get(config.stackId)!;
  const files: GeneratedFile[] = [];

  if (target === "claude") {
    files.push(...cc.generateAllAgentFiles(adaptedRoles, skills));
    files.push(...cc.generateAllSkillFiles(skills));
    files.push(...cc.generateAllToolFiles(tools));

    const orchestratorFile = cc.generateOrchestratorFile(
      config.name, adaptedRoles, ctx.dependencies, ctx.raci, governance, ctx.phaseDeliverables,
    );
    files.push(orchestratorFile);
    files.push(cc.generateClaudeConfig(adaptedRoles));
    files.push(cc.generateProjectManifest(config, selection, adaptedRoles, skills, tools, stack, governance));

    return { files, orchestratorFile };
  }

  // Default: opencode
  files.push(...oc.generateAllAgentFiles(adaptedRoles, skills));
  files.push(...oc.generateAllSkillFiles(skills));
  files.push(...oc.generateAllToolFiles(tools));

  const orchestratorFile = oc.generateOrchestratorFile(
    config.name, adaptedRoles, ctx.dependencies, ctx.raci, governance, ctx.phaseDeliverables,
  );
  files.push(orchestratorFile);
  files.push(oc.generateOpenCodeConfig(adaptedRoles));
  files.push(oc.generateProjectManifest(config, selection, adaptedRoles, skills, tools, stack, governance));

  return { files, orchestratorFile };
}

/**
 * Full pipeline: config → engine → generator → files.
 */
export function runPipeline(config: ProjectConfig, selection: SelectionResult, ctx: DataContext): PipelineResult {
  const roleIds = selection.roles.map((s) => s.roleId);
  const stack = ctx.stacks.get(config.stackId)!;
  const governance = resolveGovernance(config.size);

  // Resolve roles, skills, tools
  const rawRoles = roleIds.map((id) => ctx.roles.get(id)!).filter(Boolean);
  const adaptedRoles = adaptAllRolesToStack(rawRoles, stack);

  const skillIds = resolveSkills(roleIds, ctx.roles);
  const { found: skills } = filterSkills(skillIds, ctx.skills);

  const toolIds = resolveTools(roleIds, ctx.roles);
  const { found: tools } = filterTools(toolIds, ctx.tools);

  const { files, orchestratorFile } = generateFiles(
    config.target, config, selection, adaptedRoles, skills, tools, governance, ctx,
  );

  // Validate orchestrator
  const validation = validateOrchestrator(orchestratorFile, adaptedRoles);

  return {
    project: {
      config,
      selection,
      roles: adaptedRoles,
      skills,
      tools,
      stack,
    },
    files,
    orchestratorWarnings: [...validation.errors, ...validation.warnings],
  };
}

/**
 * Writes all generated files to disk, or returns them for dry-run.
 */
export function writePipeline(result: PipelineResult, dryRun: boolean): void {
  if (dryRun) return;
  writeGeneratedFiles(result.files, result.project.config.targetDir);
}
