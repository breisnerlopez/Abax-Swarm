import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { readdirSync } from "fs";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import type { Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix } from "../../src/loader/schemas.js";
import { validateRaciMatrix, validateRaciRoles } from "../../src/validator/raci-validator.js";

const DATA_DIR = join(__dirname, "../../data");

let roles: Map<string, Role>;
let skills: Map<string, Skill>;
let tools: Map<string, Tool>;
let stacks: Map<string, Stack>;
let sizeMatrix: SizeMatrix;
let criteria: CriteriaRules;
let dependencies: DependencyGraph;
let raci: RaciMatrix;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  skills = loadSkillsAsMap(join(DATA_DIR, "skills"));
  tools = loadToolsAsMap(join(DATA_DIR, "tools"));
  stacks = loadStacksAsMap(join(DATA_DIR, "stacks"));
  const rules = loadAllRules(join(DATA_DIR, "rules"));
  sizeMatrix = rules.sizeMatrix;
  criteria = rules.criteria;
  dependencies = rules.dependencies;
  raci = rules.raci;
});

// =========================================
// R5-1: Every skill referenced by a role must have a YAML file
// =========================================
describe("Skills completeness", () => {
  it("every skill ID referenced in roles should have a skill YAML file", () => {
    const missingSkills: string[] = [];
    for (const role of roles.values()) {
      for (const skillId of role.skills) {
        if (!skills.has(skillId)) {
          missingSkills.push(`${role.id} -> ${skillId}`);
        }
      }
    }
    expect(missingSkills, `Missing skill files:\n${missingSkills.join("\n")}`).toEqual([]);
  });

  it("every skill file should be referenced by at least one role", () => {
    const allRoleSkills = new Set<string>();
    for (const role of roles.values()) {
      for (const s of role.skills) allRoleSkills.add(s);
    }
    const orphanSkills: string[] = [];
    for (const skillId of skills.keys()) {
      if (!allRoleSkills.has(skillId)) {
        orphanSkills.push(skillId);
      }
    }
    expect(orphanSkills, `Orphan skills (no role uses them):\n${orphanSkills.join("\n")}`).toEqual([]);
  });

  it("skill used_by should match roles that reference the skill", () => {
    const mismatches: string[] = [];
    for (const [skillId, skill] of skills) {
      for (const roleId of skill.used_by) {
        const role = roles.get(roleId);
        if (!role) {
          mismatches.push(`Skill ${skillId} lists used_by ${roleId} but role doesn't exist`);
        } else if (!role.skills.includes(skillId)) {
          mismatches.push(`Skill ${skillId} lists used_by ${roleId} but role doesn't list this skill`);
        }
      }
    }
    expect(mismatches, `Skill used_by mismatches:\n${mismatches.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-2: Every tool referenced by a role must have a YAML file
// =========================================
describe("Tools completeness", () => {
  it("every tool ID referenced in roles should have a tool YAML file", () => {
    const missingTools: string[] = [];
    for (const role of roles.values()) {
      for (const toolId of role.tools) {
        if (!tools.has(toolId)) {
          missingTools.push(`${role.id} -> ${toolId}`);
        }
      }
    }
    expect(missingTools, `Missing tool files:\n${missingTools.join("\n")}`).toEqual([]);
  });

  it("every tool file should be referenced by at least one role", () => {
    const allRoleTools = new Set<string>();
    for (const role of roles.values()) {
      for (const t of role.tools) allRoleTools.add(t);
    }
    const orphanTools: string[] = [];
    for (const toolId of tools.keys()) {
      if (!allRoleTools.has(toolId)) {
        orphanTools.push(toolId);
      }
    }
    expect(orphanTools, `Orphan tools:\n${orphanTools.join("\n")}`).toEqual([]);
  });

  it("tool used_by should match roles that reference the tool", () => {
    const mismatches: string[] = [];
    for (const [toolId, tool] of tools) {
      for (const roleId of tool.used_by) {
        const role = roles.get(roleId);
        if (!role) {
          mismatches.push(`Tool ${toolId} lists used_by ${roleId} but role doesn't exist`);
        } else if (!role.tools.includes(toolId)) {
          mismatches.push(`Tool ${toolId} lists used_by ${roleId} but role doesn't list this tool`);
        }
      }
    }
    expect(mismatches, `Tool used_by mismatches:\n${mismatches.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-3: Size matrix references valid roles
// =========================================
describe("Size matrix consistency", () => {
  it("all roles in size matrix should exist", () => {
    const missing: string[] = [];
    for (const [size, data] of Object.entries(sizeMatrix.roles_by_size)) {
      for (const id of [...data.indispensable, ...data.recommended, ...(data.optional ?? [])]) {
        if (!roles.has(id)) {
          missing.push(`${size}: ${id}`);
        }
      }
    }
    expect(missing, `Size matrix references unknown roles:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every non-orchestrator role should appear in at least one size", () => {
    const allSizeRoles = new Set<string>();
    for (const data of Object.values(sizeMatrix.roles_by_size)) {
      for (const id of [...data.indispensable, ...data.recommended, ...(data.optional ?? [])]) {
        allSizeRoles.add(id);
      }
    }
    const missing: string[] = [];
    for (const roleId of roles.keys()) {
      if (roleId === "orchestrator" || roleId === "system-designer") continue;
      if (!allSizeRoles.has(roleId)) {
        missing.push(roleId);
      }
    }
    expect(missing, `Roles not in any size classification:\n${missing.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-4: Dependency graph references valid roles
// =========================================
describe("Dependency graph consistency", () => {
  it("all dependency source roles should exist", () => {
    const missing: string[] = [];
    for (const roleId of Object.keys(dependencies.dependencies)) {
      if (!roles.has(roleId)) {
        missing.push(roleId);
      }
    }
    expect(missing).toEqual([]);
  });

  it("all dependency targets should exist", () => {
    const missing: string[] = [];
    for (const [roleId, deps] of Object.entries(dependencies.dependencies)) {
      for (const target of [...deps.hard, ...deps.soft]) {
        if (!roles.has(target)) {
          missing.push(`${roleId} -> ${target}`);
        }
      }
    }
    expect(missing, `Dependency targets don't exist:\n${missing.join("\n")}`).toEqual([]);
  });

  it("role delivers_to/receives_from should reference existing roles", () => {
    const missing: string[] = [];
    for (const role of roles.values()) {
      for (const target of role.dependencies.delivers_to) {
        if (!roles.has(target)) missing.push(`${role.id}.delivers_to -> ${target}`);
      }
      for (const source of role.dependencies.receives_from) {
        if (!roles.has(source)) missing.push(`${role.id}.receives_from -> ${source}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// =========================================
// R5-5: Criteria rules reference valid roles
// =========================================
describe("Criteria rules consistency", () => {
  it("all criteria adds_roles should reference existing roles", () => {
    const missing: string[] = [];
    for (const criterion of criteria.criteria) {
      for (const roleId of criterion.adds_roles) {
        if (!roles.has(roleId)) {
          missing.push(`${criterion.id} -> ${roleId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

// =========================================
// R5-6: RACI matrix consistency
// =========================================
describe("RACI matrix consistency", () => {
  it("RACI matrix should be valid (R and A for every activity)", () => {
    const result = validateRaciMatrix(raci);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("RACI matrix should only reference existing roles", () => {
    const roleIds = new Set(roles.keys());
    const result = validateRaciRoles(raci, roleIds);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("role RACI self-references should match existing activities", () => {
    const activities = new Set(Object.keys(raci.activities));
    const mismatches: string[] = [];
    for (const role of roles.values()) {
      for (const activity of Object.keys(role.raci)) {
        if (!activities.has(activity)) {
          mismatches.push(`${role.id}.raci references unknown activity: ${activity}`);
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
});

// =========================================
// R5-7: Stack overrides reference valid stacks
// =========================================
describe("Stack overrides consistency", () => {
  it("role stack_overrides should reference existing stacks", () => {
    const missing: string[] = [];
    for (const role of roles.values()) {
      for (const stackId of Object.keys(role.stack_overrides)) {
        if (!stacks.has(stackId)) {
          missing.push(`${role.id} -> ${stackId}`);
        }
      }
    }
    expect(missing, `Stack overrides reference unknown stacks:\n${missing.join("\n")}`).toEqual([]);
  });

  it("stack role_context should reference existing roles", () => {
    const missing: string[] = [];
    for (const stack of stacks.values()) {
      for (const roleId of Object.keys(stack.role_context)) {
        if (!roles.has(roleId)) {
          missing.push(`${stack.id} -> ${roleId}`);
        }
      }
    }
    expect(missing, `Stack role_context references unknown roles:\n${missing.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-8: No orphan YAML files
// =========================================
describe("File system consistency", () => {
  it("every role YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "roles")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(roles.size);
  });

  it("every skill YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "skills")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(skills.size);
  });

  it("every tool YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "tools")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(tools.size);
  });

  it("every stack YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "stacks")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(stacks.size);
  });
});
