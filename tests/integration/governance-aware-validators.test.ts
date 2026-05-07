// Integration tests for governance-aware validator behaviour (0.1.41).
import { describe, it, expect } from "vitest";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { validateRaciRoles } from "../../src/validator/raci-validator.js";
import { validateGatesAgainstTeam } from "../../src/validator/gates-validator.js";
import type { ValidationContext } from "../../src/validator/types.js";

const RULES_DIR = "data/rules";
const ROLES_DIR = "data/roles";

// User's reported team — small + lightweight, 9 roles. This is the exact
// composition that produced ~80 warnings in 0.1.40.
const SMALL_LIGHTWEIGHT_TEAM = new Set([
  "orchestrator",
  "project-manager",
  "business-analyst",
  "tech-lead",
  "developer-backend",
  "developer-frontend",
  "qa-functional",
  "solution-architect",
  "devops",
]);

describe("Governance-aware validator behaviour (0.1.41)", () => {
  const rules = loadAllRules(RULES_DIR);
  const raci = rules.raci;

  describe("Small + lightweight (the user's scenario)", () => {
    const ctx: ValidationContext = { sizeMatrix: rules.sizeMatrix, projectSize: "small" };

    it("validateRaciRoles produces zero warnings (all unknowns are optional for small)", () => {
      const result = validateRaciRoles(raci, SMALL_LIGHTWEIGHT_TEAM, ctx);
      expect(result.warnings, `Got warnings:\n${result.warnings.join("\n")}`).toEqual([]);
      expect(result.notices.length).toBeGreaterThan(0);
    });

    it("validateGatesAgainstTeam produces zero warnings for small+lightweight", () => {
      const result = validateGatesAgainstTeam(rules.phaseDeliverables, SMALL_LIGHTWEIGHT_TEAM, ctx);
      expect(
        result.warnings,
        `Expected zero warnings for small+lightweight after fallback chains added in 0.1.41. Got:\n` +
          result.warnings.join("\n"),
      ).toEqual([]);
    });

    it("notices count is meaningful (system is informing, not warning)", () => {
      const gates = validateGatesAgainstTeam(rules.phaseDeliverables, SMALL_LIGHTWEIGHT_TEAM, ctx);
      const raciResult = validateRaciRoles(raci, SMALL_LIGHTWEIGHT_TEAM, ctx);
      const totalNotices = gates.notices.length + raciResult.notices.length;
      expect(totalNotices).toBeGreaterThanOrEqual(40);
    });
  });

  describe("Without ValidationContext (backward compat)", () => {
    it("validateRaciRoles emits warnings (safe default)", () => {
      const result = validateRaciRoles(raci, SMALL_LIGHTWEIGHT_TEAM);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("validateGatesAgainstTeam emits warnings without context", () => {
      const result = validateGatesAgainstTeam(rules.phaseDeliverables, SMALL_LIGHTWEIGHT_TEAM);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Large team + corporate governance (no warnings expected at all)", () => {
    const LARGE_FULL = new Set([
      "orchestrator",
      ...rules.sizeMatrix.roles_by_size.large.indispensable,
      ...rules.sizeMatrix.roles_by_size.large.recommended,
    ]);
    const ctx: ValidationContext = { sizeMatrix: rules.sizeMatrix, projectSize: "large" };

    it("RACI: zero warnings for full large team", () => {
      const result = validateRaciRoles(raci, LARGE_FULL, ctx);
      expect(result.warnings).toEqual([]);
    });

    it("Gates: zero warnings for full large team", () => {
      const result = validateGatesAgainstTeam(rules.phaseDeliverables, LARGE_FULL, ctx);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("Medium team without product-owner (downgrade boundary)", () => {
    // product-owner is INDISPENSABLE for medium. Missing it should warn,
    // not notice. Proves governance-aware filtering doesn't blanket-hide
    // everything — actionable issues still surface.
    const MEDIUM_INCOMPLETE = new Set([
      "orchestrator",
      "project-manager",
      "business-analyst",
      "tech-lead",
      "developer-backend",
      "qa-functional",
      "dba",
    ]);
    const ctx: ValidationContext = { sizeMatrix: rules.sizeMatrix, projectSize: "medium" };

    it("Missing indispensable role (product-owner) surfaces as WARNING for medium", () => {
      const result = validateGatesAgainstTeam(rules.phaseDeliverables, MEDIUM_INCOMPLETE, ctx);
      const productOwnerWarnings = result.warnings.filter((w) => w.includes("product-owner"));
      expect(
        productOwnerWarnings.length,
        "product-owner missing on medium should be a warning, not a notice",
      ).toBeGreaterThan(0);
    });
  });

  describe("Dataset-level invariant: every approver has a fallback chain", () => {
    it("every deliverable in phase-deliverables.yaml declares approver_fallback", () => {
      for (const phase of rules.phaseDeliverables.phases) {
        for (const d of phase.deliverables) {
          expect(
            d.approver_fallback,
            `phase ${phase.id} / deliverable ${d.id} is missing approver_fallback`,
          ).toBeDefined();
          expect(d.approver_fallback.length).toBeGreaterThan(0);
        }
      }
    });

    it("every fallback chain entry refers to a real role in the catalogue", () => {
      const validRoleIds = new Set(loadRolesAsMap(ROLES_DIR).keys());
      const errors: string[] = [];
      for (const phase of rules.phaseDeliverables.phases) {
        for (const d of phase.deliverables) {
          for (const r of d.approver_fallback) {
            if (!validRoleIds.has(r)) {
              errors.push(`phase ${phase.id}/${d.id}: approver_fallback "${r}" not in roles catalogue`);
            }
          }
          for (const r of d.responsible_fallback) {
            if (!validRoleIds.has(r)) {
              errors.push(`phase ${phase.id}/${d.id}: responsible_fallback "${r}" not in roles catalogue`);
            }
          }
        }
      }
      expect(errors).toEqual([]);
    });
  });
});
