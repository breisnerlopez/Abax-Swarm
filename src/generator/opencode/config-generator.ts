import { stringify } from "yaml";
import type { Role, Skill, Tool, Stack } from "../../loader/schemas.js";
import type { ModelMix, ModelSpec, PermissionMode, IsolationMode, ProjectConfig, SelectionResult } from "../../engine/types.js";
import type { GovernanceDetails } from "../../engine/governance-resolver.js";
import { resolveAgentColor, ORCHESTRATOR_COLOR } from "../../engine/color-resolver.js";
import { buildOpenCodePermission, applyModeToAgentPermissions } from "../../engine/permissions.js";
import type { GeneratedFile } from "./agent-generator.js";

function applySpec(target: Record<string, unknown>, spec: ModelSpec | undefined): void {
  if (!spec) return;
  target.model = spec.model;
  if (spec.thinking) target.thinking = spec.thinking;
  if (spec.reasoningEffort) target.reasoningEffort = spec.reasoningEffort;
}

/**
 * Generates opencode.json configuration file.
 * Built programmatically to ensure valid JSON (templates break with multiline strings).
 */
export function generateOpenCodeConfig(
  agents: Role[],
  mix?: ModelMix,
  orchestratorDescription?: string,
  permissionMode: PermissionMode = "recommended",
  isolationMode: IsolationMode = "devcontainer",
  /** Module specifiers to add under opencode.json `plugin: [...]`. Each
   * entry is a relative path or npm package id. Optional — when absent,
   * the field is omitted from the output. */
  pluginPaths: string[] = [],
): GeneratedFile {
  const agentConfig: Record<string, unknown> = {};

  // Add orchestrator entry (primary agent).
  // Permissions are intentionally restrictive: orchestrator is a pure
  // coordinator. `applyModeToAgentPermissions` preserves the `deny` values
  // even in `full` mode — only `task: allow` stays as `allow`.
  const orch: Record<string, unknown> = {
    description: orchestratorDescription ?? "Orquestador principal del proyecto. Coordina agentes siguiendo flujo cascada.",
    mode: "primary",
    color: ORCHESTRATOR_COLOR,
    temperature: 0.3,
    permission: applyModeToAgentPermissions({
      read: "deny",
      edit: "deny",
      glob: "deny",
      grep: "deny",
      bash: "deny",
      task: "allow",
      skill: "deny",
      webfetch: "deny",
      todowrite: "deny",
    }, permissionMode),
  };
  applySpec(orch, mix?.["orchestrator"]);
  agentConfig["orchestrator"] = orch;

  for (const agent of agents) {
    if (agent.id === "orchestrator") continue;
    const entry: Record<string, unknown> = {
      description: agent.agent.description.replace(/\s+/g, " ").trim(),
      mode: agent.agent.mode,
      color: resolveAgentColor(agent),
      temperature: agent.agent.temperature,
      // Apply permission mode: in `full`, ask -> allow (preserves deny);
      // in `strict`, allow -> ask (preserves deny). `recommended` = pass-through.
      permission: applyModeToAgentPermissions(agent.agent.permissions, permissionMode),
    };
    applySpec(entry, mix?.[agent.id]);
    agentConfig[agent.id] = entry;
  }

  const rootPermission = buildOpenCodePermission(permissionMode, isolationMode);
  const config: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    agent: agentConfig,
  };
  if (rootPermission !== undefined) config.permission = rootPermission;
  if (pluginPaths.length > 0) config.plugin = pluginPaths;

  return {
    path: "opencode.json",
    content: JSON.stringify(config, null, 2) + "\n",
  };
}

/**
 * Generates project-manifest.yaml with full project metadata.
 */
export function generateProjectManifest(
  config: ProjectConfig,
  selection: SelectionResult,
  roles: Role[],
  skills: Skill[],
  tools: Tool[],
  stack: Stack,
  governance: GovernanceDetails,
): GeneratedFile {
  const manifest = {
    project: {
      name: config.name,
      description: config.description,
      size: config.size,
      stack: stack.id,
      target: config.target,
      team_scope: config.teamScope,
      provider: config.provider ?? "anthropic",
      model_strategy: config.modelStrategy ?? "custom",
      permission_mode: config.permissionMode ?? "recommended",
      isolation_mode: config.isolationMode ?? "devcontainer",
      governance_model: governance.model,
      governance_name: governance.name_es,
    },
    team: {
      total_agents: roles.length + 1, // +1 for orchestrator
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        tier: r.tier,
        category: r.category,
      })),
    },
    skills: skills.map((s) => ({ id: s.id, name: s.name })),
    tools: tools.map((t) => ({ id: t.id, name: t.name })),
    criteria_applied: config.criteria,
    warnings: selection.warnings.map((w) => w.message),
    generated_at: new Date().toISOString(),
    generated_by: "abax-swarm v0.1.0",
  };

  // Preserve user-supplied policy overrides through round-trip. Without
  // this, calling `regenerate` on a customised manifest silently drops
  // the user's task_contracts_override / secret_patterns_extra /
  // runaway_limits_override / model_overrides_explicit blocks. Each is
  // emitted only when present (preserves a clean manifest for projects
  // that don't customise).
  const overridesPresent: Record<string, unknown> = {};
  if (config.taskContractsOverride !== undefined) {
    overridesPresent.task_contracts_override = config.taskContractsOverride;
  }
  if (config.secretPatternsExtra !== undefined) {
    overridesPresent.secret_patterns_extra = config.secretPatternsExtra;
  }
  if (config.runawayLimitsOverride !== undefined) {
    overridesPresent.runaway_limits_override = config.runawayLimitsOverride;
  }
  if (config.modelOverridesExplicit !== undefined) {
    overridesPresent.model_overrides_explicit = config.modelOverridesExplicit;
  }

  // The commented-out trailer is documentation for projects WITHOUT
  // active overrides. When the user has at least one override, we don't
  // duplicate the templates — the live block is self-documenting.
  const hasActiveOverrides = Object.keys(overridesPresent).length > 0;
  const trailer = hasActiveOverrides ? "" : POLICY_OVERRIDES_TRAILER;
  const overrideYaml = hasActiveOverrides
    ? "\n# ========================================================\n# Active policy overrides (from project-manifest.yaml input)\n# ========================================================\n" + stringify(overridesPresent)
    : "";

  return {
    path: "project-manifest.yaml",
    content: stringify(manifest) + overrideYaml + trailer,
  };
}

/**
 * Documentation trailer appended to every generated project-manifest.yaml.
 * Documents the 4 optional override blocks shipped in the v0.1.40 schema
 * extension, with commented-out examples so users see the syntax they need.
 *
 * Trailer is appended AFTER `generated_by` so it doesn't interfere with
 * the structured fields. YAML parsers ignore trailing comments — proven
 * by `abax-swarm regenerate` round-tripping the file unchanged.
 *
 * Why a trailer instead of a wizard step:
 * The 4 overrides have very different shapes (regex lists, nested limits,
 * per-role model maps). A wizard could only meaningfully capture a small
 * fraction of valid configurations and would mislead users into thinking
 * the wizard was authoritative. A documented trailer lets users discover
 * the feature when they open their manifest, copy the relevant block,
 * uncomment, and edit — which is the actual workflow once they need it.
 */
const POLICY_OVERRIDES_TRAILER = `
# ============================================================================
# Optional policy overrides (v0.1.40+)
# ============================================================================
# Uncomment and edit any of the four blocks below to override the baselines
# in /srv/repos/Abax-Swarm/data/rules/{task-contracts,secret-patterns,
# runaway-limits}.yaml or to override the per-role model assignment.
#
# Lists merge by \`id\`: an entry with a baseline id REPLACES the baseline
# entry; a new id is added. Scalar fields merge field-by-field. Empty
# blocks are equivalent to "use baseline as-is".
#
# Re-run \`abax-swarm regenerate --dir .\` after editing.

# ---- 1. Task atomicity overlay ---------------------------------------------
# task_contracts_override:
#   forbidden_combinations:
#     - id: my-project-rule
#       actions: [build, push, deploy]   # see baseline for the action vocabulary
#       reason: |
#         Why this combination is dangerous in this project.

# ---- 2. Project-specific secret patterns -----------------------------------
# secret_patterns_extra:
#   - id: internal-microservice-token
#     regex: 'svc_[A-Z0-9]{32}'
#     severity: block       # block | warn
#     description: Internal service auth token

# ---- 3. Runaway limits overlay ---------------------------------------------
# runaway_limits_override:
#   by_role:
#     developer-backend:
#       parts_max: 700        # this role naturally runs longer
#       duration_min_max: 90

# ---- 4. Per-role explicit model assignment ---------------------------------
# Escape hatch over the cognitive_tier+reasoning lookup. Use sparingly —
# typically only for the orchestrator (high blast radius, low volume).
# model_overrides_explicit:
#   orchestrator:
#     provider: anthropic
#     model: claude-opus-4-7
#     reasoning_effort: high
`;

