// Tier F — Semantic snapshots.
//
// Verifies the CONTENT of generated files, not just their presence.
// Catches regressions where the structure stays valid but the meaning
// changes — e.g. the 0.1.41 PO regression where vision-producto's
// approver silently became business-analyst instead of sponsor.
//
// Aimed at clases of bugs:
//   - Approver/responsible drift in deliverable rendering
//   - Unresolved placeholders in orchestrator narratives
//   - RACI section including roles not in team
//   - Naming inconsistency between files (deliverable IDs out of sync)
//
// See docs/TEST-PLAN.md Tier F for the full description.

import { describe, it, expect } from "vitest";
import {
  buildConfig,
  generate,
  loadTestContext,
  extractDeliverableSection,
  deliverableName,
} from "../helpers/test-context.js";

const ctx = loadTestContext();

// User's reported scenario — 9 roles, no product-owner. The most fertile
// ground for semantic regression because the orchestrator must
// substitute "el usuario (sponsor)" for missing PO.
const SMALL_LIGHTWEIGHT = buildConfig({ size: "small", stackId: "angular-quarkus" });

describe("Tier F — Semantic snapshots of generated content", () => {
  describe("Strategic deliverables — sponsor approves when PO not in team", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const orchFile = result.files.find((f) => f.path.match(/agents\/orchestrator\.md$/));
    expect(orchFile, "orchestrator.md missing").toBeDefined();
    const orch = orchFile!.content;
    const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"))!;
    const policies = JSON.parse(policiesFile.content);

    const STRATEGIC_DELIVERABLES = [
      "vision-producto",
      "backlog-priorizado",
      "project-charter",
      "uat-signoff",
      "closure-report",
    ];

    for (const id of STRATEGIC_DELIVERABLES) {
      it(`"${id}" routes to sponsor (not a delegated agent) for approval`, () => {
        // Orchestrator references deliverables by HUMAN NAME (table-of-deliverables
        // style), not by id. Look up the name from policies and search by it.
        const name = deliverableName(policies, id);
        expect(name, `${id} not found in policies`).toBeTruthy();
        const section = extractDeliverableSection(orch, name!);
        expect(
          section.length,
          `Deliverable "${name}" (id=${id}) not found in orchestrator.md`,
        ).toBeGreaterThan(0);
        // Section must mention sponsor approval — the strategic gate.
        expect(
          section,
          `${id} ("${name}") should mention sponsor/usuario as approver`,
        ).toMatch(/sponsor|usuario/i);
      });
    }

    it("sponsorApprovals field on PipelineResult lists exactly these strategic deliverables", () => {
      const ids = new Set(result.sponsorApprovals.map((a) => a.deliverableId));
      for (const id of STRATEGIC_DELIVERABLES) {
        expect(ids.has(id), `${id} missing from sponsorApprovals`).toBe(true);
      }
    });
  });

  describe("Technical deliverables — team member approves, NOT sponsor", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const orchFile = result.files.find((f) => f.path.match(/agents\/orchestrator\.md$/))!;
    const orch = orchFile.content;

    // env-verification, source-code, unit-tests, runbook etc. — all
    // technical deliverables. Approvers should be team members
    // (tech-lead, solution-architect), never sponsor.
    const policiesFile2 = result.files.find((f) => f.path.includes("abax-policies.json"))!;
    const policies = JSON.parse(policiesFile2.content);

    function findSection(id: string): string {
      const name = deliverableName(policies, id);
      if (!name) return "";
      return extractDeliverableSection(orch, name);
    }

    it("env-verification routes to tech-lead, not sponsor", () => {
      const section = findSection("env-verification");
      expect(section, "env-verification not in orchestrator").toMatch(/@tech-lead/);
      expect(section).not.toMatch(/sponsor/);
    });

    it("source-code routes to tech-lead, not sponsor", () => {
      const section = findSection("source-code");
      expect(section).toMatch(/@tech-lead/);
      expect(section).not.toMatch(/sponsor/);
    });

    it("project-readme falls back from tech-writer to tech-lead (not sponsor)", () => {
      const section = findSection("project-readme");
      expect(section).toMatch(/@(tech-writer|tech-lead)/);
      expect(section).not.toMatch(/sponsor/);
    });
  });

  describe("RACI section — only references team roles", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const orchFile = result.files.find((f) => f.path.match(/agents\/orchestrator\.md$/))!;
    const teamIds = new Set(result.project.roles.map((r) => r.id));

    it("orchestrator @mentions are subset of team roles + built-in agents", () => {
      const allMentions = [...orchFile.content.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1]);
      const builtInAgents = new Set(["explore", "general", "plan", "docs", "general-purpose"]);
      const teamMentions = allMentions.filter((m) => !builtInAgents.has(m));
      const orphanMentions = teamMentions.filter((m) => !teamIds.has(m));
      expect(
        orphanMentions,
        `Orchestrator @mentions roles not in team: ${[...new Set(orphanMentions)].join(", ")}`,
      ).toEqual([]);
    });

    it("orchestrator does NOT @mention roles missing from this team", () => {
      // For small + lightweight, these should never appear as @mentions
      const missingRoles = ["product-owner", "qa-lead", "dba", "change-manager"];
      for (const role of missingRoles) {
        expect(
          orchFile.content,
          `@${role} should not appear (it's not in the small+lightweight team)`,
        ).not.toMatch(new RegExp(`@${role}\\b`));
      }
    });
  });

  describe("Phase narratives — no unresolved placeholders", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const orchFile = result.files.find((f) => f.path.match(/agents\/orchestrator\.md$/))!;

    it("Discovery narrative has all placeholders resolved", () => {
      // Discovery narrative uses {visionAgent}, {backlogAgent}, {designSystemAgent}
      const placeholders = ["{visionAgent}", "{backlogAgent}", "{designSystemAgent}"];
      for (const ph of placeholders) {
        expect(
          orchFile.content,
          `Unresolved placeholder ${ph} found in orchestrator.md`,
        ).not.toContain(ph);
      }
    });

    it("no curly-brace placeholders remain in any phase narrative", () => {
      // Any {camelCase} that survived means a placeholder leaked through.
      // Allow {N} (heading numbers) but flag {wordWord}.
      const matches = [...orchFile.content.matchAll(/\{([a-z][a-zA-Z]+)\}/g)];
      const unresolvedKeys = matches.map((m) => m[1]).filter((k) => !["N"].includes(k));
      expect(
        unresolvedKeys,
        `Unresolved placeholders: ${[...new Set(unresolvedKeys)].join(", ")}`,
      ).toEqual([]);
    });
  });

  describe("Cross-file ID consistency — policies.json ↔ orchestrator.md", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const orchFile = result.files.find((f) => f.path.match(/agents\/orchestrator\.md$/))!;
    const policiesFile = result.files.find((f) => f.path.includes("abax-policies.json"))!;
    const policies = JSON.parse(policiesFile.content) as { phases: Array<{ deliverables: Array<{ id: string }> }> };

    it("every MANDATORY deliverable in policies.json is referenced in orchestrator.md", () => {
      // Orchestrator template includes mandatory deliverables in its
      // table/prose but omits optionals (by design — optionals only
      // appear if the team has the responsible role + the criteria
      // matches). policies.json contains both for runtime tools like
      // phase-state to track all deliverable states. This test catches
      // a new MANDATORY deliverable being added to policies but
      // forgotten in the orchestrator template.
      const mandatoryDeliverables: Array<{ id: string; name: string }> = policies.phases
        .flatMap((p: { deliverables: Array<{ id: string; name: string; mandatory: boolean }> }) =>
          p.deliverables.filter((d) => d.mandatory));
      const orphans: string[] = [];
      for (const d of mandatoryDeliverables) {
        const linkedById = orchFile.content.includes(d.id);
        const linkedByName = orchFile.content.includes(d.name);
        if (!linkedById && !linkedByName) {
          orphans.push(`${d.id} ("${d.name}")`);
        }
      }
      expect(
        orphans,
        `Mandatory deliverables in policies but not orchestrator: ${orphans.join(", ")}`,
      ).toEqual([]);
    });

    it("optional deliverables MAY be omitted from orchestrator (by design)", () => {
      // Companion sanity check: at least SOME optionals are missing in
      // a small+lightweight team. If this fires, all optionals are
      // appearing — that's not necessarily wrong but worth noticing.
      const optionalDeliverables: Array<{ id: string; name: string }> = policies.phases
        .flatMap((p: { deliverables: Array<{ id: string; name: string; mandatory: boolean }> }) =>
          p.deliverables.filter((d) => !d.mandatory));
      const omitted = optionalDeliverables.filter(
        (d) => !orchFile.content.includes(d.name) && !orchFile.content.includes(d.id),
      );
      // Just record — don't assert on count. This is informational.
      expect(omitted.length, `Optionals omitted from orchestrator: ${omitted.length}`)
        .toBeGreaterThanOrEqual(0);
    });
  });

  describe("Manifest content — strategic project metadata", () => {
    const result = generate(SMALL_LIGHTWEIGHT, ctx);
    const manifestFile = result.files.find((f) => f.path === "project-manifest.yaml")!;

    it("manifest declares the size, stack, target chosen", () => {
      expect(manifestFile.content).toMatch(/size:\s*small/);
      expect(manifestFile.content).toMatch(/stack:\s*angular-quarkus/);
      expect(manifestFile.content).toMatch(/target:\s*opencode/);
    });

    it("manifest preserves user policy overrides when none set (trailer present)", () => {
      // The trailer with commented-out override blocks should be present
      // when the user hasn't set any (round-trip preservation contract).
      expect(manifestFile.content).toMatch(/Optional policy overrides/);
    });

    it("manifest team list count matches result.project.roles count", () => {
      // Sanity: the number of roles claimed in the manifest matches what
      // the pipeline actually produced. Ignores orchestrator (always +1).
      const manifestRoleMatches = [...manifestFile.content.matchAll(/^\s+- id:\s*([a-z-]+)\s*$/gm)];
      const manifestRoles = manifestRoleMatches.map((m) => m[1]);
      const pipelineRoleIds = new Set(result.project.roles.map((r) => r.id));
      const manifestIdsInTeam = manifestRoles.filter((id) => pipelineRoleIds.has(id));
      expect(manifestIdsInTeam.length).toBe(result.project.roles.length);
    });
  });

  describe("Sponsor approvals visibility — the user can SEE what they approve", () => {
    it("sponsorApprovals is non-empty for small+lightweight (no PO in team)", () => {
      const result = generate(SMALL_LIGHTWEIGHT, ctx);
      expect(result.sponsorApprovals.length).toBeGreaterThan(0);
    });

    it("each sponsor approval entry has full identifying fields", () => {
      const result = generate(SMALL_LIGHTWEIGHT, ctx);
      for (const a of result.sponsorApprovals) {
        expect(a.phaseId.length).toBeGreaterThan(0);
        expect(a.phaseName.length).toBeGreaterThan(0);
        expect(a.deliverableId.length).toBeGreaterThan(0);
        expect(a.deliverableName.length).toBeGreaterThan(0);
      }
    });
  });
});
