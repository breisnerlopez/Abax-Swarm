// Unit tests for the severity classification helpers introduced in 0.1.41.
// These are pure functions over the size matrix — no I/O, no fixtures.
import { describe, it, expect } from "vitest";
import {
  classifyRoleTier,
  severityForMissingRole,
  type ValidationContext,
} from "../../../src/validator/types.js";
import type { SizeMatrix } from "../../../src/loader/schemas.js";

const matrix: SizeMatrix = {
  roles_by_size: {
    small: {
      indispensable: ["project-manager", "tech-lead"],
      recommended: ["solution-architect"],
      optional: ["product-owner", "qa-lead"],
    },
    medium: {
      indispensable: ["project-manager", "tech-lead", "product-owner"],
      recommended: ["qa-lead"],
      optional: ["qa-performance"],
    },
    large: {
      indispensable: ["project-manager", "tech-lead", "product-owner", "qa-lead"],
      recommended: ["qa-performance"],
      optional: [],
    },
  },
};

describe("classifyRoleTier", () => {
  it("returns indispensable when role is in the indispensable list for the size", () => {
    expect(classifyRoleTier("project-manager", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("indispensable");
  });

  it("returns recommended when role is recommended for the size", () => {
    expect(classifyRoleTier("solution-architect", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("recommended");
  });

  it("returns optional when role is optional for the size", () => {
    expect(classifyRoleTier("product-owner", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("optional");
  });

  it("returns unknown when role is not catalogued", () => {
    expect(classifyRoleTier("ghost-role", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("unknown");
  });

  it("returns unknown when context is missing", () => {
    expect(classifyRoleTier("project-manager", undefined)).toBe("unknown");
    expect(classifyRoleTier("project-manager", {})).toBe("unknown");
    expect(classifyRoleTier("project-manager", { sizeMatrix: matrix })).toBe("unknown");
    expect(classifyRoleTier("project-manager", { projectSize: "small" } as ValidationContext))
      .toBe("unknown");
  });

  it("respects different sizes for the same role", () => {
    // product-owner: optional for small, indispensable for medium/large
    expect(classifyRoleTier("product-owner", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("optional");
    expect(classifyRoleTier("product-owner", { sizeMatrix: matrix, projectSize: "medium" }))
      .toBe("indispensable");
    expect(classifyRoleTier("product-owner", { sizeMatrix: matrix, projectSize: "large" }))
      .toBe("indispensable");
  });
});

describe("severityForMissingRole", () => {
  it("downgrades to notice for optional roles", () => {
    expect(severityForMissingRole("product-owner", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("notice");
  });

  it("keeps as warning for recommended roles", () => {
    expect(severityForMissingRole("solution-architect", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("warning");
  });

  it("keeps as warning for indispensable roles", () => {
    expect(severityForMissingRole("project-manager", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("warning");
  });

  it("keeps as warning for unknown roles", () => {
    expect(severityForMissingRole("ghost-role", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("warning");
  });

  it("keeps as warning when context is missing (safe default)", () => {
    expect(severityForMissingRole("product-owner", undefined)).toBe("warning");
  });

  it("flips severity for the same role across sizes (the whole point)", () => {
    expect(severityForMissingRole("product-owner", { sizeMatrix: matrix, projectSize: "small" }))
      .toBe("notice");
    expect(severityForMissingRole("product-owner", { sizeMatrix: matrix, projectSize: "medium" }))
      .toBe("warning");
  });

  it("document mode downgrades EVERYTHING to notice (intentional minimal team)", () => {
    // In document mode the user picked a docs-only team; references to
    // dev/qa/ops roles in catalogue data are not actionable.
    const docCtx = { sizeMatrix: matrix, projectSize: "small" as const, mode: "document" as const };
    expect(severityForMissingRole("product-owner", docCtx)).toBe("notice");
    expect(severityForMissingRole("project-manager", docCtx)).toBe("notice"); // would be warning otherwise
    expect(severityForMissingRole("solution-architect", docCtx)).toBe("notice"); // recommended → notice in doc
    expect(severityForMissingRole("ghost-role", docCtx)).toBe("notice"); // unknown → notice in doc
  });

  it("document mode acts even without sizeMatrix", () => {
    expect(severityForMissingRole("anything", { mode: "document" })).toBe("notice");
  });
});
