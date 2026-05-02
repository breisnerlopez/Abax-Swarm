import { stringify } from "yaml";
import type { Role, Skill, Tool, Stack } from "../../loader/schemas.js";
import type { ModelMix, ModelSpec, PermissionMode, IsolationMode, ProjectConfig, SelectionResult } from "../../engine/types.js";
import type { GovernanceDetails } from "../../engine/governance-resolver.js";
import { resolveAgentColor, ORCHESTRATOR_COLOR } from "../../engine/color-resolver.js";
import { buildOpenCodePermission } from "../../engine/permissions.js";
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
): GeneratedFile {
  const agentConfig: Record<string, unknown> = {};

  // Add orchestrator entry (primary agent)
  const orch: Record<string, unknown> = {
    description: orchestratorDescription ?? "Orquestador principal del proyecto. Coordina agentes siguiendo flujo cascada.",
    mode: "primary",
    color: ORCHESTRATOR_COLOR,
    temperature: 0.3,
    permission: {
      read: "deny",
      edit: "deny",
      glob: "deny",
      grep: "deny",
      bash: "deny",
      task: "allow",
      skill: "deny",
      webfetch: "deny",
      todowrite: "deny",
    },
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
      permission: agent.agent.permissions,
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

  return {
    path: "project-manifest.yaml",
    content: stringify(manifest),
  };
}
