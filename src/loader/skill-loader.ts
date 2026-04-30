import { join } from "path";
import { fileURLToPath } from "url";
import { SkillSchema, type Skill } from "./schemas.js";
import { loadYamlFile, loadYamlDirectory, type LoadResult, type LoadAllResult } from "./yaml-loader.js";

const __loaderDir = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_SKILLS_DIR = join(__loaderDir, "../../data/skills");

export function loadSkill(filePath: string): LoadResult<Skill> {
  return loadYamlFile(filePath, SkillSchema);
}

export function loadAllSkills(dirPath: string = DEFAULT_SKILLS_DIR): LoadAllResult<Skill> {
  return loadYamlDirectory(dirPath, SkillSchema);
}

export function loadSkillsAsMap(dirPath: string = DEFAULT_SKILLS_DIR): Map<string, Skill> {
  const result = loadAllSkills(dirPath);
  if (result.errors.length > 0) {
    const msgs = result.errors.map((e) => `${e.filePath}: ${e.errors.join(", ")}`);
    throw new Error(`Failed to load skills:\n${msgs.join("\n")}`);
  }
  const map = new Map<string, Skill>();
  for (const item of result.items) {
    map.set(item.data.id, item.data);
  }
  return map;
}
