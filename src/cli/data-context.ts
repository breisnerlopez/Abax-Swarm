import { join } from "path";
import { fileURLToPath } from "url";
import { loadRolesAsMap } from "../loader/role-loader.js";
import { loadSkillsAsMap } from "../loader/skill-loader.js";
import { loadToolsAsMap } from "../loader/tool-loader.js";
import { loadStacksAsMap } from "../loader/stack-loader.js";
import { loadAllRules } from "../loader/rule-loader.js";
import type { DataContext } from "../engine/types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

/**
 * Loads all canonical data from YAML files into a DataContext.
 */
export function loadDataContext(): DataContext {
  const roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  const skills = loadSkillsAsMap(join(DATA_DIR, "skills"));
  const tools = loadToolsAsMap(join(DATA_DIR, "tools"));
  const stacks = loadStacksAsMap(join(DATA_DIR, "stacks"));
  const rules = loadAllRules(join(DATA_DIR, "rules"));

  return {
    roles,
    skills,
    tools,
    stacks,
    sizeMatrix: rules.sizeMatrix,
    criteria: rules.criteria,
    dependencies: rules.dependencies,
    raci: rules.raci,
    phaseDeliverables: rules.phaseDeliverables,
  };
}
