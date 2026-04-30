import type { Skill } from "../../loader/schemas.js";
import { renderTemplate } from "./template-engine.js";
import type { GeneratedFile } from "./agent-generator.js";

/**
 * Generates a SKILL.md file + guides/ for OpenCode.
 */
export function generateSkillFile(skill: Skill): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main SKILL.md
  const content = renderTemplate("skill.md.hbs", skill);
  files.push({
    path: `.opencode/skills/${skill.id}/SKILL.md`,
    content,
  });

  // Guide files (progressive disclosure)
  for (const guide of skill.content.guides) {
    files.push({
      path: `.opencode/skills/${skill.id}/guides/${guide.name}.md`,
      content: `# ${guide.name}\n\n${guide.content.trim()}\n`,
    });
  }

  return files;
}

/**
 * Generates all skill files for a set of skills.
 */
export function generateAllSkillFiles(skills: Skill[]): GeneratedFile[] {
  return skills.flatMap((skill) => generateSkillFile(skill));
}
