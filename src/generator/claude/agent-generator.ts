import type { Role, Skill } from "../../loader/schemas.js";
import type { ModelMix, ModelSpec, PermissionMode } from "../../engine/types.js";
import { computeAgentTools } from "../../engine/agent-tools.js";
import { applyModeToAgentPermissions } from "../../engine/permissions.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";
import { renderTemplate } from "./template-engine.js";

/**
 * Generates an agent .md file for Claude Code.
 *
 * Same `permissionMode` adjustment as the OpenCode counterpart so the rendered
 * permissions section reflects the user's choice instead of the raw role YAML.
 */
export function generateAgentFile(
  role: Role,
  skills: Skill[],
  spec?: ModelSpec,
  permissionMode: PermissionMode = "recommended",
): GeneratedFile {
  const roleSkills = skills.filter((s) => s.used_by.includes(role.id));
  const adjustedPermissions =
    applyModeToAgentPermissions(role.agent.permissions, permissionMode) ?? role.agent.permissions;
  const content = renderTemplate("agent.md.hbs", {
    ...role,
    agent: { ...role.agent, permissions: adjustedPermissions },
    skills: roleSkills,
    model: spec?.model,
    thinking: spec?.thinking,
    reasoningEffort: spec?.reasoningEffort,
    availableTools: computeAgentTools(role),
  });

  return {
    path: `.claude/agents/${role.id}.md`,
    content,
  };
}

/**
 * Generates all agent files for a set of roles, optionally per-role specs.
 */
export function generateAllAgentFiles(
  roles: Role[],
  skills: Skill[],
  mix?: ModelMix,
  permissionMode: PermissionMode = "recommended",
): GeneratedFile[] {
  return roles.map((role) => generateAgentFile(role, skills, mix?.[role.id], permissionMode));
}
