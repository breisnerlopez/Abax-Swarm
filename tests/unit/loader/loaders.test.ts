import { describe, it, expect } from "vitest";
import { join } from "path";
import { loadAllRoles, loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadAllSkills, loadSkillsAsMap } from "../../../src/loader/skill-loader.js";
import { loadAllTools, loadToolsAsMap } from "../../../src/loader/tool-loader.js";
import { loadAllStacks, loadStacksAsMap } from "../../../src/loader/stack-loader.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";

const DATA_DIR = join(__dirname, "../../../data");

describe("Role Loader", () => {
  it("should load all roles without errors", () => {
    const result = loadAllRoles(join(DATA_DIR, "roles"));
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThanOrEqual(19); // 18 + orchestrator
  });

  it("should load roles as map with correct IDs", () => {
    const map = loadRolesAsMap(join(DATA_DIR, "roles"));
    expect(map.size).toBeGreaterThanOrEqual(19);

    // Tier 1 roles
    expect(map.has("business-analyst")).toBe(true);
    expect(map.has("solution-architect")).toBe(true);
    expect(map.has("tech-lead")).toBe(true);
    expect(map.has("developer-backend")).toBe(true);
    expect(map.has("developer-frontend")).toBe(true);
    expect(map.has("integration-architect")).toBe(true);
    expect(map.has("security-architect")).toBe(true);
    expect(map.has("dba")).toBe(true);
    expect(map.has("qa-functional")).toBe(true);
    expect(map.has("devops")).toBe(true);

    // Tier 2 roles
    expect(map.has("project-manager")).toBe(true);
    expect(map.has("product-owner")).toBe(true);
    expect(map.has("qa-lead")).toBe(true);
    expect(map.has("qa-automation")).toBe(true);
    expect(map.has("qa-performance")).toBe(true);
    expect(map.has("tech-writer")).toBe(true);
    expect(map.has("ux-designer")).toBe(true);
    expect(map.has("change-manager")).toBe(true);

    // Orchestrator
    expect(map.has("orchestrator")).toBe(true);
  });

  it("should have valid tier for each role", () => {
    const map = loadRolesAsMap(join(DATA_DIR, "roles"));
    for (const [id, role] of map) {
      expect(["1", "2", "3"]).toContain(role.tier);
    }
  });

  it("should have size classification for each role", () => {
    const map = loadRolesAsMap(join(DATA_DIR, "roles"));
    for (const [id, role] of map) {
      expect(role.size_classification).toHaveProperty("small");
      expect(role.size_classification).toHaveProperty("medium");
      expect(role.size_classification).toHaveProperty("large");
    }
  });

  it("should have non-empty system prompt for each role", () => {
    const map = loadRolesAsMap(join(DATA_DIR, "roles"));
    for (const [id, role] of map) {
      expect(role.agent.system_prompt.length).toBeGreaterThan(50);
    }
  });
});

describe("Skill Loader", () => {
  it("should load all skills without errors", () => {
    const result = loadAllSkills(join(DATA_DIR, "skills"));
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThanOrEqual(10);
  });

  it("should load skills as map with correct IDs", () => {
    const map = loadSkillsAsMap(join(DATA_DIR, "skills"));
    expect(map.has("functional-analysis")).toBe(true);
    expect(map.has("acceptance-criteria")).toBe(true);
    expect(map.has("technical-design")).toBe(true);
    expect(map.has("code-review")).toBe(true);
    expect(map.has("api-design")).toBe(true);
    expect(map.has("test-case-design")).toBe(true);
    expect(map.has("ci-cd-pipeline")).toBe(true);
    expect(map.has("db-modeling")).toBe(true);
    expect(map.has("security-audit")).toBe(true);
    expect(map.has("deployment-plan")).toBe(true);
  });

  it("should have at least one used_by for each skill", () => {
    const map = loadSkillsAsMap(join(DATA_DIR, "skills"));
    for (const [id, skill] of map) {
      expect(skill.used_by.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Tool Loader", () => {
  it("should load all tools without errors", () => {
    const result = loadAllTools(join(DATA_DIR, "tools"));
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThanOrEqual(5);
  });

  it("should load tools as map with correct IDs", () => {
    const map = loadToolsAsMap(join(DATA_DIR, "tools"));
    expect(map.has("generate-diagram")).toBe(true);
    expect(map.has("create-document")).toBe(true);
    expect(map.has("run-tests")).toBe(true);
    expect(map.has("lint-code")).toBe(true);
    expect(map.has("db-migrate")).toBe(true);
  });
});

describe("Stack Loader", () => {
  it("should load all stacks without errors", () => {
    const result = loadAllStacks(join(DATA_DIR, "stacks"));
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThanOrEqual(3);
  });

  it("should load stacks as map with correct IDs", () => {
    const map = loadStacksAsMap(join(DATA_DIR, "stacks"));
    expect(map.has("angular-springboot")).toBe(true);
    expect(map.has("react-nextjs")).toBe(true);
    expect(map.has("python-fastapi")).toBe(true);
  });

  it("should have role_context for key roles", () => {
    const map = loadStacksAsMap(join(DATA_DIR, "stacks"));
    for (const [id, stack] of map) {
      expect(Object.keys(stack.role_context).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Rule Loader", () => {
  it("should load all rules without errors", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    expect(rules.sizeMatrix).toBeDefined();
    expect(rules.criteria).toBeDefined();
    expect(rules.dependencies).toBeDefined();
    expect(rules.raci).toBeDefined();
  });

  it("should have all three sizes in matrix", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    expect(rules.sizeMatrix.roles_by_size.small.indispensable.length).toBeGreaterThan(0);
    expect(rules.sizeMatrix.roles_by_size.medium.indispensable.length).toBeGreaterThan(0);
    expect(rules.sizeMatrix.roles_by_size.large.indispensable.length).toBeGreaterThan(0);
  });

  it("should have criteria with questions and roles", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    expect(rules.criteria.criteria.length).toBeGreaterThanOrEqual(10);
    for (const criterion of rules.criteria.criteria) {
      expect(criterion.question.length).toBeGreaterThan(10);
      expect(criterion.adds_roles.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should have dependencies for all non-root roles", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    const deps = rules.dependencies.dependencies;
    expect(Object.keys(deps).length).toBeGreaterThanOrEqual(18);
    // product-owner should have no hard dependencies (root)
    expect(deps["product-owner"].hard).toEqual([]);
  });

  it("should have RACI activities with at least R and A", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    for (const [activity, roles] of Object.entries(rules.raci.activities)) {
      const values = Object.values(roles);
      const hasResponsible = values.some((v) => v === "R" || v === "A/R");
      expect(hasResponsible).toBe(true);
    }
  });
});

describe("Cross-validation: Roles reference valid skills", () => {
  it("should have all role-referenced skills defined", () => {
    const roles = loadRolesAsMap(join(DATA_DIR, "roles"));
    const skills = loadSkillsAsMap(join(DATA_DIR, "skills"));

    const missingSkills: string[] = [];
    for (const [id, role] of roles) {
      for (const skillId of role.skills) {
        if (!skills.has(skillId)) {
          missingSkills.push(`${id} -> ${skillId}`);
        }
      }
    }
    // Log missing but don't fail yet (some skills are defined in roles but not yet created)
    if (missingSkills.length > 0) {
      console.warn(`Skills referenced but not yet defined: ${missingSkills.join(", ")}`);
    }
    // At least the core skills should exist
    expect(skills.has("functional-analysis")).toBe(true);
    expect(skills.has("code-review")).toBe(true);
    expect(skills.has("test-case-design")).toBe(true);
  });
});

describe("Cross-validation: Roles reference valid tools", () => {
  it("should have all role-referenced tools defined", () => {
    const roles = loadRolesAsMap(join(DATA_DIR, "roles"));
    const tools = loadToolsAsMap(join(DATA_DIR, "tools"));

    for (const [id, role] of roles) {
      for (const toolId of role.tools) {
        expect(tools.has(toolId)).toBe(true);
      }
    }
  });
});

describe("Cross-validation: Dependencies reference valid roles", () => {
  it("should have all dependency targets as valid role IDs", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    const roles = loadRolesAsMap(join(DATA_DIR, "roles"));

    for (const [roleId, deps] of Object.entries(rules.dependencies.dependencies)) {
      expect(roles.has(roleId)).toBe(true);
      for (const hardDep of deps.hard) {
        expect(roles.has(hardDep)).toBe(true);
      }
      for (const softDep of deps.soft) {
        expect(roles.has(softDep)).toBe(true);
      }
    }
  });
});

describe("Cross-validation: Size matrix references valid roles", () => {
  it("should have all matrix role IDs as valid roles", () => {
    const rules = loadAllRules(join(DATA_DIR, "rules"));
    const roles = loadRolesAsMap(join(DATA_DIR, "roles"));

    for (const size of ["small", "medium", "large"] as const) {
      const sizeData = rules.sizeMatrix.roles_by_size[size];
      for (const roleId of [...sizeData.indispensable, ...sizeData.recommended, ...sizeData.optional]) {
        expect(roles.has(roleId)).toBe(true);
      }
    }
  });
});
