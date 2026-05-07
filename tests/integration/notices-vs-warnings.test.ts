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
