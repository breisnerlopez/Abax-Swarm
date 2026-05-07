// Tier C++ — Differential testing.
//
// "Changing ONE dimension changes SOLO the expected files." Catches
// spurious coupling: e.g. a stack change that affects phase IDs (it
// shouldn't), a size change that breaks file structure (it shouldn't),
// a name change that affects anything beyond manifest (it shouldn't).
//
// See docs/TEST-PLAN.md Tier C++ for the full matrix.

import { describe, it, expect } from "vitest";
import {
  buildConfig,
  generate,
  loadTestContext,
  normalizeForCrossTarget,
} from "../helpers/test-context.js";

const ctx = loadTestContext();

function deliverableIds(result: ReturnType<typeof generate>): string[] {
  const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
  if (!policiesFile) return [];
  const policies = JSON.parse(policiesFile.content) as { phases?: Array<{ deliverables?: Array<{ id: string }> }> };
  return (policies.phases ?? []).flatMap((p) => (p.deliverables ?? []).map((d) => d.id)).sort();
}

function phaseIds(result: ReturnType<typeof generate>): string[] {
  const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
  if (!policiesFile) return [];
  const policies = JSON.parse(policiesFile.content) as { phases?: Array<{ id: string }> };
  return (policies.phases ?? []).map((p) => p.id).sort();
}

function gateIds(result: ReturnType<typeof generate>): string[] {
  const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"));
  if (!policiesFile) return [];
  const policies = JSON.parse(policiesFile.content) as { phases?: Array<{ id: string; gates?: Array<{ id: string }> }> };
  return (policies.phases ?? []).flatMap((p) => (p.gates ?? []).map((g) => `${p.id}/${g.id}`)).sort();
}

function fileSetSummary(result: ReturnType<typeof generate>): { paths: Set<string>; count: number } {
  return {
    paths: new Set(result.files.map((f) => f.path)),
    count: result.files.length,
  };
}

describe("Tier C++ — Differential testing", () => {
  describe("size change (small → medium → large)", () => {
    const small = generate(buildConfig({ size: "small" }), ctx);
    const medium = generate(buildConfig({ size: "medium" }), ctx);
    const large = generate(buildConfig({ size: "large" }), ctx);

    it("deliverable IDs are identical regardless of size (data-driven, not size-specific)", () => {
      expect(deliverableIds(medium)).toEqual(deliverableIds(small));
      expect(deliverableIds(large)).toEqual(deliverableIds(small));
    });

    it("phase IDs are identical regardless of size", () => {
      expect(phaseIds(medium)).toEqual(phaseIds(small));
      expect(phaseIds(large)).toEqual(phaseIds(small));
    });

    it("gate IDs are identical regardless of size", () => {
      expect(gateIds(medium)).toEqual(gateIds(small));
      expect(gateIds(large)).toEqual(gateIds(small));
    });

    it("team role count grows monotonically with size", () => {
      expect(small.project.roles.length).toBeLessThanOrEqual(medium.project.roles.length);
      expect(medium.project.roles.length).toBeLessThanOrEqual(large.project.roles.length);
    });

    it("file count grows or stays similar — never collapses dramatically", () => {
      // Tolerate ~30% file count variance (more roles → more agent .md, more skills)
      const a = small.files.length;
      const b = large.files.length;
      expect(b).toBeGreaterThanOrEqual(a * 0.9);
    });
  });

  describe("stack change (mvn-based → python-based)", () => {
    const angular = generate(buildConfig({ stackId: "angular-quarkus" }), ctx);
    const python = generate(buildConfig({ stackId: "python-fastapi" }), ctx);

    it("phase IDs identical across stacks", () => {
      expect(phaseIds(python)).toEqual(phaseIds(angular));
    });

    it("deliverable IDs identical across stacks", () => {
      expect(deliverableIds(python)).toEqual(deliverableIds(angular));
    });

    it("gate IDs identical across stacks", () => {
      expect(gateIds(python)).toEqual(gateIds(angular));
    });

    it("verify-deliverable tool body differs (test commands stack-specific)", () => {
      // The verification command in deliverables uses {stack.backend.test_command}
      // which resolves differently. After resolution the bodies differ.
      const angularPolicies = angular.files.find((f) => f.path.includes("abax-policies.json"))!;
      const pythonPolicies = python.files.find((f) => f.path.includes("abax-policies.json"))!;
      expect(angularPolicies.content).not.toEqual(pythonPolicies.content);
    });

    it("manifest stack field reflects the choice", () => {
      const angularManifest = angular.files.find((f) => f.path === "project-manifest.yaml")!;
      const pythonManifest = python.files.find((f) => f.path === "project-manifest.yaml")!;
      expect(angularManifest.content).toContain("angular-quarkus");
      expect(pythonManifest.content).toContain("python-fastapi");
    });
  });

  describe("target change (opencode ↔ claude)", () => {
    const oc = generate(buildConfig({ target: "opencode" }), ctx);
    const cc = generate(buildConfig({ target: "claude" }), ctx);

    it("policies.json semantically equivalent (after cross-target normalization)", () => {
      const ocPolicies = oc.files.find((f) => f.path.includes("abax-policies.json"))!;
      const ccPolicies = cc.files.find((f) => f.path.includes("abax-policies.json"))!;
      expect(normalizeForCrossTarget(JSON.parse(ocPolicies.content)))
        .toEqual(normalizeForCrossTarget(JSON.parse(ccPolicies.content)));
    });

    it("deliverable IDs identical across targets", () => {
      expect(deliverableIds(cc)).toEqual(deliverableIds(oc));
    });

    it("gate IDs identical across targets", () => {
      expect(gateIds(cc)).toEqual(gateIds(oc));
    });

    it("opencode emits .opencode/, claude emits .claude/ — paths differ correctly", () => {
      const ocPaths = [...fileSetSummary(oc).paths].filter((p) => p.startsWith(".opencode/"));
      const ccPaths = [...fileSetSummary(cc).paths].filter((p) => p.startsWith(".claude/"));
      expect(ocPaths.length).toBeGreaterThan(0);
      expect(ccPaths.length).toBeGreaterThan(0);
      // Opencode shouldn't emit .claude/ files; claude shouldn't emit .opencode/.
      const ocClaude = [...fileSetSummary(oc).paths].filter((p) => p.startsWith(".claude/"));
      const ccOpencode = [...fileSetSummary(cc).paths].filter((p) => p.startsWith(".opencode/"));
      expect(ocClaude).toEqual([]);
      expect(ccOpencode).toEqual([]);
    });

    it("plugin/hook present in both, language-appropriate (TS vs Python)", () => {
      const ocPlugin = oc.files.find((f) => f.path === ".opencode/plugins/abax-policy.ts");
      const ccHook = cc.files.find((f) => f.path.match(/\.claude\/.*abax-policy\.py$/));
      expect(ocPlugin, "opencode plugin missing").toBeDefined();
      expect(ccHook, "claude hook missing").toBeDefined();
    });
  });

  describe("mode change (new → document)", () => {
    const newMode = generate(buildConfig({ mode: "new" }), ctx);
    const docMode = generate(buildConfig({ mode: "document" }), ctx);

    it("team composition differs: document mode has documentation-focused roles", () => {
      const newTeam = new Set(newMode.project.roles.map((r) => r.id));
      const docTeam = new Set(docMode.project.roles.map((r) => r.id));
      // Document mode team is DIFFERENT (not necessarily smaller). It
      // pivots away from implementation roles toward doc/UX roles.
      expect(docTeam).not.toEqual(newTeam);
      // tech-writer is the marker role for document mode
      expect(docTeam.has("tech-writer")).toBe(true);
      // Doc mode typically excludes pure-build roles
      expect(docTeam.has("developer-backend")).toBe(false);
    });

    it("file path conventions hold in both modes", () => {
      const newPaths = fileSetSummary(newMode).paths;
      const docPaths = fileSetSummary(docMode).paths;
      expect(newPaths).toContain("project-manifest.yaml");
      expect(docPaths).toContain("project-manifest.yaml");
      expect(newPaths).toContain("opencode.json");
      expect(docPaths).toContain("opencode.json");
    });

    it("manifest reflects the mode (document mode flagged)", () => {
      const docManifest = docMode.files.find((f) => f.path === "project-manifest.yaml")!;
      // Doc mode often resolves to a different governance model name
      expect(docManifest.content).toMatch(/document|Documentación|Documentacion/);
    });
  });

  describe("name change (only name differs)", () => {
    const aaa = generate(buildConfig({ name: "ProjectAAA" }), ctx);
    const bbb = generate(buildConfig({ name: "ProjectBBB" }), ctx);

    it("file count is identical when only name changes", () => {
      expect(bbb.files.length).toBe(aaa.files.length);
    });

    it("path set is identical when only name changes", () => {
      expect([...fileSetSummary(bbb).paths].sort())
        .toEqual([...fileSetSummary(aaa).paths].sort());
    });

    it("deliverable IDs identical", () => {
      expect(deliverableIds(bbb)).toEqual(deliverableIds(aaa));
    });

    it("manifest reflects the name change in `project.name` only", () => {
      const aManifest = aaa.files.find((f) => f.path === "project-manifest.yaml")!;
      const bManifest = bbb.files.find((f) => f.path === "project-manifest.yaml")!;
      expect(aManifest.content).toContain("ProjectAAA");
      expect(bManifest.content).toContain("ProjectBBB");
      expect(aManifest.content).not.toContain("ProjectBBB");
      expect(bManifest.content).not.toContain("ProjectAAA");
    });
  });

  describe("teamScope change (lean → full)", () => {
    const lean = generate(buildConfig({ teamScope: "lean" }), ctx);
    const full = generate(buildConfig({ teamScope: "full" }), ctx);

    it("lean has fewer or equal roles than full", () => {
      expect(lean.project.roles.length).toBeLessThanOrEqual(full.project.roles.length);
    });

    it("phase IDs identical regardless of scope", () => {
      expect(phaseIds(full)).toEqual(phaseIds(lean));
    });

    it("deliverable IDs identical regardless of scope", () => {
      expect(deliverableIds(full)).toEqual(deliverableIds(lean));
    });
  });
});
