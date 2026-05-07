import type { ProjectConfig, DataContext, ModelMix, RoleSelection, SelectionResult, ResolvedProject } from "../engine/types.js";
import type { GeneratedFile } from "../generator/opencode/agent-generator.js";
import { buildModelMix, applyExplicitOverrides } from "../engine/model-mapping.js";
import { selectRoles, selectRolesForDocumentMode } from "../engine/role-selector.js";
import { resolveDependencies } from "../engine/dependency-resolver.js";
import { resolveSkills, filterSkills } from "../engine/skill-resolver.js";
import { resolveTools, filterTools } from "../engine/tool-resolver.js";
import { adaptAllRolesToStack } from "../engine/stack-adapter.js";
import { resolveGovernance, resolveDocumentGovernance } from "../engine/governance-resolver.js";
import { writeGeneratedFiles } from "../generator/opencode/agent-generator.js";
import { validateOrchestrator } from "../validator/orchestrator-validator.js";
import { validateRaciRoles } from "../validator/raci-validator.js";
import {
  validateGatesAgainstTeam,
  validateGatesForDocumentMode,
} from "../validator/gates-validator.js";

import type { Role, Skill, Tool } from "../loader/schemas.js";
import type { GovernanceDetails } from "../engine/governance-resolver.js";

// OpenCode generators
import * as oc from "../generator/opencode/index.js";
// Claude generators
import * as cc from "../generator/claude/index.js";
// Shared generators
import { generatePresentationTemplate, teamUsesPresentations } from "../generator/design-system-generator.js";
import { generateDocsSiteFiles } from "../generator/docs-site-generator.js";
import { generateDevcontainerFile, shouldEmitDevcontainer } from "../generator/devcontainer-generator.js";
import { generatePagesWorkflow, teamUsesPresentations as teamUsesPresentationsForPages } from "../generator/pages-generator.js";

export interface PipelineResult {
  project: ResolvedProject;
  files: GeneratedFile[];
  /** Actionable findings from the validator stack — the user probably
   * wants to fix or knowingly accept each one. CLI surfaces them with
   * a collapse if there are many. */
  orchestratorWarnings: string[];
  /** Informational findings — fallback chains resolved successfully OR
   * the missing role was optional for the project's size. CLI shows
   * the count by default, full list only on --verbose. */
  orchestratorNotices: string[];
}

/**
 * Runs the full selection pipeline: size → criteria → dependencies → skills/tools → stack adapt.
 * In "document" mode, branches to the curated team from data/rules/document-mode.yaml.
 */
export function runSelection(config: ProjectConfig, ctx: DataContext): SelectionResult {
  if (config.mode === "document" && ctx.documentMode) {
    // `criteria` is reused to pass enabled optional roles in document mode.
    const enabledOptional = config.criteria;
    const initial = selectRolesForDocumentMode(ctx.documentMode, enabledOptional);
    const { selections, warnings } = resolveDependencies(initial, ctx.dependencies);
    const governance = resolveDocumentGovernance();
    return { roles: selections, warnings, governanceModel: governance.model };
  }

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
  mix: ModelMix,
  ctx: DataContext,
): { files: GeneratedFile[]; orchestratorFile: GeneratedFile } {
  const stack = ctx.stacks.get(config.stackId)!;
  const files: GeneratedFile[] = [];

  const orchFlags = {
    mode: config.mode,
    existingDocs: config.detection?.existingDocs,
    hasGit: config.detection?.hasGit,
    documentPhases: ctx.documentMode?.phases,
  };

  const permissionMode = config.permissionMode ?? "recommended";

  if (target === "claude") {
    files.push(...cc.generateAllAgentFiles(adaptedRoles, skills, mix, permissionMode));
    files.push(...cc.generateAllSkillFiles(skills));
    files.push(...cc.generateAllToolFiles(tools));

    const orchestratorFile = cc.generateOrchestratorFile(
      config.name, adaptedRoles, ctx.dependencies, ctx.raci, governance, ctx.phaseDeliverables, orchFlags,
    );
    files.push(orchestratorFile);

    // Emit policy hook + merged policies JSON. Same merged content as the
    // opencode plugin, different runtime (Python script + .claude/settings.json
    // hooks block instead of TS plugin).
    const policyFiles = cc.generateClaudePolicyFiles(
      config,
      adaptedRoles,
      ctx.taskContracts,
      ctx.secretPatterns,
      ctx.runawayLimits,
      ctx.phaseDeliverables,
      stack,
      ctx.iterationScopes,
    );
    files.push(...policyFiles);

    files.push(cc.generateClaudeConfig(adaptedRoles, cc.CLAUDE_HOOK_INVOCATION));
    files.push(cc.generateProjectManifest(config, selection, adaptedRoles, skills, tools, stack, governance));

    if (teamUsesPresentations(skills)) files.push(generatePresentationTemplate());
    if (config.mode === "document") files.push(...generateDocsSiteFiles(config, ctx));
    if (shouldEmitDevcontainer(config)) files.push(generateDevcontainerFile(config));
    if (teamUsesPresentationsForPages(skills)) files.push(generatePagesWorkflow());

    return { files, orchestratorFile };
  }

  // Default: opencode
  files.push(...oc.generateAllAgentFiles(adaptedRoles, skills, mix, permissionMode));
  files.push(...oc.generateAllSkillFiles(skills));
  files.push(...oc.generateAllToolFiles(tools));

  const orchestratorFile = oc.generateOrchestratorFile(
    config.name, adaptedRoles, ctx.dependencies, ctx.raci, governance, ctx.phaseDeliverables, orchFlags,
  );
  files.push(orchestratorFile);

  // Emit policy plugin + merged policies JSON. Generic across team
  // composition: project-level overlays (taskContractsOverride,
  // secretPatternsExtra, runawayLimitsOverride) are merged here so the
  // runtime plugin reads a single ready-to-use file. Phases + stack
  // commands are also embedded so the phase-state / verify-deliverable
  // tools can read them at runtime without needing access to abax-swarm.
  const pluginFiles = oc.generatePluginFiles(
    config,
    adaptedRoles,
    ctx.taskContracts,
    ctx.secretPatterns,
    ctx.runawayLimits,
    ctx.phaseDeliverables,
    stack,
    ctx.iterationScopes,
  );
  files.push(...pluginFiles);

  files.push(oc.generateOpenCodeConfig(
    adaptedRoles, mix, undefined,
    permissionMode,
    config.isolationMode ?? "devcontainer",
    [oc.PLUGIN_OPENCODE_PATH],
  ));
  files.push(oc.generateProjectManifest(config, selection, adaptedRoles, skills, tools, stack, governance));

  if (teamUsesPresentations(skills)) files.push(generatePresentationTemplate());
  if (config.mode === "document") files.push(...generateDocsSiteFiles(config, ctx));
  if (shouldEmitDevcontainer(config)) files.push(generateDevcontainerFile(config));
  if (teamUsesPresentationsForPages(skills)) files.push(generatePagesWorkflow());

  return { files, orchestratorFile };
}

/**
 * Full pipeline: config → engine → generator → files.
 */
export function runPipeline(config: ProjectConfig, selection: SelectionResult, ctx: DataContext): PipelineResult {
  const roleIds = selection.roles.map((s) => s.roleId);
  const stack = ctx.stacks.get(config.stackId)!;
  const governance = config.mode === "document" ? resolveDocumentGovernance() : resolveGovernance(config.size);

  // Resolve roles, skills, tools
  const rawRoles = roleIds.map((id) => ctx.roles.get(id)!).filter(Boolean);
  const adaptedRoles = adaptAllRolesToStack(rawRoles, stack);

  // In document mode, fold extra_skills (e.g. reverse-engineering) into the resolved set.
  const baseSkillIds = resolveSkills(roleIds, ctx.roles);
  const extraSkillIds = config.mode === "document" && ctx.documentMode ? ctx.documentMode.extra_skills : [];
  const skillIds = Array.from(new Set([...baseSkillIds, ...extraSkillIds]));
  const { found: skills } = filterSkills(skillIds, ctx.skills);

  const toolIds = resolveTools(roleIds, ctx.roles);
  const { found: tools } = filterTools(toolIds, ctx.tools);

  const provider = config.provider ?? "anthropic";
  const orchRole = ctx.roles.get("orchestrator");
  const rolesForMix = orchRole ? [...adaptedRoles, orchRole] : adaptedRoles;
  // "inherit" strategy: pass an empty mix so generators leave model fields unset
  // and the user's own OpenCode/Claude default is used at runtime.
  const baseMix: ModelMix =
    config.modelStrategy === "inherit"
      ? {}
      : buildModelMix(provider, rolesForMix, config.modelOverrides ?? {});

  // Apply per-role explicit overrides on top. These win over both the
  // cognitive_tier+reasoning lookup and the inherit default — they are an
  // escape hatch for projects that need a specific model for one role
  // (e.g. claude-opus-4-7 only for the orchestrator). When no explicit
  // overrides are declared, this is a no-op.
  const mix: ModelMix = applyExplicitOverrides(
    baseMix,
    config.modelOverridesExplicit,
    provider,
  );

  const { files, orchestratorFile } = generateFiles(
    config.target, config, selection, adaptedRoles, skills, tools, governance, mix, ctx,
  );

  // Validate orchestrator (existing)
  const validation = validateOrchestrator(orchestratorFile, adaptedRoles);

  // Cross-reference RACI and phase-deliverables (gates + responsibles) against
  // the resolved team. These never block — they surface dangling references
  // so the user understands what is being silently filtered. Generic across
  // any team composition: more roles = fewer warnings, fewer roles = more.
  //
  // Pass governance-aware context so the validators downgrade warnings about
  // roles that are "optional" for the project's size (the user knew they
  // were skipping them) into informational notices. This collapses the
  // ~80-warning wall the user saw on small projects in 0.1.40 to ~0
  // surfaceable warnings — actionable items still surface, the rest move
  // to notices.
  const validRoleIds = new Set(adaptedRoles.map((r) => r.id));
  const validatorCtx = {
    sizeMatrix: ctx.sizeMatrix,
    projectSize: config.size,
    mode: config.mode,
  };
  const raciCheck = validateRaciRoles(ctx.raci, validRoleIds, validatorCtx);
  const gatesTeamCheck = validateGatesAgainstTeam(
    ctx.phaseDeliverables, validRoleIds, validatorCtx,
  );
  const gatesDocCheck =
    config.mode === "document" && ctx.documentMode
      ? validateGatesForDocumentMode(
          ctx.phaseDeliverables,
          ctx.documentMode.phases.map((p) => p.id),
        )
      : { valid: true, errors: [], warnings: [], notices: [] };

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
    orchestratorWarnings: [
      ...validation.errors,
      ...validation.warnings,
      ...raciCheck.errors,
      ...raciCheck.warnings,
      ...gatesTeamCheck.warnings,
      ...gatesDocCheck.warnings,
    ],
    orchestratorNotices: [
      ...validation.notices,
      ...raciCheck.notices,
      ...gatesTeamCheck.notices,
      ...gatesDocCheck.notices,
    ],
  };
}

/**
 * Writes all generated files to disk, or returns them for dry-run.
 */
export function writePipeline(result: PipelineResult, dryRun: boolean): void {
  if (dryRun) return;
  writeGeneratedFiles(result.files, result.project.config.targetDir);
}
