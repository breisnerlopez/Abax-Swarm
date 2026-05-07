// Cross-cutting tests for the notices-vs-warnings split (0.1.41).
import { describe, it, expect } from "vitest";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { ProjectConfig, DataContext } from "../../src/engine/types.js";
import { resolveWithFallback } from "../../src/engine/role-fallback.js";

const ctx: DataContext = {
  roles: loadRolesAsMap("data/roles"),
  skills: loadSkillsAsMap("data/skills"),
  tools: loadToolsAsMap("data/tools"),
  stacks: loadStacksAsMap("data/stacks"),
  ...loadAllRules("data/rules"),
} as DataContext;

const SMALL_LIGHTWEIGHT_CONFIG: ProjectConfig = {
  name: "test-repro",
  description: "User's scenario reproduction",
  size: "small",
  stackId: "angular-quarkus",
  target: "opencode",
  teamScope: "full",
  criteria: [],
  provider: "anthropic",
  modelStrategy: "inherit",
  permissionMode: "recommended",
  isolationMode: "host",
} as ProjectConfig;

describe("Pipeline aggregates notices separately from warnings", () => {
  it("orchestratorNotices field exists and is populated for small+lightweight", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);

    expect(result.orchestratorNotices).toBeDefined();
    expect(Array.isArray(result.orchestratorNotices)).toBe(true);
    expect(result.orchestratorNotices.length).toBeGreaterThan(0);
  });

  it("orchestratorWarnings is collapsed for the user's exact scenario", () => {
    // The 0.1.40 user reported ~80 warnings. Strict zero now because
    // every previously-warned role/deliverable has either a fallback
    // chain (resolved as notice) or is optional for `small`.
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);

    expect(
      result.orchestratorWarnings,
      `Regressed: small+lightweight should produce zero warnings in 0.1.41+. Got:\n${result.orchestratorWarnings.join("\n")}`,
    ).toEqual([]);
  });

  it("notices vs warnings ratio reflects governance-aware downgrade", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);
    expect(result.orchestratorNotices.length).toBeGreaterThan(result.orchestratorWarnings.length);
  });

  it("notices and warnings are disjoint (no message in both channels)", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);
    const wSet = new Set(result.orchestratorWarnings);
    const overlap = result.orchestratorNotices.filter((n) => wSet.has(n));
    expect(overlap, "notices and warnings should not contain the same message").toEqual([]);
  });

  // 0.1.42: sponsor approvals
  it("sponsorApprovals is populated for small+lightweight (PO not in team)", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);
    expect(result.sponsorApprovals).toBeDefined();
    expect(result.sponsorApprovals.length).toBeGreaterThan(0);
    // The 29 PO-approved deliverables in the catalogue should all surface
    expect(result.sponsorApprovals.length).toBe(29);
  });

  it("each sponsor approval entry has phase + deliverable identifiers", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);
    for (const a of result.sponsorApprovals) {
      expect(a.phaseId).toBeTruthy();
      expect(a.phaseName).toBeTruthy();
      expect(a.deliverableId).toBeTruthy();
      expect(a.deliverableName).toBeTruthy();
    }
  });

  it("sponsor approvals include the strategic deliverables (vision, backlog, charter, closure)", () => {
    const selection = runSelection(SMALL_LIGHTWEIGHT_CONFIG, ctx);
    const result = runPipeline(SMALL_LIGHTWEIGHT_CONFIG, selection, ctx);
    const ids = new Set(result.sponsorApprovals.map((a) => a.deliverableId));
    // Spot-check that the user retains approval over key strategic gates.
    expect(ids.has("vision-producto")).toBe(true);
    expect(ids.has("backlog-priorizado")).toBe(true);
    expect(ids.has("project-charter")).toBe(true);
    expect(ids.has("closure-report")).toBe(true);
    expect(ids.has("uat-signoff")).toBe(true);
  });

  it("sponsorApprovals is empty when product-owner IS in the team", () => {
    const withPO = {
      ...SMALL_LIGHTWEIGHT_CONFIG,
      // Force a team that explicitly includes product-owner.
      criteria: [],
    };
    // Build a selection manually with PO in team.
    const selection = runSelection(withPO, ctx);
    const augmentedCtx = { ...ctx };
    // Inject PO into the resolved roles to simulate.
    const poRole = ctx.roles.get("product-owner");
    if (!poRole) throw new Error("product-owner role missing from catalogue");
    const augmentedSelection = {
      ...selection,
      roles: [...selection.roles, { roleId: "product-owner", reason: "manual" as const }],
    };
    const result = runPipeline(withPO, augmentedSelection, augmentedCtx);
    expect(result.sponsorApprovals).toEqual([]);
  });
});

describe("resolveWithFallback exclude option (segregation of duties)", () => {
  const team = new Set(["a", "b", "c"]);

  it("returns primary when not excluded", () => {
    expect(resolveWithFallback("a", ["b"], team)).toBe("a");
  });

  it("skips primary when excluded, walks fallback chain", () => {
    expect(resolveWithFallback("a", ["b", "c"], team, { exclude: ["a"] })).toBe("b");
  });

  it("skips both primary and excluded fallback candidates", () => {
    expect(resolveWithFallback("a", ["b", "c"], team, { exclude: ["a", "b"] })).toBe("c");
  });

  it("returns null when all candidates are excluded", () => {
    expect(resolveWithFallback("a", ["b"], team, { exclude: ["a", "b"] })).toBeNull();
  });

  it("accepts both Set and array exclude", () => {
    expect(resolveWithFallback("a", ["b"], team, { exclude: new Set(["a"]) })).toBe("b");
    expect(resolveWithFallback("a", ["b"], team, { exclude: ["a"] })).toBe("b");
  });

  it("backward compat: no options behaves as before", () => {
    expect(resolveWithFallback("a", ["b"], team)).toBe("a");
    expect(resolveWithFallback("z", ["a"], team)).toBe("a");
    expect(resolveWithFallback("z", ["y"], team)).toBeNull();
  });

  it("does not pick the same person for responsible+approver via fallback", () => {
    // Real-world scenario: deliverable has responsible=tech-writer
    // (not in team), responsible_fallback=[tech-lead] → resolves to
    // tech-lead. approver=tech-lead → would be self-approval.
    // With exclude=[tech-lead], approver chain skips tech-lead.
    const tinyTeam = new Set(["tech-lead", "project-manager"]);
    const responsibleResolved = "tech-lead";
    const approverResolved = resolveWithFallback(
      "tech-lead",
      ["solution-architect", "project-manager"],
      tinyTeam,
      { exclude: [responsibleResolved] },
    );
    expect(approverResolved).toBe("project-manager"); // not tech-lead!
  });
});
