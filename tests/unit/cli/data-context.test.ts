import { describe, it, expect } from "vitest";
import { loadDataContext } from "../../../src/cli/data-context.js";
import { loadAllRoles } from "../../../src/loader/role-loader.js";
import { loadAllSkills } from "../../../src/loader/skill-loader.js";
import { loadAllTools } from "../../../src/loader/tool-loader.js";
import { loadAllStacks } from "../../../src/loader/stack-loader.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";

describe("DataContext loader", () => {
  it("should load all canonical data", () => {
    const ctx = loadDataContext();

    expect(ctx.roles.size).toBeGreaterThan(0);
    expect(ctx.skills.size).toBeGreaterThan(0);
    expect(ctx.tools.size).toBeGreaterThan(0);
    expect(ctx.stacks.size).toBeGreaterThan(0);
    expect(ctx.sizeMatrix.roles_by_size).toBeDefined();
    expect(ctx.criteria.criteria.length).toBeGreaterThan(0);
    expect(Object.keys(ctx.dependencies.dependencies).length).toBeGreaterThan(0);
    expect(Object.keys(ctx.raci.activities).length).toBeGreaterThan(0);
  });

  it("should include all 20 roles", () => {
    const ctx = loadDataContext();
    expect(ctx.roles.size).toBe(20);
  });

  it("should have consistent role references", () => {
    const ctx = loadDataContext();
    const roleIds = new Set(ctx.roles.keys());

    // All size matrix roles should exist
    for (const size of Object.values(ctx.sizeMatrix.roles_by_size)) {
      for (const id of [...size.indispensable, ...size.recommended, ...(size.optional ?? [])]) {
        expect(roleIds.has(id), `Size matrix references unknown role: ${id}`).toBe(true);
      }
    }
  });
});

describe("Loaders with default paths", () => {
  it("loadAllRoles with default path should work", () => {
    const result = loadAllRoles();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it("loadAllSkills with default path should work", () => {
    const result = loadAllSkills();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("loadAllTools with default path should work", () => {
    const result = loadAllTools();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("loadAllStacks with default path should work", () => {
    const result = loadAllStacks();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("loadAllRules with default path should work", () => {
    const rules = loadAllRules();
    expect(rules.sizeMatrix).toBeDefined();
    expect(rules.criteria).toBeDefined();
    expect(rules.dependencies).toBeDefined();
    expect(rules.raci).toBeDefined();
  });
});
