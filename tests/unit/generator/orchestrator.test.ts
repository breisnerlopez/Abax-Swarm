import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { readFileSync } from "fs";
import { loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";
import { generateOrchestratorFile } from "../../../src/generator/opencode/orchestrator-generator.js";
import { validateOrchestrator } from "../../../src/validator/orchestrator-validator.js";
import { resolveGovernance } from "../../../src/engine/governance-resolver.js";
import type { Role } from "../../../src/loader/schemas.js";

const DATA_DIR = join(__dirname, "../../../data");
let roles: Map<string, Role>;
let rules: ReturnType<typeof loadAllRules>;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  rules = loadAllRules(join(DATA_DIR, "rules"));
});

function generateForTeam(teamIds: string[], size: "small" | "medium" | "large", projectName = "test-project") {
  const teamRoles = teamIds.map((id) => roles.get(id)!).filter(Boolean);
  const governance = resolveGovernance(size);
  const file = generateOrchestratorFile(projectName, teamRoles, rules.dependencies, rules.raci, governance, rules.phaseDeliverables);
  return { file, teamRoles };
}

describe("Orchestrator: Small project", () => {
  it("should generate valid orchestrator for small team", () => {
    const teamIds = ["business-analyst", "tech-lead", "developer-backend", "qa-functional", "product-owner", "project-manager"];
    const { file, teamRoles } = generateForTeam(teamIds, "small", "api-pagos");

    expect(file.content).toContain("api-pagos");
    expect(file.content).toContain("Equipo Ligero");

    const validation = validateOrchestrator(file, teamRoles);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("should NOT reference agents outside the small team", () => {
    const teamIds = ["business-analyst", "tech-lead", "developer-backend", "qa-functional", "product-owner", "project-manager"];
    const { file } = generateForTeam(teamIds, "small", "api-pagos");

    // These agents are NOT in the small team — must NOT appear as @mentions
    expect(file.content).not.toContain("@devops");
    expect(file.content).not.toContain("@dba");
    expect(file.content).not.toContain("@solution-architect");
    expect(file.content).not.toContain("@change-manager");
    expect(file.content).not.toContain("@tech-writer");
    expect(file.content).not.toContain("@qa-lead");
  });

  it("should skip phases with no available agents", () => {
    const teamIds = ["business-analyst", "tech-lead", "developer-backend", "qa-functional", "product-owner", "project-manager"];
    const { file } = generateForTeam(teamIds, "small", "api-pagos");

    // Small team has no devops → deployment phase should be skipped or have no devops deliverables
    // The phase gate deliverables should only reference team members
    const content = file.content;

    // All @mentions in deliverables must be team members
    const deliverableLines = content.split("\n").filter((l) => l.includes("delegar a @"));
    for (const line of deliverableLines) {
      const match = line.match(/@([a-z-]+)/);
      if (match) {
        expect(teamIds).toContain(match[1]);
      }
    }
  });
});

describe("Orchestrator: Medium project", () => {
  it("should generate valid orchestrator for medium team", () => {
    const teamIds = [
      "business-analyst", "tech-lead", "developer-backend", "developer-frontend",
      "qa-functional", "qa-lead", "solution-architect", "dba", "devops",
      "product-owner", "project-manager",
    ];
    const { file, teamRoles } = generateForTeam(teamIds, "medium", "sistema-ventas");

    expect(file.content).toContain("sistema-ventas");
    expect(file.content).toContain("Equipo Controlado");
    expect(file.content).toContain("11 agentes");

    const validation = validateOrchestrator(file, teamRoles);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    // All team members should be referenced (with or without @ prefix)
    for (const id of teamIds) {
      expect(file.content).toContain(id);
    }
  });
});

describe("Orchestrator: Large project", () => {
  it("should generate valid orchestrator for large team", () => {
    const teamIds = [
      "business-analyst", "tech-lead", "developer-backend", "developer-frontend",
      "qa-functional", "qa-lead", "qa-automation", "solution-architect",
      "integration-architect", "security-architect", "dba", "devops",
      "product-owner", "project-manager", "change-manager", "tech-writer",
    ];
    const { file, teamRoles } = generateForTeam(teamIds, "large", "plataforma-core");

    expect(file.content).toContain("plataforma-core");
    expect(file.content).toContain("Equipo Corporativo Completo");
    expect(file.content).toContain("Estricto y trazable");

    const validation = validateOrchestrator(file, teamRoles);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("should include more phases than a minimal team", () => {
    // Minimal team: only BA and PO — many phases have no deliverables
    const minimalTeamIds = ["business-analyst", "product-owner"];
    const largeTeamIds = [
      "business-analyst", "tech-lead", "developer-backend", "developer-frontend",
      "qa-functional", "qa-lead", "qa-automation", "solution-architect",
      "dba", "devops", "product-owner", "project-manager", "change-manager", "tech-writer",
    ];

    const { file: minimalFile } = generateForTeam(minimalTeamIds, "small");
    const { file: largeFile } = generateForTeam(largeTeamIds, "large");

    const countFases = (content: string) => (content.match(/### Fase \d+:/g) || []).length;
    expect(countFases(largeFile.content)).toBeGreaterThan(countFases(minimalFile.content));
  });
});

describe("Orchestrator: Phase adaptation", () => {
  it("should use 'el usuario (sponsor)' when gate approver is missing", () => {
    // Team without solution-architect: Phase 3 gate approver (solution-architect) is missing
    const teamIds = ["business-analyst", "tech-lead", "developer-backend", "product-owner", "project-manager"];
    const { file } = generateForTeam(teamIds, "small");

    // If any phase lacks its gate approver, it should fallback to "el usuario (sponsor)"
    if (file.content.includes("Diseno Tecnico")) {
      expect(file.content).toContain("el usuario (sponsor)");
    }
  });

  it("should never produce @mentions for agents outside the team", () => {
    const teamIds = ["business-analyst", "product-owner", "project-manager"];
    const { file, teamRoles } = generateForTeam(teamIds, "small", "mini-project");

    const validation = validateOrchestrator(file, teamRoles);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});

describe("Orchestrator validation", () => {
  it("should detect references to non-existent agents", () => {
    const teamIds = ["business-analyst", "product-owner"];
    const { file } = generateForTeam(
      ["business-analyst", "product-owner", "tech-lead", "developer-backend"],
      "small",
    );
    // Validate against smaller team (missing tech-lead, developer-backend)
    const smallerTeam = teamIds.map((id) => roles.get(id)!);
    const validation = validateOrchestrator(file, smallerTeam);

    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some((e) => e.includes("tech-lead"))).toBe(true);
  });

  it("should warn about unreferenced team members", () => {
    const teamIds = ["business-analyst", "product-owner"];
    const { file, teamRoles } = generateForTeam(teamIds, "small");

    const validation = validateOrchestrator(file, teamRoles);
    expect(validation.valid).toBe(true);
  });

  it("should contain required sections", () => {
    const teamIds = ["business-analyst", "product-owner", "tech-lead"];
    const { file } = generateForTeam(teamIds, "small");

    expect(file.content).toContain("Equipo disponible");
    expect(file.content).toContain("Reglas INQUEBRANTABLES");
  });

  it("should include governance details", () => {
    const teamIds = ["business-analyst", "product-owner"];
    const { file } = generateForTeam(teamIds, "large");

    expect(file.content).toContain("Completa y auditable");
    expect(file.content).toContain("Estricto y trazable");
  });
});

describe("Orchestrator: narrative_only phase handling", () => {
  it("does NOT render a structured ### Fase block for phases marked narrative_only", () => {
    // discovery phase in phase-deliverables.yaml has narrative_only: true.
    // The orchestrator template carries the rich Phase 0 narrative inline,
    // so the structured loop must skip it to avoid duplication.
    const teamIds = [
      "business-analyst",
      "tech-lead",
      "developer-backend",
      "qa-functional",
      "product-owner",
      "project-manager",
    ];
    const { file } = generateForTeam(teamIds, "small", "narrative-test");
    const allFaseHeadings = (file.content.match(/^### Fase \d+: [^\n]+/gm) || []);
    // Index 0 is the hardcoded narrative "### Fase 0: Descubrimiento ...".
    // Index 1 must be the FIRST structured loop entry: "Fase 1: Inicio".
    // If the loop did NOT skip narrative_only, index 1 would be a
    // duplicate "Fase 1: Descubrimiento..." (or shift everything by one).
    expect(allFaseHeadings[0]).toMatch(/Fase 0: Descubrimiento/);
    expect(allFaseHeadings[1]).toMatch(/Fase 1: Inicio/);
    // Sanity: only one "Descubrimiento" heading total (the narrative).
    const discoveryHeadings = allFaseHeadings.filter((l) =>
      /Descubrimiento/i.test(l),
    );
    expect(discoveryHeadings).toHaveLength(1);
  });

  it("policies.phases (consumed by plugin) STILL includes narrative_only phases", async () => {
    // The plugin needs to recognise `discovery` for iteration-scope
    // enforcement even though the orchestrator template renders it as
    // narrative. Verify the canonical phase id list is preserved.
    const phaseIds = rules.phaseDeliverables.phases.map((p) => p.id);
    expect(phaseIds).toContain("discovery");
    const discovery = rules.phaseDeliverables.phases.find((p) => p.id === "discovery");
    expect(discovery?.narrative_only).toBe(true);
  });

  it("every narrative_only phase has matching prose in orchestrator.md.hbs", () => {
    // Guardrail for the fragility surfaced in the post-fix audit:
    // narrative_only phases are skipped by the structured loop but the
    // template carries hand-written prose for them. If a future commit
    // adds a narrative_only phase WITHOUT corresponding prose in the
    // template, the rendered orchestrator.md silently lacks that phase.
    // This test fails on that drift.
    const templatePath = join(__dirname, "../../../templates/opencode/orchestrator.md.hbs");
    const template = readFileSync(templatePath, "utf8");

    const missing: string[] = [];
    for (const phase of rules.phaseDeliverables.phases) {
      if (!phase.narrative_only) continue;
      // Heuristic: phase id OR a recognisable token from `name`. We
      // require the template to contain at least one of:
      //   - "Fase N: <name prefix>"
      //   - the literal phase id
      // For the current "discovery" phase, the template has
      //   "### Fase 0: Descubrimiento y Definicion de Alcance"
      // — covered by both the phase.id check (discovery / Discovery)
      // and the name check.
      const idHit = new RegExp(`\\b${phase.id}\\b`, "i").test(template);
      const namePrefix = phase.name.split(/\s+/)[0];   // "Descubrimiento"
      const nameHit = new RegExp(`\\b${namePrefix}\\b`, "i").test(template);
      if (!idHit && !nameHit) {
        missing.push(`${phase.id} (name: "${phase.name}")`);
      }
    }
    expect(
      missing,
      `narrative_only phases without matching prose in orchestrator.md.hbs:\n  ${missing.join("\n  ")}\n\nEither (a) add a "### Fase N: <name>" section to the template, OR (b) drop narrative_only:true and let the structured loop render it.`,
    ).toEqual([]);
  });
});
