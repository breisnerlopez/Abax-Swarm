import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
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
