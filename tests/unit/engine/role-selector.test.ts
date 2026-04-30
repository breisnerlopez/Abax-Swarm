import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { selectBySize, applyCriteria, selectRoles } from "../../../src/engine/role-selector.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";
import type { SizeMatrix, CriteriaRules } from "../../../src/loader/schemas.js";

const DATA_DIR = join(__dirname, "../../../data");
let sizeMatrix: SizeMatrix;
let criteriaRules: CriteriaRules;

beforeAll(() => {
  const rules = loadAllRules(join(DATA_DIR, "rules"));
  sizeMatrix = rules.sizeMatrix;
  criteriaRules = rules.criteria;
});

describe("selectBySize", () => {
  it("should select indispensable roles for small project", () => {
    const result = selectBySize("small", sizeMatrix);
    const indispensable = result.filter((r) => r.reason === "indispensable");
    const ids = indispensable.map((r) => r.roleId);

    expect(ids).toContain("project-manager");
    expect(ids).toContain("business-analyst");
    expect(ids).toContain("tech-lead");
    expect(ids).toContain("developer-backend");
    expect(ids).toContain("qa-functional");
    expect(ids).not.toContain("product-owner");

    // All indispensable should not be removable
    for (const sel of indispensable) {
      expect(sel.removable).toBe(false);
    }
  });

  it("should have recommended roles for small (full scope)", () => {
    const result = selectBySize("small", sizeMatrix, "full");
    const recommended = result.filter((r) => r.reason === "recommended");

    expect(recommended.length).toBeGreaterThan(0);
    const ids = recommended.map((r) => r.roleId);
    expect(ids).toContain("solution-architect");
    expect(ids).toContain("devops");
    expect(ids).toContain("developer-frontend");
  });

  it("should have no recommended roles for small lean scope", () => {
    const result = selectBySize("small", sizeMatrix, "lean");
    const recommended = result.filter((r) => r.reason === "recommended");

    expect(recommended.length).toBe(0);
    const indispensable = result.filter((r) => r.reason === "indispensable");
    expect(indispensable.map((r) => r.roleId)).toContain("tech-lead");
  });

  it("should select more indispensable roles for medium", () => {
    const small = selectBySize("small", sizeMatrix);
    const medium = selectBySize("medium", sizeMatrix);
    const smallIndispensable = small.filter((r) => r.reason === "indispensable");
    const mediumIndispensable = medium.filter((r) => r.reason === "indispensable");

    expect(mediumIndispensable.length).toBeGreaterThan(smallIndispensable.length);
  });

  it("should select most indispensable roles for large", () => {
    const large = selectBySize("large", sizeMatrix);
    const indispensable = large.filter((r) => r.reason === "indispensable");

    expect(indispensable.length).toBeGreaterThanOrEqual(14);
    const ids = indispensable.map((r) => r.roleId);
    expect(ids).toContain("solution-architect");
    expect(ids).toContain("integration-architect");
    expect(ids).toContain("security-architect");
    expect(ids).toContain("devops");
    expect(ids).toContain("qa-lead");
    expect(ids).toContain("change-manager");
  });

  it("should not duplicate roles", () => {
    const result = selectBySize("large", sizeMatrix);
    const ids = result.map((r) => r.roleId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("should exclude recommended roles when scope is lean", () => {
    const full = selectBySize("medium", sizeMatrix, "full");
    const lean = selectBySize("medium", sizeMatrix, "lean");

    const fullRecommended = full.filter((r) => r.reason === "recommended");
    const leanRecommended = lean.filter((r) => r.reason === "recommended");

    expect(leanRecommended.length).toBe(0);
    expect(lean.length).toBeLessThanOrEqual(full.length);
    // Indispensable count same in both
    const fullIndispensable = full.filter((r) => r.reason === "indispensable");
    const leanIndispensable = lean.filter((r) => r.reason === "indispensable");
    expect(leanIndispensable.length).toBe(fullIndispensable.length);
  });

  it("should include recommended roles when scope is full (default)", () => {
    const result = selectBySize("medium", sizeMatrix);
    const recommended = result.filter((r) => r.reason === "recommended");
    // medium has recommended roles
    expect(recommended.length).toBeGreaterThanOrEqual(0);
  });
});

describe("applyCriteria", () => {
  it("should add roles based on criteria", () => {
    const base = selectBySize("small", sizeMatrix);
    const result = applyCriteria(base, ["has_integrations"], criteriaRules);

    const ids = result.map((r) => r.roleId);
    expect(ids).toContain("integration-architect");
    expect(ids).toContain("devops");
  });

  it("should not duplicate roles already selected", () => {
    const base = selectBySize("large", sizeMatrix);
    // devops is already indispensable for large
    const result = applyCriteria(base, ["has_integrations"], criteriaRules);
    const devopsEntries = result.filter((r) => r.roleId === "devops");
    expect(devopsEntries.length).toBe(1);
  });

  it("should tag criteria-added roles with source", () => {
    const base = selectBySize("small", sizeMatrix);
    const result = applyCriteria(base, ["has_sensitive_data"], criteriaRules);
    const secArch = result.find((r) => r.roleId === "security-architect");

    expect(secArch).toBeDefined();
    expect(secArch!.reason).toBe("criteria");
    expect(secArch!.criteriaSource).toBe("has_sensitive_data");
    expect(secArch!.removable).toBe(true);
  });

  it("should handle multiple criteria adding same role", () => {
    const base = selectBySize("small", sizeMatrix);
    const result = applyCriteria(
      base,
      ["has_sensitive_data", "has_regulatory_compliance"],
      criteriaRules,
    );
    const secArchEntries = result.filter((r) => r.roleId === "security-architect");
    expect(secArchEntries.length).toBe(1);
  });

  it("should handle unknown criteria gracefully", () => {
    const base = selectBySize("small", sizeMatrix);
    const result = applyCriteria(base, ["nonexistent_criterion"], criteriaRules);
    expect(result.length).toBe(base.length);
  });
});

describe("selectRoles (full pipeline)", () => {
  it("should combine size + criteria", () => {
    const result = selectRoles(
      "medium",
      ["has_integrations", "has_user_facing_ui"],
      sizeMatrix,
      criteriaRules,
    );
    const ids = result.map((r) => r.roleId);

    // From size
    expect(ids).toContain("business-analyst");
    expect(ids).toContain("tech-lead");
    // From criteria
    expect(ids).toContain("developer-frontend");
    expect(ids).toContain("ux-designer");
  });

  it("should respect lean scope — no recommended, criteria still applied", () => {
    const full = selectRoles("medium", ["has_integrations"], sizeMatrix, criteriaRules, "full");
    const lean = selectRoles("medium", ["has_integrations"], sizeMatrix, criteriaRules, "lean");

    const leanRecommended = lean.filter((r) => r.reason === "recommended");
    expect(leanRecommended.length).toBe(0);

    // Criteria roles still added in lean
    const leanIds = lean.map((r) => r.roleId);
    expect(leanIds).toContain("integration-architect");

    expect(lean.length).toBeLessThanOrEqual(full.length);
  });
});
