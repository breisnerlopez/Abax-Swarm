import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import {
  resolveHardDependencies,
  checkSoftDependencies,
  detectCircularDependencies,
  resolveDependencies,
} from "../../../src/engine/dependency-resolver.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";
import type { DependencyGraph } from "../../../src/loader/schemas.js";
import type { RoleSelection } from "../../../src/engine/types.js";

const DATA_DIR = join(__dirname, "../../../data");
let depGraph: DependencyGraph;

beforeAll(() => {
  const rules = loadAllRules(join(DATA_DIR, "rules"));
  depGraph = rules.dependencies;
});

function makeSelection(roleId: string, reason: "indispensable" | "recommended" | "criteria" = "indispensable"): RoleSelection {
  return { roleId, reason, removable: reason !== "indispensable" };
}

describe("resolveHardDependencies", () => {
  it("should add missing hard dependencies", () => {
    // solution-architect depends hard on business-analyst
    const selections = [makeSelection("solution-architect")];
    const result = resolveHardDependencies(selections, depGraph);
    const ids = result.map((r) => r.roleId);

    expect(ids).toContain("business-analyst");
    // business-analyst has soft (not hard) dep on product-owner
    expect(ids).not.toContain("product-owner");
  });

  it("should resolve transitive dependencies", () => {
    // integration-architect -> solution-architect -> business-analyst (soft to PO)
    const selections = [makeSelection("integration-architect")];
    const result = resolveHardDependencies(selections, depGraph);
    const ids = result.map((r) => r.roleId);

    expect(ids).toContain("solution-architect");
    expect(ids).toContain("business-analyst");
    // PO is now soft dep of BA, not auto-added
    expect(ids).not.toContain("product-owner");
  });

  it("should not duplicate already-selected roles", () => {
    const selections = [
      makeSelection("solution-architect"),
      makeSelection("business-analyst"),
      makeSelection("product-owner"),
    ];
    const result = resolveHardDependencies(selections, depGraph);
    const ids = result.map((r) => r.roleId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("should mark dependency-added roles as not removable", () => {
    const selections = [makeSelection("solution-architect")];
    const result = resolveHardDependencies(selections, depGraph);
    const ba = result.find((r) => r.roleId === "business-analyst");

    expect(ba).toBeDefined();
    expect(ba!.reason).toBe("dependency");
    expect(ba!.removable).toBe(false);
  });

  it("should handle roles with no hard dependencies", () => {
    const selections = [makeSelection("product-owner")];
    const result = resolveHardDependencies(selections, depGraph);
    expect(result.length).toBe(1);
  });
});

describe("checkSoftDependencies", () => {
  it("should warn about missing soft dependencies", () => {
    // tech-lead has soft dep on solution-architect
    const selections = [
      makeSelection("tech-lead"),
      makeSelection("business-analyst"),
      makeSelection("product-owner"),
    ];
    const warnings = checkSoftDependencies(selections, depGraph);
    const techLeadWarnings = warnings.filter((w) => w.roleId === "tech-lead");

    expect(techLeadWarnings.length).toBeGreaterThanOrEqual(1);
    expect(techLeadWarnings.some((w) => w.missingDependency === "solution-architect")).toBe(true);
  });

  it("should not warn for present soft dependencies", () => {
    const selections = [
      makeSelection("tech-lead"),
      makeSelection("business-analyst"),
      makeSelection("product-owner"),
      makeSelection("solution-architect"),
    ];
    const warnings = checkSoftDependencies(selections, depGraph);
    const techLeadArchWarning = warnings.find(
      (w) => w.roleId === "tech-lead" && w.missingDependency === "solution-architect",
    );
    expect(techLeadArchWarning).toBeUndefined();
  });

  it("should return empty for roles with no soft dependencies", () => {
    const selections = [makeSelection("product-owner")];
    const warnings = checkSoftDependencies(selections, depGraph);
    expect(warnings.length).toBe(0);
  });
});

describe("detectCircularDependencies", () => {
  it("should detect no cycles in the real dependency graph", () => {
    const cycles = detectCircularDependencies(depGraph);
    expect(cycles.length).toBe(0);
  });

  it("should detect a cycle in a synthetic graph", () => {
    const cyclicGraph: DependencyGraph = {
      dependencies: {
        a: { hard: ["b"], soft: [] },
        b: { hard: ["c"], soft: [] },
        c: { hard: ["a"], soft: [] },
      },
    };
    const cycles = detectCircularDependencies(cyclicGraph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("resolveDependencies (full)", () => {
  it("should resolve hard deps and return soft warnings", () => {
    const selections = [
      makeSelection("developer-backend", "recommended"),
    ];
    const { selections: resolved, warnings } = resolveDependencies(selections, depGraph);
    const ids = resolved.map((r) => r.roleId);

    // Hard: developer-backend -> tech-lead -> business-analyst
    expect(ids).toContain("tech-lead");
    expect(ids).toContain("business-analyst");
    // PO is soft dep of BA, not auto-added
    expect(ids).not.toContain("product-owner");

    // Soft warnings for developer-backend: dba, solution-architect
    expect(warnings.some((w) => w.roleId === "developer-backend")).toBe(true);
  });
});
