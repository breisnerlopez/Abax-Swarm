import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { Role, Skill } from "../../loader/schemas.js";
import type { ModelMix, ModelSpec } from "../../engine/types.js";
import { resolveAgentColor } from "../../engine/color-resolver.js";
import { computeAgentTools } from "../../engine/agent-tools.js";
import { renderTemplate } from "./template-engine.js";

export interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Generates an agent .md file for OpenCode. If a spec is supplied, the
 * frontmatter includes model + thinking/reasoningEffort.
 */
export function generateAgentFile(role: Role, skills: Skill[], spec?: ModelSpec): GeneratedFile {
  const roleSkills = skills.filter((s) => s.used_by.includes(role.id));
  const content = renderTemplate("agent.md.hbs", {
    ...role,
    skills: roleSkills,
    color: resolveAgentColor(role),
    model: spec?.model,
    thinking: spec?.thinking,
    reasoningEffort: spec?.reasoningEffort,
    availableTools: computeAgentTools(role),
  });

  return {
    path: `.opencode/agents/${role.id}.md`,
    content,
  };
}

/**
 * Generates all agent files for a set of roles, optionally per-role specs.
 */
export function generateAllAgentFiles(roles: Role[], skills: Skill[], mix?: ModelMix): GeneratedFile[] {
  return roles.map((role) => generateAgentFile(role, skills, mix?.[role.id]));
}

/**
 * Writes generated files to disk.
 */
export function writeGeneratedFiles(files: GeneratedFile[], baseDir: string): void {
  for (const file of files) {
    const fullPath = join(baseDir, file.path);
    const dir = join(fullPath, "..");
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, file.content, "utf-8");
  }
}
