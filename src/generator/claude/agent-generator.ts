import type { Role, Skill } from "../../loader/schemas.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";
import { renderTemplate } from "./template-engine.js";

/**
 * Generates an agent .md file for Claude Code.
 */
export function generateAgentFile(role: Role, skills: Skill[]): GeneratedFile {
  const roleSkills = skills.filter((s) => s.used_by.includes(role.id));
  const content = renderTemplate("agent.md.hbs", {
    ...role,
    skills: roleSkills,
  });

  return {
    path: `.claude/agents/${role.id}.md`,
    content,
  };
}

/**
 * Generates all agent files for a set of roles.
 */
export function generateAllAgentFiles(roles: Role[], skills: Skill[]): GeneratedFile[] {
  return roles.map((role) => generateAgentFile(role, skills));
}
