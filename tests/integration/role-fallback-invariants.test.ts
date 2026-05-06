// Permanent guardrail — runs on every commit. Locks the role-fallback
// resolution invariants observed in Tier E (36 compositions) and Tier F
// (cross-cutting consistency). Any future change that re-introduces
// orphan deliverables, drops fallback chains, or makes the orchestrator
// disagree with policies.json will fail this test.
import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { loadDataContext } from "../../src/cli/data-context.js";
import { resolveWithFallback } from "../../src/engine/role-fallback.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { ProjectConfig, DataContext } from "../../src/engine/types.js";

let ctx: DataContext;
beforeAll(() => { ctx = loadDataContext(); });

function buildConfig(opts: {
  size: "small" | "medium" | "large";
  scope: "lean" | "full";
  stackId?: string;
  name?: string;
}): ProjectConfig {
  return {
    name: opts.name ?? `test-${opts.size}-${opts.scope}`,
    description: "fixture",
    targetDir: "/tmp",
    size: opts.size,
    criteria: [],
    stackId: opts.stackId ?? "legacy-other",
    target: "opencode",
    teamScope: opts.scope,
    provider: "openai",
    modelStrategy: "inherit",
    permissionMode: "full",
    isolationMode: "host",
  };
}

interface PolicyShape {
  role_categories: Record<string, string>;
  phases: Array<{
    id: string;
    deliverables: Array<{ id: string; responsible: string; mandatory: boolean }>;
  }>;
}

function policiesOf(config: ProjectConfig): PolicyShape {
  const selection = runSelection(config, ctx);
  const result = runPipeline(config, selection, ctx);
  const policiesFile = result.files.find((f) =>
    f.path === ".opencode/policies/abax-policies.json",
  );
  expect(policiesFile, "policies file must be emitted").toBeDefined();
  return JSON.parse(policiesFile!.content);
}

describe("Role-fallback invariant — every responsible in policies.phases must be in team", () => {
  const compositions: Array<{ size: "small" | "medium" | "large"; scope: "lean" | "full" }> = [
    { size: "small", scope: "lean" },
    { size: "small", scope: "full" },
    { size: "medium", scope: "lean" },
    { size: "medium", scope: "full" },
    { size: "large", scope: "lean" },
    { size: "large", scope: "full" },
  ];

  for (const c of compositions) {
    it(`${c.size}/${c.scope}: every deliverable.responsible resolves to a team member`, () => {
      const policies = policiesOf(buildConfig(c));
      const team = new Set(Object.keys(policies.role_categories));
      const orphans: string[] = [];
      for (const phase of policies.phases) {
        for (const d of phase.deliverables) {
          if (!team.has(d.responsible)) {
            orphans.push(`${phase.id}/${d.id}=${d.responsible}`);
          }
        }
      }
      expect(orphans, `orphan deliverables in ${c.size}/${c.scope}`).toEqual([]);
    });
  }
});

describe("Role-fallback invariant — no MANDATORY deliverable silently disappears", () => {
  // For each composition, every mandatory deliverable in
  // phase-deliverables.yaml whose primary responsible OR any fallback
  // role IS in the team MUST appear in policies.phases. If a mandatory
  // deliverable has no fallback chain that resolves, that's a config
  // hole (the data file should declare a fallback or accept the loss).
  it("small/lean: mandatory deliverables either render or have no possible fallback", () => {
    const policies = policiesOf(buildConfig({ size: "small", scope: "lean" }));
    const team = new Set(Object.keys(policies.role_categories));

    const renderedIds = new Set<string>();
    for (const phase of policies.phases) {
      for (const d of phase.deliverables) renderedIds.add(`${phase.id}/${d.id}`);
    }

    const lostMandatoryWithFallbackPossible: string[] = [];
    for (const phase of ctx.phaseDeliverables.phases) {
      for (const d of phase.deliverables) {
        if (!d.mandatory) continue;
        const id = `${phase.id}/${d.id}`;
        if (renderedIds.has(id)) continue;
        // Not rendered — was there ANY way to resolve?
        const resolved = resolveWithFallback(d.responsible, d.responsible_fallback, team);
        if (resolved) {
          // Could have resolved but didn't → bug
          lostMandatoryWithFallbackPossible.push(id);
        }
      }
    }
    expect(lostMandatoryWithFallbackPossible).toEqual([]);
  });
});

describe("Role-fallback invariant — orchestrator @mentions match policies.phases", () => {
  // The orchestrator-generator (rendered .md) and plugin-generator
  // (policies.json) must agree on which roles get @mentioned. Drift
  // here means the orchestrator instructs delegation to a role that
  // the runtime tools wouldn't recognise (or vice versa).
  for (const c of [
    { size: "small" as const, scope: "lean" as const },
    { size: "small" as const, scope: "full" as const },
    { size: "medium" as const, scope: "lean" as const },
    { size: "medium" as const, scope: "full" as const },
  ]) {
    it(`${c.size}/${c.scope}: orchestrator @mentions ⊆ team`, () => {
      const config = buildConfig(c);
      const selection = runSelection(config, ctx);
      const result = runPipeline(config, selection, ctx);
      const orchFile = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
      expect(orchFile).toBeDefined();
      const team = new Set(result.project.roles.map((r) => r.id).concat("orchestrator"));
      const KNOWN_NATIVES = new Set(["explore", "general", "plan", "docs"]);

      const mentions = orchFile!.content.match(/@[a-z][a-z0-9-]+/g) || [];
      const offenders: string[] = [];
      for (const m of mentions) {
        const id = m.slice(1);
        if (team.has(id)) continue;
        if (KNOWN_NATIVES.has(id)) continue;
        offenders.push(id);
      }
      expect([...new Set(offenders)]).toEqual([]);
    });
  }
});

describe("Cross-target invariant — opencode and claude emit identical policies.phases", () => {
  // Drift catcher: the opencode plugin-generator and claude policy-generator
  // both emit policies.json. They must produce IDENTICAL policies.phases
  // for the same project — different runtime, same merged data. This
  // failed before the resolveDeliverablesForTeam helper was extracted
  // (claude side did NOT apply fallback resolution).
  for (const c of [
    { size: "small" as const, scope: "lean" as const },
    { size: "medium" as const, scope: "full" as const },
    { size: "large" as const, scope: "full" as const },
  ]) {
    it(`${c.size}/${c.scope}: phases identical across targets`, () => {
      const ocConfig = { ...buildConfig(c), target: "opencode" as const };
      const ccConfig = { ...buildConfig(c), target: "claude" as const };

      const ocResult = runPipeline(ocConfig, runSelection(ocConfig, ctx), ctx);
      const ccResult = runPipeline(ccConfig, runSelection(ccConfig, ctx), ctx);

      const ocPolicies = ocResult.files.find(
        (f) => f.path === ".opencode/policies/abax-policies.json",
      );
      const ccPolicies = ccResult.files.find(
        (f) => f.path === ".claude/policies/abax-policies.json",
      );
      expect(ocPolicies).toBeDefined();
      expect(ccPolicies).toBeDefined();

      const ocPhases = JSON.parse(ocPolicies!.content).phases;
      const ccPhases = JSON.parse(ccPolicies!.content).phases;
      // Compare the resolved deliverable lists. role_categories etc. are
      // identical by construction; we focus on the phase set which was
      // the actual drift point.
      expect(ccPhases).toEqual(ocPhases);
    });
  }
});

describe("Role-fallback resolver — unit", () => {
  it("primary role in team → returns primary", () => {
    expect(resolveWithFallback("a", ["b"], new Set(["a", "b"]))).toBe("a");
  });
  it("primary missing, fallback in team → returns fallback", () => {
    expect(resolveWithFallback("a", ["b"], new Set(["b"]))).toBe("b");
  });
  it("walks chain in order", () => {
    expect(resolveWithFallback("a", ["b", "c"], new Set(["c"]))).toBe("c");
    expect(resolveWithFallback("a", ["b", "c"], new Set(["b", "c"]))).toBe("b");
  });
  it("nothing matches → null", () => {
    expect(resolveWithFallback("a", ["b"], new Set(["x"]))).toBeNull();
  });
  it("undefined fallback chain → null when primary missing", () => {
    expect(resolveWithFallback("a", undefined, new Set(["b"]))).toBeNull();
  });
});
