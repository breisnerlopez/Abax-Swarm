import type { Role, Skill } from "../../loader/schemas.js";
import type { ModelMix, ModelSpec } from "../../engine/types.js";
import { computeAgentTools } from "../../engine/agent-tools.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";
import { renderTemplate } from "./template-engine.js";

/**
 * Generates an agent .md file for Claude Code.
 */
export function generateAgentFile(role: Role, skills: Skill[], spec?: ModelSpec): GeneratedFile {
  const roleSkills = skills.filter((s) => s.used_by.includes(role.id));
  const content = renderTemplate("agent.md.hbs", {
    ...role,
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
export function generateAllAgentFiles(roles: Role[], skills: Skill[], mix?: ModelMix): GeneratedFile[] {
  return roles.map((role) => generateAgentFile(role, skills, mix?.[role.id]));
}
