import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { Skill } from "../loader/schemas.js";
import type { GeneratedFile } from "./opencode/agent-generator.js";

const __thisDir = fileURLToPath(new URL(".", import.meta.url));
const DESIGN_SYSTEM_DIR = join(__thisDir, "../../templates/design-system");

/**
 * Path emitted into the generated project. The presentation-design skill,
 * the create-presentation tool, and every agent's system prompt all
 * reference this exact path, so it must remain stable.
 */
export const PRESENTATION_TEMPLATE_PATH = "docs/design-system/presentacion-template.html";

/**
 * Returns the static reference template (HTML with 3 visual presets) that the
 * presentation-design skill references in its instructions. Generated only when
 * at least one agent in the team uses the `presentation-design` skill.
 */
export function generatePresentationTemplate(): GeneratedFile {
  const content = readFileSync(join(DESIGN_SYSTEM_DIR, "presentacion-template.html"), "utf-8");
  return { path: PRESENTATION_TEMPLATE_PATH, content };
}

/**
 * True when the team's resolved skill set includes presentation-design,
 * i.e. at least one agent will reference the template.
 */
export function teamUsesPresentations(skills: Skill[]): boolean {
  return skills.some((s) => s.id === "presentation-design");
}
