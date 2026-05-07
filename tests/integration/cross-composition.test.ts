// Tier C+ — Cross-composition consistency.
//
// Verifies that compositions are consistent ENTRE SÍ, not just within
// each one. This catches a class of bugs the per-composition sweep
// (Tier C) cannot:
//
//   - Asymmetric generators (one target emits X, the other doesn't)
//   - Schema drift after partial refactors
//   - Path convention divergence per stack/size
//   - Non-deterministic generation (timestamps, random IDs sneaking in)
//   - init/regenerate disagreement
//
// See docs/TEST-PLAN.md for the full tier description.

import { describe, it, expect } from "vitest";
import {
  buildCompositionMatrix,
  buildConfig,
  generate,
  loadTestContext,
  stripNonDeterministic,
  extractShape,
  normalizeForCrossTarget,
} from "../helpers/test-context.js";

const ctx = loadTestContext();

describe("Tier C+ — Cross-composition consistency", () => {
  const compositions = buildCompositionMatrix();

  it("loads at least 12 compositions for cross-composition tests", () => {
    expect(compositions.length).toBeGreaterThanOrEqual(12);
  });

  describe("Schema invariance — all compositions have the same JSON shape", () => {
    it("policies.json top-level keys are identical across compositions", () => {
      const shapes = new Set<string>();
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const policiesFile = result.files.find((f) => f.path.match(/policies\/abax-policies\.json|policies\/abax-policies\.json/));
        if (!policiesFile) continue;
        const policies = JSON.parse(policiesFile.content);
        shapes.add(Object.keys(policies).sort().join(","));
      }
      // At most 1 unique shape — same top-level keys everywhere.
      expect(shapes.size, `policies.json top-level keys vary: ${[...shapes].join(" | ")}`).toBe(1);
    });

    it("policies.phases array element shape is identical across compositions", () => {
      const shapes = new Set<string>();
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
        if (!policiesFile) continue;
        const policies = JSON.parse(policiesFile.content);
        if (!policies.phases || policies.phases.length === 0) continue;
        // Take one representative phase, extract its shape
        const shape = JSON.stringify(extractShape(policies.phases[0]));
        shapes.add(shape);
      }
      expect(shapes.size, `phase element shape varies: ${shapes.size} variants found`).toBe(1);
    });

    it("manifest top-level keys are stable across compositions", () => {
      const shapes = new Set<string>();
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const manifestFile = result.files.find((f) => f.path === "project-manifest.yaml");
        if (!manifestFile) continue;
        // Extract top-level YAML keys (lines starting at column 0 with `key:`)
        const keys = manifestFile.content
          .split("\n")
          .filter((l) => /^[a-z_]+:/.test(l))
          .map((l) => l.split(":")[0])
          .sort()
          .join(",");
        shapes.add(keys);
      }
      // We accept up to 2 shapes because document mode adds a different
      // top-level structure. New + continue should agree though.
      expect(shapes.size).toBeLessThanOrEqual(2);
    });
  });

  describe("Path conventions — file structure is stable across compositions", () => {
    it("every composition emits project-manifest.yaml at root", () => {
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const paths = result.files.map((f) => f.path);
        expect(
          paths,
          `${c.id} missing project-manifest.yaml`,
        ).toContain("project-manifest.yaml");
      }
    });

    it("opencode targets emit opencode.json, claude targets emit .claude/settings.json", () => {
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const paths = result.files.map((f) => f.path);
        if (c.config.target === "opencode") {
          expect(paths, `${c.id} (opencode) missing opencode.json`).toContain("opencode.json");
        } else {
          // claude target uses .claude/settings.json (or similar config file)
          const hasClaudeConfig = paths.some((p) => p.startsWith(".claude/"));
          expect(hasClaudeConfig, `${c.id} (claude) missing .claude/ files`).toBe(true);
        }
      }
    });

    it("every opencode composition emits the runtime plugin", () => {
      const ocCompositions = compositions.filter((c) => c.config.target === "opencode");
      for (const c of ocCompositions) {
        const result = generate(c.config, ctx);
        const paths = result.files.map((f) => f.path);
        expect(
          paths,
          `${c.id} missing .opencode/plugins/abax-policy.ts`,
        ).toContain(".opencode/plugins/abax-policy.ts");
        expect(
          paths,
          `${c.id} missing .opencode/policies/abax-policies.json`,
        ).toContain(".opencode/policies/abax-policies.json");
      }
    });

    it("every claude composition emits the runtime hook", () => {
      const ccCompositions = compositions.filter((c) => c.config.target === "claude");
      for (const c of ccCompositions) {
        const result = generate(c.config, ctx);
        const paths = result.files.map((f) => f.path);
        // Claude target uses Python hook + JSON policies under .claude/
        const hasHook = paths.some((p) => p.includes(".claude") && p.includes("abax-policy"));
        expect(hasHook, `${c.id} missing claude hook`).toBe(true);
        const hasPolicies = paths.some((p) => p.includes(".claude") && p.includes("abax-policies.json"));
        expect(hasPolicies, `${c.id} missing claude policies`).toBe(true);
      }
    });
  });

  describe("Idempotency — same config produces same output bytewise", () => {
    it("two generations of the same config produce identical files", () => {
      const config = buildConfig({ size: "small", stackId: "angular-quarkus" });
      const a = generate(config, ctx);
      const b = generate(config, ctx);
      expect(a.files.length).toBe(b.files.length);
      const aMap = new Map(a.files.map((f) => [f.path, f.content]));
      for (const bFile of b.files) {
        const aContent = aMap.get(bFile.path);
        expect(aContent, `${bFile.path} present in b but not a`).toBeDefined();
        expect(
          stripNonDeterministic(bFile.content),
          `${bFile.path} content differs between two runs`,
        ).toBe(stripNonDeterministic(aContent!));
      }
    });

    it("idempotent across different size compositions (same size produces same output)", () => {
      for (const size of ["small", "medium", "large"] as const) {
        const a = generate(buildConfig({ size }), ctx);
        const b = generate(buildConfig({ size }), ctx);
        expect(a.files.length, `size=${size} count differs`).toBe(b.files.length);
      }
    });
  });

  describe("Cross-target equivalence — opencode and claude are semantically identical", () => {
    it("policies.json content is semantically identical for opencode and claude (same other dims)", () => {
      const config = { size: "medium" as const, stackId: "react-nextjs" };
      const oc = generate(buildConfig({ ...config, target: "opencode" }), ctx);
      const cc = generate(buildConfig({ ...config, target: "claude" }), ctx);

      const ocPolicies = oc.files.find((f) => f.path.includes("abax-policies.json"));
      const ccPolicies = cc.files.find((f) => f.path.includes("abax-policies.json"));

      expect(ocPolicies, "opencode policies missing").toBeDefined();
      expect(ccPolicies, "claude policies missing").toBeDefined();

      const ocJson = normalizeForCrossTarget(JSON.parse(ocPolicies!.content));
      const ccJson = normalizeForCrossTarget(JSON.parse(ccPolicies!.content));

      expect(ocJson).toEqual(ccJson);
    });

    it("orchestrator file mentions ALL team roles equivalently across targets", () => {
      // opencode emits .opencode/agents/orchestrator.md, claude emits CLAUDE.md
      // at root. Different paths, equivalent SEMANTIC content. Both files
      // contain target-specific built-in agents (opencode: explore/plan/docs,
      // claude: general-purpose) plus the team roles. We filter to team
      // roles only — those should be identical.
      const config = { size: "small" as const, stackId: "python-fastapi" };
      const oc = generate(buildConfig({ ...config, target: "opencode" }), ctx);
      const cc = generate(buildConfig({ ...config, target: "claude" }), ctx);

      const ocOrch = oc.files.find((f) => f.path.match(/agents\/orchestrator\.md$/));
      const ccOrch = cc.files.find((f) => f.path === "CLAUDE.md");
      expect(ocOrch, "opencode orchestrator missing").toBeDefined();
      expect(ccOrch, "claude CLAUDE.md missing").toBeDefined();

      const teamIds = new Set(oc.project.roles.map((r) => r.id));
      const ocMentions = new Set(
        [...ocOrch!.content.matchAll(/@([a-z0-9-]+)/g)]
          .map((m) => m[1])
          .filter((id) => teamIds.has(id)),
      );
      const ccMentions = new Set(
        [...ccOrch!.content.matchAll(/@([a-z0-9-]+)/g)]
          .map((m) => m[1])
          .filter((id) => teamIds.has(id)),
      );

      expect(
        [...ocMentions].sort(),
        `team-role mention sets differ: oc=${[...ocMentions]} cc=${[...ccMentions]}`,
      ).toEqual([...ccMentions].sort());
    });
  });

  describe("Phase id stability — phase ids are a stable subset of canonical phases", () => {
    const CANONICAL_PHASES = [
      "discovery",
      "inception",
      "functional-analysis",
      "technical-design",
      "construction",
      "qa-testing",
      "uat",
      "deployment",
      "stabilization",
      "closure",
    ];

    it("every composition's policies.phases ids are a subset of canonical phases", () => {
      for (const c of compositions) {
        const result = generate(c.config, ctx);
        const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
        if (!policiesFile) continue;
        const policies = JSON.parse(policiesFile.content);
        const phaseIds = (policies.phases ?? []).map((p: { id: string }) => p.id);
        for (const id of phaseIds) {
          expect(
            CANONICAL_PHASES,
            `${c.id} has unknown phase id "${id}"`,
          ).toContain(id);
        }
      }
    });

    it("at least 6 phases present in non-document compositions", () => {
      const newModeCompositions = compositions.filter((c) => c.config.mode !== "document");
      for (const c of newModeCompositions) {
        const result = generate(c.config, ctx);
        const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
        if (!policiesFile) continue;
        const policies = JSON.parse(policiesFile.content);
        expect(
          policies.phases.length,
          `${c.id} has only ${policies.phases.length} phases`,
        ).toBeGreaterThanOrEqual(6);
      }
    });
  });
});
