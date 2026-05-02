import { describe, it, expect, beforeAll } from "vitest";
import { parse as yamlParse } from "yaml";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import {
  teamUsesPresentations as teamUsesPresentationsForPages,
  generatePagesWorkflow,
} from "../../src/generator/pages-generator.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "deploy-pages-test",
    description: "test",
    targetDir: "/tmp/deploy-pages-test",
    size: "medium",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    permissionMode: "recommended",
    isolationMode: "devcontainer",
    ...overrides,
  };
}

describe("deployment-planning skill: existence and wiring", () => {
  it("skill exists with the 12-topic instructions", () => {
    const skill = ctx.skills.get("deployment-planning");
    expect(skill).toBeDefined();
    const text = skill!.content.instructions;
    // Check the 12 topics are explicitly enumerated
    for (const topic of [
      "Donde se despliega",
      "Como se despliega",
      "URL publica y dominio",
      "DNS + TLS",
      "Modelo de exposicion",
      "Secrets management",
      "Monitoring",
      "Rollback",
      "Backup",
      "Comunicacion",
      "Compliance",
      "SLO/SLA",
    ]) {
      expect(text, `topic ${topic}`).toContain(topic);
    }
  });

  it("is referenced by the 4 expected roles", () => {
    const skill = ctx.skills.get("deployment-planning")!;
    for (const r of ["devops", "project-manager", "solution-architect", "security-architect"]) {
      expect(skill.used_by, `should list ${r}`).toContain(r);
    }
  });

  it("each of the 4 roles declares the skill", () => {
    for (const r of ["devops", "project-manager", "solution-architect", "security-architect"]) {
      const role = ctx.roles.get(r)!;
      expect(role.skills, `${r}.skills`).toContain("deployment-planning");
    }
  });

  it("emphasises that web/API services without public URL are NOT in production", () => {
    const skill = ctx.skills.get("deployment-planning")!;
    const text = skill.content.instructions;
    expect(text).toMatch(/Si NO va a estar publico|servicio o web y NO se publica/i);
  });
});

describe("phase-deliverables: deployment-plan-doc has product-owner approver (sponsor proxy)", () => {
  it("deployment phase deployment-plan-doc is approved by product-owner, not tech-lead", () => {
    const phase = ctx.phaseDeliverables.phases.find((p) => p.id === "deployment")!;
    const planDoc = phase.deliverables.find((d) => d.id === "deployment-plan-doc")!;
    expect(planDoc).toBeDefined();
    expect(planDoc.responsible).toBe("devops");
    expect(planDoc.approver).toBe("product-owner");
    expect(planDoc.mandatory).toBe(true);
  });

  it("deployment-plan-doc is the FIRST deliverable in deployment phase", () => {
    const phase = ctx.phaseDeliverables.phases.find((p) => p.id === "deployment")!;
    expect(phase.deliverables[0]!.id).toBe("deployment-plan-doc");
  });
});

describe("orchestrator template: Protocolo de inicio de fase Despliegue", () => {
  it("opencode orchestrator emits the deployment block when team has the right roles (medium project)", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de inicio de fase Despliegue");
    expect(orch.content).toContain("deployment-plan-doc");
    expect(orch.content).toContain("deployment-planning");
    expect(orch.content).toMatch(/12 preguntas/);
    expect(orch.content).toMatch(/URL publica.*dominio/i);
    expect(orch.content).toMatch(/aprobacion EXPLICITA del usuario sponsor/i);
  });

  it("does NOT emit the deployment block when devops AND tech-lead are both absent", () => {
    // teamScope=lean + size=small → minimal team, may lack both. Use a manual list.
    const config = baseConfig({ size: "small", teamScope: "lean" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    const teamHasLeader = result.project.roles.some((r) => r.id === "devops" || r.id === "tech-lead");
    if (!teamHasLeader) {
      expect(orch.content).not.toContain("Protocolo de inicio de fase Despliegue");
    } else {
      // Most lean teams DO have tech-lead, so the section appears with tech-lead as lead
      expect(orch.content).toContain("Protocolo de inicio de fase Despliegue");
    }
  });

  it("claude orchestrator also emits the protocol", () => {
    const config = baseConfig({ target: "claude" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toContain("Protocolo de inicio de fase Despliegue");
    expect(orch.content).toMatch(/URL publica.*dominio/i);
  });
});

describe("pages-generator: GitHub Pages workflow", () => {
  it("teamUsesPresentations returns true when presentation-design is present", () => {
    expect(teamUsesPresentationsForPages([{ id: "presentation-design" } as never])).toBe(true);
    expect(teamUsesPresentationsForPages([{ id: "other" } as never])).toBe(false);
  });

  it("emits .github/workflows/pages.yml when team uses presentation-design", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const wf = result.files.find((f) => f.path === ".github/workflows/pages.yml");
    expect(wf).toBeDefined();
  });

  it("does NOT emit pages.yml when no agent uses presentation-design", () => {
    // Need a team that excludes all 6 presentation-design users. Hard with full
    // teams; use lean small.
    const config = baseConfig({ size: "small", teamScope: "lean" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const teamHasPresentations = result.project.skills.some((s) => s.id === "presentation-design");
    const wf = result.files.find((f) => f.path === ".github/workflows/pages.yml");
    if (teamHasPresentations) {
      expect(wf).toBeDefined();
    } else {
      expect(wf).toBeUndefined();
    }
  });

  it("workflow YAML is valid and has expected structure", () => {
    const wf = generatePagesWorkflow();
    const parsed = yamlParse(wf.content);
    expect(parsed.name).toMatch(/Pages/i);
    expect(parsed.on?.push?.branches).toContain("main");
    expect(parsed.permissions?.pages).toBe("write");
    expect(parsed.permissions?.["id-token"]).toBe("write");
    expect(parsed.jobs?.build).toBeDefined();
    expect(parsed.jobs?.deploy).toBeDefined();
    expect(parsed.jobs?.deploy?.needs).toBe("build");
    expect(parsed.jobs?.deploy?.environment?.name).toBe("github-pages");
    // Concurrency group should be 'pages' to allow safe queueing
    expect(parsed.concurrency?.group).toBe("pages");
    expect(parsed.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("workflow auto-detects mkdocs.yml vs static docs/", () => {
    const wf = generatePagesWorkflow();
    expect(wf.content).toContain("if [ -f mkdocs.yml ]");
    expect(wf.content).toContain("mkdocs build");
    expect(wf.content).toContain("cp -R docs/. _site/");
  });
});

describe("audit: presentation roles matrix (no overlap, no orphan responsibilities)", () => {
  // Parse the markdown table inside presentation-design.yaml's instructions.
  function parseGobernanzaTable(): Array<{ phase: string; presentation: string; responsible: string }> {
    const skill = ctx.skills.get("presentation-design")!;
    const text = skill.content.instructions;
    // Find the "Gobernanza de Presentaciones por Fase" section table
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => /Gobernanza de Presentaciones por Fase/.test(l));
    expect(start, "Gobernanza section must exist").toBeGreaterThanOrEqual(0);
    const rows: Array<{ phase: string; presentation: string; responsible: string }> = [];
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]!.trim();
      if (l.startsWith("##")) break;
      if (!l.startsWith("|") || /\|---/.test(l) || /\| Fase/.test(l)) continue;
      const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length < 6) continue;
      rows.push({ phase: cells[0]!, presentation: cells[1]!, responsible: cells[3]! });
    }
    return rows;
  }

  it("the gobernanza table has at least 8 entries", () => {
    const rows = parseGobernanzaTable();
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  it("no two rows share the same (phase, presentation) pair", () => {
    const rows = parseGobernanzaTable();
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.phase}::${r.presentation}`;
      expect(seen.has(key), `duplicate row: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  // Map human-readable role names from the table to canonical role IDs
  const ROLE_NAME_TO_ID: Record<string, string> = {
    "Project Manager": "project-manager",
    "Product Owner": "product-owner",
    "Product Owner + BA": "product-owner",
    "Business Analyst": "business-analyst",
    "Solution Architect": "solution-architect",
    "QA Lead": "qa-lead",
    "Tech Lead": "tech-lead",
    "Tech Lead + PM": "tech-lead",
    "Change Manager": "change-manager",
  };

  it("every responsible role in the table declares presentation-design skill", () => {
    const rows = parseGobernanzaTable();
    const presentationDesignUsers = new Set(ctx.skills.get("presentation-design")!.used_by);
    const offenders: string[] = [];
    for (const r of rows) {
      const roleId = ROLE_NAME_TO_ID[r.responsible];
      if (!roleId) {
        offenders.push(`unmapped role name: "${r.responsible}"`);
        continue;
      }
      const role = ctx.roles.get(roleId);
      if (!role) {
        offenders.push(`role id "${roleId}" missing in data/roles/`);
        continue;
      }
      if (!presentationDesignUsers.has(roleId)) {
        offenders.push(`role "${roleId}" responsible for "${r.presentation}" but not listed in presentation-design.used_by`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
